/**
 * CardEngine: 字卡抽取与拼接引擎
 * 核心原则：纯随机、无权重、不根据历史记录调整概率
 */

import { Card } from '../types';
import { ProbabilityEngine } from './ProbabilityEngine';
import { StorageService } from '../services/StorageService';

export class CardEngine {
  /**
   * 获取有效字卡池（过滤掉已被用户禁用的分类；纯随机，无权重）
   */
  static getActivePool(cards: Card[], category?: string): Card[] {
    let disabledNames: Set<string>;
    try {
      const groups = StorageService.getCardGroups();
      disabledNames = new Set(groups.filter(g => g.disabled).map(g => g.name));
    } catch {
      disabledNames = new Set();
    }

    let pool = cards;
    // 如果存在被禁用的分类，优先排除禁用分类
    if (disabledNames.size > 0) {
      const enabled = pool.filter(c => !disabledNames.has(c.category));
      if (enabled.length > 0) {
        pool = enabled;
      }
    }

    if (category && category !== '全部') {
      const filtered = pool.filter(c => c.category === category);
      if (filtered.length > 0) {
        return filtered;
      }
    }

    return pool.length > 0 ? pool : cards;
  }

  /**
   * 从指定字卡池纯随机抽取 1 张字卡
   */
  static drawRandomCard(cards: Card[], category?: string): Card | null {
    const pool = this.getActivePool(cards, category);
    if (pool.length === 0) return null;
    return ProbabilityEngine.pickRandom(pool) ?? null;
  }

  /**
   * 纯随机抽取指定数量的字卡
   */
  static drawMultipleCards(cards: Card[], count: number, category?: string): Card[] {
    const pool = this.getActivePool(cards, category);
    if (pool.length === 0) return [];
    return ProbabilityEngine.pickRandomMultiple(pool, count);
  }

  /**
   * 按照数量范围 [minCount, maxCount] 纯随机抽取字卡
   */
  static drawCardsByRange(cards: Card[], minCount: number, maxCount: number, category?: string): Card[] {
    const count = ProbabilityEngine.randomInt(Math.max(1, minCount), Math.max(minCount, maxCount));
    return this.drawMultipleCards(cards, count, category);
  }

  /**
   * 将多张字卡以中文逗号拼接为一条文本
   * 例如：“你吃饭了吗，你在干嘛，我想你了”
   */
  static concatenateCards(cards: Card[]): string {
    return cards.map(c => c.text.trim()).filter(Boolean).join('，');
  }

  /**
   * 搜索字卡
   */
  static searchCards(cards: Card[], keyword: string): Card[] {
    if (!keyword.trim()) return cards;
    const lower = keyword.toLowerCase();
    return cards.filter(c => c.text.toLowerCase().includes(lower) || c.category.toLowerCase().includes(lower));
  }
}
