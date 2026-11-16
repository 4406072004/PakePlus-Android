/**
 * StorageService: 统一管理本地持久化存储
 * 小型结构化数据使用 localStorage，支持内存降级缓存，保护历史数据绝不物理删除，
 * 杜绝隐私模式禁用存储导致的白屏与崩溃闪退。
 */

import {
  Character,
  UserProfile,
  PhoneSettings,
  Card,
  CardGroup,
  Message,
  MomentPost,
  Letter,
  CompanionSession,
  CompanionRecord,
  CompanionActivity,
  SleepRecord,
  PeriodRecord,
  LedgerEntry,
  ScheduledEvent,
  FullBackupData,
  MailboxSettings,
  MomentsProfile,
  MomentsSettings,
} from '../types';
import { DEFAULT_USER, DEFAULT_CHARACTER, DEFAULT_SETTINGS } from '../data/defaultPresets';
import { DEFAULT_CARDS, DEFAULT_CARD_GROUPS } from '../data/defaultCards';
import { DEFAULT_STICKERS, DEFAULT_EMOJIS } from '../data/defaultStickers';

export const DEFAULT_MOMENTS_SETTINGS: MomentsSettings = {
  dailyProactiveRate: 70, // 默认 70% 概率判定今天发不发
  maxDailyPosts: 3, // 默认上限 3 条（实际 1~3 条随机决定）
  minIntervalMinutes: 60, // 默认最少间隔 60 分钟
  maxIntervalMinutes: 180, // 默认最多间隔 180 分钟
  minCardsPerPost: 1, // 默认每条动态最少 1 张字卡（下限 1）
  maxCardsPerPost: 3, // 默认每条动态最多 3 张字卡（上限 10）
  todayPlannedCount: 0,
  todayPostedCount: 0,
  enableCharacterImagePost: false, // 默认未开启发图
  characterImagePool: [], // 专属图片库
};

export const DEFAULT_MAILBOX_SETTINGS: MailboxSettings = {
  dailyProactiveRate: 100, // 默认 100% 每天必写一封信
  minReplyMinutes: 30, // 默认 30 分钟
  maxReplyMinutes: 240, // 默认 4 小时 (240分钟)
  minCardCount: 2, // 默认 2 张 (下限 1)
  maxCardCount: 4, // 默认 4 张 (上限 15)
};

const DEFAULT_INITIAL_LETTERS: Letter[] = [];


const STORAGE_KEYS = {
  USER_PROFILE: 'zk_card_phone_user_profile',
  CHARACTERS: 'zk_card_phone_characters',
  SETTINGS: 'zk_card_phone_settings',
  CARDS: 'zk_card_phone_cards',
  MESSAGES: 'zk_card_phone_messages',
  MOMENTS: 'zk_card_phone_moments',
  MOMENTS_PROFILE: 'zk_card_phone_moments_profile',
  MOMENTS_SETTINGS: 'zk_card_phone_moments_settings',
  LETTERS: 'zk_card_phone_letters',
  MAILBOX_SETTINGS: 'zk_card_phone_mailbox_settings',
  COMPANION: 'zk_card_phone_companion',
  COMPANION_RECORDS: 'zk_card_phone_companion_records',
  COMPANION_CUSTOM_ACTIVITIES: 'zk_card_phone_companion_custom_activities',
  SLEEP: 'zk_card_phone_sleep',
  PERIOD: 'zk_card_phone_period',
  LEDGER: 'zk_card_phone_ledger',
  LEDGER_CUSTOM_CATEGORIES: 'zk_card_phone_ledger_custom_categories',
  EVENTS: 'zk_card_phone_events',
  DAILY_WEATHER: 'zk_card_phone_daily_weather',
  CARD_GROUPS: 'zk_card_phone_card_groups',
  CUSTOM_POKES: 'zk_card_phone_custom_pokes',
  CUSTOM_STATUSES: 'zk_card_phone_custom_statuses',
  CUSTOM_STICKERS: 'zk_card_phone_custom_stickers',
  CUSTOM_EMOJIS: 'zk_card_phone_custom_emojis',
  NEXT_STATUS_UPDATE: 'zk_card_phone_next_status_update',
  LAST_STATUS_UPDATE: 'zk_card_phone_last_status_update',
  LAST_ACTIVE_PAGE: 'zk_card_phone_last_active_page',
  ACTIVE_CALL: 'zk_card_phone_active_call',
};

export const DEFAULT_CUSTOM_POKES: string[] = [
  '拍了拍',
];

export const DEFAULT_CUSTOM_STATUSES: string[] = [
  '在线',
];

export class StorageService {
  // 内存备用缓存，在浏览器隐私无痕模式或存储禁用时充当安全容灾
  private static memoryFallback = new Map<string, string>();

