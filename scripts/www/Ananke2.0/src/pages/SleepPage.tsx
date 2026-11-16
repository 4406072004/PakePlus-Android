import React, { useState, useMemo, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Moon, 
  Plus, 
  Share2, 
  Lock, 
  Trash2, 
  Edit3, 
  Calendar, 
  Sparkles, 
  Check, 
  X, 
  Info, 
  Heart, 
  Send, 
  Droplets, 
  Clock, 
  Coffee, 
  Flame, 
  TrendingUp, 
  BarChart2, 
  PieChart, 
  AlertTriangle,
  Smile,
  Shield,
  CheckCircle2
} from 'lucide-react';
import { SleepRecord, PhoneSettings, Message, PeriodRecord, Character } from '../types';
import { StorageService } from '../services/StorageService';

interface SleepPageProps {
  character?: Character;
  sleepRecords: SleepRecord[];
  onAddSleepRecord: (record: SleepRecord) => void;
  onUpdateSleepRecord?: (record: SleepRecord) => void;
  onDeleteSleepRecord?: (id: string) => void;
  periodRecords?: PeriodRecord[];
  onUpdatePeriodRecords?: (records: PeriodRecord[]) => void;
  settings?: PhoneSettings;
  onUpdateSettings?: (updates: Partial<PhoneSettings>) => void;
  onSendMessage?: (msg: Message) => void;
  onNavigateToChat?: () => void;
  onBack: () => void;
}

