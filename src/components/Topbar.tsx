import React from 'react';
import { Resources } from '../types/game';

interface TopbarProps {
  resources: Resources;
  onOpenBuildings: () => void;
  onOpenImageStudio: () => void;
  onOpenVeo: () => void;
  onToggleFullscreen: () => void;
  readyUpgradesCount: number;
}

export const Topbar: React.FC<TopbarProps> = ({
  resources,
  onOpenBuildings,
  onOpenImageStudio,
  onOpenVeo,
  onToggleFullscreen,
  readyUpgradesCount,
}) => {
  return (
    <header className="topbar">
      <div className="brand-mark">HR</div>
      <div className="brand-copy">
        <div className="eyebrow">REALM COMMAND</div>
        <h1>Himalayan Realms</h1>
      </div>

      <div className="top-resources">
        <div className="resource">
          <span className="resource-icon wood">♣</span>
          <span>
            <b>{resources.wood.toLocaleString()}</b>
            <small>WOOD</small>
          </span>
        </div>
        <div className="resource">
          <span className="resource-icon stone">◆</span>
          <span>
            <b>{resources.stone.toLocaleString()}</b>
            <small>STONE</small>
          </span>
        </div>
        <div className="resource">
          <span className="resource-icon iron">⬟</span>
          <span>
            <b>{resources.iron.toLocaleString()}</b>
            <small>IRON</small>
          </span>
        </div>
        <div className="resource">
          <span className="resource-icon food">✦</span>
          <span>
            <b>{resources.food.toLocaleString()}</b>
            <small>FOOD</small>
          </span>
        </div>
      </div>

      <div className="topbar-actions">
        <button
          className="topbar-btn bldg-btn"
          onClick={onOpenBuildings}
          title="Inspect all kingdom building asset requirements, manage upgrades, and construct blueprints"
        >
          <span className="veo-icon">🏛️</span>
          <span className="veo-text">
            <b>Building Asset Requirements</b>
            <small>Upgrades & Blueprints</small>
          </span>
          <span
            className="badge-req"
            style={{
              background:
                readyUpgradesCount > 0
                  ? 'linear-gradient(135deg,#286e42,#174427)'
                  : 'linear-gradient(135deg,#4a3a24,#2b2114)',
            }}
          >
            {readyUpgradesCount > 0 ? `${readyUpgradesCount} READY` : 'REQUIREMENTS'}
          </span>
        </button>

        <button
          className="topbar-btn art-btn"
          onClick={onOpenImageStudio}
          title="Create & Edit 3D character art and realm imagery using gemini-nano-banana-2.1"
        >
          <span className="veo-icon">🎨</span>
          <span className="veo-text">
            <b>Create & Edit Art</b>
            <small>Nano Banana 2.1</small>
          </span>
          <span className="badge-ai">AI ART</span>
        </button>

        <button
          className="topbar-btn veo-btn"
          onClick={onOpenVeo}
          title="Animate realm photos into video using Veo 3.1"
        >
          <span className="veo-icon">🎥</span>
          <span className="veo-text">
            <b>Animate Video</b>
            <small>Veo 3.1 Fast</small>
          </span>
          <span className="badge-veo">VEO</span>
        </button>

        <button
          className="topbar-btn fs-btn"
          onClick={onToggleFullscreen}
          title="Expand Game Mainland to Fullscreen [F]"
        >
          <span className="veo-icon">⛶</span>
          <span className="veo-text">
            <b>Fullscreen Realm</b>
            <small>Expanded Mainland</small>
          </span>
        </button>
      </div>

      <div className="profile">
        <div className="profile-avatar">⚔</div>
        <div>
          <b>Lord Dangol</b>
          <small>LEVEL 18 · VIP 3</small>
        </div>
        <span className="online-dot"></span>
      </div>
    </header>
  );
};