  private static getItem<T>(key: string, fallback: T): T {
    let data: string | null = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        data = window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`Direct localStorage.getItem failed for key ${key}, falling back to memory:`, e);
    }

    if (!data && this.memoryFallback.has(key)) {
      data = this.memoryFallback.get(key) || null;
    }

    if (!data) return fallback;

    try {
      const parsed = JSON.parse(data);
      if (parsed === null || parsed === undefined) return fallback;
      return parsed as T;
    } catch (e) {
      console.warn(`Failed to parse storage key ${key}, using fallback:`, e);
      return fallback;
    }
  }

  private static setItem<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      this.memoryFallback.set(key, serialized);

      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, serialized);
        }
      } catch (e: unknown) {
        const err = e as { name?: string; code?: number };
        const isQuota =
          err?.name === 'QuotaExceededError' ||
          err?.code === 22 ||
          err?.name === 'NS_ERROR_DOM_QUOTA_REACHED';

        if (isQuota) {
          // 触发 QuotaExceededError 时，严禁调用 pruneStorageHealth 删减聊天记录和朋友圈，宁可存不进去也绝不物理删除历史数据
          console.error(
            `[StorageService] 存储配额超出 (QuotaExceededError)！无法写入 localStorage (key: "${key}")。数据已保存在内存中，严禁物理删减任何历史记录！`,
            err
          );
        } else {
          console.warn(`[StorageService] 写入 localStorage 失败 (key: ${key}):`, err);
        }
      }
    } catch (err) {
      console.warn(`Safe setItem serialization error for key ${key}:`, err);
    }
  }

  private static removeItem(key: string): void {
    try {
      this.memoryFallback.delete(key);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`Failed to remove storage key ${key}:`, e);
    }
  }

  // --- User Profile (防御性合并，防止字段缺失引发渲染异常) ---
  static getUserProfile(): UserProfile {
    const raw = this.getItem<Partial<UserProfile>>(STORAGE_KEYS.USER_PROFILE, DEFAULT_USER);
    // 兼容升级：如果存储中还是旧版默认的 2024-01-01 或 100 天，重置为无预设日期、天数为0
    const isLegacyDate = raw?.meetStartDate === '2024-01-01' || raw?.meetDays === 100;
    const meetStartDate = isLegacyDate ? '' : (raw?.meetStartDate || '');
    const meetDays = isLegacyDate ? 0 : (typeof raw?.meetDays === 'number' && !isNaN(raw.meetDays) ? raw.meetDays : 0);

    const profile: UserProfile = {
      ...DEFAULT_USER,
      ...raw,
      meetStartDate,
      meetDays,
      name: raw?.name || DEFAULT_USER.name,
      avatar: raw?.avatar || DEFAULT_USER.avatar,
    };

    if (isLegacyDate) {
      this.saveUserProfile(profile);
    }

    if (!profile.quote || profile.quote === '风吹过的时候，便是在想你。') {
      profile.quote = '仿佛我们一直以来 就注定要在此相遇';
    }
    return profile;
  }

  static saveUserProfile(profile: UserProfile): void {
    this.setItem(STORAGE_KEYS.USER_PROFILE, profile);
  }

  // --- Characters (确保永远非空且属性完整) ---
  static getCharacters(): Character[] {
    const list = this.getItem<Character[]>(STORAGE_KEYS.CHARACTERS, [DEFAULT_CHARACTER]);
    if (!Array.isArray(list) || list.length === 0 || !list[0]) {
      return [DEFAULT_CHARACTER];
    }
    const rawFirst = list[0];
    const isLegacyName = rawFirst.name === '阿念' || rawFirst.nickname === '念宝';
    const name = isLegacyName ? '梦角' : (rawFirst.name || DEFAULT_CHARACTER.name);
    const nickname = isLegacyName ? '梦角' : (rawFirst.nickname || DEFAULT_CHARACTER.nickname);

    const safeFirst: Character = {
      ...DEFAULT_CHARACTER,
      ...rawFirst,
      name,
      nickname,
      avatar: rawFirst.avatar || DEFAULT_CHARACTER.avatar,
    };

    if (isLegacyName) {
      this.saveCharacter(safeFirst);
    }

    return [safeFirst, ...list.slice(1)];
  }

  static saveCharacters(characters: Character[]): void {
    if (!Array.isArray(characters) || characters.length === 0) {
      this.setItem(STORAGE_KEYS.CHARACTERS, [DEFAULT_CHARACTER]);
    } else {
      this.setItem(STORAGE_KEYS.CHARACTERS, characters);
    }
  }

  static saveCharacter(character: Character): void {
    this.saveCharacters([character]);
  }

  // --- Phone Settings ---
  static getSettings(): PhoneSettings {
    const raw = this.getItem<Partial<PhoneSettings>>(STORAGE_KEYS.SETTINGS, {});
    const legacyVoiceId = raw?.minimaxVoiceId === 'male-qn-qingse' ? '' : (raw?.minimaxVoiceId || '');

    // 优先从独立备份键恢复，彻底防止刷新或其它组件保存配置时意外丢失 AI 数据
    let recoveredAiKey = raw?.aiApiKey || '';
    let recoveredAiBase = raw?.aiBaseUrl || 'https://api.siliconflow.cn/v1';
    let recoveredAiModel = raw?.aiModel || 'Qwen/Qwen2.5-7B-Instruct';
    let recoveredAiProxy = raw?.aiProxyUrl || '';
    let recoveredWereadKey = raw?.wereadApiKey || '';

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const backupRaw = window.localStorage.getItem('zk_card_phone_ai_config');
        if (backupRaw) {
          const backupObj = JSON.parse(backupRaw);
          if (backupObj?.aiApiKey && !recoveredAiKey) {
            recoveredAiKey = backupObj.aiApiKey;
            recoveredAiBase = backupObj.aiBaseUrl || recoveredAiBase;
            recoveredAiModel = backupObj.aiModel || recoveredAiModel;
            recoveredAiProxy = backupObj.aiProxyUrl || recoveredAiProxy;
          }
          if (backupObj?.wereadApiKey && !recoveredWereadKey) {
            recoveredWereadKey = backupObj.wereadApiKey;
          }
        }
      } catch {
        // ignore
      }
    }

    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      voiceMessageEnabled: typeof raw?.voiceMessageEnabled === 'boolean' ? raw.voiceMessageEnabled : false,
      minimaxVoiceId: legacyVoiceId,
      minimaxModel: raw?.minimaxModel || 'speech-2.8-turbo',
      minimaxBaseUrl: raw?.minimaxBaseUrl || 'https://api.minimaxi.com/v1',
      minimaxRegion: raw?.minimaxRegion || 'domestic',
      minimaxSpeed: typeof raw?.minimaxSpeed === 'number' && !isNaN(raw.minimaxSpeed) ? raw.minimaxSpeed : 1.0,
      aiBaseUrl: recoveredAiBase,
      aiApiKey: recoveredAiKey,
      aiModel: recoveredAiModel,
      aiProxyUrl: recoveredAiProxy,
      wereadApiKey: recoveredWereadKey,
      cardOpacity: typeof raw?.cardOpacity === 'number' && !isNaN(raw.cardOpacity) ? raw.cardOpacity : 1.0,
      iconOpacity: typeof raw?.iconOpacity === 'number' && !isNaN(raw.iconOpacity) ? raw.iconOpacity : 0.95,
      iconRadius: typeof raw?.iconRadius === 'number' && !isNaN(raw.iconRadius) ? raw.iconRadius : 18,
      backgroundNotifications: typeof raw?.backgroundNotifications === 'boolean' ? raw.backgroundNotifications : false,
      keepAliveAudio: typeof raw?.keepAliveAudio === 'boolean' ? raw.keepAliveAudio : true,
      forceFullscreen: typeof raw?.forceFullscreen === 'boolean' ? raw.forceFullscreen : false,
    };
  }

  static saveSettings(settings: PhoneSettings): void {
    const existing = this.getItem<Partial<PhoneSettings>>(STORAGE_KEYS.SETTINGS, {});
    const safeAiBaseUrl = settings.aiBaseUrl !== undefined && settings.aiBaseUrl !== '' ? settings.aiBaseUrl : (existing.aiBaseUrl || 'https://api.siliconflow.cn/v1');
    const safeAiApiKey = settings.aiApiKey !== undefined && settings.aiApiKey !== '' ? settings.aiApiKey : (existing.aiApiKey || '');
    const safeAiModel = settings.aiModel !== undefined && settings.aiModel !== '' ? settings.aiModel : (existing.aiModel || 'Qwen/Qwen2.5-7B-Instruct');
    const safeAiProxyUrl = settings.aiProxyUrl !== undefined ? settings.aiProxyUrl : (existing.aiProxyUrl || '');
    const safeWereadApiKey = settings.wereadApiKey !== undefined ? settings.wereadApiKey : (existing.wereadApiKey || '');

    const merged: PhoneSettings = {
      ...existing,
      ...settings,
      aiBaseUrl: safeAiBaseUrl,
      aiApiKey: safeAiApiKey,
      aiModel: safeAiModel,
      aiProxyUrl: safeAiProxyUrl,
      wereadApiKey: safeWereadApiKey,
    };
    this.setItem(STORAGE_KEYS.SETTINGS, merged);

    // 双重持久化存储保护，确保页面刷新、切后台再回来或其它页面更新设置时，用户填入的 AI 与微信读书配置绝对不丢失
    try {
      if (typeof window !== 'undefined' && window.localStorage && (safeAiApiKey || safeWereadApiKey)) {
        window.localStorage.setItem('zk_card_phone_ai_config', JSON.stringify({
          aiBaseUrl: safeAiBaseUrl,
          aiApiKey: safeAiApiKey,
          aiModel: safeAiModel,
          aiProxyUrl: safeAiProxyUrl,
          wereadApiKey: safeWereadApiKey,
        }));
      }
    } catch {
      // ignore
    }
  }

  // --- Cards ---
  static getCards(): Card[] {
    const raw = this.getItem<Card[]>(STORAGE_KEYS.CARDS, []);
    const list = Array.isArray(raw) ? raw : [];
    // 过滤掉自带的预设字卡 (card_001 ~ card_030)
    return list.filter(c => !c.id || !/^card_0\d+$/.test(c.id));
  }

  static saveCards(cards: Card[]): void {
    this.setItem(STORAGE_KEYS.CARDS, Array.isArray(cards) ? cards : []);
  }

  // --- Card Groups ---
  static getCardGroups(): CardGroup[] {
    const raw = this.getItem<CardGroup[]>(STORAGE_KEYS.CARD_GROUPS, DEFAULT_CARD_GROUPS);
    return Array.isArray(raw) ? raw : DEFAULT_CARD_GROUPS;
  }

  static saveCardGroups(groups: CardGroup[]): void {
    this.setItem(STORAGE_KEYS.CARD_GROUPS, Array.isArray(groups) ? groups : DEFAULT_CARD_GROUPS);
  }

  // --- Custom Pokes (拍一拍自定义库) ---
  static getCustomPokes(): string[] {
    const raw = this.getItem<string[]>(STORAGE_KEYS.CUSTOM_POKES, DEFAULT_CUSTOM_POKES);
    if (Array.isArray(raw) && raw.length === 3 && raw[0] === '拍了拍你的小脑袋') {
      this.saveCustomPokes(DEFAULT_CUSTOM_POKES);
      return DEFAULT_CUSTOM_POKES;
    }
    return Array.isArray(raw) && raw.length > 0 ? raw : DEFAULT_CUSTOM_POKES;
  }

  static saveCustomPokes(pokes: string[]): void {
    const safe = Array.isArray(pokes) ? pokes.filter(p => typeof p === 'string' && p.trim().length > 0) : DEFAULT_CUSTOM_POKES;
    this.setItem(STORAGE_KEYS.CUSTOM_POKES, safe.length > 0 ? safe : DEFAULT_CUSTOM_POKES);
  }

  // --- Custom Statuses (梦角状态库，预设只设置“在线”) ---
  static getCustomStatuses(): string[] {
    const raw = this.getItem<string[]>(STORAGE_KEYS.CUSTOM_STATUSES, DEFAULT_CUSTOM_STATUSES);
    return Array.isArray(raw) && raw.length > 0 ? raw : DEFAULT_CUSTOM_STATUSES;
  }

  static saveCustomStatuses(statuses: string[]): void {
    const safe = Array.isArray(statuses) ? statuses.filter(s => typeof s === 'string' && s.trim().length > 0) : DEFAULT_CUSTOM_STATUSES;
    this.setItem(STORAGE_KEYS.CUSTOM_STATUSES, safe.length > 0 ? safe : DEFAULT_CUSTOM_STATUSES);
  }

  // --- Custom Stickers (表情包库) ---
  static getCustomStickers(): string[] {
    const raw = this.getItem<string[]>(STORAGE_KEYS.CUSTOM_STICKERS, DEFAULT_STICKERS);
    return Array.isArray(raw) && raw.length > 0 ? raw : DEFAULT_STICKERS;
  }

  static saveCustomStickers(stickers: string[]): void {
    const safe = Array.isArray(stickers) ? stickers.filter(s => typeof s === 'string' && s.trim().length > 0) : DEFAULT_STICKERS;
    this.setItem(STORAGE_KEYS.CUSTOM_STICKERS, safe);
  }

  // --- Custom Emojis (Emoji 库：默认清空预设) ---
  static getCustomEmojis(): string[] {
    const raw = this.getItem<string[] | null>(STORAGE_KEYS.CUSTOM_EMOJIS, null);
    if (raw === null) {
      return DEFAULT_EMOJIS;
    }
    if (!Array.isArray(raw)) return DEFAULT_EMOJIS;
    // 兼容升级：如果存储中仍是旧版预设的 14 个 emoji，自动清空
    const legacyPreset = ['✨', '🌸', '💫', '🧸', '🍃', '☁️', '🤍', '🥰', '🥺', '🐱', '☕', '🌙', '🎀', '🍓'];
    if (raw.length === legacyPreset.length && raw.every((e, i) => e === legacyPreset[i])) {
      this.saveCustomEmojis([]);
      return [];
    }
    return raw;
  }

  static saveCustomEmojis(emojis: string[]): void {
    const safe = Array.isArray(emojis) ? emojis.filter(e => typeof e === 'string' && e.trim().length > 0) : [];
    this.setItem(STORAGE_KEYS.CUSTOM_EMOJIS, safe);
  }

  /**
   * 角色状态更新机制：
   * 触发方式：每隔 1~3 小时（1 + Math.random() * 2）检查一次，时间到了就更新。
   * 状态内容：从状态库纯随机选取。
   */
  static checkAndUpdateCharacterStatus(
    character: Character,
    forceRandom: boolean = false,
    onUpdate?: (char: Character) => void
  ): Character {
    const now = Date.now();
    const nextCheck = this.getItem<number>(STORAGE_KEYS.NEXT_STATUS_UPDATE, 0);

    if (forceRandom || !nextCheck || now >= nextCheck) {
      const statuses = this.getCustomStatuses();
      if (statuses.length > 0) {
        const randIdx = Math.floor(Math.random() * statuses.length);
        const nextStatus = statuses[randIdx] || '在线';
        const updatedChar = { ...character, status: nextStatus };
        this.saveCharacter(updatedChar);
        if (onUpdate) {
          onUpdate(updatedChar);
        }

        // 下一次更新触发时间：每隔 1~3 小时 (1 + Math.random() * 2 小时)
        const nextIntervalHours = 1 + Math.random() * 2;
        const nextIntervalMs = Math.floor(nextIntervalHours * 3600 * 1000);
        this.setItem(STORAGE_KEYS.NEXT_STATUS_UPDATE, now + nextIntervalMs);
        this.setItem(STORAGE_KEYS.LAST_STATUS_UPDATE, now);
        return updatedChar;
      }
    }
    return character;
  }

  // --- Messages ---
  static getMessages(): Message[] {
    const raw = this.getItem<Message[]>(STORAGE_KEYS.MESSAGES, []);
    return Array.isArray(raw) ? raw : [];
  }

  static saveMessages(messages: Message[]): void {
    if (!Array.isArray(messages)) return;
    // 扩展最大存储容量至 1000 条，并执行消息轻量化防溢出保护
    const safeList = messages.slice(-1000);
    this.setItem(STORAGE_KEYS.MESSAGES, safeList);
  }

  // --- Moments (清空预设动态) ---
  static getMoments(): MomentPost[] {
    const raw = this.getItem<MomentPost[]>(STORAGE_KEYS.MOMENTS, []);
    const list = Array.isArray(raw) ? raw : [];
    // 过滤清除旧版预设的朋友圈动态 (post_init_1)
    return list.filter(p => p.id !== 'post_init_1');
  }

  static saveMoments(moments: MomentPost[]): void {
    this.setItem(STORAGE_KEYS.MOMENTS, Array.isArray(moments) ? moments.slice(-200) : []);
  }

  // --- Moments Profile ---
  static getMomentsProfile(fallback?: Partial<MomentsProfile>): MomentsProfile {
    const defaultProfile: MomentsProfile = {
      cover: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=900&auto=format&fit=crop&q=80',
      avatar: fallback?.avatar || DEFAULT_USER.avatar,
      nickname: fallback?.nickname || DEFAULT_USER.name,
    };
    const raw = this.getItem<Partial<MomentsProfile>>(STORAGE_KEYS.MOMENTS_PROFILE, defaultProfile);
    return {
      cover: raw?.cover || defaultProfile.cover,
      avatar: raw?.avatar || fallback?.avatar || defaultProfile.avatar,
      nickname: raw?.nickname || fallback?.nickname || defaultProfile.nickname,
    };
  }

  static saveMomentsProfile(profile: MomentsProfile): void {
    this.setItem(STORAGE_KEYS.MOMENTS_PROFILE, profile);
  }

  // --- Moments Proactive Settings ---
  static getMomentsSettings(): MomentsSettings {
    const raw = this.getItem<Partial<MomentsSettings>>(STORAGE_KEYS.MOMENTS_SETTINGS, DEFAULT_MOMENTS_SETTINGS);
    const maxPosts = (raw?.maxDailyPosts === 1 || raw?.maxDailyPosts === 5) ? raw.maxDailyPosts : (raw?.maxDailyPosts === 3 ? 3 : DEFAULT_MOMENTS_SETTINGS.maxDailyPosts);
    const minInterval = typeof raw?.minIntervalMinutes === 'number' && raw.minIntervalMinutes >= 1 ? raw.minIntervalMinutes : DEFAULT_MOMENTS_SETTINGS.minIntervalMinutes;
    const maxInterval = typeof raw?.maxIntervalMinutes === 'number' && raw.maxIntervalMinutes >= minInterval ? raw.maxIntervalMinutes : Math.max(minInterval, DEFAULT_MOMENTS_SETTINGS.maxIntervalMinutes);
    const minCards = typeof raw?.minCardsPerPost === 'number' ? Math.max(1, Math.min(10, Math.floor(raw.minCardsPerPost))) : DEFAULT_MOMENTS_SETTINGS.minCardsPerPost;
    const maxCards = typeof raw?.maxCardsPerPost === 'number' ? Math.max(minCards, Math.min(10, Math.floor(raw.maxCardsPerPost))) : Math.max(minCards, DEFAULT_MOMENTS_SETTINGS.maxCardsPerPost);

    return {
      dailyProactiveRate: typeof raw?.dailyProactiveRate === 'number' ? Math.max(0, Math.min(100, raw.dailyProactiveRate)) : DEFAULT_MOMENTS_SETTINGS.dailyProactiveRate,
      maxDailyPosts: maxPosts,
      minIntervalMinutes: minInterval,
      maxIntervalMinutes: maxInterval,
      minCardsPerPost: minCards,
      maxCardsPerPost: maxCards,
      lastPlanDate: raw?.lastPlanDate,
      todayPlannedCount: typeof raw?.todayPlannedCount === 'number' ? raw.todayPlannedCount : 0,
      todayPostedCount: typeof raw?.todayPostedCount === 'number' ? raw.todayPostedCount : 0,
      enableCharacterImagePost: typeof raw?.enableCharacterImagePost === 'boolean' ? raw.enableCharacterImagePost : DEFAULT_MOMENTS_SETTINGS.enableCharacterImagePost,
      characterImagePool: Array.isArray(raw?.characterImagePool) ? raw.characterImagePool : DEFAULT_MOMENTS_SETTINGS.characterImagePool,
    };
  }

  static saveMomentsSettings(settings: MomentsSettings): void {
    this.setItem(STORAGE_KEYS.MOMENTS_SETTINGS, settings);
  }

  // --- Letters (清空预设信件，确保每封信纯由字卡组成) ---
  static getLetters(): Letter[] {
    const raw = this.getItem<Letter[]>(STORAGE_KEYS.LETTERS, DEFAULT_INITIAL_LETTERS);
    const list = Array.isArray(raw) ? raw : DEFAULT_INITIAL_LETTERS;
    // 过滤清除旧版预设信件 (let_init_1)，并清洗信件末尾多余的固定结尾话术
    return list
      .filter(l => l.id !== 'let_init_1')
      .map(l => ({
        ...l,
        content: (l.content || '')
          .replace(/。愿你今天的一切美好都如[期约]而至。?$/, '')
          .replace(/愿你今天的一切美好都如[期约]而至。?$/, '')
          .replace(/。天气转凉，记得添衣。?$/, '')
          .replace(/^亲爱的：已收到你的来信。/, '')
          .replace(/^见字如面。/, ''),
      }));
  }

  static saveLetters(letters: Letter[]): void {
    this.setItem(STORAGE_KEYS.LETTERS, Array.isArray(letters) ? letters : []);
  }

  // --- Mailbox Settings ---
  static getMailboxSettings(): MailboxSettings {
    const raw = this.getItem<Partial<MailboxSettings>>(STORAGE_KEYS.MAILBOX_SETTINGS, DEFAULT_MAILBOX_SETTINGS);
    const minCard = typeof raw?.minCardCount === 'number' ? Math.max(1, Math.min(15, raw.minCardCount)) : DEFAULT_MAILBOX_SETTINGS.minCardCount;
    const maxCard = typeof raw?.maxCardCount === 'number' ? Math.max(1, Math.min(15, raw.maxCardCount)) : DEFAULT_MAILBOX_SETTINGS.maxCardCount;
    const minReply = typeof raw?.minReplyMinutes === 'number' && raw.minReplyMinutes >= 1 ? raw.minReplyMinutes : DEFAULT_MAILBOX_SETTINGS.minReplyMinutes;
    const maxReply = typeof raw?.maxReplyMinutes === 'number' && raw.maxReplyMinutes >= minReply ? raw.maxReplyMinutes : Math.max(minReply, DEFAULT_MAILBOX_SETTINGS.maxReplyMinutes);

    return {
      dailyProactiveRate: typeof raw?.dailyProactiveRate === 'number' ? Math.max(0, Math.min(100, raw.dailyProactiveRate)) : DEFAULT_MAILBOX_SETTINGS.dailyProactiveRate,
      minReplyMinutes: minReply,
      maxReplyMinutes: maxReply,
      minCardCount: minCard,
      maxCardCount: maxCard,
      lastProactiveDate: raw?.lastProactiveDate,
    };
  }

  static saveMailboxSettings(settings: MailboxSettings): void {
    this.setItem(STORAGE_KEYS.MAILBOX_SETTINGS, settings);
  }

  // --- Scheduled Events ---
  static getScheduledEvents(): ScheduledEvent[] {
    const raw = this.getItem<ScheduledEvent[]>(STORAGE_KEYS.EVENTS, []);
    return Array.isArray(raw) ? raw : [];
  }

  static saveScheduledEvents(events: ScheduledEvent[]): void {
    const safeList = Array.isArray(events) ? events.slice(-100) : [];
    this.setItem(STORAGE_KEYS.EVENTS, safeList);
  }

  // --- Companion Records (按月收纳，最多保留近6个月的记录) ---
  static getCompanionRecords(): CompanionRecord[] {
    const raw = this.getItem<CompanionRecord[]>(STORAGE_KEYS.COMPANION_RECORDS, []);
    if (!Array.isArray(raw)) return [];
    const sixMonthsAgo = Date.now() - 183 * 24 * 60 * 60 * 1000;
    return raw.filter(entry => {
      const time = entry.startTime || 0;
      return !isNaN(time) && time >= sixMonthsAgo;
    });
  }

  static saveCompanionRecords(records: CompanionRecord[]): void {
    if (!Array.isArray(records)) {
      this.setItem(STORAGE_KEYS.COMPANION_RECORDS, []);
      return;
    }
    const sixMonthsAgo = Date.now() - 183 * 24 * 60 * 60 * 1000;
    const filtered = records.filter(entry => {
      const time = entry.startTime || 0;
      return !isNaN(time) && time >= sixMonthsAgo;
    });
    this.setItem(STORAGE_KEYS.COMPANION_RECORDS, filtered);
  }

  // --- Companion Custom Activities (持久化保存自定义陪伴事项，可删除/可收纳) ---
  static getCompanionCustomActivities(): CompanionActivity[] {
    const raw = this.getItem<CompanionActivity[]>(STORAGE_KEYS.COMPANION_CUSTOM_ACTIVITIES, []);
    return Array.isArray(raw) ? raw : [];
  }

  static saveCompanionCustomActivities(activities: CompanionActivity[]): void {
    this.setItem(STORAGE_KEYS.COMPANION_CUSTOM_ACTIVITIES, Array.isArray(activities) ? activities : []);
  }

  // --- Active Companion Session (后台切换/退出重进保持陪伴状态与计时) ---
  static getCompanionSession(): CompanionSession | null {
    const raw = this.getItem<CompanionSession | null>(STORAGE_KEYS.COMPANION, null);
    if (!raw || !raw.id || raw.status === 'ended' || raw.status === 'rejected') return null;
    return raw;
  }

  static saveCompanionSession(session: CompanionSession | null): void {
    if (!session || session.status === 'ended' || session.status === 'rejected') {
      this.removeItem(STORAGE_KEYS.COMPANION);
    } else {
      this.setItem(STORAGE_KEYS.COMPANION, session);
    }
  }

  // --- Last Active Page (切后台/退出重进保持当前页面，不刷新/不回退首页) ---
  static getLastActivePage(fallback: string = 'home'): string {
    const page = this.getItem<string>(STORAGE_KEYS.LAST_ACTIVE_PAGE, fallback);
    return page || fallback;
  }

  static saveLastActivePage(page: string): void {
    if (page) {
      this.setItem(STORAGE_KEYS.LAST_ACTIVE_PAGE, page);
    }
  }

  // --- Active Call Session (后台切换/退出重进保持通话状态与计时) ---
  static getActiveCall(): any | null {
    const raw = this.getItem<any | null>(STORAGE_KEYS.ACTIVE_CALL, null);
    if (!raw || !raw.id || raw.status === 'ended') return null;
    return raw;
  }

  static saveActiveCall(session: any | null): void {
    if (!session || session.status === 'ended') {
      this.removeItem(STORAGE_KEYS.ACTIVE_CALL);
    } else {
      this.setItem(STORAGE_KEYS.ACTIVE_CALL, session);
    }
  }

  // --- Sleep Records (最多保留近期6个月的记录) ---
  static getSleepRecords(): SleepRecord[] {
    const raw = this.getItem<SleepRecord[]>(STORAGE_KEYS.SLEEP, []);
    if (!Array.isArray(raw)) return [];
    const sixMonthsAgo = Date.now() - 183 * 24 * 60 * 60 * 1000;
    return raw.filter(entry => {
      const time = entry.date ? new Date(entry.date + 'T00:00:00').getTime() : 0;
      return !isNaN(time) && time >= sixMonthsAgo;
    });
  }

  static saveSleepRecords(records: SleepRecord[]): void {
    if (!Array.isArray(records)) {
      this.setItem(STORAGE_KEYS.SLEEP, []);
      return;
    }
    const sixMonthsAgo = Date.now() - 183 * 24 * 60 * 60 * 1000;
    const filtered = records.filter(entry => {
      const time = entry.date ? new Date(entry.date + 'T00:00:00').getTime() : 0;
      return !isNaN(time) && time >= sixMonthsAgo;
    });
    this.setItem(STORAGE_KEYS.SLEEP, filtered);
  }

  // --- Period Records (最多保留近期6个月的记录) ---
  static getPeriodRecords(): PeriodRecord[] {
    const raw = this.getItem<PeriodRecord[]>(STORAGE_KEYS.PERIOD, []);
    if (!Array.isArray(raw)) return [];
    const sixMonthsAgo = Date.now() - 183 * 24 * 60 * 60 * 1000;
    return raw.filter(entry => {
      const time = entry.startDate ? new Date(entry.startDate + 'T00:00:00').getTime() : 0;
      return !isNaN(time) && time >= sixMonthsAgo;
    });
  }

  static savePeriodRecords(records: PeriodRecord[]): void {
    if (!Array.isArray(records)) {
      this.setItem(STORAGE_KEYS.PERIOD, []);
      return;
    }
    const sixMonthsAgo = Date.now() - 183 * 24 * 60 * 60 * 1000;
    const filtered = records.filter(entry => {
      const time = entry.startDate ? new Date(entry.startDate + 'T00:00:00').getTime() : 0;
      return !isNaN(time) && time >= sixMonthsAgo;
    });
    this.setItem(STORAGE_KEYS.PERIOD, filtered);
  }

  // --- Ledger (最多保留近一年记录) ---
  static getLedgerEntries(): LedgerEntry[] {
    const raw = this.getItem<LedgerEntry[]>(STORAGE_KEYS.LEDGER, []);
    if (!Array.isArray(raw)) return [];
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    return raw.filter(entry => {
      const time = entry.createdAt || (entry.date ? new Date(entry.date + 'T00:00:00').getTime() : 0);
      return !isNaN(time) && time >= oneYearAgo;
    });
  }

  static saveLedgerEntries(entries: LedgerEntry[]): void {
    if (!Array.isArray(entries)) {
      this.setItem(STORAGE_KEYS.LEDGER, []);
      return;
    }
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const filtered = entries.filter(entry => {
      const time = entry.createdAt || (entry.date ? new Date(entry.date + 'T00:00:00').getTime() : 0);
      return !isNaN(time) && time >= oneYearAgo;
    });
    this.setItem(STORAGE_KEYS.LEDGER, filtered);
  }

  // --- Custom Categories for Ledger ---
  static getCustomLedgerCategories(): { expense: string[]; income: string[] } {
    const defaults = { expense: [], income: [] };
    const raw = this.getItem<{ expense?: string[]; income?: string[] }>(STORAGE_KEYS.LEDGER_CUSTOM_CATEGORIES, defaults);
    return {
      expense: Array.isArray(raw?.expense) ? raw.expense : [],
      income: Array.isArray(raw?.income) ? raw.income : [],
    };
  }

  static saveCustomLedgerCategories(custom: { expense: string[]; income: string[] }): void {
    this.setItem(STORAGE_KEYS.LEDGER_CUSTOM_CATEGORIES, custom);
  }

  // --- Daily Weather ---
  static getDailyWeatherRecord(): { date: string; weatherId: string } | null {
    return this.getItem<{ date: string; weatherId: string } | null>(STORAGE_KEYS.DAILY_WEATHER, null);
  }

  static saveDailyWeatherRecord(record: { date: string; weatherId: string }): void {
    this.setItem(STORAGE_KEYS.DAILY_WEATHER, record);
  }

  // --- Export Full Backup ---
  static exportFullBackup(): FullBackupData {
    return {
      version: '2.0.0',
      exportedAt: Date.now(),
      userProfile: this.getUserProfile(),
      characters: this.getCharacters(),
      settings: this.getSettings(),
      cards: this.getCards(),
      cardGroups: this.getCardGroups(),
      messages: this.getMessages(),
      moments: this.getMoments(),
      momentsProfile: this.getMomentsProfile(),
      momentsSettings: this.getMomentsSettings(),
      letters: this.getLetters(),
      mailboxSettings: this.getMailboxSettings(),
      companionSession: null,
      companionRecords: this.getCompanionRecords(),
      companionCustomActivities: this.getCompanionCustomActivities(),
      sleepRecords: this.getSleepRecords(),
      periodRecords: this.getPeriodRecords(),
      ledgerEntries: this.getLedgerEntries(),
      customCategories: this.getCustomLedgerCategories(),
      scheduledEvents: [],
      customPokes: this.getCustomPokes(),
      customStatuses: this.getCustomStatuses(),
      customStickers: this.getCustomStickers(),
      customEmojis: this.getCustomEmojis(),
      dailyWeather: this.getDailyWeatherRecord(),
    };
  }

  // --- Import Full Backup ---
  static importFullBackup(data: FullBackupData): boolean {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid backup file');
      }

      if (data.userProfile) this.saveUserProfile(data.userProfile);
      if (data.characters) this.saveCharacters(data.characters);
      if (data.settings) this.saveSettings(data.settings);
      if (data.cards) this.saveCards(data.cards);
      if (Array.isArray(data.cardGroups)) this.saveCardGroups(data.cardGroups);
      if (data.messages) this.saveMessages(data.messages);
      if (data.moments) this.saveMoments(data.moments);
      if (data.momentsProfile) this.saveMomentsProfile(data.momentsProfile);
      if (data.momentsSettings) this.saveMomentsSettings(data.momentsSettings);
      if (data.letters) this.saveLetters(data.letters);
      if (data.mailboxSettings) this.saveMailboxSettings(data.mailboxSettings);
      if (data.companionRecords) this.saveCompanionRecords(data.companionRecords);
      if (Array.isArray(data.companionCustomActivities)) this.saveCompanionCustomActivities(data.companionCustomActivities);
      if (data.sleepRecords) this.saveSleepRecords(data.sleepRecords);
      if (data.periodRecords) this.savePeriodRecords(data.periodRecords);
      if (data.ledgerEntries) this.saveLedgerEntries(data.ledgerEntries);
      if (data.customCategories) this.saveCustomLedgerCategories(data.customCategories);
      if (Array.isArray(data.customPokes)) this.saveCustomPokes(data.customPokes);
      if (Array.isArray(data.customStatuses)) this.saveCustomStatuses(data.customStatuses);
      if (Array.isArray(data.customStickers)) this.saveCustomStickers(data.customStickers);
      if (Array.isArray(data.customEmojis)) this.saveCustomEmojis(data.customEmojis);
      if (data.dailyWeather) this.saveDailyWeatherRecord(data.dailyWeather);

      return true;
    } catch (err) {
      console.error('Import failed:', err);
      return false;
    }
  }

  // --- Reset All Data to Default ---
  static resetToDefault(): void {
    try {
      Object.values(STORAGE_KEYS).forEach(k => {
        try {
          localStorage.removeItem(k);
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
    this.memoryFallback.clear();
  }
}
