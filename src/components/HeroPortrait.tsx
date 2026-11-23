import React, { useState } from 'react';
import type { NepaleseHeroConfig } from '../game/NepaleseBalanceConfig';
import { getHeroPortraitUrl } from '../game/HeroPortraits';

interface HeroPortraitProps {
  hero?: NepaleseHeroConfig | null;
  heroId?: string | null;
  heroName?: string;
  size?: number;
  rounded?: number;
  isSelected?: boolean;
  isLocked?: boolean;
}

export const HeroPortrait: React.FC<HeroPortraitProps> = ({
  hero,
  heroId,
  heroName,
  size = 40,
  rounded = 8,
  isSelected = false,
  isLocked = false,
}) => {
  const [hasError, setHasError] = useState(false);
  const crest = hero?.crestColor || '#f59e0b';
  const label = hero?.name || heroName || 'Commander';
  const src = hero?.portraitUrl || getHeroPortraitUrl(hero?.id || heroId);
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();

  return (
    <div
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        borderRadius: `${rounded}px`,
        border: isSelected ? '1.5px solid #fde047' : `1.5px solid ${crest}99`,
        background: `radial-gradient(circle at 50% 38%, ${crest}2e 0%, rgba(10, 16, 28, 0.98) 78%)`,
        boxShadow: isSelected
          ? `0 0 12px ${crest}75, inset 0 0 6px rgba(254, 240, 138, 0.3)`
          : '0 2px 6px rgba(0,0,0,0.55)',
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      {hasError ? (
        <span
          style={{
            font: `800 ${Math.max(10, Math.round(size * 0.34))}px 'Barlow Condensed', sans-serif`,
            color: crest,
            letterSpacing: '0.04em',
          }}
        >
          {initials}
        </span>
      ) : (
        <img
          src={src}
          alt={label}
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setHasError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 22%',
            display: 'block',
            filter: isLocked ? 'grayscale(0.65) brightness(0.62)' : 'none',
          }}
        />
      )}
      {isLocked && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.42)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: '2px',
          }}
        >
          <span
            style={{
              font: "800 8px 'Barlow Condensed', sans-serif",
              color: '#fca5a5',
              letterSpacing: '0.05em',
              textShadow: '0 1px 2px #000',
            }}
          >
            ON MARCH
          </span>
        </div>
      )}
    </div>
  );
};
