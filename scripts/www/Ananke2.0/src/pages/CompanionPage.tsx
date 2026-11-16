import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ChevronLeft, 
  HeartHandshake, 
  Sparkles, 
  Plus, 
  BookOpen, 
  Gamepad2, 
  Headphones, 
  Flame, 
  Glasses, 
  Clock, 
  StopCircle,
  Share2,
  Trash2,
  CheckSquare,
  Square,
  Award,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Calendar,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  AlertCircle,
  Coffee,
  Smile,
  Tv
} from 'lucide-react';
import { Character, CompanionSession, CompanionActivity, CompanionRecord, Message } from '../types';
import { companionService } from '../core/CompanionService';
import { StorageService } from '../services/StorageService';
import { ReadingTimeView } from '../components/companion/ReadingTimeView';

interface CompanionPageProps {
  character: Character;
  onBack: () => void;
  onSendMessage?: (msg: Message) => void;
  onNavigateToChat?: () => void;
}

// 格式化秒数为数字时钟格式 (HH:MM:SS 或 MM:SS)
function formatDigitalTimer(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// 格式化秒数为人类易读汉字
function formatDurationZh(totalSecs: number): string {
  if (totalSecs < 60) return `${totalSecs}秒`;
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) {
    return s > 0 ? `${h}小时${m}分${s}秒` : `${h}小时${m}分钟`;
  }
  return s > 0 ? `${m}分${s}秒` : `${m}分钟`;
}

// 获取时段分类
function getTimeSlot(timestamp: number): { key: string; name: string; icon: string; order: number } {
  const hour = new Date(timestamp).getHours();
  if (hour >= 6 && hour < 11) {
    return { key: 'morning', name: '清晨/早上', icon: 'Sunrise', order: 0 };
  } else if (hour >= 11 && hour < 14) {
    return { key: 'noon', name: '中午时分', icon: 'Sun', order: 1 };
  } else if (hour >= 14 && hour < 18) {
    return { key: 'afternoon', name: '午后晴空', icon: 'Sun', order: 2 };
  } else if (hour >= 18 && hour < 21) {
    return { key: 'sunset', name: '傍晚日落', icon: 'Sunset', order: 3 };
  } else {
    return { key: 'night', name: '晚上/静夜', icon: 'Moon', order: 4 };
  }
}

