import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/loaders/GLTFLoader.js';

const viewport = document.getElementById('gameViewport');
const loadingBadge = document.getElementById('loadingBadge');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#8ba3a1');
scene.fog = new THREE.Fog('#8ba3a1', 60, 200);

// Camera scaled for expansive 160x130 land
const camera = new THREE.OrthographicCamera(-36, 36, 26, -26, 0.1, 450);
camera.position.set(44, 52, 44);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
viewport.prepend(renderer.domElement);

const hemiLight = new THREE.HemisphereLight(0xdceeff, 0x354536, 2.0);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight(0xffe2bd, 3.0);
sun.position.set(-35, 65, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -95; sun.shadow.camera.right = 95;
sun.shadow.camera.top = 95; sun.shadow.camera.bottom = -95;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 280;
scene.add(sun);

const world = new THREE.Group();
scene.add(world);
const pickables = [];
const animated = [];
const gltfLoader = new GLTFLoader();
const glbCache = new Map();
const modelAssetBase = new URL('../assets/models/', import.meta.url);

function loadGLBAsset(file) {
  if (!glbCache.has(file)) {
    const promise = new Promise((resolve, reject) => {
      gltfLoader.load(new URL(file, modelAssetBase).href, gltf => resolve(gltf.scene), undefined, reject);
    });
    glbCache.set(file, promise);
  }
  return glbCache.get(file);
}

function applyGLBVisual(group, file) {
  loadGLBAsset(file).then(asset => {
    if (!group || !group.parent) return;
    const clone = asset.clone(true);
    clone.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (Array.isArray(node.material)) node.material = node.material.map(m => m.clone());
        else if (node.material) node.material = node.material.clone();
      }
    });
    group.children.forEach(child => {
      if (child.isMesh) child.visible = false;
      else if (child.isGroup) child.traverse(node => { if (node.isMesh) node.visible = false; });
    });
    clone.name = `GLB:${file}`;
    clone.userData.importedAsset = file;
    group.add(clone);
  }).catch(error => console.warn(`Could not load asset ${file}; keeping procedural model.`, error));
}

/* ==========================================================================
   DYNAMIC WEATHER SYSTEM
   ========================================================================== */
const weathers = [
  { id: 'clear', name: 'Clear Skies', icon: '☀️', speedMult: 1.0, gatherMult: 1.0, fogNear: 45, fogFar: 115, lightColor: 0xffe2bd, lightIntensity: 3.0, desc: 'Speed 100% · Gather 100%', legend: '☀️ Clear Skies (Normal)' },
  { id: 'snow', name: 'Alpine Snow', icon: '❄️', speedMult: 0.75, gatherMult: 0.9, fogNear: 28, fogFar: 75, lightColor: 0xcfe3f2, lightIntensity: 2.2, desc: 'Speed -25% · Wood +15%, Food -20%', legend: '❄️ Snow (Speed -25%)' },
  { id: 'blizzard', name: 'Himalayan Blizzard', icon: '🌨️', speedMult: 0.60, gatherMult: 0.7, fogNear: 18, fogFar: 50, lightColor: 0xd9eafd, lightIntensity: 1.8, desc: 'Speed -40% · Gathering -30%', legend: '🌨️ Blizzard (Speed -40%)' },
  { id: 'fog', name: 'Valley Fog', icon: '🌫️', speedMult: 0.85, gatherMult: 1.2, fogNear: 12, fogFar: 45, lightColor: 0xe3e1d5, lightIntensity: 1.9, desc: 'Speed -15% · Covert Gather +20%', legend: '🌫️ Deep Fog (Covert +20%)' }
];

let currentWeatherIndex = 0;
let currentWeather = weathers[0];
let weatherAutoTimer = 0;

// Particles across expanded 160x130 land
const particleCount = 850;
const particleGeometry = new THREE.BufferGeometry();
const particlePositions = new Float32Array(particleCount * 3);
const particleVelocities = [];

for (let i = 0; i < particleCount; i++) {
  particlePositions[i * 3] = (Math.random() - 0.5) * 160;
  particlePositions[i * 3 + 1] = Math.random() * 26;
  particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 130;
  particleVelocities.push({
    y: 0.9 + Math.random() * 1.6,
    x: 0.3 + Math.random() * 0.7,
    drift: Math.random() * Math.PI * 2
  });
}
particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
const particleMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.22,
  transparent: true,
  opacity: 0.75
});
const weatherParticleSystem = new THREE.Points(particleGeometry, particleMaterial);
world.add(weatherParticleSystem);

function applyWeather(index, notify = true) {
  currentWeatherIndex = (index + weathers.length) % weathers.length;
  currentWeather = weathers[currentWeatherIndex];

  const overlay = document.getElementById('weatherOverlay');
  if (overlay) {
    overlay.className = `weather-overlay weather-${currentWeather.id}`;
  }

  document.getElementById('weatherIcon').textContent = currentWeather.icon;
  document.getElementById('weatherName').textContent = currentWeather.name;
  document.getElementById('weatherEffects').textContent = currentWeather.desc;
  const legendInd = document.getElementById('weatherLegendIndicator');
  if (legendInd) legendInd.textContent = currentWeather.legend;

  scene.fog.near = currentWeather.fogNear;
  scene.fog.far = currentWeather.fogFar;
  sun.color.set(currentWeather.lightColor);
  sun.intensity = currentWeather.lightIntensity;

  if (currentWeather.id === 'clear') {
    weatherParticleSystem.visible = false;
  } else {
    weatherParticleSystem.visible = true;
    particleMaterial.opacity = currentWeather.id === 'blizzard' ? 0.95 : currentWeather.id === 'snow' ? 0.75 : 0.45;
    particleMaterial.size = currentWeather.id === 'blizzard' ? 0.32 : currentWeather.id === 'snow' ? 0.22 : 0.26;
  }

  if (notify) {
    addLog('Weather shifted', `${currentWeather.name}: ${currentWeather.desc}`, currentWeather.icon);
    toast(`Weather shifted: ${currentWeather.name}`);
  }
}

document.getElementById('cycleWeatherBtn')?.addEventListener('click', () => {
  applyWeather(currentWeatherIndex + 1);
});

/* ==========================================================================
   GAME RESOURCES & STATE
   ========================================================================== */
const resources = { wood: 1450, stone: 1100, iron: 680, food: 2800 };
let kingdomPowerBonus = 0;

function updateResourceUI() {
  document.getElementById('woodCount').textContent = resources.wood.toLocaleString();
  document.getElementById('stoneCount').textContent = resources.stone.toLocaleString();
  document.getElementById('ironCount').textContent = resources.iron.toLocaleString();
  document.getElementById('foodCount').textContent = resources.food.toLocaleString();
}

function calculateArmyPower() {
  return 12480 + (army.counts.infantry - 120) * 120 + (army.counts.cavalry - 24) * 350 + (army.counts.archer - 60) * 180 + kingdomPowerBonus;
}

function updatePowerDisplay() {
  const powerEl = document.getElementById('armyPower');
  if (powerEl) {
    const power = calculateArmyPower();
    powerEl.textContent = `✦ ${power.toLocaleString()} POWER`;
  }
}

/* ==========================================================================
   TRAIN RECRUITS SYSTEM
   ========================================================================== */
const unitStats = {
  infantry: { name: 'Magar Infantry', food: 60, iron: 30, wood: 0, time: 5, power: 120, icon: '⚔' },
  cavalry: { name: 'Mountain Cavalry', food: 120, iron: 75, wood: 0, time: 8, power: 350, icon: '🏇' },
  archer: { name: 'Himalayan Archer', food: 80, iron: 0, wood: 45, time: 6, power: 180, icon: '🏹' }
};

let trainingQueue = [];
let activeTraining = null;

function queueUnitTraining(type, count = 1) {
  const conf = unitStats[type];
  if (!conf) return;

  const totalFood = conf.food * count;
  const totalIron = conf.iron * count;
  const totalWood = conf.wood * count;

  if (resources.food < totalFood || resources.iron < totalIron || resources.wood < totalWood) {
    toast(`Not enough resources to train ${count}x ${conf.name}!`);
    return;
  }

  resources.food -= totalFood;
  resources.iron -= totalIron;
  resources.wood -= totalWood;
  updateResourceUI();

  for (let i = 0; i < count; i++) {
    trainingQueue.push({ type, duration: conf.time, elapsed: 0, name: conf.name, icon: conf.icon });
  }

  updateQueueUI();
  toast(`Queued +${count} ${conf.name}`);
  addLog('Recruitment queued', `Ordered training for ${count}x ${conf.name}.`, conf.icon);
}

function updateTraining(dt) {
  if (!activeTraining && trainingQueue.length > 0) {
    activeTraining = trainingQueue.shift();
  }

  if (activeTraining) {
    activeTraining.elapsed += dt;
    const progress = Math.min(1, activeTraining.elapsed / activeTraining.duration);
    const box = document.getElementById('trainingQueueBox');
    if (box) box.style.display = 'block';

    const remaining = Math.max(0, Math.ceil(activeTraining.duration - activeTraining.elapsed));
    const timerEl = document.getElementById('queueItemTimer');
    if (timerEl) timerEl.textContent = `${remaining}s`;

    const nameEl = document.getElementById('queueItemName');
    if (nameEl) nameEl.textContent = `Training ${activeTraining.name}…`;

    const fillEl = document.getElementById('queueProgressBar');
    if (fillEl) fillEl.style.width = `${progress * 100}%`;

    if (progress >= 1) {
      army.counts[activeTraining.type] = (army.counts[activeTraining.type] || 0) + 1;
      document.getElementById('infantryCount').textContent = army.counts.infantry;
      document.getElementById('cavalryCount').textContent = army.counts.cavalry;
      document.getElementById('archerCount').textContent = army.counts.archer;
      updatePowerDisplay();

      showCombatFloater(`+1 ${activeTraining.name.toUpperCase()}`, window.innerWidth * 0.18, window.innerHeight * 0.45, `floater-${activeTraining.type}`);
      addLog('Unit trained', `${activeTraining.name} joined the Vanguard!`, activeTraining.icon);
      toast(`${activeTraining.name} trained!`);

      activeTraining = null;
      updateQueueUI();
    }
  } else {
    const box = document.getElementById('trainingQueueBox');
    if (box && trainingQueue.length === 0) box.style.display = 'none';
  }
}

function updateQueueUI() {
  const pendingContainer = document.getElementById('queuePendingList');
  if (!pendingContainer) return;

  const counts = {};
  trainingQueue.forEach(item => { counts[item.name] = (counts[item.name] || 0) + 1; });
  pendingContainer.innerHTML = '';
  for (const [name, qty] of Object.entries(counts)) {
    const tag = document.createElement('span');
    tag.className = 'queue-tag';
    tag.textContent = `+${qty} ${name}`;
    pendingContainer.appendChild(tag);
  }
  const badge = document.getElementById('queueBadge');
  if (badge) {
    const total = trainingQueue.length + (activeTraining ? 1 : 0);
    badge.textContent = total > 0 ? `TRAINING (${total})` : 'CITADEL BARRACKS';
  }
}

document.querySelectorAll('.btn-train').forEach(btn => {
  btn.addEventListener('click', () => {
    const unit = btn.dataset.unit;
    const count = parseInt(btn.dataset.count, 10) || 1;
    queueUnitTraining(unit, count);
  });
});

/* ==========================================================================
   EXPANDED HIMALAYAN MAPS & KINGDOMS
   ========================================================================== */
const maps = {
  valley: { name: 'Gorkha Valley', subtitle: 'HOME TERRITORY · CENTRAL HIMALAYAS', ground: '#5e7d54', hill: '#7a8e63', snow: false },
  snow: { name: 'Himshikhar', subtitle: 'SNOW KINGDOM · FROZEN FRONTIER', ground: '#a2bdc4', hill: '#d5e2e4', snow: true },
  mountain: { name: 'Ironcrest', subtitle: 'MOUNTAIN KINGDOM · ORE TERRITORY', ground: '#717572', hill: '#92948c', snow: false },
  forest: { name: 'Green Mandala', subtitle: 'FOREST KINGDOM · ANCIENT WOODLAND', ground: '#3a6646', hill: '#5b7d54', snow: false }
};

let currentMap = 'valley';
let selectedObject = null;
let zoom = 1;
let panX = 0, panZ = 0;
let pointerDown = null;
let dragMoved = false;
let toastTimeout;

const army = {
  id: 'A-01',
  home: new THREE.Vector3(-14, 0, 10),
  position: new THREE.Vector3(-14, 0, 10),
  destination: null,
  state: 'idle',
  progress: 0,
  duration: 0,
  timer: 0,
  target: null,
  health: 100,
  counts: { infantry: 120, cavalry: 24, archer: 60 },
  missionType: null,
  start: null,
  returnAfterTask: false
};

const objects = [];
const mapObjects = new Map();
const clock = new THREE.Clock();

function mat(color, roughness = 0.88, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addMesh(parent, geometry, material, x, y, z, cast = true) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function makeLabelSprite(text, color = '#f4f0df') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const ctx = c.getContext('2d'); ctx.fillStyle = 'rgba(16,23,25,.88)';
  ctx.beginPath(); ctx.roundRect(10, 10, 492, 76, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(210,220,205,.5)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.font = 'bold 32px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, 256, 49);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(4.2, 0.8, 1);
  return sprite;
}

function registerObject(obj, data) {
  if (!obj.parent) world.add(obj);
  obj.userData.gameData = data;
  obj.traverse?.(child => { if (child.isMesh) child.userData.gameData = data; });
  pickables.push(obj);
  objects.push({ group: obj, data });
  return obj;
}

/* ==========================================================================
   TERRAIN GENERATOR (160x130 VAST REALM WITH TERRACES, RIVERS, BRIDGES & PRAYER FLAGS)
   ========================================================================== */
function createGround(config) {
  // Vast 160x130 ground plane
  const ground = addMesh(world, new THREE.PlaneGeometry(160, 130), mat(config.ground), 0, -0.12, 0, false);
  ground.rotation.x = -Math.PI / 2;

  // 65+ Layered hill mounds & agricultural terrace steps across the vast land
  for (let i = 0; i < 68; i++) {
    const x = (Math.random() - 0.5) * 148;
    const z = (Math.random() - 0.5) * 118;
    // Don't place huge hills directly on citadel courtyard or river center
    if (Math.hypot(x - (-14), z - 10) < 10) continue;

    const r = 2.2 + Math.random() * 4.2;
    const hill = addMesh(world, new THREE.SphereGeometry(1, 14, 8), mat(config.hill), x, -0.12, z, false);
    hill.scale.set(r, 0.5 + Math.random() * 1.2, r * 0.8);

    // Terraced contour ring around lower slopes for rice/barley cultivation
    if (i % 2 === 0) {
      const terrace = addMesh(world, new THREE.CylinderGeometry(r * 0.92, r * 1.02, 0.24, 16), mat(config.snow ? '#c2d2d4' : '#829c69'), x, 0.08, z, false);
      terrace.receiveShadow = true;
    }
    // High northern snow caps
    if (config.snow || z < -25) {
      const cap = addMesh(world, new THREE.SphereGeometry(1, 10, 6), mat('#edf4f2'), x, 0.25, z, false);
      cap.scale.set(r * 0.65, 0.35, r * 0.52);
    }
  }

  // Prayer Flag Poles & Colorful Lungta Banners strung between high ridges
  const prayerFlagPosts = [
    { x1: -48, z1: -32, x2: -36, z2: -38 },
    { x1: -22, z1: 28, x2: -12, z2: 34 },
    { x1: 22, z1: -28, x2: 36, z2: -32 },
    { x1: 42, z1: 26, x2: 56, z2: 30 }
  ];
  const flagColors = ['#1d6091', '#ffffff', '#b53328', '#2b7548', '#d6a82d']; // Blue, White, Red, Green, Yellow
  prayerFlagPosts.forEach(pf => {
    // Poles
    addMesh(world, new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6), mat('#5c4432'), pf.x1, 2.1, pf.z1);
    addMesh(world, new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6), mat('#5c4432'), pf.x2, 2.1, pf.z2);
    // Rope line
    const ropePoints = [
      new THREE.Vector3(pf.x1, 3.8, pf.z1),
      new THREE.Vector3((pf.x1 + pf.x2) * 0.5, 3.3, (pf.z1 + pf.z2) * 0.5),
      new THREE.Vector3(pf.x2, 3.8, pf.z2)
    ];
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ropePoints), 20, 0.02, 4, false), mat('#42382c'));
    world.add(rope);
    // Fluttering colored flag pennants
    for (let f = 0; f < 8; f++) {
      const t = (f + 1) / 10;
      const fx = THREE.MathUtils.lerp(pf.x1, pf.x2, t);
      const fz = THREE.MathUtils.lerp(pf.z1, pf.z2, t);
      const fy = 3.3 + Math.sin(t * Math.PI) * 0.4 - 0.2;
      const flagMesh = addMesh(world, new THREE.BoxGeometry(0.35, 0.45, 0.02), mat(flagColors[f % flagColors.length]), fx, fy, fz);
      flagMesh.rotation.y = Math.atan2(pf.z2 - pf.z1, pf.x2 - pf.x1) + Math.PI / 2;
    }
  });

  // Winding Himalayan Glacial River System (Extended across 160 units)
  const riverPoints = [
    new THREE.Vector3(-76, -0.01, -30),
    new THREE.Vector3(-52, -0.01, -22),
    new THREE.Vector3(-28, -0.01, -14),
    new THREE.Vector3(0, -0.01, -4),
    new THREE.Vector3(26, -0.01, -12),
    new THREE.Vector3(52, -0.01, -22),
    new THREE.Vector3(76, -0.01, -26)
  ];
  const riverCurve = new THREE.CatmullRomCurve3(riverPoints);
  const river = new THREE.Mesh(new THREE.TubeGeometry(riverCurve, 180, 0.65, 8, false), mat('#3b94a8', 0.25, 0.2));
  river.receiveShadow = true;
  world.add(river);

  // South Agricultural Canal / Farmland Stream
  const canalPoints = [
    new THREE.Vector3(0, -0.01, -4),
    new THREE.Vector3(14, -0.01, 8),
    new THREE.Vector3(26, -0.01, 20),
    new THREE.Vector3(44, -0.01, 38),
    new THREE.Vector3(68, -0.01, 52)
  ];
  const canal = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(canalPoints), 100, 0.45, 8, false), mat('#4298ab', 0.25, 0.15));
  canal.receiveShadow = true;
  world.add(canal);

  // 4 Stone Arched Bridges connecting sectors across rivers
  function createBridge(x, z, rotY = 0) {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(x, 0.05, z);
    bridgeGroup.rotation.y = rotY;
    // Deck
    addMesh(bridgeGroup, new THREE.BoxGeometry(2.6, 0.24, 4.6), mat('#8c897f', 0.8, 0.1), 0, 0.22, 0);
    // Parapets
    addMesh(bridgeGroup, new THREE.BoxGeometry(0.3, 0.45, 4.6), mat('#75726a'), -1.2, 0.48, 0);
    addMesh(bridgeGroup, new THREE.BoxGeometry(0.3, 0.45, 4.6), mat('#75726a'), 1.2, 0.48, 0);
    // Arch support
    addMesh(bridgeGroup, new THREE.CylinderGeometry(0.55, 0.55, 2.4, 8), mat('#6d6b63'), 0, -0.1, 0).rotation.z = Math.PI / 2;
    world.add(bridgeGroup);
  }
  createBridge(0, -4, 0.1);          // Central Royal Bridge
  createBridge(-28, -14, -0.35);    // West Valley Bridge
  createBridge(50, -21, 0.35);      // Far East Silk Bridge
  createBridge(24, 18, 0.7);        // South Farmland Canal Bridge

  // 1. Royal Imperial Highway (Western Outposts through Citadel to East Gate)
  const highwayPoints = [
    new THREE.Vector3(-55, -0.03, 16),
    new THREE.Vector3(-34, -0.03, 12),
    new THREE.Vector3(-14, 0.02, 10), // Pass right by Gorkha Citadel
    new THREE.Vector3(0, 0.05, -4),   // Over Central Bridge
    new THREE.Vector3(26, -0.03, 4),
    new THREE.Vector3(48, -0.03, 14),
    new THREE.Vector3(68, -0.03, 20)  // East Mainland Gate
  ];
  const highway = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(highwayPoints), 160, 0.34, 6, false), mat(config.snow ? '#b4b6a9' : '#c6b68d'));
  highway.receiveShadow = true; world.add(highway);

  // 2. Northern Glacier Pass Road (Climbing to Snowy Frontiers)
  const northPassPoints = [
    new THREE.Vector3(-14, 0.02, 10),
    new THREE.Vector3(-8, -0.03, -12),
    new THREE.Vector3(-4, -0.03, -32),
    new THREE.Vector3(12, -0.03, -48),
    new THREE.Vector3(28, -0.03, -54)
  ];
  const northRoad = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(northPassPoints), 120, 0.24, 6, false), mat(config.snow ? '#9ea6a5' : '#b2a588'));
  northRoad.receiveShadow = true; world.add(northRoad);

  // 3. Southern Terraced Farmland Route (Connecting Granaries & Watermills)
  const southRoadPoints = [
    new THREE.Vector3(-14, 0.02, 10),
    new THREE.Vector3(-6, -0.03, 24),
    new THREE.Vector3(14, -0.03, 34),
    new THREE.Vector3(38, -0.03, 48),
    new THREE.Vector3(58, -0.03, 52)
  ];
  const southRoad = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(southRoadPoints), 120, 0.26, 6, false), mat(config.snow ? '#9ea6a5' : '#b7a98a'));
  southRoad.receiveShadow = true; world.add(southRoad);

  // 4. Western Pine Logging & Iron Mining Trail
  const westTrailPoints = [
    new THREE.Vector3(-14, 0.02, 10),
    new THREE.Vector3(-36, -0.03, 4),
    new THREE.Vector3(-52, -0.03, -4),
    new THREE.Vector3(-66, -0.03, -16)
  ];
  const westTrail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(westTrailPoints), 100, 0.24, 6, false), mat(config.snow ? '#9ea6a5' : '#ad9e80'));
  westTrail.receiveShadow = true; world.add(westTrail);
}

