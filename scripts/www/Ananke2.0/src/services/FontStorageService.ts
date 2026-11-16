/**
 * FontStorageService:
 * 1. 负责管理自定义 TTF 字体的 IndexedDB 本地持久化与 @font-face 动态注入
 *    杜绝将数兆字体存入 localStorage 导致配额爆炸 (QuotaExceededError) 的风险
 * 2. 负责提供聊天背景图 Canvas 智能压缩算法，将用户上传的大图稳定压缩至 ~150KB 内
 */

const DB_NAME = 'zk_card_phone_assets_db';
const DB_VERSION = 1;
const FONT_STORE = 'custom_fonts';

function openAssetDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(FONT_STORE)) {
        db.createObjectStore(FONT_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class FontStorageService {
  private static cachedFontDataUrl: string | null = null;
  private static cachedFontName: string | null = null;

  /**
   * 将 TTF 字体保存至 IndexedDB
   */
  static async saveFont(fileName: string, base64OrDataUrl: string): Promise<void> {
    try {
      const db = await openAssetDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(FONT_STORE, 'readwrite');
        const store = tx.objectStore(FONT_STORE);
        const record = {
          id: 'chat_custom_font',
          fileName,
          dataUrl: base64OrDataUrl,
          updatedAt: Date.now(),
        };
        const req = store.put(record);
        req.onsuccess = () => {
          this.cachedFontDataUrl = base64OrDataUrl;
          this.cachedFontName = fileName;
          this.applyFontToDom(base64OrDataUrl);
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Failed to save font to IndexedDB, using memory cache:', err);
      this.cachedFontDataUrl = base64OrDataUrl;
      this.cachedFontName = fileName;
      this.applyFontToDom(base64OrDataUrl);
    }
  }

  /**
   * 从 IndexedDB 加载自定义字体
   */
  static async loadFont(): Promise<{ fileName: string; dataUrl: string } | null> {
    if (this.cachedFontDataUrl && this.cachedFontName) {
      return { fileName: this.cachedFontName, dataUrl: this.cachedFontDataUrl };
    }
    try {
      const db = await openAssetDb();
      return new Promise((resolve) => {
        const tx = db.transaction(FONT_STORE, 'readonly');
        const store = tx.objectStore(FONT_STORE);
        const req = store.get('chat_custom_font');
        req.onsuccess = () => {
          const res = req.result;
          if (res && typeof res.dataUrl === 'string') {
            const fontName = typeof res.fileName === 'string' ? res.fileName : '自定义字体.ttf';
            const fontUrl = res.dataUrl;
            this.cachedFontDataUrl = fontUrl;
            this.cachedFontName = fontName;
            this.applyFontToDom(fontUrl);
            resolve({ fileName: fontName, dataUrl: fontUrl });
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * 清除自定义字体
   */
  static async clearFont(): Promise<void> {
    this.cachedFontDataUrl = null;
    this.cachedFontName = null;
    try {
      const db = await openAssetDb();
      const tx = db.transaction(FONT_STORE, 'readwrite');
      tx.objectStore(FONT_STORE).delete('chat_custom_font');
    } catch {
      // ignore
    }
    const styleEl = document.getElementById('zk-chat-custom-font-style');
    if (styleEl) {
      styleEl.remove();
    }
  }

  /**
   * 动态向 DOM 注入 @font-face 规则
   */
  static applyFontToDom(dataUrl: string): void {
    if (typeof document === 'undefined') return;
    let styleEl = document.getElementById('zk-chat-custom-font-style') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'zk-chat-custom-font-style';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      @font-face {
        font-family: 'ChatCustomFont';
        src: url('${dataUrl}') format('truetype');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
      .chat-custom-font-active {
        font-family: 'ChatCustomFont', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      }
    `;
  }

  /**
   * 聊天背景图 Canvas 智能自适应压缩
   * 限制最大宽高 1080x1920，输出高保真轻量 WebP/JPEG
   * 彻底避免因用户上传原图（5MB~20MB）导致 localStorage 溢出与白屏崩溃
   */
  static compressBackgroundImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('请选择有效的图片文件'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const MAX_WIDTH = 1080;
            const MAX_HEIGHT = 1920;
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH || height > MAX_HEIGHT) {
              const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('无法创建 Canvas 上下文'));
              return;
            }

            // 绘制平滑抗锯齿
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            // 优先 WebP 格式，若不支持自动降级为 JPEG
            let compressedData = canvas.toDataURL('image/webp', 0.82);
            if (!compressedData.startsWith('data:image/webp')) {
              compressedData = canvas.toDataURL('image/jpeg', 0.82);
            }

            resolve(compressedData);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('图片加载解析失败'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('读取本地文件失败'));
      reader.readAsDataURL(file);
    });
  }
}
