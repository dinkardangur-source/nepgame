import React, { useMemo, useState } from 'react';
import {
  AllianceShrineRuleStatus,
  calculateArmyMetrics,
  CalculatedBonuses,
  GameBalanceConfig,
  normalizeAllianceTag,
  PlayerAllianceIdentity,
  PlayerResources,
  ShrineGarrisonState,
  validateAllianceAlias,
} from '../game/NepaleseBalanceConfig';
import type { CommandHubTab } from './CommandHubDrawer';
import { CastleSpawnData, RESERVED_PLOTS } from '../game/WorldCoordinates';

export type AllianceHqTab =
  | 'overview'
  | 'members'
  | 'territory'
  | 'technology'
  | 'store'
  | 'logs'
  | 'settings';

interface AllianceLogEntry {
  id: string;
  timeLabel: string;
  text: string;
  accent?: string;
}

interface AllianceTechNode {
  id: 'gathering' | 'construction' | 'attack' | 'march';
  name: string;
  desc: string;
  level: number;
  maxLevel: number;
  bonusPerLevel: number;
  costGold: number;
}

interface AllianceHeadquartersModalProps {
  isOpen: boolean;
  initialTab?: AllianceHqTab;
  onClose: () => void;
  playerAlliance: PlayerAllianceIdentity;
  onUpdateAllianceIdentity: (tag: string, alias: string) => boolean;
  shrineRuleStatus: AllianceShrineRuleStatus;
  shrineGarrisons: Record<string, ShrineGarrisonState>;
  conqueredPlots?: Record<string, 'neutral' | 'enemy' | 'alliance'>;
  castles: CastleSpawnData[];
  resources: PlayerResources;
  balanceConfig: GameBalanceConfig;
  bonuses: CalculatedBonuses;
  onPanTo: (x: number, z: number) => void;
  onOpenCommandHub: (tab: CommandHubTab, structureId?: string) => void;
  onRelinquishStructure: (structureId: string) => void;
  onGrantReward?: (
    type: 'wood' | 'stone' | 'iron' | 'food' | 'crystal' | 'gold' | 'gems',
    amount: number,
    label: string
  ) => void;
  onShowToast?: (msg: string) => void;
}