function createTree(x, z, scale = 1, snow = false) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale);
  addMesh(g, new THREE.CylinderGeometry(0.14, 0.24, 1.3, 7), mat('#594331'), 0, 0.65, 0);
  const green = snow ? '#607c78' : '#315b3d';
  for (let i = 0; i < 3; i++) {
    addMesh(g, new THREE.ConeGeometry(0.85 - i * 0.13, 1.5, 7), mat(i === 0 ? green : (snow ? '#78938f' : '#426d47')), 0, 1.35 + i * 0.6, 0);
  }
  if (snow) addMesh(g, new THREE.ConeGeometry(0.52, 1.15, 7), mat('#e4eeeb'), 0, 2.2, 0, false);
  world.add(g);
  if (!snow) applyGLBVisual(g, 'himalayan_pine.glb');
  return g;
}

function createRock(x, z, color = '#7c8580', scale = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.random() * 3;
  const rock = addMesh(g, new THREE.DodecahedronGeometry(0.65, 0), mat(color), 0, 0.42, 0);
  rock.scale.set(1.1, 0.8, 0.9); g.scale.setScalar(scale); world.add(g); return g;
}

/* ==========================================================================
   BUILDINGS ARCHITECTURE & DIVERSE HIMALAYAN STRUCTURES
   ========================================================================== */
function createBuilding(x, z, kind = 'house', scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);

  const stoneMat = mat('#9d998d');
  const darkStone = mat('#6b6961');
  const woodMat = mat('#524032');
  const brickRed = mat('#8b3b32');
  const goldMat = mat('#d4af37', 0.3, 0.4);
  const whiteDome = mat('#eaece8');

  if (kind === 'castle') {
    // Grand Gorkha Citadel Keep with outer battlements and watchtower turrets
    addMesh(g, new THREE.BoxGeometry(4.2, 1.8, 3.2), stoneMat, 0, 0.9, 0);
    // 4 Corner Bastions
    for (const [tx, tz] of [[-2.1, -1.6], [2.1, -1.6], [-2.1, 1.6], [2.1, 1.6]]) {
      addMesh(g, new THREE.CylinderGeometry(0.55, 0.65, 3.2, 8), darkStone, tx, 1.5, tz);
      addMesh(g, new THREE.ConeGeometry(0.65, 0.95, 8), brickRed, tx, 3.5, tz);
    }
    // Main Royal Keep
    addMesh(g, new THREE.BoxGeometry(2.2, 2.8, 1.8), stoneMat, 0, 2.2, 0);
    addMesh(g, new THREE.ConeGeometry(1.6, 1.1, 4), brickRed, 0, 4.1, 0).rotation.y = Math.PI / 4;
    // Central Pagoda Pinnacle & Banners
    addMesh(g, new THREE.BoxGeometry(0.35, 0.35, 0.35), goldMat, 0, 4.8, 0);
    const flagPole = addMesh(g, new THREE.CylinderGeometry(0.04, 0.04, 2.0, 6), mat('#c8b58b'), 0.5, 4.8, 0);
    const banner = addMesh(g, new THREE.BoxGeometry(0.9, 0.5, 0.05), brickRed, 0.95, 5.3, 0);
    banner.userData.isBanner = true;
    addMesh(g, new THREE.BoxGeometry(1.4, 1.4, 0.25), woodMat, 0, 0.7, 1.62); // Heavy timber gate
  } else if (kind === 'barracks') {
    // Military training barracks with weapon racks
    addMesh(g, new THREE.BoxGeometry(2.8, 1.4, 1.8), stoneMat, 0, 0.7, 0);
    addMesh(g, new THREE.BoxGeometry(3.1, 0.4, 2.1), woodMat, 0, 1.45, 0);
    const roof = addMesh(g, new THREE.ConeGeometry(2.1, 0.8, 4), brickRed, 0, 2.0, 0);
    roof.rotation.y = Math.PI / 4;
    // Training dummy & weapon rack
    addMesh(g, new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6), woodMat, 1.8, 0.55, 0.5);
    addMesh(g, new THREE.BoxGeometry(0.6, 0.4, 0.2), mat('#6d4536'), 1.8, 0.75, 0.5);
    addMesh(g, new THREE.BoxGeometry(0.1, 0.8, 0.08), mat('#a0aab0'), 1.8, 0.75, 0.5).rotation.z = 0.3;
  } else if (kind === 'armory') {
    // Forge & Smithy with smoking stone chimney
    addMesh(g, new THREE.BoxGeometry(2.2, 1.3, 1.8), darkStone, 0, 0.65, 0);
    addMesh(g, new THREE.ConeGeometry(1.6, 0.7, 4), mat('#4a443e'), 0, 1.6, 0).rotation.y = Math.PI / 4;
    // Stone chimney
    addMesh(g, new THREE.BoxGeometry(0.55, 2.4, 0.55), darkStone, -0.9, 1.2, -0.6);
    // Anvil
    addMesh(g, new THREE.CylinderGeometry(0.2, 0.3, 0.4, 8), woodMat, 0.9, 0.2, 1.1);
    addMesh(g, new THREE.BoxGeometry(0.35, 0.18, 0.22), mat('#8c949a', 0.2, 0.8), 0.9, 0.45, 1.1);
  } else if (kind === 'temple') {
    // Traditional Multi-tiered Nepalese Pagoda Temple
    addMesh(g, new THREE.BoxGeometry(2.4, 1.2, 2.4), stoneMat, 0, 0.6, 0);
    // Tier 1 roof
    addMesh(g, new THREE.ConeGeometry(2.1, 0.6, 4), brickRed, 0, 1.4, 0).rotation.y = Math.PI / 4;
    // Tier 2 level
    addMesh(g, new THREE.BoxGeometry(1.5, 0.9, 1.5), woodMat, 0, 1.8, 0);
    addMesh(g, new THREE.ConeGeometry(1.4, 0.55, 4), brickRed, 0, 2.45, 0).rotation.y = Math.PI / 4;
    // Tier 3 pinnacle
    addMesh(g, new THREE.BoxGeometry(0.8, 0.6, 0.8), woodMat, 0, 2.7, 0);
    addMesh(g, new THREE.ConeGeometry(0.85, 0.5, 4), goldMat, 0, 3.15, 0).rotation.y = Math.PI / 4;
    addMesh(g, new THREE.CylinderGeometry(0.04, 0.08, 0.5, 8), goldMat, 0, 3.6, 0); // Golden Gajur
  } else if (kind === 'stupa') {
    // Sacred Mountain Stupa (Chorten)
    addMesh(g, new THREE.BoxGeometry(2.2, 0.6, 2.2), stoneMat, 0, 0.3, 0);
    addMesh(g, new THREE.SphereGeometry(0.85, 14, 10), whiteDome, 0, 1.1, 0).scale.set(1, 0.85, 1);
    addMesh(g, new THREE.BoxGeometry(0.65, 0.55, 0.65), goldMat, 0, 1.9, 0); // Harmika
    addMesh(g, new THREE.ConeGeometry(0.42, 0.95, 10), goldMat, 0, 2.55, 0); // Spire
  } else if (kind === 'granary') {
    // Elevated grain storehouse on pillars
    for (const [px, pz] of [[-0.8, -0.6], [0.8, -0.6], [-0.8, 0.6], [0.8, 0.6]]) {
      addMesh(g, new THREE.CylinderGeometry(0.12, 0.15, 0.9, 6), darkStone, px, 0.45, pz);
    }
    addMesh(g, new THREE.BoxGeometry(2.2, 1.4, 1.8), woodMat, 0, 1.45, 0);
    const roof = addMesh(g, new THREE.ConeGeometry(1.8, 0.8, 4), mat('#8c744c'), 0, 2.45, 0);
    roof.rotation.y = Math.PI / 4;
  } else if (kind === 'watchtower') {
    // Tall stone defense tower
    addMesh(g, new THREE.CylinderGeometry(0.7, 0.95, 3.8, 8), stoneMat, 0, 1.9, 0);
    addMesh(g, new THREE.CylinderGeometry(1.1, 0.9, 0.6, 8), woodMat, 0, 3.9, 0);
    addMesh(g, new THREE.ConeGeometry(1.25, 0.9, 8), brickRed, 0, 4.6, 0);
    const flag = addMesh(g, new THREE.BoxGeometry(0.65, 0.35, 0.04), mat('#c23a2f'), 0.4, 5.2, 0);
    flag.userData.isBanner = true;
  } else if (kind === 'bazaar') {
    // Himalayan Trade Bazaar with 3 colorful awnings
    addMesh(g, new THREE.BoxGeometry(3.2, 0.25, 2.2), stoneMat, 0, 0.12, 0);
    const colors = ['#b8392e', '#cf9b32', '#2f7462'];
    for (let i = 0; i < 3; i++) {
      const bx = -1.0 + i * 1.0;
      addMesh(g, new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), woodMat, bx - 0.35, 0.6, 0.6);
      addMesh(g, new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), woodMat, bx + 0.35, 0.6, 0.6);
      addMesh(g, new THREE.BoxGeometry(0.85, 0.45, 0.5), woodMat, bx, 0.3, 0.3); // Counter
      const awning = addMesh(g, new THREE.BoxGeometry(0.95, 0.06, 0.9), mat(colors[i]), bx, 1.25, 0.35);
      awning.rotation.x = 0.2;
    }
  } else if (kind === 'stables') {
    // Highland War Cavalry Stables: timber paddock, sheltered stalls & hay bale
    addMesh(g, new THREE.BoxGeometry(3.2, 0.2, 2.4), darkStone, 0, 0.1, 0);
    addMesh(g, new THREE.BoxGeometry(2.8, 1.3, 1.2), woodMat, 0, 0.75, -0.5); // Sheltered stalls
    const stallRoof = addMesh(g, new THREE.BoxGeometry(3.1, 0.15, 1.6), brickRed, 0, 1.48, -0.45);
    stallRoof.rotation.x = 0.15;
    // Paddock fence rails
    for (const [fx, fz] of [[-1.4, 0.9], [0, 0.9], [1.4, 0.9]]) {
      addMesh(g, new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), woodMat, fx, 0.45, fz);
    }
    addMesh(g, new THREE.BoxGeometry(2.8, 0.08, 0.06), woodMat, 0, 0.65, 0.9);
    addMesh(g, new THREE.BoxGeometry(0.7, 0.5, 0.6), mat('#c9af59'), 0.9, 0.25, 0.4); // Golden hay bale
  } else if (kind === 'range') {
    // Himalayan Archery Range: shooting shelter & archery target butts
    addMesh(g, new THREE.BoxGeometry(2.4, 1.2, 1.4), woodMat, -0.6, 0.6, 0);
    const rangeRoof = addMesh(g, new THREE.ConeGeometry(1.6, 0.6, 4), mat('#6d523b'), -0.6, 1.45, 0);
    rangeRoof.rotation.y = Math.PI / 4;
    // Archery Target Butt
    addMesh(g, new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), woodMat, 1.2, 0.6, 0);
    const targetDisc = addMesh(g, new THREE.CylinderGeometry(0.48, 0.48, 0.1, 16), mat('#ede1ba'), 1.2, 0.95, 0);
    targetDisc.rotation.z = Math.PI / 2;
    const bullseye = addMesh(g, new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16), mat('#b53026'), 1.2, 0.95, 0);
    bullseye.rotation.z = Math.PI / 2;
  } else if (kind === 'lumbermill') {
    // Pine Forest Timber Mill: saw shed & timber log piles
    addMesh(g, new THREE.BoxGeometry(2.6, 1.3, 1.8), woodMat, 0, 0.65, 0);
    const millRoof = addMesh(g, new THREE.ConeGeometry(1.9, 0.7, 4), mat('#5c4939'), 0, 1.6, 0);
    millRoof.rotation.y = Math.PI / 4;
    // Stack of logs
    for (let l = 0; l < 3; l++) {
      const log = addMesh(g, new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8), mat('#6e4e37'), 1.3, 0.15 + l * 0.18, 0.3);
      log.rotation.z = Math.PI / 2;
    }
  } else if (kind === 'foundry') {
    // Mountain Iron Smelter: heavy stone foundry with blast furnace chimney
    addMesh(g, new THREE.BoxGeometry(2.6, 1.4, 2.0), darkStone, 0, 0.7, 0);
    addMesh(g, new THREE.CylinderGeometry(0.4, 0.55, 3.2, 10), mat('#4a443d'), -0.8, 1.6, -0.6); // Tall smelter stack
    addMesh(g, new THREE.ConeGeometry(0.5, 0.4, 10), mat('#b54228'), -0.8, 3.3, -0.6); // Glowing top
    // Stack of iron ingots
    addMesh(g, new THREE.BoxGeometry(0.6, 0.35, 0.5), mat('#8c98a0', 0.3, 0.7), 0.9, 0.18, 0.6);
  } else if (kind === 'masonry') {
    // Granite Quarry Masonry: stone-cutter station with ashlar blocks & hoist
    addMesh(g, new THREE.BoxGeometry(2.4, 1.2, 1.8), stoneMat, -0.4, 0.6, 0);
    addMesh(g, new THREE.ConeGeometry(1.6, 0.65, 4), mat('#636869'), -0.4, 1.45, 0).rotation.y = Math.PI / 4;
    // Dressed stone blocks
    addMesh(g, new THREE.BoxGeometry(0.6, 0.6, 0.6), mat('#b0b4b2'), 1.1, 0.3, 0.3);
    addMesh(g, new THREE.BoxGeometry(0.5, 0.5, 0.5), mat('#929896'), 1.1, 0.85, 0.3);
  } else if (kind === 'watermill') {
    // Terrace Watermill & Grain Basin
    addMesh(g, new THREE.BoxGeometry(2.4, 1.4, 1.8), woodMat, 0, 0.7, 0);
    const waterRoof = addMesh(g, new THREE.ConeGeometry(1.7, 0.8, 4), brickRed, 0, 1.7, 0);
    waterRoof.rotation.y = Math.PI / 4;
    // Rotating waterwheel
    const wheel = addMesh(g, new THREE.CylinderGeometry(0.9, 0.9, 0.22, 12), mat('#423528'), 1.4, 0.65, 0);
    wheel.rotation.z = Math.PI / 2;
    wheel.userData.isWaterwheel = true;
  } else {
    // Traditional Himalayan Village Dwelling / Farmstead
    addMesh(g, new THREE.BoxGeometry(1.8, 1.2, 1.5), stoneMat, 0, 0.6, 0);
    const roof = addMesh(g, new THREE.ConeGeometry(1.4, 0.75, 4), brickRed, 0, 1.55, 0);
    roof.rotation.y = Math.PI / 4;
    addMesh(g, new THREE.BoxGeometry(0.35, 0.65, 0.1), woodMat, 0, 0.32, 0.77); // Wooden door
    addMesh(g, new THREE.BoxGeometry(0.3, 0.3, 0.08), woodMat, -0.5, 0.65, 0.77); // Carved window
  }

  world.add(g);
  if (kind === 'castle') applyGLBVisual(g, 'gorkha_hillfort.glb');
  return g;
}

/* ==========================================================================
   TROOP & WEAPON ARCHITECTURE
   ========================================================================== */
function createWarriorModel(type = 'infantry', color = '#9b493c') {
  const g = new THREE.Group();
  const skin = mat('#bd8d6a'), cloth = mat(color), dark = mat('#332f2b'), steel = mat('#9ca9af', 0.4, 0.55), wood = mat('#74513a');

  addMesh(g, new THREE.CylinderGeometry(0.24, 0.32, 0.78, 8), cloth, 0, 1.02, 0);
  addMesh(g, new THREE.SphereGeometry(0.22, 12, 10), skin, 0, 1.58, 0);
  addMesh(g, new THREE.CylinderGeometry(0.235, 0.245, 0.11, 8), dark, 0, 1.75, 0);
  addMesh(g, new THREE.TorusGeometry(0.22, 0.055, 5, 12), cloth, 0, 1.72, 0).rotation.x = Math.PI / 2;

  const animatedArms = [];
  for (const sx of [-1, 1]) {
    const arm = addMesh(g, new THREE.CylinderGeometry(0.075, 0.09, 0.55, 7), cloth, sx * 0.31, 1.13, 0.02);
    arm.rotation.z = sx * -0.2;
    animatedArms.push({ mesh: arm, side: sx, base: arm.rotation.z });
    addMesh(g, new THREE.CylinderGeometry(0.07, 0.07, 0.62, 7), dark, sx * 0.14, 0.42, 0);
  }
  addMesh(g, new THREE.BoxGeometry(0.17, 0.12, 0.13), dark, 0, 0.12, 0.02);

  const animatedWeapons = [];

  if (type === 'infantry') {
    const swordGroup = new THREE.Group();
    swordGroup.position.set(0.48, 1.0, 0.1);
    const blade = addMesh(swordGroup, new THREE.BoxGeometry(0.075, 0.78, 0.08), steel, 0, 0.32, 0);
    blade.rotation.z = -0.15;
    addMesh(swordGroup, new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8), dark, 0, -0.05, 0);
    g.add(swordGroup);
    animatedWeapons.push({ mesh: swordGroup, baseRotZ: -0.2, baseRotX: 0, type: 'sword' });
    const shield = addMesh(g, new THREE.CylinderGeometry(0.26, 0.26, 0.06, 12), mat('#6d2e28', 0.5, 0.2), -0.42, 1.06, 0.15);
    shield.rotation.x = Math.PI / 2;
  } else if (type === 'archer') {
    const bowGroup = new THREE.Group();
    bowGroup.position.set(0.42, 1.2, 0.08);
    const bow = addMesh(bowGroup, new THREE.TorusGeometry(0.35, 0.038, 6, 16, Math.PI), wood, 0, 0, 0);
    bow.rotation.z = Math.PI / 2;
    const arrow = addMesh(bowGroup, new THREE.CylinderGeometry(0.018, 0.018, 0.65, 5), steel, 0.05, 0, 0.02);
    arrow.rotation.z = -0.1;
    g.add(bowGroup);
    animatedWeapons.push({ mesh: bowGroup, arrowMesh: arrow, baseRotZ: 0, baseRotX: 0, type: 'bow' });
    addMesh(g, new THREE.BoxGeometry(0.12, 0.5, 0.12), wood, -0.28, 1.45, -0.16).rotation.z = 0.2;
  } else {
    const spearGroup = new THREE.Group();
    spearGroup.position.set(0.44, 1.2, 0.05);
    const shaft = addMesh(spearGroup, new THREE.CylinderGeometry(0.035, 0.035, 1.4, 7), wood, 0, 0.2, 0);
    shaft.rotation.x = Math.PI / 2.3;
    const spearHead = addMesh(spearGroup, new THREE.ConeGeometry(0.08, 0.35, 6), steel, 0, 0.85, 0.45);
    spearHead.rotation.x = Math.PI / 2.3;
    g.add(spearGroup);
    animatedWeapons.push({ mesh: spearGroup, basePosZ: 0, baseRotX: 0, type: 'spear' });

    const horse = new THREE.Group();
    addMesh(horse, new THREE.BoxGeometry(0.58, 0.55, 1.1), mat('#6d4b35'), 0, 0.65, -0.05);
    addMesh(horse, new THREE.BoxGeometry(0.28, 0.62, 0.28), mat('#6d4b35'), 0, 0.98, 0.44).rotation.x = -0.25;
    addMesh(horse, new THREE.SphereGeometry(0.2, 8, 7), mat('#6d4b35'), 0, 1.26, 0.6);
    for (const sx of [-0.18, 0.18]) {
      for (const sz of [-0.38, 0.32]) {
        addMesh(horse, new THREE.CylinderGeometry(0.06, 0.075, 0.68, 6), mat('#4a382b'), sx, 0.3, sz);
      }
    }
    horse.position.y = -0.02;
    g.add(horse);
    g.userData.horse = horse;
  }

  const miningTool = new THREE.Group();
  const handle = addMesh(miningTool, new THREE.CylinderGeometry(0.035, 0.045, 0.62, 6), wood, 0, 0.1, 0);
  handle.rotation.z = -0.38;
  const pickHead = addMesh(miningTool, new THREE.BoxGeometry(0.48, 0.09, 0.1), steel, 0.1, 0.36, 0);
  pickHead.rotation.z = -0.18;
  miningTool.position.set(0.48, 1.05, 0.12);
  miningTool.rotation.z = -0.25;
  miningTool.visible = false;
  g.add(miningTool);

  g.userData.animParts = { arms: animatedArms, weapons: animatedWeapons, type, miningTool };
  return g;
}

