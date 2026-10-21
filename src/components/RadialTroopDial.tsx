import React, { useState, useEffect, useRef } from 'react';
import { InteractiveObject, UnitCounts } from '../types/game';

interface RadialTroopDialProps {
  isOpen: boolean;
  onClose: () => void;
  target: InteractiveObject | null;
  mode: 'attack' | 'gather';
  availableUnits: UnitCounts;
  targetScreenPos: { x: number; y: number } | null;
  onConfirm: (dispatched: UnitCounts) => void;
}

interface TiltState {
  rotateX: number;
  rotateY: number;
  isHovered: boolean;
}

export const RadialTroopDial: React.FC<RadialTroopDialProps> = ({
  isOpen,
  onClose,
  target,
  mode,
  availableUnits,
  targetScreenPos,
  onConfirm,
}) => {
  const [infantry, setInfantry] = useState(0);
  const [cavalry, setCavalry] = useState(0);
  const [archer, setArcher] = useState(0);

  // 3D Tilt states for each isometric card
  const [tiltInfantry, setTiltInfantry] = useState<TiltState>({ rotateX: 0, rotateY: 0, isHovered: false });
  const [tiltCavalry, setTiltCavalry] = useState<TiltState>({ rotateX: 0, rotateY: 0, isHovered: false });
  const [tiltArcher, setTiltArcher] = useState<TiltState>({ rotateX: 0, rotateY: 0, isHovered: false });

  // Hover states for the individual isometric unit badges (triggering 3D pop)
  const [hoveredBadge, setHoveredBadge] = useState<'infantry' | 'cavalry' | 'archer' | null>(null);

  const dialRef = useRef<HTMLDivElement | null>(null);

  // Tactical Web Audio pop click for physical tactile feedback on hover
  const playTacticalPop = (freq = 520) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.035, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {
      // AudioContext unavailable or not yet interacted
    }
  };

  // Initialize with 50% available troops whenever opened
  useEffect(() => {
    if (isOpen) {
      setInfantry(Math.max(1, Math.floor(availableUnits.infantry * 0.5)));
      setCavalry(Math.max(1, Math.floor(availableUnits.cavalry * 0.5)));
      setArcher(Math.max(1, Math.floor(availableUnits.archer * 0.5)));
    }
  }, [isOpen, availableUnits]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !target) return null;

  const isAttack = mode === 'attack';
  const totalForcePower = infantry * 85 + cavalry * 220 + archer * 140;
  const targetReqPower = (target.level || 5) * 600;
  const winPercent = Math.min(99, Math.max(15, Math.round((totalForcePower / targetReqPower) * 75)));

  const setPreset = (ratio: number) => {
    setInfantry(Math.floor(availableUnits.infantry * ratio));
    setCavalry(Math.floor(availableUnits.cavalry * ratio));
    setArcher(Math.floor(availableUnits.archer * ratio));
  };

  const handleCardMouseMove = (
    e: React.MouseEvent<HTMLDivElement>,
    setTilt: React.Dispatch<React.SetStateAction<TiltState>>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateX = -(y / (rect.height / 2)) * 14;
    const rotateY = (x / (rect.width / 2)) * 14;
    setTilt({ rotateX, rotateY, isHovered: true });
  };

  const handleCardMouseLeave = (
    setTilt: React.Dispatch<React.SetStateAction<TiltState>>
  ) => {
    setTilt({ rotateX: 0, rotateY: 0, isHovered: false });
  };

  const handleConfirm = () => {
    if (infantry + cavalry + archer === 0) return;
    onConfirm({ infantry, cavalry, archer });
    onClose();
  };

  // Compute position relative to target screen position, clamped to screen viewport
  const posX = targetScreenPos?.x || window.innerWidth / 2;
  const posY = targetScreenPos?.y || window.innerHeight / 2;

  // Clamp so the dial doesn't overflow viewport edges
  const dialWidth = 460;
  const dialHeight = 290;
  const clampedX = Math.max(dialWidth / 2 + 16, Math.min(window.innerWidth - dialWidth / 2 - 16, posX));
  const clampedY = Math.max(dialHeight / 2 + 70, Math.min(window.innerHeight - dialHeight / 2 - 40, posY - 20));

  return (
    <div
      className="radial-dial-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialRef}
        className="radial-dial-wrapper"
        style={{
          left: `${clampedX}px`,
          top: `${clampedY}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pointer beacon connecting to target */}
        <div className="dial-beacon"></div>

        {/* Tactical Dial Glass Header */}
        <div className="dial-header">
          <div className="dial-target-info">
            <span
              className="dial-mode-badge"
              style={{ background: isAttack ? 'linear-gradient(135deg,#8e2920,#561a15)' : 'linear-gradient(135deg,#7e642a,#4a3a16)' }}
            >
              {isAttack ? '⚔️ ATTACK' : '⛏️ MINE'}
            </span>
            <b>{target.name}</b>
            <span className="dial-sub">LVL {target.level} · {isAttack ? `HP: ${target.health || 250}` : `Ore: ${target.yieldAmount || 300}`}</span>
          </div>

          <div className="dial-presets">
            <button type="button" onClick={() => setPreset(0.25)} className="btn-preset-mini">25%</button>
            <button type="button" onClick={() => setPreset(0.5)} className="btn-preset-mini">50%</button>
            <button type="button" onClick={() => setPreset(1.0)} className="btn-preset-mini active">MAX</button>
            <button type="button" onClick={onClose} className="btn-dial-close" title="Cancel [Esc]">✕</button>
          </div>
        </div>

        {/* 3D Isometric Cards Row */}
        <div className="iso-cards-row">
          {/* Card 1: Magar Infantry */}
          <div
            className="iso-troop-card"
            style={{
              transform: `perspective(600px) rotateX(${tiltInfantry.rotateX}deg) rotateY(${tiltInfantry.rotateY}deg) ${tiltInfantry.isHovered ? 'translateZ(10px)' : 'translateZ(0px)'}`,
            }}
            onMouseMove={(e) => handleCardMouseMove(e, setTiltInfantry)}
            onMouseLeave={() => handleCardMouseLeave(setTiltInfantry)}
          >
            <div className="card-glare"></div>
            <div
              className={`iso-card-badge infantry ${hoveredBadge === 'infantry' ? 'popped' : ''}`}
              onMouseEnter={() => {
                setHoveredBadge('infantry');
                playTacticalPop(520);
              }}
              onMouseLeave={() => setHoveredBadge(null)}
              onClick={() => {
                setInfantry((p) => Math.min(availableUnits.infantry, p + 10));
                playTacticalPop(620);
              }}
              title="Tactical Badge: Hover for 3D Pop · Click to quick-add +10 troops"
            >
              <div className="badge-pop-shine"></div>
              <span className="unit-icon">⚔️</span>
              <div className="badge-text-col">
                <span className="unit-label">Magar Vanguard</span>
                <span className="unit-tactical-tag">MELEE ASSAULT</span>
              </div>
              <span className="badge-pop-pip" title="Isometric 3D Depth Layer">3D</span>
            </div>

            <div className="iso-card-meta">
              <span>Avail: <b>{availableUnits.infantry}</b></span>
              <span className="unit-power">✦ {infantry * 85}</span>
            </div>

            <div className="iso-slider-wrap">
              <input
                type="range"
                min="0"
                max={availableUnits.infantry}
                value={infantry}
                onChange={(e) => setInfantry(Number(e.target.value))}
                className="iso-slider"
              />
            </div>

            <div className="iso-counter-row">
              <button
                type="button"
                className="btn-dial-step"
                onClick={() => setInfantry((p) => Math.max(0, p - 5))}
              >
                −5
              </button>
              <span className="iso-count">{infantry}</span>
              <button
                type="button"
                className="btn-dial-step"
                onClick={() => setInfantry((p) => Math.min(availableUnits.infantry, p + 5))}
              >
                +5
              </button>
            </div>
          </div>

          {/* Card 2: Mountain Cavalry */}
          <div
            className="iso-troop-card"
            style={{
              transform: `perspective(600px) rotateX(${tiltCavalry.rotateX}deg) rotateY(${tiltCavalry.rotateY}deg) ${tiltCavalry.isHovered ? 'translateZ(10px)' : 'translateZ(0px)'}`,
            }}
            onMouseMove={(e) => handleCardMouseMove(e, setTiltCavalry)}
            onMouseLeave={() => handleCardMouseLeave(setTiltCavalry)}
          >
            <div className="card-glare"></div>
            <div
              className={`iso-card-badge cavalry ${hoveredBadge === 'cavalry' ? 'popped' : ''}`}
              onMouseEnter={() => {
                setHoveredBadge('cavalry');
                playTacticalPop(620);
              }}
              onMouseLeave={() => setHoveredBadge(null)}
              onClick={() => {
                setCavalry((p) => Math.min(availableUnits.cavalry, p + 5));
                playTacticalPop(720);
              }}
              title="Tactical Badge: Hover for 3D Pop · Click to quick-add +5 steeds"
            >
              <div className="badge-pop-shine"></div>
              <span className="unit-icon">🏇</span>
              <div className="badge-text-col">
                <span className="unit-label">Mountain Steeds</span>
                <span className="unit-tactical-tag">FLANK CHARGE</span>
              </div>
              <span className="badge-pop-pip" title="Isometric 3D Depth Layer">3D</span>
            </div>

            <div className="iso-card-meta">
              <span>Avail: <b>{availableUnits.cavalry}</b></span>
              <span className="unit-power">✦ {cavalry * 220}</span>
            </div>

            <div className="iso-slider-wrap">
              <input
                type="range"
                min="0"
                max={availableUnits.cavalry}
                value={cavalry}
                onChange={(e) => setCavalry(Number(e.target.value))}
                className="iso-slider"
              />
            </div>

            <div className="iso-counter-row">
              <button
                type="button"
                className="btn-dial-step"
                onClick={() => setCavalry((p) => Math.max(0, p - 2))}
              >
                −2
              </button>
              <span className="iso-count">{cavalry}</span>
              <button
                type="button"
                className="btn-dial-step"
                onClick={() => setCavalry((p) => Math.min(availableUnits.cavalry, p + 2))}
              >
                +2
              </button>
            </div>
          </div>

          {/* Card 3: Himalayan Archers */}
          <div
            className="iso-troop-card"
            style={{
              transform: `perspective(600px) rotateX(${tiltArcher.rotateX}deg) rotateY(${tiltArcher.rotateY}deg) ${tiltArcher.isHovered ? 'translateZ(10px)' : 'translateZ(0px)'}`,
            }}
            onMouseMove={(e) => handleCardMouseMove(e, setTiltArcher)}
            onMouseLeave={() => handleCardMouseLeave(setTiltArcher)}
          >
            <div className="card-glare"></div>
            <div
              className={`iso-card-badge archer ${hoveredBadge === 'archer' ? 'popped' : ''}`}
              onMouseEnter={() => {
                setHoveredBadge('archer');
                playTacticalPop(740);
              }}
              onMouseLeave={() => setHoveredBadge(null)}
              onClick={() => {
                setArcher((p) => Math.min(availableUnits.archer, p + 10));
                playTacticalPop(840);
              }}
              title="Tactical Badge: Hover for 3D Pop · Click to quick-add +10 bowmen"
            >
              <div className="badge-pop-shine"></div>
              <span className="unit-icon">🏹</span>
              <div className="badge-text-col">
                <span className="unit-label">Alpine Bowmen</span>
                <span className="unit-tactical-tag">PRECISION VOLLEY</span>
              </div>
              <span className="badge-pop-pip" title="Isometric 3D Depth Layer">3D</span>
            </div>

            <div className="iso-card-meta">
              <span>Avail: <b>{availableUnits.archer}</b></span>
              <span className="unit-power">✦ {archer * 140}</span>
            </div>

            <div className="iso-slider-wrap">
              <input
                type="range"
                min="0"
                max={availableUnits.archer}
                value={archer}
                onChange={(e) => setArcher(Number(e.target.value))}
                className="iso-slider"
              />
            </div>

            <div className="iso-counter-row">
              <button
                type="button"
                className="btn-dial-step"
                onClick={() => setArcher((p) => Math.max(0, p - 5))}
              >
                −5
              </button>
              <span className="iso-count">{archer}</span>
              <button
                type="button"
                className="btn-dial-step"
                onClick={() => setArcher((p) => Math.min(availableUnits.archer, p + 5))}
              >
                +5
              </button>
            </div>
          </div>
        </div>

        {/* Tactical Dial Footer & Launch Button */}
        <div className="dial-footer">
          <div className="dial-stats">
            <div>
              <small>TOTAL POWER</small>
              <b>✦ {totalForcePower.toLocaleString()}</b>
            </div>
            <div>
              <small>PROJECTION</small>
              <b className={winPercent >= 70 ? 'status-good' : 'status-warn'}>
                {isAttack ? `${winPercent}% Win Rate` : '100% Yield'}
              </b>
            </div>
          </div>

          <button
            type="button"
            className={`btn-dial-launch ${!isAttack ? 'mine-launch' : ''}`}
            onClick={handleConfirm}
            disabled={infantry + cavalry + archer === 0}
          >
            <span>{isAttack ? '⚔️' : '⛏️'}</span>
            <b>{isAttack ? 'Deploy Vanguard' : 'Dispatch Miners'}</b>
          </button>
        </div>
      </div>
    </div>
  );
};
