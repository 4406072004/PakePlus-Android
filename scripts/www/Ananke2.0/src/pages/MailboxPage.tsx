import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, 
  Mail, 
  PenTool, 
  Trash2, 
  Sliders, 
  CheckSquare, 
  Square, 
  Check, 
  CheckCheck, 
  Calendar, 
  X, 
  Sparkles, 
  Clock, 
  Inbox, 
  Send 
} from 'lucide-react';
import { Letter, UserProfile, Character, Card, MailboxSettings } from '../types';
import { StorageService } from '../services/StorageService';
import { globalScheduler } from '../core/Scheduler';

interface MailboxPageProps {
  userProfile: UserProfile;
  character: Character;
  cards: Card[];
  letters: Letter[];
  onAddLetter: (letter: Letter) => void;
  onDeleteLetters?: (ids: string[]) => void;
  onMarkLetterRead?: (id: string) => void;
  onMarkAllLettersRead?: () => void;
  onBack: () => void;
}

const safeFormatDate = (timestamp?: number): string => {
  if (!timestamp || isNaN(timestamp)) return '';
  try {
    const d = new Date(timestamp);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return '';
  }
};

const safeFormatDateTime = (timestamp?: number): string => {
  if (!timestamp || isNaN(timestamp)) return '';
  try {
    const d = new Date(timestamp);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
};

const getYearMonth = (timestamp?: number): string => {
  if (!timestamp || isNaN(timestamp)) return '其他日期';
  try {
    const d = new Date(timestamp);
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  } catch {
    return '其他日期';
  }
};

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}秒`;
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes}分钟`;
  const hours = (minutes / 60).toFixed(1);
  return `${hours}小时`;
};

