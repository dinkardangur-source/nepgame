import React, { useMemo, useState } from 'react';
import { InfantryGearState, PlayerResources, TroopInventory } from '../game/NepaleseBalanceConfig';
import type { CommandHubTab } from './CommandHubDrawer';

export type QuestBoardCategory = 'daily' | 'main' | 'side' | 'achievements' | 'events';

export interface QuestBoardItem {
  id: string;
  category: QuestBoardCategory;
  title: string;
  desc: string;
  progress: number;
  target: number;
  unitLabel?: string;
  activityPoints: number;
  rewards: Array<{
    type: 'gold' | 'gems' | 'wood' | 'stone' | 'iron' | 'food' | 'chest' | 'speedup' | 'power';
    amount: number;
  }>;
  goAction?:
    | 'enter_kingdom'
    | 'open_worldmap'
    | 'relocate'
    | 'filter_3d'
    | 'open_barracks'
    | 'open_research'
    | 'open_shrines'
    | 'open_search_wood'
    | 'open_search_monster'
    | 'open_gear';
  claimed: boolean;
}

interface QuestBoardModalProps {
  isOpen: boolean;
  initialCategory?: QuestBoardCategory;
  onClose: () => void;
  resources: PlayerResources;
  troopInventory: TroopInventory;
  standingPower: number;
  shrinesHeldCount: number;
  hasCongress: boolean;
  battleReportsCount: number;
  activeMarchesCount: number;
  isStrategicFilterActive: boolean;
  infantryGear?: InfantryGearState;
  onGrantReward?: (
    type: 'wood' | 'stone' | 'iron' | 'food' | 'crystal' | 'gold' | 'gems',
    amount: number,
    label: string
  ) => void;
  onShowToast?: (msg: string) => void;
  onExecuteGoAction: (action: NonNullable<QuestBoardItem['goAction']>) => void;
  onOpenCommandHub: (tab: CommandHubTab) => void;
  onUnclaimedCountChange?: (count: number) => void;
}

const DAILY_MILESTONES = [20, 40, 60, 80, 100] as const;

