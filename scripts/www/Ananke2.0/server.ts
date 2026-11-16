import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.DISABLE_HMR = 'true';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// MiniMax TTS proxy route: 安全代理请求，支持从 Authorization Bearer 头或请求体中获取 API Key
app.post(['/api/tts/minimax', '/v1/tts', '/tts'], async (req, res) => {
  const { text, voice_id, model, apiKey: clientApiKey, baseUrl: clientBaseUrl, speed, pitch, vol } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ success: false, error: 'Text is required' });
  }

  const authHeader = req.headers.authorization;
  const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;

  const effectiveApiKey = (clientApiKey && typeof clientApiKey === 'string' && clientApiKey.trim())
    ? clientApiKey.trim()
    : (bearerKey || process.env.MINIMAX_API_KEY);

  const groupId = process.env.MINIMAX_GROUP_ID;

  if (!effectiveApiKey) {
    return res.status(503).json({
      success: false,
      error: 'MINIMAX_API_KEY_NOT_CONFIGURED',
      message: 'MiniMax API 密钥未配置。请在语音消息设置中填入 API Key，或在服务端环境变量中设置 MINIMAX_API_KEY。',
    });
  }

  try {
    const rawBase = (clientBaseUrl && typeof clientBaseUrl === 'string' && clientBaseUrl.trim())
      ? clientBaseUrl.trim().replace(/\/$/, '')
      : 'https://api.minimaxi.com/v1';

    let url = rawBase.endsWith('/t2a_v2') ? rawBase : `${rawBase}/t2a_v2`;
    if (groupId) {
      url += `?GroupId=${encodeURIComponent(groupId)}`;
    }

    const payload = {
      model: model && typeof model === 'string' && model.trim() ? model.trim() : 'speech-2.8-turbo',
      text: text.slice(0, 1000),
      stream: false,
      voice_setting: {
        voice_id: voice_id || 'male-qn-qingse',
        speed: typeof speed === 'number' ? speed : 1.0,
        vol: typeof vol === 'number' ? vol : 1.0,
        pitch: typeof pitch === 'number' ? pitch : 0,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${effectiveApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('MiniMax API HTTP error:', response.status, errText);
      return res.status(response.status).json({
        success: false,
        error: 'MINIMAX_API_ERROR',
        details: errText,
      });
    }

    const data = (await response.json()) as any;

    if (data.base_resp && data.base_resp.status_code !== 0) {
      return res.status(400).json({
        success: false,
        error: 'MINIMAX_SERVICE_ERROR',
        message: data.base_resp.status_msg || 'MiniMax TTS returned error',
      });
    }

    // MiniMax T2A v2 通常在 data.data.audio 返回 hex 编码的 mp3 音频数据
    const hexAudio = data?.data?.audio;
    if (hexAudio && typeof hexAudio === 'string') {
      const audioBuffer = Buffer.from(hexAudio, 'hex');
      const base64Audio = audioBuffer.toString('base64');
      const audioDataUrl = `data:audio/mp3;base64,${base64Audio}`;

      return res.json({
        success: true,
        audioUrl: audioDataUrl,
        duration: data?.data?.extra_info?.audio_length ? Math.round(data.data.extra_info.audio_length / 1000) : undefined,
      });
    }

    // 如果返回的是直接 base64 或 url
    if (data?.data?.audio_url) {
      return res.json({
        success: true,
        audioUrl: data.data.audio_url,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'NO_AUDIO_DATA',
      message: 'No audio data received from MiniMax',
    });
  } catch (err: any) {
    console.error('TTS Proxy Error:', err);
    return res.status(500).json({
      success: false,
      error: 'SERVER_PROXY_ERROR',
      message: err.message || 'Internal proxy error',
    });
  }
});

// MiniMax 状态检查端点
app.get('/api/tts/status', (_req, res) => {
  const isConfigured = Boolean(process.env.MINIMAX_API_KEY && process.env.MINIMAX_API_KEY.trim());
  res.json({
    configured: isConfigured,
    hasGroupId: Boolean(process.env.MINIMAX_GROUP_ID),
  });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();
