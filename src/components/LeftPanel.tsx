import React from 'react';
import { UnitCounts, ArmyState, TrainingQueueItem, Province } from '../types/game';

interface LeftPanelProps {
  provinces: Record<string, Province>;
  currentProvince: string;
  onSelectProvince: (provId: string) => void;
  units: UnitCounts;
  armyHealth: number;
  armyPower: number;
  armyState: ArmyState;
  missionDesc: string;
  missionProgress: number;
  missionTimerText: string;
  trainingQueue: TrainingQueueItem[];
  onTrainUnit: (unit: 'infantry' | 'cavalry' | 'archer', count: number) => void;
  onRecallArmy: () => void;
  onOpenBuildings: () => void;
  onOpenImageStudio: () => void;
  armyPortraitUrl: string;
  onMarchToTarget: () => void;
  onGatherTarget: () => void;
  onAttackTarget: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  provinces,
  currentProvince,
  onSelectProvince,
  units,
  armyHealth,
  armyPower,
  armyState,
  missionDesc,
  missionProgress,
  missionTimerText,
  trainingQueue,
  onTrainUnit,
  onRecallArmy,
  onOpenBuildings,
  onOpenImageStudio,
  armyPortraitUrl,
  onMarchToTarget,
  onGatherTarget,
  onAttackTarget,
}) => {
  const currentTraining = trainingQueue[0];

  return (
    <aside className="left-panel panel">
      <div className="panel-heading">
        <span>WORLD ATLAS · MAINLAND KINGDOM</span>
        <span className="live-dot"></span>
      </div>

      <div className="kingdom-list">
        {Object.values(provinces).map((p) => (
          <button
            key={p.id}
            className={`kingdom ${currentProvince === p.id ? 'active' : ''}`}
            onClick={() => onSelectProvince(p.id)}
            title={`Focus ${p.name}`}
          >
            <span className={`kingdom-art ${p.id}-art`}>{p.icon}</span>
            <span className="kingdom-copy">
              <b>{p.name}</b>
              <small>{p.subtitle}</small>
            </span>
            <span className="chevron">›</span>
          </button>
        ))}
      </div>

      <div className="panel-divider"></div>

      <div className="panel-heading">
        SELECTED ARMY <span className="tiny-tag">A-01</span>
      </div>

      <div className="army-card">
        <div
          className="army-portrait"
          id="armyPortraitBox"
          title="Click to view/edit Magar Infantry character design"
          onClick={onOpenImageStudio}
          style={{ cursor: 'pointer' }}
        >
          <img
            id="armyPortraitImg"
            src={armyPortraitUrl}
            alt="Magar Infantry"
            onError={(e) => {
              // fallback if local file path issue
              (e.currentTarget as HTMLImageElement).src =
                '/assets/images/magar_infantry_tpose.jpg';
            }}
          />
        </div>
        <div className="army-details">
          <b>Magar Vanguard</b>
          <small>Level 1 Himalayan Infantry</small>
          <div className="power" id="armyPower">
            ✦ {armyPower.toLocaleString()} POWER
          </div>
        </div>
      </div>

      <div className="army-stats">
        <div>
          <small>INFANTRY</small>
          <b>{units.infantry}</b>
        </div>
        <div>
          <small>CAVALRY</small>
          <b>{units.cavalry}</b>
        </div>
        <div>
          <small>ARCHERS</small>
          <b>{units.archer}</b>
        </div>
      </div>

      <div className="health-label">
        <span>ARMY HEALTH</span>
        <b>{Math.round(armyHealth)}%</b>
      </div>
      <div className="health-track">
        <div
          className="health-fill"
          style={{
            width: `${Math.max(0, Math.min(100, armyHealth))}%`,
            background:
              armyHealth > 50 ? '#54b870' : armyHealth > 25 ? '#e09838' : '#d64538',
          }}
        ></div>
      </div>

      <div className="mission-box">
        <div className="mission-top">
          <span
            className="status-pip"
            style={{
              background:
                armyState === 'IDLE'
                  ? '#34d399'
                  : armyState === 'ATTACKING'
                  ? '#ef4444'
                  : '#f59e0b',
            }}
          ></span>
          <b>{armyState}</b>
        </div>
        <p>{missionDesc}</p>
        <div className="mission-progress">
          <div
            style={{
              width: `${Math.max(0, Math.min(100, missionProgress))}%`,
              height: '100%',
              background: '#dfba6e',
              transition: 'width 0.2s',
            }}
          ></div>
        </div>
        <small>{missionTimerText}</small>
      </div>

      <div className="panel-divider"></div>

      <div className="panel-heading">
        ARMY ORDERS <span className="command-hint">TACTICAL</span>
      </div>

      <button className="command primary" onClick={onMarchToTarget}>
        <span>➤</span>
        <span>
          <b>March to Target</b>
          <small>Move force to selected coordinates</small>
        </span>
        <kbd>M</kbd>
      </button>

      <button className="command" onClick={onGatherTarget}>
        <span>⛏</span>
        <span>
          <b>Gather Resources</b>
          <small>Work at selected resource node</small>
        </span>
        <kbd>G</kbd>
      </button>

      <button className="command" onClick={onAttackTarget}>
        <span>⚔</span>
        <span>
          <b>Attack Target</b>
          <small>Engage monster, enemy, or outpost</small>
        </span>
        <kbd>A</kbd>
      </button>

      <button className="command" onClick={onRecallArmy}>
        <span>↶</span>
        <span>
          <b>Recall Army to Citadel</b>
          <small>Rally force back at home base</small>
        </span>
        <kbd>R</kbd>
      </button>

      <button className="command bldg-command" onClick={onOpenBuildings}>
        <span>🏛️</span>
        <span>
          <b>Kingdom Architecture</b>
          <small>Asset requirements & blueprints</small>
        </span>
        <kbd>B</kbd>
      </button>

      <div className="command-tactical-note">
        <small>⚔️ Click any monster for <b>Attack & Scout</b></small>
        <small>⛏️ Click any resource node to <b>Mine</b></small>
      </div>

      <div className="panel-divider"></div>

      <div className="panel-heading">
        TRAIN RECRUITS <span className="tiny-tag">CITADEL BARRACKS</span>
      </div>

      <div className="train-panel">
        <div className="train-item">
          <div className="train-info">
            <span className="train-badge infantry-badge">⚔</span>
            <div>
              <b>Magar Infantry</b>
              <small>Sword Slash · 60 ✦ Food, 30 ⬟ Iron</small>
            </div>
          </div>
          <div className="train-actions">
            <button className="btn-train" onClick={() => onTrainUnit('infantry', 1)}>
              +1
            </button>
            <button className="btn-train" onClick={() => onTrainUnit('infantry', 5)}>
              +5
            </button>
          </div>
        </div>

        <div className="train-item">
          <div className="train-info">
            <span className="train-badge cavalry-badge">🏇</span>
            <div>
              <b>Mountain Cavalry</b>
              <small>Spear Thrust · 120 ✦ Food, 75 ⬟ Iron</small>
            </div>
          </div>
          <div className="train-actions">
            <button className="btn-train" onClick={() => onTrainUnit('cavalry', 1)}>
              +1
            </button>
            <button className="btn-train" onClick={() => onTrainUnit('cavalry', 5)}>
              +5
            </button>
          </div>
        </div>

        <div className="train-item">
          <div className="train-info">
            <span className="train-badge archer-badge">🏹</span>
            <div>
              <b>Himalayan Archer</b>
              <small>Bow Volley · 80 ✦ Food, 45 ♣ Wood</small>
            </div>
          </div>
          <div className="train-actions">
            <button className="btn-train" onClick={() => onTrainUnit('archer', 1)}>
              +1
            </button>
            <button className="btn-train" onClick={() => onTrainUnit('archer', 5)}>
              +5
            </button>
          </div>
        </div>

        {trainingQueue.length > 0 && currentTraining && (
          <div className="training-queue-box">
            <div className="queue-status-line">
              <span className="queue-spinner"></span>
              <span>Training {currentTraining.name} (+{currentTraining.count})…</span>
              <b>{Math.ceil(currentTraining.timeRemaining)}s</b>
            </div>
            <div className="queue-progress-track">
              <div
                className="queue-progress-fill"
                style={{
                  width: `${(1 - currentTraining.timeRemaining / currentTraining.totalTime) * 100}%`,
                }}
              ></div>
            </div>
            {trainingQueue.length > 1 && (
              <div className="queue-pending-list">
                <small>Queued: {trainingQueue.slice(1).map(q => `${q.name} (+${q.count})`).join(', ')}</small>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
