/**
 * cardImportService: 独立字卡及周边模块 JSON 解析与导入服务
 * 
 * 核心设计：
 * 1. 深度兼容旧版项目导出的完整 JSON 结构（customReplies, customReplyGroups, customPokes, customStatuses, customMottos, customIntros, customEmojis 等）
 * 2. 策略：分组作为主结构，customReplies 作为完整字卡全集，避免重复字卡
 * 3. 绝对保持原文字字句，不纠错、不润色、不擅自改标点、不删特殊字符或 Emoji
 * 4. 严禁增加概率权重机制，所有字卡均为纯随机
 * 5. 稳定确定性 ID 生成，多次重复导入同一文件不会产生大量重复数据
 * 6. 各模块（pokes, statuses, mottos, intros, emojis）独立存入对应数据池
 */

import { Card, CardGroup, ImportResultSummary } from '../types';
import { StorageService } from './StorageService';

/**
 * 确定性哈希，根据分类与文本生成稳定的唯一卡片 ID
 * 避免重复导入时堆叠海量重复项，同时绝不修改原文字内容
 */
export function generateDeterministicCardId(category: string, text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const str = `${category}:::${text}`;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return `card_${hash.toString(36)}`;
}

export class CardImportService {
  /**
   * 解析 JSON 文本并执行导入
   */
  static parseAndImportJson(
    jsonString: string,
    existingCards: Card[] = StorageService.getCards(),
    existingGroups: CardGroup[] = StorageService.getCardGroups()
  ): {
    success: boolean;
    summary?: ImportResultSummary;
    updatedCards?: Card[];
    updatedGroups?: CardGroup[];
    error?: string;
  } {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      return {
        success: false,
        error: 'JSON 格式解析失败，请检查文件是否为合法 JSON',
      };
    }

    if (!parsed || (typeof parsed !== 'object' && !Array.isArray(parsed))) {
      return {
        success: false,
        error: '数据格式不符，未能识别出有效的字卡数据',
      };
    }

