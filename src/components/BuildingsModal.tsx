import React, { useState } from 'react';
import { KingdomBuilding, Blueprint, Resources } from '../types/game';

interface BuildingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildings: KingdomBuilding[];
  blueprints: Blueprint[];
  resources: Resources;
  onUpgradeBuilding: (buildingId: string) => void;
  onConstructBlueprint: (blueprintId: string) => void;
}

export const BuildingsModal: React.FC<BuildingsModalProps> = ({
  isOpen,
  onClose,
  buildings,
  blueprints,
  resources,
  onUpgradeBuilding,
  onConstructBlueprint,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'blueprints'>('overview');

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="bldg-modal-window">
        <div className="bldg-modal-header">
          <div className="bldg-modal-title">
            <span style={{ fontSize: '24px' }}>🏛️</span>
            <div>
              <h3>Kingdom Architecture & Asset Requirements</h3>
              <p>
                Manage structure tiers, verify Wood, Stone, Iron & Food asset requirements, and construct
                blueprints
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="bldg-tabs">
              <button
                type="button"
                className={`bldg-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Structures & Upgrades
              </button>
              <button
                type="button"
                className={`bldg-tab-btn ${activeTab === 'blueprints' ? 'active' : ''}`}
                onClick={() => setActiveTab('blueprints')}
              >
                Construct Blueprints
              </button>
            </div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>
        </div>

        <div className="bldg-modal-body">
          <div className="bldg-summary-bar">
            <div>
              <b>Kingdom Treasury & Assets Available:</b>
            </div>
            <div className="bldg-summary-res">
              <span>♣ {resources.wood.toLocaleString()} Wood</span>
              <span>◆ {resources.stone.toLocaleString()} Stone</span>
              <span>⬟ {resources.iron.toLocaleString()} Iron</span>
              <span>✦ {resources.food.toLocaleString()} Food</span>
              <span style={{ color: '#dfba6e' }}>🏛️ {buildings.length} Structures</span>
            </div>
          </div>

          {activeTab === 'overview' && (
            <div className="buildings-grid">
              {buildings.map((b) => {
                const hasWood = resources.wood >= b.cost.wood;
                const hasStone = resources.stone >= b.cost.stone;
                const hasIron = resources.iron >= b.cost.iron;
                const hasFood = resources.food >= b.cost.food;
                const canUpgrade = hasWood && hasStone && hasIron && hasFood && b.level < b.maxLevel;

                return (
                  <div key={b.id} className="bldg-card">
                    <div className="bldg-card-top">
                      <div className="bldg-card-icon">{b.icon}</div>
                      <div className="bldg-card-title">
                        <b>{b.name}</b>
                        <small>{b.tag} Structure</small>
                      </div>
                      <span className="bldg-level-pill">
                        LVL {b.level}/{b.maxLevel}
                      </span>
                    </div>

                    <p className="bldg-card-desc">{b.description}</p>

                    <div className="bldg-yield-badge">
                      <span>✦ Yield:</span> <b>{b.passiveAmount}</b>
                    </div>

                    <div className="bldg-req-details">
                      <div className="bldg-req-title">
                        <span>UPGRADE ASSET REQUIREMENTS (LVL {b.level + 1})</span>
                      </div>
                      <div className="bldg-req-grid">
                        <div className={`bldg-req-item ${hasWood ? 'met' : 'unmet'}`}>
                          <span>♣</span>
                          <span>
                            Wood: {resources.wood}/{b.cost.wood}
                          </span>
                        </div>
                        <div className={`bldg-req-item ${hasStone ? 'met' : 'unmet'}`}>
                          <span>◆</span>
                          <span>
                            Stone: {resources.stone}/{b.cost.stone}
                          </span>
                        </div>
                        <div className={`bldg-req-item ${hasIron ? 'met' : 'unmet'}`}>
                          <span>⬟</span>
                          <span>
                            Iron: {resources.iron}/{b.cost.iron}
                          </span>
                        </div>
                        <div className={`bldg-req-item ${hasFood ? 'met' : 'unmet'}`}>
                          <span>✦</span>
                          <span>
                            Food: {resources.food}/{b.cost.food}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn-upgrade-card"
                      disabled={!canUpgrade}
                      onClick={() => onUpgradeBuilding(b.id)}
                      style={{ opacity: canUpgrade ? 1 : 0.6 }}
                    >
                      {canUpgrade ? '🔨 Upgrade Structure' : 'Assets Insufficient'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'blueprints' && (
            <div className="blueprints-grid">
              {blueprints.map((bp) => {
                const hasWood = resources.wood >= bp.cost.wood;
                const hasStone = resources.stone >= bp.cost.stone;
                const hasIron = resources.iron >= bp.cost.iron;
                const hasFood = resources.food >= bp.cost.food;
                const canConstruct = hasWood && hasStone && hasIron && hasFood && !bp.constructed;

                return (
                  <div key={bp.id} className="blueprint-card">
                    <div className="bp-header">
                      <div className="bp-icon">{bp.icon}</div>
                      <div className="bp-info">
                        <b>{bp.name}</b>
                        <small>{bp.category} Structure</small>
                      </div>
                      <span className="bp-yield">{bp.benefit}</span>
                    </div>

                    <p className="bp-desc">{bp.description}</p>

                    <div className="bldg-req-details">
                      <div className="bldg-req-title">
                        <span>CONSTRUCTION ASSET REQUIREMENTS</span>
                      </div>
                      <div className="bldg-req-grid">
                        <div className={`bldg-req-item ${hasWood ? 'met' : 'unmet'}`}>
                          <span>♣</span>
                          <span>
                            Wood: {resources.wood}/{bp.cost.wood}
                          </span>
                        </div>
                        <div className={`bldg-req-item ${hasStone ? 'met' : 'unmet'}`}>
                          <span>◆</span>
                          <span>
                            Stone: {resources.stone}/{bp.cost.stone}
                          </span>
                        </div>
                        <div className={`bldg-req-item ${hasIron ? 'met' : 'unmet'}`}>
                          <span>⬟</span>
                          <span>
                            Iron: {resources.iron}/{bp.cost.iron}
                          </span>
                        </div>
                        <div className={`bldg-req-item ${hasFood ? 'met' : 'unmet'}`}>
                          <span>✦</span>
                          <span>
                            Food: {resources.food}/{bp.cost.food}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn-upgrade-card"
                      disabled={!canConstruct}
                      onClick={() => onConstructBlueprint(bp.id)}
                      style={{
                        opacity: bp.constructed ? 0.7 : canConstruct ? 1 : 0.6,
                        background: bp.constructed
                          ? 'linear-gradient(135deg,#2e4537,#1b2b22)'
                          : undefined,
                      }}
                    >
                      {bp.constructed ? '✓ Constructed' : canConstruct ? '🏗️ Construct Blueprint' : 'Assets Insufficient'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
