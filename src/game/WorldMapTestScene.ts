import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  GridObject,
  OwnershipState,
  TEST_GRID_HEIGHT,
  TEST_GRID_WIDTH,
  TILE_SIZE,
  WorldGridManager,
  gridToWorldCenter,
} from './WorldGridSystem';

export type ZoomLodTier = 'Far' | 'Medium' | 'Close';

export interface SceneTelemetry {
  zoom: number;
  lodTier: ZoomLodTier;
  cameraTargetX: number;
  cameraTargetZ: number;
}

export interface WorldMapTestSceneCallbacks {
  onSelectObject?: (obj: GridObject | null) => void;
  onTelemetryChange?: (telemetry: SceneTelemetry) => void;
  onTroopArrived?: (targetObjectId: string | null) => void;
}

interface RenderedObjectEntry {
  data: GridObject;
  rootGroup: THREE.Group;
  modelGroup: THREE.Group;
  farIconSprite: THREE.Sprite;
  detailGroup: THREE.Group | null;
  collisionBoxMesh: THREE.LineSegments;
  barrierGroup: THREE.Group | null;
  barrierMaterial: THREE.MeshBasicMaterial | null;
  barrierRingMaterial: THREE.MeshBasicMaterial | null;
  labelSprite: THREE.Sprite;
}

const OWNERSHIP_COLOR_HEX: Record<OwnershipState, number> = {
  Neutral: 0x94a3b8,
  Protected: 0x38bdf8,
  Occupied: 0xf59e0b,
  'Under attack': 0xef4444,
  Captured: 0x10b981,
};

const LAYER_BOX_COLOR_HEX: Record<string, number> = {
  buildings: 0xfacc15,
  monsters: 0xf43f5e,
  resources: 0x22c55e,
  troops: 0x38bdf8,
};

function detectSoftwareGl(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return false;
    const renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
    return /swiftshader|llvmpipe|softpipe|software/i.test(renderer);
  } catch {
    return false;
  }
}

