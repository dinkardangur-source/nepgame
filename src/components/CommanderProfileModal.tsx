import React, { useMemo, useState } from 'react';
import { getHeroPortraitUrl } from '../game/HeroPortraits';
import {
  CalculatedBonuses,
  getHeroById,
  InfantryGearState,
  NEPALESE_HEROES,
  NepaleseHeroConfig,
  PlayerAllianceIdentity,
  TroopInventory,
} from '../game/NepaleseBalanceConfig';
import { CastleSpawnData } from '../game/WorldCoordinates';
import type { CommandHubTab } from './CommandHubDrawer';
import { Profile3DBadge, Profile3DCrestViewport } from './Profile3DEmblems';
import type { Profile3DIconKey } from '../game/Profile3DModels';
import { useAuth } from '../context/AuthContext';

type ProfileTopTab = 'profile' | 'kingdom' | 'nft' | 'account' | 'option';
type ProfileFooterPanel = 'none' | 'history' | 'mastery' | 'ranking';

interface CommanderProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  commanderName: string;
  onChangeCommanderName: (nextName: string) => void;
  vipLevel: number;
  commanderLevel: number;
  standingPower: number;
  actionPoints: number;
  maxActionPoints: number;
  onReplenishActionPoints: () => void;
  selectedHeroId: string;
  onSelectHeroId: (heroId: string) => void;
  playerAlliance: PlayerAllianceIdentity;
  shrinesHeldCount: number;
  hasCongress: boolean;
  battleReportsCount: number;
  troopInventory: TroopInventory;
  castles: CastleSpawnData[];
  bonuses: CalculatedBonuses;
  infantryGear?: InfantryGearState;
  isStrategicFilterActive: boolean;
  onToggleStrategicFilter: (enabled: boolean) => void;
  viewMode: 'world' | 'kingdom';
  onToggleViewMode: () => void;
  onOpenStrategicWorldMap: () => void;
  onOpenAlliance: () => void;
  onOpenAchievements: () => void;
  onOpenInventory: () => void;
  onOpenCommandHub: (tab: CommandHubTab) => void;
  onShowToast?: (msg: string) => void;
}

