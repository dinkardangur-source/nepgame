import React, { useEffect, useState } from 'react';
import {
  getCachedMonsterCutoutSync,
  getMonsterArtConfig,
  loadProcessedMonsterCutout,
} from '../game/MonsterArtwork';

interface MonsterPortraitProps {
  subtype?: string;
  level?: number;
  name?: string;
  size?: number;
  rounded?: number;
}

export const MonsterPortrait: React.FC<MonsterPortraitProps> = ({
  subtype,
  level,
  name,
  size = 44,
  rounded = 8,
}) => {
  const artCfg = getMonsterArtConfig(subtype, level, name);
  const cached = getCachedMonsterCutoutSync(artCfg.key);
  const [src, setSrc] = useState<string>(cached?.dataUrl ?? artCfg.imageUrl);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    const syncCached = getCachedMonsterCutoutSync(artCfg.key);
    if (syncCached) {
      setSrc(syncCached.dataUrl);
      setHasError(false);
      return;
    }
    loadProcessedMonsterCutout(artCfg.key).then((res) => {
      if (active) {
        setSrc(res.dataUrl);
        setHasError(false);
      }
    });
    return () => {
      active = false;
    };
  }, [artCfg.key]);

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        borderRadius: `${rounded}px`,
        border: `1.5px solid ${artCfg.auraCss}`,
        background: `radial-gradient(circle at 50% 60%, ${artCfg.auraCss}33 0%, rgba(15, 23, 42, 0.96) 72%)`,
        boxShadow: `inset 0 0 10px ${artCfg.auraCss}30, 0 2px 8px rgba(0,0,0,0.45)`,
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        padding: '2px',
        flexShrink: 0,
      }}
    >
      {hasError ? (
        <span
          style={{
            font: "800 12px 'Barlow Condensed', sans-serif",
            color: artCfg.auraCss,
          }}
        >
          {artCfg.label.slice(0, 2).toUpperCase()}
        </span>
      ) : (
        <img
          src={src}
          alt={name || artCfg.label}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.75))`,
          }}
        />
      )}
    </div>
  );
};
