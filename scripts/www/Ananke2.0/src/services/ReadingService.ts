import { Book, UserRecommendedBook, BackupReadingData, ImportMode } from '../types';
import { DEFAULT_CLASSIC_BOOKS, getDefaultBookCover } from '../data/defaultBooks';
import { CardEngine } from '../core/CardEngine';
import { StorageService } from './StorageService';

const READING_STORAGE_KEYS = {
  CURRENT_SHELF: 'zk_card_phone_reading_current_shelf',
  LAST_SHELF_UPDATE: 'zk_card_phone_reading_last_shelf_update',
  SHELF_UPDATE_FREQ: 'zk_card_phone_reading_shelf_update_freq',
  USER_RECOMMENDED: 'zk_card_phone_reading_user_recommended',
  USER_PREF_TAGS: 'zk_card_phone_reading_user_pref_tags',
  RECENT_TITLES: 'zk_card_phone_reading_recent_titles',
};

// 预设更新频率选项 (毫秒)
export const SHELF_UPDATE_PRESETS = [
  { label: '测试: 10秒', value: 10 * 1000 },
  { label: '3 天', value: 3 * 24 * 60 * 60 * 1000 },
  { label: '7 天 (默认)', value: 7 * 24 * 60 * 60 * 1000 },
  { label: '15 天', value: 15 * 24 * 60 * 60 * 1000 },
  { label: '30 天', value: 30 * 24 * 60 * 60 * 1000 },
];

export const DEFAULT_SHELF_FREQ_MS = 7 * 24 * 60 * 60 * 1000; // 默认7天

// 题材与领域种子，优先大众常读知名书目，在确保绝对真实不杜撰的前提下适度多样化
const DIVERSE_SEARCH_DOMAINS = [
  '中外大众文学经典与高分小说（如加缪、东野圭吾、毛姆、马尔克斯、莫言、余华等知名作者作品）',
  '大众高分科幻与奇幻佳作（如刘慈欣、阿西莫夫、特德·姜等知名作家的经典作品）',
  '通俗历史读物与人物传记（如《明朝那些事儿》《人类简史》《万历十五年》等生动名作）',
  '大众心理学、生活哲学与成长读物（如《被讨厌的勇气》《亲密关系》《自卑与超越》等经典）',
  '经典散文随笔与生活美学（如汪曾祺、史铁生、林清玄、丰子恺、杨绛等作家的散文名作）',
  '趣味自然科普与通俗新知读物（如《时间的秩序》《自私的基因》《万物简史》等知名畅销科普）',
  '知名高口碑大众网络文学经典（如《诡秘之主》《凡人修仙传》《庆余年》《全职高手》等读者熟知的知名作品）'
];

export class ReadingService {
  // 并发锁，防止前后台同时触发更新冲突
  private static isUpdatingShelfLock = false;

  static isCurrentlyUpdatingShelf(): boolean {
    return this.isUpdatingShelfLock;
  }

