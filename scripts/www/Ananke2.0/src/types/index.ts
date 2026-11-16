/**
 * Data models for Card Phone (字卡小手机)
 */

export interface Character {
  id: string;
  name: string;
  nickname: string;
  avatar: string;
  bio?: string;
  status: string;
  chatBackground?: string;
}

export interface UserProfile {
  name: string;
  avatar: string;
  meetDays: number;
  meetStartDate: string;
  quote: string;
  quoteBackground?: string;
  topCardBackground?: string;
  meetDaysBackground?: string;
  topCardOpacity?: number;
  quoteCardOpacity?: number;
  meetDaysOpacity?: number;
}

export interface Card {
  id: string;
  text: string;
  category: string;
  createdAt?: number;
}

export interface CardGroup {
  id: string | number;
  name: string;
  color: string;
  disabled: boolean;
  items?: string[];
  _collapsed?: boolean;
}

export interface ImportResultSummary {
  cardsCount: number;
  groupsCount: number;
  totalNewCards: number;
}

export interface BubbleCustomStyle {
  bg: string;
  textColor: string;
  opacity?: number;
  radius: number;  // 0 ~ 28 (方圆度)
  customCss?: string;
}

export interface PollData {
  id: string;
  type: 'boolean' | 'custom';
  isMultiple: boolean;
  question: string;
  imageUrl?: string;
  options: string[];
  selectedOptions?: string[]; // 梦角选择的结果
  completed: boolean; // 是否已完成选择
}

export interface RedPacketData {
  id: string;
  sender: 'user' | 'character';
  amount: number;
  remark: string;
  color?: string; // 自定义半透明磨砂颜色（非传统大红）
  isOpened: boolean;
  openedAt?: number;
}

export interface CallRecordData {
  id: string;
  initiator: 'user' | 'character';
  status: 'connected' | 'missed' | 'rejected' | 'character_hungup' | 'user_cancelled';
  durationSeconds?: number;
}

export interface Message {
  id: string;
  characterId: string;
  sender: 'user' | 'character' | 'system';
  timestamp: number;
  cards: string[];
  text: string;
  sticker?: string;
  imageUrl?: string;
  emoji?: string;
  replyTo?: string; // ID of message replied to
  type: 'text' | 'card' | 'poke' | 'call' | 'image' | 'sticker' | 'emoji' | 'system' | 'voice' | 'poll' | 'redpacket';
  read?: boolean;
  isProactive?: boolean; // 主动发消息标识
  voiceDuration?: number; // 语音秒数
  voiceTranscript?: string; // 语音转文字
  voiceAudioUrl?: string; // 语音音频
  pollData?: PollData; // 问卷内容
  redPacketData?: RedPacketData; // 红包内容
  callData?: CallRecordData; // 通话状态记录
}

export interface ScheduledEvent {
  id: string;
  type: 'chat_reply' | 'moment_post' | 'moment_comment' | 'moment_like' | 'letter_reply' | 'letter_proactive' | 'status_update' | 'phone_check';
  executeAt: number;
  payload: Record<string, unknown>;
  status: 'pending' | 'executed' | 'cancelled';
}

export interface MailboxSettings {
  dailyProactiveRate: number; // 0 ~ 100 每天主动写信概率（100%为每天必写一封信）
  minReplyMinutes: number; // 自定义角色最短回复时间（分钟），默认 30
  maxReplyMinutes: number; // 自定义角色最长回复时间（分钟），默认 240
  minCardCount: number; // 每封信随机抽取的最少字卡数量（下限 1，上限 15），默认 2
  maxCardCount: number; // 每封信随机抽取的最多字卡数量（下限 1，上限 15），默认 4
  lastProactiveDate?: string; // 最近主动写信检查日期 YYYY-MM-DD
}

export interface CompanionActivity {
  id: string;
  name: string;
  iconName: string;
  isCustom?: boolean;
}

export interface CompanionSession {
  id: string;
  characterId: string;
  activity: string;
  startTime: number;
  status: 'pending' | 'active' | 'rejected' | 'ended';
  endTime?: number;
}

export interface CompanionRecord {
  id: string;
  characterId: string;
  characterName: string;
  activity: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
}

