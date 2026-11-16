import React, { useState, useMemo, useEffect } from 'react';
import { 
  ChevronLeft, 
  Plus, 
  Wallet, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar, 
  PieChart as PieChartIcon, 
  Tag, 
  X, 
  Check, 
  Info,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { LedgerEntry } from '../types';
import { StorageService } from '../services/StorageService';

interface LedgerPageProps {
  ledgerEntries: LedgerEntry[];
  onAddLedgerEntry: (entry: LedgerEntry) => void;
  onDeleteLedgerEntries: (ids: string[]) => void;
  onBack: () => void;
}

// 预设支出分类 (色彩丰富、具有明确辨识度)
const DEFAULT_EXPENSE_CATEGORIES = [
  '餐饮', '购物', '日用', '交通', '约会', '零食', '娱乐', '礼物', '居住', '医疗'
];

// 预设收入分类
const DEFAULT_INCOME_CATEGORIES = [
  '工资', '兼职', '奖金', '红包', '理财', '生活费', '报销', '其他收入'
];

// 预设分类颜色映射表 (支出预设分类使用高辨识度专属色)
const DEFAULT_EXPENSE_COLORS: Record<string, string> = {
  餐饮: '#f43f5e', // 玫瑰红
  购物: '#8b5cf6', // 梦幻紫
  日用: '#10b981', // 翡翠绿
  交通: '#0ea5e9', // 天空蓝
  约会: '#ec4899', // 甜心粉
  零食: '#f97316', // 暖橙色
  娱乐: '#a855f7', // 亮紫色
  礼物: '#e11d48', // 樱桃红
  居住: '#6366f1', // 靛青蓝
  医疗: '#14b8a6', // 青碧绿
};

// 自定义分类在圆饼图中必须用灰色显示 (符合需求3规则)
const CUSTOM_CATEGORY_GRAY = '#9ca3af'; // 纯净灰色 (Slate-400)

type PeriodTab = 'week' | 'month' | 'year' | 'all';

// 获取指定日期所在周的周一和周日 (ISO格式周)
function getWeekBounds(date: Date): { monday: Date; sunday: Date; mondayStr: string; sundayStr: string } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    monday,
    sunday,
    mondayStr: monday.toISOString().slice(0, 10),
    sundayStr: sunday.toISOString().slice(0, 10),
  };
}

