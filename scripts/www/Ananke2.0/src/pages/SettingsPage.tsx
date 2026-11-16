import React, { useState, useRef } from 'react';
import { 
  ChevronLeft, 
  Palette, 
  Sparkles, 
  Layers, 
  Volume2, 
  Download, 
  Upload, 
  RotateCcw, 
  Camera, 
  Sliders,
  Check,
  CloudSun,
  Calendar,
  Image as ImageIcon,
  Bell,
  ShieldAlert,
  Archive,
  CheckCircle2,
  AlertTriangle,
  FolderArchive,
  Info,
  MessageSquare,
  HeartHandshake,
  Moon,
  Wallet,
  Settings as SettingsIcon,
  Mail,
  ChevronRight,
  ChevronDown,
  BookOpen,
  FileCheck,
  Maximize2,
  Minimize2,
  Key,
  Eye,
  EyeOff,
  Globe,
} from 'lucide-react';
import { requestAppFullscreen, exitAppFullscreen, isFullscreenActive } from '../utils/fullscreen';
import { 
  PhoneSettings, 
  UserProfile, 
  Character, 
  Card, 
  FullBackupData,
  BackupModuleType,
  BackupPackage,
  ImportMode,
  ImportReport,
} from '../types';
import { COLOR_THEMES, CARD_BG_PRESETS } from '../data/defaultThemes';
import { StorageService } from '../services/StorageService';
import { FontStorageService } from '../services/FontStorageService';
import { NotificationService } from '../services/NotificationService';
import { BackupService, MODULE_NAMES, ALL_BACKUP_MODULES } from '../services/BackupService';
import { backgroundKeepAlive } from '../core/BackgroundKeepAlive';
import { fileToBase64 } from '../utils/imageUpload';
import { 
  ALL_WEATHER_PRESETS, 
  getCurrentSeason, 
  getSeasonChineseName,
} from '../data/weatherData';
import { WeatherLineAnimation } from '../components/phone/WeatherLineAnimation';
import { AnankeNoticeContent } from '../components/common/AnankeNoticeContent';
import { PWAInstallButton } from '../components/common/PWAInstallButton';

interface SettingsPageProps {
  settings: PhoneSettings;
  userProfile: UserProfile;
  character: Character;
  cards: Card[];
  onUpdateSettings: (updates: Partial<PhoneSettings>) => void;
  onUpdateUserProfile: (updates: Partial<UserProfile>) => void;
  onUpdateCharacter: (updates: Partial<Character>) => void;
  onUpdateCards: (newCards: Card[]) => void;
  onRestoreBackup: (data: FullBackupData) => void;
  onReloadAllData?: () => void;
  onNavigateToChat?: () => void;
  onOpenNoticeModal?: () => void;
  onBack: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  userProfile,
  character,
  cards,
  onUpdateSettings,
  onUpdateUserProfile,
  onUpdateCharacter,
  onUpdateCards,
  onRestoreBackup,
  onReloadAllData,
  onNavigateToChat,
  onOpenNoticeModal,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'ui' | 'weather' | 'system'>('ui');
  const [weatherFilter, setWeatherFilter] = useState<'all' | 'common' | 'romantic' | 'rare' | 'extreme'>('all');
  const [weatherToast, setWeatherToast] = useState<string | null>(null);
  const currentMonth = new Date().getMonth() + 1;
  const currentSeason = getCurrentSeason(currentMonth);

  const [keepAliveActive, setKeepAliveActive] = useState(backgroundKeepAlive.getStatus());
  const [notificationPerm, setNotificationPerm] = useState<'granted' | 'denied' | 'default' | 'unsupported'>(
    NotificationService.getPermission()
  );
  const [notificationToast, setNotificationToast] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // 整体备份与模块备份状态
  const [backupSubTab, setBackupSubTab] = useState<'full' | 'modules'>('full');
  const [moduleStats, setModuleStats] = useState(() => BackupService.getModuleStats());
  const [isBackupSectionExpanded, setIsBackupSectionExpanded] = useState<boolean>(false);
  const [isNoticeSectionExpanded, setIsNoticeSectionExpanded] = useState<boolean>(false);

  // 导出结果展示弹窗
  const [exportResultInfo, setExportResultInfo] = useState<{
    fileName: string;
    fileSizeStr: string;
    meta: any;
  } | null>(null);

  // 待导入文件的解析包与模式选择弹窗
  const [pendingImportPkg, setPendingImportPkg] = useState<BackupPackage | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [showOverwriteWarning, setShowOverwriteWarning] = useState<boolean>(false);

  // 校验错误弹窗
  const [validationErrors, setValidationErrors] = useState<string[] | null>(null);

  // 导入报告弹窗
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  const [isWallpaperUploading, setIsWallpaperUploading] = useState(false);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const showNotificationMsg = (msg: string) => {
    setNotificationToast(msg);
    setTimeout(() => setNotificationToast(null), 3000);
  };

  // 强制全屏状态
  const [isFullscreen, setIsFullscreen] = useState(() => isFullscreenActive());

  React.useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(isFullscreenActive());
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const handleToggleForceFullscreen = async () => {
    const nextVal = settings.forceFullscreen === false ? true : false;
    onUpdateSettings({ forceFullscreen: nextVal });
    if (nextVal) {
      const ok = await requestAppFullscreen();
      if (ok) {
        showNotificationMsg('已开启强制全屏并进入全屏');
      } else {
        showNotificationMsg('强制全屏已开启（受限于不同浏览器，可能需要再次轻触屏幕）');
      }
    } else {
      await exitAppFullscreen();
      showNotificationMsg('强制全屏已关闭');
    }
    setIsFullscreen(isFullscreenActive());
  };

  const handleManualFullscreenTrigger = async () => {
    if (isFullscreenActive()) {
      await exitAppFullscreen();
      showNotificationMsg('已退出全屏');
    } else {
      const ok = await requestAppFullscreen();
      if (ok) {
        showNotificationMsg('已成功进入全屏');
      } else {
        showNotificationMsg('当前浏览器未能进入全屏，可能受浏览器安全策略限制');
      }
    }
    setIsFullscreen(isFullscreenActive());
  };