export const MailboxPage: React.FC<MailboxPageProps> = ({
  userProfile,
  character,
  letters,
  onAddLetter,
  onDeleteLetters,
  onMarkLetterRead,
  onMarkAllLettersRead,
  onBack,
}) => {
  // Tabs: 'inbox' (收件箱 - character来信) | 'outbox' (发件箱 - user寄信)
  const [activeTab, setActiveTab] = useState<'inbox' | 'outbox'>('inbox');

  // Year/Month archive selection: 'all' or 'YYYY年M月'
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>('all');

  // Batch delete management mode
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Write modal
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [letterTitle, setLetterTitle] = useState('');
  const [letterContent, setLetterContent] = useState('');

  // View modal
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);

  // Settings modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [mailboxSettings, setMailboxSettings] = useState<MailboxSettings>(() => {
    return StorageService.getMailboxSettings();
  });

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 2400);
  };

  // Sync settings whenever opened
  useEffect(() => {
    if (showSettingsModal) {
      setMailboxSettings(StorageService.getMailboxSettings());
    }
  }, [showSettingsModal]);

  // Current tab letters
  const tabLetters = useMemo(() => {
    return letters.filter(letter => {
      if (activeTab === 'inbox') {
        return letter.sender === 'character';
      } else {
        return letter.sender === 'user';
      }
    });
  }, [letters, activeTab]);

  // Available year-months for current tab
  const availableYearMonths = useMemo(() => {
    const map = new Map<string, number>();
    tabLetters.forEach(l => {
      const ym = getYearMonth(l.timestamp);
      map.set(ym, (map.get(ym) || 0) + 1);
    });
    return Array.from(map.entries()).map(([ym, count]) => ({ ym, count }));
  }, [tabLetters]);

  // Filtered letters based on Year-Month archive selection
  const filteredLetters = useMemo(() => {
    if (selectedYearMonth === 'all') {
      return tabLetters;
    }
    return tabLetters.filter(l => getYearMonth(l.timestamp) === selectedYearMonth);
  }, [tabLetters, selectedYearMonth]);

  // Grouped by Month when in 'all' view
  const groupedLetters = useMemo(() => {
    const groups: { [key: string]: Letter[] } = {};
    filteredLetters.forEach(l => {
      const ym = getYearMonth(l.timestamp);
      if (!groups[ym]) groups[ym] = [];
      groups[ym].push(l);
    });
    return groups;
  }, [filteredLetters]);

  // Unread count in inbox
  const inboxUnreadCount = useMemo(() => {
    return letters.filter(l => l.sender === 'character' && !l.isRead).length;
  }, [letters]);

  // Switch tab resets selection
  const handleTabChange = (tab: 'inbox' | 'outbox') => {
    setActiveTab(tab);
    setSelectedYearMonth('all');
    setSelectedIds([]);
  };

  // Reading a letter: immediately marks isRead = true to clear red dot
  const handleOpenLetter = (letter: Letter) => {
    if (isBatchMode) {
      toggleSelectLetter(letter.id);
      return;
    }

    setSelectedLetter(letter);

    // If unread, mark read immediately to dismiss badge
    if (!letter.isRead) {
      if (onMarkLetterRead) {
        onMarkLetterRead(letter.id);
      } else {
        const next = letters.map(l => (l.id === letter.id ? { ...l, isRead: true } : l));
        StorageService.saveLetters(next);
      }
    }
  };

  // Batch delete toggle
  const toggleSelectLetter = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Select all / Deselect all
  const handleSelectAll = () => {
    if (selectedIds.length === filteredLetters.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLetters.map(l => l.id));
    }
  };

  // Execute batch delete
  const handleConfirmBatchDelete = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;

    if (onDeleteLetters) {
      onDeleteLetters(selectedIds);
    } else {
      const next = letters.filter(l => !selectedIds.includes(l.id));
      StorageService.saveLetters(next);
    }

    setSelectedIds([]);
    setIsBatchMode(false);
    setShowDeleteConfirm(false);
    showToast(`已删除 ${count} 封信件`);
  };

  // Mark all unread letters as read
  const handleMarkAllRead = () => {
    if (inboxUnreadCount === 0) return;
    if (onMarkAllLettersRead) {
      onMarkAllLettersRead();
    } else {
      const next = letters.map(l => ({ ...l, isRead: true }));
      StorageService.saveLetters(next);
    }
    showToast('已全部标为已读');
  };

  // Send letter using unified Scheduler
  const handleSendLetter = () => {
    if (!letterTitle.trim() || !letterContent.trim()) return;

    const userLetter: Letter = {
      id: 'let_' + Date.now(),
      sender: 'user',
      title: letterTitle.trim(),
      content: letterContent.trim(),
      timestamp: Date.now(),
      isRead: true,
    };

    onAddLetter(userLetter);
    setLetterTitle('');
    setLetterContent('');
    setShowWriteModal(false);

    // 统一使用 Scheduler 计算并安排未来回信时间
    const currentSettings = StorageService.getMailboxSettings();
    const minMs = Math.max(1000, currentSettings.minReplyMinutes * 60 * 1000);
    const maxMs = Math.max(minMs, currentSettings.maxReplyMinutes * 60 * 1000);
    const replyDelayMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

    globalScheduler.schedule('letter_reply', replyDelayMs, {
      userLetterId: userLetter.id,
      userTitle: userLetter.title,
      minCards: currentSettings.minCardCount,
      maxCards: currentSettings.maxCardCount,
    });

    showToast(`信件已投递！预计在 ${formatDuration(replyDelayMs)} 后收到回信`);
    setActiveTab('outbox');
  };

  // Save mailbox settings
  const handleSaveSettings = () => {
    const minCard = Math.max(1, Math.min(15, mailboxSettings.minCardCount || 1));
    const maxCard = Math.max(1, Math.min(15, mailboxSettings.maxCardCount || 1));
    const minReply = Math.max(1, mailboxSettings.minReplyMinutes);
    const maxReply = Math.max(minReply, mailboxSettings.maxReplyMinutes);

    const safeSettings: MailboxSettings = {
      ...mailboxSettings,
      minCardCount: minCard,
      maxCardCount: maxCard,
      minReplyMinutes: minReply,
      maxReplyMinutes: maxReply,
    };

    setMailboxSettings(safeSettings);
    StorageService.saveMailboxSettings(safeSettings);
    setShowSettingsModal(false);
    showToast('信箱规则设置已保存');
  };

  // Immediate proactive letter trigger for testing via Scheduler
  const handleTestProactiveLetter = () => {
    globalScheduler.schedule('letter_proactive', 1200, {
      isProactive: true,
      minCards: mailboxSettings.minCardCount,
      maxCards: mailboxSettings.maxCardCount,
    });
    showToast('已排入 Scheduler，角色将在 1 秒后寄送信件！');
  };

  return (
    <div className="w-full h-full flex flex-col justify-between bg-neutral-100 select-none overflow-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/90 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-md flex items-center gap-1.5 animate-fade-in pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar */}
      <div className="h-12 px-3 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 flex items-center justify-between shrink-0 z-20">
        {isBatchMode ? (
          <>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-neutral-600 hover:text-neutral-900 font-medium px-1 cursor-pointer"
            >
              {selectedIds.length === filteredLetters.length && filteredLetters.length > 0 ? '取消全选' : '全选'}
            </button>
            <span className="text-xs font-semibold text-neutral-800">
              已选 {selectedIds.length} 封
            </span>
            <button
              type="button"
              onClick={() => {
                setIsBatchMode(false);
                setSelectedIds([]);
              }}
              className="text-xs text-neutral-500 hover:text-neutral-900 font-medium px-1 cursor-pointer"
            >
              退出
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onBack}
              className="flex items-center text-xs text-neutral-600 hover:text-neutral-900 active:scale-95 transition-all p-1 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 mr-0.5" />
              <span>返回</span>
            </button>

            <span className="text-xs font-semibold text-neutral-800 tracking-wide">时光信箱</span>

            <div className="flex items-center gap-1">
              {/* Batch Delete Mode Toggle */}
              <button
                type="button"
                onClick={() => setIsBatchMode(true)}
                title="批量管理信件"
                className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg active:scale-95 transition-all cursor-pointer"
              >
                <CheckSquare className="w-4 h-4" />
              </button>

              {/* Mailbox Rules Settings */}
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                title="信箱设置"
                className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg active:scale-95 transition-all cursor-pointer"
              >
                <Sliders className="w-4 h-4" />
              </button>

              {/* Mark All As Read */}
              {inboxUnreadCount > 0 && activeTab === 'inbox' && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  title="全部标为已读"
                  className="p-1.5 text-pink-600 hover:text-pink-700 hover:bg-pink-50 rounded-lg active:scale-95 transition-all cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}

              {/* Write Letter Button */}
              <button
                type="button"
                onClick={() => setShowWriteModal(true)}
                className="text-xs bg-neutral-900 hover:bg-neutral-800 text-white px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-2xs ml-0.5"
              >
                <PenTool className="w-3 h-3" />
                <span>寄信</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Tabs: 收件箱 vs 发件箱 */}
      <div className="px-3 pt-2.5 pb-1.5 bg-white border-b border-neutral-200/60 flex items-center justify-between shrink-0">
        <div className="flex items-center bg-neutral-100 p-0.5 rounded-xl w-full">
          <button
            type="button"
            onClick={() => handleTabChange('inbox')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'inbox'
                ? 'bg-white text-neutral-900 shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>收件箱</span>
            {inboxUnreadCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] font-bold flex items-center justify-center shadow-2xs animate-pulse">
                {inboxUnreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('outbox')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'outbox'
                ? 'bg-white text-neutral-900 shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>发件箱</span>
            <span className="text-[10px] text-neutral-400 font-mono">
              ({letters.filter(l => l.sender === 'user').length})
            </span>
          </button>
        </div>
      </div>

      {/* 顶部按年份和月份收纳栏目 (Year-Month Archive Pills) */}
      <div className="px-3 py-2 bg-neutral-50/90 border-b border-neutral-200/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <div className="flex items-center text-[10px] text-neutral-500 font-medium shrink-0 mr-1">
          <Calendar className="w-3 h-3 mr-1 text-neutral-400" />
          <span>归档</span>
        </div>

        <button
          type="button"
          onClick={() => setSelectedYearMonth('all')}
          className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-all cursor-pointer ${
            selectedYearMonth === 'all'
              ? 'bg-neutral-800 text-white font-medium shadow-2xs'
              : 'bg-white text-neutral-600 border border-neutral-200/80 hover:bg-neutral-100'
          }`}
        >
          全部 ({tabLetters.length})
        </button>

        {availableYearMonths.map(({ ym, count }) => (
          <button
            key={ym}
            type="button"
            onClick={() => setSelectedYearMonth(ym)}
            className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-all cursor-pointer ${
              selectedYearMonth === ym
                ? 'bg-pink-500 text-white font-medium shadow-2xs'
                : 'bg-white text-neutral-600 border border-neutral-200/80 hover:bg-neutral-100'
            }`}
          >
            {ym} ({count})
          </button>
        ))}

        {availableYearMonths.length === 0 && (
          <span className="text-[11px] text-neutral-400 italic">暂无归档日期</span>
        )}
      </div>

      {/* Letters List / Grouped by Month */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {filteredLetters.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-neutral-400 space-y-2">
            <Mail className="w-8 h-8 opacity-40" />
            <p className="text-xs">
              {activeTab === 'inbox' ? '收件箱空空如也' : '发件箱暂无寄出的信件'}
            </p>
            {activeTab === 'outbox' && (
              <button
                type="button"
                onClick={() => setShowWriteModal(true)}
                className="text-xs text-pink-600 font-medium hover:underline pt-1"
              >
                给对方写第一封信
              </button>
            )}
          </div>
        ) : (
          Object.entries(groupedLetters).map(([monthLabel, monthLetters]) => (
            <div key={monthLabel} className="space-y-2">
              {/* Month Section Header */}
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold text-neutral-500 flex items-center gap-1 font-mono">
                  <span>📅</span>
                  <span>{monthLabel}</span>
                  <span className="text-[10px] text-neutral-400 font-normal">
                    ({monthLetters.length}封)
                  </span>
                </span>
                {selectedYearMonth !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedYearMonth('all')}
                    className="text-[10px] text-pink-600 hover:underline"
                  >
                    显示全部月份
                  </button>
                )}
              </div>

              {/* Month's Letters */}
              <div className="space-y-2">
                {monthLetters.map(letter => {
                  const isFromCharacter = letter.sender === 'character';
                  const isSelected = selectedIds.includes(letter.id);
                  const isUnread = !letter.isRead;

                  return (
                    <div
                      key={letter.id}
                      onClick={() => handleOpenLetter(letter)}
                      className={`w-full text-left bg-white p-3 rounded-2xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? 'border-pink-500 ring-1 ring-pink-500/20 bg-pink-50/20'
                          : isUnread
                            ? 'border-pink-300 shadow-xs'
                            : 'border-neutral-200/80 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Batch selection checkbox */}
                        {isBatchMode && (
                          <div className="pt-0.5 shrink-0 text-pink-500">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 fill-pink-500 text-white" />
                            ) : (
                              <Square className="w-4 h-4 text-neutral-300" />
                            )}
                          </div>
                        )}

                        {/* Avatar / Icon */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative ${
                            isFromCharacter
                              ? 'bg-pink-50 text-pink-500'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          <Mail className="w-4 h-4" />
                          {/* Unread red dot indicator */}
                          {isUnread && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-pink-500 rounded-full border-2 border-white ring-1 ring-pink-500/40" />
                          )}
                        </div>

                        {/* Letter Summary */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`text-xs truncate ${isUnread ? 'font-bold text-neutral-900' : 'font-medium text-neutral-800'}`}>
                                {letter.title}
                              </span>
                              {isUnread && (
                                <span className="px-1 py-0.2 bg-pink-500 text-white text-[8px] font-bold rounded-sm leading-tight shrink-0">
                                  NEW
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-neutral-400 font-mono shrink-0 ml-2">
                              {safeFormatDate(letter.timestamp)}
                            </span>
                          </div>

                          <p className="text-[11px] text-neutral-500 truncate leading-relaxed">
                            {letter.content}
                          </p>

                          <div className="flex items-center justify-between mt-1 text-[10px] text-neutral-400 font-sans">
                            <span>
                              {isFromCharacter ? `寄自：${character.nickname || character.name}` : `投递给：${character.nickname || character.name}`}
                            </span>
                            {letter.replyToLetterId && (
                              <span className="text-pink-500 font-medium">回信</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Batch Mode Bottom Action Bar */}
      {isBatchMode && (
        <div className="p-3 bg-white border-t border-neutral-200/80 flex items-center justify-between shrink-0 shadow-lg z-30">
          <span className="text-xs text-neutral-600 font-medium">
            已选择 <strong className="text-pink-600 font-bold">{selectedIds.length}</strong> 封信件
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsBatchMode(false);
                setSelectedIds([]);
              }}
              className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 bg-neutral-100 rounded-xl"
            >
              取消
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3.5 py-1.5 text-xs text-white bg-red-500 hover:bg-red-600 disabled:opacity-40 rounded-xl font-medium flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>删除 ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-xs p-5 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center gap-2.5 text-red-600">
              <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">批量删除信件</h3>
                <p className="text-[11px] text-neutral-500">删除后将无法恢复</p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 bg-neutral-50 p-3 rounded-xl leading-relaxed">
              确定要永久删除已选中的 <strong className="text-red-600">{selectedIds.length}</strong> 封信件吗？
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-xl text-xs text-neutral-600 bg-neutral-100 hover:bg-neutral-200 font-medium"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDelete}
                className="flex-1 py-2 rounded-xl text-xs text-white bg-red-500 hover:bg-red-600 font-medium shadow-2xs"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Letter Modal */}
      {selectedLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[#fcfbf9] rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-amber-100 text-neutral-800 space-y-4 font-serif relative">
            <div className="flex justify-between items-center border-b border-amber-200/60 pb-2">
              <span className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                <span>✉️</span>
                <span>{selectedLetter.title}</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedLetter(null)}
                className="w-6 h-6 rounded-full hover:bg-neutral-200/50 flex items-center justify-center text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[320px] overflow-y-auto pr-1">
              <p className="text-xs leading-loose whitespace-pre-wrap text-neutral-700 min-h-[120px] font-normal selection:bg-pink-100">
                {selectedLetter.content}
              </p>
            </div>

            <div className="text-right text-[11px] text-neutral-500 pt-3 border-t border-amber-200/60 font-sans space-y-0.5">
              <div className="font-medium text-neutral-700">
                {selectedLetter.sender === 'character' 
                  ? (character.nickname || character.name) 
                  : userProfile.name}
              </div>
              <div className="text-[10px] text-neutral-400 font-mono">
                {safeFormatDateTime(selectedLetter.timestamp)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Write Letter Modal */}
      {showWriteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-neutral-200 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
                <PenTool className="w-3.5 h-3.5 text-pink-500" />
                <span>寄信给 {character.nickname || character.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowWriteModal(false)}
                className="text-xs text-neutral-400 hover:text-neutral-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={letterTitle ?? ''}
              onChange={e => setLetterTitle(e.target.value)}
              placeholder="信件标题..."
              className="w-full text-xs p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-none focus:bg-white"
            />

            <textarea
              value={letterContent ?? ''}
              onChange={e => setLetterContent(e.target.value)}
              placeholder="写下你想对TA说的话..."
              rows={5}
              className="w-full text-xs p-3 bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-none focus:bg-white resize-none"
            />

            <div className="text-[10px] text-neutral-400 flex items-center justify-between">
              <span>统一由系统 Scheduler 排期送达</span>
              <span>
                默认回复：{mailboxSettings.minReplyMinutes}分~{mailboxSettings.maxReplyMinutes}分钟
              </span>
            </div>

            <button
              type="button"
              onClick={handleSendLetter}
              disabled={!letterTitle.trim() || !letterContent.trim()}
              className="w-full py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-medium disabled:opacity-50 hover:bg-neutral-800 active:scale-98 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>投递信件</span>
            </button>
          </div>
        </div>
      )}

      {/* Mailbox Settings Modal (概率、回复时间、抽取字卡数量设定) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-neutral-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
                <Sliders className="w-4 h-4 text-pink-500" />
                <span>信箱规则与回复设置</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-xs text-neutral-400 hover:text-neutral-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. 角色每天主动写信概率 */}
            <div className="bg-neutral-50 p-3 rounded-2xl space-y-2 border border-neutral-200/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-800">每天主动写信概率</span>
                <span className="font-bold text-pink-600 font-mono">
                  {mailboxSettings.dailyProactiveRate}%
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={mailboxSettings.dailyProactiveRate ?? 50}
                onChange={e => setMailboxSettings(prev => ({
                  ...prev,
                  dailyProactiveRate: Number(e.target.value)
                }))}
                className="w-full accent-pink-500 cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>0% (不写)</span>
                <span className="text-pink-600 font-medium">100% 为每天必写一封信</span>
              </div>
            </div>

            {/* 2. 自定义角色最长和最短回复时间 */}
            <div className="bg-neutral-50 p-3 rounded-2xl space-y-2 border border-neutral-200/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-800">角色回复时间范围</span>
                <span className="text-[10px] text-neutral-400">默认30分~4小时</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-neutral-500 block mb-1">最短回复 (分钟)</label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={mailboxSettings.minReplyMinutes ?? 30}
                    onChange={e => setMailboxSettings(prev => ({
                      ...prev,
                      minReplyMinutes: Math.max(1, Number(e.target.value))
                    }))}
                    className="w-full p-2 bg-white rounded-xl border border-neutral-200 font-mono text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-500 block mb-1">最长回复 (分钟)</label>
                  <input
                    type="number"
                    min={mailboxSettings.minReplyMinutes}
                    max="1440"
                    value={mailboxSettings.maxReplyMinutes ?? 240}
                    onChange={e => setMailboxSettings(prev => ({
                      ...prev,
                      maxReplyMinutes: Math.max(prev.minReplyMinutes, Number(e.target.value))
                    }))}
                    className="w-full p-2 bg-white rounded-xl border border-neutral-200 font-mono text-center"
                  />
                </div>
              </div>

              {/* 预设快捷选项 */}
              <div className="flex gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setMailboxSettings(prev => ({ ...prev, minReplyMinutes: 30, maxReplyMinutes: 240 }))}
                  className="flex-1 py-1 text-[10px] bg-white border border-neutral-200 rounded-lg text-neutral-600 hover:border-pink-300"
                >
                  默认 (30分~4h)
                </button>
                <button
                  type="button"
                  onClick={() => setMailboxSettings(prev => ({ ...prev, minReplyMinutes: 1, maxReplyMinutes: 3 }))}
                  className="flex-1 py-1 text-[10px] bg-white border border-neutral-200 rounded-lg text-neutral-600 hover:border-pink-300"
                >
                  极速测试 (1~3分)
                </button>
                <button
                  type="button"
                  onClick={() => setMailboxSettings(prev => ({ ...prev, minReplyMinutes: 60, maxReplyMinutes: 480 }))}
                  className="flex-1 py-1 text-[10px] bg-white border border-neutral-200 rounded-lg text-neutral-600 hover:border-pink-300"
                >
                  慢递 (1~8h)
                </button>
              </div>
            </div>

            {/* 3. 每封信抽取字卡数量设定 (下限1，上限15) */}
            <div className="bg-neutral-50 p-3 rounded-2xl space-y-2 border border-neutral-200/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-800">随机抽取字卡数量</span>
                <span className="text-[10px] text-pink-600 font-medium">下限1，上限15</span>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex justify-between text-[10px] text-neutral-500 mb-1">
                    <span>最少字卡</span>
                    <strong className="text-neutral-800 font-mono">{mailboxSettings.minCardCount}张</strong>
                  </div>
                  <input
                    id="mailbox-min-card-slider"
                    type="range"
                    min="1"
                    max="15"
                    step="1"
                    value={mailboxSettings.minCardCount ?? 2}
                    onChange={e => {
                      const v = Math.max(1, Math.min(15, Number(e.target.value)));
                      setMailboxSettings(prev => ({
                        ...prev,
                        minCardCount: v,
                      }));
                    }}
                    className="w-full accent-pink-500 cursor-pointer h-2 bg-neutral-200 rounded-lg appearance-none"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-neutral-500 mb-1">
                    <span>最多字卡</span>
                    <strong className="text-neutral-800 font-mono">{mailboxSettings.maxCardCount}张</strong>
                  </div>
                  <input
                    id="mailbox-max-card-slider"
                    type="range"
                    min="1"
                    max="15"
                    step="1"
                    value={mailboxSettings.maxCardCount ?? 4}
                    onChange={e => {
                      const v = Math.max(1, Math.min(15, Number(e.target.value)));
                      setMailboxSettings(prev => ({
                        ...prev,
                        maxCardCount: v,
                      }));
                    }}
                    className="w-full accent-pink-500 cursor-pointer h-2 bg-neutral-200 rounded-lg appearance-none"
                  />
                </div>
              </div>

              <p className="text-[10px] text-neutral-400">
                角色来信时将随机抽取 {mailboxSettings.minCardCount} ~ {mailboxSettings.maxCardCount} 张字卡拼接
              </p>
            </div>

            {/* 4. 统一使用 Scheduler 说明与即时测试按钮 */}
            <div className="bg-pink-50/50 p-3 rounded-2xl border border-pink-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-pink-500" />
                  <span>调度器 Scheduler</span>
                </span>
                <span className="text-[10px] text-pink-600">全局统一运行</span>
              </div>
              <p className="text-[10px] text-neutral-500 leading-relaxed">
                所有信件投递与回信均通过系统全局 Scheduler 异步排期，无需额外保持后台页面。
              </p>
              <button
                type="button"
                onClick={handleTestProactiveLetter}
                className="w-full py-1.5 bg-white border border-pink-200 text-pink-600 hover:bg-pink-50 rounded-xl text-xs font-medium transition-all active:scale-98 shadow-2xs"
              >
                立即触发角色寄信（测试 Scheduler）
              </button>
            </div>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSaveSettings}
              className="w-full py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 active:scale-98 transition-all shadow-2xs"
            >
              保存设置
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