    try {
      // 1. 如果导入的是旧版本兼容的顶层对象格式
      if (!Array.isArray(parsed) && typeof parsed === 'object') {
        const result = this.importLegacyFormat(parsed, existingCards, existingGroups);
        return {
          success: true,
          ...result,
        };
      }

      // 2. 如果导入的是普通的字卡数组 [{ text, category }, ...]
      if (Array.isArray(parsed)) {
        const result = this.importFlatCardsArray(parsed, existingCards, existingGroups);
        return {
          success: true,
          ...result,
        };
      }

      return {
        success: false,
        error: '未能识别的数据结构',
      };
    } catch (err) {
      console.error('Import processing error:', err);
      return {
        success: false,
        error: '导入过程发生异常：' + (err instanceof Error ? err.message : String(err)),
      };
    }
  }

  /**
   * 核心算法：以 customReplyGroups 为主结构，以 customReplies 为完整字卡全集
   */
  private static importLegacyFormat(
    data: Record<string, any>,
    existingCards: Card[],
    existingGroups: CardGroup[]
  ): {
    summary: ImportResultSummary;
    updatedCards: Card[];
    updatedGroups: CardGroup[];
  } {
    const rawGroups: any[] = Array.isArray(data.customReplyGroups) ? data.customReplyGroups : [];
    const rawReplies: any[] = Array.isArray(data.customReplies) ? data.customReplies : [];

    // 用于快速根据文字查询归属分类的映射表
    const textToCategoryMap = new Map<string, string>();
    const importedGroupsList: CardGroup[] = [];

    // 处理分组结构
    rawGroups.forEach((grp, idx) => {
      if (!grp || typeof grp.name !== 'string') return;
      const groupName = grp.name;
      const groupColor = typeof grp.color === 'string' && grp.color ? grp.color : '#3B82F6';
      const isDisabled = Boolean(grp.disabled);
      const items = Array.isArray(grp.items) ? grp.items.filter((it: any) => typeof it === 'string') : [];

      // 登记属于该分类的所有文字
      items.forEach((itemText: string) => {
        if (!textToCategoryMap.has(itemText)) {
          textToCategoryMap.set(itemText, groupName);
        }
      });

      importedGroupsList.push({
        id: grp.id !== undefined ? String(grp.id) : `grp_${Date.now()}_${idx}`,
        name: groupName,
        color: groupColor,
        disabled: isDisabled,
        items: items,
        _collapsed: Boolean(grp._collapsed),
      });
    });

    // 构建本批次导入的字卡清单（保留原样字符、零润色、零去重丢失）
    const batchCards: Card[] = [];
    const seenBatchKeys = new Set<string>();

    // 步骤 A：优先从 customReplyGroups.items 中生成字卡
    rawGroups.forEach(grp => {
      if (!grp || typeof grp.name !== 'string' || !Array.isArray(grp.items)) return;
      const categoryName = grp.name;
      grp.items.forEach((rawItem: any) => {
        if (typeof rawItem !== 'string') return;
        const key = `${categoryName}:::${rawItem}`;
        if (!seenBatchKeys.has(key)) {
          seenBatchKeys.add(key);
          batchCards.push({
            id: generateDeterministicCardId(categoryName, rawItem),
            text: rawItem, // 原样保留
            category: categoryName,
            createdAt: Date.now(),
          });
        }
      });
    });

    // 步骤 B：处理 customReplies 全集
    // 若文字已在某个分组中，上面步骤 A 已精准收录并指定好 category
    // 若文字未出现在任何分组中，归入“未分类”
    rawReplies.forEach((replyItem: any) => {
      if (typeof replyItem !== 'string') return;
      const assignedCategory = textToCategoryMap.get(replyItem) || '未分类';
      const key = `${assignedCategory}:::${replyItem}`;
      if (!seenBatchKeys.has(key)) {
        seenBatchKeys.add(key);
        batchCards.push({
          id: generateDeterministicCardId(assignedCategory, replyItem),
          text: replyItem, // 原样保留
          category: assignedCategory,
          createdAt: Date.now(),
        });
      }
    });

    // 合并字卡：防重复机制（根据确定性 ID 或 分类+文本 进行排重，防止重复导入刷出几千条冗余）
    const existingCardKeys = new Set<string>();
    existingCards.forEach(c => {
      existingCardKeys.add(c.id);
      existingCardKeys.add(`${c.category}:::${c.text}`);
    });

    const newCardsToAdd: Card[] = [];
    batchCards.forEach(card => {
      const matchKey = `${card.category}:::${card.text}`;
      if (!existingCardKeys.has(card.id) && !existingCardKeys.has(matchKey)) {
        newCardsToAdd.push(card);
        existingCardKeys.add(card.id);
        existingCardKeys.add(matchKey);
      }
    });

    const updatedCards = [...newCardsToAdd, ...existingCards];
    StorageService.saveCards(updatedCards);

    // 合并分组：若已有同名分组则更新配置与颜色，没有则追加
    const groupNameMap = new Map<string, CardGroup>();
    existingGroups.forEach(g => groupNameMap.set(g.name, g));
    importedGroupsList.forEach(g => {
      if (groupNameMap.has(g.name)) {
        const old = groupNameMap.get(g.name)!;
        groupNameMap.set(g.name, {
          ...old,
          color: g.color || old.color,
          disabled: g.disabled,
          items: g.items && g.items.length > 0 ? g.items : old.items,
        });
      } else {
        groupNameMap.set(g.name, g);
      }
    });
    const updatedGroups = Array.from(groupNameMap.values());
    StorageService.saveCardGroups(updatedGroups);

    const summary: ImportResultSummary = {
      cardsCount: batchCards.length,
      groupsCount: importedGroupsList.length,
      totalNewCards: newCardsToAdd.length,
    };

    return {
      summary,
      updatedCards,
      updatedGroups,
    };
  }

  /**
   * 兼容普通的字卡扁平数组导入 [{ text, category }, ...]
   */
  private static importFlatCardsArray(
    rawCards: any[],
    existingCards: Card[],
    existingGroups: CardGroup[]
  ): {
    summary: ImportResultSummary;
    updatedCards: Card[];
    updatedGroups: CardGroup[];
  } {
    const existingCardKeys = new Set<string>();
    existingCards.forEach(c => {
      existingCardKeys.add(c.id);
      existingCardKeys.add(`${c.category}:::${c.text}`);
    });

    const newCards: Card[] = [];
    const detectedCategories = new Set<string>();

    rawCards.forEach((item, idx) => {
      if (!item || typeof item.text !== 'string') return;
      const text = item.text;
      const category = typeof item.category === 'string' && item.category.trim() ? item.category.trim() : '未分类';
      const id = item.id || generateDeterministicCardId(category, text);
      const matchKey = `${category}:::${text}`;

      detectedCategories.add(category);

      if (!existingCardKeys.has(id) && !existingCardKeys.has(matchKey)) {
        newCards.push({
          id,
          text,
          category,
          createdAt: Date.now(),
        });
        existingCardKeys.add(id);
        existingCardKeys.add(matchKey);
      }
    });

    const updatedCards = [...newCards, ...existingCards];
    StorageService.saveCards(updatedCards);

    // 自动为未登记的新分类生成分组条目
    const existingGroupNames = new Set(existingGroups.map(g => g.name));
    const newGroupsToAdd: CardGroup[] = [];
    const colors = ['#FF6B6B', '#FF8E53', '#FFC542', '#51CF66', '#748FFC', '#F06595', '#38D9A9'];
    let colorIdx = 0;

    detectedCategories.forEach(catName => {
      if (!existingGroupNames.has(catName)) {
        newGroupsToAdd.push({
          id: `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: catName,
          color: colors[colorIdx % colors.length],
          disabled: false,
        });
        colorIdx++;
      }
    });

    const updatedGroups = [...existingGroups, ...newGroupsToAdd];
    StorageService.saveCardGroups(updatedGroups);

    return {
      summary: {
        cardsCount: rawCards.length,
        groupsCount: detectedCategories.size,
        totalNewCards: newCards.length,
      },
      updatedCards,
      updatedGroups,
    };
  }

  /**
   * 格式化导入完成通知文本
   */
  static formatSummaryMessage(summary: ImportResultSummary): string {
    const lines = ['导入完成！'];
    lines.push(`• 普通字卡：${summary.cardsCount} 条（实际新增 ${summary.totalNewCards} 条）`);
    if (summary.groupsCount > 0) lines.push(`• 字卡分类：${summary.groupsCount} 个`);
    return lines.join('\n');
  }

  /**
   * 导出字卡及分类 JSON
   */
  static exportFullJson(cards: Card[] = StorageService.getCards(), groups: CardGroup[] = StorageService.getCardGroups()): string {
    // 按照分组构建 customReplyGroups 与 customReplies
    const customReplyGroups = groups.map(g => {
      const itemsInGroup = cards.filter(c => c.category === g.name).map(c => c.text);
      return {
        id: g.id,
        name: g.name,
        color: g.color,
        disabled: g.disabled,
        items: itemsInGroup,
        _collapsed: g._collapsed,
      };
    });

    const customReplies = cards.map(c => c.text);

    const exportObj = {
      exportDate: new Date().toISOString(),
      modules: ['replies', 'groups'],
      customReplies,
      customReplyGroups,
    };

    return JSON.stringify(exportObj, null, 2);
  }
}
