import React, { useState } from 'react';
import { InteractiveObject } from '../types/game';

interface AllianceRallyModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: InteractiveObject | null;
  onConfirmRally: (rallyData: { totalPower: number; captains: string[] }) => void;
}

export const AllianceRallyModal: React.FC<AllianceRallyModalProps> = ({
  isOpen,
  onClose,
  target,
  onConfirmRally,
}) => {
  const [selectedCaptains, setSelectedCaptains] = useState<string[]>([
    'Subedar Thapa',
    'Captain Rana',
    'Ranger Gurung',
  ]);
  const [rallyTimerOption, setRallyTimerOption] = useState<'instant' | '30s'>('instant');

  if (!isOpen || !target) return null;

  const isTower = target.subtype === 'tower' || target.type === 'fort' || target.type === 'citadel';
  const isYeti = target.subtype === 'yeti';
  const targetName = target.name || 'Highland Target';
  const targetLevel = target.level || 5;
  const targetHp = target.health || (target.maxHealth || 650);

  const toggleCaptain = (name: string) => {
    setSelectedCaptains((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  const basePower = 1250;
  const captainBonus = selectedCaptains.length * 680;
  const totalRallyPower = basePower + captainBonus;

  const handleLaunch = () => {
    onConfirmRally({
      totalPower: totalRallyPower,
      captains: selectedCaptains,
    });
    onClose();
  };

  return (
    <div
      className="radial-dial-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-window modal-rally">
        {/* Header */}
        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #2b1810, #171110)', borderBottom: '1.5px solid #d97706' }}>
          <div className="modal-title">
            <span style={{ fontSize: '26px', filter: 'drop-shadow(0 2px 6px rgba(245, 158, 11, 0.6))' }}>
              {isTower ? '🗼' : isYeti ? '❄️' : '🚩'}
            </span>
            <div>
              <h3 style={{ color: '#fed7aa', margin: 0, fontFamily: 'Cinzel, Georgia, serif', letterSpacing: '0.8px' }}>
                {isTower ? 'Alliance Siege Rally · Tower Building' : 'Alliance War Rally · High-Level Beast'}
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1' }}>
                Assemble Allied Vanguard Captains for Massive Synchronized Assault
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} style={{ color: '#fbcfe8' }}>
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#0f172a' }}>
          {/* Target Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #1e293b, #0f172a)',
              border: '1px solid #d97706',
              boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: '#991b1b',
                    color: '#fee2e2',
                    fontSize: '9px',
                    fontWeight: 800,
                    fontFamily: 'Barlow Condensed',
                    letterSpacing: '0.8px',
                  }}
                >
                  {isTower ? 'FORTIFIED TOWER' : 'HIGH-LEVEL MONSTER'}
                </span>
                <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700 }}>
                  LVL {targetLevel}
                </span>
              </div>
              <h2 style={{ margin: '4px 0 2px', fontSize: '16px', color: '#f8fafc', fontFamily: 'Cinzel, serif' }}>
                {targetName}
              </h2>
              <small style={{ color: '#94a3b8', fontSize: '11px' }}>
                Estimated HP: <b style={{ color: '#ef4444' }}>{targetHp} HP</b> · Coordinate: ({target.position[0]}, {target.position[2]})
              </small>
            </div>

            <div style={{ textAlign: 'right' }}>
              <small style={{ display: 'block', fontSize: '9px', color: '#94a3b8', letterSpacing: '0.5px' }}>
                COMBINED RALLY AURA
              </small>
              <b style={{ fontSize: '18px', color: '#f59e0b', fontFamily: 'Barlow Condensed' }}>
                +{selectedCaptains.length * 30 + 50}% POW
              </b>
            </div>
          </div>

          {/* Allied Captains Roster */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.8px', fontFamily: 'Barlow Condensed' }}>
                ALLIANCE CAPTAINS JOINING RALLY ({selectedCaptains.length}/3)
              </span>
              <span style={{ fontSize: '10px', color: '#38bdf8' }}>
                ★ Full Alliance Horn Active
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                { name: 'Subedar Thapa', role: 'Vanguard Infantry', count: '+120 Troops', icon: '🛡️', pwr: '+680' },
                { name: 'Captain Rana', role: 'Highland Cavalry', count: '+60 Mounts', icon: '🏇', pwr: '+680' },
                { name: 'Ranger Gurung', role: 'Mountain Archers', count: '+80 Bows', icon: '🏹', pwr: '+680' },
              ].map((cap) => {
                const active = selectedCaptains.includes(cap.name);
                return (
                  <div
                    key={cap.name}
                    onClick={() => toggleCaptain(cap.name)}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      background: active
                        ? 'linear-gradient(135deg, #1e3a5f, #0f2744)'
                        : 'linear-gradient(135deg, #1e293b, #0f172a)',
                      border: active ? '1.5px solid #38bdf8' : '1px solid #334155',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: active ? '0 0 12px rgba(56, 189, 248, 0.35)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '18px' }}>{cap.icon}</span>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          padding: '2px 5px',
                          borderRadius: '3px',
                          background: active ? '#0284c7' : '#334155',
                          color: '#fff',
                        }}
                      >
                        {active ? 'READY' : 'OFFLINE'}
                      </span>
                    </div>
                    <b style={{ display: 'block', fontSize: '12px', color: '#f8fafc', marginTop: '6px' }}>
                      {cap.name}
                    </b>
                    <small style={{ display: 'block', fontSize: '9px', color: '#94a3b8' }}>
                      {cap.role}
                    </small>
                    <div style={{ marginTop: '4px', fontSize: '10px', fontWeight: 700, color: '#f59e0b' }}>
                      {cap.count} ({cap.pwr} PWR)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rally Launch Options */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: '6px',
              background: '#1e293b',
              border: '1px solid #334155',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>📯</span>
              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Rally Assembly Mode:</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setRallyTimerOption('instant')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: rallyTimerOption === 'instant' ? '#d97706' : '#334155',
                  color: rallyTimerOption === 'instant' ? '#fff' : '#94a3b8',
                  border: 'none',
                }}
              >
                ⚡ Instant Strike
              </button>
              <button
                type="button"
                onClick={() => setRallyTimerOption('30s')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: rallyTimerOption === '30s' ? '#d97706' : '#334155',
                  color: rallyTimerOption === '30s' ? '#fff' : '#94a3b8',
                  border: 'none',
                }}
              >
                ⏱️ 30s Prep
              </button>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={handleLaunch}
              disabled={selectedCaptains.length === 0}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                background:
                  selectedCaptains.length === 0
                    ? '#475569'
                    : 'linear-gradient(135deg, #b45309, #78350f)',
                border: '1.5px solid #fbbf24',
                color: '#fff',
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: '14px',
                fontWeight: 800,
                letterSpacing: '1px',
                cursor: selectedCaptains.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(217, 119, 6, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{isTower ? '🗼' : '🚩'}</span>
              <span>
                {isTower
                  ? `LAUNCH ALLIANCE RALLY TO TOWER (${totalRallyPower} PWR)`
                  : `LAUNCH ALLIANCE RALLY ON ${targetName.toUpperCase()}`}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '12px 18px',
                borderRadius: '8px',
                background: '#1e293b',
                border: '1px solid #475569',
                color: '#cbd5e1',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