  // Toggle Background notifications
  const handleToggleNotifications = async () => {
    const willEnable = !settings.backgroundNotifications;

    if (!willEnable) {
      onUpdateSettings({ backgroundNotifications: false });
      showNotificationMsg('后台通知已关闭');
      return;
    }

    if (!NotificationService.isSupported()) {
      showNotificationMsg('当前浏览器不支持系统通知 API');
      return;
    }

    let perm = NotificationService.getPermission();
    if (perm === 'default') {
      perm = await NotificationService.requestPermission();
      setNotificationPerm(perm);
    }

    if (perm === 'granted') {
      onUpdateSettings({ backgroundNotifications: true });
      showNotificationMsg('后台通知已开启，角色新消息将推送桌面通知');
    } else if (perm === 'denied') {
      showNotificationMsg('通知权限已被浏览器拒绝，请在地址栏设置中允许通知');
    } else {
      showNotificationMsg('未授予通知权限');
    }
  };

  const handleTestNotification = () => {
    if (!NotificationService.isSupported()) {
      showNotificationMsg('当前浏览器不支持通知');
      return;
    }
    const success = NotificationService.sendTestNotification(character, () => {
      if (onNavigateToChat) {
        onNavigateToChat();
      }
    });
    if (success) {
      showNotificationMsg('已发送测试通知，请查看系统桌面提示');
    } else {
      showNotificationMsg('发送失败，请确认已授予通知权限');
    }
  };

  // Toggle Background keep-alive
  const handleToggleKeepAlive = async () => {
    const next = !settings.keepAliveAudio;
    onUpdateSettings({ keepAliveAudio: next });
    if (next) {
      await backgroundKeepAlive.start();
      setKeepAliveActive(true);
    } else {
      backgroundKeepAlive.stop();
      setKeepAliveActive(false);
    }
  };