function createArmy() {
  const g = new THREE.Group();
  const bannerPole = addMesh(g, new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6), mat('#b4a080'), -0.7, 1.5, -0.15);
  const banner = addMesh(g, new THREE.BoxGeometry(0.8, 0.48, 0.05), mat('#a83d34'), -0.32, 2.15, -0.15);
  banner.userData.banner = true;
  const models = [];
  for (let i = 0; i < 15; i++) {
    const type = (i === 4 || i === 10) ? 'cavalry' : (i === 2 || i === 7 || i === 12 ? 'archer' : 'infantry');
    const m = createWarriorModel(type, type === 'archer' ? '#71886d' : (type === 'cavalry' ? '#806343' : '#9d4438'));
    const col = i % 5, row = Math.floor(i / 5);
    const baseX = (col - 2) * 0.58;
    const baseZ = (row - 1) * 0.62 + 0.25;
    m.position.set(baseX, 0, baseZ);
    m.userData.baseX = baseX;
    m.userData.baseZ = baseZ;
    m.scale.setScalar(type === 'cavalry' ? 0.66 : 0.72);
    g.add(m);
    models.push(m);
  }
  g.userData.models = models;
  return g;
}

function createResource(data) {
  const g = new THREE.Group();
  const c = data.type === 'wood' ? '#487447' : data.type === 'iron' ? '#818d91' : data.type === 'stone' ? '#9a9c95' : data.type === 'gold' ? '#d0a74c' : '#6f9860';
  if (data.type === 'wood') {
    addMesh(g, new THREE.CylinderGeometry(0.18, 0.25, 1.6, 7), mat('#5d422e'), 0, 0.8, 0);
    for (let i = 0; i < 3; i++) addMesh(g, new THREE.ConeGeometry(0.85 - i * 0.12, 1.15, 7), mat('#376345'), 0, 1.5 + i * 0.5, 0);
  } else if (data.type === 'iron' || data.type === 'stone' || data.type === 'gold') {
    for (let i = 0; i < 5; i++) {
      const r = addMesh(g, new THREE.DodecahedronGeometry(0.45 + Math.random() * 0.22, 0), mat(c, 0.6, 0.15), (Math.random() - 0.5) * 1.1, 0.4 + Math.random() * 0.35, (Math.random() - 0.5) * 0.7);
      r.rotation.set(Math.random(), Math.random(), Math.random());
    }
    if (data.type === 'gold') addMesh(g, new THREE.OctahedronGeometry(0.22), mat('#f4d77c', 0.3, 0.25), 0, 0.9, 0);
  } else {
    addMesh(g, new THREE.BoxGeometry(1, 0.55, 0.85), mat('#8c7448'), 0, 0.28, 0);
    addMesh(g, new THREE.BoxGeometry(0.35, 0.6, 0.35), mat('#b8a071'), 0, 0.75, 0);
  }
  g.position.set(data.x, 0, data.z);
  const label = makeLabelSprite(data.name); label.position.set(0, 2.5, 0); g.add(label);
  const assetByType = { wood: 'timber_node.glb', iron: 'iron_vein.glb', stone: 'stone_quarry.glb', gold: 'gold_seam.glb' };
  if (assetByType[data.type]) applyGLBVisual(g, assetByType[data.type]);
  return registerObject(g, data);
}

function createMonster(data) {
  const g = new THREE.Group();
  g.userData.monsterType = data.type;

  if (data.type === 'bear') {
    const fur = mat('#e2e5dc'), dark = mat('#424746'), nose = mat('#292b2b');
    const body = addMesh(g, new THREE.SphereGeometry(0.68, 14, 12), fur, 0, 0.85, 0);
    body.scale.set(1.05, 0.85, 1.25);
    const head = addMesh(g, new THREE.SphereGeometry(0.46, 12, 10), fur, 0, 1.36, 0.48);
    head.scale.set(1, 0.92, 0.9);
    addMesh(g, new THREE.SphereGeometry(0.15, 8, 7), dark, -0.3, 1.67, 0.43);
    addMesh(g, new THREE.SphereGeometry(0.15, 8, 7), dark, 0.3, 1.67, 0.43);
    addMesh(g, new THREE.SphereGeometry(0.14, 8, 7), nose, 0, 1.29, 0.91);

    const paws = [];
    for (const sx of [-0.42, 0.42]) {
      const forepaw = new THREE.Group();
      forepaw.position.set(sx, 0.75, 0.45);
      addMesh(forepaw, new THREE.CylinderGeometry(0.13, 0.16, 0.65, 8), fur, 0, -0.28, 0);
      g.add(forepaw);
      paws.push(forepaw);
      addMesh(g, new THREE.CylinderGeometry(0.15, 0.18, 0.58, 8), fur, sx, 0.35, -0.42);
    }
    g.userData.defensiveParts = { paws, head, body };
  } else if (data.type === 'rabbit') {
    const fur = mat('#edf0e8');
    const body = addMesh(g, new THREE.SphereGeometry(0.35, 12, 10), fur, 0, 0.4, 0);
    body.scale.set(1, 0.9, 1.2);
    const head = addMesh(g, new THREE.SphereGeometry(0.24, 12, 10), fur, 0, 0.68, 0.28);
    const ears = [];
    for (const sx of [-0.12, 0.12]) {
      const ear = addMesh(g, new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), fur, sx, 0.99, 0.28);
      ear.rotation.z = sx < 0 ? -0.18 : 0.18;
      ears.push(ear);
    }
    addMesh(g, new THREE.SphereGeometry(0.045, 8, 6), mat('#343737'), -0.08, 0.72, 0.48);
    addMesh(g, new THREE.SphereGeometry(0.045, 8, 6), mat('#343737'), 0.08, 0.72, 0.48);
    g.userData.defensiveParts = { ears, body, head };
  } else {
    // Dark Knight / Raider
    const armor = mat(data.type === 'raider' ? '#5a3d31' : '#242a30', 0.36, 0.7);
    const trim = mat('#8e3935', 0.5, 0.4);
    addMesh(g, new THREE.BoxGeometry(0.8, 1.1, 0.5), armor, 0, 1.0, 0);
    addMesh(g, new THREE.SphereGeometry(0.3, 10, 9), armor, 0, 1.8, 0.02);
    addMesh(g, new THREE.BoxGeometry(0.42, 0.08, 0.07), mat('#d8a36e', 0.3, 0.3), 0, 1.82, 0.29);
    addMesh(g, new THREE.BoxGeometry(0.95, 0.22, 0.57), trim, 0, 1.48, 0);
    for (const sx of [-0.48, 0.48]) addMesh(g, new THREE.CylinderGeometry(0.12, 0.16, 0.85, 7), armor, sx, 1.0, 0);

    const knightSword = new THREE.Group();
    knightSword.position.set(0.72, 1.0, 0.08);
    addMesh(knightSword, new THREE.BoxGeometry(0.11, 1.4, 0.12), mat('#a9b3ba', 0.3, 0.75), 0, 0.5, 0);
    addMesh(knightSword, new THREE.BoxGeometry(0.22, 0.25, 0.18), armor, 0, -0.2, 0);
    g.add(knightSword);

    const knightShield = new THREE.Group();
    knightShield.position.set(-0.65, 1.15, 0.12);
    addMesh(knightShield, new THREE.BoxGeometry(0.58, 0.88, 0.1), mat('#5c2622', 0.4, 0.4), 0, 0, 0);
    addMesh(knightShield, new THREE.BoxGeometry(0.64, 0.08, 0.12), mat('#b29352'), 0, 0, 0);
    g.add(knightShield);

    for (const sx of [-0.22, 0.22]) addMesh(g, new THREE.CylinderGeometry(0.14, 0.17, 0.72, 7), armor, sx, 0.35, 0);
    g.userData.defensiveParts = { sword: knightSword, shield: knightShield };
  }

  g.position.set(data.x, 0, data.z);
  const label = makeLabelSprite(data.name, data.type === 'knight' ? '#f1b5a9' : '#f2f0e4');
  label.position.set(0, data.type === 'bear' ? 2.35 : 1.85, 0);
  g.add(label);

  const result = registerObject(g, data);
  if (data.type === 'rabbit') animated.push({ obj: g, kind: 'rabbit', baseY: 0, phase: Math.random() * 6 });
  if (data.type === 'bear') animated.push({ obj: g, kind: 'bear', baseY: 0, phase: Math.random() * 6 });
  if (data.type === 'knight' || data.type === 'raider') animated.push({ obj: g, kind: 'knight', baseY: 0, phase: Math.random() * 6 });
  return result;
}

