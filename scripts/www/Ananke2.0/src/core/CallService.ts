/**
 * CallService: 语音通话核心生命周期管理
 * 独立于 ChatPage 页面生命周期，退出聊天界面再返回时依然保持通话状态，
 * 支持前台大弹窗与全局极简可拖拽悬浮窗。
 */

export interface ActiveCallSession {
  id: string;
  characterId: string;
  callType: 'outgoing' | 'incoming';
  status: 'ringing' | 'connected' | 'ended';
  startedAt: number;
  duration: number; // 通话持续秒数
  isMinimized: boolean;
  minimizedPos: { x: number; y: number } | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  endReason: string;
}

export type CallRecordCallback = (record: {
  characterId: string;
  initiator: 'user' | 'character';
  status: 'connected' | 'missed' | 'rejected' | 'character_hungup' | 'user_cancelled';
  durationSeconds: number;
}) => void;

export type CallListener = (session: ActiveCallSession | null) => void;

import { StorageService } from '../services/StorageService';

export class CallService {
  private currentSession: ActiveCallSession | null = null;
  private listeners: CallListener[] = [];
  private recordCallbacks: CallRecordCallback[] = [];
  private ringTimer: number | null = null;
  private connectedTimer: number | null = null;
  private audioCtx: AudioContext | null = null;
  private ringOscInterval: number | null = null;

