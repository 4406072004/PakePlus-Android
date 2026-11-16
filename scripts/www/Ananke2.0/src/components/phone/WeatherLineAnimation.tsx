import React from 'react';

interface WeatherLineAnimationProps {
  weatherId: string;
  size?: number;
  className?: string;
  color?: string;
}

export const WeatherLineAnimation: React.FC<WeatherLineAnimationProps> = ({
  weatherId,
  size = 36,
  className = '',
  color,
}) => {
  return (
    <div
      className={`inline-flex items-center justify-center relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <style>{`
        @keyframes weather-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes weather-spin-fast {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes weather-drift {
          0%, 100% { transform: translateX(-2.5px); }
          50% { transform: translateX(2.5px); }
        }
        @keyframes weather-drift-rev {
          0%, 100% { transform: translateX(2px); }
          50% { transform: translateX(-2px); }
        }
        @keyframes weather-pulse-soft {
          0%, 100% { transform: scale(0.96); opacity: 0.85; }
          50% { transform: scale(1.04); opacity: 1; }
        }
        @keyframes weather-rain {
          0% { transform: translateY(-4px) translateX(1px); opacity: 0; }
          30% { opacity: 1; }
          90% { opacity: 0.9; }
          100% { transform: translateY(7px) translateX(-2px); opacity: 0; }
        }
        @keyframes weather-rain-fast {
          0% { transform: translateY(-5px) translateX(2px); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translateY(9px) translateX(-3px); opacity: 0; }
        }
        @keyframes weather-lightning {
          0%, 20%, 38%, 100% { opacity: 0.2; stroke-width: 1.5; }
          22%, 30% { opacity: 1; stroke-width: 2.2; filter: drop-shadow(0 0 3px #facc15); }
          26% { opacity: 0.4; stroke-width: 1.8; }
        }
        @keyframes weather-haze {
          0%, 100% { transform: translateX(-3.5px); opacity: 0.45; }
          50% { transform: translateX(3.5px); opacity: 0.85; }
        }
        @keyframes weather-fog {
          0%, 100% { transform: translateY(-1.5px); }
          50% { transform: translateY(1.5px); }
        }
        @keyframes weather-snow {
          0% { transform: translateY(-4px) rotate(0deg); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translateY(8px) rotate(180deg); opacity: 0; }
        }
        @keyframes weather-meteor {
          0%, 40% { transform: translate(-8px, -8px); opacity: 0; }
          45% { opacity: 1; }
          75% { transform: translate(14px, 14px); opacity: 0; }
          100% { transform: translate(14px, 14px); opacity: 0; }
        }
        @keyframes weather-twinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes weather-hail {
          0% { transform: translateY(-4px); opacity: 0; }
          40% { transform: translateY(5px); opacity: 1; }
          60% { transform: translateY(3px); }
          80% { transform: translateY(6px); opacity: 0.8; }
          100% { transform: translateY(7px); opacity: 0; }
        }
      `}</style>

      {/* 1. 晴空万里 (Sunny) */}
      {weatherId === 'sunny' && (
        <svg
          viewBox="0 0 36 36"
          width={size}
          height={size}
          fill="none"
          stroke={color || '#f59e0b'}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* 旋转射线 */}
          <g style={{ transformOrigin: '18px 18px', animation: 'weather-spin 14s linear infinite' }}>
            <line x1="18" y1="4" x2="18" y2="7.5" />
            <line x1="18" y1="28.5" x2="18" y2="32" />
            <line x1="4" y1="18" x2="7.5" y2="18" />
            <line x1="28.5" y1="18" x2="32" y2="18" />
            <line x1="8" y1="8" x2="10.5" y2="10.5" />
            <line x1="25.5" y1="25.5" x2="28" y2="28" />
            <line x1="8" y1="28" x2="10.5" y2="25.5" />
            <line x1="25.5" y1="10.5" x2="28" y2="8" />
          </g>
          {/* 中心太阳圆环 */}
          <circle
            cx="18"
            cy="18"
            r="6"
            style={{ transformOrigin: '18px 18px', animation: 'weather-pulse-soft 3s ease-in-out infinite' }}
          />
        </svg>
      )}

      {/* 2. 微风多云 (Partly Cloudy) */}
      {weatherId === 'partly_cloudy' && (
        <svg
          viewBox="0 0 36 36"
          width={size}
          height={size}
          fill="none"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* 背景小太阳 */}
          <g stroke={color || '#f59e0b'} style={{ transformOrigin: '23px 12px', animation: 'weather-spin 18s linear infinite' }}>
            <circle cx="23" cy="12" r="4" />
            <line x1="23" y1="5" x2="23" y2="6.8" />
            <line x1="23" y1="17.2" x2="23" y2="19" />
            <line x1="16" y1="12" x2="17.8" y2="12" />
            <line x1="28.2" y1="12" x2="30" y2="12" />
            <line x1="18" y1="7" x2="19.3" y2="8.3" />
            <line x1="26.7" y1="15.7" x2="28" y2="17" />
          </g>
          {/* 前景轻柔云朵 */}
          <path
            d="M9 25 h16 a5 5 0 0 0 1 -9.9 a6.5 6.5 0 0 0 -12.4 -2 a5 5 0 0 0 -4.6 11.9 z"
            stroke="#94a3b8"
            style={{ animation: 'weather-drift 4.5s ease-in-out infinite' }}
          />
        </svg>
      )}

      {/* 3. 阴天沉闷 (Overcast) */}
      {weatherId === 'overcast' && (
        <svg
          viewBox="0 0 36 36"
          width={size}
          height={size}
          fill="none"
          stroke={color || '#64748b'}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* 后景云朵 */}
          <path
            d="M13 18 h14 a4.5 4.5 0 0 0 0 -9 a6 6 0 0 0 -11.5 -1.5 a4.5 4.5 0 0 0 -2.5 10.5 z"
            stroke="#cbd5e1"
            style={{ animation: 'weather-drift-rev 6s ease-in-out infinite' }}
          />
          {/* 前景云朵 */}
          <path
            d="M8 26 h17 a5 5 0 0 0 1 -9.9 a6.5 6.5 0 0 0 -12.5 -2 a5 5 0 0 0 -5.5 11.9 z"
            stroke="#64748b"
            style={{ animation: 'weather-drift 5s ease-in-out infinite' }}
          />
        </svg>
      )}

      {/* 4. 绵绵细雨 (Drizzle) */}
      {weatherId === 'drizzle' && (
        <svg
          viewBox="0 0 36 36"
          width={size}
          height={size}
          fill="none"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* 云朵 */}
          <path
            d="M8 20 h18 a4.5 4.5 0 0 0 0 -9 a6 6 0 0 0 -11.5 -2 a4.5 4.5 0 0 0 -6.5 11 z"
            stroke="#94a3b8"
            style={{ animation: 'weather-drift 5s ease-in-out infinite' }}
          />
          {/* 细雨丝 */}
          <line
            x1="12"
            y1="23"
            x2="10"
            y2="28"
            stroke={color || '#38bdf8'}
            strokeDasharray="2 2"
            style={{ animation: 'weather-rain 1.8s ease-in-out infinite' }}
          />
          <line
            x1="18"
            y1="23"
            x2="16"
            y2="28"
            stroke={color || '#38bdf8'}
            strokeDasharray="2 2"
            style={{ animation: 'weather-rain 1.8s ease-in-out infinite 0.5s' }}
          />
          <line
            x1="24"
            y1="23"
            x2="22"
            y2="28"
            stroke={color || '#38bdf8'}
            strokeDasharray="2 2"
            style={{ animation: 'weather-rain 1.8s ease-in-out infinite 1s' }}
          />
        </svg>
      )}

      {/* 5. 倾盆大雨 (Heavy Rain) */}
      {weatherId === 'heavy_rain' && (
        <svg
          viewBox="0 0 36 36"
          width={size}
          height={size}
          fill="none"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M8 18 h19 a4.5 4.5 0 0 0 0 -9 a6 6 0 0 0 -11.5 -2 a4.5 4.5 0 0 0 -7.5 11 z"
            stroke="#64748b"
          />
          {/* 密集下冲雨线 */}
          <line
            x1="11"
            y1="20"
            x2="8"
            y2="30"
            stroke={color || '#0284c7'}
            strokeWidth="1.8"
            style={{ animation: 'weather-rain-fast 0.9s linear infinite' }}
          />
          <line
            x1="17"
            y1="20"
            x2="14"
            y2="30"
            stroke={color || '#0284c7'}
            strokeWidth="1.8"
            style={{ animation: 'weather-rain-fast 0.9s linear infinite 0.25s' }}
          />
          <line
            x1="23"
            y1="20"
            x2="20"
            y2="30"
            stroke={color || '#0284c7'}
            strokeWidth="1.8"
            style={{ animation: 'weather-rain-fast 0.9s linear infinite 0.5s' }}
          />
          {/* 水花线条 */}
          <path d="M12 32 c2 -1 4 -1 6 0" stroke={color || '#0284c7'} opacity="0.6" />
        </svg>
      )}

      {/* 6. 闪电雷暴 (Thunderstorm) */}
      {weatherId === 'thunderstorm' && (
        <svg
          viewBox="0 0 36 36"
          width={size}
          height={size}
          fill="none"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M8 17 h18 a4.5 4.5 0 0 0 0 -9 a6 6 0 0 0 -11.5 -2 a4.5 4.5 0 0 0 -6.5 11 z"
            stroke="#475569"
          />
          {/* 折线闪电 */}
          <polyline
            points="18,17 14,24 19,24 16,33"
            stroke={color || '#eab308'}
            strokeWidth="2"
            style={{ animation: 'weather-lightning 2.2s ease-in-out infinite' }}
          />
          {/* 雨线 */}
          <line
            x1="10"
            y1="22"
            x2="8"
            y2="28"
            stroke="#38bdf8"
            style={{ animation: 'weather-rain-fast 1s linear infinite' }}
          />
          <line
            x1="24"
            y1="22"
            x2="22"
            y2="28"
            stroke="#38bdf8"
            style={{ animation: 'weather-rain-fast 1s linear infinite 0.4s' }}
          />
        </svg>
      )}

      {/* 7. 狂风台风 (Typhoon) */}
      {weatherId === 'typhoon' && (
        <svg
          viewBox="0 0 36 36"
          width={size}
          height={size}
          fill="none"
          stroke={color || '#0d9488'}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* 旋转螺旋中心 */}
          <g style={{ transformOrigin: '18px 18px', animation: 'weather-spin-fast 4s linear infinite' }}>
            <circle cx="18" cy="18" r="3" strokeWidth="1.5" />
            <path d="M18 12 C24 12 26 18 26 18 C26 23 21 26 18 26" strokeDasharray="3 2" />
            <path d="M18 24 C12 24 10 18 10 18 C10 13 15 10 18 10" strokeDasharray="3 2" />
            <path d="M7 14 C12 6 24 6 29 14" strokeWidth="1.8" />
            <path d="M29 22 C24 30 12 30 7 22" strokeWidth="1.8" />
          </g>
        </svg>
      )}

      {/* 8. 灰蒙雾霾 (Haze) */}
      {weatherId === 'haze' && (
        <svg
          viewBox="0 0 36 36"
          width={size}
          height={size}
          fill="none"
          stroke={color || '#78716c'}
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <line
            x1="7"
            y1="12"
            x2="29"
            y2="12"
            strokeDasharray="4 3"
            style={{ animation: 'weather-haze 3.5s ease-in-out infinite' }}
          />
          <line
            x1="5"
            y1="18"
            x2="31"
            y2="18"
            strokeDasharray="5 3"
            style={{ animation: 'weather-haze 4.2s ease-in-out infinite 0.5s' }}
          />
          <line
            x1="9"
            y1="24"
            x2="27"
            y2="24"
            strokeDasharray="3 3"
            style={{ animation: 'weather-haze 3.8s ease-in-out infinite 1s' }}
          />
        </svg>
      )}

      {/* 9. 迷蒙晨雾 (Fog) */}
      {weatherId === 'fog' && (
        <svg
          viewBox="0 0 36 36"
          width={size}
          height={size}
          fill="none"
          stroke={color || '#94a3b8'}
          strokeWidth="1.7"
          strokeLinecap="round"
        >
          {/* 平滑起伏波浪线 */}
          <path
            d="M6 13 Q12 10 18 13 T30 13"
            style={{ animation: 'weather-fog 4s ease-in-out infinite' }}
          />
          <path
            d="M5 19 Q12 16 19 19 T31 19"
            style={{ animation: 'weather-fog 4s ease-in-out infinite 0.7s' }}
          />
          <path
            d="M8 25 Q14 22 20 25 T29 25"
            style={{ animation: 'weather-fog 4s ease-in-out infinite 1.4s' }}
          />
        </svg>
      )}

      {/* 10. 浪漫初雪 (Snow Light) */}
      {weatherId === 'snow_light' && (
        <svg
          viewBox="0 0 36 36"
          width={size}
          height={size}
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M8 18 h18 a4.5 4.5 0 0 0 0 -9 a6 6 0 0 0 -11.5 -2 a4.5 4.5 0 0 0 -6.5 11 z"
            stroke="#94a3b8"
          />
          {/* 六瓣极简雪花 1 */}
          <g
            stroke={color || '#06b6d4'}
            style={{ transformOrigin: '14px 26px', animation: 'weather-snow 3.2s ease-in-out infinite' }}
          >
            <line x1="14" y1="23" x2="14" y2="29" />
            <line x1="11" y1="26" x2="17" y2="26" />
            <line x1="12" y1="24" x2="16" y2="28" />
            <line x1="12" y1="28" x2="16" y2="24" />
          </g>
          {/* 六瓣极简雪花 2 */}
          <g
            stroke={color || '#06b6d4'}
            style={{ transformOrigin: '23px 25px', animation: 'weather-snow 3.2s ease-in-out infinite 1.6s' }}
          >
            <line x1="23" y1="22" x2="23" y2="28" />
            <line x1="20" y1="25" x2="26" y2="25" />
          </g>
        </svg>
      )}

      {/* 11. 漫天暴雪 (Snow Heavy) */}
      {weatherId === 'snow_heavy' && (
        <svg
          viewBox="0 0 36 36"
          width={size}
          height={size}
          fill="none"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M7 16 h20 a4.5 4.5 0 0 0 0 -9 a6 6 0 0 0 -11.5 -2 a4.5 4.5 0 0 0 -8.5 11 z"
            stroke="#64748b"
          />
          {/* 密集的旋转飘雪 */}
          <g
            stroke={color || '#38bdf8'}
            style={{ transformOrigin: '11px 24px', animation: 'weather-snow 1.8s linear infinite' }}
          >
            <line x1="11" y1="21" x2="11" y2="27" />
            <line x1="8" y1="24" x2="14" y2="24" />
          </g>
          <g
            stroke={color || '#38bdf8'}
            style={{ transformOrigin: '18px 26px', animation: 'weather-snow 1.8s linear infinite 0.6s' }}
          >
            <line x1="18" y1="23" x2="18" y2="29" />
            <line x1="15" y1="26" x2="21" y2="26" />
          </g>
          <g
            stroke={color || '#38bdf8'}
            style={{ transformOrigin: '25px 23px', animation: 'weather-snow 1.8s linear infinite 1.2s' }}
          >
            <line x1="25" y1="20" x2="25" y2="26" />
            <line x1="22" y1="23" x2="28" y2="23" />
          </g>
        </svg>
      )}

      {/* 12. 彩虹初霁 (Rainbow) */}
      {weatherId === 'rainbow' && (
        <svg
          viewBox="0 0 36 36"
          width={size}
          height={size}
          fill="none"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          {/* 3层同心圆弧彩虹 */}
          <path d="M8 26 A12 12 0 0 1 28 26" stroke="#f43f5e" />
          <path d="M11 26 A9 9 0 0 1 25 26" stroke="#fbbf24" />
          <path d="M14 26 A6 6 0 0 1 22 26" stroke="#38bdf8" />
          {/* 基底小云朵 */}
          <path
            d="M5 28 h9 a3 3 0 0 0 0 -6 a4 4 0 0 0 -7.5 -1 a3 3 0 0 0 -1.5 7 z"
            stroke="#94a3b8"
            style={{ animation: 'weather-drift 4s ease-in-out infinite' }}
          />
        </svg>
      )}

      {/* 13. 绚烂晚霞 (Sunset) */}
      {weatherId === 'sunset' && (
        <svg
          viewBox="0 0 36 36"
          width={size}
          height={size}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* 地平线 */}
          <line x1="5" y1="23" x2="31" y2="23" stroke="#f97316" strokeWidth="1.8" />
          {/* 半轮落日 */}
          <path
            d="M12 23 A6 6 0 0 1 24 23"
            stroke={color || '#f43f5e'}
            strokeWidth="1.8"
            style={{ transformOrigin: '18px 23px', animation: 'weather-pulse-soft 3.5s ease-in-out infinite' }}
          />
          {/* 晚霞光芒 */}
          <line x1="18" y1="11" x2="18" y2="14" stroke="#fb923c" strokeWidth="1.6" />
          <line x1="11" y1="14" x2="13" y2="16" stroke="#fb923c" strokeWidth="1.6" />
          <line x1="25" y1="14" x2="23" y2="16" stroke="#fb923c" strokeWidth="1.6" />
          {/* 水面倒影微波 */}
          <line x1="10" y1="27" x2="26" y2="27" stroke="#fb923c" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="13" y1="31" x2="23" y2="31" stroke="#fb923c" strokeWidth="1.5" strokeDasharray="2 2" />
        </svg>
      )}

      {/* 14. 流星夜空 (Meteor) */}
      {weatherId === 'meteor' && (
        <svg
          viewBox="0 0 36 36"
          width={size}
          height={size}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* 弯月 */}
          <path
            d="M20 9 A6 6 0 1 0 27 16 A5 5 0 0 1 20 9 Z"
            stroke={color || '#818cf8'}
            strokeWidth="1.6"
          />
          {/* 闪烁十字星 */}
          <path
            d="M10 13 v4 M8 15 h4"
            stroke="#c084fc"
            strokeWidth="1.4"
            style={{ animation: 'weather-twinkle 2s ease-in-out infinite' }}
          />
          <path
            d="M26 25 v3 M24.5 26.5 h3"
            stroke="#c084fc"
            strokeWidth="1.4"
            style={{ animation: 'weather-twinkle 2.5s ease-in-out infinite 0.8s' }}
          />
          {/* 划破夜空的流星 */}
          <line
            x1="8"
            y1="8"
            x2="18"
            y2="18"
            stroke="#a855f7"
            strokeWidth="1.8"
            style={{ animation: 'weather-meteor 3s ease-in-out infinite' }}
          />
        </svg>
      )}

      {/* 15. 骤降冰雹 (Hail) */}
      {weatherId === 'hail' && (
        <svg
          viewBox="0 0 36 36"
          width={size}
          height={size}
          fill="none"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M8 17 h18 a4.5 4.5 0 0 0 0 -9 a6 6 0 0 0 -11.5 -2 a4.5 4.5 0 0 0 -6.5 11 z"
            stroke="#475569"
          />
          {/* 弹跳的菱形冰晶 */}
          <polygon
            points="12,22 14,24 12,26 10,24"
            stroke={color || '#6366f1'}
            style={{ animation: 'weather-hail 1.4s ease-in-out infinite' }}
          />
          <polygon
            points="18,23 20,25 18,27 16,25"
            stroke={color || '#6366f1'}
            style={{ animation: 'weather-hail 1.4s ease-in-out infinite 0.4s' }}
          />
          <polygon
            points="24,22 26,24 24,26 22,24"
            stroke={color || '#6366f1'}
            style={{ animation: 'weather-hail 1.4s ease-in-out infinite 0.8s' }}
          />
        </svg>
      )}
    </div>
  );
};
