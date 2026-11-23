import React, { useEffect, useState } from 'react';
import type { TroopLevel } from '../game/NepaleseBalanceConfig';
import {
  getMagarChartCropsSync,
  loadMagarChartCrops,
  MAGAR_CHART_IMAGE_URL,
  MagarChartPart,
} from '../game/MagarChartArtwork';

interface MagarChartSpriteProps {
  level: TroopLevel;
  part: MagarChartPart;
  alt: string;
  height?: number;
  accentColor?: string;
}

export const MagarChartSprite: React.FC<MagarChartSpriteProps> = ({
  level,
  part,
  alt,
  height = 88,
  accentColor = '#dfba6e',
}) => {
  const initialCrops = getMagarChartCropsSync();
  const [src, setSrc] = useState<string | null>(initialCrops ? initialCrops[level][part] : null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    const sync = getMagarChartCropsSync();
    if (sync) {
      setSrc(sync[level][part]);
      setHasError(false);
      return;
    }
    loadMagarChartCrops().then((crops) => {
      if (active) {
        setSrc(crops[level][part]);
        setHasError(false);
      }
    });
    return () => {
      active = false;
    };
  }, [level, part]);

  return (
    <div
      style={{
        width: '100%',
        height: `${height}px`,
        borderRadius: '7px',
        background: `radial-gradient(circle at 50% 45%, ${accentColor}1c 0%, rgba(15, 23, 42, 0.96) 78%)`,
        border: `1px solid ${accentColor}3a`,
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        padding: part === 'warrior' ? '3px 2px 0' : '4px',
      }}
    >
      {hasError || !src ? (
        <span
          style={{
            font: "700 10px 'Barlow Condensed', sans-serif",
            color: accentColor,
            letterSpacing: '0.04em',
            textAlign: 'center',
            padding: '0 4px',
          }}
        >
          {src === null ? 'Loading...' : `Lv.${level} ${part.toUpperCase()}`}
        </span>
      ) : (
        <img
          src={src || MAGAR_CHART_IMAGE_URL}
          alt={alt}
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setHasError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: part === 'warrior' ? 'center bottom' : 'center center',
            display: 'block',
            filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.72))',
          }}
        />
      )}
    </div>
  );
};
