import React from 'react';
import { InteractiveObject } from '../types/game';

interface ObjectHudProps {
  selectedObject: InteractiveObject | null;
  screenPos: { x: number; y: number } | null;
  onAttack: () => void;
  onScout: () => void;
  onMine: () => void;
  onInspect: () => void;
  onQuickStrike?: () => void;
  onRally?: () => void;
  onGarrison?: () => void;
}

export const ObjectHud: React.FC<ObjectHudProps> = ({
  selectedObject,
  screenPos,
  onAttack,
  onScout,
  onMine,
  onInspect,
  onQuickStrike,
  onRally,
  onGarrison,
}) => {
  if (!selectedObject || !screenPos) return null;

  const isMonster = selectedObject.type === 'monster';
  const isResource = selectedObject.type === 'resource';
  const isTower =
    selectedObject.subtype === 'tower' ||
    selectedObject.id?.includes('tower') ||
    selectedObject.name?.toLowerCase().includes('tower');
  const isBuilding = selectedObject.type === 'citadel' || selectedObject.type === 'fort' || isTower;
  const isDefeated =
    selectedObject.isDefeated || (selectedObject.health !== undefined && selectedObject.health <= 0);

  // High-level target or boss eligible for Rally
  const isRallyEligible =
    (isMonster && (selectedObject.level >= 3 || selectedObject.subtype === 'yeti')) ||
    isTower ||
    (isBuilding && selectedObject.level >= 10);

  const emoji = isMonster
    ? isDefeated
      ? '💨'
      : selectedObject.subtype === 'yeti'
      ? '❄️'
      : selectedObject.subtype === 'bear'
      ? '🐻'
      : selectedObject.subtype === 'rabbit'
      ? '🐇'
      : selectedObject.subtype === 'wolf'
      ? '🐺'
      : selectedObject.subtype === 'treemonster' || selectedObject.subtype === 'tree'
      ? '🌲'
      : '⚔️'
    : isResource
    ? selectedObject.subtype === 'wood'
      ? '🌲'
      : selectedObject.subtype === 'farm'
      ? '🌾'
      : selectedObject.subtype === 'gold'
      ? '🪙'
      : selectedObject.subtype === 'stonecrystal' || selectedObject.subtype === 'stone'
      ? '💎'
      : '⬟'
    : isTower
    ? '🗼'
    : '🏛️';

  const maxHp = selectedObject.maxHealth || (isTower ? 900 : 160);
  const curHp = selectedObject.health !== undefined ? selectedObject.health : maxHp;

  return (
    <div
      className="selected-object-hud"
      style={{
        transform: `translate(${screenPos.x}px, ${screenPos.y - 70}px) translate(-50%, -100%)`,
      }}
    >
      <div className="so-header">
        <span id="soEmoji">{emoji}</span>
        <div className="so-info">
          <b>{selectedObject.name}</b>
          <small>
            {isDefeated
              ? '💨 Dissolved into Smoke · Defeated'
              : isResource
              ? `Level ${selectedObject.level} · Reserve: ${selectedObject.yieldAmount || selectedObject.level * 250}`
              : `Level ${selectedObject.level} · HP: ${curHp}/${maxHp}`}
          </small>
        </div>
      </div>

      {(isMonster || isTower) && !isDefeated && (
        <div
          className="so-hp-bar-track"
          style={{
            height: '4px',
            background: 'rgba(0,0,0,0.5)',
            borderRadius: '2px',
            margin: '4px 0 6px',
            overflow: 'hidden',
            width: '100%',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.max(0, Math.min(100, (curHp / maxHp) * 100))}%`,
              background: curHp <= 50 ? '#ef4444' : isTower ? '#38bdf8' : '#eab308',
              transition: 'width 0.2s',
            }}
          />
        </div>
      )}

      <div className="so-actions" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* MONSTER CONTEXTUAL ACTIONS */}
        {isMonster && !isDefeated && (
          <>
            <button className="so-btn so-btn-attack" onClick={onAttack} title="Deploy Vanguard Army via 3D Dial">
              <span>⚔️ Deploy Dial</span>
            </button>

            {onQuickStrike && (
              <button
                className="so-btn so-btn-strike"
                onClick={onQuickStrike}
                title="Direct Strike (-45 HP): Triggers White Flash, turns into smoke when HP reaches 0"
                style={{
                  background: 'linear-gradient(135deg, #b91c1c, #7f1d1d)',
                  color: '#fff',
                  border: '1px solid #f87171',
                }}
              >
                <span>⚡ Strike</span>
              </button>
            )}

            {/* RALLY BUTTON FOR YETI & HIGH LEVEL MONSTERS */}
            {isRallyEligible && onRally && (
              <button
                className="so-btn so-btn-rally"
                onClick={onRally}
                title="Assemble Alliance War Rally against this high-level monster!"
                style={{
                  background: 'linear-gradient(135deg, #d97706, #92400e)',
                  color: '#fef3c7',
                  border: '1px solid #fcd34d',
                  boxShadow: '0 0 10px rgba(245, 158, 11, 0.5)',
                }}
              >
                <span>🚩 Rally</span>
              </button>
            )}

            <button className="so-btn so-btn-scout" onClick={onScout} title="Scout Monster Target">
              <span>👁️ Scout</span>
            </button>
          </>
        )}

        {isMonster && isDefeated && (
          <div style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' }}>
            💨 Vanquished & dissolved into mountain smoke
          </div>
        )}

        {/* RESOURCE CONTEXTUAL ACTIONS */}
        {isResource && (
          <>
            <button className="so-btn so-btn-mine" onClick={onMine} title="Deploy Troops to Mine Resources">
              <span>⛏️ Mine</span>
            </button>
            <button className="so-btn so-btn-scout" onClick={onScout} title="Scout Resource Node Reserves">
              <span>👁️ Scout</span>
            </button>
          </>
        )}

        {/* TOWER BUILDING & CITADEL ACTIONS */}
        {isBuilding && (
          <>
            {/* RALLY TO TOWER BUILDING */}
            {onRally && (
              <button
                className="so-btn so-btn-rally"
                onClick={onRally}
                title="Rally Alliance Forces to this Tower Building!"
                style={{
                  background: 'linear-gradient(135deg, #b45309, #78350f)',
                  color: '#fef3c7',
                  border: '1px solid #fbbf24',
                  boxShadow: '0 0 10px rgba(251, 191, 36, 0.45)',
                }}
              >
                <span>🚩 Rally Tower</span>
              </button>
            )}

            <button
              className="so-btn so-btn-attack"
              onClick={onAttack}
              title="Assault Tower with Vanguard Forces"
            >
              <span>⚔️ Assault</span>
            </button>

            {onGarrison && (
              <button
                className="so-btn so-btn-mine"
                onClick={onGarrison}
                title="Garrison and Defend Tower"
                style={{
                  background: 'linear-gradient(135deg, #1e3a8a, #172554)',
                  borderColor: '#60a5fa',
                  color: '#dbeafe',
                }}
              >
                <span>🛡️ Garrison</span>
              </button>
            )}

            <button className="so-btn so-btn-scout" onClick={onScout} title="Scout Tower Garrisons & Defenses">
              <span>👁️ Scout</span>
            </button>

            <button className="so-btn so-btn-scout" onClick={onInspect} title="Inspect Architecture">
              <span>🏛️ Inspect</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
