import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { InteractiveObject, ArmyState } from '../types/game';
import {
  createStoneBrickTexture,
  createWoodPlankTexture,
  createRoofTileTexture,
  createIceSpikeTexture,
} from './proceduralTextures';

interface GameCanvasProps {
  onSelectObject: (obj: InteractiveObject | null, screenPos: { x: number; y: number } | null) => void;
  armyState: ArmyState;
  activeTarget: InteractiveObject | null;
  onMissionStepComplete: (result: { type: 'gather' | 'attack' | 'arrive'; target: InteractiveObject }) => void;
  cameraPan: { x: number; z: number };
  zoom: number;
  onUpdateCamera: (pan: { x: number; z: number }, zoom: number) => void;
  onAddCombatFloater: (text: string, color: string, x: number, y: number) => void;
  registerObjectsRef: (objs: InteractiveObject[]) => void;
  getCanvasSnapshotRef: (fn: () => string | null) => void;
  selectedObject: InteractiveObject | null;
  registerDamageHandlerRef?: (fn: (monsterId: string, damage: number, forceFatal?: boolean) => { remainingHp: number; isDead: boolean }) => void;
  onUpdateObjectHp?: (objectId: string, newHp: number, isDead: boolean) => void;
  onMissionProgressUpdate?: (progress: number, desc: string, timerText?: string) => void;
  onArmyReturnHome?: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  onSelectObject,
  armyState,
  activeTarget,
  onMissionStepComplete,
  cameraPan,
  zoom,
  onUpdateCamera,
  onAddCombatFloater,
  registerObjectsRef,
  getCanvasSnapshotRef,
  selectedObject,
  registerDamageHandlerRef,
  onUpdateObjectHp,
  onMissionProgressUpdate,
  onArmyReturnHome,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const worldRef = useRef<THREE.Group | null>(null);
  const armyGroupRef = useRef<THREE.Group | null>(null);
  const selectionRingRef = useRef<THREE.Mesh | null>(null);
  const tacticalLineRef = useRef<THREE.Line | null>(null);

  const objectsListRef = useRef<InteractiveObject[]>([]);
  const pickableMeshesRef = useRef<THREE.Object3D[]>([]);

  // Monster damage visual effects & 3D smoke systems
  const monsterGroupsMapRef = useRef<Map<string, THREE.Group>>(new Map());
  const activeFlashesRef = useRef<Array<{ mesh: THREE.Mesh; timer: number; maxTimer: number }>>([]);
  const activeDissolvingRef = useRef<Array<{ group: THREE.Group; progress: number; origY: number }>>([]);
  const activeSmokeParticlesRef = useRef<Array<{
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotSpeedX: number;
    rotSpeedY: number;
    rotSpeedZ: number;
    life: number;
    maxLife: number;
    initialScale: number;
    targetScale: number;
  }>>([]);
  const activeMiningParticlesRef = useRef<Array<{
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotSpeed: number;
    life: number;
    maxLife: number;
  }>>([]);
  const combatStrikeTimerRef = useRef<number>(0);
  const hasStruckUponArrivalRef = useRef<boolean>(false);
  const gatherTimerRef = useRef<number>(0);
  const miningChipTimerRef = useRef<number>(0);
  const totalMarchDistanceRef = useRef<number>(0);
  const groundRef = useRef<THREE.Mesh | null>(null);

  // Live refs to dynamic props so requestAnimationFrame animate() never has stale closures
  const armyStateRef = useRef<ArmyState>(armyState);
  armyStateRef.current = armyState;

  const activeTargetRef = useRef<InteractiveObject | null>(activeTarget);
  activeTargetRef.current = activeTarget;

  const onMissionProgressUpdateRef = useRef(onMissionProgressUpdate);
  onMissionProgressUpdateRef.current = onMissionProgressUpdate;

  const onMissionStepCompleteRef = useRef(onMissionStepComplete);
  onMissionStepCompleteRef.current = onMissionStepComplete;

  const onArmyReturnHomeRef = useRef(onArmyReturnHome);
  onArmyReturnHomeRef.current = onArmyReturnHome;

  // Citadel Gate garrison position: [390, 0.02, 414] inside Gorkha Citadel at [400, 0, 400]
  const armyPosRef = useRef<THREE.Vector3>(new THREE.Vector3(390, 0.02, 414));
  const armyHomeRef = useRef<THREE.Vector3>(new THREE.Vector3(390, 0.02, 414));
  const armyTargetPosRef = useRef<THREE.Vector3 | null>(null);

  // Drag & interaction state
  const isDraggingRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Atmospheric Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#789490');
    scene.fog = new THREE.Fog('#789490', 90, 420);
    sceneRef.current = scene;

