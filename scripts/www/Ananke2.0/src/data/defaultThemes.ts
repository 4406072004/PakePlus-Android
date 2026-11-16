export interface ColorTheme {
  id: string;
  name: string;
  primary: string;
  accent: string;
  bgGradient: string;
  cardBg: string;
  textPrimary: string;
  textMuted: string;
  borderColor: string;
  topCardDefaultBg: string;
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'monochrome',
    name: '极简黑白灰 (初始默认)',
    primary: '#18181b', // neutral-900
    accent: '#52525b', // neutral-600
    bgGradient: '#f4f4f5', // neutral-100
    cardBg: '#ffffff',
    textPrimary: '#18181b',
    textMuted: '#71717a',
    borderColor: '#e4e4e7',
    topCardDefaultBg: '#ffffff',
  },
  {
    id: 'misty-blue',
    name: '雾霾灰蓝 (清幽克制)',
    primary: '#334155', // slate-700
    accent: '#64748b',
    bgGradient: '#e2e8f0',
    cardBg: '#f8fafc',
    textPrimary: '#1e293b',
    textMuted: '#64748b',
    borderColor: '#cbd5e1',
    topCardDefaultBg: '#ffffff',
  },
  {
    id: 'sage-green',
    name: '豆沙灰绿 (温润草木)',
    primary: '#3f4f44',
    accent: '#687864',
    bgGradient: '#e8ece9',
    cardBg: '#f6f7f6',
    textPrimary: '#2d372e',
    textMuted: '#738074',
    borderColor: '#d2dad4',
    topCardDefaultBg: '#ffffff',
  },
  {
    id: 'warm-almond',
    name: '浅杏暖灰 (柔和静谧)',
    primary: '#44403c', // stone-700
    accent: '#78716c',
    bgGradient: '#f5f5f4',
    cardBg: '#fafaf9',
    textPrimary: '#292524',
    textMuted: '#78716c',
    borderColor: '#e7e5e4',
    topCardDefaultBg: '#ffffff',
  },
  {
    id: 'mauve-twilight',
    name: '暮色紫灰 (低饱和暗香)',
    primary: '#4c424d',
    accent: '#776b79',
    bgGradient: '#eeeaf0',
    cardBg: '#faf8fa',
    textPrimary: '#372f38',
    textMuted: '#7c737f',
    borderColor: '#ded8df',
    topCardDefaultBg: '#ffffff',
  },
  {
    id: 'oatmeal-sand',
    name: '燕麦米褐 (自然纸韵)',
    primary: '#4d4639',
    accent: '#7e7362',
    bgGradient: '#edebe6',
    cardBg: '#fbfaf8',
    textPrimary: '#383329',
    textMuted: '#807769',
    borderColor: '#dedbd2',
    topCardDefaultBg: '#ffffff',
  },
];

export interface WallpaperPreset {
  id: string;
  name: string;
  value: string; // CSS background or image url
  isImage?: boolean;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  { id: 'mono_pure', name: '极简纯灰', value: '#ececec' },
  { id: 'mono_white', name: '素雅原白', value: '#f7f7f8' },
  { id: 'mono_cool', name: '冷灰微光', value: 'linear-gradient(180deg, #e5e7eb 0%, #d1d5db 100%)' },
  { id: 'mist_dusk', name: '雾蓝微染', value: 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)' },
  { id: 'warm_paper', name: '暖调棉纸', value: 'linear-gradient(180deg, #f5f5f4 0%, #e7e5e4 100%)' },
  { id: 'sage_leaf', name: '灰绿微风', value: 'linear-gradient(180deg, #e3e8e4 0%, #d5ded7 100%)' },
  { id: 'soft_mauve', name: '淡紫薄暮', value: 'linear-gradient(180deg, #eae5ea 0%, #dfd7e0 100%)' },
  { id: 'grain_mesh', name: '素雅浅织', value: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%)' },
];

export const CARD_BG_PRESETS: WallpaperPreset[] = [
  { id: 'card_white', name: '经典纯白', value: '#ffffff' },
  { id: 'card_warm', name: '浅暖素白', value: '#fafaf9' },
  { id: 'card_slate', name: '冰川淡青', value: '#f8fafc' },
  { id: 'card_grain', name: '极淡柔粉', value: 'linear-gradient(135deg, #ffffff 0%, #fff5f5 100%)' },
  { id: 'card_lavender', name: '淡熏衣草', value: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)' },
  { id: 'card_sage', name: '浅草淡绿', value: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)' },
  { id: 'card_gradient_clean', name: '晨曦轻烟', value: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)' },
];
