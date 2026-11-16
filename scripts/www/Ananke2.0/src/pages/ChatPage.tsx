import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  ChevronLeft, 
  Send, 
  Sparkles, 
  HandMetal, 
  Moon,
  Lock,
  MoreHorizontal,
  Smile,
  Image as ImageIcon,
  Copy,
  Trash2,
  Quote,
  X,
  PhoneCall,
  Phone,
  ListChecks,
  Gift,
  Volume2,
  Pause,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { Character, UserProfile, Card, Message, PhoneSettings, PollData, RedPacketData, CallRecordData } from '../types';
import { CardEngine } from '../core/CardEngine';
import { ProbabilityEngine } from '../core/ProbabilityEngine';
import { StorageService } from '../services/StorageService';
import { FontStorageService } from '../services/FontStorageService';
import { MiniMaxTtsService } from '../services/MiniMaxTtsService';
import { callService } from '../core/CallService';
import { getRedPacketStyle } from '../data/redPacketPresets';
import { playMessageSound } from '../utils/soundEffects';
import { ChatSettingsView, parseCssDeclarations, buildPokeMessageText } from '../components/chat/ChatSettingsView';
import { StickerEmojiPicker } from '../components/chat/StickerEmojiPicker';
import { PollModal } from '../components/chat/PollModal';
import { RedPacketModal } from '../components/chat/RedPacketModal';
import { RedPacketOpenModal } from '../components/chat/RedPacketOpenModal';
import { globalChatReplyEngine } from '../core/ChatReplyEngine';

interface ChatPageProps {
  character: Character;
  userProfile: UserProfile;
  settings: PhoneSettings;
  cards: Card[];
  messages: Message[];
  onSendMessage: (msg: Message) => void;
  onUpdateCards: (newCards: Card[]) => void;
  onUpdateSettings?: (newSettings: Partial<PhoneSettings>) => void;
  onUpdateCharacter?: (newChar: Partial<Character>) => void;
  onUpdateMessages?: (newMessagesOrUpdater: Message[] | ((prev: Message[]) => Message[])) => void;
  onMarkUserMessagesRead?: () => void;
  onTriggerCharacterReply?: (instant?: boolean) => void;
  onBack: () => void;
}

const generateMsgId = (prefix = 'msg'): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const formatMsgTime = (ts: number): string => {
  if (!ts) return '';
  const date = new Date(ts);
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
};

