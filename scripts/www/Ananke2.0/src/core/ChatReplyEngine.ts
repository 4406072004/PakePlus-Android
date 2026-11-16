/**
 * ChatReplyEngine: 全局聊天回复与角色主动发消息调度引擎
 * 
 * 核心保证：
 * 1. 聊天模块返回主界面或切换到其他模块时，角色的字卡依然稳定生成并发出（不因组件卸载而中断）。
 * 2. 角色主动发消息（proactiveMessageEnabled）在后台及非聊天页面时持续定时检查并发出。
 * 3. 拍一拍角色后立即触发角色发送消息。
 */

import { Message, Character, PhoneSettings, Card } from '../types';
import { StorageService } from '../services/StorageService';
import { CardEngine } from './CardEngine';
import { ProbabilityEngine } from './ProbabilityEngine';
import { NotificationService } from '../services/NotificationService';
import { playMessageSound } from '../utils/soundEffects';
import { getRedPacketStyle } from '../data/redPacketPresets';

export type SendMessageHandler = (msg: Message) => void;
export type TypingChangeHandler = (isTyping: boolean) => void;

class ChatReplyEngineClass {
  private activeReplyTimers: number[] = [];
  private proactiveIntervalId: number | null = null;
  private lastProactiveSentTime = 0;
  private isTypingState = false;
  private typingListeners = new Set<TypingChangeHandler>();

  /**
   * 注册打字状态变更监听（用于 ChatPage 呈现“对方正在输入...”）
   */
  public onTypingChange(listener: TypingChangeHandler): () => void {
    this.typingListeners.add(listener);
    listener(this.isTypingState);
    return () => {
      this.typingListeners.delete(listener);
    };
  }

  private setTyping(typing: boolean): void {
    this.isTypingState = typing;
    this.typingListeners.forEach(listener => {
      try {
        listener(typing);
      } catch (err) {
        console.warn('Typing listener error:', err);
      }
    });
  }

  public getIsTyping(): boolean {
    return this.isTypingState;
  }

  /**
   * 检查是否处于梦角监督早睡时段 (00:00 ~ 07:00)
   */
  private isForceSleepTime(settings: PhoneSettings): boolean {
    if (!settings.forceSleepMode) return false;
    const hour = new Date().getHours();
    return hour >= 0 && hour < 7;
  }

