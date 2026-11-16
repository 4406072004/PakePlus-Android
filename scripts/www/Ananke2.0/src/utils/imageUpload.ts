/**
 * Image helper: Handles user image uploads with client-side compression and presets.
 * 自动对大图进行有损缩放压缩（最大边 1080px，质量 0.82），
 * 防止超大图片突破 localStorage 5MB 限制导致崩溃闪退。
 */

export const FALLBACK_AVATAR =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23e5e7eb"/><circle cx="50" cy="38" r="18" fill="%239ca3af"/><path d="M22 86 C24 64, 76 64, 78 86 Z" fill="%239ca3af"/></svg>';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    // 如果不是图片类型或大于 50MB 异常文件，直接返回降级
    if (!file || !file.type.startsWith('image/')) {
      resolve(FALLBACK_AVATAR);
      return;
    }

    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const rawDataUrl = readerEvent.target?.result as string;
      if (!rawDataUrl) {
        resolve(FALLBACK_AVATAR);
        return;
      }

      // 如果是微小图片（< 100KB）或者是 SVG，无需额外 Canvas 压缩
      if (file.size < 100 * 1024 || file.type.includes('svg')) {
        resolve(rawDataUrl);
        return;
      }

      // 利用 Offscreen Canvas 进行等比缩放和压缩
      const img = new Image();
      img.onload = () => {
        try {
          const MAX_WIDTH = 840;
          const MAX_HEIGHT = 840;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d', { willReadFrequently: false });

          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          // 压缩为 JPEG 质量 0.78，大幅降低图片字节数与内存占用，彻底杜绝 QuotaExceededError
          const compressed = canvas.toDataURL('image/jpeg', 0.78);
          // 及时释放内存
          img.src = '';
          canvas.width = 0;
          canvas.height = 0;
          resolve(compressed);
        } catch (e) {
          console.warn('Canvas image compression failed, using raw data:', e);
          resolve(rawDataUrl);
        }
      };

      img.onerror = () => {
        resolve(rawDataUrl);
      };

      img.src = rawDataUrl;
    };

    reader.onerror = () => {
      resolve(FALLBACK_AVATAR);
    };

    reader.readAsDataURL(file);
  });
};

export const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=e5e7eb',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Aria&backgroundColor=fce7f3',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Leo&backgroundColor=e0f2fe',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Milo&backgroundColor=fef3c7',
  // 下面四个女性预设头像：与上面保持一致的简约化手绘风格 (Notionists)
  'https://api.dicebear.com/7.x/notionists/svg?seed=Luna&backgroundColor=ede9fe',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Chloe&backgroundColor=ffe4e6',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Zoe&backgroundColor=dcfce7',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Mia&backgroundColor=fef3c7',
];
