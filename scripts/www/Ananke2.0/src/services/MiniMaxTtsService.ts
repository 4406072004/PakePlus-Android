/**
 * MiniMaxTtsService: 负责与 MiniMax 语音合成接口直连通信及音频播放
 * 支持纯前端浏览器直连模式（携带用户自己的 API Key），或通过自定义反向代理调用。
 */

export interface MiniMaxVoicePreset {
  id: string;
  name: string;
  gender: 'male' | 'female';
  description: string;
}

export interface MiniMaxSpeechModel {
  id: string;
  name: string;
  label: string;
  description: string;
}

export const MINIMAX_SPEECH_MODELS: MiniMaxSpeechModel[] = [
  {
    id: 'speech-2.8-turbo',
    name: 'Speech 2.8 Turbo',
    label: 'Speech 2.8 Turbo · 低延迟·强情感（推荐）',
    description: '低延迟·强情感（推荐）',
  },
  {
    id: 'speech-2.8-hd',
    name: 'Speech 2.8 HD',
    label: 'Speech 2.8 HD · 最高音质',
    description: '最高音质',
  },
  {
    id: 'speech-02-turbo',
    name: 'Speech 02 Turbo',
    label: 'Speech 02 Turbo · 快速稳定',
    description: '快速稳定',
  },
  {
    id: 'speech-02-hd',
    name: 'Speech 02 HD',
    label: 'Speech 02 HD · 高质量',
    description: '高质量',
  },
];

export const MINIMAX_VOICE_PRESETS: MiniMaxVoicePreset[] = [];

export interface TtsResponse {
  success: boolean;
  audioUrl?: string;
  duration?: number;
  isFallback?: boolean;
  error?: string;
  message?: string;
}

/**
 * 将 MiniMax 响应中的十六进制音频数据转换为 MP3 Blob
 */
function hexToMp3Blob(hexString: string): Blob | null {
  try {
    const cleanHex = hexString.replace(/\s+/g, '');
    if (cleanHex.length === 0 || cleanHex.length % 2 !== 0) {
      return null;
    }
    const byteLength = cleanHex.length / 2;
    const bytes = new Uint8Array(byteLength);
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    return new Blob([bytes], { type: 'audio/mp3' });
  } catch (err) {
    console.warn('[MiniMax TTS] Hex to Blob error:', err);
    return null;
  }
}

/**
 * 辅助将十六进制音频数据转换为 Base64
 */
function hexToBase64(hexString: string): string {
  try {
    const cleanHex = hexString.replace(/\s+/g, '');
    const bytes = new Uint8Array(Math.floor(cleanHex.length / 2));
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    return window.btoa(binary);
  } catch (err) {
    console.warn('[MiniMax TTS] Hex decode error:', err);
    return '';
  }
}

/**
 * 动态拼接与规范化 MiniMax / 自定义代理 TTS 请求地址
 * 严格使用 /v1/t2a_v2 路径，避免重复拼接
 */
export function resolveTtsEndpoint(baseUrl?: string, customProxyUrl?: string): string {
  // 若用户配置了自定义代理地址且不是已废弃的本地代理
  if (customProxyUrl && customProxyUrl.trim() && customProxyUrl.trim() !== '/api/tts/minimax') {
    return customProxyUrl.trim();
  }

  const rawBase = (baseUrl && baseUrl.trim()) ? baseUrl.trim() : 'https://api.minimaxi.com/v1';
  const clean = rawBase.replace(/\/+$/, '');

  // 若用户填写的已经包含 /t2a_v2 结尾
  if (/\/t2a_v2$/i.test(clean)) {
    return clean;
  }

  // 若以 /v1 结尾
  if (/\/v1$/i.test(clean)) {
    return `${clean}/t2a_v2`;
  }

  try {
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      const urlObj = new URL(clean);
      const pathname = urlObj.pathname.replace(/\/+$/, '');
      if (!pathname || pathname === '') {
        urlObj.pathname = '/v1/t2a_v2';
      } else if (pathname.endsWith('/v1')) {
        urlObj.pathname = `${pathname}/t2a_v2`;
      } else {
        urlObj.pathname = `${pathname}/v1/t2a_v2`;
      }
      return urlObj.toString();
    }
  } catch {
    // 降级兜底
  }

  return `${clean}/v1/t2a_v2`;
}

