import React, { useState } from 'react';
import { Resources } from '../types/game';

interface GamerProfileAccountProps {
  username?: string;
  email?: string;
  avatarUrl?: string;
  level?: number;
  vipLevel?: number;
  power?: number;
  resources: Resources;
  onOpenBuildings?: () => void;
  onAddToast?: (msg: string) => void;
}

export const GamerProfileAccount: React.FC<GamerProfileAccountProps> = ({
  username = 'Commander Dinkar',
  email = 'dinkardangur@gmail.com',
  avatarUrl = '/assets/images/magar_infantry_tpose.jpg',
  level = 18,
  vipLevel = 6,
  power = 48500,
  resources,
  onOpenBuildings,
  onAddToast,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* FLOATING GAMER USER PROFILE ACCOUNT IN UPPER LEFT CORNER */}
      <div className="gamer-profile-corner upper-left">
        <div
          className="gamer-profile-card"
          onClick={() => setIsModalOpen(true)}
          title="Click to view Commander Profile & Account Details"
        >
          {/* Avatar Ring */}
          <div className="gamer-avatar-wrap">
            <img
              src={avatarUrl}
              alt={username}
              className="gamer-avatar-img"
              onError={(e) => {
                // Fallback to stylized warrior avatar icon
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span className="gamer-avatar-fallback">👑</span>
            <span className="gamer-vip-badge">VIP {vipLevel}</span>
            <span className="gamer-online-dot" title="Account Status: Online & Connected"></span>
          </div>

          {/* User & Title Info */}
          <div className="gamer-identity">
            <div className="gamer-name-row">
              <span className="gamer-username">{username}</span>
              <span className="gamer-lvl-tag">Lv.{level}</span>
            </div>
            <div className="gamer-sub-row">
              <span className="gamer-title">Magar Vanguard Lord</span>
              <span className="gamer-power-chip">⚔️ {power.toLocaleString()}</span>
            </div>
          </div>

          {/* Quick HUD Resource Mini-Pills */}
          <div className="gamer-resources-strip" onClick={(e) => e.stopPropagation()}>
            <div className="g-res-item" title="Wood Stockpile">
              <span className="g-res-icon wood">♣</span>
              <span className="g-res-val">{resources.wood.toLocaleString()}</span>
            </div>
            <div className="g-res-item" title="Stone Stockpile">
              <span className="g-res-icon stone">◆</span>
              <span className="g-res-val">{resources.stone.toLocaleString()}</span>
            </div>
            <div className="g-res-item" title="Iron Stockpile">
              <span className="g-res-icon iron">⬟</span>
              <span className="g-res-val">{resources.iron.toLocaleString()}</span>
            </div>
            <div className="g-res-item" title="Food Stockpile">
              <span className="g-res-icon food">✦</span>
              <span className="g-res-val">{resources.food.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* DETAILED COMMANDER USER ACCOUNT MODAL */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="gamer-account-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="gam-modal-header">
              <div className="gam-modal-title">
                <span className="gam-icon">🎖️</span>
                <div>
                  <h3>Commander Account Dossier</h3>
                  <p>HIMALAYAN REALM #101 · UNIFIED GREATER KINGDOM</p>
                </div>
              </div>
              <button
                className="btn-modal-close"
                onClick={() => setIsModalOpen(false)}
                title="Close Profile"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="gam-modal-body">
              {/* Profile Card Banner */}
              <div className="gam-hero-strip">
                <div className="gam-hero-avatar">
                  <span className="gam-large-crown">👑</span>
                  <span className="gam-vip-ribbon">VIP {vipLevel}</span>
                </div>
                <div className="gam-hero-info">
                  <div className="gam-hero-top">
                    <h4>{username}</h4>
                    <span className="gam-status-badge">🟢 ONLINE</span>
                  </div>
                  <p className="gam-email-line">{email}</p>
                  <p className="gam-citadel-desc">
                    Supreme Commander of the Gorkha Citadel Keep · Magar Vanguard Battalion
                  </p>
                </div>
                <div className="gam-power-box">
                  <small>TOTAL COMBAT POWER</small>
                  <b>⚔️ {power.toLocaleString()}</b>
                  <span>Realm Rank #1</span>
                </div>
              </div>

              {/* Combat & Domain Stats Grid */}
              <div className="gam-stats-grid">
                <div className="gam-stat-card">
                  <small>CITADEL LEVEL</small>
                  <b>Lv. {level}</b>
                  <span>Highland Fortress</span>
                </div>
                <div className="gam-stat-card">
                  <small>VANGUARD TROOPS</small>
                  <b>15 / 15</b>
                  <span>Ready at Citadel Gate</span>
                </div>
                <div className="gam-stat-card">
                  <small>BATTLES WON</small>
                  <b>28</b>
                  <span>0 Defeats Recorded</span>
                </div>
                <div className="gam-stat-card">
                  <small>YETI BOSS CLEARS</small>
                  <b>5</b>
                  <span>Northern Glaciers</span>
                </div>
              </div>

              {/* Active Realm Perks */}
              <div className="gam-perks-section">
                <h5>Active Commander Blessings & Buffs</h5>
                <div className="gam-perks-list">
                  <div className="gam-perk-item">
                    <span>⚡</span>
                    <div>
                      <b>Vanguard Rapid March</b>
                      <small>+15% overland battalion movement speed across mountain terrain</small>
                    </div>
                  </div>
                  <div className="gam-perk-item">
                    <span>⛏️</span>
                    <div>
                      <b>Highland Prospector</b>
                      <small>+20% bonus resource yield from Gold, Wood, Stone & Farm deposits</small>
                    </div>
                  </div>
                  <div className="gam-perk-item">
                    <span>☀️</span>
                    <div>
                      <b>Clear Atmospheric Skies</b>
                      <small>Permanent sunshine across realm: 100% visibility & full combat morale</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="gam-modal-actions">
                {onOpenBuildings && (
                  <button
                    className="btn-gam-action primary"
                    onClick={() => {
                      setIsModalOpen(false);
                      onOpenBuildings();
                    }}
                  >
                    <span>🏛️</span>
                    <span>Kingdom Buildings & Blueprints [B]</span>
                  </button>
                )}
                <button
                  className="btn-gam-action secondary"
                  onClick={() => {
                    onAddToast?.('Commander Profile synchronized with Kingdom Records.');
                    setIsModalOpen(false);
                  }}
                >
                  Confirm & Return to Realm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