function makeBadgeTexture(
  title: string,
  subtitle: string,
  bgHex: string,
  borderHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 96);

  ctx.fillStyle = bgHex;
  ctx.strokeStyle = borderHex;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(8, 12, 240, 72, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 128, 38);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(subtitle, 128, 66);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeFarIconTexture(symbol: string, fillHex: string, strokeHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);

  ctx.save();
  ctx.translate(64, 64);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = fillHex;
  ctx.strokeStyle = strokeHex;
  ctx.lineWidth = 8;
  ctx.fillRect(-38, -38, 76, 76);
  ctx.strokeRect(-38, -38, 76, 76);
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, 64, 66);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export class WorldMapTestScene {
  private container: HTMLElement;
  private gridManager: WorldGridManager;
  private callbacks: WorldMapTestSceneCallbacks;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private pmremGenerator: THREE.PMREMGenerator;
  private envRenderTarget: THREE.WebGLRenderTarget;
  private isSoftwareGl = false;

  private gridOverlayGroup = new THREE.Group();
  private terrainGroup = new THREE.Group();
  private decorationGroup = new THREE.Group();
  private objectsGroup = new THREE.Group();
  private troopGroup = new THREE.Group();

  private objectEntries: Map<string, RenderedObjectEntry> = new Map();
  private disposableTextures: THREE.Texture[] = [];
  private sharedGeometries: THREE.BufferGeometry[] = [];
  private sharedMaterials: THREE.Material[] = [];

  private selectionRing: THREE.Mesh;
  private troopActorGroup: THREE.Group;
  private troopPathLine: THREE.Line | null = null;
  private troopCollisionBox: THREE.LineSegments;

  // Camera & navigation state
  private targetPos = new THREE.Vector3(0, 0, 0);
  private desiredTargetPos = new THREE.Vector3(0, 0, 0);
  private zoom = 1.0;
  private desiredZoom = 1.0;
  private readonly minZoom = 0.35;
  private readonly maxZoom = 2.8;
  private lastReportedZoom = -1;
  private lastReportedLod: ZoomLodTier | '' = '';

  // Visibility toggles
  private showGrid = true;
  private showCollisionBoxes = true;
  private showProtectionBarriers = true;
  private selectedObjectId: string | null = null;

  // Interaction state
  private keysDown = new Set<string>();
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragMoved = false;
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private tempBox = new THREE.Box3();
  private tempSize = new THREE.Vector3();

  private rafId = 0;
  private lastFrameTime = performance.now();
  private elapsedSec = 0;
  private lastDrawMs = 0;
  private disposed = false;

  constructor(
    container: HTMLElement,
    gridManager: WorldGridManager,
    callbacks: WorldMapTestSceneCallbacks = {}
  ) {
    this.container = container;
    this.gridManager = gridManager;
    this.callbacks = callbacks;

    const width = Math.max(320, container.clientWidth || window.innerWidth);
    const height = Math.max(240, container.clientHeight || window.innerHeight);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1524);
    this.scene.fog = new THREE.FogExp2(0x0b1524, 0.00055);

    this.camera = new THREE.PerspectiveCamera(40, width / height, 2, 4000);
    this.updateCameraTransform();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    const gl = this.renderer.getContext();
    this.isSoftwareGl = detectSoftwareGl(gl);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? Math.min(window.devicePixelRatio || 1, 1.25) : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // Environment & lighting
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRenderTarget = this.pmremGenerator.fromScene(roomEnv, 0.04);
    roomEnv.dispose();
    this.scene.environment = this.envRenderTarget.texture;
    this.scene.environmentIntensity = 0.65;

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x334155, 0.95);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff1d6, 1.65);
    sunLight.position.set(320, 460, 260);
    if (!this.isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.near = 50;
      sunLight.shadow.camera.far = 1400;
      const d = 520;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
    }
    this.scene.add(sunLight);

    // Build terrain, grid overlay, instanced decorations
    this.buildTerrain();
    this.buildGridOverlay();
    this.buildTerrainDecorations();

    // Selection ring
    const selGeo = new THREE.RingGeometry(0.85, 1.0, 32);
    selGeo.rotateX(-Math.PI / 2);
    const selMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    this.sharedGeometries.push(selGeo);
    this.sharedMaterials.push(selMat);
    this.selectionRing = new THREE.Mesh(selGeo, selMat);
    this.selectionRing.visible = false;
    this.selectionRing.position.y = 0.35;
    this.scene.add(this.selectionRing);

    // Troop unit placeholder actor
    this.troopActorGroup = this.createTroopColumnModel();
    this.troopActorGroup.visible = false;
    this.troopGroup.add(this.troopActorGroup);

    const troopBoxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(TILE_SIZE * 0.8, 7, TILE_SIZE * 0.8));
    const troopBoxMat = new THREE.LineBasicMaterial({ color: LAYER_BOX_COLOR_HEX.troops });
    this.sharedGeometries.push(troopBoxGeo);
    this.sharedMaterials.push(troopBoxMat);
    this.troopCollisionBox = new THREE.LineSegments(troopBoxGeo, troopBoxMat);
    this.troopCollisionBox.position.y = 3.5;
    this.troopActorGroup.add(this.troopCollisionBox);

    this.scene.add(this.terrainGroup);
    this.scene.add(this.gridOverlayGroup);
    this.scene.add(this.decorationGroup);
    this.scene.add(this.objectsGroup);
    this.scene.add(this.troopGroup);

    this.syncFromGridManager();
    this.bindEvents();
    this.animate();
  }

  public getZoom(): number {
    return this.zoom;
  }

  public getLodTier(z = this.zoom): ZoomLodTier {
    if (z < 0.72) return 'Far';
    if (z <= 1.55) return 'Medium';
    return 'Close';
  }

  public setZoom(nextZoom: number, instant = false): void {
    const clamped = Math.max(this.minZoom, Math.min(this.maxZoom, nextZoom));
    this.desiredZoom = clamped;
    if (instant) {
      this.zoom = clamped;
      this.updateCameraTransform();
      this.applyLodVisibility();
    }
  }

  public focusOnGridObject(obj: GridObject): void {
    const c = gridToWorldCenter(
      obj.gridX,
      obj.gridY,
      obj.widthTiles,
      obj.heightTiles,
      this.gridManager.gridWidth,
      this.gridManager.gridHeight
    );
    this.desiredTargetPos.set(c.x, 0, c.z);
  }

  public setShowGrid(visible: boolean): void {
    this.showGrid = visible;
    this.gridOverlayGroup.visible = visible;
  }

  public setShowCollisionBoxes(visible: boolean): void {
    this.showCollisionBoxes = visible;
    this.objectEntries.forEach((entry) => {
      entry.collisionBoxMesh.visible = visible;
    });
    this.troopCollisionBox.visible = visible;
  }

  public setShowProtectionBarriers(visible: boolean): void {
    this.showProtectionBarriers = visible;
    this.objectEntries.forEach((entry) => {
      if (entry.barrierGroup) {
        entry.barrierGroup.visible = visible;
      }
    });
  }

  public setSelectedObjectId(id: string | null): void {
    this.selectedObjectId = id;
    if (!id) {
      this.selectionRing.visible = false;
      return;
    }
    const entry = this.objectEntries.get(id);
    if (!entry) {
      this.selectionRing.visible = false;
      return;
    }
    const radius = (Math.max(entry.data.widthTiles, entry.data.heightTiles) * TILE_SIZE) * 0.68;
    this.selectionRing.position.set(entry.rootGroup.position.x, 0.4, entry.rootGroup.position.z);
    this.selectionRing.scale.set(radius, 1, radius);
    this.selectionRing.visible = true;
  }

  public refreshObjectAppearance(obj: GridObject): void {
    const entry = this.objectEntries.get(obj.id);
    if (!entry) return;
    entry.data = obj;
    const color = OWNERSHIP_COLOR_HEX[obj.ownership];
    if (entry.barrierMaterial) {
      entry.barrierMaterial.color.setHex(color);
    }
    if (entry.barrierRingMaterial) {
      entry.barrierRingMaterial.color.setHex(color);
    }
    // Rebuild label texture
    const oldTex = (entry.labelSprite.material as THREE.SpriteMaterial).map;
    const subText =
      obj.category === 'monster'
        ? `Lv.${obj.level} · ${obj.hp}/${obj.maxHp}`
        : obj.category === 'resource'
          ? `${Math.round((obj.remainingResource ?? 0) / 1000)}K · ${obj.gatherProgressPct ?? 0}%`
          : `${obj.ownership} · ${obj.widthTiles}×${obj.heightTiles}`;
    const nextTex = makeBadgeTexture(obj.name.slice(0, 18), subText, 'rgba(10,16,28,0.88)', '#eab308');
    this.disposableTextures.push(nextTex);
    (entry.labelSprite.material as THREE.SpriteMaterial).map = nextTex;
    (entry.labelSprite.material as THREE.SpriteMaterial).needsUpdate = true;
    if (oldTex) oldTex.dispose();
  }

  public syncFromGridManager(): void {
    // Clear existing rendered objects cleanly
    this.objectEntries.forEach((entry) => {
      this.objectsGroup.remove(entry.rootGroup);
    });
    this.objectEntries.clear();

    for (const obj of this.gridManager.objects) {
      const entry = this.buildObjectEntry(obj);
      this.objectEntries.set(obj.id, entry);
      this.objectsGroup.add(entry.rootGroup);
    }

    this.syncTroopVisuals();
    this.setSelectedObjectId(this.selectedObjectId);
    this.applyLodVisibility();
  }

  public syncTroopVisuals(): void {
    if (this.troopPathLine) {
      this.troopGroup.remove(this.troopPathLine);
      this.troopPathLine.geometry.dispose();
      (this.troopPathLine.material as THREE.Material).dispose();
      this.troopPathLine = null;
    }

    const troop = this.gridManager.activeTroop;
    if (!troop || troop.pathTiles.length === 0) {
      this.troopActorGroup.visible = false;
      return;
    }

    const pts = troop.pathTiles.map(([tx, ty]) => {
      const c = gridToWorldCenter(tx, ty, 1, 1, this.gridManager.gridWidth, this.gridManager.gridHeight);
      return new THREE.Vector3(c.x, 0.7, c.z);
    });
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.92 });
    this.troopPathLine = new THREE.Line(lineGeo, lineMat);
    this.troopGroup.add(this.troopPathLine);

    const startWorld = pts[0];
    this.troopActorGroup.position.set(startWorld.x, 0, startWorld.z);
    this.troopActorGroup.visible = true;
    this.troopCollisionBox.visible = this.showCollisionBoxes;
  }

  /**
   * Measures real world-space Box3 dimensions of rendered models so TEST 10
   * can verify object dimensions never distort across zoom levels.
   */
  public measureSampleDimensions(): { width: number; depth: number; detail: string } {
    const sample =
      this.gridManager.objects.find((o) => o.typeId === 'alliance_citadel') ??
      this.gridManager.objects[0];
    if (!sample) return { width: 0, depth: 0, detail: 'No objects' };
    const entry = this.objectEntries.get(sample.id);
    if (!entry) return { width: 0, depth: 0, detail: 'Missing entry' };
    entry.modelGroup.updateWorldMatrix(true, true);
    this.tempBox.setFromObject(entry.modelGroup);
    this.tempBox.getSize(this.tempSize);
    return {
      width: Number(this.tempSize.x.toFixed(2)),
      depth: Number(this.tempSize.z.toFixed(2)),
      detail: `${sample.name}: ${this.tempSize.x.toFixed(1)}×${this.tempSize.z.toFixed(1)}u`,
    };
  }

  private buildTerrain(): void {
    const worldW = this.gridManager.gridWidth * TILE_SIZE;
    const worldH = this.gridManager.gridHeight * TILE_SIZE;

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(worldW, worldH, 48, 48);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x3f6b3d,
      roughness: 0.92,
      metalness: 0.04,
    });
    this.sharedGeometries.push(groundGeo);
    this.sharedMaterials.push(groundMat);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    this.terrainGroup.add(ground);

    // Tile-based terrain patches for river, mountain, hills, forest clearings
    const riverTiles: Array<[number, number]> = [];
    const mountainTiles: Array<[number, number]> = [];
    const hillTiles: Array<[number, number]> = [];
    const forestTiles: Array<[number, number]> = [];

    for (let y = 0; y < this.gridManager.gridHeight; y++) {
      for (let x = 0; x < this.gridManager.gridWidth; x++) {
        const t = this.gridManager.terrain[y][x];
        if (t === 'river') riverTiles.push([x, y]);
        else if (t === 'mountain') mountainTiles.push([x, y]);
        else if (t === 'hill') hillTiles.push([x, y]);
        else if (t === 'forest') forestTiles.push([x, y]);
      }
    }

    const addInstancedTiles = (
      coords: Array<[number, number]>,
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      yOffset: number,
      randomHeight = false
    ) => {
      if (coords.length === 0) return;
      const inst = new THREE.InstancedMesh(geo, mat, coords.length);
      inst.receiveShadow = true;
      inst.castShadow = randomHeight;
      const dummy = new THREE.Object3D();
      coords.forEach(([gx, gy], idx) => {
        const w = gridToWorldCenter(gx, gy, 1, 1, this.gridManager.gridWidth, this.gridManager.gridHeight);
        const hScale = randomHeight ? 0.75 + (((gx * 13 + gy * 7) % 10) / 14) : 1;
        dummy.position.set(w.x, yOffset * hScale, w.z);
        dummy.scale.set(1, hScale, 1);
        dummy.updateMatrix();
        inst.setMatrixAt(idx, dummy.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
      this.terrainGroup.add(inst);
    };

    const flatGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.98, TILE_SIZE * 0.98);
    flatGeo.rotateX(-Math.PI / 2);
    this.sharedGeometries.push(flatGeo);

    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.16,
      metalness: 0.2,
      emissive: 0x0369a1,
      emissiveIntensity: 0.25,
    });
    const forestMat = new THREE.MeshStandardMaterial({
      color: 0x2d5432,
      roughness: 0.95,
    });
    const hillMat = new THREE.MeshStandardMaterial({
      color: 0x6b724d,
      roughness: 0.9,
    });
    const peakGeo = new THREE.ConeGeometry(TILE_SIZE * 0.65, 16, 6);
    const peakMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.85,
      flatShading: true,
    });
    this.sharedGeometries.push(peakGeo);
    this.sharedMaterials.push(riverMat, forestMat, hillMat, peakMat);

    addInstancedTiles(riverTiles, flatGeo, riverMat, 0.08);
    addInstancedTiles(forestTiles, flatGeo, forestMat, 0.05);
    addInstancedTiles(hillTiles, flatGeo, hillMat, 0.07);
    addInstancedTiles(mountainTiles, peakGeo, peakMat, 7.2, true);
  }

  private buildGridOverlay(): void {
    const worldW = this.gridManager.gridWidth * TILE_SIZE;
    const worldH = this.gridManager.gridHeight * TILE_SIZE;
    const halfW = worldW / 2;
    const halfH = worldH / 2;

    const minorPoints: number[] = [];
    const majorPoints: number[] = [];

    for (let x = 0; x <= this.gridManager.gridWidth; x++) {
      const wx = x * TILE_SIZE - halfW;
      const target = x % 10 === 0 ? majorPoints : minorPoints;
      target.push(wx, 0.14, -halfH, wx, 0.14, halfH);
    }
    for (let y = 0; y <= this.gridManager.gridHeight; y++) {
      const wz = y * TILE_SIZE - halfH;
      const target = y % 10 === 0 ? majorPoints : minorPoints;
      target.push(-halfW, 0.14, wz, halfW, 0.14, wz);
    }

    const minorGeo = new THREE.BufferGeometry();
    minorGeo.setAttribute('position', new THREE.Float32BufferAttribute(minorPoints, 3));
    const minorMat = new THREE.LineBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.17,
    });
    const majorGeo = new THREE.BufferGeometry();
    majorGeo.setAttribute('position', new THREE.Float32BufferAttribute(majorPoints, 3));
    const majorMat = new THREE.LineBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.42,
    });
    this.sharedGeometries.push(minorGeo, majorGeo);
    this.sharedMaterials.push(minorMat, majorMat);

    this.gridOverlayGroup.add(new THREE.LineSegments(minorGeo, minorMat));
    this.gridOverlayGroup.add(new THREE.LineSegments(majorGeo, majorMat));
    this.gridOverlayGroup.visible = this.showGrid;
  }

  private buildTerrainDecorations(): void {
    const trees = this.gridManager.decorations.filter((d) => d.kind === 'tree');
    const rocks = this.gridManager.decorations.filter((d) => d.kind === 'rock');

    if (trees.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.45, 0.7, 3.2, 6);
      trunkGeo.translate(0, 1.6, 0);
      const canopyGeo = new THREE.ConeGeometry(2.3, 6.2, 7);
      canopyGeo.translate(0, 5.2, 0);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
      const canopyMat = new THREE.MeshStandardMaterial({
        color: 0x1e4d2b,
        roughness: 0.85,
        flatShading: true,
      });
      this.sharedGeometries.push(trunkGeo, canopyGeo);
      this.sharedMaterials.push(trunkMat, canopyMat);

      const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
      const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, trees.length);
      canopyInst.castShadow = true;

      const dummy = new THREE.Object3D();
      trees.forEach((t, i) => {
        dummy.position.set(t.worldX, 0, t.worldZ);
        dummy.rotation.set(0, t.rotationY, 0);
        dummy.scale.setScalar(t.scale);
        dummy.updateMatrix();
        trunkInst.setMatrixAt(i, dummy.matrix);
        canopyInst.setMatrixAt(i, dummy.matrix);
      });
      trunkInst.instanceMatrix.needsUpdate = true;
      canopyInst.instanceMatrix.needsUpdate = true;
      this.decorationGroup.add(trunkInst, canopyInst);
    }

    if (rocks.length > 0) {
      const rockGeo = new THREE.DodecahedronGeometry(1.7, 0);
      rockGeo.translate(0, 0.9, 0);
      const rockMat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.9,
        flatShading: true,
      });
      this.sharedGeometries.push(rockGeo);
      this.sharedMaterials.push(rockMat);

      const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
      const dummy = new THREE.Object3D();
      rocks.forEach((r, i) => {
        dummy.position.set(r.worldX, 0, r.worldZ);
        dummy.rotation.set(0, r.rotationY, 0);
        dummy.scale.set(r.scale * 1.2, r.scale * 0.75, r.scale);
        dummy.updateMatrix();
        rockInst.setMatrixAt(i, dummy.matrix);
      });
      rockInst.instanceMatrix.needsUpdate = true;
      this.decorationGroup.add(rockInst);
    }
  }

  private buildObjectEntry(obj: GridObject): RenderedObjectEntry {
    const rootGroup = new THREE.Group();
    const worldCenter = gridToWorldCenter(
      obj.gridX,
      obj.gridY,
      obj.widthTiles,
      obj.heightTiles,
      this.gridManager.gridWidth,
      this.gridManager.gridHeight
    );
    rootGroup.position.set(worldCenter.x, 0, worldCenter.z);
    rootGroup.userData.objectId = obj.id;

    // 1. Build 3D model matching exact dimensions/visualScale
    const { modelGroup, detailGroup } = this.createPlaceholder3DModel(obj);
    modelGroup.traverse((child) => {
      child.userData.objectId = obj.id;
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = !this.isSoftwareGl;
        child.receiveShadow = true;
      }
    });
    rootGroup.add(modelGroup);

    // 2. Collision footprint wireframe box (exact widthTiles*10 x heightTiles*10)
    const fpW = obj.widthTiles * TILE_SIZE;
    const fpD = obj.heightTiles * TILE_SIZE;
    const boxH =
      obj.category === 'citadel' ? 42 : obj.category === 'shrine' ? 28 : obj.category === 'castle' ? 22 : 12;
    const boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(fpW, boxH, fpD));
    const boxMat = new THREE.LineBasicMaterial({
      color: LAYER_BOX_COLOR_HEX[obj.collisionLayer] ?? 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
    this.sharedGeometries.push(boxGeo);
    this.sharedMaterials.push(boxMat);
    const collisionBoxMesh = new THREE.LineSegments(boxGeo, boxMat);
    collisionBoxMesh.position.y = boxH / 2 + 0.1;
    collisionBoxMesh.visible = this.showCollisionBoxes;
    rootGroup.add(collisionBoxMesh);

    // 3. Protection Barrier dome + ground ring (Shrines, Citadel, Castles when barrierRadius > 0)
    let barrierGroup: THREE.Group | null = null;
    let barrierMaterial: THREE.MeshBasicMaterial | null = null;
    let barrierRingMaterial: THREE.MeshBasicMaterial | null = null;

    if (obj.barrierRadius > 0) {
      barrierGroup = new THREE.Group();
      const bColor = OWNERSHIP_COLOR_HEX[obj.ownership];

      const domeGeo = new THREE.SphereGeometry(
        obj.barrierRadius,
        28,
        16,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.5
      );
      barrierMaterial = new THREE.MeshBasicMaterial({
        color: bColor,
        transparent: true,
        opacity: obj.category === 'castle' ? 0.12 : 0.2,
        wireframe: false,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const dome = new THREE.Mesh(domeGeo, barrierMaterial);

      const ringGeo = new THREE.RingGeometry(obj.barrierRadius - 1.2, obj.barrierRadius, 48);
      ringGeo.rotateX(-Math.PI / 2);
      barrierRingMaterial = new THREE.MeshBasicMaterial({
        color: bColor,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, barrierRingMaterial);
      ring.position.y = 0.25;

      this.sharedGeometries.push(domeGeo, ringGeo);
      this.sharedMaterials.push(barrierMaterial, barrierRingMaterial);

      barrierGroup.add(dome, ring);
      barrierGroup.visible = this.showProtectionBarriers;
      rootGroup.add(barrierGroup);
    }

    // 4. Overhead Level / Status Sprite Label
    const subText =
      obj.category === 'monster'
        ? `Lv.${obj.level} · ${obj.hp}/${obj.maxHp}`
        : obj.category === 'resource'
          ? `${Math.round((obj.remainingResource ?? 0) / 1000)}K`
          : `${obj.ownership} · ${obj.widthTiles}×${obj.heightTiles}`;
    const labelTex = makeBadgeTexture(obj.name.slice(0, 18), subText, 'rgba(10,16,28,0.88)', '#eab308');
    this.disposableTextures.push(labelTex);
    const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false });
    this.sharedMaterials.push(labelMat);
    const labelSprite = new THREE.Sprite(labelMat);
    labelSprite.position.set(0, boxH + 7, 0);
    labelSprite.scale.set(18, 6.8, 1);
    labelSprite.userData.objectId = obj.id;
    rootGroup.add(labelSprite);

    // 5. Far Zoom LOD tactical icon sprite
    const iconCfg =
      obj.category === 'citadel'
        ? { sym: '🏛', fill: '#7c2d12', stroke: '#facc15', scale: 34 }
        : obj.category === 'shrine'
          ? { sym: obj.typeId[0].toUpperCase(), fill: '#1e3a8a', stroke: '#38bdf8', scale: 26 }
          : obj.category === 'castle'
            ? {
                sym: obj.typeId === 'player_castle' ? '★' : '♜',
                fill: obj.typeId === 'player_castle' ? '#065f46' : '#7f1d1d',
                stroke: '#fef08a',
                scale: 22,
              }
            : obj.category === 'monster'
              ? { sym: '☠', fill: '#881337', stroke: '#fda4af', scale: 16 }
              : { sym: '♦', fill: '#14532d', stroke: '#86efac', scale: 15 };
    const farTex = makeFarIconTexture(iconCfg.sym, iconCfg.fill, iconCfg.stroke);
    this.disposableTextures.push(farTex);
    const farMat = new THREE.SpriteMaterial({ map: farTex, transparent: true, depthTest: false });
    this.sharedMaterials.push(farMat);
    const farIconSprite = new THREE.Sprite(farMat);
    farIconSprite.position.set(0, 14, 0);
    farIconSprite.scale.set(iconCfg.scale, iconCfg.scale, 1);
    farIconSprite.visible = false;
    farIconSprite.userData.objectId = obj.id;
    rootGroup.add(farIconSprite);

    return {
      data: obj,
      rootGroup,
      modelGroup,
      farIconSprite,
      detailGroup,
      collisionBoxMesh,
      barrierGroup,
      barrierMaterial,
      barrierRingMaterial,
      labelSprite,
    };
  }

  private createPlaceholder3DModel(obj: GridObject): {
    modelGroup: THREE.Group;
    detailGroup: THREE.Group | null;
  } {
    const group = new THREE.Group();
    let detailGroup: THREE.Group | null = null;

    if (obj.category === 'castle' || obj.category === 'shrine' || obj.category === 'citadel') {
      const [dimW, dimD] = obj.visualDimensions; // e.g., 20x20, 30x30, 40x40, 50x50, 80x80
      const baseColor =
        obj.typeId === 'alliance_citadel'
          ? 0x475569
          : obj.category === 'shrine'
            ? 0x334155
            : obj.typeId === 'player_castle'
              ? 0x64748b
              : 0x57534e;
      const accentColor =
        obj.typeId === 'alliance_citadel'
          ? 0xf59e0b
          : obj.typeId === 'a_shrine'
            ? 0xa855f7
            : obj.typeId === 'b_shrine'
              ? 0x38bdf8
              : obj.typeId === 'c_shrine'
                ? 0x22c55e
                : obj.typeId === 'player_castle'
                  ? 0x3b82f6
                  : 0xef4444;

      const stoneMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.72, metalness: 0.15 });
      const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.35, metalness: 0.55 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.28, metalness: 0.75 });

      // Exact courtyard plinth matching visualDimensions
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(dimW * 0.96, 2.2, dimD * 0.96), stoneMat);
      plinth.position.y = 1.1;
      group.add(plinth);

      if (obj.category === 'castle') {
        const keepH = obj.typeId === 'player_castle' ? 14 : 20;
        const keep = new THREE.Mesh(new THREE.BoxGeometry(dimW * 0.52, keepH, dimD * 0.52), stoneMat);
        keep.position.y = 2.2 + keepH / 2;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(dimW * 0.4, keepH * 0.5, 4), accentMat);
        roof.rotation.y = Math.PI / 4;
        roof.position.y = 2.2 + keepH + keepH * 0.25;
        group.add(keep, roof);

        // 4 corner towers
        const offset = dimW * 0.38;
        const tGeo = new THREE.CylinderGeometry(dimW * 0.1, dimW * 0.12, keepH * 0.78, 8);
        const capGeo = new THREE.ConeGeometry(dimW * 0.13, keepH * 0.3, 8);
        [
          [-offset, -offset],
          [offset, -offset],
          [-offset, offset],
          [offset, offset],
        ].forEach(([tx, tz]) => {
          const tower = new THREE.Mesh(tGeo, stoneMat);
          tower.position.set(tx, 2.2 + (keepH * 0.78) / 2, tz);
          const cap = new THREE.Mesh(capGeo, accentMat);
          cap.position.set(tx, 2.2 + keepH * 0.78 + keepH * 0.15, tz);
          group.add(tower, cap);
        });
      } else if (obj.category === 'shrine') {
        const tiers = obj.typeId === 'a_shrine' ? 3 : 2;
        for (let t = 0; t < tiers; t++) {
          const scale = 0.72 - t * 0.18;
          const step = new THREE.Mesh(
            new THREE.BoxGeometry(dimW * scale, 2.4, dimD * scale),
            t % 2 === 0 ? stoneMat : accentMat
          );
          step.position.y = 2.2 + t * 2.4 + 1.2;
          group.add(step);
        }
        const crystalH = dimW * 0.42;
        const obelisk = new THREE.Mesh(
          new THREE.OctahedronGeometry(dimW * 0.18, 0),
          new THREE.MeshStandardMaterial({
            color: accentColor,
            emissive: accentColor,
            emissiveIntensity: 0.45,
            roughness: 0.2,
            metalness: 0.6,
          })
        );
        obelisk.scale.set(1, 1.55, 1);
        obelisk.position.y = 6 + crystalH * 0.6;
        group.add(obelisk);
      } else {
        // Alliance Citadel (80 x 80) — Grand Congress Hall
        const tier1 = new THREE.Mesh(new THREE.BoxGeometry(dimW * 0.76, 8, dimD * 0.76), stoneMat);
        tier1.position.y = 6.2;
        const rotunda = new THREE.Mesh(new THREE.CylinderGeometry(dimW * 0.26, dimW * 0.3, 18, 12), stoneMat);
        rotunda.position.y = 19;
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(dimW * 0.24, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
          goldMat
        );
        dome.position.y = 28;
        const spire = new THREE.Mesh(new THREE.ConeGeometry(3.2, 12, 8), goldMat);
        spire.position.y = 28 + dimW * 0.24 + 5;
        group.add(tier1, rotunda, dome, spire);

        const cornerOff = dimW * 0.4;
        const cTowerGeo = new THREE.CylinderGeometry(4.2, 5.2, 24, 8);
        const cCapGeo = new THREE.ConeGeometry(5.8, 8, 8);
        [
          [-cornerOff, -cornerOff],
          [cornerOff, -cornerOff],
          [-cornerOff, cornerOff],
          [cornerOff, cornerOff],
        ].forEach(([cx, cz]) => {
          const t = new THREE.Mesh(cTowerGeo, stoneMat);
          t.position.set(cx, 14, cz);
          const c = new THREE.Mesh(cCapGeo, accentMat);
          c.position.set(cx, 30, cz);
          group.add(t, c);
        });
      }

      // Close-zoom extra banners/props
      detailGroup = new THREE.Group();
      const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 8, 6), goldMat);
      flagPole.position.set(dimW * 0.35, 6, dimD * 0.35);
      const banner = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.0, 0.25), accentMat);
      banner.position.set(dimW * 0.35 + 1.8, 8.8, dimD * 0.35);
      detailGroup.add(flagPole, banner);
      group.add(detailGroup);

      return { modelGroup: group, detailGroup };
    }

    if (obj.category === 'monster') {
      // Normalized within 10x10 units at visualScale=1.0, scaled strictly by obj.visualScale
      const unitGroup = new THREE.Group();
      const colorByMonster: Record<string, number> = {
        slime: 0x22d3ee,
        orc: 0x65a30d,
        goblin: 0x84cc16,
        wolf: 0x94a3b8,
        skeleton_knight: 0xe2e8f0,
        ogre: 0xd97706,
        death_knight: 0x7c3aed,
        skeleton_dragon: 0xf43f5e,
      };
      const primaryMat = new THREE.MeshStandardMaterial({
        color: colorByMonster[obj.typeId] ?? 0xef4444,
        roughness: 0.45,
        metalness: 0.25,
      });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
      const glowMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf97316,
        emissiveIntensity: 0.7,
      });

      if (obj.typeId === 'slime') {
        const body = new THREE.Mesh(
          new THREE.SphereGeometry(4.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
          primaryMat
        );
        body.position.y = 0.5;
        unitGroup.add(body);
      } else if (obj.typeId === 'wolf') {
        const torso = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.0, 7.0), primaryMat);
        torso.position.y = 3.2;
        const head = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.2, 6), primaryMat);
        head.rotation.x = Math.PI / 2;
        head.position.set(0, 4.4, 4.2);
        unitGroup.add(torso, head);
      } else if (obj.typeId === 'skeleton_dragon') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 3.2, 6.8), primaryMat);
        body.position.y = 4.6;
        const wingL = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 3.8), darkMat);
        wingL.position.set(-3.4, 6.2, 0);
        wingL.rotation.z = 0.35;
        const wingR = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 3.8), darkMat);
        wingR.position.set(3.4, 6.2, 0);
        wingR.rotation.z = -0.35;
        const head = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 3.2), glowMat);
        head.position.set(0, 6.8, 4.0);
        unitGroup.add(body, wingL, wingR, head);
      } else {
        // Humanoid raider / knight / ogre / death knight
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 5.2, 8), primaryMat);
        torso.position.y = 3.2;
        const head = new THREE.Mesh(new THREE.SphereGeometry(1.7, 12, 10), primaryMat);
        head.position.y = 7.0;
        const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.2, 0.7), glowMat);
        weapon.position.set(2.9, 5.0, 1.2);
        weapon.rotation.x = 0.4;
        const shield = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.5, 8), darkMat);
        shield.rotation.z = Math.PI / 2;
        shield.position.set(-2.7, 4.0, 0.8);
        unitGroup.add(torso, head, weapon, shield);
      }

      unitGroup.scale.setScalar(obj.visualScale);
      group.add(unitGroup);
      return { modelGroup: group, detailGroup: null };
    }

    // Resource nodes (normalized inside 10x10 at visualScale=1.0)
    const resGroup = new THREE.Group();
    if (obj.typeId === 'small_wood') {
      const logMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.9 });
      const logGeo = new THREE.CylinderGeometry(1.1, 1.1, 6.5, 8);
      logGeo.rotateZ(Math.PI / 2);
      [-1.3, 1.3].forEach((zOff) => {
        const log = new THREE.Mesh(logGeo, logMat);
        log.position.set(0, 1.2, zOff);
        resGroup.add(log);
      });
      const topLog = new THREE.Mesh(logGeo, logMat);
      topLog.position.set(0, 2.9, 0);
      resGroup.add(topLog);
    } else if (obj.typeId === 'small_food') {
      const wheatMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.85 });
      for (let i = -1; i <= 1; i++) {
        const sheaf = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.8, 7), wheatMat);
        sheaf.position.set(i * 2.2, 2.4, (i % 2) * 1.4);
        resGroup.add(sheaf);
      }
    } else if (obj.typeId === 'small_crystal') {
      const crysMat = new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.55,
        roughness: 0.15,
        metalness: 0.4,
      });
      [
        [0, 3.6, 0, 1.3],
        [-2.0, 2.3, 1.2, 0.9],
        [2.0, 2.6, -1.0, 1.0],
      ].forEach(([cx, cy, cz, s]) => {
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(2.1 * s, 0), crysMat);
        shard.scale.set(0.75, 1.6, 0.75);
        shard.position.set(cx, cy, cz);
        resGroup.add(shard);
      });
    } else {
      // Stone, Gold, Medium, Large Quarry / Vein
      const veinColor =
        obj.typeId === 'small_gold'
          ? 0xfacc15
          : obj.typeId === 'large_resource'
            ? 0xf59e0b
            : obj.typeId === 'medium_resource'
              ? 0x38bdf8
              : 0x94a3b8;
      const baseRock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(3.6, 0),
        new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88, flatShading: true })
      );
      baseRock.scale.set(1.2, 0.75, 1.1);
      baseRock.position.y = 2.0;
      const ore = new THREE.Mesh(
        new THREE.OctahedronGeometry(2.2, 0),
        new THREE.MeshStandardMaterial({
          color: veinColor,
          emissive: veinColor,
          emissiveIntensity: 0.22,
          roughness: 0.3,
          metalness: 0.65,
        })
      );
      ore.position.set(0.8, 3.6, 0.4);
      resGroup.add(baseRock, ore);
    }

    resGroup.scale.setScalar(obj.visualScale);
    group.add(resGroup);
    return { modelGroup: group, detailGroup: null };
  }

  private createTroopColumnModel(): THREE.Group {
    const troop = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35, metalness: 0.6 });
    const capeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.7 });
    const spearMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, metalness: 0.8, roughness: 0.25 });

    const offsets = [
      [-1.8, -1.6],
      [1.8, -1.6],
      [-1.8, 1.6],
      [1.8, 1.6],
      [0, 0],
    ];
    offsets.forEach(([ox, oz], idx) => {
      const soldier = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.8, 2.4, 7), armorMat);
      body.position.y = 1.2;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), capeMat);
      head.position.y = 2.8;
      const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 5), spearMat);
      spear.position.set(0.75, 2.3, 0);
      soldier.add(body, head, spear);
      if (idx === 4) {
        soldier.scale.setScalar(1.25);
      }
      soldier.position.set(ox, 0, oz);
      troop.add(soldier);
    });
    return troop;
  }

  private updateCameraTransform(): void {
    // Distance shrinks smoothly as zoom increases
    const dist = 360 / this.zoom;
    this.camera.position.set(
      this.targetPos.x + dist * 0.62,
      dist * 0.78,
      this.targetPos.z + dist * 0.62
    );
    this.camera.lookAt(this.targetPos.x, 0, this.targetPos.z);
  }

  private applyLodVisibility(): void {
    const lod = this.getLodTier(this.zoom);
    // Far LOD hides small terrain decorations & swaps detailed meshes for clear tactical icons
    this.decorationGroup.visible = lod !== 'Far';

    this.objectEntries.forEach((entry) => {
      const isFar = lod === 'Far';
      const isClose = lod === 'Close';
      entry.modelGroup.visible = !isFar;
      entry.farIconSprite.visible = isFar;
      if (entry.detailGroup) {
        entry.detailGroup.visible = isClose;
      }
    });

    if (
      Math.abs(this.zoom - this.lastReportedZoom) > 0.015 ||
      lod !== this.lastReportedLod
    ) {
      this.lastReportedZoom = this.zoom;
      this.lastReportedLod = lod;
      this.callbacks.onTelemetryChange?.({
        zoom: Number(this.zoom.toFixed(2)),
        lodTier: lod,
        cameraTargetX: Math.round(this.targetPos.x),
        cameraTargetZ: Math.round(this.targetPos.z),
      });
    }
  }

  private bindEvents(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('resize', this.handleResize);
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
  }

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.88 : 1.14;
    this.setZoom(this.desiredZoom * factor);
  };

  private handlePointerDown = (e: PointerEvent): void => {
    this.isDragging = true;
    this.dragMoved = false;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    if (Math.hypot(dx, dy) > 4) this.dragMoved = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;

    // Screen drag mapped to isometric XZ plane
    const panSpeed = 0.7 / this.zoom;
    const isoRightX = 0.7071;
    const isoRightZ = -0.7071;
    const isoForwardX = -0.7071;
    const isoForwardZ = -0.7071;

    this.desiredTargetPos.x -= (dx * isoRightX - dy * isoForwardX) * panSpeed;
    this.desiredTargetPos.z -= (dx * isoRightZ - dy * isoForwardZ) * panSpeed;
    const bound = (this.gridManager.gridWidth * TILE_SIZE) / 2;
    this.desiredTargetPos.x = Math.max(-bound, Math.min(bound, this.desiredTargetPos.x));
    this.desiredTargetPos.z = Math.max(-bound, Math.min(bound, this.desiredTargetPos.z));
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (this.dragMoved) return;

    // Pick object under pointer
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const hits = this.raycaster.intersectObjects(this.objectsGroup.children, true);
    let hitId: string | null = null;
    for (const hit of hits) {
      const oid = hit.object.userData.objectId;
      if (oid) {
        hitId = oid;
        break;
      }
    }
    this.setSelectedObjectId(hitId);
    const selectedObj = hitId ? this.gridManager.objects.find((o) => o.id === hitId) ?? null : null;
    this.callbacks.onSelectObject?.(selectedObj);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      this.keysDown.add(key);
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.key.toLowerCase());
  };

  public handleResize = (): void => {
    if (this.disposed) return;
    const w = Math.max(320, this.container.clientWidth || window.innerWidth);
    const h = Math.max(240, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
  };

  private animate = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);

    const now = performance.now();
    if (this.isSoftwareGl && now - this.lastDrawMs < 33) {
      return;
    }
    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    this.elapsedSec += dt;

    // WASD / Arrow camera pan
    const moveSpeed = (220 / this.zoom) * dt;
    let moveRight = 0;
    let moveUp = 0;
    if (this.keysDown.has('d') || this.keysDown.has('arrowright')) moveRight += 1;
    if (this.keysDown.has('a') || this.keysDown.has('arrowleft')) moveRight -= 1;
    if (this.keysDown.has('w') || this.keysDown.has('arrowup')) moveUp += 1;
    if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) moveUp -= 1;
    if (moveRight !== 0 || moveUp !== 0) {
      this.desiredTargetPos.x += (moveRight * 0.7071 - moveUp * 0.7071) * moveSpeed;
      this.desiredTargetPos.z += (-moveRight * 0.7071 - moveUp * 0.7071) * moveSpeed;
      const bound = (this.gridManager.gridWidth * TILE_SIZE) / 2;
      this.desiredTargetPos.x = Math.max(-bound, Math.min(bound, this.desiredTargetPos.x));
      this.desiredTargetPos.z = Math.max(-bound, Math.min(bound, this.desiredTargetPos.z));
    }

    // Smooth camera zoom & pan interpolation
    const lerpAlpha = 1 - Math.exp(-10 * dt);
    this.zoom += (this.desiredZoom - this.zoom) * lerpAlpha;
    this.targetPos.lerp(this.desiredTargetPos, lerpAlpha);
    this.updateCameraTransform();
    this.applyLodVisibility();

    // Subtle Close-LOD & Barrier pulse animation (never touches model scale!)
    const lod = this.getLodTier(this.zoom);
    this.objectEntries.forEach((entry) => {
      if (entry.data.ownership === 'Under attack' && entry.barrierMaterial) {
        entry.barrierMaterial.opacity = 0.14 + Math.sin(this.elapsedSec * 5) * 0.09;
      }
      if (lod === 'Close' && entry.data.category === 'monster') {
        entry.modelGroup.position.y = Math.abs(Math.sin(this.elapsedSec * 2.8 + entry.data.gridX)) * 0.45;
      } else if (entry.modelGroup.position.y !== 0) {
        entry.modelGroup.position.y = 0;
      }
    });

    // Advance marching troop along A* tiles
    const troop = this.gridManager.activeTroop;
    if (troop && troop.status === 'marching' && troop.pathTiles.length > 1) {
      const speedTilesPerSec = 5.5;
      const totalSegments = troop.pathTiles.length - 1;
      troop.progress = Math.min(1, troop.progress + (speedTilesPerSec * dt) / totalSegments);
      const exactIdx = troop.progress * totalSegments;
      const segIdx = Math.min(totalSegments - 1, Math.floor(exactIdx));
      const frac = exactIdx - segIdx;
      troop.currentTileIndex = segIdx;

      const [ax, ay] = troop.pathTiles[segIdx];
      const [bx, by] = troop.pathTiles[segIdx + 1];
      const aw = gridToWorldCenter(ax, ay, 1, 1, this.gridManager.gridWidth, this.gridManager.gridHeight);
      const bw = gridToWorldCenter(bx, by, 1, 1, this.gridManager.gridWidth, this.gridManager.gridHeight);
      const wx = aw.x + (bw.x - aw.x) * frac;
      const wz = aw.z + (bw.z - aw.z) * frac;
      this.troopActorGroup.position.set(wx, 0, wz);
      this.troopActorGroup.rotation.y = Math.atan2(bw.x - aw.x, bw.z - aw.z);

      if (troop.progress >= 1) {
        troop.status = 'arrived';
        this.callbacks.onTroopArrived?.(troop.targetObjectId);
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.lastDrawMs = now;
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('wheel', this.handleWheel);
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('resize', this.handleResize);
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);

    this.disposableTextures.forEach((t) => t.dispose());
    this.sharedGeometries.forEach((g) => g.dispose());
    this.sharedMaterials.forEach((m) => m.dispose());
    if (this.troopPathLine) {
      this.troopPathLine.geometry.dispose();
      (this.troopPathLine.material as THREE.Material).dispose();
    }
    this.envRenderTarget.dispose();
    this.pmremGenerator.dispose();
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