  /**
   * 触发角色回复（支持即刻或延时，在后台或离开聊天界面后依然正常发出）
   */
  public triggerReply(options: {
    character: Character;
    settings: PhoneSettings;
    cards: Card[];
    onSendMessage: SendMessageHandler;
    instant?: boolean;
    currentPage?: string;
  }): void {
    const { character, settings, cards, onSendMessage, instant = false, currentPage = 'chat' } = options;

    // 1. 监督早睡模式：用户消息不回复
    if (this.isForceSleepTime(settings)) {
      return;
    }

    // 2. 5% 概率已读不回（生活化模拟）
    if (!instant && settings.readWithoutReply && ProbabilityEngine.checkReadWithoutReply()) {
      return;
    }

    // 3. 正在输入状态提示
    this.setTyping(true);

    // 计算回复延迟
    let delayMs = 600;
    if (!instant) {
      const dMin = Math.max(2, Math.min(120, settings.minReplyDelaySeconds || 2));
      const dMax = Math.max(2, Math.min(120, settings.maxReplyDelaySeconds || 6));
      const minSec = Math.min(dMin, dMax);
      const maxSec = Math.max(dMin, dMax);
      delayMs = ProbabilityEngine.randomInt(minSec, maxSec) * 1000;
    }

    const timerId = window.setTimeout(() => {
      // 从活动定时器中移除
      this.activeReplyTimers = this.activeReplyTimers.filter(t => t !== timerId);
      this.setTyping(false);

      try {
        this.markMessagesRead();

        // 抽取字卡
        const currentCards = cards && cards.length > 0 ? cards : StorageService.getCards();
        const cardCount = ProbabilityEngine.getReplyCardCount();
        const drawnCards = CardEngine.drawMultipleCards(currentCards, cardCount);

        if (drawnCards.length === 0) {
          return;
        }

        const currentMessages = StorageService.getMessages();

        // 引用判断 (10% 概率引用最近 5 条用户消息之一)
        let replyToId: string | undefined;
        if (settings.enableQuoteReply !== false && ProbabilityEngine.checkReplyTo()) {
          const recentUserMsgs = currentMessages.filter(m => m.sender === 'user').slice(-5);
          if (recentUserMsgs.length > 0) {
            const target = ProbabilityEngine.pickRandom(recentUserMsgs);
            replyToId = target?.id;
          }
        }

        const stickerPool = StorageService.getCustomStickers();
        const emojiPool = StorageService.getCustomEmojis();

        const isStickersEnabled = settings.stickersEnabled !== false;
        const isEmojisEnabled = settings.emojisEnabled !== false;
        const isMixedMode = settings.emojiMixedMode !== false;

        // 根据 mergeCards 选项决定是单条合并字卡还是多条独立字卡
        const cardItems = (settings.mergeCards !== false)
          ? [{ text: CardEngine.concatenateCards(drawnCards), cards: drawnCards.map(c => c.text) }]
          : drawnCards.map(c => ({ text: c.text, cards: [c.text] }));

        let scheduleOffset = 0;

        cardItems.forEach((item, itemIdx) => {
          let extraEmoji: string | undefined;
          let shouldSendSeparateEmoji = false;
          if (isEmojisEnabled && emojiPool.length > 0 && Math.random() < 0.2) {
            extraEmoji = ProbabilityEngine.pickRandom(emojiPool);
            if (!isMixedMode) {
              shouldSendSeparateEmoji = true;
            }
          }

          let extraSticker: string | undefined;
          if (isStickersEnabled && stickerPool.length > 0 && Math.random() < 0.2) {
            extraSticker = ProbabilityEngine.pickRandom(stickerPool);
          }

          // 10% 概率发语音消息
          const shouldSendVoice = (settings.voiceMessageEnabled !== false) && (Math.random() < 0.1);
          const finalItemText = extraEmoji && isMixedMode ? `${item.text} ${extraEmoji}` : item.text;

          const msgId = 'msg_char_' + Date.now() + '_' + itemIdx + '_' + Math.random().toString(36).substring(2, 6);
          const newMsg: Message = {
            id: msgId,
            characterId: character.id,
            sender: 'character',
            timestamp: Date.now() + scheduleOffset,
            cards: item.cards,
            text: finalItemText,
            replyTo: (itemIdx === 0 ? replyToId : undefined),
            voiceTranscript: finalItemText,
            voiceDuration: Math.max(2, Math.min(25, Math.round(finalItemText.length / 3.5) || 3)),
            type: shouldSendVoice ? 'voice' : 'card',
            read: currentPage === 'chat',
          };

          if (scheduleOffset === 0) {
            onSendMessage(newMsg);
          } else {
            const subTimer = window.setTimeout(() => {
              onSendMessage(newMsg);
            }, scheduleOffset);
            this.activeReplyTimers.push(subTimer);
          }

          // 独立发送 Emoji
          if (shouldSendSeparateEmoji && extraEmoji) {
            const emojiMsg: Message = {
              id: 'msg_char_emoji_' + Date.now() + '_' + itemIdx,
              characterId: character.id,
              sender: 'character',
              timestamp: Date.now() + scheduleOffset + 500,
              cards: [],
              text: extraEmoji,
              type: 'emoji',
              read: currentPage === 'chat',
            };
            const emojiTimer = window.setTimeout(() => {
              onSendMessage(emojiMsg);
            }, scheduleOffset + 500);
            this.activeReplyTimers.push(emojiTimer);
          }

          // 附带表情包图片
          if (extraSticker) {
            const stickerMsg: Message = {
              id: 'msg_char_stk_' + Date.now() + '_' + itemIdx,
              characterId: character.id,
              sender: 'character',
              timestamp: Date.now() + scheduleOffset + 700,
              cards: [],
              text: '[表情包]',
              sticker: extraSticker,
              type: 'sticker',
              read: currentPage === 'chat',
            };
            const stickerTimer = window.setTimeout(() => {
              onSendMessage(stickerMsg);
            }, scheduleOffset + 700);
            this.activeReplyTimers.push(stickerTimer);
          }

          scheduleOffset += 1100;
        });

        // 3% 概率角色主动发心愿红包
        if (settings.characterRedPacketEnabled !== false && Math.random() < 0.03) {
          const redPacketAmounts = [
            13.14, 50, 52.0, 66.6, 88.8, 99.9, 100, 131.4, 200, 500,
            520, 600, 666, 800, 888, 999, 1000, 1314, 2000, 5200, 6666, 8888, 9999
          ];
          const charPacketAmt = redPacketAmounts[Math.floor(Math.random() * redPacketAmounts.length)];
          const charPacketRemarks = [
            '给你的小惊喜，专属宠溺红包~',
            '今天也是最喜欢你的一天',
            '拿去买你最喜欢吃的甜点与奶茶',
            '专属零花钱，不许推辞哦',
          ];
          const charRemark = charPacketRemarks[Math.floor(Math.random() * charPacketRemarks.length)];
          const rpStyle = getRedPacketStyle(settings.customRedPacketColor);

          const packetTimer = window.setTimeout(() => {
            const packetMsg: Message = {
              id: 'msg_char_pkt_' + Date.now(),
              characterId: character.id,
              sender: 'character',
              timestamp: Date.now() + 150,
              cards: [],
              text: '[梦角心愿红包]',
              type: 'redpacket',
              read: currentPage === 'chat',
              redPacketData: {
                id: 'pkt_' + Date.now(),
                sender: 'character',
                amount: charPacketAmt,
                remark: charRemark,
                color: rpStyle.primaryColor,
                isOpened: false,
              },
            };
            onSendMessage(packetMsg);
          }, scheduleOffset + 350);
          this.activeReplyTimers.push(packetTimer);
        }
      } catch (err) {
        console.warn('Execute character reply error:', err);
      }
    }, delayMs);

    this.activeReplyTimers.push(timerId);
  }

