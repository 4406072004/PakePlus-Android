/**
 * 全屏控制与跨浏览器兼容工具函数
 */

export const isFullscreenActive = (): boolean => {
  if (typeof document === 'undefined') return false;
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
};

export const requestAppFullscreen = async (): Promise<boolean> => {
  if (typeof document === 'undefined') return false;
  if (isFullscreenActive()) return true;

  const docEl = document.documentElement as any;
  try {
    if (docEl.requestFullscreen) {
      await docEl.requestFullscreen();
      return true;
    } else if (docEl.webkitRequestFullscreen) {
      await docEl.webkitRequestFullscreen();
      return true;
    } else if (docEl.mozRequestFullScreen) {
      await docEl.mozRequestFullScreen();
      return true;
    } else if (docEl.msRequestFullscreen) {
      await docEl.msRequestFullscreen();
      return true;
    }
  } catch (err) {
    // 多数现代浏览器要求由用户直接手势（Click/Touch）触发
    console.warn('[Fullscreen] Request failed or blocked by browser policy:', err);
    return false;
  }
  return false;
};

export const exitAppFullscreen = async (): Promise<boolean> => {
  if (typeof document === 'undefined') return false;
  if (!isFullscreenActive()) return true;

  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return true;
    } else if ((document as any).webkitExitFullscreen) {
      await (document as any).webkitExitFullscreen();
      return true;
    } else if ((document as any).mozCancelFullScreen) {
      await (document as any).mozCancelFullScreen();
      return true;
    } else if ((document as any).msExitFullscreen) {
      await (document as any).msExitFullscreen();
      return true;
    }
  } catch (err) {
    console.warn('[Fullscreen] Exit failed:', err);
    return false;
  }
  return false;
};
