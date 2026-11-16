/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PhoneFrame } from './components/phone/PhoneFrame';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { HomeScreen } from './pages/HomeScreen';
import { ChatPage } from './pages/ChatPage';
import { MomentsPage } from './pages/MomentsPage';
import { MailboxPage } from './pages/MailboxPage';
import { CompanionPage } from './pages/CompanionPage';
import { SleepPage } from './pages/SleepPage';
import { LedgerPage } from './pages/LedgerPage';
import { SettingsPage } from './pages/SettingsPage';

import { AppPageId } from './components/phone/AppGrid';
import { 
  UserProfile, 
  Character, 
  PhoneSettings, 
  Card, 
  Message, 
  MomentPost, 
  Letter, 
  SleepRecord, 
  PeriodRecord, 
  LedgerEntry, 
  CompanionSession, 
  FullBackupData 
} from './types';
import { DEFAULT_CHARACTER, DEFAULT_USER, DEFAULT_SETTINGS } from './data/defaultPresets';
import { StorageService } from './services/StorageService';
import { companionService } from './core/CompanionService';
import { globalScheduler } from './core/Scheduler';
import { backgroundKeepAlive } from './core/BackgroundKeepAlive';
import { CardEngine } from './core/CardEngine';
import { callService } from './core/CallService';
import { ChatCallModal } from './components/chat/ChatCallModal';
import { NotificationService } from './services/NotificationService';
import { playMessageSound } from './utils/soundEffects';
import { AnankeStartupNoticeModal } from './components/common/AnankeStartupNoticeModal';
import { isFullscreenActive, requestAppFullscreen } from './utils/fullscreen';
import { globalChatReplyEngine } from './core/ChatReplyEngine';
import { ReadingService } from './services/ReadingService';