  /**
   * 标记所有用户未读消息为已读
   */
  private markMessagesRead(): void {
    try {
      const msgs = StorageService.getMessages();
      let changed = false;
      const updated = msgs.map(m => {
        if (m.sender === 'user' && !m.read) {
          changed = true;
          return { ...m, read: true };
        }
        return m;
      });
      if (changed) {
        StorageService.saveMessages(updated);
      }
    } catch {
      // ignore
    }
  }

  /**
   * 启动全局角色主动发消息定时检查（在后台或非聊天页面持续生效）
   */
  public startProactiveLoop(
    getAppState: () => {
      settings: PhoneSettings;
      character: Character;
      cards: Card[];
      currentPage: string;
      onSendMessage: SendMessageHandler;
    }
  ): void {
    if (this.proactiveIntervalId !== null) return;

    const checkProactive = () => {
      try {
        const { settings, character, cards, currentPage, onSendMessage } = getAppState();
        if (!settings.proactiveMessageEnabled) return;
        if (this.isForceSleepTime(settings)) return;

        const intervalMin = Math.max(3, Math.min(180, settings.proactiveMessageIntervalMinutes || 15));
        const intervalMs = intervalMin * 60 * 1000;
        const now = Date.now();

        const messages = StorageService.getMessages();
        const lastMsgTime = messages.length > 0 ? messages[messages.length - 1].timestamp : 0;

        if (
          lastMsgTime > 0 &&
          now - lastMsgTime >= intervalMs &&
          now - this.lastProactiveSentTime >= intervalMs
        ) {
          this.lastProactiveSentTime = now;

          const currentCards = cards && cards.length > 0 ? cards : StorageService.getCards();
          const cardCount = ProbabilityEngine.getReplyCardCount();
          const drawnCards = CardEngine.drawMultipleCards(currentCards, cardCount);
          if (drawnCards.length === 0) return;

          const replyText = settings.mergeCards !== false
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
            read: currentPage === 'chat',
            isProactive: true,
          };

          onSendMessage(proactiveMsg);
        }
      } catch (err) {
        console.warn('Proactive message check error:', err);
      }
    };

    // 每 20 秒进行一次全局心跳检查
    this.proactiveIntervalId = window.setInterval(checkProactive, 20000);
  }

  public stopProactiveLoop(): void {
    if (this.proactiveIntervalId !== null) {
      clearInterval(this.proactiveIntervalId);
      this.proactiveIntervalId = null;
    }
  }
}

export const globalChatReplyEngine = new ChatReplyEngineClass();