function clearWorld() {
  while (world.children.length) {
    const child = world.children.pop();
    child.traverse?.(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }
  pickables.length = 0;
  objects.length = 0;
  animated.length = 0;
  mapObjects.clear();
  world.add(weatherParticleSystem);
}

/* ==========================================================================
   BUILD EXPANDED WORLD (160x130 VAST REALM, DENSE STRUCTURES & ABUNDANT ASSETS)
   ========================================================================== */
function buildMap(mapId) {
  currentMap = mapId;
  selectedObject = null;
  clearWorld();
  const config = maps[mapId];

  scene.background.set(config.snow ? '#a5beca' : mapId === 'forest' ? '#688b7b' : mapId === 'mountain' ? '#8b9794' : '#8ba3a1');
  scene.fog.color.copy(scene.background);
  createGround(config);

  // 44 Perimeter Himalayan Peaks encircling the vast 160x130 territory
  for (let i = 0; i < 44; i++) {
    const angle = (i / 44) * Math.PI * 2;
    const dist = 72 + Math.random() * 12;
    const x = Math.cos(angle) * (dist * 1.15);
    const z = Math.sin(angle) * dist;
    const peak = addMesh(world, new THREE.ConeGeometry(4.5 + Math.random() * 3.2, 8 + Math.random() * 6, 7), mat(config.snow ? '#d8e4e5' : '#64756e'), x, 3.5, z, false);
    peak.rotation.y = Math.random() * Math.PI;
    if (config.snow || i % 2 === 0 || z < -20) {
      addMesh(world, new THREE.ConeGeometry(2.4, 3.8, 7), mat('#f0f3ed'), x, 6.2, z + 0.15, false);
    }
  }

  // 140+ Himalayan Pine Trees in lush groves across the territory
  for (let i = 0; i < 140; i++) {
    const x = (Math.random() - 0.5) * 144;
    const z = (Math.random() - 0.5) * 114;
    // Don't spawn inside citadel courtyard or river center
    if (Math.hypot(x - (-14), z - 10) < 11) continue;
    if (Math.abs(z - (-0.01 * x - 10)) < 3.2 && Math.abs(x) < 40) continue;
    createTree(x, z, 0.7 + Math.random() * 0.85, config.snow);
  }

  // ==========================================
  // KINGDOM STRUCTURES & ALL ASSET REQUIREMENTS
  // ==========================================
  // 1. Gorkha Citadel Keep (Level 18 - Supreme Command)
  const castle = createBuilding(-14, 10, 'castle', 1.15);
  const castleData = {
    id: 'home-castle',
    name: 'Gorkha Citadel Keep',
    kind: 'castle',
    type: 'castle',
    category: 'Government',
    level: 18,
    x: -14,
    z: 10,
    health: 1500,
    maxQuantity: 1500,
    description: 'Supreme royal fortified keep, central granary authority, and army garrison.',
    guard: 'Royal Garrison'
  };
  registerObject(castle, castleData);

  // 2. Royal Gurkha/Magar Barracks (Level 8)
  const barracks = createBuilding(-7, 13, 'barracks', 0.95);
  const barracksData = {
    id: 'bldg-barracks',
    name: 'Royal Vanguard Barracks',
    kind: 'building',
    type: 'barracks',
    category: 'Military',
    level: 8,
    x: -7,
    z: 13,
    health: 750,
    maxQuantity: 750,
    description: 'Elite martial quarters where Magar Infantry, Cavalry, and Archers train.',
    guard: 'Drill Masters'
  };
  registerObject(barracks, barracksData);

  // 3. Highland War Cavalry Stables (Level 7)
  const stables = createBuilding(-2, 18, 'stables', 1.0);
  const stablesData = {
    id: 'bldg-stables',
    name: 'Highland Cavalry Stables',
    kind: 'building',
    type: 'stables',
    category: 'Military',
    level: 7,
    x: -2,
    z: 18,
    health: 680,
    maxQuantity: 680,
    description: 'Breeding paddocks training mountain steeds for lightning spear charges.',
    guard: 'Stable Master'
  };
  registerObject(stables, stablesData);

  // 4. Himalayan Archery Range (Level 7)
  const range = createBuilding(-16, 20, 'range', 0.95);
  const rangeData = {
    id: 'bldg-range',
    name: 'Himalayan Archery Range',
    kind: 'building',
    type: 'range',
    category: 'Military',
    level: 7,
    x: -16,
    z: 20,
    health: 600,
    maxQuantity: 600,
    description: 'Target butts and bowyers training high-angle valley arrow volleys.',
    guard: 'Master Bowyer'
  };
  registerObject(range, rangeData);

  // 5. Khukuri Armory & Steel Forge (Level 7)
  const armory = createBuilding(-21, 12, 'armory', 0.95);
  const armoryData = {
    id: 'bldg-armory',
    name: 'Khukuri Armory & Forge',
    kind: 'building',
    type: 'armory',
    category: 'Military',
    level: 7,
    x: -21,
    z: 12,
    health: 650,
    maxQuantity: 650,
    description: 'Blacksmith forges steel blades, spear tips, and arrowhead armor.',
    guard: 'Master Smith'
  };
  registerObject(armory, armoryData);

  // 6. Sacred Multi-Tiered Pagoda Temple (Level 10)
  const temple = createBuilding(-10, 3, 'temple', 1.0);
  const templeData = {
    id: 'bldg-temple',
    name: 'Sacred Taleju Temple',
    kind: 'building',
    type: 'temple',
    category: 'Sacred',
    level: 10,
    x: -10,
    z: 3,
    health: 800,
    maxQuantity: 800,
    description: 'Ancient mountain pagoda blessing the realm with divine stability and moral strength.',
    guard: 'Monastery Guard'
  };
  registerObject(temple, templeData);

  // 7. Mountain Boudha Stupa (Level 6)
  const stupa = createBuilding(16, 20, 'stupa', 1.05);
  const stupaData = {
    id: 'bldg-stupa',
    name: 'Eastern Mountain Stupa',
    kind: 'building',
    type: 'stupa',
    category: 'Sacred',
    level: 6,
    x: 16,
    z: 20,
    health: 650,
    maxQuantity: 650,
    description: 'Sacred chorten shrine radiating peaceful vigilance across the mountain passes.',
    guard: 'Guardian Lamas'
  };
  registerObject(stupa, stupaData);

  // 8. Imperial Granary & Storage (Level 9)
  const granary = createBuilding(-19, 4, 'granary', 0.9);
  const granaryData = {
    id: 'bldg-granary',
    name: 'Imperial Provision Granary',
    kind: 'building',
    type: 'granary',
    category: 'Economy',
    level: 9,
    x: -19,
    z: 4,
    health: 550,
    maxQuantity: 550,
    description: 'Elevated timber silos safeguarding kingdom food and grain reserves (+45 Food/min).',
    guard: 'Quartermaster'
  };
  registerObject(granary, granaryData);

  // 9. Pine Forest Timber Mill (Level 8)
  const lumbermill = createBuilding(-42, 14, 'lumbermill', 1.0);
  const lumbermillData = {
    id: 'bldg-lumbermill',
    name: 'Western Pine Logging Mill',
    kind: 'building',
    type: 'lumbermill',
    category: 'Economy',
    level: 8,
    x: -42,
    z: 14,
    health: 620,
    maxQuantity: 620,
    description: 'Highland timber station providing logs for fortress ramparts and bows (+40 Wood/min).',
    guard: 'Forester Wardens'
  };
  registerObject(lumbermill, lumbermillData);

  // 10. Granite Quarry Masonry (Level 7)
  const masonry = createBuilding(28, 12, 'masonry', 1.0);
  const masonryData = {
    id: 'bldg-masonry',
    name: 'Granite Quarry Masonry',
    kind: 'building',
    type: 'masonry',
    category: 'Economy',
    level: 7,
    x: 28,
    z: 12,
    health: 700,
    maxQuantity: 700,
    description: 'Hewn stone-cutting workshop shaping slate and granite blocks for keep upgrades (+35 Stone/min).',
    guard: 'Quarry Guild'
  };
  registerObject(masonry, masonryData);

  // 11. Mountain Iron Foundry & Smelter (Level 8)
  const foundry = createBuilding(-36, -14, 'foundry', 1.0);
  const foundryData = {
    id: 'bldg-foundry',
    name: 'Deep Ridge Iron Smelter',
    kind: 'building',
    type: 'foundry',
    category: 'Economy',
    level: 8,
    x: -36,
    z: -14,
    health: 720,
    maxQuantity: 720,
    description: 'High-heat blast smelter processing raw mountain veins into refined war ingots (+30 Iron/min).',
    guard: 'Smelter Master'
  };
  registerObject(foundry, foundryData);

  // 12. Terrace Watermill & Grain Basin (Level 6)
  const watermill = createBuilding(14, 34, 'watermill', 1.05);
  const watermillData = {
    id: 'bldg-watermill',
    name: 'Terrace Farmland Watermill',
    kind: 'building',
    type: 'watermill',
    category: 'Economy',
    level: 6,
    x: 14,
    z: 34,
    health: 580,
    maxQuantity: 580,
    description: 'Water-powered grain mill grinding highland barley along irrigation canals (+50 Food/min).',
    guard: 'Miller Guild'
  };
  registerObject(watermill, watermillData);

  // 13. Himalayan Silk Bazaar (Level 5)
  const bazaar = createBuilding(6, 2, 'bazaar', 1.0);
  const bazaarData = {
    id: 'bldg-bazaar',
    name: 'Himalayan Silk Bazaar',
    kind: 'building',
    type: 'bazaar',
    category: 'Economy',
    level: 5,
    x: 6,
    z: 2,
    health: 500,
    maxQuantity: 500,
    description: 'Lively cross-mountain trade market exchanging precious spices, iron ore, and silk.',
    guard: 'Caravan Guild'
  };
  registerObject(bazaar, bazaarData);

  // 14. North Glacier Watchtower (Level 12)
  const tower1 = createBuilding(-4, -32, 'watchtower', 0.95);
  const tower1Data = {
    id: 'bldg-tower-north',
    name: 'North Glacier Watchtower',
    kind: 'building',
    type: 'watchtower',
    category: 'Defense',
    level: 12,
    x: -4,
    z: -32,
    health: 900,
    maxQuantity: 900,
    description: 'High sentinel stone tower watching for beasts descending from snowy northern passes.',
    guard: 'Archery Garrison'
  };
  registerObject(tower1, tower1Data);

  // 15. River Valley Watchtower (Level 11)
  const tower2 = createBuilding(26, -6, 'watchtower', 0.95);
  const tower2Data = {
    id: 'bldg-tower-south',
    name: 'River Valley Watchtower',
    kind: 'building',
    type: 'watchtower',
    category: 'Defense',
    level: 11,
    x: 26,
    z: -6,
    health: 850,
    maxQuantity: 850,
    description: 'Guards the eastern river crossing and road intersection against bandits.',
    guard: 'Sentinel Guard'
  };
  registerObject(tower2, tower2Data);

  // 16. Eastern Frontier Bastion (Level 10)
  const tower3 = createBuilding(52, 14, 'watchtower', 1.05);
  const tower3Data = {
    id: 'bldg-tower-east',
    name: 'Eastern Frontier Bastion',
    kind: 'building',
    type: 'watchtower',
    category: 'Defense',
    level: 10,
    x: 52,
    z: 14,
    health: 950,
    maxQuantity: 950,
    description: 'Heavy frontier stone bastion commanding the highway to the Eastern Mainland Gate.',
    guard: 'Border Garrison'
  };
  registerObject(tower3, tower3Data);

  // 17–23. Mountain Village Settlements Across Expanded Valleys
  const villagePlots = [
    { x: -14, z: -4, name: 'Lower Mill Village' },
    { x: -8, z: -6, name: 'Riverside Homestead' },
    { x: 10, z: 10, name: 'Terrace Valley Dwellings' },
    { x: 22, z: 6, name: 'Eastern Merchant Lodge' },
    { x: -28, z: 18, name: 'High Alpine Settlement' },
    { x: 36, z: 38, name: 'Southern Farmland Village' },
    { x: -52, z: 22, name: 'Western Forest Haven' }
  ];
  villagePlots.forEach((v, idx) => {
    const house = createBuilding(v.x, v.z, 'house', 0.85);
    const houseData = {
      id: `bldg-village-${idx}`,
      name: v.name,
      kind: 'building',
      type: 'house',
      category: 'Economy',
      level: 4 + idx,
      x: v.x,
      z: v.z,
      health: 350,
      maxQuantity: 350,
      description: 'Himalayan stone-and-timber homestead contributing kingdom tax, food, and population.',
      guard: 'Local Villagers'
    };
    registerObject(house, houseData);
  });

  // ==========================================
  // ABUNDANT RESOURCE NODES (18 NODES ACROSS 160x130 LAND)
  // ==========================================
  const resourceData = [
    { id: 'r1', name: 'Central Iron Mountain Vein', type: 'iron', x: 10, z: -3, quantity: 950, maxQuantity: 950, level: 8, description: 'Deep mountain iron seam for forging khukuri blades and armor.' },
    { id: 'r2', name: 'Western Iron Seam', type: 'iron', x: -30, z: 8, quantity: 820, maxQuantity: 820, level: 7, description: 'Rich iron deposits exposed along western foothills.' },
    { id: 'r3', name: 'High Ridge Iron Outcrop', type: 'iron', x: -8, z: -38, quantity: 1100, maxQuantity: 1100, level: 10, description: 'Precipitous northern iron cliff.' },
    { id: 'r4', name: 'Deep Glacier Iron Vein', type: 'iron', x: 28, z: -42, quantity: 1250, maxQuantity: 1250, level: 11, description: 'High-altitude iron ore encased in permafrost.' },
    { id: 'r5', name: 'Ancient Pine Forest', type: 'wood', x: -22, z: -14, quantity: 1100, maxQuantity: 1100, level: 7, description: 'Old-growth Himalayan timber prime for citadel architecture.' },
    { id: 'r6', name: 'Valley Pine Grove', type: 'wood', x: 18, z: -12, quantity: 850, maxQuantity: 850, level: 6, description: 'Tall alpine timber near the eastern trade route.' },
    { id: 'r7', name: 'Southern Wood Clearing', type: 'wood', x: -6, z: 26, quantity: 750, maxQuantity: 750, level: 5, description: 'Sturdy pine timber alongside mountain agricultural terraces.' },
    { id: 'r8', name: 'Far West Deepwood', type: 'wood', x: -58, z: -12, quantity: 1200, maxQuantity: 1200, level: 9, description: 'Dense rhododendron and cedar grove on western ridges.' },
    { id: 'r9', name: 'Royal Stone Quarry', type: 'stone', x: 20, z: 12, quantity: 1200, maxQuantity: 1200, level: 8, description: 'Dense slate and granite for constructing fortresses.' },
    { id: 'r10', name: 'River Granite Quarry', type: 'stone', x: -14, z: -20, quantity: 900, maxQuantity: 900, level: 7, description: 'Workable stone along riverbed slopes.' },
    { id: 'r11', name: 'Eastern Stone Bluff', type: 'stone', x: 38, z: -2, quantity: 850, maxQuantity: 850, level: 7, description: 'Exposed stone cliffs overlooking the eastern lowlands.' },
    { id: 'r12', name: 'Far East Slate Quarry', type: 'stone', x: 62, z: 6, quantity: 1300, maxQuantity: 1300, level: 10, description: 'Massive slate deposits near the border gate.' },
    { id: 'r13', name: 'Sacred Gold Seam', type: 'gold', x: 24, z: 22, quantity: 550, maxQuantity: 550, level: 12, description: 'Rare high-purity gold ore for temple spires and royal crowns.' },
    { id: 'r14', name: 'Glacial Gold Pocket', type: 'gold', x: -22, z: -32, quantity: 480, maxQuantity: 480, level: 13, description: 'Glacier-fed stream with gleaming gold dust.' },
    { id: 'r15', name: 'Eastern Treasure Outcrop', type: 'gold', x: 48, z: -32, quantity: 600, maxQuantity: 600, level: 14, description: 'Gleaming gold veins on eastern slopes.' },
    { id: 'r16', name: 'Terrace Herb Meadows', type: 'food', x: 2, z: 16, quantity: 800, maxQuantity: 800, level: 6, description: 'Fertile terrace farmland harvesting mountain grains.' },
    { id: 'r17', name: 'Southern Berry Valley', type: 'food', x: -30, z: -8, quantity: 650, maxQuantity: 650, level: 5, description: 'Wild provisions and high-altitude medicinal herbs.' },
    { id: 'r18', name: 'South Basin Grain Fields', type: 'food', x: 28, z: 46, quantity: 900, maxQuantity: 900, level: 7, description: 'Golden barley and buckwheat terrace plots.' }
  ];
  resourceData.forEach(d => createResource({ ...d, kind: 'resource', kingdomId: mapId }));

  // ==========================================
  // MONSTERS & WILDLIFE ENCOUNTERS
  // ==========================================
  const monsterData = [
    { id: 'm1', name: 'Himalayan Snow Bear', type: 'bear', kind: 'monster', x: 18, z: -24, level: 10, health: 160, maxQuantity: 160, description: 'Territorial apex beast prowling northern glacier passes.', guard: 'Apex Beast', reward: 140 },
    { id: 'm2', name: 'Western Grizzled Bear', type: 'bear', kind: 'monster', x: -44, z: -8, level: 11, health: 180, maxQuantity: 180, description: 'Massive cave-dwelling bear guarding western forest passes.', guard: 'Hostile', reward: 160 },
    { id: 'm3', name: 'Dark Knight Champion', type: 'knight', kind: 'monster', x: 36, z: -4, level: 16, health: 260, maxQuantity: 260, description: 'Armored renegade warlord commanding the eastern highway.', guard: 'Elite Boss', reward: 320 },
    { id: 'm4', name: 'Highland Raider Captain', type: 'raider', kind: 'monster', x: -4, z: -44, level: 14, health: 200, maxQuantity: 200, description: 'Mountain bandit chieftain occupying the northern glacier peak.', guard: 'Hostile', reward: 220 },
    { id: 'm5', name: 'Border Bandit Warlord', type: 'knight', kind: 'monster', x: 58, z: -14, level: 15, health: 240, maxQuantity: 240, description: 'Ruthless warlord menacing trade caravans along the eastern border.', guard: 'Elite Boss', reward: 290 },
    { id: 'm6', name: 'Alpine Snow Hare', type: 'rabbit', kind: 'animal', x: -4, z: 8, level: 2, health: 35, maxQuantity: 35, description: 'Agile mountain rabbit hopping across terrace steps.', guard: 'Wildlife', reward: 14 },
    { id: 'm7', name: 'Highland White Hare', type: 'rabbit', kind: 'animal', x: 14, z: -10, level: 3, health: 40, maxQuantity: 40, description: 'Wildlife browsing peacefully near the riverbank grove.', guard: 'Wildlife', reward: 18 },
    { id: 'm8', name: 'Southern Meadow Hare', type: 'rabbit', kind: 'animal', x: 22, z: 32, level: 2, health: 30, maxQuantity: 30, description: 'Wildlife feeding among southern grain paddies.', guard: 'Wildlife', reward: 12 }
  ];
  monsterData.forEach(d => createMonster({ ...d, kingdomId: mapId }));

  // Eastern Mainland Travel Gate (Positioned at x: 68, z: 20)
  const gate = new THREE.Group(); gate.position.set(68, 0, 20);
  addMesh(gate, new THREE.TorusGeometry(1.4, 0.18, 8, 16), mat('#d1b66c', 0.4, 0.3), 0, 2.1, 0).rotation.x = Math.PI / 2;
  addMesh(gate, new THREE.CylinderGeometry(0.12, 0.12, 4.2, 8), mat('#a78d56'), -1.4, 2.1, 0);
  addMesh(gate, new THREE.CylinderGeometry(0.12, 0.12, 4.2, 8), mat('#a78d56'), 1.4, 2.1, 0);
  const gateData = { id: 'travel-gate', name: 'Eastern Mainland Gate', kind: 'travel', type: 'travel', x: 68, z: 20, level: 1, description: 'Select a kingdom on the World Atlas to travel across realms.' };
  registerObject(gate, gateData);
  world.add(gate);

  // Player Army Squad
  const armyGroup = createArmy();
  armyGroup.position.copy(army.position);
  armyGroup.position.y = 0.02;
  armyGroup.userData.isArmy = true;
  const armyLabel = makeLabelSprite('MAGAR VANGUARD', '#d7e7f5');
  armyLabel.position.set(0, 3, 0);
  armyGroup.add(armyLabel);
  registerObject(armyGroup, { id: 'A-01', name: 'Magar Vanguard', kind: 'army', type: 'army', level: 18, description: 'Your selected Nepalese-inspired infantry, cavalry, and archer force.', guard: 'Friendly', x: army.position.x, z: army.position.z });
  mapObjects.set('army', armyGroup);

  if (army.state === 'idle') {
    army.position.copy(army.home);
    armyGroup.position.copy(army.home);
  }
  world.add(armyGroup);

  // 75+ Distant scenic stones across the realm
  for (let i = 0; i < 75; i++) {
    createRock((Math.random() - 0.5) * 148, (Math.random() - 0.5) * 118, config.snow ? '#d1d8d6' : '#737e75', 0.5 + Math.random() * 0.9);
  }

  world.scale.setScalar(zoom);
  world.position.set(panX, 0, panZ);
  updateMapText();
  refreshTargetUI();
  updateReadyUpgradesBadge();
  loadingBadge.style.display = 'none';
}

function updateMapText() {
  document.getElementById('mapName').textContent = maps[currentMap].name;
  document.getElementById('mapSubtitle').textContent = maps[currentMap].subtitle;
  document.querySelectorAll('.kingdom').forEach(b => b.classList.toggle('active', b.dataset.map === currentMap));
}

function getGameData(obj) {
  let o = obj;
  while (o) {
    if (o.userData?.gameData) return o.userData.gameData;
    o = o.parent;
  }
  return null;
}

function selectObject(obj) {
  const data = getGameData(obj);
  if (!data) return;
  selectedObject = data;
  if (window.selectionRing) {
    scene.remove(window.selectionRing);
    window.selectionRing.geometry.dispose();
    window.selectionRing.material.dispose();
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.92, 32), new THREE.MeshBasicMaterial({ color: '#f0d18b', side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthTest: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(obj.getWorldPosition(new THREE.Vector3()).x, 0.03, obj.getWorldPosition(new THREE.Vector3()).z);
  scene.add(ring);
  window.selectionRing = ring;
  ring.userData.follow = obj;
  refreshTargetUI();
  toast(`${data.name} selected`);
}

/* ==========================================================================
   BUILDING ASSET REQUIREMENTS & BLUEPRINTS SPECIFICATION
   ========================================================================== */
function getBuildingUpgradeRequirements(data) {
  const lvl = data.level || 1;
  const kind = data.type || data.kind || 'house';
  const citadel = objects.find(o => o.data.kind === 'castle' || o.data.type === 'castle')?.data;
  const citadelLvl = citadel?.level || 18;

  if (kind === 'castle' || kind === 'kingdom') {
    return {
      nextLevel: lvl + 1,
      category: 'Government',
      wood: Math.floor(380 + lvl * 35),
      stone: Math.floor(480 + lvl * 40),
      iron: Math.floor(280 + lvl * 28),
      food: Math.floor(520 + lvl * 45),
      reqCitadelLevel: lvl,
      bonus: `+${(lvl + 1) * 200} Citadel Power, +500 Asset Storage Capacity`
    };
  } else if (kind === 'barracks') {
    return {
      nextLevel: lvl + 1,
      category: 'Military',
      wood: Math.floor(240 + lvl * 24),
      stone: Math.floor(220 + lvl * 22),
      iron: Math.floor(160 + lvl * 18),
      food: Math.floor(200 + lvl * 20),
      reqCitadelLevel: Math.max(1, lvl - 1),
      bonus: `+${(lvl + 1) * 110} Troop Training Speed & Power`
    };
  } else if (kind === 'stables') {
    return {
      nextLevel: lvl + 1,
      category: 'Military',
      wood: Math.floor(260 + lvl * 26),
      stone: Math.floor(210 + lvl * 20),
      iron: Math.floor(150 + lvl * 16),
      food: Math.floor(240 + lvl * 24),
      reqCitadelLevel: Math.max(1, lvl - 1),
      bonus: `+${(lvl + 1) * 15}% Cavalry Speed & Spear Damage`
    };
  } else if (kind === 'range') {
    return {
      nextLevel: lvl + 1,
      category: 'Military',
      wood: Math.floor(230 + lvl * 24),
      stone: Math.floor(180 + lvl * 18),
      iron: Math.floor(110 + lvl * 14),
      food: Math.floor(160 + lvl * 18),
      reqCitadelLevel: Math.max(1, lvl - 1),
      bonus: `+${(lvl + 1) * 12}% Archer Volley Range & Arrow Power`
    };
  } else if (kind === 'armory') {
    return {
      nextLevel: lvl + 1,
      category: 'Military',
      wood: Math.floor(200 + lvl * 20),
      stone: Math.floor(280 + lvl * 26),
      iron: Math.floor(240 + lvl * 28),
      food: Math.floor(140 + lvl * 14),
      reqCitadelLevel: Math.max(1, lvl - 2),
      bonus: `+${(lvl + 1) * 18} Khukuri Attack & Armor Rating`
    };
  } else if (kind === 'temple') {
    return {
      nextLevel: lvl + 1,
      category: 'Sacred',
      wood: Math.floor(220 + lvl * 20),
      stone: Math.floor(320 + lvl * 28),
      iron: Math.floor(100 + lvl * 12),
      food: Math.floor(260 + lvl * 22),
      reqCitadelLevel: Math.max(1, lvl - 1),
      bonus: `+${(lvl + 1) * 90} Divine Blessing & Health Regeneration`
    };
  } else if (kind === 'stupa') {
    return {
      nextLevel: lvl + 1,
      category: 'Sacred',
      wood: Math.floor(180 + lvl * 16),
      stone: Math.floor(310 + lvl * 26),
      iron: Math.floor(80 + lvl * 8),
      food: Math.floor(200 + lvl * 18),
      reqCitadelLevel: Math.max(1, lvl - 2),
      bonus: `+${(lvl + 1) * 85} Spiritual Realm Stability & Covert Gather`
    };
  } else if (kind === 'granary') {
    return {
      nextLevel: lvl + 1,
      category: 'Economy',
      wood: Math.floor(250 + lvl * 24),
      stone: Math.floor(210 + lvl * 20),
      iron: Math.floor(80 + lvl * 10),
      food: Math.floor(160 + lvl * 16),
      reqCitadelLevel: Math.max(1, lvl - 2),
      bonus: `+${(lvl + 1) * 45} Food/min Production & Storage`
    };
  } else if (kind === 'lumbermill') {
    return {
      nextLevel: lvl + 1,
      category: 'Economy',
      wood: Math.floor(160 + lvl * 18),
      stone: Math.floor(190 + lvl * 20),
      iron: Math.floor(70 + lvl * 8),
      food: Math.floor(120 + lvl * 12),
      reqCitadelLevel: Math.max(1, lvl - 2),
      bonus: `+${(lvl + 1) * 40} Wood/min Passive Timber Harvest`
    };
  } else if (kind === 'foundry') {
    return {
      nextLevel: lvl + 1,
      category: 'Economy',
      wood: Math.floor(240 + lvl * 24),
      stone: Math.floor(310 + lvl * 30),
      iron: Math.floor(160 + lvl * 18),
      food: Math.floor(110 + lvl * 12),
      reqCitadelLevel: Math.max(1, lvl - 2),
      bonus: `+${(lvl + 1) * 30} Iron/min Smelt Output`
    };
  } else if (kind === 'masonry') {
    return {
      nextLevel: lvl + 1,
      category: 'Economy',
      wood: Math.floor(180 + lvl * 18),
      stone: Math.floor(240 + lvl * 24),
      iron: Math.floor(80 + lvl * 10),
      food: Math.floor(110 + lvl * 12),
      reqCitadelLevel: Math.max(1, lvl - 2),
      bonus: `+${(lvl + 1) * 35} Stone/min Quarry Production`
    };
  } else if (kind === 'watermill') {
    return {
      nextLevel: lvl + 1,
      category: 'Economy',
      wood: Math.floor(200 + lvl * 20),
      stone: Math.floor(150 + lvl * 16),
      iron: Math.floor(60 + lvl * 8),
      food: Math.floor(180 + lvl * 20),
      reqCitadelLevel: Math.max(1, lvl - 2),
      bonus: `+${(lvl + 1) * 50} Food & Terrace Paddy Irrigation`
    };
  } else if (kind === 'watchtower') {
    return {
      nextLevel: lvl + 1,
      category: 'Defense',
      wood: Math.floor(180 + lvl * 18),
      stone: Math.floor(270 + lvl * 26),
      iron: Math.floor(130 + lvl * 15),
      food: Math.floor(100 + lvl * 10),
      reqCitadelLevel: Math.max(1, lvl - 2),
      bonus: `+${(lvl + 1) * 110} Sentinel Range & Fortress Armor`
    };
  } else if (kind === 'bazaar') {
    return {
      nextLevel: lvl + 1,
      category: 'Economy',
      wood: Math.floor(180 + lvl * 18),
      stone: Math.floor(150 + lvl * 15),
      iron: Math.floor(70 + lvl * 8),
      food: Math.floor(160 + lvl * 16),
      reqCitadelLevel: Math.max(1, lvl - 2),
      bonus: `+${(lvl + 1) * 65} Trade Tax & Market Economy`
    };
  } else {
    // Traditional village homestead / farmstead
    return {
      nextLevel: lvl + 1,
      category: 'Economy',
      wood: Math.floor(140 + lvl * 14),
      stone: Math.floor(130 + lvl * 12),
      iron: Math.floor(60 + lvl * 6),
      food: Math.floor(120 + lvl * 12),
      reqCitadelLevel: 1,
      bonus: `+${(lvl + 1) * 45} Population Tax & Crop Yield`
    };
  }
}

// 8 Constructible Blueprints with Strict Asset Requirements
const blueprints = [
  {
    id: 'bp-watermill',
    name: 'Terrace Farmland Watermill',
    kind: 'watermill',
    icon: '🌾',
    category: 'Economy',
    wood: 180,
    stone: 120,
    iron: 40,
    food: 150,
    yield: '+50 Food/min',
    description: 'Construct a flowing mountain watermill beside irrigation canals to feed growing regiments.'
  },
  {
    id: 'bp-foundry',
    name: 'Mountain Iron Smelter',
    kind: 'foundry',
    icon: '⚒️',
    category: 'Economy',
    wood: 240,
    stone: 300,
    iron: 150,
    food: 100,
    yield: '+30 Iron/min',
    description: 'High-heat blast smelter processing raw mountain veins into refined war ingots.'
  },
  {
    id: 'bp-lumbermill',
    name: 'Pine Timber Mill',
    kind: 'lumbermill',
    icon: '♣',
    category: 'Economy',
    wood: 140,
    stone: 160,
    iron: 50,
    food: 80,
    yield: '+40 Wood/min',
    description: 'Highland timber station providing logs for fortress ramparts and archery bows.'
  },
  {
    id: 'bp-masonry',
    name: 'Granite Masonry Works',
    kind: 'masonry',
    icon: '◆',
    category: 'Economy',
    wood: 160,
    stone: 220,
    iron: 60,
    food: 90,
    yield: '+35 Stone/min',
    description: 'Hewn stone-cutting workshop shaping slate and granite blocks for keep upgrades.'
  },
  {
    id: 'bp-stables',
    name: 'War Cavalry Stables',
    kind: 'stables',
    icon: '🏇',
    category: 'Military',
    wood: 260,
    stone: 220,
    iron: 140,
    food: 200,
    yield: '+15% Cavalry Speed',
    description: 'Spacious timber paddocks and stables breeding mountain horses for the Magar Cavalry.'
  },
  {
    id: 'bp-range',
    name: 'Frontier Archery Range',
    kind: 'range',
    icon: '🏹',
    category: 'Military',
    wood: 220,
    stone: 180,
    iron: 100,
    food: 150,
    yield: '+20% Arrow Range',
    description: 'High-altitude shooting range training sharpshooters with composite bamboo and yew bows.'
  },
  {
    id: 'bp-bastion',
    name: 'Sentinel Bastion',
    kind: 'watchtower',
    icon: '🗼',
    category: 'Defense',
    wood: 200,
    stone: 320,
    iron: 150,
    food: 90,
    yield: '+120 Defense Aura',
    description: 'Formidable stone fortress tower guarding distant mountain passes against warlords.'
  },
  {
    id: 'bp-stupa',
    name: 'Mountain Chorten Shrine',
    kind: 'stupa',
    icon: '☸️',
    category: 'Sacred',
    wood: 180,
    stone: 300,
    iron: 60,
    food: 160,
    yield: '+150 Stability',
    description: 'Sacred whitewashed stupa surrounded by prayer wheels to maintain realm morale.'
  }
];

let blueprintBuildCount = 0;
function constructBlueprint(bp) {
  if (resources.wood < bp.wood || resources.stone < bp.stone || resources.iron < bp.iron || resources.food < bp.food) {
    toast(`Missing assets to construct ${bp.name}!`);
    return;
  }

  // Deduct asset requirements
  resources.wood -= bp.wood;
  resources.stone -= bp.stone;
  resources.iron -= bp.iron;
  resources.food -= bp.food;
  updateResourceUI();

  // Position on open plots across the expanded 160x130 map
  const openPlots = [
    { x: 20, z: 36 },
    { x: -48, z: 18 },
    { x: -10, z: 32 },
    { x: 44, z: 18 },
    { x: -38, z: 28 },
    { x: 30, z: -26 },
    { x: -50, z: -18 },
    { x: 8, z: 42 }
  ];
  const plot = openPlots[blueprintBuildCount % openPlots.length];
  blueprintBuildCount++;

  const bldg = createBuilding(plot.x, plot.z, bp.kind, 1.0);
  const data = {
    id: `bldg-bp-${Date.now()}`,
    name: bp.name,
    kind: 'building',
    type: bp.kind,
    category: bp.category,
    level: 1,
    x: plot.x,
    z: plot.z,
    health: 500,
    maxQuantity: 500,
    description: `${bp.description} (${bp.yield})`,
    guard: 'Garrison'
  };
  registerObject(bldg, data);

  // Spurt golden construction floaters & particles
  const screenPos = bldg.position.clone().project(camera);
  const rect = renderer.domElement.getBoundingClientRect();
  const sx = ((screenPos.x + 1) * 0.5) * rect.width + rect.left;
  const sy = ((-screenPos.y + 1) * 0.5) * rect.height + rect.top;
  showCombatFloater(`🔨 CONSTRUCTED ${bp.name}!`, sx, sy - 30, 'floater-cavalry');

  kingdomPowerBonus += 250;
  updatePowerDisplay();
  refreshTargetUI();
  renderBuildingsModal();
  updateReadyUpgradesBadge();

  addLog('Structure Built', `${bp.name} constructed on kingdom territory. Asset requirements satisfied.`, '🏛️');
  toast(`Constructed ${bp.name}!`);
}

function refreshTargetUI() {
  const d = selectedObject || objects.find(o => o.data.kind === 'resource')?.data;
  if (!d) return;

  const emoji = d.type === 'wood' ? '♣' : d.type === 'iron' ? '⬟' : d.type === 'stone' ? '◆' : d.type === 'gold' ? '✦' : d.type === 'bear' ? '🐻' : d.type === 'rabbit' ? '🐇' : d.type === 'knight' ? '♞' : d.type === 'raider' ? '⚔️' : d.kind === 'castle' ? '🏰' : d.type === 'barracks' ? '🎪' : d.type === 'stables' ? '🏇' : d.type === 'range' ? '🏹' : d.type === 'armory' ? '⚒️' : d.type === 'temple' ? '🛕' : d.type === 'stupa' ? '☸️' : d.type === 'granary' ? '🌾' : d.type === 'lumbermill' ? '♣' : d.type === 'foundry' ? '⚒️' : d.type === 'masonry' ? '◆' : d.type === 'watermill' ? '🌾' : d.type === 'watchtower' ? '🗼' : d.type === 'bazaar' ? '⛺' : d.kind === 'building' ? '🏛️' : d.kind === 'army' ? '🛡️' : '⌖';
  document.getElementById('targetEmoji').textContent = emoji;
  document.getElementById('targetName').textContent = d.name;
  document.getElementById('targetDescription').textContent = d.description || 'An object in the kingdom.';
  document.getElementById('targetLevel').textContent = String(d.level ?? 1).padStart(2, '0');
  document.getElementById('targetGuard').textContent = d.guard || (d.kind === 'monster' ? 'Hostile' : d.kind === 'resource' ? 'None' : 'Fortified');

  const artwork = document.getElementById('targetArtwork');
  artwork.className = 'target-artwork ' + (d.kind === 'monster' ? 'monster-target' : d.kind === 'animal' ? 'animal-target' : 'resource-target');
  document.getElementById('targetType').textContent = (d.kind || 'OBJECT').replace(/-/g, ' ').toUpperCase();

  const quantity = d.quantity ?? d.health ?? (d.kind === 'army' ? army.health : 100);
  document.getElementById('targetQuantity').textContent = Number(quantity).toLocaleString();
  document.getElementById('quantityLabel').textContent = d.kind === 'resource' ? 'REMAINING ' + d.type.toUpperCase() : d.kind === 'monster' || d.kind === 'building' || d.kind === 'castle' ? 'STRUCTURE / TARGET HEALTH' : d.kind === 'animal' ? 'WILDLIFE HEALTH' : 'STATUS';
  document.getElementById('quantityBar').style.width = `${Math.max(0, Math.min(100, (quantity / (d.maxQuantity || 100)) * 100))}%`;
  document.getElementById('targetStatus').textContent = d.kind === 'resource' ? (d.quantity > 0 ? 'Available' : 'Depleted') : d.kind === 'monster' ? 'Hostile' : d.kind === 'building' || d.kind === 'castle' ? 'Fortified' : d.kind === 'animal' ? 'Wildlife' : 'Friendly';
  document.getElementById('targetStatus').className = d.kind === 'monster' ? 'status-warn' : 'status-good';

  // BUILDING ASSET REQUIREMENTS & UPGRADE CARD
  const reqBox = document.getElementById('buildingRequirementsBox');
  const isBuilding = d.kind === 'building' || d.kind === 'castle' || d.kind === 'kingdom';

  if (reqBox && isBuilding) {
    reqBox.style.display = 'block';
    const req = getBuildingUpgradeRequirements(d);
    document.getElementById('reqNextLevel').textContent = req.nextLevel;
    document.getElementById('reqBonus').textContent = req.bonus;

    const wPill = document.getElementById('reqWoodPill');
    const sPill = document.getElementById('reqStonePill');
    const iPill = document.getElementById('reqIronPill');
    const fPill = document.getElementById('reqFoodPill');

    document.getElementById('reqWoodText').textContent = `${resources.wood} / ${req.wood} ♣`;
    document.getElementById('reqStoneText').textContent = `${resources.stone} / ${req.stone} ◆`;
    document.getElementById('reqIronText').textContent = `${resources.iron} / ${req.iron} ⬟`;
    document.getElementById('reqFoodText').textContent = `${resources.food} / ${req.food} ✦`;

    const hasWood = resources.wood >= req.wood;
    const hasStone = resources.stone >= req.stone;
    const hasIron = resources.iron >= req.iron;
    const hasFood = resources.food >= req.food;

    wPill.className = `req-pill ${hasWood ? 'met' : 'unmet'}`;
    sPill.className = `req-pill ${hasStone ? 'met' : 'unmet'}`;
    iPill.className = `req-pill ${hasIron ? 'met' : 'unmet'}`;
    fPill.className = `req-pill ${hasFood ? 'met' : 'unmet'}`;

    const btn = document.getElementById('btnUpgradeBuilding');
    const statusText = document.getElementById('reqUpgradeStatus');
    const canUpgrade = hasWood && hasStone && hasIron && hasFood;

    if (btn) btn.disabled = !canUpgrade;
    if (statusText) {
      if (canUpgrade) {
        statusText.textContent = 'Asset Requirements Met · Ready to Construct';
      } else {
        const missing = [];
        if (!hasWood) missing.push(`${req.wood - resources.wood} Wood`);
        if (!hasStone) missing.push(`${req.stone - resources.stone} Stone`);
        if (!hasIron) missing.push(`${req.iron - resources.iron} Iron`);
        if (!hasFood) missing.push(`${req.food - resources.food} Food`);
        statusText.textContent = `Missing: ${missing.slice(0, 2).join(', ')}`;
      }
    }
  } else if (reqBox) {
    reqBox.style.display = 'none';
  }
}

// Upgrade Building Function
function upgradeBuilding(data) {
  if (!data) return;
  const isBuilding = data.kind === 'building' || data.kind === 'castle' || data.kind === 'kingdom';
  if (!isBuilding) return;

  const req = getBuildingUpgradeRequirements(data);
  if (resources.wood < req.wood || resources.stone < req.stone || resources.iron < req.iron || resources.food < req.food) {
    toast(`Need more assets to upgrade ${data.name}!`);
    return;
  }

  // Deduct asset requirements
  resources.wood -= req.wood;
  resources.stone -= req.stone;
  resources.iron -= req.iron;
  resources.food -= req.food;
  updateResourceUI();

  // Upgrade building level and power
  data.level = (data.level || 1) + 1;
  kingdomPowerBonus += (data.level) * 140;
  updatePowerDisplay();

  const bldgObj = objects.find(o => o.data.id === data.id);
  if (bldgObj && bldgObj.group) {
    bldgObj.group.scale.multiplyScalar(1.05); // Visual growth
    const pos = bldgObj.group.position;
    const screenPos = pos.clone().project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    const sx = ((screenPos.x + 1) * 0.5) * rect.width + rect.left;
    const sy = ((-screenPos.y + 1) * 0.5) * rect.height + rect.top;
    showCombatFloater(`🔨 UPGRADED TO LVL ${data.level}!`, sx, sy - 30, 'floater-cavalry');
  }

  refreshTargetUI();
  renderBuildingsModal();
  updateReadyUpgradesBadge();
  addLog('Structure Upgraded', `${data.name} reached Level ${data.level}. ${req.bonus}.`, '🔨');
  toast(`${data.name} upgraded to Level ${data.level}!`);
}

document.getElementById('btnUpgradeBuilding')?.addEventListener('click', () => {
  if (selectedObject) upgradeBuilding(selectedObject);
});

// "Gather Shortage" Button in Target Panel
document.getElementById('btnGatherShortage')?.addEventListener('click', () => {
  if (!selectedObject) return;
  const req = getBuildingUpgradeRequirements(selectedObject);
  let missingType = null;
  if (resources.wood < req.wood) missingType = 'wood';
  else if (resources.stone < req.stone) missingType = 'stone';
  else if (resources.iron < req.iron) missingType = 'iron';
  else if (resources.food < req.food) missingType = 'food';

  if (!missingType) {
    toast(`All asset requirements are already satisfied for ${selectedObject.name}!`);
    return;
  }

  const node = objects.find(o => o.data.kind === 'resource' && o.data.type === missingType && o.data.quantity > 0);
  if (node) {
    selectObject(node.group);
    beginMarch(node.data, 'gather');
    toast(`Army dispatched to gather missing ${missingType.toUpperCase()}!`);
  } else {
    toast(`No active ${missingType.toUpperCase()} node found nearby.`);
  }
});

// ==========================================================================
// BUILDINGS ASSET REQUIREMENTS MODAL & DIRECTORY
// ==========================================================================
const buildingsModal = document.getElementById('buildingsModal');
const openBuildingsBtn = document.getElementById('openBuildingsBtn');
const closeBuildingsModal = document.getElementById('closeBuildingsModal');
const btnQuickOpenBuildings = document.getElementById('btnQuickOpenBuildings');
const btnOpenFromTarget = document.getElementById('btnOpenFromTarget');
const tabBldgOverview = document.getElementById('tabBldgOverview');
const tabBldgBlueprints = document.getElementById('tabBldgBlueprints');
const panelBldgOverview = document.getElementById('panelBldgOverview');
const panelBldgBlueprints = document.getElementById('panelBldgBlueprints');

function toggleBuildingsModal(show = true) {
  if (!buildingsModal) return;
  buildingsModal.style.display = show ? 'grid' : 'none';
  if (show) {
    renderBuildingsModal();
    renderBlueprintsGrid();
  }
}

openBuildingsBtn?.addEventListener('click', () => toggleBuildingsModal(true));
btnQuickOpenBuildings?.addEventListener('click', () => toggleBuildingsModal(true));
btnOpenFromTarget?.addEventListener('click', () => toggleBuildingsModal(true));
closeBuildingsModal?.addEventListener('click', () => toggleBuildingsModal(false));

tabBldgOverview?.addEventListener('click', () => {
  tabBldgOverview.classList.add('active');
  tabBldgBlueprints.classList.remove('active');
  panelBldgOverview.style.display = 'block';
  panelBldgBlueprints.style.display = 'none';
});

tabBldgBlueprints?.addEventListener('click', () => {
  tabBldgBlueprints.classList.add('active');
  tabBldgOverview.classList.remove('active');
  panelBldgBlueprints.style.display = 'block';
  panelBldgOverview.style.display = 'none';
});

function updateReadyUpgradesBadge() {
  const badge = document.getElementById('readyUpgradesBadge');
  if (!badge) return;
  const bldgList = objects.filter(o => o.data.kind === 'building' || o.data.kind === 'castle');
  let readyCount = 0;
  bldgList.forEach(b => {
    const req = getBuildingUpgradeRequirements(b.data);
    if (resources.wood >= req.wood && resources.stone >= req.stone && resources.iron >= req.iron && resources.food >= req.food) {
      readyCount++;
    }
  });
  badge.textContent = readyCount > 0 ? `${readyCount} READY` : 'REQUIREMENTS';
  badge.style.background = readyCount > 0 ? 'linear-gradient(135deg,#286e42,#174427)' : 'linear-gradient(135deg,#4a3a24,#2b2114)';
}

function renderBuildingsModal() {
  const grid = document.getElementById('buildingsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  document.getElementById('bldgModalWood').textContent = `♣ ${resources.wood} Wood`;
  document.getElementById('bldgModalStone').textContent = `◆ ${resources.stone} Stone`;
  document.getElementById('bldgModalIron').textContent = `⬟ ${resources.iron} Iron`;
  document.getElementById('bldgModalFood').textContent = `✦ ${resources.food} Food`;

  const bldgList = objects.filter(o => o.data.kind === 'building' || o.data.kind === 'castle');
  document.getElementById('bldgModalStructures').textContent = `🏛️ ${bldgList.length} Structures`;

  bldgList.forEach(b => {
    const d = b.data;
    const req = getBuildingUpgradeRequirements(d);
    const hasWood = resources.wood >= req.wood;
    const hasStone = resources.stone >= req.stone;
    const hasIron = resources.iron >= req.iron;
    const hasFood = resources.food >= req.food;
    const canUpgrade = hasWood && hasStone && hasIron && hasFood;

    const emoji = d.type === 'castle' ? '🏰' : d.type === 'barracks' ? '🎪' : d.type === 'stables' ? '🏇' : d.type === 'range' ? '🏹' : d.type === 'armory' ? '⚒️' : d.type === 'temple' ? '🛕' : d.type === 'stupa' ? '☸️' : d.type === 'granary' ? '🌾' : d.type === 'lumbermill' ? '♣' : d.type === 'foundry' ? '⚒️' : d.type === 'masonry' ? '◆' : d.type === 'watermill' ? '🌾' : d.type === 'watchtower' ? '🗼' : d.type === 'bazaar' ? '⛺' : '🏛️';

    const card = document.createElement('div');
    card.className = `bldg-card ${canUpgrade ? 'ready-upgrade' : ''}`;
    card.innerHTML = `
      <div class="bldg-card-header">
        <div class="bldg-card-icon">${emoji}</div>
        <div class="bldg-card-title">
          <b>${d.name}</b>
          <small>${req.category} · Health ${d.health}/${d.maxQuantity}</small>
        </div>
        <div class="bldg-level-badge">LVL ${d.level}</div>
      </div>
      <div class="bldg-req-details">
        <div class="bldg-req-title">
          <span>UPGRADE REQUIREMENTS (LVL ${req.nextLevel})</span>
          <span style="color:${canUpgrade ? '#9be2ad' : '#f5988d'}">${canUpgrade ? 'Requirements Met' : 'Shortage'}</span>
        </div>
        <div class="bldg-req-grid">
          <div class="bldg-req-item ${hasWood ? 'met' : 'unmet'}"><span>♣</span><span>Wood: ${resources.wood}/${req.wood}</span></div>
          <div class="bldg-req-item ${hasStone ? 'met' : 'unmet'}"><span>◆</span><span>Stone: ${resources.stone}/${req.stone}</span></div>
          <div class="bldg-req-item ${hasIron ? 'met' : 'unmet'}"><span>⬟</span><span>Iron: ${resources.iron}/${req.iron}</span></div>
          <div class="bldg-req-item ${hasFood ? 'met' : 'unmet'}"><span>✦</span><span>Food: ${resources.food}/${req.food}</span></div>
        </div>
        <div class="bldg-bonus-text">Upgrade Perk: ${req.bonus}</div>
      </div>
      <div class="bldg-card-actions">
        <button class="btn-bldg-upgrade" ${canUpgrade ? '' : 'disabled'}>
          <span>🔨</span><b>${canUpgrade ? 'Upgrade Structure' : 'Missing Assets'}</b>
        </button>
        <button class="btn-bldg-focus">⌖ Focus</button>
      </div>
    `;

    card.querySelector('.btn-bldg-upgrade').addEventListener('click', () => {
      upgradeBuilding(d);
    });

    card.querySelector('.btn-bldg-focus').addEventListener('click', () => {
      toggleBuildingsModal(false);
      selectObject(b.group);
      panX = -d.x * 0.8;
      panZ = -d.z * 0.8;
      world.position.set(panX, 0, panZ);
      applyZoom(1.3);
    });

    grid.appendChild(card);
  });
}

function renderBlueprintsGrid() {
  const grid = document.getElementById('blueprintsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  blueprints.forEach(bp => {
    const hasWood = resources.wood >= bp.wood;
    const hasStone = resources.stone >= bp.stone;
    const hasIron = resources.iron >= bp.iron;
    const hasFood = resources.food >= bp.food;
    const canConstruct = hasWood && hasStone && hasIron && hasFood;

    const card = document.createElement('div');
    card.className = 'blueprint-card';
    card.innerHTML = `
      <div class="bp-header">
        <div class="bp-icon">${bp.icon}</div>
        <div class="bp-info">
          <b>${bp.name}</b>
          <small>${bp.category} Structure</small>
        </div>
        <span class="bp-yield">${bp.yield}</span>
      </div>
      <p class="bp-desc">${bp.description}</p>
      <div class="bldg-req-details">
        <div class="bldg-req-title"><span>CONSTRUCTION ASSET REQUIREMENTS</span></div>
        <div class="bldg-req-grid">
          <div class="bldg-req-item ${hasWood ? 'met' : 'unmet'}"><span>♣</span><span>Wood: ${resources.wood}/${bp.wood}</span></div>
          <div class="bldg-req-item ${hasStone ? 'met' : 'unmet'}"><span>◆</span><span>Stone: ${resources.stone}/${bp.stone}</span></div>
          <div class="bldg-req-item ${hasIron ? 'met' : 'unmet'}"><span>⬟</span><span>Iron: ${resources.iron}/${bp.iron}</span></div>
          <div class="bldg-req-item ${hasFood ? 'met' : 'unmet'}"><span>✦</span><span>Food: ${resources.food}/${bp.food}</span></div>
        </div>
      </div>
      <button class="btn-construct" ${canConstruct ? '' : 'disabled'}>
        <span>🔨</span><b>${canConstruct ? 'Construct on Land' : 'Missing Assets'}</b>
      </button>
    `;

    card.querySelector('.btn-construct').addEventListener('click', () => {
      constructBlueprint(bp);
    });

    grid.appendChild(card);
  });
}

// Periodic Passive Resource Yield from Kingdom Structures (Every 6 seconds)
let passiveIncomeTimer = 0;
function updateKingdomPassiveIncome(dt) {
  passiveIncomeTimer += dt;
  if (passiveIncomeTimer < 6.0) return;
  passiveIncomeTimer = 0;

  const bldgList = objects.filter(o => o.data.kind === 'building' || o.data.kind === 'castle');
  let woodGain = 0, stoneGain = 0, ironGain = 0, foodGain = 0;

  bldgList.forEach(b => {
    const lvl = b.data.level || 1;
    if (b.data.type === 'lumbermill') woodGain += lvl * 5;
    else if (b.data.type === 'masonry') stoneGain += lvl * 5;
    else if (b.data.type === 'foundry') ironGain += lvl * 4;
    else if (b.data.type === 'granary' || b.data.type === 'watermill') foodGain += lvl * 6;
    else if (b.data.type === 'house') {
      foodGain += lvl * 2;
      woodGain += lvl * 1;
    }
  });

  if (woodGain > 0 || stoneGain > 0 || ironGain > 0 || foodGain > 0) {
    resources.wood += woodGain;
    resources.stone += stoneGain;
    resources.iron += ironGain;
    resources.food += foodGain;
    updateResourceUI();
    updateReadyUpgradesBadge();
  }
}

function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 2400);
}

function addLog(title, detail, icon = '✦') {
  const log = document.getElementById('missionLog');
  const row = document.createElement('div');
  row.className = 'log-entry';
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  row.innerHTML = `<span class="log-icon">${icon}</span><div><b></b><small></small></div><time>${now}</time>`;
  row.querySelector('b').textContent = title;
  row.querySelector('small').textContent = detail;
  log.prepend(row);
  while (log.children.length > 8) log.lastElementChild.remove();
}

function showCombatFloater(text, screenX, screenY, typeClass = 'floater-hit') {
  const container = document.getElementById('combatFloaters');
  if (!container) return;
  const floater = document.createElement('div');
  floater.className = `floater-text ${typeClass}`;
  floater.textContent = text;
  floater.style.left = `${screenX}px`;
  floater.style.top = `${screenY}px`;
  container.appendChild(floater);
  setTimeout(() => floater.remove(), 1100);
}

function setMissionState(state, description, progress = 0) {
  army.state = state;
  document.getElementById('missionState').textContent = state.toUpperCase();
  document.getElementById('missionDescription').textContent = description;
  document.getElementById('missionProgress').style.width = `${progress}%`;
  document.getElementById('missionPip').style.background = state === 'attacking' ? '#d76859' : state === 'gathering' ? '#d4b16a' : state === 'idle' ? '#7fc497' : '#81b9df';
  document.getElementById('missionTimer').textContent = state === 'idle' ? 'No active mission' : `${Math.round(Math.max(0, army.duration - army.timer))}s remaining · Live simulation`;
  document.getElementById('activeMissionCount').textContent = state === 'idle' ? '0' : '1';
  document.getElementById('healthText').textContent = `${Math.round(army.health)}%`;
  document.getElementById('healthBar').style.width = `${army.health}%`;
  document.getElementById('infantryCount').textContent = army.counts.infantry;
  document.getElementById('cavalryCount').textContent = army.counts.cavalry;
  document.getElementById('archerCount').textContent = army.counts.archer;
  updatePowerDisplay();
}

/* ==========================================================================
   FLYING ARROWS & COMBAT PARTICLES
   ========================================================================== */
const activeProjectiles = [];
const arrowGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.7, 5);
const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xefdec5 });

