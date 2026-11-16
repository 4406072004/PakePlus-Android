import { Book } from '../types';

/**
 * 20 本经典真实书籍预设库 (用于断网、API 响应慢、API 查无此书时的坚实兜底)
 */
export const DEFAULT_CLASSIC_BOOKS: Book[] = [
  {
    id: 'book_preset_1',
    title: '小王子',
    author: '安托万·德·圣-埃克苏佩里',
    coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 1943,
    description: '真正重要的东西，用眼睛是看不见的，唯有用心才能看清。'
  },
  {
    id: 'book_preset_2',
    title: '百年孤独',
    author: '加夫列尔·加西亚·马尔克斯',
    coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 1967,
    description: '马孔多在下雨，布恩迪亚家族七代人在时间的长河中穿行与沉思。'
  },
  {
    id: 'book_preset_3',
    title: '月亮与六便士',
    author: '威廉·萨默塞特·毛姆',
    coverUrl: 'https://images.unsplash.com/photo-1532012164546-f432f2e37274?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 1919,
    description: '满地都是六便士，他却抬头看见了月亮。'
  },
  {
    id: 'book_preset_4',
    title: '解忧杂货店',
    author: '东野圭吾',
    coverUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 2012,
    description: '投进卷帘门投信口的每一封信，都在深夜得到了温暖的回音。'
  },
  {
    id: 'book_preset_5',
    title: '悉达多',
    author: '赫尔曼·黑塞',
    coverUrl: 'https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 1922,
    description: '在静淌的河水边，倾听万物合一的心声与自性的觉醒。'
  },
  {
    id: 'book_preset_6',
    title: '被讨厌的勇气',
    author: '岸见一郎 / 古贺史健',
    coverUrl: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 2013,
    description: '课题分离，拥有被讨厌的勇气，才能获得真正的自由与自洽。'
  },
  {
    id: 'book_preset_7',
    title: '杀死一只知更鸟',
    author: '哈珀·李',
    coverUrl: 'https://images.unsplash.com/photo-1495640388908-05fa85288e61?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 1960,
    description: '你永远不可能真正了解一个人，除非你穿上他的鞋子走来走去。'
  },
  {
    id: 'book_preset_8',
    title: '追风筝的人',
    author: '卡勒德·胡赛尼',
    coverUrl: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 2003,
    description: '为你，千千万万遍。关于勇气、救赎与纯净誓言的动人故事。'
  },
  {
    id: 'book_preset_9',
    title: '银河系漫游指南',
    author: '道格拉斯·亚当斯',
    coverUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 1979,
    description: '不要恐慌，带上毛巾，生命的终极答案是42。'
  },
  {
    id: 'book_preset_10',
    title: '活着',
    author: '余华',
    coverUrl: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 1993,
    description: '人是为了活着本身而活着的，而不是为了活着之外的任何事物所活着。'
  },
  {
    id: 'book_preset_11',
    title: '海边的卡夫卡',
    author: '村上春树',
    coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 2002,
    description: '沙尘暴过去后，你将不再是走入沙尘暴时的那个你。'
  },
  {
    id: 'book_preset_12',
    title: '绿山墙的安妮',
    author: '露西·莫德·蒙哥马利',
    coverUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 1908,
    description: '生活中有那么多可以去爱、去期待的事物，明天是崭新且没有任何错误的一天。'
  },
  {
    id: 'book_preset_13',
    title: '瓦尔登湖',
    author: '亨利·戴维·梭罗',
    coverUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 1854,
    description: '我步入丛林，因为我希望生活得从容，面对生活的本真。'
  },
  {
    id: 'book_preset_14',
    title: '局外人',
    author: '阿尔贝·加缪',
    coverUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 1942,
    description: '在严寒的冬日里，我终于发现在我心里有一个不可战胜的夏天。'
  },
  {
    id: 'book_preset_15',
    title: '霍乱时期的爱情',
    author: '加夫列尔·加西亚·马尔克斯',
    coverUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 1985,
    description: '跨越半个多世纪的风雨与守候，唯有爱是超越生死的坚韧航程。'
  },
  {
    id: 'book_preset_16',
    title: '平凡的世界',
    author: '路遥',
    coverUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 1986,
    description: '在这片广袤黄土地上，普通人对尊严与梦想的不屈追寻。'
  },
  {
    id: 'book_preset_17',
    title: '1984',
    author: '乔治·奥威尔',
    coverUrl: 'https://images.unsplash.com/photo-1516796181074-bf453fbfa3e6?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 1949,
    description: '反思真理与思想的独立，守护内心中那一抹不被侵蚀的微光。'
  },
  {
    id: 'book_preset_18',
    title: '人类简史',
    author: '尤瓦尔·赫拉利',
    coverUrl: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 2011,
    description: '从认知革命到智人崛起，探寻想象力如何塑造了整个人类文明。'
  },
  {
    id: 'book_preset_19',
    title: '围城',
    author: '钱钟书',
    coverUrl: 'https://images.unsplash.com/photo-1491841573634-28140fc7ced7?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 1947,
    description: '城外的人想冲进去，城里的人想逃出来。幽默机智中洞见人生的际遇。'
  },
  {
    id: 'book_preset_20',
    title: '纳尼亚传奇',
    author: 'C·S·刘易斯',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80',
    firstPublishYear: 1950,
    description: '穿过衣橱后的冰雪世界，开启关于忠诚、希望与勇气的奇幻冒险。'
  }
];