export default function App() {
  // Navigation State (切后台/退出重进保持当前页面，不刷新/不回退首页)
  const [currentPage, setCurrentPageState] = useState<AppPageId>(() => {
    try {
      const saved = StorageService.getLastActivePage('home') as AppPageId;
      return saved || 'home';
    } catch {
      return 'home';
    }
  });

  const setCurrentPage = useCallback((page: AppPageId) => {
    setCurrentPageState(page);
    try {
      StorageService.saveLastActivePage(page);
    } catch {
      // ignore
    }
  }, []);

  // Core Data States with bulletproof fallbacks
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      return StorageService.getUserProfile();
    } catch {
      return DEFAULT_USER;
    }
  });

  const [character, setCharacter] = useState<Character>(() => {
    try {
      const list = StorageService.getCharacters();
      return list && list.length > 0 ? list[0] : DEFAULT_CHARACTER;
    } catch {
      return DEFAULT_CHARACTER;
    }
  });

  const [settings, setSettings] = useState<PhoneSettings>(() => {
    try {
      return StorageService.getSettings();
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [cards, setCards] = useState<Card[]>(() => {
    try {
      return StorageService.getCards();
    } catch {
      return [];
    }
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      return StorageService.getMessages();
    } catch {
      return [];
    }
  });

  const [moments, setMoments] = useState<MomentPost[]>(() => {
    try {
      return StorageService.getMoments();
    } catch {
      return [];
    }
  });

  const [letters, setLetters] = useState<Letter[]>(() => {
    try {
      return StorageService.getLetters();
    } catch {
      return [];
    }
  });

  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>(() => {
    try {
      return StorageService.getSleepRecords();
    } catch {
      return [];
    }
  });

  const [periodRecords, setPeriodRecords] = useState<PeriodRecord[]>(() => {
    try {
      return StorageService.getPeriodRecords();
    } catch {
      return [];
    }
  });

  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>(() => {
    try {
      return StorageService.getLedgerEntries();
    } catch {
      return [];
    }
  });

  // Companion Session
  const [companionSession, setCompanionSession] = useState<CompanionSession | null>(() => companionService.getSession());

  // 开屏初次使用说明弹窗（勾选跳过后不再弹出）
  const [showStartupNotice, setShowStartupNotice] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ananke_startup_notice_skipped') !== 'true';
    } catch {
      return true;
    }
  });

  const cardsRef = useRef(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const characterRef = useRef(character);
  useEffect(() => {
    characterRef.current = character;
  }, [character]);

  const currentPageRef = useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // 强制全屏：默认开启（用户首次手势、点击或触摸时自动申请全屏以隐藏浏览器地址/导航栏）
  useEffect(() => {
    if (settings.forceFullscreen === false) return;

    const tryFullscreen = () => {
      if (settings.forceFullscreen !== false && !isFullscreenActive()) {
        requestAppFullscreen().catch(() => {});
      }
    };

    // 尝试在就绪时申请
    tryFullscreen();

    // 绑定用户交互手势触发
    window.addEventListener('pointerdown', tryFullscreen, { passive: true });
    window.addEventListener('click', tryFullscreen, { passive: true });
    window.addEventListener('touchstart', tryFullscreen, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', tryFullscreen);
      window.removeEventListener('click', tryFullscreen);
      window.removeEventListener('touchstart', tryFullscreen);
    };
  }, [settings.forceFullscreen]);

  // Subscribe to Companion Service updates
  useEffect(() => {
    const unsub = companionService.subscribe(session => {
      setCompanionSession(session);
    });
    return unsub;
  }, []);

  // 共读时光书架后台自动更新调度：即使离开共读时光模式或处于应用其他页面，也能稳定按设定频率更新
  useEffect(() => {
    const runShelfUpdateCheck = () => {
      try {
        const books = ReadingService.getCurrentShelfBooks();
        // 初始为空白时必须用户手动点击查看书单，不自动无端生成；一旦已有书单，按周期稳定在后台更新
        if (books.length > 0) {
          ReadingService.checkAndUpdateShelf(false).catch(err => {
            console.warn('[ReadingService] Background shelf check failed:', err);
          });
        }
      } catch (e) {
        console.warn('[ReadingService] Background update error:', e);
      }
    };

    runShelfUpdateCheck();
    // 每 5 秒轮询检查一次，确保涵盖最短 10 秒测试周期及常规周期的准时更新
    const timer = setInterval(runShelfUpdateCheck, 5000);
    return () => clearInterval(timer);
  }, []);

  // 订阅 CallService 通话完成记录并保存到聊天消息中
  useEffect(() => {
    const unsub = callService.onRecord((record) => {
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
        id: 'msg_call_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        characterId: record.characterId,
        sender: record.initiator,
        timestamp: Date.now(),
        cards: [],
        text: callText,
        type: 'call',
        callData: {
          id: 'calldata_' + Date.now(),
          initiator: record.initiator,
          status: record.status,
          durationSeconds: record.durationSeconds,
        },
        read: true,
      };

      handleSendMessage(callMsg);
    });

    return unsub;
  }, []);

  // Global Scheduler & Background Keep Alive Lifecycle
  useEffect(() => {
    globalScheduler.start(4000);

    // 注册 Service Worker 支持后台桌面与移动端通知
    NotificationService.registerServiceWorker().catch(() => {});

    // 启动 1 秒循环静音音频保活，稳定防止后台浏览器杀掉页面或刷新
    if (settings.keepAliveAudio !== false) {
      backgroundKeepAlive.start().catch(() => {});
    }

    // 订阅信件调度事件（统一使用系统 Scheduler，确保信件完全使用字卡，去掉固定前后缀）
    const unsubReply = globalScheduler.subscribe('letter_reply', (event) => {
      try {
        const payload = (event.payload || {}) as Record<string, unknown>;
        const minCards = typeof payload.minCards === 'number' ? payload.minCards : 2;
        const maxCards = typeof payload.maxCards === 'number' ? payload.maxCards : 4;
        const actualMin = Math.min(minCards, maxCards);
        const actualMax = Math.max(minCards, maxCards);
        const count = Math.floor(Math.random() * (actualMax - actualMin + 1)) + actualMin;
        const drawnCards = CardEngine.drawMultipleCards(cardsRef.current, count);
        const replyText = CardEngine.concatenateCards(drawnCards);

        // 确保每封信完全用的是自己的字卡，去掉任何预设前缀和后缀
        const replyLetter: Letter = {
          id: 'let_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          sender: 'character',
          title: payload.userTitle ? `回信：${payload.userTitle}` : '展信佳',
          content: replyText || '……',
          timestamp: Date.now(),
          isRead: false,
          replyToLetterId: typeof payload.userLetterId === 'string' ? payload.userLetterId : undefined,
        };

        handleAddLetter(replyLetter);
      } catch (err) {
        console.warn('Letter reply event handling failed:', err);
      }
    });

    const unsubProactive = globalScheduler.subscribe('letter_proactive', (event) => {
      try {
        const payload = (event.payload || {}) as Record<string, unknown>;
        const minCards = typeof payload.minCards === 'number' ? payload.minCards : 2;
        const maxCards = typeof payload.maxCards === 'number' ? payload.maxCards : 4;
        const actualMin = Math.min(minCards, maxCards);
        const actualMax = Math.max(minCards, maxCards);
        const count = Math.floor(Math.random() * (actualMax - actualMin + 1)) + actualMin;
        const drawnCards = CardEngine.drawMultipleCards(cardsRef.current, count);
        const proactiveText = CardEngine.concatenateCards(drawnCards);

        const titles = ['见字如晤', '今日心语', '想对你说的话', '风吹来的思念', '时光寄语'];
        const randomTitle = titles[Math.floor(Math.random() * titles.length)];

        // 确保每封信完全用的是自己的字卡，去掉每封信末尾“愿你今天的一切美好都如约而至”以及开头固定前缀
        const proactiveLetter: Letter = {
          id: 'let_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          sender: 'character',
          title: randomTitle,
          content: proactiveText || '……',
          timestamp: Date.now(),
          isRead: false,
        };

        handleAddLetter(proactiveLetter);
      } catch (err) {
        console.warn('Proactive letter event handling failed:', err);
      }
    });

    // 订阅角色主动发朋友圈事件（统一使用系统 Scheduler）
    const unsubMomentPost = globalScheduler.subscribe('moment_post', (event) => {
      try {
        const payload = (event.payload || {}) as Record<string, unknown>;
        const mSettings = StorageService.getMomentsSettings();
        const minCards = Math.max(1, Math.min(10, mSettings.minCardsPerPost || 1));
        const maxCards = Math.max(minCards, Math.min(10, mSettings.maxCardsPerPost || 3));

        // 1. 可以自主设置，角色每条朋友圈最多使用多少字卡，最少使用多少字卡。（上限10，下限1）。多字卡用逗号拼接。
        const drawnCards = CardEngine.drawCardsByRange(cardsRef.current, minCards, maxCards);
        const cardText = CardEngine.concatenateCards(drawnCards);

        const chosenContent = cardText || '今天的天气格外清澈，适合慢慢散步。';

        // 角色发图片功能：开启后，在角色发朋友圈时有20%的概率从图片库中随机抽取1张图片发圈（只抽一张）
        let postImages: string[] | undefined = undefined;
        if (
          mSettings.enableCharacterImagePost &&
          Array.isArray(mSettings.characterImagePool) &&
          mSettings.characterImagePool.length > 0
        ) {
          const shouldAttachImage = Math.random() < 0.20;
          if (shouldAttachImage) {
            const randomIndex = Math.floor(Math.random() * mSettings.characterImagePool.length);
            const chosenImg = mSettings.characterImagePool[randomIndex];
            if (chosenImg) {
              postImages = [chosenImg];
            }
          }
        }

        const charPost: MomentPost = {
          id: 'post_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          author: 'character',
          authorName: character.nickname || character.name,
          authorAvatar: character.avatar,
          content: chosenContent,
          images: postImages,
          timestamp: Date.now(),
          likes: [],
          comments: [],
        };

        handleAddMoment(charPost);

        // 如果不是手动即时测试，则继续按设定的“最少间隔～最多间隔”调度下一条动态
        if (!payload.isManualTest) {
          const currentPosted = (mSettings.todayPostedCount || 0) + 1;
          mSettings.todayPostedCount = currentPosted;

          if (currentPosted < (mSettings.todayPlannedCount || 0)) {
            // 3. 发帖间隔：最少间隔 ~ 最多间隔 之间随机生成
            const minMs = Math.max(1000, mSettings.minIntervalMinutes * 60 * 1000);
            const maxMs = Math.max(minMs, mSettings.maxIntervalMinutes * 60 * 1000);
            const nextDelayMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

            globalScheduler.schedule('moment_post', nextDelayMs, {
              postIndex: currentPosted + 1,
              totalPlan: mSettings.todayPlannedCount,
            });
          }
          StorageService.saveMomentsSettings(mSettings);
        }
      } catch (err) {
        console.warn('Moment proactive post event handling failed:', err);
      }
    });

    // 订阅角色对朋友圈点赞事件（统一使用系统 Scheduler）
    // 2. 我发朋友圈，对方点赞的概率是百分百，在我发送一分钟后点赞。
    const unsubMomentLike = globalScheduler.subscribe('moment_like', (event) => {
      try {
        const payload = (event.payload || {}) as Record<string, unknown>;
        const postId = payload.postId as string;
        const likerName = (payload.likerName as string) || character.nickname || character.name;
        if (!postId) return;

        setMoments(prev => {
          const list = prev.length > 0 ? prev : StorageService.getMoments();
          const target = list.find(p => p.id === postId);
          if (!target) return prev;
          if (target.likes && target.likes.includes(likerName)) return prev;

          const updated: MomentPost = {
            ...target,
            likes: [...(target.likes || []), likerName],
          };
          const next = list.map(p => (p.id === postId ? updated : p));
          StorageService.saveMoments(next);
          return next;
        });
      } catch (err) {
        console.warn('Moment like event handling failed:', err);
      }
    });

    // 订阅角色对朋友圈评论/回复事件（统一使用系统 Scheduler）
    // 对方主动评论我的朋友圈的概率是80%，在我发送后1～3分钟内评论，评论时随机抽取1-3条字卡，抽取逻辑和聊天一样。字卡与字卡之间的拼接用逗号。
    // 我发表评论，对方回复我评论的概率是80%。机制同上。
    const unsubMomentComment = globalScheduler.subscribe('moment_comment', (event) => {
      try {
        const payload = (event.payload || {}) as Record<string, unknown>;
        const postId = payload.postId as string;
        const authorName = (payload.authorName as string) || character.nickname || character.name;
        const replyTo = payload.replyTo as string | undefined;
        if (!postId) return;

        // 评论时随机抽取 1-3 条字卡，抽取逻辑和聊天一样。字卡与字卡之间的拼接用逗号。
        const drawnCards = CardEngine.drawCardsByRange(cardsRef.current, 1, 3);
        const cardText = CardEngine.concatenateCards(drawnCards);
        const commentText = cardText || '看到你的分享，心情很明朗。';

        const newComment = {
          id: 'comm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          author: authorName,
          text: commentText,
          timestamp: Date.now(),
          replyTo: replyTo || undefined,
        };

        setMoments(prev => {
          const list = prev.length > 0 ? prev : StorageService.getMoments();
          const target = list.find(p => p.id === postId);
          if (!target) return prev;

          const updated: MomentPost = {
            ...target,
            comments: [...(target.comments || []), newComment],
          };
          const next = list.map(p => (p.id === postId ? updated : p));
          StorageService.saveMoments(next);
          return next;
        });
      } catch (err) {
        console.warn('Moment comment event handling failed:', err);
      }
    });

    // 每日主动发朋友圈规划检查
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const mSettings = StorageService.getMomentsSettings();
      if (mSettings.lastPlanDate !== todayStr) {
        mSettings.lastPlanDate = todayStr;
        mSettings.todayPostedCount = 0;

        // 1. 每日主动发帖概率：决定角色当天是否会主动发朋友圈
        const roll = Math.random() * 100;
        const willPostToday = roll < mSettings.dailyProactiveRate;

        if (willPostToday) {
          // 2. 每日发帖频率上限：决定当天最多发几条 (1/3/5条)，实际发帖数量在 1 ~ maxDailyPosts 之间随机抽取
          const maxLimit = mSettings.maxDailyPosts || 3;
          const targetCount = Math.floor(Math.random() * maxLimit) + 1;
          mSettings.todayPlannedCount = targetCount;
          StorageService.saveMomentsSettings(mSettings);

          // 调度当天第 1 条动态（启动 25 秒后通过 scheduler 执行）
          const firstDelayMs = Math.floor(Math.random() * 15000) + 20000;
          globalScheduler.schedule('moment_post', firstDelayMs, {
            postIndex: 1,
            totalPlan: targetCount,
          });
        } else {
          mSettings.todayPlannedCount = 0;
          StorageService.saveMomentsSettings(mSettings);
        }
      }
    } catch (e) {
      console.warn('Daily proactive moments check warning:', e);
    }

    // 每日主动写信概率检查 (100%为每天必写一封信)
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const mailboxSettings = StorageService.getMailboxSettings();
      if (mailboxSettings.lastProactiveDate !== todayStr) {
        mailboxSettings.lastProactiveDate = todayStr;
        StorageService.saveMailboxSettings(mailboxSettings);

        const roll = Math.random() * 100;
        if (roll < mailboxSettings.dailyProactiveRate) {
          // 角色今天主动写信，在启动 15 秒后通过 scheduler 投递
          globalScheduler.schedule('letter_proactive', 15000, {
            isProactive: true,
            minCards: mailboxSettings.minCardCount,
            maxCards: mailboxSettings.maxCardCount,
          });
        }
      }
    } catch (e) {
      console.warn('Daily proactive letter check warning:', e);
    }

    // 启动角色全局主动发消息后台循环检查（即使在桌面或非聊天模块中亦可稳定发消息）
    globalChatReplyEngine.startProactiveLoop(() => ({
      settings: settingsRef.current,
      character: characterRef.current,
      cards: cardsRef.current,
      currentPage: currentPageRef.current,
      onSendMessage: handleSendMessage,
    }));

    return () => {
      globalScheduler.stop();
      backgroundKeepAlive.stop();
      globalChatReplyEngine.stopProactiveLoop();
      unsubReply();
      unsubProactive();
      unsubMomentPost();
      unsubMomentLike();
      unsubMomentComment();
    };
  }, []);

  // --- State Updaters with Auto-Save ---
  const handleUpdateUserProfile = (updates: Partial<UserProfile>) => {
    setUserProfile(prev => {
      const next = { ...prev, ...updates };
      StorageService.saveUserProfile(next);
      return next;
    });
  };

  const handleUpdateCharacter = (updates: Partial<Character>) => {
    setCharacter(prev => {
      const oldName = prev.nickname || prev.name;
      const next = { ...prev, ...updates };
      const newName = next.nickname || next.name;
      const newAvatar = next.avatar;

      StorageService.saveCharacters([next]);

      // 同步更新朋友圈中角色发布的所有动态、头像、昵称、评论及点赞
      setMoments(prevMoments => {
        const updatedMoments = prevMoments.map(post => {
          const isCharAuthor = post.author === 'character' || post.authorName === oldName;
          const authorName = isCharAuthor ? newName : post.authorName;
          const authorAvatar = isCharAuthor ? (newAvatar || post.authorAvatar) : post.authorAvatar;

          const updatedLikes = post.likes.map(name => (name === oldName ? newName : name));
          const updatedComments = post.comments.map(c => {
            const isCharComm = c.author === oldName || (c.author !== 'user' && !post.likes.includes(c.author));
            return {
              ...c,
              author: isCharComm ? newName : c.author,
              replyTo: c.replyTo === oldName ? newName : c.replyTo,
            };
          });

          return {
            ...post,
            authorName,
            authorAvatar,
            likes: updatedLikes,
            comments: updatedComments,
          };
        });

        StorageService.saveMoments(updatedMoments);
        return updatedMoments;
      });

      return next;
    });
  };

  const handleUpdateSettings = (updates: Partial<PhoneSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      StorageService.saveSettings(next);
      return next;
    });
  };

  const handleUpdateCards = (newCards: Card[]) => {
    setCards(newCards);
    StorageService.saveCards(newCards);
  };

  const handleUpdateMessages = (newMessagesOrUpdater: Message[] | ((prev: Message[]) => Message[])) => {
    setMessages(prev => {
      const next = typeof newMessagesOrUpdater === 'function' ? newMessagesOrUpdater(prev) : newMessagesOrUpdater;
      StorageService.saveMessages(next);
      return next;
    });
  };

  const handleMarkUserMessagesRead = () => {
    setMessages(prev => {
      let changed = false;
      const next = prev.map(m => {
        if (m.sender === 'user' && !m.read) {
          changed = true;
          return { ...m, read: true };
        }
        return m;
      });
      if (changed) {
        StorageService.saveMessages(next);
        return next;
      }
      return prev;
    });
  };

  const handleSendMessage = (msg: Message) => {
    if (!msg || !msg.id) return;
    if (msg.sender === 'character') {
      playMessageSound(settings.messageSound);
      // 开启后台通知时，根据前后台状态尽可能发送桌面/系统通知，点击进入聊天页面
      if (settings.backgroundNotifications) {
        NotificationService.notifyCharacterMessage(msg, character, currentPage, () => {
          setCurrentPage('chat');
        });
      }
    }
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === msg.id);
      const next = idx >= 0 ? prev.map(m => (m.id === msg.id ? msg : m)) : [...prev, msg];
      StorageService.saveMessages(next);
      return next;
    });
  };

  const handleTriggerCharacterReply = useCallback((instant: boolean = false) => {
    globalChatReplyEngine.triggerReply({
      character: characterRef.current,
      settings: settingsRef.current,
      cards: cardsRef.current,
      onSendMessage: handleSendMessage,
      instant,
      currentPage: currentPageRef.current,
    });
  }, []);

  const handleAddMoment = (post: MomentPost) => {
    if (!post || !post.id) return;
    setMoments(prev => {
      const idx = prev.findIndex(p => p.id === post.id);
      const next = idx >= 0 ? prev.map(p => (p.id === post.id ? post : p)) : [post, ...prev];
      StorageService.saveMoments(next);
      return next;
    });
  };

  const handleUpdateMoment = (post: MomentPost) => {
    if (!post || !post.id) return;
    setMoments(prev => {
      const idx = prev.findIndex(p => p.id === post.id);
      const next = idx >= 0 ? prev.map(p => (p.id === post.id ? post : p)) : [post, ...prev];
      StorageService.saveMoments(next);
      return next;
    });
  };

  const handleUpdateAllMoments = (newMoments: MomentPost[]) => {
    if (!Array.isArray(newMoments)) return;
    setMoments(newMoments);
    StorageService.saveMoments(newMoments);
  };

  const handleDeleteMoments = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    setMoments(prev => {
      const next = prev.filter(p => !ids.includes(p.id));
      StorageService.saveMoments(next);
      return next;
    });
  };

  const handleAddLetter = (letter: Letter) => {
    if (!letter || !letter.id) return;
    setLetters(prev => {
      const idx = prev.findIndex(l => l.id === letter.id);
      const next = idx >= 0 ? prev.map(l => (l.id === letter.id ? letter : l)) : [letter, ...prev];
      StorageService.saveLetters(next);
      return next;
    });
  };

  const handleDeleteLetters = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    setLetters(prev => {
      const next = prev.filter(l => !ids.includes(l.id));
      StorageService.saveLetters(next);
      return next;
    });
  };

  const handleMarkLetterRead = (id: string) => {
    setLetters(prev => {
      const next = prev.map(l => (l.id === id ? { ...l, isRead: true } : l));
      StorageService.saveLetters(next);
      return next;
    });
  };

  const handleMarkAllLettersRead = () => {
    setLetters(prev => {
      const next = prev.map(l => ({ ...l, isRead: true }));
      StorageService.saveLetters(next);
      return next;
    });
  };

  const handleAddSleepRecord = (record: SleepRecord) => {
    if (!record || !record.id) return;
    setSleepRecords(prev => {
      const idx = prev.findIndex(r => r.id === record.id);
      const next = idx >= 0 ? prev.map(r => (r.id === record.id ? record : r)) : [record, ...prev];
      StorageService.saveSleepRecords(next);
      return next;
    });
  };

  const handleUpdateSleepRecord = (record: SleepRecord) => {
    if (!record || !record.id) return;
    setSleepRecords(prev => {
      const idx = prev.findIndex(r => r.id === record.id);
      const next = idx >= 0 ? prev.map(r => (r.id === record.id ? record : r)) : [record, ...prev];
      StorageService.saveSleepRecords(next);
      return next;
    });
  };

  const handleDeleteSleepRecord = (id: string) => {
    setSleepRecords(prev => {
      const next = prev.filter(r => r.id !== id);
      StorageService.saveSleepRecords(next);
      return next;
    });
  };

  const handleUpdatePeriodRecords = (records: PeriodRecord[]) => {
    setPeriodRecords(records);
    StorageService.savePeriodRecords(records);
  };

  const handleAddLedgerEntry = (entry: LedgerEntry) => {
    if (!entry || !entry.id) return;
    setLedgerEntries(prev => {
      const idx = prev.findIndex(e => e.id === entry.id);
      const next = idx >= 0 ? prev.map(e => (e.id === entry.id ? entry : e)) : [entry, ...prev];
      StorageService.saveLedgerEntries(next);
      return next;
    });
  };

  const handleDeleteLedgerEntries = (ids: string[]) => {
    setLedgerEntries(prev => {
      const next = prev.filter(e => !ids.includes(e.id));
      StorageService.saveLedgerEntries(next);
      return next;
    });
  };

  // Restore from Full Backup
  const handleRestoreBackup = (data: FullBackupData) => {
    try {
      const ok = StorageService.importFullBackup(data);
      if (ok) {
        handleReloadAllData();
      }
    } catch (err) {
      console.error('Restore backup failed:', err);
    }
  };

  // 全量重新同步加载存储中的数据状态
  const handleReloadAllData = () => {
    setUserProfile(StorageService.getUserProfile());
    const chars = StorageService.getCharacters();
    if (chars && chars[0]) setCharacter(chars[0]);
    setSettings(StorageService.getSettings());
    setCards(StorageService.getCards());
    setMessages(StorageService.getMessages());
    setMoments(StorageService.getMoments());
    setLetters(StorageService.getLetters());
    setSleepRecords(StorageService.getSleepRecords());
    setPeriodRecords(StorageService.getPeriodRecords());
    setLedgerEntries(StorageService.getLedgerEntries());
  };

  const unreadLetters = Array.isArray(letters) ? letters.filter(l => !l.isRead).length : 0;

  return (
    <ErrorBoundary fallbackTitle="小手机系统保护" onReset={() => setCurrentPage('home')}>
      <PhoneFrame
        settings={settings}
        character={character}
        activeSession={companionSession}
        onHomeClick={() => setCurrentPage('home')}
        onOpenCompanion={() => setCurrentPage('companion')}
      >
        <ErrorBoundary fallbackTitle="应用页面保护" onReset={() => setCurrentPage('home')}>
          {/* 1. Home Screen */}
          {currentPage === 'home' && (
            <HomeScreen
              userProfile={userProfile}
              character={character}
              settings={settings}
              onUpdateUserProfile={handleUpdateUserProfile}
              onUpdateCharacter={handleUpdateCharacter}
              onUpdateSettings={handleUpdateSettings}
              onOpenApp={(page) => setCurrentPage(page)}
              unreadLettersCount={unreadLetters}
              isCompanionActive={companionSession?.status === 'active'}
            />
          )}

          {/* 2. Chat Page (Entered by clicking the pink line heart on the Top Card!) */}
          {currentPage === 'chat' && (
            <ChatPage
              character={character}
              userProfile={userProfile}
              settings={settings}
              cards={cards}
              messages={messages}
              onSendMessage={handleSendMessage}
              onUpdateCards={handleUpdateCards}
              onUpdateSettings={handleUpdateSettings}
              onUpdateCharacter={handleUpdateCharacter}
              onUpdateMessages={handleUpdateMessages}
              onMarkUserMessagesRead={handleMarkUserMessagesRead}
              onTriggerCharacterReply={handleTriggerCharacterReply}
              onBack={() => setCurrentPage('home')}
            />
          )}

          {/* 3. Moments App (朋友圈) */}
          {currentPage === 'moments' && (
            <MomentsPage
              userProfile={userProfile}
              character={character}
              cards={cards}
              moments={moments}
              onAddMoment={handleAddMoment}
              onUpdateMoment={handleUpdateMoment}
              onUpdateAllMoments={handleUpdateAllMoments}
              onDeleteMoments={handleDeleteMoments}
              onBack={() => setCurrentPage('home')}
            />
          )}

          {/* 4. Mailbox App (信箱) */}
          {currentPage === 'mailbox' && (
            <MailboxPage
              userProfile={userProfile}
              character={character}
              cards={cards}
              letters={letters}
              onAddLetter={handleAddLetter}
              onDeleteLetters={handleDeleteLetters}
              onMarkLetterRead={handleMarkLetterRead}
              onMarkAllLettersRead={handleMarkAllLettersRead}
              onBack={() => setCurrentPage('home')}
            />
          )}

          {/* 5. Companion App (陪伴) */}
          {currentPage === 'companion' && (
            <CompanionPage
              character={character}
              onBack={() => setCurrentPage('home')}
              onSendMessage={handleSendMessage}
              onNavigateToChat={() => setCurrentPage('chat')}
            />
          )}

          {/* 6. Health App (健康: 睡眠监督打卡 & 经期记录) */}
          {currentPage === 'sleep' && (
            <SleepPage
              character={character}
              sleepRecords={sleepRecords}
              onAddSleepRecord={handleAddSleepRecord}
              onUpdateSleepRecord={handleUpdateSleepRecord}
              onDeleteSleepRecord={handleDeleteSleepRecord}
              periodRecords={periodRecords}
              onUpdatePeriodRecords={handleUpdatePeriodRecords}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onSendMessage={handleSendMessage}
              onNavigateToChat={() => setCurrentPage('chat')}
              onBack={() => setCurrentPage('home')}
            />
          )}

          {/* 7. Ledger App (记账) */}
          {currentPage === 'ledger' && (
            <LedgerPage
              ledgerEntries={ledgerEntries}
              onAddLedgerEntry={handleAddLedgerEntry}
              onDeleteLedgerEntries={handleDeleteLedgerEntries}
              onBack={() => setCurrentPage('home')}
            />
          )}

          {/* 8. Settings App (设置) */}
          {currentPage === 'settings' && (
            <SettingsPage
              settings={settings}
              userProfile={userProfile}
              character={character}
              cards={cards}
              onUpdateSettings={handleUpdateSettings}
              onUpdateUserProfile={handleUpdateUserProfile}
              onUpdateCharacter={handleUpdateCharacter}
              onUpdateCards={handleUpdateCards}
              onRestoreBackup={handleRestoreBackup}
              onReloadAllData={handleReloadAllData}
              onNavigateToChat={() => setCurrentPage('chat')}
              onOpenNoticeModal={() => setShowStartupNotice(true)}
              onBack={() => setCurrentPage('home')}
            />
          )}
        </ErrorBoundary>

        {/* 全局语音通话大弹窗与极简可拖拽小悬浮胶囊（退出聊天再返回保持通话） */}
        <ChatCallModal
          character={character}
          onNavigateToChat={() => setCurrentPage('chat')}
        />

        {/* 开屏初次使用说明（必读）弹窗 */}
        <AnankeStartupNoticeModal
          isOpen={showStartupNotice}
          onClose={() => setShowStartupNotice(false)}
        />
      </PhoneFrame>
    </ErrorBoundary>
  );
}
