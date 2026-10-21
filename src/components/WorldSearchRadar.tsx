import React, { useState, useMemo } from 'react';
import { InteractiveObject } from '../types/game';

interface WorldSearchRadarProps {
  isOpen: boolean;
  onToggle: () => void;
  objects: InteractiveObject[];
  playerBasePos?: [number, number, number];
  onSelectAndLocate: (obj: InteractiveObject) => void;
  onQuickDispatch?: (obj: InteractiveObject, mode: 'attack' | 'gather') => void;
}

export type SearchCategory = 'all' | 'resource' | 'monster' | 'tower';

export const WorldSearchRadar: React.FC<WorldSearchRadarProps> = ({
  isOpen,
  onToggle,
  objects,
  playerBasePos = [-14, 0, 10],
  onSelectAndLocate,
  onQuickDispatch,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('all');
  const [selectedSubtype, setSelectedSubtype] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<number | 'all'>('all');

  // Calculate distance from player citadel
  const calculateDistance = (pos: [number, number, number]) => {
    const dx = pos[0] - playerBasePos[0];
    const dz = pos[2] - playerBasePos[2];
    return Math.round(Math.sqrt(dx * dx + dz * dz) * 10); // scale in meters
  };

  // Filter matching targets
  const filteredTargets = useMemo(() => {
    return objects
      .filter((obj) => {
        const isTower = obj.subtype === 'tower' || obj.id?.includes('tower') || obj.name?.toLowerCase().includes('tower');

        // Category filter
        if (selectedCategory === 'tower') {
          if (!isTower) return false;
        } else if (selectedCategory !== 'all') {
          if (obj.type !== selectedCategory) return false;
        } else {
          // If 'all', include resources, monsters, and tower buildings
          if (obj.type !== 'resource' && obj.type !== 'monster' && !isTower) return false;
        }

        // Subtype filter
        if (selectedSubtype !== 'all') {
          if (selectedSubtype === 'tree') {
            if (obj.subtype !== 'treemonster' && obj.subtype !== 'tree') return false;
          } else if (selectedSubtype === 'stonecrystal') {
            if (obj.subtype !== 'stonecrystal' && obj.subtype !== 'stone') return false;
          } else if (selectedSubtype === 'tower') {
            if (!isTower) return false;
          } else {
            if (obj.subtype !== selectedSubtype) return false;
          }
        }

        // Level filter 1 - 5 (or level match)
        if (selectedLevel !== 'all') {
          if (obj.level !== selectedLevel && !(selectedLevel === 5 && obj.level > 5)) return false;
        }

        // Search text
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const nameMatch = obj.name.toLowerCase().includes(q);
          const subtypeMatch = obj.subtype.toLowerCase().includes(q);
          const typeMatch = obj.type.toLowerCase().includes(q);
          if (!nameMatch && !subtypeMatch && !typeMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const distA = calculateDistance(a.position);
        const distB = calculateDistance(b.position);
        return distA - distB;
      });
  }, [objects, selectedCategory, selectedSubtype, selectedLevel, searchTerm, playerBasePos]);

  const getSubtypeIcon = (obj: InteractiveObject) => {
    const isTower = obj.subtype === 'tower' || obj.id?.includes('tower') || obj.name?.toLowerCase().includes('tower');
    if (isTower) return '🗼';

    switch (obj.subtype) {
      case 'wood':
        return '🌲';
      case 'farm':
        return '🌾';
      case 'gold':
        return '🪙';
      case 'stonecrystal':
      case 'stone':
        return '💎';
      case 'yeti':
        return '❄️';
      case 'bear':
        return '🐻';
      case 'rabbit':
        return '🐇';
      case 'wolf':
        return '🐺';
      case 'treemonster':
      case 'tree':
        return '🪵';
      default:
        return obj.type === 'monster' ? '👾' : '⛏️';
    }
  };

  return (
    <>
      {/* 3D TACTICAL SEARCHING ICON BUTTON (TOP-RIGHT DOCK) */}
      <div className="tactical-3d-dock top-right">
        <button
          type="button"
          onClick={onToggle}
          className={`btn-3d-tactical ${isOpen ? 'active' : ''}`}
          title="Tactical World Radar (Search Resources & Monsters Lv 1-5)"
        >
          {/* 3D Compass Sphere Housing */}
          <div className="icon-3d-compass-wrap">
            <div className="icon-3d-compass-face">
              <div className="compass-radar-sweep" />
              <div className="compass-needle-3d">
                <div className="compass-needle-north" />
                <div className="compass-needle-south" />
              </div>
              <div className="compass-center-rivet" />
            </div>
          </div>

          <div className="btn-3d-label">
            <span className="btn-3d-title">3D Radar</span>
            <span className="btn-3d-sub">Scan Lv 1-5</span>
          </div>

          <span
            style={{
              padding: '2px 5px',
              borderRadius: '4px',
              background: '#202f3f',
              border: '1px solid #48627c',
              fontSize: '10px',
              fontWeight: 700,
              color: '#ffd978',
            }}
          >
            {filteredTargets.length}
          </span>
        </button>
      </div>

      {/* DOCKED TACTICAL RADAR SEARCH WINDOW (NEVER FULLSCREEN - ALWAYS BOUND TO CORNER) */}
      {isOpen && (
        <div className="tactical-radar-window">
          {/* Header Bar */}
          <div className="radar-header-bar">
            <div className="radar-header-title">
              <span style={{ fontSize: '20px' }}>🧭</span>
              <div>
                <h3>Tactical World Radar</h3>
                <p>Locate Resources & Monsters Lv 1 - 5</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '9px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: '#243242',
                  color: '#dfba6e',
                  border: '1px solid #dfba6e55',
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                }}
              >
                {filteredTargets.length} TARGETS
              </span>
              <button
                type="button"
                className="btn-chat-ctrl"
                onClick={onToggle}
                title="Close Radar"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body Area */}
          <div className="radar-body-area">
            {/* Search Input Bar */}
            <div className="radar-search-input-wrap">
              <span className="search-ico">🔍</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Wood, Farm, Gold, Bear, Wolf..."
                className="radar-search-input"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="radar-clear-btn"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Switcher Tabs */}
            <div className="radar-cat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedSubtype('all');
                }}
                className={`radar-cat-btn ${selectedCategory === 'all' ? 'active' : ''}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('resource');
                  setSelectedSubtype('all');
                }}
                className={`radar-cat-btn ${selectedCategory === 'resource' ? 'active' : ''}`}
              >
                <span>⛏️</span>
                <span>Mine</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('monster');
                  setSelectedSubtype('all');
                }}
                className={`radar-cat-btn ${selectedCategory === 'monster' ? 'active monster' : ''}`}
              >
                <span>⚔️</span>
                <span>Monsters</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('tower');
                  setSelectedSubtype('all');
                }}
                className={`radar-cat-btn ${selectedCategory === 'tower' ? 'active' : ''}`}
                style={{
                  background: selectedCategory === 'tower' ? 'linear-gradient(135deg, #1e3a5f, #0f2744)' : undefined,
                  borderColor: selectedCategory === 'tower' ? '#38bdf8' : undefined,
                  color: selectedCategory === 'tower' ? '#bae6fd' : undefined,
                }}
              >
                <span>🗼</span>
                <span>Towers</span>
              </button>
            </div>

            {/* 3D Level Selector Pills (1 - 5) */}
            <div className="radar-level-row">
              <small>FILTER LEVEL (1 - 5):</small>
              <div className="level-pills-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedLevel('all')}
                  className={`level-3d-btn ${selectedLevel === 'all' ? 'active' : ''}`}
                  style={{ width: 'auto', padding: '0 6px' }}
                >
                  ALL
                </button>
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedLevel(lvl === selectedLevel ? 'all' : lvl)}
                    className={`level-3d-btn ${selectedLevel === lvl ? 'active' : ''}`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Subtype Quick Filter Chips */}
            <div className="radar-subtypes-scroll">
              <button
                type="button"
                onClick={() => setSelectedSubtype('all')}
                className={`radar-sub-chip ${selectedSubtype === 'all' ? 'active' : ''}`}
              >
                All Subtypes
              </button>

              {/* Resource Subtypes */}
              {(selectedCategory === 'all' || selectedCategory === 'resource') && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedSubtype('wood')}
                    className={`radar-sub-chip ${selectedSubtype === 'wood' ? 'active' : ''}`}
                  >
                    <span>🌲</span> Wood
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSubtype('farm')}
                    className={`radar-sub-chip ${selectedSubtype === 'farm' ? 'active' : ''}`}
                  >
                    <span>🌾</span> Farm
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSubtype('gold')}
                    className={`radar-sub-chip ${selectedSubtype === 'gold' ? 'active' : ''}`}
                  >
                    <span>🪙</span> Gold
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSubtype('stonecrystal')}
                    className={`radar-sub-chip ${selectedSubtype === 'stonecrystal' ? 'active' : ''}`}
                  >
                    <span>💎</span> Stone Crystal
                  </button>
                </>
              )}

              {/* Monster Subtypes */}
              {(selectedCategory === 'all' || selectedCategory === 'monster') && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedSubtype('yeti')}
                    className={`radar-sub-chip ${selectedSubtype === 'yeti' ? 'active' : ''}`}
                    style={{
                      background: selectedSubtype === 'yeti' ? 'linear-gradient(135deg, #0369a1, #0c4a6e)' : undefined,
                      borderColor: selectedSubtype === 'yeti' ? '#38bdf8' : undefined,
                    }}
                  >
                    <span>❄️</span> Yeti
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSubtype('bear')}
                    className={`radar-sub-chip ${selectedSubtype === 'bear' ? 'active' : ''}`}
                  >
                    <span>🐻</span> Bear
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSubtype('rabbit')}
                    className={`radar-sub-chip ${selectedSubtype === 'rabbit' ? 'active' : ''}`}
                  >
                    <span>🐇</span> Rabbit
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSubtype('wolf')}
                    className={`radar-sub-chip ${selectedSubtype === 'wolf' ? 'active' : ''}`}
                  >
                    <span>🐺</span> Wolf
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSubtype('tree')}
                    className={`radar-sub-chip ${selectedSubtype === 'tree' ? 'active' : ''}`}
                  >
                    <span>🪵</span> Tree Monster
                  </button>
                </>
              )}

              {/* Tower Buildings */}
              {(selectedCategory === 'all' || selectedCategory === 'tower') && (
                <button
                  type="button"
                  onClick={() => setSelectedSubtype('tower')}
                  className={`radar-sub-chip ${selectedSubtype === 'tower' ? 'active' : ''}`}
                >
                  <span>🗼</span> Tower Building
                </button>
              )}
            </div>

            {/* Target Results List */}
            <div className="radar-results-list">
              {filteredTargets.length === 0 ? (
                <div
                  style={{
                    padding: '24px 12px',
                    textAlign: 'center',
                    color: '#7f93a3',
                    fontSize: '11px',
                  }}
                >
                  <span style={{ fontSize: '24px', display: 'block', marginBottom: '6px' }}>🔭</span>
                  No targets found for current radar filters.
                </div>
              ) : (
                filteredTargets.slice(0, 25).map((obj) => {
                  const dist = calculateDistance(obj.position);
                  const isMonster = obj.type === 'monster';

                  return (
                    <div
                      key={obj.id}
                      className={`radar-target-card ${isMonster ? 'monster-card' : 'resource-card'}`}
                    >
                      <div className="radar-target-avatar">
                        <span>{getSubtypeIcon(obj)}</span>
                      </div>

                      <div className="radar-target-meta">
                        <div className="radar-target-top">
                          <span className="radar-target-name">{obj.name}</span>
                          <span className={`radar-level-badge ${obj.level === 5 ? 'l5' : ''}`}>
                            Lv.{obj.level || 1}
                          </span>
                        </div>

                        <div className="radar-target-details">
                          <span>📍 {dist}m</span>
                          <span>
                            {isMonster
                              ? `❤️ ${obj.health ?? 100} HP`
                              : `📦 +${obj.yieldAmount || 250}`}
                          </span>
                        </div>
                      </div>

                      <div className="radar-target-actions">
                        <button
                          type="button"
                          onClick={() => onSelectAndLocate(obj)}
                          className="btn-radar-locate"
                          title="Center camera on target"
                        >
                          Locate
                        </button>

                        {isMonster ? (
                          <button
                            type="button"
                            onClick={() => onQuickDispatch && onQuickDispatch(obj, 'attack')}
                            className="btn-radar-strike"
                            title="Deploy Vanguard Assault"
                          >
                            ⚔️ Attack
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onQuickDispatch && onQuickDispatch(obj, 'gather')}
                            className="btn-radar-gather"
                            title="Deploy Workforce Mining"
                          >
                            ⛏️ Mine
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
