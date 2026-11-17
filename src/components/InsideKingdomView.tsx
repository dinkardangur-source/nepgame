import React, { useState } from 'react';
import {
  InsideKingdomState,
  MergeBuildingCategory,
  BUILDING_TEMPLATES,
} from '../game/InsideKingdom3D';

interface InsideKingdomViewProps {
  kingdomState: InsideKingdomState | null;
  resources: {
    wood: number;
    stone: number;
    iron: number;
    food: number;
    gold: number;
    gems: number;
  };
  onSpendResources: (cost: { wood: number; stone: number; iron: number; food: number }) => boolean;
  onGrantReward: (
    type: 'wood' | 'stone' | 'iron' | 'food' | 'gold' | 'gems',
    amount: number,
    label: string
  ) => void;
  onSelectPlot: (plotId: string) => void;
  onMergeSelected: () => boolean;
  onAutoMergeAll: () => number;
  onConstructBuilding: (category: MergeBuildingCategory, preferredPlotId?: string) => boolean;
  onUpgradeKeep: () => boolean;
  onShowToast: (msg: string) => void;
  onReturnToWorld: () => void;
}

const CATEGORIES: MergeBuildingCategory[] = ['barracks', 'tower', 'mill', 'shrine'];

export const InsideKingdomView: React.FC<InsideKingdomViewProps> = ({
  kingdomState,
  resources,
  onSpendResources,
  onGrantReward,
  onSelectPlot,
  onMergeSelected,
  onAutoMergeAll,
  onConstructBuilding,
  onUpgradeKeep,
  onShowToast,
  onReturnToWorld,
}) => {
  const [trainedTroopPower, setTrainedTroopPower] = useState<number>(0);

  if (!kingdomState) return null;

  const { keepLevel, keepMaxLevel, keepPower, plots, selectedPlotId } = kingdomState;

  const occupiedPlots = plots.filter((p) => p.building !== null);
  const emptyPlotsCount = plots.length - occupiedPlots.length;

  // Count how many matching (category, level) pairs exist across the 3D courtyard
  const countMergeablePairs = (): number => {
    const counts = new Map<string, number>();
    for (const p of occupiedPlots) {
      if (!p.building || p.building.level >= p.building.maxLevel) continue;
      const key = `${p.building.category}-${p.building.level}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let pairs = 0;
    counts.forEach((c) => {
      pairs += Math.floor(c / 2);
    });
    return pairs;
  };

  const mergeablePairsCount = countMergeablePairs();

  const totalKingdomPower =
    keepPower +
    occupiedPlots.reduce((sum, p) => sum + (p.building?.powerBonus || 0), 0) +
    trainedTroopPower;

  const selectedPlot =
    selectedPlotId && selectedPlotId !== 'keep'
      ? plots.find((p) => p.plotId === selectedPlotId) || null
      : null;

  const selectedBuilding = selectedPlot?.building || null;

  // Check if the currently selected 3D building has a matching twin on another 3D plot
  const matchingTwinPlot =
    selectedPlot && selectedBuilding && selectedBuilding.level < selectedBuilding.maxLevel
      ? plots.find(
          (p) =>
            p.plotId !== selectedPlot.plotId &&
            p.building &&
            p.building.category === selectedBuilding.category &&
            p.building.level === selectedBuilding.level
        ) || null
      : null;

  const handleSummonBuilding = (cat: MergeBuildingCategory) => {
    if (emptyPlotsCount <= 0) {
      onShowToast('⚠️ All 16 3D Courtyard Plots are full! Merge matching buildings first!');
      return;
    }
    const cost = BUILDING_TEMPLATES[cat].baseCost;
    const ok = onSpendResources(cost);
    if (!ok) {
      onShowToast(`⚠️ Insufficient resources to construct ${BUILDING_TEMPLATES[cat].baseName}!`);
      return;
    }
    const built = onConstructBuilding(
      cat,
      selectedPlot && !selectedPlot.building ? selectedPlot.plotId : undefined
    );
    if (built) {
      onShowToast(
        `🔨 Constructed Lv.1 ${BUILDING_TEMPLATES[cat].baseName} on 3D Courtyard! Click matching buildings to merge!`
      );
    }
  };

  const handleAutoMergeClick = () => {
    const mergedCount = onAutoMergeAll();
    if (mergedCount > 0) {
      onShowToast(
        `✨ Auto-Merged ${mergedCount} building pair${mergedCount > 1 ? 's' : ''} in the 3D Citadel Courtyard!`
      );
    } else {
      onShowToast('ℹ️ No matching 3D building pairs found! Summon more buildings to merge.');
    }
  };

  const handleMergeSelectedClick = () => {
    const ok = onMergeSelected();
    if (ok && selectedBuilding) {
      onShowToast(
        `✨ Merged twin ${BUILDING_TEMPLATES[selectedBuilding.category].baseName} into Lv.${selectedBuilding.level + 1}!`
      );
    }
  };

  const handleQuickCollectOrTrain = () => {
    if (selectedPlotId === 'keep') {
      onGrantReward('gold', 1500, 'Imperial Pagoda Keep');
      return;
    }
    if (!selectedBuilding) return;

    if (selectedBuilding.rewardType === 'troops') {
      const bonus = selectedBuilding.rewardAmount * 25;
      setTrainedTroopPower((prev) => prev + bonus);
      onShowToast(
        `⚔️ Trained +${selectedBuilding.rewardAmount} Gurkha Shock Troops (+${bonus.toLocaleString()} ⚡ Power)!`
      );
    } else {
      onGrantReward(
        selectedBuilding.rewardType,
        selectedBuilding.rewardAmount,
        selectedBuilding.name
      );
    }
  };

  const keepUpgradeCost = {
    wood: keepLevel * 650,
    stone: keepLevel * 750,
    iron: keepLevel * 450,
    food: keepLevel * 400,
  };

  const handleKeepUpgradeClick = () => {
    if (keepLevel >= keepMaxLevel) {
      onShowToast('✨ Imperial Pagoda Keep is at Maximum Tier!');
      return;
    }
    if (!onSpendResources(keepUpgradeCost)) {
      onShowToast('⚠️ Insufficient resources in Vanguard Vault to upgrade the Imperial Keep!');
      return;
    }
    onUpgradeKeep();
    onShowToast(`🏯 Upgraded Imperial Pagoda Keep to Lv.${keepLevel + 1}!`);
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* 1. TOP-CENTER 3D CITADEL MERGE BANNER */}
      <div
        className="inside-top-banner"
        style={{
          marginTop: '12px',
          alignSelf: 'center',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(9, 13, 22, 0.95))',
          borderTop: '1.5px solid #dfba6e',
          borderLeft: '1.5px solid #dfba6e',
          borderRight: '1.5px solid #dfba6e',
          borderBottom: '3.5px solid #78350f',
          borderRadius: '12px',
          padding: '6px 18px',
          boxShadow: '0 10px 28px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          pointerEvents: 'auto',
        }}
      >
        <div
          onClick={() => onSelectPlot('keep')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          title="Click to inspect Central Imperial Pagoda Keep"
        >
          <span style={{ fontSize: '20px' }}>🏯</span>
          <div>
            <div
              style={{
                font: "800 13.5px 'Barlow Condensed', sans-serif",
                color: '#fef08a',
                letterSpacing: '0.06em',
              }}
            >
              3D CITADEL MERGE COURTYARD (KEEP LV.{keepLevel})
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              Click matching 3D buildings (Green Ring) on the courtyard to merge & evolve tiers
            </div>
          </div>
        </div>

        <div style={{ width: '1px', height: '26px', background: 'rgba(255,255,255,0.14)' }} />

        <div style={{ textAlign: 'right' }}>
          <div style={{ font: "700 12px 'Barlow Condensed'", color: '#38bdf8' }}>
            ⚡ {totalKingdomPower.toLocaleString()} CITADEL POWER
          </div>
          <div style={{ fontSize: '9.5px', color: '#86efac' }}>
            {occupiedPlots.length}/16 3D Plots Active · {mergeablePairsCount} Merge Pair
            {mergeablePairsCount === 1 ? '' : 's'} Ready
          </div>
        </div>

        <button
          type="button"
          onClick={handleAutoMergeClick}
          style={{
            padding: '6px 13px',
            borderRadius: '8px',
            background:
              mergeablePairsCount > 0
                ? 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)'
                : 'linear-gradient(180deg, #334155 0%, #1e293b 100%)',
            borderTop: mergeablePairsCount > 0 ? '1.5px solid #4ade80' : '1px solid rgba(255,255,255,0.2)',
            borderLeft: mergeablePairsCount > 0 ? '1.5px solid #4ade80' : '1px solid rgba(255,255,255,0.2)',
            borderRight: mergeablePairsCount > 0 ? '1.5px solid #4ade80' : '1px solid rgba(255,255,255,0.2)',
            borderBottom: mergeablePairsCount > 0 ? '3.5px solid #14532d' : '3px solid #0f172a',
            color: '#fef08a',
            font: "800 11.5px 'Barlow Condensed', sans-serif",
            letterSpacing: '0.04em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow:
              mergeablePairsCount > 0
                ? '0 0 16px rgba(74, 222, 128, 0.45), 0 4px 10px rgba(0,0,0,0.6)'
                : '0 4px 10px rgba(0,0,0,0.5)',
          }}
        >
          <span>✨</span>
          <span>AUTO-MERGE ({mergeablePairsCount})</span>
        </button>
      </div>

      {/* 2. BOTTOM-CENTER 3D BUILDING SUMMON & MERGE DECK */}
      <div
        className="inside-summon-deck"
        style={{
          alignSelf: 'center',
          marginBottom: '88px',
          background: 'rgba(10, 16, 26, 0.96)',
          borderTop: '1.5px solid #dfba6e',
          borderLeft: '1.5px solid #dfba6e',
          borderRight: '1.5px solid #dfba6e',
          borderBottom: '4px solid #78350f',
          borderRadius: '12px',
          padding: '8px 12px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'auto',
          zIndex: 60,
        }}
      >
        <div style={{ paddingRight: '6px', borderRight: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ font: "800 11px 'Barlow Condensed'", color: '#fef08a', letterSpacing: '0.05em' }}>
            🔨 SUMMON 3D BUILDING
          </div>
          <div style={{ fontSize: '9px', color: '#94a3b8' }}>
            {emptyPlotsCount} Empty Plot{emptyPlotsCount === 1 ? '' : 's'}
          </div>
        </div>

        {CATEGORIES.map((cat) => {
          const tpl = BUILDING_TEMPLATES[cat];
          const canAfford =
            resources.wood >= tpl.baseCost.wood &&
            resources.stone >= tpl.baseCost.stone &&
            resources.iron >= tpl.baseCost.iron &&
            resources.food >= tpl.baseCost.food &&
            emptyPlotsCount > 0;

          return (
            <button
              key={cat}
              type="button"
              onClick={() => handleSummonBuilding(cat)}
              style={{
                padding: '5px 10px',
                borderRadius: '8px',
                background: canAfford
                  ? 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)'
                  : 'rgba(15, 23, 42, 0.5)',
                borderTop: canAfford ? '1px solid #dfba6e' : '1px solid rgba(255,255,255,0.12)',
                borderLeft: canAfford ? '1px solid #dfba6e' : '1px solid rgba(255,255,255,0.12)',
                borderRight: canAfford ? '1px solid #dfba6e' : '1px solid rgba(255,255,255,0.12)',
                borderBottom: canAfford ? '3px solid #78350f' : '3px solid #020617',
                color: canAfford ? '#f8fafc' : '#64748b',
                cursor: canAfford ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'transform 0.12s ease',
              }}
              title={`Summon Lv.1 ${tpl.baseName} (${tpl.baseCost.wood} Wood, ${tpl.baseCost.stone} Stone)`}
            >
              <span style={{ fontSize: '17px' }}>{tpl.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ font: "700 11px 'Barlow Condensed'", color: '#fef08a' }}>
                  + Lv.1 {cat.toUpperCase()}
                </div>
                <div style={{ fontSize: '8.5px', color: '#86efac' }}>
                  🌲{tpl.baseCost.wood} · 🪨{tpl.baseCost.stone}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. RIGHT-SIDE 3D COURTYARD PLOT & MERGE INSPECTOR CARD */}
      <div
        className="inside-inspector-card"
        style={{
          position: 'absolute',
          right: '14px',
          bottom: '90px',
          width: '310px',
          maxWidth: 'calc(100vw - 28px)',
          background: 'rgba(10, 16, 26, 0.97)',
          borderTop: '1.5px solid #dfba6e',
          borderLeft: '1.5px solid #dfba6e',
          borderRight: '1.5px solid #dfba6e',
          borderBottom: '4px solid #78350f',
          borderRadius: '12px',
          padding: '12px 14px',
          boxShadow: '0 6px 0 rgba(0,0,0,0.6), 0 16px 36px rgba(0,0,0,0.9)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'auto',
          zIndex: 65,
        }}
      >
        {selectedPlotId === 'keep' ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: '6px',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #78350f, #1e293b)',
                  border: '1.5px solid #facc15',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '20px',
                }}
              >
                🏯
              </div>
              <div>
                <div style={{ font: "700 13.5px 'Barlow Condensed'", color: '#fef08a' }}>
                  Emperor's Pagoda Keep (Lv.{keepLevel}/{keepMaxLevel})
                </div>
                <div style={{ fontSize: '9.5px', color: '#38bdf8', fontWeight: 600 }}>
                  SUPREME 3D CITADEL CENTERPIECE
                </div>
              </div>
            </div>

            <div style={{ fontSize: '10.5px', color: '#cbd5e1', lineHeight: 1.4 }}>
              Three-tiered gilded Himalayan pagoda palace overlooking the 16 3D merge plots.
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={handleQuickCollectOrTrain}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '7px',
                  background: 'linear-gradient(180deg, #0284c7 0%, #0369a1 100%)',
                  borderTop: '1px solid #38bdf8',
                  borderLeft: '1px solid #38bdf8',
                  borderRight: '1px solid #38bdf8',
                  borderBottom: '3.5px solid #0c4a6e',
                  color: '#fff',
                  font: "700 11.5px 'Barlow Condensed', sans-serif",
                  cursor: 'pointer',
                }}
              >
                🪙 COLLECT +1,500 GOLD
              </button>
              <button
                type="button"
                onClick={handleKeepUpgradeClick}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '7px',
                  background: 'linear-gradient(180deg, #ca8a04 0%, #854d0e 100%)',
                  borderTop: '1px solid #facc15',
                  borderLeft: '1px solid #facc15',
                  borderRight: '1px solid #facc15',
                  borderBottom: '3.5px solid #713f12',
                  color: '#fef08a',
                  font: "700 11.5px 'Barlow Condensed', sans-serif",
                  cursor: 'pointer',
                }}
              >
                🔨 UPGRADE LV.{keepLevel + 1}
              </button>
            </div>
          </>
        ) : selectedBuilding ? (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #78350f, #1e293b)',
                    border: '1.5px solid #facc15',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '20px',
                  }}
                >
                  {selectedBuilding.icon}
                </div>
                <div>
                  <div style={{ font: "700 13.5px 'Barlow Condensed'", color: '#fef08a' }}>
                    {selectedBuilding.name} (Lv.{selectedBuilding.level}/{selectedBuilding.maxLevel})
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#38bdf8', fontWeight: 600 }}>
                    3D PLOT #{selectedPlot!.slotIndex + 1} · {selectedBuilding.subtitle}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '7px',
                padding: '5px 8px',
                fontSize: '10.5px',
                color: '#86efac',
                fontWeight: 600,
              }}
            >
              {selectedBuilding.productionText}
            </div>

            {/* 3D Merge Status Box */}
            <div
              style={{
                background: matchingTwinPlot
                  ? 'rgba(6, 78, 59, 0.55)'
                  : 'rgba(15, 23, 42, 0.65)',
                border: matchingTwinPlot
                  ? '1px solid #4ade80'
                  : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '7px',
                padding: '6px 8px',
                fontSize: '10px',
                color: matchingTwinPlot ? '#bbf7d0' : '#94a3b8',
              }}
            >
              {matchingTwinPlot ? (
                <span>
                  ✨ <b>Matching Lv.{selectedBuilding.level} Twin</b> on Plot #
                  {matchingTwinPlot.slotIndex + 1}! Click its green ring in 3D or press Merge below!
                </span>
              ) : (
                <span>
                  ℹ️ Summon or evolve another <b>Lv.{selectedBuilding.level} {BUILDING_TEMPLATES[selectedBuilding.category].baseName}</b> to merge into Lv.{selectedBuilding.level + 1}.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={handleQuickCollectOrTrain}
                style={{
                  flex: 1,
                  padding: '7px 8px',
                  borderRadius: '7px',
                  background: 'linear-gradient(180deg, #0284c7 0%, #0369a1 100%)',
                  borderTop: '1px solid #38bdf8',
                  borderLeft: '1px solid #38bdf8',
                  borderRight: '1px solid #38bdf8',
                  borderBottom: '3.5px solid #0c4a6e',
                  color: '#fff',
                  font: "700 11px 'Barlow Condensed', sans-serif",
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <span>{selectedBuilding.quickActionIcon}</span>
                <span>{selectedBuilding.rewardType === 'troops' ? 'TRAIN' : 'HARVEST'}</span>
              </button>

              <button
                type="button"
                onClick={handleMergeSelectedClick}
                disabled={!matchingTwinPlot}
                style={{
                  flex: 1.2,
                  padding: '7px 8px',
                  borderRadius: '7px',
                  background: matchingTwinPlot
                    ? 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)'
                    : 'rgba(51, 65, 85, 0.5)',
                  borderTop: matchingTwinPlot
                    ? '1.5px solid #4ade80'
                    : '1px solid rgba(255,255,255,0.12)',
                  borderLeft: matchingTwinPlot
                    ? '1.5px solid #4ade80'
                    : '1px solid rgba(255,255,255,0.12)',
                  borderRight: matchingTwinPlot
                    ? '1.5px solid #4ade80'
                    : '1px solid rgba(255,255,255,0.12)',
                  borderBottom: matchingTwinPlot ? '3.5px solid #14532d' : '3px solid #1e293b',
                  color: matchingTwinPlot ? '#fef08a' : '#64748b',
                  font: "800 11px 'Barlow Condensed', sans-serif",
                  cursor: matchingTwinPlot ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <span>✨</span>
                <span>MERGE → LV.{selectedBuilding.level + 1}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ font: "700 13px 'Barlow Condensed'", color: '#38bdf8' }}>
              ➕ Empty 3D Courtyard Plot #{selectedPlot ? selectedPlot.slotIndex + 1 : ''}
            </div>
            <div style={{ fontSize: '10.5px', color: '#cbd5e1' }}>
              Select any building in the bottom summon deck to construct a 3D structure on this stone plinth.
            </div>
          </>
        )}
      </div>

      <style>{`
        @media (max-height: 540px) {
          .inside-top-banner {
            margin-top: 6px !important;
            padding: 4px 10px !important;
            gap: 6px !important;
            max-width: calc(100vw - 290px) !important;
          }
          .inside-inspector-card {
            left: 8px !important;
            bottom: 54px !important;
            width: 245px !important;
            padding: 7px 9px !important;
          }
          .inside-inspector-card button {
            min-height: 32px;
          }
          .inside-summon-deck {
            margin-bottom: 52px !important;
            max-width: 62vw !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
            padding: 4px 6px !important;
          }
          .inside-summon-deck button {
            min-height: 32px;
            flex-shrink: 0;
            touch-action: manipulation;
          }
        }
        @media (max-width: 768px) {
          .inside-top-banner {
            max-width: calc(100vw - 16px) !important;
            margin-top: 174px !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
            padding: 6px 10px !important;
            justify-content: space-between !important;
          }
          .inside-inspector-card {
            left: 8px !important;
            right: 8px !important;
            width: auto !important;
            max-width: none !important;
            bottom: 142px !important;
            padding: 8px 10px !important;
          }
          .inside-inspector-card button {
            min-height: 36px;
          }
          .inside-summon-deck {
            position: absolute !important;
            left: 8px !important;
            right: 8px !important;
            bottom: 78px !important;
            margin-bottom: 0 !important;
            max-width: calc(100vw - 16px) !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
            padding: 6px 8px !important;
          }
          .inside-summon-deck button {
            min-height: 36px;
            flex-shrink: 0;
          }
        }
      `}</style>
    </div>
  );
};
