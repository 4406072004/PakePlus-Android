import { Character, UserProfile, PhoneSettings } from '../types';

export const DEFAULT_USER: UserProfile = {
  name: '我',
  avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=e5e7eb',
  meetDays: 0,
  meetStartDate: '', // 不要预设任何日期，初始相爱日期为0
  quote: '仿佛我们一直以来 就注定要在此相遇',
  quoteBackground: '#ffffff',
  topCardBackground: '#ffffff',
  meetDaysBackground: '#ffffff',
  topCardOpacity: 1.0,
  quoteCardOpacity: 1.0,
  meetDaysOpacity: 1.0,
};

export const DEFAULT_CHARACTER: Character = {
  id: 'char_default',
  name: '梦角',
  nickname: '梦角',
  avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=Aria&backgroundColor=fce7f3',
  bio: '愿所有日子都清澈明朗',
  status: '在线',
};

export const DEFAULT_SETTINGS: PhoneSettings = {
  themeId: 'monochrome',
  accentColor: '#52525b',
  wallpaper: '#ececec',
  wallpaperMask: 0.2, // 主界面底图遮罩度默认 20%
  topCardBg: '#ffffff',
  quoteCardBg: '#ffffff',
  cardOpacity: 1.0,

  // App Icons customization
  iconBgColor: '#ffffff',
  iconOpacity: 0.95,
  iconRadius: 18, // 0 = 方, 18 = 优雅圆角, 999 = 圆形
  iconTextColor: '#27272a',

  // Chat Rules
  stickersEnabled: true,
  emojisEnabled: true,
  emojiMixedMode: true,
  characterRedPacketEnabled: true,
  customRedPacketColor: '#e5e7eb',
  voiceMessageEnabled: false, // 默认关闭（需用户手动开启）
  minimaxApiKey: '',
  minimaxRegion: 'domestic',
  minimaxBaseUrl: 'https://api.minimaxi.com/v1',
  minimaxModel: 'speech-2.8-turbo',
  minimaxVoiceId: '', // 去除预设声音
  minimaxProxyUrl: '',
  minimaxSpeed: 1.0,
  // 大模型 API 设置 (默认硅基流动与免费 Qwen2.5-7B-Instruct 模型)
  aiBaseUrl: 'https://api.siliconflow.cn/v1',
  aiApiKey: '',
  aiModel: 'Qwen/Qwen2.5-7B-Instruct',
  aiProxyUrl: '',
  wereadApiKey: '',
  mergeCards: true,
  readWithoutReply: false,
  forceSleepMode: false,
  minReplyDelaySeconds: 2,
  maxReplyDelaySeconds: 6,
  enableQuoteReply: true,
  proactiveMessageEnabled: false,
  proactiveMessageIntervalMinutes: 15,
  pokeReplyEnabled: true,

  // Bubble Customization
  characterBubbleStyle: {
    bg: '#ffffff',
    textColor: '#262626',
    opacity: 1.0,
    radius: 18,
    customCss: '',
  },
  userBubbleStyle: {
    bg: '#262626',
    textColor: '#ffffff',
    opacity: 1.0,
    radius: 18,
    customCss: '',
  },

  // 聊天美化
  chatBackground: undefined,
  chatBackgroundMask: 0.3, // 默认 30% 减淡遮罩
  chatCustomFontName: undefined,
  messageSound: 'bubble',

  // Weather Card (梦角当日天气模块)
  showWeatherCard: true,
  currentWeatherId: undefined,
  weatherCardBg: '#ffffff',

  // Background Keep Alive & Notifications
  keepAliveAudio: true, // 默认开启静音音频后台挂起保护
  backgroundNotifications: false,
  forceFullscreen: false, // 强制全屏默认关闭
};