export const CommanderProfileModal: React.FC<CommanderProfileModalProps> = ({
  isOpen,
  onClose,
  commanderName,
  onChangeCommanderName,
  vipLevel,
  commanderLevel,
  standingPower,
  actionPoints,
  maxActionPoints,
  onReplenishActionPoints,
  selectedHeroId,
  onSelectHeroId,
  playerAlliance,
  shrinesHeldCount,
  hasCongress,
  battleReportsCount,
  troopInventory,
  castles,
  bonuses,
  infantryGear,
  isStrategicFilterActive,
  onToggleStrategicFilter,
  viewMode,
  onToggleViewMode,
  onOpenStrategicWorldMap,
  onOpenAlliance,
  onOpenAchievements,
  onOpenInventory,
  onOpenCommandHub,
  onShowToast,
}) => {
  const {
    user,
    profile,
    openAccountModal,
    openSignOutConfirm,
  } = useAuth();
  const [topTab, setTopTab] = useState<ProfileTopTab>('profile');
  const [footerPanel, setFooterPanel] = useState<ProfileFooterPanel>('none');
  const [showcaseMode, setShowcaseMode] = useState<'portrait' | '3d_crest' | 'avatar_picker'>('portrait');
  const [showcase3DKey, setShowcase3DKey] = useState<Profile3DIconKey>('royal_crown');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(commanderName);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('himalayan_sfx_enabled') !== 'false';
    } catch {
      return true;
    }
  });
  const [compactHudMode, setCompactHudMode] = useState<boolean>(false);

  React.useEffect(() => {
    if (isOpen) {
      setNameDraft(commanderName);
    }
  }, [isOpen, commanderName]);

  const activeHero: NepaleseHeroConfig = getHeroById(selectedHeroId) || NEPALESE_HEROES[0];

  const troopTotals = useMemo(() => {
    const sumClass = (cls: 'infantry' | 'archer' | 'cavalry') =>
      (troopInventory[cls]?.[1] || 0) +
      (troopInventory[cls]?.[2] || 0) +
      (troopInventory[cls]?.[3] || 0) +
      (troopInventory[cls]?.[4] || 0) +
      (troopInventory[cls]?.[5] || 0);
    const inf = sumClass('infantry');
    const arc = sumClass('archer');
    const cav = sumClass('cavalry');
    return { inf, arc, cav, total: inf + arc + cav };
  }, [troopInventory]);

  const totalGearRank = useMemo(() => {
    if (!infantryGear) return 0;
    return Object.values(infantryGear).reduce((sum, lv) => sum + (Number(lv) || 0), 0);
  }, [infantryGear]);

  const leaderboardRows = useMemo(() => {
    const entries = castles.map((c) => ({
      id: c.id,
      name: c.isMyCastle ? commanderName : c.name,
      tag: c.faction === 'enemy' ? 'RIVAL' : playerAlliance.tag,
      power: c.isMyCastle ? Math.max(c.power, standingPower) : c.power,
      isPlayer: Boolean(c.isMyCastle),
      faction: c.faction,
    }));
    return entries.sort((a, b) => b.power - a.power).slice(0, 8);
  }, [castles, commanderName, playerAlliance.tag, standingPower]);

  if (!isOpen) return null;

  const killsCount = 1240 + battleReportsCount * 1840 + shrinesHeldCount * 4250;
  const victorsMedalCount = shrinesHeldCount * 2 + (hasCongress ? 5 : 0) + battleReportsCount;
  const dragoActionPts = Math.max(1, Math.floor(actionPoints / 45));
  const xpMax = Math.max(25000, commanderLevel * 3200);
  const xpCurrent = Math.min(xpMax - 420, Math.round((standingPower * 0.72 + battleReportsCount * 3400) % xpMax));
  const xpPct = Math.max(12, Math.min(100, Math.round((xpCurrent / xpMax) * 100)));
  const apPct = Math.max(0, Math.min(100, Math.round((actionPoints / maxActionPoints) * 100)));

  const handleSaveName = () => {
    const trimmed = nameDraft.trim().toUpperCase().slice(0, 18);
    if (trimmed.length < 2) {
      onShowToast?.('Commander name must be at least 2 characters.');
      return;
    }
    onChangeCommanderName(trimmed);
    setIsEditingName(false);
    onShowToast?.(`Commander Name updated to ${trimmed}`);
  };

  const renderLedgerRows = () => {
    if (topTab === 'profile' && footerPanel === 'history') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
            <div style={{ font: "800 15px 'Cinzel', serif", color: '#fde047' }}>
              WARFARE &amp; EXPEDITION HISTORY
            </div>
            <button
              type="button"
              onClick={() => setFooterPanel('none')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'linear-gradient(180deg, #2563eb, #1e3a8a)',
                border: '1px solid #93c5fd',
                color: '#fff',
                font: "700 11px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              ← Back to Profile
            </button>
          </div>
          {[
            { label: 'Victorious Field Battles Logged', value: String(battleReportsCount), tone: '#fde047' },
            { label: 'Enemy Troops Eliminated (Kills)', value: killsCount.toLocaleString(), tone: '#fca5a5' },
            { label: 'Crystal Shrines Under Command', value: `${shrinesHeldCount} / 5`, tone: '#86efac' },
            { label: 'The Congress Citadel Dominion', value: hasCongress ? 'SOVEREIGN' : 'LOCKED (2C · 1B · 1A)', tone: hasCongress ? '#fde047' : '#93c5fd' },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(11, 23, 44, 0.92)',
                border: '1px solid rgba(59, 130, 246, 0.28)',
              }}
            >
              <span style={{ fontSize: '12.5px', color: '#cbd5e1', fontWeight: 600 }}>{row.label}</span>
              <span style={{ font: "800 14px 'Plus Jakarta Sans', sans-serif", color: row.tone, fontVariantNumeric: 'tabular-nums' }}>
                {row.value}
              </span>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCommandHub('reports_config');
            }}
            style={{
              marginTop: '4px',
              padding: '9px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(180deg, #2563eb, #1d4ed8)',
              borderTop: '1.5px solid #93c5fd',
              borderBottom: '3px solid #1e3a8a',
              color: '#fff',
              font: "800 13px 'Barlow Condensed'",
              letterSpacing: '0.05em',
              cursor: 'pointer',
            }}
          >
            OPEN FULL BATTLE REPORTS IN COMMAND HUB
          </button>
        </div>
      );
    }

    if (topTab === 'profile' && footerPanel === 'mastery') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ font: "800 15px 'Cinzel', serif", color: '#fde047' }}>
              VANGUARD MASTERY &amp; DOCTRINES
            </div>
            <button
              type="button"
              onClick={() => setFooterPanel('none')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'linear-gradient(180deg, #2563eb, #1e3a8a)',
                border: '1px solid #93c5fd',
                color: '#fff',
                font: "700 11px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              ← Back to Profile
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '8px',
            }}
          >
            {[
              { title: 'Attack Multiplier', val: `${Math.round(bonuses.attackMult * 100)}%`, sub: 'All Regiments' },
              { title: 'Defense & HP Pool', val: `${Math.round(bonuses.hpMult * 100)}%`, sub: 'Citadel & Field' },
              { title: 'March Velocity', val: `${Math.round(bonuses.marchMult * 100)}%`, sub: 'Mountain Speed' },
              { title: 'Infantry Gear Lv.', val: `Lv.${totalGearRank}`, sub: '6 Forged Slots' },
            ].map((m) => (
              <div
                key={m.title}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: 'rgba(11, 23, 44, 0.92)',
                  border: '1px solid rgba(250, 204, 21, 0.28)',
                }}
              >
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{m.title}</div>
                <div style={{ font: "800 18px 'Plus Jakarta Sans', sans-serif", color: '#fde047', fontVariantNumeric: 'tabular-nums' }}>
                  {m.val}
                </div>
                <div style={{ fontSize: '10.5px', color: '#7dd3fc' }}>{m.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCommandHub('troops');
              }}
              style={{
                flex: 1,
                minWidth: '140px',
                padding: '9px 12px',
                borderRadius: '8px',
                background: 'linear-gradient(180deg, #eab308, #b45309)',
                borderTop: '1.5px solid #fef08a',
                borderBottom: '3px solid #78350f',
                color: '#1f1202',
                font: "800 13px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              UPGRADE INFANTRY GEAR
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAchievements();
              }}
              style={{
                flex: 1,
                minWidth: '140px',
                padding: '9px 12px',
                borderRadius: '8px',
                background: 'linear-gradient(180deg, #2563eb, #1d4ed8)',
                borderTop: '1.5px solid #93c5fd',
                borderBottom: '3px solid #1e3a8a',
                color: '#ffffff',
                font: "800 13px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              VIEW ACHIEVEMENTS
            </button>
          </div>
        </div>
      );
    }

    if (topTab === 'profile' && footerPanel === 'ranking') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ font: "800 15px 'Cinzel', serif", color: '#fde047' }}>
              CONTINENT 1 POWER RANKING
            </div>
            <button
              type="button"
              onClick={() => setFooterPanel('none')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'linear-gradient(180deg, #2563eb, #1e3a8a)',
                border: '1px solid #93c5fd',
                color: '#fff',
                font: "700 11px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              ← Back to Profile
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '235px', overflowY: 'auto' }}>
            {leaderboardRows.map((entry, idx) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderRadius: '7px',
                  background: entry.isPlayer
                    ? 'linear-gradient(90deg, rgba(234, 179, 8, 0.22), rgba(37, 99, 235, 0.25))'
                    : 'rgba(11, 23, 44, 0.88)',
                  border: entry.isPlayer
                    ? '1.5px solid #facc15'
                    : '1px solid rgba(59, 130, 246, 0.2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{ font: "800 13px 'Barlow Condensed'", color: idx < 3 ? '#fde047' : '#94a3b8', width: '20px', fontVariantNumeric: 'tabular-nums' }}>
                    #{idx + 1}
                  </span>
                  <span style={{ font: "700 12px 'Barlow Condensed'", color: entry.faction === 'enemy' ? '#fca5a5' : '#86efac' }}>
                    [{entry.tag}]
                  </span>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {entry.name}
                  </span>
                </div>
                <span style={{ font: "800 13px 'Plus Jakarta Sans', sans-serif", color: '#fde047', fontVariantNumeric: 'tabular-nums' }}>
                  {entry.power.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (topTab === 'kingdom') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          <div style={{ font: "800 15px 'Cinzel', serif", color: '#fde047' }}>
            HIMALAYAN KINGDOM &amp; CITADEL STATUS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
            <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(11,23,44,0.9)', border: '1px solid rgba(96,165,250,0.3)' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Active Realm View</div>
              <div style={{ font: "800 15px 'Cinzel', serif", color: '#fef08a' }}>
                {viewMode === 'kingdom' ? 'Inside 3D Citadel' : 'Continent 1 Overworld'}
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(11,23,44,0.9)', border: '1px solid rgba(96,165,250,0.3)' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Standing Battalions</div>
              <div style={{ font: "800 15px 'Plus Jakarta Sans', sans-serif", color: '#86efac', fontVariantNumeric: 'tabular-nums' }}>
                {troopTotals.total.toLocaleString()} Troops
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(11,23,44,0.9)', border: '1px solid rgba(96,165,250,0.3)' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Magar / Limbu / Thakuri</div>
              <div style={{ font: "700 12.5px 'Plus Jakarta Sans', sans-serif", color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>
                {troopTotals.inf.toLocaleString()} / {troopTotals.arc.toLocaleString()} / {troopTotals.cav.toLocaleString()}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                onToggleViewMode();
              }}
              style={{
                flex: 1,
                minWidth: '150px',
                padding: '9px 12px',
                borderRadius: '8px',
                background: 'linear-gradient(180deg, #2563eb, #1d4ed8)',
                borderTop: '1.5px solid #93c5fd',
                borderBottom: '3px solid #1e3a8a',
                color: '#ffffff',
                font: "800 13px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              {viewMode === 'world' ? 'ENTER 3D CITADEL' : 'RETURN TO WORLD MAP'}
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenStrategicWorldMap();
              }}
              style={{
                flex: 1,
                minWidth: '150px',
                padding: '9px 12px',
                borderRadius: '8px',
                background: 'linear-gradient(180deg, #059669, #065f46)',
                borderTop: '1.5px solid #6ee7b7',
                borderBottom: '3px solid #022c22',
                color: '#fef08a',
                font: "800 13px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              OPEN PARCHMENT WORLDMAP
            </button>
          </div>
        </div>
      );
    }

    if (topTab === 'nft') {
      const relics: Array<{
        key: Profile3DIconKey;
        name: string;
        tier: string;
        unlocked: boolean;
      }> = [
        { key: 'royal_crown', name: 'Sovereign Crown', tier: 'Mythic 3D Relic', unlocked: true },
        { key: 'crossed_swords', name: 'Gorkha Blades', tier: '10K+ Power Crest', unlocked: standingPower >= 10000 },
        { key: 'spartan_helm', name: 'Vanguard Helm', tier: 'Field Commander', unlocked: battleReportsCount >= 1 || standingPower >= 15000 },
        { key: 'trophy_cup', name: 'Congress Chalice', tier: 'Shrine Dominion', unlocked: shrinesHeldCount >= 1 || hasCongress },
      ];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ font: "800 15px 'Cinzel', serif", color: '#fde047' }}>
            3D ROYAL RELICS &amp; COLLECTIBLE VAULT
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
            {relics.map((relic) => (
              <button
                key={relic.key}
                type="button"
                onClick={() => {
                  setShowcase3DKey(relic.key);
                  setShowcaseMode('3d_crest');
                  onShowToast?.(`Inspecting 3D Relic: ${relic.name}`);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: showcase3DKey === relic.key && showcaseMode === '3d_crest'
                    ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.28), rgba(37, 99, 235, 0.3))'
                    : 'rgba(11, 23, 44, 0.92)',
                  border: relic.unlocked
                    ? '1.5px solid rgba(250, 204, 21, 0.5)'
                    : '1px solid rgba(148, 163, 184, 0.25)',
                  opacity: relic.unlocked ? 1 : 0.65,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Profile3DBadge iconKey={relic.key} size={36} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: "700 12.5px 'Barlow Condensed'", color: '#fef08a' }}>{relic.name}</div>
                  <div style={{ fontSize: '10.5px', color: relic.unlocked ? '#86efac' : '#94a3b8' }}>
                    {relic.unlocked ? `✓ ${relic.tier}` : 'Locked Relic'}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: '11.5px', color: '#93c5fd' }}>
            Click any 3D Relic to spin and inspect its interactive 3D sculpture on the crimson pedestal left.
          </div>
        </div>
      );
    }

    if (topTab === 'account') {
      const accountDisplayName = profile?.username || user?.displayName || commanderName;
      const accountKingdom = profile?.kingdomName || 'Royal Bastion';
      const accountLevel = profile?.level || commanderLevel;
      const accountAvatarUrl = profile?.avatarId
        ? getHeroPortraitUrl(profile.avatarId)
        : activeHero.portraitUrl || getHeroPortraitUrl(activeHero.id);

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '9px',
            maxHeight: '296px',
            overflowY: 'auto',
            paddingRight: '4px',
          }}
        >
          {/* Royal Account Identity Summary */}
          {user && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'linear-gradient(180deg, #1b365d 0%, #112544 100%)',
                border: '1px solid rgba(250, 204, 21, 0.38)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <img
                  src={accountAvatarUrl}
                  alt={accountDisplayName}
                  referrerPolicy="no-referrer"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '7px',
                    objectFit: 'cover',
                    objectPosition: 'center 20%',
                    border: '1.5px solid #facc15',
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      font: "800 14px 'Cinzel', serif",
                      color: '#fef08a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {accountDisplayName}
                  </div>
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: '#bae6fd',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {accountKingdom} · Lv.{accountLevel}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '2px',
                  fontSize: '10.5px',
                }}
              >
                <span style={{ color: '#fde68a', fontWeight: 700 }}>
                  {profile?.provider === 'google.com' ? 'Google Account' : 'Email & Password'}
                </span>
                <span style={{ color: user.emailVerified ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                  {user.emailVerified ? 'Verified Seal' : 'Pending Verification'}
                </span>
              </div>
            </div>
          )}

          {/* Account Actions: My Profile, Account Settings, Change Password, Privacy Settings, Sign Out */}
          {user && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '6px',
              }}
            >
              <button
                type="button"
                onClick={() => openAccountModal('profile')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '7px',
                  background: 'rgba(11, 23, 44, 0.94)',
                  border: '1px solid rgba(250, 204, 21, 0.34)',
                  color: '#f8fafc',
                  font: "700 12.5px 'Plus Jakarta Sans', sans-serif",
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span aria-hidden="true">👑</span>
                <span>My Profile</span>
              </button>

              <button
                type="button"
                onClick={() => openAccountModal('settings')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '7px',
                  background: 'rgba(11, 23, 44, 0.94)',
                  border: '1px solid rgba(59, 130, 246, 0.34)',
                  color: '#f8fafc',
                  font: "700 12.5px 'Plus Jakarta Sans', sans-serif",
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span aria-hidden="true">⚙️</span>
                <span>Account Settings</span>
              </button>

              <button
                type="button"
                onClick={() => openAccountModal('password')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '7px',
                  background: 'rgba(11, 23, 44, 0.94)',
                  border: '1px solid rgba(59, 130, 246, 0.34)',
                  color: '#f8fafc',
                  font: "700 12.5px 'Plus Jakarta Sans', sans-serif",
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span aria-hidden="true">🔑</span>
                <span>Change Password</span>
              </button>

              <button
                type="button"
                onClick={() => openAccountModal('privacy')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '7px',
                  background: 'rgba(11, 23, 44, 0.94)',
                  border: '1px solid rgba(59, 130, 246, 0.34)',
                  color: '#f8fafc',
                  font: "700 12.5px 'Plus Jakarta Sans', sans-serif",
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span aria-hidden="true">🛡️</span>
                <span>Privacy Settings</span>
              </button>

              <button
                type="button"
                onClick={() => openSignOutConfirm()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '7px',
                  background: 'rgba(127, 29, 29, 0.52)',
                  border: '1px solid rgba(248, 113, 113, 0.45)',
                  color: '#fecaca',
                  font: "700 12.5px 'Plus Jakarta Sans', sans-serif",
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span aria-hidden="true">🚪</span>
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Field Hero Avatar Switcher */}
          <div style={{ font: "800 13px 'Cinzel', serif", color: '#fde047', marginTop: '2px' }}>
            ACTIVE FIELD HERO AVATAR
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: '6px' }}>
            {NEPALESE_HEROES.map((hero) => {
              const selected = hero.id === activeHero.id;
              return (
                <button
                  key={hero.id}
                  type="button"
                  onClick={() => {
                    onSelectHeroId(hero.id);
                    setShowcaseMode('portrait');
                    onShowToast?.(`Active Commander Avatar set to ${hero.name}`);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    borderRadius: '8px',
                    background: selected
                      ? 'linear-gradient(90deg, rgba(234, 179, 8, 0.26), rgba(37, 99, 235, 0.28))'
                      : 'rgba(11, 23, 44, 0.9)',
                    border: selected ? '1.5px solid #facc15' : '1px solid rgba(59, 130, 246, 0.25)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <img
                    src={hero.portraitUrl || getHeroPortraitUrl(hero.id)}
                    alt={hero.name}
                    referrerPolicy="no-referrer"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      objectFit: 'cover',
                      objectPosition: 'center 20%',
                      border: `1.5px solid ${hero.crestColor}`,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: "700 11.5px 'Plus Jakarta Sans', sans-serif", color: '#fef08a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {hero.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {hero.title}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#cbd5e1', paddingTop: '2px' }}>
            <span>Commander UID: HR-C1-{commanderName.replace(/\s+/g, '').slice(0, 8)}</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAlliance();
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'linear-gradient(180deg, #059669, #065f46)',
                border: '1px solid #6ee7b7',
                color: '#fef08a',
                font: "700 11px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              EDIT ALLIANCE [{playerAlliance.tag}]
            </button>
          </div>
        </div>
      );
    }

    if (topTab === 'option') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ font: "800 15px 'Cinzel', serif", color: '#fde047' }}>
            GAME &amp; VISUAL DISPLAY OPTIONS
          </div>
          {[
            {
              label: '3D Strategic Shrine & Castle Map Filter',
              active: isStrategicFilterActive,
              toggle: () => onToggleStrategicFilter(!isStrategicFilterActive),
            },
            {
              label: 'Realm Battlefield Audio Alerts',
              active: soundEnabled,
              toggle: () => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                try {
                  localStorage.setItem('himalayan_sfx_enabled', String(next));
                } catch {
                  // Ignore
                }
                onShowToast?.(next ? 'Audio alerts enabled' : 'Audio alerts muted');
              },
            },
            {
              label: 'Inspect Profile Crest in Interactive 3D Viewport',
              active: showcaseMode === '3d_crest',
              toggle: () => setShowcaseMode((prev) => (prev === '3d_crest' ? 'portrait' : '3d_crest')),
            },
            {
              label: 'Compact Ledger Metrics Mode',
              active: compactHudMode,
              toggle: () => setCompactHudMode((prev) => !prev),
            },
          ].map((opt) => (
            <div
              key={opt.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: '8px',
                background: 'rgba(11, 23, 44, 0.92)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
              }}
            >
              <span style={{ fontSize: '12.5px', color: '#e2e8f0', fontWeight: 600 }}>{opt.label}</span>
              <button
                type="button"
                onClick={opt.toggle}
                style={{
                  minWidth: '64px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: opt.active
                    ? 'linear-gradient(180deg, #22c55e, #15803d)'
                    : 'linear-gradient(180deg, #334155, #1e293b)',
                  border: opt.active ? '1px solid #86efac' : '1px solid #64748b',
                  color: '#fff',
                  font: "800 11px 'Barlow Condensed'",
                  cursor: 'pointer',
                }}
              >
                {opt.active ? 'ON' : 'OFF'}
              </button>
            </div>
          ))}
        </div>
      );
    }

    // DEFAULT: MAIN PROFILE LEDGER MATCHING REFERENCE DASHBOARD
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {/* Name Row with Green Edit Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '5px 8px 5px 10px',
            borderRadius: '6px',
            background: 'linear-gradient(180deg, #1b365d 0%, #112544 100%)',
            border: '1px solid rgba(147, 197, 253, 0.25)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            <Profile3DBadge iconKey="alliance_shield" size={24} />
            <span style={{ fontSize: '12px', color: '#93c5fd', fontWeight: 700, minWidth: '58px' }}>Name</span>
            {isEditingName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                <input
                  type="text"
                  value={nameDraft}
                  maxLength={18}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setIsEditingName(false);
                  }}
                  style={{
                    flex: 1,
                    minWidth: '90px',
                    padding: '3px 8px',
                    borderRadius: '5px',
                    background: '#091428',
                    border: '1px solid #facc15',
                    color: '#fef08a',
                    font: "700 13px 'Plus Jakarta Sans', sans-serif",
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '5px',
                    background: 'linear-gradient(180deg, #22c55e, #15803d)',
                    border: '1px solid #86efac',
                    color: '#fff',
                    font: "800 11px 'Barlow Condensed'",
                    cursor: 'pointer',
                  }}
                >
                  SAVE
                </button>
              </div>
            ) : (
              <span
                style={{
                  font: "800 15px 'Cinzel', serif",
                  color: '#ffffff',
                  letterSpacing: '0.03em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {commanderName}
              </span>
            )}
          </div>

          {!isEditingName && (
            <button
              type="button"
              onClick={() => {
                setNameDraft(commanderName);
                setIsEditingName(true);
              }}
              title="Rename Commander"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '5px',
                background: 'linear-gradient(180deg, #4ade80 0%, #16a34a 100%)',
                borderTop: '1px solid #bbf7d0',
                borderBottom: '2px solid #14532d',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              ✎
            </button>
          )}
        </div>

        {/* Power & Kill Split Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 10px',
              borderRadius: '6px',
              background: 'rgba(11, 23, 44, 0.92)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Profile3DBadge iconKey="power_bolt" size={22} />
              <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 600 }}>Power</span>
            </div>
            <span style={{ font: "800 14.5px 'Plus Jakarta Sans', sans-serif", color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>
              {standingPower.toLocaleString()}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 10px',
              borderRadius: '6px',
              background: 'rgba(11, 23, 44, 0.92)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Profile3DBadge iconKey="kill_skull" size={22} />
              <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 600 }}>Kill</span>
            </div>
            <span style={{ font: "800 14.5px 'Plus Jakarta Sans', sans-serif", color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
              {killsCount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Alliance Row */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenAlliance();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            background: 'linear-gradient(180deg, #1b365d 0%, #112544 100%)',
            border: '1px solid rgba(147, 197, 253, 0.24)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
          title="Open Alliance Headquarters"
        >
          <Profile3DBadge iconKey="alliance_shield" size={22} />
          <span style={{ fontSize: '11.5px', color: '#93c5fd', fontWeight: 700, minWidth: '72px' }}>ALLIANCE</span>
          <span style={{ font: "700 13.5px 'Plus Jakarta Sans', sans-serif", color: '#ffffff', flex: 1 }}>
            [{playerAlliance.tag}] {playerAlliance.alias}
          </span>
          <span style={{ fontSize: '12px', color: '#fde047' }}>›</span>
        </button>

        {/* Continent Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 10px',
            borderRadius: '6px',
            background: 'rgba(11, 23, 44, 0.92)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}
        >
          <Profile3DBadge iconKey="trophy_cup" size={22} />
          <span style={{ fontSize: '11.5px', color: '#93c5fd', fontWeight: 700, minWidth: '72px' }}>CONTINENT</span>
          <span style={{ font: "700 13.5px 'Plus Jakarta Sans', sans-serif", color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
            1 · Himalayan Frontier
          </span>
        </div>

        {/* Victor's Medal & Drago Action Point Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 10px',
              borderRadius: '6px',
              background: 'rgba(11, 23, 44, 0.92)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Profile3DBadge iconKey="victor_medal" size={22} />
              <span style={{ fontSize: '11.5px', color: '#cbd5e1', fontWeight: 600 }}>Victor's Medal</span>
            </div>
            <span style={{ font: "800 14px 'Plus Jakarta Sans', sans-serif", color: '#fde047', fontVariantNumeric: 'tabular-nums' }}>
              {victorsMedalCount}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 10px',
              borderRadius: '6px',
              background: 'rgba(11, 23, 44, 0.92)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Profile3DBadge iconKey="power_bolt" size={22} />
              <span style={{ fontSize: '11.5px', color: '#cbd5e1', fontWeight: 600 }}>Drago Action Point</span>
            </div>
            <span style={{ font: "800 14px 'Plus Jakarta Sans', sans-serif", color: '#fef08a', fontVariantNumeric: 'tabular-nums' }}>
              {dragoActionPts}
            </span>
          </div>
        </div>

        {/* Lord Level Progress Bar Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            padding: '5px 8px 5px 10px',
            borderRadius: '6px',
            background: 'linear-gradient(180deg, #1b365d 0%, #112544 100%)',
            border: '1px solid rgba(147, 197, 253, 0.24)',
          }}
        >
          <Profile3DBadge iconKey="xp_star" size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ font: "800 13px 'Plus Jakarta Sans', sans-serif", color: '#fef08a' }}>
                Lord Level : {commanderLevel}
              </span>
              <span style={{ fontSize: '10.5px', color: '#bae6fd', fontVariantNumeric: 'tabular-nums' }}>
                VIP {vipLevel}
              </span>
            </div>
            <div
              style={{
                position: 'relative',
                height: '14px',
                borderRadius: '7px',
                background: '#091224',
                border: '1px solid rgba(56, 189, 248, 0.38)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${xpPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 55%, #7dd3fc 100%)',
                  boxShadow: '0 0 10px rgba(56, 189, 248, 0.65)',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  font: "800 10px 'Plus Jakarta Sans', sans-serif",
                  fontVariantNumeric: 'tabular-nums',
                  color: '#ffffff',
                  textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                }}
              >
                {xpCurrent.toLocaleString()} / {xpMax.toLocaleString()}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCommandHub('barracks');
            }}
            title="Train Regiments to Increase Lord Power & Level"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
              borderTop: '1px solid #bfdbfe',
              borderBottom: '2px solid #1e3a8a',
              color: '#ffffff',
              fontSize: '17px',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            +
          </button>
        </div>

        {/* Action Point Progress Bar Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            padding: '5px 8px 5px 10px',
            borderRadius: '6px',
            background: 'linear-gradient(180deg, #1b365d 0%, #112544 100%)',
            border: '1px solid rgba(147, 197, 253, 0.24)',
          }}
        >
          <Profile3DBadge iconKey="ap_potion" size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 12px 'Plus Jakarta Sans', sans-serif", color: '#e2e8f0', marginBottom: '3px' }}>
              Action Point
            </div>
            <div
              style={{
                position: 'relative',
                height: '14px',
                borderRadius: '7px',
                background: '#091224',
                border: '1px solid rgba(251, 191, 36, 0.45)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${apPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #ea580c 0%, #f59e0b 55%, #fde047 100%)',
                  boxShadow: '0 0 10px rgba(245, 158, 11, 0.65)',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  font: "800 10px 'Plus Jakarta Sans', sans-serif",
                  fontVariantNumeric: 'tabular-nums',
                  color: '#ffffff',
                  textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                }}
              >
                {actionPoints} / {maxActionPoints}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onReplenishActionPoints}
            title="Replenish +35 Action Points"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
              borderTop: '1px solid #bfdbfe',
              borderBottom: '2px solid #1e3a8a',
              color: '#ffffff',
              fontSize: '17px',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            +
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 16, 0.85)',
        zIndex: 110,
        display: 'grid',
        placeItems: 'center',
        padding: '20px 14px',
        pointerEvents: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '94dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* TOP WINGED SHIELD HEADER: PROFILE + 3D SPARTAN HELM */}
        <div
          style={{
            position: 'relative',
            zIndex: 6,
            marginBottom: '-18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Winged Gold Side Brackets */}
          <div
            aria-hidden="true"
            style={{
              width: '34px',
              height: '22px',
              background: 'linear-gradient(135deg, #fef08a, #d97706)',
              clipPath: 'polygon(0 25%, 100% 0, 100% 100%, 25% 85%)',
              marginRight: '-6px',
              filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.65))',
            }}
          />
          <div
            style={{
              position: 'relative',
              minWidth: '250px',
              padding: '7px 36px',
              borderRadius: '10px',
              background: 'linear-gradient(180deg, #1d4ed8 0%, #172554 100%)',
              border: '2.5px solid #facc15',
              boxShadow: '0 8px 24px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.3)',
              textAlign: 'center',
            }}
          >
            {/* 3D Spartan Helm Apex */}
            <div
              style={{
                position: 'absolute',
                top: '-24px',
                left: '50%',
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
              }}
            >
              <Profile3DBadge iconKey="spartan_helm" size={42} />
            </div>
            <span
              style={{
                font: "900 20px 'Cinzel', serif",
                color: '#ffffff',
                letterSpacing: '0.1em',
                textShadow: '0 2px 4px rgba(0,0,0,0.85)',
              }}
            >
              PROFILE
            </span>
          </div>
          <div
            aria-hidden="true"
            style={{
              width: '34px',
              height: '22px',
              background: 'linear-gradient(225deg, #fef08a, #d97706)',
              clipPath: 'polygon(100% 25%, 0 0, 0 100%, 75% 85%)',
              marginLeft: '-6px',
              filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.65))',
            }}
          />
        </div>

        {/* MAIN STONE & STEEL CITADEL CHASSIS */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            background: 'linear-gradient(180deg, #4b5563 0%, #374151 12%, #1e293b 100%)',
            borderTop: '4px solid #cbd5e1',
            borderLeft: '4px solid #64748b',
            borderRight: '4px solid #64748b',
            borderBottom: '6px solid #1e293b',
            borderRadius: '14px',
            boxShadow: '0 28px 80px rgba(0,0,0,0.94), inset 0 0 0 2px rgba(234, 179, 8, 0.45)',
            padding: '26px 20px 16px',
            overflowY: 'auto',
          }}
        >
          {/* Red Close Shield Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Profile"
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              zIndex: 8,
              width: '38px',
              height: '38px',
              borderRadius: '9px',
              background: 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)',
              borderTop: '2px solid #fca5a5',
              borderLeft: '2px solid #fca5a5',
              borderRight: '2px solid #991b1b',
              borderBottom: '4px solid #7f1d1d',
              color: '#ffffff',
              fontSize: '18px',
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.7)',
            }}
          >
            ✕
          </button>

          {/* Left Flanking Stone Buttress + 3D Fire Brazier + Hanging Blue Banner */}
          <div
            className="profile-side-pillar"
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '-14px',
              bottom: '28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              pointerEvents: 'none',
              zIndex: 4,
            }}
          >
            <div style={{ filter: 'drop-shadow(0 0 14px rgba(249, 115, 22, 0.75))', marginBottom: '-6px' }}>
              <Profile3DBadge iconKey="fire_brazier" size={44} />
            </div>
            <div
              style={{
                width: '34px',
                height: '115px',
                background: 'linear-gradient(180deg, #94a3b8 0%, #475569 100%)',
                border: '2px solid #eab308',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: '10px',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '52px',
                  background: 'linear-gradient(180deg, #2563eb 0%, #1e3a8a 100%)',
                  border: '1.5px solid #facc15',
                  clipPath: 'polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Profile3DBadge iconKey="royal_crown" size={16} />
              </div>
            </div>
          </div>

          {/* Right Flanking Stone Buttress + 3D Fire Brazier + Hanging Blue Banner */}
          <div
            className="profile-side-pillar"
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: '-14px',
              bottom: '28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              pointerEvents: 'none',
              zIndex: 4,
            }}
          >
            <div style={{ filter: 'drop-shadow(0 0 14px rgba(249, 115, 22, 0.75))', marginBottom: '-6px' }}>
              <Profile3DBadge iconKey="fire_brazier" size={44} />
            </div>
            <div
              style={{
                width: '34px',
                height: '115px',
                background: 'linear-gradient(180deg, #94a3b8 0%, #475569 100%)',
                border: '2px solid #eab308',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: '10px',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '52px',
                  background: 'linear-gradient(180deg, #2563eb 0%, #1e3a8a 100%)',
                  border: '1.5px solid #facc15',
                  clipPath: 'polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Profile3DBadge iconKey="royal_crown" size={16} />
              </div>
            </div>
          </div>

          {/* INNER ROYAL NAVY STEEL PANEL */}
          <div
            style={{
              background: 'linear-gradient(180deg, #102546 0%, #09162d 100%)',
              border: '2px solid rgba(250, 204, 21, 0.45)',
              borderRadius: '10px',
              padding: '12px 16px 14px',
              boxShadow: 'inset 0 2px 18px rgba(0,0,0,0.75)',
            }}
          >
            {/* 5 HORIZONTAL 3D TABS: PROFILE | KINGDOM | NFT | ACCOUNT | OPTION */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
                marginBottom: '12px',
                paddingRight: '26px',
              }}
            >
              {(
                [
                  { id: 'profile', label: 'PROFILE' },
                  { id: 'kingdom', label: 'KINGDOM' },
                  { id: 'nft', label: 'NFT' },
                  { id: 'account', label: 'ACCOUNT' },
                  { id: 'option', label: 'OPTION' },
                ] as const
              ).map((tab) => {
                const isActive = topTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setTopTab(tab.id);
                      if (tab.id !== 'profile') setFooterPanel('none');
                    }}
                    style={{
                      minWidth: '88px',
                      padding: '7px 14px',
                      borderRadius: '6px',
                      background: isActive
                        ? 'linear-gradient(180deg, #fde047 0%, #eab308 45%, #b45309 100%)'
                        : 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 55%, #1e3a8a 100%)',
                      borderTop: isActive ? '1.5px solid #fef9c3' : '1.5px solid #93c5fd',
                      borderLeft: isActive ? '1.5px solid #fef08a' : '1.5px solid #60a5fa',
                      borderRight: isActive ? '1.5px solid #ca8a04' : '1.5px solid #3b82f6',
                      borderBottom: isActive ? '3px solid #78350f' : '3px solid #0f2957',
                      color: isActive ? '#ffffff' : '#e0f2fe',
                      textShadow: '0 1px 3px rgba(0,0,0,0.85)',
                      font: "800 13px 'Barlow Condensed', sans-serif",
                      letterSpacing: '0.06em',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* TWO-COLUMN CONTENT BODY: LEFT CRIMSON BANNER + RIGHT STEEL LEDGER */}
            <div
              className="profile-dashboard-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: '215px 1fr',
                gap: '16px',
                alignItems: 'stretch',
              }}
            >
              {/* LEFT COLUMN: Crimson Hanging Royal Pennant + Crowned Hero Frame / Interactive 3D Model */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                {/* Golden Banner Mounting Rod */}
                <div
                  style={{
                    width: '104%',
                    height: '12px',
                    borderRadius: '6px',
                    background: 'linear-gradient(180deg, #fef08a 0%, #d97706 55%, #78350f 100%)',
                    border: '1px solid #fde047',
                    boxShadow: '0 3px 8px rgba(0,0,0,0.65)',
                    zIndex: 2,
                  }}
                />

                {/* Crimson & Gold Swallowtail Banner */}
                <div
                  style={{
                    width: '94%',
                    marginTop: '-4px',
                    padding: '22px 14px 36px',
                    background: 'linear-gradient(180deg, #b91c1c 0%, #dc2626 42%, #7f1d1d 100%)',
                    borderLeft: '3.5px solid #facc15',
                    borderRight: '3.5px solid #facc15',
                    clipPath: 'polygon(0 0, 100% 0, 100% 89%, 50% 100%, 0 89%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: 'inset 0 8px 18px rgba(0,0,0,0.4)',
                  }}
                >
                  {/* 3D Royal Crown Above Frame */}
                  <div style={{ marginBottom: '-20px', zIndex: 3, pointerEvents: 'none' }}>
                    <Profile3DBadge iconKey="royal_crown" size={52} />
                  </div>

                  {/* Gold-Beveled Square Frame (Hero Portrait OR Interactive 3D Model OR Inline Avatar Picker) */}
                  <div
                    style={{
                      position: 'relative',
                      width: '142px',
                      height: '142px',
                      borderRadius: '10px',
                      background: 'linear-gradient(180deg, #fde047 0%, #b45309 100%)',
                      padding: '5px',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.75)',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '7px',
                        overflow: 'hidden',
                        background: '#0f172a',
                        border: '1.5px solid #fef08a',
                        position: 'relative',
                      }}
                    >
                      {showcaseMode === '3d_crest' ? (
                        <Profile3DCrestViewport modelKey={showcase3DKey} />
                      ) : showcaseMode === 'avatar_picker' ? (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            overflowY: 'auto',
                            padding: '4px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            background: '#091224',
                          }}
                        >
                          {NEPALESE_HEROES.map((h) => (
                            <button
                              key={h.id}
                              type="button"
                              onClick={() => {
                                onSelectHeroId(h.id);
                                setShowcaseMode('portrait');
                                onShowToast?.(`Avatar changed to ${h.name}`);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '3px 5px',
                                borderRadius: '5px',
                                background: h.id === activeHero.id ? 'rgba(234,179,8,0.28)' : 'rgba(30,41,59,0.75)',
                                border: h.id === activeHero.id ? '1px solid #facc15' : '1px solid rgba(255,255,255,0.1)',
                                color: '#fef08a',
                                font: "700 10.5px 'Plus Jakarta Sans', sans-serif",
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              <img
                                src={h.portraitUrl || getHeroPortraitUrl(h.id)}
                                alt={h.name}
                                style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover' }}
                              />
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {h.name.split(' ')[0]}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <>
                          <img
                            src={activeHero.portraitUrl || getHeroPortraitUrl(activeHero.id)}
                            alt={activeHero.name}
                            referrerPolicy="no-referrer"
                            draggable={false}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              objectPosition: 'center 18%',
                              display: 'block',
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              insetInline: 0,
                              bottom: 0,
                              padding: '12px 4px 3px',
                              background: 'linear-gradient(180deg, transparent, rgba(5,10,22,0.92))',
                              textAlign: 'center',
                              font: "700 10px 'Plus Jakarta Sans', sans-serif",
                              color: '#fef08a',
                            }}
                          >
                            {activeHero.name}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quick Portrait / 3D Crest / Avatar Controls */}
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      type="button"
                      onClick={() =>
                        setShowcaseMode((m) => (m === '3d_crest' ? 'portrait' : '3d_crest'))
                      }
                      style={{
                        padding: '3px 8px',
                        borderRadius: '5px',
                        background: showcaseMode === '3d_crest'
                          ? 'linear-gradient(180deg, #eab308, #b45309)'
                          : 'rgba(15, 23, 42, 0.85)',
                        border: '1px solid #facc15',
                        color: '#fef08a',
                        font: "800 10px 'Barlow Condensed'",
                        cursor: 'pointer',
                      }}
                    >
                      {showcaseMode === '3d_crest' ? 'HERO PORTRAIT' : '3D MODEL'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setShowcaseMode((m) => (m === 'avatar_picker' ? 'portrait' : 'avatar_picker'))
                      }
                      style={{
                        padding: '3px 8px',
                        borderRadius: '5px',
                        background: showcaseMode === 'avatar_picker'
                          ? 'linear-gradient(180deg, #2563eb, #1e3a8a)'
                          : 'rgba(15, 23, 42, 0.85)',
                        border: '1px solid #93c5fd',
                        color: '#e0f2fe',
                        font: "800 10px 'Barlow Condensed'",
                        cursor: 'pointer',
                      }}
                    >
                      EDIT AVATAR
                    </button>
                  </div>

                  {/* Blue Season / Rank Shield Badge (S1) */}
                  <div
                    style={{
                      width: '54px',
                      height: '44px',
                      background: 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
                      border: '2px solid #facc15',
                      clipPath: 'polygon(0 0, 100% 0, 100% 68%, 50% 100%, 0 68%)',
                      display: 'grid',
                      placeItems: 'center',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.65)',
                    }}
                  >
                    <span style={{ font: "900 15px 'Cinzel', serif", color: '#ffffff' }}>S1</span>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Navy Ledger Rows / Selected Panel */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minWidth: 0,
                }}
              >
                {renderLedgerRows()}
              </div>
            </div>
          </div>

          {/* BOTTOM 5 ORNATE 3D FOOTER BUTTONS: HISTORY | TROOPS | MASTERY | TREASURE | RANKING */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
              gap: '8px',
              marginTop: '14px',
              paddingInline: '18px',
            }}
          >
            {(
              [
                {
                  id: 'history',
                  label: 'HISTORY',
                  icon: 'history_scroll' as Profile3DIconKey,
                  isActive: footerPanel === 'history',
                  onClick: () => {
                    setTopTab('profile');
                    setFooterPanel((p) => (p === 'history' ? 'none' : 'history'));
                  },
                },
                {
                  id: 'troops',
                  label: 'TROOPS',
                  icon: 'spartan_helm' as Profile3DIconKey,
                  isActive: false,
                  onClick: () => {
                    onClose();
                    onOpenCommandHub('barracks');
                  },
                },
                {
                  id: 'mastery',
                  label: 'MASTERY',
                  icon: 'royal_crown' as Profile3DIconKey,
                  isActive: footerPanel === 'mastery' || (topTab === 'profile' && footerPanel === 'none'),
                  onClick: () => {
                    setTopTab('profile');
                    setFooterPanel((p) => (p === 'mastery' ? 'none' : 'mastery'));
                  },
                },
                {
                  id: 'treasure',
                  label: 'TREASURE',
                  icon: 'treasure_chest' as Profile3DIconKey,
                  isActive: false,
                  onClick: () => {
                    onClose();
                    onOpenInventory();
                  },
                },
                {
                  id: 'ranking',
                  label: 'RANKING',
                  icon: 'trophy_cup' as Profile3DIconKey,
                  isActive: footerPanel === 'ranking',
                  onClick: () => {
                    setTopTab('profile');
                    setFooterPanel((p) => (p === 'ranking' ? 'none' : 'ranking'));
                  },
                },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={btn.onClick}
                style={{
                  position: 'relative',
                  marginTop: '10px',
                  padding: '16px 6px 8px',
                  borderRadius: '8px',
                  background: btn.isActive
                    ? 'linear-gradient(180deg, #fde047 0%, #eab308 42%, #b45309 100%)'
                    : 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 55%, #1e3a8a 100%)',
                  borderTop: btn.isActive ? '2px solid #fef9c3' : '2px solid #93c5fd',
                  borderLeft: btn.isActive ? '1.5px solid #fef08a' : '1.5px solid #60a5fa',
                  borderRight: btn.isActive ? '1.5px solid #ca8a04' : '1.5px solid #3b82f6',
                  borderBottom: btn.isActive ? '4px solid #78350f' : '4px solid #0f2957',
                  color: '#ffffff',
                  textShadow: '0 1px 3px rgba(0,0,0,0.85)',
                  font: "800 13px 'Barlow Condensed', sans-serif",
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  boxShadow: btn.isActive
                    ? '0 6px 18px rgba(234, 179, 8, 0.45)'
                    : '0 6px 14px rgba(0,0,0,0.65)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-18px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                  }}
                >
                  <Profile3DBadge iconKey={btn.icon} size={34} />
                </div>
                <span style={{ whiteSpace: 'nowrap' }}>{btn.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .profile-side-pillar {
            display: none !important;
          }
          .profile-dashboard-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