function spawnArrowVolley(sourcePos, targetPos) {
  for (let i = 0; i < 3; i++) {
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    const start = sourcePos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.2, (Math.random() - 0.5) * 1.2));
    const dest = targetPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.8, (Math.random() - 0.5) * 0.8));
    arrow.position.copy(start);
    world.add(arrow);
    activeProjectiles.push({
      mesh: arrow,
      start,
      dest,
      progress: 0,
      speed: 1.6 + Math.random() * 0.5
    });
  }
}

function updateProjectiles(dt) {
  for (let i = activeProjectiles.length - 1; i >= 0; i--) {
    const p = activeProjectiles[i];
    p.progress += dt * p.speed;
    const t = Math.min(1, p.progress);

    const currentPos = new THREE.Vector3().lerpVectors(p.start, p.dest, t);
    const arcHeight = Math.sin(t * Math.PI) * 1.4;
    currentPos.y += arcHeight;
    p.mesh.position.copy(currentPos);

    const forward = new THREE.Vector3().subVectors(p.dest, p.start).normalize();
    forward.y += (1 - t * 2) * 0.6;
    p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward.normalize());

    if (t >= 1) {
      world.remove(p.mesh);
      p.mesh.geometry.dispose();
      activeProjectiles.splice(i, 1);

      const screenPos = p.dest.clone().project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      const sx = ((screenPos.x + 1) * 0.5) * rect.width + rect.left;
      const sy = ((-screenPos.y + 1) * 0.5) * rect.height + rect.top;
      const dmg = Math.floor(18 + Math.random() * 14);
      showCombatFloater(`🏹 ARROW -${dmg}`, sx, sy, 'floater-archer');
    }
  }
}

