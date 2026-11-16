/**
 * NotificationService: 网页端与系统桌面后台通知服务
 * 支持消息摘要解析、去重防扰、前后台感知、权限申请与点击直接唤醒对应角色聊天页面
 */

import { Character, Message } from '../types';

export class NotificationService {
  // 记录最近已通知的消息 ID，杜绝重复发送相同通知
  private static notifiedMessageIds = new Set<string>();
  // 记录最近通知时间戳（用于频率限制防抖）
  private static lastNotificationTime = 0;

  /**
   * 检查当前浏览器或运行环境是否支持 Notification API
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * 获取当前通知权限状态
   */
  static getPermission(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  /**
   * 请求系统/浏览器通知权限
   */
  static async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!this.isSupported()) {
      return 'unsupported';
    }
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      console.warn('Notification permission request failed or was dismissed:', e);
      return Notification.permission || 'denied';
    }
  }

  /**
   * 解析消息摘要文本
   */
  static getMessageSummary(msg: Message): string {
    if (!msg) return '发来了一条新消息';

    switch (msg.type) {
      case 'image':
        return '[图片]';
      case 'sticker':
        return '[表情包]';
      case 'emoji':
        return msg.emoji ? `[表情] ${msg.emoji}` : '[表情]';
      case 'voice':
        return msg.voiceTranscript ? `[语音] ${msg.voiceTranscript}` : `[语音条] ${msg.voiceDuration || ''}″`;
      case 'call':
        return msg.text ? `[通话] ${msg.text}` : '[语音通话]';
      case 'poll':
        return msg.pollData?.question ? `[问卷] ${msg.pollData.question}` : '[问卷调研]';
      case 'redpacket':
        return msg.redPacketData ? `[心愿红包] ¥${msg.redPacketData.amount.toFixed(2)}` : '[心愿红包]';
      case 'poke':
        return msg.text || '拍了拍你';
      case 'card':
      case 'text':
      default:
        if (msg.text && msg.text.trim()) {
          // 截取前 60 个字符防止通知内容过长
          const cleanText = msg.text.replace(/[\r\n]+/g, ' ').trim();
          return cleanText.length > 60 ? `${cleanText.slice(0, 60)}...` : cleanText;
        }
        return '发来了一条新消息';
    }
  }

  /**
   * 当角色产生新消息时，根据前后台状态与用户所在页面智能发送后台通知
   * @param msg 产生的消息对象
   * @param character 对应角色
   * @param currentPage 当前应用所在页面 ('chat' | 'home' | 'moments' | etc.)
   * @param onOpenChat 点击通知后唤醒并跳转至聊天页面的回调
   */
  /**
   * 初始化并注册 Service Worker 以支持移动端及更广泛的系统通知
   */
  static async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      return reg;
    } catch (err) {
      console.warn('[NotificationService] ServiceWorker register failed:', err);
      return null;
    }
  }

  /**
   * 发送系统通知（优先通过 Service Worker，备选标准 Notification）
   */
  private static async dispatchNotification(
    title: string,
    options: NotificationOptions,
    onClick?: () => void
  ): Promise<boolean> {
    // 1. 优先尝试 Service Worker registration.showNotification
    if ('serviceWorker' in navigator) {
      try {
        const reg = (await navigator.serviceWorker.getRegistration()) || (await this.registerServiceWorker());
        if (reg && 'showNotification' in reg) {
          await reg.showNotification(title, options);
          return true;
        }
      } catch (swErr) {
        console.warn('[NotificationService] SW showNotification failed, trying fallback:', swErr);
      }
    }

    // 2. 备选标准 Notification 构造器
    try {
      const notification = new Notification(title, options);
      if (onClick) {
        notification.onclick = () => {
          try {
            if (typeof window !== 'undefined') {
              window.focus?.();
            }
          } catch {
            // ignore
          }
          notification.close();
          onClick();
        };
      }

      setTimeout(() => {
        try {
          notification.close();
        } catch {
          // ignore
        }
      }, 8000);

      return true;
    } catch (ctorErr) {
      console.warn('[NotificationService] Fallback new Notification failed:', ctorErr);
      return false;
    }
  }

  /**
   * 当角色产生新消息时，根据前后台状态与用户所在页面智能发送后台通知
   * @param msg 产生的消息对象
   * @param character 对应角色
   * @param currentPage 当前应用所在页面 ('chat' | 'home' | 'moments' | etc.)
   * @param onOpenChat 点击通知后唤醒并跳转至聊天页面的回调
   */
  static notifyCharacterMessage(
    msg: Message,
    character: Character,
    currentPage: string,
    onOpenChat: () => void
  ): boolean {
    if (!this.isSupported()) return false;
    if (Notification.permission !== 'granted') return false;
    if (!msg || !character) return false;

    // 1. 去重检查：如果该条消息已经通知过，绝不重复发送
    if (this.notifiedMessageIds.has(msg.id)) {
      return false;
    }

    // 2. 前后台与页面判定：
    // 用户正在查看对应角色的聊天页面，且窗口处于聚焦活跃可见状态时，不发送多余通知
    const isPageVisible = typeof document !== 'undefined' && !document.hidden && (document.hasFocus ? document.hasFocus() : true);
    const isCurrentlyInChat = currentPage === 'chat';

    if (isPageVisible && isCurrentlyInChat) {
      // 用户正在看聊天界面，无需系统通知
      return false;
    }

    // 3. 记录通知状态与频率防抖
    const now = Date.now();
    if (now - this.lastNotificationTime < 300) {
      return false;
    }
    this.lastNotificationTime = now;
    this.notifiedMessageIds.add(msg.id);

    // 限制去重集合大小
    if (this.notifiedMessageIds.size > 200) {
      const arr = Array.from(this.notifiedMessageIds);
      this.notifiedMessageIds = new Set(arr.slice(-100));
    }

    const charName = character.nickname || character.name || '梦角';
    const summary = this.getMessageSummary(msg);

    const iconUrl = (character.avatar && !character.avatar.startsWith('data:'))
      ? (character.avatar.startsWith('http') ? character.avatar : (typeof window !== 'undefined' ? window.location.origin : '') + character.avatar)
      : (typeof window !== 'undefined' ? window.location.origin : '') + '/ananke-logo.svg';

    const options: NotificationOptions = {
      body: summary,
      icon: iconUrl,
      tag: `char_msg_${character.id}_${msg.id}`,
      silent: false,
    } as NotificationOptions;

    this.dispatchNotification(charName, options, onOpenChat);
    return true;
  }

  /**
   * 发送测试通知（供用户在设置页点击验证效果）
   */
  static sendTestNotification(character: Character, onOpenChat: () => void): boolean {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return false;
    }

    const charName = character.nickname || character.name || '梦角';
    const options: NotificationOptions = {
      body: '后台通知已成功生效！点击此条通知即可直接进入与我的聊天哦 ✨',
      icon: (character.avatar && !character.avatar.startsWith('data:')) ? character.avatar : '/ananke-logo.svg',
      tag: 'test_notification_' + Date.now(),
    } as NotificationOptions;

    this.dispatchNotification(`来自「${charName}」的测试通知`, options, onOpenChat);
    return true;
  }
}
