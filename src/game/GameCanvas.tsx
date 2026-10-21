import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { InteractiveObject, ArmyState } from '../types/game';

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

  // Live refs to dynamic props so requestAnimationFrame animate() never has stale closures!
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

  // Internal army state (Assembly Square in front of Citadel Gate)
  const armyPosRef = useRef<THREE.Vector3>(new THREE.Vector3(-10.5, 0.02, 13.5));
  const armyHomeRef = useRef<THREE.Vector3>(new THREE.Vector3(-10.5, 0.02, 13.5));
  const armyTargetPosRef = useRef<THREE.Vector3 | null>(null);

  // Drag & interaction state
  const isDraggingRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#8ba3a1');
    scene.fog = new THREE.Fog('#8ba3a1', 60, 220);
    sceneRef.current = scene;

    // Camera
    const width = container.clientWidth;
    const height = container.clientHeight;
    const aspect = width / height;
    const frustumSize = 52;
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      500
    );
    camera.position.set(44, 52, 44);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Provide snapshot capture function to parent
    getCanvasSnapshotRef(() => {
      if (!renderer || !scene || !camera) return null;
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/jpeg', 0.95);
    });

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xdceeff, 0x354536, 2.0);
    scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xffe2bd, 3.0);
    sun.position.set(-35, 65, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -95;
    sun.shadow.camera.right = 95;
    sun.shadow.camera.top = 95;
    sun.shadow.camera.bottom = -95;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 280;
    scene.add(sun);

    // World root group
    const world = new THREE.Group();
    scene.add(world);
    worldRef.current = world;

    // GLTF cache and loader
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
          // Graceful procedural fallback remains active
        });
    };

    // Helper materials
    const mat = (color: string, roughness = 0.8, metalness = 0.1) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });

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

    // 1. Enhanced Terrain Ground & Biomes
    const groundGeo = new THREE.PlaneGeometry(175, 145, 1, 1);
    const groundMat = mat('#4e6d46', 0.9, 0.05); // Rich alpine meadow green
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    world.add(ground);
    groundRef.current = ground;

    // Northern Glacial Snow Tundra Plateau
    const snowTundraGeo = new THREE.PlaneGeometry(175, 55, 1, 1);
    const snowTundraMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.85,
      metalness: 0.1,
    });
    const snowTundra = new THREE.Mesh(snowTundraGeo, snowTundraMat);
    snowTundra.rotation.x = -Math.PI / 2;
    snowTundra.position.set(0, 0.01, -45);
    snowTundra.receiveShadow = true;
    world.add(snowTundra);

    // Western Iron Ridge Rocky Slopes
    const rockSlopeGeo = new THREE.PlaneGeometry(55, 75, 1, 1);
    const rockSlopeMat = mat('#38424b', 0.85, 0.2);
    const rockSlope = new THREE.Mesh(rockSlopeGeo, rockSlopeMat);
    rockSlope.rotation.x = -Math.PI / 2;
    rockSlope.position.set(-52, 0.008, 0);
    rockSlope.receiveShadow = true;
    world.add(rockSlope);

    // Southern Terraced Loam
    const terraceLoamGeo = new THREE.PlaneGeometry(65, 45, 1, 1);
    const terraceLoamMat = mat('#63482d', 0.92, 0.05);
    const terraceLoam = new THREE.Mesh(terraceLoamGeo, terraceLoamMat);
    terraceLoam.rotation.x = -Math.PI / 2;
    terraceLoam.position.set(22, 0.008, 26);
    terraceLoam.receiveShadow = true;
    world.add(terraceLoam);

    // Enhanced Crystalline River with Specular Water & Foam
    const riverGeo = new THREE.PlaneGeometry(160, 8.5, 1, 1);
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.15,
      metalness: 0.45,
      transparent: true,
      opacity: 0.88,
    });
    const river = new THREE.Mesh(riverGeo, riverMat);
    river.rotation.x = -Math.PI / 2;
    river.rotation.z = 0.22;
    river.position.set(2, 0.02, -6);
    river.receiveShadow = true;
    world.add(river);

    // River Foam Edges
    const foamMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.4,
      transparent: true,
      opacity: 0.65,
    });
    const foam1 = new THREE.Mesh(new THREE.PlaneGeometry(160, 0.8), foamMat);
    foam1.rotation.x = -Math.PI / 2;
    foam1.rotation.z = 0.22;
    foam1.position.set(2 + Math.cos(0.22 + Math.PI / 2) * 3.8, 0.022, -6 + Math.sin(0.22 + Math.PI / 2) * 3.8);
    world.add(foam1);

    const foam2 = new THREE.Mesh(new THREE.PlaneGeometry(160, 0.8), foamMat);
    foam2.rotation.x = -Math.PI / 2;
    foam2.rotation.z = 0.22;
    foam2.position.set(2 - Math.cos(0.22 + Math.PI / 2) * 3.8, 0.022, -6 - Math.sin(0.22 + Math.PI / 2) * 3.8);
    world.add(foam2);

    // Scattered Himalayan Wildflowers & Grass Tufts
    const flowerBlueMat = mat('#38bdf8', 0.7, 0.1); // Himalayan gentians
    const flowerGoldMat = mat('#fbbf24', 0.7, 0.1); // Alpine poppies
    const flowerWhiteMat = mat('#ffffff', 0.8, 0.05); // Edelweiss
    for (let i = 0; i < 90; i++) {
      const fx = (Math.random() - 0.5) * 130;
      const fz = (Math.random() - 0.5) * 100;
      if (Math.hypot(fx - (-14), fz - 10) < 10) continue;
      if (Math.abs(fz - 0.22 * fx + 6) < 5.5) continue; // avoid river

      const fColor = i % 3 === 0 ? flowerBlueMat : i % 3 === 1 ? flowerGoldMat : flowerWhiteMat;
      const flower = addMesh(
        world,
        new THREE.DodecahedronGeometry(0.12 + Math.random() * 0.08, 0),
        fColor,
        fx,
        0.1,
        fz,
        false
      );
      flower.rotation.y = Math.random() * Math.PI;
    }

    // Perimeter Himalayan peaks
    for (let i = 0; i < 44; i++) {
      const angle = (i / 44) * Math.PI * 2;
      const dist = 72 + Math.random() * 12;
      const px = Math.cos(angle) * (dist * 1.15);
      const pz = Math.sin(angle) * dist;
      const peak = addMesh(
        world,
        new THREE.ConeGeometry(4.5 + Math.random() * 3.2, 8 + Math.random() * 6, 7),
        mat('#64756e'),
        px,
        3.5,
        pz,
        false
      );
      peak.rotation.y = Math.random() * Math.PI;
      if (i % 2 === 0 || pz < -20) {
        addMesh(world, new THREE.ConeGeometry(2.4, 3.8, 7), mat('#f0f3ed'), px, 6.2, pz + 0.15, false);
      }
    }

    // Pine Trees
    for (let i = 0; i < 110; i++) {
      const tx = (Math.random() - 0.5) * 140;
      const tz = (Math.random() - 0.5) * 110;
      if (Math.hypot(tx - (-14), tz - 10) < 12) continue; // avoid citadel
      if (Math.abs(tz - 0.22 * tx + 6) < 6) continue; // avoid river

      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);
      const trunk = addMesh(tree, new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6), mat('#5c432d'), 0, 0.6, 0);
      for (let c = 0; c < 3; c++) {
        addMesh(tree, new THREE.ConeGeometry(0.9 - c * 0.15, 1.2, 6), mat('#2f593b'), 0, 1.4 + c * 0.6, 0);
      }
      applyGLB(tree, 'himalayan_pine.glb', 0.85);
      world.add(tree);
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

      // Add generous invisible hit cylinder collider so clicking on or near any monster/building/resource reliably hits
      const hitRadius = data.type === 'monster' ? 3.0 : data.type === 'resource' ? 2.8 : 3.4;
      const hitGeo = new THREE.CylinderGeometry(hitRadius, hitRadius, 4.5, 8);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 });
      const hitCollider = new THREE.Mesh(hitGeo, hitMat);
      hitCollider.position.set(0, 2.25, 0);
      hitCollider.userData.gameData = data;
      group.add(hitCollider);

      allObjects.push(data);
      pickables.push(group);
      world.add(group);
    };

    // 2. Kingdom Structures
    // Citadel Keep
    const castleGroup = new THREE.Group();
    castleGroup.position.set(-14, 0, 10);
    addMesh(castleGroup, new THREE.BoxGeometry(4.2, 2.5, 4.2), mat('#6c7675'), 0, 1.25, 0);
    addMesh(castleGroup, new THREE.ConeGeometry(3.2, 1.8, 4), mat('#8c3228'), 0, 3.3, 0).rotation.y =
      Math.PI / 4;
    applyGLB(castleGroup, 'gorkha_hillfort.glb', 1.2);
    registerInteractive(castleGroup, {
      id: 'citadel-keep',
      name: 'Gorkha Citadel Keep',
      type: 'citadel',
      subtype: 'citadel',
      level: 18,
      position: [-14, 0, 10],
      health: 1500,
      maxHealth: 1500,
      description: 'Supreme fortified royal keep, army garrison, and central treasury.',
    });

    // Barracks
    const barracksGroup = new THREE.Group();
    barracksGroup.position.set(-7, 0, 13);
    addMesh(barracksGroup, new THREE.BoxGeometry(2.8, 1.6, 2.0), mat('#606b6a'), 0, 0.8, 0);
    addMesh(barracksGroup, new THREE.ConeGeometry(2.0, 1.0, 4), mat('#85352c'), 0, 2.0, 0).rotation.y =
      Math.PI / 4;
    registerInteractive(barracksGroup, {
      id: 'bldg-barracks',
      name: 'Royal Vanguard Barracks',
      type: 'fort',
      subtype: 'citadel',
      level: 8,
      position: [-7, 0, 13],
      health: 750,
      description: 'Martial quarters where Magar Infantry, Cavalry, and Archers train.',
    });

    // Stables
    const stablesGroup = new THREE.Group();
    stablesGroup.position.set(-2, 0, 18);
    addMesh(stablesGroup, new THREE.BoxGeometry(3.2, 1.4, 1.6), mat('#5e4835'), 0, 0.7, 0);
    registerInteractive(stablesGroup, {
      id: 'bldg-stables',
      name: 'Highland Cavalry Stables',
      type: 'fort',
      subtype: 'citadel',
      level: 7,
      position: [-2, 0, 18],
      health: 680,
      description: 'Breeding paddocks for mountain steeds.',
    });

    // Watchtower North (Tower Building)
    const towerNorth = new THREE.Group();
    towerNorth.position.set(-4, 0, -32);
    addMesh(towerNorth, new THREE.CylinderGeometry(0.7, 0.95, 4.0, 8), mat('#6c7675'), 0, 2.0, 0);
    addMesh(towerNorth, new THREE.ConeGeometry(1.25, 0.9, 8), mat('#8c3228'), 0, 4.4, 0);
    // Archer battlement walkway
    addMesh(towerNorth, new THREE.CylinderGeometry(1.15, 1.15, 0.35, 8), mat('#4b5563'), 0, 3.8, 0);
    registerInteractive(towerNorth, {
      id: 'bldg-tower-north',
      name: 'North Glacier Watchtower',
      type: 'fort',
      subtype: 'tower',
      level: 12,
      position: [-4, 0, -32],
      health: 900,
      maxHealth: 900,
      description: 'High sentinel stone tower watching northern glacial passes. Defended by heavy archer garrisons.',
    });

    // Ironcrest Sentinel Tower (Tower Building)
    const towerIroncrest = new THREE.Group();
    towerIroncrest.position.set(-36, 0, -8);
    // Multi-tier stone bastion
    addMesh(towerIroncrest, new THREE.BoxGeometry(3.6, 2.2, 3.6), mat('#475569'), 0, 1.1, 0);
    addMesh(towerIroncrest, new THREE.CylinderGeometry(1.2, 1.5, 4.2, 8), mat('#64748b'), 0, 3.2, 0);
    addMesh(towerIroncrest, new THREE.CylinderGeometry(1.6, 1.6, 0.45, 8), mat('#334155'), 0, 5.1, 0);
    addMesh(towerIroncrest, new THREE.ConeGeometry(1.5, 1.4, 8), mat('#991b1b'), 0, 6.0, 0);
    // Signal brazier at top
    const brazierMat = new THREE.MeshStandardMaterial({ color: 0xff7700, emissive: 0xff4400, emissiveIntensity: 2.5 });
    addMesh(towerIroncrest, new THREE.SphereGeometry(0.35, 8, 8), brazierMat, 0, 6.7, 0);
    registerInteractive(towerIroncrest, {
      id: 'bldg-tower-ironcrest',
      name: 'Ironcrest Sentinel Tower',
      type: 'fort',
      subtype: 'tower',
      level: 15,
      position: [-36, 0, -8],
      health: 1200,
      maxHealth: 1200,
      description: 'Formidable western frontier tower building commanding mineral passes. High-priority Alliance Rally objective.',
    });

    // 3. Resource Nodes (Levels 1 - 5 for Wood, Farm, Gold, Stone Crystal)
    const resourceNodesData: InteractiveObject[] = [
      // Wood (Levels 1 - 5)
      {
        id: 'r_w1',
        name: 'Pine Sapling Grove',
        type: 'resource',
        subtype: 'wood',
        level: 1,
        position: [-10, 0, 18],
        yieldAmount: 250,
        resourceType: 'wood',
        description: 'Young Himalayan pine saplings easy for novices to harvest.',
      },
      {
        id: 'r_w2',
        name: 'Alpine Timber Stand',
        type: 'resource',
        subtype: 'wood',
        level: 2,
        position: [4, 0, 14],
        yieldAmount: 450,
        resourceType: 'wood',
        description: 'Sturdy mountain pines yielding reliable structural timber.',
      },
      {
        id: 'r_w3',
        name: 'Ancient Pine Forest',
        type: 'resource',
        subtype: 'wood',
        level: 3,
        position: [-22, 0, -14],
        yieldAmount: 750,
        resourceType: 'wood',
        description: 'Old-growth Himalayan timber prime for citadel architecture.',
      },
      {
        id: 'r_w4',
        name: 'Old-Growth Cedar Woods',
        type: 'resource',
        subtype: 'wood',
        level: 4,
        position: [20, 0, -16],
        yieldAmount: 1100,
        resourceType: 'wood',
        description: 'Dense fragrant cedar logs prized for royal gate fortifications.',
      },
      {
        id: 'r_w5',
        name: 'Royal Ironwood Bastion',
        type: 'resource',
        subtype: 'wood',
        level: 5,
        position: [28, 0, 24],
        yieldAmount: 1600,
        resourceType: 'wood',
        description: 'Legendary iron-hard Himalayan timbers forged in mountain blizzards.',
      },

      // Farm (Levels 1 - 5)
      {
        id: 'r_f1',
        name: 'Terrace Barley Field',
        type: 'resource',
        subtype: 'farm',
        level: 1,
        position: [-6, 0, 14],
        yieldAmount: 300,
        resourceType: 'food',
        description: 'Sunny hillside terrace producing golden highland barley.',
      },
      {
        id: 'r_f2',
        name: 'Highland Wheat Meadow',
        type: 'resource',
        subtype: 'farm',
        level: 2,
        position: [8, 0, 8],
        yieldAmount: 500,
        resourceType: 'food',
        description: 'Irrigated terrace meadow teeming with nutritious grain stalks.',
      },
      {
        id: 'r_f3',
        name: 'Mountain Granary Terrace',
        type: 'resource',
        subtype: 'farm',
        level: 3,
        position: [-18, 0, 22],
        yieldAmount: 800,
        resourceType: 'food',
        description: 'Stacked hillside terraces supplying citadel garrisons with food.',
      },
      {
        id: 'r_f4',
        name: 'Golden Paddy Basin',
        type: 'resource',
        subtype: 'farm',
        level: 4,
        position: [16, 0, 26],
        yieldAmount: 1250,
        resourceType: 'food',
        description: 'Vast fertile basin producing abundant highland rice and grains.',
      },
      {
        id: 'r_f5',
        name: 'Imperial Harvest Domain',
        type: 'resource',
        subtype: 'farm',
        level: 5,
        position: [-28, 0, 28],
        yieldAmount: 1800,
        resourceType: 'food',
        description: 'Crown agricultural terraces providing banquet feasts for the kingdom.',
      },

      // Gold (Levels 1 - 5)
      {
        id: 'r_g1',
        name: 'Glimmering Gold Silt',
        type: 'resource',
        subtype: 'gold',
        level: 1,
        position: [-8, 0, -4],
        yieldAmount: 180,
        resourceType: 'food',
        description: 'Alluvial gold flecks shining in shallow mountain creek waters.',
      },
      {
        id: 'r_g2',
        name: 'Stream Gold Deposits',
        type: 'resource',
        subtype: 'gold',
        level: 2,
        position: [12, 0, -6],
        yieldAmount: 320,
        resourceType: 'food',
        description: 'Porous riverbed pebbles rich in raw golden nuggets.',
      },
      {
        id: 'r_g3',
        name: 'Gilded Quartz Quarry',
        type: 'resource',
        subtype: 'gold',
        level: 3,
        position: [-30, 0, -10],
        yieldAmount: 550,
        resourceType: 'food',
        description: 'Exposed quartz veins gleaming with rich veins of yellow gold.',
      },
      {
        id: 'r_g4',
        name: 'Deep Auric Lode',
        type: 'resource',
        subtype: 'gold',
        level: 4,
        position: [24, 0, 22],
        yieldAmount: 900,
        resourceType: 'food',
        description: 'Deep subterranean gold vein for royal treasury and temple gilding.',
      },
      {
        id: 'r_g5',
        name: 'Sacred Sun-Gold Cavern',
        type: 'resource',
        subtype: 'gold',
        level: 5,
        position: [-36, 0, -26],
        yieldAmount: 1500,
        resourceType: 'food',
        description: 'Ancient cavern glowing with pure auric crystals and priceless ore.',
      },

      // Stone Crystal (Levels 1 - 5)
      {
        id: 'r_c1',
        name: 'Slate Crystal Shards',
        type: 'resource',
        subtype: 'stonecrystal',
        level: 1,
        position: [-18, 0, 2],
        yieldAmount: 260,
        resourceType: 'stone',
        description: 'Brittle crystal clusters embedded in dark slate stone.',
      },
      {
        id: 'r_c2',
        name: 'Amethyst Geode Quarry',
        type: 'resource',
        subtype: 'stonecrystal',
        level: 2,
        position: [16, 0, 4],
        yieldAmount: 480,
        resourceType: 'stone',
        description: 'Open pit quarry sparkling with purple and cyan quartz geodes.',
      },
      {
        id: 'r_c3',
        name: 'Prismatic Granite Cavern',
        type: 'resource',
        subtype: 'stonecrystal',
        level: 3,
        position: [-14, 0, -20],
        yieldAmount: 780,
        resourceType: 'stone',
        description: 'Granite cavern encrusted with prismatic gemstone formations.',
      },
      {
        id: 'r_c4',
        name: 'Azure Crystal Bastion',
        type: 'resource',
        subtype: 'stonecrystal',
        level: 4,
        position: [26, 0, -10],
        yieldAmount: 1150,
        resourceType: 'stone',
        description: 'Luminous cyan crystal pillars radiating mountain earth energy.',
      },
      {
        id: 'r_c5',
        name: 'Royal Arcane Crystal Spire',
        type: 'resource',
        subtype: 'stonecrystal',
        level: 5,
        position: [-42, 0, 12],
        yieldAmount: 1750,
        resourceType: 'stone',
        description: 'Colossal glowing crystal cluster used for castle wardstones.',
      },
    ];

    resourceNodesData.forEach((resData) => {
      const rg = new THREE.Group();
      rg.position.set(resData.position[0], 0, resData.position[2]);

      if (resData.subtype === 'wood') {
        // Wood Lumber Grove
        const trunkMat = mat('#5d422e');
        const leafMat = mat('#285c3b');
        addMesh(rg, new THREE.CylinderGeometry(0.2, 0.3, 1.8, 7), trunkMat, 0, 0.9, 0);
        for (let i = 0; i < 3; i++) {
          addMesh(rg, new THREE.ConeGeometry(0.95 - i * 0.16, 1.3, 7), leafMat, 0, 1.6 + i * 0.55, 0);
        }
        // Small timber logs on ground
        addMesh(rg, new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6), trunkMat, 0.6, 0.1, 0.4).rotation.z = Math.PI / 2;
        addMesh(rg, new THREE.CylinderGeometry(0.12, 0.12, 0.8, 6), trunkMat, 0.5, 0.22, 0.45).rotation.z = Math.PI / 2;
      } else if (resData.subtype === 'farm') {
        // Farm terrace with soil base, fence and wheat sheaves
        const soilMat = mat('#78522c');
        const wheatMat = mat('#eab308', 0.8, 0.1);
        const fenceMat = mat('#523824');

        // Soil plot
        addMesh(rg, new THREE.BoxGeometry(2.4, 0.16, 2.2), soilMat, 0, 0.08, 0);

        // Wheat stalks / Haystacks
        addMesh(rg, new THREE.CylinderGeometry(0.35, 0.55, 0.9, 8), wheatMat, -0.4, 0.55, -0.3);
        addMesh(rg, new THREE.CylinderGeometry(0.3, 0.45, 0.8, 8), wheatMat, 0.5, 0.5, 0.3);
        addMesh(rg, new THREE.ConeGeometry(0.4, 0.5, 8), wheatMat, -0.4, 1.15, -0.3);
        addMesh(rg, new THREE.ConeGeometry(0.35, 0.45, 8), wheatMat, 0.5, 1.05, 0.3);

        // Fence posts
        for (let i = -1; i <= 1; i += 2) {
          addMesh(rg, new THREE.CylinderGeometry(0.04, 0.04, 0.5, 5), fenceMat, i * 1.05, 0.3, -0.9);
          addMesh(rg, new THREE.CylinderGeometry(0.04, 0.04, 0.5, 5), fenceMat, i * 1.05, 0.3, 0.9);
        }
      } else if (resData.subtype === 'gold') {
        // Gold Vein cluster with golden facets
        const rockMat = mat('#52575c', 0.7, 0.2);
        const goldMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          roughness: 0.22,
          metalness: 0.88,
          emissive: 0xd97706,
          emissiveIntensity: 0.2,
        });

        // Rock base
        addMesh(rg, new THREE.DodecahedronGeometry(0.7, 0), rockMat, 0, 0.45, 0);
        // Gold nuggets
        for (let i = 0; i < 4; i++) {
          const goldNugget = new THREE.Mesh(new THREE.OctahedronGeometry(0.35 + i * 0.06), goldMat);
          goldNugget.position.set((i - 1.5) * 0.38, 0.6 + (i % 2) * 0.2, (Math.random() - 0.5) * 0.5);
          goldNugget.rotation.set(i * 0.4, i * 0.7, 0);
          rg.add(goldNugget);
        }
      } else {
        // Stone Crystal Prismatic cluster (cyan and amethyst crystals)
        const slateMat = mat('#334155', 0.8, 0.1);
        const crystalCyanMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          roughness: 0.15,
          metalness: 0.3,
          emissive: 0x0284c7,
          emissiveIntensity: 0.55,
          transparent: true,
          opacity: 0.92,
        });
        const crystalPurpleMat = new THREE.MeshStandardMaterial({
          color: 0xc084fc,
          roughness: 0.15,
          metalness: 0.3,
          emissive: 0x7e22ce,
          emissiveIntensity: 0.55,
          transparent: true,
          opacity: 0.92,
        });

        // Rock base
        addMesh(rg, new THREE.DodecahedronGeometry(0.75, 0), slateMat, 0, 0.4, 0);

        // Prismatic crystal spires
        for (let i = 0; i < 5; i++) {
          const cGeo = new THREE.ConeGeometry(0.18 + (i % 2) * 0.08, 0.9 + i * 0.15, 5);
          const cMat = i % 2 === 0 ? crystalCyanMat : crystalPurpleMat;
          const cMesh = new THREE.Mesh(cGeo, cMat);
          cMesh.position.set((i - 2) * 0.3, 0.55 + (i % 2) * 0.2, (Math.random() - 0.5) * 0.4);
          cMesh.rotation.set((Math.random() - 0.5) * 0.4, i * 0.6, (Math.random() - 0.5) * 0.4);
          rg.add(cMesh);
        }
      }

      registerInteractive(rg, resData);
    });

    // 4. Monsters (Levels 1 - 5 for Bear, Rabbit, Wolf, and Tree Monster)
    const monstersData: InteractiveObject[] = [
      // Bear (Levels 1 - 5)
      {
        id: 'm_b1',
        name: 'Himalayan Cub',
        type: 'monster',
        subtype: 'bear',
        level: 1,
        position: [-4, 0, 4],
        health: 60,
        power: 120,
        description: 'Young mountain bear foraging along valley brook banks.',
      },
      {
        id: 'm_b2',
        name: 'Mountain Brown Bear',
        type: 'monster',
        subtype: 'bear',
        level: 2,
        position: [14, 0, -4],
        health: 90,
        power: 210,
        description: 'Sturdy highland bear defending its pine territory.',
      },
      {
        id: 'm_b3',
        name: 'Highland Grizzled Bear',
        type: 'monster',
        subtype: 'bear',
        level: 3,
        position: [-26, 0, 16],
        health: 140,
        power: 360,
        description: 'Aggressive clawed beast guarding western mineral ridges.',
      },
      {
        id: 'm_b4',
        name: 'Glacial Frost Bear',
        type: 'monster',
        subtype: 'bear',
        level: 4,
        position: [22, 0, -22],
        health: 200,
        power: 540,
        description: 'Heavily armored white fur bear adapted to sub-zero blizzards.',
      },
      {
        id: 'm_b5',
        name: 'Apex Ancient Snow Bear',
        type: 'monster',
        subtype: 'bear',
        level: 5,
        position: [-12, 0, -36],
        health: 280,
        power: 750,
        description: 'Legendary mountain apex predator commanding northern glacier passes.',
      },

      // Rabbit (Levels 1 - 5)
      {
        id: 'm_r1',
        name: 'Alpine Meadow Hare',
        type: 'monster',
        subtype: 'rabbit',
        level: 1,
        position: [-8, 0, 6],
        health: 40,
        power: 80,
        description: 'Nimble mountain rabbit darting across terrace steps.',
      },
      {
        id: 'm_r2',
        name: 'Horned Mountain Rabbit',
        type: 'monster',
        subtype: 'rabbit',
        level: 2,
        position: [-4, 0, 8],
        health: 60,
        power: 140,
        description: 'Fast jumping rabbit equipped with defensive horn spikes.',
      },
      {
        id: 'm_r3',
        name: 'Swift Snow Hare',
        type: 'monster',
        subtype: 'rabbit',
        level: 3,
        position: [6, 0, 18],
        health: 85,
        power: 220,
        description: 'Evasive winter hare running across deep snowdrifts.',
      },
      {
        id: 'm_r4',
        name: 'Agile Highland Jackrabbit',
        type: 'monster',
        subtype: 'rabbit',
        level: 4,
        position: [-20, 0, -8],
        health: 120,
        power: 330,
        description: 'Hyper-agile jackrabbit capable of dodging arrows.',
      },
      {
        id: 'm_r5',
        name: 'Mystic Moon-Hare',
        type: 'monster',
        subtype: 'rabbit',
        level: 5,
        position: [30, 0, 10],
        health: 160,
        power: 480,
        description: 'Rare enchanted beast moving with lightning speed.',
      },

      // Wolf (Levels 1 - 5)
      {
        id: 'm_w1',
        name: 'Lone Timber Wolf',
        type: 'monster',
        subtype: 'wolf',
        level: 1,
        position: [-2, 0, -8],
        health: 55,
        power: 110,
        description: 'Sleek predatory wolf stalking the valley outskirts.',
      },
      {
        id: 'm_w2',
        name: 'Steppe Pack Wolf',
        type: 'monster',
        subtype: 'wolf',
        level: 2,
        position: [10, 0, 16],
        health: 85,
        power: 200,
        description: 'Vicious pack hunter hunting in highland meadows.',
      },
      {
        id: 'm_w3',
        name: 'Highland Grey Wolf',
        type: 'monster',
        subtype: 'wolf',
        level: 3,
        position: [-32, 0, 8],
        health: 130,
        power: 340,
        description: 'Battle-hardened grey wolf with razor-sharp mountain fangs.',
      },
      {
        id: 'm_w4',
        name: 'Blight Fang Wolf',
        type: 'monster',
        subtype: 'wolf',
        level: 4,
        position: [18, 0, -28],
        health: 180,
        power: 510,
        description: 'Fierce winter wolf with frost-bitten jaws and cunning instincts.',
      },
      {
        id: 'm_w5',
        name: 'Alpha Dire Frost Wolf',
        type: 'monster',
        subtype: 'wolf',
        level: 5,
        position: [-40, 0, -18],
        health: 260,
        power: 720,
        description: 'Monstrous alpha dire wolf leading northern mountain packs.',
      },

      // Tree Monster (Levels 1 - 5)
      {
        id: 'm_t1',
        name: 'Sprout Treant',
        type: 'monster',
        subtype: 'treemonster',
        level: 1,
        position: [4, 0, -6],
        health: 65,
        power: 125,
        description: 'Awakened young pine sapling swinging wooden limbs.',
      },
      {
        id: 'm_t2',
        name: 'Mossy Bark Guardian',
        type: 'monster',
        subtype: 'treemonster',
        level: 2,
        position: [-16, 0, -12],
        health: 100,
        power: 230,
        description: 'Moss-covered walking tree defending woodland paths.',
      },
      {
        id: 'm_t3',
        name: 'Ancient Pine Treant',
        type: 'monster',
        subtype: 'treemonster',
        level: 3,
        position: [28, 0, 4],
        health: 155,
        power: 380,
        description: 'Centuries-old animated pine tree with sweeping branch attacks.',
      },
      {
        id: 'm_t4',
        name: 'Elder Forest Behemoth',
        type: 'monster',
        subtype: 'treemonster',
        level: 4,
        position: [-24, 0, 26],
        health: 220,
        power: 560,
        description: 'Massive towering tree guardian with thick bark plating.',
      },
      {
        id: 'm_t5',
        name: 'Primeval World-Tree Monster',
        type: 'monster',
        subtype: 'treemonster',
        level: 5,
        position: [34, 0, 28],
        health: 310,
        power: 820,
        description: 'Colossal primeval arbor colossus glowing with ancient forest wrath.',
      },

      // Yeti (Levels 1 - 5 in northern glaciers)
      {
        id: 'm_y1',
        name: 'Glacier Snow Ape',
        type: 'monster',
        subtype: 'yeti',
        level: 1,
        position: [2, 0, -26],
        health: 80,
        power: 150,
        description: 'Nimble mountain snow ape foraging in northern glacial moraines.',
      },
      {
        id: 'm_y2',
        name: 'Frost Peak Yeti',
        type: 'monster',
        subtype: 'yeti',
        level: 2,
        position: [-8, 0, -38],
        health: 140,
        power: 280,
        description: 'Territorial frost yeti defending high-altitude snow valley passes.',
      },
      {
        id: 'm_y3',
        name: 'Highland Glacier Yeti',
        type: 'monster',
        subtype: 'yeti',
        level: 3,
        position: [12, 0, -42],
        health: 260,
        power: 520,
        description: 'Massive white-furred brute hurling glacial ice boulders. Rally recommended.',
      },
      {
        id: 'm_y4',
        name: 'Dreadfrost Mountain Yeti',
        type: 'monster',
        subtype: 'yeti',
        level: 4,
        position: [-16, 0, -44],
        health: 480,
        power: 950,
        description: 'Heavily armored dreadfrost yeti equipped with frozen horn spikes. High-level raid boss.',
      },
      {
        id: 'm_y5',
        name: 'Ancient Abominable Yeti King',
        type: 'monster',
        subtype: 'yeti',
        level: 5,
        position: [0, 0, -48],
        health: 950,
        power: 1800,
        description: 'Legendary Abominable Yeti King ruling northern glaciers! Supreme World Boss requiring an Alliance Rally!',
      },
    ];

    monstersData.forEach((monData) => {
      monData.maxHealth = monData.health;
      const mg = new THREE.Group();
      mg.position.set(monData.position[0], 0, monData.position[2]);
      const lvlScale = 0.8 + monData.level * 0.12;

      if (monData.subtype === 'bear') {
        // Bear 3D Model
        const furColor = monData.level >= 4 ? '#e2e8f0' : '#78350f';
        const fur = mat(furColor, 0.8, 0.1);
        const body = addMesh(mg, new THREE.SphereGeometry(0.7 * lvlScale, 12, 10), fur, 0, 0.85 * lvlScale, 0);
        body.scale.set(1.1, 0.85, 1.3);
        // Head & snout
        addMesh(mg, new THREE.SphereGeometry(0.42 * lvlScale, 10, 8), fur, 0, 1.25 * lvlScale, 0.55 * lvlScale);
        addMesh(mg, new THREE.BoxGeometry(0.3 * lvlScale, 0.22 * lvlScale, 0.3 * lvlScale), mat('#451a03'), 0, 1.15 * lvlScale, 0.85 * lvlScale);
        // Ears
        addMesh(mg, new THREE.SphereGeometry(0.14 * lvlScale, 6, 6), fur, -0.28 * lvlScale, 1.55 * lvlScale, 0.5 * lvlScale);
        addMesh(mg, new THREE.SphereGeometry(0.14 * lvlScale, 6, 6), fur, 0.28 * lvlScale, 1.55 * lvlScale, 0.5 * lvlScale);
        // Legs
        for (let x = -1; x <= 1; x += 2) {
          for (let z = -1; z <= 1; z += 2) {
            addMesh(mg, new THREE.CylinderGeometry(0.14 * lvlScale, 0.18 * lvlScale, 0.6 * lvlScale, 6), fur, x * 0.45 * lvlScale, 0.3 * lvlScale, z * 0.45 * lvlScale);
          }
        }
      } else if (monData.subtype === 'rabbit') {
        // Rabbit 3D Model
        const fur = mat(monData.level === 5 ? '#fef08a' : '#f1f5f9', 0.9, 0.05);
        const innerEar = mat('#f472b6', 0.8, 0.1);
        const rScale = lvlScale * 0.85;

        // Body & head
        addMesh(mg, new THREE.SphereGeometry(0.38 * rScale, 10, 8), fur, 0, 0.45 * rScale, 0);
        addMesh(mg, new THREE.SphereGeometry(0.26 * rScale, 8, 8), fur, 0, 0.75 * rScale, 0.25 * rScale);
        // Upright tall ears
        for (let i = -1; i <= 1; i += 2) {
          const ear = addMesh(mg, new THREE.ConeGeometry(0.09 * rScale, 0.55 * rScale, 6), fur, i * 0.14 * rScale, 1.18 * rScale, 0.22 * rScale);
          ear.rotation.z = i * -0.15;
          ear.rotation.x = -0.1;
        }
        // Fluffy tail
        addMesh(mg, new THREE.SphereGeometry(0.12 * rScale, 6, 6), fur, 0, 0.42 * rScale, -0.36 * rScale);
      } else if (monData.subtype === 'wolf') {
        // Wolf 3D Model
        const wolfCoat = mat(monData.level >= 4 ? '#64748b' : '#334155', 0.75, 0.2);
        const wScale = lvlScale * 0.92;

        // Torso
        const torso = addMesh(mg, new THREE.BoxGeometry(0.55 * wScale, 0.55 * wScale, 1.25 * wScale), wolfCoat, 0, 0.8 * wScale, 0);
        torso.rotation.x = 0.05;
        // Head & Muzzle
        addMesh(mg, new THREE.BoxGeometry(0.38 * wScale, 0.38 * wScale, 0.45 * wScale), wolfCoat, 0, 1.15 * wScale, 0.65 * wScale);
        addMesh(mg, new THREE.BoxGeometry(0.24 * wScale, 0.18 * wScale, 0.35 * wScale), mat('#1e293b'), 0, 1.05 * wScale, 0.95 * wScale);
        // Pointed Ears
        for (let i = -1; i <= 1; i += 2) {
          const wEar = addMesh(mg, new THREE.ConeGeometry(0.09 * wScale, 0.26 * wScale, 4), wolfCoat, i * 0.16 * wScale, 1.45 * wScale, 0.6 * wScale);
          wEar.rotation.z = i * -0.2;
        }
        // Lupine tail
        const tail = addMesh(mg, new THREE.CylinderGeometry(0.08 * wScale, 0.05 * wScale, 0.75 * wScale, 6), wolfCoat, 0, 0.7 * wScale, -0.85 * wScale);
        tail.rotation.x = -0.65;
        // 4 Running Legs
        for (let x = -1; x <= 1; x += 2) {
          for (let z = -1; z <= 1; z += 2) {
            addMesh(mg, new THREE.CylinderGeometry(0.08 * wScale, 0.07 * wScale, 0.7 * wScale, 5), wolfCoat, x * 0.25 * wScale, 0.35 * wScale, z * 0.45 * wScale);
          }
        }
      } else if (monData.subtype === 'yeti') {
        // Yeti 3D Model (Himalayan White-Furred Frost Ape with Glacial Horns)
        const yetiFur = mat(monData.level >= 4 ? '#e2e8f0' : '#f8fafc', 0.9, 0.05);
        const yetiSkin = mat('#64748b', 0.7, 0.1);
        const iceHornMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 1.4,
          roughness: 0.2,
          metalness: 0.4,
        });
        const iceEyeMat = new THREE.MeshStandardMaterial({
          color: 0x00ffff,
          emissive: 0x38bdf8,
          emissiveIntensity: 3.5,
        });
        const yBase = lvlScale * 1.15;

        // Muscular ape torso
        const yTorso = addMesh(mg, new THREE.BoxGeometry(0.9 * yBase, 1.0 * yBase, 0.75 * yBase), yetiFur, 0, 0.95 * yBase, 0);
        yTorso.rotation.x = 0.1;
        // Chest plate
        addMesh(mg, new THREE.BoxGeometry(0.7 * yBase, 0.65 * yBase, 0.25 * yBase), yetiSkin, 0, 1.05 * yBase, 0.35 * yBase);

        // Ape head
        addMesh(mg, new THREE.BoxGeometry(0.55 * yBase, 0.5 * yBase, 0.5 * yBase), yetiFur, 0, 1.6 * yBase, 0.15 * yBase);
        addMesh(mg, new THREE.BoxGeometry(0.4 * yBase, 0.3 * yBase, 0.25 * yBase), yetiSkin, 0, 1.48 * yBase, 0.38 * yBase);

        // Glacial Ice Horns
        const hornL = addMesh(mg, new THREE.ConeGeometry(0.12 * yBase, 0.5 * yBase, 5), iceHornMat, -0.28 * yBase, 1.95 * yBase, 0.1 * yBase);
        hornL.rotation.z = -0.4;
        const hornR = addMesh(mg, new THREE.ConeGeometry(0.12 * yBase, 0.5 * yBase, 5), iceHornMat, 0.28 * yBase, 1.95 * yBase, 0.1 * yBase);
        hornR.rotation.z = 0.4;

        // Glowing Blue Eyes
        addMesh(mg, new THREE.SphereGeometry(0.06 * yBase, 6, 6), iceEyeMat, -0.14 * yBase, 1.62 * yBase, 0.38 * yBase);
        addMesh(mg, new THREE.SphereGeometry(0.06 * yBase, 6, 6), iceEyeMat, 0.14 * yBase, 1.62 * yBase, 0.38 * yBase);

        // Powerful Gorilla-like Arms with Ice Claws
        const armL = addMesh(mg, new THREE.CylinderGeometry(0.18 * yBase, 0.22 * yBase, 1.1 * yBase, 6), yetiFur, -0.65 * yBase, 1.0 * yBase, 0.1 * yBase);
        armL.rotation.z = 0.25;
        armL.rotation.x = -0.2;
        addMesh(mg, new THREE.BoxGeometry(0.25 * yBase, 0.25 * yBase, 0.25 * yBase), iceHornMat, -0.72 * yBase, 0.45 * yBase, 0.2 * yBase);

        const armR = addMesh(mg, new THREE.CylinderGeometry(0.18 * yBase, 0.22 * yBase, 1.1 * yBase, 6), yetiFur, 0.65 * yBase, 1.0 * yBase, 0.1 * yBase);
        armR.rotation.z = -0.25;
        armR.rotation.x = -0.2;
        addMesh(mg, new THREE.BoxGeometry(0.25 * yBase, 0.25 * yBase, 0.25 * yBase), iceHornMat, 0.72 * yBase, 0.45 * yBase, 0.2 * yBase);

        // Sturdy Legs
        addMesh(mg, new THREE.CylinderGeometry(0.2 * yBase, 0.22 * yBase, 0.65 * yBase, 6), yetiFur, -0.3 * yBase, 0.32 * yBase, 0);
        addMesh(mg, new THREE.CylinderGeometry(0.2 * yBase, 0.22 * yBase, 0.65 * yBase, 6), yetiFur, 0.3 * yBase, 0.32 * yBase, 0);
      } else {
        // Tree Monster (Treant) 3D Model
        const barkMat = mat('#3e2723', 0.9, 0.1);
        const foliageMat = mat('#14532d', 0.8, 0.1);
        const eyeMat = new THREE.MeshStandardMaterial({
          color: 0xffaa00,
          emissive: 0xff8800,
          emissiveIntensity: 2.8,
        });
        const tScale = lvlScale * 1.0;

        // Gnarled Trunk
        addMesh(mg, new THREE.CylinderGeometry(0.35 * tScale, 0.55 * tScale, 1.8 * tScale, 7), barkMat, 0, 0.9 * tScale, 0);

        // Branch Arms
        const armLeft = addMesh(mg, new THREE.CylinderGeometry(0.1 * tScale, 0.16 * tScale, 1.1 * tScale, 6), barkMat, -0.55 * tScale, 1.25 * tScale, 0.2 * tScale);
        armLeft.rotation.z = 0.7;
        armLeft.rotation.x = 0.3;
        const armRight = addMesh(mg, new THREE.CylinderGeometry(0.1 * tScale, 0.16 * tScale, 1.1 * tScale, 6), barkMat, 0.55 * tScale, 1.25 * tScale, 0.2 * tScale);
        armRight.rotation.z = -0.7;
        armRight.rotation.x = 0.3;

        // Tree Crown Foliage
        addMesh(mg, new THREE.SphereGeometry(0.85 * tScale, 8, 8), foliageMat, 0, 2.1 * tScale, 0);
        addMesh(mg, new THREE.SphereGeometry(0.55 * tScale, 7, 7), foliageMat, -0.4 * tScale, 2.4 * tScale, 0.2 * tScale);
        addMesh(mg, new THREE.SphereGeometry(0.55 * tScale, 7, 7), foliageMat, 0.4 * tScale, 2.4 * tScale, -0.2 * tScale);

        // Glowing Amber Eyes
        addMesh(mg, new THREE.SphereGeometry(0.08 * tScale, 6, 6), eyeMat, -0.16 * tScale, 1.45 * tScale, 0.42 * tScale);
        addMesh(mg, new THREE.SphereGeometry(0.08 * tScale, 6, 6), eyeMat, 0.16 * tScale, 1.45 * tScale, 0.42 * tScale);
      }

      // Clone materials so white flashes only affect this monster
      mg.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((m) => m.clone());
          } else if (mesh.material) {
            mesh.material = mesh.material.clone();
          }
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m: any) => {
            if (m && m.isMeshStandardMaterial) {
              m.userData._origEmissive = m.emissive.clone();
              m.userData._origColor = m.color.clone();
              m.userData._origIntensity = m.emissiveIntensity || 0;
            }
          });
        }
      });

      registerInteractive(mg, monData);
      monsterGroupsMapRef.current.set(monData.id, mg);
    });


    // --- White Flash Animation Function ---
    const flashMonsterWhite = (group: THREE.Group) => {
      group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m: any) => {
            if (m && m.isMeshStandardMaterial) {
              if (!m.userData._origEmissive) {
                m.userData._origEmissive = m.emissive.clone();
                m.userData._origColor = m.color.clone();
                m.userData._origIntensity = m.emissiveIntensity || 0;
              }
              // Pure white blazing emissive flash
              m.emissive.setHex(0xffffff);
              m.emissiveIntensity = 4.2;
              m.color.setHex(0xffffff);
            }
          });

          // Check if already in activeFlashesRef, otherwise add
          const existing = activeFlashesRef.current.find((f) => f.mesh === mesh);
          if (existing) {
            existing.timer = 0.25;
            existing.maxTimer = 0.25;
          } else {
            activeFlashesRef.current.push({
              mesh,
              timer: 0.25,
              maxTimer: 0.25,
            });
          }
        }
      });

      // Impact flinch shudder
      group.position.x += (Math.random() - 0.5) * 0.4;
      group.position.y += 0.22;
    };

    // --- 3D Smoke in Air Particle Dissolution Function ---
    const turnMonsterIntoSmoke = (monsterId: string, group: THREE.Group) => {
      // 1. Initial blazing white flash burst
      flashMonsterWhite(group);

      // 2. Dissolve the monster mesh down into the vapor cloud
      activeDissolvingRef.current.push({
        group,
        progress: 0,
        origY: group.position.y,
      });

      // 3. Remove from raycast pickables so clicking the smoke doesn't re-target
      const pIdx = pickableMeshesRef.current.indexOf(group);
      if (pIdx !== -1) {
        pickableMeshesRef.current.splice(pIdx, 1);
      }

      // 4. Spawn 36 faceted 3D smoke puffs billowing into the air!
      const originPos = group.position.clone();
      const smokeCount = 36;
      const smokeShades = [0xf1f5f9, 0xe2e8f0, 0xcbd5e1, 0x94a3b8];

      for (let i = 0; i < smokeCount; i++) {
        const radius = 0.32 + Math.random() * 0.28;
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
        puffMesh.castShadow = false;
        puffMesh.receiveShadow = false;

        puffMesh.position.set(
          originPos.x + (Math.random() - 0.5) * 1.4,
          originPos.y + 0.2 + Math.random() * 1.2,
          originPos.z + (Math.random() - 0.5) * 1.4
        );

        const initScale = 0.35 + Math.random() * 0.25;
        puffMesh.scale.setScalar(initScale);
        world.add(puffMesh);

        activeSmokeParticlesRef.current.push({
          mesh: puffMesh,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 1.8,
            2.0 + Math.random() * 2.8, // rising vigorously into the air
            (Math.random() - 0.5) * 1.8
          ),
          rotSpeedX: (Math.random() - 0.5) * 3.5,
          rotSpeedY: (Math.random() - 0.5) * 3.5,
          rotSpeedZ: (Math.random() - 0.5) * 3.5,
          life: 0,
          maxLife: 2.2 + Math.random() * 0.8,
          initialScale: initScale,
          targetScale: 2.6 + Math.random() * 1.4,
        });
      }

      // 14 glowing spirit spark particles floating even higher
      for (let i = 0; i < 14; i++) {
        const sparkGeo = new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 6, 6);
        const sparkMat = new THREE.MeshBasicMaterial({
          color: 0xffd566,
          transparent: true,
          opacity: 0.95,
        });
        const spark = new THREE.Mesh(sparkGeo, sparkMat);
        spark.position.set(
          originPos.x + (Math.random() - 0.5) * 0.9,
          originPos.y + 0.6 + Math.random() * 0.9,
          originPos.z + (Math.random() - 0.5) * 0.9
        );
        world.add(spark);

        activeSmokeParticlesRef.current.push({
          mesh: spark,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 1.0,
            3.6 + Math.random() * 2.2,
            (Math.random() - 0.5) * 1.0
          ),
          rotSpeedX: (Math.random() - 0.5) * 2,
          rotSpeedY: (Math.random() - 0.5) * 2,
          rotSpeedZ: 0,
          life: 0,
          maxLife: 2.8 + Math.random() * 0.6,
          initialScale: 1,
          targetScale: 0.1,
        });
      }
    };

    // --- Master Damage Execution Handler ---
    const executeMonsterDamage = (monsterId: string, damage: number, forceFatal?: boolean): { remainingHp: number; isDead: boolean } => {
      const mg = monsterGroupsMapRef.current.get(monsterId);
      if (!mg || !worldRef.current) return { remainingHp: 0, isDead: true };
      const gameData = mg.userData.gameData as InteractiveObject;
      if (!gameData || gameData.isDefeated) return { remainingHp: 0, isDead: true };

      const currentHp = gameData.health ?? 150;
      const newHp = forceFatal ? 0 : Math.max(0, currentHp - damage);
      gameData.health = newHp;
      const isDead = newHp <= 0;

      // Project world coordinate to screen for floating combat indicators
      const worldPos = mg.position.clone();
      worldPos.y += 1.8;
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

    // Register external damage execution hook with parent
    if (registerDamageHandlerRef) {
      registerDamageHandlerRef((monsterId: string, damage: number, forceFatal?: boolean) => {
        return executeMonsterDamage(monsterId, damage, forceFatal);
      });
    }

    // 5. Army Squad Group (Magar Vanguard 15-Warrior Battalion)
    const armyGroup = new THREE.Group();
    armyGroup.position.copy(armyPosRef.current);
    armyGroup.userData = { isArmyGroup: true };

    // Procedural 15-warrior squad in disciplined tactical formation
    for (let i = 0; i < 15; i++) {
      const warrior = new THREE.Group();
      const col = i % 5;
      const row = Math.floor(i / 5);
      warrior.position.set((col - 2) * 0.72, 0, (row - 1) * 0.75);

      const isCav = i === 4 || i === 10;
      const isArch = i === 2 || i === 7 || i === 12;
      const isCommander = i === 0;

      warrior.userData = {
        origY: 0,
        isCav,
        isArch,
        isCommander,
        idx: i,
      };

      const clothMat = mat(isCommander ? '#b8860b' : isArch ? '#3e6347' : isCav ? '#7a4e28' : '#8e2b22');
      const skinMat = mat('#cfa07e');
      const metalMat = mat('#94a3b8', 0.3, 0.7);

      if (isCav) {
        // Mountain Steed Warhorse
        const horseMat = mat('#523620');
        const horseBody = addMesh(warrior, new THREE.BoxGeometry(0.55, 0.55, 1.1), horseMat, 0, 0.55, 0);
        const horseHead = addMesh(warrior, new THREE.BoxGeometry(0.28, 0.38, 0.45), horseMat, 0, 0.95, 0.5);
        horseHead.rotation.x = -0.3;
        // Rider
        addMesh(warrior, new THREE.CylinderGeometry(0.18, 0.22, 0.65, 7), clothMat, 0, 1.15, 0);
        addMesh(warrior, new THREE.SphereGeometry(0.18, 8, 8), skinMat, 0, 1.62, 0);
        // Helmet
        addMesh(warrior, new THREE.ConeGeometry(0.2, 0.3, 7), metalMat, 0, 1.82, 0);
        // Lance Spear
        const lance = addMesh(warrior, new THREE.CylinderGeometry(0.025, 0.025, 1.8, 6), metalMat, 0.32, 1.4, 0.3);
        lance.rotation.x = 0.2;
      } else {
        // Foot Soldier (Infantry / Archer / Commander)
        // Two legs for walking animation
        const legLeft = addMesh(warrior, new THREE.CylinderGeometry(0.07, 0.08, 0.45, 6), mat('#2b2622'), -0.12, 0.22, 0);
        const legRight = addMesh(warrior, new THREE.CylinderGeometry(0.07, 0.08, 0.45, 6), mat('#2b2622'), 0.12, 0.22, 0);
        legLeft.userData = { isLegLeft: true };
        legRight.userData = { isLegRight: true };

        // Torso & Tunic
        addMesh(warrior, new THREE.CylinderGeometry(0.2, 0.24, 0.68, 7), clothMat, 0, 0.75, 0);
        // Head
        addMesh(warrior, new THREE.SphereGeometry(0.18, 8, 8), skinMat, 0, 1.25, 0);

        // Helmet with Crest
        const helm = addMesh(warrior, new THREE.ConeGeometry(0.2, 0.28, 7), metalMat, 0, 1.45, 0);
        if (isCommander) {
          const goldCrest = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 1.5 });
          addMesh(warrior, new THREE.BoxGeometry(0.05, 0.35, 0.3), goldCrest, 0, 1.65, 0);
        }

        // Weapons
        if (isArch) {
          // Himalayan Longbow
          addMesh(warrior, new THREE.TorusGeometry(0.32, 0.035, 5, 12, Math.PI), mat('#5c4028'), 0.38, 0.9, 0);
        } else {
          // Broadsword & Shield
          const sword = addMesh(warrior, new THREE.BoxGeometry(0.07, 0.75, 0.07), metalMat, 0.38, 0.85, 0.1);
          sword.userData = { isWeapon: true };
          // Round Wooden/Brass Shield
          const shieldMat = isCommander ? mat('#b8860b') : mat('#7c2d12');
          const shield = addMesh(warrior, new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12), shieldMat, -0.35, 0.85, 0.12);
          shield.rotation.x = Math.PI / 2;
        }
      }

      armyGroup.add(warrior);
    }

    // Tall Gilded Battalion Banner & Overhead Glowing Beacon
    const bannerPole = addMesh(
      armyGroup,
      new THREE.CylinderGeometry(0.04, 0.04, 3.8, 8),
      mat('#ffd700', 0.2, 0.8),
      -1.2,
      2.0,
      -0.2
    );
    const mainBannerMesh = addMesh(
      armyGroup,
      new THREE.BoxGeometry(1.4, 0.8, 0.05),
      mat('#b91c1c', 0.4, 0.3),
      -0.5,
      3.2,
      -0.2
    );
    mainBannerMesh.userData = { isBannerMesh: true };

    // Glowing Golden Beacon Orb at top of banner pole
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xffe066,
      emissive: 0xffb703,
      emissiveIntensity: 2.8,
    });
    addMesh(armyGroup, new THREE.SphereGeometry(0.2, 12, 12), beaconMat, -1.2, 3.9, -0.2);

    // Floating 3D Chevron Pointer (points down at Magar Vanguard from high above)
    const chevronMat = new THREE.MeshStandardMaterial({
      color: 0xffd978,
      emissive: 0xff9900,
      emissiveIntensity: 2.5,
      transparent: true,
      opacity: 0.95,
    });
    const chevronPointer = addMesh(
      armyGroup,
      new THREE.ConeGeometry(0.35, 0.6, 4),
      chevronMat,
      0,
      4.6,
      0
    );
    chevronPointer.rotation.x = Math.PI; // upside down pointing down
    chevronPointer.userData = { isChevronPointer: true };

    world.add(armyGroup);
    armyGroupRef.current = armyGroup;

    // Selection ring
    const ringGeo = new THREE.RingGeometry(1.2, 1.45, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xdfba6e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.03, 0);
    ring.visible = false;
    world.add(ring);
    selectionRingRef.current = ring;

    // Tactical Line
    const lineMat = new THREE.LineDashedMaterial({
      color: 0xdfba6e,
      dashSize: 0.8,
      gapSize: 0.4,
      linewidth: 2,
    });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.2, 0),
      new THREE.Vector3(0, 0.2, 0),
    ]);
    const line = new THREE.Line(lineGeo, lineMat);
    line.visible = false;
    world.add(line);
    tacticalLineRef.current = line;

    // Store references
    objectsListRef.current = allObjects;
    pickableMeshesRef.current = pickables;
    registerObjectsRef(allObjects);

    // Resize handler
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

    // --- Mining Particle Chips Spawner ---
    const spawnMiningChips = (targetObj: InteractiveObject) => {
      if (!sceneRef.current) return;
      const subtype = targetObj.subtype;
      let chipColor = 0xf59e0b; // default gold
      let emissiveColor = 0xd97706;
      let isGlow = true;

      if (subtype === 'wood') {
        chipColor = 0x8b5a2b;
        emissiveColor = 0x3d2314;
        isGlow = false;
      } else if (subtype === 'farm') {
        chipColor = 0xfacc15;
        emissiveColor = 0xca8a04;
        isGlow = false;
      } else if (subtype === 'stonecrystal' || subtype === 'stone') {
        chipColor = Math.random() > 0.5 ? 0x38bdf8 : 0xc084fc;
        emissiveColor = chipColor;
        isGlow = true;
      }

      for (let i = 0; i < 4; i++) {
        const geo = new THREE.DodecahedronGeometry(0.08 + Math.random() * 0.06, 0);
        const pMat = new THREE.MeshStandardMaterial({
          color: chipColor,
          emissive: emissiveColor,
          emissiveIntensity: isGlow ? 2.5 : 0.2,
          roughness: 0.3,
          metalness: isGlow ? 0.6 : 0.1,
        });
        const mesh = new THREE.Mesh(geo, pMat);
        mesh.position.set(
          targetObj.position[0] + (Math.random() - 0.5) * 1.4,
          0.3 + Math.random() * 0.6,
          targetObj.position[2] + (Math.random() - 0.5) * 1.4
        );
        sceneRef.current.add(mesh);

        activeMiningParticlesRef.current.push({
          mesh,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 3.5,
            2.5 + Math.random() * 3.0,
            (Math.random() - 0.5) * 3.5
          ),
          rotSpeed: (Math.random() - 0.5) * 16,
          life: 0,
          maxLife: 0.65 + Math.random() * 0.35,
        });
      }
    };

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Army movement & Real-Time Arrival Combat Logic
      if (armyGroupRef.current) {
        const currentPos = armyGroupRef.current.position;
        const currentArmyState = armyStateRef.current;
        const currentTarget = activeTargetRef.current;

        // Marching to Target (Attack or Gather or Marching)
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

          // Render glowing tactical marching path line connecting army to destination
          if (tacticalLineRef.current) {
            tacticalLineRef.current.visible = true;
            const p1 = currentPos.clone();
            p1.y = 0.22;
            const p2 = targetPos.clone();
            p2.y = 0.22;
            tacticalLineRef.current.geometry.setFromPoints([p1, p2]);
            (tacticalLineRef.current as any).computeLineDistances?.();
          }

          if (dist > 1.4) {
            // Actively marching towards the distant target across the landscape
            const dir = new THREE.Vector3().subVectors(targetPos, currentPos).normalize();
            // Calibrated march speed (6.2 units/sec) so player can observe marching troops
            currentPos.addScaledVector(dir, delta * 6.2);
            currentPos.y = 0.02 + Math.abs(Math.sin(elapsed * 10)) * 0.18;
            armyGroupRef.current.rotation.y = Math.atan2(dir.x, dir.z);

            // Animate 15 marching warriors: walking legs, swinging weapons, horse gallop
            armyGroupRef.current.children.forEach((child) => {
              const warrior = child as THREE.Group;
              if (warrior.userData?.idx !== undefined) {
                const idx = warrior.userData.idx;
                warrior.position.y = Math.abs(Math.sin(elapsed * 12 + idx * 0.6)) * 0.12;
                warrior.rotation.x = 0; // reset mining strike posture

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

            // Dynamic progress update as army visibly traverses the valleys
            if (totalMarchDistanceRef.current > 0) {
              const walked = Math.max(0, totalMarchDistanceRef.current - dist);
              const pct = Math.min(48, Math.max(6, Math.round((walked / totalMarchDistanceRef.current) * 48)));
              const secsLeft = Math.max(0.3, Math.round((dist / 6.2) * 10) / 10);
              onMissionProgressUpdateRef.current?.(
                pct,
                `Vanguard marching to ${currentTarget.name}...`,
                `${secsLeft}s`
              );
            }
          } else {
            // REACHED TARGET IN REAL TIME!
            currentPos.y = 0.02;
            const dir = new THREE.Vector3().subVectors(targetPos, currentPos).normalize();
            armyGroupRef.current.rotation.y = Math.atan2(dir.x, dir.z);

            if (currentArmyState === 'ATTACKING') {
              // Soldiers enter melee combat stance and swing weapons
              armyGroupRef.current.children.forEach((child) => {
                const warrior = child as THREE.Group;
                if (warrior.userData?.idx !== undefined) {
                  const idx = warrior.userData.idx;
                  warrior.children.forEach((mesh) => {
                    if (mesh.userData?.isWeapon) {
                      mesh.rotation.x = Math.sin(elapsed * 18 + idx * 0.8) * 0.8;
                    }
                  });
                }
              });

              const targetMg = monsterGroupsMapRef.current.get(currentTarget.id);
              if (targetMg && targetMg.userData?.gameData && !targetMg.userData.gameData.isDefeated) {
                // 1. FIRST STRIKE IMPACT LANDS IMMEDIATELY UPON PHYSICAL ARRIVAL!
                if (!hasStruckUponArrivalRef.current) {
                  hasStruckUponArrivalRef.current = true;
                  combatStrikeTimerRef.current = 0;
                  const curHp = targetMg.userData.gameData.health ?? 100;
                  const strikeDamage = Math.max(35, Math.min(curHp, 45 + (currentTarget.level || 1) * 6));
                  const isFatal = curHp <= strikeDamage;

                  // Trigger white flash recoil, combat floaters & HP deduction in real-time
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
                  // 2. Subsequent combat strikes every 0.85s until zero HP
                  combatStrikeTimerRef.current += delta;
                  if (combatStrikeTimerRef.current >= 0.85) {
                    combatStrikeTimerRef.current = 0;
                    const curHp = targetMg.userData.gameData.health ?? 100;
                    const strikeDamage = Math.max(40, 50);
                    const isFatal = curHp <= strikeDamage;

                    executeMonsterDamage(currentTarget.id, strikeDamage, isFatal);
                    const pct = Math.min(
                      95,
                      60 +
                        Math.round(
                          (1 - (curHp - strikeDamage) / (targetMg.userData.gameData.maxHealth || 100)) * 35
                        )
                    );
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
              // REAL-TIME GATHERING AT RESOURCE NODE WITH DYNAMIC MINING ANIMATION!
              gatherTimerRef.current += delta;
              miningChipTimerRef.current += delta;

              // 1. Soldiers swing pickaxes/axes down vigorously onto deposit!
              armyGroupRef.current.children.forEach((child) => {
                const warrior = child as THREE.Group;
                if (warrior.userData?.idx !== undefined) {
                  const idx = warrior.userData.idx;
                  // Torso strikes forward and down with physical weight
                  warrior.rotation.x = Math.max(0, Math.sin(elapsed * 9 + idx * 0.9)) * 0.38;
                  warrior.position.y = Math.sin(elapsed * 9 + idx * 0.9) * 0.06;

                  warrior.children.forEach((mesh) => {
                    if (mesh.userData?.isWeapon) {
                      // Heavy pickaxe / mining strike swinging down!
                      mesh.rotation.x = -0.35 + Math.sin(elapsed * 9 + idx * 0.9) * 1.35;
                    }
                  });
                }
              });

              // 2. Spawn dynamic flying mining particle chips on each strike interval
              if (miningChipTimerRef.current >= 0.28) {
                miningChipTimerRef.current = 0;
                spawnMiningChips(currentTarget);
              }

              const gPct = Math.min(95, 45 + Math.round((gatherTimerRef.current / 3.8) * 50));
              const gSecs = Math.max(0.2, Math.round((3.8 - gatherTimerRef.current) * 10) / 10);
              onMissionProgressUpdateRef.current?.(
                gPct,
                `Mining & gathering assets at ${currentTarget.name}... (${Math.round((gatherTimerRef.current / 3.8) * 100)}%)`,
                `${gSecs}s`
              );

              if (gatherTimerRef.current >= 3.8) {
                gatherTimerRef.current = 0;
                onMissionStepCompleteRef.current?.({ type: 'gather', target: currentTarget });
              }
            }
          }
        } else if (currentArmyState === 'RETURNING') {
          // Returning to Citadel Gate
          const homePos = armyHomeRef.current;
          const distToHome = currentPos.distanceTo(homePos);

          if (tacticalLineRef.current) {
            tacticalLineRef.current.visible = true;
            const p1 = currentPos.clone();
            p1.y = 0.22;
            const p2 = homePos.clone();
            p2.y = 0.22;
            tacticalLineRef.current.geometry.setFromPoints([p1, p2]);
            (tacticalLineRef.current as any).computeLineDistances?.();
          }

          if (distToHome > 0.6) {
            const dir = new THREE.Vector3().subVectors(homePos, currentPos).normalize();
            currentPos.addScaledVector(dir, delta * 7.5);
            currentPos.y = 0.02 + Math.abs(Math.sin(elapsed * 10)) * 0.18;
            armyGroupRef.current.rotation.y = Math.atan2(dir.x, dir.z);

            const secsLeft = Math.max(0.3, Math.round((distToHome / 7.5) * 10) / 10);
            onMissionProgressUpdateRef.current?.(
              90,
              'Vanguard marching back to citadel gate.',
              `${secsLeft}s`
            );
          } else {
            currentPos.copy(homePos);
            currentPos.y = 0.02;
            armyGroupRef.current.rotation.y = 0;
            if (tacticalLineRef.current) tacticalLineRef.current.visible = false;
            onArmyReturnHomeRef.current?.();
          }
        } else if (currentArmyState === 'IDLE') {
          if (tacticalLineRef.current) tacticalLineRef.current.visible = false;
        }

        // Overhead chevron pointer & banner waving
        armyGroupRef.current.children.forEach((child) => {
          if (child.userData?.isBannerMesh) {
            child.rotation.y = Math.sin(elapsed * 5) * 0.25;
          } else if (child.userData?.isChevronPointer) {
            child.position.y = 4.6 + Math.sin(elapsed * 4) * 0.25;
            child.rotation.y = elapsed * 2.5;
          }
        });
      }

      // --- Process Active White Flashing Meshes on Damaged Monsters ---
      for (let i = activeFlashesRef.current.length - 1; i >= 0; i--) {
        const item = activeFlashesRef.current[i];
        item.timer -= delta;
        const progress = Math.max(0, item.timer / item.maxTimer);
        const mats = Array.isArray(item.mesh.material) ? item.mesh.material : [item.mesh.material];
        mats.forEach((m: any) => {
          if (m && m.isMeshStandardMaterial && m.userData._origColor) {
            m.emissiveIntensity = progress * 4.2;
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

      // Smoothly settle monster positions back after recoil flinch
      monsterGroupsMapRef.current.forEach((mg) => {
        const monData = mg.userData?.gameData;
        if (monData && !monData.isDefeated) {
          mg.position.x = THREE.MathUtils.damp(mg.position.x, monData.position[0], 12, delta);
          mg.position.y = THREE.MathUtils.damp(mg.position.y, 0, 12, delta);
        }
      });

      // --- Process Dissolving Monsters (Shrinking down to zero as they vaporize) ---
      for (let i = activeDissolvingRef.current.length - 1; i >= 0; i--) {
        const dm = activeDissolvingRef.current[i];
        dm.progress += delta * 2.8;
        const curScale = Math.max(0, 1 - dm.progress);
        dm.group.scale.setScalar(curScale);
        dm.group.position.y += delta * 0.8; // gently lifts into the vapor

        if (dm.progress >= 1.0 || curScale <= 0.02) {
          dm.group.visible = false;
          activeDissolvingRef.current.splice(i, 1);
        }
      }

      // --- Process 3D Smoke In Air Particles ---
      for (let i = activeSmokeParticlesRef.current.length - 1; i >= 0; i--) {
        const p = activeSmokeParticlesRef.current[i];
        p.life += delta;
        const ratio = p.life / p.maxLife;

        // Upward buoyancy & mountain wind drift
        p.velocity.y += delta * 0.55;
        p.velocity.x += delta * 0.32;
        p.mesh.position.addScaledVector(p.velocity, delta);

        // Multi-axis organic tumbling
        p.mesh.rotation.x += p.rotSpeedX * delta;
        p.mesh.rotation.y += p.rotSpeedY * delta;
        p.mesh.rotation.z += p.rotSpeedZ * delta;

        // Billowing expansion in scale
        const curScale = THREE.MathUtils.lerp(p.initialScale, p.targetScale, Math.min(1, ratio * 1.35));
        p.mesh.scale.setScalar(curScale);

        // Smooth opacity curve: rapid puff-in then ethereal fade out to zero in air
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

      // --- Process Dynamic Mining Particles (Chips flying from resource nodes) ---
      for (let i = activeMiningParticlesRef.current.length - 1; i >= 0; i--) {
        const p = activeMiningParticlesRef.current[i];
        p.life += delta;
        p.velocity.y -= delta * 12.0; // gravity
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

      // Render
      renderer.render(scene, camera);
    };
    animate();

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
        (tacticalLineRef.current as any).computeLineDistances?.();
      } else {
        tacticalLineRef.current.visible = false;
      }
    }
  }, [activeTarget, armyState]);

  // Handle active army marching order
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
          // Troops ALWAYS start march from Citadel Gate Assembly Square!
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
    }
  }, [armyState, activeTarget]);

  // Pointer event handlers for drag-to-pan & click-to-select
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
      // Convert screen delta to isometric world delta
      const factor = (52 / (containerRef.current?.clientHeight || 600)) * (1 / zoom);
      const newPanX = panStartRef.current.x + dx * factor;
      const newPanZ = panStartRef.current.z + dy * factor;
      onUpdateCamera({ x: newPanX, z: newPanZ }, zoom);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) {
      // It was a click! Raycast to select object
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
          let minDistance = 4.2; // generous click radius threshold

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
    const newZoom = Math.max(0.5, Math.min(2.0, zoom + zoomDelta));
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
        HIMALAYAN GLACIER CREST <span>▲ ▲ ▲</span>
      </div>
      <div className="scene-label label-east">EASTERN SILK GATEWAY</div>
      <div className="scene-label label-south">TERRACED LOWLANDS & BASIN</div>
      <div className="scene-label label-west">WESTERN IRON RIDGES</div>
    </div>
  );
};
