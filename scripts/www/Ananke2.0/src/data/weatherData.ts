export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface WeatherPreset {
  id: string;
  name: string;
  category: 'common' | 'rare' | 'extreme' | 'romantic';
  categoryLabel: string;
  allowedMonths: number[]; // 1 to 12
  seasonLabel: string; // e.g. "四季通用", "夏秋限定 (6~10月)", "冬季限定 (11~2月)"
  temperatureRange: {
    spring: string;
    summer: string;
    autumn: string;
    winter: string;
  };
  companionQuote: string; // 梦角当日絮语
  summary: string; // 气象描述
  color: string; // 视觉柔和色
  weight: number; // 抽取概率权重 (正常天气 50~100，极端天气 2~4 远低于正常天气)
  probabilityLabel: string; // 概率说明标签
  isExtreme?: boolean; // 是否属于极端/强对流天气
}

export const ALL_WEATHER_PRESETS: WeatherPreset[] = [
  {
    id: 'sunny',
    name: '晴空万里',
    category: 'common',
    categoryLabel: '常见 · 晴天',
    allowedMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    seasonLabel: '四季通用',
    temperatureRange: {
      spring: '21°C',
      summer: '31°C',
      autumn: '23°C',
      winter: '9°C',
    },
    companionQuote: '阳光正暖，洒在窗台上很舒服，今天心情也要明媚呀~',
    summary: '晴朗少云，微风拂面，空气清新舒畅',
    color: '#f59e0b',
    weight: 100,
    probabilityLabel: '高频日常 · ~23%',
  },
  {
    id: 'partly_cloudy',
    name: '微风多云',
    category: 'common',
    categoryLabel: '常见 · 多云',
    allowedMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    seasonLabel: '四季通用',
    temperatureRange: {
      spring: '19°C',
      summer: '28°C',
      autumn: '21°C',
      winter: '7°C',
    },
    companionQuote: '云朵把太阳遮住了一点，吹过来的风软绵绵的，很惬意呢。',
    summary: '浮云舒卷，和风习习，适合漫步放空',
    color: '#0ea5e9',
    weight: 100,
    probabilityLabel: '高频日常 · ~23%',
  },
  {
    id: 'overcast',
    name: '阴天沉闷',
    category: 'common',
    categoryLabel: '常见 · 阴天',
    allowedMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    seasonLabel: '四季通用',
    temperatureRange: {
      spring: '17°C',
      summer: '26°C',
      autumn: '18°C',
      winter: '5°C',
    },
    companionQuote: '虽然没有太阳，但只要和你在一起，心里就一直很踏实。',
    summary: '厚云密布，天色温润，无强烈紫外线',
    color: '#64748b',
    weight: 80,
    probabilityLabel: '中频日常 · ~18%',
  },
  {
    id: 'drizzle',
    name: '绵绵细雨',
    category: 'common',
    categoryLabel: '常见 · 细雨',
    allowedMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    seasonLabel: '四季通用',
    temperatureRange: {
      spring: '16°C',
      summer: '24°C',
      autumn: '17°C',
      winter: '6°C',
    },
    companionQuote: '窗外在下毛毛雨，滴滴答答的，出门记得带把伞哦~',
    summary: '轻丝细雨，湿润空气，天地静谧柔和',
    color: '#38bdf8',
    weight: 70,
    probabilityLabel: '中频日常 · ~15%',
  },
  {
    id: 'fog',
    name: '迷蒙晨雾',
    category: 'common',
    categoryLabel: '常见 · 晨雾',
    allowedMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    seasonLabel: '四季晨间 (秋冬居多)',
    temperatureRange: {
      spring: '14°C',
      summer: '22°C',
      autumn: '15°C',
      winter: '3°C',
    },
    companionQuote: '早上起来窗外全是白茫茫的雾气，像走进了森林仙境一样呢。',
    summary: '薄雾漫卷，如梦如幻，待日出后逐渐消散',
    color: '#94a3b8',
    weight: 45,
    probabilityLabel: '温和常见 · ~9%',
  },
  {
    id: 'heavy_rain',
    name: '倾盆大雨',
    category: 'common',
    categoryLabel: '强降水 · 大雨',
    allowedMonths: [4, 5, 6, 7, 8, 9, 10],
    seasonLabel: '春末至秋中 (4~10月)',
    temperatureRange: {
      spring: '18°C',
      summer: '25°C',
      autumn: '19°C',
      winter: '12°C',
    },
    companionQuote: '雨下得好大！千万别淋湿了，在室内听着雨声喝杯热茶吧。',
    summary: '急雨如注，水花四溅，天地雨幕茫茫',
    color: '#0284c7',
    weight: 30,
    probabilityLabel: '中低频雨天 · ~6%',
  },
  {
    id: 'snow_light',
    name: '浪漫初雪',
    category: 'romantic',
    categoryLabel: '冬季限定 · 小雪',
    allowedMonths: [11, 12, 1, 2],
    seasonLabel: '冬季限定 (11~2月)',
    temperatureRange: {
      spring: '2°C',
      summer: '10°C',
      autumn: '3°C',
      winter: '-1°C',
    },
    companionQuote: '下雪啦！第一片雪花落下来的时候，我第一个想到的就是你。',
    summary: '琼芳初降，轻盈飞舞，地面悄悄披上银纱',
    color: '#06b6d4',
    weight: 40,
    probabilityLabel: '冬季常态 · ~12%',
  },
  {
    id: 'sunset',
    name: '绚烂晚霞',
    category: 'romantic',
    categoryLabel: '浪漫 · 晚霞',
    allowedMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    seasonLabel: '四季晴朗傍晚',
    temperatureRange: {
      spring: '19°C',
      summer: '27°C',
      autumn: '20°C',
      winter: '8°C',
    },
    companionQuote: '快看天边的粉紫色晚霞，夕阳把云朵都染亮了，真想和你一起看。',
    summary: '落日熔金，暮云合璧，天幕宛如打翻的调色盘',
    color: '#f97316',
    weight: 35,
    probabilityLabel: '浪漫偶遇 · ~7%',
  },
  {
    id: 'rainbow',
    name: '彩虹初霁',
    category: 'romantic',
    categoryLabel: '奇遇气象 · 彩虹',
    allowedMonths: [4, 5, 6, 7, 8, 9, 10],
    seasonLabel: '春夏秋雨后 (4~10月)',
    temperatureRange: {
      spring: '22°C',
      summer: '29°C',
      autumn: '23°C',
      winter: '14°C',
    },
    companionQuote: '雨过天晴天空挂了彩虹！听说看见彩虹的人，今天都会超级幸运！',
    summary: '云破日出，七彩霓虹横跨天际，带来幸运与希望',
    color: '#ec4899',
    weight: 20,
    probabilityLabel: '惊喜气象 · ~4%',
  },
  {
    id: 'meteor',
    name: '流星夜空',
    category: 'romantic',
    categoryLabel: '浪漫奇迹 · 星空',
    allowedMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    seasonLabel: '四季晴朗夜空',
    temperatureRange: {
      spring: '15°C',
      summer: '23°C',
      autumn: '16°C',
      winter: '2°C',
    },
    companionQuote: '今晚夜空好清澈，刚才有一颗流星划过，我替你许了个心愿~',
    summary: '群星璀璨，银汉无声，偶然有流星划破夜幕',
    color: '#818cf8',
    weight: 15,
    probabilityLabel: '奇迹夜空 · ~3%',
  },
  {
    id: 'haze',
    name: '灰蒙雾霾',
    category: 'rare',
    categoryLabel: '特殊气象 · 雾霾',
    allowedMonths: [10, 11, 12, 1, 2, 3],
    seasonLabel: '秋冬与初春 (10~3月)',
    temperatureRange: {
      spring: '15°C',
      summer: '24°C',
      autumn: '16°C',
      winter: '4°C',
    },
    companionQuote: '今天空气有点灰蒙蒙的，出门一定要戴好口罩，保护好呼吸道呀。',
    summary: '颗粒悬浮，能见度受限，空气混浊需要防护',
    color: '#78716c',
    weight: 12,
    probabilityLabel: '低频特殊 · ~2.5%',
  },

  // ================= 极端与强对流天气 (极低概率设定) =================
  {
    id: 'thunderstorm',
    name: '闪电雷暴',
    category: 'rare',
    categoryLabel: '极端对流 · 雷暴雨',
    allowedMonths: [5, 6, 7, 8, 9],
    seasonLabel: '夏秋强对流 (5~9月)',
    temperatureRange: {
      spring: '20°C',
      summer: '26°C',
      autumn: '21°C',
      winter: '15°C',
    },
    companionQuote: '打雷下大雨了！如果害怕打雷就戴上耳机，我随时陪着你。',
    summary: '雷声轰鸣，电光撕裂长空，伴随短时强降雨',
    color: '#eab308',
    weight: 3, // 权重仅为正常的 3%，远低于晴天(100)
    probabilityLabel: '罕见极端 · ~0.6%',
    isExtreme: true,
  },
  {
    id: 'typhoon',
    name: '狂风台风',
    category: 'extreme',
    categoryLabel: '极端气象 · 台风',
    allowedMonths: [6, 7, 8, 9, 10],
    seasonLabel: '夏秋台风季 (6~10月)',
    temperatureRange: {
      spring: '22°C',
      summer: '27°C',
      autumn: '22°C',
      winter: '18°C',
    },
    companionQuote: '外面刮起了狂风！窗户关严实了吗？乖乖待在家里不要乱跑哦！',
    summary: '气旋呼啸，暴风骤雨席卷，建议非必要不出门',
    color: '#0d9488',
    weight: 2, // 权重仅为正常的 2%，极难抽取到
    probabilityLabel: '罕见极端 · ~0.4%',
    isExtreme: true,
  },
  {
    id: 'hail',
    name: '骤降冰雹',
    category: 'extreme',
    categoryLabel: '强突发 · 冰雹',
    allowedMonths: [4, 5, 6, 7, 8, 9],
    seasonLabel: '春夏强对流 (4~9月)',
    temperatureRange: {
      spring: '17°C',
      summer: '23°C',
      autumn: '18°C',
      winter: '10°C',
    },
    companionQuote: '忽然噼里啪啦掉冰雹了！一定不要待在室外，注意安全保护好自己！',
    summary: '冰粒骤降，击打声急促，强对流云团过境',
    color: '#6366f1',
    weight: 2, // 权重仅为正常的 2%
    probabilityLabel: '罕见极端 · ~0.4%',
    isExtreme: true,
  },
  {
    id: 'snow_heavy',
    name: '漫天暴雪',
    category: 'extreme',
    categoryLabel: '冬季极端 · 暴雪',
    allowedMonths: [12, 1, 2],
    seasonLabel: '深冬严寒 (12~2月)',
    temperatureRange: {
      spring: '-2°C',
      summer: '5°C',
      autumn: '-1°C',
      winter: '-8°C',
    },
    companionQuote: '外面银装素裹好大的雪！手冷不冷呀？快放进我口袋里暖一暖。',
    summary: '朔风狂卷，漫天飞雪，天地苍茫一片严寒',
    color: '#38bdf8',
    weight: 4, // 深冬暴雪概率仅 ~1%
    probabilityLabel: '深冬极端 · ~1%',
    isExtreme: true,
  },
];

