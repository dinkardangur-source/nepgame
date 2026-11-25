import React, { useEffect, useMemo, useState } from 'react';
import {
  ActiveMarch,
  AllianceShrineRuleStatus,
  BattleReport,
  CalculatedBonuses,
  EquipmentItem,
  GameBalanceConfig,
  HospitalQueueItem,
  InfantryGearSlot,
  InfantryGearState,
  MAGAR_PROGRESSION_SPECS,
  MAX_INFANTRY_GEAR_RANK,
  NEPALESE_HEROES,
  PlayerAllianceIdentity,
  PlayerResources,
  ResearchState,
  ResourceKind,
  ShrineGarrisonState,
  StructureTierKey,
  TrainingQueueItem,
  TroopClassId,
  TroopInventory,
  TroopLevel,
  TroopStack,
  calculateArmyMetrics,
  createInitialInfantryGear,
  getHeroById,
  getInfantryGearUpgradeCost,
  getInfantryTierMultipliers,
  getRecommendedMonsterBand,
  normalizeAllianceTag,
  validateAllianceAlias,
} from '../game/NepaleseBalanceConfig';
import {
  RESERVED_PLOTS,
  WORLD_MONSTERS,
  WORLD_RESOURCES,
} from '../game/WorldCoordinates';
import { MonsterPortrait } from './MonsterPortrait';
import { HeroPortrait } from './HeroPortrait';
import { MagarChartSprite } from './MagarChartSprite';
import { SimCountdownText, SimProgressFill } from '../game/simClockStore';

export type CommandHubTab =
  | 'resources'
  | 'monsters'
  | 'barracks'
  | 'troops'
  | 'shrines'
  | 'congress'
  | 'marches'
  | 'reports_config';

export interface LiveNodeStatus {
  remainingYield: number;
  maxYield: number;
  respawnAt: number | null;
}

export interface LiveMonsterStatus {
  currentHp: number;
  maxHp: number;
  isDefeated: boolean;
  respawnAt: number | null;
}

export interface LiveCastleStatus {
  currentHp: number;
  maxHp: number;
  isBurning: boolean;
  lastAttackedAt: number | null;
  teleportCount: number;
}

interface CommandHubDrawerProps {
  isOpen: boolean;
  activeTab: CommandHubTab;
  onSelectTab: (tab: CommandHubTab) => void;
  onClose: () => void;
  resources: PlayerResources;
  balanceConfig: GameBalanceConfig;
  bonuses: CalculatedBonuses;
  troopInventory: TroopInventory;
  woundedInventory: TroopInventory;
  trainingQueue: TrainingQueueItem[];
  hospitalQueue: HospitalQueueItem[];
  research: ResearchState;
  equipmentBag: EquipmentItem[];
  equippedIds: string[];
  shrineGarrisons: Record<string, ShrineGarrisonState>;
  selectedStructureId: string;
  onSelectStructureId: (id: string) => void;
  activeMarches: ActiveMarch[];
  battleReports: BattleReport[];
  nodeStates: Record<string, LiveNodeStatus>;
  monsterStates: Record<string, LiveMonsterStatus>;
  commanderXp: number;
  onPanTo: (x: number, z: number) => void;
  onTrainTroops: (classId: TroopClassId, level: TroopLevel, count: number) => void;
  onInstantFinishTraining: (id: string) => void;
  onHealWounded: (classId?: TroopClassId, level?: TroopLevel) => void;
  onDeployStructureTroops: (
    structureId: string,
    structureKey: StructureTierKey,
    classId: TroopClassId,
    level: TroopLevel,
    count: number
  ) => void;
  onWithdrawStructureTroops: (
    structureId: string,
    classId: TroopClassId,
    level: TroopLevel,
    count: number
  ) => void;
  onAutoFillStructure: (structureId: string, structureKey: StructureTierKey) => void;
  onAllianceReinforceStructure: (structureId: string, structureKey: StructureTierKey) => void;
  onToggleStructureBarrier: (structureId: string, structureKey: StructureTierKey) => void;
  onSimulateStructureDefense: (structureId: string, structureKey: StructureTierKey) => void;
  onRecallMarch: (marchId: string) => void;
  onUpgradeResearch: (key: keyof ResearchState) => void;
  onToggleEquipItem: (itemId: string) => void;
  onUpdateBalanceConfig: (next: GameBalanceConfig) => void;
  onResetBalanceConfig: () => void;
  playerAlliance: PlayerAllianceIdentity;
  onUpdateAllianceIdentity: (tag: string, alias: string) => boolean;
  shrineRuleStatus: AllianceShrineRuleStatus;
  onRelinquishStructure: (structureId: string) => void;
  infantryGear?: InfantryGearState;
  onUpgradeInfantryGear?: (level: TroopLevel, slot: InfantryGearSlot) => void;
  onShowToast?: (msg: string) => void;
}

const TAB_DEFS: Array<{ id: CommandHubTab; label: string; short: string }> = [
  { id: 'resources', label: '1. Resources Lv1-10', short: 'Resources' },
  { id: 'monsters', label: '2. Monsters Lv1-10', short: 'Monsters' },
  { id: 'barracks', label: '3. Barracks & Hospital', short: 'Barracks' },
  { id: 'troops', label: '4. Nepalese Troops', short: 'Troop Stats' },
  { id: 'shrines', label: '5. Shrines C / B / A', short: 'Shrines' },
  { id: 'congress', label: '6. Alliance Congress', short: 'Congress' },
  { id: 'marches', label: '7. Active Marches', short: 'Marches' },
  { id: 'reports_config', label: '8. Reports & Config', short: 'Reports/Cfg' },
];

const CLASS_ORDER: TroopClassId[] = ['infantry', 'archer', 'cavalry'];
const TROOP_LEVELS: TroopLevel[] = [1, 2, 3, 4, 5];