  constructor() {
    this.restoreActiveSession();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.restoreActiveSession();
        }
      });
    }
  }

  private restoreActiveSession(): void {
    try {
      const saved = StorageService.getActiveCall();
      if (saved && saved.id && saved.status !== 'ended') {
        if (saved.status === 'connected' && saved.startedAt > 0) {
          // 若保存的通话在 12 小时内，恢复并继续累加计时
          const elapsed = Math.floor((Date.now() - saved.startedAt) / 1000);
          if (elapsed < 43200 && elapsed >= 0) {
            this.currentSession = {
              ...saved,
              duration: elapsed,
            };
            this.startConnectedTimer();
            this.notify();
          } else {
            StorageService.saveActiveCall(null);
          }
        } else if (saved.status === 'ringing') {
          const elapsed = Date.now() - (saved.startedAt || Date.now());
          if (saved.callType === 'outgoing' && elapsed > 3200) {
            this.markConnected();
          } else if (saved.callType === 'incoming' && elapsed > 20000) {
            this.endCall('未接听来电', 'missed');
          } else {
            this.currentSession = saved;
            this.notify();
          }
        }
      }
    } catch {
      // ignore
    }
  }

  public getSession(): ActiveCallSession | null {
    return this.currentSession;
  }

  public subscribe(listener: CallListener): () => void {
    this.listeners.push(listener);
    listener(this.currentSession);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public onRecord(callback: CallRecordCallback): () => void {
    this.recordCallbacks.push(callback);
    return () => {
      this.recordCallbacks = this.recordCallbacks.filter(c => c !== callback);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentSession ? { ...this.currentSession } : null);
    }
  }

  // 播放温和的嘟嘟声 / 振铃音（免外部音频依赖）
  private startRingingSound(): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioCtx = new AudioCtx();

      const playBeep = () => {
        if (!this.audioCtx || this.audioCtx.state === 'closed') return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 1.2);
      };

      playBeep();
      this.ringOscInterval = window.setInterval(playBeep, 2800);
    } catch {
      // Ignore autoplay restrictions
    }
  }

  private stopRingingSound(): void {
    if (this.ringOscInterval) {
      clearInterval(this.ringOscInterval);
      this.ringOscInterval = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch {
        // Ignore
      }
      this.audioCtx = null;
    }
  }

  /**
   * 发起通话或触发角色来电
   */
  public startCall(characterId: string, callType: 'outgoing' | 'incoming'): void {
    // 若已有通话，直接展开并返回
    if (this.currentSession && this.currentSession.status !== 'ended') {
      this.currentSession.isMinimized = false;
      this.notify();
      return;
    }

    this.clearAllTimers();
    this.stopRingingSound();

    this.currentSession = {
      id: 'call_' + Date.now(),
      characterId,
      callType,
      status: 'ringing',
      startedAt: Date.now(),
      duration: 0,
      isMinimized: false,
      minimizedPos: this.currentSession?.minimizedPos || null,
      isMuted: false,
      isSpeakerOn: true,
      endReason: '',
    };
    StorageService.saveActiveCall(this.currentSession);
    this.notify();

    this.startRingingSound();

    if (callType === 'outgoing') {
      // 用户主动打过去：3.2秒后决定接通还是挂断（25%概率被挂断，75%接通）
      this.ringTimer = window.setTimeout(() => {
        this.stopRingingSound();
        const isHungUp = Math.random() < 0.25;

        if (isHungUp) {
          this.endCall('对方已挂断', 'character_hungup');
        } else {
          this.markConnected();
        }
      }, 3200);
    } else {
      // 角色主动来电：20秒未接听则超时未接
      this.ringTimer = window.setTimeout(() => {
        this.stopRingingSound();
        this.endCall('未接听来电', 'missed');
      }, 20000);
    }
  }

  /**
   * 用户接听来电
   */
  public answerCall(): void {
    if (!this.currentSession || this.currentSession.status !== 'ringing') return;
    this.stopRingingSound();
    if (this.ringTimer) {
      clearTimeout(this.ringTimer);
      this.ringTimer = null;
    }
    this.markConnected();
  }

  private markConnected(): void {
    if (!this.currentSession) return;
    this.currentSession.status = 'connected';
    this.currentSession.startedAt = Date.now();
    this.currentSession.duration = 0;
    StorageService.saveActiveCall(this.currentSession);
    this.notify();

    this.startConnectedTimer();
  }

  private startConnectedTimer(): void {
    if (this.connectedTimer) {
      clearInterval(this.connectedTimer);
      this.connectedTimer = null;
    }

    this.connectedTimer = window.setInterval(() => {
      if (!this.currentSession || this.currentSession.status !== 'connected') {
        if (this.connectedTimer) clearInterval(this.connectedTimer);
        this.connectedTimer = null;
        return;
      }

      // 基于真实时间戳计算持续秒数，切后台或休眠唤醒后依然精确无损
      if (this.currentSession.startedAt > 0) {
        this.currentSession.duration = Math.max(
          0,
          Math.floor((Date.now() - this.currentSession.startedAt) / 1000)
        );
      } else {
        this.currentSession.duration += 1;
      }

      StorageService.saveActiveCall(this.currentSession);
      this.notify();
    }, 1000);
  }

  /**
   * 挂断通话（用户或系统挂断）
   */
  public endCall(
    reason: string = '通话已结束',
    recordStatus?: 'connected' | 'missed' | 'rejected' | 'character_hungup' | 'user_cancelled'
  ): void {
    if (!this.currentSession) return;
    this.stopRingingSound();
    this.clearAllTimers();

    const session = this.currentSession;
    const prevStatus = session.status;
    const finalDuration = session.startedAt > 0 
      ? Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000))
      : session.duration;

    session.duration = finalDuration;
    session.status = 'ended';
    session.endReason = reason;
    StorageService.saveActiveCall(null);
    this.notify();

    let computedStatus: 'connected' | 'missed' | 'rejected' | 'character_hungup' | 'user_cancelled';
    if (recordStatus) {
      computedStatus = recordStatus;
    } else if (prevStatus === 'ringing') {
      computedStatus = session.callType === 'incoming' ? 'rejected' : 'user_cancelled';
    } else {
      computedStatus = 'connected';
    }

    const initiator = session.callType === 'outgoing' ? 'user' : 'character';
    for (const cb of this.recordCallbacks) {
      cb({
        characterId: session.characterId,
        initiator,
        status: computedStatus,
        durationSeconds: finalDuration,
      });
    }

    // 若在最小化状态下挂断：直接挂断并立即清理，绝不弹回原窗口
    if (session.isMinimized) {
      this.currentSession = null;
      this.notify();
      return;
    }

    // 大弹窗模式下延迟 1.5 秒后清除会话以显示提示
    window.setTimeout(() => {
      if (this.currentSession && this.currentSession.status === 'ended') {
        this.currentSession = null;
        this.notify();
      }
    }, 1500);
  }

  public setMinimized(minimized: boolean): void {
    if (!this.currentSession) return;
    this.currentSession.isMinimized = minimized;
    this.notify();
  }

  public setMinimizedPos(pos: { x: number; y: number }): void {
    if (!this.currentSession) return;
    this.currentSession.minimizedPos = pos;
    this.notify();
  }

  public toggleMute(): void {
    if (!this.currentSession) return;
    this.currentSession.isMuted = !this.currentSession.isMuted;
    this.notify();
  }

  public toggleSpeaker(): void {
    if (!this.currentSession) return;
    this.currentSession.isSpeakerOn = !this.currentSession.isSpeakerOn;
    this.notify();
  }

  private clearAllTimers(): void {
    if (this.ringTimer) {
      clearTimeout(this.ringTimer);
      this.ringTimer = null;
    }
    if (this.connectedTimer) {
      clearInterval(this.connectedTimer);
      this.connectedTimer = null;
    }
  }
}

export const callService = new CallService();