export const QuestBoardModal: React.FC<QuestBoardModalProps> = ({
  isOpen,
  initialCategory = 'daily',
  onClose,
  resources,
  troopInventory,
  standingPower,
  shrinesHeldCount,
  hasCongress,
  battleReportsCount,
  activeMarchesCount,
  isStrategicFilterActive,
  infantryGear,
  onGrantReward,
  onShowToast,
  onExecuteGoAction,
  onUnclaimedCountChange,
}) => {
  const [activeTab, setActiveTab] = useState<QuestBoardCategory>(initialCategory);
  const [claimedQuestIds, setClaimedQuestIds] = useState<Record<string, boolean>>({});
  const [claimedChestMilestones, setClaimedChestMilestones] = useState<Record<number, boolean>>({});
  const [bonusActivityPoints, setBonusActivityPoints] = useState<number>(35);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialCategory);
    }
  }, [isOpen, initialCategory]);

  const totalInfantry = useMemo(
    () =>
      (troopInventory.infantry?.[1] || 0) +
      (troopInventory.infantry?.[2] || 0) +
      (troopInventory.infantry?.[3] || 0) +
      (troopInventory.infantry?.[4] || 0) +
      (troopInventory.infantry?.[5] || 0),
    [troopInventory]
  );

  const totalGearLevel = useMemo(() => {
    if (!infantryGear) return 0;
    return Object.values(infantryGear).reduce((sum, lv) => sum + (Number(lv) || 0), 0);
  }, [infantryGear]);

  const allQuests = useMemo<QuestBoardItem[]>(() => {
    const items: QuestBoardItem[] = [
      // DAILY QUESTS
      {
        id: 'dq-train-infantry',
        category: 'daily',
        title: 'Train 500 Magar Infantry',
        desc: 'Muster Magar shield-bearers inside your Barracks to bolster frontline defense.',
        progress: Math.min(500, totalInfantry),
        target: 500,
        activityPoints: 25,
        rewards: [
          { type: 'gold', amount: 800 },
          { type: 'gems', amount: 15 },
          { type: 'speedup', amount: 10 },
        ],
        goAction: 'open_barracks',
        claimed: Boolean(claimedQuestIds['dq-train-infantry']),
      },
      {
        id: 'dq-gather-wood',
        category: 'daily',
        title: 'Gather 100K Deodar Wood',
        desc: 'Harvest Himalayan timber groves or stockpile 100,000 Wood in My Castle vault.',
        progress: Math.min(100000, resources.wood),
        target: 100000,
        activityPoints: 20,
        rewards: [
          { type: 'gold', amount: 600 },
          { type: 'gems', amount: 12 },
          { type: 'chest', amount: 1 },
        ],
        goAction: 'open_search_wood',
        claimed: Boolean(claimedQuestIds['dq-gather-wood']),
      },
      {
        id: 'dq-barracks-tier',
        category: 'daily',
        title: 'Build Vanguard Force (10,000+ Power)',
        desc: 'Equip Infantry Gear and expand your standing battalion above 10,000 Combat Power.',
        progress: Math.min(10000, standingPower),
        target: 10000,
        activityPoints: 20,
        rewards: [
          { type: 'iron', amount: 15000 },
          { type: 'chest', amount: 1 },
          { type: 'power', amount: 20 },
        ],
        goAction: 'open_gear',
        claimed: Boolean(claimedQuestIds['dq-barracks-tier']),
      },
      {
        id: 'dq-shrine-filter',
        category: 'daily',
        title: 'Survey 3D Crystal Shrine Network',
        desc: 'Activate the Strategic 3D Map Filter or dispatch a scout column onto the continent.',
        progress: isStrategicFilterActive || activeMarchesCount > 0 ? 1 : 0,
        target: 1,
        activityPoints: 20,
        rewards: [
          { type: 'stone', amount: 18000 },
          { type: 'gems', amount: 25 },
          { type: 'gold', amount: 1200 },
        ],
        goAction: 'filter_3d',
        claimed: Boolean(claimedQuestIds['dq-shrine-filter']),
      },
      {
        id: 'dq-monster-hunt',
        category: 'daily',
        title: 'Hunt Himalayan Frontier Beasts',
        desc: 'Engage Goblins, Orcs, Death Knights, or Drago World Boss on Continent 1.',
        progress: Math.min(1, battleReportsCount),
        target: 1,
        activityPoints: 25,
        rewards: [
          { type: 'gold', amount: 1500 },
          { type: 'gems', amount: 30 },
          { type: 'speedup', amount: 5 },
        ],
        goAction: 'open_search_monster',
        claimed: Boolean(claimedQuestIds['dq-monster-hunt']),
      },

      // MAIN QUESTS
      {
        id: 'mq-citadel-merge',
        category: 'main',
        title: 'Forge the 3D Walled Imperial Citadel',
        desc: 'Enter Inside Kingdom and merge matching Barracks, Watchtowers, and Resource Mills.',
        progress: 1,
        target: 1,
        activityPoints: 0,
        rewards: [
          { type: 'gold', amount: 6000 },
          { type: 'gems', amount: 120 },
          { type: 'chest', amount: 2 },
        ],
        goAction: 'enter_kingdom',
        claimed: Boolean(claimedQuestIds['mq-citadel-merge']),
      },
      {
        id: 'mq-congress-recon',
        category: 'main',
        title: 'Reconnoiter The Congress & 36 Shrines',
        desc: 'Inspect The Congress at [1600, 1600] alongside Shrines A1–A4, B1–B12, and C1–C20.',
        progress: 1,
        target: 1,
        activityPoints: 0,
        rewards: [
          { type: 'stone', amount: 20000 },
          { type: 'gems', amount: 100 },
          { type: 'wood', amount: 20000 },
        ],
        goAction: 'open_worldmap',
        claimed: Boolean(claimedQuestIds['mq-congress-recon']),
      },
      {
        id: 'mq-capture-shrine',
        category: 'main',
        title: 'Claim 2 Crystal Shrines for Alliance',
        desc: 'Conquer Shrine C, B, or A citadels to unlock passive Attack, Speed, and Yield buffs.',
        progress: Math.min(2, shrinesHeldCount),
        target: 2,
        activityPoints: 0,
        rewards: [
          { type: 'gold', amount: 12000 },
          { type: 'gems', amount: 200 },
          { type: 'power', amount: 50 },
        ],
        goAction: 'open_shrines',
        claimed: Boolean(claimedQuestIds['mq-capture-shrine']),
      },

      // SIDE QUESTS
      {
        id: 'sq-infantry-gear',
        category: 'side',
        title: 'Tempered Gorkha Panoply (Gear Lv.6+)',
        desc: 'Upgrade your 6 Infantry Gear slots to enhance shield resilience and sword attack.',
        progress: Math.min(6, totalGearLevel),
        target: 6,
        activityPoints: 0,
        rewards: [
          { type: 'iron', amount: 22000 },
          { type: 'gems', amount: 75 },
          { type: 'chest', amount: 1 },
        ],
        goAction: 'open_gear',
        claimed: Boolean(claimedQuestIds['sq-infantry-gear']),
      },
      {
        id: 'sq-alliance-castles',
        category: 'side',
        title: 'Coordinate 10 Alliance Strongholds',
        desc: 'Survey or relocate allied strongholds across the 3200×3200 Himalayan continent.',
        progress: 10,
        target: 10,
        activityPoints: 0,
        rewards: [
          { type: 'wood', amount: 24000 },
          { type: 'gems', amount: 90 },
          { type: 'gold', amount: 4500 },
        ],
        goAction: 'relocate',
        claimed: Boolean(claimedQuestIds['sq-alliance-castles']),
      },
      {
        id: 'sq-royal-research',
        category: 'side',
        title: 'Advance Royal Academy Doctrine',
        desc: 'Unlock strategic military and gathering doctrines in the Royal Academy.',
        progress: 1,
        target: 1,
        activityPoints: 0,
        rewards: [
          { type: 'food', amount: 25000 },
          { type: 'gems', amount: 60 },
          { type: 'speedup', amount: 8 },
        ],
        goAction: 'open_research',
        claimed: Boolean(claimedQuestIds['sq-royal-research']),
      },

      // ACHIEVEMENTS
      {
        id: 'ach-power-titan',
        category: 'achievements',
        title: 'Vanguard Warlord · 50K Combat Power',
        desc: 'Amass 50,000 Standing Army Power across Magar, Limbu, and Thakuri regiments.',
        progress: Math.min(50000, standingPower),
        target: 50000,
        activityPoints: 0,
        rewards: [
          { type: 'gold', amount: 15000 },
          { type: 'gems', amount: 250 },
          { type: 'power', amount: 100 },
        ],
        goAction: 'open_barracks',
        claimed: Boolean(claimedQuestIds['ach-power-titan']),
      },
      {
        id: 'ach-slayer',
        category: 'achievements',
        title: 'Bane of the Glacial Beasts',
        desc: 'Record 3 victorious field engagements against frontier monsters or rival keeps.',
        progress: Math.min(3, battleReportsCount),
        target: 3,
        activityPoints: 0,
        rewards: [
          { type: 'gold', amount: 10000 },
          { type: 'gems', amount: 160 },
          { type: 'chest', amount: 2 },
        ],
        goAction: 'open_search_monster',
        claimed: Boolean(claimedQuestIds['ach-slayer']),
      },
      {
        id: 'ach-congress-sovereign',
        category: 'achievements',
        title: 'Sovereign of The Congress',
        desc: 'Hold 2 C Shrines, 1 B Shrine, and 1 A Shrine to seize The Congress [1600, 1600].',
        progress: hasCongress ? 1 : 0,
        target: 1,
        activityPoints: 0,
        rewards: [
          { type: 'gold', amount: 50000 },
          { type: 'gems', amount: 500 },
          { type: 'chest', amount: 5 },
        ],
        goAction: 'open_shrines',
        claimed: Boolean(claimedQuestIds['ach-congress-sovereign']),
      },

      // EVENTS
      {
        id: 'ev-kvk-shrine',
        category: 'events',
        title: 'Shrine Dominion Festival (Limited Event)',
        desc: 'Hold any Sacred Crystal Shrine and collect imperial tribute before the eclipse ends.',
        progress: Math.min(1, shrinesHeldCount),
        target: 1,
        activityPoints: 0,
        rewards: [
          { type: 'gold', amount: 9000 },
          { type: 'gems', amount: 140 },
          { type: 'chest', amount: 2 },
        ],
        goAction: 'open_shrines',
        claimed: Boolean(claimedQuestIds['ev-kvk-shrine']),
      },
      {
        id: 'ev-drago-bounty',
        category: 'events',
        title: 'Drago World Boss Bounty [240, 2960]',
        desc: 'Dispatch an Alliance Rally or Vanguard column to challenge Drago in Southwest Highlands.',
        progress: activeMarchesCount > 0 ? 1 : 0,
        target: 1,
        activityPoints: 0,
        rewards: [
          { type: 'iron', amount: 30000 },
          { type: 'gems', amount: 180 },
          { type: 'speedup', amount: 15 },
        ],
        goAction: 'open_search_monster',
        claimed: Boolean(claimedQuestIds['ev-drago-bounty']),
      },
    ];
    return items;
  }, [
    totalInfantry,
    resources.wood,
    standingPower,
    isStrategicFilterActive,
    activeMarchesCount,
    battleReportsCount,
    shrinesHeldCount,
    totalGearLevel,
    hasCongress,
    claimedQuestIds,
  ]);

  const dailyActivityPoints = useMemo(() => {
    const earned = allQuests
      .filter((q) => q.category === 'daily' && q.claimed)
      .reduce((sum, q) => sum + q.activityPoints, 0);
    return Math.min(100, bonusActivityPoints + earned);
  }, [allQuests, bonusActivityPoints]);

  const tabCounts = useMemo(() => {
    const counts: Record<QuestBoardCategory, number> = {
      daily: 0,
      main: 0,
      side: 0,
      achievements: 0,
      events: 0,
    };
    for (const q of allQuests) {
      if (!q.claimed && q.progress >= q.target) {
        counts[q.category] += 1;
      }
    }
    return counts;
  }, [allQuests]);

  React.useEffect(() => {
    const total =
      tabCounts.daily +
      tabCounts.main +
      tabCounts.side +
      tabCounts.achievements +
      tabCounts.events;
    onUnclaimedCountChange?.(total);
  }, [tabCounts, onUnclaimedCountChange]);

  if (!isOpen) return null;

  const handleClaimQuest = (quest: QuestBoardItem) => {
    if (quest.claimed || quest.progress < quest.target) return;
    setClaimedQuestIds((prev) => ({ ...prev, [quest.id]: true }));

    for (const rew of quest.rewards) {
      if (
        rew.type === 'gold' ||
        rew.type === 'gems' ||
        rew.type === 'wood' ||
        rew.type === 'stone' ||
        rew.type === 'iron' ||
        rew.type === 'food'
      ) {
        onGrantReward?.(rew.type, rew.amount, quest.title);
      } else if (rew.type === 'chest') {
        onGrantReward?.('gold', rew.amount * 1500, `${quest.title} Coffer`);
      } else if (rew.type === 'speedup') {
        onGrantReward?.('gems', rew.amount * 4, `${quest.title} Speedup`);
      }
    }

    if (quest.category === 'daily' && quest.activityPoints > 0) {
      onShowToast?.(`Quest Claimed! +${quest.activityPoints} Daily Activity Points`);
    } else {
      onShowToast?.(`Claimed rewards for "${quest.title}"!`);
    }
  };

  const handleClaimChest = (threshold: number) => {
    if (dailyActivityPoints < threshold) {
      onShowToast?.(`Reach ${threshold} Daily Activity points to unlock this chest!`);
      return;
    }
    if (claimedChestMilestones[threshold]) return;
    setClaimedChestMilestones((prev) => ({ ...prev, [threshold]: true }));
    const goldBonus = threshold * 75;
    const gemBonus = Math.round(threshold * 1.5);
    onGrantReward?.('gold', goldBonus, `Activity ${threshold} Chest`);
    onGrantReward?.('gems', gemBonus, `Activity ${threshold} Chest`);
    onShowToast?.(`Opened ${threshold}-Point Activity Chest! (+${goldBonus.toLocaleString()} Gold & +${gemBonus} Gems)`);
  };

  const renderRewardGlyph = (type: QuestBoardItem['rewards'][number]['type']) => {
    switch (type) {
      case 'gold':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8.5" fill="#eab308" stroke="#fef08a" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="5" fill="#ca8a04" stroke="#fde047" strokeWidth="1" />
          </svg>
        );
      case 'gems':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <polygon points="7,4 17,4 21,10 12,20 3,10" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="1.4" />
            <polygon points="7,4 17,4 12,11" fill="#bae6fd" opacity="0.7" />
          </svg>
        );
      case 'chest':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="8" width="16" height="11" rx="2" fill="#92400e" stroke="#facc15" strokeWidth="1.4" />
            <path d="M4 11H20" stroke="#fde047" strokeWidth="1.5" />
            <rect x="10.5" y="10" width="3" height="4" rx="0.8" fill="#38bdf8" stroke="#fef08a" strokeWidth="0.9" />
          </svg>
        );
      case 'speedup':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M6 6L12 12L6 18M13 6L19 12L13 18" stroke="#e0f2fe" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'power':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <polygon points="12,3 20,7 18,16 12,21 6,16 4,7" fill="#6d28d9" stroke="#facc15" strokeWidth="1.4" />
            <polygon points="12,7 14.5,11.5 12,17 9.5,11.5" fill="#fde047" />
          </svg>
        );
      case 'wood':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <polygon points="12,3 19,12 15,12 20,18 4,18 9,12 5,12" fill="#22c55e" stroke="#bbf7d0" strokeWidth="1.2" />
            <rect x="10.5" y="18" width="3" height="3" fill="#92400e" />
          </svg>
        );
      case 'stone':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <polygon points="5,18 7,7 14,4 19,10 18,19 7,19" fill="#94a3b8" stroke="#f1f5f9" strokeWidth="1.3" />
          </svg>
        );
      case 'iron':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <polygon points="4,15 8,8 20,8 16,15" fill="#60a5fa" stroke="#dbeafe" strokeWidth="1.3" />
            <polygon points="4,15 16,15 15,19 3,19" fill="#2563eb" />
          </svg>
        );
      default:
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 19V5" stroke="#fde047" strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="9" cy="10" rx="2.5" ry="1.4" fill="#fef08a" />
            <ellipse cx="15" cy="13" rx="2.5" ry="1.4" fill="#eab308" />
          </svg>
        );
    }
  };

  const renderSidebarIcon = (cat: QuestBoardCategory) => {
    switch (cat) {
      case 'daily':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="4" width="14" height="16" rx="2" fill="#f5e3ba" stroke="#b45309" strokeWidth="1.4" />
            <polygon points="12,7.5 13.4,10.6 16.8,11 14.2,13.2 14.9,16.5 12,14.8 9.1,16.5 9.8,13.2 7.2,11 10.6,10.6" fill="#d97706" />
          </svg>
        );
      case 'main':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M5 4H19V17L12 21L5 17V4Z" fill="#1d4ed8" stroke="#facc15" strokeWidth="1.4" />
            <path d="M8 12L10 8L12 11L14 8L16 12H8Z" fill="#fef08a" />
          </svg>
        );
      case 'side':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <line x1="6" y1="18" x2="18" y2="6" stroke="#e2e8f0" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="18" y1="18" x2="6" y2="6" stroke="#e2e8f0" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="3.5" fill="#d97706" stroke="#fef08a" strokeWidth="1.2" />
          </svg>
        );
      case 'achievements':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M7 5H17V10C17 13 14.8 15 12 15C9.2 15 7 13 7 10V5Z" fill="#facc15" stroke="#92400e" strokeWidth="1.3" />
            <rect x="10.5" y="15" width="3" height="3" fill="#eab308" />
            <rect x="8" y="18" width="8" height="2.2" rx="1" fill="#facc15" />
          </svg>
        );
      case 'events':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M7 4H17L13.5 11.5L17 19H7L10.5 11.5L7 4Z" fill="#fde047" stroke="#b45309" strokeWidth="1.4" />
          </svg>
        );
    }
  };

  const visibleQuests = allQuests.filter((q) => q.category === activeTab);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3, 8, 12, 0.86)',
        zIndex: 108,
        display: 'grid',
        placeItems: 'center',
        padding: '14px',
        pointerEvents: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90dvh',
          background: 'linear-gradient(180deg, #0b2223 0%, #061416 100%)',
          border: '2px solid #b58d3d',
          borderRadius: '14px',
          boxShadow: '0 26px 72px rgba(0, 0, 0, 0.92), inset 0 0 0 1px rgba(254, 240, 138, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f8fafc',
        }}
      >
        {/* Top Ornate Rail */}
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
              QUESTS
            </span>
          </button>

          {/* Centered Ornate Crest Banner */}
          <div
            style={{
              padding: '4px 28px',
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
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
              }}
            >
              Quest Board
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Quest Board"
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

        {/* Main 2-Column Ornate Body */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexWrap: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {/* Left Vertical Sidebar Navigation (All 5 Reference Tabs) */}
          <aside
            style={{
              width: '176px',
              minWidth: '148px',
              background: 'linear-gradient(180deg, #0d2526 0%, #071618 100%)',
              borderRight: '2px solid #96712d',
              padding: '12px 9px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              overflowY: 'auto',
            }}
          >
            {(
              [
                { id: 'daily', label: 'Daily Quests' },
                { id: 'main', label: 'Main Quests' },
                { id: 'side', label: 'Side Quests' },
                { id: 'achievements', label: 'Achievements' },
                { id: 'events', label: 'Events' },
              ] as const
            ).map((tab) => {
              const isSelected = activeTab === tab.id;
              const claimable = tabCounts[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    position: 'relative',
                    minHeight: '46px',
                    padding: '8px 10px',
                    borderRadius: '7px',
                    background: isSelected
                      ? 'linear-gradient(180deg, #ba8d3c 0%, #7d591f 100%)'
                      : 'linear-gradient(180deg, #163336 0%, #0f2427 100%)',
                    borderTop: isSelected ? '1.5px solid #fef08a' : '1px solid #2b4d52',
                    borderLeft: isSelected ? '1.5px solid #fef08a' : '1px solid #2b4d52',
                    borderRight: isSelected ? '1.5px solid #fef08a' : '1px solid #2b4d52',
                    borderBottom: isSelected ? '3px solid #452e0c' : '2.5px solid #081517',
                    boxShadow: isSelected ? '0 0 14px rgba(234, 179, 8, 0.32)' : 'none',
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
                    {renderSidebarIcon(tab.id)}
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tab.label}
                  </span>
                  {claimable > 0 && (
                    <span
                      style={{
                        font: "800 11px 'Barlow Condensed', sans-serif",
                        fontVariantNumeric: 'tabular-nums',
                        color: '#fde047',
                      }}
                    >
                      ★{claimable}
                    </span>
                  )}
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
                boxShadow: 'inset 0 2px 14px rgba(68, 48, 22, 0.25)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                overflow: 'hidden',
              }}
            >
              {/* Daily Activity Chest Track (Matches Reference Daily Activity: X/100) */}
              {activeTab === 'daily' && (
                <div
                  style={{
                    background: 'linear-gradient(180deg, #c6b293 0%, #b59e7c 100%)',
                    border: '1.5px solid #8a6c3a',
                    borderRadius: '8px',
                    padding: '10px 14px 12px',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                    }}
                  >
                    <span
                      style={{
                        font: "800 15px 'Plus Jakarta Sans', sans-serif",
                        color: '#2c1f0f',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      Daily Activity: {dailyActivityPoints}/100
                    </span>
                    <span
                      style={{
                        padding: '2px 10px',
                        borderRadius: '5px',
                        background: 'linear-gradient(180deg, #eab308, #a16207)',
                        border: '1.5px solid #fef08a',
                        color: '#fffbeb',
                        font: "800 13px 'Barlow Condensed', sans-serif",
                        fontVariantNumeric: 'tabular-nums',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                      }}
                    >
                      {dailyActivityPoints}
                    </span>
                  </div>

                  {/* Progress Track + 5 Interactive Chests */}
                  <div style={{ position: 'relative', paddingTop: '14px', paddingBottom: '14px' }}>
                    <div
                      style={{
                        position: 'relative',
                        height: '12px',
                        borderRadius: '999px',
                        background: '#2a241d',
                        border: '1.5px solid #755b33',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${dailyActivityPoints}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #06b6d4 0%, #22d3ee 60%, #fef08a 100%)',
                          boxShadow: '0 0 10px rgba(34, 211, 238, 0.75)',
                          transition: 'width 0.35s ease',
                        }}
                      />
                    </div>

                    {DAILY_MILESTONES.map((pt) => {
                      const unlocked = dailyActivityPoints >= pt;
                      const claimed = Boolean(claimedChestMilestones[pt]);
                      return (
                        <button
                          key={pt}
                          type="button"
                          onClick={() => handleClaimChest(pt)}
                          title={
                            claimed
                              ? `${pt}-Pt Activity Chest Claimed`
                              : unlocked
                                ? `Click to Claim ${pt}-Pt Activity Chest`
                                : `Unlock at ${pt} Daily Activity Points`
                          }
                          style={{
                            position: 'absolute',
                            left: `${pt}%`,
                            top: '-2px',
                            transform: 'translateX(-50%)',
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <div
                            style={{
                              width: '34px',
                              height: '32px',
                              borderRadius: '7px',
                              background: unlocked && !claimed
                                ? 'radial-gradient(circle, rgba(250, 204, 21, 0.52) 0%, rgba(120, 53, 15, 0.85) 75%)'
                                : 'rgba(28, 22, 16, 0.85)',
                              border: unlocked && !claimed
                                ? '1.5px solid #fef08a'
                                : '1px solid #7c6239',
                              boxShadow: unlocked && !claimed ? '0 0 12px rgba(250, 204, 21, 0.75)' : 'none',
                              display: 'grid',
                              placeItems: 'center',
                              opacity: claimed ? 0.65 : 1,
                            }}
                          >
                            <svg width="22" height="20" viewBox="0 0 24 24" fill="none">
                              <rect
                                x="4"
                                y="8"
                                width="16"
                                height="11"
                                rx="2"
                                fill={unlocked ? '#b45309' : '#6b4226'}
                                stroke={unlocked ? '#fef08a' : '#a37b47'}
                                strokeWidth="1.5"
                              />
                              <path d="M4 12H20" stroke={unlocked ? '#fef08a' : '#a37b47'} strokeWidth="1.4" />
                              <rect
                                x="10.5"
                                y="10.5"
                                width="3"
                                height="4"
                                rx="0.6"
                                fill={claimed ? '#4ade80' : unlocked ? '#38bdf8' : '#d4af37'}
                              />
                            </svg>
                          </div>
                          <span
                            style={{
                              font: "800 11.5px 'Barlow Condensed', sans-serif",
                              fontVariantNumeric: 'tabular-nums',
                              color: claimed ? '#15803d' : '#2c1f0f',
                            }}
                          >
                            {claimed ? '✓' : pt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Scrollable Quest Cards List */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  paddingRight: '4px',
                }}
              >
                {visibleQuests.map((q) => {
                  const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.target)) * 100));
                  const canClaim = !q.claimed && q.progress >= q.target;

                  return (
                    <div
                      key={q.id}
                      style={{
                        background: 'linear-gradient(180deg, #1b383c 0%, #12272a 100%)',
                        border: q.claimed ? '1.5px solid #445a5d' : '1.5px solid #597b7f',
                        borderRadius: '9px',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap',
                        opacity: q.claimed ? 0.72 : 1,
                        boxShadow: '0 4px 12px rgba(24, 18, 10, 0.25)',
                      }}
                    >
                      {/* Blue-Gold Star Shield Emblem */}
                      <div
                        style={{
                          width: '52px',
                          height: '56px',
                          minWidth: '52px',
                          borderRadius: '8px',
                          background: 'rgba(11, 27, 29, 0.85)',
                          border: '1px solid #35585c',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <svg width="38" height="42" viewBox="0 0 36 40" fill="none">
                          <polygon
                            points="18,3 32,9 29,26 18,36 7,26 4,9"
                            fill="#1d4ed8"
                            stroke="#facc15"
                            strokeWidth="2.1"
                          />
                          <polygon
                            points="18,10 20.5,15.5 26.5,16.2 22,20.2 23.2,26 18,23 12.8,26 14,20.2 9.5,16.2 15.5,15.5"
                            fill="#fde047"
                            stroke="#b45309"
                            strokeWidth="0.9"
                          />
                        </svg>
                      </div>

                      {/* Quest Title, Progress Counter & Bar */}
                      <div style={{ flex: 1, minWidth: '185px' }}>
                        <div
                          style={{
                            font: "700 15px 'Plus Jakarta Sans', sans-serif",
                            color: '#fefce8',
                            lineHeight: 1.25,
                          }}
                        >
                          {q.title}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#cbd5e1',
                            marginTop: '2px',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          Progress: {q.progress.toLocaleString()} / {q.target.toLocaleString()}
                        </div>
                        <div
                          style={{
                            marginTop: '6px',
                            height: '10px',
                            maxWidth: '250px',
                            borderRadius: '4px',
                            background: '#0b1719',
                            border: '1px solid #3b5559',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: canClaim
                                ? 'linear-gradient(90deg, #facc15, #fef08a)'
                                : 'linear-gradient(90deg, #b45309, #eab308)',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>

                      {/* Reward Tiles + CLAIM / GO Button */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {q.rewards.map((rew, idx) => (
                            <div
                              key={`${q.id}-r-${idx}`}
                              style={{
                                position: 'relative',
                                width: '42px',
                                height: '42px',
                                borderRadius: '7px',
                                background:
                                  rew.type === 'power'
                                    ? 'linear-gradient(180deg, #581c87, #3b0764)'
                                    : rew.type === 'chest'
                                      ? 'linear-gradient(180deg, #166534, #052e16)'
                                      : 'linear-gradient(180deg, #1e3a5f, #0f172a)',
                                border: '1.5px solid #c99d43',
                                display: 'grid',
                                placeItems: 'center',
                              }}
                              title={`${rew.amount.toLocaleString()} ${rew.type.toUpperCase()}`}
                            >
                              {renderRewardGlyph(rew.type)}
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: '1px',
                                  right: '3px',
                                  font: "800 10px 'Barlow Condensed', sans-serif",
                                  fontVariantNumeric: 'tabular-nums',
                                  color: '#ffffff',
                                  textShadow: '0 1px 3px #000, 0 0 4px #000',
                                }}
                              >
                                {rew.amount >= 1000
                                  ? `${Math.round(rew.amount / 1000)}K`
                                  : rew.type === 'chest'
                                    ? `x${rew.amount}`
                                    : rew.amount}
                              </span>
                            </div>
                          ))}
                        </div>

                        {canClaim ? (
                          <button
                            type="button"
                            onClick={() => handleClaimQuest(q)}
                            style={{
                              minWidth: '94px',
                              minHeight: '38px',
                              padding: '6px 14px',
                              borderRadius: '7px',
                              background: 'linear-gradient(180deg, #35c142 0%, #15803d 100%)',
                              borderTop: '1.5px solid #bbf7d0',
                              borderLeft: '1.5px solid #86efac',
                              borderRight: '1.5px solid #86efac',
                              borderBottom: '3px solid #14532d',
                              color: '#ffffff',
                              font: "800 14px 'Barlow Condensed', sans-serif",
                              letterSpacing: '0.06em',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              boxShadow: '0 0 14px rgba(52, 211, 153, 0.5)',
                            }}
                          >
                            CLAIM
                          </button>
                        ) : q.claimed ? (
                          <span
                            style={{
                              minWidth: '94px',
                              textAlign: 'center',
                              padding: '7px 10px',
                              borderRadius: '7px',
                              background: 'rgba(15, 23, 42, 0.55)',
                              border: '1px solid rgba(148, 163, 184, 0.35)',
                              color: '#94a3b8',
                              font: "700 12px 'Barlow Condensed', sans-serif",
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ✓ CLAIMED
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (q.goAction) {
                                onClose();
                                onExecuteGoAction(q.goAction);
                              }
                            }}
                            style={{
                              minWidth: '94px',
                              minHeight: '38px',
                              padding: '6px 14px',
                              borderRadius: '7px',
                              background: 'linear-gradient(180deg, #2d82df 0%, #174c94 100%)',
                              borderTop: '1.5px solid #bae6fd',
                              borderLeft: '1.5px solid #7dd3fc',
                              borderRight: '1.5px solid #7dd3fc',
                              borderBottom: '3px solid #0c2b59',
                              color: '#ffffff',
                              font: "800 14px 'Barlow Condensed', sans-serif",
                              letterSpacing: '0.06em',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            GO
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
