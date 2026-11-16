/**
 * BackupService: 统一整体备份、模块备份与恢复服务
 * 
 * 1. 覆盖 7 大完整模块：聊天、朋友圈、信件、陪伴记录、健康记录、记账记录、应用设置
 * 2. 统一资产池与资源去重打包（避免海量重复 Base64 JSON 膨胀）
 * 3. 严格数据隔离性（模块备份导入绝不意外覆盖其他模块）
 * 4. 区分合并导入（Merge）与覆盖导入（Overwrite）
 * 5. 先校验后写入流水线（原子化安全，数据校验失败零写入）
 * 6. 完备导出信息与导入详细统计报告
 */

import {
  BackupModuleType,
  BackupPackage,
  BackupPackageMeta,
  BackupModuleDataMap,
  ImportMode,
  ImportReport,
  ModuleImportResult,
  ValidationResult,
  Message,
  Card,
  CardGroup,
  MomentPost,
  Letter,
  CompanionRecord,
  CompanionActivity,
  SleepRecord,
  PeriodRecord,
  LedgerEntry,
  Character,
  BackupReadingData,
} from '../types';
import { StorageService } from './StorageService';
import { ReadingService } from './ReadingService';

export const MODULE_NAMES: Record<BackupModuleType, string> = {
  chat: '聊天模块',
  moments: '朋友圈模块',
  mailbox: '信件模块',
  companion: '陪伴记录',
  health: '健康记录',
  ledger: '记账记录',
  reading: '共读时光',
  settings: '应用设置',
};

export const ALL_BACKUP_MODULES: BackupModuleType[] = [
  'chat',
  'moments',
  'mailbox',
  'companion',
  'health',
  'ledger',
  'reading',
  'settings',
];

