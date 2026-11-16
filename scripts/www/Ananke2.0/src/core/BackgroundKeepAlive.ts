/**
 * BackgroundKeepAlive: 后台保活模块
 * 采用双重静音保活机制：
 * 1. 底层挂载 1 秒循环静音 HTMLAudioElement (volume=0, loop=true)，借助系统媒体会话机制维持后台进程活跃，避免浏览器激进冻结或刷新。
 * 2. 结合 Web Audio API 静音振荡器，确保前后台 JavaScript 事件循环稳定调度。
 * 3. 严格遵循移动端 Autoplay 策略，在初次手势 (click / touchstart / pointerdown) 时自动补触发 play()，绝不冲突主界面音频播放。
 */

function generateSilentWavBlobUrl(): string {
  try {
    const sampleRate = 8000;
    const numSamples = sampleRate; // 1 秒静音
    const buffer = new Uint8Array(44 + numSamples);
    const view = new DataView(buffer.buffer);

    // "RIFF"
    buffer.set([0x52, 0x49, 0x46, 0x46], 0);
    view.setUint32(4, 36 + numSamples, true);
    // "WAVE"
    buffer.set([0x57, 0x41, 0x56, 0x45], 8);
    // "fmt "
    buffer.set([0x66, 0x6d, 0x74, 0x20], 12);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true); // block align
    view.setUint16(34, 8, true); // 8-bit
    // "data"
    buffer.set([0x64, 0x61, 0x74, 0x61], 36);
    view.setUint32(40, numSamples, true);
    // 8-bit PCM 静音中心值为 128
    buffer.fill(128, 44);

    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  } catch {
    // 极端环境降级为极简 base64 静音 WAV
    return 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
  }
}

class BackgroundKeepAliveService {
  private silentAudio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isRunning: boolean = false;
  private unlockListenerAttached: boolean = false;
  private visibilityListenerAttached: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initSilentAudio();
      this.attachVisibilityHandler();
    }
  }

  /**
   * 初始化 1 秒循环静音音频元素
   */
  private initSilentAudio(): void {
    if (this.silentAudio || typeof window === 'undefined') return;

    try {
      const audioUrl = generateSilentWavBlobUrl();
      const audio = new Audio(audioUrl);
      audio.loop = true;
      audio.volume = 0; // 静音，绝不打扰用户
      audio.muted = false; // 部分浏览器需要 unmuted + volume=0 来开启后台音频通道
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');

      // 防止音频意外中断时停止
      audio.addEventListener('pause', () => {
        if (this.isRunning) {
          audio.play().catch(() => {});
        }
      });
      audio.addEventListener('ended', () => {
        if (this.isRunning) {
          audio.play().catch(() => {});
        }
      });

      this.silentAudio = audio;
    } catch (err) {
      console.warn('[BackgroundKeepAlive] initSilentAudio error:', err);
    }
  }

  private attachVisibilityHandler(): void {
    if (this.visibilityListenerAttached || typeof document === 'undefined') return;
    this.visibilityListenerAttached = true;

    document.addEventListener('visibilitychange', () => {
      if (this.isRunning) {
        // 切后台或从后台返回时，确保静音音频保持持续播放
        this.playSilentAudio().catch(() => {});
        if (this.audioContext && this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(() => {});
        }
      }
    });
  }

  private async playSilentAudio(): Promise<void> {
    if (!this.silentAudio) {
      this.initSilentAudio();
    }
    if (!this.silentAudio) return;

    try {
      await this.silentAudio.play();
    } catch {
      // 捕获自动播放限制，等待用户第一次手势激活
      this.attachUnlockListeners();
    }
  }

  private attachUnlockListeners(): void {
    if (this.unlockListenerAttached || typeof window === 'undefined') return;
    this.unlockListenerAttached = true;

    const unlock = () => {
      if (this.isRunning) {
        if (this.silentAudio && this.silentAudio.paused) {
          this.silentAudio.play().catch(() => {});
        }
        if (this.audioContext && this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(() => {});
        }
      }
    };

    const cleanup = () => {
      unlock();
      window.removeEventListener('click', cleanup);
      window.removeEventListener('touchstart', cleanup);
      window.removeEventListener('pointerdown', cleanup);
      window.removeEventListener('keydown', cleanup);
      this.unlockListenerAttached = false;
    };

    window.addEventListener('click', cleanup, { passive: true });
    window.addEventListener('touchstart', cleanup, { passive: true });
    window.addEventListener('pointerdown', cleanup, { passive: true });
    window.addEventListener('keydown', cleanup, { passive: true });
  }

  public getStatus(): boolean {
    return this.isRunning;
  }

  public async start(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    this.isRunning = true;

    // 1. 尝试播放 1 秒循环静音音频
    await this.playSilentAudio();

    // 2. 结合 Web Audio 振荡器辅助双重保活
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioCtx) {
        if (!this.audioContext || this.audioContext.state === 'closed') {
          this.audioContext = new AudioCtx();
        }

        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(() => {});
          this.attachUnlockListeners();
        }

        if (!this.oscillator && this.audioContext) {
          this.oscillator = this.audioContext.createOscillator();
          this.gainNode = this.audioContext.createGain();

          // 增益接近 0，完全静音
          this.gainNode.gain.setValueAtTime(0.00001, this.audioContext.currentTime);
          this.oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);

          this.oscillator.connect(this.gainNode);
          this.gainNode.connect(this.audioContext.destination);

          this.oscillator.start();
        }
      }
    } catch (err) {
      console.warn('[BackgroundKeepAlive] WebAudio keepalive fallback:', err);
    }

    return true;
  }

  public stop(): void {
    try {
      this.isRunning = false;

      if (this.silentAudio) {
        this.silentAudio.pause();
      }

      if (this.oscillator) {
        try {
          this.oscillator.stop();
          this.oscillator.disconnect();
        } catch {
          // ignore
        }
        this.oscillator = null;
      }

      if (this.gainNode) {
        try {
          this.gainNode.disconnect();
        } catch {
          // ignore
        }
        this.gainNode = null;
      }

      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close().catch(() => {});
        this.audioContext = null;
      }
    } catch (err) {
      console.warn('[BackgroundKeepAlive] Error while stopping:', err);
    }
  }
}

export const backgroundKeepAlive = new BackgroundKeepAliveService();
