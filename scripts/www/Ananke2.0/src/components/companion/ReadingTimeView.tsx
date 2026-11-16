import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  RefreshCw, 
  Clock, 
  X, 
  Check, 
  AlertCircle, 
  Library, 
  BookmarkCheck, 
  Tag, 
  Pencil,
  Trash2,
  Key,
  Globe,
  Sliders,
  Eye,
  EyeOff,
  Share2
} from 'lucide-react';
import { Book, Character, UserRecommendedBook, Message } from '../../types';
import { 
  ReadingService, 
  SHELF_UPDATE_PRESETS 
} from '../../services/ReadingService';
import { StorageService } from '../../services/StorageService';
import { PRESET_PREFERENCE_CAPSULES, getDefaultBookCover } from '../../data/defaultBooks';

interface ReadingTimeViewProps {
  character: Character;
  showToast: (msg: string) => void;
  onSendMessage?: (msg: Message) => void;
  onNavigateToChat?: () => void;
}

export const ReadingTimeView: React.FC<ReadingTimeViewProps> = ({
  character,
  showToast,
  onSendMessage,
  onNavigateToChat,
}) => {
  const charDisplayName = character.nickname || character.name;

  // 1. 书架书籍与更新状态 (默认初始为空白)
  const [shelfBooks, setShelfBooks] = useState<Book[]>(() => ReadingService.getCurrentShelfBooks());
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(() => ReadingService.getLastShelfUpdateTime());
  const [updateFrequency, setUpdateFrequency] = useState<number>(() => ReadingService.getShelfUpdateFrequency());
  const [isUpdatingShelf, setIsUpdatingShelf] = useState<boolean>(false);
  const [selectedBookForDetail, setSelectedBookForDetail] = useState<Book | null>(null);

  // 2. 偏好标签与输入
  const [tags, setTags] = useState<string[]>(() => ReadingService.getUserPreferenceTags());
  const [customTagInput, setCustomTagInput] = useState<string>('');

  // 3. 梦角抽书推荐状态
  const [isRecommending, setIsRecommending] = useState<boolean>(false);
  const [recommendProgressText, setRecommendProgressText] = useState<string>('梦角正在书架寻找...');
  const [recommendResult, setRecommendResult] = useState<{ book?: Book; reflection?: string; message?: string; success: boolean; needConfig?: boolean } | null>(null);
  const [showRecommendModal, setShowRecommendModal] = useState<boolean>(false);

  // 4. 用户推荐书单
  const [userRecs, setUserRecs] = useState<UserRecommendedBook[]>(() => ReadingService.getUserRecommendedBooks());
  const [recTitle, setRecTitle] = useState<string>('');
  const [recAuthor, setRecAuthor] = useState<string>('');
  const [recSuccessNotice, setRecSuccessNotice] = useState<string | null>(null);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState<boolean>(false);

  // 5. 编辑推荐书单弹窗状态
  const [editingRec, setEditingRec] = useState<UserRecommendedBook | null>(null);
  const [editRecTitle, setEditRecTitle] = useState<string>('');
  const [editRecAuthor, setEditRecAuthor] = useState<string>('');

  // 6. 自定义大模型 AI API 状态与弹窗 (只有点击保存配置才保存，点击取消不保存)
  const [isAiReady, setIsAiReady] = useState<boolean>(() => ReadingService.isAiConfigured());
  const [showApiModal, setShowApiModal] = useState<boolean>(false);
  const [draftBaseUrl, setDraftBaseUrl] = useState<string>(() => StorageService.getSettings().aiBaseUrl || 'https://api.siliconflow.cn/v1');
  const [draftApiKey, setDraftApiKey] = useState<string>(() => StorageService.getSettings().aiApiKey || '');
  const [draftModel, setDraftModel] = useState<string>(() => StorageService.getSettings().aiModel || 'Qwen/Qwen2.5-7B-Instruct');
  const [draftProxyUrl, setDraftProxyUrl] = useState<string>(() => StorageService.getSettings().aiProxyUrl || '');
  const [draftWereadApiKey, setDraftWereadApiKey] = useState<string>(() => StorageService.getSettings().wereadApiKey || '');
  const [showKeySecret, setShowKeySecret] = useState<boolean>(false);
  const [showWereadSecret, setShowWereadSecret] = useState<boolean>(false);

  const openApiModal = () => {
    const s = StorageService.getSettings();
    setDraftBaseUrl(s.aiBaseUrl || 'https://api.siliconflow.cn/v1');
    setDraftApiKey(s.aiApiKey || '');
    setDraftModel(s.aiModel || 'Qwen/Qwen2.5-7B-Instruct');
    setDraftProxyUrl(s.aiProxyUrl || '');
    setDraftWereadApiKey(s.wereadApiKey || '');
    setShowKeySecret(false);
    setShowWereadSecret(false);
    setShowApiModal(true);
  };

  // 每次打开弹窗时保证拉取本地最新持久化的 API 数据
  useEffect(() => {
    if (showApiModal) {
      const s = StorageService.getSettings();
      setDraftBaseUrl(s.aiBaseUrl || 'https://api.siliconflow.cn/v1');
      setDraftApiKey(s.aiApiKey || '');
      setDraftModel(s.aiModel || 'Qwen/Qwen2.5-7B-Instruct');
      setDraftProxyUrl(s.aiProxyUrl || '');
      setDraftWereadApiKey(s.wereadApiKey || '');
    }
  }, [showApiModal]);

  // 页面载入时执行周期性检查与后台同步
  useEffect(() => {
    const syncShelf = () => {
      const current = ReadingService.getCurrentShelfBooks();
      setShelfBooks(current);
      setLastUpdateTime(ReadingService.getLastShelfUpdateTime());
      setUserRecs(ReadingService.getUserRecommendedBooks());
    };

    const initialBooks = ReadingService.getCurrentShelfBooks();
    if (initialBooks.length > 0) {
      ReadingService.checkAndUpdateShelf(false).then(res => {
        if (res.updated) {
          setShelfBooks(res.books);
          setLastUpdateTime(Date.now());
          setUserRecs(ReadingService.getUserRecommendedBooks());
          showToast(`书架已定期更新，${charDisplayName}为你换上了新书卷！`);
        }
      });
    }

    const unsubscribeWereadError = ReadingService.addWereadErrorListener((msg) => {
      showToast(msg);
    });

    window.addEventListener('storage', syncShelf);
    const interval = setInterval(syncShelf, 3000);
    return () => {
      unsubscribeWereadError();
      window.removeEventListener('storage', syncShelf);
      clearInterval(interval);
    };
  }, []);

  // 点击「查看书单」加载/刷新第1批或新一批书架书籍（生成时长 10 秒）
  const handleViewBookList = async () => {
    if (!ReadingService.isAiConfigured()) {
      showToast('请先配置大模型 AI 接口以生成书单');
      openApiModal();
      return;
    }

    setIsUpdatingShelf(true);
    const startTime = Date.now();
    // 生成时长 10s (10000ms)
    const targetDelay = 10000;

    try {
      const res = await ReadingService.checkAndUpdateShelf(true);
      const elapsed = Date.now() - startTime;
      if (elapsed < targetDelay) {
        await new Promise(r => setTimeout(r, targetDelay - elapsed));
      }
      setShelfBooks(res.books);
      setLastUpdateTime(Date.now());
      setUserRecs(ReadingService.getUserRecommendedBooks());
      showToast('书单已更新！');
    } catch {
      showToast('书单生成失败，请检查网络或 AI 接口配置');
    } finally {
      setIsUpdatingShelf(false);
    }
  };

  // 将书架上的书分享到聊天框：只显示书名/作者/推荐语，不要加其他废话，点击后从分享界面退出
  const handleShareBookToChat = (book: Book) => {
    const content = `《${book.title}》\n作者：${book.author}\n推荐语：${book.description || '一本值得细细品味的经典佳作。'}`;
    const newMsg: Message = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      characterId: character.id,
      sender: 'user',
      timestamp: Date.now(),
      cards: [],
      text: content,
      type: 'text',
    };

    if (onSendMessage) {
      onSendMessage(newMsg);
    } else {
      const msgs = StorageService.getMessages();
      StorageService.saveMessages([...msgs, newMsg]);
    }
    showToast(`已将《${book.title}》详情分享到聊天框！`);
    // 用户点击分享到聊天后，界面从详情/分享弹窗退出，代表分享成功
    setSelectedBookForDetail(null);
  };

  // 保存偏好标签
  const handleAddTag = (tagToAdd: string) => {
    const clean = tagToAdd.trim().replace(/^#+/, '');
    if (!clean) return;
    const formatted = `#${clean}`;
    if (!tags.includes(formatted)) {
      const nextTags = [...tags, formatted];
      setTags(nextTags);
      ReadingService.saveUserPreferenceTags(nextTags);
    }
    setCustomTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const nextTags = tags.filter(t => t !== tagToRemove);
    setTags(nextTags);
    ReadingService.saveUserPreferenceTags(nextTags);
  };

  // 处理输入框按回车或逗号分隔添加标签
  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const parts = customTagInput.split(/[,，]/);
      parts.forEach(p => handleAddTag(p));
    }
  };

  // 取消 API 配置编辑：不保存修改，恢复已保存的配置并关闭
  const handleCancelApiSettings = () => {
    const s = StorageService.getSettings();
    setDraftBaseUrl(s.aiBaseUrl || 'https://api.siliconflow.cn/v1');
    setDraftApiKey(s.aiApiKey || '');
    setDraftModel(s.aiModel || 'Qwen/Qwen2.5-7B-Instruct');
    setDraftProxyUrl(s.aiProxyUrl || '');
    setDraftWereadApiKey(s.wereadApiKey || '');
    setShowApiModal(false);
  };

  // 保存自定义 AI 与微信读书接口配置 (点击保存时才写入)
  const handleSaveApiSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const currentSettings = StorageService.getSettings();
    const nextBase = draftBaseUrl.trim() || 'https://api.siliconflow.cn/v1';
    const nextKey = draftApiKey.trim();
    const nextModel = draftModel.trim() || 'Qwen/Qwen2.5-7B-Instruct';
    const nextProxy = draftProxyUrl.trim();
    const nextWereadKey = draftWereadApiKey.trim();

    if (!nextKey) {
      showToast('请输入大模型 API Key');
      return;
    }

    const updated = {
      ...currentSettings,
      aiBaseUrl: nextBase,
      aiApiKey: nextKey,
      aiModel: nextModel,
      aiProxyUrl: nextProxy,
      wereadApiKey: nextWereadKey,
    };
    StorageService.saveSettings(updated);
    setIsAiReady(true);
    setShowApiModal(false);
    showToast(nextWereadKey ? 'AI 与微信读书接口配置已保存！' : 'AI 接口配置已保存！');
  };

  // 触发梦角抽书推荐
  const handleTriggerRecommendation = async () => {
    if (!ReadingService.isAiConfigured()) {
      showToast('请先在设置中配置 AI 接口');
      openApiModal();
      return;
    }

    setIsRecommending(true);
    setShowRecommendModal(true);
    setRecommendProgressText('梦角正在书架寻找...');

    try {
      const result = await ReadingService.executeCharacterBookRecommendation(
        tags,
        (progress) => setRecommendProgressText(progress)
      );

      if (result.needConfig) {
        setShowRecommendModal(false);
        showToast('请先在设置中配置 AI 接口');
        openApiModal();
        return;
      }

      setRecommendResult(result);
    } catch {
      setRecommendResult({
        success: false,
        message: '寻找书本时起了一阵微风，暂时没有找到合适的书，稍后再试一次吧。',
      });
    } finally {
      setIsRecommending(false);
    }
  };

  // 用户提交推荐书目
  const handleSubmitUserRecommendation = (e: React.FormEvent) => {
    e.preventDefault();
    const t = recTitle.trim();
    if (!t) {
      showToast('请输入要推荐的书名');
      return;
    }

    ReadingService.addUserRecommendedBook(t, recAuthor.trim());
    setUserRecs(ReadingService.getUserRecommendedBooks());
    setRecTitle('');
    setRecAuthor('');
    setRecSuccessNotice(`已放入${charDisplayName}的待读书单，TA将在下次更新时优先阅读！`);
    setTimeout(() => setRecSuccessNotice(null), 5000);
  };

  // 打开编辑待读书单
  const handleStartEdit = (rec: UserRecommendedBook) => {
    setEditingRec(rec);
    setEditRecTitle(rec.title);
    setEditRecAuthor(rec.author);
  };

  // 保存待读书单编辑
  const handleSaveEdit = () => {
    if (!editingRec) return;
    const t = editRecTitle.trim();
    if (!t) {
      showToast('书名不能为空');
      return;
    }
    ReadingService.updateUserRecommendedBook(editingRec.id, t, editRecAuthor.trim());
    setUserRecs(ReadingService.getUserRecommendedBooks());
    setEditingRec(null);
    showToast('推荐书目已修改！');
  };

  // 删除待读书单（下次不再加入书架）
  const handleDeleteRec = (id: string, title: string) => {
    ReadingService.deleteUserRecommendedBook(id);
    setUserRecs(ReadingService.getUserRecommendedBooks());
    showToast(`已将《${title}》从待读书单移除，下次不会上架`);
  };

  // 将书目加入书架
  const handleAddBookToShelf = (book: Book) => {
    if (shelfBooks.some(b => b.title === book.title)) {
      showToast('这本书已经在当前书架上了哦');
      return;
    }
    const updated = [book, ...shelfBooks.slice(0, 2)];
    setShelfBooks(updated);
    ReadingService.saveCurrentShelfBooks(updated);
    showToast(`已将《${book.title}》放入书架！`);
  };

  // 计算下次更新时间提示
  const nextUpdateTime = lastUpdateTime + updateFrequency;
  const remainingMs = Math.max(0, nextUpdateTime - Date.now());
  const remainingSecs = Math.ceil(remainingMs / 1000);
  const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

  const currentFreqLabel = SHELF_UPDATE_PRESETS.find(p => p.value === updateFrequency)?.label || '7 天 (默认)';

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      {/* ========================================================================= */}
      {/* 0. 顶端 API 接入提示条 (需要接入自己的 API 使用)                             */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-amber-900/15 bg-gradient-to-r from-amber-50 via-orange-50/40 to-amber-50/20 p-3 shadow-2xs flex items-center justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="text-xs text-neutral-800 leading-snug">
            <p className="font-semibold text-[11px] text-amber-950 flex items-center gap-1.5">
              <span>需接入自己的大模型 API 使用</span>
              {isAiReady ? (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-normal">
                  已配置
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-200/80 text-amber-900 font-normal">
                  未配置
                </span>
              )}
            </p>
            <p className="text-[10px] text-neutral-500 mt-0.5">
              共读时光图书推荐需使用你在「设置」中填入的大模型 API（Base URL、API Key 与 Model 名称）。
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openApiModal}
          className="px-2.5 py-1.5 rounded-xl bg-amber-900/10 hover:bg-amber-900/20 text-amber-900 text-[10px] font-medium shrink-0 cursor-pointer transition-colors border border-amber-900/10"
        >
          {isAiReady ? '接口设置' : '配置接口'}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. 梦角阅读书架 (温润实木书架质感，默认初始为空白)                           */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-amber-900/10 bg-gradient-to-b from-[#fbf8f3] via-[#f7f2ea] to-[#eee5d8] p-4 shadow-sm relative overflow-hidden">
        {/* 顶栏信息与更新控制 */}
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-amber-900/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-amber-800/10 flex items-center justify-center text-amber-900">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <span>梦角阅读书架</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-normal">
                  {shelfBooks.length} 本
                </span>
              </h3>
              <p className="text-[9px] text-neutral-500">
                {shelfBooks.length === 0 
                  ? '书架暂未摆放书卷 · 点击查看书单生成'
                  : remainingMs <= 0 
                  ? '书架即将随步履刷新' 
                  : updateFrequency <= 30000
                  ? `约 ${remainingSecs} 秒后换新`
                  : remainingHours < 24 
                  ? `约 ${remainingHours} 小时后换新` 
                  : `约 ${remainingDays} 天后更新`} · 周期 {currentFreqLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* 切换周期按钮 */}
            <button
              type="button"
              onClick={() => setShowFrequencyPicker(true)}
              className="p-1.5 rounded-xl bg-white/70 hover:bg-white text-neutral-600 border border-amber-900/10 text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
              title="设置书架更新周期"
            >
              <Clock className="w-3 h-3 text-amber-800" />
              <span>周期</span>
            </button>

            {/* 查看书单按钮 */}
            <button
              type="button"
              onClick={handleViewBookList}
              disabled={isUpdatingShelf}
              className={`p-1.5 px-2 rounded-xl bg-amber-900/85 hover:bg-amber-900 text-white text-[10px] flex items-center gap-1 cursor-pointer transition-all shadow-2xs ${
                isUpdatingShelf ? 'opacity-70 animate-pulse' : ''
              }`}
              title="点击查看书单加载新书（约需10秒）"
            >
              <RefreshCw className={`w-3 h-3 ${isUpdatingShelf ? 'animate-spin' : ''}`} />
              <span>{isUpdatingShelf ? '正在挑选书目 (约10秒)...' : '查看书单'}</span>
            </button>
          </div>
        </div>

        {/* 拟物木质书架陈列区 (初始为空白时展示提示) */}
        <div className="pt-2 pb-6 px-2 flex items-end justify-around gap-2.5 relative min-h-[168px]">
          {shelfBooks.length === 0 ? (
            <div className="w-full py-8 flex flex-col items-center justify-center text-center space-y-2.5 z-10">
              <div className="w-10 h-10 rounded-full bg-amber-900/10 flex items-center justify-center text-amber-900">
                <BookOpen className="w-5 h-5 opacity-60" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-neutral-700">书架暂无书籍</p>
                <p className="text-[10px] text-neutral-500 max-w-xs">
                  点击右上角「查看书单」，梦角将随机为你推荐并上架心仪藏书
                </p>
              </div>
              <button
                type="button"
                onClick={handleViewBookList}
                disabled={isUpdatingShelf}
                className="mt-1 px-3 py-1.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-[11px] font-medium flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isUpdatingShelf ? 'animate-spin' : ''}`} />
                <span>{isUpdatingShelf ? '正在由 AI 挑选书卷 (约10秒)...' : '查看书单'}</span>
              </button>
            </div>
          ) : (
            shelfBooks.map((book) => (
              <div
                key={book.id}
                onClick={() => setSelectedBookForDetail(book)}
                className="group flex flex-col items-center cursor-pointer transition-transform hover:-translate-y-2 relative"
                style={{ perspective: '800px' }}
              >
                {/* 3D 悬浮书籍封皮 */}
                <div 
                  className="w-20 h-28 sm:w-22 sm:h-32 rounded-r-md rounded-l-xs overflow-hidden shadow-lg border-y border-r border-amber-950/20 relative transition-all group-hover:shadow-2xl bg-neutral-100"
                  style={{
                    transform: 'rotateY(-8deg)',
                    boxShadow: '-4px 6px 12px rgba(60, 40, 20, 0.28), inset 3px 0 6px rgba(255, 255, 255, 0.25)',
                  }}
                >
                  {/* 书脊折痕光影 */}
                  <div className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/40 via-white/10 to-transparent z-10 pointer-events-none" />
                  {book.firstPublishYear === '你的推荐' && (
                    <div className="absolute top-1 right-1 z-20 px-1 py-0.5 rounded-md bg-amber-600/90 text-[8px] text-white font-medium shadow-xs border border-amber-400/40 leading-none">
                      你的推荐
                    </div>
                  )}
                  <img 
                    src={book.coverUrl} 
                    alt={book.title} 
                    className="w-full h-full object-cover" 
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = getDefaultBookCover(book.title, book.author);
                    }}
                  />
                </div>

                {/* 书名与作者 */}
                <div className="mt-2 text-center w-22">
                  <span className="text-[10px] font-bold text-neutral-800 line-clamp-1 block group-hover:text-amber-900 transition-colors">
                    {book.title}
                  </span>
                  <span className="text-[9px] text-neutral-400 line-clamp-1 block">
                    {book.author}
                  </span>
                </div>
              </div>
            ))
          )}

          {/* 拟物木架托板 (Wooden Shelf Plank) */}
          <div 
            className="absolute -bottom-1 left-0 right-0 h-4 rounded-xs border-t border-amber-950/30"
            style={{
              background: 'linear-gradient(to bottom, #d4a373 0%, #b07d4b 40%, #8c5828 100%)',
              boxShadow: '0 6px 14px rgba(65, 40, 15, 0.35)',
            }}
          >
            {/* 木纹高光边 */}
            <div className="w-full h-0.5 bg-amber-200/40" />
          </div>
        </div>

        <p className="text-[10px] text-center text-amber-900/60 mt-3 pt-1">
          ✦ 点击可查看书籍详情和梦角手记 ✦
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 2. 梦角推荐抽书模块 (核心交互)                                            */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-neutral-200/80 bg-white p-4 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-pink-50 flex items-center justify-center text-pink-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-neutral-800">梦角荐书 · 灵感抽取</h3>
              <p className="text-[10px] text-neutral-400">输入或点选偏好标签，让TA在浩瀚书海中挑选一本</p>
            </div>
          </div>
        </div>

        {/* 偏好标签快捷胶囊按钮 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-neutral-500">
            <span className="flex items-center gap-1">
              <Tag className="w-3 h-3 text-pink-500" />
              <span>常用风格灵感</span>
            </span>
            <span className="text-[9px] text-neutral-400">点击自动填入</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_PREFERENCE_CAPSULES.map(cap => {
              const isSelected = tags.includes(cap);
              return (
                <button
                  key={cap}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      handleRemoveTag(cap);
                    } else {
                      handleAddTag(cap);
                    }
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-pink-50 border-pink-300 text-pink-700 font-medium shadow-2xs'
                      : 'bg-neutral-50 border-neutral-200/80 text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {cap}
                </button>
              );
            })}
          </div>
        </div>

        {/* 标签管理与输入框 */}
        <div className="p-2.5 rounded-2xl bg-neutral-50/80 border border-neutral-200/70 space-y-2">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map(t => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 text-[10px] bg-white border border-neutral-200 px-2 py-0.5 rounded-full text-neutral-700 shadow-2xs"
                >
                  <span>{t}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="text-neutral-400 hover:text-rose-500 cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customTagInput}
              onChange={e => setCustomTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
              placeholder="输入标签（支持逗号或回车分隔，如：治愈, 宇宙）"
              className="flex-1 bg-white border border-neutral-200/90 rounded-xl px-2.5 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-pink-400"
            />
            <button
              type="button"
              onClick={() => handleAddTag(customTagInput)}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-900 text-white text-xs rounded-xl font-medium shrink-0 cursor-pointer transition-colors"
            >
              添加
            </button>
          </div>
        </div>

        {/* 核心抽取按钮“梦角推荐” */}
        <button
          type="button"
          onClick={handleTriggerRecommendation}
          disabled={isRecommending}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white font-bold text-xs tracking-wide shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-200 animate-spin" style={{ animationDuration: '4s' }} />
          <span>让「{charDisplayName}」在书架中推荐</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. 用户推荐书单模块                                                       */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-neutral-200/80 bg-white p-4 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Library className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-neutral-800">向梦角推荐共读书目</h3>
              <p className="text-[10px] text-neutral-400">下次书架更新时，TA将优先上架你推荐的书</p>
            </div>
          </div>
        </div>

        {recSuccessNotice && (
          <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{recSuccessNotice}</span>
          </div>
        )}

        <form onSubmit={handleSubmitUserRecommendation} className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-neutral-500 block mb-1">书名 *</label>
              <input
                type="text"
                required
                value={recTitle}
                onChange={e => setRecTitle(e.target.value)}
                placeholder="例如：云雀叫了一整天"
                className="w-full bg-neutral-50 border border-neutral-200/80 rounded-xl px-2.5 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 block mb-1">作者 (选填)</label>
              <input
                type="text"
                value={recAuthor}
                onChange={e => setRecAuthor(e.target.value)}
                placeholder="例如：木心"
                className="w-full bg-neutral-50 border border-neutral-200/80 rounded-xl px-2.5 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-2xs"
          >
            放入待读书单
          </button>
        </form>

        {/* 已推荐列表（可编辑、可删除） */}
        {userRecs.length > 0 && (
          <div className="pt-2 border-t border-neutral-100 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-neutral-400 px-1">
              <span>待读与已读清单 ({userRecs.length})</span>
              <span>支持编辑与删除</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {userRecs.map(rec => (
                <div
                  key={rec.id}
                  className="p-2.5 rounded-xl bg-neutral-50/80 border border-neutral-200/60 flex items-center justify-between text-xs transition-all hover:bg-neutral-100/50"
                >
                  <div className="min-w-0 pr-2 flex-1">
                    <span className="font-medium text-neutral-800 block truncate">
                      《{rec.title}》
                    </span>
                    <span className="text-[10px] text-neutral-400 block truncate">
                      {rec.author || '佚名'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                        rec.added
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {rec.added ? '已在书架共读 · 你的推荐' : '待更新上架'}
                    </span>

                    {/* 编辑按钮 */}
                    <button
                      type="button"
                      onClick={() => handleStartEdit(rec)}
                      className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 cursor-pointer transition-colors"
                      title="编辑书目"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {/* 删除按钮 */}
                    <button
                      type="button"
                      onClick={() => handleDeleteRec(rec.id, rec.title)}
                      className="p-1 rounded-md text-neutral-400 hover:text-rose-500 hover:bg-rose-50 cursor-pointer transition-colors"
                      title="从书单删除（下次不再上架）"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. 书籍详情与梦角读后感 Modal (已移除分享到聊天功能)                        */}
      {/* ========================================================================= */}
      {selectedBookForDetail && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in select-none"
          onClick={() => setSelectedBookForDetail(null)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh] animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            {/* 顶栏关闭 */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <BookmarkCheck className="w-4 h-4 text-amber-700" />
                <span>书卷手记</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedBookForDetail(null)}
                className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1 text-xs">
              {/* 封面与基础信息 */}
              <div className="flex gap-3.5 items-start">
                <div className="w-20 h-28 rounded-lg overflow-hidden shadow-md shrink-0 border border-neutral-200 bg-neutral-100">
                  <img 
                    src={selectedBookForDetail.coverUrl} 
                    alt={selectedBookForDetail.title} 
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      e.currentTarget.src = getDefaultBookCover(selectedBookForDetail.title, selectedBookForDetail.author);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-neutral-900 leading-snug">
                    《{selectedBookForDetail.title}》
                  </h4>
                  <p className="text-[11px] text-neutral-600">
                    作者：{selectedBookForDetail.author}
                  </p>
                  <p className="text-[10px] text-amber-800/80 font-medium">
                    来源：{selectedBookForDetail.firstPublishYear === '你的推荐' ? '你的推荐' : '梦角精心推荐'}
                  </p>
                  {selectedBookForDetail.description && (
                    <p className="text-[10px] text-neutral-500 line-clamp-3 leading-relaxed mt-1">
                      {selectedBookForDetail.description}
                    </p>
                  )}
                </div>
              </div>

              {/* 梦角读后感 (由 3~5 张字卡拼接而成) */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50/70 via-pink-50/40 to-neutral-50 border border-amber-200/60 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full overflow-hidden border border-pink-200 shrink-0">
                    <img src={character.avatar} alt={charDisplayName} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[11px] font-bold text-neutral-800">
                    {charDisplayName} 的共读心声
                  </span>
                  <span className="text-[9px] text-amber-800 bg-amber-100/70 px-1.5 py-0.2 rounded-full font-serif">
                    字卡拼接手记
                  </span>
                </div>

                <p className="text-xs text-neutral-700 leading-relaxed font-serif italic pl-2 border-l-2 border-amber-400/80">
                  “{selectedBookForDetail.reflection || '翻开这一页，安静的字句如同你手心的温度。'}”
                </p>
              </div>
            </div>

            {/* 底部动作：分享到聊天 与 收好手记 */}
            <div className="pt-3 border-t border-neutral-100 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleShareBookToChat(selectedBookForDetail)}
                className="flex-1 py-2.5 rounded-xl bg-amber-900/10 hover:bg-amber-900/20 text-amber-900 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-amber-900/15 transition-colors"
                title="将书目详情分享到聊天框"
              >
                <Share2 className="w-3.5 h-3.5 text-amber-800" />
                <span>分享到聊天</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedBookForDetail(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs flex items-center justify-center cursor-pointer shadow-xs transition-colors"
              >
                <span>收好手记</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. 梦角推荐抽书 Loading 与结果 Modal (真实 3D 翻书动画，无多余分享功能)    */}
      {/* ========================================================================= */}
      {showRecommendModal && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in select-none">
          <div 
            className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-neutral-200/90 overflow-hidden flex flex-col items-center text-center animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            {isRecommending ? (
              /* 真实仿真 3D 翻书动画 (多页连绵翻折，书脊与翻页光影) */
              <div className="py-6 space-y-6 flex flex-col items-center">
                {/* 翻页 CSS Keyframes */}
                <style>{`
                  @keyframes realisticBookFlip {
                    0% {
                      transform: rotateY(0deg);
                      box-shadow: -1px 2px 4px rgba(0,0,0,0.06);
                    }
                    50% {
                      transform: rotateY(-90deg) scale(1.04);
                      box-shadow: 0 8px 16px rgba(0,0,0,0.16);
                    }
                    100% {
                      transform: rotateY(-180deg);
                      box-shadow: 1px 2px 4px rgba(0,0,0,0.06);
                    }
                  }
                `}</style>

                {/* 3D 展开实景书本容器 */}
                <div className="relative w-40 h-28 flex items-center justify-center" style={{ perspective: '800px' }}>
                  {/* 书籍底部呼吸柔光阴影 */}
                  <div 
                    className="absolute -bottom-2 left-3 right-3 h-4 rounded-full bg-amber-950/20 blur-md animate-pulse"
                    style={{ animationDuration: '2s' }}
                  />

                  {/* 展开的精装书本底座 */}
                  <div className="w-36 h-24 rounded-sm bg-[#5c3718] border border-[#3d240e] shadow-xl relative flex overflow-hidden">
                    {/* 左半边摊开的书页 */}
                    <div className="w-1/2 h-full bg-[#fcfaf2] border-r border-amber-900/15 p-2 flex flex-col justify-around relative">
                      <div className="space-y-1.5 opacity-40">
                        <div className="w-11 h-1 bg-amber-950/40 rounded-full" />
                        <div className="w-9 h-1 bg-amber-950/30 rounded-full" />
                        <div className="w-12 h-1 bg-amber-950/35 rounded-full" />
                        <div className="w-8 h-1 bg-amber-950/25 rounded-full" />
                      </div>
                      {/* 书脊内陷渐变阴影 */}
                      <div className="absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-amber-950/25 to-transparent pointer-events-none" />
                    </div>

                    {/* 中央装订书脊 */}
                    <div className="w-1 h-full bg-gradient-to-r from-amber-950/60 via-amber-900/30 to-amber-950/60 shrink-0 z-20" />

                    {/* 右半边摊开的书页 */}
                    <div className="w-1/2 h-full bg-[#fcfaf2] p-2 flex flex-col justify-around relative">
                      <div className="space-y-1.5 opacity-40">
                        <div className="w-10 h-1 bg-amber-950/30 rounded-full ml-auto" />
                        <div className="w-12 h-1 bg-amber-950/40 rounded-full ml-auto" />
                        <div className="w-8 h-1 bg-amber-950/25 rounded-full ml-auto" />
                        <div className="w-11 h-1 bg-amber-950/35 rounded-full ml-auto" />
                      </div>
                      {/* 书脊内陷渐变阴影 */}
                      <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-amber-950/25 to-transparent pointer-events-none" />
                    </div>
                  </div>

                  {/* 3 张顺畅循环翻转的真实纸页 */}
                  {[
                    { delay: '0s', id: 1 },
                    { delay: '0.45s', id: 2 },
                    { delay: '0.9s', id: 3 },
                  ].map(p => (
                    <div
                      key={p.id}
                      className="absolute top-2 right-2 w-[70px] h-24 origin-left pointer-events-none"
                      style={{
                        transformStyle: 'preserve-3d',
                        animation: 'realisticBookFlip 1.35s cubic-bezier(0.4, 0.05, 0.6, 0.95) infinite',
                        animationDelay: p.delay,
                      }}
                    >
                      <div className="w-full h-full bg-gradient-to-r from-[#fcfaf4] via-[#f7f2e4] to-[#f0e8d6] border-r border-y border-amber-950/20 rounded-r-xs p-2 flex flex-col justify-around relative overflow-hidden shadow-xs">
                        <div className="space-y-1.5 opacity-50">
                          <div className="w-9 h-1 bg-amber-900/30 rounded-full" />
                          <div className="w-11 h-1 bg-amber-900/25 rounded-full" />
                          <div className="w-8 h-1 bg-amber-900/20 rounded-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-neutral-800 tracking-wide">
                    {recommendProgressText}
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    {charDisplayName}正在细细翻阅书海，挑选最契合心境的书卷
                  </p>
                  <div className="pt-1">
                    <span className="text-[10px] text-amber-800 bg-amber-50/90 border border-amber-200/70 px-2.5 py-1 rounded-full font-medium inline-block">
                      预计需 10~20 秒，请稍候…
                    </span>
                  </div>
                </div>
              </div>
            ) : recommendResult ? (
              recommendResult.success && recommendResult.book ? (
                /* 抽选成功卡片展示 */
                <div className="w-full space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                    <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-pink-500" />
                      <span>{charDisplayName}的专属荐书</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowRecommendModal(false)}
                      className="text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 书籍信息 */}
                  <div className="flex gap-3 text-left bg-neutral-50/70 p-3 rounded-2xl border border-neutral-200/70">
                    <div className="w-16 h-24 rounded-md overflow-hidden shadow-sm shrink-0 border border-neutral-200 bg-neutral-100">
                      <img 
                        src={recommendResult.book.coverUrl} 
                        alt={recommendResult.book.title} 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          e.currentTarget.src = getDefaultBookCover(recommendResult.book!.title, recommendResult.book!.author);
                        }}
                      />
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-neutral-900 line-clamp-1">
                        《{recommendResult.book.title}》
                      </h4>
                      <p className="text-[11px] text-neutral-600 line-clamp-1">
                        {recommendResult.book.author}
                      </p>
                      <p className="text-[9px] text-amber-800/80 font-medium">
                        来源：梦角精心推荐
                      </p>
                      <p className="text-[10px] text-neutral-500 line-clamp-2 leading-relaxed">
                        {recommendResult.book.description}
                      </p>
                    </div>
                  </div>

                  {/* 梦角推荐语 (由 CardEngine 随机抽取 3~5 张拼字卡) */}
                  <div className="p-3 rounded-2xl bg-pink-50/60 border border-pink-200/70 text-left space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full overflow-hidden border border-pink-200 shrink-0">
                        <img src={character.avatar} alt={charDisplayName} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[11px] font-bold text-pink-900">
                        {charDisplayName}的推荐语
                      </span>
                    </div>
                    <p className="text-xs text-neutral-700 font-serif italic pl-2 border-l-2 border-pink-400 leading-relaxed">
                      “{recommendResult.reflection || recommendResult.book.reflection || '在无垠的字句中遇见你，便有了最好的章节。'}”
                    </p>
                  </div>

                  {/* 动作按钮 (仅保留加入书架与关闭，取消分享聊天) */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        handleAddBookToShelf(recommendResult.book!);
                        setShowRecommendModal(false);
                      }}
                      className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-medium cursor-pointer shadow-xs transition-colors"
                    >
                      加入当前书架
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRecommendModal(false)}
                      className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-medium cursor-pointer transition-colors"
                    >
                      好的
                    </button>
                  </div>
                </div>
              ) : (
                /* 20% 概率查找失败或无结果模式 */
                <div className="py-6 space-y-4 w-full">
                  <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                    <AlertCircle className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5 text-center">
                    <h4 className="text-sm font-bold text-neutral-800">
                      梦角：对不起，没有找到合适的书推荐给你…
                    </h4>
                    <p className="text-xs text-neutral-400 leading-relaxed px-4">
                      梦角暂时不知道推荐什么
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRecommendModal(false)}
                    className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold cursor-pointer transition-colors"
                  >
                    我知道啦，换个标签试试
                  </button>
                </div>
              )
            ) : null}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. 书架更新周期设置弹窗 (测试周期仅保留 10秒)                             */}
      {/* ========================================================================= */}
      {showFrequencyPicker && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in select-none"
          onClick={() => setShowFrequencyPicker(false)}
        >
          <div 
            className="bg-white w-full max-w-xs rounded-3xl p-5 shadow-2xl border border-neutral-200 space-y-4 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-700" />
                <span>书架定期更新频率</span>
              </span>
              <button
                type="button"
                onClick={() => setShowFrequencyPicker(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              {SHELF_UPDATE_PRESETS.map(preset => {
                const isSelected = updateFrequency === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      setUpdateFrequency(preset.value);
                      ReadingService.saveShelfUpdateFrequency(preset.value);
                      setShowFrequencyPicker(false);
                      showToast(`已设置更新频率为：${preset.label}`);
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-amber-600 bg-amber-50 text-amber-950 font-bold'
                        : 'border-neutral-200/80 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    <span>{preset.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-700" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. 修改待读书单弹窗                                                       */}
      {/* ========================================================================= */}
      {editingRec && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in select-none"
          onClick={() => setEditingRec(null)}
        >
          <div 
            className="bg-white w-full max-w-xs rounded-3xl p-5 shadow-2xl border border-neutral-200 space-y-4 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5 text-emerald-600" />
                <span>修改待读书目</span>
              </span>
              <button
                type="button"
                onClick={() => setEditingRec(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-[10px] text-neutral-500 block mb-1">书名 *</label>
                <input
                  type="text"
                  value={editRecTitle}
                  onChange={e => setEditRecTitle(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200/90 rounded-xl px-2.5 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-500 block mb-1">作者</label>
                <input
                  type="text"
                  value={editRecAuthor}
                  onChange={e => setEditRecAuthor(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200/90 rounded-xl px-2.5 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium cursor-pointer shadow-xs transition-colors"
              >
                保存修改
              </button>
              <button
                type="button"
                onClick={() => setEditingRec(null)}
                className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl text-xs font-medium cursor-pointer transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. 大模型 AI 接口快速配置弹窗                                             */}
      {/* ========================================================================= */}
      {showApiModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in select-none"
          onClick={handleCancelApiSettings}
        >
          <div 
            className="bg-white w-full max-w-sm max-h-[70vh] rounded-3xl p-4 shadow-2xl border border-neutral-200 flex flex-col animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            {/* 固定的顶栏 */}
            <div className="flex items-center justify-between pb-2.5 border-b border-neutral-100 shrink-0">
              <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>大模型与书库接口配置</span>
              </span>
              <button
                type="button"
                onClick={handleCancelApiSettings}
                className="text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 可滑动表单内容区 (弹窗外框大小保持稳定，内部平滑滚动) */}
            <form onSubmit={handleSaveApiSettings} className="flex-1 overflow-y-auto pr-1 py-2 space-y-3.5">
              <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-[10px] text-amber-900 leading-relaxed space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <Globe className="w-3 h-3 text-amber-700" />
                  <span>支持所有兼容 OpenAI 格式的标准 API 接口</span>
                </p>
                <p className="text-amber-800/80">
                  默认推荐硅基流动提供的 <strong>Qwen/Qwen2.5-7B-Instruct</strong>（该模型可免费使用），亦支持 DeepSeek、OpenAI、Kimi 等。API Key 仅保存在本机浏览器中。
                </p>
              </div>

              <div>
                <label className="text-[10px] font-medium text-neutral-600 block mb-1">
                  Base URL (大模型接口地址)
                </label>
                <input
                  type="text"
                  value={draftBaseUrl}
                  onChange={e => setDraftBaseUrl(e.target.value)}
                  placeholder="https://api.siliconflow.cn/v1"
                  className="w-full bg-neutral-50 border border-neutral-200/90 rounded-xl px-2.5 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
                <span className="text-[9px] text-neutral-400 mt-0.5 block">
                  默认：https://api.siliconflow.cn/v1（硅基流动）
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-medium text-neutral-600">
                    大模型 API Key (密钥) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowKeySecret(!showKeySecret)}
                    className="text-[9px] text-neutral-400 hover:text-neutral-600 flex items-center gap-0.5 cursor-pointer"
                  >
                    {showKeySecret ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                    <span>{showKeySecret ? '隐藏' : '显示'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showKeySecret ? 'text' : 'password'}
                    required
                    value={draftApiKey}
                    onChange={e => setDraftApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-neutral-50 border border-neutral-200/90 rounded-xl pl-2.5 pr-8 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                  <Key className="w-3 h-3 text-neutral-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
                <span className="text-[9px] text-neutral-400 mt-0.5 block">
                  由用户填入，仅保存在用户浏览器本地
                </span>
              </div>

              <div>
                <label className="text-[10px] font-medium text-neutral-600 block mb-1">
                  Model (模型名称)
                </label>
                <input
                  type="text"
                  value={draftModel}
                  onChange={e => setDraftModel(e.target.value)}
                  placeholder="Qwen/Qwen2.5-7B-Instruct"
                  className="w-full bg-neutral-50 border border-neutral-200/90 rounded-xl px-2.5 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
                <span className="text-[9px] text-neutral-400 mt-0.5 block">
                  默认：Qwen/Qwen2.5-7B-Instruct（该模型在硅基流动上免费使用）
                </span>
              </div>

              <div>
                <label className="text-[10px] font-medium text-neutral-600 block mb-1">
                  自定义代理中转地址 (Proxy URL，选填)
                </label>
                <input
                  type="text"
                  value={draftProxyUrl}
                  onChange={e => setDraftProxyUrl(e.target.value)}
                  placeholder="例如：https://my-proxy.workers.dev"
                  className="w-full bg-neutral-50 border border-neutral-200/90 rounded-xl px-2.5 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
                <span className="text-[9px] text-neutral-400 mt-0.5 block">
                  选填。用于支持那些不开放浏览器直接 CORS 跨域请求的 API 接口
                </span>
              </div>

              {/* 微信读书 API Key (选填，真实书库来源) */}
              <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-50/90 via-emerald-50/50 to-teal-50/40 border border-emerald-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="text-xs font-bold text-emerald-950">
                      微信读书 API Key (选填)
                    </span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-100/90 text-emerald-800 font-medium border border-emerald-200/60">
                    真实书库来源
                  </span>
                </div>
                <div className="space-y-1 text-[10px] text-emerald-900/85 leading-relaxed">
                  <p>
                    接入后，微信读书将作为书目搜索来源，是重要的接入口。
                  </p>
                  <p className="text-emerald-700 font-medium bg-white/70 p-1.5 rounded-lg border border-emerald-200/50">
                    💡 非必填：即使不接入微信读书 API，用户自己配置的大模型 API 也可以正常使用推荐功能。
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[9.5px] font-medium text-emerald-900">
                      微信读书 Token (Key)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowWereadSecret(!showWereadSecret)}
                      className="text-[9px] text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 cursor-pointer"
                    >
                      {showWereadSecret ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                      <span>{showWereadSecret ? '隐藏' : '显示'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showWereadSecret ? 'text' : 'password'}
                      value={draftWereadApiKey}
                      onChange={e => setDraftWereadApiKey(e.target.value)}
                      placeholder="wrk-..."
                      className="w-full bg-white border border-emerald-300/80 rounded-xl pl-2.5 pr-8 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                    <Key className="w-3 h-3 text-emerald-400 absolute right-2.5 top-2.5 pointer-events-none" />
                  </div>
                  <span className="text-[9px] text-emerald-700/70 mt-0.5 block">
                    格式为 <code>wrk-</code> 开头，保存在本地 localStorage 中
                  </span>
                </div>
              </div>

              {/* 固定的底部操作按钮 */}
              <div className="flex gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                >
                  保存配置
                </button>
                <button
                  type="button"
                  onClick={handleCancelApiSettings}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl text-xs font-medium cursor-pointer transition-colors"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