/* ==========================================================================
   COMMANDS & MISSIONS
   ========================================================================== */
function beginMarch(target, missionType) {
  if (!target) { toast('Select a valid target first'); return; }
  if (army.state !== 'idle') { toast('Army is busy. Recall it before issuing another mission.'); return; }
  if (target.kind === 'travel') { toast('Choose a kingdom from the World Atlas.'); return; }
  if (missionType === 'gather' && target.kind !== 'resource') { toast('Select a resource node to gather.'); return; }

  if (missionType === 'attack') {
    const isAttackable = ['monster', 'animal', 'castle', 'building', 'kingdom'].includes(target.kind) || ['castle', 'temple', 'house', 'barracks', 'watchtower'].includes(target.type);
    if (!isAttackable) {
      toast('Select a monster, wildlife, or rival structure to attack.');
      return;
    }
  }
  if (missionType === 'gather' && target.quantity <= 0) { toast('This resource node is depleted.'); return; }

  army.target = target;
  army.missionType = missionType;
  army.start = army.position.clone();
  army.destination = new THREE.Vector3(target.x || 0, 0, target.z || 0);

  const baseSpeed = 3.6 * currentWeather.speedMult;
  army.duration = Math.max(3, Math.round(army.position.distanceTo(army.destination) / baseSpeed));
  army.timer = 0;
  army.progress = 0;

  setMissionState('marching', `Marching toward ${target.name} (${Math.round(currentWeather.speedMult * 100)}% speed).`);
  addLog('March order issued', `Magar Vanguard moving to ${target.name}. Weather: ${currentWeather.name}.`, '➤');
  toast(`Marching to ${target.name}`);
}

function returnHome() {
  if (army.state === 'idle') { toast('Your army is already at home'); return; }
  if (army.state === 'returning') { toast('Army is already returning'); return; }

  army.missionType = 'return';
  army.target = null;
  army.start = army.position.clone();
  army.destination = army.home.clone();
  army.timer = 0;
  const baseSpeed = 3.6 * currentWeather.speedMult;
  army.duration = Math.max(3, Math.round(army.position.distanceTo(army.home) / baseSpeed));
  setMissionState('returning', 'Returning to Gorkha Citadel.');
  addLog('Recall order received', 'Your army is returning to the citadel.', '↶');
  toast('Return march started');
}

function resolveArrival() {
  if (army.state === 'returning') {
    army.position.copy(army.home);
    army.destination = null;
    army.target = null;
    army.missionType = null;
    setMissionState('idle', 'Your army has returned and is awaiting new orders.');
    addLog('Army returned home', 'Troops rallied at the citadel gates.', '⌂');
    toast('Army returned home');
    return;
  }
  if (army.state === 'marching' && army.target) {
    if (army.missionType === 'gather') {
      setMissionState('gathering', `Gathering ${army.target.type} at ${army.target.name}.`);
      army.timer = 0;
      army.duration = 8;
      addLog('Gathering started', `Troops working at ${army.target.name}.`, '⛏');
      toast('Gathering started');
    } else if (army.missionType === 'attack') {
      setMissionState('attacking', `Engaging ${army.target.name} in battle.`);
      army.timer = 0;
      army.duration = 7;
      addLog('Battle engaged', `Magar Vanguard attacked ${army.target.name}!`, '⚔');
      toast(`Attacking ${army.target.name}!`);
    } else {
      setMissionState('idle', 'Army reached the destination.');
    }
  }
}

function finishGathering() {
  const t = army.target;
  if (!t) { returnHome(); return; }

  const baseYield = Math.floor(85 + army.counts.infantry * 0.4);
  const amount = Math.min(t.quantity, Math.max(10, Math.floor(baseYield * currentWeather.gatherMult)));
  t.quantity -= amount;

  const key = t.type === 'wood' ? 'wood' : t.type === 'stone' ? 'stone' : t.type === 'iron' || t.type === 'gold' ? 'iron' : 'food';
  resources[key] = (resources[key] || 0) + amount;
  updateResourceUI();
  refreshTargetUI();

  addLog('Gathering complete', `Collected ${amount} ${t.type} (${Math.round(currentWeather.gatherMult * 100)}% weather efficiency).`, '⛏');
  toast(`Collected ${amount} ${t.type}!`);

  army.start = army.position.clone();
  army.destination = army.home.clone();
  army.target = null;
  army.missionType = 'return';
  army.timer = 0;
  const baseSpeed = 3.6 * currentWeather.speedMult;
  army.duration = Math.max(3, Math.round(army.position.distanceTo(army.home) / baseSpeed));
  setMissionState('returning', 'Resources secured. Returning to Gorkha Citadel.');
}

function finishAttack() {
  const t = army.target;
  if (!t) { returnHome(); return; }

  const winPower = army.counts.infantry * 1.3 + army.counts.cavalry * 2.8 + army.counts.archer * 1.6;
  const enemyPower = (t.level || 1) * 14;
  const damageScore = Math.max(10, Math.min(95, Math.round(winPower / (winPower + enemyPower) * 100)));

  if (t.type === 'rabbit') {
    resources.food += 15;
    updateResourceUI();
    addLog('Wildlife secured', 'Secured 15 food provisions.', '✦');
    toast('Encounter complete · +15 Food');
  } else if (t.kind === 'building' || t.kind === 'castle') {
    const loot = 150;
    resources.stone += loot;
    resources.iron += loot;
    updateResourceUI();
    addLog('Siege Victory', `${t.name} garrison subdued. Captured ${loot} Stone & ${loot} Iron!`, '🏰');
    toast(`Siege victory · +${loot} Stone & Iron!`);
  } else if (damageScore >= 45) {
    const reward = t.reward || 100;
    resources.food += reward;
    resources.iron += Math.floor(reward * 0.4);
    updateResourceUI();
    addLog('Victory', `${t.name} defeated in battle! Claimed ${reward} food & ${Math.floor(reward * 0.4)} iron.`, '⚔');
    toast(`Victory · Claimed spoils of war!`);
    army.health = Math.max(25, army.health - (100 - damageScore) * 0.3);

    t.health = 0;
    t.description = 'Defeated in combat. Target subdued.';
    const group = objects.find(o => o.data.id === t.id)?.group;
    if (group) group.visible = false;
  } else {
    army.health = Math.max(15, army.health - 25);
    army.counts.infantry = Math.max(0, army.counts.infantry - 4);
    addLog('Costly skirmish', `${t.name} resisted fiercely. Army took casualties and fell back.`, '⚠');
    toast('Costly battle · Returning to citadel');
  }

  refreshTargetUI();
  army.target = null;
  army.destination = army.home.clone();
  army.missionType = 'return';
  army.timer = 0;
  const baseSpeed = 3.6 * currentWeather.speedMult;
  army.duration = Math.max(3, Math.round(army.position.distanceTo(army.home) / baseSpeed));
  setMissionState('returning', 'Battle resolved. Troops returning to the citadel.');
}

/* ==========================================================================
   UPDATE & ANIMATION LOOP
   ========================================================================== */
let lastArrowTime = 0;
let lastMeleeEffectTime = 0;

function updateArmy(dt) {
  const group = mapObjects.get('army');
  if (!group) return;

  if (army.state === 'marching' || army.state === 'returning') {
    army.timer += dt;
    const t = Math.min(1, army.timer / army.duration);
    if (army.destination) {
      army.position.lerpVectors(army.start || group.position, army.destination, t);
      group.position.x = army.position.x;
      group.position.z = army.position.z;
      const dx = army.destination.x - group.position.x;
      const dz = army.destination.z - group.position.z;
      if (Math.abs(dx) + Math.abs(dz) > 0.01) {
        group.rotation.y = Math.atan2(dx, dz);
      }
    }
    setMissionState(army.state, army.state === 'returning' ? 'Returning to Gorkha Citadel.' : `Marching toward ${army.target?.name || 'destination'}.`, t * 100);
    if (t >= 1) {
      army.position.copy(army.destination);
      group.position.copy(army.destination);
      resolveArrival();
    }
  } else if (army.state === 'gathering') {
    army.timer += dt;
    const p = Math.min(1, army.timer / army.duration);
    setMissionState('gathering', `Gathering ${army.target?.type || 'resources'}…`, p * 100);
    if (p >= 1) finishGathering();
  } else if (army.state === 'attacking') {
    army.timer += dt;
    const p = Math.min(1, army.timer / army.duration);
    setMissionState('attacking', `Fighting ${army.target?.name || 'target'}…`, p * 100);

    if (army.target) {
      const dx = (army.target.x || 0) - group.position.x;
      const dz = (army.target.z || 0) - group.position.z;
      group.rotation.y = Math.atan2(dx, dz);
    }
    if (p >= 1) finishAttack();
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  weatherAutoTimer += dt;
  if (weatherAutoTimer > 75) {
    weatherAutoTimer = 0;
    applyWeather(currentWeatherIndex + 1);
  }

  updateTraining(dt);
  updateArmy(dt);
  updateProjectiles(dt);
  updateKingdomPassiveIncome(dt);

  // Animate weather particles across expanded 160x130 land
  if (weatherParticleSystem.visible) {
    const pos = particleGeometry.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      const v = particleVelocities[i];
      pos[i * 3 + 1] -= v.y * dt * (currentWeather.id === 'blizzard' ? 2.8 : 1.4);
      pos[i * 3] += Math.sin(elapsed + v.drift) * dt * (currentWeather.id === 'blizzard' ? 3.0 : 0.9);
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3 + 1] = 25;
        pos[i * 3] = (Math.random() - 0.5) * 160;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 130;
      }
    }
    particleGeometry.attributes.position.needsUpdate = true;
  }

  const squad = mapObjects.get('army');
  const fighting = army.state === 'attacking';
  const moving = army.state === 'marching' || army.state === 'returning';
  const mining = army.state === 'gathering';

  if (fighting && army.target) {
    const targetGroup = objects.find(o => o.data.id === army.target.id)?.group;
    const targetPos = targetGroup ? targetGroup.position : new THREE.Vector3(army.target.x || 0, 0, army.target.z || 0);

    if (elapsed - lastArrowTime > 1.1) {
      lastArrowTime = elapsed;
      spawnArrowVolley(squad.position, targetPos);
    }

    if (elapsed - lastMeleeEffectTime > 0.85) {
      lastMeleeEffectTime = elapsed;
      const screenPos = targetPos.clone().project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      const sx = ((screenPos.x + 1) * 0.5) * rect.width + rect.left;
      const sy = ((-screenPos.y + 1) * 0.5) * rect.height + rect.top;

      if (Math.random() > 0.5) {
        showCombatFloater(`⚔️ SWORD SLASH -${Math.floor(25 + Math.random() * 15)}`, sx - 30, sy - 20, 'floater-infantry');
      } else {
        showCombatFloater(`🗡️ SPEAR PIERCE -${Math.floor(32 + Math.random() * 18)}`, sx + 30, sy - 10, 'floater-cavalry');
      }
    }
  }

  // Animate squad units
  if (squad?.userData.models) {
    squad.userData.models.forEach((unit, i) => {
      const parts = unit.userData.animParts || {};
      const type = parts.type;
      const phase = elapsed * (moving ? 8 : fighting ? 11 : mining ? 5 : 1.4) + i * 0.72;

      if (parts.miningTool) parts.miningTool.visible = mining;

      let bob = 0;
      if (moving) {
        bob = Math.abs(Math.sin(phase)) * 0.13;
      } else if (fighting) {
        bob = Math.abs(Math.sin(phase)) * 0.08;
      } else if (mining) {
        bob = Math.abs(Math.sin(phase)) * 0.04;
      } else {
        bob = Math.sin(phase) * 0.012;
      }
      unit.position.y = bob;
      unit.rotation.z = moving ? Math.sin(phase) * 0.035 : 0;

      if (fighting) {
        if (type === 'infantry') {
          const slashCycle = Math.sin(phase * 1.8);
          if (parts.arms) {
            parts.arms.forEach(a => {
              if (a.side === 1) {
                a.mesh.rotation.z = a.base + slashCycle * 1.25;
                a.mesh.rotation.x = Math.cos(phase * 1.8) * 0.8;
              } else {
                a.mesh.rotation.z = a.base + 0.35;
                a.mesh.rotation.x = 0.5;
              }
            });
          }
          if (parts.weapons) {
            parts.weapons.forEach(w => {
              if (w.type === 'sword') {
                w.mesh.rotation.z = w.baseRotZ + slashCycle * 1.4;
                w.mesh.rotation.x = Math.cos(phase * 1.8) * 0.9;
              }
            });
          }
        } else if (type === 'cavalry') {
          const thrust = Math.sin(phase * 2.2);
          const forwardLunge = Math.max(0, thrust) * 0.35;
          unit.position.z = (unit.userData.baseZ || 0) + forwardLunge;

          if (parts.arms) {
            parts.arms.forEach(a => {
              if (a.side === 1) {
                a.mesh.position.z = forwardLunge;
                a.mesh.rotation.x = 0.8 + Math.sin(phase * 2.2) * 0.3;
              }
            });
          }
          if (parts.weapons) {
            parts.weapons.forEach(w => {
              if (w.type === 'spear') {
                w.mesh.position.z = (w.basePosZ || 0) + forwardLunge;
                w.mesh.rotation.x = Math.sin(phase * 2.2) * 0.35;
              }
            });
          }
          if (unit.userData.horse) {
            unit.userData.horse.rotation.x = -Math.max(0, thrust) * 0.18;
          }
        } else if (type === 'archer') {
          const drawCycle = (phase * 1.5) % (Math.PI * 2);
          const isDrawing = drawCycle < Math.PI * 1.4;
          const pullBack = isDrawing ? Math.sin(drawCycle * 0.5) * 0.3 : 0;

          if (parts.arms) {
            parts.arms.forEach(a => {
              if (a.side === 1) {
                a.mesh.rotation.x = 1.1;
                a.mesh.rotation.z = a.base - 0.2;
              } else {
                a.mesh.rotation.x = 0.8 - pullBack;
                a.mesh.position.z = -pullBack;
              }
            });
          }
          if (parts.weapons) {
            parts.weapons.forEach(w => {
              if (w.type === 'bow') {
                w.mesh.rotation.x = 0.3;
                if (w.arrowMesh) {
                  w.arrowMesh.position.z = 0.02 - pullBack;
                }
              }
            });
          }
        }
      } else {
        if (parts.arms) {
          parts.arms.forEach((a, j) => {
            const swing = moving ? Math.sin(phase + (j * Math.PI)) * 0.45 : mining ? (j === 0 ? Math.max(0, Math.sin(phase)) * 1.05 : -0.25) : 0;
            a.mesh.rotation.z = a.base + swing * a.side;
            a.mesh.rotation.x = 0;
            a.mesh.position.z = 0;
          });
        }
        if (parts.weapons) {
          parts.weapons.forEach(w => {
            if (w.type === 'spear') {
              w.mesh.position.z = 0;
              w.mesh.rotation.x = 0;
            } else if (w.type === 'sword') {
              w.mesh.rotation.z = w.baseRotZ + (moving ? Math.sin(phase) * 0.15 : 0);
              w.mesh.rotation.x = 0;
            }
          });
        }
        if (unit.userData.horse) {
          unit.userData.horse.rotation.x = 0;
          unit.userData.horse.position.y = moving ? Math.abs(Math.sin(phase)) * 0.08 : 0;
        }
        unit.position.z = unit.userData.baseZ || 0;
      }

      if (parts.miningTool) {
        parts.miningTool.rotation.z = -0.25 + (mining ? Math.max(0, Math.sin(phase)) * 1.0 : 0);
      }
    });

    const banner = squad.children.find(c => c.userData.banner);
    if (banner) banner.rotation.y = Math.sin(elapsed * 2.2) * 0.12;
  }

  // Defending reactions
  const defendingTargetId = (fighting && army.target) ? army.target.id : null;

  for (const a of animated) {
    const isUnderAttack = defendingTargetId === a.obj.userData.gameData?.id;
    const parts = a.obj.userData.defensiveParts || {};

    if (a.kind === 'rabbit') {
      if (isUnderAttack) {
        a.obj.position.y = 0.04 + Math.abs(Math.sin(elapsed * 12)) * 0.35;
        a.obj.rotation.y = Math.sin(elapsed * 8) * 0.8;
        if (parts.ears) parts.ears.forEach(ear => { ear.rotation.x = -0.5; });
      } else {
        a.obj.position.y = 0.04 + Math.abs(Math.sin(elapsed * 4 + a.phase)) * 0.06;
        a.obj.rotation.y = Math.sin(elapsed * 0.6 + a.phase) * 0.3;
        if (parts.ears) parts.ears.forEach(ear => { ear.rotation.x = 0; });
      }
    } else if (a.kind === 'bear') {
      if (isUnderAttack) {
        const rearAngle = -0.42 + Math.sin(elapsed * 3.5) * 0.12;
        a.obj.rotation.x = rearAngle;
        a.obj.position.y = 0.18 + Math.abs(Math.sin(elapsed * 4)) * 0.08;
        if (parts.paws) {
          parts.paws.forEach((paw, idx) => {
            paw.rotation.x = -0.8 + Math.sin(elapsed * 6 + idx * Math.PI) * 0.75;
          });
        }
      } else {
        a.obj.rotation.x = 0;
        a.obj.position.y = 0.01 + Math.sin(elapsed * 1.7 + a.phase) * 0.025;
        a.obj.rotation.y = Math.sin(elapsed * 0.25 + a.phase) * 0.08;
        if (parts.paws) {
          parts.paws.forEach(paw => { paw.rotation.x = 0; });
        }
      }
    } else if (a.kind === 'knight') {
      if (isUnderAttack) {
        if (parts.shield) {
          parts.shield.position.set(-0.35, 1.3, 0.45);
          parts.shield.rotation.y = -0.4 + Math.sin(elapsed * 4) * 0.2;
        }
        if (parts.sword) {
          parts.sword.rotation.z = 0.8 + Math.sin(elapsed * 5) * 0.35;
          parts.sword.rotation.x = -0.6;
        }
        a.obj.position.y = Math.abs(Math.sin(elapsed * 5)) * 0.04;
      } else {
        if (parts.shield) {
          parts.shield.position.set(-0.65, 1.15, 0.12);
          parts.shield.rotation.y = 0;
        }
        if (parts.sword) {
          parts.sword.rotation.z = 0;
          parts.sword.rotation.x = 0;
        }
        a.obj.position.y = 0;
      }
    }
  }

  // Building vibration if under attack
  if (fighting && army.target && (army.target.kind === 'building' || army.target.kind === 'castle')) {
    const bldgGroup = objects.find(o => o.data.id === army.target.id)?.group;
    if (bldgGroup) {
      bldgGroup.position.y = Math.sin(elapsed * 24) * 0.025;
    }
  }

  if (window.selectionRing?.userData.follow) {
    const p = window.selectionRing.userData.follow.getWorldPosition(new THREE.Vector3());
    window.selectionRing.position.set(p.x, 0.035, p.z);
    window.selectionRing.rotation.z = elapsed * 0.2;
  }

  renderer.render(scene, camera);
  updateMinimap();
}

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  // Scaled for expansive 160x130 land
  const halfH = 30 / zoom;
  const halfW = halfH * aspect;
  camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
  camera.updateProjectionMatrix();
}

