import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  ChevronLeft,
  Download, 
  Upload, 
  Plus, 
  Trash2, 
  Search, 
  MessageSquare, 
  Layers, 
  CheckCircle2,
  AlertCircle,
  Edit2,
  Check,
  X,
  CheckSquare,
  Square,
  HandMetal,
  Smile,
  Clock,
  Quote,
  Send,
  Sparkles,
  Palette,
  RotateCcw,
  Sliders,
  Code,
  Image as ImageIcon,
  Type,
  ChevronDown,
  ChevronUp,
  Gift,
  Volume2,
  ShieldCheck,
  Server,
  Eye,
  EyeOff,
  FolderInput
} from 'lucide-react';
import { 
  Card, 
  CardGroup, 
  ImportResultSummary, 
  PhoneSettings, 
  Character, 
  BubbleCustomStyle,
  Message
} from '../../types';
import { CardImportService } from '../../services/cardImportService';
import { 
  StorageService, 
  DEFAULT_CUSTOM_POKES, 
  DEFAULT_CUSTOM_STATUSES 
} from '../../services/StorageService';
import { FontStorageService } from '../../services/FontStorageService';
import { MINIMAX_SPEECH_MODELS, MiniMaxTtsService } from '../../services/MiniMaxTtsService';
import { playMessageSound } from '../../utils/soundEffects';

interface ChatSettingsViewProps {
  cards: Card[];
  onUpdateCards: (newCards: Card[]) => void;
  settings: PhoneSettings;
  onUpdateSettings?: (newSettings: Partial<PhoneSettings>) => void;
  character: Character;
  onUpdateCharacter?: (newChar: Partial<Character>) => void;
  messages?: Message[];
  onUpdateMessages?: (newMessages: Message[]) => void;
  onBack: () => void;
}

const PRESET_PALETTE = [
  '#FF6B6B', '#FF8E53', '#FFC542', '#51CF66', '#4DABF7', 
  '#748FFC', '#F06595', '#38D9A9', '#845EF7', '#20C997', 
  '#FA5252', '#E64980', '#BE4BDB', '#4C6EF5', '#15AABF'
];

/**
 * 拍一拍格式化器：
 * 角色…我，我…角色
 */
export function buildPokeMessageText(
  rawAction: string,
  isUserSender: boolean,
  charName: string
): string {
  const trimmed = rawAction.trim();
  const roleName = `「${charName}」`;

  // 如果动作包含 … 或 ...
  if (trimmed.includes('…') || trimmed.includes('...')) {
    const placeholder = trimmed.includes('…') ? '…' : '...';
    if (isUserSender) {
      return `我${trimmed.replace(placeholder, roleName)}`;
    } else {
      return `${roleName}${trimmed.replace(placeholder, '我')}`;
    }
  }

  // 如果动作包含“你”
  if (trimmed.includes('你')) {
    if (isUserSender) {
      return `我${trimmed.replace(/你/g, roleName)}`;
    } else {
      return `${roleName}${trimmed.replace(/你/g, '我')}`;
    }
  }

  // 基础标准格式：
  // 我...角色: 我[动作]角色
  // 角色...我: 角色[动作]我
  if (isUserSender) {
    return `我${trimmed}${roleName}`;
  } else {
    return `${roleName}${trimmed}我`;
  }
}

/**
 * 将用户输入的自定义 CSS 字符串安全解析为 React 样式对象
 */
export function parseCssDeclarations(css?: string): React.CSSProperties {
  if (!css || !css.trim()) return {};
  const style: Record<string, string> = {};
  css.split(';').forEach(rule => {
    const colonIdx = rule.indexOf(':');
    if (colonIdx > 0) {
      const prop = rule.slice(0, colonIdx).trim();
      const val = rule.slice(colonIdx + 1).trim();
      if (prop && val) {
        const camelProp = prop.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        style[camelProp] = val;
      }
    }
  });
  return style as React.CSSProperties;
}

