import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  TerrainGenerator,
  TerrainBiomeType,
  TerrainLodMode,
  HexTileData,
} from './TerrainGenerator';
import { CameraController } from './CameraController';
import {
  RESERVED_PLOTS,
  STRATEGIC_DISTANCE_LINKS,
  WORLD_MONSTERS,
  WORLD_RESOURCES,
  WORLD_BOUNDS,
  WorldEntity,
  EntityAction,
  CastleSpawnData,
  PlayerAllianceIdentity,
  generateRandomCastles,
  pickValidCastleCoordinate,
} from './WorldCoordinates';
import { getEnemyCastleMaxHp, loadAllianceIdentity, TroopLevel } from './NepaleseBalanceConfig';
import {
  getMonsterArtConfig,
  getSharedMonsterDirectionalTextures,
  MonsterArchetypeKey,
  prewarmMonsterCutouts,
} from './MonsterArtwork';
import { getSharedMagarWarriorDirectionalTextures } from './MagarChartArtwork';
import { getSharedHeroDirectionalTextures } from './HeroArtwork';
import {
  createStoneBrickTexture,
  createWoodPlankTexture,
  createRoofTileTexture,
  createIceSpikeTexture,
  createDragonBannerTexture,
  createPrayerFlagTexture,
  createGraniteQuarryTexture,
  createTimberBarkTexture,
  createLogEndGrainTexture,
  createFarmlandSoilTexture,
  createWheatCropTexture,
  createGoldOreRockTexture,
  createCastlePlasterTexture,
} from './proceduralTextures';
import {
  InsideKingdom3D,
  InsideKingdomState,
  MergeBuildingCategory,
  KingdomMergePlot,
} from './InsideKingdom3D';
import { VFXManager } from './vfx/VFXManager';
import { EnvironmentAnimationManager, TimeOfDayMode } from './vfx/EnvironmentAnimationManager';
import {
  BarrierFactionColorKey,
  ProtectionBarrierInstance,
  createProtectionBarrier,
  disposeProtectionBarrier,
  setBarrierFaction,
  triggerBarrierImpact,
  updateProtectionBarrier,
} from './vfx/ProtectionBarrierShader';
import { BuiltUnitRig, createProceduralUnitRig } from './vfx/ProceduralRigLibrary';
import type { ZoomLodLevel } from './vfx/AnimationController';
import {
  ContactShadowEntry,
  ShadowProjectionState,
  createContactShadowMaterial,
  createFlatContactShadow,
  createTerrainConformedContactShadow,
  syncContactShadowEntries,
} from './shadows';

export interface WorldMapOptions {
  container: HTMLElement;
  onCameraUpdate?: (info: { x: number; y: number; z: number; zoom: number }) => void;
  onSelectEntity?: (entity: WorldEntity | null, screenPos: { x: number; y: number } | null) => void;
  onAddCombatFloater?: (text: string, color: string, x: number, y: number) => void;
  onArmyStatusUpdate?: (desc: string, progress: number, timerText: string, armyPos?: [number, number, number]) => void;
  onHarvestReward?: (resourceType: string, amount: number) => void;
  onMonsterDefeated?: (monster: WorldEntity) => void;
  onStructureConquered?: (entity: WorldEntity, buffLabel: string) => void;
  onEnemyCastleDefeated?: (castleEntity: WorldEntity) => void;
  onBulletNotify?: (msg: { text: string; category: 'attack' | 'conquest' | 'monster' | 'rally' }) => void;
  onEnterKingdom?: () => void;
  onInsideKingdomStateChange?: (state: InsideKingdomState) => void;
  onCastlesUpdated?: (castles: CastleSpawnData[]) => void;
  onSceneReady?: () => void;
  initialSceneMode?: 'world' | 'kingdom';
}