export const ChatPage: React.FC<ChatPageProps> = ({
  character,
  userProfile,
  settings,
  cards,
  messages,
  onSendMessage,
  onUpdateCards,
  onUpdateSettings,
  onUpdateCharacter,
  onUpdateMessages,
  onMarkUserMessagesRead,
  onTriggerCharacterReply,
  onBack,
}) => {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [viewMode, setViewMode] = useState<'chat' | 'settings'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const activeTimersRef = useRef<number[]>([]);
  const lastProactiveSentTimeRef = useRef<number>(0);
  const messagesRef = useRef<Message[]>(messages);
  // 记录已经播放过入场动画的消息ID，确保切换已读状态或重新渲染时绝不重复播放动画
  const animatedMsgIdsRef = useRef<Set<string>>(new Set(messages.map(m => m.id)));

  useEffect(() => {
    const unsubTyping = globalChatReplyEngine.onTypingChange(setIsTyping);
    return () => {
      unsubTyping();
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // 底部左侧功能：表情包与图片
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const chatImageInputRef = useRef<HTMLInputElement>(null);

  // 气泡长按/右键菜单状态（悬浮在每个气泡旁边）
  const [activeMenuMsg, setActiveMenuMsg] = useState<Message | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  // 引用中的消息
  const [replyingToMsg, setReplyingToMsg] = useState<Message | null>(null);

  // 提示 Toast
  const [toastText, setToastText] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastText(msg);
    setTimeout(() => setToastText(null), 2000);
  };

  // ① 通讯功能状态
  const nextProactiveCallTimeRef = useRef<number>(Date.now() + (15 + Math.random() * 45) * 60 * 1000);

  // ② 语音消息播放状态（MiniMax TTS）
  const [playingVoiceMsgId, setPlayingVoiceMsgId] = useState<string | null>(null);
  const [loadingVoiceMsgId, setLoadingVoiceMsgId] = useState<string | null>(null);

  // ③ 问卷模块状态
  const [showPollModal, setShowPollModal] = useState(false);

  // ④ 红包模块状态
  const [showRedPacketModal, setShowRedPacketModal] = useState(false);
  const [selectedRedPacket, setSelectedRedPacket] = useState<RedPacketData | null>(null);
  const [showRedPacketOpenModal, setShowRedPacketOpenModal] = useState(false);

  // 移动端软键盘高度自适应偏移量（支持全屏模式及非全屏模式）
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      if (window.visualViewport) {
        const diff = window.innerHeight - window.visualViewport.height;
        setKeyboardOffset(diff > 100 ? diff : 0);
      }
    };
    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);
    window.addEventListener('resize', handleResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // ⑤ 底部功能栏（即刻传讯行）拖动/滑动与灰色拉动条状态
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isToolbarInteracting, setIsToolbarInteracting] = useState(false);
  const [toolbarScrollRatio, setToolbarScrollRatio] = useState(0);
  const toolbarHideTimerRef = useRef<number | null>(null);
  const isPointerDraggingToolbarRef = useRef(false);
  const toolbarDragStartRef = useRef({ startX: 0, scrollLeft: 0 });
  const hasMovedToolbarRef = useRef(false);

  const handleToolbarScroll = () => {
    if (!toolbarRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = toolbarRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      setToolbarScrollRatio(Math.min(1, Math.max(0, scrollLeft / maxScroll)));
    }
    setIsToolbarInteracting(true);
    if (toolbarHideTimerRef.current) {
      clearTimeout(toolbarHideTimerRef.current);
    }
    toolbarHideTimerRef.current = window.setTimeout(() => {
      setIsToolbarInteracting(false);
    }, 700);
  };

  const handleToolbarPointerDown = (e: React.PointerEvent) => {
    if (!toolbarRef.current) return;
    isPointerDraggingToolbarRef.current = true;
    hasMovedToolbarRef.current = false;
    toolbarDragStartRef.current = {
      startX: e.clientX,
      scrollLeft: toolbarRef.current.scrollLeft,
    };
  };

  const handleToolbarPointerMove = (e: React.PointerEvent) => {
    if (!isPointerDraggingToolbarRef.current || !toolbarRef.current) return;
    const dx = e.clientX - toolbarDragStartRef.current.startX;
    if (Math.abs(dx) > 3) {
      hasMovedToolbarRef.current = true;
      setIsToolbarInteracting(true);
      if (toolbarHideTimerRef.current) {
        clearTimeout(toolbarHideTimerRef.current);
      }
      toolbarRef.current.scrollLeft = toolbarDragStartRef.current.scrollLeft - dx;
      const { scrollLeft, scrollWidth, clientWidth } = toolbarRef.current;
      const maxScroll = scrollWidth - clientWidth;
      if (maxScroll > 0) {
        setToolbarScrollRatio(Math.min(1, Math.max(0, scrollLeft / maxScroll)));
      }
    }
  };

  const handleToolbarPointerUp = () => {
    isPointerDraggingToolbarRef.current = false;
    if (toolbarHideTimerRef.current) {
      clearTimeout(toolbarHideTimerRef.current);
    }
    toolbarHideTimerRef.current = window.setTimeout(() => {
      setIsToolbarInteracting(false);
    }, 700);
  };

  useEffect(() => {
    isMountedRef.current = true;
    FontStorageService.loadFont();
    markUserMessagesRead();
    return () => {
      isMountedRef.current = false;
      activeTimersRef.current.forEach(id => clearTimeout(id));
      activeTimersRef.current = [];
      if (toolbarHideTimerRef.current) clearTimeout(toolbarHideTimerRef.current);
    };
  }, []);



  // 梦角状态自动更新检查（每隔 1~3 小时纯随机选取更新）
  useEffect(() => {
    StorageService.checkAndUpdateCharacterStatus(character, false, onUpdateCharacter);
    const statusTimer = setInterval(() => {
      StorageService.checkAndUpdateCharacterStatus(character, false, onUpdateCharacter);
    }, 60000);
    return () => clearInterval(statusTimer);
  }, [character, onUpdateCharacter]);

  // 角色主动发消息机制检查
  useEffect(() => {
    if (!settings.proactiveMessageEnabled) return;
    if (isForceSleepTime()) return;

    const intervalMin = Math.max(3, Math.min(180, settings.proactiveMessageIntervalMinutes || 15));
    const intervalMs = intervalMin * 60 * 1000;

    const checkProactive = () => {
      if (!isMountedRef.current) return;
      const now = Date.now();
      const lastMsgTime = messages.length > 0 ? messages[messages.length - 1].timestamp : 0;

      if (
        lastMsgTime > 0 &&
        now - lastMsgTime >= intervalMs &&
        now - lastProactiveSentTimeRef.current >= intervalMs
      ) {
        lastProactiveSentTimeRef.current = now;

        const cardCount = ProbabilityEngine.getReplyCardCount();
        const drawnCards = CardEngine.drawMultipleCards(cards, cardCount);
        if (drawnCards.length === 0) return;

        let replyText = settings.mergeCards 
          ? CardEngine.concatenateCards(drawnCards) 
          : drawnCards[0].text;

        const shouldSendVoiceProactive = (settings.voiceMessageEnabled !== false) && (Math.random() < 0.1);
        const proactiveMsg: Message = {
          id: 'msg_proactive_' + Date.now(),
          characterId: character.id,
          sender: 'character',
          timestamp: Date.now(),
          cards: drawnCards.map(c => c.text),
          text: replyText,
          voiceTranscript: replyText,
          voiceDuration: Math.max(2, Math.min(25, Math.round(replyText.length / 3.5) || 3)),
          type: shouldSendVoiceProactive ? 'voice' : 'card',
          read: true,
          isProactive: true,
        };

        onSendMessage(proactiveMsg);
      }
    };

    const intervalTimer = setInterval(checkProactive, 30000);
    return () => clearInterval(intervalTimer);
  }, [settings, messages, cards, character, onSendMessage]);

  // 角色主动来电检查机制：每15到60分钟随机触发一次，每次触发有25％的概率发起来电
  useEffect(() => {
    const checkProactiveCall = () => {
      if (!isMountedRef.current) return;
      if (callService.getSession()) return; // 正在通话中不重复发起
      const now = Date.now();
      if (now >= nextProactiveCallTimeRef.current) {
        // 重新随机下一次来电触发间隔 (15 ~ 60 分钟)
        const nextMin = 15 + Math.random() * 45;
        nextProactiveCallTimeRef.current = now + nextMin * 60 * 1000;

        // 每次触发有25％的概率发起主动来电
        if (Math.random() < 0.25) {
          callService.startCall(character.id, 'incoming');
        }
      }
    };

    const callTimer = setInterval(checkProactiveCall, 30000);
    return () => clearInterval(callTimer);
  }, [character.id]);

  const [isUnlockedByChance, setIsUnlockedByChance] = useState(false);
  const [sleepTick, setSleepTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setSleepTick(prev => prev + 1);
    }, 10000);
    return () => clearInterval(t);
  }, []);

  const isForceSleepTime = (): boolean => {
    if (!settings.forceSleepMode) return false;
    const hour = new Date().getHours();
    return hour >= 0 && hour < 7;
  };

  const isSleepLocked = isForceSleepTime() && !isUnlockedByChance;
  void sleepTick;

  // 聊天性能与抗崩溃优化：海量历史记录渐进式安全呈现与 O(1) 快速索引
  const DEFAULT_PAGE_SIZE = 60;
  const [visibleCount, setVisibleCount] = useState<number>(DEFAULT_PAGE_SIZE);

  // 消息快速检索 Map，避免引用消息时的 O(N^2) 性能暴跌
  const messageMap = useMemo(() => {
    const map = new Map<string, Message>();
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m && m.id) {
        map.set(m.id, m);
      }
    }
    return map;
  }, [messages]);

  // 当前渲染展示的安全可见消息切片
  const visibleMessages = useMemo(() => {
    if (!Array.isArray(messages)) return [];
    if (messages.length <= visibleCount) return messages;
    return messages.slice(-visibleCount);
  }, [messages, visibleCount]);

  const handleLoadEarlier = (count: number = 50) => {
    setVisibleCount(prev => Math.min(messages.length, prev + count));
  };

  const handleLoadAll = () => {
    setVisibleCount(messages.length);
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior,
      });
    }
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  const lastMsgId = messages[messages.length - 1]?.id;
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, lastMsgId, isTyping, scrollToBottom]);

  // 从设置界面返回聊天界面时，立刻将聊天页面滚动展示至最新消息
  useEffect(() => {
    if (viewMode === 'chat') {
      scrollToBottom('auto');
      const t1 = setTimeout(() => scrollToBottom('auto'), 20);
      const t2 = setTimeout(() => scrollToBottom('smooth'), 120);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [viewMode, scrollToBottom]);

  // 监督早睡模式下：用户消息保持正常显示已读
  useEffect(() => {
    if (isSleepLocked) {
      markUserMessagesRead();
    }
  }, [isSleepLocked]);

  /**
   * 将当前未读的用户消息标记为已读（原子函数式更新，绝不吞消息）
   */
  const markUserMessagesRead = () => {
    if (onMarkUserMessagesRead) {
      onMarkUserMessagesRead();
    } else if (onUpdateMessages) {
      onUpdateMessages(prev => {
        let changed = false;
        const next = prev.map(m => {
          if (m.sender === 'user' && !m.read) {
            changed = true;
            return { ...m, read: true };
          }
          return m;
        });
        return changed ? next : prev;
      });
    } else {
      const current = messagesRef.current;
      const updated = current.map(m => m.sender === 'user' && !m.read ? { ...m, read: true } : m);
      StorageService.saveMessages(updated);
    }
  };

  /**
   * 触发角色回复机制（包含表情包20%、Emoji 20%、混合模式、心愿红包等全规则）
   * 通过全局 ChatReplyEngine 调度，无论切到主界面还是其他模块，字卡均能稳定发出
   */
  const triggerCharacterReply = (instant = false) => {
    if (onTriggerCharacterReply) {
      onTriggerCharacterReply(instant);
    } else {
      globalChatReplyEngine.triggerReply({
        character,
        settings,
        cards,
        onSendMessage,
        instant,
        currentPage: 'chat',
      });
    }
  };

  const scheduleReadTimer = () => {
    const t = window.setTimeout(() => {
      if (isMountedRef.current) {
        markUserMessagesRead();
        triggerCharacterReply();
      }
    }, 1000);
    activeTimersRef.current.push(t);
  };

  /**
   * 发送纯文本消息
   */
  const handleSend = () => {
    if (!inputText.trim()) return;

    const userMsg: Message = {
      id: generateMsgId('msg_user'),
      characterId: character.id,
      sender: 'user',
      timestamp: Date.now(),
      cards: [],
      text: inputText.trim(),
      replyTo: replyingToMsg?.id,
      type: 'text',
      read: isSleepLocked ? true : false,
    };

    setReplyingToMsg(null);
    onSendMessage(userMsg);
    scheduleReadTimer();
    playMessageSound(settings.messageSound);
    setInputText('');
  };

  /**
   * 用户从表情包面板发送表情包
   */
  const handleSendSticker = (stickerUrl: string) => {
    const userMsg: Message = {
      id: generateMsgId('msg_sticker'),
      characterId: character.id,
      sender: 'user',
      timestamp: Date.now(),
      cards: [],
      text: '[表情包]',
      sticker: stickerUrl,
      replyTo: replyingToMsg?.id,
      type: 'sticker',
      read: isSleepLocked ? true : false,
    };

    setReplyingToMsg(null);
    onSendMessage(userMsg);
    scheduleReadTimer();
    playMessageSound(settings.messageSound);
    setShowStickerPicker(false);
    showToast('已发送表情包');
  };

  /**
   * 用户从 Emoji 面板发送单个 Emoji
   */
  const handleSendEmoji = (emoji: string) => {
    const userMsg: Message = {
      id: generateMsgId('msg_emoji'),
      characterId: character.id,
      sender: 'user',
      timestamp: Date.now(),
      cards: [],
      text: emoji,
      emoji: emoji,
      replyTo: replyingToMsg?.id,
      type: 'emoji',
      read: isSleepLocked ? true : false,
    };

    setReplyingToMsg(null);
    onSendMessage(userMsg);
    scheduleReadTimer();
    playMessageSound(settings.messageSound);
    setShowStickerPicker(false);
  };

  /**
   * 用户选择本地图片发送
   */
  const handleSendLocalImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSendingImage(true);
    try {
      // 智能自适应压缩控制在 ~150KB 内
      const compressedDataUrl = await FontStorageService.compressBackgroundImage(file);
      const imgMsg: Message = {
        id: generateMsgId('msg_img'),
        characterId: character.id,
        sender: 'user',
        timestamp: Date.now(),
        cards: [],
        text: '[图片]',
        imageUrl: compressedDataUrl,
        replyTo: replyingToMsg?.id,
        type: 'image',
        read: isSleepLocked ? true : false,
      };

      setReplyingToMsg(null);
      onSendMessage(imgMsg);
      scheduleReadTimer();
      playMessageSound(settings.messageSound);
      showToast('图片已发送');
    } catch (err) {
      showToast('图片压缩发送失败：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSendingImage(false);
      if (chatImageInputRef.current) chatImageInputRef.current.value = '';
    }
  };

  /**
   * 拍一拍对方
   */
  const handlePoke = () => {
    const pokesPool = StorageService.getCustomPokes();
    const charName = character.nickname || character.name;
    const userAction = ProbabilityEngine.pickRandom(pokesPool) || '拍了拍';
    const userPokeText = buildPokeMessageText(userAction, true, charName);

    const pokeMsg: Message = {
      id: generateMsgId('msg_poke'),
      characterId: character.id,
      sender: 'system',
      timestamp: Date.now(),
      cards: [],
      text: userPokeText,
      type: 'poke',
    };
    onSendMessage(pokeMsg);

    // 拍一拍回复字卡（遵循聊天模块抽取概率与最短最长延迟时间设置）
    if (settings.pokeReplyEnabled !== false) {
      triggerCharacterReply(false);
    }

    // 3% 概率角色反拍
    if (ProbabilityEngine.checkPoke()) {
      const pokeTimer = window.setTimeout(() => {
        if (!isMountedRef.current) return;
        try {
          const charAction = ProbabilityEngine.pickRandom(pokesPool) || '拍了拍';
          const replyPokeText = buildPokeMessageText(charAction, false, charName);

          const replyPoke: Message = {
            id: generateMsgId('msg_poke'),
            characterId: character.id,
            sender: 'system',
            timestamp: Date.now(),
            cards: [],
            text: replyPokeText,
            type: 'poke',
          };
          onSendMessage(replyPoke);
        } catch (err) {
          console.warn('Poke reply error:', err);
        }
      }, 1200);
      activeTimersRef.current.push(pokeTimer);
    }
  };

  /**
   * 即刻传讯（遵循聊天模块抽取概率与最短最长延迟时间设置）
   */
  const handleDrawCard = () => {
    triggerCharacterReply(false);
  };

  /**
   * ① 通讯：立刻给角色打电话
   */
  const handleStartCall = () => {
    callService.startCall(character.id, 'outgoing');
  };

  const handleRecordCall = (record: {
    initiator: 'user' | 'character';
    status: 'connected' | 'missed' | 'rejected' | 'character_hungup' | 'user_cancelled';
    durationSeconds: number;
  }) => {
    const formatDur = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    let callText = '';
    if (record.status === 'connected') {
      callText = `通话时长 ${formatDur(record.durationSeconds)}`;
    } else if (record.status === 'character_hungup') {
      callText = record.durationSeconds > 0 
        ? `通话时长 ${formatDur(record.durationSeconds)} · 对方已挂断` 
        : '对方已挂断';
    } else if (record.status === 'missed') {
      callText = record.initiator === 'user' ? '对方暂未接通' : '未接听来电';
    } else if (record.status === 'rejected') {
      callText = '已拒绝通话';
    } else {
      callText = '已取消呼叫';
    }

    const callMsg: Message = {
      id: generateMsgId('msg_call'),
      characterId: character.id,
      sender: record.initiator,
      timestamp: Date.now(),
      cards: [],
      text: callText,
      type: 'call',
      callData: {
        id: generateMsgId('calldata'),
        initiator: record.initiator,
        status: record.status,
        durationSeconds: record.durationSeconds,
      },
      read: true,
    };
    onSendMessage(callMsg);
  };

  /**
   * ② 语音消息播放：浏览器直连 MiniMax TTS，并支持本地浏览器朗读降级
   */
  const handlePlayVoiceMessage = async (msg: Message) => {
    if (playingVoiceMsgId === msg.id) {
      MiniMaxTtsService.stop();
      setPlayingVoiceMsgId(null);
      return;
    }

    // 1. 如果已有合成/缓存音频，直接播放
    if (msg.voiceAudioUrl) {
      setPlayingVoiceMsgId(msg.id);
      MiniMaxTtsService.playAudio(
        msg.voiceAudioUrl,
        msg.id,
        () => setPlayingVoiceMsgId(null),
        (err) => {
          console.warn('Audio play error, fallback to speech:', err);
          showToast('缓存音频播放异常，已降级为浏览器本地朗读');
          MiniMaxTtsService.speakWithWebSpeech(
            msg.text,
            () => setPlayingVoiceMsgId(null),
            () => setPlayingVoiceMsgId(null)
          );
        }
      );
      return;
    }

    // 2. 浏览器直连请求 MiniMax TTS
    setLoadingVoiceMsgId(msg.id);
    try {
      const res = await MiniMaxTtsService.synthesize(
        msg.text,
        settings.minimaxVoiceId,
        settings.minimaxProxyUrl,
        settings.minimaxModel || 'speech-2.8-turbo',
        settings.minimaxApiKey,
        settings.minimaxBaseUrl || (settings.minimaxRegion === 'international' ? 'https://api.minimax.chat/v1' : 'https://api.minimaxi.com/v1'),
        settings.minimaxSpeed || 1.0
      );
      setLoadingVoiceMsgId(null);

      if (res.success && res.audioUrl) {
        // 缓存生成的音频到消息对象中
        if (onUpdateMessages) {
          onUpdateMessages(prev => prev.map(m => m.id === msg.id ? {
            ...m,
            voiceAudioUrl: res.audioUrl,
            voiceDuration: res.duration || m.voiceDuration,
          } : m));
        }

        setPlayingVoiceMsgId(msg.id);
        MiniMaxTtsService.playAudio(
          res.audioUrl,
          msg.id,
          () => setPlayingVoiceMsgId(null),
          () => {
            setPlayingVoiceMsgId(null);
            showToast('音频解码播放异常，已降级为浏览器本地朗读');
            MiniMaxTtsService.speakWithWebSpeech(msg.text, () => setPlayingVoiceMsgId(null));
          }
        );
      } else {
        // MiniMax 失败时明确告知用户失败原因与当前降级为浏览器本地朗读
        const failReason = res.message || 'TTS 合成请求失败';
        showToast(`${failReason}（已降级为浏览器本地朗读）`);

        setPlayingVoiceMsgId(msg.id);
        const played = MiniMaxTtsService.speakWithWebSpeech(
          msg.text,
          () => setPlayingVoiceMsgId(null),
          () => setPlayingVoiceMsgId(null)
        );
        if (!played) {
          setPlayingVoiceMsgId(null);
        }
      }
    } catch (err: unknown) {
      setLoadingVoiceMsgId(null);
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast(`请求异常: ${errMsg}（已降级为浏览器本地朗读）`);
      setPlayingVoiceMsgId(msg.id);
      MiniMaxTtsService.speakWithWebSpeech(
        msg.text,
        () => setPlayingVoiceMsgId(null),
        () => setPlayingVoiceMsgId(null)
      );
    }
  };

  /**
   * ③ 问卷模块：发送问卷与5秒后角色完成选择
   */
  const handleSendPoll = (poll: PollData) => {
    const pollMsg: Message = {
      id: generateMsgId('msg_poll'),
      characterId: character.id,
      sender: 'user',
      timestamp: Date.now(),
      cards: [],
      text: `[问卷] ${poll.question}`,
      type: 'poll',
      pollData: poll,
      read: isSleepLocked ? true : false,
      replyTo: replyingToMsg?.id,
    };

    setReplyingToMsg(null);
    onSendMessage(pollMsg);
    scheduleReadTimer();
    playMessageSound(settings.messageSound);
    showToast('问卷已发送，5秒后揭晓选择');

    // 五秒后让角色完成选择
    const pollTimer = window.setTimeout(() => {
      if (!isMountedRef.current) return;
      markUserMessagesRead();

      let chosen: string[] = [];
      if (poll.type === 'boolean') {
        // ① 是否问卷：固定选项“是”，“否”。选择是否的概率各50%
        chosen = Math.random() < 0.5 ? ['是'] : ['否'];
      } else {
        // ② 选择问卷，可切换单选/多选。自定义选项，每条选项选到的概率一样
        if (!poll.isMultiple) {
          const pick = poll.options[Math.floor(Math.random() * poll.options.length)];
          chosen = [pick];
        } else {
          chosen = poll.options.filter(() => Math.random() < 0.5);
          if (chosen.length === 0) {
            chosen = [poll.options[Math.floor(Math.random() * poll.options.length)]];
          }
        }
      }

      // 更新问卷结果状态
      if (onUpdateMessages) {
        onUpdateMessages(prev => prev.map(m => {
          if (m.id === pollMsg.id && m.pollData) {
            return {
              ...m,
              pollData: {
                ...m.pollData,
                completed: true,
                selectedOptions: chosen,
              }
            };
          }
          return m;
        }));
      }

      // 角色发送一条回复配合
      const replyMsg: Message = {
        id: generateMsgId('msg_poll_reply'),
        characterId: character.id,
        sender: 'character',
        timestamp: Date.now() + 100,
        cards: [],
        text: `我选好啦，我的选择是「${chosen.join('、')}」！`,
        type: 'text',
        read: true,
      };
      onSendMessage(replyMsg);
    }, 5000);
    activeTimersRef.current.push(pollTimer);
  };

  /**
   * ④ 发红包模块：我发红包 (5秒内角色收取) 与 梦角发红包
   */
  const handleSendUserRedPacket = (amount: number, userRemark: string, color: string) => {
    const packetData: RedPacketData = {
      id: generateMsgId('pkt_user'),
      sender: 'user',
      amount,
      remark: userRemark,
      color,
      isOpened: false,
    };

    const redPacketMsg: Message = {
      id: generateMsgId('msg_redpacket'),
      characterId: character.id,
      sender: 'user',
      timestamp: Date.now(),
      cards: [],
      text: `[心愿红包] ¥${amount.toFixed(2)}`,
      type: 'redpacket',
      redPacketData: packetData,
      read: isSleepLocked ? true : false,
      replyTo: replyingToMsg?.id,
    };

    setReplyingToMsg(null);
    onSendMessage(redPacketMsg);
    scheduleReadTimer();
    playMessageSound(settings.messageSound);
    showToast('红包已发送');

    // 角色会在我发送 5 秒内收取我的红包
    const charReceiveTimer = window.setTimeout(() => {
      if (!isMountedRef.current) return;
      markUserMessagesRead();

      if (onUpdateMessages) {
        onUpdateMessages(prev => prev.map(m => {
          if (m.id === redPacketMsg.id && m.redPacketData) {
            return {
              ...m,
              redPacketData: {
                ...m.redPacketData,
                isOpened: true,
                openedAt: Date.now(),
              }
            };
          }
          return m;
        }));
      }

      const replyMsg: Message = {
        id: generateMsgId('msg_redpacket_ack'),
        characterId: character.id,
        sender: 'character',
        timestamp: Date.now() + 100,
        cards: [],
        text: `已领取红包 ¥${amount.toFixed(2)}`,
        type: 'text',
        read: true,
      };
      onSendMessage(replyMsg);
    }, 4500);
    activeTimersRef.current.push(charReceiveTimer);
  };

  const handleSendCharacterRedPacket = (amount: number, charRemark: string, color: string) => {
    const packetData: RedPacketData = {
      id: generateMsgId('pkt_char'),
      sender: 'character',
      amount,
      remark: charRemark,
      color,
      isOpened: false,
    };

    const charPacketMsg: Message = {
      id: generateMsgId('msg_redpacket'),
      characterId: character.id,
      sender: 'character',
      timestamp: Date.now(),
      cards: [],
      text: `[梦角红包] ¥${amount.toFixed(2)}`,
      type: 'redpacket',
      redPacketData: packetData,
      read: true,
    };

    onSendMessage(charPacketMsg);
    showToast(`${character.nickname || character.name}给你发了一个红包！`);
  };

  const handleOpenRedPacket = (packetId: string) => {
    if (onUpdateMessages) {
      onUpdateMessages(prev => prev.map(m => {
        if (m.redPacketData && m.redPacketData.id === packetId) {
          return {
            ...m,
            redPacketData: {
              ...m.redPacketData,
              isOpened: true,
              openedAt: Date.now(),
            }
          };
        }
        return m;
      }));
    }
    setSelectedRedPacket(prev => prev ? { ...prev, isOpened: true, openedAt: Date.now() } : null);
  };

  // 在气泡旁边弹出操作菜单（复制/引用/删除）
  const openBubbleMenu = (msg: Message, targetEl: HTMLElement) => {
    const rect = targetEl.getBoundingClientRect();
    const isUser = msg.sender === 'user';
    const menuWidth = 175;
    const menuHeight = 40;

    // 垂直定位在气泡旁边：默认优先在气泡上方；若顶部空间不足（<55px）则展示在下方
    let top = rect.top - menuHeight - 8;
    let placement: 'top' | 'bottom' = 'top';
    if (top < 55) {
      top = rect.bottom + 8;
      placement = 'bottom';
    }

    // 水平定位在气泡旁边：用户气泡靠右贴合，对方气泡靠左贴合，留出边界
    let left = isUser ? rect.right - menuWidth : rect.left;
    left = Math.max(12, Math.min(window.innerWidth - menuWidth - 12, left));

    setActiveMenuMsg(msg);
    setMenuPos({ top, left, placement });
  };

  // 长按气泡事件处理
  const handleBubbleTouchStart = (msg: Message, e: React.TouchEvent) => {
    const targetEl = e.currentTarget as HTMLElement;
    longPressTimerRef.current = window.setTimeout(() => {
      openBubbleMenu(msg, targetEl);
    }, 400);
  };

  const handleBubbleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleBubbleContextMenu = (msg: Message, e: React.MouseEvent) => {
    e.preventDefault();
    const targetEl = e.currentTarget as HTMLElement;
    openBubbleMenu(msg, targetEl);
  };

  // 复制气泡内容
  const handleCopyMsg = (msg: Message) => {
    let textToCopy = msg.text;
    if (msg.type === 'voice') {
      textToCopy = msg.voiceTranscript || '[语音消息]';
    } else if (msg.type === 'poll' && msg.pollData) {
      textToCopy = `[问卷] ${msg.pollData.question} (选项: ${msg.pollData.options.join('、')})`;
    } else if (msg.type === 'redpacket' && msg.redPacketData) {
      textToCopy = `[心愿红包] ¥${msg.redPacketData.amount.toFixed(2)} - ${msg.redPacketData.remark}`;
    } else if (!textToCopy) {
      textToCopy = msg.imageUrl ? '[图片]' : (msg.sticker ? '[表情包]' : '[消息]');
    }
    navigator.clipboard.writeText(textToCopy);
    showToast('已复制内容');
    setActiveMenuMsg(null);
    setMenuPos(null);
  };

  // 删除气泡（使用函数式更新，绝不吞消息）
  const handleDeleteMsg = (msg: Message) => {
    if (onUpdateMessages) {
      onUpdateMessages(prev => prev.filter(m => m.id !== msg.id));
    } else {
      const next = messagesRef.current.filter(m => m.id !== msg.id);
      StorageService.saveMessages(next);
    }
    showToast('已删除消息');
    setActiveMenuMsg(null);
    setMenuPos(null);
  };

  // 引用气泡
  const handleQuoteMsg = (msg: Message) => {
    setReplyingToMsg(msg);
    showToast('已引用该消息');
    setActiveMenuMsg(null);
    setMenuPos(null);
  };

  // 进入设置界面
  if (viewMode === 'settings') {
    return (
      <ChatSettingsView
        cards={cards}
        onUpdateCards={onUpdateCards}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        character={character}
        onUpdateCharacter={onUpdateCharacter}
        messages={messages}
        onUpdateMessages={onUpdateMessages}
        onBack={() => setViewMode('chat')}
      />
    );
  }

  // 气泡样式解析
  const charBubbleStyle = settings.characterBubbleStyle || {
    bg: '#ffffff',
    textColor: '#262626',
    radius: 18,
    customCss: '',
  };
  const userBubbleStyle = settings.userBubbleStyle || {
    bg: '#262626',
    textColor: '#ffffff',
    radius: 18,
    customCss: '',
  };
  const parsedCharCss = parseCssDeclarations(charBubbleStyle.customCss);
  const parsedUserCss = parseCssDeclarations(userBubbleStyle.customCss);

  return (
    <div className={`w-full h-full flex flex-col justify-between bg-neutral-100 select-none overflow-hidden relative ${settings.chatCustomFontName ? 'chat-custom-font-active' : ''}`}>
      {/* 聊天背景图与减淡遮罩层 */}
      {settings.chatBackground && (
        <>
          <div 
            className="absolute inset-0 bg-cover bg-center pointer-events-none z-0 transition-all duration-300"
            style={{ backgroundImage: `url(${settings.chatBackground})` }}
          />
          <div 
            className="absolute inset-0 pointer-events-none z-0 transition-colors duration-300"
            style={{ 
              backgroundColor: `rgba(255, 255, 255, ${settings.chatBackgroundMask ?? 0.3})` 
            }}
          />
        </>
      )}

      {/* 顶部提示 Toast */}
      {toastText && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 bg-neutral-900/80 backdrop-blur-md text-white text-[11px] rounded-full shadow-lg animate-fade-in pointer-events-none">
          {toastText}
        </div>
      )}

      {/* Top Navigation Bar */}
      <div className="h-12 px-3 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 flex items-center justify-between shrink-0 z-20">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center text-xs text-neutral-600 hover:text-neutral-900 active:scale-95 transition-all p-1 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 mr-0.5" />
          <span>返回</span>
        </button>

        <div className="flex flex-col items-center">
          <span className="text-xs font-semibold text-neutral-800">
            {character.nickname || character.name}
          </span>
          <span className="text-[9px] text-neutral-400 font-normal">
            {isTyping ? '对方正在输入...' : (character.status || '在线')}
          </span>
        </div>

        {/* 右上角进入设置界面 */}
        <button
          type="button"
          onClick={() => setViewMode('settings')}
          className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 active:scale-95 transition-all cursor-pointer"
          title="聊天与字卡设置"
          aria-label="聊天与字卡设置"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* 监督早睡模式提示条 */}
      {isSleepLocked && (
        <div className="bg-purple-900/90 text-purple-100 text-[11px] px-3 py-1.5 flex items-center justify-center gap-1.5 shrink-0 z-10 shadow-xs">
          <Moon className="w-3.5 h-3.5 text-purple-300" />
          <span>梦角监督你早点睡觉啦（00:00~07:00 锁定休息）</span>
        </div>
      )}

      {/* Messages Feed */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3.5 text-xs relative z-10 bg-transparent">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 py-12">
            <div className="w-12 h-12 rounded-full bg-pink-50 border border-pink-200/60 flex items-center justify-center mb-2 text-pink-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-xs text-neutral-600 font-medium">链接已开启</p>
            <p className="text-[11px] text-neutral-400 mt-1">发条消息或点击下方抽卡，聆听对方的心声吧</p>
          </div>
        )}

        {/* 聊天记录海量防卡顿/防崩溃：加载更早历史消息栏 */}
        {messages.length > visibleCount && (
          <div className="py-1.5 flex flex-col items-center justify-center gap-1 border-b border-neutral-200/50 pb-2.5 mb-2 animate-fade-in select-none">
            <span className="text-[10px] text-neutral-400">
              已展示最近 {visibleMessages.length} 条记录 · 还有 {messages.length - visibleCount} 条更早记录
            </span>
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleLoadEarlier(50)}
                className="px-2.5 py-0.5 bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 text-neutral-600 rounded-full text-[10px] font-medium transition-all shadow-2xs cursor-pointer"
              >
                加载更早 50 条
              </button>
              <button
                type="button"
                onClick={handleLoadAll}
                className="px-2.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-500 rounded-full text-[10px] font-medium transition-all cursor-pointer"
              >
                展开全部记录
              </button>
            </div>
          </div>
        )}

        {visibleMessages.map((msg: Message) => {
          if (msg.type === 'poke' || msg.type === 'system') {
            return (
              <div key={msg.id} className="flex flex-col items-center justify-center my-1.5">
                <span className="text-[10px] text-neutral-400 bg-neutral-200/60 px-2.5 py-0.5 rounded-full font-light">
                  {msg.text}
                </span>
                <span className="text-[9px] text-neutral-300 mt-0.5">{formatMsgTime(msg.timestamp)}</span>
              </div>
            );
          }

          if (msg.type === 'call') {
            const isDisconnected = msg.callData?.status === 'missed' || msg.callData?.status === 'rejected' || msg.callData?.status === 'character_hungup';
            return (
              <div key={msg.id} className="flex flex-col items-center justify-center my-2 select-none animate-fade-in">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/90 backdrop-blur-md shadow-2xs border border-neutral-200/80 text-xs">
                  <Phone className={`w-3.5 h-3.5 ${isDisconnected ? 'text-neutral-400' : 'text-emerald-500'}`} />
                  <span className="text-neutral-700 font-medium">{msg.text}</span>
                </div>
                <span className="text-[9px] text-neutral-300 mt-0.5">{formatMsgTime(msg.timestamp)}</span>
              </div>
            );
          }

          const isUser = msg.sender === 'user';
          const repliedMsg = msg.replyTo ? messageMap.get(msg.replyTo) : null;
          const isCustomBubbleContainer = msg.type === 'sticker' || msg.type === 'emoji' || msg.type === 'poll' || msg.type === 'redpacket';
          const isNewMessage = !animatedMsgIdsRef.current.has(msg.id);
          if (isNewMessage) {
            animatedMsgIdsRef.current.add(msg.id);
          }

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2 ${isNewMessage ? 'animate-bubble-in' : ''} ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {/* Character Avatar */}
              {!isUser && (
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-neutral-200 shadow-2xs">
                  <img src={character.avatar} alt="Avatar" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Message Bubble + 时间 + 已读/未读 */}
              <div className={`max-w-[75%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                {/* 引用展示：独立在气泡外部上方，不塞进气泡内部；内容长用省略号隐去 */}
                {repliedMsg && (
                  <div 
                    className={`flex items-center gap-1 text-[10px] text-neutral-400 mb-1 max-w-[180px] sm:max-w-[220px] truncate select-none ${
                      isUser ? 'self-end' : 'self-start'
                    }`}
                    title={repliedMsg.text}
                  >
                    <Quote className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                    <span className="shrink-0 font-medium text-neutral-500">
                      {repliedMsg.sender === 'user' ? '我' : (character.nickname || character.name)}:
                    </span>
                    <span className="truncate opacity-80">
                      {repliedMsg.text || (repliedMsg.imageUrl ? '[图片]' : '[表情包]')}
                    </span>
                  </div>
                )}

                {/* 气泡本体（绝无内部引用撑大，气泡尺寸完全由输出消息长度决定，支持长按菜单） */}
                <div
                  onTouchStart={(e) => handleBubbleTouchStart(msg, e)}
                  onTouchEnd={handleBubbleTouchEnd}
                  onTouchMove={handleBubbleTouchEnd}
                  onContextMenu={(e) => handleBubbleContextMenu(msg, e)}
                  className={`relative select-text transition-transform active:scale-[0.98] w-fit max-w-full ${
                    isCustomBubbleContainer 
                      ? 'p-0 bg-transparent' 
                      : 'px-3 py-2 text-xs leading-relaxed shadow-2xs break-words'
                  }`}
                  style={
                    isCustomBubbleContainer
                      ? undefined
                      : isUser
                      ? {
                          backgroundColor: userBubbleStyle.bg,
                          color: userBubbleStyle.textColor,
                          borderRadius: `${userBubbleStyle.radius}px`,
                          ...parsedUserCss,
                        }
                      : {
                          backgroundColor: charBubbleStyle.bg,
                          color: charBubbleStyle.textColor,
                          borderRadius: `${charBubbleStyle.radius}px`,
                          ...parsedCharCss,
                        }
                  }
                >
                  {/* 1. 表情包类型 */}
                  {msg.type === 'sticker' || msg.sticker ? (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center p-1">
                      <img 
                        src={msg.sticker} 
                        alt="Sticker" 
                        className="max-w-full max-h-full object-contain drop-shadow-md select-none pointer-events-none" 
                      />
                    </div>
                  ) : msg.type === 'image' || msg.imageUrl ? (
                    /* 2. 图片类型 */
                    <div className="rounded-xl overflow-hidden max-w-[200px] max-h-[240px] shadow-xs">
                      <img 
                        src={msg.imageUrl} 
                        alt="Photo" 
                        className="w-full h-full object-cover rounded-xl" 
                      />
                    </div>
                  ) : msg.type === 'emoji' ? (
                    /* 3. 独立 Emoji 类型 */
                    <div className="text-3xl sm:text-4xl px-1 py-0.5 select-none animate-scale-in">
                      {msg.emoji || msg.text}
                    </div>
                  ) : msg.type === 'voice' ? (
                    /* 4. 字卡语音条类型（语音条 + 文字直接显示，未接入 MiniMax 时用户仍能清晰查看字卡内容） */
                    <div className="space-y-1.5 min-w-[140px] max-w-[280px]">
                      {/* 语音条 */}
                      <div 
                        onClick={() => handlePlayVoiceMessage(msg)}
                        className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 active:bg-black/15 transition-all cursor-pointer select-none group"
                        title={playingVoiceMsgId === msg.id ? "点击暂停" : "点击播放语音"}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                            playingVoiceMsgId === msg.id ? 'bg-pink-500 text-white shadow-2xs' : 'bg-current/10 text-current'
                          }`}>
                            {loadingVoiceMsgId === msg.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : playingVoiceMsgId === msg.id ? (
                              <Pause className="w-3 h-3" />
                            ) : (
                              <Volume2 className="w-3 h-3" />
                            )}
                          </div>
                          {/* 动态音波条 */}
                          <div className="flex items-center gap-0.5 h-3.5">
                            <span className={`w-0.5 bg-current rounded-full transition-all ${playingVoiceMsgId === msg.id ? 'h-3 animate-pulse' : 'h-1.5 opacity-60'}`} />
                            <span className={`w-0.5 bg-current rounded-full transition-all ${playingVoiceMsgId === msg.id ? 'h-3.5 animate-pulse [animation-delay:0.1s]' : 'h-2.5 opacity-80'}`} />
                            <span className={`w-0.5 bg-current rounded-full transition-all ${playingVoiceMsgId === msg.id ? 'h-2 animate-pulse [animation-delay:0.2s]' : 'h-1.5 opacity-60'}`} />
                            <span className={`w-0.5 bg-current rounded-full transition-all ${playingVoiceMsgId === msg.id ? 'h-3 animate-pulse [animation-delay:0.3s]' : 'h-2 opacity-70'}`} />
                          </div>
                        </div>
                        <span className="font-mono text-[11px] opacity-80 shrink-0">{msg.voiceDuration || 2}"</span>
                      </div>

                      {/* 字卡文字直接显示，保证未接入 MiniMax 时用户依然能完整看到角色说了什么字卡 */}
                      <div className="text-xs leading-relaxed break-words px-0.5 select-text font-normal">
                        {msg.text}
                      </div>
                    </div>
                  ) : msg.type === 'poll' && msg.pollData ? (
                    /* 5. 问卷互动卡片类型 */
                    <div className="w-56 sm:w-64 bg-white/95 backdrop-blur-md rounded-2xl border border-neutral-200/90 shadow-xs p-3 space-y-2.5 text-neutral-800 text-xs select-none">
                      <div className="flex items-center justify-between pb-1.5 border-b border-neutral-100">
                        <div className="flex items-center gap-1.5">
                          <ListChecks className="w-3.5 h-3.5 text-pink-500" />
                          <span className="font-bold text-[11px] text-neutral-700">
                            问卷 · {msg.pollData.type === 'boolean' ? '是否问卷' : msg.pollData.isMultiple ? '多选问卷' : '单选问卷'}
                          </span>
                        </div>
                        <span className={`text-[9.5px] px-1.5 py-0.5 rounded-full font-medium ${
                          msg.pollData.completed ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600 animate-pulse'
                        }`}>
                          {msg.pollData.completed ? '已完成选择' : '思考中...'}
                        </span>
                      </div>

                      <div className="font-semibold text-xs leading-snug">
                        {msg.pollData.question}
                      </div>

                      {msg.pollData.imageUrl && (
                        <div className="rounded-xl overflow-hidden max-h-32 border border-neutral-100">
                          <img src={msg.pollData.imageUrl} alt="Poll Illustration" className="w-full h-full object-cover" />
                        </div>
                      )}

                      <div className="space-y-1.5 pt-0.5">
                        {msg.pollData.options.map((opt: string, optIdx: number) => {
                          const isChosen = msg.pollData?.selectedOptions?.includes(opt);
                          return (
                            <div
                              key={optIdx}
                              className={`p-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                                isChosen 
                                  ? 'bg-pink-50 text-pink-700 font-semibold border border-pink-200/90 shadow-2xs' 
                                  : 'bg-neutral-50 text-neutral-700 border border-neutral-100'
                              }`}
                            >
                              <span>{opt}</span>
                              {isChosen && (
                                <span className="text-[10px] bg-pink-100 text-pink-600 px-1.5 py-0.2 rounded-full font-normal flex items-center gap-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>梦角已选</span>
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {!msg.pollData.completed && (
                        <div className="text-[10px] text-neutral-400 text-center animate-pulse pt-1">
                          等待梦角在5秒内完成选择...
                        </div>
                      )}
                    </div>
                  ) : msg.type === 'redpacket' && msg.redPacketData ? (
                    /* 6. 红包卡片类型 (半透明磨砂质感，非传统大红，浅底配深字) */
                    (() => {
                      const rpStyle = getRedPacketStyle(msg.redPacketData.color || settings.customRedPacketColor);
                      return (
                        <div
                          onClick={() => {
                            setSelectedRedPacket(msg.redPacketData!);
                            setShowRedPacketOpenModal(true);
                          }}
                          className="w-52 sm:w-56 p-3 rounded-2xl shadow-sm cursor-pointer select-none transition-transform active:scale-[0.98] border relative overflow-hidden"
                          style={{
                            background: rpStyle.bgGradient,
                            borderColor: rpStyle.border,
                            color: rpStyle.textColor,
                            backdropFilter: 'blur(12px)',
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div 
                              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-2xs"
                              style={{ 
                                backgroundColor: rpStyle.badgeBg,
                                color: rpStyle.textColor 
                              }}
                            >
                              <Gift className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <span className="font-semibold text-xs block truncate" style={{ color: rpStyle.textColor }}>
                                {msg.redPacketData.remark || '心愿红包'}
                              </span>
                              <span className="text-[9.5px] font-medium" style={{ color: rpStyle.subTextColor }}>
                                {msg.redPacketData.isOpened ? '已领取' : '点击拆开'}
                              </span>
                            </div>
                          </div>

                          <div 
                            className="pt-1.5 border-t flex items-center justify-between text-[11px] font-medium"
                            style={{ 
                              borderColor: rpStyle.border,
                              color: rpStyle.textColor 
                            }}
                          >
                            <span style={{ color: rpStyle.subTextColor }}>
                              {msg.redPacketData.sender === 'user' ? '心愿红包' : `${character.nickname || character.name}的红包`}
                            </span>
                            <span className="font-mono font-bold text-xs" style={{ color: rpStyle.textColor }}>
                              {msg.redPacketData.isOpened ? `¥${msg.redPacketData.amount.toFixed(2)}` : '查看详情'}
                            </span>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    /* 7. 常规文本 / 字卡 */
                    <>
                      {!isUser && msg.isProactive && (
                        <span className="inline-block text-[9px] px-1 py-0.2 rounded border border-current/30 opacity-75 mr-1 font-normal select-none">
                          主动消息
                        </span>
                      )}
                      <span>{msg.text}</span>
                    </>
                  )}
                </div>

                {/* 气泡下方的聊天时间 与 我的气泡下方的未读/已读 */}
                <div 
                  className={`flex items-center gap-1.5 mt-0.5 px-0.5 text-[9.5px] select-none ${
                    isUser ? 'justify-end text-neutral-400' : 'justify-start text-neutral-400'
                  }`}
                >
                  <span>{formatMsgTime(msg.timestamp)}</span>
                  {isUser && (
                    <span className={`inline-block w-[24px] text-center shrink-0 transition-colors duration-150 ${msg.read ? 'text-neutral-400 font-normal' : 'text-pink-500 font-normal'}`}>
                      {msg.read ? '已读' : '未读'}
                    </span>
                  )}
                </div>
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-neutral-200 shadow-2xs">
                  <img src={userProfile.avatar} alt="User" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-neutral-200">
              <img src={character.avatar} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div 
              className="px-3 py-2 shadow-2xs flex items-center gap-1 text-[11px]"
              style={{
                backgroundColor: charBubbleStyle.bg,
                color: charBubbleStyle.textColor,
                borderRadius: `${charBubbleStyle.radius}px`,
                ...parsedCharCss,
              }}
            >
              <span className="w-1.5 h-1.5 bg-current opacity-60 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-current opacity-60 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-current opacity-60 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 气泡长按浮层菜单 (复制/引用/删除) - 浮动设置在每个气泡旁边 */}
      {activeMenuMsg && menuPos && (
        <div 
          className="fixed inset-0 z-50 bg-black/15 select-none"
          onClick={() => {
            setActiveMenuMsg(null);
            setMenuPos(null);
          }}
          onTouchStart={() => {
            setActiveMenuMsg(null);
            setMenuPos(null);
          }}
        >
          <div 
            className="fixed z-50 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-neutral-200/90 py-1 px-1.5 flex items-center gap-1 animate-scale-in"
            style={{ 
              top: `${menuPos.top}px`, 
              left: `${menuPos.left}px`,
            }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => handleCopyMsg(activeMenuMsg)}
              className="px-2.5 py-1.5 rounded-xl text-xs text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-neutral-500" />
              <span>复制</span>
            </button>
            <div className="w-px h-3.5 bg-neutral-200 shrink-0" />
            <button
              type="button"
              onClick={() => handleQuoteMsg(activeMenuMsg)}
              className="px-2.5 py-1.5 rounded-xl text-xs text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Quote className="w-3.5 h-3.5 text-neutral-500" />
              <span>引用</span>
            </button>
            <div className="w-px h-3.5 bg-neutral-200 shrink-0" />
            <button
              type="button"
              onClick={() => handleDeleteMsg(activeMenuMsg)}
              className="px-2.5 py-1.5 rounded-xl text-xs text-rose-600 hover:bg-rose-50 active:bg-rose-100 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>删除</span>
            </button>
          </div>
        </div>
      )}

      {/* 表情包与 Emoji 选择面板 */}
      {showStickerPicker && (
        <StickerEmojiPicker
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          onSelectSticker={handleSendSticker}
          onSelectEmoji={handleSendEmoji}
          onClose={() => setShowStickerPicker(false)}
        />
      )}

      {/* Bottom Input Area */}
      <div 
        className="p-2.5 bg-white/95 backdrop-blur-md border-t border-neutral-200/80 shrink-0 space-y-2 z-25 transition-all duration-100"
        style={{ paddingBottom: keyboardOffset > 0 ? `${keyboardOffset + 10}px` : undefined }}
      >
        {/* 引用展示条 */}
        {replyingToMsg && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-pink-50/80 rounded-xl text-xs text-neutral-700 border border-pink-200/80 animate-fade-in shadow-2xs">
            <div className="flex items-center gap-1.5 truncate mr-2">
              <Quote className="w-3.5 h-3.5 text-pink-500 shrink-0" />
              <span className="font-semibold text-neutral-800 shrink-0">
                回复 {replyingToMsg.sender === 'user' ? '我' : (character.nickname || character.name)}:
              </span>
              <span className="truncate text-neutral-500 text-[11px]">{replyingToMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingToMsg(null)}
              className="text-neutral-400 hover:text-neutral-700 p-0.5 cursor-pointer shrink-0"
              title="取消引用"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Toolbar above message bar (即刻传讯功能栏，仅拖拽滑动时显示灰色拉动条，平时不显示) */}
        <div className="relative">
          <div 
            ref={toolbarRef}
            onScroll={handleToolbarScroll}
            onPointerDown={handleToolbarPointerDown}
            onPointerMove={handleToolbarPointerMove}
            onPointerUp={handleToolbarPointerUp}
            onPointerCancel={handleToolbarPointerUp}
            className="flex items-center px-1 overflow-x-auto no-scrollbar py-0.5 gap-1.5 select-none touch-pan-x cursor-grab active:cursor-grabbing"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* 即刻传讯 (原抽卡互动) */}
            <button
              type="button"
              onClick={() => {
                if (hasMovedToolbarRef.current) return;
                handleDrawCard();
              }}
              disabled={isTyping}
              className="flex items-center gap-1 px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-full text-[11px] font-medium transition-colors cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-pink-500" />
              <span>即刻传讯</span>
            </button>

            {/* 拍一拍 */}
            <button
              type="button"
              onClick={() => {
                if (hasMovedToolbarRef.current) return;
                handlePoke();
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-full text-[11px] font-medium transition-colors cursor-pointer active:scale-95 shrink-0"
              title="拍一拍"
            >
              <HandMetal className="w-3.5 h-3.5 text-pink-500" />
              <span>拍一拍</span>
            </button>

            {/* ① 通讯 */}
            <button
              type="button"
              onClick={() => {
                if (hasMovedToolbarRef.current) return;
                handleStartCall();
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-full text-[11px] font-medium transition-colors cursor-pointer active:scale-95 shrink-0"
              title="立刻给角色打电话"
            >
              <PhoneCall className="w-3.5 h-3.5 text-emerald-500" />
              <span>通讯</span>
            </button>

            {/* ② 问卷 */}
            <button
              type="button"
              onClick={() => {
                if (hasMovedToolbarRef.current) return;
                setShowPollModal(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full text-[11px] font-medium transition-colors cursor-pointer active:scale-95 shrink-0"
              title="发起问卷互动"
            >
              <ListChecks className="w-3.5 h-3.5 text-indigo-500" />
              <span>问卷</span>
            </button>

            {/* ④ 发红包 */}
            <button
              type="button"
              onClick={() => {
                if (hasMovedToolbarRef.current) return;
                setShowRedPacketModal(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-full text-[11px] font-medium transition-colors cursor-pointer active:scale-95 shrink-0"
              title="发红包互动"
            >
              <Gift className="w-3.5 h-3.5 text-rose-500" />
              <span>发红包</span>
            </button>
          </div>

          {/* 灰色拉动条：只有拖动/滑动时显示，否则不要显示 */}
          <div 
            className={`flex justify-center items-center w-full py-0.5 transition-opacity duration-300 pointer-events-none ${
              isToolbarInteracting ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden="true"
          >
            <div className="w-12 h-1 bg-neutral-200/90 rounded-full overflow-hidden relative">
              <div 
                className="h-full w-4 bg-neutral-400 rounded-full transition-transform duration-75"
                style={{
                  transform: `translateX(${toolbarScrollRatio * (48 - 16)}px)`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Input box row (常驻纯粹文本输入) */}
        <div className="flex items-center gap-1.5">
          {/* 标识 1: 表情包按钮 */}
          <button
            type="button"
            onClick={() => setShowStickerPicker(!showStickerPicker)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              showStickerPicker 
                ? 'bg-pink-100 text-pink-600 ring-2 ring-pink-300' 
                : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'
            }`}
            title="表情包与 Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* 标识 2: 图片按钮 */}
          <button
            type="button"
            onClick={() => chatImageInputRef.current?.click()}
            disabled={isSendingImage}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 active:scale-95 transition-all cursor-pointer shrink-0"
            title="发送图片"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <input
            type="file"
            ref={chatImageInputRef}
            accept="image/*"
            onChange={handleSendLocalImage}
            className="hidden"
          />

          {/* 文本输入框 */}
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            onFocus={() => {
              setTimeout(() => scrollToBottom('smooth'), 120);
            }}
            placeholder={isSleepLocked ? "梦角监督中，早点睡哦..." : "发送消息..."}
            className="flex-1 bg-neutral-100/90 text-neutral-800 text-xs px-3.5 py-2.5 rounded-2xl border border-transparent focus:border-neutral-300 focus:bg-white focus:outline-none transition-colors"
          />

          {/* 发送按钮 */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="w-9 h-9 bg-neutral-900 text-white rounded-full flex items-center justify-center disabled:opacity-40 hover:bg-neutral-800 active:scale-90 transition-all cursor-pointer shadow-xs shrink-0"
            title="发送"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ③ 问卷模块弹窗 */}
      <PollModal
        isOpen={showPollModal}
        onClose={() => setShowPollModal(false)}
        onSendPoll={handleSendPoll}
      />

      {/* ④ 发红包模块弹窗 */}
      <RedPacketModal
        isOpen={showRedPacketModal}
        character={character}
        settings={settings}
        onUpdateSettings={onUpdateSettings || (() => {})}
        onClose={() => setShowRedPacketModal(false)}
        onSendUserRedPacket={handleSendUserRedPacket}
        onSendCharacterRedPacket={handleSendCharacterRedPacket}
      />

      {/* 拆红包与详情弹窗 */}
      {selectedRedPacket && (
        <RedPacketOpenModal
          packet={selectedRedPacket}
          character={character}
          userProfile={userProfile}
          isOpen={showRedPacketOpenModal}
          onClose={() => {
            setShowRedPacketOpenModal(false);
            setSelectedRedPacket(null);
          }}
          onOpen={handleOpenRedPacket}
        />
      )}
    </div>
  );
};