  // 安全读取 localStorage
  private static getItem<T>(key: string, fallback: T): T {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed !== null && parsed !== undefined) return parsed as T;
        }
      }
    } catch (e) {
      console.warn(`[ReadingService] Failed to read key ${key}:`, e);
    }
    return fallback;
  }

  // 安全写入 localStorage
  private static setItem<T>(key: string, value: T): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      console.warn(`[ReadingService] Failed to set key ${key}:`, e);
    }
  }

  // --- 历史推荐书目缓存（保持最近10本，用于大模型排重） ---
  static getRecentHistoryTitles(): string[] {
    const list = this.getItem<string[]>(READING_STORAGE_KEYS.RECENT_TITLES, []);
    return Array.isArray(list) ? list.slice(0, 10) : [];
  }

  static addRecentHistoryTitles(titles: string[]): void {
    const existing = this.getRecentHistoryTitles();
    const set = new Set([...titles.map(t => t.trim()), ...existing]);
    const updated = Array.from(set).slice(0, 10);
    this.setItem(READING_STORAGE_KEYS.RECENT_TITLES, updated);
  }

  // --- 1. 当前书架书籍 (默认初始为空白，点击查看书单才加载) ---
  static getCurrentShelfBooks(): Book[] {
    const list = this.getItem<Book[]>(READING_STORAGE_KEYS.CURRENT_SHELF, []);
    return Array.isArray(list) ? list : [];
  }

  static saveCurrentShelfBooks(books: Book[]): void {
    this.setItem(READING_STORAGE_KEYS.CURRENT_SHELF, books);
  }

  // --- 2. 书架更新时间与频率设置 ---
  static getLastShelfUpdateTime(): number {
    return this.getItem<number>(READING_STORAGE_KEYS.LAST_SHELF_UPDATE, Date.now());
  }

  static saveLastShelfUpdateTime(ts: number): void {
    this.setItem(READING_STORAGE_KEYS.LAST_SHELF_UPDATE, ts);
  }

  static getShelfUpdateFrequency(): number {
    return this.getItem<number>(READING_STORAGE_KEYS.SHELF_UPDATE_FREQ, DEFAULT_SHELF_FREQ_MS);
  }

  static saveShelfUpdateFrequency(freq: number): void {
    this.setItem(READING_STORAGE_KEYS.SHELF_UPDATE_FREQ, freq);
  }

  // --- 3. 用户推荐书单池 ---
  static getUserRecommendedBooks(): UserRecommendedBook[] {
    const list = this.getItem<UserRecommendedBook[]>(READING_STORAGE_KEYS.USER_RECOMMENDED, []);
    return Array.isArray(list) ? list : [];
  }

  static saveUserRecommendedBooks(books: UserRecommendedBook[]): void {
    this.setItem(READING_STORAGE_KEYS.USER_RECOMMENDED, books);
  }

  static addUserRecommendedBook(title: string, author: string): UserRecommendedBook {
    const list = this.getUserRecommendedBooks();
    const newBook: UserRecommendedBook = {
      id: 'user_rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      title: title.trim(),
      author: author.trim() || '佚名',
      added: false,
      createdAt: Date.now(),
    };
    const updated = [newBook, ...list];
    this.saveUserRecommendedBooks(updated);
    return newBook;
  }

  static updateUserRecommendedBook(id: string, title: string, author: string): void {
    const list = this.getUserRecommendedBooks();
    const updated = list.map(b => b.id === id ? { ...b, title: title.trim(), author: author.trim() || '佚名' } : b);
    this.saveUserRecommendedBooks(updated);
  }

  static deleteUserRecommendedBook(id: string): void {
    const list = this.getUserRecommendedBooks();
    const updated = list.filter(b => b.id !== id);
    this.saveUserRecommendedBooks(updated);
  }

  // --- 4. 用户偏好标签 ---
  static getUserPreferenceTags(): string[] {
    const list = this.getItem<string[]>(READING_STORAGE_KEYS.USER_PREF_TAGS, ['#纪实', '#散文', '#名著']);
    return Array.isArray(list) ? list : ['#纪实', '#散文', '#名著'];
  }

  static saveUserPreferenceTags(tags: string[]): void {
    const clean = Array.isArray(tags) ? Array.from(new Set(tags.map(t => t.trim()).filter(Boolean))) : [];
    this.setItem(READING_STORAGE_KEYS.USER_PREF_TAGS, clean);
  }

  // --- 5. 为书籍生成梦角读后感 (抽取 3~5 张字卡拼接) ---
  static generateBookReflection(bookTitle?: string): string {
    try {
      const cards = StorageService.getCards();
      const count = Math.floor(Math.random() * 3) + 3; // 3 ~ 5 张
      const drawn = CardEngine.drawMultipleCards(cards, count);
      if (drawn.length > 0) {
        return CardEngine.concatenateCards(drawn);
      }
    } catch {
      // ignore
    }
    // 优雅保底读后感
    const fallbacks = [
      '翻开字页的一刻，安静的心跳与字里行间的微光重合。很庆幸在这个时刻与你一同翻阅。',
      '书中藏着未曾谋面的世界，而此刻能与你共享这份安谧，便成了整本书最美的注脚。',
      '文字跨越了漫长时光来到我们眼前，正如我们总能在平静的日子里找到彼此的心声。',
      '在每一行起伏的词句里，都像是你在耳畔轻声诉说，文字也变得格外温软。',
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  // --- 微信读书报错监听 ---
  private static wereadErrorListeners: Array<(msg: string) => void> = [];

  static addWereadErrorListener(fn: (msg: string) => void): () => void {
    this.wereadErrorListeners.push(fn);
    return () => {
      this.wereadErrorListeners = this.wereadErrorListeners.filter(l => l !== fn);
    };
  }

  static notifyWereadError(msg: string = '微信读书连接失败，请检查 Key 或网络'): void {
    for (const fn of this.wereadErrorListeners) {
      try {
        fn(msg);
      } catch {
        // ignore
      }
    }
  }

  // --- 6. 检查 AI 接口是否已在设置中配置 ---
  static isAiConfigured(): boolean {
    const settings = StorageService.getSettings();
    return Boolean(settings.aiApiKey?.trim());
  }

  // --- 检查是否配置了微信读书 API Key ---
  static isWereadConfigured(): boolean {
    const settings = StorageService.getSettings();
    return Boolean(settings.wereadApiKey?.trim());
  }

  /**
   * 封装微信读书搜索函数 fetchWereadBooks
   * 接入部署好的微信读书代理后端：https://vx-reading.onrender.com/api/weread
   * 支持 mode: 'random'（纯随机推荐，无需传 keyword，count 随机 1-3）与 mode: 'tag'（标签推荐，传 keyword 与 count）
   */
  static async fetchWereadBooks(
    optionsOrKeyword: string | { mode: 'random' | 'tag'; keyword?: string; count?: number } = '文学',
    paramCount: number = 3,
    paramMode: 'random' | 'tag' = 'tag',
    onProgress?: (msg: string) => void
  ): Promise<Array<{ title: string; author: string; coverUrl?: string }>> {
    const settings = StorageService.getSettings();
    const wereadKey = settings.wereadApiKey?.trim();
    if (!wereadKey) {
      throw new Error('未配置微信读书 API Key');
    }

    let mode: 'random' | 'tag' = paramMode;
    let keyword = '文学';
    let count = paramCount;

    if (typeof optionsOrKeyword === 'object' && optionsOrKeyword !== null) {
      mode = optionsOrKeyword.mode || 'tag';
      keyword = optionsOrKeyword.keyword || '文学';
      count = optionsOrKeyword.count || 3;
    } else if (typeof optionsOrKeyword === 'string') {
      keyword = optionsOrKeyword;
    }

    // 随机推荐书籍模式下，数量随机（1-3）
    if (mode === 'random') {
      const randomCount = Math.floor(Math.random() * 3) + 1; // 1, 2, 或 3
      count = randomCount;
    }

    const endpoint = 'https://vx-reading.onrender.com/api/weread';

    if (onProgress) {
      onProgress('正在唤醒真实书库，首次启动可能需要约 50 秒，请稍候...');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 延长至 60000 毫秒（60秒，适配 Render 免费版冷启动）

    try {
      const requestBody: any = {
        mode,
        count,
      };
      if (mode === 'tag') {
        requestBody.keyword = keyword.trim() || '文学';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${wereadKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`微信读书接口响应异常 (${response.status})`);
      }

      const resData = await response.json();
      const list = resData?.books || resData?.data?.books || resData?.data || resData?.items || resData?.records || [];
      const extracted: Array<{ title: string; author: string; coverUrl?: string }> = [];

      if (Array.isArray(list)) {
        for (const item of list) {
          const b = item.bookInfo || item.book || item;
          const title = String(b.title || b.bookName || b.name || '').trim();
          const author = String(b.author || b.writer || '佚名').trim();
          const coverUrl = b.cover || b.coverUrl || b.picUrl || '';
          if (title) {
            extracted.push({ title, author, coverUrl });
          }
        }
      }

      if (extracted.length === 0) {
        throw new Error('微信读书未能找到相关书籍');
      }

      return extracted;
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn('[ReadingService] 微信读书 API 请求失败:', err);
      // 错误与跨域处理：遇到 CORS 跨域报错或 Key 无效，捕获并提示用户
      this.notifyWereadError('微信读书连接失败，请检查 Key 或网络');
      throw err;
    }
  }

  /**
   * 底层 OpenAI 兼容标准接口请求与 JSON 数组解析
   */
  private static async executeOpenAiRequest(
    endpoint: string,
    apiKey: string,
    model: string,
    prompt: string,
    temperature: number = 0.65
  ): Promise<Array<{ title: string; author: string; description: string }>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`AI 接口响应异常 (${response.status}): ${errorText.slice(0, 100) || response.statusText}`);
      }

      const data = await response.json();
      const rawContent: string = data?.choices?.[0]?.message?.content || '';

      if (!rawContent) {
        throw new Error('AI 返回内容为空');
      }

      let cleaned = rawContent.trim();
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

      // 提取 JSON 数组或对象
      let parsedArray: any[] = [];
      const firstArr = cleaned.indexOf('[');
      const lastArr = cleaned.lastIndexOf(']');
      if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
        try {
          parsedArray = JSON.parse(cleaned.slice(firstArr, lastArr + 1));
        } catch {
          // ignore
        }
      }

      if (!Array.isArray(parsedArray) || parsedArray.length === 0) {
        const firstObj = cleaned.indexOf('{');
        const lastObj = cleaned.lastIndexOf('}');
        if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
          try {
            const parsedObj = JSON.parse(cleaned.slice(firstObj, lastObj + 1));
            if (Array.isArray(parsedObj.books || parsedObj.list || parsedObj.items)) {
              parsedArray = parsedObj.books || parsedObj.list || parsedObj.items;
            } else if (parsedObj.书名 || parsedObj.title) {
              parsedArray = [parsedObj];
            }
          } catch {
            // ignore
          }
        }
      }

      const results: Array<{ title: string; author: string; description: string }> = [];
      const localSeen = new Set<string>();

      for (const item of parsedArray) {
        if (!item || typeof item !== 'object') continue;
        const title = String(item.书名 || item.title || item.bookTitle || item.name || '').trim();
        const author = String(item.作者 || item.author || item.writer || '佚名').trim();
        const description = String(
          item.一句话推荐语 || item.推荐语 || item.description || item.recommendation || item.summary || '一本值得细细品味的经典佳作。'
        ).trim();

        if (title && !localSeen.has(title)) {
          localSeen.add(title);
          results.push({ title, author, description });
        }
      }

      return results;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('请求大模型 API 超时，请检查网络连接');
      }
      throw err;
    }
  }

  // --- 7. 接入大模型 AI 进行广泛、多领域的单本/批量图书搜索推荐 ---
  static async fetchAiBookRecommendationBatch(
    count: number,
    tags: string[] = [], 
    isRandomGeneral: boolean = false,
    excludeTitles: string[] = [],
    onProgressUpdate?: (stepText: string) => void
  ): Promise<Array<{ title: string; author: string; description: string; coverUrl?: string }>> {
    const settings = StorageService.getSettings();
    const rawBase = (settings.aiBaseUrl || '').trim() || 'https://api.siliconflow.cn/v1';
    const apiKey = (settings.aiApiKey || '').trim();
    const model = (settings.aiModel || '').trim() || 'Qwen/Qwen2.5-7B-Instruct';

    if (!apiKey) {
      throw new Error('请先在设置中配置 AI 接口');
    }

    let endpoint = rawBase;
    if (!endpoint.endsWith('/chat/completions')) {
      endpoint = `${endpoint.replace(/\/+$/, '')}/chat/completions`;
    }

    const proxyUrl = (settings.aiProxyUrl || '').trim();
    if (proxyUrl) {
      if (proxyUrl.includes('?url=') || proxyUrl.includes('%s')) {
        endpoint = proxyUrl.includes('%s')
          ? proxyUrl.replace('%s', encodeURIComponent(endpoint))
          : `${proxyUrl}${encodeURIComponent(endpoint)}`;
      } else if (proxyUrl.endsWith('/chat/completions')) {
        endpoint = proxyUrl;
      } else {
        endpoint = `${proxyUrl.replace(/\/+$/, '')}/chat/completions`;
      }
    }

    const cleanTags = tags.map(t => t.replace(/^[#＃\s]+/, '').trim()).filter(Boolean);
    const tagsStr = cleanTags.length > 0 ? cleanTags.join('、') : '经典文学、人文历史、心理成长、知名科普';

    // 整合历史推荐书名（本地自动追踪最近10本）及当前书架已占用的书名，做排重
    const historyTitles = this.getRecentHistoryTitles().slice(0, 10);
    const combinedExcluded = Array.from(new Set([...excludeTitles, ...historyTitles])).slice(0, 10);
    const excludeStr = combinedExcluded.length > 0 
      ? `\n【近期已推荐过的这几本书请避开，换其他真实大众好书】：[${combinedExcluded.join('、')}]` 
      : '';

    // =========================================================================
    // 【微信读书 API 接入推荐流程】
    // 第一步：调用 fetchWereadBooks() 拿到真实的书名和作者
    // 第二步：把拿到的书目发给 AI
    // 第三步：将 AI 生成的推荐语和真实书目一起展示给用户
    // =========================================================================
    const wereadKey = settings.wereadApiKey?.trim();
    if (wereadKey) {
      try {
        let wereadKeyword = cleanTags.length > 0 ? cleanTags[0] : '';
        if (!wereadKeyword) {
          const kwList = ['经典文学', '高分小说', '科幻', '历史', '心理学', '随笔', '人文社科'];
          wereadKeyword = kwList[Math.floor(Math.random() * kwList.length)];
        }

        // 第一步：调用 fetchWereadBooks() 拿到真实的书名和作者
        const wereadBooks = await this.fetchWereadBooks(
          isRandomGeneral
            ? { mode: 'random' }
            : { mode: 'tag', keyword: wereadKeyword, count: Math.max(count, 3) },
          3,
          'tag',
          onProgressUpdate
        );
        if (wereadBooks && wereadBooks.length > 0) {
          let chosen = wereadBooks.filter(b => !combinedExcluded.includes(b.title));
          if (chosen.length === 0) {
            chosen = wereadBooks;
          }
          const selectedWeread = chosen.slice(0, count);

          // 第二步：把拿到的真实书目发给 AI
          const bookListPrompt = selectedWeread
            .map((b, i) => `${i + 1}. 《${b.title}》 作者：${b.author}`)
            .join('\n');

          const promptForWeread = `你是一个专业的图书推荐助手。我们已从微信读书真实书库中检索到以下真实书籍：
${bookListPrompt}

【核心任务】：
1. 必须完全保留上述书名和作者，绝对不要篡改书名或自行杜撰任何不存在的书！真实性是第一位的。
2. 请为上述每一本书撰写一段富有感染力、温馨精辟的一句话推荐语。
请严格只返回一个 JSON 数组格式（不要包含 markdown 代码块以外的任何文字），格式如下：
[
  {"书名": "${selectedWeread[0].title}", "作者": "${selectedWeread[0].author}", "一句话推荐语": "精彩推荐语1"}${selectedWeread.length > 1 ? ',\n  {"书名": "' + selectedWeread[1].title + '", "作者": "' + selectedWeread[1].author + '", "一句话推荐语": "精彩推荐语2"}' : ''}
]`;

          const aiItems = await this.executeOpenAiRequest(endpoint, apiKey, model, promptForWeread, 0.65);
          // 第三步：将 AI 生成的推荐语和真实书目（含微信读书封面）一起展示给用户
          const merged: Array<{ title: string; author: string; description: string; coverUrl?: string }> = [];
          for (const wb of selectedWeread) {
            const matchedAi = aiItems.find(a => a.title === wb.title || wb.title.includes(a.title) || a.title.includes(wb.title));
            merged.push({
              title: wb.title,
              author: wb.author,
              description: matchedAi?.description || '微信读书精选真实好书，值得静心品味。',
              coverUrl: wb.coverUrl,
            });
          }

          if (merged.length > 0) {
            this.addRecentHistoryTitles(merged.map(m => m.title));
            return merged;
          }
        }
      } catch (err: any) {
        console.warn('[ReadingService] 微信读书流程失败，自动降级至原有大模型推荐:', err);
        // fetchWereadBooks 中已经触发了 notifyWereadError('微信读书连接失败，请检查 Key 或网络')
        // 自动降级至下方原有的 AI 推荐流程，确保书籍加载不中断
      }
    }

    // =========================================================================
    // 【原有大模型推荐流程：未填微信读书 Key 或连接失败时降级保持原样】
    // =========================================================================
    // 随机注入题材种子，引导在不同大众领域中换换口味
    const randomGenre = DIVERSE_SEARCH_DOMAINS[Math.floor(Math.random() * DIVERSE_SEARCH_DOMAINS.length)];

    const prompt = isRandomGeneral
      ? `你是一个专业的图书推荐助手。请推荐 ${count} 本真实存在的优质大众图书。
【核心要求（至关重要）】：
1. 绝对严禁杜撰！必须是真实出版或广为人知的大众书籍，绝对不能自己瞎编或生造不存在的书名和作者。书籍真实性是第一位的。
2. 优先推荐大众广泛阅读、口碑良好的经典作品与知名作家代表作。切勿为了追求生僻小众而编造不存在的书。
3. 请保持适度多样性，本次推荐可参考【${randomGenre}】及其他大众常读领域，挑选不同作者的代表作。
${excludeStr}
请严格只返回一个 JSON 数组格式（不要包含 markdown 代码块以外的任何文字），格式如下：
[
  {"书名": "真实书名1", "作者": "真实作者1", "一句话推荐语": "简要推荐语1"}${count > 1 ? ',\n  {"书名": "真实书名2", "作者": "真实作者2", "一句话推荐语": "简要推荐语2"}' : ''}
]`
      : `你是一个专业的图书推荐助手。请根据偏好标签【${tagsStr}】，推荐 ${count} 本真实存在的优质书籍。
【核心要求（至关重要）】：
1. 绝对严禁杜撰！必须是真实出版或广为人知的大众书籍，绝对不能自己瞎编或生造不存在的书名和作者。书籍真实性是第一位的。
2. 优先推荐该标签下大众熟知、口碑良好且真实存在的经典作品或知名作者代表作，切勿瞎编冷门书名。
3. 在真实大众书籍范围内兼顾多样性。
${excludeStr}
请严格只返回一个 JSON 数组格式：
[
  {"书名": "真实书名1", "作者": "真实作者1", "一句话推荐语": "简要推荐语1"}
]`;

    try {
      const aiItems = await this.executeOpenAiRequest(endpoint, apiKey, model, prompt, 0.65);
      const results: Array<{ title: string; author: string; description: string; coverUrl?: string }> = [];
      const localSeen = new Set<string>();

      for (const item of aiItems) {
        if (item.title && !localSeen.has(item.title) && !combinedExcluded.includes(item.title)) {
          localSeen.add(item.title);
          results.push(item);
        }
      }

      if (results.length > 0) {
        this.addRecentHistoryTitles(results.map(r => r.title));
        return results;
      }

      throw new Error('AI 返回数据中未包含有效书名');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('请求大模型 API 超时，请检查网络连接');
      }
      throw err;
    }
  }

  // 单本书推荐便捷方法
  static async fetchAiBookRecommendation(
    tags: string[] = [], 
    isRandomGeneral: boolean = false,
    excludeTitles: string[] = [],
    onProgressUpdate?: (stepText: string) => void
  ): Promise<{ title: string; author: string; description: string; coverUrl?: string }> {
    const list = await this.fetchAiBookRecommendationBatch(1, tags, isRandomGeneral, excludeTitles, onProgressUpdate);
    if (list.length > 0) return list[0];
    throw new Error('未能获取到有效的书籍推荐');
  }

  // --- 8. 封面获取与兜底逻辑 ---
  static resolveBookCover(title: string, author?: string): string {
    const matched = DEFAULT_CLASSIC_BOOKS.find(b => b.title === title || title.includes(b.title));
    if (matched && matched.coverUrl) {
      return matched.coverUrl;
    }
    return getDefaultBookCover(title, author);
  }

  // --- 9. 书架定期与手动更新逻辑 (后台预留充足时间加载，避免加载过急失败) ---
  static async checkAndUpdateShelf(force: boolean = false): Promise<{ updated: boolean; books: Book[] }> {
    // 防重入并发锁
    if (this.isUpdatingShelfLock) {
      return { updated: false, books: this.getCurrentShelfBooks() };
    }

    const now = Date.now();
    const lastUpdate = this.getLastShelfUpdateTime();
    const frequency = this.getShelfUpdateFrequency();

    const isOverdue = (now - lastUpdate) > frequency;

    if (!isOverdue && !force) {
      return { updated: false, books: this.getCurrentShelfBooks() };
    }

    this.isUpdatingShelfLock = true;

    try {
      // 随机决定更新后新书的数量（1~3 本随机）
      const targetCount = Math.floor(Math.random() * 3) + 1; // 1 ~ 3 本
      const newShelfBooks: Book[] = [];
      const usedTitles = new Set<string>(); // 用于严格确保上架的书完全不同

      // 1. 优先检查用户推荐池中未上架的书（added为false的）
      const recommended = this.getUserRecommendedBooks();
      const unadded = recommended.filter(r => !r.added && !usedTitles.has(r.title.trim()));

      // 取最多 2 本优先上架
      const toAddCount = Math.min(2, unadded.length, targetCount);
      const chosenRecommended = unadded.slice(0, toAddCount);

      for (const rec of chosenRecommended) {
        const cleanTitle = rec.title.trim();
        if (usedTitles.has(cleanTitle)) continue;

        usedTitles.add(cleanTitle);
        const coverUrl = this.resolveBookCover(cleanTitle, rec.author);
        newShelfBooks.push({
          id: `book_rec_${rec.id}`,
          title: cleanTitle,
          author: rec.author,
          coverUrl,
          firstPublishYear: '你的推荐', // 用户推荐的书目，来源严格写：你的推荐
          description: '这本由你推荐的心仪之书，梦角已经在书架上认真翻阅。',
          reflection: this.generateBookReflection(cleanTitle),
        });

        // 将其 added 设为 true（已经加入过的书不要重复抽取加入，只能加一次）
        rec.added = true;
      }

      // 更新用户推荐池状态
      if (chosenRecommended.length > 0) {
        this.saveUserRecommendedBooks(recommended);
      }

      // 2. 剩余名额：预留充足时间让 API 搜索书籍和加载书籍（一次批量并行请求，高效且保证多样）
      let remainingCount = targetCount - newShelfBooks.length;
      if (remainingCount > 0) {
        const hasAi = this.isAiConfigured();
        let apiSuccess = false;

        if (hasAi) {
          try {
            // 一次性批量搜索并加载所需数量的书籍，给 API 预留充足时间加载好
            const aiRecs = await this.fetchAiBookRecommendationBatch(
              remainingCount, 
              [], 
              true, 
              Array.from(usedTitles)
            );

            if (aiRecs && aiRecs.length > 0) {
              apiSuccess = true;
              for (let i = 0; i < aiRecs.length && newShelfBooks.length < targetCount; i++) {
                const item = aiRecs[i];
                const cleanTitle = item.title.trim();
                if (cleanTitle && !usedTitles.has(cleanTitle)) {
                  usedTitles.add(cleanTitle);
                  const coverUrl = this.resolveBookCover(cleanTitle, item.author);
                  newShelfBooks.push({
                    id: `book_ai_shelf_${Date.now()}_${i}`,
                    title: cleanTitle,
                    author: item.author,
                    coverUrl,
                    firstPublishYear: '梦角精心推荐',
                    description: item.description,
                    reflection: this.generateBookReflection(cleanTitle),
                  });
                }
              }
            }
          } catch (err) {
            console.warn('[ReadingService] Shelf batch AI search failed:', err);
          }
        }

        // 如果 API 未成功返回（失败或未配置），才从本地经典预设库完全随机乱序挑选不重复的书籍补齐兜底
        if (!apiSuccess) {
          const stillNeeded = targetCount - newShelfBooks.length;
          if (stillNeeded > 0) {
            const candidates = DEFAULT_CLASSIC_BOOKS.filter(b => !usedTitles.has(b.title.trim()));
            const shuffled = [...candidates].sort(() => Math.random() - 0.5);
            const chosen = shuffled.slice(0, stillNeeded);

            chosen.forEach(b => {
              usedTitles.add(b.title.trim());
              newShelfBooks.push({
                ...b,
                firstPublishYear: '梦角精心推荐',
                reflection: this.generateBookReflection(b.title),
              });
            });
          }
        }
      }

      // 3. 最终保障：确保书架上绝对没有任何重复书名的书
      const distinctBooks: Book[] = [];
      const distinctSet = new Set<string>();
      for (const b of newShelfBooks) {
        const cleanT = b.title.trim();
        if (!distinctSet.has(cleanT)) {
          distinctSet.add(cleanT);
          distinctBooks.push(b);
        }
      }

      // 4. 后台预先全部加载完毕后，再统一替换显示书架并更新时间戳
      this.saveCurrentShelfBooks(distinctBooks);
      this.saveLastShelfUpdateTime(now);

      return { updated: true, books: distinctBooks };
    } finally {
      this.isUpdatingShelfLock = false;
    }
  }

  // --- 10. 梦角推荐抽书逻辑 (核心交互) ---
  /**
   * 抽书按钮“梦角推荐”：
   * - 点击后，若未配置 AI 接口，返回提示“请先在设置中配置 AI 接口”。
   * - 点击后，弹出 Loading 遮罩，带有翻书动画。
   * - 调用大模型 API 推荐书籍，展示翻书动画 10~20 秒，动画页面明确告知用户需 10~20 秒。
   * - 有 10% 概率梦角查找失败，界面显示：梦角：对不起，没有找到合适的书推荐给你…（小字标注：梦角暂时不知道推荐什么）
   * - 抽取结果后，展示书籍卡片，来源标注为“梦角精心推荐”，并在卡片下方用 CardEngine 随机抽 3~5 张拼字卡作为梦角的推荐语。
   */
  static async executeCharacterBookRecommendation(
    tags: string[],
    onProgressUpdate?: (stepText: string) => void
  ): Promise<{ success: boolean; book?: Book; reflection?: string; message?: string; needConfig?: boolean }> {
    if (!this.isAiConfigured()) {
      return {
        success: false,
        needConfig: true,
        message: '请先在设置中配置 AI 接口',
      };
    }

    // 执行翻书动画等待逻辑 (保持 10~20 秒)
    const waitMs = Math.floor(Math.random() * 10000) + 10000; // 10000ms ~ 20000ms
    const startTime = Date.now();

    // 阶段性展示翻书进度文案
    if (onProgressUpdate) {
      onProgressUpdate('梦角正在书架寻找...');
      setTimeout(() => onProgressUpdate('在浩瀚书海中翻阅书卷...'), 3500);
      setTimeout(() => onProgressUpdate('挑选最契合此时心境的一页...'), 7500);
      setTimeout(() => onProgressUpdate('写下读书手记与拼字卡心声...'), 11500);
    }

    let aiResult: { title: string; author: string; description: string } | null = null;
    let apiError: string | null = null;

    try {
      aiResult = await this.fetchAiBookRecommendation(tags, false, [], onProgressUpdate);
    } catch (err: any) {
      apiError = err?.message || '大模型请求未返回结果';
      console.warn('[ReadingService] AI recommendation error:', err);
    }

    // 补足剩余等待时间以展示完整 10~20 秒翻书动画
    const elapsed = Date.now() - startTime;
    if (elapsed < waitMs) {
      await new Promise(resolve => setTimeout(resolve, waitMs - elapsed));
    }

    // 如果 API 调用报错或超时
    if (!aiResult) {
      return {
        success: false,
        message: apiError || '大模型未能成功推荐书籍，请检查接口配置或网络后重试。',
      };
    }

    // 10% 概率梦角查找失败 (由 20% 改为 10%)
    const isFailure = Math.random() < 0.10;
    if (isFailure) {
      return {
        success: false,
        message: '梦角暂时不知道推荐什么',
      };
    }

    const coverUrl = (aiResult as any).coverUrl || this.resolveBookCover(aiResult.title, aiResult.author);
    const reflection = this.generateBookReflection(aiResult.title);

    const book: Book = {
      id: `book_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: aiResult.title,
      author: aiResult.author,
      coverUrl,
      firstPublishYear: '梦角精心推荐',
      description: aiResult.description,
      reflection,
    };

    return {
      success: true,
      book,
      reflection,
    };
  }

  // --- 11. 备份与数据恢复接入 ---
  static getBackupData(): BackupReadingData {
    return {
      currentShelfBooks: this.getCurrentShelfBooks(),
      lastShelfUpdateTime: this.getLastShelfUpdateTime(),
      shelfUpdateFrequency: this.getShelfUpdateFrequency(),
      userRecommendedBooks: this.getUserRecommendedBooks(),
      userPreferenceTags: this.getUserPreferenceTags(),
    };
  }

  static restoreFromBackup(
    data: BackupReadingData, 
    mode: ImportMode
  ): { importedCount: number; skippedCount: number; details: string } {
    if (mode === 'overwrite') {
      const shelf = Array.isArray(data.currentShelfBooks) ? data.currentShelfBooks : [];
      const recs = Array.isArray(data.userRecommendedBooks) ? data.userRecommendedBooks : [];
      const tags = Array.isArray(data.userPreferenceTags) ? data.userPreferenceTags : ['#纪实', '#散文', '#名著'];
      this.saveCurrentShelfBooks(shelf);
      this.saveLastShelfUpdateTime(typeof data.lastShelfUpdateTime === 'number' ? data.lastShelfUpdateTime : Date.now());
      this.saveShelfUpdateFrequency(typeof data.shelfUpdateFrequency === 'number' ? data.shelfUpdateFrequency : DEFAULT_SHELF_FREQ_MS);
      this.saveUserRecommendedBooks(recs);
      this.saveUserPreferenceTags(tags);
      return {
        importedCount: shelf.length + recs.length,
        skippedCount: 0,
        details: `覆盖为 ${shelf.length} 本在架书目、${recs.length} 条待读推荐及偏好标签`,
      };
    } else {
      // 合并模式
      const localShelf = this.getCurrentShelfBooks();
      const incomingShelf = Array.isArray(data.currentShelfBooks) ? data.currentShelfBooks : [];
      const localTitles = new Set(localShelf.map(b => b.title.trim()));
      let addedShelf = 0;
      let skippedShelf = 0;
      const mergedShelf = [...localShelf];

      // 若本地书架为空，直接填入导入书目
      if (localShelf.length === 0 && incomingShelf.length > 0) {
        mergedShelf.push(...incomingShelf.slice(0, 3));
        addedShelf += Math.min(3, incomingShelf.length);
      } else {
        for (const b of incomingShelf) {
          if (mergedShelf.length < 3 && !localTitles.has(b.title.trim())) {
            mergedShelf.push(b);
            localTitles.add(b.title.trim());
            addedShelf++;
          } else {
            skippedShelf++;
          }
        }
      }
      this.saveCurrentShelfBooks(mergedShelf);

      // 推荐书单池合并
      const localRecs = this.getUserRecommendedBooks();
      const incomingRecs = Array.isArray(data.userRecommendedBooks) ? data.userRecommendedBooks : [];
      const recKeySet = new Set(localRecs.map(r => `${r.title.trim()}__${r.author.trim()}`));
      const mergedRecs = [...localRecs];
      let addedRec = 0;
      let skippedRec = 0;

      for (const r of incomingRecs) {
        const key = `${r.title.trim()}__${r.author.trim()}`;
        if (!recKeySet.has(key)) {
          mergedRecs.push(r);
          recKeySet.add(key);
          addedRec++;
        } else {
          skippedRec++;
        }
      }
      this.saveUserRecommendedBooks(mergedRecs);

      // 偏好标签合并
      const localTags = this.getUserPreferenceTags();
      const incomingTags = Array.isArray(data.userPreferenceTags) ? data.userPreferenceTags : [];
      const combinedTags = Array.from(new Set([...localTags, ...incomingTags]));
      this.saveUserPreferenceTags(combinedTags);

      return {
        importedCount: addedShelf + addedRec,
        skippedCount: skippedShelf + skippedRec,
        details: `合并新增 ${addedShelf} 本在架书目、${addedRec} 条待读书目（去重跳过 ${skippedShelf + skippedRec} 条）`,
      };
    }
  }
}