export class BackupService {
  /**
   * 生成资产哈希标识（简单快速的哈希签名）
   */
  private static hashResource(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16);
    return `ast_${hex}_${content.length}`;
  }

  /**
   * 递归扫描并抽离重复/超大 Base64 资源，放入 assets 字典，并用 @asset:id 代替
   */
  private static extractAssets(obj: any, assets: Record<string, string>): any {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
      // 匹配 data URI (如 data:image/... 或 data:audio/...) 且长度大于 128
      if (obj.startsWith('data:') && obj.length > 128) {
        const hashId = this.hashResource(obj);
        assets[hashId] = obj;
        return `@asset:${hashId}`;
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.extractAssets(item, assets));
    }

    if (typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = this.extractAssets(v, assets);
      }
      return result;
    }

    return obj;
  }

  /**
   * 递归将 @asset:id 还原为真正的 Base64 数据
   */
  private static hydrateAssets(obj: any, assets: Record<string, string>): any {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
      if (obj.startsWith('@asset:')) {
        const hashId = obj.slice(7);
        if (assets && assets[hashId]) {
          return assets[hashId];
        }
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.hydrateAssets(item, assets));
    }

    if (typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = this.hydrateAssets(v, assets);
      }
      return result;
    }

    return obj;
  }

  /**
   * 获取本地当前各模块数据量统计
   */
  static getModuleStats(): Record<BackupModuleType, { name: string; summary: string; count: number }> {
    const messages = StorageService.getMessages();
    const cards = StorageService.getCards();
    const moments = StorageService.getMoments();
    const letters = StorageService.getLetters();
    const companionRecords = StorageService.getCompanionRecords();
    const sleepRecords = StorageService.getSleepRecords();
    const periodRecords = StorageService.getPeriodRecords();
    const ledgerEntries = StorageService.getLedgerEntries();

    return {
      chat: {
        name: MODULE_NAMES.chat,
        summary: `${messages.length}条聊天 · ${cards.length}张字卡`,
        count: messages.length + cards.length,
      },
      moments: {
        name: MODULE_NAMES.moments,
        summary: `${moments.length}条朋友圈动态`,
        count: moments.length,
      },
      mailbox: {
        name: MODULE_NAMES.mailbox,
        summary: `${letters.length}封往来信件`,
        count: letters.length,
      },
      companion: {
        name: MODULE_NAMES.companion,
        summary: `${companionRecords.length}次陪伴记录`,
        count: companionRecords.length,
      },
      health: {
        name: MODULE_NAMES.health,
        summary: `${sleepRecords.length}条睡眠 · ${periodRecords.length}条经期`,
        count: sleepRecords.length + periodRecords.length,
      },
      ledger: {
        name: MODULE_NAMES.ledger,
        summary: `${ledgerEntries.length}笔记账明细`,
        count: ledgerEntries.length,
      },
      reading: {
        name: MODULE_NAMES.reading,
        summary: `${ReadingService.getCurrentShelfBooks().length}本在架 · ${ReadingService.getUserRecommendedBooks().length}本待读`,
        count: ReadingService.getCurrentShelfBooks().length + ReadingService.getUserRecommendedBooks().length,
      },
      settings: {
        name: MODULE_NAMES.settings,
        summary: '主题/壁纸/天气/通知/角色等',
        count: 1,
      },
    };
  }

  /**
   * 收集指定模块的数据对象
   */
  private static collectModuleData(module: BackupModuleType): any {
    switch (module) {
      case 'chat': {
        const fullSettings = StorageService.getSettings();
        return {
          messages: StorageService.getMessages(),
          cards: StorageService.getCards(),
          cardGroups: StorageService.getCardGroups(),
          customStickers: StorageService.getCustomStickers(),
          customEmojis: StorageService.getCustomEmojis(),
          customPokes: StorageService.getCustomPokes(),
          chatSettings: {
            stickersEnabled: fullSettings.stickersEnabled,
            emojisEnabled: fullSettings.emojisEnabled,
            emojiMixedMode: fullSettings.emojiMixedMode,
            characterRedPacketEnabled: fullSettings.characterRedPacketEnabled,
            customRedPacketColor: fullSettings.customRedPacketColor,
            voiceMessageEnabled: fullSettings.voiceMessageEnabled,
            minimaxModel: fullSettings.minimaxModel,
            minimaxVoiceId: fullSettings.minimaxVoiceId,
            mergeCards: fullSettings.mergeCards,
            readWithoutReply: fullSettings.readWithoutReply,
            forceSleepMode: fullSettings.forceSleepMode,
            minReplyDelaySeconds: fullSettings.minReplyDelaySeconds,
            maxReplyDelaySeconds: fullSettings.maxReplyDelaySeconds,
            enableQuoteReply: fullSettings.enableQuoteReply,
            proactiveMessageEnabled: fullSettings.proactiveMessageEnabled,
            proactiveMessageIntervalMinutes: fullSettings.proactiveMessageIntervalMinutes,
            characterBubbleStyle: fullSettings.characterBubbleStyle,
            userBubbleStyle: fullSettings.userBubbleStyle,
            chatBackground: fullSettings.chatBackground,
            chatBackgroundMask: fullSettings.chatBackgroundMask,
            chatCustomFontName: fullSettings.chatCustomFontName,
            messageSound: fullSettings.messageSound,
          },
        };
      }
      case 'moments':
        return {
          moments: StorageService.getMoments(),
          momentsSettings: StorageService.getMomentsSettings(),
          momentsProfile: StorageService.getMomentsProfile(),
        };
      case 'mailbox':
        return {
          letters: StorageService.getLetters(),
          mailboxSettings: StorageService.getMailboxSettings(),
        };
      case 'companion':
        return {
          companionRecords: StorageService.getCompanionRecords(),
          companionCustomActivities: StorageService.getCompanionCustomActivities(),
          companionSession: null,
        };
      case 'health':
        return {
          sleepRecords: StorageService.getSleepRecords(),
          periodRecords: StorageService.getPeriodRecords(),
        };
      case 'ledger':
        return {
          ledgerEntries: StorageService.getLedgerEntries(),
          customCategories: StorageService.getCustomLedgerCategories(),
        };
      case 'reading':
        return ReadingService.getBackupData();
      case 'settings':
        return {
          settings: StorageService.getSettings(),
          userProfile: StorageService.getUserProfile(),
          characters: StorageService.getCharacters(),
          customStatuses: StorageService.getCustomStatuses(),
          dailyWeather: StorageService.getDailyWeatherRecord(),
        };
    }
  }

  /**
   * 导出备份（支持整体备份或指定单独模块）
   */
  static exportBackup(targetModules: BackupModuleType[] | 'all' = 'all'): {
    jsonString: string;
    fileName: string;
    fileSizeStr: string;
    meta: BackupPackageMeta;
  } {
    const modules: BackupModuleType[] = targetModules === 'all' ? [...ALL_BACKUP_MODULES] : targetModules;
    const isFull = modules.length === ALL_BACKUP_MODULES.length;
    const now = Date.now();
    const nowStr = new Date(now).toLocaleString('zh-CN', { hour12: false });
    const dateFileStr = new Date(now).toISOString().slice(0, 10);

    const rawDataMap: BackupModuleDataMap = {};
    const itemCounts: Partial<Record<BackupModuleType, number>> = {};

    for (const mod of modules) {
      const data = this.collectModuleData(mod);
      rawDataMap[mod] = data;

      // 统计该模块关键条目数量
      if (mod === 'chat') {
        itemCounts.chat = (data.messages?.length || 0) + (data.cards?.length || 0);
      } else if (mod === 'moments') {
        itemCounts.moments = data.moments?.length || 0;
      } else if (mod === 'mailbox') {
        itemCounts.mailbox = data.letters?.length || 0;
      } else if (mod === 'companion') {
        itemCounts.companion = data.companionRecords?.length || 0;
      } else if (mod === 'health') {
        itemCounts.health = (data.sleepRecords?.length || 0) + (data.periodRecords?.length || 0);
      } else if (mod === 'ledger') {
        itemCounts.ledger = data.ledgerEntries?.length || 0;
      } else if (mod === 'reading') {
        itemCounts.reading = (data.currentShelfBooks?.length || 0) + (data.userRecommendedBooks?.length || 0);
      } else if (mod === 'settings') {
        itemCounts.settings = 1;
      }
    }

    // 资产抽离与去重
    const assets: Record<string, string> = {};
    const processedData = this.extractAssets(rawDataMap, assets);

    const meta: BackupPackageMeta = {
      appName: 'HeartCardPhone',
      formatVersion: '2.0.0',
      exportedAt: now,
      exportedAtStr: nowStr,
      backupType: isFull ? 'full' : 'module',
      modules,
      itemCounts,
      assetCount: Object.keys(assets).length,
    };

    const pkg: BackupPackage = {
      meta,
      data: processedData,
      assets: Object.keys(assets).length > 0 ? assets : undefined,
    };

    const jsonString = JSON.stringify(pkg, null, 2);
    const bytes = new Blob([jsonString]).size;
    const fileSizeStr = bytes < 1024 * 1024 
      ? `${(bytes / 1024).toFixed(1)} KB` 
      : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

    const moduleTag = isFull ? 'full' : modules.join('_');
    const fileName = `heartcard_backup_${moduleTag}_${dateFileStr}.json`;

    return {
      jsonString,
      fileName,
      fileSizeStr,
      meta,
    };
  }

  /**
   * 触发浏览器下载备份文件
   */
  static downloadBackupFile(jsonString: string, fileName: string): void {
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  /**
   * 导入前结构、格式、版本与数据类型全面校验流水线
   * 先完成校验，再执行写入；失败时立即中止并报告明确错误，避免脏数据写入
   */
  static validateBackup(rawJson: string): ValidationResult {
    const errors: string[] = [];

    // 1. JSON 解析
    let parsed: any;
    try {
      parsed = JSON.parse(rawJson);
    } catch (e: any) {
      return {
        isValid: false,
        errors: [`JSON 语法解析失败：文件不是合法的 JSON 格式 (${e?.message || '未知语法错误'})`],
      };
    }

    if (!parsed || typeof parsed !== 'object') {
      return {
        isValid: false,
        errors: ['文件内容为空或根结构不是合法的 JSON 对象'],
      };
    }

    // 2. 检测是否为旧版 1.0.0 完整备份 (FullBackupData 结构兼容转换)
    if (parsed.version === '1.0.0' && (parsed.cards || parsed.messages || parsed.userProfile)) {
      try {
        const adaptedPkg = this.convertLegacyBackupToPackage(parsed);
        return {
          isValid: true,
          errors: [],
          pkg: adaptedPkg,
          rawType: 'legacy',
        };
      } catch (err: any) {
        return {
          isValid: false,
          errors: [`兼容转换旧版 1.0.0 备份失败：${err?.message || '字段解析错误'}`],
        };
      }
    }

    // 3. 校验现代 2.0.0 模块化结构元数据
    const meta = parsed.meta;
    if (!meta || typeof meta !== 'object') {
      errors.push('缺少备份元数据描述 (meta 节点丢失)');
    } else {
      if (!meta.formatVersion) {
        errors.push('元数据缺少格式版本号 (meta.formatVersion)');
      }
      if (!Array.isArray(meta.modules) || meta.modules.length === 0) {
        errors.push('元数据缺少包含的模块列表 (meta.modules 为空)');
      }
    }

    if (!parsed.data || typeof parsed.data !== 'object') {
      errors.push('缺少备份主体数据区域 (data 节点丢失)');
      return { isValid: false, errors };
    }

    const modules: BackupModuleType[] = Array.isArray(meta?.modules) ? meta.modules : [];

    // 4. 逐一深度校验每个包含模块的数据结构与字段类型
    for (const mod of modules) {
      if (!ALL_BACKUP_MODULES.includes(mod)) {
        errors.push(`检测到不受支持的未知模块标识: 「${mod}」`);
        continue;
      }

      const modData = parsed.data[mod];
      if (!modData || typeof modData !== 'object') {
        errors.push(`模块「${MODULE_NAMES[mod]}」数据结构丢失或非对象`);
        continue;
      }

      // 模块具体字段校验
      switch (mod) {
        case 'chat': {
          if (!Array.isArray(modData.messages)) {
            errors.push('聊天模块校验失败：messages 必须是消息数组');
          } else {
            const invalidMsg = modData.messages.find((m: any) => !m || typeof m !== 'object' || !m.id);
            if (invalidMsg) {
              errors.push('聊天模块校验失败：检测到格式损坏的单条消息对象 (缺少 id)');
            }
          }
          if (!Array.isArray(modData.cards)) {
            errors.push('聊天模块校验失败：cards 必须是字卡数组');
          }
          if (modData.cardGroups && !Array.isArray(modData.cardGroups)) {
            errors.push('聊天模块校验失败：cardGroups 必须是分组数组');
          }
          break;
        }
        case 'moments': {
          if (!Array.isArray(modData.moments)) {
            errors.push('朋友圈模块校验失败：moments 必须是动态数组');
          }
          if (modData.momentsSettings && typeof modData.momentsSettings !== 'object') {
            errors.push('朋友圈模块校验失败：momentsSettings 必须是设置对象');
          }
          break;
        }
        case 'mailbox': {
          if (!Array.isArray(modData.letters)) {
            errors.push('信件模块校验失败：letters 必须是信件数组');
          }
          break;
        }
        case 'companion': {
          if (modData.companionRecords && !Array.isArray(modData.companionRecords)) {
            errors.push('陪伴记录模块校验失败：companionRecords 必须是记录数组');
          }
          if (modData.companionCustomActivities && !Array.isArray(modData.companionCustomActivities)) {
            errors.push('陪伴记录模块校验失败：companionCustomActivities 必须是事项数组');
          }
          break;
        }
        case 'health': {
          if (modData.sleepRecords && !Array.isArray(modData.sleepRecords)) {
            errors.push('健康模块校验失败：sleepRecords 必须是睡眠记录数组');
          }
          if (modData.periodRecords && !Array.isArray(modData.periodRecords)) {
            errors.push('健康模块校验失败：periodRecords 必须是经期记录数组');
          }
          break;
        }
        case 'ledger': {
          if (!Array.isArray(modData.ledgerEntries)) {
            errors.push('记账模块校验失败：ledgerEntries 必须是账目数组');
          }
          break;
        }
        case 'reading': {
          if (modData.currentShelfBooks && !Array.isArray(modData.currentShelfBooks)) {
            errors.push('共读时光模块校验失败：currentShelfBooks 必须是书籍数组');
          }
          if (modData.userRecommendedBooks && !Array.isArray(modData.userRecommendedBooks)) {
            errors.push('共读时光模块校验失败：userRecommendedBooks 必须是推荐书单数组');
          }
          break;
        }
        case 'settings': {
          if (modData.settings && typeof modData.settings !== 'object') {
            errors.push('设置模块校验失败：settings 必须是对象');
          }
          break;
        }
      }
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        errors,
      };
    }

    return {
      isValid: true,
      errors: [],
      pkg: parsed as BackupPackage,
      rawType: 'modular',
    };
  }

  /**
   * 将旧版 1.0.0 完整备份安全适配为统一的 BackupPackage 规范
   */
  private static convertLegacyBackupToPackage(legacy: any): BackupPackage {
    const rawDataMap: BackupModuleDataMap = {
      chat: {
        messages: Array.isArray(legacy.messages) ? legacy.messages : [],
        cards: Array.isArray(legacy.cards) ? legacy.cards : [],
        cardGroups: Array.isArray(legacy.cardGroups) ? legacy.cardGroups : [],
        customStickers: Array.isArray(legacy.customStickers) ? legacy.customStickers : [],
        customEmojis: Array.isArray(legacy.customEmojis) ? legacy.customEmojis : [],
        customPokes: Array.isArray(legacy.customPokes) ? legacy.customPokes : [],
      },
      moments: {
        moments: Array.isArray(legacy.moments) ? legacy.moments : [],
        momentsSettings: legacy.momentsSettings || StorageService.getMomentsSettings(),
        momentsProfile: legacy.momentsProfile || StorageService.getMomentsProfile(),
      },
      mailbox: {
        letters: Array.isArray(legacy.letters) ? legacy.letters : [],
        mailboxSettings: legacy.mailboxSettings || StorageService.getMailboxSettings(),
      },
      companion: {
        companionRecords: Array.isArray(legacy.companionRecords) ? legacy.companionRecords : [],
        companionCustomActivities: Array.isArray(legacy.companionCustomActivities) ? legacy.companionCustomActivities : [],
        companionSession: legacy.companionSession || null,
      },
      health: {
        sleepRecords: Array.isArray(legacy.sleepRecords) ? legacy.sleepRecords : [],
        periodRecords: Array.isArray(legacy.periodRecords) ? legacy.periodRecords : [],
      },
      ledger: {
        ledgerEntries: Array.isArray(legacy.ledgerEntries) ? legacy.ledgerEntries : [],
        customCategories: legacy.customCategories || StorageService.getCustomLedgerCategories(),
      },
      reading: ReadingService.getBackupData(),
      settings: {
        settings: legacy.settings || StorageService.getSettings(),
        userProfile: legacy.userProfile || StorageService.getUserProfile(),
        characters: Array.isArray(legacy.characters) ? legacy.characters : StorageService.getCharacters(),
        customStatuses: Array.isArray(legacy.customStatuses) ? legacy.customStatuses : StorageService.getCustomStatuses(),
        dailyWeather: legacy.dailyWeather || null,
      },
    };

    const now = legacy.exportedAt || Date.now();
    const meta: BackupPackageMeta = {
      appName: 'HeartCardPhone',
      formatVersion: '2.0.0 (Legacy Adapted)',
      exportedAt: now,
      exportedAtStr: new Date(now).toLocaleString('zh-CN', { hour12: false }),
      backupType: 'full',
      modules: [...ALL_BACKUP_MODULES],
      itemCounts: {
        chat: (rawDataMap.chat?.messages.length || 0) + (rawDataMap.chat?.cards.length || 0),
        moments: rawDataMap.moments?.moments.length || 0,
        mailbox: rawDataMap.mailbox?.letters.length || 0,
        companion: rawDataMap.companion?.companionRecords.length || 0,
        health: (rawDataMap.health?.sleepRecords.length || 0) + (rawDataMap.health?.periodRecords.length || 0),
        ledger: rawDataMap.ledger?.ledgerEntries.length || 0,
        reading: (rawDataMap.reading?.currentShelfBooks.length || 0) + (rawDataMap.reading?.userRecommendedBooks.length || 0),
        settings: 1,
      },
      assetCount: 0,
    };

    return {
      meta,
      data: rawDataMap,
    };
  }

  /**
   * 执行导入（支持合并导入 Merge 或覆盖导入 Overwrite）
   * 严格遵循模块隔离原则：导入某个模块时，绝不覆盖其他模块
   */
  static importBackup(
    pkg: BackupPackage,
    mode: ImportMode,
    targetModules?: BackupModuleType[]
  ): ImportReport {
    const modulesToProcess = targetModules || pkg.meta.modules;
    const results: ModuleImportResult[] = [];

    // 1. 资产池解包与 Base64 还原
    const hydratedData: BackupModuleDataMap = pkg.assets 
      ? this.hydrateAssets(pkg.data, pkg.assets)
      : pkg.data;

    try {
      // 2. 逐一模块执行导入写入
      for (const mod of modulesToProcess) {
        const modData = hydratedData[mod];
        if (!modData) {
          continue;
        }

        const res: ModuleImportResult = {
          module: mod,
          moduleName: MODULE_NAMES[mod],
          importedCount: 0,
          skippedCount: 0,
          failedCount: 0,
        };

        switch (mod) {
          case 'chat': {
            const chatData = modData as any;
            if (mode === 'overwrite') {
              // 覆盖模式：完全替换聊天所有内容
              const newMsgs: Message[] = Array.isArray(chatData.messages) ? chatData.messages : [];
              const newCards: Card[] = Array.isArray(chatData.cards) ? chatData.cards : [];
              const newGroups: CardGroup[] = Array.isArray(chatData.cardGroups) ? chatData.cardGroups : [];

              StorageService.saveMessages(newMsgs);
              StorageService.saveCards(newCards);
              StorageService.saveCardGroups(newGroups);
              if (Array.isArray(chatData.customStickers)) StorageService.saveCustomStickers(chatData.customStickers);
              if (Array.isArray(chatData.customEmojis)) StorageService.saveCustomEmojis(chatData.customEmojis);
              if (Array.isArray(chatData.customPokes)) StorageService.saveCustomPokes(chatData.customPokes);
              if (chatData.chatSettings) {
                const currentSettings = StorageService.getSettings();
                StorageService.saveSettings({ ...currentSettings, ...chatData.chatSettings });
              }

              res.importedCount = newMsgs.length + newCards.length;
              res.details = `覆盖为 ${newMsgs.length} 条消息、${newCards.length} 张字卡`;
            } else {
              // 合并模式：按 ID 去重合并，追加新数据
              const localMsgs = StorageService.getMessages();
              const incomingMsgs: Message[] = Array.isArray(chatData.messages) ? chatData.messages : [];
              const msgIdMap = new Set(localMsgs.map(m => m.id));
              const mergedMsgs = [...localMsgs];
              let newMsgCount = 0;
              let skipMsgCount = 0;

              for (const m of incomingMsgs) {
                if (m && m.id && !msgIdMap.has(m.id)) {
                  mergedMsgs.push(m);
                  msgIdMap.add(m.id);
                  newMsgCount++;
                } else {
                  skipMsgCount++;
                }
              }
              mergedMsgs.sort((a, b) => a.timestamp - b.timestamp);
              StorageService.saveMessages(mergedMsgs);

              // 字卡去重合并
              const localCards = StorageService.getCards();
              const incomingCards: Card[] = Array.isArray(chatData.cards) ? chatData.cards : [];
              const cardKeyMap = new Set(localCards.map(c => `${c.id}__${c.text}__${c.category}`));
              const mergedCards = [...localCards];
              let newCardCount = 0;
              let skipCardCount = 0;

              for (const c of incomingCards) {
                const key = `${c.id}__${c.text}__${c.category}`;
                if (!cardKeyMap.has(key)) {
                  mergedCards.push(c);
                  cardKeyMap.add(key);
                  newCardCount++;
                } else {
                  skipCardCount++;
                }
              }
              StorageService.saveCards(mergedCards);

              // 分组去重合并
              const localGroups = StorageService.getCardGroups();
              const incomingGroups: CardGroup[] = Array.isArray(chatData.cardGroups) ? chatData.cardGroups : [];
              const groupNameMap = new Set(localGroups.map(g => g.name));
              const mergedGroups = [...localGroups];
              for (const g of incomingGroups) {
                if (g && g.name && !groupNameMap.has(g.name)) {
                  mergedGroups.push(g);
                  groupNameMap.add(g.name);
                }
              }
              StorageService.saveCardGroups(mergedGroups);

              // 贴纸/表情/拍一拍合并
              if (Array.isArray(chatData.customStickers)) {
                const local = StorageService.getCustomStickers();
                const set = new Set([...local, ...chatData.customStickers]);
                StorageService.saveCustomStickers(Array.from(set));
              }
              if (Array.isArray(chatData.customEmojis)) {
                const local = StorageService.getCustomEmojis();
                const set = new Set([...local, ...chatData.customEmojis]);
                StorageService.saveCustomEmojis(Array.from(set));
              }
              if (Array.isArray(chatData.customPokes)) {
                const local = StorageService.getCustomPokes();
                const set = new Set([...local, ...chatData.customPokes]);
                StorageService.saveCustomPokes(Array.from(set));
              }
              if (chatData.chatSettings) {
                const currentSettings = StorageService.getSettings();
                StorageService.saveSettings({ ...currentSettings, ...chatData.chatSettings });
              }

              res.importedCount = newMsgCount + newCardCount;
              res.skippedCount = skipMsgCount + skipCardCount;
              res.details = `合并新增 ${newMsgCount} 条消息、${newCardCount} 张字卡（去重跳过 ${skipMsgCount + skipCardCount} 条）`;
            }
            break;
          }

          case 'moments': {
            const momentsData = modData as any;
            const incomingMoments: MomentPost[] = Array.isArray(momentsData.moments) ? momentsData.moments : [];

            if (mode === 'overwrite') {
              StorageService.saveMoments(incomingMoments);
              if (momentsData.momentsSettings) StorageService.saveMomentsSettings(momentsData.momentsSettings);
              if (momentsData.momentsProfile) StorageService.saveMomentsProfile(momentsData.momentsProfile);
              res.importedCount = incomingMoments.length;
              res.details = `覆盖为 ${incomingMoments.length} 条动态及发帖设置`;
            } else {
              const localMoments = StorageService.getMoments();
              const idSet = new Set(localMoments.map(m => m.id));
              const merged = [...localMoments];
              let added = 0;
              let skipped = 0;

              for (const m of incomingMoments) {
                if (m && m.id && !idSet.has(m.id)) {
                  merged.push(m);
                  idSet.add(m.id);
                  added++;
                } else {
                  skipped++;
                }
              }
              merged.sort((a, b) => b.timestamp - a.timestamp);
              StorageService.saveMoments(merged);

              // 合并朋友圈背景封面与资料
              if (momentsData.momentsProfile) {
                const localProfile = StorageService.getMomentsProfile();
                StorageService.saveMomentsProfile({ ...localProfile, ...momentsData.momentsProfile });
              }

              // 合并朋友圈发帖设置及角色专属图片库
              if (momentsData.momentsSettings) {
                const localSettings = StorageService.getMomentsSettings();
                const poolSet = new Set([
                  ...(localSettings.characterImagePool || []),
                  ...(momentsData.momentsSettings.characterImagePool || []),
                ]);
                StorageService.saveMomentsSettings({
                  ...localSettings,
                  ...momentsData.momentsSettings,
                  characterImagePool: Array.from(poolSet),
                });
              }

              res.importedCount = added;
              res.skippedCount = skipped;
              res.details = `合并新增 ${added} 条动态与背景资料（去重跳过 ${skipped} 条）`;
            }
            break;
          }

          case 'mailbox': {
            const mailboxData = modData as any;
            const incomingLetters: Letter[] = Array.isArray(mailboxData.letters) ? mailboxData.letters : [];

            if (mode === 'overwrite') {
              StorageService.saveLetters(incomingLetters);
              if (mailboxData.mailboxSettings) StorageService.saveMailboxSettings(mailboxData.mailboxSettings);
              res.importedCount = incomingLetters.length;
              res.details = `覆盖为 ${incomingLetters.length} 封信件`;
            } else {
              const localLetters = StorageService.getLetters();
              const idSet = new Set(localLetters.map(l => l.id));
              const merged = [...localLetters];
              let added = 0;
              let skipped = 0;

              for (const l of incomingLetters) {
                if (l && l.id && !idSet.has(l.id)) {
                  merged.push(l);
                  idSet.add(l.id);
                  added++;
                } else {
                  skipped++;
                }
              }
              merged.sort((a, b) => b.timestamp - a.timestamp);
              StorageService.saveLetters(merged);
              res.importedCount = added;
              res.skippedCount = skipped;
              res.details = `合并新增 ${added} 封信件（去重跳过 ${skipped} 封）`;
            }
            break;
          }

          case 'companion': {
            const compData = modData as any;
            const incomingRecs: CompanionRecord[] = Array.isArray(compData.companionRecords) ? compData.companionRecords : [];
            const incomingActs: CompanionActivity[] = Array.isArray(compData.companionCustomActivities) ? compData.companionCustomActivities : [];

            if (mode === 'overwrite') {
              StorageService.saveCompanionRecords(incomingRecs);
              StorageService.saveCompanionCustomActivities(incomingActs);
              res.importedCount = incomingRecs.length + incomingActs.length;
              res.details = `覆盖为 ${incomingRecs.length} 条陪伴记录、${incomingActs.length} 个自定义事项`;
            } else {
              const localRecs = StorageService.getCompanionRecords();
              const recIdSet = new Set(localRecs.map(r => r.id));
              const mergedRecs = [...localRecs];
              let addedRec = 0;
              let skippedRec = 0;

              for (const r of incomingRecs) {
                if (r && r.id && !recIdSet.has(r.id)) {
                  mergedRecs.push(r);
                  recIdSet.add(r.id);
                  addedRec++;
                } else {
                  skippedRec++;
                }
              }
              mergedRecs.sort((a, b) => b.startTime - a.startTime);
              StorageService.saveCompanionRecords(mergedRecs);

              // 自定义事项去重合并
              const localActs = StorageService.getCompanionCustomActivities();
              const actNameSet = new Set(localActs.map(a => a.name));
              const mergedActs = [...localActs];
              let addedAct = 0;
              for (const a of incomingActs) {
                if (a && a.name && !actNameSet.has(a.name)) {
                  mergedActs.push(a);
                  actNameSet.add(a.name);
                  addedAct++;
                }
              }
              StorageService.saveCompanionCustomActivities(mergedActs);

              res.importedCount = addedRec + addedAct;
              res.skippedCount = skippedRec;
              res.details = `合并新增 ${addedRec} 条陪伴记录、${addedAct} 个事项（去重跳过 ${skippedRec} 条）`;
            }
            break;
          }

          case 'health': {
            const healthData = modData as any;
            const incomingSleep: SleepRecord[] = Array.isArray(healthData.sleepRecords) ? healthData.sleepRecords : [];
            const incomingPeriod: PeriodRecord[] = Array.isArray(healthData.periodRecords) ? healthData.periodRecords : [];

            if (mode === 'overwrite') {
              StorageService.saveSleepRecords(incomingSleep);
              StorageService.savePeriodRecords(incomingPeriod);
              res.importedCount = incomingSleep.length + incomingPeriod.length;
              res.details = `覆盖为 ${incomingSleep.length} 条睡眠记录、${incomingPeriod.length} 条经期记录`;
            } else {
              const localSleep = StorageService.getSleepRecords();
              const sleepDateSet = new Set(localSleep.map(s => s.date || s.id));
              const mergedSleep = [...localSleep];
              let addedSleep = 0;
              let skippedSleep = 0;

              for (const s of incomingSleep) {
                const key = s.date || s.id;
                if (!sleepDateSet.has(key)) {
                  mergedSleep.push(s);
                  sleepDateSet.add(key);
                  addedSleep++;
                } else {
                  skippedSleep++;
                }
              }
              mergedSleep.sort((a, b) => b.date.localeCompare(a.date));
              StorageService.saveSleepRecords(mergedSleep);

              const localPeriod = StorageService.getPeriodRecords();
              const periodDateSet = new Set(localPeriod.map(p => p.startDate || p.id));
              const mergedPeriod = [...localPeriod];
              let addedPeriod = 0;
              let skippedPeriod = 0;

              for (const p of incomingPeriod) {
                const key = p.startDate || p.id;
                if (!periodDateSet.has(key)) {
                  mergedPeriod.push(p);
                  periodDateSet.add(key);
                  addedPeriod++;
                } else {
                  skippedPeriod++;
                }
              }
              mergedPeriod.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
              StorageService.savePeriodRecords(mergedPeriod);

              res.importedCount = addedSleep + addedPeriod;
              res.skippedCount = skippedSleep + skippedPeriod;
              res.details = `合并新增 ${addedSleep} 条睡眠、${addedPeriod} 条经期（跳过 ${skippedSleep + skippedPeriod} 条）`;
            }
            break;
          }

          case 'ledger': {
            const ledgerData = modData as any;
            const incomingEntries: LedgerEntry[] = Array.isArray(ledgerData.ledgerEntries) ? ledgerData.ledgerEntries : [];

            if (mode === 'overwrite') {
              StorageService.saveLedgerEntries(incomingEntries);
              if (ledgerData.customCategories) StorageService.saveCustomLedgerCategories(ledgerData.customCategories);
              res.importedCount = incomingEntries.length;
              res.details = `覆盖为 ${incomingEntries.length} 笔账目明细`;
            } else {
              const localEntries = StorageService.getLedgerEntries();
              const idSet = new Set(localEntries.map(e => e.id));
              const merged = [...localEntries];
              let added = 0;
              let skipped = 0;

              for (const e of incomingEntries) {
                if (e && e.id && !idSet.has(e.id)) {
                  merged.push(e);
                  idSet.add(e.id);
                  added++;
                } else {
                  skipped++;
                }
              }
              merged.sort((a, b) => b.date.localeCompare(a.date));
              StorageService.saveLedgerEntries(merged);

              // 自定义分类合并
              if (ledgerData.customCategories) {
                const localCats = StorageService.getCustomLedgerCategories();
                const expSet = new Set([...localCats.expense, ...(ledgerData.customCategories.expense || [])]);
                const incSet = new Set([...localCats.income, ...(ledgerData.customCategories.income || [])]);
                StorageService.saveCustomLedgerCategories({
                  expense: Array.from(expSet),
                  income: Array.from(incSet),
                });
              }

              res.importedCount = added;
              res.skippedCount = skipped;
              res.details = `合并新增 ${added} 笔账目（去重跳过 ${skipped} 笔）`;
            }
            break;
          }

          case 'reading': {
            const readingData = modData as any;
            const restoreRes = ReadingService.restoreFromBackup(readingData, mode);
            res.importedCount = restoreRes.importedCount;
            res.skippedCount = restoreRes.skippedCount;
            res.details = restoreRes.details;
            break;
          }

          case 'settings': {
            const setsData = modData as any;
            if (mode === 'overwrite') {
              if (setsData.settings) StorageService.saveSettings(setsData.settings);
              if (setsData.userProfile) StorageService.saveUserProfile(setsData.userProfile);
              if (Array.isArray(setsData.characters) && setsData.characters.length > 0) {
                StorageService.saveCharacters(setsData.characters);
              }
              if (Array.isArray(setsData.customStatuses)) StorageService.saveCustomStatuses(setsData.customStatuses);
              if (setsData.dailyWeather) StorageService.saveDailyWeatherRecord(setsData.dailyWeather);
              res.importedCount = 1;
              res.details = '应用设置、角色资料与用户资料已全部覆盖更新';
            } else {
              // 合并模式：优先应用导入的桌面壁纸、遮罩度、主题及个性化配置
              if (setsData.settings) {
                const current = StorageService.getSettings();
                StorageService.saveSettings({ ...current, ...setsData.settings });
              }
              if (setsData.userProfile) {
                const current = StorageService.getUserProfile();
                StorageService.saveUserProfile({ ...current, ...setsData.userProfile });
              }
              if (Array.isArray(setsData.characters) && setsData.characters.length > 0) {
                const current = StorageService.getCharacters();
                const merged = setsData.characters.map((c: Character, idx: number) => {
                  const exist = current[idx] || current[0] || {};
                  return { ...exist, ...c };
                });
                StorageService.saveCharacters(merged);
              }
              if (Array.isArray(setsData.customStatuses)) {
                const current = StorageService.getCustomStatuses();
                const set = new Set([...current, ...setsData.customStatuses]);
                StorageService.saveCustomStatuses(Array.from(set));
              }
              if (setsData.dailyWeather) {
                StorageService.saveDailyWeatherRecord(setsData.dailyWeather);
              }
              res.importedCount = 1;
              res.details = '应用设置、角色资料与桌面壁纸已安全合并更新';
            }
            break;
          }
        }

        results.push(res);
      }

      return {
        success: true,
        mode,
        backupType: pkg.meta.backupType,
        modules: modulesToProcess,
        results,
      };
    } catch (err: any) {
      console.error('Import execution error:', err);
      return {
        success: false,
        mode,
        backupType: pkg.meta.backupType,
        modules: modulesToProcess,
        results,
        error: `写入执行异常：${err?.message || '未知存储写入错误'}`,
      };
    }
  }
}
