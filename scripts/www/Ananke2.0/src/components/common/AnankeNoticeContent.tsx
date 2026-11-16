import React from 'react';
import { ShieldCheck, HeartHandshake, AlertTriangle, Sparkles, BookOpen } from 'lucide-react';

interface AnankeNoticeContentProps {
  className?: string;
}

export const AnankeNoticeContent: React.FC<AnankeNoticeContentProps> = ({ className = '' }) => {
  return (
    <div className={`space-y-3.5 text-xs text-neutral-700 leading-relaxed ${className}`}>
      {/* 头部导语 */}
      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/70 space-y-1.5">
        <h4 className="font-bold text-sm text-neutral-900 flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-neutral-800" />
          <span>Ananke字卡｜初次使用说明（必读）</span>
        </h4>
        <p className="text-neutral-600">欢迎使用 Ananke字卡。</p>
        <p className="font-bold text-neutral-900">
          制作者@Nyx（小红书号：42894201185）
        </p>
        <p className="font-bold text-neutral-900">
          网站完全免费，不涉及任何盈利！也禁止任何盈利行为！
        </p>
        <p className="text-neutral-500 text-[11px]">
          灵感来源/概率设置参考：milk字卡，感谢milk老师！
        </p>
        <p className="font-bold text-rose-600 bg-rose-50/80 px-2.5 py-1 rounded-lg border border-rose-200/60 inline-block text-[11px]">
          ⚠️ 为保证您的数据安全，请定期及时备份。
        </p>
      </div>

      {/* 1. 关于制作和修bug */}
      <div className="p-3 bg-white rounded-xl border border-neutral-200/80 shadow-2xs space-y-1.5">
        <h5 className="font-semibold text-neutral-900 text-xs flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-mono">1</span>
          <span>关于制作和修bug</span>
        </h5>
        <p className="text-neutral-600">
          ①本网站代码完全由Gemini  AI 生成，作者本人完全不懂代码。
        </p>
        <p className="text-neutral-700 leading-relaxed">
          ②<span className="underline underline-offset-4 decoration-neutral-800 decoration-1 text-neutral-800 font-normal">如果使用过程中出现任何致命 bug，请停止使用。如果因为不同手机和浏览器产生 bug，本人无法替大家修复。</span>
        </p>
        <p className="font-bold text-neutral-900 text-[11px] bg-neutral-50 p-2 rounded-lg border border-neutral-200/60">
          代码已完全在 GitHub 仓库公开，有能力者可以自行修复。支持二改，二改必须标注原作者。
        </p>
      </div>

      {/* 2. 关于字卡网站连上飘 */}
      <div className="p-3 bg-white rounded-xl border border-neutral-200/80 shadow-2xs space-y-1.5">
        <h5 className="font-semibold text-neutral-900 text-xs flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-mono">2</span>
          <span>关于字卡网站连上飘</span>
        </h5>
        <p className="font-bold text-neutral-900">
          讲科学，破迷信。
        </p>
        <p className="text-neutral-600 leading-relaxed">
          字卡网站本质完全由代码运行，不存在任何灵异行为。<span className="underline underline-offset-4 decoration-neutral-800 decoration-1 text-neutral-800 font-normal">如果您本人相信这种说法，请不要使用本网站。</span>
        </p>
      </div>

      {/* 3. 关于网站分享 */}
      <div className="p-3 bg-white rounded-xl border border-neutral-200/80 shadow-2xs space-y-1">
        <h5 className="font-semibold text-neutral-900 text-xs flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-mono">3</span>
          <span>关于网站分享</span>
        </h5>
        <div className="space-y-0.5">
          <p className="text-neutral-900 font-bold">①尽量自己使用，少传播分享。</p>
          <p className="text-neutral-600 pl-3.5 text-[11px]">有能力的朋友可自行部署（源代码已公开，可去Github仓库自行复制）</p>
        </div>
        <p className="text-neutral-600">②禁止将字卡网站分享给圈外人。</p>
        <p className="text-neutral-600">③作者本人在能力范围内搓的网站，即使不好用，也请尊重作者劳动成果。</p>
      </div>

      {/* 4. 全屏体验与免责声明 */}
      <div className="p-3 bg-white rounded-xl border border-neutral-200/80 shadow-2xs space-y-1.5">
        <h5 className="font-semibold text-neutral-900 text-xs flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-mono">4</span>
          <span>全屏体验与免责声明</span>
        </h5>
        <p className="text-neutral-600">
          为了获得真实沉浸的虚拟小手机互动体验，本站默认开启强制全屏并尝试隐藏浏览器导航栏。
        </p>
        <p className="font-semibold text-amber-800 bg-amber-50/80 p-2 rounded-lg border border-amber-200/60 leading-relaxed text-[11px]">
          ⚠️ 免责声明：受限于不同浏览器（如部分 iOS Safari、微信内置环境或特定手机系统安全策略），可能有的浏览器没有办法全屏。进入应用后可在【设置】随时开启或关闭强制全屏开关。
        </p>
      </div>

      {/* 5. 其他免责声明 */}
      <div className="p-3 bg-white rounded-xl border border-neutral-200/80 shadow-2xs space-y-1.5">
        <h5 className="font-semibold text-neutral-900 text-xs flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-mono">5</span>
          <span>其他免责声明</span>
        </h5>
        <p className="text-neutral-600">
          本站内容均由代码概率随机生成，不构成任何心理辅导、心理疗愈或医疗建议，不能替代专业心理咨询与治疗。
        </p>
        <p className="text-neutral-800 leading-relaxed">
          <span className="underline underline-offset-4 decoration-neutral-800 decoration-1 font-normal">如有心理困扰，请及时咨询心理医生或正规医疗机构，切勿将本站作为情绪寄托或替代性支持。</span>
        </p>
        <p className="text-neutral-600">
          本站面向具备理性判断力与心理成熟度的使用者，请勿过度解读或依赖。
        </p>
        <p className="text-neutral-600 pt-1">
          <strong className="font-bold text-neutral-900 block">
            使用本站即视为已理解并接受以上说明与免责声明。
          </strong>
        </p>
      </div>
    </div>
  );
};