export interface SleepRecord {
  id: string;
  date: string; // YYYY-MM-DD
  sleepTime: string; // HH:mm
  wakeTime: string; // HH:mm
  durationMinutes: number;
  tag: 'good' | 'late' | 'insufficient'; // 12点前+8h: good(绿色), 12点后: late(红色熬夜), 12点前但不足8h: insufficient(黄色睡眠不足)
  note?: string;
}

export interface PeriodRecord {
  id: string;
  startDate: string; // YYYY-MM-DD 生理期开始日
  endDate?: string; // YYYY-MM-DD 生理期结束日（未标注结束则为进行中）
  painDates: string[]; // 发生痛经的日期列表 (YYYY-MM-DD)
  note?: string;
}

export interface LedgerEntry {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  type: 'expense' | 'income';
  category: string;
  note: string;
  createdAt: number;
}

export interface MomentsProfile {
  cover: string; // 朋友圈背景
  avatar: string; // 朋友圈头像
  nickname: string; // 朋友圈昵称
}

export interface MomentsSettings {
  dailyProactiveRate: number; // 0 ~ 100 每日主动发帖概率（决定当天发不发）
  maxDailyPosts: 1 | 3 | 5; // 每日发帖频率上限（可选：1 条、3 条、5 条。实际发帖数量在 1 ~ maxDailyPosts 之间随机抽取）
  minIntervalMinutes: number; // 发帖最少间隔（分钟）
  maxIntervalMinutes: number; // 发帖最多间隔（分钟）
  minCardsPerPost: number; // 角色每条朋友圈最少字卡数 (1 ~ 10)
  maxCardsPerPost: number; // 角色每条朋友圈最多字卡数 (1 ~ 10)
  lastPlanDate?: string; // 最近规划日期 YYYY-MM-DD
  todayPlannedCount?: number; // 当天计划发帖数量 (1 ~ maxDailyPosts 随机生成)
  todayPostedCount?: number; // 当天已发帖数量
  enableCharacterImagePost?: boolean; // 开启角色发图片功能 (20% 概率抽1张发圈)
  characterImagePool?: string[]; // 角色专属发圈图片库 (压缩 Base64 或图片链接)
}

export interface MomentPost {
  id: string;
  author: 'user' | 'character';
  authorName: string;
  authorAvatar: string;
  content: string;
  images?: string[];
  timestamp: number;
  likes: string[]; // names or ids
  comments: Array<{
    id: string;
    author: string;
    text: string;
    timestamp: number;
    replyTo?: string;
  }>;
}

export interface Letter {
  id: string;
  sender: 'user' | 'character';
  title: string;
  content: string;
  timestamp: number;
  isRead: boolean;
  replyToLetterId?: string;
}

export interface PhoneSettings {
  // Theme & Appearance
  themeId: string;
  accentColor: string;
  wallpaper: string; // image or gradient/solid color
  wallpaperMask?: number; // 主界面底图遮罩度 (0.0 ~ 0.9，让背景图颜色减淡)
  topCardBg: string;
  quoteCardBg: string;
  cardOpacity: number;

  // App Icons customization
  iconBgColor: string;
  iconOpacity: number; // 0.1 to 1.0
  iconRadius: number; // 0: square, 12: rounded-md, 20: rounded-2xl, 999: circular
  iconTextColor: string;

