/**
 * Web Audio API based sound effects with click/pop prevention envelopes and robust resume handling
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function playMessageSound(soundKey?: string) {
  if (!soundKey || soundKey === 'none') return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        executeTone(ctx, soundKey);
      }).catch(() => {
        executeTone(ctx, soundKey);
      });
    } else {
      executeTone(ctx, soundKey);
    }
  } catch {
    // ignore audio failures
  }
}

function executeTone(ctx: AudioContext, soundKey: string) {
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // 严格设置初始静音起点，彻底杜绝爆裂音与点击杂音
    gain.gain.setValueAtTime(0.0001, now);

    if (soundKey === 'bubble') {
      // 柔和气泡音
      const duration = 0.12;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.setValueAtTime(750, now + 0.05);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.45, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } else if (soundKey === 'beep') {
      // 干净的正弦波短音 1 (清脆单音 - 较大音量)
      const duration = 0.09;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.95, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } else if (soundKey === 'ping') {
      // 干净的正弦波短音 2 (温馨轻音 - 较大音量)
      const duration = 0.14;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, now); // C6

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.95, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    }
  } catch {
    // ignore tone errors
  }
}