function formatCompactPower(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export const AllianceHeadquartersModal: React.FC<AllianceHeadquartersModalProps> = ({
  isOpen,
  initialTab = 'overview',
  onClose,
  playerAlliance,
  onUpdateAllianceIdentity,
  shrineRuleStatus,
  shrineGarrisons,
  conqueredPlots,
  castles,
  resources,
  balanceConfig,
  bonuses,
  onPanTo,
  onOpenCommandHub,
  onRelinquishStructure,
  onGrantReward,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<AllianceHqTab>(initialTab);
  const [allianceLevel, setAllianceLevel] = useState<number>(15);
  const [allianceXpPct, setAllianceXpPct] = useState<number>(48);
  const [honorCoins, setHonorCoins] = useState<number>(2400);
  const [treasury, setTreasury] = useState({
    food: 15400,
    wood: 11200,
    stone: 18600,
    gold: 50000,
    gems: 520,
  });
  const [announcement, setAnnouncement] = useState<string>(
    `Welcome new commanders of [${playerAlliance.tag}]! Coordinate shrines (2C · 1B · 1A) to unlock The Congress at [1600, 1600] and donate gold for alliance tech buffs.`
  );
  const [announcementDraft, setAnnouncementDraft] = useState<string>(announcement);
  const [recruitmentPolicy, setRecruitmentPolicy] = useState<'open' | 'approval'>('open');
  const [tagDraft, setTagDraft] = useState<string>(playerAlliance.tag);
  const [aliasDraft, setAliasDraft] = useState<string>(playerAlliance.alias);
  const [isDonateMenuOpen, setIsDonateMenuOpen] = useState<boolean>(false);

  const [techNodes, setTechNodes] = useState<AllianceTechNode[]>([
    {
      id: 'gathering',
      name: 'Highland Resource Harvest',
      desc: 'Boosts alliance-wide Timber, Granite, Iron & Grain gathering yield.',
      level: 5,
      maxLevel: 10,
      bonusPerLevel: 3,
      costGold: 600,
    },
    {
      id: 'construction',
      name: 'Citadel Ashlar Masonry',
      desc: 'Accelerates 3D Citadel courtyard merges & watchtower fortification speed.',
      level: 4,
      maxLevel: 10,
      bonusPerLevel: 2.5,
      costGold: 750,
    },
    {
      id: 'attack',
      name: 'Gorkha Vanguard Phalanx',
      desc: 'Increases all allied battalion Combat Attack against monsters & rivals.',
      level: 3,
      maxLevel: 10,
      bonusPerLevel: 2,
      costGold: 900,
    },
    {
      id: 'march',
      name: 'Mustang Caravan Logistics',
      desc: 'Increases overland march speed across mountain highways.',
      level: 3,
      maxLevel: 10,
      bonusPerLevel: 2,
      costGold: 700,
    },
  ]);

  const [logs, setLogs] = useState<AllianceLogEntry[]>([
    { id: 'l1', timeLabel: '1m ago', text: 'Lord Dangol donated 1,200 Gold to Alliance Treasury', accent: '#fde047' },
    { id: 'l2', timeLabel: '15m ago', text: 'Alliance Level up to 15', accent: '#34d399' },
    { id: 'l3', timeLabel: '1h ago', text: 'Shrine Sector [C1] garrison reinforced by Vanguard Corps', accent: '#7dd3fc' },
  ]);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setTagDraft(playerAlliance.tag);
      setAliasDraft(playerAlliance.alias);
      setAnnouncementDraft(announcement);
    }
  }, [isOpen, initialTab, playerAlliance.tag, playerAlliance.alias]);

  const allianceMemberCastles = useMemo(
    () => castles.filter((c) => c.faction !== 'enemy'),
    [castles]
  );
  const enemyCastles = useMemo(
    () => castles.filter((c) => c.faction === 'enemy'),
    [castles]
  );

  const territoryStats = useMemo(() => {
    let cCount = 0;
    let bCount = 0;
    let aCount = 0;
    let hasCongress = false;
    for (const plot of RESERVED_PLOTS) {
      if (
        conqueredPlots?.[plot.id] === 'alliance' ||
        shrineGarrisons[plot.id]?.ownerFaction === 'alliance'
      ) {
        if (plot.type === 'shrine_c') cCount += 1;
        else if (plot.type === 'shrine_b') bCount += 1;
        else if (plot.type === 'shrine_a') aCount += 1;
        else if (plot.type === 'congress') hasCongress = true;
      }
    }
    const capturedTotal = cCount + bCount + aCount + (hasCongress ? 1 : 0);
    const totalPower = allianceMemberCastles.reduce((sum, c) => sum + c.power, 0);
    const techGather = Math.round(techNodes[0].level * techNodes[0].bonusPerLevel);
    const techConst = Math.round(techNodes[1].level * techNodes[1].bonusPerLevel);
    const techAtk = Math.round(techNodes[2].level * techNodes[2].bonusPerLevel);
    const techMarch = Math.round(techNodes[3].level * techNodes[3].bonusPerLevel);
    return {
      capturedTotal,
      totalPower,
      hasCongress,
      controlPoints: Math.max(allianceMemberCastles.length, capturedTotal * 3 + allianceMemberCastles.length),
      areaKm2: 320 + capturedTotal * 65 + allianceMemberCastles.length * 18,
      gatheringBuff: techGather + cCount * 5 + (hasCongress ? 20 : 0),
      constructionBuff: techConst + (hasCongress ? 15 : 0),
      attackBuff: techAtk + aCount * 12 + (hasCongress ? 20 : 0),
      marchBuff: techMarch + bCount * 8 + (hasCongress ? 20 : 0),
    };
  }, [conqueredPlots, shrineGarrisons, allianceMemberCastles, techNodes]);

  const heldPlots = useMemo(() => {
    const plots = RESERVED_PLOTS.filter(
      (plot) =>
        conqueredPlots?.[plot.id] === 'alliance' ||
        shrineGarrisons[plot.id]?.ownerFaction === 'alliance'
    );
    const tierPriority: Record<string, number> = {
      congress: 0,
      shrine_a: 1,
      shrine_b: 2,
      shrine_c: 3,
    };
    return [...plots].sort((a, b) => (tierPriority[a.type] ?? 9) - (tierPriority[b.type] ?? 9));
  }, [conqueredPlots, shrineGarrisons]);

  if (!isOpen) return null;

  const pushLog = (text: string, accent = '#fde047') => {
    setLogs((prev) => [
      { id: `l-${Date.now()}-${Math.random()}`, timeLabel: 'Just now', text, accent },
      ...prev.slice(0, 24),
    ]);
  };

  const handleDonate = (resType: 'gold' | 'wood' | 'stone' | 'food', amount: number) => {
    if (resources[resType] < amount) {
      onShowToast?.(`Insufficient ${resType.toUpperCase()} (${amount.toLocaleString()} required).`);
      return;
    }
    onGrantReward?.(resType, -amount, `Alliance ${resType.toUpperCase()} Donation`);
    setTreasury((prev) => ({ ...prev, [resType]: prev[resType] + amount }));
    const honorGain = resType === 'gold' ? Math.round(amount * 0.6) : Math.round(amount * 0.15);
    setHonorCoins((h) => h + honorGain);

    setAllianceXpPct((prev) => {
      const next = prev + 18;
      if (next >= 100) {
        setAllianceLevel((lv) => lv + 1);
        pushLog(`Alliance Level up to ${allianceLevel + 1}`, '#34d399');
        return next - 100;
      }
      return next;
    });

    pushLog(`Lord Dangol donated ${amount.toLocaleString()} ${resType.toUpperCase()}`, '#fde047');
    onShowToast?.(`Donated ${amount.toLocaleString()} ${resType.toUpperCase()}! Earned +${honorGain} Honor Coins.`);
    setIsDonateMenuOpen(false);
  };

  const handleUpgradeTech = (techId: AllianceTechNode['id']) => {
    const node = techNodes.find((t) => t.id === techId);
    if (!node || node.level >= node.maxLevel) return;
    if (resources.gold < node.costGold) {
      onShowToast?.(`Need ${node.costGold.toLocaleString()} Gold to research ${node.name}.`);
      return;
    }
    onGrantReward?.('gold', -node.costGold, `Alliance Tech: ${node.name}`);
    setTechNodes((prev) =>
      prev.map((t) =>
        t.id === techId
          ? { ...t, level: t.level + 1, costGold: Math.round(t.costGold * 1.35) }
          : t
      )
    );
    setHonorCoins((h) => h + 250);
    pushLog(`Researched ${node.name} to Lv.${node.level + 1}`, '#38bdf8');
    onShowToast?.(`${node.name} upgraded to Lv.${node.level + 1}! (+250 Honor Coins)`);
  };

  const handleBuyStoreItem = (
    name: string,
    honorCost: number,
    rewardType: 'wood' | 'stone' | 'iron' | 'gold' | 'gems',
    rewardAmount: number
  ) => {
    if (honorCoins < honorCost) {
      onShowToast?.(`Need ${honorCost.toLocaleString()} Honor Coins (have ${honorCoins.toLocaleString()}).`);
      return;
    }
    setHonorCoins((h) => h - honorCost);
    onGrantReward?.(rewardType, rewardAmount, `Alliance Store: ${name}`);
    pushLog(`Redeemed ${name} in Alliance Store`, '#a7f3d0');
  };

  const renderSidebarGlyph = (tab: AllianceHqTab) => {
    switch (tab) {
      case 'overview':
        return (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path d="M4 9L12 4L20 9H4Z" fill="#fde047" />
            <rect x="6" y="10" width="2.5" height="8" fill="#fef3c7" />
            <rect x="10.8" y="10" width="2.5" height="8" fill="#fef3c7" />
            <rect x="15.5" y="10" width="2.5" height="8" fill="#fef3c7" />
            <rect x="4" y="18" width="16" height="2.2" fill="#facc15" />
          </svg>
        );
      case 'members':
        return (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="9" r="3" fill="#6ee7b7" />
            <circle cx="15.5" cy="9.5" r="2.5" fill="#34d399" />
            <path d="M4 19C4 15.8 6.4 14 9 14C11.6 14 14 15.8 14 19" fill="#6ee7b7" />
            <path d="M13.5 19C13.5 16.5 15 15 17 15C19 15 20.5 16.5 20.5 19" fill="#34d399" />
          </svg>
        );
      case 'territory':
        return (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <polygon points="12,3 20,7 18,16 12,21 6,16 4,7" fill="#0f766e" stroke="#5eead4" strokeWidth="1.5" />
            <polygon points="12,8 14,12 12,16 10,12" fill="#fde047" />
          </svg>
        );
      case 'technology':
        return (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="6" stroke="#5eead4" strokeWidth="1.7" />
            <circle cx="12" cy="12" r="2.4" fill="#fde047" />
            <path d="M12 3V6M12 18V21M3 12H6M18 12H21" stroke="#5eead4" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        );
      case 'store':
        return (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path d="M4 6H7L9.2 15H17.8L20 8.5H8" stroke="#6ee7b7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10.5" cy="18.5" r="1.5" fill="#fde047" />
            <circle cx="16.5" cy="18.5" r="1.5" fill="#fde047" />
          </svg>
        );
      case 'logs':
        return (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <rect x="6" y="4" width="12" height="16" rx="2" fill="#e2e8f0" stroke="#475569" strokeWidth="1.3" />
            <line x1="9" y1="8.5" x2="15" y2="8.5" stroke="#0f172a" strokeWidth="1.5" />
            <line x1="9" y1="12" x2="15" y2="12" stroke="#0f172a" strokeWidth="1.5" />
            <line x1="9" y1="15.5" x2="13" y2="15.5" stroke="#0f172a" strokeWidth="1.5" />
          </svg>
        );
      case 'settings':
        return (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3.2" stroke="#6ee7b7" strokeWidth="1.8" />
            <path d="M12 4V6.5M12 17.5V20M4 12H6.5M17.5 12H20M6.3 6.3L8.1 8.1M15.9 15.9L17.7 17.7M17.7 6.3L15.9 8.1M8.1 15.9L6.3 17.7" stroke="#6ee7b7" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        );
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3, 8, 12, 0.86)',
        zIndex: 108,
        display: 'grid',
        placeItems: 'center',
        padding: '12px',
        pointerEvents: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '980px',
          maxHeight: '92dvh',
          background: 'linear-gradient(180deg, #0b2223 0%, #061416 100%)',
          border: '2px solid #b58d3d',
          borderRadius: '14px',
          boxShadow: '0 26px 72px rgba(0,0,0,0.92), inset 0 0 0 1px rgba(254,240,138,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f8fafc',
        }}
      >
        {/* Top Header Rail */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            background: 'linear-gradient(180deg, #102f2d 0%, #081a1b 100%)',
            borderBottom: '1.5px solid #9e7830',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: 'none',
              color: '#f5e2ad',
              cursor: 'pointer',
              padding: '2px 4px',
            }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>←</span>
            <span
              style={{
                font: "800 17px 'Cinzel', serif",
                letterSpacing: '0.1em',
                color: '#f4e0a3',
              }}
            >
              ALLIANCE
            </span>
          </button>

          <div
            style={{
              padding: '4px 26px',
              background: 'linear-gradient(180deg, #185148 0%, #0d322e 100%)',
              border: '1.5px solid #eab308',
              borderRadius: '6px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(254,240,138,0.35)',
            }}
          >
            <span
              style={{
                font: "800 16px 'Cinzel', serif",
                color: '#fbf0ce',
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
              }}
            >
              Alliance Headquarters
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Alliance Headquarters"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: 'linear-gradient(180deg, #574523 0%, #342712 100%)',
              border: '1.5px solid #e5b84b',
              color: '#fef3c7',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Main 2-Column Body */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          {/* Left Vertical Sidebar (All 7 Reference Tabs) */}
          <aside
            style={{
              width: '164px',
              minWidth: '140px',
              background: 'linear-gradient(180deg, #0d2526 0%, #071618 100%)',
              borderRight: '2px solid #96712d',
              padding: '10px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '7px',
              overflowY: 'auto',
            }}
          >
            {(
              [
                { id: 'overview', label: 'Overview' },
                { id: 'members', label: 'Members' },
                { id: 'territory', label: 'Territory' },
                { id: 'technology', label: 'Technology' },
                { id: 'store', label: 'Store' },
                { id: 'logs', label: 'Logs' },
                { id: 'settings', label: 'Settings' },
              ] as const
            ).map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    minHeight: '42px',
                    padding: '7px 10px',
                    borderRadius: '7px',
                    background: isSelected
                      ? 'linear-gradient(180deg, #ba8d3c 0%, #7d591f 100%)'
                      : 'linear-gradient(180deg, #163336 0%, #0f2427 100%)',
                    borderTop: isSelected ? '1.5px solid #fef08a' : '1px solid #2b4d52',
                    borderLeft: isSelected ? '1.5px solid #fef08a' : '1px solid #2b4d52',
                    borderRight: isSelected ? '1.5px solid #fef08a' : '1px solid #2b4d52',
                    borderBottom: isSelected ? '3px solid #452e0c' : '2.5px solid #081517',
                    color: isSelected ? '#fffbeb' : '#d6d3c9',
                    font: "700 13px 'Plus Jakarta Sans', sans-serif",
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                    {renderSidebarGlyph(tab.id)}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </aside>

          {/* Right Ornate Emerald & Parchment Content Frame */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              padding: '12px',
              background: 'linear-gradient(180deg, #0d3a35 0%, #092623 100%)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                flex: 1,
                minHeight: 0,
                background: 'linear-gradient(180deg, #dfd2bc 0%, #cbbba0 100%)',
                border: '2.5px solid #d4af37',
                borderRadius: '10px',
                padding: '12px 16px',
                overflowY: 'auto',
                color: '#2c1f10',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {/* TAB 1: OVERVIEW (Matches Reference Screenshot Composition) */}
              {activeTab === 'overview' && (
                <>
                  <div
                    style={{
                      textAlign: 'center',
                      font: "700 16px 'Cinzel', serif",
                      color: '#3a2713',
                      borderBottom: '1px solid rgba(92, 68, 36, 0.25)',
                      paddingBottom: '5px',
                    }}
                  >
                    Alliance Overview
                  </div>

                  {/* Two-Column Upper Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: '14px',
                      alignItems: 'start',
                    }}
                  >
                    {/* Left Column: Crest + DONATE + Level + Resources + Buffs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Heraldic Griffin Crest & Alliance Title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Sculpted Griffin & Shield Crest */}
                        <div
                          style={{
                            width: '78px',
                            height: '82px',
                            minWidth: '78px',
                            borderRadius: '10px',
                            background: 'radial-gradient(circle at 50% 40%, #1d4d3e 0%, #091d1a 100%)',
                            border: '2px solid #d4af37',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          <svg width="62" height="64" viewBox="0 0 64 64" fill="none">
                            <path d="M12 20L6 10L18 14L22 8L24 22Z" fill="#d4af37" />
                            <path d="M52 20L58 10L46 14L42 8L40 22Z" fill="#d4af37" />
                            <polygon points="32,12 49,19 45,42 32,54 19,42 15,19" fill="#0d6e4e" stroke="#facc15" strokeWidth="2.4" />
                            <polygon points="32,20 39,28 36,39 32,45 28,39 25,28" fill="#fde047" />
                            <polygon points="32,6 36,11 32,16 28,11" fill="#34d399" stroke="#fef08a" strokeWidth="1" />
                          </svg>
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              font: "800 18px 'Plus Jakarta Sans', sans-serif",
                              color: '#2c1c0b',
                              lineHeight: 1.15,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            [{playerAlliance.tag}] {playerAlliance.alias}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#4e3a21',
                              marginTop: '3px',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            Rank: 1st | Members: {allianceMemberCastles.length}/100 | Power:{' '}
                            {formatCompactPower(territoryStats.totalPower)}
                          </div>
                          <div style={{ marginTop: '7px', position: 'relative' }}>
                            <button
                              type="button"
                              onClick={() => setIsDonateMenuOpen((o) => !o)}
                              style={{
                                width: '100%',
                                maxWidth: '185px',
                                minHeight: '34px',
                                borderRadius: '6px',
                                background: 'linear-gradient(180deg, #dfbb5b 0%, #a57822 100%)',
                                borderTop: '1.5px solid #fef08a',
                                borderLeft: '1.5px solid #fde047',
                                borderRight: '1.5px solid #fde047',
                                borderBottom: '3px solid #593b0a',
                                color: '#281805',
                                font: "900 14px 'Cinzel', serif",
                                letterSpacing: '0.08em',
                                cursor: 'pointer',
                                boxShadow: '0 3px 8px rgba(0,0,0,0.28)',
                              }}
                            >
                              DONATE
                            </button>

                            {isDonateMenuOpen && (
                              <div
                                style={{
                                  marginTop: '6px',
                                  background: '#17292a',
                                  border: '1.5px solid #d4af37',
                                  borderRadius: '8px',
                                  padding: '8px',
                                  display: 'flex',
                                  gap: '6px',
                                  flexWrap: 'wrap',
                                }}
                              >
                                {(
                                  [
                                    { type: 'gold', amount: 500, label: '+500 Gold' },
                                    { type: 'wood', amount: 2500, label: '+2.5K Wood' },
                                    { type: 'stone', amount: 2500, label: '+2.5K Stone' },
                                  ] as const
                                ).map((opt) => (
                                  <button
                                    key={opt.type}
                                    type="button"
                                    onClick={() => handleDonate(opt.type, opt.amount)}
                                    style={{
                                      flex: 1,
                                      padding: '5px 8px',
                                      borderRadius: '5px',
                                      background: '#926a22',
                                      border: '1px solid #fde047',
                                      color: '#fefce8',
                                      font: "700 11px 'Barlow Condensed', sans-serif",
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Alliance Level Bar */}
                      <div
                        style={{
                          background: '#b6a183',
                          border: '1px solid #8a7048',
                          borderRadius: '7px',
                          padding: '7px 10px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            font: "700 13px 'Plus Jakarta Sans', sans-serif",
                            color: '#2b1c0b',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          <span>Alliance Level: {allianceLevel}</span>
                          <span>{allianceLevel + 1}</span>
                        </div>
                        <div
                          style={{
                            marginTop: '5px',
                            height: '10px',
                            borderRadius: '4px',
                            background: '#2a2219',
                            border: '1px solid #6b532c',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${allianceXpPct}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #b45309, #facc15)',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>

                      {/* Alliance Resources Row */}
                      <div
                        style={{
                          background: '#b6a183',
                          border: '1px solid #8a7048',
                          borderRadius: '7px',
                          padding: '8px 10px',
                        }}
                      >
                        <div
                          style={{
                            font: "700 13px 'Plus Jakarta Sans', sans-serif",
                            color: '#2b1c0b',
                            marginBottom: '5px',
                          }}
                        >
                          Alliance Resources
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            flexWrap: 'wrap',
                            font: "700 12.5px 'Barlow Condensed', sans-serif",
                            fontVariantNumeric: 'tabular-nums',
                            color: '#211508',
                          }}
                        >
                          <span>🌾 {(treasury.food / 1000).toFixed(1)}K</span>
                          <span>🌲 {(treasury.wood / 1000).toFixed(1)}K</span>
                          <span>🪨 {(treasury.stone / 1000).toFixed(1)}K</span>
                          <span>🪙 {(treasury.gold / 1000).toFixed(1)}K</span>
                          <span>💎 {treasury.gems}</span>
                        </div>
                      </div>

                      {/* Alliance Buffs Card */}
                      <div
                        style={{
                          background: '#b6a183',
                          border: '1px solid #8a7048',
                          borderRadius: '7px',
                          padding: '8px 10px',
                        }}
                      >
                        <div
                          style={{
                            font: "700 13px 'Plus Jakarta Sans', sans-serif",
                            color: '#2b1c0b',
                            marginBottom: '6px',
                          }}
                        >
                          Alliance Buffs
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12.5px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#2b1c0b' }}>
                            <span>🌿</span>
                            <span>Gathering Speed</span>
                            <span style={{ color: '#14532d' }}>+{territoryStats.gatheringBuff}%</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#2b1c0b' }}>
                            <span>🔨</span>
                            <span>Construction Speed</span>
                            <span style={{ color: '#14532d' }}>+{territoryStats.constructionBuff}%</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#2b1c0b' }}>
                            <span>⚔️</span>
                            <span>Troop Attack</span>
                            <span style={{ color: '#14532d' }}>+{territoryStats.attackBuff}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Interactive Territory Preview Map + Recent Activity */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div
                        style={{
                          background: '#b6a183',
                          border: '1px solid #8a7048',
                          borderRadius: '7px',
                          padding: '8px 10px',
                        }}
                      >
                        <div
                          style={{
                            font: "700 13.5px 'Plus Jakarta Sans', sans-serif",
                            color: '#2b1c0b',
                            marginBottom: '6px',
                          }}
                        >
                          Alliance Territory
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('territory')}
                          title="Inspect Alliance Territory & Held Shrines"
                          style={{
                            width: '100%',
                            padding: 0,
                            border: '1.5px solid #6e552f',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            background: '#243c2c',
                            cursor: 'pointer',
                            display: 'block',
                          }}
                        >
                          <svg viewBox="0 0 320 138" style={{ width: '100%', height: 'auto', display: 'block' }}>
                            <rect width="320" height="138" fill="#2c4a34" />
                            <polygon points="160,12 275,69 160,126 45,69" fill="#3a6b43" stroke="#d4af37" strokeWidth="1.5" />
                            <polygon points="160,12 205,69 160,126 115,69" fill="#38778c" opacity="0.55" />
                            <polygon points="45,69 115,69 160,126" fill="#9a6b39" opacity="0.6" />
                            <line x1="160" y1="22" x2="160" y2="116" stroke="#f8fafc" strokeWidth="1.5" strokeDasharray="3 3" />
                            <line x1="82" y1="69" x2="238" y2="69" stroke="#f8fafc" strokeWidth="1.5" strokeDasharray="3 3" />
                            <circle cx="160" cy="24" r="6" fill="#dc2626" stroke="#fef08a" strokeWidth="1.4" />
                            <circle cx="160" cy="114" r="6" fill="#dc2626" stroke="#fef08a" strokeWidth="1.4" />
                            <circle cx="105" cy="52" r="6" fill="#eab308" stroke="#fff" strokeWidth="1.4" />
                            <circle cx="215" cy="52" r="6" fill="#059669" stroke="#fff" strokeWidth="1.4" />
                            <circle cx="160" cy="69" r="8" fill={territoryStats.hasCongress ? '#10b981' : '#0284c7'} stroke="#fef08a" strokeWidth="2" />
                          </svg>
                          <div
                            style={{
                              background: '#172d2f',
                              color: '#fefce8',
                              padding: '5px 8px',
                              font: "700 11.5px 'Plus Jakarta Sans', sans-serif",
                              fontVariantNumeric: 'tabular-nums',
                              textAlign: 'center',
                            }}
                          >
                            Control Points: {territoryStats.controlPoints} | Total Area: {territoryStats.areaKm2}Km²
                          </div>
                        </button>
                      </div>

                      {/* Recent Activity Feed */}
                      <div
                        style={{
                          background: '#b6a183',
                          border: '1px solid #8a7048',
                          borderRadius: '7px',
                          padding: '8px 10px',
                        }}
                      >
                        <div
                          style={{
                            font: "700 13.5px 'Plus Jakarta Sans', sans-serif",
                            color: '#2b1c0b',
                            marginBottom: '6px',
                          }}
                        >
                          Recent Activity
                        </div>
                        <div
                          style={{
                            maxHeight: '112px',
                            overflowY: 'auto',
                            background: '#223839',
                            border: '1px solid #594426',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '5px',
                          }}
                        >
                          {logs.slice(0, 6).map((item) => (
                            <div key={item.id} style={{ fontSize: '12px', color: '#f1f5f9', lineHeight: 1.35 }}>
                              <span style={{ color: '#94a3b8' }}>[{item.timeLabel}]</span>{' '}
                              <span style={{ color: item.accent || '#fde047' }}>{item.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Full-Width Alliance Announcements Banner */}
                  <div
                    style={{
                      background: '#b6a183',
                      border: '1px solid #8a7048',
                      borderRadius: '7px',
                      padding: '8px 10px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '5px',
                      }}
                    >
                      <span style={{ font: "700 13.5px 'Plus Jakarta Sans', sans-serif", color: '#2b1c0b' }}>
                        Alliance Announcements
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('settings')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#5c3c13',
                          font: "700 11.5px 'Plus Jakarta Sans', sans-serif",
                          textDecoration: 'underline',
                          cursor: 'pointer',
                        }}
                      >
                        Edit in Settings
                      </button>
                    </div>
                    <div
                      style={{
                        background: '#223839',
                        border: '1px solid #594426',
                        borderRadius: '6px',
                        padding: '9px 12px',
                        color: '#f8fafc',
                        fontSize: '12.5px',
                        lineHeight: 1.45,
                      }}
                    >
                      {announcement}
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: MEMBERS */}
              {activeTab === 'members' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ font: "700 15px 'Cinzel', serif", color: '#2b1c0b' }}>
                      Allied Vanguard Castles ({allianceMemberCastles.length})
                    </span>
                    <span style={{ font: "700 12px 'Barlow Condensed', sans-serif", color: '#4e3a21', fontVariantNumeric: 'tabular-nums' }}>
                      Combined Power: {territoryStats.totalPower.toLocaleString()} ⚡
                    </span>
                  </div>
                  {allianceMemberCastles.map((mc) => (
                    <div
                      key={mc.id}
                      style={{
                        background: mc.isMyCastle ? '#173e39' : '#1b3134',
                        border: mc.isMyCastle ? '1.5px solid #eab308' : '1px solid #49676b',
                        borderRadius: '8px',
                        padding: '9px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                        color: '#f8fafc',
                      }}
                    >
                      <div>
                        <div style={{ font: "700 14px 'Plus Jakarta Sans', sans-serif", color: mc.isMyCastle ? '#fef08a' : '#bae6fd' }}>
                          [{playerAlliance.tag}] {mc.owner} · {mc.name} (Lv.{mc.level})
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
                          {mc.isMyCastle ? 'R5 Alliance Monarch' : 'R4 Vanguard Lord'} · [X:{Math.round(mc.position[0])}, Y:{Math.round(mc.position[2])}] · Power: {mc.power.toLocaleString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onPanTo(mc.position[0], mc.position[2]);
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: '#0369a1',
                            border: '1px solid #7dd3fc',
                            color: '#fff',
                            font: "700 11.5px 'Barlow Condensed', sans-serif",
                            cursor: 'pointer',
                          }}
                        >
                          Jump 📍
                        </button>
                        {!mc.isMyCastle && (
                          <button
                            type="button"
                            onClick={() => {
                              setHonorCoins((h) => h + 100);
                              onGrantReward?.('gold', 250, `Alliance Aid to ${mc.owner}`);
                              pushLog(`Dispatched Vanguard aid to ${mc.owner}`, '#34d399');
                            }}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: '#15803d',
                              border: '1px solid #86efac',
                              color: '#fff',
                              font: "700 11.5px 'Barlow Condensed', sans-serif",
                              cursor: 'pointer',
                            }}
                          >
                            Support +250g
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: TERRITORY */}
              {activeTab === 'territory' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div
                    style={{
                      background: '#172e30',
                      border: '1.5px solid #d4af37',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      color: '#f8fafc',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <div style={{ font: "700 14px 'Cinzel', serif", color: '#fef08a' }}>
                        Held Shrines: {shrineRuleStatus.totalShrinesHeld} / {shrineRuleStatus.maxShrinesPerAlliance}
                      </div>
                      <div style={{ fontSize: '12px', color: '#a7f3d0', fontVariantNumeric: 'tabular-nums' }}>
                        Congress Unlock Progress: Shrine C {shrineRuleStatus.heldByTier.shrine_c}/2 · Shrine B {shrineRuleStatus.heldByTier.shrine_b}/1 · Shrine A {shrineRuleStatus.heldByTier.shrine_a}/1
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onPanTo(1600, 1600);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: '#b45309',
                          border: '1px solid #fde047',
                          color: '#fefce8',
                          font: "700 12px 'Barlow Condensed', sans-serif",
                          cursor: 'pointer',
                        }}
                      >
                        The Congress [1600, 1600]
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenCommandHub('shrines');
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: '#0369a1',
                          border: '1px solid #7dd3fc',
                          color: '#fff',
                          font: "700 12px 'Barlow Condensed', sans-serif",
                          cursor: 'pointer',
                        }}
                      >
                        Shrines Hub ↗
                      </button>
                    </div>
                  </div>

                  {heldPlots.length === 0 ? (
                    <div
                      style={{
                        background: '#1b3134',
                        border: '1px solid #49676b',
                        borderRadius: '8px',
                        padding: '14px',
                        color: '#cbd5e1',
                        fontSize: '12.5px',
                      }}
                    >
                      [{playerAlliance.tag}] {playerAlliance.alias} currently holds 0 Crystal Shrines. March to any Shrine C, B, or A across Continent 1 to claim alliance buffs.
                    </div>
                  ) : (
                    heldPlots.map((plot) => {
                      const gar = shrineGarrisons[plot.id];
                      const stacks = [...(gar?.playerStacks || []), ...(gar?.allianceReinforcements || [])];
                      const gMetrics = calculateArmyMetrics(stacks, balanceConfig, bonuses);
                      return (
                        <div
                          key={plot.id}
                          style={{
                            background: '#1b3134',
                            border: '1px solid #d4af37',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            color: '#f8fafc',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '10px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div>
                            <div style={{ font: "700 14px 'Plus Jakarta Sans', sans-serif", color: '#fef08a' }}>
                              {plot.name} ({plot.type.toUpperCase()})
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
                              [{Math.round(plot.position[0])}, {Math.round(plot.position[2])}] · Garrison Power: {gMetrics.totalPower.toLocaleString()}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onPanTo(plot.position[0], plot.position[2]);
                              }}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                background: '#0369a1',
                                border: '1px solid #7dd3fc',
                                color: '#fff',
                                font: "700 11.5px 'Barlow Condensed'",
                                cursor: 'pointer',
                              }}
                            >
                              Jump
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenCommandHub(plot.type === 'congress' ? 'congress' : 'shrines', plot.id);
                              }}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                background: '#15803d',
                                border: '1px solid #86efac',
                                color: '#fff',
                                font: "700 11.5px 'Barlow Condensed'",
                                cursor: 'pointer',
                              }}
                            >
                              Manage
                            </button>
                            {plot.type !== 'congress' && (
                              <button
                                type="button"
                                onClick={() => onRelinquishStructure(plot.id)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  background: '#991b1b',
                                  border: '1px solid #fca5a5',
                                  color: '#fff',
                                  font: "700 11.5px 'Barlow Condensed'",
                                  cursor: 'pointer',
                                }}
                              >
                                Relinquish
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Rival Enemy Castles List */}
                  <div style={{ font: "700 14px 'Cinzel', serif", color: '#451a03', marginTop: '4px' }}>
                    Rival Strongholds ({enemyCastles.length})
                  </div>
                  {enemyCastles.slice(0, 5).map((ec) => (
                    <div
                      key={ec.id}
                      style={{
                        background: '#3d1919',
                        border: '1px solid #f87171',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: '#fecaca',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: '12.5px', fontWeight: 700 }}>
                        {ec.allianceTag} {ec.owner} · {ec.name} (Lv.{ec.level})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onPanTo(ec.position[0], ec.position[2]);
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          background: '#dc2626',
                          border: '1px solid #fecaca',
                          color: '#fff',
                          font: "700 11.5px 'Barlow Condensed'",
                          cursor: 'pointer',
                        }}
                      >
                        Scout / Attack
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: TECHNOLOGY */}
              {activeTab === 'technology' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  <div style={{ font: "700 15px 'Cinzel', serif", color: '#2b1c0b' }}>
                    Alliance Military & Economic Doctrines
                  </div>
                  {techNodes.map((tech) => (
                    <div
                      key={tech.id}
                      style={{
                        background: '#1b3134',
                        border: '1.5px solid #49676b',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        color: '#f8fafc',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ font: "700 14.5px 'Plus Jakarta Sans', sans-serif", color: '#fef08a' }}>
                          {tech.name} · Lv.{tech.level}/{tech.maxLevel}
                        </div>
                        <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
                          {tech.desc}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#86efac', marginTop: '3px', fontWeight: 700 }}>
                          Current Buff: +{(tech.level * tech.bonusPerLevel).toFixed(1)}%
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={tech.level >= tech.maxLevel}
                        onClick={() => handleUpgradeTech(tech.id)}
                        style={{
                          minHeight: '36px',
                          padding: '6px 14px',
                          borderRadius: '7px',
                          background:
                            tech.level >= tech.maxLevel
                              ? '#334155'
                              : 'linear-gradient(180deg, #dfbb5b, #a57822)',
                          border: '1px solid #fef08a',
                          color: tech.level >= tech.maxLevel ? '#94a3b8' : '#281805',
                          font: "800 12.5px 'Barlow Condensed', sans-serif",
                          cursor: tech.level >= tech.maxLevel ? 'default' : 'pointer',
                        }}
                      >
                        {tech.level >= tech.maxLevel
                          ? 'MAXED'
                          : `RESEARCH (${tech.costGold.toLocaleString()} GOLD)`}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 5: STORE */}
              {activeTab === 'store' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ font: "700 15px 'Cinzel', serif", color: '#2b1c0b' }}>
                      Alliance Honor Quartermaster
                    </span>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: '#1b3134',
                        border: '1px solid #d4af37',
                        color: '#fef08a',
                        font: "800 13px 'Barlow Condensed', sans-serif",
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      Honor Coins: {honorCoins.toLocaleString()}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    {[
                      { name: 'Deodar Timber Bundle (+15K Wood)', cost: 400, type: 'wood' as const, amount: 15000 },
                      { name: 'Granite Fortress Crate (+15K Stone)', cost: 400, type: 'stone' as const, amount: 15000 },
                      { name: 'Gorkha Meteoric Iron (+12K Iron)', cost: 450, type: 'iron' as const, amount: 12000 },
                      { name: 'Imperial Gold Coffer (+5K Gold)', cost: 600, type: 'gold' as const, amount: 5000 },
                      { name: 'Arcane Shrine Gem Reliquary (+120 Gems)', cost: 900, type: 'gems' as const, amount: 120 },
                    ].map((item) => (
                      <div
                        key={item.name}
                        style={{
                          background: '#1b3134',
                          border: '1.5px solid #49676b',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          color: '#f8fafc',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '8px',
                        }}
                      >
                        <div style={{ font: "700 13.5px 'Plus Jakarta Sans', sans-serif", color: '#fef08a' }}>
                          {item.name}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleBuyStoreItem(item.name, item.cost, item.type, item.amount)}
                          style={{
                            minHeight: '34px',
                            borderRadius: '6px',
                            background: 'linear-gradient(180deg, #16a34a, #15803d)',
                            border: '1px solid #86efac',
                            color: '#fff',
                            font: "800 12.5px 'Barlow Condensed', sans-serif",
                            cursor: 'pointer',
                          }}
                        >
                          BUY · {item.cost} HONOR
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 6: LOGS */}
              {activeTab === 'logs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ font: "700 15px 'Cinzel', serif", color: '#2b1c0b' }}>
                    Alliance Chronicle Ledger
                  </div>
                  <div
                    style={{
                      background: '#1b3134',
                      border: '1.5px solid #49676b',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '7px',
                    }}
                  >
                    {logs.map((entry) => (
                      <div
                        key={entry.id}
                        style={{
                          fontSize: '12.5px',
                          color: '#f1f5f9',
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          paddingBottom: '5px',
                        }}
                      >
                        <span style={{ color: '#94a3b8' }}>[{entry.timeLabel}]</span>{' '}
                        <span style={{ color: entry.accent || '#fde047' }}>{entry.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 7: SETTINGS */}
              {activeTab === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      background: '#1b3134',
                      border: '1.5px solid #49676b',
                      borderRadius: '8px',
                      padding: '12px',
                      color: '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ font: "700 14px 'Cinzel', serif", color: '#fef08a' }}>
                      Alliance Tag (4 Chars) & 4-Word Alias
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        maxLength={4}
                        value={tagDraft}
                        onChange={(e) =>
                          setTagDraft(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4))
                        }
                        style={{
                          width: '82px',
                          minHeight: '36px',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          background: '#091517',
                          border: '1px solid #d4af37',
                          color: '#fef08a',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                        }}
                      />
                      <input
                        type="text"
                        value={aliasDraft}
                        onChange={(e) => setAliasDraft(e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: '200px',
                          minHeight: '36px',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          background: '#091517',
                          border: '1px solid #d4af37',
                          color: '#f8fafc',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const ok = onUpdateAllianceIdentity(normalizeAllianceTag(tagDraft), aliasDraft);
                          if (ok) {
                            pushLog(`Updated Alliance Identity to [${normalizeAllianceTag(tagDraft)}]`, '#34d399');
                          }
                        }}
                        style={{
                          minHeight: '36px',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          background: '#15803d',
                          border: '1px solid #86efac',
                          color: '#fff',
                          font: "700 12.5px 'Barlow Condensed', sans-serif",
                          cursor: 'pointer',
                        }}
                      >
                        Save Identity
                      </button>
                    </div>
                    {(() => {
                      const check = validateAllianceAlias(aliasDraft);
                      return (
                        <div style={{ fontSize: '11.5px', color: check.valid ? '#86efac' : '#fca5a5' }}>
                          {check.valid
                            ? `Active Badge: [${normalizeAllianceTag(tagDraft)}] ${check.normalized}`
                            : check.error}
                        </div>
                      );
                    })()}
                  </div>

                  <div
                    style={{
                      background: '#1b3134',
                      border: '1.5px solid #49676b',
                      borderRadius: '8px',
                      padding: '12px',
                      color: '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ font: "700 14px 'Cinzel', serif", color: '#fef08a' }}>
                      Alliance Announcements & Recruitment
                    </div>
                    <textarea
                      rows={3}
                      value={announcementDraft}
                      onChange={(e) => setAnnouncementDraft(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: '#091517',
                        border: '1px solid #594426',
                        color: '#f8fafc',
                        fontSize: '12.5px',
                        resize: 'vertical',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {(['open', 'approval'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setRecruitmentPolicy(mode)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: recruitmentPolicy === mode ? '#0369a1' : '#0f1f22',
                              border: recruitmentPolicy === mode ? '1px solid #7dd3fc' : '1px solid #355459',
                              color: '#f8fafc',
                              font: "700 12px 'Barlow Condensed', sans-serif",
                              cursor: 'pointer',
                            }}
                          >
                            {mode === 'open' ? 'Open Recruitment' : 'Approval Required'}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAnnouncement(announcementDraft.trim() || announcement);
                          pushLog('Updated Alliance Announcements', '#fde047');
                          onShowToast?.('Alliance Announcements saved!');
                        }}
                        style={{
                          minHeight: '34px',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          background: 'linear-gradient(180deg, #dfbb5b, #a57822)',
                          border: '1px solid #fef08a',
                          color: '#281805',
                          font: "800 12.5px 'Barlow Condensed', sans-serif",
                          cursor: 'pointer',
                        }}
                      >
                        Publish Announcement
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
