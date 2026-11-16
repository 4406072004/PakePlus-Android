export interface RedPacketColorPreset {
  id: string;
  name: string;
  primaryColor: string; // 主色调 Hex
  bgGradient: string; // 清透简约磨砂渐变
  border: string; // 细边框
  textColor: string; // 标题与金额文字颜色（浅底配深字）
  subTextColor: string; // 次级文字
  badgeBg: string; // 图标半透明背景
  isLight: boolean; // 是否为浅色底
}

/**
 * 极致清透、简约高级的莫兰迪纸感红包预设
 * 采用极高透明度、细腻柔和渐变与极细线条，视觉清爽优雅。
 */
export const RED_PACKET_COLOR_PRESETS: RedPacketColorPreset[] = [
  {
    id: 'pure-snow',
    name: '素雪白',
    primaryColor: '#e5e7eb',
    bgGradient: 'linear-gradient(135deg, rgba(255, 255, 255, 0.85), rgba(243, 244, 246, 0.70))',
    border: 'rgba(209, 213, 219, 0.35)',
    textColor: '#1f2937',
    subTextColor: '#4b5563',
    badgeBg: 'rgba(31, 41, 55, 0.06)',
    isLight: true,
  },
  {
    id: 'airy-pink',
    name: '轻雾粉',
    primaryColor: '#f3e8eb',
    bgGradient: 'linear-gradient(135deg, rgba(253, 242, 245, 0.85), rgba(243, 232, 235, 0.70))',
    border: 'rgba(236, 201, 209, 0.40)',
    textColor: '#5e3a42',
    subTextColor: '#82525c',
    badgeBg: 'rgba(94, 58, 66, 0.06)',
    isLight: true,
  },
  {
    id: 'linen-beige',
    name: '亚麻白',
    primaryColor: '#f7f5f0',
    bgGradient: 'linear-gradient(135deg, rgba(255, 253, 249, 0.85), rgba(247, 245, 240, 0.70))',
    border: 'rgba(226, 221, 213, 0.40)',
    textColor: '#4a4338',
    subTextColor: '#706554',
    badgeBg: 'rgba(74, 67, 56, 0.06)',
    isLight: true,
  },
  {
    id: 'misty-mint',
    name: '清泉绿',
    primaryColor: '#e8f2ee',
    bgGradient: 'linear-gradient(135deg, rgba(240, 249, 245, 0.85), rgba(232, 242, 238, 0.70))',
    border: 'rgba(198, 221, 212, 0.40)',
    textColor: '#2c4a3e',
    subTextColor: '#476e5e',
    badgeBg: 'rgba(44, 74, 62, 0.06)',
    isLight: true,
  },
  {
    id: 'icicle-blue',
    name: '薄冰蓝',
    primaryColor: '#e7edf3',
    bgGradient: 'linear-gradient(135deg, rgba(243, 247, 251, 0.85), rgba(231, 237, 243, 0.70))',
    border: 'rgba(203, 215, 227, 0.40)',
    textColor: '#2e3f52',
    subTextColor: '#4c637a',
    badgeBg: 'rgba(46, 63, 82, 0.06)',
    isLight: true,
  },
  {
    id: 'dawn-peach',
    name: '初雪橘',
    primaryColor: '#f7edeb',
    bgGradient: 'linear-gradient(135deg, rgba(254, 247, 245, 0.85), rgba(247, 237, 235, 0.70))',
    border: 'rgba(235, 211, 207, 0.40)',
    textColor: '#593d38',
    subTextColor: '#7d5953',
    badgeBg: 'rgba(89, 61, 56, 0.06)',
    isLight: true,
  },
];

// 兼容旧预设 ID 映射到新的清透简约色调
const LEGACY_ID_MAP: Record<string, string> = {
  'dusty-pink': 'airy-pink',
  'oat-latte': 'linen-beige',
  'sage-green': 'misty-mint',
  'dusty-blue': 'icicle-blue',
  'dusty-taro': 'airy-pink',
  'warm-greige': 'linen-beige',
  'muted-graphite': 'pure-snow',
  sakura: 'airy-pink',
  gold: 'linen-beige',
  cream: 'linen-beige',
  sky: 'icicle-blue',
  mint: 'misty-mint',
  lavender: 'airy-pink',
  rose: 'airy-pink',
};

export function getRedPacketStyle(colorOrId?: string): RedPacketColorPreset {
  if (!colorOrId) return RED_PACKET_COLOR_PRESETS[0];

  const mappedId = LEGACY_ID_MAP[colorOrId] || colorOrId;

  const found = RED_PACKET_COLOR_PRESETS.find(
    p => p.id === mappedId || p.primaryColor.toLowerCase() === colorOrId.toLowerCase()
  );
  if (found) return found;

  // 如果传入自定义 hex，生成清透简约磨砂样式
  const hex = colorOrId.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 240;
  const g = parseInt(hex.substring(2, 4), 16) || 240;
  const b = parseInt(hex.substring(4, 6), 16) || 240;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  const isLight = brightness > 140;

  return {
    id: 'custom',
    name: '清透雅致',
    primaryColor: colorOrId,
    bgGradient: `linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.85), rgba(${Math.max(0, r - 15)}, ${Math.max(0, g - 15)}, ${Math.max(0, b - 15)}, 0.70))`,
    border: `rgba(${r}, ${g}, ${b}, 0.4)`,
    textColor: isLight ? '#222222' : '#ffffff',
    subTextColor: isLight ? '#555555' : 'rgba(255, 255, 255, 0.85)',
    badgeBg: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.15)',
    isLight,
  };
}