// 辅助日期函数：相差天数
const getDaysDiff = (d1: string, d2: string): number => {
  try {
    const t1 = new Date(d1 + 'T00:00:00').getTime();
    const t2 = new Date(d2 + 'T00:00:00').getTime();
    return Math.round(Math.abs(t2 - t1) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
};

// 辅助日期函数：增加天数
const addDaysToStr = (d: string, days: number): string => {
  try {
    const dt = new Date(d + 'T00:00:00');
    dt.setDate(dt.getDate() + days);
    return dt.toISOString().slice(0, 10);
  } catch {
    return d;
  }
};

// 作息监督规则计算
const calculateSleepTag = (sTime: string, wTime: string): { duration: number; tag: SleepRecord['tag'] } => {
  try {
    const sParts = (sTime || '23:00').split(':').map(Number);
    const wParts = (wTime || '07:30').split(':').map(Number);
    const sH = !isNaN(sParts[0]) ? sParts[0] : 23;
    const sM = !isNaN(sParts[1]) ? sParts[1] : 0;
    const wH = !isNaN(wParts[0]) ? wParts[0] : 7;
    const wM = !isNaN(wParts[1]) ? wParts[1] : 30;

    let startMinutes = sH * 60 + sM;
    let endMinutes = wH * 60 + wM;

    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }

    const duration = Math.max(0, endMinutes - startMinutes);
    const hours = duration / 60;

    // 凌晨0点到中午12点之间入睡视为熬夜 (12点后睡)
    const isAfterMidnight = sH >= 0 && sH < 12;

    let tag: SleepRecord['tag'] = 'good';
    if (isAfterMidnight) {
      tag = 'late'; // 红色 熬夜
    } else if (hours < 8) {
      tag = 'insufficient'; // 黄色 睡眠不足
    } else {
      tag = 'good'; // 绿色 规律早睡 (12点前且满8小时)
    }

    return { duration, tag };
  } catch {
    return { duration: 480, tag: 'good' };
  }
};

export const SleepPage: React.FC<SleepPageProps> = ({
  character,
  sleepRecords,
  onAddSleepRecord,
  onUpdateSleepRecord,
  onDeleteSleepRecord,
  periodRecords,
  onUpdatePeriodRecords,
  settings,
  onUpdateSettings,
  onSendMessage,
  onNavigateToChat,
  onBack,
}) => {
  // 顶层子板块切换：睡眠监督打卡 vs 经期记录
  const [activeTab, setActiveTab] = useState<'sleep' | 'period'>('sleep');

  // 当前日历浏览的年与月
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth() + 1); // 1 ~ 12

  // 今天日期字符串
  const todayDateStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Toast 提示
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 2400);
  };

  // -------------------------------------------------------------
  // 一、经期数据与逻辑
  // -------------------------------------------------------------
  const [periods, setPeriods] = useState<PeriodRecord[]>(() => {
    if (Array.isArray(periodRecords)) return periodRecords;
    return StorageService.getPeriodRecords();
  });

  useEffect(() => {
    if (Array.isArray(periodRecords)) {
      setPeriods(periodRecords);
    }
  }, [periodRecords]);

  const updatePeriodsAndPersist = (newRecords: PeriodRecord[]) => {
    setPeriods(newRecords);
    if (onUpdatePeriodRecords) {
      onUpdatePeriodRecords(newRecords);
    } else {
      StorageService.savePeriodRecords(newRecords);
    }
  };

  // 经期删除确认弹窗状态与删除操作 (删除后日历同步清除并重新计算周期)
  const [deletePeriodCycleId, setDeletePeriodCycleId] = useState<string | null>(null);

  const handleConfirmDeletePeriod = () => {
    if (!deletePeriodCycleId) return;
    const targetId = deletePeriodCycleId;
    const next = periods.filter(p => p.id !== targetId);
    updatePeriodsAndPersist(next);
    setDeletePeriodCycleId(null);
    showToast('已删除该条经期记录，日历已同步更新并重新计算周期');
  };

  // 按开始日期升序排序
  const sortedPeriods = useMemo(() => {
    return [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [periods]);

  // 统计生理周期 (Cycle Length) 与 行经天数 (Period Duration)
  const cycleStats = useMemo(() => {
    // 计算周期长度 (相邻开始日之间的间隔天数)
    const cycleIntervals: number[] = [];
    for (let i = 1; i < sortedPeriods.length; i++) {
      const prev = sortedPeriods[i - 1].startDate;
      const curr = sortedPeriods[i].startDate;
      const diff = getDaysDiff(prev, curr);
      if (diff >= 15 && diff <= 60) {
        cycleIntervals.push(diff);
      }
    }

    // 计算行经天数 (结束日 - 开始日 + 1)
    const periodDurations: number[] = [];
    sortedPeriods.forEach(p => {
      if (p.endDate) {
        const d = getDaysDiff(p.startDate, p.endDate) + 1;
        if (d >= 2 && d <= 15) {
          periodDurations.push(d);
        }
      }
    });

    // 平均周期长度，默认28天
    const avgCycleLength = cycleIntervals.length > 0
      ? Math.round(cycleIntervals.reduce((a, b) => a + b, 0) / cycleIntervals.length)
      : 28;

    // 平均行经天数，默认5天
    const avgPeriodDuration = periodDurations.length > 0
      ? Math.round(periodDurations.reduce((a, b) => a + b, 0) / periodDurations.length)
      : 5;

    // 最新记录周期
    const latestCycle = sortedPeriods.length > 0 ? sortedPeriods[sortedPeriods.length - 1] : null;

    // 判断今天是否正处于经期中
    let isInPeriodNow = false;
    let ongoingPeriodDay = 1;
    let activeCycleId: string | null = null;

    if (latestCycle) {
      if (!latestCycle.endDate) {
        // 未标注结束
        if (todayDateStr >= latestCycle.startDate) {
          const diff = getDaysDiff(latestCycle.startDate, todayDateStr) + 1;
          if (diff <= 14) {
            isInPeriodNow = true;
            ongoingPeriodDay = diff;
            activeCycleId = latestCycle.id;
          }
        }
      } else {
        // 已有结束日
        if (todayDateStr >= latestCycle.startDate && todayDateStr <= latestCycle.endDate) {
          isInPeriodNow = true;
          ongoingPeriodDay = getDaysDiff(latestCycle.startDate, todayDateStr) + 1;
          activeCycleId = latestCycle.id;
        }
      }
    }

    // 预估下一次生理周期
    let predictedNextStartDate: string | null = null;
    let predictedNextEndDate: string | null = null;
    let daysUntilNextPeriod: number | null = null;

    if (latestCycle) {
      predictedNextStartDate = addDaysToStr(latestCycle.startDate, avgCycleLength);
      predictedNextEndDate = addDaysToStr(predictedNextStartDate, avgPeriodDuration - 1);
      
      const tNext = new Date(predictedNextStartDate + 'T00:00:00').getTime();
      const tNow = new Date(todayDateStr + 'T00:00:00').getTime();
      daysUntilNextPeriod = Math.round((tNext - tNow) / (1000 * 60 * 60 * 24));
    }

    return {
      avgCycleLength,
      avgPeriodDuration,
      latestCycle,
      isInPeriodNow,
      ongoingPeriodDay,
      activeCycleId,
      predictedNextStartDate,
      predictedNextEndDate,
      daysUntilNextPeriod,
    };
  }, [sortedPeriods, todayDateStr]);

  // 经期日历中被点击的日期详情弹窗
  const [selectedPeriodDate, setSelectedPeriodDate] = useState<string | null>(null);
  const [periodModalData, setPeriodModalData] = useState<{
    isPeriodDay: boolean;
    hasPain: boolean;
    isStartDay: boolean;
    isEndDay: boolean;
  }>({
    isPeriodDay: false,
    hasPain: false,
    isStartDay: false,
    isEndDay: false,
  });

  // 打开经期某日弹窗
  const handleOpenPeriodDateModal = (dateStr: string) => {
    setSelectedPeriodDate(dateStr);
    
    // 检查此日期是否落在任何经期内
    const isPeriodDay = sortedPeriods.some(p => {
      const end = p.endDate || (p.id === cycleStats.activeCycleId ? addDaysToStr(p.startDate, 10) : p.startDate);
      return dateStr >= p.startDate && dateStr <= end;
    });

    const isStartDay = sortedPeriods.some(p => p.startDate === dateStr);
    const isEndDay = sortedPeriods.some(p => p.endDate === dateStr);
    const hasPain = sortedPeriods.some(p => p.painDates?.includes(dateStr));

    setPeriodModalData({
      isPeriodDay,
      hasPain,
      isStartDay,
      isEndDay,
    });
  };

  // 经期弹窗中保存该日期的痛经和经期状态
  const handleSavePeriodDateModal = () => {
    if (!selectedPeriodDate) return;
    const dateStr = selectedPeriodDate;

    let updated = [...sortedPeriods];

    // 痛经记录处理：如果勾选了痛经，将其加入对应的周期或最新周期的 painDates 中
    if (periodModalData.hasPain) {
      // 找到覆盖该日期的周期，若没有则挂载到最近周期或新建
      const matchIdx = updated.findIndex(p => {
        const end = p.endDate || addDaysToStr(p.startDate, 12);
        return dateStr >= p.startDate && dateStr <= end;
      });

      if (matchIdx >= 0) {
        const p = updated[matchIdx];
        const pains = Array.isArray(p.painDates) ? [...p.painDates] : [];
        if (!pains.includes(dateStr)) pains.push(dateStr);
        updated[matchIdx] = { ...p, painDates: pains };
      } else {
        // 如果无对应周期，挂在最新一条，或新建以该日为起点的轻周期
        if (updated.length > 0) {
          const last = updated[updated.length - 1];
          const pains = Array.isArray(last.painDates) ? [...last.painDates] : [];
          if (!pains.includes(dateStr)) pains.push(dateStr);
          updated[updated.length - 1] = { ...last, painDates: pains };
        } else {
          updated.push({
            id: 'period_' + Date.now(),
            startDate: dateStr,
            painDates: [dateStr],
          });
        }
      }
    } else {
      // 取消痛经
      updated = updated.map(p => ({
        ...p,
        painDates: (p.painDates || []).filter(d => d !== dateStr),
      }));
    }

    // 如果用户在弹窗中选择将今天/该日设为开始日
    if (periodModalData.isStartDay) {
      const exists = updated.find(p => p.startDate === dateStr);
      if (!exists) {
        updated.push({
          id: 'period_' + Date.now(),
          startDate: dateStr,
          painDates: periodModalData.hasPain ? [dateStr] : [],
        });
      }
    }

    // 如果用户在弹窗中选择将今天/该日设为结束日
    if (periodModalData.isEndDay) {
      // 找到最近一个未结束的周期并设为该日
      const openIdx = updated.findIndex(p => !p.endDate && p.startDate <= dateStr);
      if (openIdx >= 0) {
        updated[openIdx] = { ...updated[openIdx], endDate: dateStr };
      } else if (updated.length > 0) {
        updated[updated.length - 1] = { ...updated[updated.length - 1], endDate: dateStr };
      }
    }

    updatePeriodsAndPersist(updated);
    setSelectedPeriodDate(null);
    showToast(periodModalData.hasPain ? `已记录 ${dateStr} 痛经并标注特殊符号！` : `已更新 ${dateStr} 经期记录`);
  };

  // 标记今天开始
  const handleMarkPeriodTodayStart = () => {
    // 检查是否已有今天开始的
    const already = sortedPeriods.find(p => p.startDate === todayDateStr);
    if (already) {
      showToast('今天已标记为经期开始日啦～');
      return;
    }

    const newCycle: PeriodRecord = {
      id: 'period_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      startDate: todayDateStr,
      painDates: [],
    };

    updatePeriodsAndPersist([...sortedPeriods, newCycle]);
    showToast('已标记今天（' + todayDateStr + '）生理期开始，梦角暖心守护已开启♡');
  };

  // 标注今天结束
  const handleMarkPeriodTodayEnd = () => {
    if (sortedPeriods.length === 0) {
      showToast('暂无进行中的经期记录哦');
      return;
    }

    // 优先匹配当前未结束的周期
    const openIdx = sortedPeriods.findIndex(p => !p.endDate);
    const targetIdx = openIdx >= 0 ? openIdx : sortedPeriods.length - 1;

    const target = sortedPeriods[targetIdx];
    if (todayDateStr < target.startDate) {
      showToast('结束日期不能早于开始日期哦');
      return;
    }

    const updated = [...sortedPeriods];
    updated[targetIdx] = {
      ...target,
      endDate: todayDateStr,
    };

    updatePeriodsAndPersist(updated);
    showToast('已标注今天（' + todayDateStr + '）生理期结束，辛苦啦宝贝～');
  };

  // 补录历史经期弹窗
  const [showAddPeriodModal, setShowAddPeriodModal] = useState(false);
  const [addPeriodStartDate, setAddPeriodStartDate] = useState(todayDateStr);
  const [addPeriodEndDate, setAddPeriodEndDate] = useState(todayDateStr);

  const handleSaveAddPeriod = () => {
    if (!addPeriodStartDate) {
      showToast('请选择经期开始日期');
      return;
    }

    if (addPeriodEndDate && addPeriodEndDate < addPeriodStartDate) {
      showToast('结束日期不能早于开始日期');
      return;
    }

    const newRec: PeriodRecord = {
      id: 'period_' + Date.now(),
      startDate: addPeriodStartDate,
      endDate: addPeriodEndDate || undefined,
      painDates: [],
    };

    updatePeriodsAndPersist([...sortedPeriods, newRec]);
    setShowAddPeriodModal(false);
    showToast('已成功补录经期记录！');
  };

  // -------------------------------------------------------------
  // 二、睡眠数据与逻辑 (作息监督 & 质量评估)
  // -------------------------------------------------------------
  const [showAddSleepModal, setShowAddSleepModal] = useState(false);
  const [recordDate, setRecordDate] = useState<string>(todayDateStr);
  const [sleepTime, setSleepTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:30');

  // 点击某一天查看、修改或删除的详情弹窗
  const [selectedRecord, setSelectedRecord] = useState<SleepRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editSleepTime, setEditSleepTime] = useState('23:00');
  const [editWakeTime, setEditWakeTime] = useState('07:30');

  // 多选生成记录表并分享（最多选 7 天）
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedShareDates, setSelectedShareDates] = useState<string[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);

  // 记录映射表：按 YYYY-MM-DD 索引
  const recordMap = useMemo(() => {
    const map = new Map<string, SleepRecord>();
    sleepRecords.forEach(rec => {
      if (rec.date) {
        map.set(rec.date, rec);
      }
    });
    return map;
  }, [sleepRecords]);

  // 月份导航切换
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(prev => prev - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(prev => prev + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
  };

  // 计算当前月的睡眠记录统计 (绿色多少天，黄色多少天，红色多少天)
  const currentMonthSleepStats = useMemo(() => {
    const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const monthRecords = sleepRecords.filter(r => r.date && r.date.startsWith(monthPrefix));

    const greenDays = monthRecords.filter(r => r.tag === 'good').length;
    const yellowDays = monthRecords.filter(r => r.tag === 'insufficient').length;
    const redDays = monthRecords.filter(r => r.tag === 'late').length;
    const totalDays = greenDays + yellowDays + redDays;

    const totalMinutes = monthRecords.reduce((acc, r) => acc + (r.durationMinutes || 0), 0);
    const avgHours = totalDays > 0 ? (totalMinutes / totalDays / 60).toFixed(1) : '0.0';

    const greenPercent = totalDays > 0 ? Math.round((greenDays / totalDays) * 100) : 0;
    const yellowPercent = totalDays > 0 ? Math.round((yellowDays / totalDays) * 100) : 0;
    const redPercent = totalDays > 0 ? Math.round((redDays / totalDays) * 100) : 0;

    // 睡眠质量评估结论：如果黄色和红色比较多，就说明睡眠质量比较差，提醒注意休息
    const badDays = yellowDays + redDays;
    const isBadQuality = totalDays > 0 && (badDays > greenDays || badDays >= Math.max(3, Math.ceil(totalDays * 0.45)));

    return {
      monthRecords,
      greenDays,
      yellowDays,
      redDays,
      totalDays,
      avgHours,
      greenPercent,
      yellowPercent,
      redPercent,
      badDays,
      isBadQuality,
    };
  }, [sleepRecords, currentYear, currentMonth]);

  // 日历网格生成通用函数
  const calendarDays = useMemo(() => {
    const totalDays = new Date(currentYear, currentMonth, 0).getDate();
    const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay();
    const leadingEmptyDays = (firstDayOfWeek + 6) % 7;

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      sleepRecord?: SleepRecord;
      isToday: boolean;
      isFuture: boolean;
      // 经期标记
      isPeriodDay: boolean;
      isPeriodStart: boolean;
      isPeriodEnd: boolean;
      hasPain: boolean;
      isPredictedPeriod: boolean;
    }> = [];

    // 填充空白
    for (let i = 0; i < leadingEmptyDays; i++) {
      days.push({
        dateStr: '',
        dayNum: 0,
        isCurrentMonth: false,
        isToday: false,
        isFuture: false,
        isPeriodDay: false,
        isPeriodStart: false,
        isPeriodEnd: false,
        hasPain: false,
        isPredictedPeriod: false,
      });
    }

    // 填充真实日期
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayDateStr;
      const isFuture = dateStr > todayDateStr;
      const sleepRecord = recordMap.get(dateStr);

      // 经期分析
      const isPeriodDay = sortedPeriods.some(p => {
        const end = p.endDate || (p.id === cycleStats.activeCycleId ? addDaysToStr(p.startDate, 7) : p.startDate);
        return dateStr >= p.startDate && dateStr <= end;
      });

      const isPeriodStart = sortedPeriods.some(p => p.startDate === dateStr);
      const isPeriodEnd = sortedPeriods.some(p => p.endDate === dateStr);
      const hasPain = sortedPeriods.some(p => p.painDates?.includes(dateStr));

      // 预估经期分析
      let isPredictedPeriod = false;
      if (cycleStats.predictedNextStartDate && cycleStats.predictedNextEndDate) {
        if (dateStr >= cycleStats.predictedNextStartDate && dateStr <= cycleStats.predictedNextEndDate) {
          isPredictedPeriod = true;
        }
      }

      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        sleepRecord,
        isToday,
        isFuture,
        isPeriodDay,
        isPeriodStart,
        isPeriodEnd,
        hasPain,
        isPredictedPeriod,
      });
    }

    return days;
  }, [currentYear, currentMonth, todayDateStr, recordMap, sortedPeriods, cycleStats]);

  // 点击睡眠日历格子
  const handleSleepDayClick = (day: typeof calendarDays[0]) => {
    if (!day.isCurrentMonth || !day.dateStr) return;

    if (isSelectMode) {
      if (!day.sleepRecord) {
        showToast('该日期暂无睡眠打卡记录');
        return;
      }
      handleToggleShareDate(day.dateStr);
      return;
    }

    if (day.sleepRecord) {
      setSelectedRecord(day.sleepRecord);
      setEditSleepTime(day.sleepRecord.sleepTime || '23:00');
      setEditWakeTime(day.sleepRecord.wakeTime || '07:30');
      setIsEditing(false);
    } else {
      if (day.isFuture) {
        showToast('未来日期还未到来哦～');
        return;
      }
      setRecordDate(day.dateStr);
      setSleepTime('23:00');
      setWakeTime('07:30');
      setShowAddSleepModal(true);
    }
  };

  // 添加或补卡保存
  const handleSaveAddSleepRecord = () => {
    const { duration, tag } = calculateSleepTag(sleepTime, wakeTime);

    const newRecord: SleepRecord = {
      id: 'sleep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      date: recordDate,
      sleepTime,
      wakeTime,
      durationMinutes: duration,
      tag,
    };

    onAddSleepRecord(newRecord);
    setShowAddSleepModal(false);
    showToast(`已完成 ${recordDate} 的睡眠打卡！`);
  };

  // 保存修改
  const handleSaveEditSleepRecord = () => {
    if (!selectedRecord) return;
    const { duration, tag } = calculateSleepTag(editSleepTime, editWakeTime);

    const updated: SleepRecord = {
      ...selectedRecord,
      sleepTime: editSleepTime,
      wakeTime: editWakeTime,
      durationMinutes: duration,
      tag,
    };

    if (onUpdateSleepRecord) {
      onUpdateSleepRecord(updated);
    } else {
      onAddSleepRecord(updated);
    }

    setSelectedRecord(updated);
    setIsEditing(false);
    showToast('睡眠打卡记录已更新');
  };

  // 删除打卡
  const handleDeleteSleepRecord = (id: string) => {
    if (onDeleteSleepRecord) {
      onDeleteSleepRecord(id);
    }
    setSelectedRecord(null);
    setIsEditing(false);
    showToast('已删除该日打卡记录');
  };

  // 多选日期切换 (最多选 7 天)
  const handleToggleShareDate = (dateStr: string) => {
    if (selectedShareDates.includes(dateStr)) {
      setSelectedShareDates(prev => prev.filter(d => d !== dateStr));
    } else {
      if (selectedShareDates.length >= 7) {
        showToast('日历上最多可选择 7 天的睡眠记录哦');
        return;
      }
      setSelectedShareDates(prev => [...prev, dateStr]);
    }
  };

  // 一键选择当月最近打卡的 7 天
  const handleQuickSelectRecent = () => {
    const availableDates = sleepRecords
      .map(r => r.date)
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 7);

    if (availableDates.length === 0) {
      showToast('暂无打卡数据可供选择');
      return;
    }
    setSelectedShareDates(availableDates);
    showToast(`已选中最近的 ${availableDates.length} 天记录`);
  };

  // 生成的 7 天记录表数据
  const shareReportData = useMemo(() => {
    const list = selectedShareDates
      .map(dateStr => recordMap.get(dateStr))
      .filter((r): r is SleepRecord => Boolean(r))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (list.length === 0) return null;

    const goodCount = list.filter(r => r.tag === 'good').length;
    const totalMinutes = list.reduce((sum, r) => sum + r.durationMinutes, 0);
    const avgHours = (totalMinutes / list.length / 60).toFixed(1);
    const goodRate = Math.round((goodCount / list.length) * 100);

    return {
      list,
      count: list.length,
      startDate: list[0]?.date,
      endDate: list[list.length - 1]?.date,
      goodCount,
      goodRate,
      avgHours,
    };
  }, [selectedShareDates, recordMap]);

  // 直接分享到聊天框
  const handleSendReportToChat = () => {
    if (!shareReportData || !onSendMessage) {
      showToast('分享功能不可用或未选择记录');
      return;
    }

    const lines: string[] = [
      `📋【我的作息健康打卡记录表】`,
      `📅 记录周期：${shareReportData.startDate} ~ ${shareReportData.endDate} (共 ${shareReportData.count} 天)`,
      `⭐ 绿色达标率：${shareReportData.goodRate}% | 平均睡眠：${shareReportData.avgHours}小时`,
      `─────────────────`,
    ];

    shareReportData.list.forEach(r => {
      const hrs = (r.durationMinutes / 60).toFixed(1);
      const tagText = r.tag === 'good' ? '🟢 绿色规律早睡' : r.tag === 'late' ? '🔴 红色熬夜晚睡' : '🟡 黄色睡眠不足';
      lines.push(`• ${r.date.slice(5)}: ${r.sleepTime}~${r.wakeTime} (${hrs}h) ${tagText}`);
    });

    lines.push(`─────────────────`);
    lines.push(`🌙 梦角监督你早点睡觉，今晚继续保持健康规律的作息哦～`);

    const messageText = lines.join('\n');

    const msg: Message = {
      id: 'msg_sleep_share_' + Date.now(),
      characterId: character?.id || 'char_default',
      sender: 'user',
      text: messageText,
      timestamp: Date.now(),
      cards: [],
      type: 'text',
      read: true,
    };

    onSendMessage(msg);
    setShowShareModal(false);
    setIsSelectMode(false);
    setSelectedShareDates([]);
    showToast('已成功分享睡眠记录表到聊天框！');
  };

  return (
    <div className="w-full h-full flex flex-col justify-between bg-neutral-100 select-none overflow-hidden relative font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/90 text-white text-xs px-3.5 py-1.5 rounded-full shadow-xl backdrop-blur-md flex items-center gap-1.5 animate-fade-in pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar */}
      <div className="h-12 px-3 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 flex items-center justify-between shrink-0 z-20">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center text-xs text-neutral-600 hover:text-neutral-900 active:scale-95 transition-all p-1 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 mr-0.5" />
          <span>返回</span>
        </button>

        <div className="flex items-center gap-1.5 font-bold text-neutral-900 text-xs">
          <span>健康中心</span>
        </div>

        {activeTab === 'sleep' ? (
          <button
            type="button"
            onClick={() => {
              setRecordDate(todayDateStr);
              setSleepTime('23:00');
              setWakeTime('07:30');
              setShowAddSleepModal(true);
            }}
            className="px-2.5 py-1 text-xs bg-neutral-900 text-white rounded-full font-medium flex items-center gap-1 hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>今日打卡</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAddPeriodStartDate(todayDateStr);
              setAddPeriodEndDate(todayDateStr);
              setShowAddPeriodModal(true);
            }}
            className="px-2.5 py-1 text-xs bg-rose-500 text-white rounded-full font-medium flex items-center gap-1 hover:bg-rose-600 active:scale-95 transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>补录经期</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
        {/* 板块容纳两个内容切换：睡眠监督打卡 & 经期记录 */}
        <div className="bg-white p-1 rounded-2xl border border-neutral-200/80 shadow-2xs flex items-center">
          <button
            type="button"
            onClick={() => setActiveTab('sleep')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              activeTab === 'sleep'
                ? 'bg-neutral-900 text-white shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-purple-400" />
            <span>睡眠监督打卡</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('period')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              activeTab === 'period'
                ? 'bg-rose-500 text-white shadow-2xs'
                : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <Droplets className="w-3.5 h-3.5 text-rose-400" />
            <span>经期记录</span>
            {cycleStats.isInPeriodNow && (
              <span className="w-2 h-2 rounded-full bg-rose-300 animate-pulse" />
            )}
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: 睡眠监督打卡内容 */}
        {/* ========================================================= */}
        {activeTab === 'sleep' && (
          <div className="space-y-3.5">
            {/* 监督早睡模式设置卡片 */}
            <div className="bg-white p-3.5 rounded-3xl border border-purple-100 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-neutral-900 block">
                      监督早睡模式 (00:00~07:00)
                    </span>
                    <span className="text-[10px] text-purple-600 font-medium">
                      梦角陪你告别熬夜
                    </span>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={settings?.forceSleepMode ?? false}
                  onChange={e => onUpdateSettings?.({ forceSleepMode: e.target.checked })}
                  className="accent-purple-600 w-4 h-4 cursor-pointer"
                />
              </div>

              {/* 最简洁的话小字标注说明 */}
              <p className="text-[10px] text-neutral-500 leading-relaxed border-t border-purple-50 pt-1.5">
                开启后每天凌晨 00:00～07:00 锁定聊天框并显示『梦角监督你早点睡觉啦』。你可以随便发消息但对方已读不回，仅 0.1% 概率偶然解锁（除非手动关闭）。
              </p>
            </div>

            {/* 日历月份收纳 & 视图 */}
            <div className="bg-white p-3.5 rounded-3xl border border-neutral-200/80 shadow-2xs space-y-3">
              {/* 月份导航栏 */}
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 cursor-pointer"
                    title="上一月"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="font-bold text-neutral-900 text-xs flex items-center gap-1 cursor-pointer" onClick={handleResetToCurrentMonth}>
                    <Calendar className="w-3.5 h-3.5 text-purple-600" />
                    <span>{currentYear}年 {currentMonth}月</span>
                    <span className="text-[10px] text-neutral-400 font-normal hover:underline ml-1">
                      (本月)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 cursor-pointer"
                    title="下一月"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* 分享记录按钮 (进入多选最多选 7 天) */}
                <div className="flex items-center gap-1.5">
                  {isSelectMode ? (
                    <div className="flex items-center gap-1 animate-fade-in">
                      <button
                        type="button"
                        onClick={handleQuickSelectRecent}
                        className="text-[10px] text-purple-600 hover:underline px-1"
                      >
                        选近7天
                      </button>
                      <button
                        type="button"
                        disabled={selectedShareDates.length === 0}
                        onClick={() => setShowShareModal(true)}
                        className="px-2 py-1 text-[10px] bg-purple-600 text-white rounded-lg font-medium disabled:opacity-40 hover:bg-purple-700 cursor-pointer shadow-2xs"
                      >
                        生成表 ({selectedShareDates.length}/7)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSelectMode(false);
                          setSelectedShareDates([]);
                        }}
                        className="text-[10px] text-neutral-400 hover:text-neutral-700 px-1"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsSelectMode(true)}
                      className="px-2 py-1 text-[10px] bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>分享周报 (最多7天)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 星期行标头 */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-neutral-400 font-medium">
                <span>一</span>
                <span>二</span>
                <span>三</span>
                <span>四</span>
                <span>五</span>
                <span>六</span>
                <span>日</span>
              </div>

              {/* 日历网格 (只标注纯纯的颜色，去除任何闪电、三角、花花emoji) */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  if (!day.isCurrentMonth) {
                    return <div key={'empty_sleep_' + idx} className="h-11 rounded-xl" />;
                  }

                  const hasRecord = Boolean(day.sleepRecord);
                  const isGood = day.sleepRecord?.tag === 'good';
                  const isLate = day.sleepRecord?.tag === 'late';
                  const isInsufficient = day.sleepRecord?.tag === 'insufficient';
                  const isSelectedForShare = selectedShareDates.includes(day.dateStr);

                  return (
                    <button
                      key={day.dateStr}
                      type="button"
                      onClick={() => handleSleepDayClick(day)}
                      className={`h-11 rounded-xl border flex flex-col items-center justify-between p-1 transition-all cursor-pointer relative ${
                        isSelectedForShare
                          ? 'border-purple-600 bg-purple-100 ring-2 ring-purple-500'
                          : isGood
                            ? 'bg-emerald-100/90 border-emerald-300 text-emerald-950 hover:bg-emerald-200'
                            : isLate
                              ? 'bg-rose-100/90 border-rose-300 text-rose-950 hover:bg-rose-200'
                              : isInsufficient
                                ? 'bg-amber-100/90 border-amber-300 text-amber-950 hover:bg-amber-200'
                                : day.isToday
                                  ? 'border-neutral-900 bg-neutral-50 text-neutral-900'
                                  : 'border-neutral-100 bg-neutral-50/40 text-neutral-700 hover:bg-neutral-100'
                      }`}
                      title={hasRecord ? `${day.dateStr}: ${day.sleepRecord?.sleepTime}~${day.sleepRecord?.wakeTime}` : day.dateStr}
                    >
                      {/* 日期数字与标记 */}
                      <div className="w-full flex items-center justify-between text-[10px] leading-none">
                        <span className={`font-mono font-bold ${day.isToday ? 'text-pink-600 font-black' : ''}`}>
                          {day.dayNum}
                        </span>
                        {day.isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />
                        )}
                        {isSelectedForShare && (
                          <Check className="w-2.5 h-2.5 text-purple-600 shrink-0 stroke-[3]" />
                        )}
                      </div>

                      {/* 中间无任何emoji，只保持整洁色彩 */}
                      <div className="w-full flex items-center justify-center text-[9px] leading-none text-neutral-400">
                        {!hasRecord && !day.isFuture && (
                          <span className="text-[9px] text-neutral-300">+</span>
                        )}
                      </div>

                      {/* 睡眠时长数字 */}
                      <div className="w-full text-center text-[9px] font-mono font-medium truncate leading-none">
                        {hasRecord ? `${(day.sleepRecord!.durationMinutes / 60).toFixed(1)}h` : ''}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 作息监督规则颜色图例 (Legend - 纯色说明) */}
              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between flex-wrap gap-1 text-[10px] text-neutral-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-300 border border-emerald-400" />
                  <span>绿色：规律早睡 (12点前满8h)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-300 border border-amber-400" />
                  <span>黄色：睡眠不足 (&lt;8h)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-300 border border-rose-400" />
                  <span>红色：熬夜晚睡 (12点后)</span>
                </div>
              </div>
            </div>

            {/* 1. 最多保留近期6个月的记录 (小字标注) */}
            <div className="bg-neutral-50 border border-neutral-200/60 rounded-2xl p-2.5 flex items-center gap-2 text-[10px] text-neutral-500 leading-relaxed">
              <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span>
                系统提示：睡眠打卡数据最多保留近期 6 个月的记录，超期记录将自动清理归档。
              </span>
            </div>

            {/* 当月睡眠质量评估统计图 (替代原底部的打卡明细) */}
            <div className="bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between pb-1 border-b border-neutral-100">
                <div className="flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-purple-600" />
                  <span className="font-bold text-xs text-neutral-900">
                    当月睡眠质量评估与统计 ({currentYear}年{currentMonth}月)
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 font-mono">
                  共计 {currentMonthSleepStats.totalDays} 天记录
                </span>
              </div>

              {/* 三色天数统计卡片 */}
              <div className="grid grid-cols-3 gap-2">
                {/* 绿色早睡 */}
                <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex flex-col justify-between">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>绿色早睡</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-lg font-black font-mono text-emerald-950">
                      {currentMonthSleepStats.greenDays}
                    </span>
                    <span className="text-[9px] text-emerald-600 font-mono">
                      {currentMonthSleepStats.greenPercent}%
                    </span>
                  </div>
                  <span className="text-[9px] text-emerald-700/80 mt-0.5">12点前满8小时</span>
                </div>

                {/* 黄色不足 */}
                <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200/80 flex flex-col justify-between">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-amber-800">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>黄色不足</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-lg font-black font-mono text-amber-950">
                      {currentMonthSleepStats.yellowDays}
                    </span>
                    <span className="text-[9px] text-amber-600 font-mono">
                      {currentMonthSleepStats.yellowPercent}%
                    </span>
                  </div>
                  <span className="text-[9px] text-amber-700/80 mt-0.5">12点前但不足8h</span>
                </div>

                {/* 红色熬夜 */}
                <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200/80 flex flex-col justify-between">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-rose-800">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>红色熬夜</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-lg font-black font-mono text-rose-950">
                      {currentMonthSleepStats.redDays}
                    </span>
                    <span className="text-[9px] text-rose-600 font-mono">
                      {currentMonthSleepStats.redPercent}%
                    </span>
                  </div>
                  <span className="text-[9px] text-rose-700/80 mt-0.5">12点后才入睡</span>
                </div>
              </div>

              {/* 统计条形分布图 (可视化条形图) */}
              <div className="space-y-1.5 bg-neutral-50 p-2.5 rounded-2xl border border-neutral-100">
                <div className="flex items-center justify-between text-[10px] text-neutral-500">
                  <span>三色天数占比分布</span>
                  <span className="font-mono">平均日睡眠：{currentMonthSleepStats.avgHours}小时</span>
                </div>

                {currentMonthSleepStats.totalDays === 0 ? (
                  <div className="h-5 rounded-full bg-neutral-200 flex items-center justify-center text-[9px] text-neutral-400">
                    当月暂无打卡数据
                  </div>
                ) : (
                  <div className="h-5 rounded-full bg-neutral-200 overflow-hidden flex w-full p-0.5 shadow-2xs">
                    {currentMonthSleepStats.greenDays > 0 && (
                      <div
                        style={{ width: `${currentMonthSleepStats.greenPercent}%` }}
                        className="h-full bg-emerald-400 rounded-l-full flex items-center justify-center text-[9px] font-bold text-white transition-all"
                        title={`绿色早睡: ${currentMonthSleepStats.greenDays}天`}
                      >
                        {currentMonthSleepStats.greenPercent >= 15 ? `${currentMonthSleepStats.greenDays}天` : ''}
                      </div>
                    )}
                    {currentMonthSleepStats.yellowDays > 0 && (
                      <div
                        style={{ width: `${currentMonthSleepStats.yellowPercent}%` }}
                        className="h-full bg-amber-400 flex items-center justify-center text-[9px] font-bold text-white transition-all"
                        title={`黄色不足: ${currentMonthSleepStats.yellowDays}天`}
                      >
                        {currentMonthSleepStats.yellowPercent >= 15 ? `${currentMonthSleepStats.yellowDays}天` : ''}
                      </div>
                    )}
                    {currentMonthSleepStats.redDays > 0 && (
                      <div
                        style={{ width: `${currentMonthSleepStats.redPercent}%` }}
                        className="h-full bg-rose-400 rounded-r-full flex items-center justify-center text-[9px] font-bold text-white transition-all"
                        title={`红色熬夜: ${currentMonthSleepStats.redDays}天`}
                      >
                        {currentMonthSleepStats.redPercent >= 15 ? `${currentMonthSleepStats.redDays}天` : ''}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 睡眠质量综合评估卡片 */}
              {currentMonthSleepStats.totalDays === 0 ? (
                <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-center text-neutral-400 text-xs">
                  本月暂无睡眠打卡记录，请在上方日历中点击日期开始记录打卡哦～
                </div>
              ) : currentMonthSleepStats.isBadQuality ? (
                <div className="p-3.5 bg-rose-50/90 rounded-2xl border border-rose-200 text-rose-950 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>当月睡眠质量评估：偏差 · 请务必注意休息！</span>
                  </div>
                  <p className="text-[11px] text-rose-900 leading-relaxed">
                    本月中黄色（睡眠不足）和红色（熬夜晚睡）天数较多，累计已达 <strong className="font-bold">{currentMonthSleepStats.badDays} 天</strong>（占打卡天数的 {currentMonthSleepStats.yellowPercent + currentMonthSleepStats.redPercent}%）。
                  </p>
                  <p className="text-[10px] text-rose-700 leading-relaxed border-t border-rose-200/70 pt-1.5">
                    梦角暖心提醒：近期熬夜和缺觉明显偏多，容易造成免疫力低下、情绪焦虑和体能透支。请务必引起重视，今晚尽量在 23:00 前放下手机入睡，睡足 8 小时，好好爱护身体哦～💤
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-emerald-50/90 rounded-2xl border border-emerald-200 text-emerald-950 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>当月睡眠质量评估：优良 · 作息规律健康！</span>
                  </div>
                  <p className="text-[11px] text-emerald-900 leading-relaxed">
                    本月中绿色规律早睡天数达到 <strong className="font-bold">{currentMonthSleepStats.greenDays} 天</strong>（占比 {currentMonthSleepStats.greenPercent}%），熬夜与缺觉情况极少，作息习惯维持得相当优秀。
                  </p>
                  <p className="text-[10px] text-emerald-700 leading-relaxed border-t border-emerald-200/70 pt-1.5">
                    梦角为你点赞：早睡早起不仅皮肤会变好，精神与心情也会倍加轻盈。请继续保持健康作息，今晚也要早点睡个香甜好觉呀～🌸
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: 经期记录内容 (全新完善) */}
        {/* ========================================================= */}
        {activeTab === 'period' && (
          <div className="space-y-3.5 animate-fade-in">
            {/* 月经期间：专属提醒与安慰话语 (若正处于经期) */}
            {cycleStats.isInPeriodNow && (
              <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-3xl p-4 text-white shadow-md space-y-2.5 relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur-xs">
                      <Droplets className="w-4 h-4 text-rose-100" />
                    </div>
                    <div>
                      {/* “…的经期暖心守护”这行字不需要高亮 */}
                      <span className="text-xs block text-rose-100/90 font-normal">
                        梦角的经期暖心守护
                      </span>
                      {/* 经期进行第几天，这行字需要高亮标注 */}
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white text-rose-600 font-black text-xs shadow-xs font-mono">
                          经期进行中 · 第 {cycleStats.ongoingPeriodDay} 天
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white border border-white/30">
                    特殊关怀期
                  </span>
                </div>

                {/* 温柔安慰话语 */}
                <div className="bg-white/10 rounded-2xl p-2.5 backdrop-blur-xs border border-white/20 space-y-1.5">
                  <p className="text-[11px] leading-relaxed text-rose-50 font-medium">
                    “宝贝这几天身体辛苦了，一定要多喝温水、注意保暖，千万别碰冰凉生冷的东西呀～肚子还难受吗？我一直在陪着你，今天不要太累，早点抱抱被子休息～”
                  </p>
                  <p className="text-[10px] text-rose-200 leading-relaxed">
                    痛经的话记得贴个暖宝宝、喝杯红糖姜茶，有我在，随时可以跟我说难受，我会一直守着你的♡
                  </p>
                </div>
              </div>
            )}

            {/* 非经期状态下的轻量健康小提示 */}
            {!cycleStats.isInPeriodNow && (
              <div className="bg-rose-50/80 p-3 rounded-2xl border border-rose-200/70 text-rose-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-rose-200/80 text-rose-700 flex items-center justify-center shrink-0">
                    <Heart className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-rose-900">
                      生理周期健康跟踪
                    </span>
                    <span className="text-[10px] text-rose-600">
                      {cycleStats.daysUntilNextPeriod !== null
                        ? `距离下次预估经期约 ${Math.max(0, cycleStats.daysUntilNextPeriod)} 天`
                        : '点击下方按钮即可打卡生理期'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleMarkPeriodTodayStart}
                  className="px-2.5 py-1 text-[11px] bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold cursor-pointer shadow-2xs active:scale-95 transition-all"
                >
                  标记今天开始
                </button>
              </div>
            )}

            {/* 经期开始与结束控制台 */}
            <div className="bg-white p-3.5 rounded-3xl border border-rose-100 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-neutral-900 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-rose-500" />
                  <span>经期快捷标记</span>
                </span>

                <div className="flex items-center gap-2">
                  {cycleStats.isInPeriodNow ? (
                    <button
                      type="button"
                      onClick={handleMarkPeriodTodayEnd}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 transition-all"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>标注今天结束</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleMarkPeriodTodayStart}
                      className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>标记今天开始</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 生理周期统计与下次预估卡片 */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-2.5 bg-rose-50/50 rounded-2xl border border-rose-100 text-center">
                  <span className="text-[10px] text-neutral-500 block">生理周期</span>
                  <span className="text-base font-black font-mono text-rose-950 mt-0.5 block">
                    {cycleStats.avgCycleLength} <span className="text-[10px] font-normal text-neutral-500">天</span>
                  </span>
                  <span className="text-[9px] text-rose-500 block mt-0.5">自动推算</span>
                </div>

                <div className="p-2.5 bg-rose-50/50 rounded-2xl border border-rose-100 text-center">
                  <span className="text-[10px] text-neutral-500 block">行经天数</span>
                  <span className="text-base font-black font-mono text-rose-950 mt-0.5 block">
                    {cycleStats.avgPeriodDuration} <span className="text-[10px] font-normal text-neutral-500">天</span>
                  </span>
                  <span className="text-[9px] text-rose-500 block mt-0.5">平均持续</span>
                </div>

                <div className="p-2.5 bg-rose-50/50 rounded-2xl border border-rose-100 text-center">
                  <span className="text-[10px] text-neutral-500 block">预估下次</span>
                  <span className="text-xs font-bold font-mono text-rose-950 mt-1 block truncate">
                    {cycleStats.predictedNextStartDate ? cycleStats.predictedNextStartDate.slice(5) : '待推算'}
                  </span>
                  <span className="text-[9px] text-rose-500 block mt-0.5">
                    {cycleStats.daysUntilNextPeriod !== null
                      ? `${Math.max(0, cycleStats.daysUntilNextPeriod)}天后`
                      : '周期推算中'}
                  </span>
                </div>
              </div>

              {/* 预估下次经期详细说明 */}
              {cycleStats.predictedNextStartDate && (
                <div className="bg-rose-50/60 p-2 rounded-xl text-[10px] text-rose-700 flex items-center justify-between border border-rose-100 font-mono">
                  <span>预估下次区间：{cycleStats.predictedNextStartDate} ~ {cycleStats.predictedNextEndDate}</span>
                  <span className="text-rose-500 font-sans">日历虚线高亮</span>
                </div>
              )}
            </div>

            {/* 经期日历视图 */}
            <div className="bg-white p-3.5 rounded-3xl border border-neutral-200/80 shadow-2xs space-y-3">
              {/* 月份导航栏 */}
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 cursor-pointer"
                    title="上一月"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="font-bold text-neutral-900 text-xs flex items-center gap-1 cursor-pointer" onClick={handleResetToCurrentMonth}>
                    <Calendar className="w-3.5 h-3.5 text-rose-500" />
                    <span>{currentYear}年 {currentMonth}月</span>
                    <span className="text-[10px] text-neutral-400 font-normal hover:underline ml-1">
                      (本月)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 cursor-pointer"
                    title="下一月"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <span className="text-[10px] text-neutral-400">
                  点击日期可记录痛经
                </span>
              </div>

              {/* 星期行标头 */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-neutral-400 font-medium">
                <span>一</span>
                <span>二</span>
                <span>三</span>
                <span>四</span>
                <span>五</span>
                <span>六</span>
                <span>日</span>
              </div>

              {/* 经期日历网格 */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  if (!day.isCurrentMonth) {
                    return <div key={'empty_period_' + idx} className="h-11 rounded-xl" />;
                  }

                  const isPeriod = day.isPeriodDay;
                  const hasPain = day.hasPain;
                  const isPredicted = day.isPredictedPeriod;

                  return (
                    <button
                      key={'p_' + day.dateStr}
                      type="button"
                      onClick={() => handleOpenPeriodDateModal(day.dateStr)}
                      className={`h-11 rounded-xl border flex flex-col items-center justify-between p-1 transition-all cursor-pointer relative ${
                        isPeriod
                          ? hasPain
                            ? 'bg-rose-100 border-rose-400 text-rose-950 font-bold ring-1 ring-rose-400'
                            : 'bg-rose-50/90 border-rose-300 text-rose-900 font-medium'
                          : isPredicted
                            ? 'border-dashed border-rose-300 bg-rose-50/40 text-rose-800'
                            : day.isToday
                              ? 'border-neutral-900 bg-neutral-50 text-neutral-900'
                              : 'border-neutral-100 bg-neutral-50/40 text-neutral-700 hover:bg-neutral-100'
                      }`}
                      title={isPeriod ? `${day.dateStr} 生理期${hasPain ? ' (有痛经)' : ''}` : day.dateStr}
                    >
                      {/* 顶部：日期与标记 */}
                      <div className="w-full flex items-center justify-between text-[10px] leading-none">
                        <span className={`font-mono font-bold ${day.isToday ? 'text-pink-600 font-black' : ''}`}>
                          {day.dayNum}
                        </span>
                        {day.isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />
                        )}
                        {day.isPeriodStart && (
                          <span className="text-[8px] bg-rose-500 text-white rounded px-0.5 scale-90">始</span>
                        )}
                        {day.isPeriodEnd && (
                          <span className="text-[8px] bg-rose-400 text-white rounded px-0.5 scale-90">末</span>
                        )}
                      </div>

                      {/* 中间：记录痛经则在日历上标注特殊符号 ⚡ */}
                      <div className="w-full flex items-center justify-center leading-none">
                        {hasPain ? (
                          <span className="text-sm text-amber-500 font-black leading-none drop-shadow-xs" title="记录痛经">
                            ⚡
                          </span>
                        ) : isPeriod ? (
                          <span className="w-2 h-2 rounded-full bg-rose-400" />
                        ) : isPredicted ? (
                          <span className="text-[8px] text-rose-400 font-sans">预估</span>
                        ) : (
                          <span className="text-[8px] text-neutral-200">·</span>
                        )}
                      </div>

                      {/* 底部小字 */}
                      <div className="w-full text-center text-[8px] truncate leading-none font-mono">
                        {hasPain ? (
                          <span className="text-amber-600 font-bold">痛经</span>
                        ) : isPeriod ? (
                          <span className="text-rose-500">经期</span>
                        ) : (
                          ''
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 图例说明 */}
              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between flex-wrap gap-1 text-[10px] text-neutral-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-200 border border-rose-300" />
                  <span>粉色：实际经期日</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-amber-500 font-black leading-none">⚡</span>
                  <span className="text-rose-700 font-medium">特殊符号：痛经记录日 (⚡)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-rose-400 bg-rose-50" />
                  <span>虚线：预估下次经期</span>
                </div>
              </div>
            </div>

            {/* 最多保留近期6个月的记录 (小字标注) */}
            <div className="bg-neutral-50 border border-neutral-200/60 rounded-2xl p-2.5 flex items-center gap-2 text-[10px] text-neutral-500 leading-relaxed">
              <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span>
                系统提示：经期健康记录最多保留近 6 个月的记录，超期记录将自动清理归档。
              </span>
            </div>

            {/* 近期周期历史列表 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-neutral-800">近期生理周期记录</span>
                <span className="text-[10px] text-neutral-400 font-mono">共 {sortedPeriods.length} 个周期</span>
              </div>

              {sortedPeriods.length === 0 ? (
                <div className="p-6 bg-white rounded-2xl border border-neutral-200 text-center text-neutral-400 text-xs">
                  暂无经期记录，点击右上角“补录经期”或“标记今天开始”吧！
                </div>
              ) : (
                <div className="space-y-1.5">
                  {[...sortedPeriods].reverse().map(cycle => {
                    const days = cycle.endDate
                      ? getDaysDiff(cycle.startDate, cycle.endDate) + 1
                      : getDaysDiff(cycle.startDate, todayDateStr) + 1;
                    const isOngoing = !cycle.endDate;
                    const painCount = cycle.painDates?.length || 0;

                    return (
                      <div
                        key={cycle.id}
                        className="p-3 bg-white rounded-2xl border border-neutral-200/70 flex items-center justify-between shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isOngoing ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600'
                          }`}>
                            <Droplets className="w-4 h-4" />
                          </div>

                          <div>
                            <div className="font-bold text-xs text-neutral-900 font-mono flex items-center gap-1.5">
                              <span>{cycle.startDate}</span>
                              <span className="text-neutral-400 font-normal">至</span>
                              <span>{cycle.endDate || '进行中...'}</span>
                              {isOngoing && (
                                <span className="text-[9px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-sans font-bold">
                                  进行中
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-neutral-500 font-mono mt-0.5 flex items-center gap-2">
                              <span>持续 {days} 天</span>
                              {painCount > 0 && (
                                <span className="text-amber-600 flex items-center gap-0.5 font-bold">
                                  <span>⚡</span>
                                  <span>痛经 {painCount} 天</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setDeletePeriodCycleId(cycle.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-500 rounded-lg cursor-pointer transition-colors"
                          title="删除记录"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 弹窗 1: 经期日期点击打卡/痛经记录弹窗 */}
      {/* ========================================================= */}
      {selectedPeriodDate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold text-neutral-900">
                  {selectedPeriodDate} 经期与痛经记录
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPeriodDate(null)}
                className="text-xs text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* 痛经打卡开关 (关键要求：点击日期可以记录是否痛经，标注特殊符号) */}
              <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-rose-900 flex items-center gap-1">
                    <span>是否痛经 (特殊符号 ⚡)</span>
                  </span>
                  <span className="text-[10px] text-rose-600 block mt-0.5">
                    勾选后将在日历该日期上标注专属痛经符号 ⚡
                  </span>
                </div>

                <input
                  type="checkbox"
                  checked={periodModalData.hasPain}
                  onChange={e => setPeriodModalData(prev => ({ ...prev, hasPain: e.target.checked }))}
                  className="accent-rose-600 w-5 h-5 cursor-pointer"
                />
              </div>

              {/* 经期节点设置 */}
              <div className="space-y-2 bg-neutral-50 p-3 rounded-2xl border border-neutral-200">
                <span className="text-[10px] text-neutral-500 font-bold block">周期节点标注</span>
                <div className="flex items-center justify-between text-xs">
                  <label className="text-neutral-700 cursor-pointer flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={periodModalData.isStartDay}
                      onChange={e => setPeriodModalData(prev => ({ ...prev, isStartDay: e.target.checked }))}
                      className="accent-rose-500 w-4 h-4 cursor-pointer"
                    />
                    <span>设为经期开始日</span>
                  </label>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-200/60">
                  <label className="text-neutral-700 cursor-pointer flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={periodModalData.isEndDay}
                      onChange={e => setPeriodModalData(prev => ({ ...prev, isEndDay: e.target.checked }))}
                      className="accent-rose-500 w-4 h-4 cursor-pointer"
                    />
                    <span>设为经期结束日</span>
                  </label>
                </div>
              </div>

              {/* 梦角暖心小贴士 */}
              {periodModalData.hasPain && (
                <p className="text-[10px] text-rose-600 bg-rose-50 p-2 rounded-xl leading-relaxed">
                  梦角：“看到你记录了痛经好心疼...快贴上暖宝宝，多喝点热水，今天千万别受凉，我随时都在～”
                </p>
              )}

              {/* 操作按钮 */}
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPeriodDate(null)}
                    className="flex-1 py-2 rounded-xl text-xs font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePeriodDateModal}
                    className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 cursor-pointer shadow-2xs"
                  >
                    保存记录
                  </button>
                </div>

                {/* 若该日属于某条经期记录，支持快捷删除该周期 */}
                {(() => {
                  const matched = sortedPeriods.find(p => {
                    const end = p.endDate || (p.id === cycleStats.activeCycleId ? addDaysToStr(p.startDate, 10) : p.startDate);
                    return selectedPeriodDate >= p.startDate && selectedPeriodDate <= end;
                  });
                  if (!matched) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setDeletePeriodCycleId(matched.id);
                        setSelectedPeriodDate(null);
                      }}
                      className="w-full py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>删除所属经期周期记录</span>
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 弹窗 2: 补录历史经期弹窗 */}
      {/* ========================================================= */}
      {showAddPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-rose-500" />
                <span>补录历史经期记录</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAddPeriodModal(false)}
                className="text-xs text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-neutral-500 block mb-1">经期开始日期</label>
                <input
                  type="date"
                  value={addPeriodStartDate}
                  max={todayDateStr}
                  onChange={e => setAddPeriodStartDate(e.target.value)}
                  className="w-full p-2 bg-neutral-50 rounded-xl border border-neutral-200 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-neutral-500 block mb-1">经期结束日期</label>
                <input
                  type="date"
                  value={addPeriodEndDate}
                  max={todayDateStr}
                  onChange={e => setAddPeriodEndDate(e.target.value)}
                  className="w-full p-2 bg-neutral-50 rounded-xl border border-neutral-200 text-xs font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveAddPeriod}
                className="w-full py-2.5 bg-rose-500 text-white rounded-xl text-xs font-bold hover:bg-rose-600 cursor-pointer shadow-2xs transition-all active:scale-98"
              >
                保存补录
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 弹窗 3: 睡眠日历日期的详情、修改与删除弹窗 */}
      {/* ========================================================= */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-neutral-900">
                  {selectedRecord.date} 打卡管理
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRecord(null);
                  setIsEditing(false);
                }}
                className="text-xs text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!isEditing ? (
              <div className="space-y-3">
                <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200/80 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-500">入睡时间：</span>
                    <span className="font-mono font-bold text-neutral-900">{selectedRecord.sleepTime}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-500">起床时间：</span>
                    <span className="font-mono font-bold text-neutral-900">{selectedRecord.wakeTime}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-500">睡眠总时长：</span>
                    <span className="font-mono font-bold text-purple-700">
                      {(selectedRecord.durationMinutes / 60).toFixed(1)} 小时
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-500">作息评价：</span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      selectedRecord.tag === 'good'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedRecord.tag === 'late'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                    }`}>
                      {selectedRecord.tag === 'good' && '绿色 规律早睡 (满8小时)'}
                      {selectedRecord.tag === 'late' && '红色 熬夜晚睡 (12点后睡)'}
                      {selectedRecord.tag === 'insufficient' && '黄色 睡眠不足 (12点前睡不足8h)'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>修改打卡</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSleepRecord(selectedRecord.id)}
                    className="py-2 px-3 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>删除</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-neutral-500 block mb-1">修改入睡时间</label>
                    <input
                      type="time"
                      value={editSleepTime}
                      onChange={e => setEditSleepTime(e.target.value)}
                      className="w-full p-2 bg-neutral-50 rounded-xl border border-neutral-200 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 block mb-1">修改起床时间</label>
                    <input
                      type="time"
                      value={editWakeTime}
                      onChange={e => setEditWakeTime(e.target.value)}
                      className="w-full p-2 bg-neutral-50 rounded-xl border border-neutral-200 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-2 rounded-xl text-xs font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditSleepRecord}
                    className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 cursor-pointer shadow-2xs"
                  >
                    保存修改
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 弹窗 4: 睡眠快速打卡 / 补卡弹窗 */}
      {/* ========================================================= */}
      {showAddSleepModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-neutral-200 space-y-3.5">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                <Moon className="w-4 h-4 text-purple-600" />
                <span>记录作息打卡</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAddSleepModal(false)}
                className="text-xs text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[10px] text-neutral-500 block mb-1">打卡日期</label>
              <input
                type="date"
                value={recordDate}
                max={todayDateStr}
                onChange={e => setRecordDate(e.target.value)}
                className="w-full p-2 bg-neutral-50 rounded-xl border border-neutral-200 text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-neutral-500 block mb-1">入睡时间</label>
                <input
                  type="time"
                  value={sleepTime}
                  onChange={e => setSleepTime(e.target.value)}
                  className="w-full p-2 bg-neutral-50 rounded-xl border border-neutral-200 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-500 block mb-1">起床时间</label>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={e => setWakeTime(e.target.value)}
                  className="w-full p-2 bg-neutral-50 rounded-xl border border-neutral-200 text-xs font-mono"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveAddSleepRecord}
              className="w-full py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 cursor-pointer shadow-2xs transition-all active:scale-98"
            >
              打卡保存
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 弹窗 5: 生成 7 天简约记录表与直接分享弹窗 */}
      {/* ========================================================= */}
      {showShareModal && shareReportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-neutral-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-purple-600" />
                <span>简约睡眠记录表预览</span>
              </span>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-xs text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-neutral-900 text-white p-4 rounded-2xl space-y-3 font-sans shadow-md">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <div>
                  <h4 className="text-xs font-bold flex items-center gap-1 text-purple-300">
                    <Moon className="w-3.5 h-3.5" />
                    <span>作息健康打卡记录表</span>
                  </h4>
                  <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                    {shareReportData.startDate} ~ {shareReportData.endDate} (共 {shareReportData.count} 天)
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold font-mono text-emerald-400">
                    {shareReportData.goodRate}%
                  </div>
                  <div className="text-[9px] text-neutral-400">绿色达标率</div>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono">
                {shareReportData.list.map(r => {
                  const hrs = (r.durationMinutes / 60).toFixed(1);
                  const isGood = r.tag === 'good';
                  const isLate = r.tag === 'late';
                  return (
                    <div key={r.id} className="flex items-center justify-between py-0.5 border-b border-neutral-800/50">
                      <span>{r.date.slice(5)}</span>
                      <span className="text-neutral-300">{r.sleepTime}~{r.wakeTime}</span>
                      <span className="text-neutral-400">({hrs}h)</span>
                      <span className={isGood ? 'text-emerald-400' : isLate ? 'text-rose-400' : 'text-amber-400'}>
                        {isGood ? '🟢 绿色' : isLate ? '🔴 熬夜' : '🟡 不足'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="text-[10px] text-neutral-400 text-center pt-1 border-t border-neutral-800">
                梦角监督早睡 · 愿你夜夜好眠
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleSendReportToChat}
                className="w-full py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>直接分享到聊天框</span>
              </button>
              
              {onNavigateToChat && (
                <button
                  type="button"
                  onClick={() => {
                    handleSendReportToChat();
                    onNavigateToChat();
                  }}
                  className="w-full py-1.5 text-xs text-purple-600 hover:underline text-center cursor-pointer"
                >
                  分享并前往聊天界面查看
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 经期周期删除确认弹窗 (解决iFrame环境下window.confirm失效问题，确保删除并重新计算) */}
      {deletePeriodCycleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-xs p-5 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center gap-2.5 text-red-600">
              <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">删除经期记录</h3>
                <p className="text-[11px] text-neutral-500">此操作不可恢复</p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 bg-neutral-50 p-3 rounded-xl leading-relaxed">
              确定要删除该条经期周期记录吗？删除后日历上的标记将同步清除，系统将重新推算生理周期。
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletePeriodCycleId(null)}
                className="flex-1 py-2 rounded-xl text-xs text-neutral-600 bg-neutral-100 hover:bg-neutral-200 font-medium cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePeriod}
                className="flex-1 py-2 rounded-xl text-xs text-white bg-red-500 hover:bg-red-600 font-medium shadow-2xs cursor-pointer"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