let cachedSoftwareWebGL: boolean | null = null;
function detectSoftwareWebGL(): boolean {
  if (cachedSoftwareWebGL !== null) return cachedSoftwareWebGL;
  try {
    const probeCanvas = document.createElement('canvas');
    const probe =
      (probeCanvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (probeCanvas.getContext('webgl') as WebGLRenderingContext | null);
    if (!probe) {
      cachedSoftwareWebGL = true;
      return true;
    }
    const ext = probe.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
    const gpu = String(probe.getParameter(param) || '');
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareWebGL = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    cachedSoftwareWebGL = false;
  }
  return cachedSoftwareWebGL;
}

/**
 * Procedural Painted Himalayan Mountain Skyline Texture
 */
function createHimalayanSkylineTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // 1. Sky Gradient: Crisp azure to warm golden horizon
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 380);
  skyGrad.addColorStop(0, '#0f2942');
  skyGrad.addColorStop(0.35, '#1d4ed8');
  skyGrad.addColorStop(0.68, '#38bdf8');
  skyGrad.addColorStop(0.88, '#bae6fd');
  skyGrad.addColorStop(1.0, '#fef08a');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 1024, 512);

  // Morning sun disk
  const sunGrad = ctx.createRadialGradient(750, 160, 5, 750, 160, 80);
  sunGrad.addColorStop(0, '#fffbeb');
  sunGrad.addColorStop(0.3, '#fef08a');
  sunGrad.addColorStop(0.8, 'rgba(253, 224, 71, 0.25)');
  sunGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(750, 160, 80, 0, Math.PI * 2);
  ctx.fill();

  // 2. Distant Lush Emerald Highland Ridges (No snow)
  ctx.fillStyle = '#3b6e4c';
  ctx.beginPath();
  ctx.moveTo(0, 360);
  for (let x = 0; x <= 1024; x += 16) {
    const peak1 = Math.sin(x * 0.014) * 78;
    const peak2 = Math.cos(x * 0.036) * 44;
    const peak3 = Math.sin(x * 0.09) * 18;
    const y = 250 - (peak1 + peak2 + peak3);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(1024, 512);
  ctx.lineTo(0, 512);
  ctx.closePath();
  ctx.fill();

  // Shaded emerald slopes
  ctx.fillStyle = 'rgba(29, 78, 52, 0.55)';
  ctx.beginPath();
  ctx.moveTo(0, 360);
  for (let x = 0; x <= 1024; x += 16) {
    const y = 268 - (Math.sin(x * 0.014 + 0.5) * 68 + Math.cos(x * 0.04) * 34);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(1024, 512);
  ctx.lineTo(0, 512);
  ctx.closePath();
  ctx.fill();

  // 3. Mid-range Forested Ridges
  ctx.fillStyle = '#1b4332';
  ctx.beginPath();
  ctx.moveTo(0, 390);
  for (let x = 0; x <= 1024; x += 24) {
    const y = 328 - (Math.sin(x * 0.024) * 42 + Math.cos(x * 0.056) * 22);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(1024, 512);
  ctx.lineTo(0, 512);
  ctx.closePath();
  ctx.fill();

  // 4. Warm Horizon Atmospheric Haze
  const mistGrad = ctx.createLinearGradient(0, 320, 0, 512);
  mistGrad.addColorStop(0, 'rgba(186, 230, 253, 0)');
  mistGrad.addColorStop(0.55, 'rgba(198, 223, 238, 0.5)');
  mistGrad.addColorStop(1, 'rgba(184, 216, 235, 0.92)');
  ctx.fillStyle = mistGrad;
  ctx.fillRect(0, 320, 1024, 192);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export class WorldMap {
  public scene!: THREE.Scene;
  public renderer!: THREE.WebGLRenderer;
  public terrainGenerator: TerrainGenerator | null = null;
  public cameraController!: CameraController;

  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private container: HTMLElement;
  private animFrameId = 0;
  private clock = new THREE.Clock();

  // Object Groups
  public buildingsGroup = new THREE.Group();
  public castlesGroup = new THREE.Group();
  public strategicLinesGroup = new THREE.Group();
  public monstersGroup = new THREE.Group();
  public resourcesGroup = new THREE.Group();
  public armyGroup = new THREE.Group();
  public alliedRallyGroup = new THREE.Group();
  public atmosphereGroup = new THREE.Group();

  // Dynamic Lv.1-5 Magar Infantry Sprite Battalion, Enlarged Front Hero & Directional Facing
  private armyWarriorSpriteMatWest: THREE.SpriteMaterial | null = null;
  private armyWarriorSpriteMatEast: THREE.SpriteMaterial | null = null;
  private armyWarriorSprites: Array<{ sprite: THREE.Sprite; baseHeight: number; idx: number }> = [];
  private armyWarriorAspect = 0.44;
  private armyFacingEast = false;
  private currentArmyTier: TroopLevel = 3;
  private currentArmyHeroId: string | null = null;
  private currentArmyHeroCrestColor = '#facc15';
  private armyHeroGroup: THREE.Group | null = null;
  private armyHeroSprite: THREE.Sprite | null = null;
  private armyHeroSpriteMatWest: THREE.SpriteMaterial | null = null;
  private armyHeroSpriteMatEast: THREE.SpriteMaterial | null = null;
  private armyHeroAspect = 0.78;
  private armyBannerBeaconMat: THREE.MeshStandardMaterial | null = null;
  private armyCommanderRingMat: THREE.MeshBasicMaterial | null = null;
  private armyCommanderRing: THREE.Mesh | null = null;
  private alliedWarriorSpriteMatWest: THREE.SpriteMaterial | null = null;
  private alliedWarriorSpriteMatEast: THREE.SpriteMaterial | null = null;
  private alliedWarriorSprites: THREE.Sprite[] = [];
  private alliedWarriorAspect = 0.44;

  // Randomized Castles (My Castle + 10 Alliance Member Castles + 6 Enemy Castles) & Strategic Filter Mode
  public castlesList: CastleSpawnData[] = [];
  public isStrategicFilterActive = false;
  private castlePickables: THREE.Object3D[] = [];
  private starterResourcePickables: THREE.Object3D[] = [];
  private starterResourceGroups: THREE.Group[] = [];
  private starterResourceIds: string[] = [];

  // Shared realistic PBR materials cache for castles and resource sites
  private sharedMats: Record<string, THREE.Material> | null = null;

  // Pickables & Entities map
  private pickableObjects: THREE.Object3D[] = [];
  public entitiesMap = new Map<string, WorldEntity>();
  private monsterMeshesMap = new Map<string, THREE.Group>();
  private resourceMeshesMap = new Map<string, THREE.Group>();
  private buildingMeshesMap = new Map<string, THREE.Group>();
  private barrierMeshesMap = new Map<string, THREE.Mesh>();
  private shaderBarrierMap = new Map<string, ProtectionBarrierInstance>();
  public vfxManager!: VFXManager;
  public environmentManager!: EnvironmentAnimationManager;
  private vanguard3DRig: BuiltUnitRig | null = null;
  private lastVanguardState: 'IDLE' | 'MARCH' | 'ATTACK' | 'MINE' = 'IDLE';

  // Synchronized Real-Time + Ground Contact Shadow System
  private worldRadialShadowMat: THREE.MeshBasicMaterial = createContactShadowMaterial('radial', 0.7);
  private worldOctagonalShadowMat: THREE.MeshBasicMaterial = createContactShadowMaterial('octagonal', 0.72);
  private monsterContactShadowMat: THREE.MeshBasicMaterial | null = null;
  private monsterDirectionalShadowMat: THREE.MeshBasicMaterial | null = null;
  private unitShadowMat: THREE.MeshBasicMaterial | null = null;
  private worldBuildingShadowEntries: ContactShadowEntry[] = [];
  private castleShadowEntries: ContactShadowEntry[] = [];
  private currentShadowHalfExtent = 136;
  private readonly _shadowDir = new THREE.Vector3();
  private readonly _shadowSnapVec = new THREE.Vector3();
  private readonly _shadowSnapInv = new THREE.Matrix4();
  private readonly _shadowDummyCam = new THREE.Object3D();

  // Debug Collision Box Wireframe Visualizer (building / monster / resource layers)
  public isDebugCollisionBoxesVisible = false;
  private debugCollisionLayerVisibility: Record<'building' | 'monster' | 'resource', boolean> = {
    building: true,
    monster: true,
    resource: true,
  };
  private debugCollisionBoxes: Array<{
    entityId: string;
    layer: 'building' | 'monster' | 'resource';
    box: THREE.LineSegments;
  }> = [];
  private debugCollisionMats: Record<'building' | 'monster' | 'resource', THREE.LineBasicMaterial> | null = null;
  private debugCollisionGeos = new Map<string, THREE.EdgesGeometry>();

  // External App-driven march visual override (when Nepalese Balance Simulation drives marches)
  private externalMarchVisual: {
    from: [number, number, number];
    to: [number, number, number];
    progress01: number;
    label: string;
    isReturning?: boolean;
    inCombatOrGathering?: boolean;
    resourceType?: string;
  } | null = null;
  private alliedRallyColumns = new Map<
    string,
    {
      group: THREE.Group;
      line: THREE.Line;
      pts: [THREE.Vector3, THREE.Vector3];
      isActive: boolean;
      sprites: THREE.Sprite[];
      facingEast: boolean;
    }
  >();
  private externalMiningTimer = 0;

  // Selection ring indicator
  private selectionIndicator!: THREE.Mesh;
  private selectedEntity: WorldEntity | null = null;

  // Tactical path line
  private tacticalLine!: THREE.Line;

  // Army State - Troops originate from User's "My Castle" gate
  public armyState: 'IDLE' | 'MARCHING' | 'ATTACKING' | 'GATHERING' | 'RETURNING' = 'IDLE';
  public armyHomePos = new THREE.Vector3(1600, 10.0, 1551);
  public armyPos = new THREE.Vector3(1600, 10.0, 1551);
  private activeTarget: WorldEntity | null = null;
  private totalMarchDist = 0;
  private combatTimer = 0;
  private gatherTimer = 0;
  private miningChipTimer = 0;

  // Particle systems
  private activeSmokeParticles: Array<{
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotSpeed: THREE.Vector3;
    life: number;
    maxLife: number;
    initialScale: number;
    targetScale: number;
  }> = [];

  private activeMiningChips: Array<{
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotSpeed: number;
    life: number;
    maxLife: number;
  }> = [];

  private activeHitFlashes: Array<{
    mesh: THREE.Mesh;
    timer: number;
    maxTimer: number;
  }> = [];

  // Enhanced Damage VFX: High-velocity impact sparks
  private activeSparks: Array<{
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
  }> = [];

  // Flinch Shake System (Monsters & Buildings)
  private activeFlinchShakes: Array<{
    group: THREE.Group;
    basePos: THREE.Vector3;
    timer: number;
    maxTimer: number;
  }> = [];

  // Marching dust puff particle trail
  private activeDustPuffs: Array<{
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    initialScale: number;
  }> = [];
  private dustTimer = 0;

  // Shared particle geometries & pre-allocated vectors for Zero-GC 60FPS performance
  private isSoftwareGl = false;
  private isDisposed = false;
  private isContextLost = false;
  private hasCompiledScene = false;
  private sharedSparkGeo = new THREE.SphereGeometry(0.12, 5, 5);
  private sharedSparkMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  private sharedChipGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  private sharedDustGeo = new THREE.DodecahedronGeometry(0.32, 0);
  private sharedSmokeGeo = new THREE.DodecahedronGeometry(0.55, 1);
  private sharedArrowGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.1, 5);
  private sharedBoulderGeo = new THREE.DodecahedronGeometry(0.58, 0);
  private sharedShockwaveGeo = new THREE.TorusGeometry(1.0, 0.14, 6, 24);
  private sharedPillarGeo = new THREE.CylinderGeometry(1.6, 3.0, 72, 14, 1, true);
  private sharedArrowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  private sharedBoulderMat = new THREE.MeshStandardMaterial({
    color: 0xff6b2b,
    emissive: 0xff3b00,
    emissiveIntensity: 2.6,
    roughness: 0.45,
  });

  // Combat & Conquest VFX pools
  private activeProjectiles: Array<{
    mesh: THREE.Mesh;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    arcHeight: number;
    life: number;
    maxLife: number;
    isBoulder: boolean;
  }> = [];

  private activeShockwaves: Array<{
    mesh: THREE.Mesh;
    life: number;
    maxLife: number;
    maxScale: number;
  }> = [];

  private activeConquestBeams: Array<{
    mesh: THREE.Mesh;
    life: number;
    maxLife: number;
  }> = [];

  // Atmospheric living world elements (clouds & high-altitude birds)
  private atmosphericClouds: Array<{
    group: THREE.Group;
    baseX: number;
    baseY: number;
    baseZ: number;
    speedX: number;
    speedZ: number;
    bobAmp: number;
    phase: number;
  }> = [];
  private soaringEagles: Array<{
    group: THREE.Group;
    cx: number;
    cz: number;
    baseY: number;
    radius: number;
    speed: number;
    flapSpeed: number;
    bankTilt: number;
    phase: number;
  }> = [];

  // Animated Floating Crystal Shrines (hover crystal, twin gold orbit rings, rising flames, crackling lightning)
  private animatedShrines: Array<{
    crystalGroup: THREE.Group;
    crystalBaseY: number;
    orbitRing1: THREE.Mesh;
    orbitRing2: THREE.Mesh;
    portalBeam: THREE.Mesh;
    portalDisc: THREE.Mesh;
    flameTongues: Array<{
      mesh: THREE.Mesh;
      baseX: number;
      baseY: number;
      baseZ: number;
      phase: number;
      speed: number;
    }>;
    waterfallFoams: THREE.Mesh[];
    banners: THREE.Mesh[];
    lightningBolts: Array<{
      line: THREE.Line;
      positions: Float32Array;
      startX: number;
      startY: number;
      startZ: number;
      endX: number;
      endY: number;
      endZ: number;
      jitter: number;
      phase: number;
    }>;
    lightningMat: THREE.LineBasicMaterial;
    lastBoltBucket: number;
    phase: number;
  }> = [];

  // Dynamic Player Alliance Identity ([TAG] + 4-word Alias)
  private playerAlliance: PlayerAllianceIdentity = loadAllianceIdentity();
  private castleBadgeRefs = new Map<
    string,
    {
      castle: CastleSpawnData;
      group: THREE.Group;
      badgeSprite: THREE.Sprite;
      badgeY: number;
    }
  >();

  private castleBurningMap = new Map<
    string,
    {
      group: THREE.Group;
      flamesGroup: THREE.Group;
      isBurning: boolean;
      intensity: number;
      smokeTimer: number;
    }
  >();

  // Conquest references for Shrine C/B/A & The Congress ownership swapping
  private conqueredCrystalMat!: THREE.MeshStandardMaterial;
  private conqueredRingMat!: THREE.MeshStandardMaterial;
  private buildingConquestRefs = new Map<
    string,
    {
      crystalMeshes: THREE.Mesh[];
      neutralCrystalMats: THREE.Material[];
      ringMesh?: THREE.Mesh;
      neutralRingMat?: THREE.Material;
      badgeSprite: THREE.Sprite;
      group: THREE.Group;
      badgeY: number;
      neutralBadge: {
        title: string;
        subtitle: string;
        starsText: string;
        borderColor: string;
        accentColor: string;
        scaleW: number;
        scaleH: number;
      };
    }
  >();

  private readonly _tempDest = new THREE.Vector3();
  private readonly _tempDir = new THREE.Vector3();
  private readonly _tempProj = new THREE.Vector3();
  private readonly _tempVecA = new THREE.Vector3();
  private readonly _tempVecB = new THREE.Vector3();
  private readonly _linePts = [new THREE.Vector3(), new THREE.Vector3()];

  // Callbacks
  private onSelectEntity?: (entity: WorldEntity | null, screenPos: { x: number; y: number } | null) => void;
  private onAddCombatFloater?: (text: string, color: string, x: number, y: number) => void;
  private onArmyStatusUpdate?: (desc: string, progress: number, timerText: string, armyPos?: [number, number, number]) => void;
  private onHarvestReward?: (resourceType: string, amount: number) => void;
  private onMonsterDefeated?: (monster: WorldEntity) => void;
  private onStructureConquered?: (entity: WorldEntity, buffLabel: string) => void;
  private onEnemyCastleDefeated?: (castleEntity: WorldEntity) => void;
  private onBulletNotify?: (msg: { text: string; category: 'attack' | 'conquest' | 'monster' | 'rally' }) => void;
  private onEnterKingdom?: () => void;
  private onInsideKingdomStateChange?: (state: InsideKingdomState) => void;
  private onCastlesUpdated?: (castles: CastleSpawnData[]) => void;
  private onSceneReady?: () => void;
  private hasNotifiedReady = false;

  // 3D Inside Kingdom Walled Courtyard & Merge System (Lazily initialized on first enter)
  public insideKingdom3D: InsideKingdom3D | null = null;
  public currentSceneMode: 'world' | 'kingdom' = 'world';
  private resizeObserver: ResizeObserver | null = null;
  private worldMapBuilt = false;
  private worldBuildStage = 0;
  private worldBuildRafId: number | null = null;
  private isBuildingWorldNow = false;

  // Flat animation object caches (eliminates nested group child scans every frame)
  private animResBelowTags: Array<{ obj: THREE.Object3D; dist: number; y: number }> = [];
  private animWaterwheels: THREE.Object3D[] = [];
  private animWindmills: THREE.Object3D[] = [];
  private animSawBlades: THREE.Object3D[] = [];
  private animMineWheels: THREE.Object3D[] = [];
  private animFoliageCanopies: Array<{ obj: THREE.Object3D; idx: number }> = [];
  private animGoldGlints: Array<{ obj: THREE.Object3D; phase: number }> = [];
  private animCastleDragonBanners: Array<{ obj: THREE.Object3D; phase: number }> = [];
  private animCastleBrazierFlames: Array<{ obj: THREE.Object3D; phase: number }> = [];
  private animBuildingBanners: Array<{ obj: THREE.Object3D; idx: number }> = [];
  private animBuildingDragonBanners: Array<{ obj: THREE.Object3D; phase: number }> = [];
  private animBuildingPrayerFlags: Array<{ obj: THREE.Object3D; idx: number }> = [];
  private animBuildingWardRings: THREE.Object3D[] = [];
  private animBuildingBlessingRings: THREE.Object3D[] = [];
  private animBuildingWardOrbs: Array<{ obj: THREE.Object3D; radius: number; speed: number; phase: number }> = [];

  // Adaptive 60fps Quality Governor
  private qualityTier: 'high' | 'balanced' | 'performance' = 'high';
  private perfEmaMs = 16.7;
  private lastPerfTickMs = 0;
  private perfCooldownFrames = 0;
  private shadowFrameSkip = 0;
  private forceShadowUpdate = true;
  private shrineLightningHz = 16;

  // Queued state updates received while World Map is deferred in Kingdom mode
  private pendingBarrierStates = new Map<string, boolean>();
  private pendingConqueredStructures = new Set<string>();
  private pendingNeutralStructures = new Set<string>();
  private pendingEntityLivePatches = new Map<
    string,
    Partial<Pick<WorldEntity, 'health' | 'maxHealth' | 'yieldAmount' | 'isDefeated' | 'respawnAt' | 'ownerFaction'>>
  >();
  private pendingBurningCastles = new Map<
    string,
    { isBurning: boolean; currentHp?: number; maxHp?: number }
  >();
  private pendingArmyEquipmentTier: {
    tier: number;
    ranks: { weapon: number; shield: number; armor: number };
    heroCrestColor?: string;
    heroId?: string | null;
  } | null = null;
  private pendingMarchVisual: Parameters<WorldMap['setMarchVisual']>[0] | undefined = undefined;
  private pendingAlliedColumns: Parameters<WorldMap['setAlliedRallyColumns']>[0] | null = null;

  constructor(options: WorldMapOptions) {
    this.container = options.container;
    this.onSelectEntity = options.onSelectEntity;
    this.onAddCombatFloater = options.onAddCombatFloater;
    this.onArmyStatusUpdate = options.onArmyStatusUpdate;
    this.onHarvestReward = options.onHarvestReward;
    this.onMonsterDefeated = options.onMonsterDefeated;
    this.onStructureConquered = options.onStructureConquered;
    this.onEnemyCastleDefeated = options.onEnemyCastleDefeated;
    this.onBulletNotify = options.onBulletNotify;
    this.onEnterKingdom = options.onEnterKingdom;
    this.onInsideKingdomStateChange = options.onInsideKingdomStateChange;
    this.onCastlesUpdated = options.onCastlesUpdated;
    this.onSceneReady = options.onSceneReady;

    this.sharedArrowGeo.rotateX(Math.PI / 2);
    this.sharedShockwaveGeo.rotateX(Math.PI / 2);

    this.initScene();
    this.initLighting();
    const isMobileEnv = typeof window !== 'undefined' && window.innerWidth < 768;
    this.vfxManager = new VFXManager(this.scene, isMobileEnv);
    this.environmentManager = new EnvironmentAnimationManager();
    this.environmentManager.attachLights(this.scene, this.sunLight, this.hemiLight, null, this.vfxManager);
    this.initTacticalLine();
    this.initSelectionIndicator();
    this.initCameraController(options.onCameraUpdate);
    this.applyQualityTier(this.isSoftwareGl ? 'performance' : isMobileEnv ? 'balanced' : 'high');

    if (options.initialSceneMode === 'kingdom') {
      // Fast Kingdom-first startup: render only the walled citadel until player enters World Map
      this.setSceneMode('kingdom', true);
    } else {
      this.ensureWorldMapBuilt();
    }

    this.startLoop();
  }

  private applyQualityTier(tier: 'high' | 'balanced' | 'performance') {
    this.qualityTier = tier;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const targetPr = this.isSoftwareGl
      ? 1
      : tier === 'high'
        ? Math.min(dpr, 1.5)
        : tier === 'balanced'
          ? Math.min(dpr, 1.15)
          : Math.min(dpr, 0.9);

    if (this.renderer && Math.abs(this.renderer.getPixelRatio() - targetPr) > 0.02) {
      this.renderer.setPixelRatio(targetPr);
      const w = Math.max(1, this.container.clientWidth);
      const h = Math.max(1, this.container.clientHeight);
      this.renderer.setSize(w, h, false);
    }

    if (this.renderer) {
      if (tier === 'high' && !this.isSoftwareGl) {
        this.renderer.shadowMap.autoUpdate = true;
      } else {
        this.renderer.shadowMap.autoUpdate = false;
        this.forceShadowUpdate = true;
      }
    }

    if (this.terrainGenerator) {
      this.terrainGenerator.setAdaptiveLodBias(
        tier === 'high' ? 1.0 : tier === 'balanced' ? 0.82 : 0.62
      );
    }

    this.shrineLightningHz = tier === 'high' ? 16 : tier === 'balanced' ? 10 : 6;
  }

  private getGroundHeight(x: number, z: number): number {
    return this.terrainGenerator ? this.terrainGenerator.getHeightAt(x, z) : 10.0;
  }

  private runWorldBuildStage(stage: number) {
    switch (stage) {
      case 0:
        this.initTerrain();
        this.cameraController.setTerrainGenerator(this.terrainGenerator);
        this.terrainGenerator?.setAdaptiveLodBias(
          this.qualityTier === 'high' ? 1.0 : this.qualityTier === 'balanced' ? 0.82 : 0.62
        );
        break;
      case 1:
        this.initAtmosphere();
        break;
      case 2:
        this.initKingdomBuildings();
        break;
      case 3:
        this.initStrategicDistanceLines();
        break;
      case 4:
        this.initRandomCastles();
        break;
      case 5:
        this.initMonsters();
        break;
      case 6:
        this.initResources();
        break;
      case 7:
        this.rebuildDebugCollisionBoxes();
        break;
      case 8:
        this.initArmyBattalion();
        break;
    }
  }

  private finalizeWorldMapBuild() {
    this.worldMapBuilt = true;
    this.isBuildingWorldNow = false;
    this.hasCompiledScene = false;
    this.forceShadowUpdate = true;

    const myCastle = this.castlesList.find((c) => c.isMyCastle);
    if (myCastle) {
      if (this.currentSceneMode === 'kingdom') {
        this.cameraController.updateHomeCoordsOnly(myCastle.position[0], myCastle.position[2]);
      } else {
        this.cameraController.setHomeCoordinates(myCastle.position[0], myCastle.position[2], true);
      }
    }

    if (this.currentSceneMode === 'kingdom' && this.terrainGenerator) {
      this.buildingsGroup.visible = false;
      this.castlesGroup.visible = false;
      this.strategicLinesGroup.visible = false;
      this.monstersGroup.visible = false;
      this.resourcesGroup.visible = false;
      this.atmosphereGroup.visible = false;
      this.armyGroup.visible = false;
      this.alliedRallyGroup.visible = false;
      this.terrainGenerator.plotMarkersGroup.visible = false;
      this.terrainGenerator.mesh.visible = false;
      this.terrainGenerator.vegetationGroup.visible = false;
      this.terrainGenerator.waterfallsGroup.visible = false;
      this.terrainGenerator.mistPuffsGroup.visible = false;
      this.terrainGenerator.leylineStreamsGroup.visible = false;
    } else if (this.currentSceneMode === 'world') {
      if (this.terrainGenerator) {
        this.terrainGenerator.mesh.visible = true;
        this.terrainGenerator.vegetationGroup.visible = true;
        this.terrainGenerator.waterfallsGroup.visible = true;
        this.terrainGenerator.mistPuffsGroup.visible = true;
        this.terrainGenerator.leylineStreamsGroup.visible = true;
        this.terrainGenerator.plotMarkersGroup.visible = true;
      }
      this.buildingsGroup.visible = true;
      this.castlesGroup.visible = true;
      this.strategicLinesGroup.visible = true;
      this.atmosphereGroup.visible = true;
      this.monstersGroup.visible = !this.isStrategicFilterActive;
      this.resourcesGroup.visible = !this.isStrategicFilterActive;
      this.armyGroup.visible = this.armyState !== 'IDLE';
      this.alliedRallyGroup.visible = true;
      this.cameraController.setPickables(this.pickableObjects);
    }

    // Flush queued mutations that arrived before World Map was initialized
    if (this.pendingArmyEquipmentTier) {
      const q = this.pendingArmyEquipmentTier;
      this.pendingArmyEquipmentTier = null;
      this.setArmyEquipmentTier(q.tier, q.ranks, q.heroCrestColor, q.heroId);
    }
    if (this.pendingBarrierStates.size > 0) {
      const entries = Array.from(this.pendingBarrierStates.entries());
      this.pendingBarrierStates.clear();
      for (const [id, active] of entries) {
        this.setStructureBarrierActive(id, active);
      }
    }
    if (this.pendingConqueredStructures.size > 0) {
      const ids = Array.from(this.pendingConqueredStructures.values());
      this.pendingConqueredStructures.clear();
      for (const id of ids) {
        this.conquerStructureById(id, true);
      }
    }
    if (this.pendingNeutralStructures.size > 0) {
      const ids = Array.from(this.pendingNeutralStructures.values());
      this.pendingNeutralStructures.clear();
      for (const id of ids) {
        this.setStructureNeutral(id);
      }
    }
    if (this.pendingEntityLivePatches.size > 0) {
      const entries = Array.from(this.pendingEntityLivePatches.entries());
      this.pendingEntityLivePatches.clear();
      for (const [id, patch] of entries) {
        this.updateEntityLiveState(id, patch);
      }
    }
    if (this.pendingBurningCastles.size > 0) {
      const entries = Array.from(this.pendingBurningCastles.entries());
      this.pendingBurningCastles.clear();
      for (const [id, st] of entries) {
        this.setCastleBurningState(id, st.isBurning, st.currentHp, st.maxHp);
      }
    }
    if (this.pendingMarchVisual !== undefined) {
      const mv = this.pendingMarchVisual;
      this.pendingMarchVisual = undefined;
      this.setMarchVisual(mv);
    }
    if (this.pendingAlliedColumns) {
      const cols = this.pendingAlliedColumns;
      this.pendingAlliedColumns = null;
      this.setAlliedRallyColumns(cols);
    }

    this.onCastlesUpdated?.([...this.castlesList]);
  }

  private startAsyncWorldMapBuild() {
    if (this.worldMapBuilt || this.isDisposed || this.isBuildingWorldNow || this.worldBuildRafId !== null) {
      return;
    }
    this.isBuildingWorldNow = true;
    const step = () => {
      this.worldBuildRafId = null;
      if (this.isDisposed || this.worldMapBuilt) {
        this.isBuildingWorldNow = false;
        return;
      }
      if (this.worldBuildStage <= 8) {
        this.runWorldBuildStage(this.worldBuildStage);
        this.worldBuildStage++;
        this.worldBuildRafId = requestAnimationFrame(step);
      } else {
        this.finalizeWorldMapBuild();
      }
    };
    this.worldBuildRafId = requestAnimationFrame(step);
  }

  public ensureWorldMapBuilt() {
    if (this.worldMapBuilt || this.isDisposed) return;
    if (this.worldBuildRafId !== null) {
      cancelAnimationFrame(this.worldBuildRafId);
      this.worldBuildRafId = null;
    }
    this.isBuildingWorldNow = true;
    while (this.worldBuildStage <= 8) {
      this.runWorldBuildStage(this.worldBuildStage);
      this.worldBuildStage++;
    }
    this.finalizeWorldMapBuild();
  }

  private ensureInsideKingdom3D(): InsideKingdom3D {
    if (this.insideKingdom3D) return this.insideKingdom3D;
    this.insideKingdom3D = new InsideKingdom3D({
      onStateChange: (state) => {
        this.onInsideKingdomStateChange?.(state);
      },
      onMergeEffect: (worldPos, text, color) => {
        this.spawnImpactSparks(worldPos);
        this.spawnDebrisChips(worldPos, 'gold');
        const proj = worldPos.clone().project(this.cameraController.camera);
        const screenX = ((proj.x + 1) * this.container.clientWidth) / 2;
        const screenY = ((-proj.y + 1) * this.container.clientHeight) / 2;
        this.onAddCombatFloater?.(text, color, screenX, screenY - 24);
      },
    });
    this.insideKingdom3D.rootGroup.visible = false;
    this.scene.add(this.insideKingdom3D.rootGroup);
    return this.insideKingdom3D;
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.isContextLost = true;
    cancelAnimationFrame(this.animFrameId);
    clearTimeout(this.animFrameId);
  };

  private onContextRestored = () => {
    if (this.isDisposed) return;
    this.isContextLost = false;
    this.hasCompiledScene = false;
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      const roomEnv = new RoomEnvironment();
      const prevEnv = this.scene.environment;
      this.scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
      roomEnv.dispose();
      pmremGenerator.dispose();
      prevEnv?.dispose();
    } catch {
      // Ignore transient restore errors
    }
    this.startLoop();
  };

  private initScene() {
    this.isSoftwareGl = detectSoftwareWebGL();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#b8d8eb');
    this.scene.fog = new THREE.FogExp2('#c6dfee', 0.00032);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setSize(
      Math.max(1, this.container.clientWidth),
      Math.max(1, this.container.clientHeight)
    );
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.75)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // Realistic Studio Environment Map for metallic gold spires, water, and armor
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
    this.container.appendChild(this.renderer.domElement);

    // Panoramic Emerald Highland Mountain Skyline Background Dome
    const skyTex = createHimalayanSkylineTexture();
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const skyGeo = new THREE.CylinderGeometry(10500, 10500, 4800, 64, 1, true);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.position.set(WORLD_BOUNDS.CENTER_X, 500, WORLD_BOUNDS.CENTER_Z);
    this.scene.add(skyMesh);
  }

  private initLighting() {
    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x3a4d34, 1.05);
    this.scene.add(this.hemiLight);

    const isMobileShadow = typeof window !== 'undefined' && window.innerWidth < 768;
    const shadowRes = isMobileShadow ? 1024 : 2048;

    this.sunLight = new THREE.DirectionalLight(0xfff5dc, 2.35);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(shadowRes, shadowRes);
    this.sunLight.shadow.camera.left = -this.currentShadowHalfExtent;
    this.sunLight.shadow.camera.right = this.currentShadowHalfExtent;
    this.sunLight.shadow.camera.top = this.currentShadowHalfExtent;
    this.sunLight.shadow.camera.bottom = -this.currentShadowHalfExtent;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 520;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.035;
    this.sunLight.shadow.radius = 2.4;
    this.sunLight.target.position.set(WORLD_BOUNDS.CENTER_X, 10, WORLD_BOUNDS.CENTER_Z);
    this.sunLight.position.set(WORLD_BOUNDS.CENTER_X - 85, 148, WORLD_BOUNDS.CENTER_Z + 72);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.sunLight.target.updateMatrixWorld();
  }

  private initTerrain() {
    this.terrainGenerator = new TerrainGenerator();

    // Cap terrain anisotropy to 4x for crisp grazing detail without mobile fill-rate stalls
    const maxAniso = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    if (this.terrainGenerator.terrainMaterial.map) {
      this.terrainGenerator.terrainMaterial.map.anisotropy = maxAniso;
    }
    if (this.terrainGenerator.terrainMaterial.normalMap) {
      this.terrainGenerator.terrainMaterial.normalMap.anisotropy = maxAniso;
    }

    this.scene.add(this.terrainGenerator.mesh);
    this.scene.add(this.terrainGenerator.vegetationGroup);
    this.scene.add(this.terrainGenerator.plotMarkersGroup);
    this.scene.add(this.terrainGenerator.waterfallsGroup);
    this.scene.add(this.terrainGenerator.mistPuffsGroup);
    this.scene.add(this.terrainGenerator.leylineStreamsGroup);
  }

  /**
   * High-altitude drifting cumulus clouds and soaring Himalayan birds (raptors + V-formation flocks)
   */
  private initAtmosphere() {
    this.scene.add(this.atmosphereGroup);

    const cloudGeo = new THREE.DodecahedronGeometry(1, 1);
    const cloudTopMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 1.0,
      metalness: 0.0,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    });
    const cloudShadeMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      roughness: 1.0,
      metalness: 0.0,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });

    // 38 sculpted multi-puff cumulus clouds spread across all 4 quadrants, Nile corridor & outer peaks
    const cloudSpots: Array<[number, number, number, number]> = [
      // Outer highlands & corners
      [220, 92, 240, 1.75], [760, 102, 210, 1.45], [1420, 108, 190, 1.65], [2180, 104, 230, 1.55], [2920, 96, 290, 1.8],
      [240, 98, 880, 1.5], [2980, 100, 920, 1.6], [260, 104, 1620, 1.7], [2950, 98, 1680, 1.65],
      [290, 96, 2380, 1.55], [2910, 102, 2340, 1.6], [310, 98, 2940, 1.85], [960, 106, 2980, 1.55],
      [1620, 104, 2940, 1.75], [2320, 100, 2960, 1.6], [2900, 94, 2890, 1.7],
      // Mid-continent rings & Nile valley corridor
      [680, 88, 680, 1.35], [1180, 92, 620, 1.25], [1920, 90, 640, 1.4], [2520, 94, 720, 1.45],
      [640, 90, 1280, 1.3], [1140, 86, 1180, 1.2], [2080, 88, 1040, 1.35], [2580, 92, 1260, 1.4],
      [740, 96, 1820, 1.5], [1220, 90, 1980, 1.25], [2020, 88, 1920, 1.35], [2540, 94, 1860, 1.45],
      [680, 94, 2460, 1.4], [1240, 92, 2480, 1.3], [2120, 90, 2320, 1.45], [2580, 96, 2520, 1.5],
      // High-altitude wisps around the central basin (kept high so Citadel & battles stay clear)
      [1480, 118, 1340, 1.15], [1780, 122, 1460, 1.2], [1420, 120, 1780, 1.15], [1760, 124, 1820, 1.2],
      [1590, 126, 980, 1.35], [1610, 126, 2220, 1.35],
    ];

    cloudSpots.forEach(([cx, cy, cz, scale], i) => {
      const cGrp = new THREE.Group();
      cGrp.position.set(cx, cy, cz);
      cGrp.rotation.y = (i * 0.73) % (Math.PI * 2);

      // Lower cool-tinted base puffs
      const baseCount = 2 + (i % 2);
      for (let b = 0; b < baseCount; b++) {
        const basePuff = new THREE.Mesh(cloudGeo, cloudShadeMat);
        basePuff.position.set(
          (b - (baseCount - 1) * 0.5) * 17 * scale,
          -1.6 * scale,
          ((b % 2) - 0.5) * 7 * scale
        );
        basePuff.scale.set(20 * scale, 4.2 * scale, 13 * scale);
        cGrp.add(basePuff);
      }

      // Upper warm-lit cumulus crown puffs (4 puffs)
      const puffOffsets: Array<[number, number, number, number, number, number]> = [
        [-19, 1.2, -3, 18, 5.2, 12],
        [-5, 3.6, 2, 21, 6.8, 14],
        [9, 2.8, -2, 19, 6.0, 13],
        [21, 0.8, 4, 15, 4.4, 11],
      ];
      for (let p = 0; p < puffOffsets.length; p++) {
        const [ox, oy, oz, sx, sy, sz] = puffOffsets[p];
        const puff = new THREE.Mesh(cloudGeo, cloudTopMat);
        puff.position.set(ox * scale, oy * scale, oz * scale);
        puff.scale.set(sx * scale, sy * scale, sz * scale);
        cGrp.add(puff);
      }

      this.atmosphereGroup.add(cGrp);
      this.atmosphericClouds.push({
        group: cGrp,
        baseX: cx,
        baseY: cy,
        baseZ: cz,
        speedX: 2.6 + (i % 5) * 0.85,
        speedZ: ((i % 3) - 1) * 0.45,
        bobAmp: 1.1 + (i % 3) * 0.45,
        phase: i * 0.92,
      });
    });

    // Composite 5-part procedural 3D bird silhouettes (body, head/beak, fanned tail, swept tapered L/R wings)
    const birdBodyGeo = new THREE.ConeGeometry(0.36, 2.2, 6);
    birdBodyGeo.rotateX(Math.PI / 2);

    const birdBeakGeo = new THREE.ConeGeometry(0.16, 0.68, 5);
    birdBeakGeo.rotateX(Math.PI / 2);

    const birdTailGeo = new THREE.ConeGeometry(0.55, 1.15, 4);
    birdTailGeo.rotateX(-Math.PI / 2);
    birdTailGeo.scale(1.25, 0.16, 1.0);

    // Swept tapered wing airfoil pivoted at shoulder x=0
    const buildWingGeo = (side: -1 | 1): THREE.BufferGeometry => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0.44);
      shape.lineTo(side * 1.15, 0.36);
      shape.lineTo(side * 2.55, -0.18);
      shape.lineTo(side * 2.2, -0.48);
      shape.lineTo(side * 0.9, -0.22);
      shape.lineTo(0, -0.32);
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.06,
        bevelEnabled: false,
        curveSegments: 2,
      });
      geo.rotateX(Math.PI / 2);
      return geo;
    };
    const leftWingGeo = buildWingGeo(-1);
    const rightWingGeo = buildWingGeo(1);

    const speciesPalettes = [
      {
        // Himalayan Golden Eagle
        wing: new THREE.MeshStandardMaterial({ color: 0x3b281c, roughness: 0.82 }),
        body: new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.8 }),
        accent: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.55 }),
      },
      {
        // Highland Peregrine Falcon
        wing: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.78 }),
        body: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.75 }),
        accent: new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.5 }),
      },
      {
        // Alpine Snow Crane
        wing: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 }),
        body: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }),
        accent: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.55 }),
      },
    ];

    const createBirdGroup = (speciesIdx: number, scale: number): THREE.Group => {
      const pal = speciesPalettes[speciesIdx % speciesPalettes.length];
      const bird = new THREE.Group();

      const body = new THREE.Mesh(birdBodyGeo, pal.body);
      bird.add(body);

      const beak = new THREE.Mesh(birdBeakGeo, pal.accent);
      beak.position.set(0, 0.04, 1.32);
      bird.add(beak);

      const tail = new THREE.Mesh(birdTailGeo, pal.wing);
      tail.position.set(0, 0.02, -1.25);
      bird.add(tail);

      const leftWing = new THREE.Mesh(leftWingGeo, pal.wing);
      leftWing.position.set(-0.2, 0.08, 0.05);
      leftWing.userData = { isEagleWingLeft: true };
      bird.add(leftWing);

      const rightWing = new THREE.Mesh(rightWingGeo, pal.wing);
      rightWing.position.set(0.2, 0.08, 0.05);
      rightWing.userData = { isEagleWingRight: true };
      bird.add(rightWing);

      bird.scale.setScalar(scale);
      return bird;
    };

    // 14 circling raptors over mountain peaks, Nile delta, shrines & castles
    const raptorPeaks: Array<[number, number, number, number, number]> = [
      [240, 64, 240, 42, 0], [2960, 66, 240, 46, 0], [240, 68, 2960, 44, 0], [2960, 70, 2960, 48, 0],
      [1600, 62, 1600, 56, 0], [1320, 58, 1480, 38, 1], [1960, 60, 1480, 38, 1],
      [820, 56, 2120, 40, 1], [2340, 58, 860, 44, 0], [920, 54, 1180, 36, 2],
      [2180, 60, 2240, 46, 1], [620, 62, 740, 42, 0], [2540, 64, 1520, 40, 2], [1560, 64, 2680, 48, 0],
    ];

    raptorPeaks.forEach(([ex, ey, ez, radius, speciesIdx], idx) => {
      const bird = createBirdGroup(speciesIdx, 1.05 + (idx % 3) * 0.14);
      bird.position.set(ex, ey, ez);
      this.atmosphereGroup.add(bird);
      this.soaringEagles.push({
        group: bird,
        cx: ex,
        cz: ez,
        baseY: ey,
        radius,
        speed: 0.30 + (idx % 4) * 0.06,
        flapSpeed: 6.4 + (idx % 3) * 1.1,
        bankTilt: -0.22,
        phase: idx * 1.15,
      });
    });

    // 6 gliding V-formation flocks (4 birds each = 24 birds) cruising across the valley & rivers
    const flockRoutes: Array<[number, number, number, number, number]> = [
      [1100, 50, 980, 155, 2],
      [2080, 54, 1280, 175, 1],
      [1520, 58, 2040, 190, 2],
      [880, 52, 2360, 165, 1],
      [2340, 56, 2420, 170, 2],
      [1620, 60, 740, 185, 1],
    ];

    flockRoutes.forEach(([fx, fy, fz, baseRadius, speciesIdx], fIdx) => {
      const baseSpeed = 0.16 + (fIdx % 3) * 0.03;
      const basePhase = fIdx * 1.7;
      for (let m = 0; m < 4; m++) {
        const bird = createBirdGroup(speciesIdx, m === 0 ? 0.94 : 0.82);
        const wingOffset = m === 0 ? 0 : (m % 2 === 1 ? -1 : 1) * Math.ceil(m / 2) * 11;
        bird.position.set(fx, fy, fz);
        this.atmosphereGroup.add(bird);
        this.soaringEagles.push({
          group: bird,
          cx: fx,
          cz: fz,
          baseY: fy + (m === 0 ? 1.2 : -m * 0.45),
          radius: baseRadius + wingOffset,
          speed: baseSpeed,
          flapSpeed: 7.4 + m * 0.45,
          bankTilt: -0.16,
          phase: basePhase - m * 0.09,
        });
      }
    });
  }

  // ============================================================
  // 1. ARCANE BLUE CRYSTAL & GOLD STRATEGIC STRUCTURES + RANDOM CASTLES
  //    (Matching Uploaded Reference Strategy Map)
  // ============================================================
  private createFloatingBadgeSprite(
    title: string,
    subtitle: string,
    starsText: string,
    borderColor: string,
    accentColor: string,
    scaleWidth = 14,
    scaleHeight = 4.6
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 168;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 512, 168);

      // Dark translucent glass pill
      ctx.fillStyle = 'rgba(8, 15, 30, 0.88)';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(12, 12, 488, 144, 24);
      ctx.fill();
      ctx.stroke();

      // Inner accent glow line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(18, 18, 476, 132, 18);
      ctx.stroke();

      // Stars or Icon header
      if (starsText) {
        ctx.font = "900 32px 'Barlow Condensed', sans-serif";
        ctx.fillStyle = accentColor;
        ctx.textAlign = 'center';
        ctx.fillText(starsText, 256, 52, 452);
      }

      // Main Title
      ctx.font = "800 34px 'Barlow Condensed', sans-serif";
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(title, 256, starsText ? 94 : 76, 452);

      // Subtitle
      ctx.font = "700 24px 'Inter', sans-serif";
      ctx.fillStyle = accentColor;
      ctx.textAlign = 'center';
      ctx.fillText(subtitle, 256, starsText ? 132 : 118, 452);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scaleWidth, scaleHeight, 1);
    return sprite;
  }

  private initKingdomBuildings() {
    this.scene.add(this.buildingsGroup);

    const stoneTex = createStoneBrickTexture();
    const stoneMat = new THREE.MeshStandardMaterial({
      map: stoneTex,
      color: 0xe2e8f0,
      roughness: 0.55,
      metalness: 0.25,
    });
    const darkSlateMat = new THREE.MeshStandardMaterial({
      map: stoneTex,
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.35,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.22,
      metalness: 0.92,
      emissive: 0x92400e,
      emissiveIntensity: 0.45,
    });
    // Arcane Blue Crystal Material (matching the glowing sapphire/cyan crystal spires in the reference image)
    const arcaneCrystalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 2.2,
      roughness: 0.12,
      metalness: 0.35,
      transparent: true,
      opacity: 0.94,
    });
    const deepCrystalMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0369a1,
      emissiveIntensity: 1.6,
      roughness: 0.18,
      metalness: 0.4,
    });
    const cyanRingMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 2.0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    });
    const goldRingMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xd97706,
      emissiveIntensity: 2.2,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    this.conqueredCrystalMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 2.4,
      roughness: 0.12,
      metalness: 0.38,
      transparent: true,
      opacity: 0.95,
    });
    this.conqueredRingMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 2.3,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });

    const addMesh = (
      parent: THREE.Group,
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x = 0,
      y = 0,
      z = 0,
      cast = true
    ) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    const registerEntity = (group: THREE.Group, entity: WorldEntity) => {
      group.userData = { gameEntity: entity };
      this.entitiesMap.set(entity.id, entity);
      this.buildingMeshesMap.set(entity.id, group);

      const hitCollider = new THREE.Mesh(
        new THREE.CylinderGeometry(entity.radius, entity.radius, 18, 8),
        new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 })
      );
      hitCollider.position.y = 9;
      hitCollider.userData = { gameEntity: entity };
      group.add(hitCollider);

      this.pickableObjects.push(hitCollider);
    };

    // =====================================================================
    // 1. CENTRAL THE CONGRESS ("Emperor Congress Citadel of Crystal and Gold")
    //    Coordinate: [1600, 10.0, 1600]
    // =====================================================================
    const congressPlot = RESERVED_PLOTS.find((p) => p.type === 'congress');
    if (congressPlot) {
      const citadelGroup = new THREE.Group();
      const cY = this.terrainGenerator.getHeightAt(congressPlot.position[0], congressPlot.position[2]);
      congressPlot.position[1] = cY;
      citadelGroup.position.set(congressPlot.position[0], cY, congressPlot.position[2]);

      const congressShadow = createTerrainConformedContactShadow({
        width: 52,
        depth: 52,
        worldX: congressPlot.position[0],
        worldZ: congressPlot.position[2],
        baseGroundY: cY,
        yOffset: 0.08,
        getHeightAt: (x, z) => this.terrainGenerator.getHeightAt(x, z),
        material: this.worldOctagonalShadowMat,
        shiftAmount: 2.35,
        renderOrder: 2,
      });
      citadelGroup.add(congressShadow.mesh);
      this.worldBuildingShadowEntries.push(congressShadow.entry);

      // Grand Octagonal White-Marble & Gold Congress Podium
      addMesh(citadelGroup, new THREE.CylinderGeometry(18.5, 20.5, 3.2, 8), stoneMat, 0, 1.6, 0);
      addMesh(citadelGroup, new THREE.CylinderGeometry(19.2, 19.2, 0.55, 8), goldMat, 0, 3.3, 0);
      addMesh(citadelGroup, new THREE.CylinderGeometry(14.5, 16.0, 3.8, 8), darkSlateMat, 0, 5.2, 0);
      addMesh(citadelGroup, new THREE.CylinderGeometry(15.2, 15.2, 0.5, 8), goldMat, 0, 7.2, 0);

      // 4 Cardinal Golden Stairways
      const stairGeo = new THREE.BoxGeometry(6.5, 2.6, 4.2);
      for (const [sx, sz, rotY] of [
        [0, 19.2, 0],
        [0, -19.2, Math.PI],
        [19.2, 0, Math.PI / 2],
        [-19.2, 0, -Math.PI / 2],
      ]) {
        const stair = addMesh(citadelGroup, stairGeo, goldMat, sx, 1.3, sz);
        stair.rotation.y = rotY;
      }

      // 4 Corner Golden & Crystal Bastion Turrets
      const cTurretBaseGeo = new THREE.CylinderGeometry(2.8, 3.4, 9.5, 8);
      const cTurretCollarGeo = new THREE.CylinderGeometry(3.3, 3.3, 0.7, 8);
      const cTurretSpireGeo = new THREE.ConeGeometry(2.3, 6.8, 6);
      const cTurretOrbGeo = new THREE.OctahedronGeometry(0.9, 0);
      for (const [tx, tz] of [
        [-12.5, -12.5],
        [12.5, -12.5],
        [-12.5, 12.5],
        [12.5, 12.5],
      ]) {
        addMesh(citadelGroup, cTurretBaseGeo, stoneMat, tx, 4.75, tz);
        addMesh(citadelGroup, cTurretCollarGeo, goldMat, tx, 9.6, tz);
        addMesh(citadelGroup, cTurretSpireGeo, arcaneCrystalMat, tx, 13.3, tz);
        addMesh(citadelGroup, cTurretOrbGeo, goldMat, tx, 17.2, tz);
      }

      // Central Colossal Arcane Blue Crystal Spire & Golden Collar
      addMesh(citadelGroup, new THREE.CylinderGeometry(8.2, 9.5, 5.5, 8), goldMat, 0, 9.8, 0);
      const mainCrystal = addMesh(
        citadelGroup,
        new THREE.ConeGeometry(6.2, 21.0, 6),
        arcaneCrystalMat,
        0,
        22.5,
        0
      );
      mainCrystal.userData = { isCrownJewel: true };

      const cShardGeo = new THREE.ConeGeometry(2.4, 11.5, 5);
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3;
        const shard = addMesh(
          citadelGroup,
          cShardGeo,
          deepCrystalMat,
          Math.cos(ang) * 5.8,
          15.0,
          Math.sin(ang) * 5.8
        );
        shard.rotation.x = Math.sin(ang) * 0.28;
        shard.rotation.z = -Math.cos(ang) * 0.28;
      }

      const haloRing = addMesh(
        citadelGroup,
        new THREE.TorusGeometry(8.5, 0.35, 10, 32),
        goldMat,
        0,
        20.5,
        0
      );
      haloRing.rotation.x = Math.PI / 2;
      haloRing.userData = { isBlessingRing: true };

      const citadelGroundRing = new THREE.Mesh(new THREE.RingGeometry(19.5, 21.5, 32), goldRingMat);
      citadelGroundRing.rotation.x = -Math.PI / 2;
      citadelGroundRing.position.y = 0.22;
      citadelGroundRing.renderOrder = 4;
      citadelGroundRing.userData = { isBlessingRing: true };
      citadelGroup.add(citadelGroundRing);

      const cTitle = 'THE CONGRESS';
      const cSub = `Continent 1 Citadel · [${Math.round(congressPlot.position[0])}, ${Math.round(congressPlot.position[2])}]`;
      const cStars = '👑 ★★★ CONGRESS (2C+1B+1A REQ) ★★★';
      const citadelBadge = this.createFloatingBadgeSprite(
        cTitle,
        cSub,
        cStars,
        '#facc15',
        '#fde047',
        18.5,
        5.8
      );
      citadelBadge.position.set(0, 36.5, 0);
      citadelGroup.add(citadelBadge);

      const congressCrystalMeshes: THREE.Mesh[] = [mainCrystal];
      citadelGroup.traverse((ch) => {
        const m = ch as THREE.Mesh;
        if (m.isMesh && (m.material === arcaneCrystalMat || m.material === deepCrystalMat) && m !== mainCrystal) {
          congressCrystalMeshes.push(m);
        }
      });

      this.buildingsGroup.add(citadelGroup);
      this.buildingConquestRefs.set(congressPlot.id, {
        crystalMeshes: congressCrystalMeshes,
        neutralCrystalMats: congressCrystalMeshes.map((m) => m.material as THREE.Material),
        ringMesh: citadelGroundRing,
        neutralRingMat: goldRingMat,
        badgeSprite: citadelBadge,
        group: citadelGroup,
        badgeY: 36.5,
        neutralBadge: {
          title: cTitle,
          subtitle: cSub,
          starsText: cStars,
          borderColor: '#facc15',
          accentColor: '#fde047',
          scaleW: 18.5,
          scaleH: 5.8,
        },
      });
      registerEntity(citadelGroup, {
        id: congressPlot.id,
        name: congressPlot.name,
        category: 'building',
        type: 'congress',
        subtype: 'congress',
        level: 25,
        position: congressPlot.position,
        radius: 20.0,
        health: 15000,
        maxHealth: 15000,
        tier: 3,
        ownerFaction: 'neutral',
        buffLabel: '+20% All Kingdom Stats',
        description: congressPlot.description,
        actions: ['attack', 'rally', 'scout', 'inspect'],
      });
    }

    // =====================================================================
    // 2, 3 & 4. FLOATING CRYSTAL SHRINES (C = Purple, B = Red, A = Blue)
    //   Modeled after the Floating Crystal Shrine Reference Architecture:
    //   Outer mossy stone rim + moat + twin waterfalls + lotus stair runner +
    //   4 gold-capped bastion towers w/ blue banners + inner portal basin +
    //   hovering faceted crystal + 2 tilted gold rings + colored flames + lightning
    // =====================================================================

    // Procedural Royal Blue Banner & Carpet Texture with Golden Lotus Crest
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 256;
    bannerCanvas.height = 512;
    const bCtx = bannerCanvas.getContext('2d');
    if (bCtx) {
      const bGrad = bCtx.createLinearGradient(0, 0, 0, 512);
      bGrad.addColorStop(0, '#1e3a8a');
      bGrad.addColorStop(0.55, '#1d4ed8');
      bGrad.addColorStop(1, '#172554');
      bCtx.fillStyle = bGrad;
      bCtx.fillRect(0, 0, 256, 512);

      // Gold side borders & top/bottom trim
      bCtx.strokeStyle = '#facc15';
      bCtx.lineWidth = 14;
      bCtx.strokeRect(10, 10, 236, 492);
      bCtx.strokeStyle = '#fef08a';
      bCtx.lineWidth = 4;
      bCtx.strokeRect(22, 22, 212, 468);

      // Golden 5-petal Lotus Emblem
      bCtx.save();
      bCtx.translate(128, 256);
      bCtx.fillStyle = '#facc15';
      bCtx.strokeStyle = '#fef08a';
      bCtx.lineWidth = 3;
      const drawPetal = (angle: number, len: number, wid: number) => {
        bCtx.save();
        bCtx.rotate(angle);
        bCtx.beginPath();
        bCtx.moveTo(0, 14);
        bCtx.quadraticCurveTo(wid, -len * 0.45, 0, -len);
        bCtx.quadraticCurveTo(-wid, -len * 0.45, 0, 14);
        bCtx.fill();
        bCtx.stroke();
        bCtx.restore();
      };
      drawPetal(0, 74, 24);
      drawPetal(-0.46, 62, 20);
      drawPetal(0.46, 62, 20);
      drawPetal(-0.92, 46, 16);
      drawPetal(0.92, 46, 16);
      bCtx.fillStyle = '#fde047';
      bCtx.beginPath();
      bCtx.ellipse(0, 24, 34, 10, 0, 0, Math.PI * 2);
      bCtx.fill();
      bCtx.restore();
    }
    const blueLotusTex = new THREE.CanvasTexture(bannerCanvas);
    blueLotusTex.colorSpace = THREE.SRGBColorSpace;
    blueLotusTex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    const blueBannerMat = new THREE.MeshStandardMaterial({
      map: blueLotusTex,
      roughness: 0.48,
      metalness: 0.18,
      side: THREE.DoubleSide,
    });
    const moatWaterMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.95,
      roughness: 0.1,
      metalness: 0.3,
    });
    const waterfallMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.35,
      roughness: 0.15,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    });
    const foamMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x7dd3fc,
      emissiveIntensity: 1.5,
      roughness: 0.35,
      transparent: true,
      opacity: 0.85,
    });
    const mossRockMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.85,
      metalness: 0.08,
    });
    const shrubMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.88,
      metalness: 0.04,
    });

    // Shared Sanctuary Geometries (reused cleanly across all 36 shrines)
    const shOuterFloorGeo = new THREE.CylinderGeometry(7.2, 7.5, 0.36, 32);
    const shOuterRimGeo = new THREE.TorusGeometry(7.1, 0.24, 6, 32);
    const shMoatGeo = new THREE.RingGeometry(4.78, 6.92, 32);
    const shInnerBaseGeo = new THREE.CylinderGeometry(4.86, 5.18, 2.1, 24);
    const shInnerGoldBandGeo = new THREE.CylinderGeometry(4.94, 4.94, 0.18, 24);
    const shInnerWaterGeo = new THREE.CylinderGeometry(4.32, 4.32, 0.1, 24);
    const shWalkNSGeo = new THREE.BoxGeometry(1.45, 0.3, 4.35);
    const shWalkEWGeo = new THREE.BoxGeometry(4.35, 0.3, 1.45);
    const shParapetArcGeo = new THREE.CylinderGeometry(4.65, 4.72, 1.05, 8, 1, false, 0, Math.PI * 0.36);
    const shParapetWallBackGeo = new THREE.CylinderGeometry(4.65, 4.72, 1.05, 10, 1, false, Math.PI * 0.72, Math.PI * 0.56);

    const shStairStepGeo = new THREE.BoxGeometry(2.2, 0.34, 0.45);
    const shStairRailGeo = new THREE.BoxGeometry(0.22, 0.48, 2.75);
    const shCarpetGeo = new THREE.PlaneGeometry(1.46, 2.65);

    const shWaterfallLipGeo = new THREE.BoxGeometry(1.45, 0.26, 0.55);
    const shWaterfallSheetGeo = new THREE.PlaneGeometry(1.38, 2.35, 1, 4);
    const shWaterfallFoamGeo = new THREE.TorusGeometry(0.76, 0.15, 6, 16);

    const shTowerLowerGeo = new THREE.BoxGeometry(1.36, 3.65, 1.36);
    const shTowerUpperGeo = new THREE.BoxGeometry(1.12, 0.72, 1.12);
    const shTowerGoldGeo = new THREE.BoxGeometry(1.26, 0.22, 1.26);
    const shTowerFinialGeo = new THREE.ConeGeometry(0.45, 0.92, 4);
    const shBannerGeo = new THREE.PlaneGeometry(0.74, 1.48);

    const shGatePillarGeo = new THREE.BoxGeometry(0.95, 3.15, 0.95);
    const shGateGoldGeo = new THREE.BoxGeometry(1.06, 0.2, 1.06);
    const shGateFinialGeo = new THREE.ConeGeometry(0.36, 0.78, 4);

    const shBeaconBaseGeo = new THREE.CylinderGeometry(0.42, 0.52, 0.62, 8);
    const shBeaconGoldGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.14, 8);
    const shBeaconCrystalGeo = new THREE.ConeGeometry(0.32, 1.18, 6);

    const shRockGeo = new THREE.DodecahedronGeometry(0.52, 0);
    const shShrubGeo = new THREE.IcosahedronGeometry(0.44, 0);

    const shAltarDrumGeo = new THREE.CylinderGeometry(1.92, 2.15, 0.46, 16);
    const shAltarGoldRingGeo = new THREE.TorusGeometry(1.42, 0.14, 10, 28);
    const shAltarPoolGeo = new THREE.CircleGeometry(1.32, 24);
    const shRunePadGeo = new THREE.BoxGeometry(0.56, 0.16, 0.56);

    // Faceted Floating Hero Crystal (double-pointed jewel bipyramid matching reference silhouette)
    const shHeroCrystalGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, -2.55),
        new THREE.Vector2(1.08, -0.58),
        new THREE.Vector2(1.38, 0.65),
        new THREE.Vector2(0.82, 1.95),
        new THREE.Vector2(0.0, 2.9),
      ],
      7
    );
    shHeroCrystalGeo.computeVertexNormals();
    const shHeroCoreGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, -1.45),
        new THREE.Vector2(0.58, -0.32),
        new THREE.Vector2(0.74, 0.38),
        new THREE.Vector2(0.0, 1.65),
      ],
      7
    );
    const shGoldOrbitGeo1 = new THREE.TorusGeometry(2.05, 0.068, 8, 36);
    const shGoldOrbitGeo2 = new THREE.TorusGeometry(2.58, 0.056, 8, 36);
    const shPortalBeamGeo = new THREE.CylinderGeometry(0.32, 0.96, 4.4, 12, 1, true);
    const shFlameGeo = new THREE.ConeGeometry(0.28, 1.65, 5);
    shFlameGeo.translate(0, 0.82, 0);

    // Tier visual presets (Purple for C, Red for B, Blue for A — banners/stairs/outer crystals stay blue+gold)
    interface ShrineTierVisualPreset {
      scale: number;
      crystalColor: number;
      crystalEmissive: number;
      coreColor: number;
      flameColor: number;
      lightningColor: number;
      ringColor: number;
      ringEmissive: number;
      badgeBorder: string;
      badgeAccent: string;
      starsText: string;
      subRegion: string;
      level: number;
      health: number;
      tier: number;
      buffLabel: string;
      ringRadiusInner: number;
      ringRadiusOuter: number;
    }

    const tierPresets: Record<'shrine_c' | 'shrine_b' | 'shrine_a', ShrineTierVisualPreset> = {
      shrine_c: {
        scale: 1.0,
        crystalColor: 0xa855f7,
        crystalEmissive: 0x7e22ce,
        coreColor: 0xf0abfc,
        flameColor: 0xd946ef,
        lightningColor: 0xe879f9,
        ringColor: 0xc084fc,
        ringEmissive: 0x9333ea,
        badgeBorder: '#a855f7',
        badgeAccent: '#e9d5ff',
        starsText: '✦ TIER C · PURPLE CRYSTAL ✦',
        subRegion: 'Frontier',
        level: 12,
        health: 3200,
        tier: 1,
        buffLabel: '+5% Resource Yield',
        ringRadiusInner: 7.55,
        ringRadiusOuter: 8.3,
      },
      shrine_b: {
        scale: 1.18,
        crystalColor: 0xef4444,
        crystalEmissive: 0xb91c1c,
        coreColor: 0xfca5a5,
        flameColor: 0xff4d4f,
        lightningColor: 0xfb7185,
        ringColor: 0xf87171,
        ringEmissive: 0xdc2626,
        badgeBorder: '#ef4444',
        badgeAccent: '#fecaca',
        starsText: '★★ TIER B · RED CRYSTAL ★★',
        subRegion: 'Mid Ring',
        level: 16,
        health: 4600,
        tier: 2,
        buffLabel: '+8% March Speed',
        ringRadiusInner: 8.85,
        ringRadiusOuter: 9.7,
      },
      shrine_a: {
        scale: 1.36,
        crystalColor: 0x38bdf8,
        crystalEmissive: 0x0284c7,
        coreColor: 0xbae6fd,
        flameColor: 0x22d3ee,
        lightningColor: 0x7dd3fc,
        ringColor: 0x38bdf8,
        ringEmissive: 0x0284c7,
        badgeBorder: '#38bdf8',
        badgeAccent: '#bae6fd',
        starsText: '★★★ TIER A · BLUE CRYSTAL ★★★',
        subRegion: 'Inner Sanctum',
        level: 20,
        health: 6500,
        tier: 3,
        buffLabel: '+12% Attack Power',
        ringRadiusInner: 10.2,
        ringRadiusOuter: 11.2,
      },
    };

    const tierMaterials = (Object.keys(tierPresets) as Array<'shrine_c' | 'shrine_b' | 'shrine_a'>).reduce(
      (acc, k) => {
        const p = tierPresets[k];
        acc[k] = {
          crystalMat: new THREE.MeshStandardMaterial({
            color: p.crystalColor,
            emissive: p.crystalEmissive,
            emissiveIntensity: 1.85,
            roughness: 0.14,
            metalness: 0.35,
            flatShading: true,
            transparent: true,
            opacity: 0.9,
          }),
          coreMat: new THREE.MeshBasicMaterial({
            color: p.coreColor,
            transparent: true,
            opacity: 0.82,
          }),
          beamMat: new THREE.MeshBasicMaterial({
            color: p.flameColor,
            transparent: true,
            opacity: 0.38,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
          flameMat: new THREE.MeshBasicMaterial({
            color: p.flameColor,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
          poolMat: new THREE.MeshStandardMaterial({
            color: p.coreColor,
            emissive: p.flameColor,
            emissiveIntensity: 2.1,
            roughness: 0.15,
          }),
          ringMat: new THREE.MeshStandardMaterial({
            color: p.ringColor,
            emissive: p.ringEmissive,
            emissiveIntensity: 2.0,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.88,
          }),
          wardGeo: new THREE.RingGeometry(p.ringRadiusInner, p.ringRadiusOuter, 32),
        };
        return acc;
      },
      {} as Record<
        'shrine_c' | 'shrine_b' | 'shrine_a',
        {
          crystalMat: THREE.MeshStandardMaterial;
          coreMat: THREE.MeshBasicMaterial;
          beamMat: THREE.MeshBasicMaterial;
          flameMat: THREE.MeshBasicMaterial;
          poolMat: THREE.MeshStandardMaterial;
          ringMat: THREE.MeshStandardMaterial;
          wardGeo: THREE.RingGeometry;
        }
      >
    );

    const buildFloatingCrystalShrine = (
      site: (typeof RESERVED_PLOTS)[number],
      tierKey: 'shrine_c' | 'shrine_b' | 'shrine_a',
      idx: number
    ) => {
      const preset = tierPresets[tierKey];
      const mats = tierMaterials[tierKey];
      const groundY = this.terrainGenerator.getHeightAt(site.position[0], site.position[2]);
      site.position[1] = groundY;

      const rootGroup = new THREE.Group();
      rootGroup.position.set(site.position[0], groundY, site.position[2]);

      const shrineShadow = createTerrainConformedContactShadow({
        width: 19.4 * preset.scale,
        depth: 19.4 * preset.scale,
        worldX: site.position[0],
        worldZ: site.position[2],
        baseGroundY: groundY,
        yOffset: 0.06,
        getHeightAt: (x, z) => this.terrainGenerator.getHeightAt(x, z),
        material: this.worldRadialShadowMat,
        shiftAmount: 1.2 * preset.scale,
        renderOrder: 2,
      });
      rootGroup.add(shrineShadow.mesh);
      this.worldBuildingShadowEntries.push(shrineShadow.entry);

      // Scaled architectural container matching reference proportions
      const archGroup = new THREE.Group();
      archGroup.scale.setScalar(preset.scale);
      rootGroup.add(archGroup);

      // 1. Outer Stone Floor, Rim & Moat
      addMesh(archGroup, shOuterFloorGeo, stoneMat, 0, 0.18, 0);
      const outerRim = addMesh(archGroup, shOuterRimGeo, stoneMat, 0, 0.44, 0);
      outerRim.rotation.x = -Math.PI / 2;
      const moat = addMesh(archGroup, shMoatGeo, moatWaterMat, 0, 0.37, 0, false);
      moat.rotation.x = -Math.PI / 2;

      // Outer mossy rocks & green foliage shrubs along rim & waterfall banks
      for (const [rx, rz, rs] of [
        [-5.3, 4.4, 1.1], [5.3, 4.4, 1.1],
        [-6.3, 2.2, 0.9], [6.3, 2.2, 0.9],
        [-5.8, -3.5, 1.0], [5.8, -3.5, 1.0],
        [-3.2, -6.2, 0.95], [3.2, -6.2, 0.95],
      ]) {
        const rock = addMesh(archGroup, shRockGeo, mossRockMat, rx, 0.55, rz);
        rock.scale.setScalar(rs);
        rock.rotation.set(rx * 0.4, rz * 0.5, 0.3);
        const shrub = addMesh(archGroup, shShrubGeo, shrubMat, rx * 1.04, 0.72, rz * 1.02);
        shrub.scale.setScalar(rs * 0.9);
      }

      // 2. Inner Raised Circular Sanctuary Platform & Cross Walkways
      addMesh(archGroup, shInnerBaseGeo, stoneMat, 0, 1.05, 0);
      addMesh(archGroup, shInnerGoldBandGeo, goldMat, 0, 2.04, 0);
      addMesh(archGroup, shInnerWaterGeo, moatWaterMat, 0, 2.15, 0, false);
      addMesh(archGroup, shWalkNSGeo, stoneMat, 0, 2.22, 0);
      addMesh(archGroup, shWalkEWGeo, stoneMat, 0, 2.22, 0);

      // Curved stone colonnade parapet walls (left, right, and rear) leaving front stair open
      const leftParapet = addMesh(archGroup, shParapetArcGeo, stoneMat, 0, 2.65, 0);
      leftParapet.rotation.y = Math.PI * 0.28;
      const rightParapet = addMesh(archGroup, shParapetArcGeo, stoneMat, 0, 2.65, 0);
      rightParapet.rotation.y = -Math.PI * 0.64;
      addMesh(archGroup, shParapetWallBackGeo, stoneMat, 0, 2.65, 0);

      // 3. Front Grand Staircase (+Z) + Royal Blue & Gold Lotus Carpet Runner
      for (let step = 0; step < 6; step++) {
        const frac = step / 5;
        const sy = 0.45 + frac * 1.65;
        const sz = 6.7 - frac * 2.15;
        addMesh(archGroup, shStairStepGeo, stoneMat, 0, sy, sz);
      }
      const stairSlopeAngle = Math.atan2(1.75, 2.25);
      for (const side of [-1, 1]) {
        const rail = addMesh(archGroup, shStairRailGeo, goldMat, side * 1.15, 1.48, 5.65);
        rail.rotation.x = stairSlopeAngle;
      }
      const carpet = addMesh(archGroup, shCarpetGeo, blueBannerMat, 0, 1.46, 5.65, false);
      carpet.rotation.x = -Math.PI / 2 + stairSlopeAngle;

      // 4. Twin Cascading Waterfalls Flanking the Front Stairs
      const waterfallFoams: THREE.Mesh[] = [];
      for (const side of [-1, 1]) {
        addMesh(archGroup, shWaterfallLipGeo, stoneMat, side * 2.75, 2.1, 4.45);
        const sheet = addMesh(archGroup, shWaterfallSheetGeo, waterfallMat, side * 2.85, 1.28, 5.25, false);
        sheet.rotation.x = -0.58;
        sheet.rotation.z = side * -0.06;
        const foam = addMesh(archGroup, shWaterfallFoamGeo, foamMat, side * 2.95, 0.42, 5.88, false);
        foam.rotation.x = -Math.PI / 2;
        waterfallFoams.push(foam);
      }

      // 5. Four Corner Bastion Towers + 2 Front Gate Pillars (Gold Caps, Sapphire Pyramid Finials, Blue Lotus Banners)
      const banners: THREE.Mesh[] = [];
      const towerCoords: Array<[number, number, number]> = [
        [-3.25, 3.15, -0.55],
        [3.25, 3.15, 0.55],
        [-3.25, -3.15, -2.35],
        [3.25, -3.15, 2.35],
      ];
      for (const [tx, tz, rotY] of towerCoords) {
        addMesh(archGroup, shTowerLowerGeo, stoneMat, tx, 1.85, tz);
        addMesh(archGroup, shTowerUpperGeo, stoneMat, tx, 4.02, tz);
        addMesh(archGroup, shTowerGoldGeo, goldMat, tx, 4.48, tz);
        const finial = addMesh(archGroup, shTowerFinialGeo, arcaneCrystalMat, tx, 5.05, tz);
        finial.rotation.y = Math.PI / 4;

        // Vertical Royal Blue Golden Lotus Banner on outward face of tower
        const bGroup = new THREE.Group();
        bGroup.position.set(tx + Math.sin(rotY) * 0.72, 2.55, tz + Math.cos(rotY) * 0.72);
        bGroup.rotation.y = rotY;
        const bMesh = addMesh(bGroup, shBannerGeo, blueBannerMat, 0, -0.55, 0);
        archGroup.add(bGroup);
        banners.push(bMesh);
      }
      // 2 Front Stair Gate Pillars (Blue & Gold matching reference)
      for (const side of [-1, 1]) {
        addMesh(archGroup, shGatePillarGeo, stoneMat, side * 1.48, 1.62, 4.55);
        addMesh(archGroup, shGateGoldGeo, goldMat, side * 1.48, 3.26, 4.55);
        const gateFinial = addMesh(archGroup, shGateFinialGeo, arcaneCrystalMat, side * 1.48, 3.75, 4.55);
        gateFinial.rotation.y = Math.PI / 4;
      }

      // 6. Four Small Glowing Blue Perimeter Crystal Beacons (2 stair foot + 2 outer moat sides)
      for (const [bx, by, bz] of [
        [-1.68, 0.45, 6.48],
        [1.68, 0.45, 6.48],
        [-6.45, 0.5, 0.0],
        [6.45, 0.5, 0.0],
      ]) {
        addMesh(archGroup, shBeaconBaseGeo, stoneMat, bx, by + 0.3, bz);
        addMesh(archGroup, shBeaconGoldGeo, goldMat, bx, by + 0.65, bz);
        addMesh(archGroup, shBeaconCrystalGeo, arcaneCrystalMat, bx, by + 1.26, bz);
      }

      // 7. Central Golden Portal Basin & 4 Rune Pads
      addMesh(archGroup, shAltarDrumGeo, stoneMat, 0, 2.42, 0);
      const altarGoldRing = addMesh(archGroup, shAltarGoldRingGeo, goldMat, 0, 2.7, 0);
      altarGoldRing.rotation.x = -Math.PI / 2;
      const portalDisc = addMesh(archGroup, shAltarPoolGeo, mats.poolMat, 0, 2.64, 0, false);
      portalDisc.rotation.x = -Math.PI / 2;
      for (const [rx, rz] of [
        [-1.85, 0],
        [1.85, 0],
        [0, -1.85],
        [0, 1.85],
      ]) {
        addMesh(archGroup, shRunePadGeo, arcaneCrystalMat, rx, 2.38, rz);
      }

      // 8. Huge Faceted Floating Hero Crystal + Glow Core + Twin Tilted Gold Orbit Rings
      const crystalGroup = new THREE.Group();
      const crystalBaseY = 6.95;
      crystalGroup.position.set(0, crystalBaseY, 0);
      addMesh(crystalGroup, shHeroCrystalGeo, mats.crystalMat, 0, 0, 0);
      addMesh(crystalGroup, shHeroCoreGeo, mats.coreMat, 0, 0, 0, false);

      const orbitRing1 = addMesh(crystalGroup, shGoldOrbitGeo1, goldMat, 0, -0.35, 0, true);
      orbitRing1.rotation.set(Math.PI / 2 + 0.38, 0.25, 0);
      const orbitRing2 = addMesh(crystalGroup, shGoldOrbitGeo2, goldMat, 0, 0.3, 0, true);
      orbitRing2.rotation.set(Math.PI / 2 - 0.42, -0.3, 0);
      archGroup.add(crystalGroup);

      // 9. Vertical Rising Energy Beam + 6 Rising Tier-Colored Flame Tongues
      const portalBeam = addMesh(archGroup, shPortalBeamGeo, mats.beamMat, 0, 4.75, 0, false);
      const flameTongues: Array<{
        mesh: THREE.Mesh;
        baseX: number;
        baseY: number;
        baseZ: number;
        phase: number;
        speed: number;
      }> = [];
      for (let f = 0; f < 6; f++) {
        const ang = (f * Math.PI * 2) / 6;
        const rad = f % 2 === 0 ? 1.15 : 0.72;
        const fx = Math.cos(ang) * rad;
        const fz = Math.sin(ang) * rad;
        const fy = 2.68;
        const flameMesh = addMesh(archGroup, shFlameGeo, mats.flameMat, fx, fy, fz, false);
        flameTongues.push({
          mesh: flameMesh,
          baseX: fx,
          baseY: fy,
          baseZ: fz,
          phase: idx * 0.7 + f * 1.15,
          speed: 5.5 + (f % 3) * 1.4,
        });
      }

      // 10. Crackling 3D Lightning Arcs (4 pre-allocated bolts spanning corner spires -> floating crystal)
      const lightningMat = new THREE.LineBasicMaterial({
        color: preset.lightningColor,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const lightningBolts: Array<{
        line: THREE.Line;
        positions: Float32Array;
        startX: number;
        startY: number;
        startZ: number;
        endX: number;
        endY: number;
        endZ: number;
        jitter: number;
        phase: number;
      }> = [];
      const boltAnchors: Array<[number, number, number, number, number, number]> = [
        [-3.25, 5.15, 3.15, -0.65, 6.95, 0.55],
        [3.25, 5.15, 3.15, 0.65, 7.35, 0.55],
        [-3.25, 5.15, -3.15, -0.55, 7.65, -0.55],
        [3.25, 5.15, -3.15, 0.55, 6.55, -0.55],
      ];
      boltAnchors.forEach(([sx, sy, sz, ex, ey, ez], bIdx) => {
        const positions = new Float32Array(7 * 3);
        const geo = new THREE.BufferGeometry();
        const attr = new THREE.BufferAttribute(positions, 3);
        attr.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('position', attr);
        const line = new THREE.Line(geo, lightningMat);
        line.frustumCulled = false;
        archGroup.add(line);
        lightningBolts.push({
          line,
          positions,
          startX: sx,
          startY: sy,
          startZ: sz,
          endX: ex,
          endY: ey,
          endZ: ez,
          jitter: 0.52,
          phase: idx * 1.3 + bIdx * 1.7,
        });
      });

      this.animatedShrines.push({
        crystalGroup,
        crystalBaseY,
        orbitRing1,
        orbitRing2,
        portalBeam,
        portalDisc,
        flameTongues,
        waterfallFoams,
        banners,
        lightningBolts,
        lightningMat,
        lastBoltBucket: -1,
        phase: idx * 0.85,
      });

      // 11. Outer Ground Sovereignty Ring (Tier-colored when neutral -> Emerald when captured)
      const outerRing = new THREE.Mesh(mats.wardGeo, mats.ringMat);
      outerRing.rotation.x = -Math.PI / 2;
      outerRing.position.y = 0.22;
      outerRing.renderOrder = 4;
      outerRing.userData = { isWardRing: true };
      rootGroup.add(outerRing);

      // 12. Floating HUD Badge Sprite
      const sTitle = site.name.toUpperCase();
      const sSub = `[${Math.round(site.position[0])}, ${Math.round(site.position[2])}] · ${preset.subRegion}`;
      const badgeW = tierKey === 'shrine_a' ? 14.5 : tierKey === 'shrine_b' ? 13.2 : 12.0;
      const badgeH = tierKey === 'shrine_a' ? 4.6 : tierKey === 'shrine_b' ? 4.3 : 4.0;
      const badgeY = (crystalBaseY + 3.4) * preset.scale + 4.4;
      const badge = this.createFloatingBadgeSprite(
        sTitle,
        sSub,
        preset.starsText,
        preset.badgeBorder,
        preset.badgeAccent,
        badgeW,
        badgeH
      );
      badge.position.set(0, badgeY, 0);
      rootGroup.add(badge);

      this.buildingsGroup.add(rootGroup);
      // Keep crystalMeshes empty on shrines so captured shrines preserve Purple/Red/Blue crystals
      // while turning the ground ring & floating badge emerald green.
      this.buildingConquestRefs.set(site.id, {
        crystalMeshes: [],
        neutralCrystalMats: [],
        ringMesh: outerRing,
        neutralRingMat: mats.ringMat,
        badgeSprite: badge,
        group: rootGroup,
        badgeY,
        neutralBadge: {
          title: sTitle,
          subtitle: sSub,
          starsText: preset.starsText,
          borderColor: preset.badgeBorder,
          accentColor: preset.badgeAccent,
          scaleW: badgeW,
          scaleH: badgeH,
        },
      });

      registerEntity(rootGroup, {
        id: site.id,
        name: site.name,
        category: 'building',
        type: tierKey,
        subtype: tierKey,
        level: preset.level,
        position: site.position,
        radius: site.radius,
        health: preset.health,
        maxHealth: preset.health,
        tier: preset.tier,
        ownerFaction: 'neutral',
        buffLabel: preset.buffLabel,
        description: site.description,
        actions: ['attack', 'rally', 'scout', 'inspect'],
      });
    };

    RESERVED_PLOTS.filter((p) => p.type === 'shrine_a').forEach((site, idx) =>
      buildFloatingCrystalShrine(site, 'shrine_a', idx)
    );
    RESERVED_PLOTS.filter((p) => p.type === 'shrine_b').forEach((site, idx) =>
      buildFloatingCrystalShrine(site, 'shrine_b', idx + 10)
    );
    RESERVED_PLOTS.filter((p) => p.type === 'shrine_c').forEach((site, idx) =>
      buildFloatingCrystalShrine(site, 'shrine_c', idx + 30)
    );
    this.rebuildBuildingAnimCache();
  }

  private rebuildBuildingAnimCache() {
    this.animBuildingBanners = [];
    this.animBuildingDragonBanners = [];
    this.animBuildingPrayerFlags = [];
    this.animBuildingWardRings = [];
    this.animBuildingBlessingRings = [];
    this.animBuildingWardOrbs = [];
    const bGroups = this.buildingsGroup.children;
    for (let idx = 0; idx < bGroups.length; idx++) {
      const bChildren = bGroups[idx].children;
      for (let j = 0; j < bChildren.length; j++) {
        const child = bChildren[j];
        const ud = child.userData;
        if (!ud) continue;
        if (ud.isBanner) {
          this.animBuildingBanners.push({ obj: child, idx });
        } else if (ud.isDragonBanner) {
          this.animBuildingDragonBanners.push({ obj: child, phase: Number(ud.phase || 0) });
        } else if (ud.isPrayerFlag) {
          this.animBuildingPrayerFlags.push({ obj: child, idx });
        } else if (ud.isWardRing) {
          this.animBuildingWardRings.push(child);
        } else if (ud.isBlessingRing) {
          this.animBuildingBlessingRings.push(child);
        } else if (ud.isWardOrb) {
          this.animBuildingWardOrbs.push({
            obj: child,
            radius: Number(ud.orbitRadius || 7.5),
            speed: Number(ud.orbitSpeed || 1.6),
            phase: Number(ud.orbitPhase || 0),
          });
        }
      }
    }
  }

  /**
   * Draws 3D tactical leyline connectors representing the Continent 1 lattice
   * between Shrine C1–C20 -> Shrine B1–B12 -> Shrine A1–A4 -> The Congress
   */
  private initStrategicDistanceLines() {
    this.scene.add(this.strategicLinesGroup);

    const plotMap = new Map<string, [number, number, number]>();
    for (const p of RESERVED_PLOTS) {
      plotMap.set(p.id, p.position);
    }

    const goldLineMat = new THREE.LineBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.55,
    });
    const cyanLineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.55,
    });

    for (const link of STRATEGIC_DISTANCE_LINKS) {
      const fromPos = plotMap.get(link.fromId);
      const toPos = plotMap.get(link.toId);
      if (!fromPos || !toPos) continue;

      const pts: THREE.Vector3[] = [];
      const steps = 16;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = THREE.MathUtils.lerp(fromPos[0], toPos[0], t);
        const z = THREE.MathUtils.lerp(fromPos[2], toPos[2], t);
        const y = this.terrainGenerator.getHeightAt(x, z) + 0.65;
        pts.push(new THREE.Vector3(x, y, z));
      }

      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, link.color === 'gold' ? goldLineMat : cyanLineMat);
      this.strategicLinesGroup.add(line);
    }
  }

  private ensureRealisticMaterials() {
    if (this.sharedMats) return this.sharedMats;

    const stoneTex = createStoneBrickTexture();
    const woodTex = createWoodPlankTexture();
    const roofTex = createRoofTileTexture();
    const graniteTex = createGraniteQuarryTexture();
    const barkTex = createTimberBarkTexture();
    const logEndTex = createLogEndGrainTexture();
    const soilTex = createFarmlandSoilTexture();
    const wheatTex = createWheatCropTexture();
    const goldRockTex = createGoldOreRockTexture();
    const plasterTex = createCastlePlasterTexture();
    const dragonBannerTex = createDragonBannerTexture();

    const maxAniso = this.renderer ? Math.min(8, this.renderer.capabilities.getMaxAnisotropy()) : 4;
    for (const tex of [
      stoneTex,
      woodTex,
      roofTex,
      graniteTex,
      barkTex,
      logEndTex,
      soilTex,
      wheatTex,
      goldRockTex,
      plasterTex,
      dragonBannerTex,
    ]) {
      tex.anisotropy = maxAniso;
    }

    this.sharedMats = {
      castleStone: new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0xd6d3cd,
        roughness: 0.86,
        metalness: 0.05,
      }),
      castleDarkStone: new THREE.MeshStandardMaterial({
        map: graniteTex,
        color: 0x646b73,
        roughness: 0.9,
        metalness: 0.06,
      }),
      castlePlaster: new THREE.MeshStandardMaterial({
        map: plasterTex,
        color: 0xf1ece1,
        roughness: 0.82,
        metalness: 0.02,
      }),
      castleTimber: new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0x8b5a2b,
        roughness: 0.78,
        metalness: 0.04,
      }),
      myCastleRoof: new THREE.MeshStandardMaterial({
        map: roofTex,
        color: 0xb43b2a,
        roughness: 0.62,
        metalness: 0.12,
      }),
      allianceRoof: new THREE.MeshStandardMaterial({
        map: roofTex,
        color: 0x3b6ea5,
        roughness: 0.58,
        metalness: 0.16,
      }),
      enemyRoof: new THREE.MeshStandardMaterial({
        map: roofTex,
        color: 0x991b1b,
        roughness: 0.56,
        metalness: 0.2,
      }),
      wroughtIron: new THREE.MeshStandardMaterial({
        color: 0x2a3038,
        roughness: 0.42,
        metalness: 0.86,
      }),
      agedBrass: new THREE.MeshStandardMaterial({
        color: 0xd4a438,
        roughness: 0.28,
        metalness: 0.88,
      }),
      warmWindow: new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.95,
        roughness: 0.35,
      }),
      flameEmber: new THREE.MeshStandardMaterial({
        color: 0xff922b,
        emissive: 0xff5400,
        emissiveIntensity: 2.8,
        roughness: 0.4,
      }),
      darkCavern: new THREE.MeshStandardMaterial({
        color: 0x090b10,
        roughness: 0.98,
        metalness: 0.0,
      }),
      dragonBanner: new THREE.MeshStandardMaterial({
        map: dragonBannerTex,
        side: THREE.DoubleSide,
        roughness: 0.65,
      }),
      allianceBanner: new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        side: THREE.DoubleSide,
        roughness: 0.65,
      }),
      enemyBanner: new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        emissive: 0x7f1d1d,
        emissiveIntensity: 0.5,
        side: THREE.DoubleSide,
        roughness: 0.62,
      }),
      graniteRock: new THREE.MeshStandardMaterial({
        map: graniteTex,
        color: 0x9ca3af,
        roughness: 0.9,
        metalness: 0.05,
      }),
      cutStoneBlock: new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0xcbd5e1,
        roughness: 0.82,
        metalness: 0.05,
      }),
      timberBark: new THREE.MeshStandardMaterial({
        map: barkTex,
        roughness: 0.92,
        metalness: 0.02,
      }),
      logEndGrain: new THREE.MeshStandardMaterial({
        map: logEndTex,
        roughness: 0.84,
        metalness: 0.02,
      }),
      sawSteel: new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        roughness: 0.22,
        metalness: 0.94,
      }),
      pineFoliageDark: new THREE.MeshStandardMaterial({
        color: 0x1f4729,
        roughness: 0.88,
        metalness: 0.02,
      }),
      pineFoliageMid: new THREE.MeshStandardMaterial({
        color: 0x2c5e34,
        roughness: 0.86,
        metalness: 0.02,
      }),
      farmlandSoil: new THREE.MeshStandardMaterial({
        map: soilTex,
        roughness: 0.95,
        metalness: 0.02,
      }),
      wheatCrop: new THREE.MeshStandardMaterial({
        map: wheatTex,
        roughness: 0.88,
        metalness: 0.02,
      }),
      hayStraw: new THREE.MeshStandardMaterial({
        color: 0xd4a742,
        roughness: 0.92,
        metalness: 0.02,
      }),
      farmWater: new THREE.MeshStandardMaterial({
        color: 0x0e7490,
        roughness: 0.12,
        metalness: 0.35,
        transparent: true,
        opacity: 0.86,
      }),
      sailCanvas: new THREE.MeshStandardMaterial({
        color: 0xf1ead8,
        roughness: 0.85,
        side: THREE.DoubleSide,
      }),
      goldOreRock: new THREE.MeshStandardMaterial({
        map: goldRockTex,
        roughness: 0.82,
        metalness: 0.18,
      }),
      pureGold: new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        metalness: 0.95,
        roughness: 0.16,
        emissive: 0x854d0e,
        emissiveIntensity: 0.35,
      }),
      ironOreMat: new THREE.MeshStandardMaterial({
        color: 0x525d6d,
        metalness: 0.78,
        roughness: 0.42,
      }),
      burlapSack: new THREE.MeshStandardMaterial({
        color: 0xa18864,
        roughness: 0.94,
        metalness: 0.02,
      }),
      crystalOreMat: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 1.45,
        roughness: 0.14,
        metalness: 0.25,
        transparent: true,
        opacity: 0.92,
      }),
      crystalCoreMat: new THREE.MeshStandardMaterial({
        color: 0xa5f3fc,
        emissive: 0x22d3ee,
        emissiveIntensity: 2.1,
        roughness: 0.08,
        metalness: 0.3,
      }),
    };

    return this.sharedMats;
  }

  /**
   * Spawns User's "My Castle" and 10 Alliance Member Castles at random non-overlapping locations
   */
  private initRandomCastles() {
    this.scene.add(this.castlesGroup);
    this.populateCastles(false);
  }

  public relocateCastles(focusMyCastle = true): CastleSpawnData[] {
    if (!this.worldMapBuilt) {
      this.ensureWorldMapBuilt();
      if (!focusMyCastle) return this.castlesList;
    }
    return this.populateCastles(focusMyCastle);
  }

  private populateCastles(focusMyCastle = true): CastleSpawnData[] {
    // 1. Clean up old castle meshes, entities, and pickables
    for (const oldPick of this.castlePickables) {
      const idx = this.pickableObjects.indexOf(oldPick);
      if (idx !== -1) this.pickableObjects.splice(idx, 1);
    }
    this.castlePickables = [];

    for (const c of this.castlesList) {
      this.entitiesMap.delete(c.id);
      this.buildingMeshesMap.delete(c.id);
      this.castleBadgeRefs.delete(c.id);
      this.castleBurningMap.delete(c.id);
    }
    this.castleShadowEntries.length = 0;

    while (this.castlesGroup.children.length > 0) {
      const child = this.castlesGroup.children[0];
      this.castlesGroup.remove(child);
    }

    // 2. Generate new non-overlapping random coordinates for My Castle + 10 Alliance Castles + 6 Enemy Castles
    this.castlesList = generateRandomCastles(
      (x, z) => this.terrainGenerator.getHeightAt(x, z),
      this.playerAlliance
    );

    const mats = this.ensureRealisticMaterials();

    const addPart = (
      parent: THREE.Object3D,
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x = 0,
      y = 0,
      z = 0
    ) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    for (const castle of this.castlesList) {
      const cGroup = new THREE.Group();
      const groundY = this.terrainGenerator.getHeightAt(castle.position[0], castle.position[2]);
      castle.position[1] = groundY;
      cGroup.position.set(castle.position[0], groundY, castle.position[2]);

      const isMine = castle.isMyCastle;
      const isEnemy = castle.faction === 'enemy';
      const s = isMine ? 1.18 : isEnemy ? 1.0 : 0.92;
      const roofMat = isMine ? mats.myCastleRoof : isEnemy ? mats.enemyRoof : mats.allianceRoof;
      const bannerMat = isMine ? mats.dragonBanner : isEnemy ? mats.enemyBanner : mats.allianceBanner;

      // Ground contact shadow conformed to castle terrain slope
      const castleShadow = createTerrainConformedContactShadow({
        width: 31 * s,
        depth: 31 * s,
        worldX: castle.position[0],
        worldZ: castle.position[2],
        baseGroundY: groundY,
        yOffset: 0.07,
        getHeightAt: (x, z) => this.terrainGenerator.getHeightAt(x, z),
        material: this.worldOctagonalShadowMat,
        shiftAmount: 1.65 * s,
        renderOrder: 2,
      });
      cGroup.add(castleShadow.mesh);
      this.castleShadowEntries.push(castleShadow.entry);

      // 1. Terrain-flush stepped stone foundation plinth + courtyard cobble deck
      addPart(cGroup, new THREE.CylinderGeometry(12.2 * s, 13.8 * s, 2.2 * s, 8), mats.castleDarkStone, 0, 0.1 * s, 0);
      addPart(cGroup, new THREE.BoxGeometry(17.2 * s, 1.3 * s, 17.2 * s), mats.castleStone, 0, 0.8 * s, 0);

      // South entrance stone steps + bridge approach apron
      addPart(cGroup, new THREE.BoxGeometry(5.6 * s, 0.9 * s, 3.2 * s), mats.castleDarkStone, 0, 0.45 * s, 9.8 * s);
      addPart(cGroup, new THREE.BoxGeometry(4.4 * s, 0.45 * s, 2.4 * s), mats.castleStone, 0, 0.22 * s, 11.6 * s);

      // 2. Perimeter Stone Curtain Walls + Timber Hoarding + Individual Crenellation Merlons
      const wallH = 3.8 * s;
      const wallThick = 1.45 * s;
      const wallSpan = 14.8 * s;
      const halfSpan = 7.4 * s;

      // North, West, East full curtain walls
      addPart(cGroup, new THREE.BoxGeometry(wallSpan, wallH, wallThick), mats.castleStone, 0, 1.45 * s + wallH / 2, -halfSpan);
      addPart(cGroup, new THREE.BoxGeometry(wallThick, wallH, wallSpan), mats.castleStone, -halfSpan, 1.45 * s + wallH / 2, 0);
      addPart(cGroup, new THREE.BoxGeometry(wallThick, wallH, wallSpan), mats.castleStone, halfSpan, 1.45 * s + wallH / 2, 0);
      // South curtain wall split left & right of Gatehouse
      addPart(cGroup, new THREE.BoxGeometry(4.6 * s, wallH, wallThick), mats.castleStone, -5.1 * s, 1.45 * s + wallH / 2, halfSpan);
      addPart(cGroup, new THREE.BoxGeometry(4.6 * s, wallH, wallThick), mats.castleStone, 5.1 * s, 1.45 * s + wallH / 2, halfSpan);

      // Timber parapet walkway ledges inside walls
      addPart(cGroup, new THREE.BoxGeometry(13.6 * s, 0.28 * s, 1.1 * s), mats.castleTimber, 0, 4.9 * s, -6.4 * s);
      addPart(cGroup, new THREE.BoxGeometry(1.1 * s, 0.28 * s, 13.6 * s), mats.castleTimber, -6.4 * s, 4.9 * s, 0);
      addPart(cGroup, new THREE.BoxGeometry(1.1 * s, 0.28 * s, 13.6 * s), mats.castleTimber, 6.4 * s, 4.9 * s, 0);

      // Stone merlons (battlement teeth) along curtain wall tops
      for (let m = -5.2; m <= 5.2; m += 2.6) {
        addPart(cGroup, new THREE.BoxGeometry(1.1 * s, 0.9 * s, 0.85 * s), mats.castleDarkStone, m * s, 5.65 * s, -halfSpan);
        addPart(cGroup, new THREE.BoxGeometry(0.85 * s, 0.9 * s, 1.1 * s), mats.castleDarkStone, -halfSpan, 5.65 * s, m * s);
        addPart(cGroup, new THREE.BoxGeometry(0.85 * s, 0.9 * s, 1.1 * s), mats.castleDarkStone, halfSpan, 5.65 * s, m * s);
      }

      // 3. Grand Twin-Tower South Gatehouse + Recessed Archway + Iron Portcullis + Oak Drawbridge
      addPart(cGroup, new THREE.CylinderGeometry(1.45 * s, 1.65 * s, 6.8 * s, 8), mats.castleStone, -2.55 * s, 3.8 * s, 8.0 * s);
      addPart(cGroup, new THREE.CylinderGeometry(1.45 * s, 1.65 * s, 6.8 * s, 8), mats.castleStone, 2.55 * s, 3.8 * s, 8.0 * s);
      addPart(cGroup, new THREE.ConeGeometry(1.9 * s, 2.5 * s, 8), roofMat, -2.55 * s, 8.3 * s, 8.0 * s);
      addPart(cGroup, new THREE.ConeGeometry(1.9 * s, 2.5 * s, 8), roofMat, 2.55 * s, 8.3 * s, 8.0 * s);
      // Gatehouse bridge span & upper watch gallery
      addPart(cGroup, new THREE.BoxGeometry(4.2 * s, 2.2 * s, 2.2 * s), mats.castlePlaster, 0, 5.5 * s, 7.9 * s);
      addPart(cGroup, new THREE.BoxGeometry(4.8 * s, 0.7 * s, 2.8 * s), roofMat, 0, 6.95 * s, 7.9 * s);
      // Dark recessed gateway portal & iron portcullis grille bars
      addPart(cGroup, new THREE.BoxGeometry(2.8 * s, 3.1 * s, 1.4 * s), mats.darkCavern, 0, 2.75 * s, 7.6 * s);
      for (let bar = -1.0; bar <= 1.0; bar += 0.5) {
        addPart(cGroup, new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 2.9 * s, 5), mats.wroughtIron, bar * s, 2.75 * s, 8.35 * s);
      }
      addPart(cGroup, new THREE.BoxGeometry(2.6 * s, 0.1 * s, 0.1 * s), mats.wroughtIron, 0, 2.2 * s, 8.35 * s);
      addPart(cGroup, new THREE.BoxGeometry(2.6 * s, 0.1 * s, 0.1 * s), mats.wroughtIron, 0, 3.2 * s, 8.35 * s);
      // Lowered oak drawbridge planks over front stone approach
      addPart(cGroup, new THREE.BoxGeometry(3.2 * s, 0.24 * s, 3.6 * s), mats.castleTimber, 0, 1.05 * s, 9.8 * s);
      // Twin wrought-iron gatehouse fire braziers
      for (const bx of [-3.9 * s, 3.9 * s]) {
        addPart(cGroup, new THREE.CylinderGeometry(0.35 * s, 0.45 * s, 1.2 * s, 6), mats.castleDarkStone, bx, 1.4 * s, 9.6 * s);
        addPart(cGroup, new THREE.CylinderGeometry(0.45 * s, 0.25 * s, 0.35 * s, 8), mats.wroughtIron, bx, 2.1 * s, 9.6 * s);
        const flame = addPart(cGroup, new THREE.ConeGeometry(0.28 * s, 0.75 * s, 6), mats.flameEmber, bx, 2.55 * s, 9.6 * s);
        flame.castShadow = false;
        flame.userData = { isBrazierFlame: true, phase: bx };
      }

      // 4. Four Corner Bastion Watchtowers with Corbelled Stone & Pitched Terracotta/Slate Roofs
      for (const [tx, tz] of [
        [-7.6 * s, -7.6 * s],
        [7.6 * s, -7.6 * s],
        [-7.6 * s, 7.6 * s],
        [7.6 * s, 7.6 * s],
      ]) {
        addPart(cGroup, new THREE.CylinderGeometry(2.05 * s, 2.4 * s, 8.2 * s, 10), mats.castleStone, tx, 4.6 * s, tz);
        addPart(cGroup, new THREE.CylinderGeometry(2.4 * s, 2.1 * s, 0.85 * s, 10), mats.castleDarkStone, tx, 8.9 * s, tz);
        addPart(cGroup, new THREE.CylinderGeometry(2.25 * s, 2.25 * s, 0.45 * s, 10), mats.castleTimber, tx, 9.5 * s, tz);
        addPart(cGroup, new THREE.ConeGeometry(2.7 * s, 3.3 * s, 10), roofMat, tx, 11.3 * s, tz);
        addPart(cGroup, new THREE.CylinderGeometry(0.08 * s, 0.14 * s, 1.1 * s, 6), mats.agedBrass, tx, 13.2 * s, tz);
      }

      // 5. Courtyard Support Buildings (Forge/Smithy Chimney + Timber Supply Stables + Stone Well)
      if (isMine) {
        // Courtyard Smithy Forge with glowing furnace & stone chimney
        addPart(cGroup, new THREE.BoxGeometry(3.2 * s, 2.4 * s, 2.6 * s), mats.castleDarkStone, -4.4 * s, 2.5 * s, 2.8 * s);
        const smithyRoof = addPart(cGroup, new THREE.ConeGeometry(2.5 * s, 1.5 * s, 4), roofMat, -4.4 * s, 4.4 * s, 2.8 * s);
        smithyRoof.rotation.y = Math.PI / 4;
        addPart(cGroup, new THREE.BoxGeometry(0.75 * s, 3.8 * s, 0.75 * s), mats.castleDarkStone, -5.4 * s, 3.6 * s, 2.4 * s);

        // Courtyard Granary & Timber Stables
        addPart(cGroup, new THREE.BoxGeometry(3.4 * s, 2.2 * s, 2.8 * s), mats.castleTimber, 4.5 * s, 2.4 * s, 2.6 * s);
        const stableRoof = addPart(cGroup, new THREE.ConeGeometry(2.6 * s, 1.6 * s, 4), roofMat, 4.5 * s, 4.2 * s, 2.6 * s);
        stableRoof.rotation.y = Math.PI / 4;

        // Courtyard Water Well
        addPart(cGroup, new THREE.CylinderGeometry(0.85 * s, 0.95 * s, 0.75 * s, 10), mats.castleDarkStone, 4.0 * s, 1.75 * s, -3.5 * s);
        addPart(cGroup, new THREE.CylinderGeometry(0.08 * s, 0.08 * s, 1.6 * s, 6), mats.castleTimber, 3.3 * s, 2.4 * s, -3.5 * s);
        addPart(cGroup, new THREE.CylinderGeometry(0.08 * s, 0.08 * s, 1.6 * s, 6), mats.castleTimber, 4.7 * s, 2.4 * s, -3.5 * s);
        addPart(cGroup, new THREE.BoxGeometry(1.8 * s, 0.35 * s, 1.2 * s), roofMat, 4.0 * s, 3.3 * s, -3.5 * s);
      }

      // 6. Grand Multi-Story Central Royal Citadel Keep (Stone Lower Keep + Half-Timbered Upper Keep + Tiered Roofs)
      addPart(cGroup, new THREE.BoxGeometry(8.2 * s, 6.2 * s, 7.6 * s), mats.castleStone, 0, 4.5 * s, -1.0 * s);
      // Four stone corner buttress pilasters on the Keep
      for (const [px, pz] of [
        [-4.1 * s, -4.8 * s],
        [4.1 * s, -4.8 * s],
        [-4.1 * s, 2.8 * s],
        [4.1 * s, 2.8 * s],
      ]) {
        addPart(cGroup, new THREE.BoxGeometry(1.1 * s, 6.6 * s, 1.1 * s), mats.castleDarkStone, px, 4.7 * s, pz);
      }
      // Mid-tier timber & plaster overhang gallery
      addPart(cGroup, new THREE.BoxGeometry(8.8 * s, 0.65 * s, 8.2 * s), mats.castleTimber, 0, 7.8 * s, -1.0 * s);
      addPart(cGroup, new THREE.BoxGeometry(7.2 * s, 3.6 * s, 6.6 * s), mats.castlePlaster, 0, 9.8 * s, -1.0 * s);

      // Warm lit mullioned windows on the upper Royal Keep
      for (const wx of [-1.8 * s, 0, 1.8 * s]) {
        addPart(cGroup, new THREE.BoxGeometry(0.65 * s, 1.15 * s, 0.25 * s), mats.warmWindow, wx, 9.9 * s, 2.32 * s);
        addPart(cGroup, new THREE.BoxGeometry(0.65 * s, 1.15 * s, 0.25 * s), mats.warmWindow, wx, 9.9 * s, -4.32 * s);
      }
      for (const wz of [-2.4 * s, 0.4 * s]) {
        addPart(cGroup, new THREE.BoxGeometry(0.25 * s, 1.15 * s, 0.65 * s), mats.warmWindow, -3.62 * s, 9.9 * s, wz);
        addPart(cGroup, new THREE.BoxGeometry(0.25 * s, 1.15 * s, 0.65 * s), mats.warmWindow, 3.62 * s, 9.9 * s, wz);
      }

      // Lower Keep roof eaves skirt + Main Pitched Citadel Keep Roof + Royal Turret Spire
      const keepEaveRoof = addPart(cGroup, new THREE.ConeGeometry(7.3 * s, 2.6 * s, 4), roofMat, 0, 12.6 * s, -1.0 * s);
      keepEaveRoof.rotation.y = Math.PI / 4;
      addPart(cGroup, new THREE.BoxGeometry(3.8 * s, 2.4 * s, 3.8 * s), mats.castlePlaster, 0, 14.1 * s, -1.0 * s);
      const upperPeakRoof = addPart(cGroup, new THREE.ConeGeometry(3.5 * s, 3.2 * s, 4), roofMat, 0, 16.7 * s, -1.0 * s);
      upperPeakRoof.rotation.y = Math.PI / 4;
      // Gilded Bronze Royal Spire Finial
      addPart(cGroup, new THREE.CylinderGeometry(0.1 * s, 0.22 * s, 2.0 * s, 8), mats.agedBrass, 0, 18.8 * s, -1.0 * s);
      addPart(cGroup, new THREE.OctahedronGeometry(0.45 * s, 0), mats.agedBrass, 0, 19.9 * s, -1.0 * s);

      // 7. Fluttering Imperial Dragon Banners (My Castle) or Alliance Standards
      for (const [bx, ph] of [
        [-3.4 * s, 0],
        [3.4 * s, 1.8],
      ]) {
        addPart(cGroup, new THREE.CylinderGeometry(0.06 * s, 0.07 * s, 4.4 * s, 6), mats.agedBrass, bx, 10.6 * s, 6.9 * s);
        const flagMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.25 * s, 2.3 * s), bannerMat);
        flagMesh.position.set(bx, 11.4 * s, 7.6 * s);
        flagMesh.castShadow = true;
        flagMesh.userData = { isDragonBanner: true, phase: ph };
        cGroup.add(flagMesh);
      }

      // Ground Aura Ring (Emerald for My Castle, Crimson for Enemy Citadel, Royal Blue for Alliance Castle)
      const ringMat = new THREE.MeshBasicMaterial({
        color: isMine ? 0x10b981 : isEnemy ? 0xef4444 : 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isEnemy ? 0.85 : 0.78,
      });
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(12.8 * s, 14.1 * s, 32),
        ringMat
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.25;
      ring.renderOrder = 4;
      cGroup.add(ring);

      // Floating 3D Identification Badge (displays 4-char Tag + 4-word Alliance Alias)
      const badge = this.createFloatingBadgeSprite(
        isMine
          ? '🏰 MY CASTLE (LORD DANGOL)'
          : isEnemy
            ? `⚔️ ${castle.name.toUpperCase()}`
            : `🛡️ ${castle.owner.toUpperCase()}`,
        `${castle.allianceTag} ${castle.allianceAlias || ''} · Lv.${castle.level}`,
        isMine ? '👑 MY CASTLE 👑' : isEnemy ? '☠️ ENEMY CITADEL · ATTACK' : `⚔️ [${castle.position[0]}, ${castle.position[2]}] ALLIANCE`,
        isMine ? '#10b981' : isEnemy ? '#ef4444' : '#38bdf8',
        isMine ? '#fde047' : isEnemy ? '#fca5a5' : '#93c5fd',
        isMine ? 17.5 : isEnemy ? 15.5 : 14.5,
        isMine ? 5.2 : 4.4
      );
      badge.position.set(0, 22.8 * s, 0);
      cGroup.add(badge);
      this.castleBadgeRefs.set(castle.id, {
        castle,
        group: cGroup,
        badgeSprite: badge,
        badgeY: 22.8 * s,
      });

      // Update Army Home Position when placing My Castle
      if (isMine) {
        const gateZ = castle.position[2] + 13;
        const gateY = this.terrainGenerator.getHeightAt(castle.position[0], gateZ);
        this.armyHomePos.set(castle.position[0], gateY, gateZ);
        if (this.armyState === 'IDLE') {
          this.armyPos.copy(this.armyHomePos);
          this.armyGroup.position.copy(this.armyHomePos);
        }
      }

      // Reusable Burning Citadel Flame Cones for Enemy Castles (zero shader recompilation at runtime)
      if (isEnemy) {
        const flamesGroup = new THREE.Group();
        flamesGroup.visible = false;
        const flameCoords: Array<[number, number, number, number, number]> = [
          [0, 12.2 * s, -1.0 * s, 2.2 * s, 4.8 * s],
          [-2.9 * s, 9.6 * s, 1.4 * s, 1.45 * s, 3.4 * s],
          [3.1 * s, 9.6 * s, -2.4 * s, 1.45 * s, 3.4 * s],
          [-2.55 * s, 7.6 * s, 8.0 * s, 1.15 * s, 2.9 * s],
          [2.55 * s, 7.6 * s, 8.0 * s, 1.15 * s, 2.9 * s],
          [0, 5.8 * s, 7.8 * s, 1.25 * s, 2.7 * s],
        ];
        flameCoords.forEach(([fx, fy, fz, radius, height], fIdx) => {
          const cone = new THREE.Mesh(
            new THREE.ConeGeometry(radius, height, 6),
            mats.flameEmber
          );
          cone.position.set(fx, fy, fz);
          cone.userData = {
            isCastleFireCone: true,
            baseY: fy,
            baseScale: 1,
            phase: fIdx * 1.37,
          };
          flamesGroup.add(cone);
        });
        cGroup.add(flamesGroup);
        this.castleBurningMap.set(castle.id, {
          group: cGroup,
          flamesGroup,
          isBurning: false,
          intensity: 1.0,
          smokeTimer: 0,
        });
      }

      const enemyMaxHp = isEnemy ? getEnemyCastleMaxHp(castle.power, castle.level) : isMine ? 10000 : 7500;
      const entity: WorldEntity = {
        id: castle.id,
        name: castle.name,
        category: 'building',
        type: isMine ? 'my_castle' : isEnemy ? 'enemy_castle' : 'alliance_castle',
        subtype: isMine ? 'my_castle' : isEnemy ? 'enemy_castle' : 'alliance_castle',
        faction: castle.faction || (isMine ? 'my' : 'alliance'),
        ownerFaction: isEnemy ? 'enemy' : 'alliance',
        level: castle.level,
        position: castle.position,
        radius: castle.radius,
        health: enemyMaxHp,
        maxHealth: enemyMaxHp,
        power: castle.power,
        tier: 3,
        description: castle.description,
        actions: isMine
          ? ['garrison', 'upgrade', 'inspect']
          : isEnemy
            ? ['attack', 'rally', 'scout']
            : ['garrison', 'scout', 'inspect'],
      };

      cGroup.userData = { gameEntity: entity };
      this.entitiesMap.set(entity.id, entity);
      this.buildingMeshesMap.set(entity.id, cGroup);

      const hitCollider = new THREE.Mesh(
        new THREE.CylinderGeometry(entity.radius, entity.radius, 20, 8),
        new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 })
      );
      hitCollider.position.y = 10;
      hitCollider.userData = { gameEntity: entity };
      cGroup.add(hitCollider);

      this.pickableObjects.push(hitCollider);
      this.castlePickables.push(hitCollider);
      this.castlesGroup.add(cGroup);
    }

    // 3. Ensure 4 realistic starter resources (Stone Quarry, Farm Food, Wooden Lumber, Gold Mine) flank My Castle cleanly
    const myCastle = this.castlesList.find((c) => c.isMyCastle);
    if (myCastle) {
      this.spawnStarterResourcesAroundMyCastle(myCastle);
    }
    this.rebuildCastleAnimCache();

    this.rebuildDebugCollisionBoxes();
    this.onCastlesUpdated?.(this.castlesList);

    if (focusMyCastle && this.cameraController && myCastle) {
      this.cameraController.setHomeCoordinates(myCastle.position[0], myCastle.position[2], false);
      this.cameraController.panTo(myCastle.position[0], myCastle.position[2]);
    }

    return this.castlesList;
  }

  private rebuildCastleAnimCache() {
    this.animCastleDragonBanners = [];
    this.animCastleBrazierFlames = [];
    const castleGroups = this.castlesGroup.children;
    for (let idx = 0; idx < castleGroups.length; idx++) {
      const cChildren = castleGroups[idx].children;
      for (let j = 0; j < cChildren.length; j++) {
        const child = cChildren[j];
        const ud = child.userData;
        if (!ud) continue;
        if (ud.isDragonBanner) {
          this.animCastleDragonBanners.push({ obj: child, phase: Number(ud.phase || 0) });
        } else if (ud.isBrazierFlame) {
          this.animCastleBrazierFlames.push({ obj: child, phase: Number(ud.phase || 0) });
        }
      }
    }
  }

  private spawnStarterResourcesAroundMyCastle(myCastle: CastleSpawnData) {
    // Clean up any previous dynamic starter resources around My Castle
    for (const oldPick of this.starterResourcePickables) {
      const idx = this.pickableObjects.indexOf(oldPick);
      if (idx !== -1) this.pickableObjects.splice(idx, 1);
    }
    this.starterResourcePickables = [];

    for (const grp of this.starterResourceGroups) {
      this.resourcesGroup.remove(grp);
    }
    this.starterResourceGroups = [];

    for (const id of this.starterResourceIds) {
      this.entitiesMap.delete(id);
      this.resourceMeshesMap.delete(id);
    }
    this.starterResourceIds = [];

    const specs: Array<{
      id: string;
      name: string;
      subtype: 'stone' | 'farm' | 'wood' | 'gold';
      resourceType: 'stone' | 'food' | 'wood' | 'gold';
      yieldAmount: number;
      dx: number;
      dz: number;
      description: string;
    }> = [
      {
        id: 'starter_stone_quarry',
        name: 'Royal Granite Stone Quarry',
        subtype: 'stone',
        resourceType: 'stone',
        yieldAmount: 1200,
        dx: -32,
        dz: -24,
        description: 'Terraced granite quarry with heavy timber jib crane and cut masonry blocks right outside My Castle.',
      },
      {
        id: 'starter_farm_food',
        name: 'Imperial Terraced Farmstead',
        subtype: 'farm',
        resourceType: 'food',
        yieldAmount: 1200,
        dx: 32,
        dz: 22,
        description: 'Irrigated golden wheat terraces, granary barn, and waterwheel nourishing My Castle garrison.',
      },
      {
        id: 'starter_wooden_lumber',
        name: 'Cedar Sawmill & Lumber Camp',
        subtype: 'wood',
        resourceType: 'wood',
        yieldAmount: 1200,
        dx: -32,
        dz: 22,
        description: 'Active Himalayan cedar sawmill with stacked timber logs, circular saw bench, and log wagon.',
      },
      {
        id: 'starter_gold_mine',
        name: 'Crown Aurum Gold Mine',
        subtype: 'gold',
        resourceType: 'gold',
        yieldAmount: 1800,
        dx: 32,
        dz: -24,
        description: 'Timber-shored mountain gold shaft with iron ore rails, loaded minecart, and gleaming aurum veins.',
      },
    ];

    for (const sp of specs) {
      let wx = Math.round(myCastle.position[0] + sp.dx);
      let wz = Math.round(myCastle.position[2] + sp.dz);
      // Avoid intersecting nearby reserved towers/citadel or other castles if spawn angle is tight
      for (let shift = 0; shift < 4; shift++) {
        const overlapsCastle = this.castlesList.some(
          (c) => Math.hypot(wx - c.position[0], wz - c.position[2]) < (c.isMyCastle ? 22 : 20)
        );
        const overlapsPlot = RESERVED_PLOTS.some(
          (p) => Math.hypot(wx - p.position[0], wz - p.position[2]) < p.radius + 10
        );
        if (!overlapsCastle && !overlapsPlot) break;
        wx += sp.dx > 0 ? 6 : -6;
        wz += sp.dz > 0 ? 6 : -6;
      }
      wx = Math.max(80, Math.min(3120, wx));
      wz = Math.max(80, Math.min(3120, wz));

      const groundY = this.terrainGenerator.getHeightAt(wx, wz);
      const entity: WorldEntity = {
        id: sp.id,
        name: sp.name,
        category: 'resource',
        type: 'resource',
        subtype: sp.subtype,
        level: 3,
        position: [wx, groundY, wz],
        radius: 5.5,
        yieldAmount: sp.yieldAmount,
        resourceType: sp.resourceType,
        description: sp.description,
        actions: ['mine', 'scout'],
      };

      const rGroup = this.buildRealisticResourceGroup(entity);
      rGroup.userData = { gameEntity: entity };
      this.entitiesMap.set(entity.id, entity);
      this.resourceMeshesMap.set(entity.id, rGroup);

      const hitCollider = new THREE.Mesh(
        new THREE.CylinderGeometry(entity.radius, entity.radius, 9, 8),
        new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 })
      );
      hitCollider.position.y = 4.5;
      hitCollider.userData = { gameEntity: entity };
      rGroup.add(hitCollider);

      rGroup.add(this.createResourceBelowTag(entity));

      this.pickableObjects.push(hitCollider);
      this.starterResourcePickables.push(hitCollider);
      this.starterResourceGroups.push(rGroup);
      this.starterResourceIds.push(entity.id);
      this.resourcesGroup.add(rGroup);
    }
    this.rebuildResourceAnimCache();
  }

  private createResourceBelowTag(entity: WorldEntity): THREE.Sprite {
    const sub = (entity.resourceType || entity.subtype || 'wood').toLowerCase();
    const lvl = entity.level ?? 1;
    const yieldVal = entity.yieldAmount ?? 0;
    const yieldText =
      yieldVal >= 1000
        ? `${(yieldVal / 1000).toFixed(yieldVal % 1000 === 0 ? 0 : 1)}K YIELD`
        : `${yieldVal} YIELD`;

    let borderCol = '#22c55e';
    let accentCol = '#86efac';
    let headerLabel = '🌲 TIMBER CAMP';
    if (sub === 'crystal') {
      borderCol = '#38bdf8';
      accentCol = '#bae6fd';
      headerLabel = '💎 CRYSTAL VEIN';
    } else if (sub === 'gold') {
      borderCol = '#facc15';
      accentCol = '#fef08a';
      headerLabel = '🪙 GOLD MINE';
    } else if (sub === 'iron') {
      borderCol = '#94a3b8';
      accentCol = '#e2e8f0';
      headerLabel = '⚒️ IRON QUARRY';
    } else if (sub === 'stone') {
      borderCol = '#a8a29e';
      accentCol = '#e7e5e4';
      headerLabel = '🪨 STONE QUARRY';
    } else if (sub === 'farm' || sub === 'food') {
      borderCol = '#84cc16';
      accentCol = '#d9f99d';
      headerLabel = '🌾 WHEAT FARM';
    }

    const badge = this.createFloatingBadgeSprite(
      entity.name.toUpperCase(),
      `LV.${lvl} · ${yieldText}`,
      headerLabel,
      borderCol,
      accentCol,
      10.2,
      3.1
    );
    const dist = 5.8;
    badge.center.set(0.5, 0);
    badge.position.set(0, 0.25, dist);
    badge.renderOrder = 15;
    badge.userData = { belowTagDist: dist, belowTagY: 0.25 };
    return badge;
  }

  // ============================================================
  // 2. MONSTERS (Uploaded Cutout Sprites + Elemental Aura Rings)
  // ============================================================
  private initMonsters() {
    this.scene.add(this.monstersGroup);
    prewarmMonsterCutouts();

    // Shared soft radial contact & directional cast shadow materials across all monsters
    const contactShadowMat = createContactShadowMaterial('radial', 0.72);
    const directionalShadowMat = createContactShadowMaterial('radial', 0.42);
    this.monsterContactShadowMat = contactShadowMat;
    this.monsterDirectionalShadowMat = directionalShadowMat;

    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const spriteMatCache = new Map<
      MonsterArchetypeKey,
      {
        matWest: THREE.SpriteMaterial;
        matEast: THREE.SpriteMaterial;
        aspect: number;
        sprites: Array<{ sprite: THREE.Sprite; height: number }>;
      }
    >();

    const getArchetypeSpriteEntry = (key: MonsterArchetypeKey, defaultAspect: number) => {
      const existing = spriteMatCache.get(key);
      if (existing) return existing;

      const entry = {
        matWest: new THREE.SpriteMaterial({
          transparent: true,
          alphaTest: 0.05,
          depthWrite: true,
          side: THREE.DoubleSide,
          visible: false,
        }),
        matEast: new THREE.SpriteMaterial({
          transparent: true,
          alphaTest: 0.05,
          depthWrite: true,
          side: THREE.DoubleSide,
          visible: false,
        }),
        aspect: defaultAspect,
        sprites: [] as Array<{ sprite: THREE.Sprite; height: number }>,
      };
      spriteMatCache.set(key, entry);

      const { westTexture, eastTexture, aspectRatio } = getSharedMonsterDirectionalTextures(
        key,
        maxAniso,
        (readyAspect, readyWest, readyEast) => {
          entry.aspect = readyAspect;
          entry.matWest.map = readyWest;
          entry.matWest.visible = true;
          entry.matWest.needsUpdate = true;
          entry.matEast.map = readyEast;
          entry.matEast.visible = true;
          entry.matEast.needsUpdate = true;
          for (let i = 0; i < entry.sprites.length; i++) {
            const item = entry.sprites[i];
            item.sprite.scale.set(item.height * readyAspect, item.height, 1);
          }
        }
      );
      if (westTexture && eastTexture) {
        entry.matWest.map = westTexture;
        entry.matWest.visible = true;
        entry.matWest.needsUpdate = true;
        entry.matEast.map = eastTexture;
        entry.matEast.visible = true;
        entry.matEast.needsUpdate = true;
      }
      entry.aspect = aspectRatio;
      return entry;
    };

    // Cache aura ring geometries, directional chevron geometries & materials by archetype
    const auraGeoCache = new Map<string, THREE.RingGeometry>();
    const auraMatCache = new Map<string, THREE.MeshBasicMaterial>();
    const shadowGeoCache = new Map<string, THREE.CircleGeometry>();
    const chevronGeoCache = new Map<string, THREE.ConeGeometry>();
    const chevronMatCache = new Map<string, THREE.MeshBasicMaterial>();
    const bossOuterGeo = new THREE.RingGeometry(6.8, 8.15, 36);
    const bossOuterMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    });

    const registerMonster = (group: THREE.Group, entity: WorldEntity, belowTagDist: number) => {
      group.userData = { ...group.userData, gameEntity: entity };
      this.entitiesMap.set(entity.id, entity);
      this.monsterMeshesMap.set(entity.id, group);

      const isBoss = entity.subtype === 'boss' || (entity.level ?? 1) >= 10;
      const colliderHeight = isBoss ? 14 : 10;
      const hitCollider = new THREE.Mesh(
        new THREE.CylinderGeometry(entity.radius, entity.radius, colliderHeight, 8),
        new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 })
      );
      hitCollider.position.y = colliderHeight * 0.5;
      hitCollider.userData = { gameEntity: entity };
      group.add(hitCollider);

      // Floating 3D Monster Nameplate Badge positioned cleanly BELOW the monster
      const lvl = entity.level ?? 1;
      const hpVal = entity.maxHealth || entity.health || 2000;
      const hpText = hpVal >= 1000 ? `${(hpVal / 1000).toFixed(hpVal % 1000 === 0 ? 0 : 1)}K HP` : `${hpVal} HP`;
      const isGoblin = entity.subtype === 'goblin';
      const borderCol = isBoss ? '#ef4444' : isGoblin ? '#facc15' : lvl >= 7 ? '#38bdf8' : lvl >= 4 ? '#fb923c' : '#22c55e';
      const accentCol = isBoss ? '#e9d5ff' : isGoblin ? '#fef08a' : lvl >= 7 ? '#bae6fd' : lvl >= 4 ? '#fed7aa' : '#86efac';
      const headerLabel = isBoss
        ? '★ DRAGO WORLD BOSS ★'
        : isGoblin
          ? '💰 TREASURE RALLY'
          : entity.subtype === 'death_knight'
            ? '❄ DEATH KNIGHT · RALLY'
            : entity.subtype === 'skeleton'
              ? '☠ SKELETON · RALLY'
              : '⚔ ORC · RALLY';
      const badgeW = isBoss ? 14.2 : 11.0;
      const badgeH = isBoss ? 4.1 : 3.3;

      const monsterBadge = this.createFloatingBadgeSprite(
        entity.name.toUpperCase(),
        `LV.${lvl} · ${hpText}`,
        headerLabel,
        borderCol,
        accentCol,
        badgeW,
        badgeH
      );
      const tagY = 0.25;
      monsterBadge.center.set(0.5, 0);
      monsterBadge.position.set(0, tagY, belowTagDist);
      monsterBadge.renderOrder = 15;
      monsterBadge.userData = { belowTagDist, belowTagY: tagY };
      group.add(monsterBadge);

      this.pickableObjects.push(hitCollider);
      this.monstersGroup.add(group);
    };

    for (let mIdx = 0; mIdx < WORLD_MONSTERS.length; mIdx++) {
      const mData = WORLD_MONSTERS[mIdx];
      const groundY = this.terrainGenerator.getHeightAt(mData.position[0], mData.position[2]);
      mData.position[1] = groundY;
      const mGroup = new THREE.Group();
      mGroup.position.set(mData.position[0], groundY, mData.position[2]);

      const artCfg = getMonsterArtConfig(mData.subtype, mData.level, mData.name);

      // Compute varied tactical world guard bearing (facing toward heartland + deterministic patrol spread)
      const toCenterYaw = Math.atan2(1600 - mData.position[0], 1568 - mData.position[2]);
      const spreadOffset = ((mIdx % 5) - 2) * 0.44;
      const initialFacingYaw = toCenterYaw + spreadOffset;
      const initialFacingEast = Math.sin(initialFacingYaw) >= 0;

      // 1. Soft radial contact shadow grounded beneath monster feet + sun-synced directional shadow oval
      let sGeo = shadowGeoCache.get(artCfg.key);
      if (!sGeo) {
        sGeo = new THREE.CircleGeometry(artCfg.shadowRadius * 1.15, 24);
        shadowGeoCache.set(artCfg.key, sGeo);
      }
      const contactShadow = new THREE.Mesh(sGeo, contactShadowMat);
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.position.y = 0.08;
      contactShadow.renderOrder = 2;
      contactShadow.userData = { isContactShadow: true };
      mGroup.add(contactShadow);

      const dirShadow = new THREE.Mesh(sGeo, directionalShadowMat);
      dirShadow.rotation.order = 'YXZ';
      dirShadow.rotation.x = -Math.PI / 2;
      dirShadow.position.y = 0.07;
      dirShadow.renderOrder = 2;
      dirShadow.userData = {
        isDirectionalMonsterShadow: true,
        spriteHeight: artCfg.spriteHeight,
      };
      mGroup.add(dirShadow);

      // 2. Archetype elemental ground aura ring + directional facing chevron (+Z in auraDirGroup)
      const auraDirGroup = new THREE.Group();
      auraDirGroup.rotation.y = initialFacingYaw;
      auraDirGroup.userData = { isMonsterFacingRing: true };

      let aGeo = auraGeoCache.get(artCfg.key);
      if (!aGeo) {
        aGeo = new THREE.RingGeometry(artCfg.ringInner, artCfg.ringOuter, 32);
        auraGeoCache.set(artCfg.key, aGeo);
      }
      let aMat = auraMatCache.get(artCfg.key);
      if (!aMat) {
        aMat = new THREE.MeshBasicMaterial({
          color: artCfg.auraHex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: artCfg.key === 'boss' ? 0.62 : 0.48,
          depthWrite: false,
        });
        auraMatCache.set(artCfg.key, aMat);
      }
      const auraRing = new THREE.Mesh(aGeo, aMat);
      auraRing.rotation.x = -Math.PI / 2;
      auraRing.position.y = 0.13;
      auraRing.renderOrder = 4;
      auraRing.userData = { isMonsterAuraRing: true };
      auraDirGroup.add(auraRing);

      let cGeo = chevronGeoCache.get(artCfg.key);
      if (!cGeo) {
        const chevSize = artCfg.key === 'boss' ? 1.45 : 0.95;
        cGeo = new THREE.ConeGeometry(chevSize * 0.72, chevSize * 1.4, 3);
        chevronGeoCache.set(artCfg.key, cGeo);
      }
      let cMat = chevronMatCache.get(artCfg.key);
      if (!cMat) {
        cMat = new THREE.MeshBasicMaterial({
          color: artCfg.auraHex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
        });
        chevronMatCache.set(artCfg.key, cMat);
      }
      const facingChevron = new THREE.Mesh(cGeo, cMat);
      facingChevron.rotation.x = Math.PI / 2; // +Y tip maps strictly to +Z forward
      facingChevron.scale.set(1, 1, 0.14);
      facingChevron.position.set(0, 0.15, (artCfg.key === 'boss' ? 8.15 : artCfg.ringOuter) + 0.65);
      facingChevron.renderOrder = 4;
      auraDirGroup.add(facingChevron);

      if (artCfg.key === 'boss') {
        const outerBossRing = new THREE.Mesh(bossOuterGeo, bossOuterMat);
        outerBossRing.rotation.x = -Math.PI / 2;
        outerBossRing.position.y = 0.16;
        outerBossRing.renderOrder = 4;
        outerBossRing.userData = { isBossAuraRing: true };
        auraDirGroup.add(outerBossRing);
      }
      mGroup.add(auraDirGroup);

      // 3. Exact Uploaded PNG Cutout Sprite Standee (feet firmly planted at y = 0)
      const bodyRoot = new THREE.Group();
      bodyRoot.position.set(0, 0, 0);
      bodyRoot.frustumCulled = false;
      bodyRoot.userData = {
        isMonsterBodyRoot: true,
        baseY: 0,
      };

      const spriteEntry = getArchetypeSpriteEntry(artCfg.key, artCfg.initialAspect);
      const monsterSprite = new THREE.Sprite(initialFacingEast ? spriteEntry.matEast : spriteEntry.matWest);
      monsterSprite.center.set(0.5, 0);
      monsterSprite.scale.set(artCfg.spriteHeight * spriteEntry.aspect, artCfg.spriteHeight, 1);
      monsterSprite.renderOrder = 12;
      monsterSprite.frustumCulled = false;
      spriteEntry.sprites.push({ sprite: monsterSprite, height: artCfg.spriteHeight });
      bodyRoot.add(monsterSprite);

      mGroup.add(bodyRoot);
      mGroup.userData = {
        facingYaw: initialFacingYaw,
        facingEast: initialFacingEast,
        monsterSprite,
        spriteEntry,
        auraDirGroup,
      };
      registerMonster(mGroup, mData, artCfg.belowTagDist);
    }
  }

  // ============================================================
  // 3. PROCEDURAL 3D RESOURCE NODES (Realistic Quarries, Farms, Lumber & Mines)
  // ============================================================
  private buildRealisticResourceGroup(rData: WorldEntity): THREE.Group {
    const mats = this.ensureRealisticMaterials();
    const logMats = [mats.timberBark, mats.logEndGrain, mats.logEndGrain];

    const groundY = this.terrainGenerator.getHeightAt(rData.position[0], rData.position[2]);
    rData.position[1] = groundY;
    const rGroup = new THREE.Group();
    rGroup.position.set(rData.position[0], groundY, rData.position[2]);

    const addPart = (
      parent: THREE.Object3D,
      geo: THREE.BufferGeometry,
      mat: THREE.Material | THREE.Material[],
      x = 0,
      y = 0,
      z = 0
    ) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    const sub = rData.subtype;

    if (sub === 'wood') {
      // WOODEN LUMBER CAMP: Sawmill pavilion, spinning saw bench, pyramidal log stacks (bark + end-grain),
      // freshly cut stump with embedded felling axe, log wagon, and living swaying cedar trees.
      addPart(rGroup, new THREE.CylinderGeometry(4.8, 5.4, 0.35, 10), mats.farmlandSoil, 0, -0.05, 0);

      // Open-sided cedar sawmill shed
      for (const [px, pz] of [
        [-2.8, -2.5],
        [-0.4, -2.5],
        [-2.8, -0.3],
        [-0.4, -0.3],
      ]) {
        addPart(rGroup, new THREE.CylinderGeometry(0.14, 0.16, 2.3, 6), mats.castleTimber, px, 1.15, pz);
      }
      const shedRoof = addPart(rGroup, new THREE.BoxGeometry(3.2, 0.22, 2.9), mats.myCastleRoof, -1.6, 2.45, -1.4);
      shedRoof.rotation.x = 0.22;

      // Saw bench & animated spinning steel circular saw blade
      addPart(rGroup, new THREE.BoxGeometry(1.9, 0.65, 0.9), mats.castleTimber, -1.6, 0.48, -1.4);
      const sawBlade = addPart(rGroup, new THREE.CylinderGeometry(0.52, 0.52, 0.06, 16), mats.sawSteel, -1.6, 0.95, -1.4);
      sawBlade.rotation.z = Math.PI / 2;
      sawBlade.userData = { isSawBlade: true };
      // Half-cut log resting on saw bench
      const benchLog = addPart(rGroup, new THREE.CylinderGeometry(0.24, 0.26, 2.2, 10), logMats, -1.6, 0.92, -1.4);
      benchLog.rotation.x = Math.PI / 2;

      // Neatly stacked pyramidal timber logs (bark sides + concentric growth-ring ends!)
      const logOffsets: Array<[number, number]> = [
        [1.1, 0.36],
        [1.62, 0.36],
        [2.14, 0.36],
        [1.36, 0.8],
        [1.88, 0.8],
        [1.62, 1.24],
      ];
      for (const [lx, ly] of logOffsets) {
        const log = addPart(rGroup, new THREE.CylinderGeometry(0.25, 0.26, 2.7, 10), logMats, lx, ly, 1.1);
        log.rotation.x = Math.PI / 2;
      }

      // Sawn wooden plank stack beside sawmill
      for (let p = 0; p < 3; p++) {
        addPart(rGroup, new THREE.BoxGeometry(2.1, 0.14, 1.1), mats.castleTimber, -1.5, 0.2 + p * 0.18, 1.5);
      }

      // Tree stump with embedded steel axe
      addPart(rGroup, new THREE.CylinderGeometry(0.45, 0.58, 0.72, 10), logMats, 0.1, 0.36, -1.6);
      const axeHandle = addPart(rGroup, new THREE.CylinderGeometry(0.05, 0.05, 1.15, 6), mats.castleTimber, 0.2, 0.95, -1.55);
      axeHandle.rotation.z = -0.45;
      const axeHead = addPart(rGroup, new THREE.BoxGeometry(0.36, 0.24, 0.08), mats.sawSteel, 0.05, 0.78, -1.55);
      axeHead.rotation.z = -0.45;

      // Living Himalayan Cedar trees framing the lumber clearing
      for (const [tx, tz, tScale] of [
        [-2.8, 2.3, 1.05],
        [2.4, -2.1, 0.92],
      ]) {
        addPart(rGroup, new THREE.CylinderGeometry(0.34 * tScale, 0.52 * tScale, 2.8 * tScale, 8), mats.timberBark, tx, 1.4 * tScale, tz);
        const canopyGroup = new THREE.Group();
        canopyGroup.position.set(tx, 2.5 * tScale, tz);
        canopyGroup.userData = { isFoliageCanopy: true };
        addPart(canopyGroup, new THREE.ConeGeometry(1.9 * tScale, 2.3 * tScale, 8), mats.pineFoliageDark, 0, 1.0 * tScale, 0);
        addPart(canopyGroup, new THREE.ConeGeometry(1.45 * tScale, 2.0 * tScale, 8), mats.pineFoliageMid, 0, 2.2 * tScale, 0);
        addPart(canopyGroup, new THREE.ConeGeometry(0.95 * tScale, 1.7 * tScale, 8), mats.pineFoliageDark, 0, 3.3 * tScale, 0);
        rGroup.add(canopyGroup);
      }
    } else if (sub === 'farm') {
      // FARM FOOD: Terraced plowed soil plots, golden wheat crop furrows, stone irrigation channel,
      // rotating wooden waterwheel, rustic timber-and-stone granary barn, hay bales & optional windmill.
      addPart(rGroup, new THREE.BoxGeometry(6.8, 0.48, 6.2), mats.farmlandSoil, 0, 0.14, 0);
      addPart(rGroup, new THREE.BoxGeometry(4.6, 0.36, 3.6), mats.farmlandSoil, -0.9, 0.45, -1.0);

      // Dry-stone terrace retaining borders
      addPart(rGroup, new THREE.BoxGeometry(7.0, 0.36, 0.32), mats.castleDarkStone, 0, 0.25, 3.1);
      addPart(rGroup, new THREE.BoxGeometry(0.32, 0.36, 6.4), mats.castleDarkStone, -3.4, 0.25, 0);

      // Raised crop furrow ridges with golden wheat / barley stalks
      for (let row = 0; row < 5; row++) {
        const rz = -1.6 + row * 0.95;
        addPart(rGroup, new THREE.BoxGeometry(3.8, 0.55, 0.52), mats.wheatCrop, -0.9, 0.72, rz);
      }

      // Stone-lined irrigation water trough & animated wooden waterwheel
      addPart(rGroup, new THREE.BoxGeometry(1.4, 0.28, 5.2), mats.castleDarkStone, 2.1, 0.32, 0);
      addPart(rGroup, new THREE.BoxGeometry(1.05, 0.12, 4.9), mats.farmWater, 2.1, 0.48, 0);

      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(2.9, 1.35, 0.5);
      wheelGroup.rotation.y = Math.PI / 2;
      wheelGroup.userData = { isWaterwheel: true };
      addPart(wheelGroup, new THREE.TorusGeometry(1.05, 0.1, 6, 14), mats.castleTimber, 0, 0, 0);
      for (let sp = 0; sp < 6; sp++) {
        const ang = (sp * Math.PI) / 3;
        const spoke = addPart(wheelGroup, new THREE.BoxGeometry(0.1, 2.1, 0.36), mats.castleTimber, 0, 0, 0);
        spoke.rotation.z = ang;
      }
      rGroup.add(wheelGroup);
      // Timber A-frame wheel support
      addPart(rGroup, new THREE.CylinderGeometry(0.1, 0.12, 1.8, 6), mats.castleTimber, 2.9, 0.85, 0.5);

      // Rustic Granary Barn / Farmhouse with pitched terracotta roof & burlap grain sacks
      addPart(rGroup, new THREE.BoxGeometry(2.3, 0.6, 2.2), mats.castleStone, 2.0, 0.55, -2.0);
      addPart(rGroup, new THREE.BoxGeometry(2.15, 1.4, 2.05), mats.castleTimber, 2.0, 1.5, -2.0);
      const barnRoof = addPart(rGroup, new THREE.ConeGeometry(1.85, 1.3, 4), mats.myCastleRoof, 2.0, 2.8, -2.0);
      barnRoof.rotation.y = Math.PI / 4;

      // Stacked hay bales & grain sacks
      const bale1 = addPart(rGroup, new THREE.CylinderGeometry(0.4, 0.4, 0.72, 10), mats.hayStraw, -2.4, 0.62, 2.2);
      bale1.rotation.z = Math.PI / 2;
      const bale2 = addPart(rGroup, new THREE.CylinderGeometry(0.4, 0.4, 0.72, 10), mats.hayStraw, -1.5, 0.62, 2.2);
      bale2.rotation.z = Math.PI / 2;
      addPart(rGroup, new THREE.SphereGeometry(0.32, 7, 7), mats.burlapSack, 1.1, 0.52, -1.4);
      addPart(rGroup, new THREE.SphereGeometry(0.28, 7, 7), mats.burlapSack, 1.5, 0.48, -1.1);

      // Animated Timber Windmill on Lv.2+ farms
      if ((rData.level ?? 1) >= 2) {
        addPart(rGroup, new THREE.CylinderGeometry(0.7, 1.05, 3.0, 8), mats.castlePlaster, -2.4, 1.7, -2.1);
        addPart(rGroup, new THREE.ConeGeometry(0.92, 1.1, 8), mats.myCastleRoof, -2.4, 3.65, -2.1);
        const sailHub = new THREE.Group();
        sailHub.position.set(-2.4, 2.85, -1.25);
        sailHub.userData = { isWindmillBlades: true };
        for (let b = 0; b < 4; b++) {
          const arm = new THREE.Group();
          arm.rotation.z = (b * Math.PI) / 2;
          addPart(arm, new THREE.BoxGeometry(0.08, 1.7, 0.08), mats.castleTimber, 0, 0.85, 0);
          addPart(arm, new THREE.BoxGeometry(0.45, 1.3, 0.04), mats.sailCanvas, 0.26, 0.95, 0.03);
          sailHub.add(arm);
        }
        rGroup.add(sailHub);
      }

      // Split-rail wooden fence posts
      for (const fx of [-2.8, -1.4, 0.0]) {
        addPart(rGroup, new THREE.CylinderGeometry(0.06, 0.07, 0.75, 5), mats.castleTimber, fx, 0.58, 2.85);
      }
      addPart(rGroup, new THREE.BoxGeometry(3.0, 0.08, 0.08), mats.castleTimber, -1.4, 0.76, 2.85);
    } else if (sub === 'stone') {
      // STONE QUARRY: Excavated quarry gravel pad, 3-tier terraced granite cliff face,
      // A-frame timber jib crane with suspended ashlar block, stonecutter pallets & quarry cart.
      addPart(rGroup, new THREE.CylinderGeometry(4.8, 5.4, 0.35, 10), mats.castleDarkStone, 0, -0.04, 0);

      // 3-Tier stepped terraced granite cliff shelves on North/West back wall
      addPart(rGroup, new THREE.BoxGeometry(5.6, 1.3, 3.0), mats.graniteRock, -0.6, 0.65, -1.5);
      addPart(rGroup, new THREE.BoxGeometry(4.6, 1.4, 2.2), mats.graniteRock, -0.8, 1.85, -1.9);
      addPart(rGroup, new THREE.BoxGeometry(3.2, 1.4, 1.5), mats.graniteRock, -1.1, 3.05, -2.2);
      // Faceted jagged quarry rock boulders flanking the cut benches
      addPart(rGroup, new THREE.DodecahedronGeometry(1.35, 0), mats.graniteRock, -2.6, 1.4, -0.4);
      addPart(rGroup, new THREE.DodecahedronGeometry(1.15, 0), mats.graniteRock, 2.2, 1.0, -1.8);

      // A-Frame Heavy Timber Jib Crane lifting a chiseled stone block
      const leg1 = addPart(rGroup, new THREE.CylinderGeometry(0.11, 0.14, 4.4, 6), mats.castleTimber, 0.5, 2.0, -0.3);
      leg1.rotation.z = -0.25;
      const leg2 = addPart(rGroup, new THREE.CylinderGeometry(0.11, 0.14, 4.4, 6), mats.castleTimber, 1.9, 2.0, -0.3);
      leg2.rotation.z = 0.25;
      const boom = addPart(rGroup, new THREE.CylinderGeometry(0.1, 0.12, 3.6, 6), mats.castleTimber, 1.2, 3.55, 0.85);
      boom.rotation.x = 0.82;
      const pulley = addPart(rGroup, new THREE.TorusGeometry(0.32, 0.06, 6, 10), mats.wroughtIron, 1.2, 4.5, 1.95);
      pulley.rotation.y = Math.PI / 2;
      pulley.userData = { isMineWheel: true };
      // Hoist cable & suspended cut granite ashlar block
      addPart(rGroup, new THREE.CylinderGeometry(0.03, 0.03, 2.1, 5), mats.wroughtIron, 1.2, 3.35, 1.95);
      addPart(rGroup, new THREE.BoxGeometry(1.15, 0.85, 0.95), mats.cutStoneBlock, 1.2, 1.95, 1.95);

      // Stacked chiseled stone blocks on wooden pallet
      addPart(rGroup, new THREE.BoxGeometry(2.2, 0.14, 1.4), mats.castleTimber, -1.8, 0.18, 1.6);
      addPart(rGroup, new THREE.BoxGeometry(0.95, 0.65, 0.9), mats.cutStoneBlock, -2.3, 0.56, 1.6);
      addPart(rGroup, new THREE.BoxGeometry(0.95, 0.65, 0.9), mats.cutStoneBlock, -1.25, 0.56, 1.6);
      addPart(rGroup, new THREE.BoxGeometry(0.95, 0.65, 0.9), mats.cutStoneBlock, -1.75, 1.2, 1.6);

      // Wooden quarry cart loaded with crushed rock
      addPart(rGroup, new THREE.BoxGeometry(1.4, 0.6, 1.0), mats.castleTimber, 2.4, 0.65, 0.7);
      addPart(rGroup, new THREE.DodecahedronGeometry(0.45, 0), mats.graniteRock, 2.4, 1.05, 0.7);
      for (const [wx, wz] of [
        [1.9, 1.22],
        [2.9, 1.22],
        [1.9, 0.18],
        [2.9, 0.18],
      ]) {
        const wheel = addPart(rGroup, new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10), mats.wroughtIron, wx, 0.3, wz);
        wheel.rotation.x = Math.PI / 2;
      }
    } else if (sub === 'gold') {
      // GOLD MINE: Rugged gold-veined mountain outcrop with timber-shored mine adit tunnel,
      // warm glowing hanging oil lanterns, iron railway track + sleepers, gold-filled minecart,
      // hoist pulley, exposed aurum quartz veins, and stacked bullion crates.
      addPart(rGroup, new THREE.CylinderGeometry(4.9, 5.5, 0.35, 10), mats.castleDarkStone, 0, -0.04, 0);

      // Sculpted rocky mountain face housing the mine entrance (North side)
      addPart(rGroup, new THREE.DodecahedronGeometry(2.5, 1), mats.goldOreRock, 0, 1.9, -1.8);
      addPart(rGroup, new THREE.DodecahedronGeometry(1.8, 1), mats.goldOreRock, -1.9, 1.35, -1.4);
      addPart(rGroup, new THREE.DodecahedronGeometry(1.75, 1), mats.goldOreRock, 1.9, 1.3, -1.4);
      addPart(rGroup, new THREE.DodecahedronGeometry(1.4, 0), mats.goldOreRock, -0.6, 3.1, -2.1);

      // Dark recessed tunnel portal + heavy timber shoring arch (∏ frame)
      addPart(rGroup, new THREE.BoxGeometry(1.9, 2.2, 1.2), mats.darkCavern, 0, 1.15, -0.55);
      addPart(rGroup, new THREE.BoxGeometry(0.32, 2.5, 0.36), mats.castleTimber, -1.05, 1.25, 0.05);
      addPart(rGroup, new THREE.BoxGeometry(0.32, 2.5, 0.36), mats.castleTimber, 1.05, 1.25, 0.05);
      addPart(rGroup, new THREE.BoxGeometry(2.65, 0.34, 0.44), mats.castleTimber, 0, 2.48, 0.05);

      // Warm hanging iron oil lanterns beside the mine portal
      for (const lx of [-1.18, 1.18]) {
        addPart(rGroup, new THREE.BoxGeometry(0.14, 0.24, 0.14), mats.flameEmber, lx, 1.95, 0.34);
      }

      // Parallel iron minecart rails & wooden sleeper crossties extending out from tunnel
      for (let tieZ = -0.1; tieZ <= 3.3; tieZ += 0.48) {
        addPart(rGroup, new THREE.BoxGeometry(1.45, 0.09, 0.16), mats.castleTimber, 0, 0.14, tieZ);
      }
      addPart(rGroup, new THREE.BoxGeometry(0.08, 0.1, 3.7), mats.sawSteel, -0.48, 0.22, 1.6);
      addPart(rGroup, new THREE.BoxGeometry(0.08, 0.1, 3.7), mats.sawSteel, 0.48, 0.22, 1.6);

      // Riveted steel ore minecart brimming with glittering gold nuggets
      addPart(rGroup, new THREE.BoxGeometry(1.15, 0.68, 1.45), mats.wroughtIron, 0, 0.72, 1.95);
      for (const [wx, wz] of [
        [-0.48, 1.45],
        [0.48, 1.45],
        [-0.48, 2.45],
        [0.48, 2.45],
      ]) {
        const mWheel = addPart(rGroup, new THREE.CylinderGeometry(0.18, 0.18, 0.09, 10), mats.sawSteel, wx, 0.38, wz);
        mWheel.rotation.z = Math.PI / 2;
      }
      // Mound of glittering gold nuggets inside cart
      addPart(rGroup, new THREE.DodecahedronGeometry(0.42, 0), mats.pureGold, 0, 1.14, 1.95);
      addPart(rGroup, new THREE.DodecahedronGeometry(0.28, 0), mats.pureGold, -0.28, 1.08, 1.72);
      addPart(rGroup, new THREE.DodecahedronGeometry(0.28, 0), mats.pureGold, 0.26, 1.08, 2.18);

      // Exposed shimmering gold quartz crystal veins on flank rocks + stacked bullion bars
      for (let g = 0; g < 4; g++) {
        const ang = (g * Math.PI) / 2 + 0.4;
        const shard = addPart(
          rGroup,
          new THREE.ConeGeometry(0.32, 1.05, 5),
          mats.pureGold,
          (g < 2 ? -2.2 : 2.2) + Math.cos(ang) * 0.35,
          1.25,
          -0.2 + Math.sin(ang) * 0.45
        );
        shard.rotation.z = g < 2 ? 0.35 : -0.35;
      }
      // Wooden bullion crate & gleaming cast gold ingots
      addPart(rGroup, new THREE.BoxGeometry(1.1, 0.55, 0.85), mats.castleTimber, 1.95, 0.38, 1.55);
      addPart(rGroup, new THREE.BoxGeometry(0.45, 0.18, 0.24), mats.pureGold, 1.75, 0.74, 1.55);
      addPart(rGroup, new THREE.BoxGeometry(0.45, 0.18, 0.24), mats.pureGold, 2.15, 0.74, 1.55);

      // Overhead hoist pulley wheel & subtle golden glints
      const hoist = addPart(rGroup, new THREE.TorusGeometry(0.42, 0.07, 6, 12), mats.castleTimber, 0, 3.1, -0.3);
      hoist.rotation.y = Math.PI / 2;
      hoist.userData = { isMineWheel: true };

      for (let sp = 0; sp < 3; sp++) {
        const spark = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.2, 0),
          new THREE.MeshBasicMaterial({ color: 0xfef08a })
        );
        spark.position.set(Math.cos(sp * 2.1) * 2.2, 2.6, Math.sin(sp * 2.1) * 2.2);
        spark.userData = { isGoldGlint: true, phase: sp * 2.1 };
        rGroup.add(spark);
      }
    } else if (sub === 'crystal') {
      // HIMALAYAN ARCANE CRYSTAL VEIN: Basalt crater plinth, towering faceted cyan crystal spires,
      // glowing inner crystal core & orbiting starlight glints.
      addPart(rGroup, new THREE.CylinderGeometry(4.6, 5.4, 0.42, 10), mats.castleDarkStone, 0, -0.02, 0);
      addPart(rGroup, new THREE.DodecahedronGeometry(1.9, 0), mats.graniteRock, -1.6, 0.9, -1.3);
      addPart(rGroup, new THREE.DodecahedronGeometry(1.6, 0), mats.graniteRock, 1.8, 0.75, 1.1);

      const mainSpire = addPart(rGroup, new THREE.CylinderGeometry(0.18, 1.05, 5.2, 6), mats.crystalCoreMat, 0, 2.6, 0);
      mainSpire.rotation.z = 0.08;

      const shardOffsets: Array<[number, number, number, number, number]> = [
        [-1.35, 1.8, 0.65, 3.6, 0.32],
        [1.35, 1.9, -0.55, 3.8, -0.3],
        [0.45, 1.65, 1.4, 3.2, -0.22],
        [-0.6, 1.7, -1.35, 3.4, 0.25],
      ];
      for (const [sx, sy, sz, sh, rot] of shardOffsets) {
        const shard = addPart(rGroup, new THREE.CylinderGeometry(0.12, 0.65, sh, 6), mats.crystalOreMat, sx, sy, sz);
        shard.rotation.z = rot;
        shard.rotation.x = rot * 0.6;
      }

      for (let sp = 0; sp < 4; sp++) {
        const spark = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.24, 0),
          new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
        );
        spark.position.set(Math.cos(sp * 1.57) * 2.3, 3.1, Math.sin(sp * 1.57) * 2.3);
        spark.userData = { isGoldGlint: true, phase: sp * 1.57 };
        rGroup.add(spark);
      }
    } else {
      // IRON & COPPER MINE: Timber-shored mine face, iron ore boulders, brick/stone smelter blast furnace,
      // molten ember glow, iron ingot stacks, and minecart hoist wheel.
      addPart(rGroup, new THREE.CylinderGeometry(4.6, 5.2, 0.35, 10), mats.castleDarkStone, 0, -0.04, 0);
      addPart(rGroup, new THREE.DodecahedronGeometry(2.1, 1), mats.ironOreMat, -1.2, 1.5, -1.2);
      addPart(rGroup, new THREE.DodecahedronGeometry(1.4, 0), mats.graniteRock, -2.3, 1.0, 0.2);

      // Stone blast smelter furnace with glowing ember crucible & chimney
      addPart(rGroup, new THREE.CylinderGeometry(0.95, 1.25, 2.5, 8), mats.castleDarkStone, 1.7, 1.25, -0.9);
      addPart(rGroup, new THREE.CylinderGeometry(0.55, 0.75, 1.1, 8), mats.castleStone, 1.7, 2.9, -0.9);
      addPart(rGroup, new THREE.SphereGeometry(0.42, 8, 8), mats.flameEmber, 1.7, 0.75, 0.15);

      // Timber hoist frame & pulley wheel
      addPart(rGroup, new THREE.CylinderGeometry(0.1, 0.12, 3.8, 6), mats.castleTimber, 0.5, 1.9, 1.2);
      addPart(rGroup, new THREE.CylinderGeometry(0.1, 0.12, 3.8, 6), mats.castleTimber, 2.1, 1.9, 1.2);
      addPart(rGroup, new THREE.BoxGeometry(2.0, 0.2, 0.25), mats.castleTimber, 1.3, 3.7, 1.2);
      const hoistWheel = addPart(rGroup, new THREE.TorusGeometry(0.58, 0.08, 6, 12), mats.wroughtIron, 1.3, 3.7, 1.2);
      hoistWheel.userData = { isMineWheel: true };

      // Stacked forged iron ingots on timber bench
      addPart(rGroup, new THREE.BoxGeometry(1.4, 0.45, 0.85), mats.castleTimber, -0.8, 0.32, 1.7);
      addPart(rGroup, new THREE.BoxGeometry(0.5, 0.18, 0.28), mats.sawSteel, -1.0, 0.64, 1.7);
      addPart(rGroup, new THREE.BoxGeometry(0.5, 0.18, 0.28), mats.sawSteel, -0.5, 0.64, 1.7);
    }

    const footprint =
      sub === 'farm'
        ? 14.8
        : sub === 'wood'
          ? 14.0
          : sub === 'crystal'
            ? 12.8
            : 13.6;
    const resShadow = createTerrainConformedContactShadow({
      width: footprint,
      depth: footprint,
      worldX: rData.position[0],
      worldZ: rData.position[2],
      baseGroundY: groundY,
      yOffset: 0.05,
      getHeightAt: (x, z) => this.terrainGenerator.getHeightAt(x, z),
      material: this.worldRadialShadowMat,
      shiftAmount: sub === 'crystal' ? 1.15 : 0.95,
      renderOrder: 2,
    });
    rGroup.add(resShadow.mesh);
    this.worldBuildingShadowEntries.push(resShadow.entry);

    return rGroup;
  }

  private initResources() {
    this.scene.add(this.resourcesGroup);

    const registerResource = (group: THREE.Group, entity: WorldEntity) => {
      group.userData = { gameEntity: entity };
      this.entitiesMap.set(entity.id, entity);
      this.resourceMeshesMap.set(entity.id, group);

      const hitCollider = new THREE.Mesh(
        new THREE.CylinderGeometry(entity.radius, entity.radius, 9, 8),
        new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 })
      );
      hitCollider.position.y = 4.5;
      hitCollider.userData = { gameEntity: entity };
      group.add(hitCollider);

      group.add(this.createResourceBelowTag(entity));

      this.pickableObjects.push(hitCollider);
      this.resourcesGroup.add(group);
    };

    for (const rData of WORLD_RESOURCES) {
      const rGroup = this.buildRealisticResourceGroup(rData);
      registerResource(rGroup, rData);
    }
    this.rebuildResourceAnimCache();
  }

  private rebuildResourceAnimCache() {
    this.animResBelowTags = [];
    this.animWaterwheels = [];
    this.animWindmills = [];
    this.animSawBlades = [];
    this.animMineWheels = [];
    this.animFoliageCanopies = [];
    this.animGoldGlints = [];
    const resGroups = this.resourcesGroup.children;
    for (let idx = 0; idx < resGroups.length; idx++) {
      const rChildren = resGroups[idx].children;
      for (let j = 0; j < rChildren.length; j++) {
        const mesh = rChildren[j];
        const ud = mesh.userData;
        if (!ud) continue;
        if (ud.belowTagDist) {
          this.animResBelowTags.push({
            obj: mesh,
            dist: Number(ud.belowTagDist),
            y: Number(ud.belowTagY ?? 0.9),
          });
        } else if (ud.isWaterwheel) {
          this.animWaterwheels.push(mesh);
        } else if (ud.isWindmillBlades) {
          this.animWindmills.push(mesh);
        } else if (ud.isSawBlade) {
          this.animSawBlades.push(mesh);
        } else if (ud.isMineWheel) {
          this.animMineWheels.push(mesh);
        } else if (ud.isFoliageCanopy) {
          this.animFoliageCanopies.push({ obj: mesh, idx });
        } else if (ud.isGoldGlint) {
          this.animGoldGlints.push({ obj: mesh, phase: Number(ud.phase || 0) });
        }
      }
    }
  }

  // ============================================================
  // 4. MAGAR VANGUARD ARMY BATTALION & HERO-LED FRONT FLAG FORMATION
  // ============================================================
  private initArmyBattalion() {
    this.armyGroup.position.copy(this.armyHomePos);
    this.armyGroup.visible = false;
    this.scene.add(this.armyGroup);

    // Live procedural 3D vanguard officer driven by Three.js AnimationMixer
    this.vanguard3DRig = createProceduralUnitRig('magar_infantry');
    this.vanguard3DRig.rootGroup.scale.setScalar(1.65);
    this.vanguard3DRig.rootGroup.position.set(0, 0, 2.35);
    this.vanguard3DRig.rootGroup.traverse((ch) => {
      const m = ch as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    const vanguardContact = createFlatContactShadow({
      width: 1.65,
      depth: 1.65,
      y: 0.05,
      material: this.ensureUnitShadowMat(),
      shiftAmount: 0.25,
      renderOrder: 2,
    });
    this.vanguard3DRig.rootGroup.add(vanguardContact.mesh);
    this.armyGroup.add(this.vanguard3DRig.rootGroup);

    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const initTex = getSharedMagarWarriorDirectionalTextures(3, maxAniso, (readyAspect, readyWest, readyEast) => {
      if (this.currentArmyTier !== 3) return;
      this.armyWarriorAspect = readyAspect;
      if (this.armyWarriorSpriteMatWest) {
        this.armyWarriorSpriteMatWest.map = readyWest;
        this.armyWarriorSpriteMatWest.visible = true;
        this.armyWarriorSpriteMatWest.needsUpdate = true;
      }
      if (this.armyWarriorSpriteMatEast) {
        this.armyWarriorSpriteMatEast.map = readyEast;
        this.armyWarriorSpriteMatEast.visible = true;
        this.armyWarriorSpriteMatEast.needsUpdate = true;
      }
      for (let i = 0; i < this.armyWarriorSprites.length; i++) {
        const item = this.armyWarriorSprites[i];
        item.sprite.scale.set(item.baseHeight * readyAspect, item.baseHeight, 1);
      }
    });
    this.armyWarriorAspect = initTex.aspectRatio;
    this.armyWarriorSpriteMatWest = new THREE.SpriteMaterial({
      map: initTex.westTexture,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: true,
      side: THREE.DoubleSide,
      visible: Boolean(initTex.westTexture),
    });
    this.armyWarriorSpriteMatEast = new THREE.SpriteMaterial({
      map: initTex.eastTexture,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: true,
      side: THREE.DoubleSide,
      visible: Boolean(initTex.eastTexture),
    });

    this.armyCommanderRingMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    this.armyBannerBeaconMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 3.0,
    });

    const unitShadowGeo = new THREE.PlaneGeometry(1.35, 1.35);
    const unitShadowMat = this.ensureUnitShadowMat();
    const dragonBannerTex = createDragonBannerTexture();
    const dragonBannerMat = new THREE.MeshStandardMaterial({
      map: dragonBannerTex,
      side: THREE.DoubleSide,
      roughness: 0.5,
    });

    // Battalion ground directional facing ring + bright forward chevron (+Z = march direction)
    const battalionRing = new THREE.Mesh(
      new THREE.RingGeometry(2.85, 3.22, 36),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      })
    );
    battalionRing.rotation.x = -Math.PI / 2;
    battalionRing.position.set(0, 0.09, 0.35);
    this.armyGroup.add(battalionRing);

    const battalionChevron = new THREE.Mesh(
      new THREE.ConeGeometry(0.75, 1.35, 3),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      })
    );
    battalionChevron.rotation.x = Math.PI / 2; // +Y tip maps to +Z forward
    battalionChevron.scale.set(1, 1, 0.14);
    battalionChevron.position.set(0, 0.13, 4.35);
    this.armyGroup.add(battalionChevron);

    // 1. Selected Hero Lead Vanguard Slot (apex +Z front, noticeably larger than troops)
    this.armyHeroSpriteMatWest = new THREE.SpriteMaterial({
      transparent: true,
      alphaTest: 0.05,
      depthWrite: true,
      side: THREE.DoubleSide,
      visible: false,
    });
    this.armyHeroSpriteMatEast = new THREE.SpriteMaterial({
      transparent: true,
      alphaTest: 0.05,
      depthWrite: true,
      side: THREE.DoubleSide,
      visible: false,
    });

    this.armyHeroGroup = new THREE.Group();
    this.armyHeroGroup.position.set(0, 0, 3.3);
    this.armyHeroGroup.visible = false;
    this.armyHeroGroup.userData = { idx: 99, isHeroLead: true };

    const heroShadow = new THREE.Mesh(new THREE.CircleGeometry(0.88, 16), unitShadowMat);
    heroShadow.rotation.x = -Math.PI / 2;
    heroShadow.position.y = 0.05;
    this.armyHeroGroup.add(heroShadow);

    this.armyCommanderRing = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.34, 28),
      this.armyCommanderRingMat
    );
    this.armyCommanderRing.rotation.x = -Math.PI / 2;
    this.armyCommanderRing.position.y = 0.09;
    this.armyHeroGroup.add(this.armyCommanderRing);

    const heroBaseHeight = 3.95; // Larger commander figure leading in front of 2.65 troops
    this.armyHeroSprite = new THREE.Sprite(this.armyHeroSpriteMatWest);
    this.armyHeroSprite.center.set(0.5, 0);
    this.armyHeroSprite.position.y = 0.08;
    this.armyHeroSprite.scale.set(heroBaseHeight * this.armyHeroAspect, heroBaseHeight, 1);
    this.armyHeroSprite.renderOrder = 13;
    this.armyHeroSprite.frustumCulled = false;
    this.armyHeroSprite.userData = { baseHeight: heroBaseHeight };
    this.armyHeroGroup.add(this.armyHeroSprite);
    this.armyGroup.add(this.armyHeroGroup);

    // 2. Front Vanguard Flag-Bearer & Honor Guard (+Z Front Rank) + 13 Ranked Infantry Behind
    this.armyWarriorSprites = [];
    const slotLayout: Array<{ x: number; z: number; isFrontVanguard: boolean; isFlagBearer?: boolean }> = [
      // Front Flag-Bearer & Honor Guard right behind Hero apex
      { x: -1.05, z: 2.15, isFrontVanguard: true, isFlagBearer: true },
      { x: 1.05, z: 2.15, isFrontVanguard: true },
      // Row 1 (5 troops)
      { x: -2.2, z: 0.85, isFrontVanguard: false },
      { x: -1.1, z: 0.85, isFrontVanguard: false },
      { x: 0, z: 0.85, isFrontVanguard: false },
      { x: 1.1, z: 0.85, isFrontVanguard: false },
      { x: 2.2, z: 0.85, isFrontVanguard: false },
      // Row 2 (5 troops)
      { x: -2.2, z: -0.45, isFrontVanguard: false },
      { x: -1.1, z: -0.45, isFrontVanguard: false },
      { x: 0, z: -0.45, isFrontVanguard: false },
      { x: 1.1, z: -0.45, isFrontVanguard: false },
      { x: 2.2, z: -0.45, isFrontVanguard: false },
      // Row 3 Rear Guard (3 troops)
      { x: -1.1, z: -1.75, isFrontVanguard: false },
      { x: 0, z: -1.75, isFrontVanguard: false },
      { x: 1.1, z: -1.75, isFrontVanguard: false },
    ];

    for (let i = 0; i < slotLayout.length; i++) {
      const slot = slotLayout[i];
      const warrior = new THREE.Group();
      warrior.position.set(slot.x, 0, slot.z);
      warrior.userData = {
        idx: i,
        isFrontVanguard: slot.isFrontVanguard,
        isFlagBearer: Boolean(slot.isFlagBearer),
        isWarriorUnit: true,
      };

      const shadowDisc = new THREE.Mesh(unitShadowGeo, unitShadowMat);
      shadowDisc.rotation.x = -Math.PI / 2;
      shadowDisc.position.y = 0.04;
      warrior.add(shadowDisc);

      const baseHeight = slot.isFrontVanguard ? 2.85 : 2.65;
      const wSprite = new THREE.Sprite(this.armyWarriorSpriteMatWest);
      wSprite.center.set(0.5, 0);
      wSprite.position.y = 0.05;
      wSprite.scale.set(baseHeight * this.armyWarriorAspect, baseHeight, 1);
      wSprite.renderOrder = slot.isFrontVanguard ? 12 : 11;
      wSprite.frustumCulled = false;
      warrior.add(wSprite);
      this.armyWarriorSprites.push({ sprite: wSprite, baseHeight, idx: i });

      // Attach Royal Dragon Silk Standard & Beacon directly onto the Front Flag-Bearer troop
      if (slot.isFlagBearer) {
        const flagRing = new THREE.Mesh(
          new THREE.RingGeometry(0.55, 0.76, 20),
          new THREE.MeshBasicMaterial({
            color: 0xf59e0b,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.65,
            depthWrite: false,
          })
        );
        flagRing.rotation.x = -Math.PI / 2;
        flagRing.position.y = 0.07;
        warrior.add(flagRing);

        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.055, 4.9, 8),
          new THREE.MeshStandardMaterial({ color: 0xdfba6e, metalness: 0.9 })
        );
        pole.position.set(-0.62, 2.45, 0.18);
        warrior.add(pole);

        const bannerMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.55), dragonBannerMat);
        bannerMesh.position.set(0.22, 3.55, 0.18);
        bannerMesh.userData = { isArmyBanner: true };
        warrior.add(bannerMesh);

        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), this.armyBannerBeaconMat);
        beacon.position.set(-0.62, 5.0, 0.18);
        warrior.add(beacon);
      }

      this.armyGroup.add(warrior);
    }

    this.scene.add(this.alliedRallyGroup);
    this.setArmyEquipmentTier(3, { weapon: 0, shield: 0, armor: 0 });
  }

  public setArmyEquipmentTier(
    infantryTier: number,
    ranks: { weapon: number; shield: number; armor: number },
    heroCrestColor?: string,
    heroId?: string | null
  ) {
    if (!this.worldMapBuilt) {
      this.pendingArmyEquipmentTier = {
        tier: infantryTier,
        ranks,
        heroCrestColor,
        heroId,
      };
      return;
    }
    const tier = Math.max(1, Math.min(5, Math.round(infantryTier || 1))) as TroopLevel;
    this.currentArmyTier = tier;
    const totalForgeRank = Math.max(0, (ranks.weapon || 0) + (ranks.shield || 0) + (ranks.armor || 0));
    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    const { westTexture, eastTexture, aspectRatio } = getSharedMagarWarriorDirectionalTextures(
      tier,
      maxAniso,
      (readyAspect, readyWest, readyEast) => {
        if (this.currentArmyTier !== tier) return;
        this.armyWarriorAspect = readyAspect;
        if (this.armyWarriorSpriteMatWest) {
          this.armyWarriorSpriteMatWest.map = readyWest;
          this.armyWarriorSpriteMatWest.visible = true;
          this.armyWarriorSpriteMatWest.needsUpdate = true;
        }
        if (this.armyWarriorSpriteMatEast) {
          this.armyWarriorSpriteMatEast.map = readyEast;
          this.armyWarriorSpriteMatEast.visible = true;
          this.armyWarriorSpriteMatEast.needsUpdate = true;
        }
        for (let i = 0; i < this.armyWarriorSprites.length; i++) {
          const item = this.armyWarriorSprites[i];
          item.sprite.scale.set(item.baseHeight * readyAspect, item.baseHeight, 1);
        }
      }
    );

    this.armyWarriorAspect = aspectRatio;
    const tintHex = totalForgeRank >= 6 ? 0xfef9c3 : totalForgeRank >= 3 ? 0xfffbeb : 0xffffff;
    if (this.armyWarriorSpriteMatWest) {
      if (westTexture) {
        this.armyWarriorSpriteMatWest.map = westTexture;
        this.armyWarriorSpriteMatWest.visible = true;
      }
      this.armyWarriorSpriteMatWest.color.setHex(tintHex);
      this.armyWarriorSpriteMatWest.needsUpdate = true;
    }
    if (this.armyWarriorSpriteMatEast) {
      if (eastTexture) {
        this.armyWarriorSpriteMatEast.map = eastTexture;
        this.armyWarriorSpriteMatEast.visible = true;
      }
      this.armyWarriorSpriteMatEast.color.setHex(tintHex);
      this.armyWarriorSpriteMatEast.needsUpdate = true;
    }

    for (let i = 0; i < this.armyWarriorSprites.length; i++) {
      const item = this.armyWarriorSprites[i];
      item.sprite.scale.set(item.baseHeight * aspectRatio, item.baseHeight, 1);
    }

    if (this.armyCommanderRing) {
      const ringScale = 1.0 + Math.min(0.42, totalForgeRank * 0.045);
      this.armyCommanderRing.scale.set(ringScale, ringScale, 1);
    }

    // Hero Commander Cutout, Crest Ring & Banner Beacon Sync
    if (heroCrestColor) {
      this.currentArmyHeroCrestColor = heroCrestColor;
      if (this.armyCommanderRingMat) {
        this.armyCommanderRingMat.color.set(heroCrestColor);
      }
      if (this.armyBannerBeaconMat) {
        this.armyBannerBeaconMat.color.set(heroCrestColor);
        this.armyBannerBeaconMat.emissive.set(heroCrestColor);
      }
    }

    if (heroId !== undefined) {
      this.currentArmyHeroId = heroId;
    }
    const activeHeroId = this.currentArmyHeroId;
    if (this.armyHeroGroup) {
      if (!activeHeroId) {
        this.armyHeroGroup.visible = false;
      } else {
        this.armyHeroGroup.visible = true;
        const requestedCrest = this.currentArmyHeroCrestColor || '#facc15';
        const heroTex = getSharedHeroDirectionalTextures(
          activeHeroId,
          requestedCrest,
          maxAniso,
          (hAspect, hWest, hEast) => {
            if (this.currentArmyHeroId !== activeHeroId) return;
            this.armyHeroAspect = hAspect;
            if (this.armyHeroSpriteMatWest) {
              this.armyHeroSpriteMatWest.map = hWest;
              this.armyHeroSpriteMatWest.visible = true;
              this.armyHeroSpriteMatWest.needsUpdate = true;
            }
            if (this.armyHeroSpriteMatEast) {
              this.armyHeroSpriteMatEast.map = hEast;
              this.armyHeroSpriteMatEast.visible = true;
              this.armyHeroSpriteMatEast.needsUpdate = true;
            }
            if (this.armyHeroSprite) {
              const bh = this.armyHeroSprite.userData?.baseHeight ?? 3.95;
              this.armyHeroSprite.scale.set(bh * hAspect, bh, 1);
            }
          }
        );
        this.armyHeroAspect = heroTex.aspectRatio;
        if (this.armyHeroSpriteMatWest && heroTex.westTexture) {
          this.armyHeroSpriteMatWest.map = heroTex.westTexture;
          this.armyHeroSpriteMatWest.visible = true;
          this.armyHeroSpriteMatWest.needsUpdate = true;
        }
        if (this.armyHeroSpriteMatEast && heroTex.eastTexture) {
          this.armyHeroSpriteMatEast.map = heroTex.eastTexture;
          this.armyHeroSpriteMatEast.visible = true;
          this.armyHeroSpriteMatEast.needsUpdate = true;
        }
        if (this.armyHeroSprite) {
          const bh = this.armyHeroSprite.userData?.baseHeight ?? 3.95;
          this.armyHeroSprite.scale.set(bh * heroTex.aspectRatio, bh, 1);
          this.armyHeroSprite.material =
            this.armyFacingEast && this.armyHeroSpriteMatEast
              ? this.armyHeroSpriteMatEast
              : this.armyHeroSpriteMatWest!;
        }
      }
    }
  }

  private initTacticalLine() {
    const lineMat = new THREE.LineDashedMaterial({
      color: 0xffd700,
      linewidth: 3,
      scale: 1,
      dashSize: 1.2,
      gapSize: 0.8,
    });
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]);
    this.tacticalLine = new THREE.Line(geo, lineMat);
    this.tacticalLine.visible = false;
    this.scene.add(this.tacticalLine);
  }

  private initSelectionIndicator() {
    const ringGeo = new THREE.RingGeometry(3.5, 4.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    this.selectionIndicator = new THREE.Mesh(ringGeo, ringMat);
    this.selectionIndicator.rotation.x = -Math.PI / 2;
    this.selectionIndicator.visible = false;
    this.scene.add(this.selectionIndicator);
  }

  private initCameraController(
    onCameraUpdate?: (info: { x: number; y: number; z: number; zoom: number }) => void
  ) {
    this.cameraController = new CameraController({
      domElement: this.container,
      camera: null as any,
      terrainGenerator: this.terrainGenerator,
      initialTarget: [1600, 10, 1568],
      minZoom: 0.023,
      maxZoom: 3.2,
      onUpdate: onCameraUpdate,
      onSelectObject: this.handleObjectSelection,
      pickableObjects: this.pickableObjects,
    });

    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onOrientationChange);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.onResize();
      });
      this.resizeObserver.observe(this.container);
    }
  }

  private handleObjectSelection = (
    obj: THREE.Object3D | null,
    screenPos: { x: number; y: number } | null
  ) => {
    // When in 3D Inside Kingdom mode, handle 3D courtyard plot selection & merging
    if (this.currentSceneMode === 'kingdom') {
      if (!obj) return;
      let curPlotObj: THREE.Object3D | null = obj;
      let foundPlotId: string | null = null;
      while (curPlotObj) {
        if (curPlotObj.userData?.insidePlotId) {
          foundPlotId = curPlotObj.userData.insidePlotId as string;
          break;
        }
        curPlotObj = curPlotObj.parent;
      }
      if (foundPlotId) {
        this.insideKingdom3D?.handlePlotClick(foundPlotId);
      }
      return;
    }

    if (!obj) {
      this.selectionIndicator.visible = false;
      this.selectedEntity = null;
      this.onSelectEntity?.(null, null);
      return;
    }

    let cur: THREE.Object3D | null = obj;
    let foundEntity: WorldEntity | null = null;
    while (cur) {
      if (cur.userData?.gameEntity) {
        foundEntity = cur.userData.gameEntity as WorldEntity;
        break;
      }
      cur = cur.parent;
    }

    if (foundEntity && !foundEntity.isDefeated) {
      this.selectedEntity = foundEntity;
      this.selectionIndicator.visible = true;
      this.selectionIndicator.position.set(
        foundEntity.position[0],
        foundEntity.position[1] + 0.18,
        foundEntity.position[2]
      );
      const ringScale = foundEntity.radius * 0.95;
      this.selectionIndicator.scale.set(ringScale, ringScale, ringScale);

      // If the player clicked on My Castle, enter 3D Inside Kingdom view!
      if (foundEntity.id === 'my-castle') {
        this.setSceneMode('kingdom');
        this.onEnterKingdom?.();
        return;
      }

      // Smoothly focus camera onto the selected target so it sits squarely in screen focus
      this.cameraController.focusOn(foundEntity.position[0], foundEntity.position[2]);

      this.onSelectEntity?.(foundEntity, screenPos);
    } else {
      this.selectionIndicator.visible = false;
      this.selectedEntity = null;
      this.onSelectEntity?.(null, null);
    }
  };

  // ============================================================
  // 5. TROOP DISPATCH & ACTION EXECUTION
  // ============================================================
  public dispatchTroops(target: WorldEntity, action: EntityAction) {
    this.activeTarget = target;
    const dest = new THREE.Vector3(target.position[0], target.position[1], target.position[2]);

    if (action === 'attack' || action === 'rally') {
      this.armyState = 'ATTACKING';
      this.armyGroup.position.copy(this.armyHomePos);
      this.armyPos.copy(this.armyHomePos);
      this.armyGroup.visible = true;
      this.totalMarchDist = this.armyPos.distanceTo(dest);
      this.combatTimer = 0.55; // Fire initial volley shortly after reaching siege range
      this.onArmyStatusUpdate?.(`Vanguard marching to attack ${target.name}...`, 10, 'Marching', [this.armyPos.x, this.armyPos.y, this.armyPos.z]);
    } else if (action === 'mine') {
      this.armyState = 'GATHERING';
      this.armyGroup.position.copy(this.armyHomePos);
      this.armyPos.copy(this.armyHomePos);
      this.armyGroup.visible = true;
      this.totalMarchDist = this.armyPos.distanceTo(dest);
      this.gatherTimer = 0;
      this.onArmyStatusUpdate?.(`Workforce dispatched to harvest ${target.name}...`, 10, 'Marching', [this.armyPos.x, this.armyPos.y, this.armyPos.z]);
    } else if (action === 'scout') {
      this.onArmyStatusUpdate?.(`Falcon scout surveyed ${target.name}.`, 100, 'Recon Complete', [dest.x, dest.y, dest.z]);
    } else if (action === 'garrison' || action === 'upgrade') {
      // Trigger subtle fortification flash VFX on building
      this.triggerStructureEffect(target.id, action);
    }
  }

  // Trigger fortification / inspection effect on buildings
  public triggerStructureEffect(structureId: string, action: string) {
    const meshGroup = this.buildingMeshesMap.get(structureId);
    if (!meshGroup) return;

    const dest = meshGroup.position.clone();
    this.spawnImpactSparks(dest);
    this.spawnDebrisChips(dest, 'gold');
    this.triggerFlinchShake(meshGroup);

    const worldPos = dest.clone();
    worldPos.y += 4.5;
    worldPos.project(this.cameraController.camera);
    const screenX = ((worldPos.x + 1) * this.container.clientWidth) / 2;
    const screenY = ((-worldPos.y + 1) * this.container.clientHeight) / 2;

    if (action === 'upgrade') {
      this.onAddCombatFloater?.('🔨 UPGRADE COMMENCED', '#fef08a', screenX, screenY - 20);
    } else {
      this.onAddCombatFloater?.('🛡️ GARRISON REINFORCED', '#818cf8', screenX, screenY - 20);
    }
  }

  public setTimeOfDay(mode: TimeOfDayMode): void {
    this.environmentManager?.setTimeOfDay(mode);
  }

  public cycleTimeOfDay(): TimeOfDayMode {
    return this.environmentManager ? this.environmentManager.cycleTimeOfDay() : 'day';
  }

  public getTimeOfDay(): TimeOfDayMode {
    return this.environmentManager ? this.environmentManager.getTimeOfDay() : 'day';
  }

  public setStructureBarrierActive(structureId: string, active: boolean) {
    if (!this.worldMapBuilt) {
      this.pendingBarrierStates.set(structureId, active);
      return;
    }
    const group = this.buildingMeshesMap.get(structureId);
    const entity = this.entitiesMap.get(structureId);
    if (!group || !entity) return;

    const factionKey: BarrierFactionColorKey =
      entity.type === 'my_castle'
        ? 'player'
        : entity.ownerFaction === 'enemy'
          ? 'enemy'
          : entity.ownerFaction === 'alliance' || entity.type === 'congress'
            ? 'alliance'
            : 'neutral';

    let shaderBarrier = this.shaderBarrierMap.get(structureId);
    if (!shaderBarrier && active) {
      const radius = Math.max(6.8, (entity.radius || 8) * 1.15);
      shaderBarrier = createProtectionBarrier(radius, factionKey);
      shaderBarrier.group.position.y = 0.2;
      group.add(shaderBarrier.group);
      this.shaderBarrierMap.set(structureId, shaderBarrier);
    }
    if (shaderBarrier) {
      setBarrierFaction(shaderBarrier, factionKey);
      shaderBarrier.targetActivation = active ? 1.0 : 0.0;
    }
  }

  public updateEntityLiveState(
    id: string,
    patch: Partial<Pick<WorldEntity, 'health' | 'maxHealth' | 'yieldAmount' | 'isDefeated' | 'respawnAt' | 'ownerFaction'>>
  ) {
    if (!this.worldMapBuilt) {
      const prev = this.pendingEntityLivePatches.get(id) || {};
      this.pendingEntityLivePatches.set(id, { ...prev, ...patch });
      return;
    }
    const ent = this.entitiesMap.get(id);
    if (!ent) return;
    const wasDefeated = Boolean(ent.isDefeated);
    Object.assign(ent, patch);

    if (ent.category === 'monster') {
      const grp = this.monsterMeshesMap.get(id);
      if (grp) {
        if (!wasDefeated && patch.isDefeated) {
          this.dissolveMonsterIntoSmoke(grp, 'monster');
        } else if (wasDefeated && patch.isDefeated === false) {
          grp.visible = true;
          this.spawnImpactSparks(grp.position);
        }
      }
    } else if (ent.category === 'resource') {
      const grp = this.resourceMeshesMap.get(id);
      if (grp) {
        if (!wasDefeated && patch.isDefeated) {
          this.dissolveMonsterIntoSmoke(grp, 'resource');
        } else if (wasDefeated && patch.isDefeated === false) {
          grp.visible = true;
          this.spawnImpactSparks(grp.position);
        } else if (patch.isDefeated !== undefined) {
          grp.visible = !patch.isDefeated;
        }
      }
    }
  }

  public setCastleBurningState(castleId: string, isBurning: boolean, currentHp?: number, maxHp?: number) {
    if (!this.worldMapBuilt) {
      this.pendingBurningCastles.set(castleId, { isBurning, currentHp, maxHp });
      return;
    }
    const entity = this.entitiesMap.get(castleId);
    if (entity) {
      if (typeof currentHp === 'number') entity.health = currentHp;
      if (typeof maxHp === 'number') entity.maxHealth = maxHp;
    }
    const burnEntry = this.castleBurningMap.get(castleId);
    if (!burnEntry) return;

    const wasBurning = burnEntry.isBurning;
    burnEntry.isBurning = isBurning;
    burnEntry.flamesGroup.visible = isBurning;
    if (typeof currentHp === 'number' && typeof maxHp === 'number' && maxHp > 0) {
      const ratio = Math.max(0, Math.min(1, currentHp / maxHp));
      burnEntry.intensity = 0.65 + (1 - ratio) * 0.85;
    } else {
      burnEntry.intensity = 1.0;
    }

    if (isBurning) {
      const sb = this.shaderBarrierMap.get(castleId);
      if (sb) {
        triggerBarrierImpact(sb);
        sb.damageCracks = Math.min(1, sb.damageCracks + 0.25);
      }
    }

    if (isBurning && !wasBurning) {
      burnEntry.smokeTimer = 0.16;
      this.spawnSiegeSmokeBurst(burnEntry.group.position, 14);
      this.triggerFlinchShake(burnEntry.group);
    }
  }

  public teleportEnemyCastle(
    castleId: string,
    forcedPos?: [number, number, number]
  ): [number, number, number] | null {
    this.ensureWorldMapBuilt();
    const castle = this.castlesList.find((c) => c.id === castleId && c.faction === 'enemy');
    const cGroup = this.buildingMeshesMap.get(castleId);
    const entity = this.entitiesMap.get(castleId);
    if (!castle || !cGroup || !entity) return null;

    const oldPos: [number, number, number] = [...castle.position];
    const oldVec = new THREE.Vector3(oldPos[0], oldPos[1], oldPos[2]);

    const otherCastlePositions = this.castlesList
      .filter((c) => c.id !== castleId)
      .map((c) => c.position);

    const newPos =
      forcedPos ||
      pickValidCastleCoordinate(otherCastlePositions, {
        minDistFromCenter: 340,
        maxDistFromCenter: 1420,
        minCastleDist: 96,
        oldPos,
        minJumpFromOld: 340,
        getHeightAt: (x, z) => this.getGroundHeight(x, z),
      });

    // Departure destruction + portal shockwave at the fallen citadel coordinates
    this.spawnConquestPillar(oldVec, 0xef4444);
    this.spawnShockwave(oldVec, 0xef4444, entity.radius * 2.2, 0.95);
    this.spawnShockwave(oldVec, 0x38bdf8, entity.radius * 1.75, 0.85);
    this.spawnSiegeSmokeBurst(oldVec, 24);

    // Clear burning fire state & restore full HP at the new stronghold
    this.setCastleBurningState(castleId, false, entity.maxHealth ?? 45000, entity.maxHealth ?? 45000);
    entity.isDefeated = false;
    entity.health = entity.maxHealth ?? 45000;
    castle.position = [...newPos];
    entity.position = [...newPos];
    cGroup.position.set(newPos[0], newPos[1], newPos[2]);

    // Refresh floating badge sprite with new [X, Z] coords cleanly
    const badgeRef = this.castleBadgeRefs.get(castleId);
    if (badgeRef) {
      cGroup.remove(badgeRef.badgeSprite);
      if (badgeRef.badgeSprite.material.map) badgeRef.badgeSprite.material.map.dispose();
      badgeRef.badgeSprite.material.dispose();
      const refreshedBadge = this.createFloatingBadgeSprite(
        `⚔️ ${castle.name.toUpperCase()}`,
        `${castle.allianceTag} ${castle.allianceAlias || ''} · Lv.${castle.level}`,
        `☠️ [${Math.round(newPos[0])}, ${Math.round(newPos[2])}] ENEMY CITADEL`,
        '#ef4444',
        '#fca5a5',
        15.5,
        4.4
      );
      refreshedBadge.position.set(0, badgeRef.badgeY, 0);
      cGroup.add(refreshedBadge);
      badgeRef.badgeSprite = refreshedBadge;
    }

    if (this.selectedEntity?.id === castleId) {
      this.selectionIndicator.position.set(newPos[0], newPos[1] + 0.18, newPos[2]);
    }

    // Arrival cyan-gold teleportation portal at the new random area
    const newVec = new THREE.Vector3(newPos[0], newPos[1], newPos[2]);
    this.spawnConquestPillar(newVec, 0x38bdf8);
    this.spawnShockwave(newVec, 0x38bdf8, entity.radius * 2.1, 1.0);
    this.spawnShockwave(newVec, 0xfacc15, entity.radius * 1.5, 0.85);
    this.spawnImpactSparks(newVec);

    this.onCastlesUpdated?.([...this.castlesList]);
    return [...newPos];
  }

  public setMarchVisual(
    visual: {
      from: [number, number, number];
      to: [number, number, number];
      progress01: number;
      label: string;
      isReturning?: boolean;
      inCombatOrGathering?: boolean;
      resourceType?: string;
    } | null
  ) {
    if (!this.worldMapBuilt) {
      this.pendingMarchVisual = visual;
      return;
    }
    this.externalMarchVisual = visual;
    if (!visual) {
      if (this.armyState === 'IDLE') {
        this.armyGroup.visible = false;
        this.tacticalLine.visible = false;
      }
      return;
    }

    const t = Math.max(0, Math.min(1, visual.progress01));
    const ax = THREE.MathUtils.lerp(visual.from[0], visual.to[0], t);
    const az = THREE.MathUtils.lerp(visual.from[2], visual.to[2], t);
    const ay = this.getGroundHeight(ax, az);

    this.armyGroup.position.set(ax, ay, az);
    this.armyPos.set(ax, ay, az);
    this.armyGroup.visible = this.currentSceneMode === 'world';

    const dx = visual.to[0] - visual.from[0];
    const dz = visual.to[2] - visual.from[2];
    if (Math.hypot(dx, dz) > 0.1) {
      this.armyGroup.rotation.y = Math.atan2(dx, dz);
    }

    this.tacticalLine.visible = this.currentSceneMode === 'world';
    this._linePts[0].set(ax, ay + 0.35, az);
    this._linePts[1].set(visual.to[0], this.getGroundHeight(visual.to[0], visual.to[2]) + 0.35, visual.to[2]);
    this.tacticalLine.geometry.setFromPoints(this._linePts);
  }

  private ensureUnitShadowMat(): THREE.MeshBasicMaterial {
    if (!this.unitShadowMat) {
      this.unitShadowMat = createContactShadowMaterial('radial', 0.58);
    }
    return this.unitShadowMat;
  }

  private syncSunLightAndShadows(camZoom: number, shadowState: ShadowProjectionState) {
    const target = this.cameraController.target;
    const sCam = this.sunLight.shadow.camera;

    // Quantized zoom-aware frustum sizing (prevents shadow edge shimmering while zooming smoothly)
    const rawHalf = THREE.MathUtils.clamp(84 / Math.max(0.22, camZoom), 78, 224);
    const desiredHalf = Math.round(rawHalf / 4) * 4;
    if (Math.abs(desiredHalf - this.currentShadowHalfExtent) >= 4) {
      this.currentShadowHalfExtent = desiredHalf;
      sCam.left = -desiredHalf;
      sCam.right = desiredHalf;
      sCam.top = desiredHalf;
      sCam.bottom = -desiredHalf;
      sCam.updateProjectionMatrix();
    }

    this._shadowDir.copy(shadowState.sunOffset).normalize();

    if (!this.isSoftwareGl && this.sunLight.castShadow) {
      this._shadowDummyCam.position.copy(target).addScaledVector(this._shadowDir, 230);
      this._shadowDummyCam.up.set(0, 1, 0);
      this._shadowDummyCam.lookAt(target);
      this._shadowDummyCam.updateMatrix();
      this._shadowSnapInv.copy(this._shadowDummyCam.matrix).invert();

      const mapW = Math.max(512, this.sunLight.shadow.mapSize.x);
      const texelSize = (this.currentShadowHalfExtent * 2) / mapW;
      this._shadowSnapVec.copy(target).applyMatrix4(this._shadowSnapInv);
      this._shadowSnapVec.x = Math.round(this._shadowSnapVec.x / texelSize) * texelSize;
      this._shadowSnapVec.y = Math.round(this._shadowSnapVec.y / texelSize) * texelSize;
      this._shadowSnapVec.applyMatrix4(this._shadowDummyCam.matrix);

      this.sunLight.target.position.copy(this._shadowSnapVec);
      this.sunLight.position.copy(this._shadowSnapVec).addScaledVector(this._shadowDir, 230);
    } else {
      this.sunLight.target.position.copy(target);
      this.sunLight.position.copy(target).addScaledVector(this._shadowDir, 230);
    }
    this.sunLight.target.updateMatrixWorld();
  }

  private createAlliedColumnGroup(): { group: THREE.Group; sprites: THREE.Sprite[] } {
    const colGroup = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.82 });
    const unitShadowGeo = new THREE.PlaneGeometry(1.25, 1.25);
    const unitShadowMat = this.ensureUnitShadowMat();

    if (!this.alliedWarriorSpriteMatWest || !this.alliedWarriorSpriteMatEast) {
      const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      const alliedTex = getSharedMagarWarriorDirectionalTextures(4, maxAniso, (readyAspect, readyWest, readyEast) => {
        this.alliedWarriorAspect = readyAspect;
        if (this.alliedWarriorSpriteMatWest) {
          this.alliedWarriorSpriteMatWest.map = readyWest;
          this.alliedWarriorSpriteMatWest.visible = true;
          this.alliedWarriorSpriteMatWest.needsUpdate = true;
        }
        if (this.alliedWarriorSpriteMatEast) {
          this.alliedWarriorSpriteMatEast.map = readyEast;
          this.alliedWarriorSpriteMatEast.visible = true;
          this.alliedWarriorSpriteMatEast.needsUpdate = true;
        }
        for (let i = 0; i < this.alliedWarriorSprites.length; i++) {
          const sp = this.alliedWarriorSprites[i];
          const bh = sp.userData?.baseHeight ?? 2.65;
          sp.scale.set(bh * readyAspect, bh, 1);
        }
      });
      this.alliedWarriorAspect = alliedTex.aspectRatio;
      this.alliedWarriorSpriteMatWest = new THREE.SpriteMaterial({
        map: alliedTex.westTexture,
        color: 0xe0f2fe,
        transparent: true,
        alphaTest: 0.05,
        depthWrite: true,
        side: THREE.DoubleSide,
        visible: Boolean(alliedTex.westTexture),
      });
      this.alliedWarriorSpriteMatEast = new THREE.SpriteMaterial({
        map: alliedTex.eastTexture,
        color: 0xe0f2fe,
        transparent: true,
        alphaTest: 0.05,
        depthWrite: true,
        side: THREE.DoubleSide,
        visible: Boolean(alliedTex.eastTexture),
      });
    }

    // Allied Sky-Blue Ground Facing Ring + Forward Chevron (+Z forward)
    const alliedRing = new THREE.Mesh(
      new THREE.RingGeometry(1.75, 2.05, 28),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      })
    );
    alliedRing.rotation.x = -Math.PI / 2;
    alliedRing.position.set(0, 0.09, 0.25);
    colGroup.add(alliedRing);

    const alliedChevron = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.0, 3),
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
    );
    alliedChevron.rotation.x = Math.PI / 2;
    alliedChevron.scale.set(1, 1, 0.14);
    alliedChevron.position.set(0, 0.13, 2.75);
    colGroup.add(alliedChevron);

    // 6-troop allied Magar Elite formation (Front row z = +1.05 leading with Flag-Bearer, Rear row z = -0.35)
    const columnSprites: THREE.Sprite[] = [];
    for (let i = 0; i < 6; i++) {
      const warrior = new THREE.Group();
      const c = i % 3;
      const r = Math.floor(i / 3);
      const isFrontRow = r === 0;
      warrior.position.set((c - 1) * 1.15, 0, isFrontRow ? 1.05 : -0.35);
      warrior.userData = { idx: i, isWarriorUnit: true };

      const shadowDisc = new THREE.Mesh(unitShadowGeo, unitShadowMat);
      shadowDisc.rotation.x = -Math.PI / 2;
      shadowDisc.position.y = 0.04;
      warrior.add(shadowDisc);

      const baseHeight = isFrontRow && c === 1 ? 3.05 : 2.65;
      const wSprite = new THREE.Sprite(this.alliedWarriorSpriteMatWest);
      wSprite.center.set(0.5, 0);
      wSprite.position.y = 0.05;
      wSprite.scale.set(baseHeight * this.alliedWarriorAspect, baseHeight, 1);
      wSprite.renderOrder = 11;
      wSprite.frustumCulled = false;
      wSprite.userData = { baseHeight };
      warrior.add(wSprite);
      this.alliedWarriorSprites.push(wSprite);
      columnSprites.push(wSprite);

      // Front center Flag-Bearer leads the Allied column
      if (isFrontRow && c === 1) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 4.2, 6), goldMat);
        pole.position.set(-0.55, 2.1, 0.15);
        warrior.add(pole);

        const flag = new THREE.Mesh(
          new THREE.PlaneGeometry(1.4, 2.0),
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.45,
            side: THREE.DoubleSide,
          })
        );
        flag.position.set(0.2, 3.1, 0.15);
        flag.userData = { isArmyBanner: true };
        warrior.add(flag);
      }

      colGroup.add(warrior);
    }

    return { group: colGroup, sprites: columnSprites };
  }

  public setAlliedRallyColumns(
    columns: Array<{
      id: string;
      from: [number, number, number];
      to: [number, number, number];
      progress01: number;
      isReturning?: boolean;
    }>
  ) {
    if (!this.worldMapBuilt) {
      this.pendingAlliedColumns = columns;
      return;
    }
    const activeIds = new Set<string>();
    for (const col of columns) {
      activeIds.add(col.id);
      let entry = this.alliedRallyColumns.get(col.id);
      if (!entry) {
        const built = this.createAlliedColumnGroup();
        const pts: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineDashedMaterial({
          color: 0x38bdf8,
          dashSize: 1.4,
          gapSize: 0.9,
          transparent: true,
          opacity: 0.85,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        this.alliedRallyGroup.add(built.group);
        this.alliedRallyGroup.add(line);
        entry = {
          group: built.group,
          line,
          pts,
          isActive: true,
          sprites: built.sprites,
          facingEast: false,
        };
        this.alliedRallyColumns.set(col.id, entry);
      }

      const t = Math.max(0, Math.min(1, col.progress01));
      const ax = THREE.MathUtils.lerp(col.from[0], col.to[0], t);
      const az = THREE.MathUtils.lerp(col.from[2], col.to[2], t);
      const ay = this.getGroundHeight(ax, az);

      entry.group.position.set(ax, ay, az);
      entry.group.visible = this.currentSceneMode === 'world';

      const dx = col.to[0] - col.from[0];
      const dz = col.to[2] - col.from[2];
      if (Math.hypot(dx, dz) > 0.1) {
        entry.group.rotation.y = Math.atan2(dx, dz);
      }

      const toY = this.getGroundHeight(col.to[0], col.to[2]);
      entry.pts[0].set(ax, ay + 0.4, az);
      entry.pts[1].set(col.to[0], toY + 0.4, col.to[2]);
      entry.line.geometry.setFromPoints(entry.pts);
      entry.line.computeLineDistances();
      entry.line.visible = this.currentSceneMode === 'world';
    }

    // Remove inactive allied columns cleanly
    for (const [id, entry] of this.alliedRallyColumns.entries()) {
      if (!activeIds.has(id)) {
        this.alliedRallyGroup.remove(entry.group);
        this.alliedRallyGroup.remove(entry.line);
        entry.line.geometry.dispose();
        (entry.line.material as THREE.Material).dispose();
        this.alliedRallyColumns.delete(id);
      }
    }
  }

  public triggerCombatVfxAtTarget(targetId: string, damageText: string, color = '#ff4d4f', isHeavy = false) {
    const ent = this.entitiesMap.get(targetId);
    if (!ent) return;
    const meshGroup =
      ent.category === 'monster'
        ? this.monsterMeshesMap.get(targetId)
        : ent.category === 'resource'
          ? this.resourceMeshesMap.get(targetId)
          : this.buildingMeshesMap.get(targetId);
    if (!meshGroup) return;

    const proj = meshGroup.position.clone();
    proj.y += ent.category === 'monster' ? 2.5 : 4.5;
    if (ent.category === 'resource') {
      this.spawnDebrisChips(meshGroup.position, ent.resourceType === 'crystal' ? 'iron' : ent.subtype);
      this.spawnImpactSparks(proj);
    } else {
      this.spawnSiegeVolley(this.armyGroup.position, meshGroup.position, isHeavy);
      this.alliedRallyColumns.forEach((colEntry) => {
        if (colEntry.group.visible) {
          this.spawnSiegeVolley(colEntry.group.position, meshGroup.position, true);
        }
      });
      this.triggerFlinchShake(meshGroup);
      this.spawnImpactSparks(proj);
      this.spawnShockwave(meshGroup.position, isHeavy ? 0xfacc15 : 0xf87171, Math.max(4.5, ent.radius * 0.9), 0.5);
    }

    proj.project(this.cameraController.camera);
    const screenX = ((proj.x + 1) * this.container.clientWidth) / 2;
    const screenY = ((-proj.y + 1) * this.container.clientHeight) / 2;
    this.onAddCombatFloater?.(damageText, color, screenX, screenY - 22);
  }

  public conquerStructureById(structureId: string, silent = false) {
    if (!this.worldMapBuilt) {
      this.pendingNeutralStructures.delete(structureId);
      this.pendingConqueredStructures.add(structureId);
      return;
    }
    const ent = this.entitiesMap.get(structureId);
    const meshGroup = this.buildingMeshesMap.get(structureId);
    if (ent && meshGroup) {
      this.conquerStructure(ent, meshGroup, silent);
    }
  }

  // ============================================================
  // 6. ENHANCED DAMAGE VFX (Sparks, Cracks, Flinch Shake, Smoke)
  // ============================================================
  private triggerFlinchShake(group: THREE.Group) {
    this.activeFlinchShakes.push({
      group,
      basePos: group.position.clone(),
      timer: 0.25,
      maxTimer: 0.25,
    });
  }

  private spawnImpactSparks(pos: THREE.Vector3) {
    this.vfxManager?.spawnBurst(pos, 'spark', 8, { speed: 5.5, gravity: -11, life: 0.45 });
    for (let i = 0; i < 10; i++) {
      const spark = new THREE.Mesh(this.sharedSparkGeo, this.sharedSparkMat);
      spark.position.set(
        pos.x + (Math.random() - 0.5) * 0.8,
        pos.y + 1.2 + Math.random() * 1.0,
        pos.z + (Math.random() - 0.5) * 0.8
      );
      this.scene.add(spark);

      this.activeSparks.push({
        mesh: spark,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 6.5,
          4.0 + Math.random() * 5.5,
          (Math.random() - 0.5) * 6.5
        ),
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
      });
    }
  }

  private spawnDebrisChips(pos: THREE.Vector3, type = 'stone') {
    const chipColor = type === 'wood' ? 0x8b5a2b : type === 'gold' ? 0xf59e0b : type === 'iron' ? 0x94a3b8 : 0x475569;
    const mat = new THREE.MeshStandardMaterial({ color: chipColor, roughness: 0.7 });
    for (let i = 0; i < 6; i++) {
      const chip = new THREE.Mesh(this.sharedChipGeo, mat);
      chip.position.set(pos.x + (Math.random() - 0.5) * 1.5, pos.y + 0.8 + Math.random() * 0.8, pos.z + (Math.random() - 0.5) * 1.5);
      this.scene.add(chip);

      this.activeMiningChips.push({
        mesh: chip,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 4.0, 3.8 + Math.random() * 3.5, (Math.random() - 0.5) * 4.0),
        rotSpeed: (Math.random() - 0.5) * 12,
        life: 0,
        maxLife: 0.75 + Math.random() * 0.3,
      });
    }
  }

  private spawnSiegeVolley(from: THREE.Vector3, to: THREE.Vector3, isHeavySiege: boolean) {
    // 1. Arrow Volley (3 glowing arrows arcing into enemy ranks/walls)
    for (let i = 0; i < 3; i++) {
      const arrow = new THREE.Mesh(this.sharedArrowGeo, this.sharedArrowMat);
      const startP = new THREE.Vector3(
        from.x + (Math.random() - 0.5) * 3.0,
        from.y + 1.8,
        from.z + (Math.random() - 0.5) * 3.0
      );
      const endP = new THREE.Vector3(
        to.x + (Math.random() - 0.5) * 4.5,
        to.y + (isHeavySiege ? 6.0 : 2.0),
        to.z + (Math.random() - 0.5) * 4.5
      );
      arrow.position.copy(startP);
      this.scene.add(arrow);
      this.activeProjectiles.push({
        mesh: arrow,
        startPos: startP,
        endPos: endP,
        arcHeight: 4.5 + Math.random() * 2.5,
        life: -i * 0.06,
        maxLife: 0.36,
        isBoulder: false,
      });
    }

    // 2. Flaming Siege Catapult Boulder on structures & heavy bosses
    if (isHeavySiege) {
      const boulder = new THREE.Mesh(this.sharedBoulderGeo, this.sharedBoulderMat);
      const startP = new THREE.Vector3(from.x, from.y + 2.2, from.z);
      const endP = new THREE.Vector3(to.x + (Math.random() - 0.5) * 3.5, to.y + 5.0, to.z + (Math.random() - 0.5) * 3.5);
      boulder.position.copy(startP);
      this.scene.add(boulder);
      this.activeProjectiles.push({
        mesh: boulder,
        startPos: startP,
        endPos: endP,
        arcHeight: 11.5,
        life: 0,
        maxLife: 0.52,
        isBoulder: true,
      });
    }
  }

  private spawnShockwave(pos: THREE.Vector3, colorHex: number, maxScale: number, duration = 0.55) {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(this.sharedShockwaveGeo, mat);
    ring.position.set(pos.x, pos.y + 0.55, pos.z);
    ring.scale.setScalar(0.6);
    this.scene.add(ring);
    this.activeShockwaves.push({
      mesh: ring,
      life: 0,
      maxLife: duration,
      maxScale,
    });
  }

  private spawnConquestPillar(pos: THREE.Vector3, colorHex = 0x10b981) {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const pillar = new THREE.Mesh(this.sharedPillarGeo, mat);
    pillar.position.set(pos.x, pos.y + 36, pos.z);
    this.scene.add(pillar);
    this.activeConquestBeams.push({
      mesh: pillar,
      life: 0,
      maxLife: 3.2,
    });
  }

  private conquerStructure(entity: WorldEntity, meshGroup: THREE.Group, silent = false) {
    const tagBracket = `[${this.playerAlliance.tag}]`;
    entity.ownerFaction = 'alliance';
    entity.conqueredBy = `Lord Dangol ${tagBracket} · ${this.playerAlliance.alias}`;
    entity.health = entity.maxHealth ?? 5000;
    entity.actions = ['garrison', 'upgrade', 'inspect'];

    const refs = this.buildingConquestRefs.get(entity.id);
    if (refs) {
      if (entity.type === 'congress') {
        for (const m of refs.crystalMeshes) {
          m.material = this.conqueredCrystalMat;
        }
      }
      if (refs.ringMesh) {
        refs.ringMesh.material = this.conqueredRingMat;
      }
      // Replace floating badge with Conquered Alliance Sovereign badge
      meshGroup.remove(refs.badgeSprite);
      if (refs.badgeSprite.material.map) refs.badgeSprite.material.map.dispose();
      refs.badgeSprite.material.dispose();
      const isCongress = entity.type === 'congress';
      const newBadge = this.createFloatingBadgeSprite(
        entity.name.toUpperCase(),
        `${tagBracket} ${this.playerAlliance.alias}`,
        isCongress ? '👑 IMPERIAL SOVEREIGNTY 👑' : `⚔️ HELD · ${entity.buffLabel || 'ALLIANCE'}`,
        '#10b981',
        '#fde047',
        isCongress ? 19.5 : 15.0,
        isCongress ? 5.8 : 4.5
      );
      newBadge.position.set(0, refs.badgeY, 0);
      meshGroup.add(newBadge);
      refs.badgeSprite = newBadge;
    }

    if (silent) return;

    const origin = meshGroup.position;
    this.spawnConquestPillar(origin, entity.type === 'congress' ? 0xfacc15 : 0x10b981);
    this.spawnShockwave(origin, 0xfacc15, entity.radius * 1.9, 0.9);
    this.spawnShockwave(origin, 0x10b981, entity.radius * 2.5, 1.2);
    this.spawnImpactSparks(origin);

    const buffLabel = entity.buffLabel || '+5% Territory Buff';
    this.onStructureConquered?.(entity, buffLabel);
  }

  public setStructureNeutral(structureId: string) {
    if (!this.worldMapBuilt) {
      this.pendingConqueredStructures.delete(structureId);
      this.pendingNeutralStructures.add(structureId);
      return;
    }
    const entity = this.entitiesMap.get(structureId);
    const meshGroup = this.buildingMeshesMap.get(structureId);
    if (!entity || !meshGroup) return;

    entity.ownerFaction = 'neutral';
    entity.conqueredBy = undefined;
    entity.health = entity.maxHealth ?? 5000;
    entity.actions = ['attack', 'rally', 'scout', 'inspect'];

    const refs = this.buildingConquestRefs.get(structureId);
    if (refs) {
      refs.crystalMeshes.forEach((m, idx) => {
        if (refs.neutralCrystalMats[idx]) {
          m.material = refs.neutralCrystalMats[idx];
        }
      });
      if (refs.ringMesh && refs.neutralRingMat) {
        refs.ringMesh.material = refs.neutralRingMat;
      }
      meshGroup.remove(refs.badgeSprite);
      if (refs.badgeSprite.material.map) refs.badgeSprite.material.map.dispose();
      refs.badgeSprite.material.dispose();

      const nb = refs.neutralBadge;
      const neutralSprite = this.createFloatingBadgeSprite(
        nb.title,
        nb.subtitle,
        nb.starsText,
        nb.borderColor,
        nb.accentColor,
        nb.scaleW,
        nb.scaleH
      );
      neutralSprite.position.set(0, refs.badgeY, 0);
      meshGroup.add(neutralSprite);
      refs.badgeSprite = neutralSprite;
    }

    this.spawnShockwave(meshGroup.position, 0x38bdf8, entity.radius * 1.6, 0.7);
  }

  public setAllianceIdentity(identity: PlayerAllianceIdentity) {
    this.playerAlliance = identity;
    const tagBracket = `[${identity.tag}]`;

    // Update all player & alliance castle data + floating badges
    for (const castle of this.castlesList) {
      if (castle.faction === 'enemy') continue;
      castle.allianceTag = tagBracket;
      castle.allianceAlias = identity.alias;

      const entity = this.entitiesMap.get(castle.id);
      if (entity) {
        entity.description = `${tagBracket} ${identity.alias} · ${castle.owner}'s fortified stronghold.`;
      }

      const ref = this.castleBadgeRefs.get(castle.id);
      if (ref) {
        ref.group.remove(ref.badgeSprite);
        if (ref.badgeSprite.material.map) ref.badgeSprite.material.map.dispose();
        ref.badgeSprite.material.dispose();

        const isMine = castle.isMyCastle;
        const newBadge = this.createFloatingBadgeSprite(
          isMine ? '🏰 MY CASTLE (LORD DANGOL)' : `🛡️ ${castle.owner.toUpperCase()}`,
          `${tagBracket} ${identity.alias} · Lv.${castle.level}`,
          isMine ? '👑 MY CASTLE 👑' : `⚔️ [${castle.position[0]}, ${castle.position[2]}] ALLIANCE`,
          isMine ? '#10b981' : '#38bdf8',
          isMine ? '#fde047' : '#93c5fd',
          isMine ? 17.5 : 14.5,
          isMine ? 5.2 : 4.4
        );
        newBadge.position.set(0, ref.badgeY, 0);
        ref.group.add(newBadge);
        ref.badgeSprite = newBadge;
      }
    }

    // Refresh badges on any already-conquered Shrines or Congress
    this.buildingConquestRefs.forEach((refs, id) => {
      const entity = this.entitiesMap.get(id);
      if (!entity || entity.ownerFaction !== 'alliance') return;
      entity.conqueredBy = `Lord Dangol ${tagBracket} · ${identity.alias}`;
      refs.group.remove(refs.badgeSprite);
      if (refs.badgeSprite.material.map) refs.badgeSprite.material.map.dispose();
      refs.badgeSprite.material.dispose();
      const isCongress = entity.type === 'congress';
      const newBadge = this.createFloatingBadgeSprite(
        entity.name.toUpperCase(),
        `${tagBracket} ${identity.alias}`,
        isCongress ? '👑 IMPERIAL SOVEREIGNTY 👑' : `⚔️ HELD · ${entity.buffLabel || 'ALLIANCE'}`,
        '#10b981',
        '#fde047',
        isCongress ? 19.5 : 15.0,
        isCongress ? 5.8 : 4.5
      );
      newBadge.position.set(0, refs.badgeY, 0);
      refs.group.add(newBadge);
      refs.badgeSprite = newBadge;
    });

    this.onCastlesUpdated?.([...this.castlesList]);
  }

  private applyCombatStrike(target: WorldEntity, damage: number) {
    const entity = this.entitiesMap.get(target.id);
    if (!entity || entity.isDefeated) return;

    const isMonster = entity.category === 'monster';
    const isEnemyCastle = entity.type === 'enemy_castle';
    const isConquerableStructure =
      entity.type === 'shrine_c' ||
      entity.type === 'shrine_b' ||
      entity.type === 'shrine_a' ||
      entity.type === 'congress';

    const meshGroup = isMonster
      ? this.monsterMeshesMap.get(entity.id)
      : this.buildingMeshesMap.get(entity.id);
    if (!meshGroup) return;

    const curHp = entity.health ?? 200;
    const newHp = Math.max(0, curHp - damage);
    entity.health = newHp;
    const isZero = newHp <= 0;

    this._tempProj.copy(meshGroup.position);
    this._tempProj.y += isMonster ? 2.5 : 8.5;

    this.spawnSiegeVolley(this.armyGroup.position, meshGroup.position, !isMonster || entity.subtype === 'boss');
    this.triggerFlinchShake(meshGroup);
    this.spawnImpactSparks(this._tempProj);
    this.spawnDebrisChips(this._tempProj, isMonster ? 'stone' : 'gold');
    this.spawnShockwave(meshGroup.position, isMonster ? 0xf87171 : 0xfacc15, isMonster ? 4.5 : entity.radius * 0.95, 0.45);

    this._tempProj.project(this.cameraController.camera);
    const screenX = ((this._tempProj.x + 1) * this.container.clientWidth) / 2;
    const screenY = ((-this._tempProj.y + 1) * this.container.clientHeight) / 2;

    if (!isZero) {
      this.onAddCombatFloater?.(`-${damage.toLocaleString()} HP`, '#ff4d4f', screenX, screenY - 20);
      this.onAddCombatFloater?.(isMonster ? '⚔️ CLASH' : '☄️ SIEGE HIT!', '#dfba6e', screenX, screenY - 45);

      if (isEnemyCastle) {
        this.setCastleBurningState(entity.id, true, newHp, entity.maxHealth ?? 45000);
      }

      if (isMonster) {
        meshGroup.traverse((child) => {
          const m = child as THREE.Mesh;
          if (m.isMesh && m.material) {
            (m.material as any).color?.setHex(0xffffff);
            this.activeHitFlashes.push({ mesh: m, timer: 0.18, maxTimer: 0.18 });
          }
        });
      }
      return;
    }

    // Target reached 0 HP -> Handle victory by target type!
    if (isMonster) {
      this.onAddCombatFloater?.(`-${damage} HP CRIT!`, '#ff2222', screenX, screenY - 10);
      this.onAddCombatFloater?.('💨 DISSOLVED INTO SMOKE', '#e2e8f0', screenX, screenY - 35);
      this.onAddCombatFloater?.('💀 VANQUISHED!', '#dfba6e', screenX, screenY - 60);

      entity.isDefeated = true;
      this.dissolveMonsterIntoSmoke(meshGroup, 'monster');
      this.onMonsterDefeated?.(entity);
    } else if (isEnemyCastle) {
      this.onAddCombatFloater?.('🔥 CITADEL BREACHED!', '#ff4d4f', screenX, screenY - 15);
      this.onAddCombatFloater?.('🌀 RANDOM TELEPORT!', '#38bdf8', screenX, screenY - 45);

      this.teleportEnemyCastle(entity.id);
      this.onEnemyCastleDefeated?.(entity);
    } else if (isConquerableStructure) {
      this.onAddCombatFloater?.('👑 CONQUERED!', '#10b981', screenX, screenY - 18);
      this.onAddCombatFloater?.(`✨ ${entity.buffLabel || 'ALLIANCE BUFF'}`, '#fde047', screenX, screenY - 48);
      this.conquerStructure(entity, meshGroup);
    }

    this.armyState = 'RETURNING';
    this.totalMarchDist = this.armyGroup.position.distanceTo(this.armyHomePos);
  }

  private spawnSiegeSmokeBurst(origin: THREE.Vector3, count = 14) {
    const darkShades = [0x1e293b, 0x334155, 0x475569, 0x64748b];
    const maxAllowed = Math.min(count, Math.max(4, 180 - this.activeSmokeParticles.length));
    for (let i = 0; i < maxAllowed; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: darkShades[Math.floor(Math.random() * darkShades.length)],
        roughness: 0.96,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      });
      const puff = new THREE.Mesh(this.sharedSmokeGeo, mat);
      puff.position.set(
        origin.x + (Math.random() - 0.5) * 9.5,
        origin.y + 4.0 + Math.random() * 6.5,
        origin.z + (Math.random() - 0.5) * 9.5
      );
      this.scene.add(puff);

      this.activeSmokeParticles.push({
        mesh: puff,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 3.0,
          3.4 + Math.random() * 3.6,
          (Math.random() - 0.5) * 3.0
        ),
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3
        ),
        life: 0,
        maxLife: 2.1 + Math.random() * 0.7,
        initialScale: 0.8 + Math.random() * 0.5,
        targetScale: 4.2 + Math.random() * 1.8,
      });
    }
  }

  private dissolveMonsterIntoSmoke(group: THREE.Group, variant: 'monster' | 'resource' = 'monster') {
    group.visible = false;
    const origin = group.position;

    const smokeShades =
      variant === 'resource'
        ? [0xf5f5f4, 0xe7e5e4, 0xd6d3d1, 0xa8a29e]
        : [0xf1f5f9, 0xe2e8f0, 0xcbd5e1, 0x94a3b8];
    const puffCount = Math.min(28, Math.max(8, 185 - this.activeSmokeParticles.length));
    const spread = variant === 'resource' ? 3.2 : 2.2;
    for (let i = 0; i < puffCount; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: smokeShades[Math.floor(Math.random() * smokeShades.length)],
        roughness: 0.95,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      });
      const puff = new THREE.Mesh(this.sharedSmokeGeo, mat);
      puff.position.set(
        origin.x + (Math.random() - 0.5) * spread,
        origin.y + 0.5 + Math.random() * 1.8,
        origin.z + (Math.random() - 0.5) * spread
      );
      this.scene.add(puff);

      this.activeSmokeParticles.push({
        mesh: puff,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 2.4, 2.5 + Math.random() * 3.2, (Math.random() - 0.5) * 2.4),
        rotSpeed: new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4),
        life: 0,
        maxLife: 2.0 + Math.random() * 0.6,
        initialScale: 0.45 + Math.random() * 0.35,
        targetScale: 2.9 + Math.random() * 1.4,
      });
    }
  }

  private spawnMarchingDustPuff(pos: THREE.Vector3) {
    const dustMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3d1,
      roughness: 0.95,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    });
    const puff = new THREE.Mesh(this.sharedDustGeo, dustMat);
    puff.position.set(
      pos.x + (Math.random() - 0.5) * 1.4,
      pos.y + 0.15,
      pos.z + (Math.random() - 0.5) * 1.4
    );
    this.scene.add(puff);

    this.activeDustPuffs.push({
      mesh: puff,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        0.9 + Math.random() * 0.8,
        (Math.random() - 0.5) * 0.6
      ),
      life: 0,
      maxLife: 0.85 + Math.random() * 0.35,
      initialScale: 0.4,
    });
  }

  // ============================================================
  // 7. HIGH-PERFORMANCE ANIMATION & RENDER LOOP (Zero-GC + Software-GL Pacing)
  // ============================================================
  private startLoop() {
    if (this.isDisposed || this.isContextLost) return;

    const afterDraw = (cb: () => void) => {
      if (this.isDisposed || this.isContextLost) return;
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      if (!gl || gl.isContextLost() || !gl.fenceSync) {
        this.animFrameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.isDisposed || this.isContextLost || gl.isContextLost()) {
          if (sync) {
            try {
              gl.deleteSync(sync);
            } catch {
              // Ignore on lost context
            }
          }
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.animFrameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.animFrameId = window.setTimeout(cb, 80);
        }
      };
      this.animFrameId = window.setTimeout(poll, 5);
    };

    const loop = () => {
      if (this.isDisposed || this.isContextLost) return;
      const gl = this.renderer.getContext();
      if (!gl || gl.isContextLost()) {
        this.isContextLost = true;
        return;
      }

      if (!this.hasCompiledScene && !this.isSoftwareGl) {
        this.hasCompiledScene = true;
        this.renderer.compile(this.scene, this.cameraController.camera);
        if (gl.isContextLost()) {
          this.isContextLost = true;
          return;
        }
      }

      const nowMs = performance.now();
      if (this.lastPerfTickMs > 0) {
        const frameGap = Math.min(120, Math.max(4, nowMs - this.lastPerfTickMs));
        this.perfEmaMs = this.perfEmaMs * 0.92 + frameGap * 0.08;
        if (this.perfCooldownFrames > 0) {
          this.perfCooldownFrames--;
        } else if (!this.isSoftwareGl) {
          if (this.qualityTier === 'high' && this.perfEmaMs > 26) {
            this.applyQualityTier('balanced');
            this.perfCooldownFrames = 120;
          } else if (this.qualityTier === 'balanced' && this.perfEmaMs > 36) {
            this.applyQualityTier('performance');
            this.perfCooldownFrames = 140;
          } else if (this.qualityTier === 'performance' && this.perfEmaMs < 18.2) {
            this.applyQualityTier('balanced');
            this.perfCooldownFrames = 180;
          } else if (this.qualityTier === 'balanced' && this.perfEmaMs < 17.4) {
            this.applyQualityTier('high');
            this.perfCooldownFrames = 200;
          }
        }
      }
      this.lastPerfTickMs = nowMs;

      const delta = Math.min(0.1, this.clock.getDelta());
      const elapsed = this.clock.getElapsedTime();

      this.cameraController.update(delta);

      // Dynamically scale fog density with zoom so Zoom Out 100 keeps the whole 3200x3200 green continent crisp
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = 0.00042 * Math.min(1.0, Math.max(0.06, (this.cameraController.zoom - 0.015) / 0.85));
      }

      const isWorldVisible = this.currentSceneMode === 'world' && this.worldMapBuilt;

      // 0. Update Regional LOD Chunks, Waterfalls, Smooth Rivers & Mist (paused while inside Kingdom)
      if (isWorldVisible && this.terrainGenerator) {
        this.terrainGenerator.updateTerrainOverflow(delta, elapsed, this.cameraController.camera);
      }

      // 0b. Update Drifting Clouds & Soaring Himalayan Birds
      if (isWorldVisible && this.atmosphereGroup.visible) {
        for (let i = 0; i < this.atmosphericClouds.length; i++) {
          const c = this.atmosphericClouds[i];
          c.group.position.x += c.speedX * delta;
          c.group.position.z += c.speedZ * delta;
          if (c.group.position.x > 3650) c.group.position.x = -450;
          if (c.group.position.z > 3550) c.group.position.z = -350;
          else if (c.group.position.z < -350) c.group.position.z = 3550;
          c.group.position.y = c.baseY + Math.sin(elapsed * 0.42 + c.phase) * c.bobAmp;
        }
        for (let i = 0; i < this.soaringEagles.length; i++) {
          const e = this.soaringEagles[i];
          const ang = elapsed * e.speed + e.phase;
          const nx = e.cx + Math.cos(ang) * e.radius;
          const nz = e.cz + Math.sin(ang) * e.radius;
          e.group.position.set(nx, e.baseY + Math.sin(elapsed * 1.4 + e.phase) * 1.9, nz);
          e.group.rotation.y = -ang;
          e.group.rotation.z = e.bankTilt;
          const flap = Math.sin(elapsed * e.flapSpeed + e.phase) * 0.44;
          const ch = e.group.children;
          for (let j = 0; j < ch.length; j++) {
            if (ch[j].userData?.isEagleWingLeft) ch[j].rotation.z = flap;
            else if (ch[j].userData?.isEagleWingRight) ch[j].rotation.z = -flap;
          }
        }
      }

      const shadowState = this.environmentManager.getShadowState();
      const camYaw = this.cameraController.getYaw();
      const sinYaw = Math.sin(camYaw);
      const cosYaw = Math.cos(camYaw);
      const camMatrixElems = this.cameraController.camera.matrixWorld.elements;
      const camRightX = camMatrixElems[0];
      const camRightZ = camMatrixElems[2];

      if (isWorldVisible) {
      // 1. Monsters idle breathing, dynamic East-West camera-relative facing, contact shadow & aura chevron
      this.monsterMeshesMap.forEach((mGroup, id) => {
        const ent = this.entitiesMap.get(id);
        if (!ent || ent.isDefeated) return;
        const seed = (ent.position[0] * 0.08 + ent.position[2] * 0.05) % 10;
        const breath = Math.sin(elapsed * 2.2 + seed);

        const mUd = mGroup.userData;
        if (mUd && mUd.monsterSprite && mUd.spriteEntry) {
          let monsterYaw = typeof mUd.facingYaw === 'number' ? mUd.facingYaw : 0;
          if (this.armyGroup.visible) {
            const distSq =
              (this.armyGroup.position.x - mGroup.position.x) ** 2 +
              (this.armyGroup.position.z - mGroup.position.z) ** 2;
            if (distSq < 400) {
              monsterYaw = Math.atan2(
                this.armyGroup.position.x - mGroup.position.x,
                this.armyGroup.position.z - mGroup.position.z
              );
              if (mUd.auraDirGroup) {
                mUd.auraDirGroup.rotation.y = monsterYaw;
              }
            } else if (mUd.auraDirGroup && Math.abs(mUd.auraDirGroup.rotation.y - monsterYaw) > 0.01) {
              mUd.auraDirGroup.rotation.y = monsterYaw;
            }
          }
          const mDotRight = Math.sin(monsterYaw) * camRightX + Math.cos(monsterYaw) * camRightZ;
          let nextEast = Boolean(mUd.facingEast);
          if (mDotRight > 0.06) nextEast = true;
          else if (mDotRight < -0.06) nextEast = false;
          if (nextEast !== mUd.facingEast) {
            mUd.facingEast = nextEast;
            mUd.monsterSprite.material = nextEast ? mUd.spriteEntry.matEast : mUd.spriteEntry.matWest;
          }
        }

        const children = mGroup.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const ud = child.userData;
          if (!ud) continue;
          if (ud.belowTagDist) {
            child.position.set(sinYaw * ud.belowTagDist, ud.belowTagY ?? 0.25, cosYaw * ud.belowTagDist);
          } else if (ud.isMonsterBodyRoot) {
            // Planted-feet idle pose: gentle vertical breathing only, zero lateral sway or hover drift
            child.scale.set(
              1.0 - breath * 0.012,
              1.0 + breath * 0.022,
              1.0
            );
            child.position.set(0, ud.baseY ?? 0, 0);
          } else if (ud.isContactShadow) {
            const sPulse = 1.0 - breath * 0.025;
            child.scale.set(sPulse, sPulse, 1);
          } else if (ud.isDirectionalMonsterShadow) {
            const sPulse = 1.0 - breath * 0.02;
            const spriteH = typeof ud.spriteHeight === 'number' ? ud.spriteHeight : 5.0;
            const shift = spriteH * 0.16 * shadowState.contactOffsetFactor;
            child.position.set(
              shadowState.fallDirX * shift,
              0.07,
              shadowState.fallDirZ * shift
            );
            child.rotation.y = shadowState.shadowYaw;
            child.scale.set(sPulse * 0.92, sPulse * shadowState.elongation * 1.15, 1);
          } else if (ud.isMonsterFacingRing) {
            const rCh = child.children;
            for (let ri = 0; ri < rCh.length; ri++) {
              const rChild = rCh[ri];
              if (rChild.userData?.isMonsterAuraRing) {
                const pulse = 1.0 + breath * 0.035;
                rChild.scale.set(pulse, pulse, 1);
              } else if (rChild.userData?.isBossAuraRing) {
                const pulse = 1.0 + breath * 0.045;
                rChild.scale.set(pulse, pulse, 1);
              }
            }
          }
        }
      });

      // 2. Resources animations via flat typed caches (zero nested child scans)
      for (let i = 0; i < this.animResBelowTags.length; i++) {
        const t = this.animResBelowTags[i];
        t.obj.position.set(sinYaw * t.dist, t.y, cosYaw * t.dist);
      }
      for (let i = 0; i < this.animWaterwheels.length; i++) {
        this.animWaterwheels[i].rotation.z += delta * 1.8;
      }
      for (let i = 0; i < this.animWindmills.length; i++) {
        this.animWindmills[i].rotation.z -= delta * 1.35;
      }
      for (let i = 0; i < this.animSawBlades.length; i++) {
        this.animSawBlades[i].rotation.x += delta * 9.0;
      }
      for (let i = 0; i < this.animMineWheels.length; i++) {
        this.animMineWheels[i].rotation.z += delta * 2.2;
      }
      for (let i = 0; i < this.animFoliageCanopies.length; i++) {
        const f = this.animFoliageCanopies[i];
        f.obj.rotation.z = Math.sin(elapsed * 1.5 + f.idx) * 0.05;
      }
      for (let i = 0; i < this.animGoldGlints.length; i++) {
        const g = this.animGoldGlints[i];
        g.obj.position.x = Math.cos(elapsed * 2.2 + g.phase) * 2.2;
        g.obj.position.z = Math.sin(elapsed * 2.2 + g.phase) * 2.2;
        g.obj.rotation.y += delta * 2.0;
      }

      // 3. Castles animations via flat caches
      for (let i = 0; i < this.animCastleDragonBanners.length; i++) {
        const b = this.animCastleDragonBanners[i];
        b.obj.rotation.y = Math.sin(elapsed * 3.2 + b.phase) * 0.22;
      }
      for (let i = 0; i < this.animCastleBrazierFlames.length; i++) {
        const fl = this.animCastleBrazierFlames[i];
        const flicker = 0.88 + Math.sin(elapsed * 14.0 + fl.phase) * 0.2;
        fl.obj.scale.set(1, flicker, 1);
      }

      // 3a. Burning Enemy Castle Destruction Flames & Rising Siege Smoke Plumes
      this.castleBurningMap.forEach((entry) => {
        if (!entry.isBurning) return;
        const cones = entry.flamesGroup.children;
        for (let f = 0; f < cones.length; f++) {
          const cone = cones[f];
          const ph = cone.userData?.phase || 0;
          const flickerY = (0.78 + Math.sin(elapsed * 13.5 + ph) * 0.26) * entry.intensity;
          const flickerXZ = 0.86 + Math.cos(elapsed * 11.2 + ph) * 0.16;
          cone.scale.set(flickerXZ, flickerY, flickerXZ);
          cone.rotation.y = elapsed * 2.6 + ph;
        }
        entry.smokeTimer += delta;
        if (entry.smokeTimer >= 0.22) {
          entry.smokeTimer = 0;
          if (this.activeSmokeParticles.length < 165) {
            const darkShades = [0x1e293b, 0x334155, 0x475569];
            const puffMat = new THREE.MeshStandardMaterial({
              color: darkShades[Math.floor(Math.random() * darkShades.length)],
              roughness: 0.96,
              transparent: true,
              opacity: 0.8,
              depthWrite: false,
            });
            const puff = new THREE.Mesh(this.sharedSmokeGeo, puffMat);
            const origin = entry.group.position;
            puff.position.set(
              origin.x + (Math.random() - 0.5) * 8.0,
              origin.y + 8.5 + Math.random() * 5.0,
              origin.z + (Math.random() - 0.5) * 8.0
            );
            this.scene.add(puff);
            this.activeSmokeParticles.push({
              mesh: puff,
              velocity: new THREE.Vector3((Math.random() - 0.5) * 1.6, 3.2 + Math.random() * 2.2, (Math.random() - 0.5) * 1.6),
              rotSpeed: new THREE.Vector3((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5),
              life: 0,
              maxLife: 2.2 + Math.random() * 0.6,
              initialScale: 0.9 * entry.intensity,
              targetScale: 3.6 * entry.intensity,
            });
          }
        }
      });

      // Buildings animations via flat caches
      for (let i = 0; i < this.animBuildingBanners.length; i++) {
        const b = this.animBuildingBanners[i];
        b.obj.rotation.y = Math.sin(elapsed * 4.2 + b.idx) * 0.16;
      }
      for (let i = 0; i < this.animBuildingDragonBanners.length; i++) {
        const b = this.animBuildingDragonBanners[i];
        b.obj.rotation.y = Math.sin(elapsed * 3.2 + b.phase) * 0.24;
      }
      for (let i = 0; i < this.animBuildingPrayerFlags.length; i++) {
        const f = this.animBuildingPrayerFlags[i];
        f.obj.rotation.z = Math.sin(elapsed * 3.8 + f.idx) * 0.12;
      }
      for (let i = 0; i < this.animBuildingWardRings.length; i++) {
        this.animBuildingWardRings[i].rotation.z += delta * 0.55;
      }
      for (let i = 0; i < this.animBuildingBlessingRings.length; i++) {
        this.animBuildingBlessingRings[i].rotation.z += delta * 0.45;
      }
      for (let i = 0; i < this.animBuildingWardOrbs.length; i++) {
        const orb = this.animBuildingWardOrbs[i];
        orb.obj.position.x = Math.cos(elapsed * orb.speed + orb.phase) * orb.radius;
        orb.obj.position.z = Math.sin(elapsed * orb.speed + orb.phase) * orb.radius;
        orb.obj.position.y = 13.0 + Math.sin(elapsed * 2.5 + orb.phase) * 0.4;
      }

      // 3b. Animated Floating Crystal Shrines (Hover Crystal, Twin Gold Orbit Rings, Colored Flames, Crackling Lightning)
      for (let sIdx = 0; sIdx < this.animatedShrines.length; sIdx++) {
        const sh = this.animatedShrines[sIdx];
        const ph = sh.phase;

        // Hovering crystal vertical bob & graceful axial rotation
        sh.crystalGroup.position.y = sh.crystalBaseY + Math.sin(elapsed * 2.1 + ph) * 0.36;
        sh.crystalGroup.rotation.y += delta * 0.55;

        // Counter-rotating diagonal golden energy rings
        sh.orbitRing1.rotation.z += delta * 1.45;
        sh.orbitRing2.rotation.z -= delta * 1.15;

        // Portal energy beam shimmer
        const beamPulse = 0.88 + Math.sin(elapsed * 5.2 + ph) * 0.14;
        sh.portalBeam.scale.set(beamPulse, 1.0, beamPulse);

        // Rising tier-colored flame tongues around central portal
        for (let f = 0; f < sh.flameTongues.length; f++) {
          const fl = sh.flameTongues[f];
          const tWave = (elapsed * fl.speed + fl.phase) % 1;
          const flicker = 0.72 + Math.sin(elapsed * 13.0 + fl.phase) * 0.28;
          const heightScale = 0.75 + Math.sin(tWave * Math.PI) * 0.95;
          const widthScale = (1.0 - tWave * 0.48) * flicker;
          fl.mesh.position.set(
            fl.baseX * (1.0 - tWave * 0.28) + Math.sin(elapsed * 7.0 + fl.phase) * 0.08,
            fl.baseY + tWave * 0.75,
            fl.baseZ * (1.0 - tWave * 0.28) + Math.cos(elapsed * 6.5 + fl.phase) * 0.08
          );
          fl.mesh.scale.set(widthScale, heightScale, widthScale);
          fl.mesh.rotation.y = elapsed * 2.2 + fl.phase;
        }

        // Waterfall splash foam rings & swaying blue lotus banners
        for (let w = 0; w < sh.waterfallFoams.length; w++) {
          const wf = sh.waterfallFoams[w];
          const s = 0.92 + Math.sin(elapsed * 7.5 + ph + w) * 0.14;
          wf.scale.set(s, s, 1);
        }
        for (let b = 0; b < sh.banners.length; b++) {
          sh.banners[b].rotation.x = 0.05 + Math.sin(elapsed * 3.4 + ph + b) * 0.09;
        }

        // Crackling adaptive-Hz 3D lightning arcs between corner spires and hovering crystal
        const boltBucket = Math.floor(elapsed * this.shrineLightningHz + ph * 3.1);
        const burstPulse = Math.sin(elapsed * 9.5 + ph * 2.1);
        sh.lightningMat.opacity = burstPulse > -0.15 ? 0.55 + Math.abs(Math.sin(elapsed * 29.0 + ph)) * 0.45 : 0.12;

        if (boltBucket !== sh.lastBoltBucket) {
          sh.lastBoltBucket = boltBucket;
          const crystalYOffset = sh.crystalGroup.position.y - sh.crystalBaseY;
          for (let l = 0; l < sh.lightningBolts.length; l++) {
            const bolt = sh.lightningBolts[l];
            const pos = bolt.positions;
            const segs = 6;
            for (let p = 0; p <= segs; p++) {
              const t = p / segs;
              const bx = bolt.startX + (bolt.endX - bolt.startX) * t;
              const by = bolt.startY + ((bolt.endY + crystalYOffset) - bolt.startY) * t;
              const bz = bolt.startZ + (bolt.endZ - bolt.startZ) * t;
              const amp = p === 0 || p === segs ? 0 : bolt.jitter * Math.sin(t * Math.PI);
              // Deterministic pseudo-random crackle seeded by bucket + vertex index (zero allocations)
              const h1 = Math.sin(boltBucket * 12.9898 + p * 78.233 + bolt.phase) * 43758.5453;
              const h2 = Math.sin(boltBucket * 39.3468 + p * 19.137 + bolt.phase) * 21345.6789;
              const h3 = Math.sin(boltBucket * 51.7131 + p * 63.412 + bolt.phase) * 19432.1234;
              const n1 = (h1 - Math.floor(h1)) * 2 - 1;
              const n2 = (h2 - Math.floor(h2)) * 2 - 1;
              const n3 = (h3 - Math.floor(h3)) * 2 - 1;
              pos[p * 3] = bx + n1 * amp;
              pos[p * 3 + 1] = by + n2 * amp * 0.85;
              pos[p * 3 + 2] = bz + n3 * amp;
            }
            (bolt.line.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
          }
        }
      }

      // 4. Animate visible Allied Rally Columns + dynamic East-West directional sprite swap
      if (this.alliedRallyColumns.size > 0 && this.alliedRallyGroup.visible) {
        this.alliedRallyColumns.forEach((entry) => {
          if (!entry.group.visible) return;
          const colRotY = entry.group.rotation.y;
          const colDotRight = Math.sin(colRotY) * camRightX + Math.cos(colRotY) * camRightZ;
          let colEast = entry.facingEast;
          if (colDotRight > 0.06) colEast = true;
          else if (colDotRight < -0.06) colEast = false;
          if (colEast !== entry.facingEast && this.alliedWarriorSpriteMatEast && this.alliedWarriorSpriteMatWest) {
            entry.facingEast = colEast;
            const targetMat = colEast ? this.alliedWarriorSpriteMatEast : this.alliedWarriorSpriteMatWest;
            for (let si = 0; si < entry.sprites.length; si++) {
              entry.sprites[si].material = targetMat;
            }
          }

          const ch = entry.group.children;
          for (let ci = 0; ci < ch.length; ci++) {
            const child = ch[ci];
            if (child.userData?.idx !== undefined) {
              const idx = child.userData.idx;
              child.position.y = Math.abs(Math.sin(elapsed * 14 + idx * 0.6)) * 0.18;
              child.rotation.z = Math.sin(elapsed * 14 + idx * 0.6) * 0.045;
              const uCh = child.children;
              for (let ui = 0; ui < uCh.length; ui++) {
                if (uCh[ui].userData?.isArmyBanner) {
                  uCh[ui].rotation.y = Math.sin(elapsed * 6.2 + ci) * 0.24;
                }
              }
            }
          }
        });
      }

      // 4b. Army marching and interaction loop (App simulation visual OR legacy fallback)
      if (this.externalMarchVisual && this.armyGroup) {
        const curPos = this.armyGroup.position;
        if (!this.externalMarchVisual.inCombatOrGathering) {
          this.dustTimer += delta;
          if (this.dustTimer >= 0.14) {
            this.dustTimer = 0;
            this.spawnMarchingDustPuff(curPos);
          }
          const aCh = this.armyGroup.children;
          for (let ci = 0; ci < aCh.length; ci++) {
            const child = aCh[ci];
            if (child.userData?.idx !== undefined) {
              const idx = child.userData.idx;
              child.position.y = Math.abs(Math.sin(elapsed * 14 + idx * 0.55)) * 0.18;
              child.rotation.z = Math.sin(elapsed * 14 + idx * 0.55) * 0.045;
              const uCh = child.children;
              for (let ui = 0; ui < uCh.length; ui++) {
                if (uCh[ui].userData?.isArmyBanner) {
                  uCh[ui].rotation.y = Math.sin(elapsed * 6.0) * 0.22;
                }
              }
            }
          }
        } else {
          this.externalMiningTimer += delta;
          if (this.externalMiningTimer >= 0.45) {
            this.externalMiningTimer = 0;
            this._tempDest.set(
              this.externalMarchVisual.to[0],
              this.getGroundHeight(this.externalMarchVisual.to[0], this.externalMarchVisual.to[2]),
              this.externalMarchVisual.to[2]
            );
            this.spawnDebrisChips(this._tempDest, this.externalMarchVisual.resourceType || 'stone');
            if (this.externalMarchVisual.resourceType === 'crystal') {
              this.spawnImpactSparks(this._tempDest);
            }
          }
        }
      } else if (this.armyGroup && this.armyState !== 'IDLE') {
        const curPos = this.armyGroup.position;

        if (this.armyState === 'ATTACKING' || this.armyState === 'GATHERING') {
          if (this.activeTarget) {
            this._tempDest.set(
              this.activeTarget.position[0],
              this.activeTarget.position[1],
              this.activeTarget.position[2]
            );
            const dist = curPos.distanceTo(this._tempDest);

            this.tacticalLine.visible = true;
            this._linePts[0].set(curPos.x, curPos.y + 0.3, curPos.z);
            this._linePts[1].set(this._tempDest.x, this._tempDest.y + 0.3, this._tempDest.z);
            this.tacticalLine.geometry.setFromPoints(this._linePts);

            const engageDist =
              this.armyState === 'ATTACKING'
                ? Math.max(3.5, (this.activeTarget.radius || 4) + 3.8)
                : 2.2;

            if (dist > engageDist) {
              this._tempDir.subVectors(this._tempDest, curPos).normalize();
              const marchSpeed = this.armyState === 'GATHERING' ? 24.0 : 20.0;
              curPos.addScaledVector(this._tempDir, delta * marchSpeed);
              curPos.y = this.getGroundHeight(curPos.x, curPos.z);
              this.armyGroup.rotation.y = Math.atan2(this._tempDir.x, this._tempDir.z);

              this.dustTimer += delta;
              if (this.dustTimer >= 0.12) {
                this.dustTimer = 0;
                this.spawnMarchingDustPuff(curPos);
              }

              const aCh = this.armyGroup.children;
              for (let ci = 0; ci < aCh.length; ci++) {
                const child = aCh[ci];
                if (child.userData?.idx !== undefined) {
                  const idx = child.userData.idx;
                  child.position.y = Math.abs(Math.sin(elapsed * 14 + idx * 0.55)) * 0.18;
                  child.rotation.z = Math.sin(elapsed * 14 + idx * 0.55) * 0.045;
                  const uCh = child.children;
                  for (let ui = 0; ui < uCh.length; ui++) {
                    if (uCh[ui].userData?.isArmyBanner) {
                      uCh[ui].rotation.y = Math.sin(elapsed * 6.0) * 0.22;
                    }
                  }
                }
              }

              const walked = Math.max(0, this.totalMarchDist - dist);
              const pct = Math.min(48, Math.round((walked / Math.max(1, this.totalMarchDist)) * 48));
              this.armyPos.copy(curPos);
              this.onArmyStatusUpdate?.(`Vanguard marching to ${this.activeTarget.name}...`, pct, `${Math.round(dist / marchSpeed)}s`, [curPos.x, curPos.y, curPos.z]);
            } else {
              this.armyPos.copy(curPos);
              if (this.armyState === 'ATTACKING') {
                this.combatTimer += delta;
                if (this.combatTimer >= 0.85) {
                  this.combatTimer = 0;
                  const maxHp = this.activeTarget.maxHealth ?? 300;
                  const curHp = this.activeTarget.health ?? 150;
                  const baseDamage =
                    this.activeTarget.category === 'monster'
                      ? Math.max(55, Math.round(maxHp * 0.28))
                      : Math.max(380, Math.round(maxHp * 0.26));
                  const strikeDamage = Math.min(curHp, baseDamage);
                  this.applyCombatStrike(this.activeTarget, strikeDamage);
                }
                if (this.activeTarget) {
                  this.onArmyStatusUpdate?.(`Vanguard besieging ${this.activeTarget.name}...`, 50, 'In Battle', [curPos.x, curPos.y, curPos.z]);
                }
              } else if (this.armyState === 'GATHERING') {
                this.gatherTimer += delta;
                this.miningChipTimer += delta;

                const isGold = this.activeTarget.subtype === 'gold';
                if (this.miningChipTimer >= 0.28) {
                  this.miningChipTimer = 0;
                  this.spawnDebrisChips(this._tempDest, isGold ? 'gold' : this.activeTarget.subtype);
                  if (isGold) {
                    this.spawnImpactSparks(this._tempDest);
                  }

                  if (Math.random() < 0.45) {
                    this._tempProj.copy(this._tempDest);
                    this._tempProj.y += 2.2;
                    this._tempProj.project(this.cameraController.camera);
                    const screenX = ((this._tempProj.x + 1) * this.container.clientWidth) / 2;
                    const screenY = ((-this._tempProj.y + 1) * this.container.clientHeight) / 2;

                    this.onAddCombatFloater?.(
                      isGold ? '⛏️ +150 GOLD' : `⛏️ +100 ${this.activeTarget.subtype.toUpperCase()}`,
                      isGold ? '#facc15' : '#86efac',
                      screenX + (Math.random() - 0.5) * 36,
                      screenY - 20
                    );
                  }
                }

                const GATHER_DURATION = 2.2;
                const gatherPct = 50 + Math.min(45, Math.round((this.gatherTimer / GATHER_DURATION) * 45));
                this.onArmyStatusUpdate?.(`Harvesting ${this.activeTarget.name}...`, gatherPct, `${Math.ceil(GATHER_DURATION - this.gatherTimer)}s`, [curPos.x, curPos.y, curPos.z]);

                if (this.gatherTimer >= GATHER_DURATION) {
                  this.gatherTimer = 0;
                  const yieldAmt = this.activeTarget.yieldAmount || 500;
                  const resType = this.activeTarget.resourceType || 'wood';

                  this.spawnImpactSparks(this._tempDest);
                  this.spawnDebrisChips(this._tempDest, isGold ? 'gold' : 'stone');

                  this._tempProj.copy(this._tempDest);
                  this._tempProj.y += 2.8;
                  this._tempProj.project(this.cameraController.camera);
                  const screenX = ((this._tempProj.x + 1) * this.container.clientWidth) / 2;
                  const screenY = ((-this._tempProj.y + 1) * this.container.clientHeight) / 2;

                  this.onAddCombatFloater?.(`📦 +${yieldAmt.toLocaleString()} ${resType.toUpperCase()}!`, '#fef08a', screenX, screenY - 30);

                  this.onHarvestReward?.(resType, yieldAmt);
                  this.armyState = 'RETURNING';
                  this.totalMarchDist = this.armyGroup.position.distanceTo(this.armyHomePos);
                  this.onArmyStatusUpdate?.(`Harvested +${yieldAmt} ${resType.toUpperCase()}! Returning to Vanguard Castle...`, 95, 'Returning', [curPos.x, curPos.y, curPos.z]);
                }
              }
            }
          }
        } else if (this.armyState === 'RETURNING') {
          const distHome = curPos.distanceTo(this.armyHomePos);
          this.tacticalLine.visible = true;
          this._linePts[0].set(curPos.x, curPos.y + 0.3, curPos.z);
          this._linePts[1].set(this.armyHomePos.x, this.armyHomePos.y + 0.3, this.armyHomePos.z);
          this.tacticalLine.geometry.setFromPoints(this._linePts);

          if (distHome > 2.0) {
            this._tempDir.subVectors(this.armyHomePos, curPos).normalize();
            curPos.addScaledVector(this._tempDir, delta * 24.0);
            curPos.y = this.getGroundHeight(curPos.x, curPos.z);
            this.armyGroup.rotation.y = Math.atan2(this._tempDir.x, this._tempDir.z);
            this.armyPos.copy(curPos);

            this.dustTimer += delta;
            if (this.dustTimer >= 0.12) {
              this.dustTimer = 0;
              this.spawnMarchingDustPuff(curPos);
            }

            const aCh = this.armyGroup.children;
            for (let ci = 0; ci < aCh.length; ci++) {
              const child = aCh[ci];
              if (child.userData?.idx !== undefined) {
                const idx = child.userData.idx;
                child.position.y = Math.abs(Math.sin(elapsed * 14 + idx * 0.55)) * 0.18;
                child.rotation.z = Math.sin(elapsed * 14 + idx * 0.55) * 0.045;
                const uCh = child.children;
                for (let ui = 0; ui < uCh.length; ui++) {
                  if (uCh[ui].userData?.isArmyBanner) {
                    uCh[ui].rotation.y = Math.sin(elapsed * 6.0) * 0.22;
                  }
                }
              }
            }

            const walkedHome = Math.max(0, this.totalMarchDist - distHome);
            const retPct = 50 + Math.min(48, Math.round((walkedHome / this.totalMarchDist) * 48));
            this.onArmyStatusUpdate?.('Vanguard returning to Fortress...', retPct, `${Math.round(distHome / 24)}s`, [curPos.x, curPos.y, curPos.z]);
          } else {
            curPos.copy(this.armyHomePos);
            this.armyPos.copy(this.armyHomePos);
            this.armyGroup.visible = false;
            this.tacticalLine.visible = false;
            this.armyState = 'IDLE';
            this.activeTarget = null;
            this.onArmyStatusUpdate?.('Vanguard safely garrisoned inside Vanguard Fortress.', 100, 'Garrisoned', [this.armyHomePos.x, this.armyHomePos.y, this.armyHomePos.z]);
          }
        }
      }

      // 4c. Sync Player Army East-West Sprite Facing relative to Camera Right (same-frame update)
      if (this.armyGroup && this.armyGroup.visible) {
        const armyRotY = this.armyGroup.rotation.y;
        const armyDotRight = Math.sin(armyRotY) * camRightX + Math.cos(armyRotY) * camRightZ;
        let nextArmyEast = this.armyFacingEast;
        if (armyDotRight > 0.06) nextArmyEast = true;
        else if (armyDotRight < -0.06) nextArmyEast = false;
        if (nextArmyEast !== this.armyFacingEast) {
          this.armyFacingEast = nextArmyEast;
          if (this.armyWarriorSpriteMatEast && this.armyWarriorSpriteMatWest) {
            const wMat = nextArmyEast ? this.armyWarriorSpriteMatEast : this.armyWarriorSpriteMatWest;
            for (let wi = 0; wi < this.armyWarriorSprites.length; wi++) {
              this.armyWarriorSprites[wi].sprite.material = wMat;
            }
          }
          if (this.armyHeroSprite && this.armyHeroSpriteMatEast && this.armyHeroSpriteMatWest) {
            this.armyHeroSprite.material = nextArmyEast ? this.armyHeroSpriteMatEast : this.armyHeroSpriteMatWest;
          }
        }
      }
      } // end if (isWorldVisible)

      // Process Marching Dust Trail Puffs
      for (let i = this.activeDustPuffs.length - 1; i >= 0; i--) {
        const d = this.activeDustPuffs[i];
        d.life += delta;
        d.mesh.position.addScaledVector(d.velocity, delta);
        const ratio = d.life / d.maxLife;
        const scale = d.initialScale + ratio * 1.1;
        d.mesh.scale.set(scale, scale * 0.65, scale);
        (d.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 0.45 * (1 - ratio));

        if (d.life >= d.maxLife) {
          this.scene.remove(d.mesh);
          (d.mesh.material as THREE.Material).dispose();
          this.activeDustPuffs.splice(i, 1);
        }
      }

      // Process Flinch Shakes
      for (let i = this.activeFlinchShakes.length - 1; i >= 0; i--) {
        const s = this.activeFlinchShakes[i];
        s.timer -= delta;
        if (s.timer > 0) {
          const intensity = (s.timer / s.maxTimer) * 0.45;
          s.group.position.x = s.basePos.x + (Math.random() - 0.5) * intensity;
          s.group.position.z = s.basePos.z + (Math.random() - 0.5) * intensity;
        } else {
          s.group.position.copy(s.basePos);
          this.activeFlinchShakes.splice(i, 1);
        }
      }

      // Process Impact Sparks
      for (let i = this.activeSparks.length - 1; i >= 0; i--) {
        const sp = this.activeSparks[i];
        sp.life += delta;
        sp.velocity.y -= delta * 18.0;
        sp.mesh.position.addScaledVector(sp.velocity, delta);
        const ratio = sp.life / sp.maxLife;
        sp.mesh.scale.setScalar(Math.max(0.01, 1 - ratio));

        if (sp.life >= sp.maxLife) {
          this.scene.remove(sp.mesh);
          this.activeSparks.splice(i, 1);
        }
      }

      // Process Debris Chips
      for (let i = this.activeMiningChips.length - 1; i >= 0; i--) {
        const c = this.activeMiningChips[i];
        c.life += delta;
        c.velocity.y -= delta * 12.0;
        c.mesh.position.addScaledVector(c.velocity, delta);
        c.mesh.rotation.x += c.rotSpeed * delta;

        if (c.life >= c.maxLife || c.mesh.position.y <= 0.1) {
          this.scene.remove(c.mesh);
          this.activeMiningChips.splice(i, 1);
        }
      }

      // Process Smoke Particles
      for (let i = this.activeSmokeParticles.length - 1; i >= 0; i--) {
        const p = this.activeSmokeParticles[i];
        p.life += delta;
        const ratio = p.life / p.maxLife;

        p.velocity.y += delta * 0.6;
        p.mesh.position.addScaledVector(p.velocity, delta);
        p.mesh.rotation.x += p.rotSpeed.x * delta;
        p.mesh.rotation.y += p.rotSpeed.y * delta;

        const curScale = THREE.MathUtils.lerp(p.initialScale, p.targetScale, Math.min(1, ratio * 1.3));
        p.mesh.scale.setScalar(curScale);

        const m = p.mesh.material as THREE.MeshStandardMaterial;
        m.opacity = Math.max(0, (1 - ratio) * 0.88);

        if (ratio >= 1.0) {
          this.scene.remove(p.mesh);
          m.dispose();
          this.activeSmokeParticles.splice(i, 1);
        }
      }

      // Process Hit Flashes
      for (let i = this.activeHitFlashes.length - 1; i >= 0; i--) {
        const h = this.activeHitFlashes[i];
        h.timer -= delta;
        if (h.timer <= 0) {
          (h.mesh.material as any).color?.setHex(0xffffff);
          this.activeHitFlashes.splice(i, 1);
        }
      }

      // Process Siege Projectiles (Arrows & Parabolic Flaming Boulders)
      for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
        const pr = this.activeProjectiles[i];
        pr.life += delta;
        if (pr.life < 0) continue;
        const t = Math.min(1, pr.life / pr.maxLife);
        this._tempVecA.lerpVectors(pr.startPos, pr.endPos, t);
        this._tempVecA.y += 4 * pr.arcHeight * t * (1 - t);
        pr.mesh.position.copy(this._tempVecA);

        if (pr.isBoulder) {
          pr.mesh.rotation.x += delta * 9.0;
          pr.mesh.rotation.y += delta * 7.0;
        } else {
          const nextT = Math.min(1, t + 0.05);
          this._tempVecB.lerpVectors(pr.startPos, pr.endPos, nextT);
          this._tempVecB.y += 4 * pr.arcHeight * nextT * (1 - nextT);
          pr.mesh.lookAt(this._tempVecB);
        }

        if (t >= 1) {
          if (pr.isBoulder) {
            this.spawnImpactSparks(pr.endPos);
          }
          this.scene.remove(pr.mesh);
          this.activeProjectiles.splice(i, 1);
        }
      }

      // Process Expanding Shockwave Rings
      for (let i = this.activeShockwaves.length - 1; i >= 0; i--) {
        const sw = this.activeShockwaves[i];
        sw.life += delta;
        const ratio = Math.min(1, sw.life / sw.maxLife);
        const s = 0.6 + ratio * sw.maxScale;
        sw.mesh.scale.setScalar(s);
        (sw.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - ratio));
        if (ratio >= 1) {
          this.scene.remove(sw.mesh);
          (sw.mesh.material as THREE.Material).dispose();
          this.activeShockwaves.splice(i, 1);
        }
      }

      // Process Skyward Conquest Light Pillars
      for (let i = this.activeConquestBeams.length - 1; i >= 0; i--) {
        const cb = this.activeConquestBeams[i];
        cb.life += delta;
        const ratio = Math.min(1, cb.life / cb.maxLife);
        const pulse = 1.0 + Math.sin(ratio * Math.PI * 5) * 0.18;
        const widthScale = (1.0 - ratio * 0.45) * pulse;
        cb.mesh.scale.set(widthScale, 0.4 + Math.min(1, ratio * 3.5) * 0.9, widthScale);
        (cb.mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(ratio * Math.PI) * 0.72;
        if (ratio >= 1) {
          this.scene.remove(cb.mesh);
          (cb.mesh.material as THREE.Material).dispose();
          this.activeConquestBeams.splice(i, 1);
        }
      }

      // 5. Update Time-of-Day Environment Lighting, Real-Time Sun Shadow Camera & Ground Contact Shadows
      const camZoom = this.cameraController.zoom;
      const worldLod: ZoomLodLevel = camZoom >= 0.42 ? 'Close' : camZoom >= 0.14 ? 'Medium' : 'Far';
      this.environmentManager.update(delta, elapsed);
      const activeShadowState = this.environmentManager.getShadowState();
      this.syncSunLightAndShadows(camZoom, activeShadowState);

      this.worldRadialShadowMat.opacity = activeShadowState.contactOpacity;
      this.worldOctagonalShadowMat.opacity = Math.min(0.84, activeShadowState.contactOpacity * 1.06);
      if (this.monsterContactShadowMat) {
        this.monsterContactShadowMat.opacity = activeShadowState.contactOpacity;
      }
      if (this.monsterDirectionalShadowMat) {
        this.monsterDirectionalShadowMat.opacity = activeShadowState.contactOpacity * 0.56;
      }
      if (this.unitShadowMat) {
        this.unitShadowMat.opacity = activeShadowState.contactOpacity * 0.85;
      }

      if (this.currentSceneMode === 'kingdom' && this.insideKingdom3D) {
        this.insideKingdom3D.update(delta, elapsed, activeShadowState);
      } else {
        syncContactShadowEntries(this.worldBuildingShadowEntries, activeShadowState);
        syncContactShadowEntries(this.castleShadowEntries, activeShadowState);
      }

      // 6. Section 13 Live VFX, Shader Barriers & 3D Vanguard AnimationMixer
      this.vfxManager.setZoomLod(worldLod);
      this.vfxManager.update(delta);
      if (isWorldVisible) {
        this.shaderBarrierMap.forEach((b) => updateProtectionBarrier(b, delta, elapsed));
      }

      if (isWorldVisible && this.vanguard3DRig && this.armyGroup.visible) {
        this.vanguard3DRig.controller.setZoomLod(worldLod);
        const desiredState: 'IDLE' | 'MARCH' | 'ATTACK' | 'MINE' = this.externalMarchVisual?.inCombatOrGathering
          ? this.externalMarchVisual.resourceType
            ? 'MINE'
            : 'ATTACK'
          : this.armyState === 'ATTACKING' || this.armyState === 'RETURNING' || this.externalMarchVisual
            ? 'MARCH'
            : this.armyState === 'GATHERING'
              ? 'MINE'
              : 'IDLE';
        if (desiredState !== this.lastVanguardState) {
          this.lastVanguardState = desiredState;
          this.vanguard3DRig.controller.playState(desiredState, { force: true, fadeDuration: 0.2 });
        }
        this.vanguard3DRig.controller.update(delta);
      }

      if (this.sunLight.castShadow && this.qualityTier !== 'high' && !this.isSoftwareGl) {
        this.shadowFrameSkip++;
        const interval = this.qualityTier === 'balanced' ? 2 : 4;
        if (this.forceShadowUpdate || this.shadowFrameSkip >= interval) {
          this.shadowFrameSkip = 0;
          this.forceShadowUpdate = false;
          this.renderer.shadowMap.needsUpdate = true;
        }
      }

      this.renderer.render(this.scene, this.cameraController.camera);
      if (!this.hasNotifiedReady) {
        this.hasNotifiedReady = true;
        this.onSceneReady?.();
      }

      if (this.isDisposed || this.isContextLost) return;
      if (this.isSoftwareGl) {
        afterDraw(loop);
      } else {
        this.animFrameId = requestAnimationFrame(loop);
      }
    };

    // Schedule first frame asynchronously so React StrictMode unmount can cancel throwaway mounts cleanly
    if (this.isSoftwareGl) {
      this.animFrameId = window.setTimeout(loop, 0);
    } else {
      this.animFrameId = requestAnimationFrame(loop);
    }
  }

  private onOrientationChange = () => {
    setTimeout(this.onResize, 60);
    setTimeout(this.onResize, 220);
  };

  private onResize = () => {
    if (!this.container || !this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w <= 0 || h <= 0) return;
    this.renderer.setSize(w, h);
  };

  public panTo(x: number, z: number) {
    this.ensureWorldMapBuilt();
    this.cameraController.panTo(x, z);
  }

  public selectEntityById(entityId: string): boolean {
    this.ensureWorldMapBuilt();
    for (const obj of this.pickableObjects) {
      const ent = obj.userData?.gameEntity as WorldEntity | undefined;
      if (ent && ent.id === entityId && !ent.isDefeated) {
        this.selectedEntity = ent;
        this.selectionIndicator.visible = true;
        this.selectionIndicator.position.set(
          ent.position[0],
          ent.position[1] + 0.18,
          ent.position[2]
        );
        const ringScale = ent.radius * 0.95;
        this.selectionIndicator.scale.set(ringScale, ringScale, ringScale);
        this.cameraController.focusOn(ent.position[0], ent.position[2]);
        this.onSelectEntity?.(ent, null);
        return true;
      }
    }
    return false;
  }

  public zoomIn() {
    this.cameraController.adjustZoom(0.2);
  }

  public zoomOut() {
    this.cameraController.adjustZoom(-0.2);
  }

  public setZoom(z: number) {
    this.cameraController.setZoom(z);
  }

  public resetCamera() {
    this.setSceneMode('world');
  }

  public focusInsideKingdom() {
    this.setSceneMode('kingdom');
  }

  /**
   * Switch between the 3D World Map and the 3D Walled Inside Kingdom Merge Courtyard
   */
  public setSceneMode(mode: 'world' | 'kingdom', snapImmediately = false) {
    this.currentSceneMode = mode;
    if (mode === 'kingdom') {
      this.buildingsGroup.visible = false;
      this.castlesGroup.visible = false;
      this.strategicLinesGroup.visible = false;
      this.monstersGroup.visible = false;
      this.resourcesGroup.visible = false;
      this.atmosphereGroup.visible = false;
      this.armyGroup.visible = false;
      this.alliedRallyGroup.visible = false;
      this.tacticalLine.visible = false;
      this.selectionIndicator.visible = false;
      if (this.terrainGenerator) {
        this.terrainGenerator.plotMarkersGroup.visible = false;
        this.terrainGenerator.mesh.visible = false;
        this.terrainGenerator.vegetationGroup.visible = false;
        this.terrainGenerator.waterfallsGroup.visible = false;
        this.terrainGenerator.mistPuffsGroup.visible = false;
        this.terrainGenerator.leylineStreamsGroup.visible = false;
      }

      const inside3D = this.ensureInsideKingdom3D();
      inside3D.rootGroup.visible = true;
      this.cameraController.setPickables(inside3D.pickableObjects);
      this.cameraController.focusInsideKingdom(snapImmediately);
      this.onInsideKingdomStateChange?.(inside3D.getState());
    } else {
      if (this.insideKingdom3D) {
        this.insideKingdom3D.rootGroup.visible = false;
      }
      this.forceShadowUpdate = true;

      if (!this.worldMapBuilt) {
        this.startAsyncWorldMapBuild();
        this.cameraController.resetToHome();
        return;
      }

      if (this.terrainGenerator) {
        this.terrainGenerator.mesh.visible = true;
        this.terrainGenerator.vegetationGroup.visible = true;
        this.terrainGenerator.waterfallsGroup.visible = true;
        this.terrainGenerator.mistPuffsGroup.visible = true;
        this.terrainGenerator.leylineStreamsGroup.visible = true;
        this.terrainGenerator.plotMarkersGroup.visible = true;
      }
      this.buildingsGroup.visible = true;
      this.castlesGroup.visible = true;
      this.strategicLinesGroup.visible = true;
      this.atmosphereGroup.visible = true;
      this.monstersGroup.visible = !this.isStrategicFilterActive;
      this.resourcesGroup.visible = !this.isStrategicFilterActive;
      this.armyGroup.visible = this.armyState !== 'IDLE';
      this.alliedRallyGroup.visible = true;

      this.cameraController.setPickables(this.pickableObjects);
      this.cameraController.resetToHome();
    }
  }

  /**
   * Toggle 3D World Map Filter to display ONLY:
   * - The Congress (center [1600, 1600])
   * - 4 Inner Sanctum Shrines (Shrine A1–A4)
   * - 12 Mid-Ring Shrines (Shrine B1–B12)
   * - 20 Frontier Shrines (Shrine C1–C20)
   * - 10 Alliance Member Castles
   * - User's "My Castle"
   */
  public setStrategicFilterMode(onlyStrategic: boolean) {
    this.isStrategicFilterActive = onlyStrategic;
    if (this.currentSceneMode === 'world') {
      this.monstersGroup.visible = !onlyStrategic;
      this.resourcesGroup.visible = !onlyStrategic;
      this.buildingsGroup.visible = true;
      this.castlesGroup.visible = true;
      this.strategicLinesGroup.visible = true;
    }
  }

  public getCastlesList(): CastleSpawnData[] {
    return this.castlesList;
  }

  public getInsideKingdomState(): InsideKingdomState | null {
    return this.insideKingdom3D ? this.insideKingdom3D.getState() : null;
  }

  public selectInsidePlot(plotId: string) {
    return this.ensureInsideKingdom3D().handlePlotClick(plotId);
  }

  public mergeSelectedInsideBuilding(): boolean {
    return this.ensureInsideKingdom3D().mergeSelectedWithMatchingTwin();
  }

  public autoMergeInsideKingdom(): number {
    return this.ensureInsideKingdom3D().autoMergeAll();
  }

  public constructInsideBuilding(
    category: MergeBuildingCategory,
    preferredPlotId?: string
  ): KingdomMergePlot | null {
    return this.ensureInsideKingdom3D().constructBuilding(category, preferredPlotId);
  }

  public upgradeInsideImperialKeep(): boolean {
    return this.ensureInsideKingdom3D().upgradeImperialKeep();
  }

  public zoomOutTo100() {
    this.ensureWorldMapBuilt();
    this.cameraController.zoomOutTo100();
  }

  public setTerrainLodMode(mode: TerrainLodMode) {
    this.ensureWorldMapBuilt();
    this.terrainGenerator?.setLodMode(mode);
  }

  public setShowHexGrid(show: boolean) {
    this.ensureWorldMapBuilt();
    this.terrainGenerator?.setShowHexGrid(show);
  }

  public setHighlightedBiome(biome: TerrainBiomeType | null) {
    this.ensureWorldMapBuilt();
    this.terrainGenerator?.setHighlightedBiome(biome);
  }

  public getHexTileAt(x: number, z: number): HexTileData | null {
    this.ensureWorldMapBuilt();
    if (!this.terrainGenerator) return null;
    const tile = this.terrainGenerator.getHexTileAt(x, z);
    if (this.terrainGenerator.showHexGrid) {
      this.terrainGenerator.focusHexTile(tile);
    }
    return tile;
  }

  public getTerrainStats() {
    if (!this.terrainGenerator) {
      return {
        biomeCounts: {},
        totalTrianglesByLod: { high: 0, medium: 0, low: 0 },
        totalHexes: 0,
        lodMode: 'auto' as TerrainLodMode,
        showHexGrid: false,
        highlightedBiome: null,
      };
    }
    return {
      biomeCounts: this.terrainGenerator.biomeCounts,
      totalTrianglesByLod: this.terrainGenerator.totalTrianglesByLod,
      totalHexes: this.terrainGenerator.hexTilesMap.size,
      lodMode: this.terrainGenerator.currentLodMode,
      showHexGrid: this.terrainGenerator.showHexGrid,
      highlightedBiome: this.terrainGenerator.highlightedBiome,
    };
  }

  private ensureDebugCollisionMaterials() {
    if (this.debugCollisionMats) return this.debugCollisionMats;
    this.debugCollisionMats = {
      building: new THREE.LineBasicMaterial({
        color: 0xfacc15, // Gold/Amber for Buildings (Congress, Shrines, Castles)
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      }),
      monster: new THREE.LineBasicMaterial({
        color: 0xf43f5e, // Crimson/Red for Monsters
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      }),
      resource: new THREE.LineBasicMaterial({
        color: 0x22c55e, // Emerald/Green for Resource Nodes
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      }),
    };
    return this.debugCollisionMats;
  }

  private getDebugCollisionBoxGeometry(width: number, height: number, depth: number): THREE.EdgesGeometry {
    const key = `${width.toFixed(2)}x${height.toFixed(2)}x${depth.toFixed(2)}`;
    const existing = this.debugCollisionGeos.get(key);
    if (existing) return existing;
    const boxGeo = new THREE.BoxGeometry(width, height, depth);
    const edges = new THREE.EdgesGeometry(boxGeo);
    boxGeo.dispose();
    this.debugCollisionGeos.set(key, edges);
    return edges;
  }

  private attachDebugCollisionBox(
    entity: WorldEntity,
    group: THREE.Group,
    layer: 'building' | 'monster' | 'resource'
  ) {
    const mats = this.ensureDebugCollisionMaterials();
    const width = Math.max(2, Number((entity.radius * 2).toFixed(2)));
    const depth = width;
    const height =
      layer === 'building'
        ? entity.type === 'congress'
          ? 26
          : 20
        : layer === 'monster'
          ? entity.subtype === 'boss' || (entity.level ?? 1) >= 10
            ? 14
            : 10
          : 9;

    const geo = this.getDebugCollisionBoxGeometry(width, height, depth);
    const wireframe = new THREE.LineSegments(geo, mats[layer]);
    wireframe.position.set(0, height * 0.5, 0);
    wireframe.renderOrder = 25;
    wireframe.visible =
      this.isDebugCollisionBoxesVisible && this.debugCollisionLayerVisibility[layer];
    wireframe.userData = {
      isDebugCollisionBox: true,
      debugLayer: layer,
      entityId: entity.id,
    };
    group.add(wireframe);

    this.debugCollisionBoxes.push({
      entityId: entity.id,
      layer,
      box: wireframe,
    });
  }

  public rebuildDebugCollisionBoxes() {
    for (const entry of this.debugCollisionBoxes) {
      entry.box.parent?.remove(entry.box);
    }
    this.debugCollisionBoxes = [];

    this.buildingMeshesMap.forEach((group, entityId) => {
      const entity = this.entitiesMap.get(entityId);
      if (entity) this.attachDebugCollisionBox(entity, group, 'building');
    });

    this.monsterMeshesMap.forEach((group, entityId) => {
      const entity = this.entitiesMap.get(entityId);
      if (entity) this.attachDebugCollisionBox(entity, group, 'monster');
    });

    this.resourceMeshesMap.forEach((group, entityId) => {
      const entity = this.entitiesMap.get(entityId);
      if (entity) this.attachDebugCollisionBox(entity, group, 'resource');
    });
  }

  private syncDebugCollisionBoxVisibility() {
    for (const entry of this.debugCollisionBoxes) {
      entry.box.visible =
        this.isDebugCollisionBoxesVisible && this.debugCollisionLayerVisibility[entry.layer];
    }
  }

  public setDebugCollisionBoxes(enabled: boolean): boolean {
    this.isDebugCollisionBoxesVisible = enabled;
    if (enabled && this.debugCollisionBoxes.length === 0) {
      this.rebuildDebugCollisionBoxes();
    } else {
      this.syncDebugCollisionBoxVisibility();
    }
    return this.isDebugCollisionBoxesVisible;
  }

  public toggleDebugCollisionBoxes(): boolean {
    return this.setDebugCollisionBoxes(!this.isDebugCollisionBoxesVisible);
  }

  public setDebugCollisionLayerVisible(
    layer: 'building' | 'monster' | 'resource',
    enabled: boolean
  ) {
    this.debugCollisionLayerVisibility[layer] = enabled;
    this.syncDebugCollisionBoxVisibility();
  }

  public getDebugCollisionState() {
    let building = 0;
    let monster = 0;
    let resource = 0;
    for (const entry of this.debugCollisionBoxes) {
      if (entry.layer === 'building') building++;
      else if (entry.layer === 'monster') monster++;
      else if (entry.layer === 'resource') resource++;
    }
    return {
      visible: this.isDebugCollisionBoxesVisible,
      layers: { ...this.debugCollisionLayerVisibility },
      counts: {
        building,
        monster,
        resource,
        total: this.debugCollisionBoxes.length,
      },
      colors: {
        building: '#facc15',
        monster: '#f43f5e',
        resource: '#22c55e',
      },
    };
  }

  public dispose() {
    this.isDisposed = true;
    this.isBuildingWorldNow = false;
    if (this.worldBuildRafId !== null) {
      cancelAnimationFrame(this.worldBuildRafId);
      this.worldBuildRafId = null;
    }
    cancelAnimationFrame(this.animFrameId);
    clearTimeout(this.animFrameId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onOrientationChange);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.cameraController.dispose();

    this.vanguard3DRig?.controller.dispose();
    this.vanguard3DRig = null;
    this.shaderBarrierMap.forEach((b) => disposeProtectionBarrier(b));
    this.shaderBarrierMap.clear();
    this.vfxManager?.dispose();
    this.environmentManager?.dispose();

    this.debugCollisionGeos.forEach((geo) => geo.dispose());
    this.debugCollisionGeos.clear();
    if (this.debugCollisionMats) {
      this.debugCollisionMats.building.dispose();
      this.debugCollisionMats.monster.dispose();
      this.debugCollisionMats.resource.dispose();
      this.debugCollisionMats = null;
    }
    this.debugCollisionBoxes = [];

    const domEl = this.renderer?.domElement;
    if (domEl) {
      domEl.removeEventListener('webglcontextlost', this.onContextLost);
      domEl.removeEventListener('webglcontextrestored', this.onContextRestored);
    }

    if (this.scene) {
      if (this.scene.environment) {
        this.scene.environment.dispose();
        this.scene.environment = null;
      }
      const disposedGeos = new Set<THREE.BufferGeometry>();
      const disposedMats = new Set<THREE.Material>();
      const disposedTexs = new Set<THREE.Texture>();
      const disposeMat = (m: THREE.Material) => {
        if (disposedMats.has(m)) return;
        disposedMats.add(m);
        const rec = m as unknown as Record<string, unknown>;
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'aoMap', 'bumpMap']) {
          const val = rec[key];
          if (val && typeof val === 'object' && 'isTexture' in val) {
            const tex = val as THREE.Texture;
            if (!tex.userData?.preserveSharedCache && !disposedTexs.has(tex)) {
              disposedTexs.add(tex);
              tex.dispose();
            }
          }
        }
        m.dispose();
      };
      this.scene.traverse((obj) => {
        const meshLike = obj as THREE.Mesh;
        if (meshLike.geometry && !disposedGeos.has(meshLike.geometry)) {
          disposedGeos.add(meshLike.geometry);
          meshLike.geometry.dispose();
        }
        if (meshLike.material) {
          if (Array.isArray(meshLike.material)) {
            meshLike.material.forEach(disposeMat);
          } else {
            disposeMat(meshLike.material);
          }
        }
      });
    }

    this.renderer.dispose();
    if (this.container && domEl && this.container.contains(domEl)) {
      this.container.removeChild(domEl);
    }
    try {
      const gl = this.renderer.getContext();
      if (gl && !gl.isContextLost()) {
        this.renderer.forceContextLoss();
      }
    } catch {
      // Ignore context-loss cleanup errors
    }
  }
}
