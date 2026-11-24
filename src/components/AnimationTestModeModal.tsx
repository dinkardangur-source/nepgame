import React, { useEffect, useRef, useState } from 'react';
import type { AnimationState, ZoomLodLevel } from '../game/vfx/AnimationController';
import {
  AcceptanceTestResult,
  AnimationTestScene,
  ProjectedFloatingText,
  TestSceneTelemetry,
  TestSubjectCategory,
  TestSubjectId,
} from '../game/vfx/AnimationTestScene';
import type { TimeOfDayMode } from '../game/vfx/EnvironmentAnimationManager';

interface Props {
  onClose: () => void;
}

const SUBJECT_CATALOG: Array<{
  category: TestSubjectCategory;
  label: string;
  items: Array<{ id: TestSubjectId; name: string }>;
}> = [
  {
    category: 'troop',
    label: 'Troops',
    items: [
      { id: 'magar_infantry', name: 'Magar Infantry (Khukuri)' },
      { id: 'limbu_archer', name: 'Limbu Archer' },
      { id: 'thakuri_cavalry', name: 'Thakuri Cavalry' },
    ],
  },
  {
    category: 'monster',
    label: 'Monsters',
    items: [
      { id: 'slime', name: 'Slime (Poison)' },
      { id: 'orc', name: 'Orc (Melee)' },
      { id: 'goblin', name: 'Goblin (Scout)' },
      { id: 'wolf', name: 'Wolf (Beast)' },
      { id: 'skeleton_knight', name: 'Skeleton Knight' },
      { id: 'ogre', name: 'Ogre (Elite 2x2)' },
      { id: 'death_knight', name: 'Death Knight (Boss 3x3)' },
      { id: 'skeleton_dragon', name: 'Skeleton Dragon (Boss 3x3)' },
    ],
  },
  {
    category: 'resource',
    label: 'Resources',
    items: [
      { id: 'wood', name: 'Timber Forest (Wood)' },
      { id: 'food', name: 'Wheat Farm (Food)' },
      { id: 'stone', name: 'Granite Quarry (Stone)' },
      { id: 'gold', name: 'Gold Ore Vein' },
      { id: 'crystal', name: 'Arcane Crystal Cluster' },
    ],
  },
  {
    category: 'building',
    label: 'Buildings & Shrines',
    items: [
      { id: 'player_castle', name: 'Player Castle (2x2)' },
      { id: 'external_castle', name: 'External Kingdom Castle (3x3)' },
      { id: 'c_shrine', name: 'C Shrine Outpost (3x3)' },
      { id: 'b_shrine', name: 'B Shrine Bastion (4x4)' },
      { id: 'a_shrine', name: 'A Shrine Sanctum (5x5)' },
      { id: 'alliance_citadel', name: 'Alliance Congress Citadel (8x8)' },
    ],
  },
];

const CORE_STATES: Array<{ state: AnimationState; label: string }> = [
  { state: 'IDLE', label: 'Idle' },
  { state: 'WALK', label: 'Walk' },
  { state: 'RUN', label: 'Run' },
  { state: 'MARCH', label: 'March' },
  { state: 'ATTACK', label: 'Attack' },
  { state: 'BLOCK', label: 'Block' },
  { state: 'MINE', label: 'Mine' },
  { state: 'GATHER', label: 'Gather' },
  { state: 'RALLY', label: 'Rally' },
  { state: 'CAST', label: 'Cast' },
  { state: 'DAMAGE', label: 'Damage' },
  { state: 'HEAL', label: 'Heal' },
  { state: 'VICTORY', label: 'Victory' },
  { state: 'DEATH', label: 'Death' },
];