export const PRESET_PREFERENCE_CAPSULES = [
  '#纪实',
  '#散文',
  '#名著',
  '#悬疑',
  '#科幻',
  '#心理学',
  '#诗集',
  '#哲学',
  '#艺术'
];

/**
 * 默认书籍封面生成器 (在网络异常或查无封面时提供精美统一的纯色质感封面)
 */
export function getDefaultBookCover(title: string, author?: string): string {
  // 生成带有书名和书卷质感的默认封面图片 (SVG Data URI)
  const safeTitle = title.length > 12 ? title.slice(0, 11) + '…' : title;
  const safeAuthor = (author || '经典著作').slice(0, 10);
  
  const colors = [
    { bg: '#3a2e2b', accent: '#d4af37' },
    { bg: '#233237', accent: '#eac67a' },
    { bg: '#34495e', accent: '#f1c40f' },
    { bg: '#4a2c40', accent: '#f39c12' },
    { bg: '#2c3e50', accent: '#e74c3c' },
  ];
  const hash = Math.abs(title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
  const chosen = colors[hash % colors.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${chosen.bg}"/>
        <stop offset="100%" stop-color="#111111"/>
      </linearGradient>
      <linearGradient id="spine" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25"/>
        <stop offset="4%" stop-color="#000000" stop-opacity="0.35"/>
        <stop offset="8%" stop-color="#ffffff" stop-opacity="0.1"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="300" height="420" rx="8" fill="url(#bgGrad)"/>
    <rect x="0" y="0" width="28" height="420" fill="url(#spine)"/>
    <rect x="18" y="24" width="264" height="372" rx="4" fill="none" stroke="${chosen.accent}" stroke-width="1.5" stroke-opacity="0.6"/>
    <line x1="40" y1="50" x2="260" y2="50" stroke="${chosen.accent}" stroke-width="1" stroke-opacity="0.4"/>
    <text x="150" y="180" font-family="serif, sans-serif" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle">${safeTitle}</text>
    <text x="150" y="225" font-family="sans-serif" font-size="14" fill="${chosen.accent}" text-anchor="middle">${safeAuthor}</text>
    <text x="150" y="340" font-family="serif, sans-serif" font-size="12" fill="#ffffff" fill-opacity="0.5" text-anchor="middle">共读时光 · 珍藏书卷</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