export const ChatSettingsView: React.FC<ChatSettingsViewProps> = ({
  cards,
  onUpdateCards,
  settings,
  onUpdateSettings,
  character,
  onUpdateCharacter,
  messages = [],
  onUpdateMessages,
  onBack,
}) => {
  // 三大部分切换：1. 字卡设置，2. 聊天设置，3. 聊天美化
  const [activeTab, setActiveTab] = useState<'cards' | 'chat' | 'beautify'>('chat');

  // ==========================================
  // MODULE 1: 字卡设置相关状态
  // ==========================================
  const [groups, setGroups] = useState<CardGroup[]>(() => StorageService.getCardGroups());
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 分类创建与编辑
  const [showAddGroupForm, setShowAddGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#FF6B6B');
  const [editingGroupId, setEditingGroupId] = useState<string | number | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupColor, setEditingGroupColor] = useState('#FF6B6B');
  const [isCategoryDetailsExpanded, setIsCategoryDetailsExpanded] = useState<boolean>(false);

  // 批量添加字卡（换行为一条）
  const [batchInputText, setBatchInputText] = useState('');
  const [batchTargetCategory, setBatchTargetCategory] = useState('');
  const [batchFeedback, setBatchFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  // 批量操作字卡（删除与移动分组）
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [showBatchMoveModal, setShowBatchMoveModal] = useState(false);
  const [batchMoveTargetGroup, setBatchMoveTargetGroup] = useState('');
  const [batchMoveNewGroupName, setBatchMoveNewGroupName] = useState('');

  // 单张字卡直接编辑（点击字卡内容直接编辑，无额外编辑按钮）
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingCardText, setEditingCardText] = useState('');

  // 导入字卡反馈
  const [importSummary, setImportSummary] = useState<ImportResultSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const cardFileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // MODULE 2: 聊天设置相关状态
  // ==========================================
  // 可收纳状态控制 (默认收纳或展开)
  const [isPokeSectionOpen, setIsPokeSectionOpen] = useState(false);
  const [isStatusSectionOpen, setIsStatusSectionOpen] = useState(false);

  // 1. 拍一拍自定义库
  const [pokes, setPokes] = useState<string[]>(() => StorageService.getCustomPokes());
  const [newPokeText, setNewPokeText] = useState('');
  const [editingPokeIndex, setEditingPokeIndex] = useState<number | null>(null);
  const [editingPokeText, setEditingPokeText] = useState('');
  const [selectedPokeIndices, setSelectedPokeIndices] = useState<Set<number>>(new Set());
  const [isBatchPokeMode, setIsBatchPokeMode] = useState(false);

  // 2. 梦角状态设置库
  const [statuses, setStatuses] = useState<string[]>(() => StorageService.getCustomStatuses());
  const [newStatusText, setNewStatusText] = useState('');
  const [editingStatusIndex, setEditingStatusIndex] = useState<number | null>(null);
  const [editingStatusText, setEditingStatusText] = useState('');
  const [selectedStatusIndices, setSelectedStatusIndices] = useState<Set<number>>(new Set());
  const [isBatchStatusMode, setIsBatchStatusMode] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // 语音消息与 MiniMax 状态
  const [minimaxStatus, setMinimaxStatus] = useState<{ configured: boolean; message: string } | null>(null);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [isVoicePanelExpanded, setIsVoicePanelExpanded] = useState(true); // 语音消息可收纳栏折叠展开状态 (默认展开展示接入卡片)
  const [showApiKey, setShowApiKey] = useState(false);
  const [voiceSavedToast, setVoiceSavedToast] = useState<string | null>(null);
  const [showModelPickerModal, setShowModelPickerModal] = useState(false);

  useEffect(() => {
    MiniMaxTtsService.checkStatus(settings.minimaxProxyUrl).then(res => {
      setMinimaxStatus(res);
    });
  }, [settings.minimaxProxyUrl]);

  // 聊天记录管理
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [chatRecordToast, setChatRecordToast] = useState<string | null>(null);
  const msgFileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // MODULE 3: 聊天美化相关状态
  // ==========================================
  const [activeBubbleTab, setActiveBubbleTab] = useState<'character' | 'user'>('character');
  const [fontToast, setFontToast] = useState<string | null>(null);
  const [isFontLoading, setIsFontLoading] = useState(false);
  const [isBgCompressing, setIsBgCompressing] = useState(false);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const fontFileInputRef = useRef<HTMLInputElement>(null);
  const [isSoundSectionOpen, setIsSoundSectionOpen] = useState(false);

  // 预加载当前字体信息
  useEffect(() => {
    FontStorageService.loadFont().then(res => {
      if (res && res.fileName && !settings.chatCustomFontName) {
        updateSettingsSafely({ chatCustomFontName: res.fileName });
      }
    });
  }, []);

  // 局部受控的气泡配置
  const charBubble: BubbleCustomStyle = {
    bg: '#ffffff',
    textColor: '#262626',
    radius: 18,
    customCss: '',
    ...(settings.characterBubbleStyle || {}),
  };

  const userBubble: BubbleCustomStyle = {
    bg: '#262626',
    textColor: '#ffffff',
    radius: 18,
    customCss: '',
    ...(settings.userBubbleStyle || {}),
  };

  const updateSettingsSafely = (partial: Partial<PhoneSettings>) => {
    if (onUpdateSettings) {
      onUpdateSettings(partial);
    }
  };

  // 分类名称列表
  const categoryNames = useMemo(() => groups.map(g => g.name), [groups]);

  const getCategoryColor = (catName: string): string => {
    const matched = groups.find(g => g.name === catName);
    return matched?.color || '#FF8E53';
  };

  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      const matchCategory = selectedCategory === '全部' || card.category === selectedCategory;
      const matchSearch = !searchKeyword.trim() || 
        card.text.toLowerCase().includes(searchKeyword.toLowerCase()) || 
        card.category.toLowerCase().includes(searchKeyword.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [cards, selectedCategory, searchKeyword]);

  const pendingLinesCount = useMemo(() => {
    if (!batchInputText.trim()) return 0;
    return batchInputText.split('\n').filter(l => l.trim().length > 0).length;
  }, [batchInputText]);

  // ------------------------------------------
  // 聊天记录与完整聊天设置管理事件：导出、导入、清空
  // ------------------------------------------
  const handleExportMessages = () => {
    try {
      const jsonStr = JSON.stringify(messages, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `chat_history_${character.nickname || character.name}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setChatRecordToast(`已成功导出 ${messages.length} 条聊天记录`);
      setTimeout(() => setChatRecordToast(null), 3000);
    } catch (err) {
      setChatRecordToast('导出聊天记录失败：' + (err instanceof Error ? err.message : String(err)));
      setTimeout(() => setChatRecordToast(null), 3500);
    }
  };

  const handleImportMessages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        let list: Message[] = [];
        if (Array.isArray(parsed)) {
          list = parsed;
        } else if (parsed && Array.isArray(parsed.messages)) {
          list = parsed.messages;
        } else {
          throw new Error('未识别到有效的聊天记录列表格式');
        }

        const validList: Message[] = list.filter(m => m && typeof m.id === 'string' && typeof m.text === 'string');

        if (validList.length === 0) {
          throw new Error('导入的文件中无有效聊天消息');
        }

        if (onUpdateMessages) {
          onUpdateMessages(validList);
        } else {
          StorageService.saveMessages(validList);
        }

        setChatRecordToast(`成功导入 ${validList.length} 条聊天记录`);
        setTimeout(() => setChatRecordToast(null), 3000);
      } catch (err) {
        setChatRecordToast('导入失败：' + (err instanceof Error ? err.message : String(err)));
        setTimeout(() => setChatRecordToast(null), 4000);
      } finally {
        if (msgFileInputRef.current) msgFileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setChatRecordToast('读取文件发生错误');
      setTimeout(() => setChatRecordToast(null), 3000);
      if (msgFileInputRef.current) msgFileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  const handleClearMessages = () => {
    if (onUpdateMessages) {
      onUpdateMessages([]);
    } else {
      StorageService.saveMessages([]);
    }
    setShowClearConfirm(false);
    setChatRecordToast('已清空当前所有聊天记录');
    setTimeout(() => setChatRecordToast(null), 3000);
  };

  // ------------------------------------------
  // 字卡管理事件：添加、修改、删除分类
  // ------------------------------------------
  const handleCreateGroup = () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    if (groups.some(g => g.name === trimmed)) {
      setImportError('已存在同名分类，请输入不同名称');
      return;
    }
    const newGroup: CardGroup = {
      id: `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      color: newGroupColor,
      disabled: false,
    };
    const updated = [...groups, newGroup];
    setGroups(updated);
    StorageService.saveCardGroups(updated);
    setNewGroupName('');
    setShowAddGroupForm(false);
  };

  const handleSaveEditGroup = (groupId: string | number) => {
    const trimmed = editingGroupName.trim();
    if (!trimmed) return;
    const oldGroup = groups.find(g => g.id === groupId);
    if (!oldGroup) return;

    const oldName = oldGroup.name;
    const isNameChanged = oldName !== trimmed;

    const updatedGroups = groups.map(g => {
      if (g.id === groupId) {
        return { ...g, name: trimmed, color: editingGroupColor };
      }
      return g;
    });
    setGroups(updatedGroups);
    StorageService.saveCardGroups(updatedGroups);

    if (isNameChanged) {
      const updatedCards = cards.map(c => {
        if (c.category === oldName) {
          return { ...c, category: trimmed };
        }
        return c;
      });
      onUpdateCards(updatedCards);
      StorageService.saveCards(updatedCards);
      if (selectedCategory === oldName) {
        setSelectedCategory(trimmed);
      }
    }

    setEditingGroupId(null);
  };

  const handleDeleteGroup = (groupName: string) => {
    const updatedGroups = groups.filter(g => g.name !== groupName);
    setGroups(updatedGroups);
    StorageService.saveCardGroups(updatedGroups);

    const updatedCards = cards.map(c => {
      if (c.category === groupName) {
        return { ...c, category: '未分类' };
      }
      return c;
    });
    onUpdateCards(updatedCards);
    StorageService.saveCards(updatedCards);

    if (selectedCategory === groupName) {
      setSelectedCategory('全部');
    }
  };

  // ------------------------------------------
  // 字卡管理事件：添加字卡（自动筛选重复字卡/去重）
  // ------------------------------------------
  const handleBatchAddCards = () => {
    if (!batchInputText.trim()) return;
    const lines = batchInputText.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return;

    const targetCategory = batchTargetCategory.trim() || 
      (selectedCategory !== '全部' ? selectedCategory : (categoryNames[0] || '未分类'));

    const existingTexts = new Set(cards.map(c => c.text.trim()));
    const seenInInput = new Set<string>();
    const deduplicatedLines: string[] = [];
    let duplicateCount = 0;

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      if (existingTexts.has(trimmed) || seenInInput.has(trimmed)) {
        duplicateCount++;
        continue;
      }
      seenInInput.add(trimmed);
      deduplicatedLines.push(rawLine);
    }

    if (deduplicatedLines.length === 0) {
      setBatchFeedback({
        type: 'warning',
        message: `输入的 ${lines.length} 条字卡均已存在于字卡库中，已全部自动去重过滤，未重复添加。`
      });
      return;
    }

    const newCards: Card[] = deduplicatedLines.map((line, idx) => ({
      id: `card_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      text: line,
      category: targetCategory,
      createdAt: Date.now(),
    }));

    const updated = [...newCards, ...cards];
    onUpdateCards(updated);
    StorageService.saveCards(updated);
    setBatchInputText('');

    setBatchFeedback({
      type: 'success',
      message: `成功添加 ${newCards.length} 条字卡${duplicateCount > 0 ? `（已自动过滤 ${duplicateCount} 条重复字卡）` : ''}！`
    });

    setTimeout(() => {
      setBatchFeedback(null);
    }, 4000);
  };

  // 批量/单条删除字卡
  const handleToggleSelectCard = (id: string) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (selectedCardIds.size === filteredCards.length && filteredCards.length > 0) {
      setSelectedCardIds(new Set());
    } else {
      setSelectedCardIds(new Set(filteredCards.map(c => c.id)));
    }
  };

  const handleBatchDelete = () => {
    if (selectedCardIds.size === 0) return;
    const updated = cards.filter(c => !selectedCardIds.has(c.id));
    onUpdateCards(updated);
    StorageService.saveCards(updated);
    setSelectedCardIds(new Set());
    setIsBatchMode(false);
  };

  // 批量移动字卡分组
  const handleBatchMoveGroup = () => {
    if (selectedCardIds.size === 0) return;
    const targetGroup = (batchMoveNewGroupName.trim() || batchMoveTargetGroup.trim());
    if (!targetGroup) return;

    // 如果是输入的新分组名称，且该分组在 groups 中不存在，则自动创建该分组
    const groupExists = groups.some(g => g.name === targetGroup);
    if (!groupExists && targetGroup !== '未分类') {
      const newGroup: CardGroup = {
        id: `group_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: targetGroup,
        color: '#FF6B6B',
        disabled: false,
      };
      const updatedGroups = [...groups, newGroup];
      setGroups(updatedGroups);
      StorageService.saveCardGroups(updatedGroups);
    }

    const count = selectedCardIds.size;
    const updatedCards = cards.map(c => {
      if (selectedCardIds.has(c.id)) {
        return { ...c, category: targetGroup };
      }
      return c;
    });

    onUpdateCards(updatedCards);
    StorageService.saveCards(updatedCards);
    setSelectedCardIds(new Set());
    setIsBatchMode(false);
    setShowBatchMoveModal(false);
    setBatchMoveTargetGroup('');
    setBatchMoveNewGroupName('');
    setBatchFeedback({
      type: 'success',
      message: `成功将 ${count} 张字卡批量移动至分组「${targetGroup}」！`,
    });
    setTimeout(() => setBatchFeedback(null), 3500);
  };

  const handleDeleteSingleCard = (cardId: string) => {
    const updated = cards.filter(c => c.id !== cardId);
    onUpdateCards(updated);
    StorageService.saveCards(updated);
    if (selectedCardIds.has(cardId)) {
      setSelectedCardIds(prev => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  };

  // 单张字卡直接编辑（点击字卡内容直接就地编辑，无额外按钮）
  const handleStartEditCard = (card: Card) => {
    if (isBatchMode) return;
    setEditingCardId(card.id);
    setEditingCardText(card.text);
  };

  const handleSaveCardEdit = (cardId: string) => {
    const trimmed = editingCardText.trim();
    if (!trimmed) {
      setEditingCardId(null);
      return;
    }
    const currentCard = cards.find(c => c.id === cardId);
    if (currentCard && currentCard.text === trimmed) {
      setEditingCardId(null);
      return;
    }
    const updated = cards.map(c => c.id === cardId ? { ...c, text: trimmed } : c);
    onUpdateCards(updated);
    StorageService.saveCards(updated);
    setEditingCardId(null);
  };

  const handleCancelCardEdit = () => {
    setEditingCardId(null);
    setEditingCardText('');
  };

  // 导出字卡与分类 JSON
  const handleExportJson = () => {
    const jsonStr = CardImportService.exportFullJson(cards, groups);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cards_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  // 导入旧版 JSON 文件（仅提取字卡与分类）
  const handleCardFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError(null);
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const res = CardImportService.parseAndImportJson(content, cards, groups);

        if (!res.success) {
          setImportError(res.error || '导入失败，请检查文件格式');
        } else {
          if (res.updatedCards) {
            onUpdateCards(res.updatedCards);
            StorageService.saveCards(res.updatedCards);
          }
          if (res.updatedGroups) {
            setGroups(res.updatedGroups);
            StorageService.saveCardGroups(res.updatedGroups);
          }
          setImportSummary(res.summary || null);
        }
      } catch (err) {
        setImportError('导入解析发生错误：' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsImporting(false);
        if (cardFileInputRef.current) cardFileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setImportError('读取文件失败，请重试');
      setIsImporting(false);
      if (cardFileInputRef.current) cardFileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  // ------------------------------------------
  // 聊天设置事件：1. 拍一拍操作
  // ------------------------------------------
  const handleAddPoke = () => {
    const trimmed = newPokeText.trim();
    if (!trimmed) return;
    const next = [...pokes, trimmed];
    setPokes(next);
    StorageService.saveCustomPokes(next);
    setNewPokeText('');
  };

  const handleSaveEditPoke = (index: number) => {
    const trimmed = editingPokeText.trim();
    if (!trimmed) return;
    const next = [...pokes];
    next[index] = trimmed;
    setPokes(next);
    StorageService.saveCustomPokes(next);
    setEditingPokeIndex(null);
  };

  const handleDeleteSinglePoke = (index: number) => {
    const next = pokes.filter((_, i) => i !== index);
    const safe = next.length > 0 ? next : DEFAULT_CUSTOM_POKES;
    setPokes(safe);
    StorageService.saveCustomPokes(safe);
  };

  const handleBatchDeletePokes = () => {
    if (selectedPokeIndices.size === 0) return;
    const next = pokes.filter((_, i) => !selectedPokeIndices.has(i));
    const safe = next.length > 0 ? next : DEFAULT_CUSTOM_POKES;
    setPokes(safe);
    StorageService.saveCustomPokes(safe);
    setSelectedPokeIndices(new Set());
    setIsBatchPokeMode(false);
  };

  const handleResetPokes = () => {
    setPokes(DEFAULT_CUSTOM_POKES);
    StorageService.saveCustomPokes(DEFAULT_CUSTOM_POKES);
  };

  // ------------------------------------------
  // 聊天设置事件：2. 梦角状态操作
  // ------------------------------------------
  const handleAddStatus = () => {
    const trimmed = newStatusText.trim();
    if (!trimmed) return;
    if (statuses.includes(trimmed)) {
      setStatusToast('该状态已存在');
      setTimeout(() => setStatusToast(null), 2500);
      return;
    }
    const next = [...statuses, trimmed];
    setStatuses(next);
    StorageService.saveCustomStatuses(next);
    setNewStatusText('');
  };

  const handleSaveEditStatus = (index: number) => {
    const trimmed = editingStatusText.trim();
    if (!trimmed) return;
    const next = [...statuses];
    next[index] = trimmed;
    setStatuses(next);
    StorageService.saveCustomStatuses(next);
    setEditingStatusIndex(null);
  };

  const handleDeleteSingleStatus = (index: number) => {
    const next = statuses.filter((_, i) => i !== index);
    const safe = next.length > 0 ? next : DEFAULT_CUSTOM_STATUSES;
    setStatuses(safe);
    StorageService.saveCustomStatuses(safe);
  };

  const handleBatchDeleteStatuses = () => {
    if (selectedStatusIndices.size === 0) return;
    const next = statuses.filter((_, i) => !selectedStatusIndices.has(i));
    const safe = next.length > 0 ? next : DEFAULT_CUSTOM_STATUSES;
    setStatuses(safe);
    StorageService.saveCustomStatuses(safe);
    setSelectedStatusIndices(new Set());
    setIsBatchStatusMode(false);
  };

  // 立即触发一次角色随机状态切换（测试）
  const handleRandomTriggerStatus = () => {
    const updatedChar = StorageService.checkAndUpdateCharacterStatus(
      character,
      true,
      onUpdateCharacter
    );
    setStatusToast(`已随机切换当前状态为：「${updatedChar.status}」`);
    setTimeout(() => setStatusToast(null), 3000);
  };

  // ------------------------------------------
  // 聊天美化事件：背景图导入（智能自适应压缩）
  // ------------------------------------------
  const handleUploadBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsBgCompressing(true);
    try {
      const compressedDataUrl = await FontStorageService.compressBackgroundImage(file);
      updateSettingsSafely({ chatBackground: compressedDataUrl });
      setFontToast('背景图已成功导入并完成轻量压缩！');
      setTimeout(() => setFontToast(null), 3000);
    } catch (err) {
      setFontToast('背景图压缩处理失败：' + (err instanceof Error ? err.message : String(err)));
      setTimeout(() => setFontToast(null), 4000);
    } finally {
      setIsBgCompressing(false);
      if (bgFileInputRef.current) bgFileInputRef.current.value = '';
    }
  };

  const handleClearBackground = () => {
    updateSettingsSafely({ chatBackground: undefined });
    setFontToast('已恢复默认背景');
    setTimeout(() => setFontToast(null), 2000);
  };

  // ------------------------------------------
  // 聊天美化事件：气泡属性调节（直接选色，去除透明度）
  // ------------------------------------------
  const handleUpdateBubbleProp = (
    target: 'character' | 'user',
    key: keyof BubbleCustomStyle,
    value: any
  ) => {
    if (target === 'character') {
      const nextCharStyle: BubbleCustomStyle = { ...charBubble, [key]: value };
      updateSettingsSafely({ characterBubbleStyle: nextCharStyle });
    } else {
      const nextUserStyle: BubbleCustomStyle = { ...userBubble, [key]: value };
      updateSettingsSafely({ userBubbleStyle: nextUserStyle });
    }
  };

  // ------------------------------------------
  // 聊天美化事件：字体上传与重置（TTF 格式）
  // ------------------------------------------
  const handleUploadFont = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.ttf') && !file.name.toLowerCase().endsWith('.otf')) {
      setFontToast('请上传 .ttf 格式的标准字体文件');
      setTimeout(() => setFontToast(null), 3000);
      return;
    }

    setIsFontLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataUrl = evt.target?.result as string;
        await FontStorageService.saveFont(file.name, dataUrl);
        updateSettingsSafely({ chatCustomFontName: file.name });
        setFontToast(`字体「${file.name}」已成功导入并应用！`);
        setTimeout(() => setFontToast(null), 3500);
      } catch (err) {
        setFontToast('字体载入失败：' + (err instanceof Error ? err.message : String(err)));
        setTimeout(() => setFontToast(null), 3500);
      } finally {
        setIsFontLoading(false);
        if (fontFileInputRef.current) fontFileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setFontToast('读取字体文件失败');
      setIsFontLoading(false);
      if (fontFileInputRef.current) fontFileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleResetFont = async () => {
    await FontStorageService.clearFont();
    updateSettingsSafely({ chatCustomFontName: undefined });
    setFontToast('已恢复系统默认字体');
    setTimeout(() => setFontToast(null), 2500);
  };

  const charDisplayName = character.nickname || character.name;

  return (
    <div className="w-full h-full flex flex-col bg-neutral-100 select-none overflow-hidden relative">
      {/* 顶部导航 */}
      <div className="h-12 px-3 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 flex items-center justify-between shrink-0 z-20">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center text-xs text-neutral-600 hover:text-neutral-900 active:scale-95 transition-all p-1 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 mr-0.5" />
          <span>返回聊天</span>
        </button>

        <span className="text-xs font-semibold text-neutral-800">
          聊天设置与美化
        </span>

        <div className="w-8" />
      </div>

      {/* 顶部三大部分切换 Tab Bar */}
      <div className="flex bg-white border-b border-neutral-200/80 shrink-0 px-2">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'chat'
              ? 'border-neutral-900 text-neutral-900 font-bold'
              : 'border-transparent text-neutral-400 hover:text-neutral-600'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>聊天设置</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('beautify')}
          className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'beautify'
              ? 'border-neutral-900 text-neutral-900 font-bold'
              : 'border-transparent text-neutral-400 hover:text-neutral-600'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>聊天美化</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cards')}
          className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'cards'
              ? 'border-neutral-900 text-neutral-900 font-bold'
              : 'border-transparent text-neutral-400 hover:text-neutral-600'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>字卡设置 ({cards.length})</span>
        </button>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
        
        {/* ========================================================================= */}
        {/* TAB 1: 聊天设置                                                           */}
        {/* ========================================================================= */}
        {activeTab === 'chat' && (
          <div className="space-y-3.5 animate-fade-in">

            {/* 提示消息 */}
            {(chatRecordToast || statusToast) && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] text-center font-medium animate-fade-in shadow-2xs">
                {chatRecordToast || statusToast}
              </div>
            )}

            {/* 0. 聊天记录管理（导出/导入/清空） */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-neutral-800 text-xs block">仅聊天消息备份管理</span>
                    <span className="text-[10px] text-neutral-400">
                      当前共 {messages.length} 条聊天记录
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="px-2.5 py-1 text-[11px] font-medium bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl border border-rose-200/70 transition-all cursor-pointer active:scale-95"
                >
                  清空聊天记录
                </button>
              </div>

              {/* 仅聊天消息备份说明 */}
              <div className="p-2.5 bg-blue-50/90 border border-blue-200/80 rounded-xl text-[10px] text-blue-900 leading-relaxed flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>仅聊天消息备份：</strong>仅备份导出和导入当前的聊天消息记录，不包含其他设置、背景或字卡库。
                </span>
              </div>

              {/* 导出与导入按钮 */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExportMessages}
                  className="flex-1 py-2 px-3 bg-neutral-900 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer shadow-2xs"
                  title="仅导出聊天记录消息"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>导出聊天记录备份</span>
                </button>

                <input
                  type="file"
                  ref={msgFileInputRef}
                  accept=".json"
                  onChange={handleImportMessages}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => msgFileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 bg-white text-neutral-700 border border-neutral-300 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-neutral-50 active:scale-95 transition-all cursor-pointer shadow-2xs"
                  title="支持导入纯聊天记录 JSON"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>导入聊天记录备份</span>
                </button>
              </div>

              {/* 清空确认弹窗/提示 */}
              {showClearConfirm && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 animate-fade-in">
                  <div className="flex items-center gap-1.5 text-rose-800 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>确认清空聊天记录？</span>
                  </div>
                  <p className="text-[10px] text-rose-700 leading-relaxed">
                    此操作将彻底删除当前与「{charDisplayName}」的全部 {messages.length} 条聊天对话，无法撤销。
                  </p>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="px-3 py-1 bg-white border border-neutral-200 text-neutral-600 rounded-lg text-xs hover:bg-neutral-50"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleClearMessages}
                      className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700"
                    >
                      确定清空
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 1. “拍一拍”设置（可收纳形式 + 预设重写为一条 + 我拍角色/角色拍我都从此抽取） */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden transition-all">
              {/* 可点击收纳的标题头部 */}
              <div 
                onClick={() => setIsPokeSectionOpen(!isPokeSectionOpen)}
                className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-neutral-50/70 transition-colors select-none"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-pink-50 text-pink-500 flex items-center justify-center shrink-0">
                    <HandMetal className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-neutral-800 text-xs">“拍一拍”设置</span>
                      <span className="text-[10px] text-neutral-400">({pokes.length} 条动作)</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">
                      格式：我…角色 / 角色…我 · 预设 1 条 · 双向均从此抽取
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-400">
                    {isPokeSectionOpen ? '收起' : '展开'}
                  </span>
                  {isPokeSectionOpen ? (
                    <ChevronUp className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                  )}
                </div>
              </div>

              {/* 收纳折叠内容 */}
              {isPokeSectionOpen && (
                <div className="p-3.5 pt-0 border-t border-neutral-100 space-y-3 mt-1 animate-fade-in">
                  {/* 新增开关：我拍一拍梦角，梦角是否回复字卡 */}
                  <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/70">
                    <div>
                      <div className="text-xs font-bold text-neutral-800">拍一拍回复字卡</div>
                      <div className="text-[10px] text-neutral-400">我拍一拍梦角时，梦角是否回复字卡</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.pokeReplyEnabled !== false}
                        onChange={e => updateSettingsSafely({ pokeReplyEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-neutral-400">
                      角色主动反拍概率：3%（Math.random() &lt; 0.03）
                    </span>

                    <button
                      type="button"
                      onClick={() => setIsBatchPokeMode(!isBatchPokeMode)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                        isBatchPokeMode ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      {isBatchPokeMode ? '退出批量' : '批量操作'}
                    </button>
                  </div>

                  {/* 格式规范标注 */}
                  <div className="p-2 bg-neutral-50 rounded-xl border border-neutral-200/70 text-[10px] text-neutral-500 space-y-0.5">
                    <span className="font-medium text-neutral-700 block">格式规则说明：</span>
                    <p>• 基础动作直接填（如预设「<strong>拍了拍</strong>」）：我拍角色为「我拍了拍{charDisplayName}」，角色反拍为「{charDisplayName}拍了拍我」</p>
                    <p>• 复杂动作可带省略号（如「<strong>揉了揉…的头</strong>」）：我拍角色为「我揉了揉{charDisplayName}的头」，角色反拍为「{charDisplayName}揉了揉我的头」</p>
                  </div>

                  {/* 批量操作控制条 */}
                  {isBatchPokeMode && (
                    <div className="flex items-center justify-between p-2 bg-neutral-50 rounded-xl border border-neutral-200/80">
                      <span className="text-[10px] text-neutral-500">
                        已选 {selectedPokeIndices.size} 项 / 共 {pokes.length} 项
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedPokeIndices.size === pokes.length) {
                              setSelectedPokeIndices(new Set());
                            } else {
                              setSelectedPokeIndices(new Set(pokes.map((_, i) => i)));
                            }
                          }}
                          className="px-2 py-0.5 rounded text-[10px] bg-white border border-neutral-200 text-neutral-700"
                        >
                          {selectedPokeIndices.size === pokes.length ? '全不选' : '全选'}
                        </button>
                        <button
                          type="button"
                          onClick={handleBatchDeletePokes}
                          disabled={selectedPokeIndices.size === 0}
                          className="px-2 py-0.5 rounded text-[10px] bg-rose-600 text-white font-medium disabled:opacity-40"
                        >
                          批量删除
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 添加拍一拍输入 */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPokeText ?? ''}
                      onChange={e => setNewPokeText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddPoke()}
                      placeholder="添加拍一拍动作，如：轻轻捏了捏、拉了拉…的衣角..."
                      className="flex-1 px-3 py-1.5 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-800 placeholder-neutral-400 outline-none focus:border-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={handleAddPoke}
                      disabled={!newPokeText.trim()}
                      className="px-3 py-1.5 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 disabled:opacity-40 active:scale-95 cursor-pointer"
                    >
                      添加
                    </button>
                  </div>

                  {/* 拍一拍动作列表 */}
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                    {pokes.map((poke, idx) => {
                      const isSelected = selectedPokeIndices.has(idx);
                      const isEditing = editingPokeIndex === idx;

                      const userPreview = buildPokeMessageText(poke, true, charDisplayName);
                      const charPreview = buildPokeMessageText(poke, false, charDisplayName);

                      return (
                        <div
                          key={idx}
                          className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                            isSelected
                              ? 'bg-pink-50/70 border-pink-300 ring-1 ring-pink-200'
                              : 'bg-neutral-50/80 border-neutral-200/70'
                          }`}
                        >
                          {isBatchPokeMode && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = new Set(selectedPokeIndices);
                                if (next.has(idx)) next.delete(idx);
                                else next.add(idx);
                                setSelectedPokeIndices(next);
                              }}
                              className="shrink-0 text-neutral-500"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-pink-600" />
                              ) : (
                                <Square className="w-4 h-4 text-neutral-300" />
                              )}
                            </button>
                          )}

                          {isEditing ? (
                            <div className="flex-1 flex items-center gap-1">
                              <input
                                type="text"
                                value={editingPokeText ?? ''}
                                onChange={e => setEditingPokeText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveEditPoke(idx)}
                                className="flex-1 px-2 py-0.5 bg-white rounded border border-neutral-300 text-xs"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditPoke(idx)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPokeIndex(null)}
                                className="p-1 text-neutral-400 hover:bg-neutral-100 rounded"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-neutral-800 text-xs block truncate">
                                {poke}
                              </span>
                              <span className="text-[9px] text-neutral-400 block truncate mt-0.5">
                                效果：{userPreview} / {charPreview}
                              </span>
                            </div>
                          )}

                          {!isBatchPokeMode && !isEditing && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPokeIndex(idx);
                                  setEditingPokeText(poke);
                                }}
                                className="text-neutral-400 hover:text-neutral-700 p-1"
                                title="修改"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSinglePoke(idx)}
                                className="text-neutral-400 hover:text-rose-500 p-1"
                                title="删除"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={handleResetPokes}
                      className="text-[10px] text-neutral-400 hover:text-neutral-600 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>恢复预设单条（拍了拍）</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. 梦角状态设置（可收纳形式） */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden transition-all">
              {/* 可点击收纳的标题头部 */}
              <div 
                onClick={() => setIsStatusSectionOpen(!isStatusSectionOpen)}
                className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-neutral-50/70 transition-colors select-none"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                    <Smile className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-neutral-800 text-xs">梦角状态设置</span>
                      <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.2 rounded">
                        当前：{character.status || '在线'}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">
                      每隔 1~3 小时纯随机更新 · 状态库共 {statuses.length} 条
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-400">
                    {isStatusSectionOpen ? '收起' : '展开'}
                  </span>
                  {isStatusSectionOpen ? (
                    <ChevronUp className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                  )}
                </div>
              </div>

              {/* 收纳折叠内容 */}
              {isStatusSectionOpen && (
                <div className="p-3.5 pt-0 border-t border-neutral-100 space-y-3 mt-1 animate-fade-in">
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-neutral-400">
                      触发机制：1 + Math.random() * 2 小时后纯随机选取
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleRandomTriggerStatus}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                        title="立即从状态库纯随机选取一条更新当前状态"
                      >
                        随机测试
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsBatchStatusMode(!isBatchStatusMode)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                          isBatchStatusMode ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                      >
                        {isBatchStatusMode ? '退出批量' : '批量操作'}
                      </button>
                    </div>
                  </div>

                  {/* 批量操作控制条 */}
                  {isBatchStatusMode && (
                    <div className="flex items-center justify-between p-2 bg-neutral-50 rounded-xl border border-neutral-200/80">
                      <span className="text-[10px] text-neutral-500">
                        已选 {selectedStatusIndices.size} 项 / 共 {statuses.length} 项
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedStatusIndices.size === statuses.length) {
                              setSelectedStatusIndices(new Set());
                            } else {
                              setSelectedStatusIndices(new Set(statuses.map((_, i) => i)));
                            }
                          }}
                          className="px-2 py-0.5 rounded text-[10px] bg-white border border-neutral-200 text-neutral-700"
                        >
                          {selectedStatusIndices.size === statuses.length ? '全不选' : '全选'}
                        </button>
                        <button
                          type="button"
                          onClick={handleBatchDeleteStatuses}
                          disabled={selectedStatusIndices.size === 0}
                          className="px-2 py-0.5 rounded text-[10px] bg-rose-600 text-white font-medium disabled:opacity-40"
                        >
                          批量删除
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 添加状态输入 */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newStatusText ?? ''}
                      onChange={e => setNewStatusText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddStatus()}
                      placeholder="添加状态，如：正在喝热奶茶、发呆中..."
                      className="flex-1 px-3 py-1.5 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-800 placeholder-neutral-400 outline-none focus:border-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={handleAddStatus}
                      disabled={!newStatusText.trim()}
                      className="px-3 py-1.5 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 disabled:opacity-40 active:scale-95 cursor-pointer"
                    >
                      添加
                    </button>
                  </div>

                  {/* 状态列表 */}
                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                    {statuses.map((stat, idx) => {
                      const isSelected = selectedStatusIndices.has(idx);
                      const isEditing = editingStatusIndex === idx;
                      const isCurrent = (character.status || '在线') === stat;

                      return (
                        <div
                          key={idx}
                          className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                            isSelected
                              ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-200'
                              : 'bg-neutral-50/80 border-neutral-200/70'
                          }`}
                        >
                          {isBatchStatusMode && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = new Set(selectedStatusIndices);
                                if (next.has(idx)) next.delete(idx);
                                else next.add(idx);
                                setSelectedStatusIndices(next);
                              }}
                              className="shrink-0 text-neutral-500"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-amber-600" />
                              ) : (
                                <Square className="w-4 h-4 text-neutral-300" />
                              )}
                            </button>
                          )}

                          {isEditing ? (
                            <div className="flex-1 flex items-center gap-1">
                              <input
                                type="text"
                                value={editingStatusText ?? ''}
                                onChange={e => setEditingStatusText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveEditStatus(idx)}
                                className="flex-1 px-2 py-0.5 bg-white rounded border border-neutral-300 text-xs"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditStatus(idx)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingStatusIndex(null)}
                                className="p-1 text-neutral-400 hover:bg-neutral-100 rounded"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                              <span className="text-xs text-neutral-800 truncate">
                                {stat}
                              </span>
                              {isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0 font-medium">
                                  当前使用中
                                </span>
                              )}
                            </div>
                          )}

                          {!isBatchStatusMode && !isEditing && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  if (onUpdateCharacter) {
                                    onUpdateCharacter({ status: stat });
                                    StorageService.saveCharacter({ ...character, status: stat });
                                    setStatusToast(`已将当前状态切换为：「${stat}」`);
                                    setTimeout(() => setStatusToast(null), 2500);
                                  }
                                }}
                                className="text-[10px] text-neutral-500 hover:text-neutral-800 px-1.5 py-0.5 rounded hover:bg-neutral-200/60 transition-colors"
                              >
                                设为当前
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStatusIndex(idx);
                                  setEditingStatusText(stat);
                                }}
                                className="text-neutral-400 hover:text-neutral-700 p-1"
                                title="修改"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSingleStatus(idx)}
                                className="text-neutral-400 hover:text-rose-500 p-1"
                                title="删除"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 3. 梦角回复时长（拉动最短回复时长时，下面的条绝不跟着一起动） */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-neutral-800 text-xs block">梦角回复时长</span>
                  <span className="text-[10px] text-neutral-400">
                    下限 2s，上限 120s。两滑杆彼此独立调节，互不干扰联动。
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                {/* 最短回复时长：修改时只更新 minReplyDelaySeconds，绝不联动下面的条 */}
                <div>
                  <div className="flex justify-between text-[11px] text-neutral-600 mb-1">
                    <span>最短回复时长</span>
                    <span className="font-mono font-bold text-neutral-800">
                      {settings.minReplyDelaySeconds || 2} 秒
                    </span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="120"
                    step="1"
                    value={settings.minReplyDelaySeconds || 2}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10);
                      updateSettingsSafely({ minReplyDelaySeconds: val });
                    }}
                    className="w-full accent-neutral-900 cursor-pointer"
                  />
                </div>

                {/* 最长回复时长：修改时只更新 maxReplyDelaySeconds，互不干扰 */}
                <div>
                  <div className="flex justify-between text-[11px] text-neutral-600 mb-1">
                    <span>最长回复时长</span>
                    <span className="font-mono font-bold text-neutral-800">
                      {settings.maxReplyDelaySeconds || 6} 秒
                    </span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="120"
                    step="1"
                    value={settings.maxReplyDelaySeconds || 6}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10);
                      updateSettingsSafely({ maxReplyDelaySeconds: val });
                    }}
                    className="w-full accent-neutral-900 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* 4. 是否开启引用 */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-violet-50 text-violet-500 flex items-center justify-center shrink-0">
                    <Quote className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-neutral-800 text-xs block">开启引用回复</span>
                    <span className="text-[10px] text-neutral-400">
                      引用概率 10%（Math.random() &lt; 0.1）
                    </span>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={settings.enableQuoteReply !== false}
                  onChange={e => updateSettingsSafely({ enableQuoteReply: e.target.checked })}
                  className="accent-neutral-900 w-4 h-4 cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-neutral-500 leading-relaxed pt-1">
                关闭以后，角色在聊天中不再引用我的话。开启时，角色会从我最近 5 条消息中随机选取一条作为“回复对象”展示在气泡上方（纯视觉效果，不影响字卡内容）。
              </p>
            </div>

            {/* 5. 开启角色主动发消息 */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-neutral-800 text-xs block">角色主动发消息</span>
                    <span className="text-[10px] text-neutral-400">
                      下限 3 分钟，上限 180 分钟
                    </span>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={Boolean(settings.proactiveMessageEnabled)}
                  onChange={e => updateSettingsSafely({ proactiveMessageEnabled: e.target.checked })}
                  className="accent-neutral-900 w-4 h-4 cursor-pointer"
                />
              </div>

              {settings.proactiveMessageEnabled && (
                <div className="pt-1 space-y-2 border-t border-neutral-100">
                  <div className="flex justify-between text-[11px] text-neutral-600">
                    <span>最后一次发消息后的主动间隔</span>
                    <span className="font-mono font-bold text-neutral-800">
                      {settings.proactiveMessageIntervalMinutes || 15} 分钟
                    </span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="180"
                    step="1"
                    value={settings.proactiveMessageIntervalMinutes || 15}
                    onChange={e => updateSettingsSafely({ proactiveMessageIntervalMinutes: parseInt(e.target.value, 10) })}
                    className="w-full accent-neutral-900 cursor-pointer"
                  />
                  <p className="text-[10px] text-neutral-400 leading-relaxed">
                    角色会在最后一次发消息的 {settings.proactiveMessageIntervalMinutes || 15} 分钟后主动发一次消息，字卡抽取概率与聊天概率保持一致。主动消息气泡内将用小字标注「主动消息」。
                  </p>
                </div>
              )}
            </div>

            {/* 6. 拼字卡与已读不回 */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center shrink-0">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-neutral-800 text-xs block">聊天规则设置</span>
                  <span className="text-[10px] text-neutral-400">拼字卡机制与生活化忙碌拟真</span>
                </div>
              </div>

              <div className="space-y-3 pt-1 border-t border-neutral-100">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-neutral-800 font-medium block">拼字卡</span>
                    <span className="text-[10px] text-neutral-400">
                      抽到多张字卡时用中文逗号拼接为一条（75% 1张, 20% 2张, 5% 3张）
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.mergeCards !== false}
                    onChange={e => updateSettingsSafely({ mergeCards: e.target.checked })}
                    className="accent-neutral-900 w-4 h-4 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-neutral-800 font-medium block">5% 概率已读不回</span>
                    <span className="text-[10px] text-neutral-400">
                      以 5% 概率（Math.random() &lt; 0.05）模拟生活中的临时忙碌
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.readWithoutReply)}
                    onChange={e => updateSettingsSafely({ readWithoutReply: e.target.checked })}
                    className="accent-neutral-900 w-4 h-4 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* 7. 表情包与 Emoji 开关及混合模式 */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Smile className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-neutral-800 text-xs block">表情包与 Emoji 设置</span>
                  <span className="text-[10px] text-neutral-400">控制角色回复是否附带表情包与 Emoji</span>
                </div>
              </div>

              <div className="space-y-3 pt-1 border-t border-neutral-100">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-neutral-800 font-medium block">角色使用表情包</span>
                    <span className="text-[10px] text-neutral-400">
                      开启后，角色回复字卡后有概率附带发送表情包图片
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.stickersEnabled !== false}
                    onChange={e => updateSettingsSafely({ stickersEnabled: e.target.checked })}
                    className="accent-neutral-900 w-4 h-4 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-neutral-800 font-medium block">角色使用 Emoji</span>
                    <span className="text-[10px] text-neutral-400">
                      开启后，角色回复时有概率附带 Emoji
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.emojisEnabled !== false}
                    onChange={e => updateSettingsSafely({ emojisEnabled: e.target.checked })}
                    className="accent-neutral-900 w-4 h-4 cursor-pointer"
                  />
                </div>

                <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-neutral-800 font-medium block">Emoji 混合模式</span>
                      <span className="text-[10px] text-neutral-400">
                        控制 Emoji 与字卡文本的呈现组合方式
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.emojiMixedMode !== false}
                      onChange={e => updateSettingsSafely({ emojiMixedMode: e.target.checked })}
                      className="accent-neutral-900 w-4 h-4 cursor-pointer"
                    />
                  </div>

                  <div className="p-2 bg-white rounded-lg border border-neutral-200/60 text-[10px] text-neutral-500 leading-relaxed">
                    <strong className="text-neutral-700 block mb-0.5">混合模式说明：</strong>
                    • <strong>开启混合模式</strong>：Emoji 随机拼接在字卡文字的前面或后面（各 50% 几率）。<br />
                    • <strong>关闭混合模式</strong>：Emoji 作为一条单独消息发出。
                  </div>
                </div>
              </div>
            </div>

            {/* 8. 梦角红包规则设置（仅保留红包开关，不放美化） */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-neutral-800 text-xs block">红包设置</span>
                  <span className="text-[10px] text-neutral-400">控制角色是否在聊天中主动发红包</span>
                </div>
              </div>

              <div className="pt-1 border-t border-neutral-100">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-neutral-800 font-medium block">角色主动发红包</span>
                    <span className="text-[10px] text-neutral-400">
                      开启后，角色在聊天回复时有 3% 的概率（Math.random() &lt; 0.03）主动发红包
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.characterRedPacketEnabled !== false}
                    onChange={e => updateSettingsSafely({ characterRedPacketEnabled: e.target.checked })}
                    className="accent-neutral-900 w-4 h-4 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* 9. 语音消息模块 (可收纳栏：根据图片完善 MiniMax 账号接入，无预设音色) */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden transition-all duration-200">
              {/* 可收纳栏标题头 (点击收纳/展开) */}
              <div 
                onClick={() => setIsVoicePanelExpanded(!isVoicePanelExpanded)}
                className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-neutral-50/70 select-none transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-neutral-800 text-xs">语音消息</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-medium bg-neutral-100 text-neutral-500 font-mono">
                        {MINIMAX_SPEECH_MODELS.find(m => m.id === (settings.minimaxModel || 'speech-2.8-turbo'))?.name || settings.minimaxModel || 'Speech 2.8 Turbo'}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">
                      {settings.voiceMessageEnabled ? '已开启 · 10%概率字卡语音条' : '已关闭（默认关闭，需手动开启）'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={!!settings.voiceMessageEnabled}
                    onChange={e => updateSettingsSafely({ voiceMessageEnabled: e.target.checked })}
                    className="accent-neutral-900 w-4 h-4 cursor-pointer"
                    title="开启/关闭语音消息"
                  />
                  <button
                    type="button"
                    onClick={() => setIsVoicePanelExpanded(!isVoicePanelExpanded)}
                    className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                    aria-label={isVoicePanelExpanded ? '收起' : '展开'}
                  >
                    {isVoicePanelExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* 展开的收纳内容 */}
              {isVoicePanelExpanded && (
                <div className="px-3.5 pb-4 pt-1 border-t border-neutral-100 space-y-3.5 text-xs animate-fade-in">
                  <p className="text-[10px] text-neutral-500 leading-relaxed pt-1">
                    开启后，角色在对话中有 <strong>10% 的概率</strong> 发送带有声音的「字卡语音条」。样式为<strong>语音条＋文字直接显示</strong>，即使未接入 MiniMax 语音时，您仍能清晰直观地阅读字卡文本。
                  </p>

                  {/* 功能提示 */}
                  <div className="p-2.5 bg-amber-50/80 border border-amber-200/70 rounded-xl text-[10.5px] text-amber-800 leading-relaxed space-y-1">
                    <div className="font-semibold flex items-center gap-1 text-amber-900">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                      <span>功能提示</span>
                    </div>
                    <p>
                      功能不完善，有可能播放失败。
                    </p>
                  </div>

                  {/* 保存成功提示 */}
                  {voiceSavedToast && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] text-center font-medium animate-fade-in shadow-2xs">
                      {voiceSavedToast}
                    </div>
                  )}

                  {/* 图片 1: MiniMax 账号接入主卡片 */}
                  <div className="p-3 bg-neutral-50/80 rounded-2xl border border-neutral-200/80 space-y-3">
                    {/* 卡片头部 */}
                    <div>
                      <h4 className="font-bold text-neutral-800 text-xs tracking-tight">
                        MiniMax 账号接入
                      </h4>
                      <p className="text-[10.5px] text-neutral-500 leading-relaxed mt-1">
                        在这里只保存你自己的 MiniMax API Key 和音色 ID，所有内容仅存储在本地设备浏览器中，不会上传到服务器。
                      </p>
                    </div>

                    {/* 1. API Key */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-neutral-700 block">
                        API Key
                      </label>
                      <div className="relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={settings.minimaxApiKey || ''}
                          onChange={e => updateSettingsSafely({ minimaxApiKey: e.target.value.trim() })}
                          placeholder="••••••••••••••••••••••••••••••••"
                          className="w-full px-3 py-2 pr-9 text-xs bg-white border border-neutral-200 rounded-xl text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer p-0.5"
                          title={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                        >
                          {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* 2. MiniMax 版本 */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-neutral-700 block">
                        MiniMax 版本
                      </label>
                      <div className="relative">
                        <select
                          value={settings.minimaxRegion || 'domestic'}
                          onChange={e => {
                            const isDomestic = e.target.value === 'domestic';
                            updateSettingsSafely({
                              minimaxRegion: isDomestic ? 'domestic' : 'international',
                              minimaxBaseUrl: isDomestic ? 'https://api.minimaxi.com/v1' : 'https://api.minimax.chat/v1'
                            });
                          }}
                          className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-xl text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400 cursor-pointer appearance-none"
                        >
                          <option value="domestic">国内版 (api.minimaxi.com)</option>
                          <option value="international">国际版 (api.minimax.chat)</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      <p className="text-[10px] text-neutral-400 leading-relaxed pt-0.5">
                        提示：国内版/国际版通常不互通（Key、voice_id、套餐/余额可能分开）。请确认你在对应控制台创建的 Key 与音色 ID。
                      </p>
                    </div>

                    {/* 3. MiniMax Base URL */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-neutral-700 block">
                        MiniMax Base URL
                      </label>
                      <input
                        type="text"
                        value={settings.minimaxBaseUrl || (settings.minimaxRegion === 'international' ? 'https://api.minimax.chat/v1' : 'https://api.minimaxi.com/v1')}
                        onChange={e => updateSettingsSafely({ minimaxBaseUrl: e.target.value.trim() })}
                        placeholder="https://api.minimaxi.com/v1"
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-xl text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400 font-mono"
                      />
                      <span className="text-[10px] text-neutral-400 block pt-0.5 font-mono">
                        当前生效：{settings.minimaxBaseUrl || (settings.minimaxRegion === 'international' ? 'https://api.minimax.chat/v1' : 'https://api.minimaxi.com/v1')}
                      </span>
                    </div>

                    {/* 4. 自定义音色 ID (无预设声音，完全由用户填写或生成) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-neutral-700 block">
                        自定义音色 ID
                      </label>
                      <input
                        type="text"
                        value={settings.minimaxVoiceId || ''}
                        onChange={e => updateSettingsSafely({ minimaxVoiceId: e.target.value.trim() })}
                        placeholder="请输入自定义音色 ID（无预设）"
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-xl text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400 font-mono"
                      />
                    </div>

                    {/* 5. 语音合成模型（可选，支持弹窗单选如图片2） */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-neutral-700 block">
                        语音合成模型（可选）
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowModelPickerModal(true)}
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-xl text-neutral-800 text-left flex items-center justify-between hover:bg-neutral-50/50 cursor-pointer focus:outline-none focus:ring-1 focus:ring-neutral-400"
                      >
                        <span className="truncate">
                          {MINIMAX_SPEECH_MODELS.find(m => m.id === (settings.minimaxModel || 'speech-2.8-turbo'))?.label || settings.minimaxModel || 'speech-2.8-turbo'}
                        </span>
                        <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0 ml-1.5" />
                      </button>
                    </div>

                    {/* 6. 语速调节 */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-neutral-700">
                          语速调节 ({Number(settings.minimaxSpeed || 1.0).toFixed(1)}x)
                        </label>
                        <span className="text-[10px] text-neutral-400">
                          范围 0.5x ~ 2.0x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={settings.minimaxSpeed ?? 1.0}
                        onChange={e => updateSettingsSafely({ minimaxSpeed: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-neutral-800"
                      />
                    </div>

                    {/* 7. 保存语音配置按钮 */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setVoiceSavedToast('语音配置已保存至本地设备');
                          setTimeout(() => setVoiceSavedToast(null), 2500);
                        }}
                        className="w-full py-2.5 bg-[#18181b] hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        保存语音配置
                      </button>
                    </div>

                    {/* 8. 已生成音色 ID 与 试听当前配置 */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-emerald-600 text-[11px] font-mono font-medium truncate max-w-[210px]">
                        已生成音色 ID: {settings.minimaxVoiceId || '未配置'}
                      </span>

                      <button
                        type="button"
                        disabled={isTestingVoice}
                        onClick={async () => {
                          setIsTestingVoice(true);
                          const testText = '你好，这是我的语音试听，愿你今日一切顺遂。';
                          const res = await MiniMaxTtsService.synthesize(
                            testText,
                            settings.minimaxVoiceId || '',
                            settings.minimaxProxyUrl,
                            settings.minimaxModel || 'speech-2.8-turbo',
                            settings.minimaxApiKey,
                            settings.minimaxBaseUrl || (settings.minimaxRegion === 'international' ? 'https://api.minimax.chat/v1' : 'https://api.minimaxi.com/v1'),
                            settings.minimaxSpeed || 1.0
                          );
                          setIsTestingVoice(false);
                          if (res.success && res.audioUrl) {
                            setVoiceSavedToast('MiniMax 试听播放成功');
                            setTimeout(() => setVoiceSavedToast(null), 2500);
                            MiniMaxTtsService.playAudio(res.audioUrl, 'test_sample', () => {}, () => {});
                          } else {
                            setVoiceSavedToast(`MiniMax 请求失败: ${res.message || '未知错误'}，降级使用浏览器朗读`);
                            setTimeout(() => setVoiceSavedToast(null), 4000);
                            MiniMaxTtsService.speakWithWebSpeech(testText);
                          }
                        }}
                        className="shrink-0 text-[10.5px] text-pink-600 hover:text-pink-700 bg-pink-50 hover:bg-pink-100 px-2.5 py-0.5 rounded-full font-medium transition-colors cursor-pointer"
                      >
                        {isTestingVoice ? '生成试听中...' : '试听当前配置'}
                      </button>
                    </div>


                  {/* 辅助自定义后端代理完整 URL 设置 */}
                  <div className="pt-0.5 border-t border-neutral-100">
                    <label className="text-[10px] text-neutral-400 block mb-1">
                      自定义后端代理完整接口地址（选填，直接转发至自定义服务）：
                    </label>
                    <input
                      type="text"
                      value={settings.minimaxProxyUrl || ''}
                      onChange={e => updateSettingsSafely({ minimaxProxyUrl: e.target.value.trim() })}
                      placeholder="选填，例如 https://your-server.com/api/tts"
                      className="w-full px-2.5 py-1 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

            {/* 图片 2: 语音合成模型单选弹窗 */}
            {showModelPickerModal && (
              <div 
                className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-2xs animate-fade-in"
                onClick={() => setShowModelPickerModal(false)}
              >
                <div 
                  className="bg-[#fff8f8] rounded-2xl w-full max-w-xs shadow-2xl border border-neutral-200/80 overflow-hidden animate-scale-up"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="px-4 py-3 bg-[#fdf2f2]/60 flex items-center justify-between border-b border-rose-100">
                    <span className="text-xs font-bold text-neutral-800">选择语音合成模型</span>
                    <button
                      type="button"
                      onClick={() => setShowModelPickerModal(false)}
                      className="text-neutral-400 hover:text-neutral-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="divide-y divide-neutral-100">
                    {MINIMAX_SPEECH_MODELS.map(model => {
                      const isSelected = (settings.minimaxModel || 'speech-2.8-turbo') === model.id;
                      return (
                        <div
                          key={model.id}
                          onClick={() => {
                            updateSettingsSafely({ minimaxModel: model.id });
                            setShowModelPickerModal(false);
                          }}
                          className="p-3.5 flex items-center justify-between hover:bg-neutral-50/80 cursor-pointer transition-colors"
                        >
                          <div className="pr-3">
                            <span className="text-xs font-semibold text-neutral-800 block">
                              {model.name}
                            </span>
                            <span className="text-[10px] text-neutral-500 block mt-0.5">
                              {model.description}
                            </span>
                          </div>

                          <div className="shrink-0 flex items-center justify-center">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              isSelected 
                                ? 'border-[#8b3d4f] bg-transparent' 
                                : 'border-neutral-300 bg-white'
                            }`}>
                              {isSelected && (
                                <div className="w-2.5 h-2.5 rounded-full bg-[#8b3d4f]" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: 聊天美化 (背景图+遮罩度、气泡直选颜色+去透明度、自定义TTF字体)     */}
        {/* ========================================================================= */}
        {activeTab === 'beautify' && (
          <div className="space-y-3.5 animate-fade-in">
            {/* 提示消息 */}
            {fontToast && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] text-center font-medium animate-fade-in shadow-2xs">
                {fontToast}
              </div>
            )}

            {/* 消息提示音（放到美化的第一个，在聊天背景图上方，仅保留静音和 bubble） */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden transition-all">
              <div 
                onClick={() => setIsSoundSectionOpen(!isSoundSectionOpen)}
                className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-neutral-50/70 transition-colors select-none"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-neutral-800 text-xs">消息提示音</span>
                      <span className="text-[10px] text-neutral-400">
                        ({settings.messageSound === 'bubble' ? '柔和气泡' : settings.messageSound === 'beep' ? '清脆短音' : settings.messageSound === 'ping' ? '温馨轻音' : '静音'})
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">
                      发送与接收消息时的音效选择（可收纳栏）
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-400">
                    {isSoundSectionOpen ? '收起' : '展开'}
                  </span>
                  {isSoundSectionOpen ? (
                    <ChevronUp className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                  )}
                </div>
              </div>

              {isSoundSectionOpen && (
                <div className="p-3.5 pt-0 border-t border-neutral-100 space-y-2 mt-1 animate-fade-in">
                  <span className="text-[10px] text-neutral-400 block pt-1">
                    点击选择提示音并试听：
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'none', label: '静音 (无声音)' },
                      { key: 'bubble', label: '柔和气泡 (Bubble)' },
                      { key: 'beep', label: '清脆短音 (Beep)' },
                      { key: 'ping', label: '温馨轻音 (Ping)' },
                    ].map(item => {
                      const isSelected = (settings.messageSound || 'bubble') === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            updateSettingsSafely({ messageSound: item.key });
                            playMessageSound(item.key);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                            isSelected 
                              ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs font-bold' 
                              : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                          }`}
                        >
                          <span className="text-xs">{item.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 1. 聊天背景（直接导入本地图片，Canvas 智能压缩 + 背景图遮罩度减淡） */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-neutral-800 text-xs block">聊天背景图</span>
                    <span className="text-[10px] text-neutral-400">
                      支持本地图片导入 · 智能轻量压缩保障流畅运行
                    </span>
                  </div>
                </div>

                {settings.chatBackground && (
                  <button
                    type="button"
                    onClick={handleClearBackground}
                    className="text-[10px] text-neutral-400 hover:text-rose-600 cursor-pointer"
                  >
                    恢复默认纯灰
                  </button>
                )}
              </div>

              {/* 背景图缩略预览与操作按钮 */}
              <div className="flex gap-2.5 items-center">
                <div className="w-16 h-20 rounded-xl border border-neutral-200 overflow-hidden relative bg-neutral-100 shrink-0 shadow-2xs">
                  {settings.chatBackground ? (
                    <>
                      <img 
                        src={settings.chatBackground} 
                        alt="Background Preview" 
                        className="w-full h-full object-cover" 
                      />
                      <div 
                        className="absolute inset-0"
                        style={{
                          backgroundColor: `rgba(255, 255, 255, ${settings.chatBackgroundMask ?? 0.3})`
                        }}
                      />
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-neutral-300">
                      <ImageIcon className="w-5 h-5 mb-0.5" />
                      <span className="text-[8px]">默认背景</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    ref={bgFileInputRef}
                    accept="image/*"
                    onChange={handleUploadBackground}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => bgFileInputRef.current?.click()}
                    disabled={isBgCompressing}
                    className="w-full py-2 px-3 bg-neutral-900 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isBgCompressing ? '正在自适应压缩图片...' : '导入本地图片为背景'}</span>
                  </button>
                  <p className="text-[10px] text-neutral-400 leading-tight">
                    内置 Canvas 智能压缩引擎，自动优化分辨率并控制体积在 ~150KB 内，绝不爆卡或闪退。
                  </p>
                </div>
              </div>

              {/* 背景图遮罩度（减淡程度调节） */}
              {settings.chatBackground && (
                <div className="pt-2 border-t border-neutral-100 space-y-1.5">
                  <div className="flex justify-between text-[11px] text-neutral-600">
                    <span className="font-medium">背景图遮罩度（减淡程度）</span>
                    <span className="font-mono font-bold text-neutral-800">
                      {Math.round((settings.chatBackgroundMask ?? 0.3) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.9"
                    step="0.05"
                    value={settings.chatBackgroundMask ?? 0.3}
                    onChange={e => updateSettingsSafely({ chatBackgroundMask: parseFloat(e.target.value) })}
                    className="w-full accent-neutral-900 cursor-pointer"
                  />
                  <span className="text-[10px] text-neutral-400 block">
                    滑动可增加白色柔光遮罩以减淡背景，确保文字与字卡气泡清晰易读。
                  </span>
                </div>
              )}
            </div>

            {/* 2. 气泡设置与自定义 CSS（直接选色，去除预设，去除透明度） */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-neutral-800 text-xs block">气泡设置与自定义 CSS</span>
                  <span className="text-[10px] text-neutral-400">
                    自选底色与字色 · 方圆度调节 · 自定义 CSS 支持
                  </span>
                </div>
              </div>

              {/* 气泡实时预览框 */}
              <div 
                className="p-3 rounded-2xl border border-neutral-200/80 space-y-2.5 relative overflow-hidden shadow-2xs"
                style={{
                  backgroundColor: settings.chatBackground ? 'transparent' : '#f5f5f5',
                  backgroundImage: settings.chatBackground ? `url(${settings.chatBackground})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {/* 遮罩层 */}
                {settings.chatBackground && (
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundColor: `rgba(255, 255, 255, ${settings.chatBackgroundMask ?? 0.3})`
                    }}
                  />
                )}

                <div className="relative z-10 space-y-2">
                  <span className="text-[10px] font-medium text-neutral-500 block text-center">
                    气泡与背景实时匹配预览
                  </span>

                  {/* 梦角气泡效果 */}
                  <div className="flex items-end gap-2 justify-start">
                    <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-neutral-200">
                      <img src={character.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                    <div
                      className="px-3 py-2 text-xs leading-relaxed max-w-[80%] shadow-2xs break-words"
                      style={{
                        backgroundColor: charBubble.bg,
                        color: charBubble.textColor,
                        borderRadius: `${charBubble.radius}px`,
                        ...parseCssDeclarations(charBubble.customCss),
                      }}
                    >
                      这是梦角的气泡样式预览～
                    </div>
                  </div>

                  {/* 我的气泡效果 */}
                  <div className="flex items-end gap-2 justify-end">
                    <div
                      className="px-3 py-2 text-xs leading-relaxed max-w-[80%] shadow-2xs break-words"
                      style={{
                        backgroundColor: userBubble.bg,
                        color: userBubble.textColor,
                        borderRadius: `${userBubble.radius}px`,
                        ...parseCssDeclarations(userBubble.customCss),
                      }}
                    >
                      这是我的气泡样式预览！
                    </div>
                  </div>
                </div>
              </div>

              {/* 气泡子 Tab 切换（梦角气泡 vs 我的气泡） */}
              <div className="flex p-0.5 bg-neutral-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveBubbleTab('character')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    activeBubbleTab === 'character' ? 'bg-white text-neutral-900 shadow-2xs font-bold' : 'text-neutral-500'
                  }`}
                >
                  梦角气泡
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBubbleTab('user')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    activeBubbleTab === 'user' ? 'bg-white text-neutral-900 shadow-2xs font-bold' : 'text-neutral-500'
                  }`}
                >
                  我的气泡
                </button>
              </div>

              {/* 当前选中气泡的参数调节（直接选颜色，无预设底色列表，无透明度滑块） */}
              {(() => {
                const cur = activeBubbleTab === 'character' ? charBubble : userBubble;
                const isChar = activeBubbleTab === 'character';

                return (
                  <div className="space-y-3 pt-1">
                    {/* 直接自选气泡底色 */}
                    <div className="flex items-center justify-between p-2 bg-neutral-50 rounded-xl border border-neutral-200/70">
                      <div>
                        <span className="text-xs text-neutral-800 font-medium block">气泡底色</span>
                        <span className="text-[10px] text-neutral-400">点击颜色框直接自选</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={cur.bg?.startsWith('#') ? cur.bg : '#ffffff'}
                          onChange={e => handleUpdateBubbleProp(isChar ? 'character' : 'user', 'bg', e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border border-neutral-300 p-0.5 bg-white shadow-2xs"
                        />
                        <input
                          type="text"
                          value={cur.bg ?? ''}
                          onChange={e => handleUpdateBubbleProp(isChar ? 'character' : 'user', 'bg', e.target.value)}
                          placeholder="#ffffff"
                          className="w-20 px-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs font-mono text-center outline-none"
                        />
                      </div>
                    </div>

                    {/* 直接自选文字颜色 */}
                    <div className="flex items-center justify-between p-2 bg-neutral-50 rounded-xl border border-neutral-200/70">
                      <div>
                        <span className="text-xs text-neutral-800 font-medium block">文字颜色</span>
                        <span className="text-[10px] text-neutral-400">点击颜色框直接自选</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={cur.textColor?.startsWith('#') ? cur.textColor : '#262626'}
                          onChange={e => handleUpdateBubbleProp(isChar ? 'character' : 'user', 'textColor', e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border border-neutral-300 p-0.5 bg-white shadow-2xs"
                        />
                        <input
                          type="text"
                          value={cur.textColor ?? ''}
                          onChange={e => handleUpdateBubbleProp(isChar ? 'character' : 'user', 'textColor', e.target.value)}
                          placeholder="#262626"
                          className="w-20 px-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs font-mono text-center outline-none"
                        />
                      </div>
                    </div>

                    {/* 方圆度调节 (Radius) */}
                    <div>
                      <div className="flex justify-between text-[11px] text-neutral-600 mb-1">
                        <span>方圆度 (圆角半径)</span>
                        <span className="font-mono font-bold text-neutral-800">
                          {cur.radius ?? 18} px {cur.radius === 0 ? '(直角方气泡)' : cur.radius >= 24 ? '(超圆润)' : ''}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="28"
                        step="1"
                        value={cur.radius ?? 18}
                        onChange={e => handleUpdateBubbleProp(isChar ? 'character' : 'user', 'radius', parseInt(e.target.value, 10))}
                        className="w-full accent-neutral-900 cursor-pointer"
                      />
                    </div>

                    {/* 用户自定义 CSS */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Code className="w-3.5 h-3.5 text-neutral-600" />
                          <span className="text-[11px] font-bold text-neutral-800">自定义气泡 CSS 样式</span>
                        </div>
                        {cur.customCss && (
                          <button
                            type="button"
                            onClick={() => handleUpdateBubbleProp(isChar ? 'character' : 'user', 'customCss', '')}
                            className="text-[10px] text-neutral-400 hover:text-neutral-700"
                          >
                            清空 CSS
                          </button>
                        )}
                      </div>

                      <div className="p-2 bg-neutral-50 rounded-xl border border-neutral-200/80 text-[10px] text-neutral-500 font-mono leading-relaxed">
                        <strong className="text-neutral-700 font-semibold block mb-0.5">标注 CSS 格式要求：</strong>
                        输入标准的 CSS 属性声明，各属性以分号 <code>;</code> 隔开。<br />
                        <span className="text-neutral-400 block mt-1">
                          示例：<br />
                          background: linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%);<br />
                          border: 1px solid rgba(255, 255, 255, 0.4);<br />
                          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);<br />
                          color: #333333;
                        </span>
                      </div>

                      <textarea
                        rows={3}
                        value={cur.customCss || ''}
                        onChange={e => handleUpdateBubbleProp(isChar ? 'character' : 'user', 'customCss', e.target.value)}
                        placeholder="在此输入自定义 CSS 代码，如：background: linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%);"
                        className="w-full p-2.5 bg-neutral-50 font-mono text-xs rounded-xl border border-neutral-200 text-neutral-800 placeholder-neutral-400 outline-none focus:border-neutral-400 resize-none"
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 3. 聊天字体美化（在气泡下方，TTF 格式自定义） */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Type className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-neutral-800 text-xs block">聊天字体美化</span>
                    <span className="text-[10px] text-neutral-400">
                      支持 .ttf / .otf 格式自定义字体导入
                    </span>
                  </div>
                </div>

                {settings.chatCustomFontName && (
                  <button
                    type="button"
                    onClick={handleResetFont}
                    className="text-[10px] text-neutral-400 hover:text-rose-600 cursor-pointer"
                  >
                    恢复系统字体
                  </button>
                )}
              </div>

              {/* 当前字体状态 */}
              <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/70 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-neutral-400 block">当前激活字体</span>
                  <span className="text-xs font-semibold text-neutral-800">
                    {settings.chatCustomFontName ? settings.chatCustomFontName : '系统默认无衬线字体'}
                  </span>
                </div>

                <input
                  type="file"
                  ref={fontFileInputRef}
                  accept=".ttf,.otf"
                  onChange={handleUploadFont}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fontFileInputRef.current?.click()}
                  disabled={isFontLoading}
                  className="px-3 py-1.5 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Upload className="w-3 h-3" />
                  <span>{isFontLoading ? '正在加载字体...' : '导入 TTF 字体'}</span>
                </button>
              </div>

              {/* 字体效果示例 */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-dashed border-neutral-200 space-y-1">
                <span className="text-[10px] text-neutral-400 block">字体效果实时预览：</span>
                <p className="text-sm text-neutral-800 leading-relaxed font-normal chat-custom-font-active">
                  「山水一程，三生有幸」· 愿所有日子都清澈明朗。<br />
                  The quick brown fox jumps over the lazy dog. 1234567890
                </p>
              </div>
            </div>


          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: 字卡设置                                                           */}
        {/* ========================================================================= */}
        {activeTab === 'cards' && (
          <div className="space-y-3.5 animate-fade-in">

            {/* 导入结果反馈卡片 */}
            {importSummary && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-[11px] space-y-1 animate-fade-in shadow-2xs">
                <div className="flex items-center justify-between font-bold text-xs text-emerald-800">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>导入完成</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImportSummary(null)}
                    className="text-[10px] text-emerald-600 hover:underline cursor-pointer"
                  >
                    关闭
                  </button>
                </div>
                <div className="text-[11px] text-emerald-800/90 pt-0.5 space-y-0.5">
                  <p>• 普通字卡：<strong>{importSummary.cardsCount}</strong> 条（实际新增 <strong>{importSummary.totalNewCards}</strong> 条）</p>
                  {importSummary.groupsCount > 0 && <p>• 字卡分类：<strong>{importSummary.groupsCount}</strong> 个</p>}
                </div>
              </div>
            )}

            {/* 错误提示条 */}
            {importError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-[11px] flex items-center justify-between animate-fade-in shadow-2xs">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{importError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setImportError(null)}
                  className="text-[10px] text-rose-600 hover:underline shrink-0"
                >
                  关闭
                </button>
              </div>
            )}

            {/* 添加字卡反馈条（去重提示） */}
            {batchFeedback && (
              <div className={`p-3 rounded-2xl text-[11px] flex items-center justify-between animate-fade-in shadow-2xs ${
                batchFeedback.type === 'success' 
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
                  : batchFeedback.type === 'warning'
                  ? 'bg-amber-50 border border-amber-200 text-amber-900'
                  : 'bg-rose-50 border border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center gap-1.5">
                  {batchFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span>{batchFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBatchFeedback(null)}
                  className="text-[10px] opacity-75 hover:opacity-100 shrink-0 ml-2"
                >
                  关闭
                </button>
              </div>
            )}

            {/* 顶部总览与导入卡片 */}
            <div className="bg-white p-3 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-neutral-800 text-xs block">字卡库管理</span>
                  <span className="text-[10px] text-neutral-400 font-light">
                    纯随机抽取机制 · 无概率权重
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-pink-50 text-pink-700 px-2 py-0.5 rounded-full font-medium">
                    共 {cards.length} 张
                  </span>
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    {groups.length} 个分类
                  </span>
                </div>
              </div>

              {/* 导入与导出字卡操作 */}
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={cardFileInputRef}
                  accept=".json"
                  onChange={handleCardFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => cardFileInputRef.current?.click()}
                  disabled={isImporting}
                  className="flex-1 py-2 px-2.5 bg-neutral-900 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isImporting ? '正在解析导入...' : '导入字卡 JSON'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportJson}
                  className="flex-1 py-2 px-2.5 bg-white text-neutral-700 border border-neutral-300 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-neutral-50 active:scale-95 transition-all cursor-pointer shadow-2xs"
                  title="仅导出字卡与分类 JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>导出字卡 JSON</span>
                </button>
              </div>
            </div>

            {/* 1. 字卡分类管理模块 */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-neutral-800 text-xs block">字卡分类</span>
                  <span className="text-[10px] text-neutral-400">
                    可自由添加、修改或删除分类；点击标签筛选
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddGroupForm(!showAddGroupForm)}
                  className="text-xs px-2.5 py-1 bg-pink-50 text-pink-700 hover:bg-pink-100 rounded-xl font-medium flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>新建分类</span>
                </button>
              </div>

              {/* 新建分类表单 */}
              {showAddGroupForm && (
                <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-700 text-xs">添加新分类</span>
                    <button
                      type="button"
                      onClick={() => setShowAddGroupForm(false)}
                      className="text-neutral-400 hover:text-neutral-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={newGroupName ?? ''}
                    onChange={e => setNewGroupName(e.target.value)}
                    placeholder="分类名称（如：清晨问候、睡前呢喃）"
                    className="w-full px-3 py-1.5 bg-white rounded-xl border border-neutral-200 text-xs text-neutral-800 outline-none focus:border-neutral-400"
                  />

                  {/* 预设色板选择 */}
                  <div>
                    <span className="text-[10px] text-neutral-400 block mb-1">选择分类专属颜色：</span>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_PALETTE.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewGroupColor(c)}
                          className={`w-5 h-5 rounded-full border transition-transform ${
                            newGroupColor === c ? 'scale-125 ring-2 ring-neutral-800' : 'hover:scale-110'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddGroupForm(false)}
                      className="px-3 py-1 rounded-xl text-neutral-600 hover:bg-neutral-200 text-xs"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateGroup}
                      disabled={!newGroupName.trim()}
                      className="px-3 py-1 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 disabled:opacity-40"
                    >
                      确定添加
                    </button>
                  </div>
                </div>
              )}

              {/* 分类快捷标签列表 */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('全部')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                    selectedCategory === '全部'
                      ? 'bg-neutral-900 text-white shadow-2xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  全部 ({cards.length})
                </button>

                {groups.map(group => {
                  const isSelected = selectedCategory === group.name;
                  const count = cards.filter(c => c.category === group.name).length;

                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setSelectedCategory(group.name)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'text-white shadow-2xs'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                      style={{
                        backgroundColor: isSelected ? group.color : undefined,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: isSelected ? '#ffffff' : group.color }}
                      />
                      <span>{group.name}</span>
                      <span className="text-[9px] opacity-75">({count})</span>
                    </button>
                  );
                })}

                {/* 未分类标签 */}
                {cards.some(c => c.category === '未分类') && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('未分类')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                      selectedCategory === '未分类'
                        ? 'bg-neutral-900 text-white shadow-2xs'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    未分类 ({cards.filter(c => c.category === '未分类').length})
                  </button>
                )}
              </div>

              {/* 分类详情可收纳栏（小优化：防止分类过多，做成可收纳栏） */}
              {groups.length > 0 && (
                <div className="pt-1 border-t border-neutral-100">
                  <div
                    onClick={() => setIsCategoryDetailsExpanded(!isCategoryDetailsExpanded)}
                    className="p-2 px-2.5 rounded-xl bg-neutral-50/80 border border-neutral-200/70 flex items-center justify-between cursor-pointer hover:bg-neutral-100/70 select-none transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-neutral-800">分类详情</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-200/70 text-neutral-600 font-medium">
                        {groups.length} 个分类
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                      <span>{isCategoryDetailsExpanded ? '收起详情' : '展开详情 (修改/删除)'}</span>
                      {isCategoryDetailsExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </div>

                  {isCategoryDetailsExpanded && (
                    <div className="mt-2 space-y-1.5 animate-fade-in">
                      <span className="text-[10px] text-neutral-400 block px-1">
                        可修改分类名称、标识色或删除分类：
                      </span>

                      {groups.map(g => {
                        const isEditing = editingGroupId === g.id;

                        return (
                          <div
                            key={g.id}
                            className="p-2 rounded-xl bg-neutral-50 border border-neutral-200/70 flex items-center justify-between gap-2"
                          >
                            {isEditing ? (
                              <div className="flex-1 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingGroupName ?? ''}
                                  onChange={e => setEditingGroupName(e.target.value)}
                                  className="px-2 py-0.5 bg-white rounded border border-neutral-300 text-xs flex-1"
                                  autoFocus
                                />
                                <div className="flex gap-1">
                                  {PRESET_PALETTE.slice(0, 5).map(col => (
                                    <button
                                      key={col}
                                      type="button"
                                      onClick={() => setEditingGroupColor(col)}
                                      className={`w-4 h-4 rounded-full ${
                                        editingGroupColor === col ? 'ring-2 ring-neutral-800' : ''
                                      }`}
                                      style={{ backgroundColor: col }}
                                    />
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditGroup(g.id)}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                  title="保存"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingGroupId(null)}
                                  className="p-1 text-neutral-400 hover:bg-neutral-200 rounded cursor-pointer"
                                  title="取消"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: g.color }}
                                  />
                                  <span className="text-xs font-medium text-neutral-800 truncate">
                                    {g.name}
                                  </span>
                                  <span className="text-[10px] text-neutral-400">
                                    ({cards.filter(c => c.category === g.name).length} 张)
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingGroupId(g.id);
                                      setEditingGroupName(g.name);
                                      setEditingGroupColor(g.color);
                                    }}
                                    className="text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
                                    title="修改分类"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteGroup(g.name)}
                                    className="text-neutral-400 hover:text-rose-500 p-1 cursor-pointer"
                                    title="删除分类（原字卡归入未分类）"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. 批量添加字卡（换行为一条 + 自动筛选去重） */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-neutral-800 text-xs block">批量添加字卡</span>
                    <span className="text-[9px] bg-pink-50 text-pink-600 px-1.5 py-0.2 rounded font-medium">
                      自动筛选去重
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">
                    每行一条字卡，重复内容将自动过滤去重
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-neutral-400">归入分类：</span>
                  <select
                    value={batchTargetCategory ?? ''}
                    onChange={e => setBatchTargetCategory(e.target.value)}
                    className="px-2 py-1 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-700 outline-none"
                  >
                    <option value="">
                      {selectedCategory !== '全部' ? selectedCategory : (categoryNames[0] || '未分类')} (默认)
                    </option>
                    {categoryNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    <option value="未分类">未分类</option>
                  </select>
                </div>
              </div>

              <textarea
                rows={4}
                value={batchInputText ?? ''}
                onChange={e => setBatchInputText(e.target.value)}
                placeholder="在此粘贴或输入字卡内容...&#10;换行为一条，例如：&#10;今天的天气格外清澈，适合慢慢散步&#10;想买一束花放在你的窗台"
                className="w-full p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-800 placeholder-neutral-400 outline-none focus:border-neutral-400 resize-none font-sans"
              />

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] text-neutral-400">
                  {pendingLinesCount > 0 ? `当前已输入 ${pendingLinesCount} 行字卡文本` : '支持批量复制粘贴多行文本'}
                </span>

                <button
                  type="button"
                  onClick={handleBatchAddCards}
                  disabled={pendingLinesCount === 0}
                  className="px-4 py-1.5 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 disabled:opacity-40 active:scale-95 transition-all cursor-pointer shadow-2xs"
                >
                  添加字卡 ({pendingLinesCount})
                </button>
              </div>
            </div>

            {/* 3. 字卡检索与批量删除列表 */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-neutral-800 text-xs block">
                    当前分类字卡列表
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    筛选：{selectedCategory} · 共 {filteredCards.length} 张 · 点击文字可直接编辑
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsBatchMode(!isBatchMode);
                      if (isBatchMode) setSelectedCardIds(new Set());
                      setEditingCardId(null);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isBatchMode
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {isBatchMode ? '退出批量' : '批量管理'}
                  </button>
                </div>
              </div>

              {/* 批量模式操作栏 */}
              {isBatchMode && (
                <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/80 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="px-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs font-medium text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                    >
                      {selectedCardIds.size === filteredCards.length && filteredCards.length > 0 ? '全不选' : '全选当前'}
                    </button>
                    <span className="text-[11px] text-neutral-500">
                      已选 {selectedCardIds.size} 张
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setBatchMoveTargetGroup(groups[0]?.name || '未分类');
                        setBatchMoveNewGroupName('');
                        setShowBatchMoveModal(true);
                      }}
                      disabled={selectedCardIds.size === 0}
                      className="px-2.5 py-1 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 disabled:opacity-40 transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                    >
                      <FolderInput className="w-3.5 h-3.5 text-pink-400" />
                      <span>移动分组 ({selectedCardIds.size})</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBatchDelete}
                      disabled={selectedCardIds.size === 0}
                      className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
                    >
                      删除 ({selectedCardIds.size})
                    </button>
                  </div>
                </div>
              )}

              {/* 检索框 */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={searchKeyword ?? ''}
                  onChange={e => setSearchKeyword(e.target.value)}
                  placeholder="按字卡文本搜索..."
                  className="w-full pl-8 pr-3 py-1.5 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-800 placeholder-neutral-400 outline-none focus:border-neutral-400"
                />
                {searchKeyword && (
                  <button
                    type="button"
                    onClick={() => setSearchKeyword('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400 hover:text-neutral-600"
                  >
                    清空
                  </button>
                )}
              </div>

              {/* 字卡列表容器 */}
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                {filteredCards.length === 0 ? (
                  <div className="p-8 text-center text-neutral-400 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
                    当前分类下暂无字卡
                  </div>
                ) : (
                  filteredCards.map((card) => {
                    const color = getCategoryColor(card.category);
                    const isSelected = selectedCardIds.has(card.id);
                    const isEditing = editingCardId === card.id;

                    return (
                      <div
                        key={card.id}
                        onClick={() => {
                          if (isBatchMode) {
                            handleToggleSelectCard(card.id);
                          }
                        }}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-rose-50/60 border-rose-300 ring-1 ring-rose-200'
                            : isEditing
                            ? 'bg-white border-pink-400 ring-2 ring-pink-100 shadow-xs'
                            : 'bg-neutral-50/80 border-neutral-200/70 hover:border-neutral-300'
                        } ${isBatchMode ? 'cursor-pointer' : ''}`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2 flex-1">
                          {isBatchMode && (
                            <div className="shrink-0 text-neutral-500">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-rose-600" />
                              ) : (
                                <Square className="w-4 h-4 text-neutral-300" />
                              )}
                            </div>
                          )}

                          <span
                            className="text-[9px] px-2 py-0.5 rounded-md font-medium shrink-0 border"
                            style={{
                              backgroundColor: `${color}15`,
                              color: color,
                              borderColor: `${color}30`,
                            }}
                          >
                            {card.category}
                          </span>

                          {isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              value={editingCardText}
                              onChange={(e) => setEditingCardText(e.target.value)}
                              onBlur={() => handleSaveCardEdit(card.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveCardEdit(card.id);
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  handleCancelCardEdit();
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 text-xs text-neutral-900 bg-white border border-pink-400 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-pink-500 shadow-2xs"
                              placeholder="输入字卡内容..."
                            />
                          ) : (
                            <span
                              onClick={(e) => {
                                if (!isBatchMode) {
                                  e.stopPropagation();
                                  handleStartEditCard(card);
                                }
                              }}
                              className="text-xs text-neutral-800 truncate select-text cursor-text hover:text-pink-600 hover:bg-neutral-200/50 px-1 py-0.5 rounded transition-colors flex-1"
                              title="点击直接修改字卡内容"
                            >
                              {card.text}
                            </span>
                          )}
                        </div>

                        {!isBatchMode && !isEditing && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSingleCard(card.id);
                            }}
                            className="text-neutral-400 hover:text-rose-500 p-1 shrink-0 transition-colors cursor-pointer"
                            title="删除字卡"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 批量移动分组弹窗 */}
      {showBatchMoveModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in select-none">
          <div 
            className="bg-white w-full max-w-xs sm:max-w-sm rounded-3xl p-5 shadow-2xl border border-neutral-200 space-y-4 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-1.5 font-bold text-neutral-900 text-sm">
                <FolderInput className="w-4 h-4 text-pink-500" />
                <span>批量移动字卡分组</span>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchMoveModal(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              已选中 <strong className="text-pink-600 font-bold">{selectedCardIds.size}</strong> 张字卡，请选择或输入要移动到的目标分组：
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-neutral-500 block mb-1.5">选择已有分组</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-neutral-50 rounded-2xl border border-neutral-200">
                  {['未分类', ...groups.map(g => g.name).filter(n => n !== '未分类')].map(groupName => (
                    <button
                      key={groupName}
                      type="button"
                      onClick={() => {
                        setBatchMoveTargetGroup(groupName);
                        setBatchMoveNewGroupName('');
                      }}
                      className={`p-2 rounded-xl text-xs text-left border transition-all cursor-pointer truncate ${
                        batchMoveTargetGroup === groupName && !batchMoveNewGroupName
                          ? 'border-pink-500 bg-pink-50 text-pink-900 font-semibold ring-1 ring-pink-300'
                          : 'border-neutral-200/80 bg-white text-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      {groupName}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-neutral-500 block mb-1">或移动至新建分组</label>
                <input
                  type="text"
                  value={batchMoveNewGroupName}
                  onChange={e => {
                    setBatchMoveNewGroupName(e.target.value);
                    if (e.target.value.trim()) setBatchMoveTargetGroup('');
                  }}
                  placeholder="输入新分组名称（如：专属情话）"
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-neutral-400"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowBatchMoveModal(false)}
                className="flex-1 py-2 bg-neutral-100 text-neutral-600 rounded-xl text-xs font-medium hover:bg-neutral-200 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleBatchMoveGroup}
                disabled={!batchMoveNewGroupName.trim() && !batchMoveTargetGroup.trim()}
                className="flex-1 py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 disabled:opacity-40 cursor-pointer shadow-sm"
              >
                确认移动
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
