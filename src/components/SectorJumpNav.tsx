import React, { useState } from 'react';
import { PROVINCES } from '../data/initialData';

interface SectorJumpNavProps {
  currentPan: { x: number; z: number };
  currentZoom: number;
  onJumpToSector: (center: [number, number, number]) => void;
  onSetZoom: (zoom: number) => void;
  onCenterArmy: () => void;
}

export const SectorJumpNav: React.FC<SectorJumpNavProps> = ({
  currentPan,
  currentZoom,
  onJumpToSector,
  onSetZoom,
  onCenterArmy,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const sectors = Object.values(PROVINCES);

  // Determine which sector is currently closest to view center
  const viewX = -currentPan.x;
  const viewZ = -currentPan.z;

  let activeSectorId = 'valley';
  let minDist = Infinity;
  for (const s of sectors) {
    const d = Math.hypot(viewX - s.center[0], viewZ - s.center[2]);
    if (d < minDist) {
      minDist = d;
      activeSectorId = s.id;
    }
  }

  return (
    <div
      className="sector-nav-dock"
      style={{
        position: 'absolute',
        bottom: isCollapsed ? '10px' : '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        pointerEvents: 'auto',
        transition: 'bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        maxWidth: 'min(960px, 94vw)',
      }}
    >
      {/* Collapse/Expand toggle handle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'none',
          border: '1px solid rgba(218, 165, 32, 0.35)',
          color: '#dfba6e',
          fontSize: '11px',
          fontWeight: 600,
          padding: '3px 12px',
          borderRadius: '12px',
          cursor: 'pointer',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}
        title="Toggle Sector Quick-Jump Nav Bar"
      >
        <span>{isCollapsed ? '▴ Realm Navigator' : '▾ Hide Navigator'}</span>
        <span style={{ color: '#94a3b8', fontSize: '10px' }}>
          ({Math.round(viewX)}, {Math.round(viewZ)})
        </span>
      </button>

      {/* Main horizontal dock */}
      {!isCollapsed && (
        <div
          style={{
            background: 'rgba(10, 16, 26, 0.94)',
            border: '1px solid rgba(218, 165, 32, 0.4)',
            borderRadius: '14px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {/* Sector Quick-Jump Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '10px',
                color: '#94a3b8',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginRight: '2px',
              }}
            >
              Sectors:
            </span>
            {sectors.map((sec) => {
              const isActive = activeSectorId === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => onJumpToSector(sec.center)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(218, 165, 32, 0.35), rgba(180, 83, 9, 0.3))'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: isActive
                      ? '1px solid #dfba6e'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    color: isActive ? '#fef08a' : '#cbd5e1',
                    transition: 'all 0.15s ease',
                  }}
                  title={`${sec.name} [X:${sec.center[0]}, Z:${sec.center[2]}]`}
                >
                  <span style={{ fontSize: '13px' }}>{sec.icon}</span>
                  <span>{sec.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>

          <div style={{ width: '1px', height: '22px', background: 'rgba(255, 255, 255, 0.15)' }} />

          {/* Multi-Tier Zoom Levels */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '10px',
                color: '#94a3b8',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginRight: '2px',
              }}
            >
              Zoom:
            </span>

            <button
              onClick={() => onSetZoom(0.35)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                background: Math.abs(currentZoom - 0.35) < 0.1 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                border: Math.abs(currentZoom - 0.35) < 0.1 ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                color: Math.abs(currentZoom - 0.35) < 0.1 ? '#38bdf8' : '#94a3b8',
              }}
              title="Overview Tier (0.35x - View full 800x800 realm)"
            >
              0.35x Overview
            </button>

            <button
              onClick={() => onSetZoom(1.0)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                background: Math.abs(currentZoom - 1.0) < 0.15 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                border: Math.abs(currentZoom - 1.0) < 0.15 ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                color: Math.abs(currentZoom - 1.0) < 0.15 ? '#38bdf8' : '#94a3b8',
              }}
              title="Strategic Tier (1.0x - Sector march view)"
            >
              1.0x Strategic
            </button>

            <button
              onClick={() => onSetZoom(2.2)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                background: Math.abs(currentZoom - 2.2) < 0.2 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                border: Math.abs(currentZoom - 2.2) < 0.2 ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                color: Math.abs(currentZoom - 2.2) < 0.2 ? '#38bdf8' : '#94a3b8',
              }}
              title="Tactical Tier (2.2x - Close RPG asset inspection)"
            >
              2.2x Tactical
            </button>
          </div>

          <div style={{ width: '1px', height: '22px', background: 'rgba(255, 255, 255, 0.15)' }} />

          {/* Center Army Button */}
          <button
            onClick={onCenterArmy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(218, 165, 32, 0.2), rgba(180, 83, 9, 0.2))',
              border: '1px solid rgba(218, 165, 32, 0.5)',
              color: '#fef08a',
            }}
            title="Center view on Magar Vanguard Garrison"
          >
            <span>🛡️</span>
            <span>Garrison</span>
          </button>
        </div>
      )}
    </div>
  );
};
