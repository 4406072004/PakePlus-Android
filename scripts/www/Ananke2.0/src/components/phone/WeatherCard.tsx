import React, { useState, useEffect, useRef } from 'react';
import { RotateCw, Sparkles, X, CloudSun, MoreHorizontal, Palette, Camera } from 'lucide-react';
import { PhoneSettings } from '../../types';
import { 
  ALL_WEATHER_PRESETS, 
  WeatherPreset, 
  getCurrentSeason, 
  getSeasonChineseName,
  drawRandomSeasonalWeather, 
} from '../../data/weatherData';
import { CARD_BG_PRESETS } from '../../data/defaultThemes';
import { fileToBase64 } from '../../utils/imageUpload';
import { getCardBackgroundStyle } from '../../utils/themeStyles';
import { StorageService } from '../../services/StorageService';
import { WeatherLineAnimation } from './WeatherLineAnimation';

interface WeatherCardProps {
  cardOpacity?: number;
  settings: PhoneSettings;
  onUpdateSettings?: (updates: Partial<PhoneSettings>) => void;
  onOpenSettings?: () => void;
}

const getTodayDateStr = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const WeatherCard: React.FC<WeatherCardProps> = ({
  cardOpacity = 1.0,
  settings,
  onUpdateSettings,
  onOpenSettings,
}) => {
  const currentMonth = new Date().getMonth() + 1;
  const currentSeason = getCurrentSeason(currentMonth);

  // 初始化获取天气：每天第一次上线时抽取一次天气（不是每次上线），当天多次上线保持第一次抽取结果不变
  const [currentWeather, setCurrentWeather] = useState<WeatherPreset>(() => {
    // 1. 如果在设置中手动指定了固定测试天气，优先使用该天气
    if (settings.currentWeatherId) {
      const found = ALL_WEATHER_PRESETS.find(w => w.id === settings.currentWeatherId);
      if (found) return found;
    }

    const todayStr = getTodayDateStr();

    // 2. 检查当天是否已有抽取记录：每天第一次上线抽取一次，当天多次上线保持该结果不变
    try {
      const savedDaily = StorageService.getDailyWeatherRecord();
      if (savedDaily && savedDaily.date === todayStr) {
        const found = ALL_WEATHER_PRESETS.find(w => w.id === savedDaily.weatherId);
        if (found && found.allowedMonths.includes(currentMonth)) {
          return found;
        }
      }
    } catch {
      // ignore
    }

    // 3. 当天第一次上线：根据季节规律加权抽取一次并保存至持久化存储
    const rolled = drawRandomSeasonalWeather(currentMonth);
    try {
      StorageService.saveDailyWeatherRecord({
        date: todayStr,
        weatherId: rolled.id,
      });
    } catch {
      // ignore
    }
    return rolled;
  });

  const [isRerolling, setIsRerolling] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBgModal, setShowBgModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 监听 settings.currentWeatherId 的变动（如在设置中测试切换天气）
  useEffect(() => {
    if (settings.currentWeatherId) {
      const found = ALL_WEATHER_PRESETS.find(w => w.id === settings.currentWeatherId);
      if (found) {
        setCurrentWeather(found);
      }
    }
  }, [settings.currentWeatherId]);

  // 手动重新加权随机抽取一次当季天气（更新当日记录）
  const handleReroll = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsRerolling(true);
    setTimeout(() => {
      const next = drawRandomSeasonalWeather(currentMonth);
      setCurrentWeather(next);
      const todayStr = getTodayDateStr();
      try {
        StorageService.saveDailyWeatherRecord({
          date: todayStr,
          weatherId: next.id,
        });
      } catch {
        // ignore
      }
      if (settings.currentWeatherId && onUpdateSettings) {
        onUpdateSettings({ currentWeatherId: undefined });
      }
      setIsRerolling(false);
    }, 280);
  };

  const handleCustomBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpdateSettings) {
      try {
        const base64 = await fileToBase64(file);
        onUpdateSettings({ weatherCardBg: `url(${base64})` });
        setShowBgModal(false);
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
  };

  const currentBg = settings.weatherCardBg || '#ffffff';
  // 使用安全的长属性样式构建，彻底避免 shorthand background 与 backgroundSize/backgroundPosition 冲突
  const cardBgStyle = getCardBackgroundStyle(currentBg, cardOpacity);

  return (
    <>
      <div
        onClick={() => setShowDetailModal(true)}
        className="relative w-full h-24 sm:h-28 min-h-[96px] rounded-3xl px-3 py-2 sm:py-2.5 shadow-xs border border-neutral-200/70 flex flex-col justify-between items-center overflow-hidden transition-all duration-200 select-none group cursor-pointer hover:border-neutral-300 active:scale-99"
        style={cardBgStyle}
        title="点击查看天气详情与梦角絮语"
      >
        {/* 图片背景柔化蒙层 */}
        {currentBg.startsWith('url') && (
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[0.5px] pointer-events-none" />
        )}

        {/* 第1行：顶部小字 “梦角当日天气” */}
        <div className="relative z-10 w-full flex items-center justify-between px-1 pt-0.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] sm:text-[11px] font-light text-neutral-400 tracking-wider">
              梦角当日天气
            </span>
          </div>
        </div>

        {/* 第2行：居中极简线条动画 + 天气名称（不显示温度） */}
        <div className="relative z-10 flex items-center justify-center gap-2 my-auto px-1">
          <div className="shrink-0 flex items-center justify-center">
            <WeatherLineAnimation
              weatherId={currentWeather.id}
              size={34}
              color={currentWeather.color}
            />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs sm:text-[13px] font-bold text-neutral-800 tracking-tight whitespace-nowrap">
                {currentWeather.name}
              </span>
            </div>
            <span className="text-[9px] text-neutral-400 font-light truncate max-w-[85px] sm:max-w-[100px]">
              {currentWeather.categoryLabel}
            </span>
          </div>
        </div>

        {/* 第3行：底部梦角絮语 */}
        <div className="relative z-10 w-full flex justify-center pb-0.5 px-1">
          <span className="text-[9.5px] sm:text-[10px] font-light text-neutral-400 tracking-wider text-center truncate max-w-[95%]">
            {currentWeather.companionQuote}
          </span>
        </div>

        {/* 右下角底色修改按钮 (与相爱卡片对称排布) */}
        <div className="absolute bottom-1.5 right-1.5 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowBgModal(true);
            }}
            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100/80 transition-colors cursor-pointer"
            title="修改天气卡片底色"
            aria-label="修改天气卡片底色"
          >
            <MoreHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>
        </div>
      </div>

      {/* 弹窗 1：天气详情与絮语全貌（不显示温度） */}
      {showDetailModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-xs p-5 shadow-2xl border border-neutral-100 space-y-4 animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
              <div className="flex items-center gap-1.5">
                <CloudSun className="w-4 h-4 text-neutral-700" />
                <span className="text-xs font-bold text-neutral-900">梦角当日气象记</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Weather Hero */}
            <div className="flex flex-col items-center justify-center py-2 space-y-2 bg-neutral-50/80 rounded-2xl p-3 border border-neutral-100">
              <WeatherLineAnimation
                weatherId={currentWeather.id}
                size={52}
                color={currentWeather.color}
              />
              <div className="text-center space-y-0.5">
                <div className="flex items-center justify-center">
                  <span className="text-base font-bold text-neutral-900">{currentWeather.name}</span>
                </div>
                <p className="text-[11px] text-neutral-500 font-normal">
                  {currentWeather.summary}
                </p>
                <span className="inline-block px-2 py-0.5 rounded-full bg-neutral-200/60 text-[9px] text-neutral-600 font-medium mt-1">
                  概率权重：{currentWeather.probabilityLabel}
                </span>
              </div>
            </div>

            {/* 梦角絮语 */}
            <div className="p-3 bg-pink-50/50 rounded-2xl border border-pink-100/80 space-y-1">
              <div className="flex items-center gap-1 text-[10px] font-medium text-pink-700">
                <Sparkles className="w-3 h-3 text-pink-500" />
                <span>梦角贴心寄语</span>
              </div>
              <p className="text-xs text-neutral-700 leading-relaxed font-light">
                “{currentWeather.companionQuote}”
              </p>
            </div>

            {/* 季节性与概率说明 */}
            <div className="text-[10px] text-neutral-400 space-y-1 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
              <div className="flex justify-between items-center text-neutral-600 font-medium">
                <span>当前时节：{currentMonth}月（{getSeasonChineseName(currentSeason)}）</span>
                <span className="text-emerald-600 font-bold">当日抽取</span>
              </div>
              <p className="text-[9.5px] leading-relaxed text-neutral-400">
                每天第一次上线时自动抽取一次，当天多次上线保持一致。雷暴、台风、冰雹等极端天气概率远低于正常天气（≤1%）。
              </p>
            </div>

            {/* 按钮操作 */}
            <div className="space-y-2 pt-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleReroll();
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 active:scale-98 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>换个当季天气</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowBgModal(true);
                  }}
                  className="py-2 px-3 rounded-xl text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 active:scale-98 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Palette className="w-3.5 h-3.5 text-neutral-500" />
                  <span>改底色</span>
                </button>
              </div>

              <div className="flex gap-2">
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      onOpenSettings();
                    }}
                    className="flex-1 py-2 rounded-xl text-xs font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 active:scale-98 transition-all cursor-pointer"
                  >
                    查看全部预设库
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 active:scale-98 transition-all cursor-pointer"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 弹窗 2：修改天气卡片底色 */}
      {showBgModal && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setShowBgModal(false)}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-neutral-200 animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-neutral-700" />
                <h3 className="text-sm font-semibold text-neutral-800">修改天气卡片底色</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBgModal(false)}
                className="text-xs text-neutral-400 hover:text-neutral-700 px-2 py-1 cursor-pointer"
              >
                关闭
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* 预设低饱和底色与渐变 */}
              <div>
                <label className="text-xs font-medium text-neutral-500 block mb-2">预设底色与微渐变</label>
                <div className="grid grid-cols-4 gap-2">
                  {CARD_BG_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        onUpdateSettings?.({ weatherCardBg: preset.value });
                        setShowBgModal(false);
                      }}
                      className="h-10 rounded-xl border border-neutral-200 shadow-2xs hover:scale-105 active:scale-95 transition-transform relative flex items-center justify-center text-[10px] text-neutral-700 font-medium cursor-pointer"
                      style={{ background: preset.value }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 自由纯色调色器 */}
              <div>
                <label className="text-xs font-medium text-neutral-500 block mb-2">自定义纯色底色</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentBg?.startsWith('#') ? currentBg : '#ffffff'}
                    onChange={e => onUpdateSettings?.({ weatherCardBg: e.target.value })}
                    className="w-9 h-9 rounded-xl border border-neutral-200 cursor-pointer p-0.5 bg-white"
                  />
                  <div className="flex-1 flex gap-1.5 overflow-x-auto py-0.5">
                    {[
                      { name: '纯白', color: '#ffffff' },
                      { name: '雪青', color: '#f1f5f9' },
                      { name: '柔粉', color: '#fff1f2' },
                      { name: '暖橙', color: '#fff7ed' },
                      { name: '淡黄', color: '#fefce8' },
                      { name: '草木', color: '#f0fdf4' },
                      { name: '天青', color: '#f0f9ff' },
                      { name: '浅紫', color: '#faf5ff' },
                    ].map(c => (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => {
                          onUpdateSettings?.({ weatherCardBg: c.color });
                        }}
                        className="w-6 h-6 rounded-full border border-neutral-200 shrink-0 shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                        style={{ backgroundColor: c.color }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* 上传自定义图片 */}
              <div>
                <label className="text-xs font-medium text-neutral-500 block mb-2">上传自定义图片背景</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleCustomBgUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 border border-dashed border-neutral-300 rounded-xl text-xs font-medium text-neutral-600 hover:border-neutral-500 hover:bg-neutral-50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  从本地相册选择图片
                </button>
              </div>

              {/* 恢复初始纯白色 */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateSettings?.({ weatherCardBg: '#ffffff' });
                    setShowBgModal(false);
                  }}
                  className="w-full text-center text-xs text-neutral-500 hover:text-neutral-800 py-1.5 rounded-xl hover:bg-neutral-50 cursor-pointer"
                >
                  恢复初始纯白色
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
