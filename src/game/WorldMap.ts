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
  WorldEntity,
  EntityAction,
  CastleSpawnData,
  generateRandomCastles,
} from './WorldCoordinates';
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
}

/**
 * Procedural Painted Himalayan Mountain Skyline Texture
 */
function createHimalayanSkylineTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // 1. Sky Gradient: Azure to warm golden horizon
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 750);
  skyGrad.addColorStop(0, '#0f2942');
  skyGrad.addColorStop(0.35, '#1e40af');
  skyGrad.addColorStop(0.65, '#38bdf8');
  skyGrad.addColorStop(0.85, '#fed7aa');
  skyGrad.addColorStop(1.0, '#fef08a');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 2048, 1024);

  // Morning sun disk
  const sunGrad = ctx.createRadialGradient(1500, 320, 10, 1500, 320, 160);
  sunGrad.addColorStop(0, '#fffbeb');
  sunGrad.addColorStop(0.3, '#fef08a');
  sunGrad.addColorStop(0.8, 'rgba(253, 224, 71, 0.25)');
  sunGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(1500, 320, 160, 0, Math.PI * 2);
  ctx.fill();

  // 2. Distant Snow Peaks (Everest, Annapurna, Machapuchare)
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(0, 720);
  for (let x = 0; x <= 2048; x += 16) {
    const peak1 = Math.sin(x * 0.007) * 170;
    const peak2 = Math.cos(x * 0.018) * 95;
    const peak3 = Math.sin(x * 0.045) * 40;
    const y = 490 - (peak1 + peak2 + peak3);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(2048, 1024);
  ctx.lineTo(0, 1024);
  ctx.closePath();
  ctx.fill();

  // Shaded mountain slopes
  ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.beginPath();
  ctx.moveTo(0, 720);
  for (let x = 0; x <= 2048; x += 20) {
    const y = 525 - (Math.sin(x * 0.007 + 0.5) * 150 + Math.cos(x * 0.02) * 75);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(2048, 1024);
  ctx.lineTo(0, 1024);
  ctx.closePath();
  ctx.fill();

  // 3. Mid-range Mountain Ridges with Pine Forest
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(0, 780);
  for (let x = 0; x <= 2048; x += 32) {
    const y = 650 - (Math.sin(x * 0.012) * 85 + Math.cos(x * 0.028) * 45);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(2048, 1024);
  ctx.lineTo(0, 1024);
  ctx.closePath();
  ctx.fill();

  // 4. Soft Mountain Mist
  const mistGrad = ctx.createLinearGradient(0, 640, 0, 960);
  mistGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  mistGrad.addColorStop(0.5, 'rgba(241, 245, 249, 0.6)');
  mistGrad.addColorStop(1, 'rgba(226, 232, 240, 0.95)');
  ctx.fillStyle = mistGrad;
  ctx.fillRect(0, 640, 2048, 320);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export class WorldMap {
  public scene!: THREE.Scene;
  public renderer!: THREE.WebGLRenderer;
  public terrainGenerator!: TerrainGenerator;
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
  public atmosphereGroup = new THREE.Group();

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
  private buildingMeshesMap = new Map<string, THREE.Group>();

  // Selection ring indicator
  private selectionIndicator!: THREE.Mesh;
  private selectedEntity: WorldEntity | null = null;

  // Tactical path line
  private tacticalLine!: THREE.Line;

  // Army State - Troops originate from User's "My Castle" gate
  public armyState: 'IDLE' | 'MARCHING' | 'ATTACKING' | 'GATHERING' | 'RETURNING' = 'IDLE';
  public armyHomePos = new THREE.Vector3(800, 10.0, 751);
  public armyPos = new THREE.Vector3(800, 10.0, 751);
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

  // Atmospheric living world elements (clouds & high-altitude eagles)
  private atmosphericClouds: Array<{ group: THREE.Group; baseX: number; baseZ: number; speedX: number; phase: number }> = [];
  private soaringEagles: Array<{ group: THREE.Group; cx: number; cz: number; baseY: number; radius: number; speed: number; phase: number }> = [];

  // Conquest references for Shrine C/B/A & The Congress ownership swapping
  private conqueredCrystalMat!: THREE.MeshStandardMaterial;
  private conqueredRingMat!: THREE.MeshStandardMaterial;
  private buildingConquestRefs = new Map<
    string,
    {
      crystalMeshes: THREE.Mesh[];
      ringMesh?: THREE.Mesh;
      badgeSprite: THREE.Sprite;
      group: THREE.Group;
      badgeY: number;
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

  // 3D Inside Kingdom Walled Courtyard & Merge System
  public insideKingdom3D!: InsideKingdom3D;
  public currentSceneMode: 'world' | 'kingdom' = 'world';

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

    this.sharedArrowGeo.rotateX(Math.PI / 2);
    this.sharedShockwaveGeo.rotateX(Math.PI / 2);

    this.initScene();
    this.initLighting();
    this.initTerrain();
    this.initAtmosphere();
    this.initKingdomBuildings();
    this.initStrategicDistanceLines();
    this.initRandomCastles();
    this.initInsideKingdom3D();
    this.initMonsters();
    this.initResources();
    this.initArmyBattalion();
    this.initTacticalLine();
    this.initSelectionIndicator();
    this.initCameraController(options.onCameraUpdate);

    const myCastle = this.castlesList.find((c) => c.isMyCastle);
    if (myCastle) {
      this.cameraController.setHomeCoordinates(myCastle.position[0], myCastle.position[2], true);
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.cameraController.camera);
    }
    this.startLoop();
  }

  private initInsideKingdom3D() {
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
  }

  private initScene() {
    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#38648c');
    this.scene.fog = new THREE.FogExp2('#537f9e', 0.00085);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // Realistic Studio Environment Map for metallic gold spires, water, and armor
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.container.appendChild(this.renderer.domElement);

    // Panoramic Himalayan Mountain Skyline Background Dome (sized for full 100% Zoom Out)
    const skyTex = createHimalayanSkylineTexture();
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const skyGeo = new THREE.CylinderGeometry(4400, 4400, 1800, 64, 1, true);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.position.set(800, 260, 800);
    this.scene.add(skyMesh);
  }

  private initLighting() {
    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x1c2e22, 1.45);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffedd5, 3.4);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.left = -135;
    this.sunLight.shadow.camera.right = 135;
    this.sunLight.shadow.camera.top = 135;
    this.sunLight.shadow.camera.bottom = -135;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 450;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  private initTerrain() {
    this.terrainGenerator = new TerrainGenerator();

    // Maximize grazing-angle texture sharpness on terrain
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
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
   * High-altitude drifting cloud wisps and soaring Himalayan eagles for realistic living atmosphere
   */
  private initAtmosphere() {
    this.scene.add(this.atmosphereGroup);

    const cloudGeo = new THREE.DodecahedronGeometry(1, 1);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 1.0,
      metalness: 0.0,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    });

    const cloudSpots: Array<[number, number, number, number]> = [
      [260, 86, 260, 1.4], [1340, 90, 290, 1.5], [290, 92, 1340, 1.6], [1320, 88, 1310, 1.4],
      [620, 82, 460, 1.2], [980, 84, 1140, 1.3], [440, 94, 960, 1.45], [1160, 85, 580, 1.25],
      [800, 98, 220, 1.5], [800, 98, 1380, 1.5],
    ];

    cloudSpots.forEach(([cx, cy, cz, scale], i) => {
      const cGrp = new THREE.Group();
      cGrp.position.set(cx, cy, cz);
      for (let p = 0; p < 3; p++) {
        const puff = new THREE.Mesh(cloudGeo, cloudMat);
        puff.position.set((p - 1) * 18 * scale, (p % 2) * 3.5, (p - 1) * 6);
        puff.scale.set(22 * scale, 5.5 * scale, 14 * scale);
        cGrp.add(puff);
      }
      this.atmosphereGroup.add(cGrp);
      this.atmosphericClouds.push({
        group: cGrp,
        baseX: cx,
        baseZ: cz,
        speedX: 3.2 + (i % 3) * 1.1,
        phase: i * 1.1,
      });
    });

    const eagleBodyGeo = new THREE.ConeGeometry(0.42, 2.2, 5);
    eagleBodyGeo.rotateX(Math.PI / 2);
    const eagleWingGeo = new THREE.BoxGeometry(2.3, 0.08, 0.72);
    const eagleMat = new THREE.MeshStandardMaterial({ color: 0x3b281c, roughness: 0.85 });

    const eaglePeaks: Array<[number, number, number]> = [
      [240, 66, 240], [1360, 68, 240], [240, 70, 1360], [1360, 72, 1360],
      [800, 62, 800], [560, 58, 720], [1160, 60, 720],
    ];

    eaglePeaks.forEach(([ex, ey, ez], idx) => {
      const bird = new THREE.Group();
      bird.position.set(ex, ey, ez);

      const body = new THREE.Mesh(eagleBodyGeo, eagleMat);
      bird.add(body);

      const leftWing = new THREE.Mesh(eagleWingGeo, eagleMat);
      leftWing.position.set(-1.15, 0.1, 0);
      leftWing.userData = { isEagleWingLeft: true };
      bird.add(leftWing);

      const rightWing = new THREE.Mesh(eagleWingGeo, eagleMat);
      rightWing.position.set(1.15, 0.1, 0);
      rightWing.userData = { isEagleWingRight: true };
      bird.add(rightWing);

      this.atmosphereGroup.add(bird);
      this.soaringEagles.push({
        group: bird,
        cx: ex,
        cz: ez,
        baseY: ey,
        radius: 34 + (idx % 3) * 16,
        speed: 0.34 + (idx % 3) * 0.08,
        phase: idx * 1.4,
      });
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
        ctx.fillText(starsText, 256, 52);
      }

      // Main Title
      ctx.font = "800 34px 'Barlow Condensed', sans-serif";
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(title, 256, starsText ? 94 : 76);

      // Subtitle
      ctx.font = "700 24px 'Inter', sans-serif";
      ctx.fillStyle = accentColor;
      ctx.textAlign = 'center';
      ctx.fillText(subtitle, 256, starsText ? 132 : 118);
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
    //    Coordinate: [800, 10.0, 800]
    // =====================================================================
    const congressPlot = RESERVED_PLOTS.find((p) => p.type === 'congress');
    if (congressPlot) {
      const citadelGroup = new THREE.Group();
      const cY = this.terrainGenerator.getHeightAt(congressPlot.position[0], congressPlot.position[2]);
      congressPlot.position[1] = cY;
      citadelGroup.position.set(congressPlot.position[0], cY, congressPlot.position[2]);

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
      citadelGroundRing.userData = { isBlessingRing: true };
      citadelGroup.add(citadelGroundRing);

      const citadelBadge = this.createFloatingBadgeSprite(
        'THE CONGRESS',
        `Continent 1 Citadel · [${Math.round(congressPlot.position[0])}, ${Math.round(congressPlot.position[2])}]`,
        '👑 ★★★ CONGRESS (ATTACKABLE) ★★★',
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
        ringMesh: citadelGroundRing,
        badgeSprite: citadelBadge,
        group: citadelGroup,
        badgeY: 36.5,
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
    // 2. FOUR INNER SANCTUM SHRINES (Shrine A1–A4)
    // =====================================================================
    const aBaseGeo = new THREE.CylinderGeometry(6.8, 7.6, 4.8, 8);
    const aTrimGeo = new THREE.CylinderGeometry(7.2, 7.2, 0.55, 8);
    const aMidGeo = new THREE.CylinderGeometry(5.0, 5.8, 5.2, 8);
    const aCrownGeo = new THREE.CylinderGeometry(5.6, 5.2, 1.2, 8);
    const aTurretGeo = new THREE.CylinderGeometry(1.4, 1.7, 6.2, 6);
    const aTurretCapGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.4, 6);
    const aTurretTipGeo = new THREE.ConeGeometry(1.25, 3.8, 5);
    const aSpireGeo = new THREE.ConeGeometry(3.8, 11.5, 6);
    const aOrbGeo = new THREE.OctahedronGeometry(0.75, 0);
    const aRingGeo = new THREE.RingGeometry(7.6, 8.6, 28);

    const shrineASites = RESERVED_PLOTS.filter((p) => p.type === 'shrine_a');
    shrineASites.forEach((site) => {
      const groundY = this.terrainGenerator.getHeightAt(site.position[0], site.position[2]);
      site.position[1] = groundY;

      const bGroup = new THREE.Group();
      bGroup.position.set(site.position[0], groundY, site.position[2]);

      addMesh(bGroup, aBaseGeo, stoneMat, 0, 2.4, 0);
      addMesh(bGroup, aTrimGeo, goldMat, 0, 4.9, 0);
      addMesh(bGroup, aMidGeo, darkSlateMat, 0, 7.6, 0);
      addMesh(bGroup, aCrownGeo, goldMat, 0, 10.6, 0);

      for (const [tx, tz] of [
        [-4.8, -4.8],
        [4.8, -4.8],
        [-4.8, 4.8],
        [4.8, 4.8],
      ]) {
        addMesh(bGroup, aTurretGeo, stoneMat, tx, 3.1, tz);
        addMesh(bGroup, aTurretCapGeo, goldMat, tx, 6.3, tz);
        addMesh(bGroup, aTurretTipGeo, deepCrystalMat, tx, 8.4, tz);
      }

      const aSpireMesh = addMesh(bGroup, aSpireGeo, arcaneCrystalMat, 0, 16.8, 0);

      for (let orbIdx = 0; orbIdx < 2; orbIdx++) {
        const orb = addMesh(bGroup, aOrbGeo, goldMat, 0, 15.5, 0);
        orb.userData = {
          isWardOrb: true,
          orbitRadius: 6.5,
          orbitSpeed: 1.8,
          orbitPhase: orbIdx * Math.PI,
        };
      }

      const outerRing = new THREE.Mesh(aRingGeo, goldRingMat);
      outerRing.rotation.x = -Math.PI / 2;
      outerRing.position.y = 0.22;
      outerRing.userData = { isWardRing: true };
      bGroup.add(outerRing);

      const badge = this.createFloatingBadgeSprite(
        site.name.toUpperCase(),
        `[${Math.round(site.position[0])}, ${Math.round(site.position[2])}] · Inner Sanctum`,
        '★★★ TIER A · ATTACK ★★★',
        '#facc15',
        '#38bdf8',
        14.5,
        4.6
      );
      badge.position.set(0, 26.2, 0);
      bGroup.add(badge);

      const aCrystals: THREE.Mesh[] = [aSpireMesh];
      bGroup.traverse((ch) => {
        const m = ch as THREE.Mesh;
        if (m.isMesh && m.material === deepCrystalMat) aCrystals.push(m);
      });

      this.buildingsGroup.add(bGroup);
      this.buildingConquestRefs.set(site.id, {
        crystalMeshes: aCrystals,
        ringMesh: outerRing,
        badgeSprite: badge,
        group: bGroup,
        badgeY: 26.2,
      });
      registerEntity(bGroup, {
        id: site.id,
        name: site.name,
        category: 'building',
        type: 'shrine_a',
        subtype: 'shrine_a',
        level: 20,
        position: site.position,
        radius: site.radius,
        health: 6500,
        maxHealth: 6500,
        tier: 3,
        ownerFaction: 'neutral',
        buffLabel: '+12% Attack Power',
        description: site.description,
        actions: ['attack', 'rally', 'scout', 'inspect'],
      });
    });

    // =====================================================================
    // 3. TWELVE MID-RING SHRINES (Shrine B1–B12)
    // =====================================================================
    const bTier1Geo = new THREE.CylinderGeometry(6.0, 6.8, 1.2, 8);
    const bTier2Geo = new THREE.CylinderGeometry(4.8, 5.4, 1.1, 8);
    const bTier3Geo = new THREE.CylinderGeometry(3.6, 4.0, 1.0, 8);
    const bPillarGeo = new THREE.CylinderGeometry(0.42, 0.52, 5.2, 8);
    const bPillarCapGeo = new THREE.SphereGeometry(0.6, 8, 8);
    const bCoreGeo = new THREE.OctahedronGeometry(2.6, 0);
    const bShardGeo = new THREE.ConeGeometry(1.1, 4.8, 5);
    const bRingGeo = new THREE.RingGeometry(6.2, 7.1, 24);

    const shrineBSites = RESERVED_PLOTS.filter((p) => p.type === 'shrine_b');
    shrineBSites.forEach((site, idx) => {
      const groundY = this.terrainGenerator.getHeightAt(site.position[0], site.position[2]);
      site.position[1] = groundY;

      const sGroup = new THREE.Group();
      sGroup.position.set(site.position[0], groundY, site.position[2]);

      addMesh(sGroup, bTier1Geo, stoneMat, 0, 0.6, 0);
      addMesh(sGroup, bTier2Geo, goldMat, 0, 1.75, 0);
      addMesh(sGroup, bTier3Geo, darkSlateMat, 0, 2.8, 0);

      for (const [px, pz] of [
        [-3.6, -3.6],
        [3.6, -3.6],
        [-3.6, 3.6],
        [3.6, 3.6],
      ]) {
        addMesh(sGroup, bPillarGeo, goldMat, px, 3.4, pz);
        addMesh(sGroup, bPillarCapGeo, arcaneCrystalMat, px, 6.2, pz);
      }

      const centerCrystal = addMesh(sGroup, bCoreGeo, arcaneCrystalMat, 0, 7.4, 0);
      centerCrystal.scale.set(0.85, 1.85, 0.85);
      centerCrystal.userData = { isFloatingRock: true, phase: idx * 0.9 };

      for (let k = 0; k < 4; k++) {
        const ang = (k * Math.PI) / 2;
        const shard = addMesh(
          sGroup,
          bShardGeo,
          deepCrystalMat,
          Math.cos(ang) * 2.3,
          5.0,
          Math.sin(ang) * 2.3
        );
        shard.rotation.x = Math.sin(ang) * 0.4;
        shard.rotation.z = -Math.cos(ang) * 0.4;
      }

      const bRingMesh = new THREE.Mesh(bRingGeo, cyanRingMat);
      bRingMesh.rotation.x = -Math.PI / 2;
      bRingMesh.position.y = 0.2;
      bRingMesh.userData = { isBlessingRing: true };
      sGroup.add(bRingMesh);

      const badge = this.createFloatingBadgeSprite(
        site.name.toUpperCase(),
        `[${Math.round(site.position[0])}, ${Math.round(site.position[2])}] · Mid Ring`,
        '★★ TIER B · ATTACK ★★',
        '#38bdf8',
        '#7dd3fc',
        13.2,
        4.3
      );
      badge.position.set(0, 15.5, 0);
      sGroup.add(badge);

      const bCrystals: THREE.Mesh[] = [centerCrystal];
      sGroup.traverse((ch) => {
        const m = ch as THREE.Mesh;
        if (m.isMesh && (m.material === arcaneCrystalMat || m.material === deepCrystalMat) && m !== centerCrystal) {
          bCrystals.push(m);
        }
      });

      this.buildingsGroup.add(sGroup);
      this.buildingConquestRefs.set(site.id, {
        crystalMeshes: bCrystals,
        ringMesh: bRingMesh,
        badgeSprite: badge,
        group: sGroup,
        badgeY: 15.5,
      });
      registerEntity(sGroup, {
        id: site.id,
        name: site.name,
        category: 'building',
        type: 'shrine_b',
        subtype: 'shrine_b',
        level: 16,
        position: site.position,
        radius: site.radius,
        health: 4600,
        maxHealth: 4600,
        tier: 2,
        ownerFaction: 'neutral',
        buffLabel: '+8% March Speed',
        description: site.description,
        actions: ['attack', 'rally', 'scout', 'inspect'],
      });
    });

    // =====================================================================
    // 4. TWENTY OUTER PERIMETER SHRINES (Shrine C1–C20)
    // =====================================================================
    const cPedestalGeo = new THREE.CylinderGeometry(4.0, 4.6, 1.9, 8);
    const cCollarGeo = new THREE.CylinderGeometry(4.3, 4.3, 0.38, 8);
    const cShaftGeo = new THREE.CylinderGeometry(2.5, 3.2, 7.0, 8);
    const cCapGeo = new THREE.CylinderGeometry(3.0, 2.7, 1.0, 8);
    const cSpireGeo = new THREE.ConeGeometry(2.2, 6.8, 6);
    const cMiniShardGeo = new THREE.ConeGeometry(0.7, 3.0, 5);
    const cCrownOrbGeo = new THREE.OctahedronGeometry(0.8, 0);
    const cWardRingGeo = new THREE.RingGeometry(4.6, 5.4, 20);

    const shrineCSites = RESERVED_PLOTS.filter((p) => p.type === 'shrine_c');
    shrineCSites.forEach((site) => {
      const groundY = this.terrainGenerator.getHeightAt(site.position[0], site.position[2]);
      site.position[1] = groundY;

      const tGroup = new THREE.Group();
      tGroup.position.set(site.position[0], groundY, site.position[2]);

      addMesh(tGroup, cPedestalGeo, stoneMat, 0, 0.95, 0);
      addMesh(tGroup, cCollarGeo, goldMat, 0, 2.0, 0);
      addMesh(tGroup, cShaftGeo, darkSlateMat, 0, 5.5, 0);
      addMesh(tGroup, cCapGeo, goldMat, 0, 9.5, 0);
      const cSpireMesh = addMesh(tGroup, cSpireGeo, arcaneCrystalMat, 0, 13.4, 0);

      for (let c = 0; c < 4; c++) {
        const ang = (c * Math.PI) / 2 + Math.PI / 4;
        const miniShard = addMesh(
          tGroup,
          cMiniShardGeo,
          deepCrystalMat,
          Math.cos(ang) * 2.6,
          10.2,
          Math.sin(ang) * 2.6
        );
        miniShard.rotation.x = Math.sin(ang) * 0.25;
        miniShard.rotation.z = -Math.cos(ang) * 0.25;
      }

      const starOrb = addMesh(tGroup, cCrownOrbGeo, goldMat, 0, 17.5, 0);
      starOrb.userData = { isBrazier: true };

      const wardMesh = new THREE.Mesh(cWardRingGeo, cyanRingMat);
      wardMesh.rotation.x = -Math.PI / 2;
      wardMesh.position.y = 0.2;
      wardMesh.userData = { isWardRing: true };
      tGroup.add(wardMesh);

      const badge = this.createFloatingBadgeSprite(
        site.name.toUpperCase(),
        `[${Math.round(site.position[0])}, ${Math.round(site.position[2])}] · Frontier`,
        '✦ TIER C · ATTACK ✦',
        '#38bdf8',
        '#bae6fd',
        12.0,
        4.0
      );
      badge.position.set(0, 21.2, 0);
      tGroup.add(badge);

      const cCrystals: THREE.Mesh[] = [cSpireMesh];
      tGroup.traverse((ch) => {
        const m = ch as THREE.Mesh;
        if (m.isMesh && m.material === deepCrystalMat) cCrystals.push(m);
      });

      this.buildingsGroup.add(tGroup);
      this.buildingConquestRefs.set(site.id, {
        crystalMeshes: cCrystals,
        ringMesh: wardMesh,
        badgeSprite: badge,
        group: tGroup,
        badgeY: 21.2,
      });
      registerEntity(tGroup, {
        id: site.id,
        name: site.name,
        category: 'building',
        type: 'shrine_c',
        subtype: 'shrine_c',
        level: 12,
        position: site.position,
        radius: site.radius,
        health: 3200,
        maxHealth: 3200,
        tier: 1,
        ownerFaction: 'neutral',
        buffLabel: '+5% Resource Yield',
        description: site.description,
        actions: ['attack', 'rally', 'scout', 'inspect'],
      });
    });
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
    };

    return this.sharedMats;
  }

  /**
   * Spawns User's "My Castle" and 10 Alliance Member Castles at random non-overlapping locations
   */
  private initRandomCastles() {
    this.scene.add(this.castlesGroup);
    this.relocateCastles(false);
  }

  public relocateCastles(focusMyCastle = true): CastleSpawnData[] {
    // 1. Clean up old castle meshes, entities, and pickables
    for (const oldPick of this.castlePickables) {
      const idx = this.pickableObjects.indexOf(oldPick);
      if (idx !== -1) this.pickableObjects.splice(idx, 1);
    }
    this.castlePickables = [];

    for (const c of this.castlesList) {
      this.entitiesMap.delete(c.id);
      this.buildingMeshesMap.delete(c.id);
    }

    while (this.castlesGroup.children.length > 0) {
      const child = this.castlesGroup.children[0];
      this.castlesGroup.remove(child);
    }

    // 2. Generate new non-overlapping random coordinates for My Castle + 10 Alliance Castles
    this.castlesList = generateRandomCastles((x, z) => this.terrainGenerator.getHeightAt(x, z));

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
      cGroup.add(ring);

      // Floating 3D Identification Badge
      const badge = this.createFloatingBadgeSprite(
        isMine
          ? '🏰 MY CASTLE (LORD DANGOL)'
          : isEnemy
            ? `⚔️ ${castle.name.toUpperCase()}`
            : `🛡️ ${castle.owner.toUpperCase()}`,
        `${castle.allianceTag} · Lv.${castle.level} · [${castle.position[0]}, ${castle.position[2]}]`,
        isMine ? '👑 MY CASTLE 👑' : isEnemy ? '☠️ ENEMY CITADEL · ATTACK' : '⚔️ ALLIANCE MEMBER',
        isMine ? '#10b981' : isEnemy ? '#ef4444' : '#38bdf8',
        isMine ? '#fde047' : isEnemy ? '#fca5a5' : '#93c5fd',
        isMine ? 16.5 : isEnemy ? 14.5 : 13.5,
        isMine ? 5.2 : 4.4
      );
      badge.position.set(0, 22.8 * s, 0);
      cGroup.add(badge);

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
        health: isMine ? 10000 : isEnemy ? 5200 : 7500,
        maxHealth: isMine ? 10000 : isEnemy ? 5200 : 7500,
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

    this.onCastlesUpdated?.(this.castlesList);

    if (focusMyCastle && this.cameraController && myCastle) {
      this.cameraController.setHomeCoordinates(myCastle.position[0], myCastle.position[2], false);
      this.cameraController.panTo(myCastle.position[0], myCastle.position[2]);
    }

    return this.castlesList;
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
      wx = Math.max(80, Math.min(1520, wx));
      wz = Math.max(80, Math.min(1520, wz));

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

      const hitCollider = new THREE.Mesh(
        new THREE.CylinderGeometry(entity.radius, entity.radius, 9, 8),
        new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 })
      );
      hitCollider.position.y = 4.5;
      hitCollider.userData = { gameEntity: entity };
      rGroup.add(hitCollider);

      this.pickableObjects.push(hitCollider);
      this.starterResourcePickables.push(hitCollider);
      this.starterResourceGroups.push(rGroup);
      this.starterResourceIds.push(entity.id);
      this.resourcesGroup.add(rGroup);
    }
  }

  // ============================================================
  // 2. PROCEDURAL 3D MONSTERS (16+ Living Beasts, Drakes & Bosses)
  // ============================================================
  private initMonsters() {
    this.scene.add(this.monstersGroup);

    const iceTex = createIceSpikeTexture();
    const iceMat = new THREE.MeshStandardMaterial({ map: iceTex, roughness: 0.25, metalness: 0.4, transparent: true, opacity: 0.92 });
    const furWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.95 });
    const darkRockMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85, metalness: 0.3 });
    const magmaMat = new THREE.MeshStandardMaterial({ color: 0xff4500, emissive: 0xff3300, emissiveIntensity: 3.2 });
    const woodBarkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9 });
    const beastDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.88 });
    const dragonRedMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.4, metalness: 0.3 });
    const eyeCyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const eyeAmberMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

    const addMesh = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    const registerMonster = (group: THREE.Group, entity: WorldEntity) => {
      group.userData = { gameEntity: entity };
      this.entitiesMap.set(entity.id, entity);
      this.monsterMeshesMap.set(entity.id, group);

      const hitCollider = new THREE.Mesh(
        new THREE.CylinderGeometry(entity.radius, entity.radius, 10, 8),
        new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 })
      );
      hitCollider.position.y = 5;
      hitCollider.userData = { gameEntity: entity };
      group.add(hitCollider);

      this.pickableObjects.push(hitCollider);
      this.monstersGroup.add(group);
    };

    for (const mData of WORLD_MONSTERS) {
      const groundY = this.terrainGenerator.getHeightAt(mData.position[0], mData.position[2]);
      mData.position[1] = groundY;
      const mGroup = new THREE.Group();
      mGroup.position.set(mData.position[0], groundY, mData.position[2]);

      if (mData.id.includes('yeti')) {
        // Ancient Frost Yeti King: Massive muscular chest, ice spikes, frost club
        const torso = addMesh(mGroup, new THREE.BoxGeometry(3.8, 4.2, 3.0), furWhiteMat, 0, 3.2, 0);
        torso.userData = { isYetiChest: true };
        addMesh(mGroup, new THREE.BoxGeometry(1.4, 3.8, 1.5), furWhiteMat, -2.6, 2.8, 0);
        addMesh(mGroup, new THREE.BoxGeometry(1.4, 3.8, 1.5), furWhiteMat, 2.6, 2.8, 0);
        addMesh(mGroup, new THREE.BoxGeometry(2.2, 2.2, 2.2), furWhiteMat, 0, 6.0, 0.3);
        // Pale cyan glowing eyes
        addMesh(mGroup, new THREE.SphereGeometry(0.2, 6, 6), eyeCyanMat, -0.5, 6.2, 1.3);
        addMesh(mGroup, new THREE.SphereGeometry(0.2, 6, 6), eyeCyanMat, 0.5, 6.2, 1.3);
        // Glacial Ice Horns
        addMesh(mGroup, new THREE.ConeGeometry(0.5, 2.8, 6), iceMat, -1.4, 7.4, 0.3).rotation.z = -0.45;
        addMesh(mGroup, new THREE.ConeGeometry(0.5, 2.8, 6), iceMat, 1.4, 7.4, 0.3).rotation.z = 0.45;
        // Spiked Glacial Club held in right arm
        const club = addMesh(mGroup, new THREE.CylinderGeometry(0.25, 0.55, 4.8, 8), darkRockMat, 3.2, 3.5, 1.2);
        club.rotation.x = 0.4;
        club.userData = { isYetiClub: true };
        addMesh(club, new THREE.ConeGeometry(0.35, 1.2, 6), iceMat, 0, 2.2, 0);
      } else if (mData.id.includes('crimson_wyvern') || mData.subtype === 'drake') {
        // Crimson Sky Wyvern & Mountain Drakes: Articulated dual wings & swaying tail
        const isWyvern = mData.id.includes('crimson_wyvern');
        const dMat = isWyvern ? dragonRedMat : darkRockMat;

        addMesh(mGroup, new THREE.BoxGeometry(3.2, 2.2, 5.4), dMat, 0, 2.5, 0);
        // Serpentine neck & head
        addMesh(mGroup, new THREE.CylinderGeometry(0.7, 1.0, 2.8, 6), dMat, 0, 3.8, 2.2).rotation.x = 0.5;
        addMesh(mGroup, new THREE.BoxGeometry(1.6, 1.4, 2.6), dMat, 0, 4.8, 3.4);
        // Fiery gullet / glowing maw
        addMesh(mGroup, new THREE.SphereGeometry(0.55, 8, 8), magmaMat, 0, 4.4, 4.2);
        // Articulated Left & Right Wings
        const wingL = new THREE.Group();
        wingL.position.set(-1.8, 3.2, 0);
        addMesh(wingL, new THREE.BoxGeometry(5.2, 0.18, 2.8), dMat, -2.5, 0, 0);
        addMesh(wingL, new THREE.ConeGeometry(0.4, 2.2, 5), iceMat, -4.8, 0, 1.2).rotation.z = 1.2;
        wingL.userData = { isWingLeft: true };
        mGroup.add(wingL);

        const wingR = new THREE.Group();
        wingR.position.set(1.8, 3.2, 0);
        addMesh(wingR, new THREE.BoxGeometry(5.2, 0.18, 2.8), dMat, 2.5, 0, 0);
        addMesh(wingR, new THREE.ConeGeometry(0.4, 2.2, 5), iceMat, 4.8, 0, 1.2).rotation.z = -1.2;
        wingR.userData = { isWingRight: true };
        mGroup.add(wingR);

        // Dragon Tail
        const tail = addMesh(mGroup, new THREE.ConeGeometry(0.8, 4.5, 6), dMat, 0, 2.0, -4.2);
        tail.rotation.x = -1.3;
        tail.userData = { isDragonTail: true };
      } else if (mData.subtype === 'golem') {
        // Corrupted Stone Colossus: Magma fissures & levitating shoulder boulders
        addMesh(mGroup, new THREE.BoxGeometry(3.2, 4.5, 2.4), darkRockMat, 0, 2.6, 0);
        addMesh(mGroup, new THREE.BoxGeometry(1.6, 1.6, 1.6), darkRockMat, 0, 5.4, 0);
        addMesh(mGroup, new THREE.SphereGeometry(0.65, 8, 8), magmaMat, 0, 3.0, 1.2);
        // Big heavy stone arms
        addMesh(mGroup, new THREE.BoxGeometry(1.4, 4.0, 1.4), darkRockMat, -2.4, 2.4, 0);
        addMesh(mGroup, new THREE.BoxGeometry(1.4, 4.0, 1.4), darkRockMat, 2.4, 2.4, 0);
        // Levitating shoulder boulders that bob in the air
        const floatRockL = addMesh(mGroup, new THREE.DodecahedronGeometry(0.85, 0), darkRockMat, -2.6, 5.6, 0);
        floatRockL.userData = { isFloatingRock: true, phase: 0 };
        const floatRockR = addMesh(mGroup, new THREE.DodecahedronGeometry(0.85, 0), darkRockMat, 2.6, 5.6, 0);
        floatRockR.userData = { isFloatingRock: true, phase: Math.PI };
      } else if (mData.subtype === 'treant') {
        // Ancient Forest Treant: Gnarled bark, swaying branches & bioluminescent nodes
        addMesh(mGroup, new THREE.CylinderGeometry(1.0, 1.8, 5.2, 7), woodBarkMat, 0, 2.6, 0);
        addMesh(mGroup, new THREE.DodecahedronGeometry(2.4, 1), new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 }), 0, 6.0, 0);
        addMesh(mGroup, new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 3.0 }), 0, 3.0, 1.1);
        // Swaying leafy branch arms
        const bArmL = addMesh(mGroup, new THREE.BoxGeometry(2.4, 0.6, 0.6), woodBarkMat, -2.0, 4.2, 0);
        bArmL.userData = { isTreantBranch: true, phase: 0 };
        const bArmR = addMesh(mGroup, new THREE.BoxGeometry(2.4, 0.6, 0.6), woodBarkMat, 2.0, 4.2, 0);
        bArmR.userData = { isTreantBranch: true, phase: Math.PI };
      } else {
        // Predators (Dire Wolf / Leopard / Chimera)
        addMesh(mGroup, new THREE.BoxGeometry(1.8, 1.5, 3.4), beastDarkMat, 0, 1.2, 0);
        addMesh(mGroup, new THREE.BoxGeometry(1.1, 1.1, 1.5), beastDarkMat, 0, 2.0, 2.0);
        addMesh(mGroup, new THREE.SphereGeometry(0.14, 6, 6), eyeAmberMat, -0.32, 2.2, 2.6);
        addMesh(mGroup, new THREE.SphereGeometry(0.14, 6, 6), eyeAmberMat, 0.32, 2.2, 2.6);
        // Articulated tail
        const tail = addMesh(mGroup, new THREE.CylinderGeometry(0.12, 0.22, 2.2, 6), beastDarkMat, 0, 1.6, -2.4);
        tail.rotation.x = 0.8;
        tail.userData = { isBeastTail: true };
      }

      registerMonster(mGroup, mData);
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

    return rGroup;
  }

  private initResources() {
    this.scene.add(this.resourcesGroup);

    const registerResource = (group: THREE.Group, entity: WorldEntity) => {
      group.userData = { gameEntity: entity };
      this.entitiesMap.set(entity.id, entity);

      const hitCollider = new THREE.Mesh(
        new THREE.CylinderGeometry(entity.radius, entity.radius, 9, 8),
        new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 })
      );
      hitCollider.position.y = 4.5;
      hitCollider.userData = { gameEntity: entity };
      group.add(hitCollider);

      this.pickableObjects.push(hitCollider);
      this.resourcesGroup.add(group);
    };

    for (const rData of WORLD_RESOURCES) {
      const rGroup = this.buildRealisticResourceGroup(rData);
      registerResource(rGroup, rData);
    }
  }

  // ============================================================
  // 4. MAGAR VANGUARD ARMY BATTALION & DRAGON BANNER SQUAD
  // ============================================================
  private initArmyBattalion() {
    this.armyGroup.position.copy(this.armyHomePos);
    this.armyGroup.visible = false;
    this.scene.add(this.armyGroup);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.85 });
    const clothMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xcfa07e, roughness: 0.8 });
    const dragonBannerTex = createDragonBannerTexture();
    const dragonBannerMat = new THREE.MeshStandardMaterial({ map: dragonBannerTex, side: THREE.DoubleSide, roughness: 0.5 });

    // 15 Formation Troops in 3 Rows of 5
    for (let i = 0; i < 15; i++) {
      const warrior = new THREE.Group();
      const col = i % 5;
      const row = Math.floor(i / 5);
      warrior.position.set((col - 2) * 0.9, 0, (row - 1) * 0.95);

      const isCommander = i === 2; // Front center is Commander
      const isArcher = row === 2; // Back row are Longbowmen
      warrior.userData = { idx: i, isCommander, isArcher };

      // Legs
      const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
      legL.position.set(-0.14, 0.28, 0);
      legL.userData = { isLegLeft: true };
      warrior.add(legL);

      const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
      legR.position.set(0.14, 0.28, 0);
      legR.userData = { isLegRight: true };
      warrior.add(legR);

      // Torso
      const torsoMat = isCommander
        ? new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.7, roughness: 0.3 })
        : clothMat;
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.8, 7), torsoMat);
      torso.position.y = 0.85;
      warrior.add(torso);

      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), skinMat);
      head.position.y = 1.38;
      warrior.add(head);

      // Helmet
      const helm = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.35, 7), metalMat);
      helm.position.y = 1.62;
      warrior.add(helm);

      if (isArcher) {
        // Recurve Bow held in left hand
        const bow = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x78350f }));
        bow.position.set(-0.35, 1.0, 0.1);
        bow.rotation.z = Math.PI / 2;
        warrior.add(bow);
      } else {
        // Khukuri curved sword held in right hand
        const khukuri = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, 0.14), metalMat);
        khukuri.position.set(0.4, 0.95, 0.15);
        khukuri.rotation.z = -0.2;
        khukuri.userData = { isWeapon: true };
        warrior.add(khukuri);

        // Round Buckler Shield on left forearm
        const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 10), metalMat);
        shield.position.set(-0.38, 0.95, 0.12);
        shield.rotation.x = Math.PI / 2;
        warrior.add(shield);
      }

      this.armyGroup.add(warrior);
    }

    // Imperial Vanguard Dragon Silk Banner Pole out in front
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.8, 8), new THREE.MeshStandardMaterial({ color: 0xdfba6e, metalness: 0.9 }));
    pole.position.set(-1.8, 2.4, 0.4);
    this.armyGroup.add(pole);

    const bannerMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6), dragonBannerMat);
    bannerMesh.position.set(-0.9, 3.4, 0.4);
    bannerMesh.userData = { isArmyBanner: true };
    this.armyGroup.add(bannerMesh);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 3.0 }));
    beacon.position.set(-1.8, 4.9, 0.4);
    this.armyGroup.add(beacon);
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
      initialTarget: [800, 10, 768],
      minZoom: 0.048,
      maxZoom: 3.2,
      onUpdate: onCameraUpdate,
      onSelectObject: this.handleObjectSelection,
      pickableObjects: this.pickableObjects,
    });

    window.addEventListener('resize', this.onResize);
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
        this.insideKingdom3D.handlePlotClick(foundPlotId);
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
      this.onBulletNotify?.({
        text:
          action === 'rally'
            ? `🚩 ALLIANCE RALLY LAUNCHED against ${target.name}!`
            : `⚔️ Lord Dangol dispatched Vanguard Battalion to assault ${target.name}!`,
        category: action === 'rally' ? 'rally' : 'attack',
      });
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

  private conquerStructure(entity: WorldEntity, meshGroup: THREE.Group) {
    entity.ownerFaction = 'alliance';
    entity.conqueredBy = 'Lord Dangol [CRYSTAL]';
    entity.health = entity.maxHealth ?? 5000;
    entity.actions = ['garrison', 'upgrade', 'inspect'];

    const refs = this.buildingConquestRefs.get(entity.id);
    if (refs) {
      for (const m of refs.crystalMeshes) {
        m.material = this.conqueredCrystalMat;
      }
      if (refs.ringMesh) {
        refs.ringMesh.material = this.conqueredRingMat;
      }
      // Replace floating badge with Conquered Alliance Sovereign badge
      meshGroup.remove(refs.badgeSprite);
      const isCongress = entity.type === 'congress';
      const newBadge = this.createFloatingBadgeSprite(
        entity.name.toUpperCase(),
        `👑 CONQUERED BY [CRYSTAL] · ${entity.buffLabel || 'ALLIANCE'}`,
        isCongress ? '👑 IMPERIAL SOVEREIGNTY 👑' : '⚔️ ALLIANCE CONQUERED',
        '#10b981',
        '#fde047',
        isCongress ? 19.0 : 14.5,
        isCongress ? 5.8 : 4.5
      );
      newBadge.position.set(0, refs.badgeY, 0);
      meshGroup.add(newBadge);
      refs.badgeSprite = newBadge;
    }

    const origin = meshGroup.position;
    this.spawnConquestPillar(origin, entity.type === 'congress' ? 0xfacc15 : 0x10b981);
    this.spawnShockwave(origin, 0xfacc15, entity.radius * 1.9, 0.9);
    this.spawnShockwave(origin, 0x10b981, entity.radius * 2.5, 1.2);
    this.spawnImpactSparks(origin);

    const buffLabel = entity.buffLabel || '+5% Territory Buff';
    this.onStructureConquered?.(entity, buffLabel);
    this.onBulletNotify?.({
      text: `👑 CONQUEST! [CRYSTAL] Lord Dangol captured ${entity.name} (${buffLabel})!`,
      category: 'conquest',
    });
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
      this.dissolveMonsterIntoSmoke(meshGroup);
      this.onMonsterDefeated?.(entity);
      this.onBulletNotify?.({
        text: `💀 SLAYER! Lord Dangol vanquished ${entity.name} (Lv.${entity.level})!`,
        category: 'monster',
      });
    } else if (isEnemyCastle) {
      this.onAddCombatFloater?.('🔥 CITADEL BREACHED!', '#ff4d4f', screenX, screenY - 15);
      this.onAddCombatFloater?.('💰 +2,500 GOLD PLUNDERED!', '#facc15', screenX, screenY - 45);

      entity.isDefeated = true;
      this.spawnConquestPillar(meshGroup.position, 0xef4444);
      this.spawnShockwave(meshGroup.position, 0xef4444, entity.radius * 2.2, 1.0);
      this.dissolveMonsterIntoSmoke(meshGroup);
      this.onEnemyCastleDefeated?.(entity);
      this.onBulletNotify?.({
        text: `🔥 VICTORY! ${entity.name} breached & plundered by Lord Dangol!`,
        category: 'attack',
      });
    } else if (isConquerableStructure) {
      this.onAddCombatFloater?.('👑 CONQUERED!', '#10b981', screenX, screenY - 18);
      this.onAddCombatFloater?.(`✨ ${entity.buffLabel || 'ALLIANCE BUFF'}`, '#fde047', screenX, screenY - 48);
      this.conquerStructure(entity, meshGroup);
    }

    this.armyState = 'RETURNING';
    this.totalMarchDist = this.armyGroup.position.distanceTo(this.armyHomePos);
  }

  private dissolveMonsterIntoSmoke(group: THREE.Group) {
    group.visible = false;
    const origin = group.position;

    const smokeShades = [0xf1f5f9, 0xe2e8f0, 0xcbd5e1, 0x94a3b8];
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: smokeShades[Math.floor(Math.random() * smokeShades.length)],
        roughness: 0.95,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      });
      const puff = new THREE.Mesh(this.sharedSmokeGeo, mat);
      puff.position.set(
        origin.x + (Math.random() - 0.5) * 2.2,
        origin.y + 0.4 + Math.random() * 1.5,
        origin.z + (Math.random() - 0.5) * 2.2
      );
      this.scene.add(puff);

      this.activeSmokeParticles.push({
        mesh: puff,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 2.4, 2.5 + Math.random() * 3.2, (Math.random() - 0.5) * 2.4),
        rotSpeed: new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4),
        life: 0,
        maxLife: 2.0 + Math.random() * 0.6,
        initialScale: 0.4 + Math.random() * 0.3,
        targetScale: 2.8 + Math.random() * 1.4,
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
    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      if (!gl || !gl.fenceSync) {
        this.animFrameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
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
      const delta = Math.min(0.1, this.clock.getDelta());
      const elapsed = this.clock.getElapsedTime();

      this.cameraController.update(delta);

      // Dynamically scale fog density with zoom so Zoom Out 100 keeps the whole 1600x1600 continent crisp
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = 0.00085 * Math.min(1.0, Math.max(0.18, this.cameraController.zoom / 0.85));
      }

      // 0. Update Regional LOD Chunks, Waterfalls, Smooth Rivers & Mist
      this.terrainGenerator.updateTerrainOverflow(delta, elapsed, this.cameraController.camera);

      // 0b. Update Drifting Clouds & Soaring Himalayan Eagles
      if (this.atmosphereGroup.visible) {
        for (let i = 0; i < this.atmosphericClouds.length; i++) {
          const c = this.atmosphericClouds[i];
          c.group.position.x += c.speedX * delta;
          if (c.group.position.x > 1950) c.group.position.x = -350;
          c.group.position.y += Math.sin(elapsed * 0.4 + c.phase) * 0.015;
        }
        for (let i = 0; i < this.soaringEagles.length; i++) {
          const e = this.soaringEagles[i];
          const ang = elapsed * e.speed + e.phase;
          const nx = e.cx + Math.cos(ang) * e.radius;
          const nz = e.cz + Math.sin(ang) * e.radius;
          e.group.position.set(nx, e.baseY + Math.sin(elapsed * 1.4 + e.phase) * 2.2, nz);
          e.group.rotation.y = -ang;
          const flap = Math.sin(elapsed * 8.5 + e.phase) * 0.42;
          const ch = e.group.children;
          for (let j = 0; j < ch.length; j++) {
            if (ch[j].userData?.isEagleWingLeft) ch[j].rotation.z = flap;
            else if (ch[j].userData?.isEagleWingRight) ch[j].rotation.z = -flap;
          }
        }
      }

      const target = this.cameraController.target;
      this.sunLight.position.set(target.x - 70, target.y + 130, target.z + 65);
      this.sunLight.target.position.copy(target);
      this.sunLight.target.updateMatrixWorld();

      // 1. Monsters breathing & limb animations
      this.monsterMeshesMap.forEach((mGroup, id) => {
        const ent = this.entitiesMap.get(id);
        if (!ent || ent.isDefeated) return;
        const seed = (ent.position[0] * 0.08) % 10;
        mGroup.scale.y = 1.0 + Math.sin(elapsed * 2.4 + seed) * 0.035;

        const children = mGroup.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const ud = child.userData;
          if (!ud) continue;
          if (ud.isWingLeft) {
            child.rotation.z = 0.35 + Math.sin(elapsed * 5.2 + seed) * 0.35;
          } else if (ud.isWingRight) {
            child.rotation.z = -0.35 - Math.sin(elapsed * 5.2 + seed) * 0.35;
          } else if (ud.isDragonTail) {
            child.rotation.y = Math.sin(elapsed * 3.5 + seed) * 0.25;
          } else if (ud.isYetiClub) {
            child.rotation.x = 0.4 + Math.sin(elapsed * 2.2 + seed) * 0.15;
          } else if (ud.isFloatingRock) {
            child.position.y = 5.6 + Math.sin(elapsed * 2.8 + (ud.phase || 0)) * 0.35;
            child.rotation.y += delta * 0.8;
          } else if (ud.isTreantBranch) {
            child.rotation.z = Math.sin(elapsed * 2.0 + (ud.phase || 0)) * 0.2;
          } else if (ud.isBeastTail) {
            child.rotation.y = Math.sin(elapsed * 4.2 + seed) * 0.35;
          }
        }
      });

      // 2. Resources animations (waterwheel, windmill blades, saw blade, hoist pulley, swaying canopy, gold glints)
      const resGroups = this.resourcesGroup.children;
      for (let idx = 0; idx < resGroups.length; idx++) {
        const rChildren = resGroups[idx].children;
        for (let j = 0; j < rChildren.length; j++) {
          const mesh = rChildren[j];
          const ud = mesh.userData;
          if (ud?.isWaterwheel) {
            mesh.rotation.z += delta * 1.8;
          } else if (ud?.isWindmillBlades) {
            mesh.rotation.z -= delta * 1.35;
          } else if (ud?.isSawBlade) {
            mesh.rotation.x += delta * 9.0;
          } else if (ud?.isMineWheel) {
            mesh.rotation.z += delta * 2.2;
          } else if (ud?.isFoliageCanopy) {
            mesh.rotation.z = Math.sin(elapsed * 1.5 + idx) * 0.05;
          } else if (ud?.isGoldGlint) {
            const ph = ud.phase || 0;
            mesh.position.x = Math.cos(elapsed * 2.2 + ph) * 2.2;
            mesh.position.z = Math.sin(elapsed * 2.2 + ph) * 2.2;
            mesh.rotation.y += delta * 2.0;
          }
        }
      }

      // 3. Buildings & Castles animations
      const castleGroups = this.castlesGroup.children;
      for (let idx = 0; idx < castleGroups.length; idx++) {
        const cChildren = castleGroups[idx].children;
        for (let j = 0; j < cChildren.length; j++) {
          const child = cChildren[j];
          const ud = child.userData;
          if (!ud) continue;
          if (ud.isDragonBanner) {
            child.rotation.y = Math.sin(elapsed * 3.2 + (ud.phase || 0)) * 0.22;
          } else if (ud.isBrazierFlame) {
            const flicker = 0.88 + Math.sin(elapsed * 14.0 + (ud.phase || 0)) * 0.2;
            child.scale.set(1, flicker, 1);
          }
        }
      }

      const bGroups = this.buildingsGroup.children;
      for (let idx = 0; idx < bGroups.length; idx++) {
        const bChildren = bGroups[idx].children;
        for (let j = 0; j < bChildren.length; j++) {
          const child = bChildren[j];
          const ud = child.userData;
          if (!ud) continue;
          if (ud.isBanner) {
            child.rotation.y = Math.sin(elapsed * 4.2 + idx) * 0.16;
          } else if (ud.isDragonBanner) {
            child.rotation.y = Math.sin(elapsed * 3.2 + (ud.phase || 0)) * 0.24;
          } else if (ud.isPrayerFlag) {
            child.rotation.z = Math.sin(elapsed * 3.8 + idx) * 0.12;
          } else if (ud.isWardRing) {
            child.rotation.z += delta * 0.55;
          } else if (ud.isBlessingRing) {
            child.rotation.z += delta * 0.45;
          } else if (ud.isWardOrb) {
            const rad = ud.orbitRadius || 7.5;
            const spd = ud.orbitSpeed || 1.6;
            const ph = ud.orbitPhase || 0;
            child.position.x = Math.cos(elapsed * spd + ph) * rad;
            child.position.z = Math.sin(elapsed * spd + ph) * rad;
            child.position.y = 13.0 + Math.sin(elapsed * 2.5 + ph) * 0.4;
          }
        }
      }

      // 4. Army marching and interaction loop (Zero-GC pre-allocated vectors)
      if (this.armyGroup && this.armyState !== 'IDLE') {
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
              curPos.y = this.terrainGenerator.getHeightAt(curPos.x, curPos.z);
              this.armyGroup.rotation.y = Math.atan2(this._tempDir.x, this._tempDir.z);

              this.dustTimer += delta;
              if (this.dustTimer >= 0.12) {
                this.dustTimer = 0;
                this.spawnMarchingDustPuff(curPos);
              }

              this.armyGroup.children.forEach((child) => {
                if (child.userData?.isArmyBanner) {
                  child.rotation.y = Math.sin(elapsed * 6.0) * 0.22;
                }
                const w = child as THREE.Group;
                if (w.userData?.idx !== undefined) {
                  const idx = w.userData.idx;
                  w.position.y = Math.abs(Math.sin(elapsed * 14 + idx * 0.5)) * 0.15;
                  w.children.forEach((m) => {
                    if (m.userData?.isLegLeft) m.rotation.x = Math.sin(elapsed * 14 + idx) * 0.55;
                    else if (m.userData?.isLegRight) m.rotation.x = -Math.sin(elapsed * 14 + idx) * 0.55;
                  });
                }
              });

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
            curPos.y = this.terrainGenerator.getHeightAt(curPos.x, curPos.z);
            this.armyGroup.rotation.y = Math.atan2(this._tempDir.x, this._tempDir.z);
            this.armyPos.copy(curPos);

            this.dustTimer += delta;
            if (this.dustTimer >= 0.12) {
              this.dustTimer = 0;
              this.spawnMarchingDustPuff(curPos);
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

      // 5. Update 3D Inside Kingdom Courtyard & Merge Buildings when active
      if (this.currentSceneMode === 'kingdom' && this.insideKingdom3D) {
        this.insideKingdom3D.update(delta, elapsed);
      }

      this.renderer.render(this.scene, this.cameraController.camera);

      if (this.isSoftwareGl) {
        afterDraw(loop);
      } else {
        this.animFrameId = requestAnimationFrame(loop);
      }
    };

    loop();
  }

  private onResize = () => {
    if (!this.container || !this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
  };

  public panTo(x: number, z: number) {
    this.cameraController.panTo(x, z);
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
  public setSceneMode(mode: 'world' | 'kingdom') {
    this.currentSceneMode = mode;
    if (mode === 'kingdom') {
      this.buildingsGroup.visible = false;
      this.castlesGroup.visible = false;
      this.strategicLinesGroup.visible = false;
      this.monstersGroup.visible = false;
      this.resourcesGroup.visible = false;
      this.atmosphereGroup.visible = false;
      this.armyGroup.visible = false;
      this.tacticalLine.visible = false;
      this.selectionIndicator.visible = false;
      this.terrainGenerator.plotMarkersGroup.visible = false;

      this.insideKingdom3D.rootGroup.visible = true;
      this.cameraController.setPickables(this.insideKingdom3D.pickableObjects);
      this.cameraController.focusInsideKingdom();
      this.onInsideKingdomStateChange?.(this.insideKingdom3D.getState());
    } else {
      this.insideKingdom3D.rootGroup.visible = false;

      this.buildingsGroup.visible = true;
      this.castlesGroup.visible = true;
      this.strategicLinesGroup.visible = true;
      this.atmosphereGroup.visible = true;
      this.monstersGroup.visible = !this.isStrategicFilterActive;
      this.resourcesGroup.visible = !this.isStrategicFilterActive;
      this.terrainGenerator.plotMarkersGroup.visible = true;
      this.armyGroup.visible = this.armyState !== 'IDLE';

      this.cameraController.setPickables(this.pickableObjects);
      this.cameraController.resetToHome();
    }
  }

  /**
   * Toggle 3D World Map Filter to display ONLY:
   * - The Congress (center [800, 800])
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

  public getInsideKingdomState(): InsideKingdomState {
    return this.insideKingdom3D.getState();
  }

  public selectInsidePlot(plotId: string) {
    return this.insideKingdom3D.handlePlotClick(plotId);
  }

  public mergeSelectedInsideBuilding(): boolean {
    return this.insideKingdom3D.mergeSelectedWithMatchingTwin();
  }

  public autoMergeInsideKingdom(): number {
    return this.insideKingdom3D.autoMergeAll();
  }

  public constructInsideBuilding(
    category: MergeBuildingCategory,
    preferredPlotId?: string
  ): KingdomMergePlot | null {
    return this.insideKingdom3D.constructBuilding(category, preferredPlotId);
  }

  public upgradeInsideImperialKeep(): boolean {
    return this.insideKingdom3D.upgradeImperialKeep();
  }

  public zoomOutTo100() {
    this.cameraController.zoomOutTo100();
  }

  public setTerrainLodMode(mode: TerrainLodMode) {
    this.terrainGenerator.setLodMode(mode);
  }

  public setShowHexGrid(show: boolean) {
    this.terrainGenerator.setShowHexGrid(show);
  }

  public setHighlightedBiome(biome: TerrainBiomeType | null) {
    this.terrainGenerator.setHighlightedBiome(biome);
  }

  public getHexTileAt(x: number, z: number): HexTileData | null {
    const tile = this.terrainGenerator.getHexTileAt(x, z);
    if (this.terrainGenerator.showHexGrid) {
      this.terrainGenerator.focusHexTile(tile);
    }
    return tile;
  }

  public getTerrainStats() {
    return {
      biomeCounts: this.terrainGenerator.biomeCounts,
      totalTrianglesByLod: this.terrainGenerator.totalTrianglesByLod,
      totalHexes: this.terrainGenerator.hexTilesMap.size,
      lodMode: this.terrainGenerator.currentLodMode,
      showHexGrid: this.terrainGenerator.showHexGrid,
      highlightedBiome: this.terrainGenerator.highlightedBiome,
    };
  }

  public dispose() {
    cancelAnimationFrame(this.animFrameId);
    clearTimeout(this.animFrameId);
    window.removeEventListener('resize', this.onResize);
    this.cameraController.dispose();
    this.renderer.dispose();
    if (this.container && this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
