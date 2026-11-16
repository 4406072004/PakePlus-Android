import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, 
  Camera, 
  Heart, 
  MessageCircle, 
  Trash2, 
  CheckSquare, 
  Square, 
  X, 
  Sparkles, 
  Calendar, 
  Edit3, 
  Image as ImageIcon, 
  User, 
  Send,
  CornerDownRight,
  Upload,
  Sliders,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { MomentPost, UserProfile, Character, Card, MomentsProfile, MomentsSettings } from '../types';
import { CardEngine } from '../core/CardEngine';
import { ProbabilityEngine } from '../core/ProbabilityEngine';
import { StorageService } from '../services/StorageService';
import { fileToBase64 } from '../utils/imageUpload';
import { globalScheduler } from '../core/Scheduler';

interface MomentsPageProps {
  userProfile: UserProfile;
  character: Character;
  cards: Card[];
  moments: MomentPost[];
  onAddMoment: (post: MomentPost) => void;
  onUpdateMoment?: (post: MomentPost) => void;
  onUpdateAllMoments?: (posts: MomentPost[]) => void;
  onDeleteMoments?: (ids: string[]) => void;
  onBack: () => void;
}

// 预设头像推荐只保留5个，且全部为精选女性头像
const FEMALE_PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/notionists/svg?seed=Aria&backgroundColor=fce7f3', // 温柔长发少女
  'https://api.dicebear.com/7.x/notionists/svg?seed=Luna&backgroundColor=ede9fe', // 甜美丸子头少女
  'https://api.dicebear.com/7.x/notionists/svg?seed=Chloe&backgroundColor=ffe4e6', // 俏皮短发女孩
  'https://api.dicebear.com/7.x/notionists/svg?seed=Zoe&backgroundColor=dcfce7', // 灵动双马尾少女
  'https://api.dicebear.com/7.x/notionists/svg?seed=Mia&backgroundColor=fef3c7', // 恬静微卷发少女
];

