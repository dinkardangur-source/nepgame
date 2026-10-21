import React from 'react';
import { InteractiveObject, Resources } from '../types/game';

interface LogEntry {
  id: string;
  icon: string;
  title: string;
  desc: string;
  time: string;
}

interface RightPanelProps {
  selectedObject: InteractiveObject | null;
  resources: Resources;
  logs: LogEntry[];
  onAttack: () => void;
  onScout: () => void;
  onMine: () => void;
  onOpenBuildings: () => void;
  onUpgradeSelectedBuilding: () => void;
  activeMissionCount: number;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  selectedObject,
  resources,
  logs,
  onAttack,
  onScout,
  onMine,
  onOpenBuildings,
  onUpgradeSelectedBuilding,
  activeMissionCount,
}) => {
  const isMonster = selectedObject?.type === 'monster';
  const isResource = selectedObject?.type === 'resource';
  const isBuilding = selectedObject?.type === 'citadel' || selectedObject?.type === 'fort';

  const emoji = isMonster
    ? (selectedObject.subtype === 'bear' ? '🐻' : selectedObject.subtype === 'rabbit' ? '🐇' : '⚔️')
    : isResource
    ? (selectedObject.subtype === 'wood' ? '♣' : selectedObject.subtype === 'stone' ? '◆' : selectedObject.subtype === 'iron' ? '⬟' : '✦')
    : '🏛️';

  const badgeText = isMonster
    ? 'HOSTILE ENCOUNTER'
    : isResource
    ? 'RESOURCE NODE'
    : isBuilding
    ? 'KINGDOM STRUCTURE'
    : 'TERRITORY SCAN';

  const artworkClass = isMonster ? 'monster-target' : isResource ? 'resource-target' : 'castle-target';

  // Building upgrade calculation
  const buildingLvl = selectedObject?.level || 1;
  const reqWood = Math.floor(200 + buildingLvl * 20);
  const reqStone = Math.floor(220 + buildingLvl * 22);
  const reqIron = Math.floor(150 + buildingLvl * 16);
  const reqFood = Math.floor(180 + buildingLvl * 18);
  const canUpgrade =
    resources.wood >= reqWood &&
    resources.stone >= reqStone &&
    resources.iron >= reqIron &&
    resources.food >= reqFood;

  return (
    <aside className="right-panel panel">
      <div className="panel-heading">
        TARGET INTELLIGENCE <span className="scan-icon">⌕</span>
      </div>

      <div className={`target-artwork ${artworkClass}`}>
        <div className="art-glow"></div>
        <div className="target-emoji">{selectedObject ? emoji : '⌖'}</div>
        <div className="target-badge">{selectedObject ? badgeText : 'SELECT TARGET'}</div>
      </div>

      <div className="target-info">
        <h2>{selectedObject ? selectedObject.name : 'Himalayan Frontier'}</h2>
        <p>
          {selectedObject
            ? selectedObject.description || 'Interactive landmark in the Himalayan kingdom.'
            : 'Select any node, monster, or building across the realm to view tactical intel and issue orders.'}
        </p>

        {selectedObject && (
          <>
            <div className="target-metrics">
              <div>
                <small>LEVEL</small>
                <b>{selectedObject.level < 10 ? `0${selectedObject.level}` : selectedObject.level}</b>
              </div>
              <div>
                <small>GUARD</small>
                <b>{isMonster ? 'Hostile' : isResource ? 'Unprotected' : 'Kingdom Guard'}</b>
              </div>
              <div>
                <small>STATUS</small>
                <b className="status-good">Available</b>
              </div>
            </div>

            <div className="target-quantity">
              <span>{isResource ? 'REMAINING ORE' : 'STRUCTURE / HP'}</span>
              <b>{selectedObject.health || selectedObject.yieldAmount || 1000}</b>
            </div>
            <div className="quantity-track">
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: isMonster ? '#c74a3f' : '#dfba6e',
                }}
              ></div>
            </div>

            {/* Target Actions Box */}
            <div className="target-action-box">
              <div className="target-action-label">TARGET ACTIONS</div>
              <div className="target-action-buttons">
                {isMonster && (
                  <>
                    <button
                      className="btn-target-act btn-act-attack"
                      onClick={onAttack}
                      title="Select troops and commence battle"
                    >
                      <span>⚔️</span>
                      <div>
                        <b>Attack Target</b>
                        <small>Select Troops & Assault</small>
                      </div>
                    </button>
                    <button
                      className="btn-target-act btn-act-scout"
                      onClick={onScout}
                      title="Reconnaissance scout mission"
                    >
                      <span>👁️</span>
                      <div>
                        <b>Scout Threat</b>
                        <small>Recon Intel & Weaknesses</small>
                      </div>
                    </button>
                  </>
                )}

                {isResource && (
                  <button
                    className="btn-target-act btn-act-mine"
                    onClick={onMine}
                    title="Select troops and start mining"
                  >
                    <span>⛏️</span>
                    <div>
                      <b>Mine Resources</b>
                      <small>Select Troops & Gather</small>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Building Upgrade box */}
            {isBuilding && (
              <div className="building-req-box">
                <div className="req-header">
                  <span>UPGRADE ASSET REQUIREMENTS (LVL {buildingLvl + 1})</span>
                  <span className="req-bonus">+{buildingLvl * 150} Power</span>
                </div>
                <div className="req-resources-grid">
                  <div className={`req-pill ${resources.wood >= reqWood ? 'met' : 'unmet'}`}>
                    <span className="resource-icon wood tiny">♣</span>
                    <span>
                      {resources.wood}/{reqWood}
                    </span>
                  </div>
                  <div className={`req-pill ${resources.stone >= reqStone ? 'met' : 'unmet'}`}>
                    <span className="resource-icon stone tiny">◆</span>
                    <span>
                      {resources.stone}/{reqStone}
                    </span>
                  </div>
                  <div className={`req-pill ${resources.iron >= reqIron ? 'met' : 'unmet'}`}>
                    <span className="resource-icon iron tiny">⬟</span>
                    <span>
                      {resources.iron}/{reqIron}
                    </span>
                  </div>
                  <div className={`req-pill ${resources.food >= reqFood ? 'met' : 'unmet'}`}>
                    <span className="resource-icon food tiny">✦</span>
                    <span>
                      {resources.food}/{reqFood}
                    </span>
                  </div>
                </div>

                <button
                  className="btn-upgrade-building"
                  onClick={onUpgradeSelectedBuilding}
                  disabled={!canUpgrade}
                  style={{ opacity: canUpgrade ? 1 : 0.6 }}
                >
                  <span>🔨</span>
                  <b>Upgrade Structure</b>
                  <small>{canUpgrade ? 'Ready to Build' : 'Lacks Resources'}</small>
                </button>

                <div className="req-action-row">
                  <button type="button" className="btn-quick-req-dir" onClick={onOpenBuildings}>
                    🏛️ All Building Req.
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="panel-divider"></div>

      <div className="panel-heading">
        MISSION LOG <span className="tiny-tag">LIVE</span>
      </div>

      <div className="mission-log">
        {logs.map((log) => (
          <div key={log.id} className="log-entry">
            <span className="log-icon">{log.icon}</span>
            <div>
              <b>{log.title}</b>
              <small>{log.desc}</small>
            </div>
            <time>{log.time}</time>
          </div>
        ))}
      </div>

      <div className="panel-divider"></div>

      <div className="panel-heading">REALM STATUS</div>
      <div className="realm-status">
        <div>
          <span>Kingdom stability</span>
          <b className="status-good">Stable</b>
        </div>
        <div>
          <span>World connection</span>
          <b className="status-good">Live React Realm</b>
        </div>
        <div>
          <span>Active missions</span>
          <b>{activeMissionCount}</b>
        </div>
      </div>

      <div className="footer-note">
        HIMALAYAN REALMS <span>REACT STRATEGY PROTOTYPE v1.0</span>
      </div>
    </aside>
  );
};
