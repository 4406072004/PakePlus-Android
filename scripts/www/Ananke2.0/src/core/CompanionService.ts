/**
 * CompanionService: 陪伴模式核心生命周期管理
 * 独立于具体页面，陪伴开启后在整个应用中持续运行，支持跨模块悬浮头像
 * 预留未来 Android Native Bridge 接口
 */

import { CompanionSession, CompanionActivity } from '../types';
import { ProbabilityEngine } from './ProbabilityEngine';
import { StorageService } from '../services/StorageService';

export type CompanionListener = (session: CompanionSession | null) => void;

export class CompanionService {
  private currentSession: CompanionSession | null = null;
  private listeners: CompanionListener[] = [];
  private inviteTimer: number | null = null;

  public static DEFAULT_ACTIVITIES: CompanionActivity[] = [
    { id: 'study', name: '专注学习', iconName: 'BookOpen' },
    { id: 'gaming', name: '打游戏', iconName: 'Gamepad2' },
    { id: 'music', name: '听音乐', iconName: 'Headphones' },
    { id: 'workout', name: '锻炼身体', iconName: 'Flame' },
    { id: 'reading', name: '安静阅读', iconName: 'Glasses' },
    { id: 'drama', name: '吃饭', iconName: 'Tv' },
  ];

  constructor(initialSession: CompanionSession | null = null) {
    if (initialSession) {
      this.currentSession = initialSession;
    } else {
      this.restoreSession();
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkResumePendingInvite();
        }
      });
    }
  }

  private checkResumePendingInvite(): void {
    if (this.currentSession && this.currentSession.status === 'pending') {
      const elapsed = (Date.now() - this.currentSession.startTime) / 1000;
      if (elapsed > 12) {
        if (this.inviteTimer !== null) {
          clearTimeout(this.inviteTimer);
          this.inviteTimer = null;
        }
        const accepted = ProbabilityEngine.checkCompanionAccept();
        if (accepted) {
          this.currentSession = {
            ...this.currentSession,
            status: 'active',
            startTime: Date.now(),
          };
          StorageService.saveCompanionSession(this.currentSession);
          this.notify();
        } else {
          this.currentSession = {
            ...this.currentSession,
            status: 'rejected',
            endTime: Date.now(),
          };
          StorageService.saveCompanionSession(null);
          this.notify();
        }
      }
    }
  }

  private restoreSession(): void {
    try {
      const saved = StorageService.getCompanionSession();
      if (saved && saved.id && (saved.status === 'active' || saved.status === 'pending') && saved.startTime > 0) {
        // 24小时内未超时的活跃/等待陪伴保持运行
        const elapsed = Date.now() - saved.startTime;
        if (elapsed < 86400000 && elapsed >= 0) {
          this.currentSession = saved;
          if (saved.status === 'pending') {
            this.checkResumePendingInvite();
          }
        } else {
          StorageService.saveCompanionSession(null);
        }
      }
    } catch {
      // ignore
    }
  }

  public getSession(): CompanionSession | null {
    return this.currentSession;
  }

  public subscribe(listener: CompanionListener): () => void {
    this.listeners.push(listener);
    listener(this.currentSession);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentSession);
    }
  }

  /**
   * 发起陪伴邀请：
   * 5～15 秒随机时间后决定是否接受（65%接受，35%拒绝）
   */
  public invite(
    characterId: string,
    activity: string,
    onResult?: (accepted: boolean, message: string) => void
  ): CompanionSession {
    if (this.inviteTimer !== null) {
      clearTimeout(this.inviteTimer);
      this.inviteTimer = null;
    }

    const session: CompanionSession = {
      id: 'session_' + Date.now(),
      characterId,
      activity,
      startTime: Date.now(),
      status: 'pending',
    };

    this.currentSession = session;
    this.notify();

    // 5 ~ 15 秒后回复
    const delaySeconds = ProbabilityEngine.randomInt(5, 15);
    this.inviteTimer = window.setTimeout(() => {
      const accepted = ProbabilityEngine.checkCompanionAccept();
      if (accepted) {
        if (this.currentSession && this.currentSession.id === session.id) {
          this.currentSession = {
            ...this.currentSession,
            status: 'active',
            startTime: Date.now(),
          };
          StorageService.saveCompanionSession(this.currentSession);
          this.notify();
        }
        if (onResult) onResult(true, '好的，我们一起！');
      } else {
        if (this.currentSession && this.currentSession.id === session.id) {
          this.currentSession = {
            ...this.currentSession,
            status: 'rejected',
            endTime: Date.now(),
          };
          StorageService.saveCompanionSession(null);
          this.notify();
        }
        if (onResult) onResult(false, '抱歉，现在不方便');
      }
      this.inviteTimer = null;
    }, delaySeconds * 1000);

    return session;
  }

  /**
   * 立即结束陪伴
   */
  public endCompanion(): void {
    if (this.inviteTimer !== null) {
      clearTimeout(this.inviteTimer);
      this.inviteTimer = null;
    }

    if (this.currentSession) {
      this.currentSession = {
        ...this.currentSession,
        status: 'ended',
        endTime: Date.now(),
      };
      StorageService.saveCompanionSession(null);
      this.notify();
      this.currentSession = null;
      this.notify();
    }
  }

  /**
   * 预留未来 Android Native Bridge 接口
   */
  public syncToNativeBridge(): void {
    if ((window as unknown as { AndroidBridge?: { updateCompanion: (json: string) => void } }).AndroidBridge) {
      (window as unknown as { AndroidBridge: { updateCompanion: (json: string) => void } }).AndroidBridge.updateCompanion(
        JSON.stringify(this.currentSession)
      );
    }
  }
}

export const companionService = new CompanionService();