function formatDurationSec(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

function inventoryToStacks(inv: TroopInventory): TroopStack[] {
  const out: TroopStack[] = [];
  for (const c of CLASS_ORDER) {
    for (const lv of TROOP_LEVELS) {
      const count = inv[c]?.[lv] || 0;
      if (count > 0) out.push({ classId: c, level: lv, count });
    }
  }
  return out;
}

const panelBg = {
  background: 'rgba(15, 23, 42, 0.78)',
  border: '1px solid rgba(148, 163, 184, 0.2)',
  borderRadius: '8px',
};

export const CommandHubDrawer: React.FC<CommandHubDrawerProps> = ({
  isOpen,
  activeTab,
  onSelectTab,
  onClose,
  resources,
  balanceConfig,
  bonuses,
  troopInventory,
  woundedInventory,
  trainingQueue,
  hospitalQueue,
  research,
  equipmentBag,
  equippedIds,
  shrineGarrisons,
  selectedStructureId,
  onSelectStructureId,
  activeMarches,
  battleReports,
  nodeStates,
  monsterStates,
  commanderXp,
  onPanTo,
  onTrainTroops,
  onInstantFinishTraining,
  onHealWounded,
  onDeployStructureTroops,
  onWithdrawStructureTroops,
  onAutoFillStructure,
  onAllianceReinforceStructure,
  onToggleStructureBarrier,
  onSimulateStructureDefense,
  onRecallMarch,
  onUpgradeResearch,
  onToggleEquipItem,
  onUpdateBalanceConfig,
  onResetBalanceConfig,
  playerAlliance,
  onUpdateAllianceIdentity,
  shrineRuleStatus,
  onRelinquishStructure,
  infantryGear,
  onUpgradeInfantryGear,
  onShowToast,
}) => {
  const [resFilter, setResFilter] = useState<'all' | ResourceKind>('all');
  const [trainClass, setTrainClass] = useState<TroopClassId>('infantry');
  const [trainLevel, setTrainLevel] = useState<TroopLevel>(1);
  const [trainQty, setTrainQty] = useState<number>(100);
  const [selectedMagarTier, setSelectedMagarTier] = useState<TroopLevel>(3);
  const [shrineTierTab, setShrineTierTab] = useState<'shrine_c' | 'shrine_b' | 'shrine_a'>('shrine_c');
  const [deployQtyByClass, setDeployQtyByClass] = useState<Record<TroopClassId, number>>({
    infantry: 250,
    archer: 150,
    cavalry: 100,
  });
  const [subTab8, setSubTab8] = useState<'reports' | 'research' | 'balance'>('reports');
  const [balanceDraftJson, setBalanceDraftJson] = useState<string>('');
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [tagDraft, setTagDraft] = useState<string>(playerAlliance.tag);
  const [aliasDraft, setAliasDraft] = useState<string>(playerAlliance.alias);

  const activeInfantryGear = useMemo(
    () => infantryGear || createInitialInfantryGear(),
    [infantryGear]
  );

  useEffect(() => {
    setTagDraft(playerAlliance.tag);
    setAliasDraft(playerAlliance.alias);
  }, [playerAlliance.tag, playerAlliance.alias]);

  const standingArmyMetrics = useMemo(
    () => calculateArmyMetrics(inventoryToStacks(troopInventory), balanceConfig, bonuses, null, activeInfantryGear),
    [troopInventory, balanceConfig, bonuses, activeInfantryGear]
  );

  const totalWoundedCount = useMemo(() => {
    let total = 0;
    for (const c of CLASS_ORDER) {
      for (const lv of TROOP_LEVELS) total += woundedInventory[c]?.[lv] || 0;
    }
    return total;
  }, [woundedInventory]);

  const shrineSitesForTier = useMemo(
    () => RESERVED_PLOTS.filter((p) => p.type === shrineTierTab),
    [shrineTierTab]
  );

  const activeShrineSite = useMemo(() => {
    const match = shrineSitesForTier.find((s) => s.id === selectedStructureId);
    return match || shrineSitesForTier[0];
  }, [shrineSitesForTier, selectedStructureId]);

  if (!isOpen) return null;

  const renderGarrisonModule = (structureId: string, structureKey: StructureTierKey, titleOverride?: string) => {
    const req = balanceConfig.structures[structureKey];
    const garrison: ShrineGarrisonState = shrineGarrisons[structureId] || {
      structureId,
      structureKey,
      name: titleOverride || req.label,
      ownerFaction: 'neutral',
      barrierActive: false,
      barrierHp: req.barrierStrength,
      maxBarrierHp: req.barrierStrength,
      playerStacks: [],
      allianceReinforcements: [],
    };

    const allStacks = [...garrison.playerStacks, ...garrison.allianceReinforcements];
    const metrics = calculateArmyMetrics(allStacks, balanceConfig, bonuses);
    const playerMetrics = calculateArmyMetrics(garrison.playerStacks, balanceConfig, bonuses);

    const getClassTotal = (stacks: TroopStack[], cls: TroopClassId) =>
      stacks.filter((s) => s.classId === cls).reduce((sum, s) => sum + s.count, 0);

    const clsTotals: Record<TroopClassId, number> = {
      infantry: getClassTotal(allStacks, 'infantry'),
      archer: getClassTotal(allStacks, 'archer'),
      cavalry: getClassTotal(allStacks, 'cavalry'),
    };
    const clsCaps: Record<TroopClassId, number> = {
      infantry: req.requiredInfantry,
      archer: req.requiredArcher,
      cavalry: req.requiredCavalry,
    };

    const readinessPct = Math.min(100, Math.round((metrics.totalCount / Math.max(1, req.totalCapacity)) * 100));
    const isCongress = structureKey === 'congress';
    const isAllianceOwned = garrison.ownerFaction === 'alliance';
    const blockedByCongressRule = isCongress && !shrineRuleStatus.congressUnlocked;
    const blockedByShrineCap = !isCongress && !isAllianceOwned && shrineRuleStatus.atShrineCap;
    const claimBlocked = blockedByCongressRule || blockedByShrineCap;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {blockedByCongressRule && (
          <div
            style={{
              background: 'rgba(120, 53, 15, 0.35)',
              border: '1px solid rgba(251, 191, 36, 0.55)',
              borderRadius: '8px',
              padding: '9px 12px',
              fontSize: '11.5px',
              color: '#fde68a',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <strong>CONGRESS LOCKED:</strong> {shrineRuleStatus.congressRequirementText}. Capture and garrison the required Shrines in Tab 5 first.
          </div>
        )}
        {blockedByShrineCap && (
          <div
            style={{
              background: 'rgba(127, 29, 29, 0.35)',
              border: '1px solid rgba(248, 113, 113, 0.55)',
              borderRadius: '8px',
              padding: '9px 12px',
              fontSize: '11.5px',
              color: '#fecaca',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <strong>5-SHRINE CAP REACHED ({shrineRuleStatus.totalShrinesHeld}/{shrineRuleStatus.maxShrinesPerAlliance}):</strong> Your alliance [{playerAlliance.tag}] already holds {shrineRuleStatus.maxShrinesPerAlliance} Shrines. Select one of your held Shrines and click <b>Relinquish Shrine</b> before claiming this site.
          </div>
        )}

        {/* Header Summary */}
        <div
          style={{
            ...panelBg,
            padding: '10px 12px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ font: "800 15px 'Barlow Condensed', sans-serif", color: '#fef08a', letterSpacing: '0.04em' }}>
              {garrison.name} · Required Lv.{req.requiredTroopLevel}+ Troops
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              {req.buffSummary} · Owner:{' '}
              <span style={{ color: isAllianceOwned ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                {isAllianceOwned ? `[${playerAlliance.tag}] ${playerAlliance.alias}` : garrison.ownerFaction.toUpperCase()}
              </span>{' '}
              · Capacity: <span style={{ color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{metrics.totalCount.toLocaleString()} / {req.totalCapacity.toLocaleString()}</span> ({readinessPct}%)
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              disabled={claimBlocked}
              onClick={() => onAutoFillStructure(structureId, structureKey)}
              style={{
                minHeight: '38px',
                padding: '6px 11px',
                borderRadius: '7px',
                background: claimBlocked ? '#334155' : 'linear-gradient(180deg, #059669, #065f46)',
                border: claimBlocked ? '1px solid rgba(148,163,184,0.3)' : '1px solid #34d399',
                color: claimBlocked ? '#94a3b8' : '#ecfdf5',
                font: "700 11.5px 'Barlow Condensed', sans-serif",
                cursor: claimBlocked ? 'not-allowed' : 'pointer',
              }}
            >
              Auto-Deploy Required
            </button>
            <button
              type="button"
              disabled={claimBlocked}
              onClick={() => onAllianceReinforceStructure(structureId, structureKey)}
              style={{
                minHeight: '38px',
                padding: '6px 11px',
                borderRadius: '7px',
                background: claimBlocked ? '#334155' : 'linear-gradient(180deg, #0284c7, #075985)',
                border: claimBlocked ? '1px solid rgba(148,163,184,0.3)' : '1px solid #38bdf8',
                color: claimBlocked ? '#94a3b8' : '#e0f2fe',
                font: "700 11.5px 'Barlow Condensed', sans-serif",
                cursor: claimBlocked ? 'not-allowed' : 'pointer',
              }}
            >
              + Alliance Reinforce
            </button>
            <button
              type="button"
              disabled={blockedByCongressRule}
              onClick={() => onToggleStructureBarrier(structureId, structureKey)}
              style={{
                minHeight: '38px',
                padding: '6px 11px',
                borderRadius: '7px',
                background: blockedByCongressRule
                  ? '#334155'
                  : garrison.barrierActive
                    ? 'linear-gradient(180deg, #0ea5e9, #0369a1)'
                    : 'rgba(30, 41, 59, 0.9)',
                border: garrison.barrierActive && !blockedByCongressRule ? '1px solid #7dd3fc' : '1px solid rgba(148,163,184,0.35)',
                color: blockedByCongressRule ? '#94a3b8' : garrison.barrierActive ? '#fff' : '#cbd5e1',
                font: "700 11.5px 'Barlow Condensed', sans-serif",
                cursor: blockedByCongressRule ? 'not-allowed' : 'pointer',
              }}
            >
              {garrison.barrierActive ? 'Barrier: ACTIVE' : 'Activate Barrier'}
            </button>
            <button
              type="button"
              disabled={blockedByCongressRule}
              onClick={() => onSimulateStructureDefense(structureId, structureKey)}
              style={{
                minHeight: '38px',
                padding: '6px 11px',
                borderRadius: '7px',
                background: blockedByCongressRule ? '#334155' : 'linear-gradient(180deg, #b45309, #78350f)',
                border: blockedByCongressRule ? '1px solid rgba(148,163,184,0.3)' : '1px solid #facc15',
                color: blockedByCongressRule ? '#94a3b8' : '#fef08a',
                font: "700 11.5px 'Barlow Condensed', sans-serif",
                cursor: blockedByCongressRule ? 'not-allowed' : 'pointer',
              }}
            >
              Simulate Defense Battle
            </button>
            {isAllianceOwned && (
              <button
                type="button"
                onClick={() => onRelinquishStructure(structureId)}
                style={{
                  minHeight: '38px',
                  padding: '6px 11px',
                  borderRadius: '7px',
                  background: 'rgba(153, 27, 27, 0.5)',
                  border: '1px solid #f87171',
                  color: '#fecaca',
                  font: "700 11.5px 'Barlow Condensed', sans-serif",
                  cursor: 'pointer',
                }}
              >
                Relinquish {isCongress ? 'Congress' : 'Shrine'}
              </button>
            )}
          </div>
        </div>

        {/* Metrics & Barrier Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '8px',
          }}
        >
          <div style={{ ...panelBg, padding: '8px 10px' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>COMBINED GARRISON POWER</div>
            <div style={{ font: "800 17px 'Barlow Condensed', sans-serif", color: '#facc15', fontVariantNumeric: 'tabular-nums' }}>
              {metrics.totalPower.toLocaleString()}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
              Your Troops: {playerMetrics.totalPower.toLocaleString()} · Power × Qty
            </div>
          </div>
          <div style={{ ...panelBg, padding: '8px 10px' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>GARRISON HP / ATTACK</div>
            <div style={{ font: "800 15px 'Barlow Condensed', sans-serif", color: '#38bdf8', fontVariantNumeric: 'tabular-nums' }}>
              {metrics.totalHp.toLocaleString()} HP · {metrics.totalAttack.toLocaleString()} ATK
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>
              3-Class Defense Continuity Active
            </div>
          </div>
          <div style={{ ...panelBg, padding: '8px 10px' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>PROTECTION BARRIER</div>
            <div style={{ font: "800 15px 'Barlow Condensed', sans-serif", color: garrison.barrierActive ? '#22d3ee' : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
              {garrison.barrierHp.toLocaleString()} / {garrison.maxBarrierHp.toLocaleString()}
            </div>
            <div style={{ marginTop: '4px', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.round((garrison.barrierHp / Math.max(1, garrison.maxBarrierHp)) * 100)}%`,
                  height: '100%',
                  background: garrison.barrierActive ? '#22d3ee' : '#475569',
                }}
              />
            </div>
          </div>
        </div>

        {/* 3 Troop Class Deployment Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '8px',
          }}
        >
          {CLASS_ORDER.map((cls) => {
            const cfg = balanceConfig.troops[cls];
            const statRow = cfg.levels[req.requiredTroopLevel];
            const currentCount = clsTotals[cls];
            const cap = clsCaps[cls];
            const availableInBarracks = troopInventory[cls]?.[req.requiredTroopLevel] || 0;
            const playerInClass = getClassTotal(garrison.playerStacks, cls);
            const allyInClass = getClassTotal(garrison.allianceReinforcements, cls);
            const stepQty = deployQtyByClass[cls];

            return (
              <div key={cls} style={{ ...panelBg, padding: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ font: "800 13.5px 'Barlow Condensed', sans-serif", color: '#fef08a' }}>
                      {cfg.name} (Lv.{req.requiredTroopLevel})
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                      Power {statRow.power} · HP {statRow.hp} · ATK {statRow.attack}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    <div style={{ font: "800 14px 'Barlow Condensed', sans-serif", color: currentCount >= cap ? '#34d399' : '#38bdf8' }}>
                      {currentCount.toLocaleString()} / {cap.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#64748b' }}>
                      You {playerInClass.toLocaleString()} · Ally {allyInClass.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.round((currentCount / Math.max(1, cap)) * 100))}%`,
                      height: '100%',
                      background: cls === 'infantry' ? '#34d399' : cls === 'archer' ? '#38bdf8' : '#f59e0b',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
                  <span>Barracks Lv.{req.requiredTroopLevel}: {availableInBarracks.toLocaleString()}</span>
                  <span>Class Power: {(currentCount * statRow.power).toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input
                    type="number"
                    min={10}
                    max={cap}
                    value={stepQty}
                    onChange={(e) =>
                      setDeployQtyByClass((prev) => ({
                        ...prev,
                        [cls]: Math.max(1, Math.min(cap, Number(e.target.value) || 0)),
                      }))
                    }
                    style={{
                      width: '74px',
                      minHeight: '36px',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      background: 'rgba(2, 6, 23, 0.7)',
                      border: '1px solid rgba(148,163,184,0.3)',
                      color: '#f8fafc',
                      fontSize: '11.5px',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                  <button
                    type="button"
                    disabled={claimBlocked}
                    onClick={() => onDeployStructureTroops(structureId, structureKey, cls, req.requiredTroopLevel, stepQty)}
                    style={{
                      flex: 1,
                      minHeight: '36px',
                      borderRadius: '6px',
                      background: claimBlocked ? '#334155' : 'linear-gradient(180deg, #0284c7, #0369a1)',
                      border: claimBlocked ? '1px solid rgba(148,163,184,0.3)' : '1px solid #38bdf8',
                      color: claimBlocked ? '#94a3b8' : '#fff',
                      font: "700 11px 'Barlow Condensed', sans-serif",
                      cursor: claimBlocked ? 'not-allowed' : 'pointer',
                    }}
                  >
                    + Deploy
                  </button>
                  <button
                    type="button"
                    onClick={() => onWithdrawStructureTroops(structureId, cls, req.requiredTroopLevel, stepQty)}
                    style={{
                      flex: 1,
                      minHeight: '36px',
                      borderRadius: '6px',
                      background: 'rgba(51, 65, 85, 0.85)',
                      border: '1px solid rgba(148,163,184,0.3)',
                      color: '#e2e8f0',
                      font: "700 11px 'Barlow Condensed', sans-serif",
                      cursor: 'pointer',
                    }}
                  >
                    - Withdraw
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {garrison.lastBattleSummary && (
          <div style={{ ...panelBg, padding: '8px 12px', fontSize: '11.5px', color: '#fde047' }}>
            Last Garrison Report: {garrison.lastBattleSummary}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 92,
        background: 'rgba(2, 6, 16, 0.74)',
        backdropFilter: 'blur(6px)',
        display: 'grid',
        placeItems: 'center',
        padding: '10px',
        pointerEvents: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="command-hub-shell"
        style={{
          width: 'min(1120px, 98vw)',
          height: 'min(88dvh, 760px)',
          background: 'rgba(10, 16, 28, 0.96)',
          border: '1.5px solid rgba(218, 165, 32, 0.6)',
          borderRadius: '12px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f1f5f9',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ font: "800 17px 'Barlow Condensed', sans-serif", color: '#fef08a', letterSpacing: '0.05em' }}>
              [{playerAlliance.tag}] {playerAlliance.alias.toUpperCase()} · COMMAND HUB
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
              Shrines {shrineRuleStatus.totalShrinesHeld}/{shrineRuleStatus.maxShrinesPerAlliance} (C {shrineRuleStatus.heldByTier.shrine_c}/2 · B {shrineRuleStatus.heldByTier.shrine_b}/1 · A {shrineRuleStatus.heldByTier.shrine_a}/1) · Army: {standingArmyMetrics.totalCount.toLocaleString()} ({standingArmyMetrics.totalPower.toLocaleString()} PWR) · Wounded: {totalWoundedCount.toLocaleString()} · Scale: {balanceConfig.simulationTimeScale}×
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', fontVariantNumeric: 'tabular-nums', flexWrap: 'wrap' }}>
            <span style={{ color: '#fde68a' }}>Food {resources.food.toLocaleString()}</span>
            <span style={{ color: '#475569' }}>·</span>
            <span style={{ color: '#86efac' }}>Wood {resources.wood.toLocaleString()}</span>
            <span style={{ color: '#475569' }}>·</span>
            <span style={{ color: '#cbd5e1' }}>Stone {resources.stone.toLocaleString()}</span>
            <span style={{ color: '#475569' }}>·</span>
            <span style={{ color: '#93c5fd' }}>Iron {resources.iron.toLocaleString()}</span>
            <span style={{ color: '#475569' }}>·</span>
            <span style={{ color: '#22d3ee', fontWeight: 700 }}>Crystal {resources.crystal.toLocaleString()}</span>
            <button
              type="button"
              onClick={onClose}
              style={{
                minWidth: '40px',
                minHeight: '40px',
                borderRadius: '8px',
                background: 'rgba(30, 41, 59, 0.9)',
                border: '1px solid rgba(148, 163, 184, 0.35)',
                color: '#f8fafc',
                fontSize: '16px',
                cursor: 'pointer',
              }}
              aria-label="Close Command Hub"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 8-Tab Navigation Strip */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '6px 10px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            background: 'rgba(2, 6, 23, 0.45)',
          }}
        >
          {TAB_DEFS.map((t) => {
            const active = activeTab === t.id;
            const badge =
              t.id === 'marches' && activeMarches.length > 0
                ? activeMarches.length
                : t.id === 'reports_config' && battleReports.length > 0
                  ? battleReports.length
                  : null;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTab(t.id)}
                style={{
                  minHeight: '40px',
                  padding: '6px 11px',
                  borderRadius: '7px',
                  background: active
                    ? 'linear-gradient(180deg, #b45309 0%, #78350f 100%)'
                    : 'rgba(30, 41, 59, 0.65)',
                  border: active ? '1px solid #fde047' : '1px solid rgba(148, 163, 184, 0.2)',
                  color: active ? '#fef08a' : '#cbd5e1',
                  font: "700 11.5px 'Barlow Condensed', sans-serif",
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  flexShrink: 0,
                }}
              >
                <span>{t.label}</span>
                {badge !== null && (
                  <span
                    style={{
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: '#0284c7',
                      color: '#fff',
                      fontSize: '10px',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Scrollable Content Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* TAB 1: RESOURCES LV 1-10 */}
          {activeTab === 'resources' && (
            <>
              <div style={{ ...panelBg, padding: '10px 12px' }}>
                <div style={{ font: "800 14px 'Barlow Condensed', sans-serif", color: '#fef08a', marginBottom: '6px' }}>
                  RESOURCE NODE PROGRESSION TABLE (LEVEL 1 TO LEVEL 10)
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', fontVariantNumeric: 'tabular-nums' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.25)', color: '#94a3b8', textAlign: 'right' }}>
                        <th style={{ textAlign: 'left', padding: '5px 6px' }}>Lv</th>
                        <th style={{ padding: '5px 6px', color: '#fde68a' }}>Food (+{Math.round((balanceConfig.resourceGatheringBonuses.food || 0) * 100)}%)</th>
                        <th style={{ padding: '5px 6px', color: '#86efac' }}>Wood (+{Math.round((balanceConfig.resourceGatheringBonuses.wood || 0) * 100)}%)</th>
                        <th style={{ padding: '5px 6px', color: '#cbd5e1' }}>Stone (+{Math.round((balanceConfig.resourceGatheringBonuses.stone || 0) * 100)}%)</th>
                        <th style={{ padding: '5px 6px', color: '#93c5fd' }}>Iron (+{Math.round((balanceConfig.resourceGatheringBonuses.iron || 0) * 100)}%)</th>
                        <th style={{ padding: '5px 6px', color: '#22d3ee' }}>Crystal (+{Math.round((balanceConfig.resourceGatheringBonuses.crystal || 0) * 100)}%)</th>
                        <th style={{ padding: '5px 6px' }}>Req. Troops</th>
                        <th style={{ padding: '5px 6px' }}>Difficulty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balanceConfig.resourcesByLevel.map((row) => (
                        <tr key={row.level} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'right' }}>
                          <td style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 700, color: '#fef08a' }}>Lv.{row.level}</td>
                          <td style={{ padding: '5px 6px' }}>{row.food.toLocaleString()}</td>
                          <td style={{ padding: '5px 6px' }}>{row.wood.toLocaleString()}</td>
                          <td style={{ padding: '5px 6px' }}>{row.stone.toLocaleString()}</td>
                          <td style={{ padding: '5px 6px' }}>{row.iron.toLocaleString()}</td>
                          <td style={{ padding: '5px 6px', color: '#67e8f9', fontWeight: 700 }}>{row.crystal.toLocaleString()}</td>
                          <td style={{ padding: '5px 6px', color: '#38bdf8' }}>{row.requiredTroopCapacity.toLocaleString()}</td>
                          <td style={{ padding: '5px 6px', color: '#94a3b8' }}>{row.difficulty.toFixed(2)}×</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                {(['all', 'food', 'wood', 'stone', 'iron', 'crystal'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setResFilter(k)}
                    style={{
                      minHeight: '36px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: resFilter === k ? '#b45309' : 'rgba(30,41,59,0.7)',
                      border: resFilter === k ? '1px solid #fde047' : '1px solid rgba(148,163,184,0.2)',
                      color: resFilter === k ? '#fef08a' : '#cbd5e1',
                      font: "700 11px 'Barlow Condensed', sans-serif",
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '8px' }}>
                {WORLD_RESOURCES.filter((r) => resFilter === 'all' || r.resourceType === resFilter).map((node) => {
                  const live = nodeStates[node.id];
                  const maxY = live?.maxYield ?? node.maxYieldAmount ?? node.yieldAmount ?? 5000;
                  const remY = live?.remainingYield ?? maxY;
                  const isDepleted = remY <= 0;

                  return (
                    <div key={node.id} style={{ ...panelBg, padding: '9px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ font: "700 12.5px 'Barlow Condensed', sans-serif", color: '#fef08a' }}>
                          {node.name} (Lv.{node.level})
                        </span>
                        <span style={{ fontSize: '10px', color: isDepleted ? '#f87171' : '#34d399', fontWeight: 700 }}>
                          {isDepleted ? (
                            live?.respawnAt ? (
                              <SimCountdownText targetMs={live.respawnAt} format="duration" prefix="Respawn " />
                            ) : (
                              'Respawn 0s'
                            )
                          ) : (
                            'ACTIVE'
                          )}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
                        Capacity: {remY.toLocaleString()} / {maxY.toLocaleString()} {(node.resourceType || node.subtype).toUpperCase()}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                        Req. Troops: {(node.requiredTroopCapacity || 100).toLocaleString()} · Diff {(node.difficulty || 1).toFixed(2)}× · [{Math.round(node.position[0])}, {Math.round(node.position[2])}]
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onPanTo(node.position[0], node.position[2]);
                          onClose();
                        }}
                        style={{
                          marginTop: '3px',
                          minHeight: '36px',
                          borderRadius: '6px',
                          background: 'rgba(2, 132, 199, 0.25)',
                          border: '1px solid #38bdf8',
                          color: '#bae6fd',
                          font: "700 11px 'Barlow Condensed', sans-serif",
                          cursor: 'pointer',
                        }}
                      >
                        Pan Camera & Select Node ↗
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* TAB 2: MONSTERS LV 1-10 */}
          {activeTab === 'monsters' && (
            <>
              <div style={{ ...panelBg, padding: '10px 12px' }}>
                <div style={{ font: "800 14px 'Barlow Condensed', sans-serif", color: '#fef08a', marginBottom: '6px' }}>
                  MONSTER DIFFICULTY MATRIX (LEVEL 1 TO LEVEL 10)
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', fontVariantNumeric: 'tabular-nums' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.25)', color: '#94a3b8', textAlign: 'right' }}>
                        <th style={{ textAlign: 'left', padding: '5px 6px' }}>Monster Lv</th>
                        <th style={{ padding: '5px 6px', color: '#f87171' }}>Monster HP</th>
                        <th style={{ padding: '5px 6px', color: '#fb923c' }}>Attack Damage</th>
                        <th style={{ padding: '5px 6px', color: '#93c5fd' }}>Defense</th>
                        <th style={{ padding: '5px 6px', color: '#facc15' }}>Suggested Reward</th>
                        <th style={{ padding: '5px 6px' }}>Respawn Timer</th>
                        <th style={{ textAlign: 'left', padding: '5px 6px' }}>Recommended Troops</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balanceConfig.monstersByLevel.map((m) => {
                        const recBand = m.level <= 2 ? 'Lv.1 Troops' : m.level <= 3 ? 'Lv.2 Troops' : m.level <= 5 ? 'Lv.3 Troops' : m.level <= 7 ? 'Lv.4 Troops' : 'Lv.5 Troops';
                        return (
                          <tr key={m.level} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'right' }}>
                            <td style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 700, color: '#fef08a' }}>Lv.{m.level}</td>
                            <td style={{ padding: '5px 6px' }}>{m.hp.toLocaleString()}</td>
                            <td style={{ padding: '5px 6px' }}>{m.attack.toLocaleString()}</td>
                            <td style={{ padding: '5px 6px' }}>{m.defense.toLocaleString()}</td>
                            <td style={{ padding: '5px 6px', color: '#fde047', fontWeight: 700 }}>{m.suggestedReward.toLocaleString()}</td>
                            <td style={{ padding: '5px 6px', color: '#94a3b8' }}>{m.respawnSeconds}s</td>
                            <td style={{ textAlign: 'left', padding: '5px 6px', color: '#34d399' }}>{recBand}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '8px' }}>
                {WORLD_MONSTERS.map((mon) => {
                  const live = monsterStates[mon.id];
                  const mCfg = balanceConfig.monstersByLevel[Math.max(0, Math.min(9, mon.level - 1))];
                  const curHp = live?.currentHp ?? mCfg.hp;
                  const maxHp = live?.maxHp ?? mCfg.hp;
                  const isDefeated = live?.isDefeated ?? false;

                  return (
                    <div key={mon.id} style={{ ...panelBg, padding: '9px 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MonsterPortrait
                          subtype={mon.subtype}
                          level={mon.level}
                          name={mon.name}
                          size={40}
                          rounded={8}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                            <span style={{ font: "700 12.5px 'Barlow Condensed', sans-serif", color: '#fca5a5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {mon.name} (Lv.{mon.level})
                            </span>
                            <span style={{ fontSize: '10px', color: isDefeated ? '#fbbf24' : '#34d399', fontWeight: 700, flexShrink: 0 }}>
                              {isDefeated ? (
                                live?.respawnAt ? (
                                  <SimCountdownText targetMs={live.respawnAt} format="duration" prefix="Respawn " />
                                ) : (
                                  'Respawn 0s'
                                )
                              ) : (
                                'ALIVE'
                              )}
                            </span>
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>
                            HP: {curHp.toLocaleString()} / {maxHp.toLocaleString()} · ATK {mCfg.attack.toLocaleString()} · DEF {mCfg.defense.toLocaleString()}
                          </div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                            Reward Base: {mCfg.suggestedReward.toLocaleString()} + XP {mCfg.xpReward} · [{Math.round(mon.position[0])}, {Math.round(mon.position[2])}]
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onPanTo(mon.position[0], mon.position[2]);
                          onClose();
                        }}
                        style={{
                          marginTop: '3px',
                          minHeight: '36px',
                          borderRadius: '6px',
                          background: 'rgba(220, 38, 38, 0.22)',
                          border: '1px solid #f87171',
                          color: '#fecaca',
                          font: "700 11px 'Barlow Condensed', sans-serif",
                          cursor: 'pointer',
                        }}
                      >
                        Locate Monster Lair ↗
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* TAB 3: BARRACKS & HOSPITAL */}
          {activeTab === 'barracks' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '12px' }}>
              {/* Barracks Training */}
              <div style={{ ...panelBg, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ font: "800 15px 'Barlow Condensed', sans-serif", color: '#fef08a' }}>
                  ROYAL BARRACKS · TRAIN NEPALESE FORCES
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {CLASS_ORDER.map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setTrainClass(cls)}
                      style={{
                        flex: 1,
                        minHeight: '40px',
                        borderRadius: '7px',
                        background: trainClass === cls ? '#b45309' : 'rgba(30,41,59,0.8)',
                        border: trainClass === cls ? '1px solid #fde047' : '1px solid rgba(148,163,184,0.2)',
                        color: trainClass === cls ? '#fef08a' : '#cbd5e1',
                        font: "700 11.5px 'Barlow Condensed', sans-serif",
                        cursor: 'pointer',
                      }}
                    >
                      {balanceConfig.troops[cls].name}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {TROOP_LEVELS.map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      onClick={() => setTrainLevel(lv)}
                      style={{
                        flex: 1,
                        minHeight: '38px',
                        borderRadius: '6px',
                        background: trainLevel === lv ? '#0284c7' : 'rgba(30,41,59,0.7)',
                        border: trainLevel === lv ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.2)',
                        color: trainLevel === lv ? '#fff' : '#cbd5e1',
                        font: "700 12px 'Barlow Condensed', sans-serif",
                        cursor: 'pointer',
                      }}
                    >
                      Lv.{lv}
                    </button>
                  ))}
                </div>

                {(() => {
                  const cfg = balanceConfig.troops[trainClass];
                  const row = cfg.levels[trainLevel];
                  const totalCost = {
                    food: row.trainCost.food * trainQty,
                    wood: row.trainCost.wood * trainQty,
                    iron: row.trainCost.iron * trainQty,
                    crystal: row.trainCost.crystal * trainQty,
                  };
                  const trainSeconds = Math.max(
                    2,
                    Math.ceil((row.trainSecondsPerUnit * trainQty) / Math.max(1, balanceConfig.simulationTimeScale / 4))
                  );
                  const magarSpec = trainClass === 'infantry' ? MAGAR_PROGRESSION_SPECS[trainLevel] : null;
                  const magarRanks = trainClass === 'infantry' ? activeInfantryGear[trainLevel] : null;
                  const magarMults = trainClass === 'infantry' ? getInfantryTierMultipliers(trainLevel, activeInfantryGear) : null;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px', fontVariantNumeric: 'tabular-nums' }}>
                      {magarSpec && magarRanks && magarMults && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px',
                            borderRadius: '7px',
                            background: 'rgba(2, 6, 23, 0.58)',
                            border: `1px solid ${magarSpec.rarityColor}44`,
                          }}
                        >
                          <div style={{ width: '64px', flexShrink: 0 }}>
                            <MagarChartSprite
                              level={trainLevel}
                              part="warrior"
                              alt={`Magar Lv.${trainLevel} ${magarSpec.tierName}`}
                              height={76}
                              accentColor={magarSpec.rarityColor}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ font: "800 13px 'Barlow Condensed', sans-serif", color: magarSpec.rarityColor }}>
                              Lv.{trainLevel} {magarSpec.tierName.toUpperCase()} · GEAR FORGE +{magarRanks.weapon + magarRanks.shield + magarRanks.armor}/{MAX_INFANTRY_GEAR_RANK * 3}
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#cbd5e1' }}>
                              {magarSpec.weaponName} · {magarSpec.shieldName} · {magarSpec.armorName}
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#86efac' }}>
                              Forged Bonus: +{Math.round((magarMults.atkMult - 1) * 100)}% ATK · +{Math.round(magarMults.shieldMitigationPct * 100)}% DEF · +{Math.round((magarMults.hpMult - 1) * 100)}% HP
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMagarTier(trainLevel);
                              onSelectTab('troops');
                            }}
                            style={{
                              minHeight: '38px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: 'rgba(217, 119, 6, 0.28)',
                              border: '1px solid rgba(251, 191, 36, 0.65)',
                              color: '#fef08a',
                              font: "700 11px 'Barlow Condensed', sans-serif",
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            Forge Gear →
                          </button>
                        </div>
                      )}
                      <div style={{ color: '#94a3b8' }}>
                        {cfg.roleSummary}
                      </div>
                      <div style={{ color: '#e2e8f0' }}>
                        Stats/Unit: Power {magarMults ? Math.round(row.power * magarMults.powerMult) : row.power} · HP {magarMults ? Math.round(row.hp * magarMults.hpMult) : row.hp} · ATK {magarMults ? Math.round(row.attack * magarMults.atkMult) : row.attack} · Load {row.load} · Gather {row.gatheringSpeed}/m · March {row.marchingSpeed} t/m
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="number"
                          min={1}
                          max={5000}
                          value={trainQty}
                          onChange={(e) => setTrainQty(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))}
                          style={{
                            width: '90px',
                            minHeight: '38px',
                            padding: '5px 8px',
                            borderRadius: '6px',
                            background: 'rgba(2,6,23,0.75)',
                            border: '1px solid rgba(148,163,184,0.35)',
                            color: '#fff',
                          }}
                        />
                        {[50, 100, 250, 500, 1000].map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setTrainQty(q)}
                            style={{
                              minHeight: '36px',
                              padding: '4px 9px',
                              borderRadius: '6px',
                              background: 'rgba(30,41,59,0.85)',
                              border: '1px solid rgba(148,163,184,0.25)',
                              color: '#cbd5e1',
                              font: "700 11px 'Barlow Condensed', sans-serif",
                              cursor: 'pointer',
                            }}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                      <div style={{ color: '#fde68a' }}>
                        Cost: Food {totalCost.food.toLocaleString()} · Wood {totalCost.wood.toLocaleString()} · Iron {totalCost.iron.toLocaleString()}
                        {totalCost.crystal > 0 ? ` · Crystal ${totalCost.crystal.toLocaleString()}` : ''} · Time: {formatDurationSec(trainSeconds)}
                      </div>
                      <button
                        type="button"
                        onClick={() => onTrainTroops(trainClass, trainLevel, trainQty)}
                        style={{
                          minHeight: '42px',
                          borderRadius: '8px',
                          background: 'linear-gradient(180deg, #16a34a, #15803d)',
                          border: '1px solid #4ade80',
                          color: '#fff',
                          font: "800 13px 'Barlow Condensed', sans-serif",
                          cursor: 'pointer',
                        }}
                      >
                        Train +{trainQty.toLocaleString()} {cfg.name} Lv.{trainLevel} ({(trainQty * row.power).toLocaleString()} Power)
                      </button>
                    </div>
                  );
                })()}

                {/* Active Training Queue */}
                {trainingQueue.length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>TRAINING QUEUE</div>
                    {trainingQueue.map((item) => (
                      <div key={item.id} style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px', fontSize: '11px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>+{item.count.toLocaleString()} {balanceConfig.troops[item.classId].name} Lv.{item.level}</span>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ color: '#fef08a', fontVariantNumeric: 'tabular-nums' }}>
                              <SimCountdownText targetMs={item.completesAt} format="duration" />
                            </span>
                            <button
                              type="button"
                              onClick={() => onInstantFinishTraining(item.id)}
                              style={{
                                minHeight: '28px',
                                padding: '2px 8px',
                                borderRadius: '5px',
                                background: '#b45309',
                                border: '1px solid #fde047',
                                color: '#fef08a',
                                font: "700 10px 'Barlow Condensed', sans-serif",
                                cursor: 'pointer',
                              }}
                            >
                              Finish Now
                            </button>
                          </div>
                        </div>
                        <div style={{ marginTop: '4px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                          <SimProgressFill startedAt={item.startedAt} completesAt={item.completesAt} background="#34d399" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Hospital & Barracks Stock Overview */}
              <div style={{ ...panelBg, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ font: "800 15px 'Barlow Condensed', sans-serif", color: '#34d399' }}>
                    ROYAL HOSPITAL & ACTIVE GARRISON STOCK
                  </div>
                  {totalWoundedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onHealWounded()}
                      style={{
                        minHeight: '36px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'linear-gradient(180deg, #059669, #065f46)',
                        border: '1px solid #34d399',
                        color: '#ecfdf5',
                        font: "700 11px 'Barlow Condensed', sans-serif",
                        cursor: 'pointer',
                      }}
                    >
                      Heal All ({totalWoundedCount.toLocaleString()})
                    </button>
                  )}
                </div>

                {totalWoundedCount === 0 && hospitalQueue.length === 0 ? (
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                    No wounded Nepalese troops in Hospital. Casualties sustained against Lv 1–10 monsters or sieges recover here.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {CLASS_ORDER.map((c) =>
                      TROOP_LEVELS.map((lv) => {
                        const w = woundedInventory[c]?.[lv] || 0;
                        if (w <= 0) return null;
                        return (
                          <div key={`${c}-${lv}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', background: 'rgba(220,38,38,0.12)', padding: '6px 8px', borderRadius: '6px' }}>
                            <span>Wounded {balanceConfig.troops[c].name} Lv.{lv}: <strong style={{ color: '#fca5a5' }}>{w.toLocaleString()}</strong></span>
                            <button
                              type="button"
                              onClick={() => onHealWounded(c, lv)}
                              style={{
                                minHeight: '32px',
                                padding: '3px 9px',
                                borderRadius: '5px',
                                background: '#059669',
                                border: '1px solid #34d399',
                                color: '#fff',
                                font: "700 11px 'Barlow Condensed', sans-serif",
                                cursor: 'pointer',
                              }}
                            >
                              Heal
                            </button>
                          </div>
                        );
                      })
                    )}
                    {hospitalQueue.map((hq) => (
                      <div key={hq.id} style={{ fontSize: '11px', color: '#86efac', background: 'rgba(16,185,129,0.12)', padding: '6px 8px', borderRadius: '6px' }}>
                        Recovering +{hq.count.toLocaleString()} {balanceConfig.troops[hq.classId].name} Lv.{hq.level} · ETA{' '}
                        <SimCountdownText targetMs={hq.completesAt} format="duration" />
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#fef08a', fontWeight: 700, marginBottom: '6px' }}>
                    BARRACKS READY TROOPS (POWER = INDIV. POWER × QTY)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                    {CLASS_ORDER.map((cls) => (
                      <div key={cls} style={{ background: 'rgba(2,6,23,0.5)', padding: '6px 8px', borderRadius: '6px' }}>
                        <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>{balanceConfig.troops[cls].name}</div>
                        {TROOP_LEVELS.map((lv) => (
                          <div key={lv} style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                            <span>Lv.{lv}</span>
                            <span>{(troopInventory[cls]?.[lv] || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TROOP STATS LV 1-5 & NEPALESE HERO COMMANDERS */}
          {activeTab === 'troops' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ ...panelBg, padding: '10px 12px', fontSize: '11.5px', color: '#e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ color: '#fef08a' }}>Tactical Class Counters (+{Math.round(balanceConfig.counterDamageBonus * 100)}% Damage):</strong>{' '}
                  Magar Warriors (Infantry) &gt; Thakuri Cavalry &gt; Limbu Archers &gt; Magar Warriors
                </div>
                <div style={{ color: '#38bdf8', fontVariantNumeric: 'tabular-nums' }}>
                  Base Multipliers: ATK ×{bonuses.attackMult.toFixed(2)} · HP ×{bonuses.hpMult.toFixed(2)} · Load ×{bonuses.loadMult.toFixed(2)} · Gather ×{bonuses.gatherMult.toFixed(2)} · March ×{bonuses.marchMult.toFixed(2)}
                </div>
              </div>

              {/* Nepalese Lead Hero Commanders Roster */}
              <div style={{ ...panelBg, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ font: "800 14px 'Barlow Condensed', sans-serif", color: '#fef08a' }}>
                    NEPALESE LEAD HERO COMMANDERS (1 HERO PER MARCH · LOCKED WHILE MARCHING)
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Select any available Hero in the Battalion Dispatch panel when targeting a Node, Monster, or Enemy Castle
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '8px' }}>
                  {NEPALESE_HEROES.map((hero) => {
                    const activeMission = activeMarches.find((m) => m.heroId === hero.id);
                    return (
                      <div
                        key={hero.id}
                        style={{
                          background: activeMission ? 'rgba(217, 119, 6, 0.14)' : 'rgba(2, 6, 23, 0.58)',
                          border: `1px solid ${activeMission ? 'rgba(251, 191, 36, 0.55)' : 'rgba(148, 163, 184, 0.24)'}`,
                          borderRadius: '7px',
                          padding: '8px 10px',
                          display: 'flex',
                          gap: '10px',
                          alignItems: 'flex-start',
                        }}
                      >
                        <HeroPortrait hero={hero} size={52} rounded={8} isLocked={Boolean(activeMission)} />
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                            <span style={{ font: "800 13.5px 'Barlow Condensed', sans-serif", color: hero.crestColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {hero.name}
                            </span>
                            <span
                              style={{
                                fontSize: '9.5px',
                                fontWeight: 700,
                                color: activeMission ? '#fde68a' : '#6ee7b7',
                                flexShrink: 0,
                              }}
                            >
                              {activeMission ? 'ON MARCH' : 'READY'}
                            </span>
                          </div>
                          <div style={{ fontSize: '10px', color: '#cbd5e1' }}>{hero.title}</div>
                          <div style={{ fontSize: '10px', color: '#fde047', fontVariantNumeric: 'tabular-nums' }}>
                            +{Math.round(hero.classAttackPct * 100)}% {hero.classBonusClass.toUpperCase()} ATK · +{Math.round(hero.attackPct * 100)}% ATK · +{Math.round(hero.hpPct * 100)}% HP
                          </div>
                          <div style={{ fontSize: '10px', color: '#86efac', fontVariantNumeric: 'tabular-nums' }}>
                            +{Math.round(hero.gatherPct * 100)}% Gather · +{Math.round(hero.loadPct * 100)}% Load · +{Math.round(hero.marchPct * 100)}% March · +{Math.round(hero.siegeDamagePct * 100)}% Siege
                          </div>
                          {activeMission && (
                            <div style={{ fontSize: '9.5px', color: '#fbbf24' }}>
                              Leading march → {activeMission.targetName} ({activeMission.status})
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Magar Warrior Lv.1-5 Progression & Weapon/Shield/Armor Armory Forge */}
              <div style={{ ...panelBg, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <div>
                    <div style={{ font: "800 15px 'Barlow Condensed', sans-serif", color: '#fef08a' }}>
                      MAGAR WARRIOR PROGRESSION (LV.1–LV.5) · WEAPON, SHIELD & ARMOR FORGE
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Select a Magar Infantry tier to inspect its chart progression and forge Khukuri, Wooden Shield, and Armor upgrades (+ATK, +DEF Mitigation, +HP) reflected in combat and 3D marching battalions.
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#fde047', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    Stock: Wood {Math.floor(resources.wood).toLocaleString()} · Iron {Math.floor(resources.iron).toLocaleString()} · Gold {Math.floor(resources.gold).toLocaleString()} · Crystal {Math.floor(resources.crystal).toLocaleString()}
                  </div>
                </div>

                {/* 5-Column Tier Selector with Cropped Warriors */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(110px, 1fr))', gap: '8px', overflowX: 'auto' }}>
                  {TROOP_LEVELS.map((lv) => {
                    const spec = MAGAR_PROGRESSION_SPECS[lv];
                    const ranks = activeInfantryGear[lv];
                    const mults = getInfantryTierMultipliers(lv, activeInfantryGear);
                    const totalRank = ranks.weapon + ranks.shield + ranks.armor;
                    const maxTotalRank = MAX_INFANTRY_GEAR_RANK * 3;
                    const owned = troopInventory.infantry?.[lv] || 0;
                    const isSelected = selectedMagarTier === lv;

                    return (
                      <button
                        key={lv}
                        type="button"
                        onClick={() => setSelectedMagarTier(lv)}
                        style={{
                          padding: '7px',
                          borderRadius: '8px',
                          background: isSelected ? 'rgba(180, 83, 9, 0.24)' : 'rgba(2, 6, 23, 0.62)',
                          border: isSelected ? `1.5px solid ${spec.rarityColor}` : '1px solid rgba(148, 163, 184, 0.22)',
                          boxShadow: isSelected ? `0 0 12px ${spec.rarityColor}33` : 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '5px',
                          alignItems: 'center',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                          <span style={{ font: "800 12px 'Barlow Condensed', sans-serif", color: spec.rarityColor }}>
                            Lv.{lv} {spec.tierName}
                          </span>
                          <span style={{ fontSize: '10px', color: '#fde047', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {totalRank}/{maxTotalRank}
                          </span>
                        </div>
                        <MagarChartSprite
                          level={lv}
                          part="warrior"
                          alt={`Lv.${lv} ${spec.tierName}`}
                          height={112}
                          accentColor={spec.rarityColor}
                        />
                        <div style={{ fontSize: '10px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>
                          Owned: <strong>{owned.toLocaleString()}</strong>
                        </div>
                        <div style={{ fontSize: '9.5px', color: '#86efac', fontVariantNumeric: 'tabular-nums' }}>
                          +{Math.round((mults.atkMult - 1) * 100)}% ATK · +{Math.round(mults.shieldMitigationPct * 100)}% DEF · +{Math.round((mults.hpMult - 1) * 100)}% HP
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Tier Armory Forge Panel */}
                {(() => {
                  const spec = MAGAR_PROGRESSION_SPECS[selectedMagarTier];
                  const ranks = activeInfantryGear[selectedMagarTier];
                  const mults = getInfantryTierMultipliers(selectedMagarTier, activeInfantryGear);
                  const baseRow = balanceConfig.troops.infantry.levels[selectedMagarTier];
                  const forgedAtk = Number((baseRow.attack * mults.atkMult).toFixed(1));
                  const forgedHp = Math.round(baseRow.hp * mults.hpMult);
                  const forgedPower = Math.round(baseRow.power * mults.powerMult);

                  const slots: Array<{
                    slot: InfantryGearSlot;
                    part: 'weapon' | 'shield' | 'armor';
                    label: string;
                    itemName: string;
                    statSummary: string;
                    rank: number;
                  }> = [
                    {
                      slot: 'weapon',
                      part: 'weapon',
                      label: 'INFANTRY WEAPON',
                      itemName: spec.weaponName,
                      statSummary: '+6% Attack per forge rank (max +18%)',
                      rank: ranks.weapon,
                    },
                    {
                      slot: 'shield',
                      part: 'shield',
                      label: 'DEFENSE SHIELD',
                      itemName: spec.shieldName,
                      statSummary: '+5% Damage Mitigation & +3% HP per rank',
                      rank: ranks.shield,
                    },
                    {
                      slot: 'armor',
                      part: 'armor',
                      label: 'BODY ARMOR',
                      itemName: spec.armorName,
                      statSummary: '+6% Unit HP & Armor Plating per rank',
                      rank: ranks.armor,
                    },
                  ];

                  return (
                    <div
                      style={{
                        background: 'rgba(2, 6, 23, 0.56)',
                        border: `1px solid ${spec.rarityColor}44`,
                        borderRadius: '8px',
                        padding: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '9px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ font: "800 14px 'Barlow Condensed', sans-serif", color: spec.rarityColor }}>
                            LV.{selectedMagarTier} {spec.tierName.toUpperCase()} ARMORY · {spec.loreNote}
                          </div>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#fef08a', fontVariantNumeric: 'tabular-nums' }}>
                          Effective Unit: Power {forgedPower} · HP {forgedHp} · ATK {forgedAtk} · Shield DEF +{Math.round(mults.shieldMitigationPct * 100)}%
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                        {slots.map((s) => {
                          const cost = getInfantryGearUpgradeCost(selectedMagarTier, s.slot, s.rank);
                          const canAfford =
                            !cost ||
                            (resources.wood >= cost.wood &&
                              resources.iron >= cost.iron &&
                              resources.gold >= cost.gold &&
                              resources.crystal >= cost.crystal);

                          return (
                            <div
                              key={s.slot}
                              style={{
                                background: 'rgba(15, 23, 42, 0.72)',
                                border: '1px solid rgba(148, 163, 184, 0.22)',
                                borderRadius: '7px',
                                padding: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ font: "700 10.5px 'Barlow Condensed', sans-serif", color: '#94a3b8', letterSpacing: '0.04em' }}>
                                  {s.label}
                                </span>
                                <span style={{ fontSize: '10.5px', fontWeight: 700, color: s.rank >= MAX_INFANTRY_GEAR_RANK ? '#facc15' : '#38bdf8', fontVariantNumeric: 'tabular-nums' }}>
                                  Rank +{s.rank}/{MAX_INFANTRY_GEAR_RANK}
                                </span>
                              </div>

                              <MagarChartSprite
                                level={selectedMagarTier}
                                part={s.part}
                                alt={s.itemName}
                                height={74}
                                accentColor={spec.rarityColor}
                              />

                              <div style={{ font: "800 12.5px 'Barlow Condensed', sans-serif", color: '#f8fafc' }}>
                                {s.itemName}
                              </div>
                              <div style={{ fontSize: '10px', color: '#86efac' }}>
                                {s.statSummary}
                              </div>

                              {/* Rank pips */}
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {[1, 2, 3].map((pip) => (
                                  <div
                                    key={pip}
                                    style={{
                                      flex: 1,
                                      height: '5px',
                                      borderRadius: '2px',
                                      background: s.rank >= pip ? spec.rarityColor : 'rgba(148, 163, 184, 0.2)',
                                    }}
                                  />
                                ))}
                              </div>

                              {cost ? (
                                <>
                                  <div style={{ fontSize: '10px', color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
                                    Cost: {cost.wood.toLocaleString()} Wood · {cost.iron.toLocaleString()} Iron · {cost.gold.toLocaleString()} Gold
                                    {cost.crystal > 0 ? ` · ${cost.crystal.toLocaleString()} Crystal` : ''}
                                  </div>
                                  <button
                                    type="button"
                                    disabled={!canAfford}
                                    onClick={() => onUpgradeInfantryGear?.(selectedMagarTier, s.slot)}
                                    style={{
                                      minHeight: '40px',
                                      borderRadius: '6px',
                                      background: canAfford
                                        ? 'linear-gradient(180deg, #d97706, #b45309)'
                                        : 'rgba(30, 41, 59, 0.7)',
                                      border: canAfford ? '1px solid #fde047' : '1px solid rgba(148, 163, 184, 0.2)',
                                      color: canAfford ? '#fef08a' : '#64748b',
                                      font: "800 12px 'Barlow Condensed', sans-serif",
                                      letterSpacing: '0.04em',
                                      cursor: canAfford ? 'pointer' : 'not-allowed',
                                    }}
                                  >
                                    {canAfford ? `FORGE UPGRADE +${s.rank + 1}` : 'NEED RESOURCES'}
                                  </button>
                                </>
                              ) : (
                                <div
                                  style={{
                                    minHeight: '40px',
                                    display: 'grid',
                                    placeItems: 'center',
                                    borderRadius: '6px',
                                    background: 'rgba(234, 179, 8, 0.14)',
                                    border: '1px solid rgba(250, 204, 21, 0.45)',
                                    color: '#facc15',
                                    font: "800 12px 'Barlow Condensed', sans-serif",
                                    letterSpacing: '0.05em',
                                  }}
                                >
                                  MASTERWORK MAXED (+3)
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {CLASS_ORDER.map((cls) => {
                const tCfg = balanceConfig.troops[cls];
                return (
                  <div key={cls} style={{ ...panelBg, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                      <div style={{ font: "800 14px 'Barlow Condensed', sans-serif", color: '#fef08a' }}>
                        {tCfg.name} — {tCfg.cultureTitle}
                      </div>
                      <div style={{ fontSize: '11px', color: '#34d399' }}>
                        Strong vs {balanceConfig.troops[tCfg.counters].name} · Weak vs {balanceConfig.troops[tCfg.weakTo].name}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>{tCfg.roleSummary}</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', fontVariantNumeric: 'tabular-nums' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.25)', color: '#94a3b8', textAlign: 'right' }}>
                            <th style={{ textAlign: 'left', padding: '4px 6px' }}>Level</th>
                            <th style={{ padding: '4px 6px', color: '#facc15' }}>Power</th>
                            <th style={{ padding: '4px 6px', color: '#34d399' }}>HP</th>
                            <th style={{ padding: '4px 6px', color: '#f87171' }}>Attack</th>
                            {cls === 'infantry' && <th style={{ padding: '4px 6px', color: '#38bdf8' }}>Gear / DEF</th>}
                            <th style={{ padding: '4px 6px', color: '#fde68a' }}>Load</th>
                            <th style={{ padding: '4px 6px', color: '#38bdf8' }}>Gather Speed /min</th>
                            <th style={{ padding: '4px 6px', color: '#c084fc' }}>March Speed t/min</th>
                            <th style={{ padding: '4px 6px' }}>Rec. Monsters</th>
                            <th style={{ padding: '4px 6px' }}>Owned</th>
                          </tr>
                        </thead>
                        <tbody>
                          {TROOP_LEVELS.map((lv) => {
                            const r = tCfg.levels[lv];
                            const owned = troopInventory[cls]?.[lv] || 0;
                            const [mMin, mMax] = getRecommendedMonsterBand(lv);
                            const gMult = cls === 'infantry' ? getInfantryTierMultipliers(lv, activeInfantryGear) : null;
                            const effPower = gMult ? Math.round(r.power * gMult.powerMult) : r.power;
                            const effHp = gMult ? Math.round(r.hp * gMult.hpMult) : r.hp;
                            const effAtk = gMult ? Number((r.attack * gMult.atkMult).toFixed(1)) : r.attack;
                            return (
                              <tr key={lv} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'right' }}>
                                <td style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 700, color: '#fef08a' }}>
                                  Lv.{lv}{cls === 'infantry' ? ` (${MAGAR_PROGRESSION_SPECS[lv].tierName})` : ''}
                                </td>
                                <td style={{ padding: '4px 6px', color: '#facc15', fontWeight: 700 }}>{effPower}</td>
                                <td style={{ padding: '4px 6px' }}>{effHp}</td>
                                <td style={{ padding: '4px 6px' }}>{effAtk}</td>
                                {cls === 'infantry' && (
                                  <td style={{ padding: '4px 6px', color: '#38bdf8' }}>
                                    +{Math.round((gMult?.shieldMitigationPct || 0) * 100)}% DEF ({activeInfantryGear[lv].weapon}/{activeInfantryGear[lv].shield}/{activeInfantryGear[lv].armor})
                                  </td>
                                )}
                                <td style={{ padding: '4px 6px' }}>{r.load}</td>
                                <td style={{ padding: '4px 6px' }}>{r.gatheringSpeed.toFixed(1)}</td>
                                <td style={{ padding: '4px 6px' }}>{r.marchingSpeed.toFixed(1)}</td>
                                <td style={{ padding: '4px 6px', color: '#86efac' }}>Lv.{mMin}–{mMax}</td>
                                <td style={{ padding: '4px 6px', color: '#fff', fontWeight: 700 }}>{owned.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 5: SHRINES C / B / A */}
          {activeTab === 'shrines' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Alliance 5-Shrine Cap & Congress Prerequisite Strip */}
              <div
                style={{
                  ...panelBg,
                  padding: '9px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                  fontSize: '11.5px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <div style={{ color: '#e2e8f0' }}>
                  <strong style={{ color: shrineRuleStatus.atShrineCap ? '#fca5a5' : '#34d399' }}>
                    Alliance Shrine Cap: {shrineRuleStatus.totalShrinesHeld} / {shrineRuleStatus.maxShrinesPerAlliance}
                  </strong>{' '}
                  · Held: C {shrineRuleStatus.heldByTier.shrine_c}/{balanceConfig.congressPrerequisites.shrine_c} · B {shrineRuleStatus.heldByTier.shrine_b}/{balanceConfig.congressPrerequisites.shrine_b} · A {shrineRuleStatus.heldByTier.shrine_a}/{balanceConfig.congressPrerequisites.shrine_a}
                </div>
                <div style={{ color: shrineRuleStatus.congressUnlocked ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                  Congress Status: {shrineRuleStatus.congressUnlocked ? 'UNLOCKED (Ready for [1600, 1600])' : shrineRuleStatus.congressRequirementText}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                {(['shrine_c', 'shrine_b', 'shrine_a'] as const).map((tierKey) => (
                  <button
                    key={tierKey}
                    type="button"
                    onClick={() => {
                      setShrineTierTab(tierKey);
                      const heldInTier = RESERVED_PLOTS.find((p) => p.type === tierKey && shrineRuleStatus.heldIds.has(p.id));
                      const first = heldInTier || RESERVED_PLOTS.find((p) => p.type === tierKey);
                      if (first) onSelectStructureId(first.id);
                    }}
                    style={{
                      minHeight: '38px',
                      padding: '6px 12px',
                      borderRadius: '7px',
                      background: shrineTierTab === tierKey ? '#b45309' : 'rgba(30,41,59,0.8)',
                      border: shrineTierTab === tierKey ? '1px solid #fde047' : '1px solid rgba(148,163,184,0.2)',
                      color: shrineTierTab === tierKey ? '#fef08a' : '#cbd5e1',
                      font: "700 12px 'Barlow Condensed', sans-serif",
                      cursor: 'pointer',
                    }}
                  >
                    {balanceConfig.structures[tierKey].label} ({shrineRuleStatus.heldByTier[tierKey]})
                  </button>
                ))}

                <select
                  value={activeShrineSite?.id || ''}
                  onChange={(e) => onSelectStructureId(e.target.value)}
                  style={{
                    minHeight: '38px',
                    padding: '6px 10px',
                    borderRadius: '7px',
                    background: 'rgba(2,6,23,0.85)',
                    border: '1px solid #38bdf8',
                    color: '#e0f2fe',
                    fontSize: '12px',
                  }}
                >
                  {shrineSitesForTier.map((site) => {
                    const isHeld = shrineRuleStatus.heldIds.has(site.id);
                    return (
                      <option key={site.id} value={site.id}>
                        {isHeld ? '★ HELD · ' : ''}{site.name} [{Math.round(site.position[0])}, {Math.round(site.position[2])}]
                      </option>
                    );
                  })}
                </select>

                {activeShrineSite && (
                  <button
                    type="button"
                    onClick={() => {
                      onPanTo(activeShrineSite.position[0], activeShrineSite.position[2]);
                      onClose();
                    }}
                    style={{
                      minHeight: '38px',
                      padding: '6px 10px',
                      borderRadius: '7px',
                      background: 'rgba(2,132,199,0.25)',
                      border: '1px solid #38bdf8',
                      color: '#bae6fd',
                      font: "700 11.5px 'Barlow Condensed', sans-serif",
                      cursor: 'pointer',
                    }}
                  >
                    Pan to Shrine ↗
                  </button>
                )}
              </div>

              {activeShrineSite && renderGarrisonModule(activeShrineSite.id, shrineTierTab, activeShrineSite.name)}
            </div>
          )}

          {/* TAB 6: ALLIANCE CONGRESS LV 4 */}
          {activeTab === 'congress' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ ...panelBg, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ font: "800 14.5px 'Barlow Condensed', sans-serif", color: '#fef08a' }}>
                    [{playerAlliance.tag}] {playerAlliance.alias.toUpperCase()} — CONGRESS CITADEL [1600, 1600]
                  </div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
                    Requires 2 C Shrines ({shrineRuleStatus.heldByTier.shrine_c}/2) · 1 B Shrine ({shrineRuleStatus.heldByTier.shrine_b}/1) · 1 A Shrine ({shrineRuleStatus.heldByTier.shrine_a}/1) within the 5-Shrine Alliance Cap ({shrineRuleStatus.totalShrinesHeld}/{shrineRuleStatus.maxShrinesPerAlliance}).
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {!shrineRuleStatus.congressUnlocked && (
                    <button
                      type="button"
                      onClick={() => onSelectTab('shrines')}
                      style={{
                        minHeight: '38px',
                        padding: '6px 12px',
                        borderRadius: '7px',
                        background: 'linear-gradient(180deg, #b45309, #78350f)',
                        border: '1px solid #fde047',
                        color: '#fef08a',
                        font: "700 11.5px 'Barlow Condensed', sans-serif",
                        cursor: 'pointer',
                      }}
                    >
                      Manage Shrines ({shrineRuleStatus.totalShrinesHeld}/5)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onPanTo(1600, 1600);
                      onClose();
                    }}
                    style={{
                      minHeight: '38px',
                      padding: '6px 12px',
                      borderRadius: '7px',
                      background: 'rgba(2,132,199,0.25)',
                      border: '1px solid #38bdf8',
                      color: '#bae6fd',
                      font: "700 11.5px 'Barlow Condensed', sans-serif",
                      cursor: 'pointer',
                    }}
                  >
                    Focus Congress [1600, 1600] ↗
                  </button>
                </div>
              </div>
              {renderGarrisonModule('plot-congress-center', 'congress', 'The Congress (Central Citadel)')}
            </div>
          )}

          {/* TAB 7: ACTIVE MARCHES */}
          {activeTab === 'marches' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ font: "800 14px 'Barlow Condensed', sans-serif", color: '#fef08a' }}>
                ACTIVE FIELD EXPEDITIONS ({activeMarches.length} / {balanceConfig.maxSimultaneousMarches} SLOTS)
              </div>
              {activeMarches.length === 0 ? (
                <div style={{ ...panelBg, padding: '16px', fontSize: '12px', color: '#94a3b8' }}>
                  No Nepalese battalions are currently marching. Select any Resource Node or Monster on the 3D World Map to dispatch a timed march.
                </div>
              ) : (
                activeMarches.map((march) => {
                  const targetMs = march.phaseStartedAt + march.phaseDurationMs;
                  const heroCfg = getHeroById(march.heroId);
                  const mMetrics = calculateArmyMetrics(march.stacks, balanceConfig, bonuses, heroCfg, activeInfantryGear);

                  return (
                    <div key={march.id} style={{ ...panelBg, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', fontVariantNumeric: 'tabular-nums' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {(heroCfg || march.heroId || march.heroName) && (
                            <HeroPortrait hero={heroCfg} heroId={march.heroId} heroName={march.heroName} size={36} rounded={7} />
                          )}
                          <div>
                            <span style={{ font: "800 14px 'Barlow Condensed', sans-serif", color: '#fef08a' }}>
                              {march.targetName} (Lv.{march.targetLevel})
                            </span>
                            {(march.heroName || heroCfg?.name) && (
                              <span style={{ marginLeft: '8px', fontSize: '10.5px', color: heroCfg?.crestColor || '#fde047', fontWeight: 700 }}>
                                · Lead Hero: {march.heroName || heroCfg?.name}
                              </span>
                            )}
                            <span style={{ marginLeft: '8px', fontSize: '11px', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 700 }}>
                              · {march.status} (<SimCountdownText targetMs={targetMs} format="duration" />)
                            </span>
                          </div>
                        </div>
                        {march.status !== 'returning' && (
                          <button
                            type="button"
                            onClick={() => onRecallMarch(march.id)}
                            style={{
                              minHeight: '36px',
                              padding: '4px 12px',
                              borderRadius: '6px',
                              background: 'rgba(220, 38, 38, 0.25)',
                              border: '1px solid #f87171',
                              color: '#fecaca',
                              font: "700 11.5px 'Barlow Condensed', sans-serif",
                              cursor: 'pointer',
                            }}
                          >
                            Recall Troops
                          </button>
                        )}
                      </div>

                      <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                        Army: {mMetrics.totalCount.toLocaleString()} Troops ({mMetrics.totalPower.toLocaleString()} Power) · Distance: {march.distanceTiles} tiles ÷ {march.marchSpeedTilesPerMin} t/min = {march.formulaMarchMinutes}m formula time
                      </div>

                      {march.kind === 'gather' && (
                        <div style={{ fontSize: '11px', color: '#86efac' }}>
                          Gather Rate: {march.gatherSpeedPerMin.toLocaleString()} / min · Cargo Collected: {Math.floor(march.carriedAmount).toLocaleString()} / {march.maxCarryLoad.toLocaleString()} {march.resourceType?.toUpperCase()}
                        </div>
                      )}

                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <SimProgressFill
                          startedAt={march.phaseStartedAt}
                          completesAt={targetMs}
                          background={march.status === 'gathering' ? '#34d399' : march.status === 'returning' ? '#facc15' : '#38bdf8'}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 8: REPORTS, RESEARCH/EQUIPMENT & BALANCE CONFIG */}
          {activeTab === 'reports_config' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'reports' as const, label: `Battle Reports (${battleReports.length})` },
                  { id: 'research' as const, label: 'Research & Equipment' },
                  { id: 'balance' as const, label: 'Balance Config Editor (JSON)' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSubTab8(st.id)}
                    style={{
                      minHeight: '38px',
                      padding: '6px 12px',
                      borderRadius: '7px',
                      background: subTab8 === st.id ? '#0284c7' : 'rgba(30,41,59,0.8)',
                      border: subTab8 === st.id ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.2)',
                      color: subTab8 === st.id ? '#fff' : '#cbd5e1',
                      font: "700 12px 'Barlow Condensed', sans-serif",
                      cursor: 'pointer',
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {subTab8 === 'reports' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {battleReports.length === 0 ? (
                    <div style={{ ...panelBg, padding: '14px', fontSize: '12px', color: '#94a3b8' }}>
                      No combat reports yet. Attack Lv 1–10 monsters or simulate Shrine/Congress defense to log casualty & reward breakdowns.
                    </div>
                  ) : (
                    battleReports.map((rep) => (
                      <div key={rep.id} style={{ ...panelBg, padding: '10px 12px', fontSize: '11.5px', fontVariantNumeric: 'tabular-nums', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ font: "800 13.5px 'Barlow Condensed', sans-serif", color: rep.victory ? '#34d399' : '#f87171' }}>
                            {rep.victory ? 'VICTORY' : rep.kind === 'castle' ? 'SIEGE STRIKE' : 'DEFEAT'} · {rep.targetName} (Lv.{rep.targetLevel}) · {rep.rounds} Rounds
                            {rep.heroName ? ` · Lead Hero: ${rep.heroName}` : ''}
                          </span>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                            {new Date(rep.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div style={{ color: '#cbd5e1' }}>
                          Target Remaining HP: {rep.targetRemainingHp.toLocaleString()} / {rep.targetMaxHp.toLocaleString()} · Deployed: {rep.deployedCount.toLocaleString()}
                        </div>
                        <div style={{ color: '#fbbf24' }}>
                          Wounded (Hospital): Inf {rep.woundedByClass.infantry} · Arc {rep.woundedByClass.archer} · Cav {rep.woundedByClass.cavalry} | Lost: Inf {rep.lostByClass.infantry} · Arc {rep.lostByClass.archer} · Cav {rep.lostByClass.cavalry}
                        </div>
                        {(rep.victory || (rep.rewards.gold || 0) > 0 || (rep.rewards.xp || 0) > 0) && (
                          <div style={{ color: '#86efac' }}>
                            Rewards: Food +{rep.rewards.food || 0} · Wood +{rep.rewards.wood || 0} · Stone +{rep.rewards.stone || 0} · Iron +{rep.rewards.iron || 0} · Crystal +{rep.rewards.crystal || 0} · Gold +{rep.rewards.gold || 0} · XP +{rep.rewards.xp || 0}
                            {rep.rewards.equipmentDrop ? ` · Gear Drop: ${rep.rewards.equipmentDrop.name}` : ''}
                          </div>
                        )}
                        {rep.notes.map((n, i) => (
                          <div key={i} style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                            {n}
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}

              {subTab8 === 'research' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  <div style={{ ...panelBg, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ font: "800 14px 'Barlow Condensed', sans-serif", color: '#fef08a' }}>
                      NEPALESE ROYAL ACADEMY (RESEARCH)
                    </div>
                    {(
                      [
                        { key: 'martialArts' as const, title: 'Khukuri Martial Doctrine', desc: '+4% Troop Attack per level' },
                        { key: 'mountainLogistics' as const, title: 'Himalayan Trail Logistics', desc: '+5% March Speed & +4% Load per level' },
                        { key: 'alpineAgronomy' as const, title: 'Terraced Extraction Guild', desc: '+6% Gathering Speed per level' },
                        { key: 'fortressMedicine' as const, title: 'Ayurvedic Garrison Care', desc: '+5% Troop HP & +5% Hospital Speed per level' },
                      ]
                    ).map((r) => {
                      const curLv = research[r.key];
                      const nextCostWood = (curLv + 1) * 1400;
                      const nextCostCrystal = (curLv + 1) * 60;
                      return (
                        <div key={r.key} style={{ background: 'rgba(2,6,23,0.55)', padding: '8px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '12px', color: '#e2e8f0' }}>{r.title} (Lv.{curLv}/10)</div>
                            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>{r.desc}</div>
                            <div style={{ fontSize: '10px', color: '#22d3ee', fontVariantNumeric: 'tabular-nums' }}>
                              Cost: Wood {nextCostWood.toLocaleString()} · Crystal {nextCostCrystal.toLocaleString()}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={curLv >= 10}
                            onClick={() => onUpgradeResearch(r.key)}
                            style={{
                              minHeight: '36px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: curLv >= 10 ? '#334155' : '#0284c7',
                              border: '1px solid #38bdf8',
                              color: '#fff',
                              font: "700 11px 'Barlow Condensed', sans-serif",
                              cursor: curLv >= 10 ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {curLv >= 10 ? 'MAX' : 'Research +1'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ ...panelBg, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ font: "800 14px 'Barlow Condensed', sans-serif", color: '#fef08a' }}>
                      HERO ARMORY & MONSTER ARTIFACTS ({equippedIds.length} EQUIPPED)
                    </div>
                    {equipmentBag.map((item) => {
                      const isEquipped = equippedIds.includes(item.id);
                      return (
                        <div key={item.id} style={{ background: 'rgba(2,6,23,0.55)', padding: '8px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '12px', color: item.rarity === 'legendary' ? '#fde047' : item.rarity === 'epic' ? '#c084fc' : '#38bdf8' }}>
                              {item.name} [{item.slot.toUpperCase()}]
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>{item.description}</div>
                            <div style={{ fontSize: '10px', color: '#86efac', fontVariantNumeric: 'tabular-nums' }}>
                              {item.attackPct > 0 ? `+${Math.round(item.attackPct * 100)}% ATK ` : ''}
                              {item.hpPct > 0 ? `+${Math.round(item.hpPct * 100)}% HP ` : ''}
                              {item.marchPct > 0 ? `+${Math.round(item.marchPct * 100)}% March ` : ''}
                              {item.gatherPct > 0 ? `+${Math.round(item.gatherPct * 100)}% Gather ` : ''}
                              {item.loadPct > 0 ? `+${Math.round(item.loadPct * 100)}% Load` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onToggleEquipItem(item.id)}
                            style={{
                              minHeight: '36px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: isEquipped ? '#059669' : 'rgba(51,65,85,0.85)',
                              border: isEquipped ? '1px solid #34d399' : '1px solid rgba(148,163,184,0.3)',
                              color: '#fff',
                              font: "700 11px 'Barlow Condensed', sans-serif",
                              cursor: 'pointer',
                            }}
                          >
                            {isEquipped ? 'Equipped ✓' : 'Equip'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {subTab8 === 'balance' && (
                <div style={{ ...panelBg, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ font: "800 14px 'Barlow Condensed', sans-serif", color: '#fef08a' }}>
                      LIVE BALANCE & SIMULATION CONFIG (PERSISTED TO LOCALSTORAGE)
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setBalanceDraftJson(JSON.stringify(balanceConfig, null, 2));
                          setShowRawJson((v) => !v);
                        }}
                        style={{
                          minHeight: '36px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: '#0284c7',
                          border: '1px solid #38bdf8',
                          color: '#fff',
                          font: "700 11px 'Barlow Condensed', sans-serif",
                          cursor: 'pointer',
                        }}
                      >
                        {showRawJson ? 'Hide JSON Editor' : 'Edit Raw JSON'}
                      </button>
                      <button
                        type="button"
                        onClick={onResetBalanceConfig}
                        style={{
                          minHeight: '36px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'rgba(220,38,38,0.25)',
                          border: '1px solid #f87171',
                          color: '#fecaca',
                          font: "700 11px 'Barlow Condensed', sans-serif",
                          cursor: 'pointer',
                        }}
                      >
                        Reset Defaults
                      </button>
                    </div>
                  </div>

                  {/* Alliance Identity Editor: 4-Char Tag & 4-Word Alias */}
                  <div style={{ background: 'rgba(2,6,23,0.55)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    <div style={{ font: "800 13px 'Barlow Condensed', sans-serif", color: '#a7f3d0' }}>
                      ALLIANCE TAG (4 CHARS) & 4-WORD ALIAS IDENTITY
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        maxLength={4}
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4))}
                        placeholder="GORK"
                        style={{
                          width: '86px',
                          minHeight: '36px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: '#0f172a',
                          border: '1px solid rgba(56,189,248,0.4)',
                          color: '#fef08a',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          fontSize: '12px',
                        }}
                      />
                      <input
                        type="text"
                        value={aliasDraft}
                        onChange={(e) => setAliasDraft(e.target.value)}
                        placeholder="Royal Himalayan Mountain Guard"
                        style={{
                          flex: 1,
                          minWidth: '220px',
                          minHeight: '36px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: '#0f172a',
                          border: '1px solid rgba(56,189,248,0.4)',
                          color: '#e2e8f0',
                          fontSize: '12px',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => onUpdateAllianceIdentity(normalizeAllianceTag(tagDraft), aliasDraft)}
                        style={{
                          minHeight: '36px',
                          padding: '5px 12px',
                          borderRadius: '6px',
                          background: 'linear-gradient(180deg, #059669, #065f46)',
                          border: '1px solid #34d399',
                          color: '#fff',
                          font: "700 11.5px 'Barlow Condensed', sans-serif",
                          cursor: 'pointer',
                        }}
                      >
                        Save Alliance Identity
                      </button>
                    </div>
                    {(() => {
                      const check = validateAllianceAlias(aliasDraft);
                      return (
                        <div style={{ fontSize: '10.5px', color: check.valid ? '#86efac' : '#fca5a5' }}>
                          {check.valid
                            ? `Preview: [${normalizeAllianceTag(tagDraft)}] ${check.normalized} (Valid 4-word alias)`
                            : check.error}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Time Scale & Global Combat Parameters */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', fontSize: '11.5px' }}>
                    <span>Simulation Speed:</span>
                    {[
                      { label: '1× Real-Time', val: 1 },
                      { label: '12× Tactical (Default)', val: 12 },
                      { label: '60× Rapid Test', val: 60 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() =>
                          onUpdateBalanceConfig({
                            ...balanceConfig,
                            simulationTimeScale: opt.val,
                          })
                        }
                        style={{
                          minHeight: '34px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: balanceConfig.simulationTimeScale === opt.val ? '#b45309' : 'rgba(30,41,59,0.8)',
                          border: balanceConfig.simulationTimeScale === opt.val ? '1px solid #fde047' : '1px solid rgba(148,163,184,0.2)',
                          color: '#fff',
                          font: "700 11px 'Barlow Condensed', sans-serif",
                          cursor: 'pointer',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Quick Monster Respawn & Crystal Capacity Editor */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                    {balanceConfig.monstersByLevel.slice(0, 5).map((m, idx) => (
                      <div key={m.level} style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Monster Lv.{m.level} Respawn (s):</span>
                        <input
                          type="number"
                          min={5}
                          max={3600}
                          value={m.respawnSeconds}
                          onChange={(e) => {
                            const val = Math.max(5, Number(e.target.value) || 45);
                            const nextMonsters = balanceConfig.monstersByLevel.map((row, i) =>
                              i === idx ? { ...row, respawnSeconds: val } : row
                            );
                            onUpdateBalanceConfig({ ...balanceConfig, monstersByLevel: nextMonsters });
                          }}
                          style={{
                            width: '70px',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            background: '#0f172a',
                            border: '1px solid rgba(148,163,184,0.35)',
                            color: '#fef08a',
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {showRawJson && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <textarea
                        value={balanceDraftJson}
                        onChange={(e) => setBalanceDraftJson(e.target.value)}
                        rows={11}
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '6px',
                          background: '#020617',
                          border: '1px solid rgba(56,189,248,0.4)',
                          color: '#e2e8f0',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            const parsed = JSON.parse(balanceDraftJson) as GameBalanceConfig;
                            if (!Array.isArray(parsed.resourcesByLevel) || !Array.isArray(parsed.monstersByLevel)) {
                              throw new Error('Missing resourcesByLevel or monstersByLevel arrays');
                            }
                            onUpdateBalanceConfig(parsed);
                            onShowToast?.('Balance JSON configuration saved & applied.');
                          } catch (err) {
                            onShowToast?.(`Invalid JSON: ${err instanceof Error ? err.message : 'parse error'}`);
                          }
                        }}
                        style={{
                          minHeight: '38px',
                          alignSelf: 'flex-start',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          background: '#059669',
                          border: '1px solid #34d399',
                          color: '#fff',
                          font: "700 12px 'Barlow Condensed', sans-serif",
                          cursor: 'pointer',
                        }}
                      >
                        Apply & Save JSON Config
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