    // 2. Camera Setup (Orthographic Isometric)
    const width = container.clientWidth;
    const height = container.clientHeight;
    const aspect = width / height;
    const frustumSize = 65;
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1200
    );
    // Camera is positioned at isometric angle looking down at origin
    camera.position.set(55, 68, 55);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. Renderer with ACES Tone Mapping & PCF Shadows
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Provide snapshot capture function to parent
    getCanvasSnapshotRef(() => {
      if (!renderer || !scene || !camera) return null;
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/jpeg', 0.95);
    });

    // 4. Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x22382c, 2.2);
    scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xffecd2, 3.2);
    sun.position.set(-60, 110, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -110;
    sun.shadow.camera.right = 110;
    sun.shadow.camera.top = 110;
    sun.shadow.camera.bottom = -110;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    sunLightRef.current = sun;

    // World root group
    const world = new THREE.Group();
    scene.add(world);
    worldRef.current = world;

    // GLTF cache and optional loader for 3D props
    const gltfLoader = new GLTFLoader();
    const glbCache = new Map<string, Promise<THREE.Group>>();

    const loadGLBAsset = (file: string): Promise<THREE.Group> => {
      if (!glbCache.has(file)) {
        const p = new Promise<THREE.Group>((resolve, reject) => {
          gltfLoader.load(
            `/assets/models/${file}`,
            (gltf) => resolve(gltf.scene.clone()),
            undefined,
            (err) => reject(err)
          );
        });
        glbCache.set(file, p);
      }
      return glbCache.get(file)!;
    };

    const applyGLB = (parentGroup: THREE.Group, file: string, scale = 1, offsetY = 0) => {
      loadGLBAsset(file)
        .then((model) => {
          model.scale.setScalar(scale);
          model.position.y = offsetY;
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          parentGroup.add(model);
        })
        .catch(() => {
          // Graceful procedural fallback is active
        });
    };

    // Procedural PBR Textures
    const stoneBrickTex = createStoneBrickTexture();
    const woodPlankTex = createWoodPlankTexture();
    const roofTileTex = createRoofTileTexture();
    const iceSpikeTex = createIceSpikeTexture();

    // Helper material creators
    const mat = (color: string | number, roughness = 0.8, metalness = 0.1) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });

    const stonePbrMat = new THREE.MeshStandardMaterial({
      map: stoneBrickTex,
      roughness: 0.82,
      metalness: 0.15,
    });

    const woodPbrMat = new THREE.MeshStandardMaterial({
      map: woodPlankTex,
      roughness: 0.75,
      metalness: 0.08,
    });

    const roofPbrMat = new THREE.MeshStandardMaterial({
      map: roofTileTex,
      roughness: 0.65,
      metalness: 0.12,
    });

    const icePbrMat = new THREE.MeshStandardMaterial({
      map: iceSpikeTex,
      roughness: 0.2,
      metalness: 0.4,
      transparent: true,
      opacity: 0.9,
    });

    const addMesh = (
      parent: THREE.Group,
      geo: THREE.BufferGeometry,
      m: THREE.Material,
      x = 0,
      y = 0,
      z = 0,
      cast = true
    ) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // ==========================================
    // 1. EXPANDED 800x800 TERRAIN & MULTI-BIOMES
    // ==========================================
    // Base alpine meadow plane: 800x800 centered at (400, 0, 400)
    const groundGeo = new THREE.PlaneGeometry(800, 800, 32, 32);
    const groundMat = mat('#3e5a38', 0.92, 0.05);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(400, 0, 400);
    ground.receiveShadow = true;
    world.add(ground);
    groundRef.current = ground;

    // Northern Himshikhar Glaciers Snow Plateau [160, 0, 660]
    const snowPlateauGeo = new THREE.PlaneGeometry(420, 280, 16, 16);
    const snowPlateauMat = new THREE.MeshStandardMaterial({
      color: 0xecf4f8,
      roughness: 0.78,
      metalness: 0.12,
    });
    const snowPlateau = new THREE.Mesh(snowPlateauGeo, snowPlateauMat);
    snowPlateau.rotation.x = -Math.PI / 2;
    snowPlateau.position.set(210, 0.015, 660);
    snowPlateau.receiveShadow = true;
    world.add(snowPlateau);

    // Western Ironcrest Bastions Rocky Slopes [680, 0, 180]
    const ironcrestGeo = new THREE.PlaneGeometry(280, 440, 16, 16);
    const ironcrestMat = mat('#2d3748', 0.88, 0.25);
    const ironcrestPlateau = new THREE.Mesh(ironcrestGeo, ironcrestMat);
    ironcrestPlateau.rotation.x = -Math.PI / 2;
    ironcrestPlateau.position.set(660, 0.015, 220);
    ironcrestPlateau.receiveShadow = true;
    world.add(ironcrestPlateau);

    // Southern Verdant Deepwood [640, 0, 640]
    const deepwoodGeo = new THREE.PlaneGeometry(320, 320, 16, 16);
    const deepwoodMat = mat('#1e3a29', 0.95, 0.04);
    const deepwoodPlateau = new THREE.Mesh(deepwoodGeo, deepwoodMat);
    deepwoodPlateau.rotation.x = -Math.PI / 2;
    deepwoodPlateau.position.set(640, 0.015, 640);
    deepwoodPlateau.receiveShadow = true;
    world.add(deepwoodPlateau);

    // Karnali River Basin with Crystalline Water running diagonally through realm
    const riverGeo = new THREE.PlaneGeometry(880, 26, 1, 1);
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.12,
      metalness: 0.45,
      transparent: true,
      opacity: 0.88,
    });
    const river = new THREE.Mesh(riverGeo, riverMat);
    river.rotation.x = -Math.PI / 2;
    river.rotation.z = 0.58;
    river.position.set(380, 0.02, 400);
    river.receiveShadow = true;
    world.add(river);

    // River Foam Edges
    const foamMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.35,
      transparent: true,
      opacity: 0.65,
    });
    const foam1 = new THREE.Mesh(new THREE.PlaneGeometry(880, 2.2), foamMat);
    foam1.rotation.x = -Math.PI / 2;
    foam1.rotation.z = 0.58;
    foam1.position.set(380 + Math.cos(0.58 + Math.PI / 2) * 12.2, 0.022, 400 + Math.sin(0.58 + Math.PI / 2) * 12.2);
    world.add(foam1);

    const foam2 = new THREE.Mesh(new THREE.PlaneGeometry(880, 2.2), foamMat);
    foam2.rotation.x = -Math.PI / 2;
    foam2.rotation.z = 0.58;
    foam2.position.set(380 - Math.cos(0.58 + Math.PI / 2) * 12.2, 0.022, 400 - Math.sin(0.58 + Math.PI / 2) * 12.2);
    world.add(foam2);

    // Ancient Arched Stone Bridge at River Crossing [290, 0, 290]
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(290, 0, 290);
    bridgeGroup.rotation.y = 0.58 + Math.PI / 2;
    addMesh(bridgeGroup, new THREE.BoxGeometry(10, 1.2, 32), stonePbrMat, 0, 1.2, 0);
    addMesh(bridgeGroup, new THREE.BoxGeometry(0.8, 1.0, 32), stonePbrMat, -4.6, 2.2, 0);
    addMesh(bridgeGroup, new THREE.BoxGeometry(0.8, 1.0, 32), stonePbrMat, 4.6, 2.2, 0);
    // Arch pier supports
    addMesh(bridgeGroup, new THREE.CylinderGeometry(2.4, 2.8, 2.5, 8), stonePbrMat, 0, 0.8, -8);
    addMesh(bridgeGroup, new THREE.CylinderGeometry(2.4, 2.8, 2.5, 8), stonePbrMat, 0, 0.8, 8);
    world.add(bridgeGroup);

    // Perimeter Himalayan peaks bounding the 800x800 world
    for (let i = 0; i < 96; i++) {
      const angle = (i / 96) * Math.PI * 2;
      const radius = 390 + (Math.sin(i * 3) * 15);
      const px = 400 + Math.cos(angle) * radius;
      const pz = 400 + Math.sin(angle) * radius;
      const peakHeight = 22 + Math.random() * 18;
      const peakRadius = 12 + Math.random() * 8;
      const peak = addMesh(
        world,
        new THREE.ConeGeometry(peakRadius, peakHeight, 7),
        mat('#526159', 0.9, 0.1),
        px,
        peakHeight / 2,
        pz,
        false
      );
      peak.rotation.y = Math.random() * Math.PI;

      // Snow Cap on peak
      addMesh(
        world,
        new THREE.ConeGeometry(peakRadius * 0.45, peakHeight * 0.35, 7),
        mat('#f8fafc', 0.75, 0.1),
        px,
        peakHeight * 0.82,
        pz,
        false
      );
    }

    // Dense Himalayan pine forests across the Deepwood and Valley
    for (let i = 0; i < 180; i++) {
      const tx = 100 + Math.random() * 620;
      const tz = 100 + Math.random() * 620;

      // Avoid citadel and river path
      if (Math.hypot(tx - 400, tz - 400) < 45) continue;
      if (Math.abs((tz - 400) - Math.tan(0.58) * (tx - 380)) < 24) continue;

      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);
      const trunkH = 2.4 + Math.random() * 1.2;
      addMesh(tree, new THREE.CylinderGeometry(0.3, 0.45, trunkH, 6), woodPbrMat, 0, trunkH / 2, 0);

      const isDeepwood = tx > 500 && tz > 500;
      const leafColor = isDeepwood ? '#164e33' : '#22543d';
      for (let c = 0; c < 3; c++) {
        addMesh(
          tree,
          new THREE.ConeGeometry(2.2 - c * 0.4, 2.8, 6),
          mat(leafColor, 0.85, 0.05),
          0,
          trunkH + 1.2 + c * 1.5,
          0
        );
      }
      applyGLB(tree, 'himalayan_pine.glb', 1.1);
      world.add(tree);
    }

    // Glacial Ice Spires in Northern Glaciers
    for (let i = 0; i < 30; i++) {
      const ix = 60 + Math.random() * 260;
      const iz = 560 + Math.random() * 200;
      const iceGroup = new THREE.Group();
      iceGroup.position.set(ix, 0, iz);
      addMesh(iceGroup, new THREE.ConeGeometry(1.4 + Math.random() * 1.2, 5 + Math.random() * 4, 5), icePbrMat, 0, 3, 0);
      addMesh(iceGroup, new THREE.ConeGeometry(0.8, 3.2, 5), icePbrMat, 1.2, 1.6, 0.5);
      iceGroup.rotation.y = Math.random() * Math.PI;
      world.add(iceGroup);
    }

    // Object registration & data storage
    const allObjects: InteractiveObject[] = [];
    const pickables: THREE.Object3D[] = [];

    const registerInteractive = (
      group: THREE.Group,
      data: InteractiveObject
    ) => {
      group.userData.gameData = data;
      data.mesh = group;

      // Generous invisible hit cylinder collider for tactile clicking
      const hitRadius = data.type === 'monster' ? 4.2 : data.type === 'resource' ? 3.6 : 5.0;
      const hitGeo = new THREE.CylinderGeometry(hitRadius, hitRadius, 6.0, 8);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 });
      const hitCollider = new THREE.Mesh(hitGeo, hitMat);
      hitCollider.position.set(0, 3.0, 0);
      hitCollider.userData.gameData = data;
      group.add(hitCollider);

      allObjects.push(data);
      pickables.push(group);
      world.add(group);
    };

    // ==========================================
    // 2. REALISTIC KINGDOM STRUCTURES (0-800)
    // ==========================================

    // Gorkha Citadel Royal Keep [400, 0, 400]
    const citadelGroup = new THREE.Group();
    citadelGroup.position.set(400, 0, 400);

    // Multi-tier stone fortress plinth
    addMesh(citadelGroup, new THREE.BoxGeometry(16, 4.5, 16), stonePbrMat, 0, 2.25, 0);
    // Cantilevered wooden balcony tier
    addMesh(citadelGroup, new THREE.BoxGeometry(13, 3.5, 13), woodPbrMat, 0, 6.25, 0);
    // Lower Pagoda Roof
    const roof1 = addMesh(citadelGroup, new THREE.ConeGeometry(12, 3.0, 4), roofPbrMat, 0, 9.5, 0);
    roof1.rotation.y = Math.PI / 4;
    // Upper royal sanctum tier
    addMesh(citadelGroup, new THREE.BoxGeometry(8, 3.2, 8), woodPbrMat, 0, 11.5, 0);
    // Upper Pagoda Roof
    const roof2 = addMesh(citadelGroup, new THREE.ConeGeometry(8, 2.6, 4), roofPbrMat, 0, 14.0, 0);
    roof2.rotation.y = Math.PI / 4;
    // Gilded brass rooftop pinnacle (Gajur)
    const gajurMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.92,
      roughness: 0.18,
      emissive: 0xffaa00,
      emissiveIntensity: 0.6,
    });
    addMesh(citadelGroup, new THREE.CylinderGeometry(0.15, 0.45, 2.8, 8), gajurMat, 0, 16.5, 0);
    addMesh(citadelGroup, new THREE.SphereGeometry(0.55, 12, 12), gajurMat, 0, 17.8, 0);

    // Fortified Gatehouse Arch & Courtyard [Citadel Gate at 390, 0, 414]
    const gateHouse = new THREE.Group();
    gateHouse.position.set(-10, 0, 14);
    addMesh(gateHouse, new THREE.BoxGeometry(3.5, 5.0, 2.5), stonePbrMat, -3.2, 2.5, 0);
    addMesh(gateHouse, new THREE.BoxGeometry(3.5, 5.0, 2.5), stonePbrMat, 3.2, 2.5, 0);
    addMesh(gateHouse, new THREE.BoxGeometry(10, 1.8, 2.5), stonePbrMat, 0, 5.9, 0);
    addMesh(gateHouse, new THREE.ConeGeometry(6.2, 2.0, 4), roofPbrMat, 0, 7.8, 0).rotation.y = Math.PI / 4;
    citadelGroup.add(gateHouse);

    applyGLB(citadelGroup, 'gorkha_hillfort.glb', 1.4);
    registerInteractive(citadelGroup, {
      id: 'citadel-keep',
      name: 'Gorkha Citadel Keep',
      type: 'citadel',
      subtype: 'citadel',
      level: 18,
      position: [400, 0, 400],
      health: 3500,
      maxHealth: 3500,
      description: 'Supreme fortified royal palace keep, army garrison gatehouse, and central realm treasury.',
    });

    // Royal Vanguard Barracks [424, 0, 386]
    const barracksGroup = new THREE.Group();
    barracksGroup.position.set(424, 0, 386);
    addMesh(barracksGroup, new THREE.BoxGeometry(7.2, 3.2, 5.2), stonePbrMat, 0, 1.6, 0);
    addMesh(barracksGroup, new THREE.BoxGeometry(6.4, 2.2, 4.4), woodPbrMat, 0, 4.3, 0);
    const bRoof = addMesh(barracksGroup, new THREE.ConeGeometry(5.8, 2.4, 4), roofPbrMat, 0, 6.5, 0);
    bRoof.rotation.y = Math.PI / 4;
    // Training dummies in yard
    addMesh(barracksGroup, new THREE.CylinderGeometry(0.12, 0.12, 1.8, 6), woodPbrMat, 4.5, 0.9, 2.2);
    addMesh(barracksGroup, new THREE.BoxGeometry(0.8, 0.5, 0.2), mat('#854d0e'), 4.5, 1.5, 2.2);
    registerInteractive(barracksGroup, {
      id: 'bldg-barracks',
      name: 'Royal Vanguard Barracks',
      type: 'fort',
      subtype: 'citadel',
      level: 14,
      position: [424, 0, 386],
      health: 1800,
      maxHealth: 1800,
      description: 'Martial training grounds where Magar Infantry, Cavalry, and Archers undergo discipline drills.',
    });

    // Highland Cavalry Stables [432, 0, 428]
    const stablesGroup = new THREE.Group();
    stablesGroup.position.set(432, 0, 428);
    addMesh(stablesGroup, new THREE.BoxGeometry(8.5, 2.8, 5.0), woodPbrMat, 0, 1.4, 0);
    const sRoof = addMesh(stablesGroup, new THREE.ConeGeometry(6.8, 2.0, 4), roofPbrMat, 0, 3.6, 0);
    sRoof.rotation.y = Math.PI / 4;
    // Fenced paddock
    addMesh(stablesGroup, new THREE.BoxGeometry(6.0, 0.8, 0.15), woodPbrMat, 5.5, 0.4, 0);
    registerInteractive(stablesGroup, {
      id: 'bldg-stables',
      name: 'Highland Cavalry Stables',
      type: 'fort',
      subtype: 'citadel',
      level: 11,
      position: [432, 0, 428],
      health: 1450,
      maxHealth: 1450,
      description: 'Breeding paddocks for fearless mountain warhorses.',
    });

    // Royal Khukuri Forge [372, 0, 388]
    const forgeGroup = new THREE.Group();
    forgeGroup.position.set(372, 0, 388);
    addMesh(forgeGroup, new THREE.BoxGeometry(6.0, 3.0, 5.5), stonePbrMat, 0, 1.5, 0);
    addMesh(forgeGroup, new THREE.CylinderGeometry(0.8, 1.2, 4.5, 8), stonePbrMat, 2.2, 3.5, -1.8);
    // Glowing hearth
    const hearthMat = new THREE.MeshStandardMaterial({
      color: 0xff4500,
      emissive: 0xff3300,
      emissiveIntensity: 3.5,
    });
    addMesh(forgeGroup, new THREE.BoxGeometry(1.6, 1.2, 1.2), hearthMat, 0, 0.8, 2.4);
    // Anvil
    addMesh(forgeGroup, new THREE.BoxGeometry(0.8, 0.9, 1.4), mat('#334155', 0.4, 0.8), -2.0, 0.45, 1.8);
    registerInteractive(forgeGroup, {
      id: 'bldg-forge',
      name: 'Royal Khukuri Forge',
      type: 'fort',
      subtype: 'citadel',
      level: 12,
      position: [372, 0, 388],
      health: 1600,
      maxHealth: 1600,
      description: 'Master weaponsmiths forging tempered khukuri blades and mountain armor plates.',
    });

    // North Glacier Watchtower [160, 0, 660]
    const towerGlacier = new THREE.Group();
    towerGlacier.position.set(160, 0, 660);
    addMesh(towerGlacier, new THREE.CylinderGeometry(1.8, 2.5, 9.0, 8), stonePbrMat, 0, 4.5, 0);
    addMesh(towerGlacier, new THREE.CylinderGeometry(3.2, 3.2, 1.2, 8), stonePbrMat, 0, 9.5, 0);
    addMesh(towerGlacier, new THREE.ConeGeometry(3.5, 2.5, 8), roofPbrMat, 0, 11.2, 0);
    // Signal Ice Crystal Beacon at top
    addMesh(towerGlacier, new THREE.OctahedronGeometry(0.8, 0), icePbrMat, 0, 12.8, 0);
    registerInteractive(towerGlacier, {
      id: 'bldg-tower-glacier',
      name: 'North Glacier Watchtower',
      type: 'tower',
      subtype: 'tower',
      level: 16,
      position: [160, 0, 660],
      health: 2200,
      maxHealth: 2200,
      description: 'High sentinel stone bastion guarding northern glacial crevasses from yeti incursions.',
    });

    // Western Ironcrest Sentinel Bastion [680, 0, 180]
    const towerIroncrest = new THREE.Group();
    towerIroncrest.position.set(680, 0, 180);
    addMesh(towerIroncrest, new THREE.BoxGeometry(9.0, 4.5, 9.0), stonePbrMat, 0, 2.25, 0);
    addMesh(towerIroncrest, new THREE.CylinderGeometry(2.4, 2.9, 8.5, 8), stonePbrMat, 0, 8.5, 0);
    addMesh(towerIroncrest, new THREE.CylinderGeometry(3.6, 3.6, 1.4, 8), stonePbrMat, 0, 13.2, 0);
    addMesh(towerIroncrest, new THREE.ConeGeometry(3.8, 2.8, 8), roofPbrMat, 0, 15.2, 0);
    // Fire brazier
    const brazierMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff5500,
      emissiveIntensity: 3.5,
    });
    addMesh(towerIroncrest, new THREE.SphereGeometry(0.7, 8, 8), brazierMat, 0, 16.8, 0);
    registerInteractive(towerIroncrest, {
      id: 'bldg-tower-ironcrest',
      name: 'Ironcrest Sentinel Bastion',
      type: 'tower',
      subtype: 'tower',
      level: 17,
      position: [680, 0, 180],
      health: 2800,
      maxHealth: 2800,
      description: 'Impenetrable mountain stronghold securing rich western iron veins. Major Alliance Rally hub.',
    });

    // Forgotten Monastic Stupa Sanctuary [380, 0, 700]
    const stupaGroup = new THREE.Group();
    stupaGroup.position.set(380, 0, 700);
    // Stepped plinth
    addMesh(stupaGroup, new THREE.BoxGeometry(11, 1.2, 11), stonePbrMat, 0, 0.6, 0);
    addMesh(stupaGroup, new THREE.BoxGeometry(9, 1.0, 9), stonePbrMat, 0, 1.7, 0);
    // White hemispherical dome (Anda)
    const domeMat = mat('#f8fafc', 0.6, 0.1);
    addMesh(stupaGroup, new THREE.SphereGeometry(3.8, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat, 0, 2.2, 0);
    // Harmika cube
    addMesh(stupaGroup, new THREE.BoxGeometry(2.2, 1.6, 2.2), gajurMat, 0, 6.5, 0);
    // 13-tier spire
    addMesh(stupaGroup, new THREE.ConeGeometry(1.6, 4.2, 12), gajurMat, 0, 9.2, 0);
    // Sacred jewel umbrella
    addMesh(stupaGroup, new THREE.CylinderGeometry(0.2, 1.4, 0.4, 12), gajurMat, 0, 11.5, 0);
    registerInteractive(stupaGroup, {
      id: 'bldg-sanctuary',
      name: 'Forgotten Monastic Sanctuary',
      type: 'fort',
      subtype: 'citadel',
      level: 19,
      position: [380, 0, 700],
      health: 3200,
      maxHealth: 3200,
      description: 'Sacred mountain chorten stupa emanating divine spiritual protection across the realm.',
    });

    // Karnali River Trading Post [180, 0, 220]
    const riverPost = new THREE.Group();
    riverPost.position.set(180, 0, 220);
    addMesh(riverPost, new THREE.BoxGeometry(7.0, 2.8, 5.0), woodPbrMat, 0, 1.4, 0);
    const rPostRoof = addMesh(riverPost, new THREE.ConeGeometry(5.2, 1.8, 4), roofPbrMat, 0, 3.4, 0);
    rPostRoof.rotation.y = Math.PI / 4;
    // Wooden pier into water
    addMesh(riverPost, new THREE.BoxGeometry(3.2, 0.4, 8.0), woodPbrMat, 0, 0.2, 5.5);
    registerInteractive(riverPost, {
      id: 'bldg-river-post',
      name: 'Karnali River Outpost',
      type: 'fort',
      subtype: 'citadel',
      level: 10,
      position: [180, 0, 220],
      health: 1500,
      maxHealth: 1500,
      description: 'Fertile river trading post facilitating commerce and troop ferry crossings.',
    });

    // ==========================================
    // 3. REALISTIC RPG MONSTERS (Levels 5 - 15)
    // ==========================================

    // Ancient Frost Yeti King (Lv. 15 Boss) [130, 0, 710]
    const yetiKing = new THREE.Group();
    yetiKing.position.set(130, 0, 710);
    const yetiFurMat = mat('#e2e8f0', 0.9, 0.05);
    // Torso & chest
    addMesh(yetiKing, new THREE.BoxGeometry(2.8, 3.2, 2.2), yetiFurMat, 0, 2.5, 0);
    // Massive arms
    addMesh(yetiKing, new THREE.BoxGeometry(0.9, 2.8, 1.0), yetiFurMat, -1.9, 2.2, 0);
    addMesh(yetiKing, new THREE.BoxGeometry(0.9, 2.8, 1.0), yetiFurMat, 1.9, 2.2, 0);
    // Head with fierce ice horns
    addMesh(yetiKing, new THREE.BoxGeometry(1.6, 1.5, 1.5), yetiFurMat, 0, 4.6, 0.2);
    addMesh(yetiKing, new THREE.ConeGeometry(0.35, 1.8, 6), icePbrMat, -0.9, 5.6, 0.2).rotation.z = -0.4;
    addMesh(yetiKing, new THREE.ConeGeometry(0.35, 1.8, 6), icePbrMat, 0.9, 5.6, 0.2).rotation.z = 0.4;
    // Crystalline dorsal ice spikes
    for (let s = 0; s < 4; s++) {
      const spike = addMesh(yetiKing, new THREE.ConeGeometry(0.3, 1.6 - s * 0.25, 5), icePbrMat, 0, 3.6 - s * 0.7, -1.2);
      spike.rotation.x = -0.6;
    }
    // Glowing cyan eyes
    const eyeCyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    addMesh(yetiKing, new THREE.SphereGeometry(0.12, 6, 6), eyeCyanMat, -0.4, 4.6, 1.0);
    addMesh(yetiKing, new THREE.SphereGeometry(0.12, 6, 6), eyeCyanMat, 0.4, 4.6, 1.0);
    monsterGroupsMapRef.current.set('m_yeti_king', yetiKing);
    registerInteractive(yetiKing, {
      id: 'm_yeti_king',
      name: 'Ancient Frost Yeti King',
      type: 'monster',
      subtype: 'dragon',
      level: 15,
      position: [130, 0, 710],
      health: 850,
      maxHealth: 850,
      description: 'Colossal glacial monarch wielding crushing permafrost strength. High-priority Alliance Rally target!',
    });

    // Iron Ridge Rock Drake / Wyrm (Lv. 12) [720, 0, 140]
    const rockDrake = new THREE.Group();
    rockDrake.position.set(720, 0, 140);
    const drakeRockMat = mat('#334155', 0.85, 0.3);
    const magmaGlowMat = new THREE.MeshStandardMaterial({
      color: 0xff4500,
      emissive: 0xff3300,
      emissiveIntensity: 2.8,
    });
    // Segmented rocky body
    addMesh(rockDrake, new THREE.BoxGeometry(2.4, 1.8, 4.2), drakeRockMat, 0, 1.2, 0);
    addMesh(rockDrake, new THREE.BoxGeometry(1.6, 1.4, 2.2), drakeRockMat, 0, 1.8, 2.6);
    // Horned dragon skull
    addMesh(rockDrake, new THREE.ConeGeometry(0.4, 1.6, 5), drakeRockMat, -0.7, 2.6, 2.8).rotation.x = -0.5;
    addMesh(rockDrake, new THREE.ConeGeometry(0.4, 1.6, 5), drakeRockMat, 0.7, 2.6, 2.8).rotation.x = -0.5;
    // Glowing magma vents on spine
    addMesh(rockDrake, new THREE.SphereGeometry(0.35, 8, 8), magmaGlowMat, 0, 2.2, 0);
    addMesh(rockDrake, new THREE.SphereGeometry(0.3, 8, 8), magmaGlowMat, 0, 2.1, -1.4);
    // Spiked tail
    addMesh(rockDrake, new THREE.ConeGeometry(0.6, 2.6, 6), drakeRockMat, 0, 0.8, -3.2).rotation.x = -1.3;
    monsterGroupsMapRef.current.set('m_rock_drake', rockDrake);
    registerInteractive(rockDrake, {
      id: 'm_rock_drake',
      name: 'Iron Ridge Rock Drake',
      type: 'monster',
      subtype: 'dragon',
      level: 12,
      position: [720, 0, 140],
      health: 620,
      maxHealth: 620,
      description: 'Armored wyrm burrowing through iron veins. Its scales deflect ordinary arrows.',
    });

    // Shadow Dire Wolf Alpha (Lv. 8) [670, 0, 600]
    const wolfAlpha = new THREE.Group();
    wolfAlpha.position.set(670, 0, 600);
    const wolfMat = mat('#1e293b', 0.9, 0.1);
    addMesh(wolfAlpha, new THREE.BoxGeometry(1.4, 1.2, 2.8), wolfMat, 0, 1.0, 0);
    addMesh(wolfAlpha, new THREE.BoxGeometry(0.9, 0.9, 1.2), wolfMat, 0, 1.6, 1.6);
    addMesh(wolfAlpha, new THREE.ConeGeometry(0.2, 0.6, 4), wolfMat, -0.4, 2.2, 1.6);
    addMesh(wolfAlpha, new THREE.ConeGeometry(0.2, 0.6, 4), wolfMat, 0.4, 2.2, 1.6);
    // Glowing amber eyes
    const eyeAmber = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    addMesh(wolfAlpha, new THREE.SphereGeometry(0.08, 6, 6), eyeAmber, -0.28, 1.7, 2.2);
    addMesh(wolfAlpha, new THREE.SphereGeometry(0.08, 6, 6), eyeAmber, 0.28, 1.7, 2.2);
    monsterGroupsMapRef.current.set('m_wolf_alpha', wolfAlpha);
    registerInteractive(wolfAlpha, {
      id: 'm_wolf_alpha',
      name: 'Shadow Dire Wolf Alpha',
      type: 'monster',
      subtype: 'dragon',
      level: 8,
      position: [670, 0, 600],
      health: 380,
      maxHealth: 380,
      description: 'Lethal predator leading deepwood packs. Swift and vicious in forest ambush.',
    });

    // Forest Treant Ancient (Lv. 9) [590, 0, 680]
    const treantAncient = new THREE.Group();
    treantAncient.position.set(590, 0, 680);
    addMesh(treantAncient, new THREE.CylinderGeometry(0.8, 1.4, 4.5, 7), woodPbrMat, 0, 2.25, 0);
    // Tree canopy antlers
    addMesh(treantAncient, new THREE.DodecahedronGeometry(1.8, 1), mat('#14532d'), 0, 5.0, 0);
    addMesh(treantAncient, new THREE.DodecahedronGeometry(1.2, 1), mat('#166534'), -1.5, 4.2, 0);
    addMesh(treantAncient, new THREE.DodecahedronGeometry(1.2, 1), mat('#166534'), 1.5, 4.2, 0);
    // Glowing emerald heartwood
    const emeraldMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 3.2,
    });
    addMesh(treantAncient, new THREE.SphereGeometry(0.4, 8, 8), emeraldMat, 0, 2.5, 0.8);
    monsterGroupsMapRef.current.set('m_treant', treantAncient);
    registerInteractive(treantAncient, {
      id: 'm_treant',
      name: 'Forest Treant Ancient',
      type: 'monster',
      subtype: 'dragon',
      level: 9,
      position: [590, 0, 680],
      health: 460,
      maxHealth: 460,
      description: 'Sentient pine titan defending old-growth sacred mandala timber.',
    });

    // River Siren Serpent (Lv. 10) [150, 0, 260]
    const riverSiren = new THREE.Group();
    riverSiren.position.set(150, 0, 260);
    const sirenMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.2,
      metalness: 0.6,
      transparent: true,
      opacity: 0.85,
    });
    addMesh(riverSiren, new THREE.TorusGeometry(1.6, 0.5, 8, 24, Math.PI * 1.5), sirenMat, 0, 0.8, 0).rotation.x = Math.PI / 2;
    addMesh(riverSiren, new THREE.CylinderGeometry(0.35, 0.5, 3.0, 8), sirenMat, 1.2, 2.2, 0);
    addMesh(riverSiren, new THREE.SphereGeometry(0.6, 10, 10), sirenMat, 1.2, 3.9, 0);
    monsterGroupsMapRef.current.set('m_siren', riverSiren);
    registerInteractive(riverSiren, {
      id: 'm_siren',
      name: 'Karnali River Serpent',
      type: 'monster',
      subtype: 'dragon',
      level: 10,
      position: [150, 0, 260],
      health: 500,
      maxHealth: 500,
      description: 'Aquatic beast terrorizing river cargo barges. Summons whirlpool torrents.',
    });

    // Himalayan Snow Leopard (Lv. 5) [200, 0, 600]
    const snowLeopard = new THREE.Group();
    snowLeopard.position.set(200, 0, 600);
    const leopardMat = mat('#cbd5e1', 0.85, 0.1);
    addMesh(snowLeopard, new THREE.BoxGeometry(1.1, 0.9, 2.2), leopardMat, 0, 0.7, 0);
    addMesh(snowLeopard, new THREE.BoxGeometry(0.7, 0.7, 0.9), leopardMat, 0, 1.2, 1.2);
    addMesh(snowLeopard, new THREE.CylinderGeometry(0.1, 0.1, 1.8, 5), leopardMat, 0, 0.9, -1.8).rotation.x = -0.7;
    monsterGroupsMapRef.current.set('m_snow_leopard', snowLeopard);
    registerInteractive(snowLeopard, {
      id: 'm_snow_leopard',
      name: 'Himalayan Snow Leopard',
      type: 'monster',
      subtype: 'dragon',
      level: 5,
      position: [200, 0, 600],
      health: 240,
      maxHealth: 240,
      description: 'Elusive mountain feline stalking prey along high-altitude glacial moraines.',
    });

    // Mountain Bandit Warlord Camp (Lv. 6) [310, 0, 280]
    const banditCamp = new THREE.Group();
    banditCamp.position.set(310, 0, 280);
    addMesh(banditCamp, new THREE.ConeGeometry(2.5, 2.4, 6), mat('#78350f'), 0, 1.2, 0);
    addMesh(banditCamp, new THREE.BoxGeometry(4.0, 0.8, 0.3), woodPbrMat, 0, 0.4, 2.5);
    // Skulls & banners
    addMesh(banditCamp, new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), woodPbrMat, 2.2, 1.6, 2.5);
    monsterGroupsMapRef.current.set('m_bandit', banditCamp);
    registerInteractive(banditCamp, {
      id: 'm_bandit',
      name: 'Mountain Bandit Warlord Camp',
      type: 'monster',
      subtype: 'dragon',
      level: 6,
      position: [310, 0, 280],
      health: 310,
      maxHealth: 310,
      description: 'Rogue marauders preying on trade caravans passing through central valley gorges.',
    });

    // Corrupted Stone Colossus (Lv. 14) [350, 0, 740]
    const stoneColossus = new THREE.Group();
    stoneColossus.position.set(350, 0, 740);
    addMesh(stoneColossus, new THREE.BoxGeometry(2.6, 3.8, 2.2), stonePbrMat, 0, 2.4, 0);
    addMesh(stoneColossus, new THREE.BoxGeometry(1.4, 1.4, 1.4), stonePbrMat, 0, 4.8, 0);
    // Glowing runic core
    const runicMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x9333ea,
      emissiveIntensity: 3.5,
    });
    addMesh(stoneColossus, new THREE.SphereGeometry(0.5, 8, 8), runicMat, 0, 2.8, 1.0);
    monsterGroupsMapRef.current.set('m_colossus', stoneColossus);
    registerInteractive(stoneColossus, {
      id: 'm_colossus',
      name: 'Corrupted Stone Colossus',
      type: 'monster',
      subtype: 'dragon',
      level: 14,
      position: [350, 0, 740],
      health: 780,
      maxHealth: 780,
      description: 'Ancient animated monastic guardian reawakened by dark energy.',
    });

    // ==========================================
    // 4. RESOURCE NODES (Levels 1 - 5 across 0-800)
    // ==========================================
    const resourceNodesData: InteractiveObject[] = [
      // Wood (Lv 1 - 5)
      {
        id: 'r_w1',
        name: 'Pine Sapling Grove',
        type: 'resource',
        subtype: 'wood',
        level: 1,
        position: [435, 0, 435],
        yieldAmount: 350,
        resourceType: 'wood',
        description: 'Young Himalayan pine saplings easily harvested by novice recruits.',
      },
      {
        id: 'r_w2',
        name: 'Alpine Timber Stand',
        type: 'resource',
        subtype: 'wood',
        level: 2,
        position: [465, 0, 360],
        yieldAmount: 650,
        resourceType: 'wood',
        description: 'Sturdy mountain pine trees yielding durable fortress structural timber.',
      },
      {
        id: 'r_w3',
        name: 'Ancient Pine Forest',
        type: 'resource',
        subtype: 'wood',
        level: 3,
        position: [610, 0, 610],
        yieldAmount: 1100,
        resourceType: 'wood',
        description: 'Old-growth towering pine trunks prized for longbows and ballistas.',
      },
      {
        id: 'r_w4',
        name: 'Ironwood Grove',
        type: 'resource',
        subtype: 'wood',
        level: 4,
        position: [660, 0, 670],
        yieldAmount: 1800,
        resourceType: 'wood',
        description: 'Dense dark ironwood capable of resisting siege ram fire and axe blows.',
      },
      {
        id: 'r_w5',
        name: 'Mythic Bodhi Timber',
        type: 'resource',
        subtype: 'wood',
        level: 5,
        position: [570, 0, 720],
        yieldAmount: 2800,
        resourceType: 'wood',
        description: 'Sacred luminescent highland timber imbued with protective spiritual wards.',
      },

      // Farm / Food (Lv 1 - 5)
      {
        id: 'r_f1',
        name: 'Highland Barley Field',
        type: 'resource',
        subtype: 'farm',
        level: 1,
        position: [370, 0, 440],
        yieldAmount: 400,
        resourceType: 'farm',
        description: 'Hardy mountain barley ripening on sunlit capital hillocks.',
      },
      {
        id: 'r_f2',
        name: 'Terraced Rice Paddies',
        type: 'resource',
        subtype: 'farm',
        level: 2,
        position: [220, 0, 250],
        yieldAmount: 750,
        resourceType: 'farm',
        description: 'Cascading irrigated green terraces fed by glacial river runoff.',
      },
      {
        id: 'r_f3',
        name: 'Royal Granary Orchard',
        type: 'resource',
        subtype: 'farm',
        level: 3,
        position: [440, 0, 340],
        yieldAmount: 1250,
        resourceType: 'farm',
        description: 'Abundant fruit orchards and millet plots supporting standing armies.',
      },
      {
        id: 'r_f4',
        name: 'Golden Grain Silos',
        type: 'resource',
        subtype: 'farm',
        level: 4,
        position: [270, 0, 210],
        yieldAmount: 1950,
        resourceType: 'farm',
        description: 'High-yield grain reserves feeding the kingdom through harsh mountain winters.',
      },
      {
        id: 'r_f5',
        name: 'Celestial Harvest Valley',
        type: 'resource',
        subtype: 'farm',
        level: 5,
        position: [190, 0, 170],
        yieldAmount: 3100,
        resourceType: 'farm',
        description: 'Blessed fertile river basin capable of nourishing multiple alliance battalions.',
      },

      // Stone / Crystal (Lv 1 - 5)
      {
        id: 'r_s1',
        name: 'Slate Outcrop',
        type: 'resource',
        subtype: 'stone',
        level: 1,
        position: [445, 0, 385],
        yieldAmount: 320,
        resourceType: 'stone',
        description: 'Exposed mountain slate ideal for simple roof shingles and fort pavers.',
      },
      {
        id: 'r_s2',
        name: 'Granite Quarry',
        type: 'resource',
        subtype: 'stone',
        level: 2,
        position: [510, 0, 410],
        yieldAmount: 680,
        resourceType: 'stone',
        description: 'Dense granite rock blocks extracted for keep ramparts and watchtowers.',
      },
      {
        id: 'r_s3',
        name: 'Marble Crag',
        type: 'resource',
        subtype: 'stone',
        level: 3,
        position: [630, 0, 230],
        yieldAmount: 1200,
        resourceType: 'stone',
        description: 'Veined crystalline marble used for temple sanctuaries and royal monuments.',
      },
      {
        id: 'r_s4',
        name: 'Obsidian Monolith',
        type: 'resource',
        subtype: 'stone',
        level: 4,
        position: [710, 0, 250],
        yieldAmount: 1850,
        resourceType: 'stone',
        description: 'Glass-smooth volcanic obsidian forming razor-sharp defensive spikes.',
      },
      {
        id: 'r_s5',
        name: 'Starfall Crystal Spire',
        type: 'resource',
        subtype: 'stonecrystal',
        level: 5,
        position: [360, 0, 680],
        yieldAmount: 3000,
        resourceType: 'stonecrystal',
        description: 'Pulsing arcane crystal formation holding concentrated elemental earth energy.',
      },

      // Iron / Gold Mines (Lv 1 - 5)
      {
        id: 'r_i1',
        name: 'Shallow Iron Vein',
        type: 'resource',
        subtype: 'iron',
        level: 1,
        position: [360, 0, 370],
        yieldAmount: 300,
        resourceType: 'iron',
        description: 'Surface deposits of iron ore suitable for forging basic spears and nails.',
      },
      {
        id: 'r_i2',
        name: 'Deep Copper Lode',
        type: 'resource',
        subtype: 'iron',
        level: 2,
        position: [490, 0, 460],
        yieldAmount: 620,
        resourceType: 'iron',
        description: 'Rich reddish copper vein powering metallurgy and brass armaments.',
      },
      {
        id: 'r_i3',
        name: 'Royal Iron Mine',
        type: 'resource',
        subtype: 'iron',
        level: 3,
        position: [650, 0, 200],
        yieldAmount: 1150,
        resourceType: 'iron',
        description: 'Established underground shaft yielding high-grade war iron for khukuris.',
      },
      {
        id: 'r_i4',
        name: 'Highland Gold Crevasse',
        type: 'resource',
        subtype: 'gold',
        level: 4,
        position: [700, 0, 160],
        yieldAmount: 1750,
        resourceType: 'gold',
        description: 'Glittering aurum veins extracted from high mountain crevices for the treasury.',
      },
      {
        id: 'r_i5',
        name: 'Mithril Core Chamber',
        type: 'resource',
        subtype: 'iron',
        level: 5,
        position: [750, 0, 190],
        yieldAmount: 2900,
        resourceType: 'iron',
        description: 'Legendary luminescent silver-blue ore lighter than silk and stronger than steel.',
      },
    ];

    resourceNodesData.forEach((rData) => {
      const rGroup = new THREE.Group();
      rGroup.position.set(rData.position[0], 0, rData.position[2]);

      const sub = rData.subtype;
      if (sub === 'wood') {
        const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 2.4, 7);
        addMesh(rGroup, trunkGeo, woodPbrMat, 0, 1.2, 0);
        addMesh(rGroup, new THREE.ConeGeometry(2.4, 3.2, 7), mat('#1b4332', 0.85, 0.05), 0, 3.6, 0);
        addMesh(rGroup, new THREE.ConeGeometry(1.8, 2.4, 7), mat('#2d6a4f', 0.85, 0.05), 0, 5.2, 0);
      } else if (sub === 'farm') {
        // Terraced field plots with golden harvest stalks
        addMesh(rGroup, new THREE.BoxGeometry(4.8, 0.5, 4.8), mat('#5c4028', 0.95, 0.02), 0, 0.25, 0);
        addMesh(rGroup, new THREE.BoxGeometry(4.2, 0.4, 4.2), mat('#eab308', 0.8, 0.1), 0, 0.6, 0);
        for (let s = 0; s < 5; s++) {
          addMesh(rGroup, new THREE.ConeGeometry(0.35, 1.2, 5), mat('#ca8a04'), (s - 2) * 0.8, 1.1, 0);
        }
      } else if (sub === 'stone' || sub === 'stonecrystal') {
        const stoneColor = sub === 'stonecrystal' ? 0x06b6d4 : 0x71717a;
        const mainStone = addMesh(
          rGroup,
          new THREE.DodecahedronGeometry(1.8, 1),
          sub === 'stonecrystal' ? icePbrMat : stonePbrMat,
          0,
          1.4,
          0
        );
        mainStone.scale.set(1.2, 1.6, 1.0);
        addMesh(rGroup, new THREE.DodecahedronGeometry(1.0, 0), mat(stoneColor), 1.4, 0.8, 0.6);
        addMesh(rGroup, new THREE.DodecahedronGeometry(0.9, 0), mat(stoneColor), -1.2, 0.7, -0.5);
      } else {
        // Iron / Gold mines
        const isGold = sub === 'gold';
        const oreMat = new THREE.MeshStandardMaterial({
          color: isGold ? 0xf59e0b : 0x475569,
          metalness: isGold ? 0.9 : 0.75,
          roughness: isGold ? 0.25 : 0.4,
        });
        addMesh(rGroup, new THREE.BoxGeometry(3.6, 2.0, 3.6), stonePbrMat, 0, 1.0, 0);
        // Mining timber braces
        addMesh(rGroup, new THREE.BoxGeometry(0.3, 2.6, 0.3), woodPbrMat, -1.4, 1.3, 1.4);
        addMesh(rGroup, new THREE.BoxGeometry(0.3, 2.6, 0.3), woodPbrMat, 1.4, 1.3, 1.4);
        addMesh(rGroup, new THREE.BoxGeometry(3.1, 0.3, 0.3), woodPbrMat, 0, 2.5, 1.4);
        // Ore nuggets
        for (let n = 0; n < 6; n++) {
          addMesh(
            rGroup,
            new THREE.DodecahedronGeometry(0.35, 0),
            oreMat,
            (Math.random() - 0.5) * 2.2,
            0.4,
            (Math.random() - 0.5) * 2.2
          );
        }
      }

      registerInteractive(rGroup, rData);
    });

    // Provide registered objects list to parent
    objectsListRef.current = allObjects;
    pickableMeshesRef.current = pickables;
    registerObjectsRef(allObjects);

    // ==========================================
    // 5. MASTER DAMAGE EXECUTION HANDLER
    // ==========================================
    const flashMonsterWhite = (group: THREE.Group) => {
      group.position.x += (Math.random() - 0.5) * 0.4;
      group.position.y += 0.3;

      group.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m: any) => {
            if (m && m.isMeshStandardMaterial) {
              if (!m.userData._origEmissive) {
                m.userData._origEmissive = m.emissive.clone();
                m.userData._origColor = m.color.clone();
                m.userData._origIntensity = m.emissiveIntensity;
              }
              m.emissive.setHex(0xffffff);
              m.emissiveIntensity = 4.0;
              m.color.setHex(0xffffff);
            }
          });
          activeFlashesRef.current.push({ mesh, timer: 0.22, maxTimer: 0.22 });
        }
      });
    };

    const turnMonsterIntoSmoke = (monsterId: string, group: THREE.Group) => {
      activeDissolvingRef.current.push({
        group,
        progress: 0,
        origY: group.position.y,
      });

      const pIdx = pickableMeshesRef.current.indexOf(group);
      if (pIdx !== -1) {
        pickableMeshesRef.current.splice(pIdx, 1);
      }

      const originPos = group.position.clone();
      const smokeCount = 38;
      const smokeShades = [0xf1f5f9, 0xe2e8f0, 0xcbd5e1, 0x94a3b8];

      for (let i = 0; i < smokeCount; i++) {
        const radius = 0.45 + Math.random() * 0.35;
        const puffGeo = new THREE.DodecahedronGeometry(radius, 1);
        const puffColor = smokeShades[Math.floor(Math.random() * smokeShades.length)];
        const puffMat = new THREE.MeshStandardMaterial({
          color: puffColor,
          roughness: 0.95,
          metalness: 0.05,
          transparent: true,
          opacity: 0.88,
          depthWrite: false,
        });
        const puffMesh = new THREE.Mesh(puffGeo, puffMat);
        puffMesh.position.set(
          originPos.x + (Math.random() - 0.5) * 2.2,
          originPos.y + 0.3 + Math.random() * 1.6,
          originPos.z + (Math.random() - 0.5) * 2.2
        );
        const initScale = 0.4 + Math.random() * 0.3;
        puffMesh.scale.setScalar(initScale);
        world.add(puffMesh);

        activeSmokeParticlesRef.current.push({
          mesh: puffMesh,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 2.2,
            2.5 + Math.random() * 3.5,
            (Math.random() - 0.5) * 2.2
          ),
          rotSpeedX: (Math.random() - 0.5) * 3.5,
          rotSpeedY: (Math.random() - 0.5) * 3.5,
          rotSpeedZ: (Math.random() - 0.5) * 3.5,
          life: 0,
          maxLife: 2.4 + Math.random() * 0.8,
          initialScale: initScale,
          targetScale: 3.2 + Math.random() * 1.6,
        });
      }
    };

    const executeMonsterDamage = (monsterId: string, damage: number, forceFatal?: boolean): { remainingHp: number; isDead: boolean } => {
      const mg = monsterGroupsMapRef.current.get(monsterId);
      if (!mg || !worldRef.current) return { remainingHp: 0, isDead: true };
      const gameData = mg.userData.gameData as InteractiveObject;
      if (!gameData || gameData.isDefeated) return { remainingHp: 0, isDead: true };

      const currentHp = gameData.health ?? 200;
      const newHp = forceFatal ? 0 : Math.max(0, currentHp - damage);
      gameData.health = newHp;
      const isDead = newHp <= 0;

      const worldPos = mg.position.clone();
      worldPos.y += 2.5;
      worldPos.applyMatrix4(worldRef.current.matrixWorld);
      if (cameraRef.current && container) {
        worldPos.project(cameraRef.current);
        const screenX = ((worldPos.x + 1) * container.clientWidth) / 2;
        const screenY = ((-worldPos.y + 1) * container.clientHeight) / 2;

        if (!isDead) {
          onAddCombatFloater(`-${damage} HP`, '#ff4d4f', screenX, screenY - 20);
          onAddCombatFloater('⚔️ CLASH', '#dfba6e', screenX, screenY - 45);
        } else {
          onAddCombatFloater(`-${damage} HP CRIT!`, '#ff2222', screenX, screenY - 10);
          onAddCombatFloater('💨 DISSOLVED INTO SMOKE', '#e2e8f0', screenX, screenY - 40);
          onAddCombatFloater('💀 VANQUISHED!', '#dfba6e', screenX, screenY - 70);
        }
      }

      if (!isDead) {
        flashMonsterWhite(mg);
      } else {
        gameData.isDefeated = true;
        turnMonsterIntoSmoke(monsterId, mg);
      }

      if (onUpdateObjectHp) {
        onUpdateObjectHp(monsterId, newHp, isDead);
      }

      return { remainingHp: newHp, isDead };
    };

    if (registerDamageHandlerRef) {
      registerDamageHandlerRef((monsterId: string, damage: number, forceFatal?: boolean) => {
        return executeMonsterDamage(monsterId, damage, forceFatal);
      });
    }

    // ==========================================
    // 6. MAGAR VANGUARD ARMY BATTALION
    // ==========================================
    const armyGroup = new THREE.Group();
    armyGroup.position.copy(armyPosRef.current);
    armyGroup.userData = { isArmyGroup: true };
    armyGroup.visible = false; // Troops are stationed inside citadel until deployed!

    // Disciplined 15-warrior squad in formation
    for (let i = 0; i < 15; i++) {
      const warrior = new THREE.Group();
      const col = i % 5;
      const row = Math.floor(i / 5);
      warrior.position.set((col - 2) * 0.75, 0, (row - 1) * 0.8);

      const isCav = i === 4 || i === 10;
      const isArch = i === 2 || i === 7 || i === 12;
      const isCommander = i === 0;

      warrior.userData = { origY: 0, isCav, isArch, isCommander, idx: i };

      const clothMat = mat(isCommander ? '#b8860b' : isArch ? '#3e6347' : isCav ? '#7a4e28' : '#8e2b22');
      const skinMat = mat('#cfa07e');
      const metalMat = mat('#94a3b8', 0.3, 0.7);

      if (isCav) {
        // Mountain Steed Warhorse
        const horseMat = mat('#523620');
        addMesh(warrior, new THREE.BoxGeometry(0.55, 0.55, 1.1), horseMat, 0, 0.55, 0);
        const horseHead = addMesh(warrior, new THREE.BoxGeometry(0.28, 0.38, 0.45), horseMat, 0, 0.95, 0.5);
        horseHead.rotation.x = -0.3;
        // Rider
        addMesh(warrior, new THREE.CylinderGeometry(0.18, 0.22, 0.65, 7), clothMat, 0, 1.15, 0);
        addMesh(warrior, new THREE.SphereGeometry(0.18, 8, 8), skinMat, 0, 1.62, 0);
        addMesh(warrior, new THREE.ConeGeometry(0.2, 0.3, 7), metalMat, 0, 1.82, 0);
        const lance = addMesh(warrior, new THREE.CylinderGeometry(0.025, 0.025, 1.8, 6), metalMat, 0.32, 1.4, 0.3);
        lance.rotation.x = 0.2;
      } else {
        // Foot Soldier
        const legLeft = addMesh(warrior, new THREE.CylinderGeometry(0.07, 0.08, 0.45, 6), mat('#2b2622'), -0.12, 0.22, 0);
        const legRight = addMesh(warrior, new THREE.CylinderGeometry(0.07, 0.08, 0.45, 6), mat('#2b2622'), 0.12, 0.22, 0);
        legLeft.userData = { isLegLeft: true };
        legRight.userData = { isLegRight: true };

        addMesh(warrior, new THREE.CylinderGeometry(0.2, 0.24, 0.68, 7), clothMat, 0, 0.75, 0);
        addMesh(warrior, new THREE.SphereGeometry(0.18, 8, 8), skinMat, 0, 1.25, 0);
        addMesh(warrior, new THREE.ConeGeometry(0.2, 0.28, 7), metalMat, 0, 1.45, 0);

        if (isCommander) {
          const goldCrest = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 1.5 });
          addMesh(warrior, new THREE.BoxGeometry(0.05, 0.35, 0.3), goldCrest, 0, 1.65, 0);
        }

        if (isArch) {
          addMesh(warrior, new THREE.TorusGeometry(0.32, 0.035, 5, 12, Math.PI), mat('#5c4028'), 0.38, 0.9, 0);
        } else {
          const sword = addMesh(warrior, new THREE.BoxGeometry(0.07, 0.75, 0.07), metalMat, 0.38, 0.85, 0.1);
          sword.userData = { isWeapon: true };
          const shieldMat = isCommander ? mat('#b8860b') : mat('#7c2d12');
          const shield = addMesh(warrior, new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12), shieldMat, -0.35, 0.85, 0.12);
          shield.rotation.x = Math.PI / 2;
        }
      }

      armyGroup.add(warrior);
    }

    // Gilded Battalion Banner & Glowing Beacon Orb
    addMesh(armyGroup, new THREE.CylinderGeometry(0.04, 0.04, 3.8, 8), mat('#ffd700', 0.2, 0.8), -1.2, 2.0, -0.2);
    addMesh(armyGroup, new THREE.BoxGeometry(1.4, 0.8, 0.05), mat('#b91c1c', 0.4, 0.3), -0.5, 3.2, -0.2);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xffe066,
      emissive: 0xffb703,
      emissiveIntensity: 2.8,
    });
    addMesh(armyGroup, new THREE.SphereGeometry(0.2, 12, 12), beaconMat, -1.2, 3.9, -0.2);

    // Floating 3D Chevron Pointer
    const chevronMat = new THREE.MeshStandardMaterial({
      color: 0xffd978,
      emissive: 0xff9900,
      emissiveIntensity: 2.5,
      transparent: true,
      opacity: 0.95,
    });
    const chevronPointer = addMesh(armyGroup, new THREE.ConeGeometry(0.35, 0.6, 4), chevronMat, 0, 4.6, 0);
    chevronPointer.rotation.x = Math.PI;

    world.add(armyGroup);
    armyGroupRef.current = armyGroup;

    // Tactical Line Indicator
    const lineMat = new THREE.LineDashedMaterial({
      color: 0xffd700,
      linewidth: 3,
      scale: 1,
      dashSize: 1.2,
      gapSize: 0.8,
    });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]);
    const tacticalLine = new THREE.Line(lineGeo, lineMat);
    tacticalLine.visible = false;
    world.add(tacticalLine);
    tacticalLineRef.current = tacticalLine;

    // Selection Ring Indicator
    const ringGeo = new THREE.RingGeometry(3.2, 3.6, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffe066,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.visible = false;
    world.add(ringMesh);
    selectionRingRef.current = ringMesh;

    // Spawn Mining Particles
    const spawnMiningParticles = (pos: THREE.Vector3, type = 'stone') => {
      const chipColor = type === 'wood' ? 0x8b5a2b : type === 'gold' ? 0xf59e0b : type === 'iron' ? 0x94a3b8 : 0xd1d5db;
      for (let i = 0; i < 6; i++) {
        const pGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
        const pMat = new THREE.MeshStandardMaterial({ color: chipColor, roughness: 0.5 });
        const chip = new THREE.Mesh(pGeo, pMat);
        chip.position.set(
          pos.x + (Math.random() - 0.5) * 1.5,
          pos.y + 0.4 + Math.random() * 0.8,
          pos.z + (Math.random() - 0.5) * 1.5
        );
        world.add(chip);
        activeMiningParticlesRef.current.push({
          mesh: chip,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 3.5, 3.5 + Math.random() * 3.0, (Math.random() - 0.5) * 3.5),
          rotSpeed: (Math.random() - 0.5) * 10,
          life: 0,
          maxLife: 0.7 + Math.random() * 0.3,
        });
      }
    };

    // ==========================================
    // 7. RENDER & SIMULATION LOOP
    // ==========================================
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Dynamically track sun light & shadows to follow camera pan across 0-800 realm
      if (sunLightRef.current && worldRef.current) {
        const curPanX = -worldRef.current.position.x;
        const curPanZ = -worldRef.current.position.z;
        sunLightRef.current.position.set(curPanX - 60, 110, curPanZ + 50);
        sunLightRef.current.target.position.set(curPanX, 0, curPanZ);
        sunLightRef.current.target.updateMatrixWorld();
      }

      // Selection ring gentle pulse
      if (selectionRingRef.current && selectionRingRef.current.visible) {
        const s = 1.0 + Math.sin(elapsed * 4) * 0.08;
        selectionRingRef.current.scale.set(s, s, s);
      }

      // Army movement & Real-Time Arrival Combat Logic
      if (armyGroupRef.current) {
        const currentPos = armyGroupRef.current.position;
        const currentArmyState = armyStateRef.current;
        const currentTarget = activeTargetRef.current;

        if (
          (currentArmyState === 'ATTACKING' ||
            currentArmyState === 'GATHERING' ||
            currentArmyState === 'MARCHING') &&
          currentTarget
        ) {
          const targetPos = new THREE.Vector3(
            currentTarget.position[0],
            0.02,
            currentTarget.position[2]
          );
          const dist = currentPos.distanceTo(targetPos);

          if (tacticalLineRef.current) {
            tacticalLineRef.current.visible = true;
            const p1 = currentPos.clone();
            p1.y = 0.22;
            const p2 = targetPos.clone();
            p2.y = 0.22;
            tacticalLineRef.current.geometry.setFromPoints([p1, p2]);
          }

          if (dist > 2.0) {
            // Marching towards destination across 0-800 realm
            const dir = new THREE.Vector3().subVectors(targetPos, currentPos).normalize();
            // Balanced march speed for expansive terrain
            currentPos.addScaledVector(dir, delta * 14.0);
            currentPos.y = 0.02 + Math.abs(Math.sin(elapsed * 12)) * 0.22;
            armyGroupRef.current.rotation.y = Math.atan2(dir.x, dir.z);

            // Animate 15 marching warriors: walking legs, swinging weapons
            armyGroupRef.current.children.forEach((child) => {
              const warrior = child as THREE.Group;
              if (warrior.userData?.idx !== undefined) {
                const idx = warrior.userData.idx;
                warrior.position.y = Math.abs(Math.sin(elapsed * 12 + idx * 0.6)) * 0.14;
                warrior.children.forEach((mesh) => {
                  if (mesh.userData?.isLegLeft) {
                    mesh.rotation.x = Math.sin(elapsed * 12 + idx) * 0.55;
                  } else if (mesh.userData?.isLegRight) {
                    mesh.rotation.x = -Math.sin(elapsed * 12 + idx) * 0.55;
                  } else if (mesh.userData?.isWeapon) {
                    mesh.rotation.x = Math.sin(elapsed * 8 + idx) * 0.35;
                  }
                });
              }
            });

            if (totalMarchDistanceRef.current > 0) {
              const walked = Math.max(0, totalMarchDistanceRef.current - dist);
              const pct = Math.min(48, Math.max(6, Math.round((walked / totalMarchDistanceRef.current) * 48)));
              const secsLeft = Math.max(0.3, Math.round((dist / 14.0) * 10) / 10);
              onMissionProgressUpdateRef.current?.(
                pct,
                `Vanguard traversing realm to ${currentTarget.name}...`,
                `${secsLeft}s`
              );
            }
          } else {
            // Reached target in real time!
            currentPos.y = 0.02;
            const dir = new THREE.Vector3().subVectors(targetPos, currentPos).normalize();
            armyGroupRef.current.rotation.y = Math.atan2(dir.x, dir.z);

            if (currentArmyState === 'ATTACKING') {
              const targetMg = monsterGroupsMapRef.current.get(currentTarget.id);
              if (targetMg && targetMg.userData?.gameData && !targetMg.userData.gameData.isDefeated) {
                if (!hasStruckUponArrivalRef.current) {
                  hasStruckUponArrivalRef.current = true;
                  combatStrikeTimerRef.current = 0;
                  const curHp = targetMg.userData.gameData.health ?? 200;
                  const strikeDamage = Math.max(45, Math.min(curHp, 60 + (currentTarget.level || 1) * 8));
                  const isFatal = curHp <= strikeDamage;

                  executeMonsterDamage(currentTarget.id, strikeDamage, isFatal);
                  onMissionProgressUpdateRef.current?.(
                    55,
                    `First strike landing on ${currentTarget.name}! (-${strikeDamage} HP)`,
                    'Clashing'
                  );

                  if (isFatal) {
                    onMissionStepCompleteRef.current?.({ type: 'attack', target: currentTarget });
                  }
                } else {
                  combatStrikeTimerRef.current += delta;
                  if (combatStrikeTimerRef.current >= 0.85) {
                    combatStrikeTimerRef.current = 0;
                    const curHp = targetMg.userData.gameData.health ?? 200;
                    const strikeDamage = Math.max(50, 65);
                    const isFatal = curHp <= strikeDamage;

                    executeMonsterDamage(currentTarget.id, strikeDamage, isFatal);
                    const maxHp = targetMg.userData.gameData.maxHealth || 200;
                    const pct = Math.min(95, 60 + Math.round((1 - (curHp - strikeDamage) / maxHp) * 35));
                    onMissionProgressUpdateRef.current?.(
                      pct,
                      `Vanguard assaulting ${currentTarget.name}! (-${strikeDamage} HP)`,
                      'Fighting'
                    );

                    if (isFatal) {
                      onMissionStepCompleteRef.current?.({ type: 'attack', target: currentTarget });
                    }
                  }
                }
              }
            } else if (currentArmyState === 'GATHERING') {
              gatherTimerRef.current += delta;
              miningChipTimerRef.current += delta;

              if (miningChipTimerRef.current >= 0.25) {
                miningChipTimerRef.current = 0;
                spawnMiningParticles(targetPos, currentTarget.subtype);
              }

              const gatherDuration = 4.5;
              const gPct = Math.min(98, 48 + Math.round((gatherTimerRef.current / gatherDuration) * 50));
              const secsRemain = Math.max(0, Math.round((gatherDuration - gatherTimerRef.current) * 10) / 10);
              onMissionProgressUpdateRef.current?.(
                gPct,
                `Harvesting ${currentTarget.name}...`,
                `${secsRemain}s`
              );

              if (gatherTimerRef.current >= gatherDuration) {
                gatherTimerRef.current = 0;
                onMissionStepCompleteRef.current?.({ type: 'gather', target: currentTarget });
              }
            }
          }
        } else if (currentArmyState === 'RETURNING') {
          // Returning to Citadel Gate garrison at [390, 0.02, 414]
          const homePos = armyHomeRef.current;
          const distHome = currentPos.distanceTo(homePos);

          if (tacticalLineRef.current) {
            tacticalLineRef.current.visible = true;
            const p1 = currentPos.clone();
            p1.y = 0.22;
            const p2 = homePos.clone();
            p2.y = 0.22;
            tacticalLineRef.current.geometry.setFromPoints([p1, p2]);
          }

          if (distHome > 2.0) {
            const dir = new THREE.Vector3().subVectors(homePos, currentPos).normalize();
            currentPos.addScaledVector(dir, delta * 15.0);
            currentPos.y = 0.02 + Math.abs(Math.sin(elapsed * 12)) * 0.18;
            armyGroupRef.current.rotation.y = Math.atan2(dir.x, dir.z);

            if (totalMarchDistanceRef.current > 0) {
              const walked = Math.max(0, totalMarchDistanceRef.current - distHome);
              const pct = Math.min(96, Math.max(50, 50 + Math.round((walked / totalMarchDistanceRef.current) * 46)));
              const secsLeft = Math.max(0.3, Math.round((distHome / 15.0) * 10) / 10);
              onMissionProgressUpdateRef.current?.(
                pct,
                'Vanguard marching back to citadel gate...',
                `${secsLeft}s`
              );
            }
          } else {
            // Safely arrived and garrisoned inside the Citadel!
            currentPos.copy(homePos);
            armyGroupRef.current.visible = false;
            if (tacticalLineRef.current) tacticalLineRef.current.visible = false;
            onMissionProgressUpdateRef.current?.(
              100,
              'Magar Vanguard safely garrisoned inside citadel.',
              'Garrisoned'
            );
            onArmyReturnHomeRef.current?.();
          }
        }
      }

      // Process Monster Hit Flashes
      for (let i = activeFlashesRef.current.length - 1; i >= 0; i--) {
        const item = activeFlashesRef.current[i];
        item.timer -= delta;
        const progress = Math.max(0, item.timer / item.maxTimer);
        const mats = Array.isArray(item.mesh.material) ? item.mesh.material : [item.mesh.material];
        mats.forEach((m: any) => {
          if (m && m.isMeshStandardMaterial && m.userData._origColor) {
            m.emissiveIntensity = progress * 4.0;
            m.color.lerpColors(m.userData._origColor, new THREE.Color(0xffffff), progress);
          }
        });

        if (item.timer <= 0) {
          mats.forEach((m: any) => {
            if (m && m.isMeshStandardMaterial && m.userData._origColor) {
              m.emissive.copy(m.userData._origEmissive || new THREE.Color(0x000000));
              m.emissiveIntensity = m.userData._origIntensity || 0;
              m.color.copy(m.userData._origColor);
            }
          });
          activeFlashesRef.current.splice(i, 1);
        }
      }

      // Settle monsters back after recoil flinch
      monsterGroupsMapRef.current.forEach((mg) => {
        const monData = mg.userData?.gameData;
        if (monData && !monData.isDefeated) {
          mg.position.x = THREE.MathUtils.damp(mg.position.x, monData.position[0], 12, delta);
          mg.position.y = THREE.MathUtils.damp(mg.position.y, 0, 12, delta);
        }
      });

      // Process Dissolving Monsters into smoke
      for (let i = activeDissolvingRef.current.length - 1; i >= 0; i--) {
        const dm = activeDissolvingRef.current[i];
        dm.progress += delta * 2.8;
        const curScale = Math.max(0, 1 - dm.progress);
        dm.group.scale.setScalar(curScale);
        dm.group.position.y += delta * 0.8;

        if (dm.progress >= 1.0 || curScale <= 0.02) {
          dm.group.visible = false;
          activeDissolvingRef.current.splice(i, 1);
        }
      }

      // Process 3D Smoke Particles
      for (let i = activeSmokeParticlesRef.current.length - 1; i >= 0; i--) {
        const p = activeSmokeParticlesRef.current[i];
        p.life += delta;
        const ratio = p.life / p.maxLife;

        p.velocity.y += delta * 0.6;
        p.velocity.x += delta * 0.35;
        p.mesh.position.addScaledVector(p.velocity, delta);

        p.mesh.rotation.x += p.rotSpeedX * delta;
        p.mesh.rotation.y += p.rotSpeedY * delta;
        p.mesh.rotation.z += p.rotSpeedZ * delta;

        const curScale = THREE.MathUtils.lerp(p.initialScale, p.targetScale, Math.min(1, ratio * 1.35));
        p.mesh.scale.setScalar(curScale);

        const mat = p.mesh.material as THREE.MeshStandardMaterial;
        if (ratio < 0.15) {
          mat.opacity = (ratio / 0.15) * 0.88;
        } else {
          mat.opacity = Math.max(0, (1 - ratio) / 0.85 * 0.88);
        }

        if (ratio >= 1.0) {
          if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
          p.mesh.geometry.dispose();
          mat.dispose();
          activeSmokeParticlesRef.current.splice(i, 1);
        }
      }

      // Process Dynamic Mining Particles
      for (let i = activeMiningParticlesRef.current.length - 1; i >= 0; i--) {
        const p = activeMiningParticlesRef.current[i];
        p.life += delta;
        p.velocity.y -= delta * 12.0;
        p.mesh.position.addScaledVector(p.velocity, delta);
        p.mesh.rotation.x += p.rotSpeed * delta;
        p.mesh.rotation.y += p.rotSpeed * delta;
        p.mesh.scale.multiplyScalar(0.96);

        if (p.life >= p.maxLife || p.mesh.position.y <= 0.05) {
          if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
          p.mesh.geometry.dispose();
          (p.mesh.material as THREE.Material).dispose();
          activeMiningParticlesRef.current.splice(i, 1);
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const asp = w / h;
      camera.left = (-frustumSize * asp) / 2;
      camera.right = (frustumSize * asp) / 2;
      camera.top = frustumSize / 2;
      camera.bottom = -frustumSize / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update world zoom and pan whenever cameraPan or zoom changes
  useEffect(() => {
    if (worldRef.current) {
      worldRef.current.scale.setScalar(zoom);
      worldRef.current.position.set(cameraPan.x, 0, cameraPan.z);
    }
  }, [cameraPan, zoom]);

  // Update selection ring position
  useEffect(() => {
    if (selectionRingRef.current) {
      if (selectedObject) {
        selectionRingRef.current.visible = true;
        selectionRingRef.current.position.set(
          selectedObject.position[0],
          0.04,
          selectedObject.position[2]
        );
      } else {
        selectionRingRef.current.visible = false;
      }
    }
  }, [selectedObject]);

  // Update tactical line
  useEffect(() => {
    if (tacticalLineRef.current && armyGroupRef.current) {
      if (activeTarget && armyState !== 'IDLE') {
        tacticalLineRef.current.visible = true;
        const p1 = armyGroupRef.current.position.clone();
        p1.y = 0.2;
        const p2 = new THREE.Vector3(activeTarget.position[0], 0.2, activeTarget.position[2]);
        tacticalLineRef.current.geometry.setFromPoints([p1, p2]);
      } else {
        tacticalLineRef.current.visible = false;
      }
    }
  }, [activeTarget, armyState]);

  // Handle active army marching orders
  useEffect(() => {
    if (armyState === 'MARCHING' || armyState === 'GATHERING' || armyState === 'ATTACKING') {
      if (activeTarget) {
        armyTargetPosRef.current = new THREE.Vector3(
          activeTarget.position[0],
          0.02,
          activeTarget.position[2]
        );
        hasStruckUponArrivalRef.current = false;
        combatStrikeTimerRef.current = 0;
        gatherTimerRef.current = 0;
        if (armyGroupRef.current) {
          // Troops emerge from Citadel Gate at [390, 0.02, 414]
          armyGroupRef.current.position.copy(armyHomeRef.current);
          armyGroupRef.current.visible = true;
          totalMarchDistanceRef.current = armyGroupRef.current.position.distanceTo(armyTargetPosRef.current);
        }
      }
    } else if (armyState === 'RETURNING') {
      armyTargetPosRef.current = armyHomeRef.current.clone();
      hasStruckUponArrivalRef.current = false;
      combatStrikeTimerRef.current = 0;
      if (armyGroupRef.current) {
        totalMarchDistanceRef.current = armyGroupRef.current.position.distanceTo(armyHomeRef.current);
      }
    } else if (armyState === 'IDLE') {
      armyTargetPosRef.current = null;
      hasStruckUponArrivalRef.current = false;
      combatStrikeTimerRef.current = 0;
      gatherTimerRef.current = 0;
      if (armyGroupRef.current) {
        armyGroupRef.current.visible = false; // Troops stay garrisoned inside Citadel Gate
        armyGroupRef.current.position.copy(armyHomeRef.current);
      }
    }
  }, [armyState, activeTarget]);

  // Drag-to-pan & click-to-select handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...cameraPan };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;

    if (Math.hypot(dx, dy) > 5) {
      isDraggingRef.current = true;
      // Convert screen delta to isometric world delta for 0-800 realm
      const factor = (65 / (containerRef.current?.clientHeight || 600)) * (1 / zoom);
      const newPanX = panStartRef.current.x + dx * factor;
      const newPanZ = panStartRef.current.z + dy * factor;

      // Bound camera panning within 0-800 world limits (with slight margin)
      const clampedX = Math.max(-820, Math.min(20, newPanX));
      const clampedZ = Math.max(-820, Math.min(20, newPanZ));

      onUpdateCamera({ x: clampedX, z: clampedZ }, zoom);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) {
      const container = containerRef.current;
      const camera = cameraRef.current;
      if (!container || !camera) return;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(pickableMeshesRef.current, true);

      if (intersects.length > 0) {
        let hitObj: THREE.Object3D | null = intersects[0].object;
        let gameData: InteractiveObject | null = null;
        while (hitObj) {
          if (hitObj.userData?.gameData) {
            gameData = hitObj.userData.gameData;
            break;
          }
          hitObj = hitObj.parent;
        }

        if (gameData && !gameData.isDefeated) {
          const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          onSelectObject(gameData, screenPos);
          return;
        }
      }

      // Proximity selection fallback: clicking ground near an object
      if (groundRef.current && worldRef.current) {
        const groundHits = raycaster.intersectObject(groundRef.current, false);
        if (groundHits.length > 0) {
          const worldHit = groundHits[0].point;
          const localHit = worldRef.current.worldToLocal(worldHit.clone());

          let closestObj: InteractiveObject | null = null;
          let minDistance = 5.5; // generous threshold for 0-800 world scale

          for (const obj of objectsListRef.current) {
            if (obj.isDefeated) continue;
            const dist = Math.hypot(localHit.x - obj.position[0], localHit.z - obj.position[2]);
            if (dist < minDistance) {
              minDistance = dist;
              closestObj = obj;
            }
          }

          if (closestObj) {
            const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            onSelectObject(closestObj, screenPos);
            return;
          }
        }
      }

      // Clicked ground or empty space
      onSelectObject(null, null);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
    const newZoom = Math.max(0.25, Math.min(2.8, zoom + zoomDelta));
    onUpdateCamera(cameraPan, newZoom);
  };

  return (
    <div
      ref={containerRef}
      id="gameViewport"
      className="game-viewport"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <div className="map-grid"></div>
      <div className="map-vignette"></div>
      <div className="weather-overlay weather-clear"></div>
      <div className="scene-label label-north">
        HIMSHIKHAR GLACIAL RIDGE [Z: 660] <span>▲ ▲ ▲</span>
      </div>
      <div className="scene-label label-east">EASTERN SILK GATEWAY [X: 800]</div>
      <div className="scene-label label-south">SOUTHERN VERDANT DEEPWOOD [Z: 640]</div>
      <div className="scene-label label-west">WESTERN IRONCREST BASTIONS [X: 680]</div>
    </div>
  );
};
