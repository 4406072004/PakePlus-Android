import React, { useState } from 'react';
import { Download, Smartphone, X, Check } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'banner' | 'card' | 'compact';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'card',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already running inside an installed PWA, render a clean badge or null
  if (isInstalled) {
    if (variant === 'compact') return null;
    return (
      <div className={`p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-800 flex items-center justify-between text-xs ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <Check className="w-4 h-4" />
          </div>
          <div>
            <div className="font-medium text-[11px]">已安装 PWA 桌面独立应用</div>
            <div className="text-[10px] text-emerald-600/90 font-light">正在原生独立窗口模式中沉浸运行</div>
          </div>
        </div>
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setJustInstalled(true);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // Ambient or browser guidance
      setShowIOSGuide(true);
    }
  };

  if (variant === 'compact') {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 active:scale-95 text-xs font-medium shadow-xs transition-all cursor-pointer ${className}`}
          title="安装此应用到手机或电脑桌面"
        >
          <Download className="w-3.5 h-3.5" />
          <span>安装应用</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
            <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl border border-neutral-200 text-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-indigo-600" />
                  <h4 className="font-semibold text-xs text-neutral-900">添加到主屏幕 / 安装应用</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-full text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[11px] text-neutral-600 space-y-2 leading-relaxed bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <p className="font-medium text-neutral-800">在 Chrome / Edge 等浏览器：</p>
                <p>点击浏览器地址栏右侧的「安装图标」或菜单中「安装应用 / 安装为应用」。</p>
                <div className="border-t border-neutral-200/60 my-1.5" />
                <p className="font-medium text-neutral-800">在 iPhone / iPad Safari：</p>
                <p>1. 点击 Safari 底部工具栏的「分享」按钮 <span className="inline-block px-1 bg-neutral-200 rounded text-[10px]">⎋</span></p>
                <p>2. 向下滑动并点击「添加到主屏幕」即可像原生 App 一样全屏使用。</p>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 transition"
              >
                我知道了
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className={`p-3.5 bg-gradient-to-br from-neutral-900 to-neutral-800 text-white rounded-2xl shadow-sm space-y-2.5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold leading-tight">安装为独立桌面 / 手机 App (PWA)</h4>
              <p className="text-[10px] text-neutral-300 font-light mt-0.5">免去浏览器地址栏限制，支持全屏沉浸互动与后台常驻</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex-1 py-2 px-3 bg-white text-neutral-900 hover:bg-neutral-100 active:scale-98 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isInstallable ? '立即一键安装' : (isIOS ? 'iOS 添加到主屏幕说明' : '安装为应用指南')}</span>
          </button>
        </div>
      </div>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl border border-neutral-200 text-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-600" />
                <h4 className="font-semibold text-xs text-neutral-900">添加到主屏幕 / 安装指南</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[11px] text-neutral-600 space-y-2 leading-relaxed bg-neutral-50 p-3 rounded-xl border border-neutral-100">
              <p className="font-medium text-neutral-800">在 Chrome / Edge 等浏览器：</p>
              <p>点击浏览器地址栏右侧的「安装图标」或右上角菜单中的「安装此应用」。</p>
              <div className="border-t border-neutral-200/60 my-1.5" />
              <p className="font-medium text-neutral-800">在 iPhone / iPad Safari：</p>
              <p>1. 点击 Safari 底部工具栏的「分享」按钮 <span className="inline-block px-1 bg-neutral-200 rounded text-[10px]">⎋</span></p>
              <p>2. 向下滑动并点击「添加到主屏幕」即可像原生 App 一样全屏使用。</p>
            </div>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 transition"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </>
  );
};