const PRESET_COVERS = [
  { name: '郁金香语', url: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=900&auto=format&fit=crop&q=80' },
  { name: '夏日晴海', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&auto=format&fit=crop&q=80' },
  { name: '星空梦境', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=900&auto=format&fit=crop&q=80' },
  { name: '山涧晨曦', url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=900&auto=format&fit=crop&q=80' },
  { name: '樱花暖春', url: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=900&auto=format&fit=crop&q=80' },
  { name: '午后咖啡', url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900&auto=format&fit=crop&q=80' },
];

const safeFormatDate = (timestamp?: number): string => {
  if (!timestamp || isNaN(timestamp)) return '';
  try {
    const d = new Date(timestamp);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
};

const getYearMonth = (timestamp?: number): string => {
  if (!timestamp || isNaN(timestamp)) return '其他日期';
  try {
    const d = new Date(timestamp);
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  } catch {
    return '其他日期';
  }
};

export const MomentsPage: React.FC<MomentsPageProps> = ({
  userProfile,
  character,
  cards,
  moments,
  onAddMoment,
  onUpdateMoment,
  onUpdateAllMoments,
  onDeleteMoments,
  onBack,
}) => {
  // Moments profile (方形背景、头像、昵称)
  const [profile, setProfile] = useState<MomentsProfile>(() => {
    return StorageService.getMomentsProfile({
      avatar: userProfile.avatar,
      nickname: userProfile.name,
    });
  });

  // Modals state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editCover, setEditCover] = useState(profile.cover);
  const [editAvatar, setEditAvatar] = useState(profile.avatar);
  const [editNickname, setEditNickname] = useState(profile.nickname);

  // Proactive posting settings modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [momentsSettings, setMomentsSettings] = useState<MomentsSettings>(() => {
    return StorageService.getMomentsSettings();
  });
  const [showCharImagePoolPage, setShowCharImagePoolPage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const charImageInputRef = useRef<HTMLInputElement>(null);

  // Post publishing modal
  const [showPostModal, setShowPostModal] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState<string | null>(null);

  // Batch delete state
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  // Single post delete confirm
  const [deletePostTargetId, setDeletePostTargetId] = useState<string | null>(null);

  // Year/Month archive selection
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>('all');

  // Comment & reply state
  // activeCommentBox: { postId: string, replyTo?: string, commentId?: string } | null
  const [activeCommentBox, setActiveCommentBox] = useState<{
    postId: string;
    replyTo?: string;
    commentId?: string;
  } | null>(null);
  const [commentInputText, setCommentInputText] = useState('');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const timersRef = useRef<number[]>([]);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const postImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      timersRef.current.forEach(id => clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  // 当主界面修改角色头像和昵称时，自动同步朋友圈中角色发布的所有历史动态
  useEffect(() => {
    if (!character || moments.length === 0) return;
    const charName = character.nickname || character.name;
    const charAvatar = character.avatar;
    let hasChanges = false;

    const updated = moments.map(post => {
      if (post.author === 'character') {
        if (post.authorName !== charName || post.authorAvatar !== charAvatar) {
          hasChanges = true;
          return {
            ...post,
            authorName: charName,
            authorAvatar: charAvatar,
          };
        }
      }
      return post;
    });

    if (hasChanges) {
      if (onUpdateAllMoments) {
        onUpdateAllMoments(updated);
      } else {
        StorageService.saveMoments(updated);
      }
    }
  }, [character?.nickname, character?.name, character?.avatar, moments, onUpdateAllMoments]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 2200);
  };

  // 清空预设朋友圈，完全使用真实数据
  const displayMoments = moments;

  // Available Year-Months
  const availableYearMonths = useMemo(() => {
    const map = new Map<string, number>();
    displayMoments.forEach(m => {
      const ym = getYearMonth(m.timestamp);
      map.set(ym, (map.get(ym) || 0) + 1);
    });
    return Array.from(map.entries()).map(([ym, count]) => ({ ym, count }));
  }, [displayMoments]);

  // Filtered moments based on selected Year-Month
  const filteredMoments = useMemo(() => {
    if (selectedYearMonth === 'all') return displayMoments;
    return displayMoments.filter(m => getYearMonth(m.timestamp) === selectedYearMonth);
  }, [displayMoments, selectedYearMonth]);

  // Grouped by Month when in 'all' view
  const groupedMoments = useMemo(() => {
    const groups: { [key: string]: MomentPost[] } = {};
    filteredMoments.forEach(m => {
      const ym = getYearMonth(m.timestamp);
      if (!groups[ym]) groups[ym] = [];
      groups[ym].push(m);
    });
    return groups;
  }, [filteredMoments]);

  // Handle Cover / Avatar file uploads
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setEditCover(base64);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setEditAvatar(base64);
  };

  const handlePostImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setPostImage(base64);
  };

  // Save profile changes (同步更新头像、昵称，并将之前发送的所有朋友圈动态及评论/点赞同步更新)
  const handleSaveProfile = () => {
    const oldNickname = profile.nickname;
    const newNickname = editNickname.trim() || profile.nickname;
    const newAvatar = editAvatar || profile.avatar;
    const newCover = editCover || profile.cover;

    const newProfile: MomentsProfile = {
      cover: newCover,
      avatar: newAvatar,
      nickname: newNickname,
    };
    setProfile(newProfile);
    StorageService.saveMomentsProfile(newProfile);

    // 同步更新所有之前发布的动态内容（包括之前发的）
    const currentList = moments;
    const updatedMoments = currentList.map(post => {
      const isUserAuthor = post.author === 'user' || post.authorName === oldNickname;
      const authorName = isUserAuthor ? newNickname : post.authorName;
      const authorAvatar = isUserAuthor ? newAvatar : post.authorAvatar;

      const updatedLikes = post.likes.map(name => (name === oldNickname ? newNickname : name));

      const updatedComments = post.comments.map(c => {
        const cAuthor = c.author === oldNickname ? newNickname : c.author;
        const cReplyTo = c.replyTo === oldNickname ? newNickname : c.replyTo;
        return {
          ...c,
          author: cAuthor,
          replyTo: cReplyTo,
        };
      });

      return {
        ...post,
        authorName,
        authorAvatar,
        likes: updatedLikes,
        comments: updatedComments,
      };
    });

    if (onUpdateAllMoments) {
      onUpdateAllMoments(updatedMoments);
    } else {
      StorageService.saveMoments(updatedMoments);
      if (onUpdateMoment) {
        updatedMoments.forEach(m => onUpdateMoment(m));
      }
    }

    setShowProfileModal(false);
    showToast('头像与昵称已更新，历史动态已同步');
  };

  // 保存主动发朋友圈设置
  const handleSaveSettings = () => {
    const minI = Math.max(1, momentsSettings.minIntervalMinutes);
    const maxI = Math.max(minI, momentsSettings.maxIntervalMinutes);
    const safeRate = Math.max(0, Math.min(100, momentsSettings.dailyProactiveRate));
    const safeMaxPosts = (momentsSettings.maxDailyPosts === 1 || momentsSettings.maxDailyPosts === 5) ? momentsSettings.maxDailyPosts : 3;
    const minCards = Math.max(1, Math.min(10, Math.floor(momentsSettings.minCardsPerPost || 1)));
    const maxCards = Math.max(minCards, Math.min(10, Math.floor(momentsSettings.maxCardsPerPost || 3)));

    const safe: MomentsSettings = {
      ...momentsSettings,
      dailyProactiveRate: safeRate,
      maxDailyPosts: safeMaxPosts,
      minIntervalMinutes: minI,
      maxIntervalMinutes: maxI,
      minCardsPerPost: minCards,
      maxCardsPerPost: maxCards,
      enableCharacterImagePost: momentsSettings.enableCharacterImagePost ?? false,
      characterImagePool: Array.isArray(momentsSettings.characterImagePool) ? momentsSettings.characterImagePool : [],
    };
    setMomentsSettings(safe);
    StorageService.saveMomentsSettings(safe);
    setShowSettingsModal(false);
    showToast('朋友圈设置已保存');
  };

  // 角色图片库上传处理（自动缩放压缩保障稳定性与存储限额）
  const handleUploadCharImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const addedImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file && file.type.startsWith('image/')) {
        const compressed = await fileToBase64(file);
        if (compressed) {
          addedImages.push(compressed);
        }
      }
    }
    if (addedImages.length > 0) {
      setMomentsSettings(prev => ({
        ...prev,
        characterImagePool: [...(prev.characterImagePool || []), ...addedImages],
      }));
      showToast(`已向角色图片库添加 ${addedImages.length} 张图片`);
    }
    e.target.value = '';
  };

  const handleDeleteCharImage = (index: number) => {
    setMomentsSettings(prev => ({
      ...prev,
      characterImagePool: (prev.characterImagePool || []).filter((_, i) => i !== index),
    }));
    showToast('已从图片库移除该图片');
  };

  // 通过统一的 Scheduler 立即触发主动发动态测试
  const handleTestProactiveMoment = () => {
    globalScheduler.schedule('moment_post', 1000, {
      isManualTest: true,
    });
    showToast('已排入 Scheduler：角色将在 1 秒后主动发动态！');
  };

  // 通过统一的 Scheduler 立即触发互动测试（点赞与评论）
  const handleTestInteraction = () => {
    const targetPost = displayMoments[0];
    if (!targetPost) {
      showToast('暂无朋友圈动态可供测试');
      return;
    }
    // 立即测试：1秒后点赞，1.5秒后评论
    globalScheduler.schedule('moment_like', 1000, {
      postId: targetPost.id,
      likerName: character.nickname || character.name,
    });
    globalScheduler.schedule('moment_comment', 1500, {
      postId: targetPost.id,
      authorName: character.nickname || character.name,
    });
    showToast('已排入 Scheduler：角色将在 1 秒后点赞、1.5 秒后评论！');
  };

  // Create new moment
  const handleCreatePost = () => {
    if (!postContent.trim() && !postImage) return;

    const newPost: MomentPost = {
      id: 'post_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      author: 'user',
      authorName: profile.nickname,
      authorAvatar: profile.avatar,
      content: postContent.trim(),
      images: postImage ? [postImage] : undefined,
      timestamp: Date.now(),
      likes: [],
      comments: [],
    };

    onAddMoment(newPost);
    setPostContent('');
    setPostImage(null);
    setShowPostModal(false);
    showToast('动态已发布（对方将在 1 分钟后点赞，1~3 分钟内评论）');

    // 2. 我发朋友圈，对方点赞的概率是百分百，在我发送一分钟后点赞。
    globalScheduler.schedule('moment_like', 60 * 1000, {
      postId: newPost.id,
      likerName: character.nickname || character.name,
    });

    // 对方主动评论我的朋友圈的概率是80%，在我发送后1～3分钟内评论，
    // 评论时随机抽取1-3条字卡，抽取逻辑和聊天一样。字卡与字卡之间的拼接用逗号。
    if (Math.random() < 0.8) {
      const commentDelayMs = Math.floor(60000 + Math.random() * 120000); // 1~3 分钟内随机
      globalScheduler.schedule('moment_comment', commentDelayMs, {
        postId: newPost.id,
        authorName: character.nickname || character.name,
      });
    }
  };

  // Toggle batch select
  const toggleSelectPost = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredMoments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMoments.map(m => m.id));
    }
  };

  // Confirm batch delete
  const handleConfirmBatchDelete = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;

    if (onDeleteMoments) {
      onDeleteMoments(selectedIds);
    } else {
      const next = moments.filter(m => !selectedIds.includes(m.id));
      StorageService.saveMoments(next);
    }

    setSelectedIds([]);
    setIsBatchMode(false);
    setShowBatchDeleteConfirm(false);
    showToast(`已批量删除 ${count} 条动态`);
  };

  // Single post delete
  const handleConfirmSingleDelete = () => {
    if (!deletePostTargetId) return;
    const id = deletePostTargetId;
    if (onDeleteMoments) {
      onDeleteMoments([id]);
    } else {
      const next = moments.filter(m => m.id !== id);
      StorageService.saveMoments(next);
    }
    setDeletePostTargetId(null);
    showToast('动态已删除');
  };

  // Like / Unlike a post
  const handleToggleLike = (post: MomentPost) => {
    const hasLiked = post.likes.includes(profile.nickname);
    const newLikes = hasLiked
      ? post.likes.filter(name => name !== profile.nickname)
      : [...post.likes, profile.nickname];

    const updated: MomentPost = { ...post, likes: newLikes };
    if (onUpdateMoment) {
      onUpdateMoment(updated);
    } else {
      onAddMoment(updated);
    }
  };

  // Submit comment or reply
  const handleSubmitComment = () => {
    if (!activeCommentBox || !commentInputText.trim()) return;

    const { postId, replyTo } = activeCommentBox;
    const targetPost = displayMoments.find(m => m.id === postId);
    if (!targetPost) return;

    const newComment = {
      id: 'comm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      author: profile.nickname,
      text: commentInputText.trim(),
      timestamp: Date.now(),
      replyTo: replyTo || undefined,
    };

    const updatedPost: MomentPost = {
      ...targetPost,
      comments: [...targetPost.comments, newComment],
    };

    if (onUpdateMoment) {
      onUpdateMoment(updatedPost);
    } else {
      onAddMoment(updatedPost);
    }

    setCommentInputText('');
    setActiveCommentBox(null);
    showToast(replyTo ? `已回复 @${replyTo}` : '评论已发送（对方有80%概率在1~3分钟内回复）');

    // 2. 我发表评论，对方回复我评论的概率是80%。机制同上（1～3分钟内回复，抽取1-3张字卡用逗号拼接）
    if (Math.random() < 0.8) {
      const replyDelayMs = Math.floor(60000 + Math.random() * 120000); // 1~3 分钟内随机
      globalScheduler.schedule('moment_comment', replyDelayMs, {
        postId: targetPost.id,
        replyTo: profile.nickname,
        authorName: character.nickname || character.name,
      });
    }
  };

  // Delete a specific comment
  const handleDeleteComment = (post: MomentPost, commentId: string) => {
    const updatedPost: MomentPost = {
      ...post,
      comments: post.comments.filter(c => c.id !== commentId),
    };
    if (onUpdateMoment) {
      onUpdateMoment(updatedPost);
    } else {
      onAddMoment(updatedPost);
    }
    showToast('评论已删除');
  };

  // 角色专属图片库独立子页面（小优化：朋友圈→角色图片库单独做一页，说明不出现20%概率）
  if (showCharImagePoolPage) {
    return (
      <div className="w-full h-full flex flex-col justify-between bg-neutral-100 select-none overflow-hidden relative font-sans">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/90 text-white text-xs px-3.5 py-1.5 rounded-full shadow-xl backdrop-blur-md flex items-center gap-1.5 animate-fade-in pointer-events-none">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="h-12 px-3 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 flex items-center justify-between shrink-0 z-20 shadow-2xs">
          <button
            type="button"
            onClick={() => setShowCharImagePoolPage(false)}
            className="flex items-center text-xs text-neutral-600 hover:text-neutral-900 active:scale-95 transition-all p-1 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 mr-0.5" />
            <span>返回朋友圈</span>
          </button>

          <span className="text-xs font-semibold text-neutral-800 tracking-wide">角色专属图片库</span>

          <span className="text-[10px] text-pink-600 font-medium bg-pink-50 px-2.5 py-0.5 rounded-full border border-pink-200/60">
            共 {momentsSettings.characterImagePool?.length || 0} 张
          </span>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar">
          {/* 1. 功能开关卡片 */}
          <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <span className="font-semibold text-neutral-800 text-xs block">
                角色发图片功能
              </span>
              <span className="text-[10px] text-neutral-400 block mt-0.5">
                {momentsSettings.enableCharacterImagePost ? '已启用：角色发圈时适时随机配图' : '已停用：角色发圈时仅发送字卡纯文本'}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={momentsSettings.enableCharacterImagePost ?? false}
                onChange={e => {
                  const checked = e.target.checked;
                  setMomentsSettings(prev => ({
                    ...prev,
                    enableCharacterImagePost: checked
                  }));
                  showToast(checked ? '已开启角色发图片功能' : '已关闭角色发图片功能');
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500"></div>
            </label>
          </div>

          {/* 2. 功能说明卡片 (小优化：说明里不要明确说明20%的概率) */}
          <div className="bg-gradient-to-r from-pink-50/80 to-purple-50/80 border border-pink-100 rounded-2xl p-3.5 text-xs text-neutral-600 leading-relaxed space-y-1 shadow-2xs">
            <div className="font-semibold text-pink-700 flex items-center gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-pink-500" />
              <span>功能说明</span>
            </div>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              开启角色发图片功能后，在角色发布朋友圈动态时，会适时从专属图片库中随机抽取 1 张图片搭配文字发布。上传图片时系统自动执行高保真画质压缩，兼顾高清呈现与系统稳定流畅。
            </p>
          </div>

          {/* 3. 图片库管理栏 */}
          <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-neutral-800 text-xs block">
                  专属素材库 ({momentsSettings.characterImagePool?.length || 0})
                </span>
                <span className="text-[10px] text-neutral-400 block mt-0.5">
                  点击图片可全屏预览大图
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => charImageInputRef.current?.click()}
                  className="px-3 py-1.5 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 active:scale-95 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5 text-pink-400" />
                  <span>上传图片</span>
                </button>
                <input
                  type="file"
                  ref={charImageInputRef}
                  accept="image/*"
                  multiple
                  onChange={handleUploadCharImages}
                  className="hidden"
                />
              </div>
            </div>

            {(!momentsSettings.characterImagePool || momentsSettings.characterImagePool.length === 0) ? (
              <div
                onClick={() => charImageInputRef.current?.click()}
                className="py-12 px-4 border border-dashed border-neutral-200 rounded-2xl text-center text-xs text-neutral-400 cursor-pointer hover:bg-neutral-50 transition-colors flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-400">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="font-medium text-neutral-600">暂无角色专属图片素材</span>
                <span className="text-[10px] text-neutral-400">点击上传生活随拍、自拍或风景，为角色的朋友圈增添生动画面</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {momentsSettings.characterImagePool.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-2xl overflow-hidden border border-neutral-200/80 bg-neutral-100 group shadow-2xs cursor-pointer hover:border-pink-300 transition-all"
                    onClick={() => setPreviewImage(imgUrl)}
                  >
                    <img src={imgUrl} alt={`素材 ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCharImage(idx);
                      }}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer shadow-xs"
                      title="移除此图片"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 大图预览灯箱 */}
        {previewImage && (
          <div
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setPreviewImage(null)}
          >
            <div className="relative max-w-sm max-h-[85vh] flex flex-col items-center select-none" onClick={e => e.stopPropagation()}>
              <img src={previewImage} alt="Preview" className="max-w-full max-h-[75vh] rounded-2xl object-contain shadow-2xl border border-white/10" />
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="mt-3 px-4 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-full text-xs font-medium transition-colors cursor-pointer"
              >
                关闭预览
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col justify-between bg-neutral-100 select-none overflow-hidden relative font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/90 text-white text-xs px-3.5 py-1.5 rounded-full shadow-xl backdrop-blur-md flex items-center gap-1.5 animate-fade-in pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar */}
      <div className="h-12 px-3 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 flex items-center justify-between shrink-0 z-20">
        {isBatchMode ? (
          <>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-neutral-600 hover:text-neutral-900 font-medium px-1 cursor-pointer"
            >
              {selectedIds.length === filteredMoments.length && filteredMoments.length > 0 ? '取消全选' : '全选'}
            </button>
            <span className="text-xs font-semibold text-neutral-800">
              已选 {selectedIds.length} 条动态
            </span>
            <button
              type="button"
              onClick={() => {
                setIsBatchMode(false);
                setSelectedIds([]);
              }}
              className="text-xs text-neutral-500 hover:text-neutral-900 font-medium px-1 cursor-pointer"
            >
              退出
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onBack}
              className="flex items-center text-xs text-neutral-600 hover:text-neutral-900 active:scale-95 transition-all p-1 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 mr-0.5" />
              <span>返回</span>
            </button>

            <span className="text-xs font-semibold text-neutral-800 tracking-wide">朋友圈</span>

            <div className="flex items-center gap-1.5">
              {/* Batch delete mode toggle */}
              <button
                type="button"
                onClick={() => setIsBatchMode(true)}
                title="批量管理动态"
                className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg active:scale-95 transition-all cursor-pointer"
              >
                <CheckSquare className="w-4 h-4" />
              </button>

              {/* Character image pool shortcut button */}
              <button
                type="button"
                onClick={() => setShowCharImagePoolPage(true)}
                title="角色专属图片库"
                className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg active:scale-95 transition-all cursor-pointer relative"
              >
                <ImageIcon className="w-4 h-4 text-pink-500" />
                {Boolean(momentsSettings.characterImagePool?.length) && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-pink-500 ring-1 ring-white" />
                )}
              </button>

              {/* Proactive posting settings */}
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                title="主动发帖设置"
                className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg active:scale-95 transition-all cursor-pointer"
              >
                <Sliders className="w-4 h-4" />
              </button>

              {/* Publish moment */}
              <button
                type="button"
                onClick={() => setShowPostModal(true)}
                className="text-xs bg-neutral-900 hover:bg-neutral-800 text-white px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-2xs"
                title="发动态"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>发动态</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Main Scrollable Feed */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* 1. 朋友圈上方方形背景、头像与昵称展示区域 (点击均可修改) */}
        <div className="relative w-full bg-neutral-200">
          {/* 方形/宽幅朋友圈背景图 */}
          <div 
            className="w-full h-52 sm:h-56 relative overflow-hidden group cursor-pointer"
            onClick={() => {
              setEditCover(profile.cover);
              setEditAvatar(profile.avatar);
              setEditNickname(profile.nickname);
              setShowProfileModal(true);
            }}
            title="点击更换朋友圈背景图"
          >
            <img 
              src={profile.cover} 
              alt="Moments Cover" 
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
            />
            {/* 渐变遮罩保护昵称可读性 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          </div>

          {/* 朋友圈昵称与头像 (叠加在背景右下角) */}
          <div className="absolute -bottom-5 right-4 flex items-center gap-3 z-10">
            {/* 朋友圈昵称 (可点击修改) */}
            <button
              type="button"
              onClick={() => {
                setEditCover(profile.cover);
                setEditAvatar(profile.avatar);
                setEditNickname(profile.nickname);
                setShowProfileModal(true);
              }}
              className="text-right text-white font-bold text-sm tracking-wide drop-shadow-md hover:underline cursor-pointer pb-2"
              title="点击修改昵称"
            >
              {profile.nickname}
            </button>

            {/* 朋友圈方形/微圆角头像 (可点击修改) */}
            <div 
              className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-neutral-100 shrink-0 cursor-pointer group relative"
              onClick={() => {
                setEditCover(profile.cover);
                setEditAvatar(profile.avatar);
                setEditNickname(profile.nickname);
                setShowProfileModal(true);
              }}
              title="点击修改头像"
            >
              <img 
                src={profile.avatar} 
                alt="Avatar" 
                className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                <Edit3 className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>

        {/* 间隔区域 */}
        <div className="h-8" />

        {/* 2. 朋友圈按年份与月份收纳栏 (Year-Month Archive Bar) */}
        <div className="px-3.5 py-2.5 bg-white border-y border-neutral-200/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 shadow-2xs">
          <div className="flex items-center text-[10px] text-neutral-500 font-medium shrink-0 mr-1">
            <Calendar className="w-3.5 h-3.5 mr-1 text-pink-500" />
            <span>年月归档</span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedYearMonth('all')}
            className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-all cursor-pointer ${
              selectedYearMonth === 'all'
                ? 'bg-neutral-800 text-white font-medium shadow-2xs'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            全部 ({displayMoments.length})
          </button>

          {availableYearMonths.map(({ ym, count }) => (
            <button
              key={ym}
              type="button"
              onClick={() => setSelectedYearMonth(ym)}
              className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-all cursor-pointer ${
                selectedYearMonth === ym
                  ? 'bg-pink-500 text-white font-medium shadow-2xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {ym} ({count})
            </button>
          ))}
        </div>

        {/* Feed List */}
        <div className="p-3.5 space-y-4">
          {filteredMoments.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-neutral-400 space-y-2">
              <Camera className="w-8 h-8 opacity-30" />
              <p className="text-xs font-medium text-neutral-500">
                {selectedYearMonth === 'all' ? '暂无朋友圈动态' : '暂无该归档月份的朋友圈动态'}
              </p>
              {selectedYearMonth === 'all' && (
                <p className="text-[10px] text-neutral-400">点击右上角相机记录第一条生活动态吧</p>
              )}
            </div>
          ) : (
            Object.entries(groupedMoments).map(([monthLabel, monthList]) => (
              <div key={monthLabel} className="space-y-3">
                {/* Year-Month Group Divider */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold text-neutral-500 flex items-center gap-1.5 font-mono">
                    <span>📅</span>
                    <span>{monthLabel}</span>
                    <span className="text-[10px] text-neutral-400 font-normal">
                      (共 {monthList.length} 条)
                    </span>
                  </span>
                  {selectedYearMonth !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedYearMonth('all')}
                      className="text-[10px] text-pink-600 hover:underline cursor-pointer"
                    >
                      查看全部动态
                    </button>
                  )}
                </div>

                {/* Posts in Month */}
                <div className="space-y-3.5">
                  {monthList.map(post => {
                    const isSelected = selectedIds.includes(post.id);
                    const hasLiked = post.likes.includes(profile.nickname);

                    return (
                      <div
                        key={post.id}
                        onClick={() => {
                          if (isBatchMode) {
                            toggleSelectPost(post.id);
                          }
                        }}
                        className={`bg-white p-3.5 rounded-2xl border transition-all relative ${
                          isSelected
                            ? 'border-pink-500 ring-1 ring-pink-500/20 bg-pink-50/20'
                            : 'border-neutral-200/80 shadow-2xs hover:border-neutral-300'
                        } ${isBatchMode ? 'cursor-pointer' : ''}`}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Batch select checkbox */}
                          {isBatchMode && (
                            <div className="pt-0.5 shrink-0 text-pink-500">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 fill-pink-500 text-white" />
                              ) : (
                                <Square className="w-4 h-4 text-neutral-300" />
                              )}
                            </div>
                          )}

                          {/* Post Author Avatar */}
                          <div className="w-9 h-9 rounded-2xl overflow-hidden border border-neutral-200 shrink-0 bg-neutral-100">
                            <img 
                              src={post.author === 'character' ? (character.avatar || post.authorAvatar) : post.authorAvatar} 
                              alt="Avatar" 
                              className="w-full h-full object-cover" 
                            />
                          </div>

                          {/* Post Content & Actions */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-neutral-900 text-xs truncate">
                                {post.author === 'character' ? (character.nickname || character.name || post.authorName) : post.authorName}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  {safeFormatDate(post.timestamp)}
                                </span>
                                {!isBatchMode && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletePostTargetId(post.id);
                                    }}
                                    className="text-[10px] text-neutral-400 hover:text-red-500 cursor-pointer"
                                    title="删除此动态"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <p className="text-xs text-neutral-800 leading-relaxed whitespace-pre-wrap break-words">
                              {post.content}
                            </p>

                            {/* Optional Attached Images */}
                            {post.images && post.images.length > 0 && (
                              <div className="mt-2 grid grid-cols-2 gap-1.5 max-w-xs">
                                {post.images.map((imgUrl, i) => (
                                  <div key={i} className="aspect-square rounded-xl overflow-hidden border border-neutral-100 bg-neutral-50">
                                    <img src={imgUrl} alt="Attached" className="w-full h-full object-cover" />
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Actions bar (Like & Comment) */}
                            {!isBatchMode && (
                              <div className="flex items-center justify-end gap-3 mt-2 text-xs text-neutral-500">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleLike(post);
                                  }}
                                  className={`flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
                                    hasLiked ? 'text-pink-600' : 'hover:text-neutral-900'
                                  }`}
                                >
                                  <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-pink-500 text-pink-500' : ''}`} />
                                  <span>{hasLiked ? '已赞' : '点赞'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveCommentBox({ postId: post.id });
                                    setCommentInputText('');
                                  }}
                                  className="flex items-center gap-1 text-[11px] font-medium hover:text-neutral-900 transition-colors cursor-pointer"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>评论</span>
                                </button>
                              </div>
                            )}

                            {/* Likes & Comments Bubble */}
                            {(post.likes.length > 0 || post.comments.length > 0) && (
                              <div className="bg-neutral-50 rounded-xl p-2.5 mt-2 space-y-1.5 border border-neutral-100 text-xs">
                                {/* Likes list */}
                                {post.likes.length > 0 && (
                                  <div className="flex items-center gap-1.5 text-[11px] text-pink-600 leading-tight">
                                    <Heart className="w-3 h-3 fill-pink-500 text-pink-500 shrink-0" />
                                    <span className="font-medium truncate">
                                      {post.likes.map(liker => {
                                        const isChar = liker === character.name || liker === character.nickname;
                                        return isChar ? (character.nickname || character.name) : liker;
                                      }).join('、')}
                                    </span>
                                  </div>
                                )}

                                {/* Comments list (支持对评论进行回复 & 删除评论) */}
                                {post.comments.length > 0 && (
                                  <div className={`space-y-1.5 ${post.likes.length > 0 ? 'pt-1.5 border-t border-neutral-200/50' : ''}`}>
                                    {post.comments.map(c => {
                                      const isCharComment = c.author === character.nickname || c.author === character.name || (post.author === 'character' && c.author === post.authorName);
                                      const commentAuthorName = isCharComment ? (character.nickname || character.name) : c.author;
                                      const isReplyToChar = c.replyTo === character.nickname || c.replyTo === character.name;
                                      const commentReplyTo = isReplyToChar ? (character.nickname || character.name) : c.replyTo;

                                      return (
                                        <div 
                                          key={c.id} 
                                          className="group/comm text-[11px] text-neutral-700 leading-relaxed flex items-start justify-between gap-1 hover:bg-neutral-100/60 p-1 rounded-lg transition-colors"
                                        >
                                          <div className="flex-1 min-w-0 break-words">
                                            <span className="font-semibold text-neutral-900">{commentAuthorName}</span>
                                            {commentReplyTo && (
                                              <>
                                                <span className="text-neutral-400 mx-1">回复</span>
                                                <span className="font-semibold text-neutral-900">@{commentReplyTo}</span>
                                              </>
                                            )}
                                            <span>: {c.text}</span>
                                          </div>

                                        {/* 评论操作：回复 & 删除 */}
                                        {!isBatchMode && (
                                          <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover/comm:opacity-100 pl-1 text-[10px]">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveCommentBox({
                                                  postId: post.id,
                                                  replyTo: c.author,
                                                  commentId: c.id,
                                                });
                                                setCommentInputText('');
                                              }}
                                              className="text-pink-600 hover:text-pink-700 font-medium cursor-pointer"
                                            >
                                              回复
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteComment(post, c.id);
                                              }}
                                              className="text-neutral-400 hover:text-red-500 cursor-pointer"
                                              title="删除评论"
                                            >
                                              <Trash2 className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                )}
                              </div>
                            )}

                            {/* Active Comment Input on this Post */}
                            {activeCommentBox?.postId === post.id && !isBatchMode && (
                              <div className="mt-2.5 flex items-center gap-1.5 bg-neutral-100 p-1.5 rounded-xl border border-neutral-200 animate-fade-in">
                                {activeCommentBox.replyTo && (
                                  <span className="text-[10px] text-pink-600 font-medium shrink-0 flex items-center gap-0.5">
                                    <CornerDownRight className="w-3 h-3" />
                                    <span>@{activeCommentBox.replyTo}</span>
                                  </span>
                                )}
                                <input
                                  type="text"
                                  autoFocus
                                  value={commentInputText ?? ''}
                                  onChange={e => setCommentInputText(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleSubmitComment();
                                  }}
                                  placeholder={activeCommentBox.replyTo ? `回复 @${activeCommentBox.replyTo}...` : '写下评论...'}
                                  className="flex-1 text-xs bg-white px-2 py-1.5 rounded-lg border border-neutral-200 focus:outline-none focus:border-pink-400"
                                />
                                <button
                                  type="button"
                                  onClick={handleSubmitComment}
                                  disabled={!commentInputText.trim()}
                                  className="px-2.5 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-neutral-800 transition-all cursor-pointer"
                                >
                                  <Send className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveCommentBox(null)}
                                  className="p-1 text-neutral-400 hover:text-neutral-700"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 批量删除底部操作栏 */}
      {isBatchMode && (
        <div className="p-3 bg-white border-t border-neutral-200/80 flex items-center justify-between shrink-0 shadow-lg z-30">
          <span className="text-xs text-neutral-600 font-medium">
            已选择 <strong className="text-pink-600 font-bold">{selectedIds.length}</strong> 条动态
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsBatchMode(false);
                setSelectedIds([]);
              }}
              className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 bg-neutral-100 rounded-xl"
            >
              取消
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => setShowBatchDeleteConfirm(true)}
              className="px-3.5 py-1.5 text-xs text-white bg-red-500 hover:bg-red-600 disabled:opacity-40 rounded-xl font-medium flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>批量删除 ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* 批量删除确认弹窗 */}
      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-xs p-5 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center gap-2.5 text-red-600">
              <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">批量删除朋友圈</h3>
                <p className="text-[11px] text-neutral-500">此操作不可恢复</p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 bg-neutral-50 p-3 rounded-xl leading-relaxed">
              确定要删除选中的 <strong className="text-red-600">{selectedIds.length}</strong> 条动态吗？
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowBatchDeleteConfirm(false)}
                className="flex-1 py-2 rounded-xl text-xs text-neutral-600 bg-neutral-100 hover:bg-neutral-200 font-medium"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDelete}
                className="flex-1 py-2 rounded-xl text-xs text-white bg-red-500 hover:bg-red-600 font-medium shadow-2xs"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 单条删除确认弹窗 */}
      {deletePostTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-xs p-5 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center gap-2.5 text-red-600">
              <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">删除动态</h3>
                <p className="text-[11px] text-neutral-500">删除后不可恢复</p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 bg-neutral-50 p-3 rounded-xl leading-relaxed">
              确定要删除这条朋友圈动态吗？
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletePostTargetId(null)}
                className="flex-1 py-2 rounded-xl text-xs text-neutral-600 bg-neutral-100 hover:bg-neutral-200 font-medium"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelete}
                className="flex-1 py-2 rounded-xl text-xs text-white bg-red-500 hover:bg-red-600 font-medium shadow-2xs"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 朋友圈资料修改弹窗 (背景、头像、昵称修改) */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-neutral-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
                <Edit3 className="w-4 h-4 text-pink-500" />
                <span>修改朋友圈背景与资料</span>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="text-xs text-neutral-400 hover:text-neutral-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. 朋友圈背景修改 */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-neutral-800 block">朋友圈背景</span>
              <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-100">
                <img src={editCover} alt="Preview Cover" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => coverFileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/30 hover:bg-black/50 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>上传自定义背景图片</span>
                </button>
                <input
                  ref={coverFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverUpload}
                />
              </div>

              {/* 推荐背景预设 */}
              <div className="pt-1">
                <span className="text-[10px] text-neutral-400 block mb-1">或选择预设背景：</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESET_COVERS.map(pc => (
                    <button
                      key={pc.name}
                      type="button"
                      onClick={() => setEditCover(pc.url)}
                      className={`h-12 rounded-xl overflow-hidden relative border text-[10px] font-medium text-white transition-all cursor-pointer ${
                        editCover === pc.url ? 'border-pink-500 ring-2 ring-pink-500/30' : 'border-neutral-200'
                      }`}
                    >
                      <img src={pc.url} alt={pc.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center p-0.5">
                        <span className="truncate">{pc.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. 朋友圈头像修改 */}
            <div className="space-y-2 pt-2 border-t border-neutral-100">
              <span className="text-xs font-semibold text-neutral-800 block">朋友圈头像</span>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-neutral-200 bg-neutral-100 shrink-0">
                  <img src={editAvatar} alt="Avatar Preview" className="w-full h-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-xs font-medium text-neutral-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>上传新头像</span>
                </button>
                <input
                  ref={avatarFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>

              {/* 预设头像快速选择 (仅保留5个精选女性头像) */}
              <div className="pt-1">
                <span className="text-[10px] text-neutral-400 block mb-1">预设头像推荐（5款女性风格）：</span>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                  {FEMALE_PRESET_AVATARS.map((av, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setEditAvatar(av)}
                      className={`w-9 h-9 rounded-xl overflow-hidden border shrink-0 transition-all cursor-pointer ${
                        editAvatar === av ? 'border-pink-500 ring-2 ring-pink-500/40' : 'border-neutral-200'
                      }`}
                    >
                      <img src={av} alt={`Female Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. 朋友圈昵称修改 */}
            <div className="space-y-2 pt-2 border-t border-neutral-100">
              <label className="text-xs font-semibold text-neutral-800 block">朋友圈昵称</label>
              <input
                type="text"
                value={editNickname ?? ''}
                onChange={e => setEditNickname(e.target.value)}
                maxLength={20}
                placeholder="设置你的朋友圈昵称..."
                className="w-full text-xs p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-none focus:bg-white focus:border-pink-500"
              />
            </div>

            {/* 保存按钮 */}
            <button
              type="button"
              onClick={handleSaveProfile}
              className="w-full py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 active:scale-98 transition-all shadow-2xs mt-2"
            >
              保存修改
            </button>
          </div>
        </div>
      )}

      {/* 发表动态弹窗 */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-4 shadow-2xl border border-neutral-200 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <span className="text-xs font-semibold text-neutral-800">发表新动态</span>
              <button
                type="button"
                onClick={() => {
                  setShowPostModal(false);
                  setPostImage(null);
                }}
                className="text-xs text-neutral-400 hover:text-neutral-700"
              >
                取消
              </button>
            </div>

            <textarea
              value={postContent ?? ''}
              onChange={e => setPostContent(e.target.value)}
              placeholder="这一刻的想法..."
              rows={4}
              className="w-full text-xs p-3 bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-none focus:bg-white resize-none"
            />

            {/* 配图区域 */}
            {postImage ? (
              <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-neutral-200">
                <img src={postImage} alt="Post Attached" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPostImage(null)}
                  className="absolute top-1 right-1 bg-black/60 text-white p-0.5 rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => postImageInputRef.current?.click()}
                  className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-xs text-neutral-600 flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-neutral-500" />
                  <span>添加图片</span>
                </button>
                <input
                  ref={postImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePostImageUpload}
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleCreatePost}
              disabled={!postContent.trim() && !postImage}
              className="w-full py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium disabled:opacity-50 hover:bg-neutral-800 transition-all cursor-pointer"
            >
              发表
            </button>
          </div>
        </div>
      )}

      {/* 朋友圈主动发帖设置弹窗 */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-neutral-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
                <Sliders className="w-4 h-4 text-pink-500" />
                <span>朋友圈主动发帖设置</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-xs text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. 每日主动发帖概率 */}
            <div className="bg-neutral-50 p-3 rounded-2xl space-y-2 border border-neutral-200/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-800">1. 每日主动发帖概率</span>
                <span className="font-bold text-pink-600 font-mono text-sm">
                  {momentsSettings.dailyProactiveRate}%
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={momentsSettings.dailyProactiveRate ?? 50}
                onChange={e => setMomentsSettings(prev => ({
                  ...prev,
                  dailyProactiveRate: Number(e.target.value)
                }))}
                className="w-full accent-pink-500 cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                <span>0% (不发)</span>
                <span>50%</span>
                <span>100% (必发)</span>
              </div>

              {/* 每条设置下面用一行小字简要描述一下该设置的作用 */}
              <p className="text-[10px] text-neutral-500 leading-relaxed border-t border-neutral-200/40 pt-1.5">
                用于决定角色当天是否会主动发朋友圈（每天开始时进行一次独立判定，仅决定今天发不发，不影响发帖条数）。
              </p>
            </div>

            {/* 2. 每日发帖频率上限 */}
            <div className="bg-neutral-50 p-3 rounded-2xl space-y-2 border border-neutral-200/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-800">2. 每日发帖频率上限</span>
                <span className="text-[10px] text-pink-600 font-medium">最多 {momentsSettings.maxDailyPosts} 条</span>
              </div>

              {/* 可选：1 条、3 条、5 条 */}
              <div className="grid grid-cols-3 gap-2">
                {([1, 3, 5] as const).map(count => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setMomentsSettings(prev => ({
                      ...prev,
                      maxDailyPosts: count
                    }))}
                    className={`py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      momentsSettings.maxDailyPosts === count
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    {count} 条
                  </button>
                ))}
              </div>

              {/* 每条设置下面用一行小字简要描述一下该设置的作用 */}
              <p className="text-[10px] text-neutral-500 leading-relaxed border-t border-neutral-200/40 pt-1.5">
                用于决定角色在当天会发帖时最多发布的条数（实际发帖数量在 1 到该上限之间随机决定）。
              </p>
            </div>

            {/* 3. 发帖间隔 */}
            <div className="bg-neutral-50 p-3 rounded-2xl space-y-2 border border-neutral-200/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-800">3. 发帖间隔</span>
                <span className="text-[10px] text-neutral-400">同天多条动态间隔</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-neutral-500 block mb-1">最少间隔 (分钟)</label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={momentsSettings.minIntervalMinutes ?? 60}
                    onChange={e => setMomentsSettings(prev => ({
                      ...prev,
                      minIntervalMinutes: Math.max(1, Number(e.target.value))
                    }))}
                    className="w-full p-2 bg-white rounded-xl border border-neutral-200 font-mono text-center text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-500 block mb-1">最多间隔 (分钟)</label>
                  <input
                    type="number"
                    min={momentsSettings.minIntervalMinutes}
                    max="1440"
                    value={momentsSettings.maxIntervalMinutes ?? 180}
                    onChange={e => setMomentsSettings(prev => ({
                      ...prev,
                      maxIntervalMinutes: Math.max(prev.minIntervalMinutes, Number(e.target.value))
                    }))}
                    className="w-full p-2 bg-white rounded-xl border border-neutral-200 font-mono text-center text-xs"
                  />
                </div>
              </div>

              {/* 快捷间隔预设 */}
              <div className="flex gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setMomentsSettings(prev => ({ ...prev, minIntervalMinutes: 60, maxIntervalMinutes: 180 }))}
                  className="flex-1 py-1 text-[10px] bg-white border border-neutral-200 rounded-lg text-neutral-600 hover:border-pink-300 cursor-pointer"
                >
                  默认 (60~180分)
                </button>
                <button
                  type="button"
                  onClick={() => setMomentsSettings(prev => ({ ...prev, minIntervalMinutes: 1, maxIntervalMinutes: 3 }))}
                  className="flex-1 py-1 text-[10px] bg-white border border-neutral-200 rounded-lg text-neutral-600 hover:border-pink-300 cursor-pointer"
                >
                  极速测试 (1~3分)
                </button>
                <button
                  type="button"
                  onClick={() => setMomentsSettings(prev => ({ ...prev, minIntervalMinutes: 120, maxIntervalMinutes: 360 }))}
                  className="flex-1 py-1 text-[10px] bg-white border border-neutral-200 rounded-lg text-neutral-600 hover:border-pink-300 cursor-pointer"
                >
                  慢发 (2~6小时)
                </button>
              </div>

              {/* 每条设置下面用一行小字简要描述一下该设置的作用 */}
              <p className="text-[10px] text-neutral-500 leading-relaxed border-t border-neutral-200/40 pt-1.5">
                用于控制同一天内多条朋友圈之间的时间间隔（每发布一条后，下一条在此区间内随机生成）。
              </p>
            </div>

            {/* 4. 角色发动态字卡数量设置 (最少 ~ 最多，上限10，下限1) */}
            <div className="bg-neutral-50 p-3 rounded-2xl space-y-2 border border-neutral-200/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-800">4. 动态字卡抽取数量</span>
                <span className="text-[10px] text-pink-600 font-medium font-mono">
                  {momentsSettings.minCardsPerPost || 1} ~ {momentsSettings.maxCardsPerPost || 3} 张
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-neutral-500 block mb-1">最少字卡数 (下限 1)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={momentsSettings.minCardsPerPost || 1}
                    onChange={e => {
                      const val = Math.max(1, Math.min(10, Number(e.target.value) || 1));
                      setMomentsSettings(prev => ({
                        ...prev,
                        minCardsPerPost: val,
                        maxCardsPerPost: Math.max(val, prev.maxCardsPerPost || 3),
                      }));
                    }}
                    className="w-full p-2 bg-white rounded-xl border border-neutral-200 font-mono text-center text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-500 block mb-1">最多字卡数 (上限 10)</label>
                  <input
                    type="number"
                    min={momentsSettings.minCardsPerPost || 1}
                    max="10"
                    value={momentsSettings.maxCardsPerPost || 3}
                    onChange={e => {
                      const minVal = momentsSettings.minCardsPerPost || 1;
                      const val = Math.max(minVal, Math.min(10, Number(e.target.value) || minVal));
                      setMomentsSettings(prev => ({
                        ...prev,
                        maxCardsPerPost: val,
                      }));
                    }}
                    className="w-full p-2 bg-white rounded-xl border border-neutral-200 font-mono text-center text-xs"
                  />
                </div>
              </div>

              {/* 快捷字卡预设 */}
              <div className="flex gap-1.5 pt-0.5">
                {[
                  { label: '精练 (1~2张)', min: 1, max: 2 },
                  { label: '默认 (1~3张)', min: 1, max: 3 },
                  { label: '丰富 (3~6张)', min: 3, max: 6 },
                  { label: '饱满 (5~10张)', min: 5, max: 10 },
                ].map(item => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setMomentsSettings(prev => ({ ...prev, minCardsPerPost: item.min, maxCardsPerPost: item.max }))}
                    className="flex-1 py-1 text-[10px] bg-white border border-neutral-200 rounded-lg text-neutral-600 hover:border-pink-300 cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* 每条设置下面用一行小字简要描述一下该设置的作用 */}
              <p className="text-[10px] text-neutral-500 leading-relaxed border-t border-neutral-200/40 pt-1.5">
                用于自主设置角色每条朋友圈抽取的字卡数量（1~10张）。多张字卡将使用逗号拼接。
              </p>
            </div>

            {/* 5. 角色发图片功能与图片库入口 */}
            <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-800 text-xs flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-pink-500" />
                  <span>角色发图片功能</span>
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={momentsSettings.enableCharacterImagePost ?? false}
                    onChange={e => {
                      const checked = e.target.checked;
                      setMomentsSettings(prev => ({
                        ...prev,
                        enableCharacterImagePost: checked
                      }));
                      showToast(checked ? '已开启角色发图片功能' : '已关闭角色发图片功能');
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500"></div>
                </label>
              </div>

              {/* 独立图片库入口（小优化：单独做一页） */}
              <button
                type="button"
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowCharImagePoolPage(true);
                }}
                className="w-full py-2.5 px-3 bg-white border border-neutral-200/90 rounded-xl text-xs font-medium text-neutral-800 hover:bg-neutral-50 active:scale-95 transition-all flex items-center justify-between cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-pink-500" />
                  <span>管理角色专属图片库</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-pink-600 font-medium">
                  <span>已存 {momentsSettings.characterImagePool?.length || 0} 张</span>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                </div>
              </button>

              {/* 功能说明（小优化：说明里不要明确说明20%的概率） */}
              <p className="text-[10px] text-neutral-500 leading-relaxed bg-white/70 p-2 rounded-xl border border-neutral-200/50">
                开启角色发图片功能后，在角色发布朋友圈动态时，会适时从专属图片库中随机抽取 1 张图片搭配文字发布。上传图片时自动压缩，保障系统稳定与流畅。
              </p>
            </div>

            {/* 6. 互动规则与调度器执行 */}
            <div className="bg-pink-50/50 p-3 rounded-2xl border border-pink-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-pink-500" />
                  <span>朋友圈互动机制 (Scheduler)</span>
                </span>
                <span className="text-[10px] text-pink-600 font-medium">统一调度</span>
              </div>
              
              <div className="space-y-1.5 text-[10px] text-neutral-600 bg-white/80 p-2.5 rounded-xl border border-pink-100/60 leading-relaxed">
                <div>
                  <strong className="text-neutral-800">我发朋友圈：</strong>
                  对方 100% 概率在 1 分钟后点赞；80% 概率在 1～3 分钟内评论（随机抽取 1-3 张字卡并用逗号拼接）。
                </div>
                <div>
                  <strong className="text-neutral-800">我发表评论：</strong>
                  对方 80% 概率在 1～3 分钟内回复我（随机抽取 1-3 张字卡并用逗号拼接）。
                </div>
              </div>

              <p className="text-[10px] text-neutral-500 leading-relaxed">
                今日发帖状态：{momentsSettings.todayPlannedCount && momentsSettings.todayPlannedCount > 0 
                  ? `今日已规划发帖 ${momentsSettings.todayPlannedCount} 条（已发 ${momentsSettings.todayPostedCount || 0} 条）` 
                  : '今日未通过概率判定（今天不主动发帖）'}
              </p>

              <div className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleTestProactiveMoment}
                  className="flex-1 py-1.5 bg-white border border-pink-200 text-pink-600 hover:bg-pink-50 rounded-xl text-[11px] font-medium transition-all active:scale-98 shadow-2xs cursor-pointer"
                >
                  测试主动发动态 (1秒后)
                </button>
                <button
                  type="button"
                  onClick={handleTestInteraction}
                  className="flex-1 py-1.5 bg-white border border-pink-200 text-pink-600 hover:bg-pink-50 rounded-xl text-[11px] font-medium transition-all active:scale-98 shadow-2xs cursor-pointer"
                >
                  测试点赞与评论 (1秒后)
                </button>
              </div>
            </div>

            {/* 保存设置按钮 */}
            <button
              type="button"
              onClick={handleSaveSettings}
              className="w-full py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 active:scale-98 transition-all shadow-2xs cursor-pointer"
            >
              保存设置
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
