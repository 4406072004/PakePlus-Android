/**
 * ProbabilityEngine: 统一负责所有概率判断与随机抽取
 * 不把 Math.random() 散落在各组件中
 */

export class ProbabilityEngine {
  /**
   * 判断指定概率事件是否发生
   * @param probability 概率值 0 ~ 1, 例如 0.03 表示 3%
   */
  static randomChance(probability: number): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return Math.random() < probability;
  }

  /**
   * 从数组中纯随机抽取一个元素
   */
  static pickRandom<T>(items: T[]): T | undefined {
    if (!items || items.length === 0) return undefined;
    const index = Math.floor(Math.random() * items.length);
    return items[index];
  }

  /**
   * 从数组中纯随机抽取指定数量不重复的元素（若数量超过原数组长度则全部打乱返回）
   */
  static pickRandomMultiple<T>(items: T[], count: number): T[] {
    if (!items || items.length === 0 || count <= 0) return [];
    const pool = [...items];
    const result: T[] = [];
    const maxDraw = Math.min(count, pool.length);

    for (let i = 0; i < maxDraw; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      result.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return result;
  }

  /**
   * 生成指定闭区间的随机整数 [min, max]
   */
  static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 角色回复字卡数量分布：
   * 75%: 1张
   * 20%: 2张
   * 5%: 3张
   */
  static getReplyCardCount(): number {
    const r = Math.random();
    if (r < 0.75) return 1;
    if (r < 0.95) return 2;
    return 3;
  }

  /**
   * 拍一拍触发概率：3%
   */
  static checkPoke(): boolean {
    return this.randomChance(0.03);
  }

  /**
   * 已读不回概率：5%
   */
  static checkReadWithoutReply(): boolean {
    return this.randomChance(0.05);
  }

  /**
   * 表情包 Sticker 概率：20%
   */
  static checkSticker(): boolean {
    return this.randomChance(0.2);
  }

  /**
   * Emoji 概率：20%
   */
  static checkEmoji(): boolean {
    return this.randomChance(0.2);
  }

  /**
   * 引用回复概率：10%
   */
  static checkReplyTo(): boolean {
    return this.randomChance(0.1);
  }

  /**
   * 陪伴邀请是否接受：65%接受，35%拒绝
   */
  static checkCompanionAccept(): boolean {
    return this.randomChance(0.65);
  }
}