export const CompanionPage: React.FC<CompanionPageProps> = ({
  character,
  onBack,
  onSendMessage,
  onNavigateToChat,
}) => {
  const [session, setSession] = useState<CompanionSession | null>(() => companionService.getSession());
  // 子页面切换：'companion' (心动相伴) | 'reading' (共读时光)
  const [activeSubTab, setActiveSubTab] = useState<'companion' | 'reading'>('companion');
  const [selectedActivity, setSelectedActivity] = useState<string>('专注学习');
  const [customActivity, setCustomActivity] = useState<string>('');
  const [showAddCustom, setShowAddCustom] = useState<boolean>(false);
  const [inviteStatusMessage, setInviteStatusMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // 历史陪伴记录列表（按月收纳，最多保留6个月）
  const [records, setRecords] = useState<CompanionRecord[]>(() => StorageService.getCompanionRecords());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return new Set([currentMonth]);
  });

  // 批量删除记录状态
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());

  // 陪伴结束总结弹窗
  const [endedSummaryRecord, setEndedSummaryRecord] = useState<CompanionRecord | null>(null);

  // 角色拒绝弹窗 ("抱歉，现在不方便")
  const [isRejectedModalOpen, setIsRejectedModalOpen] = useState<boolean>(false);

  // 陪伴记录报告时间维度
  const [reportPeriod, setReportPeriod] = useState<'week' | 'month' | 'all'>('week');

  // 轻量提示 Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const PRESET_ACTIVITIES: CompanionActivity[] = useMemo(() => [
    { id: 'study', name: '专注学习', iconName: 'BookOpen' },
    { id: 'gaming', name: '打游戏', iconName: 'Gamepad2' },
    { id: 'music', name: '听音乐', iconName: 'Headphones' },
    { id: 'workout', name: '锻炼身体', iconName: 'Flame' },
    { id: 'reading', name: '安静阅读', iconName: 'Glasses' },
    { id: 'drama', name: '吃饭', iconName: 'Tv' },
  ], []);

  // 持久化存储的自定义事项列表（一直显示、可删除、可收纳）
  const [customActivities, setCustomActivities] = useState<CompanionActivity[]>(() => {
    return StorageService.getCompanionCustomActivities();
  });
  const [isCustomExpanded, setIsCustomExpanded] = useState<boolean>(true);

  // 订阅 CompanionService 全局状态
  useEffect(() => {
    const unsubscribe = companionService.subscribe(curr => {
      setSession(curr);
    });
    return unsubscribe;
  }, []);

  // 运行中的秒级计时器（基于 session.startTime 绝对毫秒计算，跨模块后台保持准确同步）
  useEffect(() => {
    if (session && session.status === 'active') {
      const calcSecs = () => Math.max(0, Math.floor((Date.now() - session.startTime) / 1000));
      setElapsedSeconds(calcSecs());
      const interval = setInterval(() => {
        setElapsedSeconds(calcSecs());
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedSeconds(0);
    }
  }, [session]);

  // 发起陪伴邀请
  const handleStartCompanion = () => {
    const charName = character.nickname || character.name;
    setInviteStatusMessage(`已向「${charName}」发出邀请：${selectedActivity}...`);
    
    companionService.invite(character.id, selectedActivity, (accepted, msg) => {
      setInviteStatusMessage(null);
      if (!accepted) {
        // 如果角色拒绝陪伴邀请，弹窗说明“抱歉，现在不方便”
        setIsRejectedModalOpen(true);
      } else {
        showToast(`「${charName}」已接受陪伴，陪伴计时开启！`);
      }
    });
  };

  // 结束陪伴：生成记录、自动保存并弹出总结分享弹窗
  const handleEndCompanion = () => {
    if (!session || session.status !== 'active') {
      companionService.endCompanion();
      return;
    }

    const now = Date.now();
    const duration = Math.max(1, Math.floor((now - session.startTime) / 1000));
    const recordMonth = new Date(now).toISOString().slice(0, 7);
    const recordDate = new Date(now).toISOString().slice(0, 10);

    const newRecord: CompanionRecord = {
      id: 'comp_rec_' + now + '_' + Math.random().toString(36).substring(2, 6),
      characterId: character.id,
      characterName: character.nickname || character.name,
      activity: session.activity,
      startTime: session.startTime,
      endTime: now,
      durationSeconds: duration,
      date: recordDate,
      month: recordMonth,
    };

    // 结束服务
    companionService.endCompanion();

    // 保存记录并更新
    const updated = [newRecord, ...records];
    setRecords(updated);
    StorageService.saveCompanionRecords(updated);

    // 确保当前月份在记录中展开可见
    setExpandedMonths(prev => new Set([...prev, recordMonth]));

    // 弹出结束陪伴总结
    setEndedSummaryRecord(newRecord);
  };

  // 分享陪伴记录到聊天
  const handleShareToChat = () => {
    if (!endedSummaryRecord) return;
    const charName = character.nickname || character.name;
    const durStr = formatDurationZh(endedSummaryRecord.durationSeconds);
    const shareText = `[心动陪伴] 刚刚我和${charName}共同进行了「${endedSummaryRecord.activity}」，陪伴时长：${durStr} ✨`;

    if (onSendMessage) {
      const shareMsg: Message = {
        id: 'msg_comp_share_' + Date.now(),
        characterId: character.id,
        sender: 'user',
        timestamp: Date.now(),
        cards: [],
        text: shareText,
        type: 'text',
        read: true,
      };
      onSendMessage(shareMsg);
      showToast('已成功分享至聊天！');
    } else {
      showToast('分享成功！');
    }

    setEndedSummaryRecord(null);
  };

  // 自定义活动添加（持久化保存，一直显示）
  const handleAddCustomActivity = () => {
    const trimmed = customActivity.trim();
    if (!trimmed) return;

    // 检查是否已存在同名事项
    const allNames = [...PRESET_ACTIVITIES.map(a => a.name), ...customActivities.map(a => a.name)];
    if (allNames.includes(trimmed)) {
      setSelectedActivity(trimmed);
      setCustomActivity('');
      setShowAddCustom(false);
      showToast(`已选择「${trimmed}」`);
      return;
    }

    const newAct: CompanionActivity = {
      id: 'custom_' + Date.now(),
      name: trimmed,
      iconName: 'Sparkles',
      isCustom: true,
    };
    const updated = [...customActivities, newAct];
    setCustomActivities(updated);
    StorageService.saveCompanionCustomActivities(updated);
    setSelectedActivity(newAct.name);
    setCustomActivity('');
    setShowAddCustom(false);
    setIsCustomExpanded(true);
    showToast(`已添加「${newAct.name}」`);
  };

  // 自定义活动删除
  const handleDeleteCustomActivity = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const actToDelete = customActivities.find(a => a.id === id);
    const updated = customActivities.filter(a => a.id !== id);
    setCustomActivities(updated);
    StorageService.saveCompanionCustomActivities(updated);
    if (actToDelete && selectedActivity === actToDelete.name) {
      setSelectedActivity('专注学习');
    }
    showToast('已删除该事项');
  };

  // 按月份分组整理记录
  const monthGroupedRecords = useMemo(() => {
    const groups: Record<string, CompanionRecord[]> = {};
    records.forEach(r => {
      const m = r.month || (r.date ? r.date.slice(0, 7) : new Date(r.startTime).toISOString().slice(0, 7));
      if (!groups[m]) groups[m] = [];
      groups[m].push(r);
    });
    // 月份按倒序排列
    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    return sortedKeys.map(key => ({
      month: key,
      list: groups[key],
      totalSeconds: groups[key].reduce((acc, curr) => acc + curr.durationSeconds, 0),
    }));
  }, [records]);

  // 批量删除处理
  const handleBatchDelete = () => {
    if (selectedRecordIds.size === 0) return;
    const updated = records.filter(r => !selectedRecordIds.has(r.id));
    setRecords(updated);
    StorageService.saveCompanionRecords(updated);
    setSelectedRecordIds(new Set());
    setIsBatchMode(false);
    showToast('已批量删除所选陪伴记录');
  };

  // 单条删除处理
  const handleDeleteSingle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = records.filter(r => r.id !== id);
    setRecords(updated);
    StorageService.saveCompanionRecords(updated);
    if (selectedRecordIds.has(id)) {
      const next = new Set(selectedRecordIds);
      next.delete(id);
      setSelectedRecordIds(next);
    }
    showToast('已删除该条记录');
  };

  // 月份折叠切换
  const toggleMonthExpand = (month: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) {
        next.delete(month);
      } else {
        next.add(month);
      }
      return next;
    });
  };

  // ==========================================
  // 陪伴记录报告数据统计与太阳曲线计算
  // ==========================================
  const reportData = useMemo(() => {
    const now = Date.now();
    let filtered = records;

    if (reportPeriod === 'week') {
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      filtered = records.filter(r => r.startTime >= sevenDaysAgo);
    } else if (reportPeriod === 'month') {
      const currentMonth = new Date().toISOString().slice(0, 7);
      filtered = records.filter(r => (r.month || r.date?.slice(0, 7)) === currentMonth);
    }

    const totalCount = filtered.length;
    const totalSeconds = filtered.reduce((acc, curr) => acc + curr.durationSeconds, 0);
    const longestSeconds = filtered.reduce((max, curr) => Math.max(max, curr.durationSeconds), 0);

    // 统计5个时段的陪伴分布
    const timeSlots = [
      { key: 'morning', label: '清晨/早上', range: '06:00-11:00', count: 0, icon: Sunrise },
      { key: 'noon', label: '中午', range: '11:00-14:00', count: 0, icon: Sun },
      { key: 'afternoon', label: '下午', range: '14:00-18:00', count: 0, icon: Sun },
      { key: 'sunset', label: '傍晚', range: '18:00-21:00', count: 0, icon: Sunset },
      { key: 'night', label: '夜晚/深夜', range: '21:00-06:00', count: 0, icon: Moon },
    ];

    filtered.forEach(r => {
      const hour = new Date(r.startTime).getHours();
      if (hour >= 6 && hour < 11) timeSlots[0].count++;
      else if (hour >= 11 && hour < 14) timeSlots[1].count++;
      else if (hour >= 14 && hour < 18) timeSlots[2].count++;
      else if (hour >= 18 && hour < 21) timeSlots[3].count++;
      else timeSlots[4].count++;
    });

    let favoriteSlot = timeSlots[0];
    timeSlots.forEach(s => {
      if (s.count > favoriteSlot.count) {
        favoriteSlot = s;
      }
    });

    // 奖励话语 vs 激励话语判定
    const isHighCompanion = reportPeriod === 'week' ? totalCount >= 4 : (reportPeriod === 'month' ? totalCount >= 10 : totalCount >= 12);

    return {
      totalCount,
      totalSeconds,
      longestSeconds,
      timeSlots,
      favoriteSlot,
      isHighCompanion,
    };
  }, [records, reportPeriod]);

  const charDisplayName = character.nickname || character.name;

  return (
    <div className="w-full h-full flex flex-col justify-between bg-neutral-100 select-none overflow-hidden relative">
      {/* 顶部导航条 */}
      <div className="h-12 px-3 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 flex items-center justify-between shrink-0 z-20">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center text-xs text-neutral-600 hover:text-neutral-900 active:scale-95 transition-all p-1 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 mr-0.5" />
          <span>{session?.status === 'active' ? '切到后台' : '返回'}</span>
        </button>
        
        {/* 顶部胶囊切换：心动相伴 | 共读时光 */}
        <div className="flex bg-neutral-100 p-0.5 rounded-full border border-neutral-200/60">
          <button
            type="button"
            onClick={() => setActiveSubTab('companion')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
              activeSubTab === 'companion'
                ? 'bg-white text-neutral-900 shadow-2xs font-bold'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <HeartHandshake className={`w-3.5 h-3.5 ${activeSubTab === 'companion' ? 'text-pink-500' : 'text-neutral-400'}`} />
            <span>心动相伴</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('reading')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
              activeSubTab === 'reading'
                ? 'bg-white text-neutral-900 shadow-2xs font-bold'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <BookOpen className={`w-3.5 h-3.5 ${activeSubTab === 'reading' ? 'text-amber-700' : 'text-neutral-400'}`} />
            <span>共读时光</span>
          </button>
        </div>

        {session?.status === 'active' ? (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-50 border border-pink-200">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping" />
            <span className="text-[10px] text-pink-600 font-medium">进行中</span>
          </div>
        ) : (
          <div className="w-8" />
        )}
      </div>

      {/* 轻量 Toast 提示 */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 bg-neutral-900/85 backdrop-blur-md text-white text-[11px] rounded-full shadow-lg animate-fade-in pointer-events-none">
          {toastMessage}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 核心内容区                                                               */}
      {/* ========================================================================= */}
      {activeSubTab === 'reading' ? (
        <div className="flex-1 overflow-y-auto p-3.5 text-xs">
          <ReadingTimeView
            character={character}
            showToast={showToast}
            onSendMessage={onSendMessage}
            onNavigateToChat={onNavigateToChat}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
          {/* 后台保活声明 */}
        <div className="px-3 py-2 bg-amber-50/80 border border-amber-200/70 rounded-2xl text-[10px] text-amber-800 leading-relaxed flex items-start gap-1.5 shadow-2xs">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p>
            后台保活不稳定，字卡网站挂后台容易导致陪伴模式断连。建议该模式下将字卡软件挂<strong>前台</strong>或者<strong>悬浮窗</strong>。
          </p>
        </div>

        {/* 模式 1: 正在进行中的专属陪伴窗口 (沉浸式卡片，去除悬浮小窗，角色头像/昵称与主界面同步) */}
        {session?.status === 'active' ? (
          <div className="w-full bg-gradient-to-b from-white via-pink-50/30 to-white p-5 rounded-3xl border border-pink-200/80 shadow-md flex flex-col items-center text-center space-y-4 animate-in fade-in duration-300">
            {/* 头像与同频呼吸光环（与主界面完全同步） */}
            <div className="relative mt-2">
              <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-pink-400 via-rose-300 to-amber-200 shadow-lg animate-pulse">
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-white">
                  <img 
                    src={character.avatar} 
                    alt={charDisplayName} 
                    className="w-full h-full object-cover" 
                  />
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[9px] font-bold shadow-xs flex items-center gap-1 border border-white">
                <HeartHandshake className="w-2.5 h-2.5" />
                <span>同频中</span>
              </div>
            </div>

            {/* 昵称与活动状态 */}
            <div>
              <h2 className="text-base font-bold text-neutral-900 tracking-wide">
                {charDisplayName}
              </h2>
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-pink-200/70 text-xs font-medium text-pink-700 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                <span>正在一起：{session.activity}</span>
              </div>
            </div>

            {/* 动态秒级时钟 */}
            <div className="py-2.5 px-6 rounded-2xl bg-white/90 border border-neutral-200/70 shadow-inner flex flex-col items-center">
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest mb-0.5">
                Companion Duration
              </span>
              <span className="text-3xl font-mono font-bold text-neutral-900 tracking-wider">
                {formatDigitalTimer(elapsedSeconds)}
              </span>
              <span className="text-[10px] text-pink-500 font-medium mt-1">
                已持续相伴 {formatDurationZh(elapsedSeconds)}
              </span>
            </div>

            {/* 温柔耳语 */}
            <p className="text-[11px] text-neutral-500 leading-relaxed italic px-2">
              “无论你在忙碌还是放空，我都静静在这里守护你。做你想做的事吧～”
            </p>

            {/* 操作按钮组 */}
            <div className="w-full pt-1 space-y-2">
              <button
                type="button"
                onClick={handleEndCompanion}
                className="w-full py-2.5 bg-neutral-900 text-white rounded-2xl text-xs font-semibold hover:bg-neutral-800 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <StopCircle className="w-4 h-4 text-rose-400" />
                <span>结束本次陪伴</span>
              </button>

              <button
                type="button"
                onClick={onBack}
                className="w-full py-2 bg-white text-neutral-600 rounded-2xl text-xs font-medium hover:bg-neutral-50 active:scale-95 transition-all border border-neutral-200 flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>收起窗口（后台保持记录）</span>
              </button>
            </div>
          </div>
        ) : session?.status === 'pending' ? (
          /* 等待接受中卡片 */
          <div className="w-full bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs flex flex-col items-center text-center space-y-3 animate-fade-in">
            <div className="w-14 h-14 rounded-full border-3 border-pink-500 border-t-transparent animate-spin flex items-center justify-center" />
            <span className="text-xs font-bold text-neutral-800">
              正在邀请「{charDisplayName}」...
            </span>
            <p className="text-[11px] text-neutral-500">
              {inviteStatusMessage || `已向对方发起${selectedActivity}陪伴请求，等待回应中`}
            </p>
          </div>
        ) : (
          /* 开启新陪伴模块卡片 */
          <div className="w-full bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs space-y-3.5">
            {/* 伴侣信息栏（与主界面完全同步） */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-pink-200 shadow-2xs shrink-0 bg-pink-50">
                  <img src={character.avatar} alt={charDisplayName} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-neutral-900 text-sm">{charDisplayName}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-pink-50 text-pink-600 font-medium">心动伴侣</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">
                    随时开启静默专注或互动守护
                  </span>
                </div>
              </div>
            </div>

            {/* 选择事项 */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-800 text-xs">选择今日陪伴事项</span>
                <button
                  type="button"
                  onClick={() => setShowAddCustom(!showAddCustom)}
                  className="text-[11px] text-pink-600 hover:text-pink-700 flex items-center gap-0.5 cursor-pointer font-medium"
                >
                  <Plus className="w-3 h-3" />
                  <span>添加自定义事项</span>
                </button>
              </div>

              {/* 预设事项按钮网格 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESET_ACTIVITIES.map(act => {
                  const isSelected = selectedActivity === act.name;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setSelectedActivity(act.name)}
                      className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-pink-500 bg-pink-50/70 text-pink-900 shadow-2xs font-semibold ring-1 ring-pink-300'
                          : 'border-neutral-200/80 bg-neutral-50/50 hover:bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-pink-500' : 'text-neutral-400'}`} />
                      <span className="text-xs truncate">{act.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* 自定义事项收纳栏（永久保留、可删除、可折叠收纳防止占屏） */}
              {customActivities.length > 0 && (
                <div className="rounded-2xl border border-neutral-200/70 bg-neutral-50/40 overflow-hidden">
                  <div
                    onClick={() => setIsCustomExpanded(!isCustomExpanded)}
                    className="p-2 px-3 flex items-center justify-between cursor-pointer hover:bg-neutral-100/60 select-none transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-neutral-800">自定义事项</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-pink-50 text-pink-600 font-medium border border-pink-200/50">
                        {customActivities.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                      <span>{isCustomExpanded ? '收起' : '展开'}</span>
                      {isCustomExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>
                  </div>

                  {isCustomExpanded && (
                    <div className="p-2 pt-0 grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-neutral-100 mt-1">
                      {customActivities.map(act => {
                        const isSelected = selectedActivity === act.name;
                        return (
                          <div
                            key={act.id}
                            onClick={() => setSelectedActivity(act.name)}
                            className={`p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'border-pink-500 bg-pink-50/70 text-pink-900 shadow-2xs font-semibold ring-1 ring-pink-300'
                                : 'border-neutral-200/80 bg-white hover:bg-neutral-50 text-neutral-700'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 pr-1">
                              <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-pink-500' : 'text-neutral-400'}`} />
                              <span className="text-xs truncate">{act.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteCustomActivity(act.id, e)}
                              className="p-1 rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                              title="删除自定义事项"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 自定义事项输入 */}
              {showAddCustom && (
                <div className="flex gap-2 pt-1 animate-fade-in">
                  <input
                    type="text"
                    value={customActivity}
                    onChange={e => setCustomActivity(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddCustomActivity()}
                    placeholder="输入自定义陪伴内容，如：散步、做手账..."
                    className="flex-1 px-3 py-1.5 text-xs bg-neutral-50 rounded-xl border border-neutral-200 outline-none focus:border-neutral-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomActivity}
                    className="px-3 py-1.5 bg-neutral-900 text-white rounded-xl text-xs font-medium cursor-pointer"
                  >
                    确认
                  </button>
                </div>
              )}
            </div>

            {/* 开启按钮 */}
            <button
              type="button"
              onClick={handleStartCompanion}
              className="w-full py-3 bg-neutral-900 text-white rounded-2xl text-xs font-semibold hover:bg-neutral-800 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <HeartHandshake className="w-4 h-4 text-pink-400" />
              <span>邀请「{charDisplayName}」开启陪伴</span>
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 陪伴记录报告模块 (周/月/全部，最长记录、陪伴次数、时段太阳曲线、奖励与激励) */}
        {/* ========================================================================= */}
        <div className="bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-neutral-900 text-xs">陪伴心动报告</span>
            </div>

            {/* 维度切换 */}
            <div className="flex bg-neutral-100 p-0.5 rounded-xl">
              {(['week', 'month', 'all'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setReportPeriod(p)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                    reportPeriod === p
                      ? 'bg-white text-neutral-900 shadow-2xs font-bold'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  {p === 'week' ? '本周' : p === 'month' ? '本月' : '全部'}
                </button>
              ))}
            </div>
          </div>

          {/* 数据总览卡片网格 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 bg-neutral-50 rounded-2xl border border-neutral-200/60 flex flex-col items-center text-center">
              <span className="text-[10px] text-neutral-400 block mb-0.5">共同陪伴次数</span>
              <span className="text-base font-bold text-neutral-900">{reportData.totalCount} <span className="text-[10px] font-normal text-neutral-500">次</span></span>
            </div>

            <div className="p-2.5 bg-neutral-50 rounded-2xl border border-neutral-200/60 flex flex-col items-center text-center">
              <span className="text-[10px] text-neutral-400 block mb-0.5">最长单次陪伴</span>
              <span className="text-base font-bold text-pink-600 truncate max-w-full">
                {reportData.longestSeconds > 0 ? formatDurationZh(reportData.longestSeconds) : '0分'}
              </span>
            </div>

            <div className="p-2.5 bg-neutral-50 rounded-2xl border border-neutral-200/60 flex flex-col items-center text-center">
              <span className="text-[10px] text-neutral-400 block mb-0.5">累计共度时光</span>
              <span className="text-base font-bold text-neutral-900 truncate max-w-full">
                {reportData.totalSeconds > 0 ? formatDurationZh(reportData.totalSeconds) : '0分'}
              </span>
            </div>
          </div>

          {/* 太阳日出日落时段曲线 (24小时轨迹图) */}
          <div className="p-3 bg-gradient-to-b from-amber-50/40 via-neutral-50 to-neutral-50 rounded-2xl border border-amber-200/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-semibold text-neutral-800 text-[11px]">最常相伴时段轨迹</span>
              </div>
              <span className="text-[10px] text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full font-medium">
                偏好时段：{reportData.totalCount > 0 ? reportData.favoriteSlot.label : '暂无数据'}
              </span>
            </div>

            {/* SVG 太阳日落日出轨迹曲线 */}
            <div className="relative pt-2 pb-1">
              <svg viewBox="0 0 300 70" className="w-full h-16 overflow-visible">
                {/* 渐变定义 */}
                <defs>
                  <linearGradient id="sunCurveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#ec4899" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.4" />
                  </linearGradient>
                  <linearGradient id="sunAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* 背景天空弧线 */}
                <path
                  d="M 15 55 Q 150 5 285 55"
                  fill="none"
                  stroke="url(#sunCurveGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* 曲线填充 */}
                <path
                  d="M 15 55 Q 150 5 285 55 L 285 65 L 15 65 Z"
                  fill="url(#sunAreaGrad)"
                />

                {/* 5个时段节点 (晨 15, 午 82, 晡 150, 昏 218, 夜 285) */}
                {[
                  { cx: 20, cy: 53, key: 'morning', label: '晨' },
                  { cx: 85, cy: 26, key: 'noon', label: '午' },
                  { cx: 150, cy: 15, key: 'afternoon', label: '晡' },
                  { cx: 215, cy: 26, key: 'sunset', label: '昏' },
                  { cx: 280, cy: 53, key: 'night', label: '夜' },
                ].map((pt, i) => {
                  const isFav = reportData.favoriteSlot.key === pt.key && reportData.totalCount > 0;
                  return (
                    <g key={pt.key}>
                      <circle
                        cx={pt.cx}
                        cy={pt.cy}
                        r={isFav ? 6 : 3.5}
                        fill={isFav ? '#ec4899' : '#ffffff'}
                        stroke={isFav ? '#ffffff' : '#d97706'}
                        strokeWidth={isFav ? 2 : 1.5}
                        className={isFav ? 'filter drop-shadow-md' : ''}
                      />
                      {isFav && (
                        <circle
                          cx={pt.cx}
                          cy={pt.cy}
                          r={10}
                          fill="none"
                          stroke="#ec4899"
                          strokeWidth="1.5"
                          strokeDasharray="2 2"
                          opacity="0.5"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* 5个时段数据统计条 */}
              <div className="grid grid-cols-5 text-center gap-1 pt-1">
                {reportData.timeSlots.map(slot => {
                  const isFav = reportData.favoriteSlot.key === slot.key && reportData.totalCount > 0;
                  return (
                    <div 
                      key={slot.key} 
                      className={`p-1 rounded-xl transition-all ${
                        isFav ? 'bg-pink-100/70 font-semibold text-pink-900 ring-1 ring-pink-300' : 'text-neutral-500'
                      }`}
                    >
                      <span className="text-[9px] block text-neutral-400">{slot.label}</span>
                      <span className="text-[11px] font-bold">{slot.count}次</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 激励或奖励话语卡片 */}
            <div className={`p-2.5 rounded-xl text-[10px] leading-relaxed border ${
              reportData.isHighCompanion
                ? 'bg-gradient-to-r from-amber-50 to-pink-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            }`}>
              {reportData.isHighCompanion ? (
                <div>
                  <div className="flex items-center gap-1 font-bold text-amber-800 mb-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>【专属默契心印】</span>
                  </div>
                  <span>你们的默契如细水长流，时光在每一次专注与依偎中变得无比丰盈。谢谢你愿意把最温柔的时光留给彼此，愿每段陪伴都如星光常伴！</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-1 font-bold text-emerald-800 mb-0.5">
                    <Smile className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>【温暖心语】</span>
                  </div>
                  <span>最近生活是不是有点忙碌呢？记得在疲惫之余常回来坐坐，哪怕只是 5 分钟的放空静候，也是给彼此最安心的充电哦～</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 历史陪伴记录 (按月收纳 + 最多保留6个月说明 + 批量删除)                      */}
        {/* ========================================================================= */}
        <div className="bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs space-y-3">
          {/* 头部与批量操作按钮 */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-pink-500" />
                <span className="font-bold text-neutral-900 text-xs">陪伴历史归档</span>
                <span className="text-[10px] text-neutral-400">({records.length}条)</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {records.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchMode(!isBatchMode);
                    if (isBatchMode) setSelectedRecordIds(new Set());
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-medium transition-colors cursor-pointer ${
                    isBatchMode
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {isBatchMode ? '退出批量' : '批量管理'}
                </button>
              )}
            </div>
          </div>

          {/* 明确说明：按月收纳，最多保留近6个月 */}
          <div className="p-2 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-start gap-1.5 text-[10px] text-neutral-500 leading-tight">
            <AlertCircle className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.2" />
            <span>
              <strong>记录规则说明：</strong>历史记录按月份折叠收纳，系统最多保留近 <strong>6 个月</strong> 的陪伴记录，超出周期的古早数据将自动平滑优化。
            </span>
          </div>

          {/* 批量操作控制条 */}
          {isBatchMode && (
            <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 animate-fade-in">
              <span className="text-[10px] text-neutral-500">
                已选 {selectedRecordIds.size} 项 / 共 {records.length} 项
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedRecordIds.size === records.length) {
                      setSelectedRecordIds(new Set());
                    } else {
                      setSelectedRecordIds(new Set(records.map(r => r.id)));
                    }
                  }}
                  className="px-2 py-0.5 rounded text-[10px] bg-white border border-neutral-200 text-neutral-700 cursor-pointer"
                >
                  {selectedRecordIds.size === records.length ? '全不选' : '全选'}
                </button>
                <button
                  type="button"
                  onClick={handleBatchDelete}
                  disabled={selectedRecordIds.size === 0}
                  className="px-2.5 py-0.5 rounded text-[10px] bg-rose-600 text-white font-medium disabled:opacity-40 cursor-pointer"
                >
                  确认删除
                </button>
              </div>
            </div>
          )}

          {/* 按月份折叠收纳的记录列表 */}
          {records.length === 0 ? (
            <div className="py-8 text-center text-neutral-400 space-y-1">
              <HeartHandshake className="w-8 h-8 mx-auto text-neutral-300 stroke-1" />
              <p className="text-xs">还没有陪伴记录呢</p>
              <p className="text-[10px]">开启一次心动陪伴，记录你们相伴的每分每秒吧</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {monthGroupedRecords.map(group => {
                const isExpanded = expandedMonths.has(group.month);
                const monthDisplay = group.month.replace('-', '年') + '月';

                return (
                  <div key={group.month} className="rounded-2xl border border-neutral-200/70 overflow-hidden bg-neutral-50/30">
                    {/* 月份折叠标题栏 */}
                    <div
                      onClick={() => toggleMonthExpand(group.month)}
                      className="p-2.5 bg-neutral-50 hover:bg-neutral-100/70 flex items-center justify-between cursor-pointer transition-colors select-none"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-800 text-xs">{monthDisplay}</span>
                        <span className="text-[10px] text-pink-600 font-medium bg-pink-50 px-2 py-0.2 rounded-full border border-pink-200/50">
                          {group.list.length} 次 · 共 {formatDurationZh(group.totalSeconds)}
                        </span>
                      </div>
                      <div className="text-neutral-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>

                    {/* 该月份下的陪伴卡片列表 */}
                    {isExpanded && (
                      <div className="p-2 space-y-1.5 bg-white border-t border-neutral-100">
                        {group.list.map(rec => {
                          const isSelected = selectedRecordIds.has(rec.id);
                          const formattedTime = new Date(rec.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          const dateDay = rec.date.slice(5);

                          return (
                            <div
                              key={rec.id}
                              onClick={() => {
                                if (isBatchMode) {
                                  const next = new Set(selectedRecordIds);
                                  if (next.has(rec.id)) next.delete(rec.id);
                                  else next.add(rec.id);
                                  setSelectedRecordIds(next);
                                }
                              }}
                              className={`p-2 rounded-xl border flex items-center justify-between transition-all ${
                                isSelected
                                  ? 'bg-pink-50/70 border-pink-300 ring-1 ring-pink-200'
                                  : 'bg-neutral-50/60 border-neutral-200/70 hover:bg-neutral-100/60'
                              } ${isBatchMode ? 'cursor-pointer' : ''}`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {isBatchMode && (
                                  <div className="shrink-0">
                                    {isSelected ? (
                                      <CheckSquare className="w-4 h-4 text-pink-600" />
                                    ) : (
                                      <Square className="w-4 h-4 text-neutral-300" />
                                    )}
                                  </div>
                                )}
                                <div className="w-7 h-7 rounded-full bg-pink-100/60 text-pink-600 flex items-center justify-center shrink-0">
                                  <Sparkles className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <span className="font-semibold text-neutral-800 text-xs block truncate">
                                    {rec.activity}
                                  </span>
                                  <span className="text-[10px] text-neutral-400">
                                    {dateDay} {formattedTime}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono font-bold text-pink-600 text-xs">
                                  {formatDurationZh(rec.durationSeconds)}
                                </span>
                                {!isBatchMode && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteSingle(rec.id, e)}
                                    className="p-1 text-neutral-400 hover:text-rose-500 rounded-lg cursor-pointer"
                                    title="删除记录"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* 弹窗 1: 本次陪伴完成总结弹窗 (弹出陪伴时长，并可分享至聊天)                 */}
      {/* ========================================================================= */}
      {endedSummaryRecord && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in select-none">
          <div 
            className="bg-white w-full max-w-xs rounded-3xl p-5 shadow-2xl border border-pink-200 text-center space-y-4 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-pink-50 border-2 border-pink-200 mx-auto flex items-center justify-center text-pink-500 shadow-sm">
              <Award className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-neutral-900">陪伴圆满结束</h3>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                你与「{charDisplayName}」又共同度过了一段温暖时光
              </p>
            </div>

            {/* 本次时长与事项详情卡片 */}
            <div className="p-3 bg-pink-50/50 rounded-2xl border border-pink-100 space-y-1">
              <span className="text-[10px] text-neutral-400 block">本次陪伴事项：{endedSummaryRecord.activity}</span>
              <span className="text-2xl font-mono font-bold text-pink-600 block">
                {formatDurationZh(endedSummaryRecord.durationSeconds)}
              </span>
              <span className="text-[10px] text-neutral-400 block">{endedSummaryRecord.date}</span>
            </div>

            {/* 按钮操作 */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  handleShareToChat();
                  if (onNavigateToChat) {
                    onNavigateToChat();
                  }
                }}
                className="w-full py-2.5 bg-neutral-900 text-white rounded-2xl text-xs font-semibold hover:bg-neutral-800 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-pink-400" />
                <span>分享并前往聊天</span>
              </button>

              <button
                type="button"
                onClick={handleShareToChat}
                className="w-full py-2 bg-pink-50 text-pink-700 rounded-2xl text-xs font-medium hover:bg-pink-100 active:scale-95 transition-all border border-pink-200 cursor-pointer flex items-center justify-center gap-1"
              >
                <span>仅分享到聊天</span>
              </button>

              <button
                type="button"
                onClick={() => setEndedSummaryRecord(null)}
                className="w-full py-2 bg-white text-neutral-600 rounded-2xl text-xs font-medium hover:bg-neutral-50 active:scale-95 transition-all border border-neutral-200 cursor-pointer"
              >
                <span>收下记录</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 弹窗 2: 角色拒绝陪伴邀请弹窗 ("抱歉，现在不方便")                           */}
      {/* ========================================================================= */}
      {isRejectedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in select-none">
          <div 
            className="bg-white w-full max-w-xs rounded-3xl p-5 shadow-2xl border border-neutral-200 text-center space-y-3.5 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-pink-200 mx-auto shadow-xs">
              <img src={character.avatar} alt={charDisplayName} className="w-full h-full object-cover" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-neutral-900 block">{charDisplayName}</span>
              <div className="p-2.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 text-xs font-medium text-neutral-800">
                “抱歉，现在不方便”
              </div>
              <p className="text-[10px] text-neutral-400 pt-0.5">
                对方可能手头有其他事情需要专注处理，稍等片刻再来找 TA 吧～
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsRejectedModalOpen(false);
                if (companionService.getSession()?.status === 'rejected') {
                  companionService.endCompanion();
                }
              }}
              className="w-full py-2.5 bg-neutral-900 text-white rounded-2xl text-xs font-semibold hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer"
            >
              知道啦
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