function applyZoom(next) {
  // Allows zooming out to 35% (broad kingdom theater) and in to 240%
  zoom = Math.max(0.35, Math.min(2.4, next));
  world.scale.setScalar(zoom);
  world.position.set(panX, 0, panZ);
  document.getElementById('zoomLabel').textContent = `${Math.round(zoom * 100)}%`;
  resize();
}

function onPointerDown(e) {
  pointerDown = { x: e.clientX, y: e.clientY, panX, panZ };
  dragMoved = false;
}

function onPointerMove(e) {
  if (!pointerDown) return;
  const dx = e.clientX - pointerDown.x, dy = e.clientY - pointerDown.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) dragMoved = true;
  if (dragMoved) {
    const scale = 0.055 / zoom;
    panX = pointerDown.panX + dx * scale;
    panZ = pointerDown.panZ + dy * scale;
    // Panning bounds for expansive 160x130 map
    panX = Math.max(-85, Math.min(85, panX));
    panZ = Math.max(-70, Math.min(70, panZ));
    world.position.set(panX, 0, panZ);
  }
}

function onPointerUp(e) {
  if (!pointerDown) return;
  if (!dragMoved) {
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(pickables, true);
    if (hits.length) selectObject(hits[0].object);
  }
  pointerDown = null;
}

function travelToMap(mapId) {
  if (mapId === currentMap) return;
  if (army.state !== 'idle') {
    toast('Return your army home before changing kingdom in this prototype.');
    return;
  }
  buildMap(mapId);
  army.position.copy(army.home);
  mapObjects.get('army')?.position.copy(army.position);
  panX = 0; panZ = 0;
  applyZoom(1);
  addLog('Kingdom entered', `Travelled to ${maps[mapId].name}.`, '⌖');
  toast(`Entered ${maps[mapId].name}`);
}

/* ==========================================================================
   EVENT LISTENERS & CONTROLS
   ========================================================================== */
document.querySelectorAll('.kingdom').forEach(btn => btn.addEventListener('click', () => travelToMap(btn.dataset.map)));
document.getElementById('marchBtn').addEventListener('click', () => beginMarch(selectedObject, 'march'));
document.getElementById('mineBtn').addEventListener('click', () => beginMarch(selectedObject, 'gather'));
document.getElementById('attackBtn').addEventListener('click', () => beginMarch(selectedObject, 'attack'));
document.getElementById('returnBtn').addEventListener('click', returnHome);
document.getElementById('zoomIn').addEventListener('click', () => applyZoom(zoom + 0.15));
document.getElementById('zoomOut').addEventListener('click', () => applyZoom(zoom - 0.15));
document.getElementById('resetView').addEventListener('click', () => { panX = 0; panZ = 0; world.position.set(0, 0, 0); applyZoom(1); });

renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
renderer.domElement.addEventListener('wheel', e => { e.preventDefault(); applyZoom(zoom + (e.deltaY < 0 ? 0.08 : -0.08)); }, { passive: false });
window.addEventListener('resize', resize);
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const k = e.key.toLowerCase();
  if (k === 'm') beginMarch(selectedObject, 'march');
  if (k === 'g') beginMarch(selectedObject, 'gather');
  if (k === 'a' && !e.ctrlKey && !e.metaKey) beginMarch(selectedObject, 'attack');
  if (k === 'r') returnHome();
  if (k === 'b') toggleBuildingsModal(true);

  // Smooth WASD and Arrow Keys panning across 160x130 land
  if (e.key === 'ArrowUp' || k === 'w') {
    panZ = Math.min(70, panZ + 5 / zoom);
    world.position.set(panX, 0, panZ);
  }
  if (e.key === 'ArrowDown' || k === 's') {
    panZ = Math.max(-70, panZ - 5 / zoom);
    world.position.set(panX, 0, panZ);
  }
  if (e.key === 'ArrowLeft' || k === 'a') {
    panX = Math.min(85, panX + 5 / zoom);
    world.position.set(panX, 0, panZ);
  }
  if (e.key === 'ArrowRight' || k === 'd') {
    panX = Math.max(-85, panX - 5 / zoom);
    world.position.set(panX, 0, panZ);
  }
  if (e.key === '+' || e.key === '=') applyZoom(zoom + 0.15);
  if (e.key === '-' || e.key === '_') applyZoom(zoom - 0.15);
  if (e.key === ' ' && !e.target.matches?.('input, textarea, select')) {
    e.preventDefault();
    centerOnArmy();
  }
});

/* ==========================================================================
   INTERACTIVE KINGDOM MINIMAP SYSTEM
   ========================================================================== */
const MINIMAP_BOUNDS = { minX: -80, maxX: 80, minZ: -65, maxZ: 65, width: 160, height: 130 };
const minimapOverlay = document.getElementById('minimapOverlay');
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
const minimapCoords = document.getElementById('minimapCoords');
const minimapTooltip = document.getElementById('minimapTooltip');
const btnCenterArmyMinimap = document.getElementById('btnCenterArmyMinimap');
const btnToggleMinimapLayers = document.getElementById('btnToggleMinimapLayers');
const minimapFilterBar = document.getElementById('minimapFilterBar');
const btnExpandMinimap = document.getElementById('btnExpandMinimap');
const btnExpandIcon = document.getElementById('btnExpandIcon');
const btnCollapseMinimap = document.getElementById('btnCollapseMinimap');
const minimapRestoreBtn = document.getElementById('minimapRestoreBtn');
const btnToggleMinimapQuick = document.getElementById('btnToggleMinimapQuick');
const minimapFilterBtns = document.querySelectorAll('.minimap-filter-btn');

let minimapFilter = 'all';
let minimapExpanded = false;
let minimapCollapsed = false;
let minimapDragging = false;
let hoveredMinimapObject = null;

function worldToMinimap(wx, wz, cw, ch) {
  const u = (wx - MINIMAP_BOUNDS.minX) / MINIMAP_BOUNDS.width;
  const v = (wz - MINIMAP_BOUNDS.minZ) / MINIMAP_BOUNDS.height;
  return {
    x: Math.max(0, Math.min(cw, u * cw)),
    y: Math.max(0, Math.min(ch, v * ch))
  };
}

function minimapToWorld(mx, my, cw, ch) {
  const u = Math.max(0, Math.min(1, mx / cw));
  const v = Math.max(0, Math.min(1, my / ch));
  return {
    x: MINIMAP_BOUNDS.minX + u * MINIMAP_BOUNDS.width,
    z: MINIMAP_BOUNDS.minZ + v * MINIMAP_BOUNDS.height
  };
}

function panCameraToWorld(wx, wz) {
  panX = -wx * zoom;
  panZ = -wz * zoom;
  panX = Math.max(-85, Math.min(85, panX));
  panZ = Math.max(-70, Math.min(70, panZ));
  world.position.set(panX, 0, panZ);
}

function centerOnArmy() {
  if (!army || !army.position) return;
  panCameraToWorld(army.position.x, army.position.z);
  toast(`Camera centered on ${army.id} Magar Vanguard`);
}

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const frustumRaycaster = new THREE.Raycaster();

function getFrustumWorldCorners() {
  const ndcCorners = [
    new THREE.Vector2(-1, 1),   // top-left of screen
    new THREE.Vector2(1, 1),    // top-right of screen
    new THREE.Vector2(1, -1),   // bottom-right of screen
    new THREE.Vector2(-1, -1)   // bottom-left of screen
  ];
  const points = [];
  for (const ndc of ndcCorners) {
    frustumRaycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (frustumRaycaster.ray.intersectPlane(groundPlane, hit)) {
      points.push({
        x: (hit.x - panX) / zoom,
        z: (hit.z - panZ) / zoom
      });
    }
  }
  return points.length === 4 ? points : null;
}

function findClosestMinimapObject(mx, my, cw, ch, maxDistPx = 14) {
  let closest = null;
  let minDist = maxDistPx;
  for (const o of objects) {
    const d = o.data;
    if (!d || d.x === undefined || d.z === undefined) continue;
    if (minimapFilter === 'resources' && d.kind !== 'resource') continue;
    if (minimapFilter === 'buildings' && d.kind !== 'building' && d.kind !== 'castle') continue;
    if (minimapFilter === 'army' && d.kind !== 'army') continue;
    if (minimapFilter === 'threats' && d.kind !== 'monster' && d.kind !== 'animal') continue;

    const m = worldToMinimap(d.x, d.z, cw, ch);
    const dist = Math.hypot(mx - m.x, my - m.y);
    if (dist < minDist) {
      minDist = dist;
      closest = o;
    }
  }
  return closest;
}