class MiniMaxTtsServiceImpl {
  private activeAudio: HTMLAudioElement | null = null;
  private currentPlayingId: string | null = null;

  /**
   * 检查 MiniMax API 接入状态
   */
  async checkStatus(customProxyUrl?: string): Promise<{ configured: boolean; message: string }> {
    try {
      const statusUrl = customProxyUrl 
        ? customProxyUrl.replace(/\/minimax\/?$/, '/status')
        : '/api/tts/status';

      const res = await fetch(statusUrl, { method: 'GET' });
      if (!res.ok) {
        return { configured: false, message: `服务响应异常 (${res.status})` };
      }
      const data = await res.json();
      return {
        configured: Boolean(data.configured),
        message: data.configured ? '已连接 MiniMax 服务' : '后端尚未配置 MINIMAX_API_KEY 环境变量',
      };
    } catch {
      return {
        configured: false,
        message: '纯前端直连模式（请在设置中配置个人 API Key）',
      };
    }
  }

  /**
   * 合成语音（浏览器直连 MiniMax /v1/t2a_v2 接口）
   */
  async synthesize(
    text: string, 
    voiceId = '', 
    customProxyUrl?: string,
    model = 'speech-2.8-turbo',
    apiKey?: string,
    baseUrl?: string,
    speed = 1.0,
    vol = 1.0,
    pitch = 0
  ): Promise<TtsResponse> {
    const effectiveApiKey = apiKey && apiKey.trim() ? apiKey.trim() : '';
    if (!effectiveApiKey) {
      return {
        success: false,
        error: 'MINIMAX_API_KEY_NOT_CONFIGURED',
        message: '未配置 MiniMax API Key，请在聊天设置中填写您的 API Key。',
      };
    }

    const effectiveVoiceId = voiceId && voiceId.trim() ? voiceId.trim() : '';
    if (!effectiveVoiceId) {
      return {
        success: false,
        error: 'VOICE_ID_NOT_CONFIGURED',
        message: '未配置音色 ID，请在聊天设置中填写音色 ID（克隆音色或官方音色）。',
      };
    }

    const targetUrl = resolveTtsEndpoint(baseUrl, customProxyUrl);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${effectiveApiKey}`,
    };

    const requestBody = {
      model: model || 'speech-2.8-turbo',
      text: text.slice(0, 1000),
      stream: false,
      voice_setting: {
        voice_id: effectiveVoiceId,
        speed: typeof speed === 'number' && !isNaN(speed) ? speed : 1.0,
        vol: typeof vol === 'number' && !isNaN(vol) ? vol : 1.0,
        pitch: typeof pitch === 'number' && !isNaN(pitch) ? pitch : 0,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      },
    };

    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      // 捕获静态托管环境误请求本地路径导致的 405
      if (res.status === 405) {
        return {
          success: false,
          error: 'STATIC_HOSTING_405',
          message: '请求被静态服务器拒绝 (405)。请检查设置中的 MiniMax API 地址是否正确。',
        };
      }

      // 兼容直接以二进制音频流返回的代理服务 (Content-Type: audio/...)
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('audio/')) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        return {
          success: true,
          audioUrl,
        };
      }

      // 检查 HTTP 状态码
      if (!res.ok) {
        let errMessage = `HTTP ${res.status}`;
        try {
          const errData = await res.json();
          if (errData?.base_resp?.status_msg) {
            errMessage = `${errData.base_resp.status_msg} (代码 ${errData.base_resp.status_code})`;
          } else if (errData?.message || errData?.error) {
            errMessage = errData.message || errData.error;
          }
        } catch {
          // ignore
        }
        return {
          success: false,
          error: `HTTP_${res.status}`,
          message: `MiniMax API 请求失败 (${errMessage})`,
        };
      }

      const data = await res.json().catch(() => null);
      if (!data) {
        return {
          success: false,
          error: 'INVALID_JSON_RESPONSE',
          message: 'MiniMax 接口未返回有效的 JSON 数据。',
        };
      }

      // 检查 MiniMax 业务层报错 base_resp.status_code
      if (data.base_resp && data.base_resp.status_code !== 0) {
        const code = data.base_resp.status_code;
        const msg = data.base_resp.status_msg || '未知错误';
        return {
          success: false,
          error: `MINIMAX_ERROR_${code}`,
          message: `MiniMax 返回错误 [${code}]: ${msg}`,
        };
      }

      // 读取 data.audio 中的十六进制音频数据，转换成 MP3 Blob，生成可播放的音频 URL
      const hexAudio = data?.data?.audio || data?.audio;
      if (hexAudio && typeof hexAudio === 'string') {
        const mp3Blob = hexToMp3Blob(hexAudio);
        if (mp3Blob) {
          const audioUrl = URL.createObjectURL(mp3Blob);
          const duration = data?.extra_info?.audio_length 
            ? Math.round(data.extra_info.audio_length / 1000)
            : (data?.data?.extra_info?.audio_length ? Math.round(data.data.extra_info.audio_length / 1000) : undefined);
          return {
            success: true,
            audioUrl,
            duration,
          };
        }
        // 降级使用 Base64
        const base64Audio = hexToBase64(hexAudio);
        if (base64Audio) {
          return {
            success: true,
            audioUrl: `data:audio/mp3;base64,${base64Audio}`,
          };
        }
      }

      // 兼容返回的 audio_url
      if (data?.data?.audio_url || data?.audio_url || data?.audioUrl) {
        return {
          success: true,
          audioUrl: data?.data?.audio_url || data?.audio_url || data?.audioUrl,
        };
      }

      return {
        success: false,
        error: 'NO_AUDIO_DATA',
        message: 'MiniMax 响应中未包含有效音频数据。',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isCorsOrNetwork = (err instanceof TypeError && (msg.includes('fetch') || msg.includes('NetworkError') || msg.includes('Failed to fetch')));
      return {
        success: false,
        error: isCorsOrNetwork ? 'CORS_OR_NETWORK_ERROR' : 'NETWORK_ERROR',
        message: isCorsOrNetwork
          ? '网络请求失败：可能由于浏览器跨域限制 (CORS) 或网络无法连接。若直连受限，请在设置中配置支持 CORS 的中转代理。'
          : `TTS 请求异常: ${msg}`,
      };
    }
  }

  /**
   * 停止当前所有播放
   */
  stop(): void {
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio = null;
    }
    this.currentPlayingId = null;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * 浏览器本地 Web Speech 降级朗读（未配置 MiniMax 时依然能发出声音）
   */
  speakWithWebSpeech(
    text: string,
    onEnded?: () => void,
    onError?: (err: unknown) => void
  ): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.95;
      utterance.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices();
      const zhVoice = voices.find(v => v.lang.startsWith('zh') || v.lang.includes('CN'));
      if (zhVoice) {
        utterance.voice = zhVoice;
      }

      utterance.onend = () => {
        if (onEnded) onEnded();
      };
      utterance.onerror = (e) => {
        if (onError) onError(e);
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (e) {
      if (onError) onError(e);
      return false;
    }
  }

  /**
   * 播放语音音频（支持 Base64 / 远程 URL）
   */
  playAudio(
    audioUrl: string,
    msgId: string,
    onEnded: () => void,
    onError: (err: unknown) => void
  ): HTMLAudioElement {
    this.stop();
    this.currentPlayingId = msgId;

    const audio = new Audio(audioUrl);
    this.activeAudio = audio;

    audio.onended = () => {
      this.currentPlayingId = null;
      this.activeAudio = null;
      onEnded();
    };

    audio.onerror = (e) => {
      this.currentPlayingId = null;
      this.activeAudio = null;
      onError(e);
    };

    audio.play().catch((err) => {
      this.currentPlayingId = null;
      this.activeAudio = null;
      onError(err);
    });

    return audio;
  }

  getCurrentPlayingId(): string | null {
    return this.currentPlayingId;
  }
}

export const MiniMaxTtsService = new MiniMaxTtsServiceImpl();
