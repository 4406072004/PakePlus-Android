import React from 'react';

interface AnankeLogoProps {
  className?: string;
  size?: number | string;
  showText?: boolean;
}

export const AnankeLogo: React.FC<AnankeLogoProps> = ({
  className = '',
  size = 120,
}) => {
  return (
    <svg
      viewBox="0 0 500 500"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
    >
      {/* Background canvas */}
      <rect width="500" height="500" rx="40" fill="#faf9f6" />

      {/* Orbit 1: Ellipse tilted ~20 deg */}
      <g transform="translate(250, 250) rotate(-18) translate(-250, -250)">
        <ellipse
          cx="250"
          cy="250"
          rx="185"
          ry="72"
          stroke="#4a4d52"
          strokeWidth="1.6"
          fill="none"
          strokeOpacity="0.85"
        />
        {/* Planet sphere on the left side of orbit */}
        <circle cx="68" cy="250" r="5.5" fill="#60646b" />
        
        {/* Triangle arrow on bottom-left */}
        <polygon
          points="80,318 64,332 94,332"
          stroke="#4a4d52"
          strokeWidth="1.5"
          fill="none"
        />
      </g>

      {/* Orbit 2: Ellipse tilted ~24 deg clockwise */}
      <g transform="translate(250, 250) rotate(22) translate(-250, -250)">
        <ellipse
          cx="250"
          cy="250"
          rx="180"
          ry="68"
          stroke="#52565c"
          strokeWidth="1.6"
          fill="none"
          strokeOpacity="0.85"
        />
        {/* Sparkle star on top-right */}
        <g transform="translate(422, 230)">
          {/* 4-pointed celestial star */}
          <path
            d="M0,-14 Q0,0 14,0 Q0,0 0,14 Q0,0 -14,0 Q0,0 0,-14 Z"
            fill="#52565c"
          />
          {/* Stylized diagonal triangle fin */}
          <polygon
            points="0,-12 18,-6 8,10"
            stroke="#52565c"
            strokeWidth="1.4"
            fill="none"
          />
        </g>
      </g>

      {/* Centered Serif Brand Typography "Ananke" */}
      <text
        x="250"
        y="278"
        textAnchor="middle"
        fontFamily="'Cormorant Garamond', 'Didot', 'Bodoni MT', 'Playfair Display', 'Times New Roman', serif"
        fontSize="106"
        fontWeight="400"
        letterSpacing="2px"
        fill="#111215"
      >
        Ananke
      </text>
    </svg>
  );
};