  // Upload custom desktop wallpaper with Canvas compression
  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsWallpaperUploading(true);
      try {
        const compressed = await FontStorageService.compressBackgroundImage(file);
        onUpdateSettings({ wallpaper: `url(${compressed})` });
        setImportStatus('主界面底图已成功上传并自适应压缩！');
        setTimeout(() => setImportStatus(null), 3000);
      } catch (err) {
        console.error('Wallpaper upload failed:', err);
        setImportStatus('底图上传失败：' + (err instanceof Error ? err.message : String(err)));
        setTimeout(() => setImportStatus(null), 3000);
      } finally {
        setIsWallpaperUploading(false);
        if (wallpaperInputRef.current) wallpaperInputRef.current.value = '';
      }
    }
  };

  // Clear wallpaper and reset to default neutral color
  const handleClearWallpaper = () => {
    onUpdateSettings({ wallpaper: '#ececec', wallpaperMask: 0.2 });
    setImportStatus('已恢复默认纯灰底色');
    setTimeout(() => setImportStatus(null), 2000);
  };

  // 统一导出服务（支持整体备份或指定单独模块）
  const handleExport = (targetModules: BackupModuleType[] | 'all' = 'all') => {
    try {
      const result = BackupService.exportBackup(targetModules);
      BackupService.downloadBackupFile(result.jsonString, result.fileName);
      setExportResultInfo({
        fileName: result.fileName,
        fileSizeStr: result.fileSizeStr,
        meta: result.meta,
      });
      setModuleStats(BackupService.getModuleStats());
    } catch (err: any) {
      showNotificationMsg(`导出备份失败：${err?.message || '未知错误'}`);
    }
  };

  // 选择并读取导入文件（先校验文件格式、版本及数据类型）
  const handleSelectBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) return;

        const val = BackupService.validateBackup(content);
        if (!val.isValid || !val.pkg) {
          setValidationErrors(val.errors);
          return;
        }

        // 校验通过，打开导入确认与模式选择弹窗
        setPendingImportPkg(val.pkg);
        setImportMode('merge');
        setShowOverwriteWarning(false);
      } catch (err: any) {
        setValidationErrors([`读取文件异常: ${err?.message || '未知错误'}`]);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 确认执行最终导入写入（先完成校验，再执行写入；失败时避免部分写入）
  const handleConfirmImport = (forceOverwrite = false) => {
    if (!pendingImportPkg) return;

    if (importMode === 'overwrite' && !forceOverwrite) {
      setShowOverwriteWarning(true);
      return;
    }

    setShowOverwriteWarning(false);
    const report = BackupService.importBackup(pendingImportPkg, importMode);
    setPendingImportPkg(null);
    setImportReport(report);

    // 刷新模块统计和应用状态
    setModuleStats(BackupService.getModuleStats());
    if (onReloadAllData) {
      onReloadAllData();
    }
  };

  return (
    <div className="w-full h-full flex flex-col justify-between bg-neutral-100 select-none overflow-hidden relative">
      {/* Top Bar */}
      <div className="h-12 px-3 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 flex items-center justify-between shrink-0 z-20">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center text-xs text-neutral-600 hover:text-neutral-900 active:scale-95 transition-all p-1 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 mr-0.5" />
          <span>返回</span>
        </button>
        <span className="text-xs font-semibold text-neutral-800">设置与个性化</span>
        <div className="w-10" />
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-around bg-white border-b border-neutral-200/60 px-1 py-1.5 shrink-0 z-10 text-[11px] sm:text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('ui')}
          className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
            activeTab === 'ui' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          UI与外观
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('weather')}
          className={`px-3 py-1 rounded-full font-medium transition-colors ${
            activeTab === 'weather' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          天气预设
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`px-3 py-1 rounded-full font-medium transition-colors ${
            activeTab === 'system' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          保活与备份
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {importStatus && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] text-center">
            {importStatus}
          </div>
        )}

        {/* --- TAB 1: UI & APPEARANCE --- */}
        {activeTab === 'ui' && (
          <div className="space-y-4">
            {/* 1. 全局低饱和度色彩预设 */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-2.5">
              <div className="flex items-center gap-1.5 font-medium text-neutral-800">
                <Palette className="w-4 h-4 text-neutral-600" />
                <span>整体UI颜色 (低饱和度预设)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {COLOR_THEMES.map(theme => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      const updates: Partial<PhoneSettings> = {
                        themeId: theme.id,
                        accentColor: theme.accent,
                        iconBgColor: theme.cardBg,
                      };
                      // 如果用户未上传自定义底图，则同步底图为主题渐变；若已上传自定义图片则保留
                      if (!settings.wallpaper?.startsWith('url(')) {
                        updates.wallpaper = theme.bgGradient;
                      }
                      onUpdateSettings(updates);
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      settings.themeId === theme.id
                        ? 'border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: theme.primary }}
                      />
                      <span className="text-[11px] font-medium text-neutral-700">{theme.name}</span>
                    </div>
                    {settings.themeId === theme.id && <Check className="w-3.5 h-3.5 text-neutral-900" />}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. 主界面桌面底图（无预设，直接上传本地图片，增加图片遮罩） */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-neutral-800 text-xs block">主界面桌面底图</span>
                    <span className="text-[10px] text-neutral-400">
                      支持上传本地图片 · 智能自适应压缩保障系统稳定
                    </span>
                  </div>
                </div>

                {settings.wallpaper?.startsWith('url') && (
                  <button
                    type="button"
                    onClick={handleClearWallpaper}
                    className="text-[10px] text-neutral-400 hover:text-rose-600 cursor-pointer"
                  >
                    恢复默认纯灰
                  </button>
                )}
              </div>

              {/* 底图缩略预览与操作按钮 */}
              <div className="flex gap-2.5 items-center">
                <div className="w-16 h-20 rounded-xl border border-neutral-200 overflow-hidden relative bg-neutral-100 shrink-0 shadow-2xs">
                  {settings.wallpaper?.startsWith('url') ? (
                    <>
                      <div 
                        className="w-full h-full bg-cover bg-center"
                        style={{ backgroundImage: settings.wallpaper }}
                      />
                      <div 
                        className="absolute inset-0"
                        style={{
                          backgroundColor: `rgba(255, 255, 255, ${settings.wallpaperMask ?? 0.2})`
                        }}
                      />
                    </>
                  ) : (
                    <div 
                      className="w-full h-full flex flex-col items-center justify-center text-neutral-400"
                      style={{ background: settings.wallpaper || '#ececec' }}
                    >
                      <ImageIcon className="w-5 h-5 mb-0.5 opacity-60" />
                      <span className="text-[8px] font-medium">默认底色</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    ref={wallpaperInputRef}
                    accept="image/*"
                    onChange={handleWallpaperUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => wallpaperInputRef.current?.click()}
                    disabled={isWallpaperUploading}
                    className="w-full py-2 px-3 bg-neutral-900 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isWallpaperUploading ? '正在压缩并载入...' : '上传本地图片为底图'}</span>
                  </button>
                  <p className="text-[10px] text-neutral-400 leading-tight">
                    支持各类格式本地照片，自动优化分辨率并控制体积在 ~150KB 内，不卡顿、不闪退。
                  </p>
                </div>
              </div>

              {/* 图片遮罩度调节（减淡程度） */}
              <div className="pt-2 border-t border-neutral-100 space-y-1.5">
                <div className="flex justify-between text-[11px] text-neutral-600">
                  <span className="font-medium">图片遮罩度（减淡程度）</span>
                  <span className="font-mono font-bold text-neutral-800">
                    {Math.round((settings.wallpaperMask ?? 0.2) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.9"
                  step="0.05"
                  value={settings.wallpaperMask ?? 0.2}
                  onChange={e => onUpdateSettings({ wallpaperMask: parseFloat(e.target.value) })}
                  className="w-full accent-neutral-900 cursor-pointer"
                />
                <span className="text-[10px] text-neutral-400 block">
                  滑动可覆盖白色柔光遮罩以减淡背景原图，使手机桌面卡片、文字与图标更清晰易读。
                </span>
              </div>
            </div>

            {/* 3. 软件图标自定义：底色 / 透明度 / 方圆度 */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3.5">
              <div className="flex items-center gap-1.5 font-medium text-neutral-800">
                <Sliders className="w-4 h-4 text-neutral-600" />
                <span>软件图标自定义 (底色 / 透明度 / 方圆度)</span>
              </div>

              {/* 方圆度选择 */}
              <div>
                <label className="text-[11px] text-neutral-500 block mb-1.5">图标方圆度</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '直角方', radius: 4 },
                    { label: '小圆角', radius: 12 },
                    { label: '优雅圆', radius: 20 },
                    { label: '正圆', radius: 999 },
                  ].map(r => (
                    <button
                      key={r.radius}
                      type="button"
                      onClick={() => onUpdateSettings({ iconRadius: r.radius })}
                      className={`py-1.5 rounded-xl border text-[11px] font-medium transition-all ${
                        settings.iconRadius === r.radius
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 透明度滑块 */}
              <div>
                <div className="flex justify-between text-[11px] text-neutral-500 mb-1">
                  <span>图标透明度</span>
                  <span className="font-mono">{Math.round((settings.iconOpacity ?? 0.95) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={settings.iconOpacity ?? 0.95}
                  onChange={e => onUpdateSettings({ iconOpacity: parseFloat(e.target.value) })}
                  className="w-full accent-neutral-800"
                />
              </div>

              {/* 图标底色 */}
              <div>
                <label className="text-[11px] text-neutral-500 block mb-1.5">图标底色</label>
                <div className="flex items-center gap-2">
                  {['#ffffff', '#f4f4f5', '#e2e8f0', '#f5f5f4', '#fdf2f8', '#27272a'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onUpdateSettings({ 
                        iconBgColor: color, 
                        iconTextColor: color === '#27272a' ? '#f4f4f5' : '#27272a' 
                      })}
                      className={`w-7 h-7 rounded-full border border-neutral-300 shadow-2xs hover:scale-110 transition-transform ${
                        settings.iconBgColor === color ? 'ring-2 ring-neutral-900' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 4. 卡片透明度调节 */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-2">
              <div className="flex justify-between text-[11px] text-neutral-500 mb-1">
                <span className="font-medium text-neutral-800">所有卡片透明度</span>
                <span className="font-mono">{Math.round((settings.cardOpacity ?? 1.0) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={settings.cardOpacity ?? 1.0}
                onChange={e => onUpdateSettings({ cardOpacity: parseFloat(e.target.value) })}
                className="w-full accent-neutral-800"
              />
            </div>
          </div>
        )}

        {/* --- TAB: WEATHER MODULE (梦角当日天气模块) --- */}
        {activeTab === 'weather' && (
          <div className="space-y-4">
            {/* 1. 天气模块总开关与当前状态 */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <CloudSun className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-neutral-900 text-xs block">
                      主界面“梦角当日天气”卡片
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      与相爱天数并列展示（比例 1:1）
                    </span>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={settings.showWeatherCard !== false}
                  onChange={e => onUpdateSettings({ showWeatherCard: e.target.checked })}
                  className="accent-neutral-900 w-4 h-4 cursor-pointer"
                />
              </div>

              {/* 状态与季节规律说明 */}
              <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-100 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between text-neutral-700 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                    <span>现实时节：{currentMonth} 月 · {getSeasonChineseName(currentSeason)}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/60">
                    加权概率抽取
                  </span>
                </div>
                <p className="text-[10px] text-neutral-500 leading-relaxed">
                  按季节与自然概率智能抽取：正常晴天、多云、细雨占绝大多数（&gt;85%），雷暴、台风、冰雹等极端天气概率已大幅降低（≤1%），严格遵循季节规律。
                </p>
              </div>

              {/* 锁定/恢复自动抽取按钮 */}
              {settings.currentWeatherId && (
                <div className="flex items-center justify-between p-2 bg-amber-50 rounded-xl border border-amber-200/70 text-[11px]">
                  <span className="text-amber-800 text-[10px]">
                    当前处于测试锁定模式（固定展示中）
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ currentWeatherId: undefined });
                      try { sessionStorage.removeItem('zk_session_weather_id'); } catch {}
                      setWeatherToast('已恢复每次上线根据真实季节随机抽取！');
                      setTimeout(() => setWeatherToast(null), 3000);
                    }}
                    className="px-2 py-1 bg-white text-amber-700 rounded-lg text-[10px] font-bold border border-amber-300 hover:bg-amber-100 cursor-pointer"
                  >
                    恢复随季节自动抽取
                  </button>
                </div>
              )}
            </div>

            {/* 1.5 天气卡片底色修改 */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-neutral-900 text-xs block">
                      天气卡片底色
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      支持预设微渐变、纯色与自定义底色
                    </span>
                  </div>
                </div>

                <div 
                  className="w-7 h-7 rounded-xl border border-neutral-300 shadow-2xs"
                  style={{ background: settings.weatherCardBg || '#ffffff' }}
                  title="当前天气卡片底色预览"
                />
              </div>

              {/* 预设色板 */}
              <div className="grid grid-cols-4 gap-2">
                {CARD_BG_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ weatherCardBg: preset.value });
                      setWeatherToast(`已应用「${preset.name}」天气卡片底色`);
                      setTimeout(() => setWeatherToast(null), 2500);
                    }}
                    className={`h-9 rounded-xl border text-[10px] font-medium transition-transform active:scale-95 flex items-center justify-center cursor-pointer ${
                      settings.weatherCardBg === preset.value
                        ? 'border-neutral-900 ring-2 ring-neutral-900/20 font-bold text-neutral-900'
                        : 'border-neutral-200 shadow-2xs text-neutral-700 hover:scale-102'
                    }`}
                    style={{ background: preset.value }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>

              {/* 自定义纯色调色器与重置 */}
              <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.weatherCardBg?.startsWith('#') ? settings.weatherCardBg : '#ffffff'}
                    onChange={e => onUpdateSettings({ weatherCardBg: e.target.value })}
                    className="w-7 h-7 rounded-lg border border-neutral-200 cursor-pointer p-0.5 bg-white"
                    title="自定义纯色调色盘"
                  />
                  <div className="flex gap-1 overflow-x-auto">
                    {[
                      { name: '纯白', color: '#ffffff' },
                      { name: '雪青', color: '#f1f5f9' },
                      { name: '柔粉', color: '#fff1f2' },
                      { name: '草木', color: '#f0fdf4' },
                      { name: '天青', color: '#f0f9ff' },
                      { name: '浅紫', color: '#faf5ff' },
                    ].map(c => (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => {
                          onUpdateSettings({ weatherCardBg: c.color });
                        }}
                        className="w-5 h-5 rounded-full border border-neutral-200 shrink-0 shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                        style={{ backgroundColor: c.color }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onUpdateSettings({ weatherCardBg: '#ffffff' });
                    setWeatherToast('已恢复初始纯白色');
                    setTimeout(() => setWeatherToast(null), 2000);
                  }}
                  className="text-[10px] text-neutral-500 hover:text-neutral-900 px-2 py-1 rounded-lg hover:bg-neutral-100 cursor-pointer"
                >
                  恢复纯白
                </button>
              </div>
            </div>

            {/* 提示条 */}
            {weatherToast && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] text-center animate-fade-in">
                {weatherToast}
              </div>
            )}

            {/* 2. 预设天气种类展示与极简线条动画一览 */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-neutral-800 text-xs">
                    <Sparkles className="w-4 h-4 text-pink-500" />
                    <span>预设天气种类大全 ({ALL_WEATHER_PRESETS.length} 种)</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">
                    实时播放极简线条动画，点击可直接在桌面测试预览样式
                  </span>
                </div>
              </div>

              {/* 分类过滤器 */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[
                  { id: 'all', label: '全部天气' },
                  { id: 'common', label: '常见气象' },
                  { id: 'romantic', label: '浪漫限定' },
                  { id: 'rare', label: '特殊气象' },
                  { id: 'extreme', label: '极端对流' },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setWeatherFilter(item.id as any)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                      weatherFilter === item.id 
                        ? 'bg-neutral-800 text-white' 
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* 天气卡片列表 */}
              <div className="space-y-2.5 pt-1">
                {ALL_WEATHER_PRESETS
                  .filter(w => weatherFilter === 'all' || w.category === weatherFilter)
                  .map(preset => {
                    const isSeasonal = preset.allowedMonths.includes(currentMonth);
                    const isSelected = settings.currentWeatherId === preset.id;

                    return (
                      <div
                        key={preset.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          isSelected 
                            ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-300' 
                            : 'bg-neutral-50/70 border-neutral-200/70 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          {/* 左侧：极简线条动画与标题 */}
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-white border border-neutral-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                              <WeatherLineAnimation
                                weatherId={preset.id}
                                size={32}
                                color={preset.color}
                              />
                            </div>
                            <div>
                              <div className="flex items-baseline gap-1.5">
                                <span className="font-bold text-xs text-neutral-900">
                                  {preset.name}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                                  preset.isExtreme 
                                    ? 'bg-rose-100 text-rose-700 font-bold border border-rose-200' 
                                    : 'bg-neutral-200/60 text-neutral-600'
                                }`}>
                                  {preset.isExtreme ? '⚠️ 极端气象 (低概率)' : preset.categoryLabel}
                                </span>
                              </div>
                              <span className="text-[10px] text-neutral-500 block mt-0.5 font-light">
                                {preset.summary}
                              </span>
                            </div>
                          </div>

                          {/* 右侧：设为当前按钮 */}
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateSettings({ 
                                currentWeatherId: preset.id,
                                showWeatherCard: true 
                              });
                              setWeatherToast(`已将「${preset.name}」设为当前桌面天气！返回主界面即可查看效果。`);
                              setTimeout(() => setWeatherToast(null), 3500);
                            }}
                            className={`shrink-0 px-2 py-1 rounded-xl text-[10px] font-bold cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-amber-500 text-white shadow-2xs'
                                : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-100'
                            }`}
                          >
                            {isSelected ? '展示中' : '测试设为当前'}
                          </button>
                        </div>

                        {/* 梦角寄语 */}
                        <div className="mt-2 pt-2 border-t border-neutral-200/50 flex flex-col gap-1">
                          <p className="text-[10px] text-neutral-600 font-light leading-relaxed">
                            <strong className="font-medium text-pink-600">梦角絮语：</strong>
                            “{preset.companionQuote}”
                          </p>

                          <div className="flex items-center justify-between text-[9px] text-neutral-400 pt-0.5">
                            <span>适用季节：{preset.seasonLabel}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-neutral-500">
                                抽取概率：{preset.probabilityLabel}
                              </span>
                              <span className={isSeasonal ? 'text-emerald-600 font-medium' : 'text-neutral-400'}>
                                {isSeasonal ? `(当季)` : `(非当季)`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 3: SYSTEM, KEEP-ALIVE & BACKUP --- */}
        {activeTab === 'system' && (
          <div className="space-y-3.5">
            {/* Toast prompt */}
            {notificationToast && (
              <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/90 backdrop-blur-md text-white text-xs px-3.5 py-2 rounded-2xl shadow-xl animate-fade-in border border-white/10 pointer-events-none">
                {notificationToast}
              </div>
            )}

            {/* PWA 桌面 / 手机 App 安装入口 */}
            <PWAInstallButton />

            {/* 1. 强制全屏模式开关（默认开启） */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-medium text-neutral-800">
                  <Maximize2 className="w-4 h-4 text-neutral-800" />
                  <span>强制全屏模式</span>
                  <span className="text-[10px] text-neutral-400 font-mono bg-neutral-100 px-1.5 py-0.5 rounded">
                    默认关闭
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleForceFullscreen}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                    settings.forceFullscreen !== false ? 'bg-neutral-900' : 'bg-neutral-200'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.forceFullscreen !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <p className="text-[11px] text-neutral-500 leading-relaxed">
                隐藏浏览器地址栏与导航栏，获得沉浸式小手机全屏体验。开启后，任意点击或操作屏幕将自动全屏。
              </p>

              {/* 全屏状态与手动触发 */}
              <div className="flex items-center justify-between pt-1 border-t border-neutral-100 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-400">当前状态：</span>
                  {isFullscreen ? (
                    <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                      ● 已处于全屏模式
                    </span>
                  ) : (
                    <span className="text-neutral-500 font-medium bg-neutral-100 px-2 py-0.5 rounded-full text-[10px]">
                      ● 未全屏 / 待手势触发
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleManualFullscreenTrigger}
                  className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-[10px] font-medium transition-colors cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1"
                >
                  {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                  <span>{isFullscreen ? '退出全屏' : '立即尝试全屏'}</span>
                </button>
              </div>

              {/* 免责声明提示卡片 */}
              <div className="p-2.5 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[10px] text-amber-800 leading-relaxed space-y-1">
                <div className="font-semibold flex items-center gap-1 text-amber-900">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>免责声明</span>
                </div>
                <p>
                  受限于不同浏览器（如部分 iOS Safari、微信或特定移动端系统安全策略），可能有的浏览器没有办法全屏或隐藏导航栏。
                </p>
              </div>
            </div>

            {/* Background Notification (后台通知) */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-medium text-neutral-800">
                  <Bell className="w-4 h-4 text-pink-500" />
                  <span>后台通知</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleNotifications}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                    settings.backgroundNotifications ? 'bg-neutral-900' : 'bg-neutral-200'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.backgroundNotifications ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <p className="text-[11px] text-neutral-500 leading-relaxed">
                开启后，当角色在后台产生新消息且应用处于后台时，尽可能发送系统桌面通知，展示角色昵称与消息摘要；点击通知可直接进入与该角色的聊天页面。避免重复通知；当正在查看对应聊天时不会多余发送。
              </p>

              {/* 权限状态与操作条 */}
              <div className="flex items-center justify-between pt-1 border-t border-neutral-100 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-400">权限状态：</span>
                  {notificationPerm === 'granted' ? (
                    <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                      ● 已授权
                    </span>
                  ) : notificationPerm === 'denied' ? (
                    <span className="text-rose-600 font-medium bg-rose-50 px-2 py-0.5 rounded-full text-[10px]">
                      ● 已拒绝 (需在浏览器设置中开启)
                    </span>
                  ) : notificationPerm === 'unsupported' ? (
                    <span className="text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full text-[10px]">
                      ● 浏览器不支持
                    </span>
                  ) : (
                    <span className="text-neutral-500 font-medium bg-neutral-100 px-2 py-0.5 rounded-full text-[10px]">
                      ● 未授权 (开启时将申请)
                    </span>
                  )}
                </div>

                {notificationPerm === 'granted' && settings.backgroundNotifications && (
                  <button
                    type="button"
                    onClick={handleTestNotification}
                    className="px-2.5 py-1 bg-pink-50 text-pink-600 hover:bg-pink-100 border border-pink-200/60 rounded-xl text-[10px] font-medium transition-colors cursor-pointer active:scale-95 shadow-2xs"
                  >
                    测试发送通知
                  </button>
                )}
              </div>

              {/* 免责声明 */}
              <div className="p-2.5 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[10px] text-amber-800 leading-relaxed space-y-1">
                <div className="font-semibold flex items-center gap-1 text-amber-900">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>免责声明</span>
                </div>
                <p>
                  受限于不同手机机型、省电策略、操作系统后台机制及部分移动端浏览器环境（如 iOS Safari 或部分限制严格的浏览器后台挂起策略），该功能可能无法在所有机型上正常持续应用。建议配合下方的【后台保活模式】一同开启以获得更佳体验。
                </p>
              </div>
            </div>

            {/* Background Keep-Alive */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-medium text-neutral-800">
                  <Volume2 className="w-4 h-4 text-neutral-600" />
                  <span>后台保活模式</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleKeepAlive}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                    settings.keepAliveAudio ? 'bg-neutral-900' : 'bg-neutral-200'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.keepAliveAudio ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                利用静音音频 API 保持网页后台心跳，尽可能提高后台存活率，无用户可听声音，可随时关闭。
              </p>
              {keepAliveActive && (
                <span className="inline-block text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                  ● 静音音频引擎正在运行
                </span>
              )}
            </div>

            {/* --- 整体备份、模块备份与恢复（可收纳栏） --- */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div 
                onClick={() => setIsBackupSectionExpanded(prev => !prev)}
                className="flex items-center justify-between cursor-pointer select-none group"
              >
                <div className="flex items-center gap-1.5 font-medium text-neutral-800">
                  <Archive className="w-4 h-4 text-pink-500" />
                  <span>整体与模块备份及恢复</span>
                  <span className="text-[10px] text-neutral-400 font-mono bg-neutral-100 px-1.5 py-0.5 rounded">v2.0</span>
                </div>
                <div className="flex items-center gap-1 text-neutral-400 group-hover:text-neutral-700 transition-colors">
                  <span className="text-[11px] font-medium">{isBackupSectionExpanded ? '收起' : '展开'}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isBackupSectionExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>

              {!isBackupSectionExpanded && (
                <p 
                  onClick={() => setIsBackupSectionExpanded(true)}
                  className="text-[11px] text-neutral-500 leading-relaxed cursor-pointer hover:text-neutral-700"
                >
                  支持完整备份（全量7大核心模块）与单独模块按需导出/合并/覆盖恢复，点击展开管理。
                </p>
              )}

              {/* 隐藏的文件上传 input */}
              <input
                type="file"
                ref={backupInputRef}
                accept=".json"
                onChange={handleSelectBackupFile}
                className="hidden"
              />

              {isBackupSectionExpanded && (
                <div className="space-y-3 pt-1 border-t border-neutral-100 animate-fade-in">
                  {/* 子选项卡：完整备份 / 模块单独备份 */}
                  <div className="flex bg-neutral-100 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setBackupSubTab('full')}
                  className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    backupSubTab === 'full'
                      ? 'bg-white text-neutral-900 shadow-2xs'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>完整备份 (全量7大模块)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBackupSubTab('modules')}
                  className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    backupSubTab === 'modules'
                      ? 'bg-white text-neutral-900 shadow-2xs'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                  <span>单独模块备份 (按需管理)</span>
                </button>
              </div>

              {/* 子选项卡 1：完整备份 */}
              {backupSubTab === 'full' && (
                <div className="space-y-3 animate-fade-in">
                  <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-[11px] text-neutral-600 leading-relaxed space-y-1">
                    <p className="font-medium text-neutral-800">
                      全局完整备份说明（全量保存）：
                    </p>
                    <p>
                      涵盖小手机所有 7 大模块全部东西！包括主界面头像/桌面壁纸/设置，聊天的背景图/气泡样式与CSS/字体提示音/字卡库/分组/表情包/拍一拍及记录，朋友圈封面背景/头像/动态/专属图片库，信件、陪伴、健康睡眠经期、记账等，二进制资源统一哈希去重打包，导入零丢失。
                    </p>
                  </div>

                  {/* 本地 7 大模块数据概览 */}
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    {ALL_BACKUP_MODULES.map(m => {
                      const st = moduleStats[m];
                      return (
                        <div
                          key={m}
                          className="p-2 bg-neutral-50/80 rounded-xl border border-neutral-100 flex items-center justify-between"
                        >
                          <span className="text-neutral-600 font-medium">{MODULE_NAMES[m]}</span>
                          <span className="text-neutral-400 font-mono text-[9px]">
                            {st?.summary || '0条'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 整体备份操作按钮 */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleExport('all')}
                      className="flex-1 py-2.5 px-3 bg-neutral-900 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-neutral-800 active:scale-95 transition-all shadow-2xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-pink-400" />
                      <span>导出全部数据包</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => backupInputRef.current?.click()}
                      className="flex-1 py-2.5 px-3 border border-neutral-300 rounded-xl text-xs font-medium text-neutral-700 hover:bg-neutral-50 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5 text-neutral-500" />
                      <span>导入恢复数据包</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 子选项卡 2：模块单独备份 */}
              {backupSubTab === 'modules' && (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between p-2.5 bg-sky-50/70 border border-sky-200/60 rounded-xl text-[11px] text-sky-800 leading-relaxed">
                    <div className="space-y-0.5">
                      <p className="font-medium text-sky-900">按模块灵活导出与导入：</p>
                      <p className="text-[10px] text-sky-700">
                        模块备份具备严格隔离性，导入任一模块时不会意外覆盖其他模块。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => backupInputRef.current?.click()}
                      className="px-2.5 py-1.5 bg-white text-sky-700 border border-sky-300 rounded-lg text-xs font-medium shrink-0 ml-2 hover:bg-sky-100/50 flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-2xs"
                    >
                      <Upload className="w-3 h-3" />
                      <span>导入模块文件</span>
                    </button>
                  </div>

                  {/* 7 大模块逐项列表 */}
                  <div className="space-y-2">
                    {ALL_BACKUP_MODULES.map(m => {
                      const st = moduleStats[m];
                      return (
                        <div
                          key={m}
                          className="p-2.5 bg-neutral-50/80 rounded-xl border border-neutral-200/60 flex items-center justify-between gap-2"
                        >
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {m === 'chat' && <MessageSquare className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                              {m === 'moments' && <ImageIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                              {m === 'mailbox' && <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                              {m === 'companion' && <HeartHandshake className="w-3.5 h-3.5 text-pink-500 shrink-0" />}
                              {m === 'health' && <Moon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                              {m === 'ledger' && <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                              {m === 'reading' && <BookOpen className="w-3.5 h-3.5 text-amber-700 shrink-0" />}
                              {m === 'settings' && <SettingsIcon className="w-3.5 h-3.5 text-neutral-600 shrink-0" />}
                              <span className="text-xs font-medium text-neutral-800">
                                {MODULE_NAMES[m]}
                              </span>
                              <span className="text-[10px] text-neutral-400 bg-white px-1.5 py-0.5 rounded border border-neutral-200/50 font-mono">
                                {st?.summary || '0条'}
                              </span>
                            </div>
                            <p className="text-[10px] text-neutral-500 truncate">
                              {m === 'chat' && '含聊天记录、聊天背景/遮罩度、气泡样式与CSS、字卡与分组、表情包、拍一拍'}
                              {m === 'moments' && '含朋友圈背景封面/头像/昵称、动态、发帖频率与设置、角色图片库'}
                              {m === 'mailbox' && '含往来信件、信件草稿、信箱背景与设置'}
                              {m === 'companion' && '含历史陪伴记录、自定义事项、当前会话'}
                              {m === 'health' && '含睡眠时长与打卡、经期与痛经记录'}
                              {m === 'ledger' && '含记账流水明细、自定义收支分类'}
                              {m === 'reading' && '含在架书籍、更新周期设置、向梦角推荐的待读书单、阅读偏好标签'}
                              {m === 'settings' && '含主界面头像、桌面壁纸/遮罩、主题外观、天气预设、系统设置'}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleExport([m])}
                            className="px-2.5 py-1.5 bg-white text-neutral-700 hover:text-neutral-900 border border-neutral-200 rounded-lg text-xs font-medium shrink-0 flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-2xs hover:bg-neutral-100"
                          >
                            <Download className="w-3 h-3 text-neutral-500" />
                            <span>导出</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
                </div>
              )}
            </div>

            {/* --- 使用说明（必读）（可收纳栏） --- */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-2.5">
              <div 
                onClick={() => setIsNoticeSectionExpanded(prev => !prev)}
                className="flex items-center justify-between cursor-pointer select-none group"
              >
                <div className="flex items-center gap-1.5 font-medium text-neutral-800">
                  <BookOpen className="w-4 h-4 text-neutral-700" />
                  <span>使用说明（必读）</span>
                  <span className="text-[10px] text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded font-medium">必读声明</span>
                </div>
                <div className="flex items-center gap-1 text-neutral-400 group-hover:text-neutral-700 transition-colors">
                  <span className="text-[11px] font-medium">{isNoticeSectionExpanded ? '收起' : '展开'}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isNoticeSectionExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>

              {!isNoticeSectionExpanded && (
                <p 
                  onClick={() => setIsNoticeSectionExpanded(true)}
                  className="text-[11px] text-neutral-500 leading-relaxed cursor-pointer hover:text-neutral-700"
                >
                  欢迎使用 Ananke字卡。包含制作版权说明、免责声明、破除迷信及备份警示，点击展开阅读。
                </p>
              )}

              {isNoticeSectionExpanded && (
                <div className="space-y-3 pt-2 border-t border-neutral-100 animate-fade-in">
                  <AnankeNoticeContent />
                  {onOpenNoticeModal && (
                    <button
                      type="button"
                      onClick={onOpenNoticeModal}
                      className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-medium transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-neutral-500" />
                      <span>以开屏必读弹窗重新查看</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Reset */}
            <div className="pt-2">
              {showResetConfirm ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex flex-col items-center gap-2">
                  <span className="text-[11px] text-red-700 font-medium text-center">
                    确认恢复出厂设置吗？本地字卡和修改将被清空并恢复默认。
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        StorageService.resetToDefault();
                        window.location.reload();
                      }}
                      className="px-3 py-1 bg-red-600 text-white rounded-xl text-xs font-medium hover:bg-red-700 active:scale-95 transition-all"
                    >
                      确认清空恢复
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      className="px-3 py-1 bg-white border border-neutral-300 text-neutral-700 rounded-xl text-xs font-medium hover:bg-neutral-50"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="w-full py-2 text-center text-xs text-red-500 hover:text-red-700 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>恢复出厂设置并清空数据</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- 弹窗 1：导出成功结果与文件信息 --- */}
      {exportResultInfo && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 border border-neutral-200/80 shadow-2xl space-y-3.5">
            <div className="flex items-center gap-2 pb-1 border-b border-neutral-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-neutral-800">备份文件已生成并导出</h3>
                <p className="text-[10px] text-neutral-400">已自动触发浏览器本地下载</p>
              </div>
            </div>

            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100 space-y-2 text-xs">
              <div className="flex justify-between items-center text-neutral-600">
                <span className="text-neutral-400">备份文件名：</span>
                <span className="font-mono text-[11px] font-medium text-neutral-800 truncate max-w-[190px]">
                  {exportResultInfo.fileName}
                </span>
              </div>
              <div className="flex justify-between items-center text-neutral-600">
                <span className="text-neutral-400">文件大小：</span>
                <span className="font-mono font-medium text-neutral-800">
                  {exportResultInfo.fileSizeStr}
                </span>
              </div>
              <div className="flex justify-between items-center text-neutral-600">
                <span className="text-neutral-400">备份格式版本：</span>
                <span className="font-mono text-neutral-800">
                  v{exportResultInfo.meta.formatVersion || '2.0.0'}
                </span>
              </div>
              <div className="flex justify-between items-center text-neutral-600">
                <span className="text-neutral-400">导出时间：</span>
                <span className="font-mono text-[11px] text-neutral-800">
                  {exportResultInfo.meta.exportedAtStr || new Date(exportResultInfo.meta.exportedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-neutral-600">
                <span className="text-neutral-400">打包二进制资源：</span>
                <span className="font-medium text-emerald-600">
                  {exportResultInfo.meta.assetCount} 个（已哈希去重）
                </span>
              </div>
              <div className="pt-1.5 border-t border-neutral-200/50 space-y-1">
                <span className="text-[11px] text-neutral-500 font-medium block">包含模块及条目统计：</span>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  {exportResultInfo.meta.modules.map((modKey: BackupModuleType) => (
                    <div key={modKey} className="text-neutral-600 flex justify-between bg-white px-1.5 py-0.5 rounded border border-neutral-100">
                      <span>{MODULE_NAMES[modKey]}</span>
                      <span className="font-mono text-neutral-500">
                        {exportResultInfo.meta.itemCounts?.[modKey] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExportResultInfo(null)}
              className="w-full py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer"
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {/* --- 弹窗 2：导入前校验失败提示 --- */}
      {validationErrors && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 border border-rose-200 shadow-2xl space-y-3.5">
            <div className="flex items-center gap-2 pb-1 border-b border-neutral-100">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-neutral-800">备份文件校验未通过</h3>
                <p className="text-[10px] text-rose-600">为保护当前数据安全，已中止导入，未修改任何数据</p>
              </div>
            </div>

            <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200/60 max-h-48 overflow-y-auto space-y-1.5 text-xs text-rose-800">
              {validationErrors.map((err, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-rose-500 font-bold shrink-0">•</span>
                  <span className="text-[11px] leading-relaxed">{err}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setValidationErrors(null)}
              className="w-full py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* --- 弹窗 3：导入前校验通过确认与模式选择 --- */}
      {pendingImportPkg && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 border border-neutral-200/80 shadow-2xl space-y-3.5">
            <div className="flex items-center gap-2 pb-1 border-b border-neutral-100">
              <FileCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-neutral-800">
                  {pendingImportPkg.meta.backupType === 'full' ? '识别到【完整备份】' : '识别到【模块备份】'}
                </h3>
                <p className="text-[10px] text-neutral-400">已完成数据结构与字段类型安全校验</p>
              </div>
            </div>

            {/* 备份文件信息详情 */}
            <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-neutral-600">
                <span className="text-neutral-400">导出时间：</span>
                <span className="font-mono text-neutral-800">
                  {pendingImportPkg.meta.exportedAtStr || new Date(pendingImportPkg.meta.exportedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span className="text-neutral-400">包含模块：</span>
                <span className="font-medium text-neutral-800">
                  {pendingImportPkg.meta.modules.map(m => MODULE_NAMES[m]).join('、')}
                </span>
              </div>
              {pendingImportPkg.meta.assetCount > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span className="text-neutral-400">打包资源：</span>
                  <span className="text-emerald-600 font-medium">
                    {pendingImportPkg.meta.assetCount} 个独立资源
                  </span>
                </div>
              )}
            </div>

            {/* 导入模式选择（合并导入 vs 覆盖导入） */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-neutral-700 block">选择导入方式：</span>
              
              <label
                onClick={() => { setImportMode('merge'); setShowOverwriteWarning(false); }}
                className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  importMode === 'merge'
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : 'bg-white border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'merge'}
                  onChange={() => { setImportMode('merge'); setShowOverwriteWarning(false); }}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="space-y-0.5 text-xs">
                  <div className="font-medium text-neutral-800 flex items-center gap-1">
                    <span>合并导入</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">推荐</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 leading-relaxed">
                    保留当前应用中已有数据，仅增量补充新记录；重复或已存在的记录自动跳过。
                  </p>
                </div>
              </label>

              <label
                onClick={() => { setImportMode('overwrite'); setShowOverwriteWarning(false); }}
                className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  importMode === 'overwrite'
                    ? 'bg-rose-50/70 border-rose-300'
                    : 'bg-white border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'overwrite'}
                  onChange={() => { setImportMode('overwrite'); setShowOverwriteWarning(false); }}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div className="space-y-0.5 text-xs">
                  <div className="font-medium text-neutral-800 flex items-center gap-1">
                    <span>覆盖导入</span>
                    <span className="text-[10px] text-rose-700 bg-rose-100/70 px-1.5 py-0.2 rounded">替换</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 leading-relaxed">
                    用备份数据完全替换上述模块的现有记录。仅替换备份中包含的模块，其余未涉及模块完全保留。
                  </p>
                </div>
              </label>
            </div>

            {/* 覆盖确认二次警告 */}
            {showOverwriteWarning && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5 text-xs animate-shake">
                <div className="flex items-center gap-1 font-semibold text-rose-800 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>二次确认：确定执行覆盖？</span>
                </div>
                <p className="text-[10px] text-rose-700 leading-relaxed">
                  该操作将彻底替换当前【{pendingImportPkg.meta.modules.map(m => MODULE_NAMES[m]).join('、')}】的现有数据！
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleConfirmImport(true)}
                    className="flex-1 py-1.5 bg-rose-600 text-white rounded-lg text-[11px] font-medium hover:bg-rose-700 active:scale-95 transition-all"
                  >
                    确认覆盖并导入
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOverwriteWarning(false)}
                    className="flex-1 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-lg text-[11px] font-medium hover:bg-neutral-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {!showOverwriteWarning && (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingImportPkg(null)}
                  className="flex-1 py-2 bg-neutral-100 text-neutral-700 rounded-xl text-xs font-medium hover:bg-neutral-200 active:scale-95 transition-all cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmImport(false)}
                  className={`flex-1 py-2 text-white rounded-xl text-xs font-medium active:scale-95 transition-all cursor-pointer ${
                    importMode === 'overwrite'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-neutral-900 hover:bg-neutral-800'
                  }`}
                >
                  {importMode === 'overwrite' ? '下一步：确认覆盖' : '执行合并导入'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- 弹窗 4：导入后结果与各模块明细报告 --- */}
      {importReport && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 border border-neutral-200/80 shadow-2xl space-y-3.5">
            <div className="flex items-center gap-2 pb-1 border-b border-neutral-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-neutral-800">备份数据导入完成</h3>
                <p className="text-[10px] text-neutral-400">
                  导入方式：{importReport.mode === 'merge' ? '合并导入' : '覆盖导入'} · {importReport.backupType === 'full' ? '完整备份包' : '单独模块备份包'}
                </p>
              </div>
            </div>

            {importReport.error && (
              <div className="p-2 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                {importReport.error}
              </div>
            )}

            {/* 各模块导入、跳过、失败数量列表 */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 text-xs">
              {importReport.results.map((modRes) => (
                <div
                  key={modRes.module}
                  className={`p-2 rounded-xl border flex flex-col gap-1 ${
                    modRes.failedCount > 0
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-neutral-50/80 border-neutral-200/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-neutral-800 text-[11px]">
                      {modRes.moduleName || MODULE_NAMES[modRes.module]}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-emerald-600 font-medium">导入 {modRes.importedCount}</span>
                      {modRes.skippedCount > 0 && (
                        <span className="text-neutral-400">跳过 {modRes.skippedCount}</span>
                      )}
                      {modRes.failedCount > 0 && (
                        <span className="text-rose-600 font-medium">失败 {modRes.failedCount}</span>
                      )}
                    </div>
                  </div>
                  {modRes.details && (
                    <p className="text-[10px] text-neutral-500 leading-relaxed">
                      {modRes.details}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setImportReport(null)}
              className="w-full py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer"
            >
              完成
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