export const LedgerPage: React.FC<LedgerPageProps> = ({
  ledgerEntries,
  onAddLedgerEntry,
  onDeleteLedgerEntries,
  onBack,
}) => {
  // 周期分类选择：年月周及全部
  const [activeTab, setActiveTab] = useState<PeriodTab>('month');

  // 当前浏览的基准日期
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  // 记一笔弹窗与表单状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('餐饮');
  const [note, setNote] = useState('');
  
  // 选择日期记账（默认今天）
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const oneYearAgoStr = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const [entryDate, setEntryDate] = useState<string>(todayStr);

  // 用户自定义分类 (分别保存支出和收入的自定义分类)
  const [customCategories, setCustomCategories] = useState<{ expense: string[]; income: string[] }>(() => {
    return StorageService.getCustomLedgerCategories();
  });
  const [showAddCustomCategory, setShowAddCustomCategory] = useState(false);
  const [newCustomCategoryName, setNewCustomCategoryName] = useState('');

  // 批量删除状态
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(false);

  // 提示消息 (Toast)
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 2200);
  };

  // 当前类型下的所有可选分类 (预设分类 + 用户自定义分类)
  const currentCategories = useMemo(() => {
    const presets = type === 'expense' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;
    const customs = type === 'expense' ? customCategories.expense : customCategories.income;
    return [...presets, ...customs];
  }, [type, customCategories]);

  // 当切换收支类型时，若当前分类不属于新分类列表，重置为第一个预设
  useEffect(() => {
    if (!currentCategories.includes(category)) {
      setCategory(currentCategories[0] || (type === 'expense' ? '餐饮' : '工资'));
    }
  }, [type, currentCategories, category]);

  // 判断是否为自定义分类
  const isCustomCategory = (catName: string): boolean => {
    return customCategories.expense.includes(catName) || customCategories.income.includes(catName) ||
      (!DEFAULT_EXPENSE_CATEGORIES.includes(catName) && !DEFAULT_INCOME_CATEGORIES.includes(catName));
  };

  // 添加自定义分类
  const handleCreateCustomCategory = () => {
    const trimmed = newCustomCategoryName.trim();
    if (!trimmed) return;
    if (trimmed.length > 8) {
      showToast('分类名称最多 8 个字');
      return;
    }
    if (currentCategories.includes(trimmed)) {
      showToast('该分类已存在');
      return;
    }

    const updated = {
      ...customCategories,
      [type]: [...customCategories[type], trimmed],
    };
    setCustomCategories(updated);
    StorageService.saveCustomLedgerCategories(updated);
    setCategory(trimmed);
    setNewCustomCategoryName('');
    setShowAddCustomCategory(false);
    showToast(`已添加自定义分类「${trimmed}」`);
  };

  // 删除自定义分类
  const handleDeleteCustomCategory = (catToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = {
      ...customCategories,
      [type]: customCategories[type].filter(c => c !== catToDelete),
    };
    setCustomCategories(updated);
    StorageService.saveCustomLedgerCategories(updated);
    if (category === catToDelete) {
      setCategory(currentCategories[0] || (type === 'expense' ? '餐饮' : '工资'));
    }
    showToast(`已删除自定义分类「${catToDelete}」`);
  };

  // 周期前后切换
  const handlePrevPeriod = () => {
    const next = new Date(currentDate);
    if (activeTab === 'week') {
      next.setDate(next.getDate() - 7);
    } else if (activeTab === 'month') {
      next.setMonth(next.getMonth() - 1);
    } else if (activeTab === 'year') {
      next.setFullYear(next.getFullYear() - 1);
    }
    setCurrentDate(next);
  };

  const handleNextPeriod = () => {
    const next = new Date(currentDate);
    if (activeTab === 'week') {
      next.setDate(next.getDate() + 7);
    } else if (activeTab === 'month') {
      next.setMonth(next.getMonth() + 1);
    } else if (activeTab === 'year') {
      next.setFullYear(next.getFullYear() + 1);
    }
    setCurrentDate(next);
  };

  const handleResetToCurrent = () => {
    setCurrentDate(new Date());
  };

  // 计算当前周期的文本标签及日期范围
  const periodInfo = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth() + 1;

    if (activeTab === 'week') {
      const bounds = getWeekBounds(currentDate);
      const mMonday = bounds.monday.getMonth() + 1;
      const dMonday = bounds.monday.getDate();
      const mSunday = bounds.sunday.getMonth() + 1;
      const dSunday = bounds.sunday.getDate();
      
      const label = `${bounds.monday.getFullYear()}年 ${mMonday}月${dMonday}日 - ${mSunday}月${dSunday}日`;
      return {
        label,
        subLabel: '周度统计',
        filterFn: (entry: LedgerEntry) => {
          return entry.date >= bounds.mondayStr && entry.date <= bounds.sundayStr;
        },
      };
    }

    if (activeTab === 'month') {
      const monthPrefix = `${y}-${String(m).padStart(2, '0')}`;
      return {
        label: `${y}年 ${m}月`,
        subLabel: '月度统计',
        filterFn: (entry: LedgerEntry) => entry.date.startsWith(monthPrefix),
      };
    }

    if (activeTab === 'year') {
      const yearPrefix = `${y}`;
      return {
        label: `${y}年`,
        subLabel: '年度统计',
        filterFn: (entry: LedgerEntry) => entry.date.startsWith(yearPrefix),
      };
    }

    // 全部 (近一年)
    return {
      label: '近一年全部账单',
      subLabel: '总汇统计',
      filterFn: () => true,
    };
  }, [activeTab, currentDate]);

  // 根据当前周期筛选账目明细
  const periodEntries = useMemo(() => {
    return ledgerEntries
      .filter(periodInfo.filterFn)
      .sort((a, b) => {
        // 先按日期倒序，同日按创建时间倒序
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [ledgerEntries, periodInfo]);

  // 单独统计当前周期的收支情况
  const periodExpense = useMemo(() => {
    return periodEntries
      .filter(e => e.type === 'expense')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [periodEntries]);

  const periodIncome = useMemo(() => {
    return periodEntries
      .filter(e => e.type === 'income')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [periodEntries]);

  const periodBalance = useMemo(() => {
    return periodIncome - periodExpense;
  }, [periodIncome, periodExpense]);

  // 支出部分圆饼图数据分析：计算各分类支出总额、百分比、颜色
  const expenseChartData = useMemo(() => {
    if (periodExpense <= 0) return { categories: [], topCategory: null };

    const map = new Map<string, number>();
    periodEntries.forEach(e => {
      if (e.type === 'expense') {
        map.set(e.category, (map.get(e.category) || 0) + e.amount);
      }
    });

    const list = Array.from(map.entries()).map(([cat, total]) => {
      const percentage = (total / periodExpense) * 100;
      const isCustom = isCustomCategory(cat);
      // 自定义分类在圆饼图中用灰色显示；预设分类用专有色彩
      const color = isCustom ? CUSTOM_CATEGORY_GRAY : (DEFAULT_EXPENSE_COLORS[cat] || '#64748b');

      return {
        category: cat,
        amount: total,
        percentage,
        isCustom,
        color,
      };
    });

    // 按支出金额从大到小排序
    list.sort((a, b) => b.amount - a.amount);

    return {
      categories: list,
      topCategory: list[0] || null, // 支出最多的分类
    };
  }, [periodEntries, periodExpense, customCategories]);

  // 记一笔保存逻辑
  const handleAdd = () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      showToast('请输入有效金额');
      return;
    }

    const finalDate = entryDate || todayStr;

    const entry: LedgerEntry = {
      id: 'led_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      date: finalDate,
      amount: Math.round(num * 100) / 100,
      type,
      category,
      note: note.trim(),
      createdAt: Date.now(),
    };

    onAddLedgerEntry(entry);
    setAmount('');
    setNote('');
    setEntryDate(todayStr);
    setShowAddModal(false);
    showToast(`已记一笔${type === 'expense' ? '支出' : '收入'} ¥${entry.amount.toFixed(2)}`);
  };

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    onDeleteLedgerEntries(selectedIds);
    setSelectedIds([]);
    setShowConfirmDelete(false);
    showToast(`已删除 ${count} 笔记账记录`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === periodEntries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(periodEntries.map(e => e.id));
    }
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
        <div className="flex items-center gap-1.5">
          <Wallet className="w-4 h-4 text-pink-500" />
          <span className="text-xs font-bold text-neutral-900">甜蜜记账本</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setEntryDate(todayStr);
            setShowAddModal(true);
          }}
          className="px-2.5 py-1 text-xs bg-neutral-900 text-white rounded-full font-medium flex items-center gap-1 hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>记一笔</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
        
        {/* 1. 周期分类切换 (周 / 月 / 年 / 全部) */}
        <div className="bg-white p-1.5 rounded-2xl border border-neutral-200/80 shadow-2xs flex items-center justify-between gap-1">
          {(['week', 'month', 'year', 'all'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center ${
                activeTab === tab
                  ? 'bg-neutral-900 text-white shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
              }`}
            >
              {tab === 'week' && '按周'}
              {tab === 'month' && '按月'}
              {tab === 'year' && '按年'}
              {tab === 'all' && '全部'}
            </button>
          ))}
        </div>

        {/* 周期导航器 (当前周/月/年时间范围切换) */}
        {activeTab !== 'all' && (
          <div className="bg-white/80 backdrop-blur-xs px-3 py-2 rounded-2xl border border-neutral-200/70 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handlePrevPeriod}
              className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
              title="上一周期"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center cursor-pointer" onClick={handleResetToCurrent}>
              <div className="font-bold text-neutral-900 text-xs flex items-center justify-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-pink-500" />
                <span>{periodInfo.label}</span>
              </div>
              <span className="text-[10px] text-neutral-400">点击返回当前</span>
            </div>
            <button
              type="button"
              onClick={handleNextPeriod}
              className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
              title="下一周期"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 2. 单独统计年月周的收支情况 Card */}
        <div className="bg-neutral-900 text-white p-4 rounded-3xl shadow-md space-y-3 relative overflow-hidden">
          {/* 背景光晕装饰 */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-pink-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between text-[11px] text-neutral-400 relative z-10">
            <span className="flex items-center gap-1 font-medium">
              <span>{periodInfo.label}</span>
              <span className="text-[10px] text-pink-300 font-normal">({periodInfo.subLabel})</span>
            </span>
            <span className="text-[10px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full font-mono">
              共 {periodEntries.length} 笔
            </span>
          </div>

          <div className="relative z-10">
            <div className="text-[11px] text-neutral-400 mb-0.5">周期净结余 (元)</div>
            <div className="text-2xl font-mono font-bold tracking-tight flex items-baseline gap-1">
              <span>¥</span>
              <span>{periodBalance.toFixed(2)}</span>
              {periodBalance >= 0 ? (
                <span className="text-[11px] font-sans font-medium text-emerald-400 ml-2">结余充裕</span>
              ) : (
                <span className="text-[11px] font-sans font-medium text-rose-400 ml-2">本期超支</span>
              )}
            </div>
          </div>

          {/* 收入与支出明细栏 */}
          <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-neutral-800 text-[11px] relative z-10">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <TrendingDown className="w-3 h-3 text-emerald-400 rotate-180" />
              </div>
              <div>
                <div className="text-[10px] text-neutral-400">总收入</div>
                <div className="font-mono font-bold text-xs">¥{periodIncome.toFixed(2)}</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-rose-400">
              <div className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                <TrendingUp className="w-3 h-3 text-rose-400" />
              </div>
              <div>
                <div className="text-[10px] text-neutral-400">总支出</div>
                <div className="font-mono font-bold text-xs">¥{periodExpense.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 支出分类圆饼图 (单独做一个圆饼图，清晰显示哪个分类支出的最多) */}
        <div className="bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-neutral-100">
            <div className="flex items-center gap-1.5 font-bold text-neutral-900 text-xs">
              <PieChartIcon className="w-4 h-4 text-rose-500" />
              <span>支出分类占比</span>
            </div>
            <span className="text-[10px] text-neutral-400 font-mono">
              支出总额: ¥{periodExpense.toFixed(2)}
            </span>
          </div>

          {periodExpense > 0 && expenseChartData.categories.length > 0 ? (
            <div className="space-y-3">
              {/* 清晰显示哪个分类支出的最多的高亮横幅 */}
              {expenseChartData.topCategory && (
                <div className="bg-rose-50/80 border border-rose-200/60 rounded-2xl p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">👑</span>
                    <div>
                      <div className="text-[10px] text-rose-600 font-medium">本周期支出最多分类</div>
                      <div className="text-xs font-bold text-neutral-900 flex items-center gap-1">
                        <span>{expenseChartData.topCategory.category}</span>
                        {expenseChartData.topCategory.isCustom && (
                          <span className="text-[9px] bg-neutral-200 text-neutral-700 px-1 py-0.2 rounded">自定义</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-xs font-bold text-rose-600">
                      ¥{expenseChartData.topCategory.amount.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-rose-500/80">
                      占比 {expenseChartData.topCategory.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}

              {/* 圆饼图 / 甜甜圈图 SVG 绘制 */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-2">
                <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                    {/* 背景底环 */}
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#f3f4f6"
                      strokeWidth="14"
                    />
                    {/* 各分类圆环切片 */}
                    {(() => {
                      const radius = 38;
                      const circumference = 2 * Math.PI * radius;
                      let accumulatedPercent = 0;

                      return expenseChartData.categories.map((item, idx) => {
                        const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
                        const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                        accumulatedPercent += item.percentage;

                        return (
                          <circle
                            key={idx}
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="transparent"
                            stroke={item.color}
                            strokeWidth="14"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-300 hover:opacity-90 cursor-pointer"
                          >
                            <title>{`${item.category}: ¥${item.amount.toFixed(2)} (${item.percentage.toFixed(1)}%)`}</title>
                          </circle>
                        );
                      });
                    })()}
                  </svg>
                  {/* 圆饼中心统计展示 */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] text-neutral-400">总支出</span>
                    <span className="text-xs font-bold font-mono text-neutral-900">
                      ¥{periodExpense.toFixed(0)}
                    </span>
                  </div>
                </div>

                {/* 分类图例与排行榜 */}
                <div className="flex-1 w-full space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {expenseChartData.categories.map((item, idx) => (
                    <div 
                      key={item.category} 
                      className="flex items-center justify-between text-[11px] p-1.5 rounded-xl hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {/* 颜色标记点 (自定义分类统一灰色) */}
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" 
                          style={{ backgroundColor: item.color }} 
                        />
                        <span className="font-medium text-neutral-800 truncate">
                          {item.category}
                        </span>
                        {item.isCustom && (
                          <span className="text-[9px] bg-neutral-200 text-neutral-600 px-1 py-0.2 rounded shrink-0">
                            自定义(灰)
                          </span>
                        )}
                        {idx === 0 && (
                          <span className="text-[9px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-medium shrink-0">
                            最高
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-mono">
                        <span className="text-neutral-400 text-[10px]">
                          {item.percentage.toFixed(1)}%
                        </span>
                        <span className="font-bold text-neutral-900 text-xs">
                          ¥{item.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-neutral-400 space-y-1">
              <Sparkles className="w-6 h-6 mx-auto text-neutral-300 mb-1" />
              <div className="text-xs font-medium text-neutral-500">本周期暂无支出记录</div>
              <div className="text-[10px] text-neutral-400">生活充满期待，保持良好财务习惯～</div>
            </div>
          )}
        </div>

        {/* 4. 记账数据保留小字说明 (需求2：最多保留近一年的记录) */}
        <div className="bg-neutral-50 border border-neutral-200/60 rounded-2xl p-2.5 flex items-center gap-2 text-[10px] text-neutral-500 leading-relaxed">
          <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span>
            系统提示：记账数据最多保留近一年的记录，超过一年的历史账单将自动清理归档。
          </span>
        </div>

        {/* 5. 记账明细列表与批量删除 (可收纳栏) */}
        <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-2xs overflow-hidden transition-all">
          <div 
            onClick={() => setIsDetailsCollapsed(!isDetailsCollapsed)}
            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-neutral-50/70 transition-colors select-none"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-800">记账明细列表</span>
              <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-mono">
                {periodEntries.length} 笔明细
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-400 font-medium">
                {isDetailsCollapsed ? '展开' : '收起'}
              </span>
              {isDetailsCollapsed ? (
                <ChevronDown className="w-4 h-4 text-neutral-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-neutral-400" />
              )}
            </div>
          </div>

          {!isDetailsCollapsed && (
            <div className="p-3.5 pt-0 border-t border-neutral-100 space-y-2 mt-1 animate-fade-in">
              <div className="flex items-center justify-end px-1 pt-2">
                {periodEntries.length > 0 && (
                  <div className="flex items-center gap-2">
                    {selectedIds.length > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleSelectAll(); }}
                          className="text-[11px] text-neutral-500 hover:text-neutral-800 cursor-pointer"
                        >
                          {selectedIds.length === periodEntries.length ? '取消全选' : '全选'}
                        </button>
                        {showConfirmDelete ? (
                          <div className="flex items-center gap-1.5 animate-fade-in" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={handleBatchDelete}
                              className="text-[10px] text-white bg-red-600 hover:bg-red-700 px-2 py-0.5 rounded-lg font-medium cursor-pointer shadow-2xs"
                            >
                              确认删除 ({selectedIds.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowConfirmDelete(false)}
                              className="text-[10px] text-neutral-500 hover:text-neutral-700 px-1"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(true); }}
                            className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-0.5 font-medium cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>删除 ({selectedIds.length})</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSelectAll(); }}
                        className="text-[11px] text-neutral-500 hover:text-neutral-800 cursor-pointer"
                      >
                        批量管理
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 列表渲染 */}
              {periodEntries.length === 0 ? (
                <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-200/60 text-center text-neutral-400 space-y-2">
                  <Wallet className="w-7 h-7 mx-auto text-neutral-300" />
                  <div className="text-xs text-neutral-500 font-medium">当前周期还没有记账记录</div>
                  <button
                    type="button"
                    onClick={() => {
                      setEntryDate(todayStr);
                      setShowAddModal(true);
                    }}
                    className="text-xs text-pink-600 font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>立即记一笔</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                  {periodEntries.map(entry => {
                    const isSelected = selectedIds.includes(entry.id);
                    const isCustom = isCustomCategory(entry.category);
                    const isExpense = entry.type === 'expense';

                    return (
                      <div
                        key={entry.id}
                        onClick={() => toggleSelect(entry.id)}
                        className={`p-3 bg-white rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected 
                            ? 'border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900 shadow-2xs' 
                            : 'border-neutral-200/80 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={Boolean(isSelected)}
                            onChange={() => {}}
                            className="accent-neutral-900 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-neutral-900 text-xs">
                                {entry.category}
                              </span>
                              {isCustom && (
                                <span className="text-[9px] bg-neutral-100 text-neutral-500 px-1 py-0.2 rounded border border-neutral-200">
                                  自定义
                                </span>
                              )}
                              {entry.note && (
                                <span className="text-[11px] text-neutral-400 truncate max-w-[130px]">
                                  {entry.note}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono mt-0.5 flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" />
                              <span>{entry.date}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-mono font-bold text-xs ${
                              isExpense ? 'text-neutral-900' : 'text-emerald-600'
                            }`}
                          >
                            {isExpense ? '-' : '+'} ¥{entry.amount.toFixed(2)}
                          </span>
                          <div className="text-[9px] text-neutral-400">
                            {isExpense ? '支出' : '收入'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* 6. 记一笔弹窗 (支持日期选择、收支区分、自定义分类) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-neutral-200 space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-pink-500" />
                <span>快速记一笔</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-xs text-neutral-400 hover:text-neutral-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 支出 / 收入 区分选择 */}
            <div className="flex bg-neutral-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  type === 'expense' 
                    ? 'bg-rose-500 text-white shadow-2xs' 
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                支出
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  type === 'income' 
                    ? 'bg-emerald-600 text-white shadow-2xs' 
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                收入
              </button>
            </div>

            {/* 金额输入 */}
            <div>
              <label className="text-[10px] text-neutral-500 font-medium block mb-1">
                金额 (元)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400">¥</span>
                <input
                  type="number"
                  step="0.01"
                  value={amount ?? ''}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="w-full text-xl font-mono font-bold pl-7 pr-3 py-2 bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-none focus:bg-white focus:border-neutral-900 transition-colors"
                />
              </div>
            </div>

            {/* 需求4：可以选择日期进行记账 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-neutral-500 font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-pink-500" />
                  <span>记账日期</span>
                </label>
                {/* 快捷日期按钮 */}
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setEntryDate(todayStr)}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      entryDate === todayStr ? 'bg-pink-100 text-pink-700 font-bold' : 'text-neutral-400 hover:text-neutral-600'
                    }`}
                  >
                    今天
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const yest = new Date();
                      yest.setDate(yest.getDate() - 1);
                      setEntryDate(yest.toISOString().slice(0, 10));
                    }}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      entryDate !== todayStr ? 'bg-neutral-200 text-neutral-800 font-bold' : 'text-neutral-400 hover:text-neutral-600'
                    }`}
                  >
                    昨天
                  </button>
                </div>
              </div>
              <input
                type="date"
                value={entryDate ?? ''}
                max={todayStr}
                min={oneYearAgoStr}
                onChange={e => setEntryDate(e.target.value)}
                className="w-full text-xs font-mono p-2 bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-none focus:bg-white focus:border-neutral-900"
              />
              <span className="text-[9px] text-neutral-400 mt-0.5 block">
                支持选择近一年内的任意日期记账
              </span>
            </div>

            {/* 需求3：分类区别展示与用户自定义分类 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] text-neutral-500 font-medium flex items-center gap-1">
                  <Tag className="w-3 h-3 text-pink-500" />
                  <span>{type === 'expense' ? '支出分类' : '收入分类'}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddCustomCategory(!showAddCustomCategory)}
                  className="text-[10px] text-pink-600 hover:text-pink-700 font-medium flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>自定义分类</span>
                </button>
              </div>

              {/* 新增自定义分类的输入框 */}
              {showAddCustomCategory && (
                <div className="p-2 bg-neutral-50 rounded-xl border border-neutral-200 mb-2 flex items-center gap-1.5 animate-fade-in">
                  <input
                    type="text"
                    value={newCustomCategoryName ?? ''}
                    onChange={e => setNewCustomCategoryName(e.target.value)}
                    placeholder="输入新分类名称 (最多8字)"
                    maxLength={8}
                    className="flex-1 text-xs px-2 py-1 bg-white rounded-lg border border-neutral-200 focus:outline-none focus:border-pink-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCustomCategory}
                    disabled={!newCustomCategoryName.trim()}
                    className="px-2.5 py-1 text-xs bg-neutral-900 text-white rounded-lg font-medium disabled:opacity-40 cursor-pointer"
                  >
                    添加
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCustomCategoryName('');
                      setShowAddCustomCategory(false);
                    }}
                    className="p-1 text-neutral-400 hover:text-neutral-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* 分类网格选择列表 */}
              <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
                {currentCategories.map(c => {
                  const isSelected = category === c;
                  const isCustom = isCustomCategory(c);

                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`relative py-1.5 px-1 rounded-xl text-xs font-medium border transition-all cursor-pointer text-center truncate ${
                        isSelected
                          ? type === 'expense'
                            ? 'border-rose-500 bg-rose-500 text-white shadow-2xs'
                            : 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                          : isCustom
                            ? 'border-dashed border-neutral-300 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                            : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                      }`}
                      title={c}
                    >
                      <span>{c}</span>
                      {isCustom && !isSelected && (
                        <span 
                          onClick={(e) => handleDeleteCustomCategory(c, e)}
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-neutral-400 hover:bg-red-500 text-white flex items-center justify-center text-[8px]"
                          title="删除此分类"
                        >
                          ×
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] text-neutral-400 mt-1">
                {type === 'expense' 
                  ? '注：自定义分类在支出圆饼图中将统一用灰色显示。' 
                  : '注：已针对收入提供独立分类，支持自由新增与删除。'}
              </p>
            </div>

            {/* 备注说明 */}
            <div>
              <label className="text-[10px] text-neutral-500 font-medium block mb-1">
                备注说明 (选填)
              </label>
              <input
                type="text"
                value={note ?? ''}
                onChange={e => setNote(e.target.value)}
                placeholder="例如：和对方一起喝奶茶、超市采购"
                className="w-full text-xs p-2 bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-none focus:bg-white focus:border-neutral-900"
              />
            </div>

            {/* 保存按钮 */}
            <button
              type="button"
              onClick={handleAdd}
              disabled={!amount}
              className="w-full py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-bold disabled:opacity-40 hover:bg-neutral-800 active:scale-98 transition-all cursor-pointer shadow-2xs"
            >
              保存记录
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