  // Chat Rules
  stickersEnabled: boolean;
  emojisEnabled: boolean;
  emojiMixedMode?: boolean; // 混合模式：true 拼接在字卡文字前后（各50%几率），false 作为单独一条消息发出
  characterRedPacketEnabled?: boolean; // 聊天中角色是否主动发红包 (3% 概率)
  customRedPacketColor?: string; // 自定义红包半透明质感颜色 (无预设，半透明磨砂)
  voiceMessageEnabled?: boolean; // 语音消息开关：开启后角色有 10% 概率在对话中发送字卡语音条
  minimaxApiKey?: string; // 用户自定义 MiniMax API Key（仅存浏览器本地）
  minimaxRegion?: 'domestic' | 'international'; // MiniMax 版本：国内版 / 国际版
  minimaxBaseUrl?: string; // MiniMax Base URL (默认 https://api.minimaxi.com/v1)
  minimaxModel?: string; // MiniMax 语音模型 (如 speech-2.8-turbo, speech-2.8-hd 等)
  minimaxVoiceId?: string; // 自定义音色 ID (如 male-qn-qingse 或克隆声音 ID)
  minimaxProxyUrl?: string; // 自定义后端代理地址 (选填)
  minimaxSpeed?: number; // MiniMax 语速 (0.5 ~ 2.0，默认 1.0)
  // 自定义大模型 AI API (用于共读时光推荐等功能)
  aiBaseUrl?: string; // OpenAI 兼容接口 Base URL (例如 https://api.siliconflow.cn/v1)
  aiApiKey?: string;  // API Key (仅存本地)
  aiModel?: string;   // 模型名称 (例如 Qwen/Qwen2.5-7B-Instruct, deepseek-chat 等)
  aiProxyUrl?: string; // 自定义代理中转地址 (Proxy URL)，选填，用于支持非 CORS 接口
  // 微信读书 API 设置 (选填，用于获取真实书库来源)
  wereadApiKey?: string; // 微信读书 API Key (wrk- 开头，选填)

  mergeCards: boolean; // 拼字卡
  readWithoutReply: boolean; // 5% 已读不回
  forceSleepMode: boolean; // 00:00 - 07:00 强制梦角监督早睡
  minReplyDelaySeconds: number; // 最短回复时长秒数 (下限 2s, 上限 120s)
  maxReplyDelaySeconds: number; // 最长回复时长秒数 (下限 2s, 上限 120s)
  enableQuoteReply?: boolean; // 引用开关 (10% 概率引用我的最近 5 条消息之一)
  proactiveMessageEnabled?: boolean; // 开启角色主动发消息
  proactiveMessageIntervalMinutes?: number; // 角色主动发消息间隔分钟 (下限 3m, 上限 180m)
  pokeReplyEnabled?: boolean; // 我拍一拍梦角，梦角是否回复字卡

  // Bubble Customization (气泡设置)
  characterBubbleStyle?: BubbleCustomStyle;
  userBubbleStyle?: BubbleCustomStyle;

  // 聊天美化 (Chat Beautification)
  chatBackground?: string; // 压缩后的聊天背景图 (Base64)
  chatBackgroundMask?: number; // 背景图遮罩度 (0.0 ~ 0.9，让背景图颜色减淡)
  chatCustomFontName?: string; // 自定义 TTF 字体名称
  messageSound?: string; // 发消息时的消息提示音选择

  // Weather Card (梦角当日天气模块)
  showWeatherCard?: boolean; // 是否在主界面显示梦角天气卡片 (默认 true)
  currentWeatherId?: string; // 选定或当前固定的天气预设 ID (空则随上线随机抽取)
  weatherCardBg?: string; // 天气卡片底色 (支持纯色、渐变或图片背景)

  // Background & Fullscreen
  keepAliveAudio: boolean; // 后台保活静音音频
  backgroundNotifications?: boolean; // 后台消息系统桌面通知开关（默认关闭）
  forceFullscreen?: boolean; // 强制全屏开关（隐藏浏览器导航栏，默认开启）
}

export interface FullBackupData {
  version: string;
  exportedAt: number;
  userProfile: UserProfile;
  characters: Character[];
  settings: PhoneSettings;
  cards: Card[];
  cardGroups?: CardGroup[];
  messages: Message[];
  moments: MomentPost[];
  momentsProfile?: MomentsProfile;
  momentsSettings?: MomentsSettings;
  letters: Letter[];
  mailboxSettings?: MailboxSettings;
  companionSession: CompanionSession | null;
  companionRecords?: CompanionRecord[];
  companionCustomActivities?: CompanionActivity[];
  sleepRecords: SleepRecord[];
  periodRecords?: PeriodRecord[];
  ledgerEntries: LedgerEntry[];
  customCategories?: { expense: string[]; income: string[] };
  scheduledEvents: ScheduledEvent[];
  customPokes?: string[];
  customStatuses?: string[];
  customStickers?: string[];
  customEmojis?: string[];
  dailyWeather?: { date: string; weatherId: string } | null;
}

