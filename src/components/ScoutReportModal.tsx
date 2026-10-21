import React from 'react';
import { InteractiveObject } from '../types/game';

interface ScoutReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: InteractiveObject | null;
  onDeployAssault: () => void;
  onDeployMine?: () => void;
  onLaunchRally?: () => void;
}

export const ScoutReportModal: React.FC<ScoutReportModalProps> = ({
  isOpen,
  onClose,
  target,
  onDeployAssault,
  onDeployMine,
  onLaunchRally,
}) => {
  if (!isOpen || !target) return null;

  const targetLvl = target.level || 1;
  const isMonster = target.type === 'monster';
  const isResource = target.type === 'resource';
  const isTower =
    target.subtype === 'tower' ||
    target.id?.includes('tower') ||
    target.name?.toLowerCase().includes('tower');
  const isBuilding = target.type === 'citadel' || target.type === 'fort' || isTower;

  const targetName = target.name || 'Highland Target';
  const desc = target.description || 'Reconnaissance completed by Magar scout rider.';

  return (
    <div className="radial-dial-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-window modal-scout" style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <div className="modal-title">
            <span className="scout-report-icon">👁️</span>
            <div>
              <h3>Tactical Scout Intelligence Report</h3>
              <p>
                {isMonster
                  ? 'Monster Reconnaissance Completed'
                  : isResource
                  ? 'Resource Deposit Geological Survey'
                  : 'Tower Fortress Reconnaissance'}
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body scout-modal-body">
          <div className="scout-intel-grid">
            {/* Target Card */}
            <div className="scout-target-card">
              <span
                className="scout-badge"
                style={{
                  background: isMonster ? '#7e2920' : isResource ? '#7c622a' : '#1e3a8a',
                }}
              >
                {isMonster
                  ? target.subtype === 'yeti'
                    ? '❄️ HIGH-LEVEL YETI BOSS'
                    : 'HOSTILE MONSTER'
                  : isResource
                  ? 'RESOURCE DEPOSIT'
                  : 'KINGDOM TOWER FORTRESS'}
              </span>
              <h2>{targetName}</h2>
              <p>{desc}</p>
              <div className="scout-metrics">
                <div>
                  <small>TARGET LEVEL</small>
                  <b>Lvl {targetLvl}</b>
                </div>
                <div>
                  <small>{isResource ? 'YIELD CAPACITY' : 'ESTIMATED HP'}</small>
                  <b>
                    {isResource
                      ? `${target.yieldAmount || targetLvl * 250} ${target.resourceType?.toUpperCase() || 'UNITS'}`
                      : `${target.health || (isTower ? 900 : targetLvl * 60)} HP`}
                  </b>
                </div>
                <div>
                  <small>{isResource ? 'PURITY GRADE' : 'DEFENSE RATING'}</small>
                  <b>{isResource ? 'Grade A Superior' : isTower ? 'Heavy Stone Bastion' : 'Hostile Guard'}</b>
                </div>
              </div>
            </div>

            {/* Tactical Intel Summary */}
            <div className="scout-recon-summary">
              {isMonster && (
                <>
                  <div className="recon-bonus-box">
                    <span className="recon-star">★</span>
                    <div>
                      <b>TACTICAL WEAKNESS IDENTIFIED</b>
                      <p>
                        Target vulnerable to concentrated Archer volleys and Khukuri flank charges. Your assault force gains{' '}
                        <b>+30% Damage & Loot Bonus</b>!
                      </p>
                    </div>
                  </div>

                  <div className="recon-loot-box">
                    <small>ESTIMATED BATTLE SPOILS</small>
                    <b>
                      +{targetLvl * 65} Food, +{targetLvl * 35} Iron & Realm Renown
                    </b>
                  </div>
                </>
              )}

              {isResource && (
                <>
                  <div className="recon-bonus-box" style={{ background: '#242114', borderColor: '#bfa048' }}>
                    <span className="recon-star" style={{ color: '#dfba6e' }}>⛏️</span>
                    <div>
                      <b>HIGH-PURITY VEIN DETECTED</b>
                      <p>
                        Soil & ore purity enables rapid extraction. Deploying workers grants a{' '}
                        <b>+30% Gathering Speed & Capacity Bonus</b>!
                      </p>
                    </div>
                  </div>

                  <div className="recon-loot-box" style={{ background: '#1c1b14', borderColor: '#87692b' }}>
                    <small>TOTAL HARVESTABLE YIELD</small>
                    <b style={{ color: '#ffd978' }}>
                      +{target.yieldAmount || targetLvl * 250} Units of {target.subtype?.toUpperCase() || 'ASSETS'}
                    </b>
                  </div>
                </>
              )}

              {isBuilding && (
                <>
                  <div className="recon-bonus-box" style={{ background: '#152538', borderColor: '#38bdf8' }}>
                    <span className="recon-star" style={{ color: '#38bdf8' }}>🗼</span>
                    <div>
                      <b>TOWER FORTRESS BATTLEMENTS</b>
                      <p>
                        Heavily fortified garrison walls. High-level tower structure susceptible to coordinated Alliance Rally or siege assault!
                      </p>
                    </div>
                  </div>

                  <div className="recon-loot-box" style={{ background: '#121e2c', borderColor: '#1e3a5f' }}>
                    <small>TERRITORY CONTROL & LOOT</small>
                    <b style={{ color: '#38bdf8' }}>
                      Strategic High-Ground Aura + Territory Dominance
                    </b>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="modal-actions-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
            {isMonster && (
              <>
                <button
                  className="btn-primary-dispatch"
                  onClick={() => {
                    onClose();
                    onDeployAssault();
                  }}
                >
                  <span>⚔️</span>
                  <b>Deploy Assault Squad (+30% DMG)</b>
                </button>

                {(targetLvl >= 3 || target.subtype === 'yeti') && onLaunchRally && (
                  <button
                    className="btn-primary-dispatch"
                    style={{ background: 'linear-gradient(135deg, #d97706, #78350f)', borderColor: '#fbbf24' }}
                    onClick={() => {
                      onClose();
                      onLaunchRally();
                    }}
                  >
                    <span>🚩</span>
                    <b>Assemble Alliance Rally</b>
                  </button>
                )}
              </>
            )}

            {isResource && (
              <button
                className="btn-primary-dispatch mine-mode"
                onClick={() => {
                  onClose();
                  if (onDeployMine) onDeployMine();
                  else onDeployAssault();
                }}
              >
                <span>⛏️</span>
                <b>Deploy Mining Workforce (+30% Yield)</b>
              </button>
            )}

            {isBuilding && (
              <>
                {onLaunchRally && (
                  <button
                    className="btn-primary-dispatch"
                    style={{ background: 'linear-gradient(135deg, #d97706, #78350f)', borderColor: '#fbbf24' }}
                    onClick={() => {
                      onClose();
                      onLaunchRally();
                    }}
                  >
                    <span>🚩</span>
                    <b>Rally to Tower Building</b>
                  </button>
                )}
                <button
                  className="btn-primary-dispatch"
                  onClick={() => {
                    onClose();
                    onDeployAssault();
                  }}
                >
                  <span>⚔️</span>
                  <b>Assault Tower</b>
                </button>
              </>
            )}

            <button className="btn-secondary-action" onClick={onClose}>
              <span>✓</span>
              <b>Close Recon Report</b>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
