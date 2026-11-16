import { Card, CardGroup } from '../types';

// 预设中不含任何默认分类，用户可自行添加、修改与删除分类，或通过导入旧版 JSON 恢复
export const DEFAULT_CARD_GROUPS: CardGroup[] = [];

// 预设中不含任何默认自带字卡，用户可自行批量添加或导入 JSON
export const DEFAULT_CARDS: Card[] = [];

export const CARD_CATEGORIES = ['全部', '未分类'];