// 统一整体备份与单独模块备份系统类型
export type BackupModuleType = 
  | 'chat'       // 聊天（聊天设置、聊天记录、字卡、字卡分组、表情包、Emoji、拍一拍）
  | 'moments'    // 朋友圈（动态、发帖设置、朋友圈资料、角色专属图片库）
  | 'mailbox'    // 信件（信件列表、信箱设置）
  | 'companion'  // 陪伴记录（历史记录、自定义事项、当前会话）
  | 'health'     // 健康记录（睡眠记录、经期记录）
  | 'ledger'     // 记账记录（记账条目、自定义记账分类）
  | 'reading'    // 共读时光（在架书籍、更新周期、推荐书单池、偏好标签）
  | 'settings';  // 应用设置（主题外观、壁纸、天气、保活与通知、角色与用户资料等）

export interface BackupPackageMeta {
  appName: string; // 'HeartCardPhone'
  formatVersion: string; // '2.0.0'
  exportedAt: number;
  exportedAtStr: string;
  backupType: 'full' | 'module';
  modules: BackupModuleType[];
  itemCounts: Partial<Record<BackupModuleType, number>>;
  assetCount: number;
}

export interface BackupChatData {
  messages: Message[];
  cards: Card[];
  cardGroups: CardGroup[];
  customStickers: string[];
  customEmojis: string[];
  customPokes: string[];
  chatSettings?: Partial<PhoneSettings>;
}

export interface BackupMomentsData {
  moments: MomentPost[];
  momentsSettings: MomentsSettings;
  momentsProfile: MomentsProfile;
}

export interface BackupMailboxData {
  letters: Letter[];
  mailboxSettings: MailboxSettings;
}

export interface BackupCompanionData {
  companionRecords: CompanionRecord[];
  companionCustomActivities: CompanionActivity[];
  companionSession: CompanionSession | null;
}

export interface BackupHealthData {
  sleepRecords: SleepRecord[];
  periodRecords: PeriodRecord[];
}

export interface BackupLedgerData {
  ledgerEntries: LedgerEntry[];
  customCategories: { expense: string[]; income: string[] };
}

export interface BackupReadingData {
  currentShelfBooks: Book[];
  lastShelfUpdateTime: number;
  shelfUpdateFrequency: number;
  userRecommendedBooks: UserRecommendedBook[];
  userPreferenceTags: string[];
}

export interface BackupSettingsData {
  settings: PhoneSettings;
  userProfile: UserProfile;
  characters: Character[];
  customStatuses: string[];
  dailyWeather?: { date: string; weatherId: string } | null;
}

export interface BackupModuleDataMap {
  chat?: BackupChatData;
  moments?: BackupMomentsData;
  mailbox?: BackupMailboxData;
  companion?: BackupCompanionData;
  health?: BackupHealthData;
  ledger?: BackupLedgerData;
  reading?: BackupReadingData;
  settings?: BackupSettingsData;
}

export interface BackupPackage {
  meta: BackupPackageMeta;
  data: BackupModuleDataMap;
  assets?: Record<string, string>; // 去重打包的 Base64 资产字典 (key: resource id, value: data URI)
}

export type ImportMode = 'merge' | 'overwrite';

export interface ModuleImportResult {
  module: BackupModuleType;
  moduleName: string;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  details?: string;
}

export interface ImportReport {
  success: boolean;
  mode: ImportMode;
  backupType: 'full' | 'module';
  modules: BackupModuleType[];
  results: ModuleImportResult[];
  error?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  pkg?: BackupPackage;
  rawType?: 'modular' | 'legacy';
}

// ==========================================
// 共读时光 (Reading Time & Bookshelf) Types
// ==========================================
export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  firstPublishYear?: number | string;
  description?: string;
  reflection?: string; // 梦角专属读后感 (由 3~5 张字卡拼接)
}

export interface UserRecommendedBook {
  id: string;
  title: string;
  author: string;
  added: boolean; // 是否已被梦角加入过书架（已加入过的书不重复加入，只加一次）
  createdAt: number;
}

export type ShelfUpdateFrequencyMs = number; // 毫秒数 (测试10秒, 测试1分钟, 3天, 7天, 15天, 30天)


