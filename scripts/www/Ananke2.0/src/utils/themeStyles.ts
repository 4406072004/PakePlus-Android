import React from 'react';

/**
 * Helper to safely construct card background styling without mixing shorthand `background`
 * with longhand `backgroundPosition` / `backgroundSize`, avoiding React re-render style conflict warnings.
 */
export const getCardBackgroundStyle = (
  bgValue?: string,
  opacity?: number
): React.CSSProperties => {
  const val = bgValue || '#ffffff';
  const style: React.CSSProperties = {
    opacity: opacity !== undefined ? opacity : 1.0,
  };

  if (val.startsWith('url(')) {
    style.backgroundImage = val;
    style.backgroundPosition = 'center';
    style.backgroundSize = 'cover';
    style.backgroundRepeat = 'no-repeat';
  } else if (val.includes('gradient')) {
    style.backgroundImage = val;
  } else {
    style.backgroundColor = val;
  }

  return style;
};