export const AnimationTestModeModal: React.FC<Props> = ({ onClose }) => {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<AnimationTestScene | null>(null);

  const [category, setCategory] = useState<TestSubjectCategory>('troop');
  const [subjectId, setSubjectId] = useState<TestSubjectId>('magar_infantry');
  const [telemetry, setTelemetry] = useState<TestSceneTelemetry | null>(null);
  const [floatingTexts, setFloatingTexts] = useState<ProjectedFloatingText[]>([]);
  const [lodPreset, setLodPreset] = useState<ZoomLodLevel | 'Auto'>('Auto');
  const [testResults, setTestResults] = useState<AcceptanceTestResult[] | null>(null);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    const testScene = new AnimationTestScene(host, {
      onTelemetry: (t) => setTelemetry(t),
      onFloatingTexts: (items) => setFloatingTexts(items),
    });
    sceneRef.current = testScene;
    return () => {
      testScene.dispose();
      sceneRef.current = null;
    };
  }, []);

  const handleSelectCategory = (cat: TestSubjectCategory) => {
    setCategory(cat);
    const group = SUBJECT_CATALOG.find((g) => g.category === cat);
    if (group && group.items[0]) {
      const nextId = group.items[0].id;
      setSubjectId(nextId);
      sceneRef.current?.loadSubject(cat, nextId);
    }
  };

  const handleSelectSubject = (id: TestSubjectId) => {
    setSubjectId(id);
    sceneRef.current?.loadSubject(category, id);
  };

  const handleLodChange = (preset: ZoomLodLevel | 'Auto') => {
    setLodPreset(preset);
    sceneRef.current?.setZoomLodPreset(preset === 'Auto' ? null : preset);
  };

  const handleTimeOfDay = (mode: TimeOfDayMode) => {
    sceneRef.current?.setTimeOfDay(mode);
  };

  const handleRunAcceptance = () => {
    if (!sceneRef.current) return;
    const res = sceneRef.current.runAcceptanceTests();
    setTestResults(res);
  };

  const currentCatalog = SUBJECT_CATALOG.find((g) => g.category === category)?.items ?? [];
  const passedCount = testResults ? testResults.filter((r) => r.passed).length : 0;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/95 flex flex-col text-slate-100 select-none">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900 border-b border-amber-500/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold tracking-wide text-sm uppercase">
            <span>🎭</span>
            <span>Animation &amp; VFX Lab</span>
          </div>
          {telemetry?.isPlaceholderProcedural && (
            <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-sky-500/20 border border-sky-400/40 text-sky-200">
              Procedural 3D Placeholder Rig (AnimationMixer)
            </span>
          )}
        </div>

        {/* Time of Day & Zoom LOD & Acceptance Test */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded border border-slate-700 bg-slate-950 overflow-hidden text-xs">
            {(['day', 'dusk', 'night'] as TimeOfDayMode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleTimeOfDay(m)}
                className={`px-2.5 py-1 flex items-center gap-1 capitalize transition ${
                  telemetry?.timeOfDay === m
                    ? 'bg-amber-500/25 text-amber-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>{m === 'day' ? '☀️' : m === 'dusk' ? '🌅' : '🌙'}</span>
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded border border-slate-700 bg-slate-950 overflow-hidden text-xs">
            {(['Auto', 'Close', 'Medium', 'Far'] as Array<ZoomLodLevel | 'Auto'>).map((z) => (
              <button
                key={z}
                onClick={() => handleLodChange(z)}
                className={`px-2 py-1 transition ${
                  lodPreset === z
                    ? 'bg-emerald-500/25 text-emerald-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {z === 'Auto' ? 'LOD: Auto' : z}
              </button>
            ))}
          </div>

          <button
            onClick={handleRunAcceptance}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <span>✅</span>
            Run 14 Acceptance Tests
          </button>

          <button
            onClick={onClose}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-600/80 text-slate-200 text-xs font-bold transition"
            aria-label="Close Animation Lab"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* 3D Viewport */}
        <div className="relative flex-1 min-h-[300px] bg-slate-950 overflow-hidden">
          <div ref={canvasHostRef} className="absolute inset-0" />

          {/* Floating Damage / Crit / Heal Overlay */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {floatingTexts.map((ft) => (
              <div
                key={ft.id}
                style={{
                  left: ft.x,
                  top: ft.y,
                  opacity: ft.opacity,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${
                  ft.isCrit
                    ? 'text-amber-300 text-xl tracking-wide'
                    : ft.isHeal
                      ? 'text-emerald-300 text-base'
                      : 'text-rose-400 text-base'
                }`}
              >
                {ft.text}
              </div>
            ))}
          </div>

          {/* Live Readout HUD */}
          {telemetry && (
            <div className="pointer-events-none absolute bottom-3 left-3 max-w-md bg-slate-900/90 border border-slate-700/80 rounded-lg p-3 text-xs space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="font-bold text-amber-300">{telemetry.subjectTitle}</span>
                <span className="font-mono text-emerald-400 font-semibold">{telemetry.fps} FPS</span>
              </div>
              {telemetry.diagnostics ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-300">
                  <div>
                    State: <span className="text-white font-semibold">{telemetry.diagnostics.currentState}</span> ({telemetry.diagnostics.currentClipLabel})
                  </div>
                  <div>
                    Duration: <span className="font-mono text-sky-300">{telemetry.diagnostics.clipDuration}s</span>
                  </div>
                  <div className="col-span-2">
                    Transition: <span className="text-amber-200">{telemetry.diagnostics.transitionLabel}</span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-300">
                  Mode: <span className="text-white font-semibold uppercase">{telemetry.subjectCategory}</span> • Barrier:{' '}
                  <span className="text-sky-300 uppercase">{telemetry.barrierFaction}</span>
                </div>
              )}
              <div className="pt-1 border-t border-slate-800 flex flex-wrap gap-3 text-[11px] text-slate-400">
                <span>Particles: <b className="text-slate-200">{telemetry.activeParticles}</b></span>
                <span>Rings: <b className="text-slate-200">{telemetry.activeShockwaves}</b></span>
                <span>Projectiles: <b className="text-slate-200">{telemetry.activeProjectiles}</b></span>
                <span>LOD: <b className="text-emerald-300">{telemetry.zoomLod}</b></span>
              </div>
              {telemetry.recentEffects.length > 0 && (
                <div className="text-[11px] text-sky-300 truncate">
                  Active VFX: {telemetry.recentEffects.join(' • ')}
                </div>
              )}
            </div>
          )}

          {/* Acceptance Tests Overlay */}
          {testResults && (
            <div className="absolute top-3 left-3 right-3 lg:right-auto lg:w-[440px] max-h-[82%] overflow-y-auto bg-slate-900/95 border border-emerald-500/40 rounded-lg p-3 shadow-2xl">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <div className="text-xs font-bold text-emerald-300">
                  Section 13.14 Acceptance Suite ({passedCount}/{testResults.length} Passed)
                </div>
                <button
                  onClick={() => setTestResults(null)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
                >
                  Hide
                </button>
              </div>
              <div className="space-y-1.5">
                {testResults.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start gap-2 text-[11px] p-1.5 rounded bg-slate-950/70 border border-slate-800"
                  >
                    {r.passed ? (
                      <span className="text-emerald-400 shrink-0 mt-0.5">✅</span>
                    ) : (
                      <span className="text-rose-400 shrink-0 mt-0.5">❌</span>
                    )}
                    <div>
                      <div className="font-semibold text-slate-100">
                        {r.id}. {r.title}
                      </div>
                      <div className="text-slate-400">{r.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Inspector / Control Panel */}
        <div className="w-full lg:w-[370px] bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-3.5 overflow-y-auto space-y-4">
          {/* Category Tabs */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              1. Asset Category
            </div>
            <div className="grid grid-cols-4 gap-1">
              {SUBJECT_CATALOG.map((g) => (
                <button
                  key={g.category}
                  onClick={() => handleSelectCategory(g.category)}
                  className={`py-1.5 px-1 rounded text-xs font-semibold transition ${
                    category === g.category
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {g.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Model Selector */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              2. Character / Monster / Object
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {currentCatalog.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectSubject(item.id)}
                  className={`text-left px-2.5 py-1.5 rounded text-xs border transition truncate ${
                    subjectId === item.id
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-semibold'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          {/* Animation State Buttons (for Troops & Monsters) */}
          {(category === 'troop' || category === 'monster') && (
            <>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  3. Animation State Machine
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {CORE_STATES.map((s) => {
                    const active = telemetry?.diagnostics?.currentState === s.state;
                    return (
                      <button
                        key={s.state}
                        onClick={() => sceneRef.current?.playUnitState(s.state)}
                        className={`py-1.5 px-1 rounded text-[11px] font-medium border transition ${
                          active
                            ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-bold'
                            : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Class / Monster Special Sub-Clips */}
              {telemetry && telemetry.availableCustomClips.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    4. Class &amp; Monster Sub-Animations
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {telemetry.availableCustomClips.map((c) => (
                      <button
                        key={c.key}
                        onClick={() => sceneRef.current?.playUnitState(c.state, c.key)}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] bg-slate-800 hover:bg-indigo-600/40 border border-slate-700 text-slate-200 transition truncate"
                      >
                        <span className="text-indigo-300 shrink-0">▶</span>
                        <span className="truncate">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Combat & Gather Interaction Buttons */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  5. Real-Time Interactions
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => sceneRef.current?.triggerCombatInteraction(false, false, false)}
                    className="flex items-center justify-center gap-1.5 py-2 px-2 rounded bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-semibold transition"
                  >
                    <span>⚔️</span>
                    Attack Target
                  </button>
                  <button
                    onClick={() => sceneRef.current?.triggerCombatInteraction(true, false, false)}
                    className="flex items-center justify-center gap-1.5 py-2 px-2 rounded bg-amber-600/85 hover:bg-amber-500 text-white text-xs font-semibold transition"
                  >
                    <span>💥</span>
                    Critical Hit
                  </button>
                  <button
                    onClick={() => sceneRef.current?.triggerCombatInteraction(false, true, false)}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-sky-700/80 hover:bg-sky-600 text-white text-xs font-semibold transition"
                  >
                    <span>🛡️</span>
                    Blocked Hit
                  </button>
                  <button
                    onClick={() => sceneRef.current?.triggerResourceGatherInteraction()}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-semibold transition"
                  >
                    <span>⛏️</span>
                    Mine / Gather
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Resource Node Controls */}
          {category === 'resource' && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                3. Resource Interaction
              </div>
              <button
                onClick={() => sceneRef.current?.triggerResourceGatherInteraction()}
                className="w-full py-2.5 px-3 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <span>⛏️</span>
                Trigger Chop / Mine / Gather Impact
              </button>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Wood &amp; Food sway continuously with wind + falling leaves; Stone, Gold &amp; Crystal emit dust, sparks, shards &amp; energy rings upon troop gathering.
              </p>
            </div>
          )}

          {/* Building & Shrine Controls */}
          {category === 'building' && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                3. Building, Shrine &amp; Barrier Actions
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(subjectId === 'player_castle' || subjectId === 'external_castle') && (
                  <>
                    <button
                      onClick={() => sceneRef.current?.triggerBuildingAction('gate')}
                      className="py-2 px-2 rounded bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold transition"
                    >
                      Open / Close Gate
                    </button>
                    <button
                      onClick={() => sceneRef.current?.triggerBuildingAction('upgrade')}
                      className="py-2 px-2 rounded bg-sky-600/80 hover:bg-sky-500 text-white text-xs font-semibold transition"
                    >
                      Upgrade Sequence
                    </button>
                  </>
                )}
                <button
                  onClick={() => sceneRef.current?.triggerBuildingAction('capture')}
                  className="py-2 px-2 rounded bg-purple-600/80 hover:bg-purple-500 text-white text-xs font-semibold transition"
                >
                  Capture Sequence
                </button>
                <button
                  onClick={() => sceneRef.current?.triggerBuildingAction('cycle_barrier')}
                  className="py-2 px-2 rounded bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-semibold transition"
                >
                  Barrier Color ({telemetry?.barrierFaction})
                </button>
                <button
                  onClick={() => sceneRef.current?.triggerBuildingAction('damage')}
                  className="py-2 px-2 rounded bg-rose-700/80 hover:bg-rose-600 text-white text-xs font-semibold transition"
                >
                  Siege / Fire Damage
                </button>
                <button
                  onClick={() => sceneRef.current?.triggerBuildingAction('repair')}
                  className="py-2 px-2 rounded bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-semibold transition"
                >
                  Repair &amp; Restore
                </button>
              </div>
            </div>
          )}

          {/* Global Controls: VFX Toggle, Speed, Intensity, Reset */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Enable / Disable VFX</span>
              <button
                onClick={() => sceneRef.current?.setVfxEnabled(!(telemetry?.vfxEnabled ?? true))}
                className={`px-3 py-1 rounded text-xs font-bold transition ${
                  telemetry?.vfxEnabled
                    ? 'bg-emerald-500/25 border border-emerald-400 text-emerald-300'
                    : 'bg-slate-800 border border-slate-700 text-slate-400'
                }`}
              >
                {telemetry?.vfxEnabled ? 'VFX ON' : 'VFX OFF'}
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Animation Speed</span>
                <span className="font-mono text-amber-300">{(telemetry?.speed ?? 1).toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.25}
                max={2.5}
                step={0.05}
                value={telemetry?.speed ?? 1}
                onChange={(e) => sceneRef.current?.setAnimationSpeed(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Particle Intensity</span>
                <span className="font-mono text-sky-300">{Math.round((telemetry?.intensity ?? 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.25}
                max={2.0}
                step={0.05}
                value={telemetry?.intensity ?? 1}
                onChange={(e) => sceneRef.current?.setParticleIntensity(Number(e.target.value))}
                className="w-full accent-sky-400"
              />
            </div>

            <button
              onClick={() => sceneRef.current?.resetAnimation()}
              className="w-full py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <span>🔄</span>
              Reset Animation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