function updateMinimap() {
  if (!minimapCanvas || !minimapCtx || minimapCollapsed) return;
  const rect = minimapCanvas.getBoundingClientRect();
  const cw = rect.width || 260;
  const ch = rect.height || 195;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  if (minimapCanvas.width !== Math.round(cw * dpr) || minimapCanvas.height !== Math.round(ch * dpr)) {
    minimapCanvas.width = Math.round(cw * dpr);
    minimapCanvas.height = Math.round(ch * dpr);
  }

  const ctx = minimapCtx;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cw, ch);

  // 1. Base Kingdom Terrain Gradient
  const baseGrad = ctx.createLinearGradient(0, 0, 0, ch);
  if (currentMap === 'snow') {
    baseGrad.addColorStop(0, '#c9dce3');
    baseGrad.addColorStop(0.35, '#a2bdc4');
    baseGrad.addColorStop(1, '#8ea6ad');
  } else if (currentMap === 'mountain') {
    baseGrad.addColorStop(0, '#8e928f');
    baseGrad.addColorStop(0.35, '#717572');
    baseGrad.addColorStop(1, '#565c58');
  } else if (currentMap === 'forest') {
    baseGrad.addColorStop(0, '#4f755a');
    baseGrad.addColorStop(0.35, '#3a6646');
    baseGrad.addColorStop(1, '#274b32');
  } else {
    // Gorkha Valley
    baseGrad.addColorStop(0, '#759469');
    baseGrad.addColorStop(0.35, '#5e7d54');
    baseGrad.addColorStop(1, '#435e3b');
  }
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, cw, ch);

  // 2. Himalayan Snow Peaks at the North (Z in [-65, -45], top 20% of canvas)
  ctx.fillStyle = currentMap === 'snow' ? 'rgba(255,255,255,0.75)' : 'rgba(235, 245, 250, 0.45)';
  ctx.beginPath();
  ctx.moveTo(0, ch * 0.18);
  const peakPoints = [
    [0.08, 0.04], [0.16, 0.16], [0.26, 0.06], [0.36, 0.18], [0.48, 0.02],
    [0.60, 0.17], [0.72, 0.05], [0.84, 0.18], [0.94, 0.03], [1.0, 0.15]
  ];
  peakPoints.forEach(([px, py]) => ctx.lineTo(cw * px, ch * py));
  ctx.lineTo(cw, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();

  // 3. Glacial River Winding Across Realm
  ctx.strokeStyle = currentMap === 'snow' ? '#8cb8cb' : '#49889f';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const r0 = worldToMinimap(-75, -2, cw, ch);
  const r1 = worldToMinimap(-35, -8, cw, ch);
  const r2 = worldToMinimap(0, -5, cw, ch);
  const r3 = worldToMinimap(35, 6, cw, ch);
  const r4 = worldToMinimap(75, 12, cw, ch);
  ctx.moveTo(r0.x, r0.y);
  ctx.bezierCurveTo(r1.x, r1.y, r2.x, r2.y, r3.x, r3.y);
  ctx.lineTo(r4.x, r4.y);
  ctx.stroke();

  // River water highlights
  ctx.strokeStyle = 'rgba(215, 245, 255, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 4. Ancient Silk Road connecting Gorkha Citadel, Bazaar, and Eastern Mainland Gate
  ctx.strokeStyle = 'rgba(225, 205, 155, 0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 2.5]);
  ctx.beginPath();
  const roadCitadel = worldToMinimap(-14, 10, cw, ch);
  const roadBazaar = worldToMinimap(6, 2, cw, ch);
  const roadBridge = worldToMinimap(26, -2, cw, ch);
  const roadEastGate = worldToMinimap(68, 20, cw, ch);
  ctx.moveTo(roadCitadel.x, roadCitadel.y);
  ctx.lineTo(roadBazaar.x, roadBazaar.y);
  ctx.lineTo(roadBridge.x, roadBridge.y);
  ctx.lineTo(roadEastGate.x, roadEastGate.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // 5. Southern Terraced Basin Contours
  ctx.strokeStyle = 'rgba(235, 215, 140, 0.18)';
  ctx.lineWidth = 1;
  for (let t = 0.72; t <= 0.95; t += 0.08) {
    ctx.beginPath();
    ctx.ellipse(cw * 0.5, ch * t, cw * 0.42, ch * 0.12, 0, 0, Math.PI);
    ctx.stroke();
  }

  // 6. Draw Resource Nodes
  if (minimapFilter === 'all' || minimapFilter === 'resources') {
    objects.forEach(o => {
      const d = o.data;
      if (d.kind !== 'resource') return;
      const m = worldToMinimap(d.x, d.z, cw, ch);
      const isDepleted = d.quantity <= 0;
      const isGathering = (army.state === 'gathering' && army.target && army.target.id === d.id);

      ctx.save();
      ctx.translate(m.x, m.y);

      // Gathering Aura
      if (isGathering) {
        const pulse = (Math.sin(Date.now() / 150) + 1) * 0.5;
        ctx.strokeStyle = `rgba(255, 215, 80, ${0.4 + pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 7 + pulse * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      let fill = '#4ec278';
      let stroke = '#1d5a34';
      if (d.type === 'iron') { fill = '#e89146'; stroke = '#683610'; }
      else if (d.type === 'stone') { fill = '#c5d3dc'; stroke = '#4a5b67'; }
      else if (d.type === 'gold') { fill = '#f7ca48'; stroke = '#785b14'; }
      else if (d.type === 'food') { fill = '#c7b34d'; stroke = '#564d18'; }

      if (isDepleted) {
        fill = '#666e74';
        stroke = '#3b4348';
      }

      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;

      if (d.type === 'iron') {
        // Diamond for iron
        ctx.beginPath();
        ctx.moveTo(0, -4.5);
        ctx.lineTo(4.5, 0);
        ctx.lineTo(0, 4.5);
        ctx.lineTo(-4.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (d.type === 'gold') {
        // Star/Rhombus with halo for gold
        ctx.shadowColor = '#ffe27a';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(3.5, -1);
        ctx.lineTo(5, 0);
        ctx.lineTo(3.5, 1);
        ctx.lineTo(0, 5);
        ctx.lineTo(-3.5, 1);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-3.5, -1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (d.type === 'stone') {
        // Square for stone
        ctx.fillRect(-3.5, -3.5, 7, 7);
        ctx.strokeRect(-3.5, -3.5, 7, 7);
      } else {
        // Circle for wood / food
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  // 7. Draw Kingdom Buildings & Structures
  if (minimapFilter === 'all' || minimapFilter === 'buildings') {
    objects.forEach(o => {
      const d = o.data;
      if (d.kind !== 'building' && d.kind !== 'castle' && d.kind !== 'travel') return;
      const m = worldToMinimap(d.x, d.z, cw, ch);

      ctx.save();
      ctx.translate(m.x, m.y);

      if (d.kind === 'castle') {
        // Gorkha Citadel Keep - Majestic Golden Fortress
        const pulse = (Math.sin(Date.now() / 300) + 1) * 0.5;
        ctx.shadowColor = 'rgba(242, 217, 138, 0.7)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#f0c765';
        ctx.strokeStyle = '#684e14';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.rect(-5.5, -5.5, 11, 11);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner crown accent
        ctx.fillStyle = '#61480f';
        ctx.fillRect(-2, -2, 4, 4);

        // Friendly territory radar ring
        ctx.strokeStyle = `rgba(240, 199, 101, ${0.25 + pulse * 0.25})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.stroke();
      } else if (d.type === 'travel') {
        // Eastern Mainland Travel Gate
        ctx.fillStyle = '#e8b856';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (d.type === 'watchtower') {
        // Watchtower sentinel icon with vision cone
        ctx.fillStyle = '#e5a54b';
        ctx.strokeStyle = '#2b1b08';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(3.5, 3.5);
        ctx.lineTo(-3.5, 3.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (d.type === 'temple' || d.type === 'stupa') {
        // Sacred pagoda / stupa
        ctx.fillStyle = '#f2dc87';
        ctx.strokeStyle = '#7c661c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (d.category === 'Military') {
        // Barracks / Stables / Archery / Armory
        ctx.fillStyle = '#4fa8df';
        ctx.strokeStyle = '#153c54';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -3.5);
        ctx.lineTo(3.5, 0);
        ctx.lineTo(0, 3.5);
        ctx.lineTo(-3.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Other structures (Granary, Mill, Houses)
        ctx.fillStyle = '#a8bccc';
        ctx.strokeStyle = '#32404b';
        ctx.lineWidth = 1;
        ctx.fillRect(-2.5, -2.5, 5, 5);
        ctx.strokeRect(-2.5, -2.5, 5, 5);
      }

      ctx.restore();
    });
  }

  // 8. Draw Monsters / Hostiles / Wildlife
  if (minimapFilter === 'all' || minimapFilter === 'threats') {
    objects.forEach(o => {
      const d = o.data;
      if (d.kind !== 'monster' && d.kind !== 'animal') return;
      const m = worldToMinimap(d.x, d.z, cw, ch);

      ctx.save();
      ctx.translate(m.x, m.y);

      if (d.kind === 'monster') {
        // Red threat icon
        const pulse = (Math.sin(Date.now() / 200 + d.x) + 1) * 0.5;
        ctx.fillStyle = '#f04938';
        ctx.strokeStyle = '#4e1009';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(4, 0);
        ctx.lineTo(0, 4);
        ctx.lineTo(-4, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (pulse > 0.4) {
          ctx.strokeStyle = `rgba(240, 73, 56, ${pulse * 0.7})`;
          ctx.beginPath();
          ctx.arc(0, 0, 6 + pulse * 2.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        // Wildlife (Hares)
        ctx.fillStyle = '#c7ab63';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  }

  // 9. Draw Current Army Position (Magar Vanguard)
  if (minimapFilter === 'all' || minimapFilter === 'army') {
    const armyPos = army.position;
    const mArmy = worldToMinimap(armyPos.x, armyPos.z, cw, ch);

    // Destination Trajectory & Target Crosshair
    if (army.destination && (army.state === 'marching' || army.state === 'gathering' || army.state === 'attacking' || army.state === 'returning')) {
      const mDest = worldToMinimap(army.destination.x, army.destination.z, cw, ch);

      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.lineDashOffset = -(Date.now() / 35) % 7;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = army.state === 'returning' ? '#8ec7ee' : army.state === 'attacking' ? '#f55d4b' : '#ffd55c';
      ctx.beginPath();
      ctx.moveTo(mArmy.x, mArmy.y);
      ctx.lineTo(mDest.x, mDest.y);
      ctx.stroke();

      // Destination Crosshairs
      ctx.setLineDash([]);
      ctx.strokeStyle = army.state === 'attacking' ? '#f55d4b' : '#ffd55c';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(mDest.x, mDest.y, 4, 0, Math.PI * 2);
      ctx.moveTo(mDest.x - 6, mDest.y);
      ctx.lineTo(mDest.x + 6, mDest.y);
      ctx.moveTo(mDest.x, mDest.y - 6);
      ctx.lineTo(mDest.x, mDest.y + 6);
      ctx.stroke();
      ctx.restore();
    }

    // Animated Radar Ping Wave
    const waveProgress = (Date.now() % 1400) / 1400;
    const waveRadius = 4 + waveProgress * 12;
    ctx.strokeStyle = `rgba(98, 177, 255, ${1 - waveProgress})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mArmy.x, mArmy.y, waveRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Army Vanguard Shield Badge
    ctx.save();
    ctx.translate(mArmy.x, mArmy.y);

    // Direction needle
    let dirAngle = 0;
    if (army.destination && army.state !== 'idle') {
      dirAngle = Math.atan2(army.destination.z - armyPos.z, army.destination.x - armyPos.x);
    }
    ctx.rotate(dirAngle);

    ctx.fillStyle = '#5cb8ff';
    ctx.shadowColor = '#5cb8ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(7, 0);
    ctx.lineTo(4, -2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  // 10. Camera Viewport Frustum Bounding Box
  const corners = getFrustumWorldCorners();
  if (corners && corners.length === 4) {
    const mCorners = corners.map(p => worldToMinimap(p.x, p.z, cw, ch));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(mCorners[0].x, mCorners[0].y);
    ctx.lineTo(mCorners[1].x, mCorners[1].y);
    ctx.lineTo(mCorners[2].x, mCorners[2].y);
    ctx.lineTo(mCorners[3].x, mCorners[3].y);
    ctx.closePath();

    ctx.fillStyle = 'rgba(92, 197, 255, 0.15)';
    ctx.fill();

    ctx.strokeStyle = '#62c5ff';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Corner L-brackets
    mCorners.forEach(c => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(c.x - 1.5, c.y - 1.5, 3, 3);
    });

    // Screen Center Golden Crosshair
    const centerWorld = { x: -panX / zoom, z: -panZ / zoom };
    const mCenter = worldToMinimap(centerWorld.x, centerWorld.z, cw, ch);
    ctx.strokeStyle = '#e6bf65';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(mCenter.x - 4, mCenter.y);
    ctx.lineTo(mCenter.x + 4, mCenter.y);
    ctx.moveTo(mCenter.x, mCenter.y - 4);
    ctx.lineTo(mCenter.x, mCenter.y + 4);
    ctx.stroke();
    ctx.restore();
  }

  // 11. Hover Target Reticle
  if (hoveredMinimapObject) {
    const d = hoveredMinimapObject.data;
    const m = worldToMinimap(d.x, d.z, cw, ch);
    const pulse = (Math.sin(Date.now() / 120) + 1) * 0.5;

    ctx.save();
    ctx.strokeStyle = '#ffdf7a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 8 + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();

    // Bracket ticks
    ctx.beginPath();
    ctx.moveTo(m.x - 10, m.y); ctx.lineTo(m.x - 6, m.y);
    ctx.moveTo(m.x + 6, m.y); ctx.lineTo(m.x + 10, m.y);
    ctx.moveTo(m.x, m.y - 10); ctx.lineTo(m.x, m.y - 6);
    ctx.moveTo(m.x, m.y + 6); ctx.lineTo(m.x, m.y + 10);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// Minimap Interactive Event Handlers
if (minimapCanvas) {
  minimapCanvas.addEventListener('pointerdown', e => {
    e.stopPropagation();
    e.preventDefault();
    minimapDragging = true;
    const rect = minimapCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const hitObj = findClosestMinimapObject(mx, my, rect.width, rect.height, 12);
    if (hitObj) {
      selectObject(hitObj.group);
      panCameraToWorld(hitObj.data.x, hitObj.data.z);
    } else {
      const w = minimapToWorld(mx, my, rect.width, rect.height);
      panCameraToWorld(w.x, w.z);
    }
  });

  minimapCanvas.addEventListener('pointermove', e => {
    e.stopPropagation();
    const rect = minimapCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (minimapDragging) {
      const w = minimapToWorld(mx, my, rect.width, rect.height);
      panCameraToWorld(w.x, w.z);
    }

    const hit = findClosestMinimapObject(mx, my, rect.width, rect.height, 12);
    hoveredMinimapObject = hit;

    if (hit && minimapTooltip) {
      const d = hit.data;
      const kindLabel = d.kind === 'castle' ? 'FORTRESS' : (d.type || d.kind || '').toUpperCase();
      const statusText = d.quantity !== undefined ? `${d.quantity} remaining` : d.health !== undefined ? `${d.health} HP` : 'Active';
      minimapTooltip.innerHTML = `<div>${d.name || 'Entity'}</div><small>${kindLabel} · LVL ${d.level || 1} · ${statusText}</small>`;
      minimapTooltip.style.left = `${mx}px`;
      minimapTooltip.style.top = `${my}px`;
      minimapTooltip.style.display = 'block';

      if (minimapCoords) {
        minimapCoords.textContent = `${d.name.slice(0, 16)} · X: ${Math.round(d.x)} Z: ${Math.round(d.z)}`;
      }
    } else {
      if (minimapTooltip) minimapTooltip.style.display = 'none';
      const w = minimapToWorld(mx, my, rect.width, rect.height);
      if (minimapCoords) {
        minimapCoords.textContent = `X: ${Math.round(w.x)} · Z: ${Math.round(w.z)}`;
      }
    }
  });

  minimapCanvas.addEventListener('pointerleave', () => {
    hoveredMinimapObject = null;
    if (minimapTooltip) minimapTooltip.style.display = 'none';
  });

  minimapCanvas.addEventListener('wheel', e => {
    e.stopPropagation();
  });
}

window.addEventListener('pointerup', () => {
  minimapDragging = false;
});

// Minimap Header & Controls
btnCenterArmyMinimap?.addEventListener('click', e => {
  e.stopPropagation();
  centerOnArmy();
});

btnToggleMinimapLayers?.addEventListener('click', e => {
  e.stopPropagation();
  if (!minimapFilterBar) return;
  const isHidden = minimapFilterBar.style.display === 'none';
  minimapFilterBar.style.display = isHidden ? 'flex' : 'none';
  btnToggleMinimapLayers.classList.toggle('active', isHidden);
});

minimapFilterBtns.forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    minimapFilterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    minimapFilter = btn.dataset.filter || 'all';
  });
});

function toggleMinimapExpand() {
  if (!minimapOverlay) return;
  minimapExpanded = !minimapExpanded;
  minimapOverlay.classList.toggle('expanded', minimapExpanded);
  if (btnExpandIcon) {
    btnExpandIcon.textContent = minimapExpanded ? '⤡' : '⤢';
  }
}

function setMinimapCollapsed(collapse) {
  minimapCollapsed = collapse;
  if (minimapOverlay) minimapOverlay.classList.toggle('collapsed', collapse);
  if (minimapRestoreBtn) minimapRestoreBtn.style.display = collapse ? 'flex' : 'none';
  if (btnToggleMinimapQuick) btnToggleMinimapQuick.classList.toggle('active', !collapse);
}

function toggleMinimapVisibility() {
  setMinimapCollapsed(!minimapCollapsed);
}

btnExpandMinimap?.addEventListener('click', e => {
  e.stopPropagation();
  toggleMinimapExpand();
});

btnCollapseMinimap?.addEventListener('click', e => {
  e.stopPropagation();
  setMinimapCollapsed(true);
});

minimapRestoreBtn?.addEventListener('click', e => {
  e.stopPropagation();
  setMinimapCollapsed(false);
});

btnToggleMinimapQuick?.addEventListener('click', e => {
  e.stopPropagation();
  toggleMinimapVisibility();
});

/* ==========================================================================
   VEO VIDEO GENERATION CLIENT LOGIC
   ========================================================================== */
const veoModal = document.getElementById('veoModal');
const openVeoBtn = document.getElementById('openVeoBtn');
const closeVeoModal = document.getElementById('closeVeoModal');
const dropZone = document.getElementById('dropZone');
const veoFileInput = document.getElementById('veoFileInput');
const imagePreview = document.getElementById('imagePreview');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const videoOutput = document.getElementById('videoOutput');
const veoLoading = document.getElementById('veoLoading');
const veoStatusText = document.getElementById('veoStatusText');
const btnGenerateVideo = document.getElementById('btnGenerateVideo');
const videoActions = document.getElementById('videoActions');
const btnDownloadVideo = document.getElementById('btnDownloadVideo');

let currentSourceBase64 = null;
let currentSourceMime = 'image/jpeg';
let pollInterval = null;

openVeoBtn?.addEventListener('click', () => {
  if (veoModal) veoModal.style.display = 'grid';
});

closeVeoModal?.addEventListener('click', () => {
  if (veoModal) veoModal.style.display = 'none';
  if (pollInterval) clearInterval(pollInterval);
});

const tabUpload = document.getElementById('tabUpload');
const tabCapture = document.getElementById('tabCapture');
const tabPreset = document.getElementById('tabPreset');
const uploadContainer = document.getElementById('uploadContainer');
const captureContainer = document.getElementById('captureContainer');
const presetContainer = document.getElementById('presetContainer');

tabUpload?.addEventListener('click', () => {
  tabUpload.classList.add('active'); tabCapture.classList.remove('active'); tabPreset.classList.remove('active');
  uploadContainer.style.display = 'block'; captureContainer.style.display = 'none'; presetContainer.style.display = 'none';
});

tabCapture?.addEventListener('click', () => {
  tabCapture.classList.add('active'); tabUpload.classList.remove('active'); tabPreset.classList.remove('active');
  captureContainer.style.display = 'block'; uploadContainer.style.display = 'none'; presetContainer.style.display = 'none';
});

tabPreset?.addEventListener('click', () => {
  tabPreset.classList.add('active'); tabUpload.classList.remove('active'); tabCapture.classList.remove('active');
  presetContainer.style.display = 'block'; uploadContainer.style.display = 'none'; captureContainer.style.display = 'none';
});

dropZone?.addEventListener('click', () => veoFileInput?.click());
veoFileInput?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  currentSourceMime = file.type || 'image/jpeg';
  const reader = new FileReader();
  reader.onload = ev => {
    currentSourceBase64 = ev.target.result;
    displayPreviewImage(currentSourceBase64);
    toast('Image loaded for Veo animation');
  };
  reader.readAsDataURL(file);
});

dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = '#e05b4d'; });
dropZone?.addEventListener('dragleave', () => { dropZone.style.borderColor = '#3a4755'; });
dropZone?.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.style.borderColor = '#3a4755';
  const file = e.dataTransfer.files?.[0];
  if (!file) return;
  currentSourceMime = file.type || 'image/jpeg';
  const reader = new FileReader();
  reader.onload = ev => {
    currentSourceBase64 = ev.target.result;
    displayPreviewImage(currentSourceBase64);
    toast('Image loaded for Veo animation');
  };
  reader.readAsDataURL(file);
});

document.getElementById('btnSnapViewport')?.addEventListener('click', () => {
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/jpeg', 0.95);
  currentSourceBase64 = dataUrl;
  currentSourceMime = 'image/jpeg';
  displayPreviewImage(dataUrl);
  toast('Captured 3D realm snapshot!');
});

document.querySelectorAll('.preset-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    const preset = card.dataset.preset;
    const c = document.createElement('canvas');
    c.width = 1280; c.height = 720;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 720);
    grad.addColorStop(0, preset === 'snow_pass' ? '#92b3c2' : preset === 'army_charge' ? '#462b29' : '#33484f');
    grad.addColorStop(1, preset === 'snow_pass' ? '#d4e6ed' : preset === 'army_charge' ? '#783c36' : '#6b7a69');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 52px Arial'; ctx.textAlign = 'center';
    ctx.fillText(preset === 'snow_pass' ? 'HIMSHIKHAR FROZEN PEAKS' : preset === 'army_charge' ? 'MAGAR VANGUARD IN BATTLE' : 'GORKHA CITADEL FORTRESS', 640, 360);
    ctx.font = '32px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Himalayan Realms Cinematic Sequence', 640, 420);
    const dataUrl = c.toDataURL('image/jpeg', 0.9);
    currentSourceBase64 = dataUrl;
    currentSourceMime = 'image/jpeg';
    displayPreviewImage(dataUrl);
    toast(`Loaded ${card.querySelector('b').textContent} preset`);
  });
});

function displayPreviewImage(dataUrl) {
  imagePreview.src = dataUrl;
  imagePreview.style.display = 'block';
  previewPlaceholder.style.display = 'none';
  videoOutput.style.display = 'none';
  videoActions.style.display = 'none';
}

const reassuringMessages = [
  'Connecting to Veo 3.1 video generation model…',
  'Analyzing Himalayan landscape geometry and lighting…',
  'Synthesizing dynamic atmospheric wind and cloud motion…',
  'Rendering mountain depth and flutter dynamics…',
  'Assembling high-definition video sequence…',
  'Finalizing MP4 video encode…'
];

btnGenerateVideo?.addEventListener('click', async () => {
  if (!currentSourceBase64) {
    toast('Please upload an image or snapshot the realm first.');
    return;
  }

  const selectedAspect = document.querySelector('input[name="aspectRatio"]:checked')?.value || '16:9';
  const promptText = document.getElementById('veoPrompt')?.value || 'Cinematic fantasy sequence with mountain atmosphere';

  btnGenerateVideo.disabled = true;
  veoLoading.style.display = 'flex';
  videoOutput.style.display = 'none';
  videoActions.style.display = 'none';

  let messageIndex = 0;
  veoStatusText.textContent = reassuringMessages[0];
  const messageInterval = setInterval(() => {
    messageIndex = (messageIndex + 1) % reassuringMessages.length;
    veoStatusText.textContent = reassuringMessages[messageIndex];
  }, 12000);

  try {
    const res = await fetch('/api/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: currentSourceBase64,
        mimeType: currentSourceMime,
        prompt: promptText,
        aspectRatio: selectedAspect
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to request video generation');
    }

    const { operationName } = await res.json();

    pollInterval = setInterval(async () => {
      try {
        const pollRes = await fetch('/api/video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationName })
        });

        if (!pollRes.ok) throw new Error('Status poll failed');
        const pollData = await pollRes.json();

        if (pollData.done) {
          clearInterval(pollInterval);
          clearInterval(messageInterval);
          veoStatusText.textContent = 'Downloading generated video…';

          const downloadRes = await fetch('/api/video-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operationName })
          });

          if (!downloadRes.ok) throw new Error('Failed to retrieve video stream');

          const videoBlob = await downloadRes.blob();
          const videoUrl = URL.createObjectURL(videoBlob);

          imagePreview.style.display = 'none';
          veoLoading.style.display = 'none';
          videoOutput.src = videoUrl;
          videoOutput.style.display = 'block';
          videoOutput.play();

          videoActions.style.display = 'block';
          btnDownloadVideo.href = videoUrl;
          btnGenerateVideo.disabled = false;

          addLog('Veo Video generated', 'Created cinematic sequence with Veo 3.1.', '🎥');
          toast('Veo video generation complete!');
        }
      } catch (pollErr) {
        console.error('Polling error:', pollErr);
      }
    }, 4500);

  } catch (error) {
    clearInterval(messageInterval);
    if (pollInterval) clearInterval(pollInterval);
    veoLoading.style.display = 'none';
    btnGenerateVideo.disabled = false;
    alert(`Video generation error: ${error.message}`);
    toast('Video generation failed');
  }
});

/* ==========================================================================
   IMAGE STUDIO (GEMINI-NANO-BANANA-2.1) CLIENT LOGIC
   ========================================================================= */
const imageStudioModal = document.getElementById('imageStudioModal');
const openImageStudioBtn = document.getElementById('openImageStudioBtn');
const closeImageStudioModal = document.getElementById('closeImageStudioModal');
const armyPortraitBox = document.getElementById('armyPortraitBox');
const armyPortraitImg = document.getElementById('armyPortraitImg');
const btnModeCreate = document.getElementById('btnModeCreate');
const btnModeEdit = document.getElementById('btnModeEdit');
const artSourceContainer = document.getElementById('artSourceContainer');
const btnUseMagarTpose = document.getElementById('btnUseMagarTpose');
const btnCaptureArtViewport = document.getElementById('btnCaptureArtViewport');
const btnUploadArtBase = document.getElementById('btnUploadArtBase');
const artFileInput = document.getElementById('artFileInput');
const currentEditThumbBox = document.getElementById('currentEditThumbBox');
const currentEditThumb = document.getElementById('currentEditThumb');
const imagePromptInput = document.getElementById('imagePromptInput');
const imageAspectRatio = document.getElementById('imageAspectRatio');
const imageResolution = document.getElementById('imageResolution');
const btnGenerateImage = document.getElementById('btnGenerateImage');
const btnGenerateImageText = document.getElementById('btnGenerateImageText');
const artLoading = document.getElementById('artLoading');
const artStatusText = document.getElementById('artStatusText');
const artOutputImg = document.getElementById('artOutputImg');
const btnDownloadArt = document.getElementById('btnDownloadArt');
const btnSetAsPortrait = document.getElementById('btnSetAsPortrait');

let isEditMode = false;
let currentArtBase64 = null;
let currentArtMime = 'image/jpeg';
let latestGeneratedArtUrl = '/assets/images/magar_infantry_tpose.jpg';

function openStudio() {
  if (imageStudioModal) imageStudioModal.style.display = 'grid';
}

function closeStudio() {
  if (imageStudioModal) imageStudioModal.style.display = 'none';
}

openImageStudioBtn?.addEventListener('click', openStudio);
armyPortraitBox?.addEventListener('click', openStudio);
closeImageStudioModal?.addEventListener('click', closeStudio);

btnModeCreate?.addEventListener('click', () => {
  isEditMode = false;
  btnModeCreate.classList.add('active');
  btnModeEdit.classList.remove('active');
  if (artSourceContainer) artSourceContainer.style.display = 'none';
  if (btnGenerateImageText) btnGenerateImageText.textContent = 'Generate Art with Nano Banana 2.1';
});

btnModeEdit?.addEventListener('click', () => {
  isEditMode = true;
  btnModeEdit.classList.add('active');
  btnModeCreate.classList.remove('active');
  if (artSourceContainer) artSourceContainer.style.display = 'block';
  if (btnGenerateImageText) btnGenerateImageText.textContent = 'Edit Image with Nano Banana 2.1';
  if (!currentArtBase64) {
    loadMagarInfantryAsBase();
  }
});

async function loadMagarInfantryAsBase() {
  try {
    const res = await fetch('/assets/images/magar_infantry_tpose.jpg');
    const blob = await res.blob();
    const reader = new FileReader();
    reader.onload = ev => {
      currentArtBase64 = ev.target.result;
      currentArtMime = blob.type || 'image/jpeg';
      if (currentEditThumb) currentEditThumb.src = currentArtBase64;
      if (currentEditThumbBox) currentEditThumbBox.style.display = 'block';
      toast('Level 1 Magar Infantry loaded as base image');
    };
    reader.readAsDataURL(blob);
  } catch (e) {
    console.warn('Could not load Magar T-Pose base image', e);
  }
}

btnUseMagarTpose?.addEventListener('click', loadMagarInfantryAsBase);

btnCaptureArtViewport?.addEventListener('click', () => {
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/jpeg', 0.95);
  currentArtBase64 = dataUrl;
  currentArtMime = 'image/jpeg';
  if (currentEditThumb) currentEditThumb.src = currentArtBase64;
  if (currentEditThumbBox) currentEditThumbBox.style.display = 'block';
  toast('Captured 3D realm scene as base image');
});

btnUploadArtBase?.addEventListener('click', () => artFileInput?.click());
artFileInput?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  currentArtMime = file.type || 'image/jpeg';
  const reader = new FileReader();
  reader.onload = ev => {
    currentArtBase64 = ev.target.result;
    if (currentEditThumb) currentEditThumb.src = currentArtBase64;
    if (currentEditThumbBox) currentEditThumbBox.style.display = 'block';
    toast('Custom base image loaded for editing');
  };
  reader.readAsDataURL(file);
});

document.querySelectorAll('.preset-tag').forEach(tag => {
  tag.addEventListener('click', () => {
    document.querySelectorAll('.preset-tag').forEach(t => t.classList.remove('active'));
    tag.classList.add('active');
    const prompt = tag.dataset.prompt;
    if (imagePromptInput && prompt) {
      imagePromptInput.value = prompt;
    }
  });
});

btnGenerateImage?.addEventListener('click', async () => {
  const prompt = imagePromptInput?.value?.trim();
  if (!prompt) {
    toast('Please enter a prompt or instructions.');
    return;
  }

  btnGenerateImage.disabled = true;
  if (artLoading) artLoading.style.display = 'flex';
  if (artStatusText) {
    artStatusText.textContent = isEditMode
      ? 'Editing image with gemini-nano-banana-2.1…'
      : 'Synthesizing 3D character art with gemini-nano-banana-2.1…';
  }

  const payload = {
    prompt,
    aspectRatio: imageAspectRatio?.value || '3:4',
    imageSize: imageResolution?.value || '1K'
  };

  if (isEditMode && currentArtBase64) {
    payload.imageBase64 = currentArtBase64;
    payload.mimeType = currentArtMime;
  }

  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Image generation failed');
    }

    latestGeneratedArtUrl = data.imageUrl;
    if (artOutputImg) {
      artOutputImg.src = latestGeneratedArtUrl;
      artOutputImg.style.display = 'block';
    }
    if (btnDownloadArt) {
      btnDownloadArt.href = latestGeneratedArtUrl;
      btnDownloadArt.download = 'himalayan_art_nano_banana.png';
    }

    addLog('AI Art created', isEditMode ? 'Edited concept art with gemini-nano-banana-2.1.' : 'Generated 3D character art with gemini-nano-banana-2.1.', '🎨');
    toast(isEditMode ? 'Image edited successfully!' : 'Art generated with Nano Banana 2.1!');
  } catch (error) {
    console.error('Image generation error:', error);
    alert(`Image generation failed: ${error.message}`);
    toast('Image generation failed');
  } finally {
    if (artLoading) artLoading.style.display = 'none';
    btnGenerateImage.disabled = false;
  }
});

btnSetAsPortrait?.addEventListener('click', () => {
  if (latestGeneratedArtUrl && armyPortraitImg) {
    armyPortraitImg.src = latestGeneratedArtUrl;
    toast('Set as Magar Vanguard portrait!');
    addLog('Army portrait updated', 'Magar Vanguard unit portrait updated with concept render.', '🛡️');
  }
});

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */
buildMap('valley');
applyWeather(0, false);
resize();
animate();
setMissionState('idle', 'Your army is awaiting orders at the kingdom gate.');
selectedObject = objects.find(o => o.data.kind === 'castle')?.data || null;
refreshTargetUI();
setTimeout(() => toast('Select any building to view upgrade asset requirements, or march your army!'), 700);