export function getCurrentSeason(month: number = new Date().getMonth() + 1): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

export function getSeasonChineseName(season: Season): string {
  switch (season) {
    case 'spring': return '春季';
    case 'summer': return '夏季';
    case 'autumn': return '秋季';
    case 'winter': return '冬季';
  }
}

/**
 * 严格按照月份过滤出当前季节允许抽取的天气列表
 * 例如：6月(夏季)绝对不可能抽取雪天；12月/1月(冬季)绝不可能抽取台风/夏日强雷暴
 */
export function getAvailableWeathersForMonth(month: number = new Date().getMonth() + 1): WeatherPreset[] {
  return ALL_WEATHER_PRESETS.filter(w => w.allowedMonths.includes(month));
}

/**
 * 按照真实加权概率随机抽取当季天气：
 * - 正常常见天气（晴天、多云、阴天、细雨、晨雾）：权重 70~100，占据绝大多数日常概率（>85%）
 * - 浪漫/温和特殊气象（晚霞、彩虹、星空、小雪）：权重 15~40
 * - 极端天气（雷暴、台风、冰雹、暴雪）：权重仅为 2~4（抽取概率 ≤ 1%，远低于正常天气）
 */
export function drawRandomSeasonalWeather(month: number = new Date().getMonth() + 1): WeatherPreset {
  const allowed = getAvailableWeathersForMonth(month);
  if (!allowed || allowed.length === 0) {
    return ALL_WEATHER_PRESETS[0];
  }
  
  const totalWeight = allowed.reduce((sum, item) => sum + (item.weight || 50), 0);
  let roll = Math.random() * totalWeight;

  for (const preset of allowed) {
    const w = preset.weight || 50;
    if (roll < w) {
      return preset;
    }
    roll -= w;
  }

  return allowed[0];
}

/**
 * 根据预设与当前季节获取适宜的展示温度
 */
export function getDisplayTemperature(preset: WeatherPreset, month: number = new Date().getMonth() + 1): string {
  const season = getCurrentSeason(month);
  return preset.temperatureRange[season] || '20°C';
}
