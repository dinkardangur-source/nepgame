import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/loaders/GLTFLoader.js';

const viewport = document.getElementById('gameViewport');
const loadingBadge = document.getElementById('loadingBadge');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#8ba3a1');
scene.fog = new THREE.Fog('#8ba3a1', 30, 75);

const camera = new THREE.OrthographicCamera(-16, 16, 12, -12, 0.1, 200);
camera.position.set(22, 25, 22);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
viewport.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdceeff, 0x354536, 2.0));
const sun = new THREE.DirectionalLight(0xffe2bd, 3.0);
sun.position.set(-12, 22, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
scene.add(sun);

const world = new THREE.Group();
scene.add(world);
const pickables = [];
const animated = [];
const mixers = [];
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
// Upgrade procedural placeholders with original GLB assets as soon as each file loads.
// Labels and gameplay metadata stay attached to the existing interactive groups.
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

const maps = {
  valley: { name: 'Gorkha Valley', subtitle: 'HOME TERRITORY · CENTRAL HIMALAYAS', ground: '#67835b', hill: '#82946b', snow: false },
  snow: { name: 'Himshikhar', subtitle: 'SNOW KINGDOM · FROZEN FRONTIER', ground: '#a9c1c4', hill: '#dce5e5', snow: true },
  mountain: { name: 'Ironcrest', subtitle: 'MOUNTAIN KINGDOM · ORE TERRITORY', ground: '#777a76', hill: '#999a91', snow: false },
  forest: { name: 'Green Mandala', subtitle: 'FOREST KINGDOM · ANCIENT WOODLAND', ground: '#3e6e4c', hill: '#628259', snow: false }
};
let currentMap = 'valley';
let selectedObject = null;
let zoom = 1;
let panX = 0, panZ = 0;
let pointerDown = null;
let dragMoved = false;
let toastTimeout;
const resources = { wood: 1250, stone: 860, iron: 420, food: 2100 };
const army = { id:'A-01', home: new THREE.Vector3(-6,0,5), position: new THREE.Vector3(-6,0,5), destination:null, state:'idle', progress:0, duration:0, timer:0, target:null, health:100, counts:{infantry:120,cavalry:24,archer:60}, missionType:null, start:null, returnAfterTask:false };
const objects = [];
const mapObjects = new Map();
const combatEffects = [];
let nextHitAt = 0;
let monsterHitCount = 0;
const clock = new THREE.Clock();
let missionLoop = null;

function mat(color, roughness=0.88, metalness=0) { return new THREE.MeshStandardMaterial({color, roughness, metalness}); }
function addMesh(parent, geometry, material, x,y,z, cast=true) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x,y,z); m.castShadow=cast; m.receiveShadow=true; parent.add(m); return m;
}
function makeLabelSprite(text, color='#f4f0df') {
  const c = document.createElement('canvas'); c.width=512; c.height=96;
  const ctx=c.getContext('2d'); ctx.fillStyle='rgba(16,23,25,.82)';
  ctx.beginPath(); ctx.roundRect(10,10,492,76,12); ctx.fill();
  ctx.strokeStyle='rgba(210,220,205,.5)'; ctx.lineWidth=3; ctx.stroke();
  ctx.font='bold 34px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=color; ctx.fillText(text,256,49);
  const texture=new THREE.CanvasTexture(c); texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));
  sprite.scale.set(4.1,.78,1); return sprite;
}
function registerObject(obj, data) {
  if (!obj.parent) world.add(obj);
  obj.userData.gameData = data;
  obj.traverse?.(child=>{ if(child.isMesh) child.userData.gameData=data; });
  pickables.push(obj); objects.push({group:obj,data}); return obj;
}
function createGround(config) {
  const ground=addMesh(world,new THREE.PlaneGeometry(44,34),mat(config.ground),0,-.12,0,false);
  ground.rotation.x=-Math.PI/2;
  // layered hill mounds
  for(let i=0;i<17;i++){
    const x=(Math.random()-.5)*37, z=(Math.random()-.5)*27;
    const r=1.3+Math.random()*2.6;
    const hill=addMesh(world,new THREE.SphereGeometry(1,10,7),mat(config.hill),x,-.12,z,false);
    hill.scale.set(r,.35+Math.random()*.7,r*.72);
    if(config.snow){
      const cap=addMesh(world,new THREE.SphereGeometry(1,10,6),mat('#e8f1ef'),x,.1,z,false);
      cap.scale.set(r*.65,.2,r*.47);
    }
  }
  // pale road winding through map
  const points=[new THREE.Vector3(-21,-.04,8),new THREE.Vector3(-13,-.04,4),new THREE.Vector3(-6,-.04,6),new THREE.Vector3(1,-.04,1),new THREE.Vector3(7,-.04,-3),new THREE.Vector3(18,-.04,-5)];
  const curve=new THREE.CatmullRomCurve3(points);
  const road=new THREE.Mesh(new THREE.TubeGeometry(curve,80,.24,6,false),mat(config.snow?'#b4b6a9':'#c6b68d'));
  road.receiveShadow=true; world.add(road);
  // stream
  const riverPoints=[new THREE.Vector3(-20,-.01,-7),new THREE.Vector3(-11,-.01,-4),new THREE.Vector3(-5,-.01,-7),new THREE.Vector3(3,-.01,-5),new THREE.Vector3(12,-.01,-10),new THREE.Vector3(21,-.01,-8)];
  const riverCurve=new THREE.CatmullRomCurve3(riverPoints);
  const river=new THREE.Mesh(new THREE.TubeGeometry(riverCurve,80,.35,7,false),mat('#4d9cae',.3,.1)); world.add(river);
}
function createTree(x,z,scale=1,snow=false) {
  const g=new THREE.Group(); g.position.set(x,0,z); g.scale.setScalar(scale);
  addMesh(g,new THREE.CylinderGeometry(.13,.22,1.2,7),mat('#594331'),0,.6,0);
  const green=snow?'#607c78':'#315b3d';
  for(let i=0;i<3;i++){
    const cone=addMesh(g,new THREE.ConeGeometry(0.78-i*.13,1.4,7),mat(i===0?green:(snow?'#78938f':'#426d47')),0,1.25+i*.55,0);
  }
  if(snow) addMesh(g,new THREE.ConeGeometry(.48,1.1,7),mat('#e4eeeb'),0,2.05,0,false);
  world.add(g);
  if (!snow) applyGLBVisual(g, 'himalayan_pine.glb');
  return g;
}
function createRock(x,z,color='#7c8580',scale=1) {
  const g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=Math.random()*3;
  const rock=addMesh(g,new THREE.DodecahedronGeometry(.65,0),mat(color),0,.42,0);
  rock.scale.set(1.1,.8,.9); g.scale.setScalar(scale); world.add(g); return g;
}
function createBuilding(x,z,kind='house',scale=1) {
  const g=new THREE.Group(); g.position.set(x,0,z); g.scale.setScalar(scale);
  if(kind==='castle'){
    addMesh(g,new THREE.BoxGeometry(3.8,1.6,2.8),mat('#aaa69a'),0,.8,0);
    addMesh(g,new THREE.BoxGeometry(4.1,.2,3.1),mat('#625c54'),0,1.7,0);
    for(const [tx,tz] of [[-1.55,-1.05],[1.55,-1.05],[-1.55,1.05],[1.55,1.05]]){
      addMesh(g,new THREE.BoxGeometry(.65,2.6,.65),mat('#b9b2a2'),tx,1.25,tz);
      addMesh(g,new THREE.ConeGeometry(.48,.7,4),mat('#8b3931'),tx,2.9,tz).rotation.y=Math.PI/4;
    }
    addMesh(g,new THREE.BoxGeometry(1.1,1.35,.18),mat('#49372c'),0,.67,1.42);
    // Nepalese hill-fort details: inner keep, battlements, timber gate and war banners
    addMesh(g,new THREE.BoxGeometry(1.65,2.25,1.45),mat('#918c80'),0,1.85,-.1);
    addMesh(g,new THREE.ConeGeometry(1.08,.68,4),mat('#843b32'),0,3.28,-.1).rotation.y=Math.PI/4;
    for (let i=0;i<5;i++) {
      addMesh(g,new THREE.BoxGeometry(.22,.28,.22),mat('#c1b8a7'),-1.35+i*.68,1.95,1.48);
      addMesh(g,new THREE.BoxGeometry(.22,.28,.22),mat('#c1b8a7'),-1.35+i*.68,1.95,-1.48);
    }
    const flagPole=addMesh(g,new THREE.CylinderGeometry(.035,.035,1.3,6),mat('#c8b58b'),0,4.2,-.1);
    addMesh(g,new THREE.BoxGeometry(.58,.36,.045),mat('#a83d34'),.28,4.55,-.1);
    addMesh(g,new THREE.BoxGeometry(.13,.13,.13),mat('#d4b96d'),0,4.9,-.1);
  } else {
    addMesh(g,new THREE.BoxGeometry(1.7,1.3,1.5),mat(kind==='temple'?'#a89d7e':'#9c8a70'),0,.65,0);
    const roof=addMesh(g,new THREE.ConeGeometry(1.35,.8,4),mat(kind==='temple'?'#a84436':'#59483a'),0,1.65,0);
    roof.rotation.y=Math.PI/4;
    addMesh(g,new THREE.BoxGeometry(.35,.7,.1),mat('#49382d'),0,.35,.77);
  }
  world.add(g);
  if (kind === 'castle') applyGLBVisual(g, 'gorkha_hillfort.glb');
  return g;
}
function createWarriorModel(type='infantry', color='#9b493c') {
  const g=new THREE.Group();
  const skin=mat('#bd8d6a'), cloth=mat(color), dark=mat('#332f2b'), steel=mat('#9ca9af',.4,.55), wood=mat('#74513a');
  addMesh(g,new THREE.CylinderGeometry(.24,.32,.78,8),cloth,0,1.02,0);
  addMesh(g,new THREE.SphereGeometry(.22,12,10),skin,0,1.58,0);
  addMesh(g,new THREE.CylinderGeometry(.235,.245,.11,8),dark,0,1.75,0);
  // head wrap
  addMesh(g,new THREE.TorusGeometry(.22,.055,5,12),cloth,0,1.72,0).rotation.x=Math.PI/2;
  const animatedArms=[];
  for(const sx of [-1,1]){
    const arm=addMesh(g,new THREE.CylinderGeometry(.075,.09,.55,7),cloth,sx*.31,1.13,.02); arm.rotation.z=sx*-.2;
    animatedArms.push({mesh:arm,side:sx,base:arm.rotation.z});
    addMesh(g,new THREE.CylinderGeometry(.07,.07,.62,7),dark,sx*.14,.42,0);
  }
  addMesh(g,new THREE.BoxGeometry(.17,.12,.13),dark,0,.12,.02);
  const animatedWeapons=[];
  if(type==='infantry'){
    const blade=addMesh(g,new THREE.BoxGeometry(.075,.68,.08),steel,.48,1.0,.1); blade.rotation.z=-.2; animatedWeapons.push({mesh:blade,base:blade.rotation.z});
    addMesh(g,new THREE.BoxGeometry(.25,.25,.1),wood,-.43,1.04,.12);
    addMesh(g,new THREE.CylinderGeometry(.03,.03,.25,8),dark,.48,.61,.1);
  } else if(type==='archer'){
    const bow=addMesh(g,new THREE.TorusGeometry(.32,.035,6,16,Math.PI),wood,.43,1.2,.05); bow.rotation.z=Math.PI/2;
    const arrow=addMesh(g,new THREE.CylinderGeometry(.02,.02,.58,5),steel,.47,1.2,.07); arrow.rotation.z=-.1; animatedWeapons.push({mesh:arrow,base:arrow.rotation.z});
    addMesh(g,new THREE.BoxGeometry(.1,.44,.1),wood,-.31,1.42,-.15);
  } else {
    const lance=addMesh(g,new THREE.CylinderGeometry(.05,.05,.82,7),steel,.42,1.18,.02); lance.rotation.z=-.16; animatedWeapons.push({mesh:lance,base:lance.rotation.z});
    const horse=new THREE.Group();
    addMesh(horse,new THREE.BoxGeometry(.55,.52,1.0),mat('#6d4b35'),0,.65,-.05);
    addMesh(horse,new THREE.BoxGeometry(.28,.6,.28),mat('#6d4b35'),0,.96,.42).rotation.x=-.25;
    addMesh(horse,new THREE.SphereGeometry(.2,8,7),mat('#6d4b35'),0,1.24,.58);
    for(const sx of [-.18,.18]) for(const sz of [-.35,.3]) addMesh(horse,new THREE.CylinderGeometry(.055,.07,.65,6),mat('#4a382b'),sx,.3,sz);
    horse.position.y=-.02; g.add(horse);
    g.userData.horse=horse;
  }
  // shoulder sash
  addMesh(g,new THREE.BoxGeometry(.12,.85,.1),mat('#d0ae68'),-.12,1.1,.18).rotation.z=-.22;
  const miningTool=new THREE.Group();
  const handle=addMesh(miningTool,new THREE.CylinderGeometry(.035,.045,.62,6),wood,0,.1,0);
  handle.rotation.z=-.38;
  const pickHead=addMesh(miningTool,new THREE.BoxGeometry(.48,.09,.1),steel,.1,.36,0);
  pickHead.rotation.z=-.18;
  miningTool.position.set(.48,1.05,.12); miningTool.rotation.z=-.25; miningTool.visible=false; g.add(miningTool);
  g.userData.animParts={arms:animatedArms,weapons:animatedWeapons,type,miningTool};
  return g;
}
function createArmy() {
  const g=new THREE.Group();
  const bannerPole=addMesh(g,new THREE.CylinderGeometry(.035,.035,2.4,6),mat('#b4a080'),-.7,1.5,-.15);
  const banner=addMesh(g,new THREE.BoxGeometry(.8,.48,.05),mat('#a83d34'),-.32,2.15,-.15);
  banner.userData.banner=true;
  const models=[];
  // Compact multi-rank formation so the whole squad visibly marches as a unit.
  for(let i=0;i<15;i++){
    const type=(i===4||i===10)?'cavalry':(i===2||i===7||i===12?'archer':'infantry');
    const m=createWarriorModel(type,type==='archer'?'#71886d':(type==='cavalry'?'#806343':'#9d4438'));
    const col=i%5, row=Math.floor(i/5);
    m.position.set((col-2)*.58,0,(row-1)*.62+.25);
    m.scale.setScalar(type==='cavalry'?.66:.72); g.add(m); models.push(m);
  }
  g.userData.models=models;
  return g;
}
function createResource(data) {
  const g=new THREE.Group(); const c=data.type==='wood'?'#487447':data.type==='iron'?'#818d91':data.type==='stone'?'#9a9c95':data.type==='gold'?'#d0a74c':'#6f9860';
  if(data.type==='wood'){
    addMesh(g,new THREE.CylinderGeometry(.18,.25,1.6,7),mat('#5d422e'),0,.8,0);
    for(let i=0;i<3;i++) addMesh(g,new THREE.ConeGeometry(.85-i*.12,1.15,7),mat('#376345'),0,1.5+i*.5,0);
  } else if(data.type==='iron' || data.type==='stone' || data.type==='gold'){
    for(let i=0;i<5;i++){
      const r=addMesh(g,new THREE.DodecahedronGeometry(.45+Math.random()*.22,0),mat(c,.6,.15),(Math.random()-.5)*1.1,.4+Math.random()*.35,(Math.random()-.5)*.7);
      r.rotation.set(Math.random(),Math.random(),Math.random());
    }
    if(data.type==='gold') addMesh(g,new THREE.OctahedronGeometry(.22),mat('#f4d77c',.3,.25),0,.9,0);
  } else {
    addMesh(g,new THREE.BoxGeometry(1,.55,.85),mat('#8c7448'),0,.28,0);
    addMesh(g,new THREE.BoxGeometry(.35,.6,.35),mat('#b8a071'),0,.75,0);
  }
  g.position.set(data.x,0,data.z);
  const label=makeLabelSprite(data.name); label.position.set(0,2.5,0); g.add(label);
  const assetByType = { wood:'timber_node.glb', iron:'iron_vein.glb', stone:'stone_quarry.glb', gold:'gold_seam.glb' };
  if (assetByType[data.type]) applyGLBVisual(g, assetByType[data.type]);
  return registerObject(g,data);
}
function makeMonsterHealthBar(group, data) {
  data.maxHealth = data.maxHealth || data.health || 100;
  const holder = new THREE.Group();
  holder.position.set(0, data.type === 'bear' ? 2.75 : data.type === 'knight' ? 2.55 : 1.75, 0);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .19), new THREE.MeshBasicMaterial({color:0x1b2023, side:THREE.DoubleSide, depthTest:false}));
  back.position.z = .01; holder.add(back);
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.72, .105), new THREE.MeshBasicMaterial({color:0x67d18b, side:THREE.DoubleSide, depthTest:false}));
  fill.position.set(0,0,.025); holder.add(fill);
  const label = makeLabelSprite(`${data.name} · ${data.health}/${data.maxHealth}`, '#f4f0df');
  label.scale.set(2.25,.38,1); label.position.set(0,.28,.02); holder.add(label);
  holder.userData = {healthFill:fill, healthLabel:label, back, data};
  group.add(holder); data.healthBar = holder;
  return holder;
}
function updateMonsterHealthBar(data) {
  if (!data?.healthBar) return;
  const h=data.healthBar.userData, pct=Math.max(0,Math.min(1,(data.health||0)/(data.maxHealth||100)));
  h.healthFill.scale.x=pct; h.healthFill.position.x=-(1-pct)*.86;
  h.healthFill.material.color.set(pct>.55?0x67d18b:pct>.25?0xe5bd57:0xe05e56);
  h.healthLabel.material.map.dispose();
  const c=document.createElement('canvas'); c.width=512;c.height=96; const ctx=c.getContext('2d');
  ctx.fillStyle='rgba(16,23,25,.86)';ctx.beginPath();ctx.roundRect(10,10,492,76,12);ctx.fill();ctx.font='bold 32px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f4f0df';ctx.fillText(`${data.name} · ${Math.max(0,Math.ceil(data.health||0))}/${data.maxHealth}`,256,49);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;h.healthLabel.material.map=tex;h.healthLabel.material.needsUpdate=true;
}
function spawnDamageNumber(data, amount) {
  const sprite=makeLabelSprite(`-${amount}`, '#ff8d78'); sprite.scale.set(1.25,.48,1);
  const group=objects.find(o=>o.data===data)?.group;
  if (!group) return;
  sprite.position.set((Math.random()-.5)*.7, data.type==='bear'?2.5:2.1, .15); group.add(sprite);
  combatEffects.push({sprite, group, age:0, duration:.9, startY:sprite.position.y});
}
function applyMonsterHit(data) {
  if (!data || data.health<=0) return;
  const squad=mapObjects.get('army');
  const damage=Math.max(3,Math.round(5+army.counts.infantry*.045+army.counts.archer*.035+army.counts.cavalry*.06));
  data.health=Math.max(0,data.health-damage); updateMonsterHealthBar(data); spawnDamageNumber(data,damage);
  const group=objects.find(o=>o.data===data)?.group;
  if(group){ group.userData.hitFlashUntil=clock.elapsedTime+.22; group.userData.hitBaseY=group.position.y; }
  if(squad?.userData.models) squad.userData.models.forEach((unit,i)=>{ if(i%3===monsterHitCount%3){ const parts=unit.userData.animParts||{}; if(parts.weapons) parts.weapons.forEach(w=>w.mesh.rotation.z=w.base+1.15); }});
  monsterHitCount++;
  addLog('Hit confirmed',`${data.name} took ${damage} damage. ${Math.ceil(data.health)} HP remaining.`,'⚔');
  if(data.health<=0){
    data.description='Defeated in battle. This encounter is complete for this demo session.';
    if(group) group.userData.defeated=true;
    toast(`${data.name} defeated!`);
  }
  if(selectedObject===data) refreshTargetUI();
}

function createMonster(data) {
  const g=new THREE.Group();
  if(data.type==='bear'){
    const fur=mat('#e2e5dc'), dark=mat('#424746'), nose=mat('#292b2b');
    addMesh(g,new THREE.SphereGeometry(.68,14,12),fur,0,.85,0).scale.set(1.05,.85,1.25);
    addMesh(g,new THREE.SphereGeometry(.46,12,10),fur,0,1.36,.48).scale.set(1,.92,.9);
    addMesh(g,new THREE.SphereGeometry(.15,8,7),dark,-.3,1.67,.43);addMesh(g,new THREE.SphereGeometry(.15,8,7),dark,.3,1.67,.43);
    addMesh(g,new THREE.SphereGeometry(.14,8,7),nose,0,1.29,.91);
    for(const sx of [-.42,.42]) for(const sz of [-.45,.43]) addMesh(g,new THREE.CylinderGeometry(.14,.17,.58,8),fur,sx,.36,sz);
  } else if(data.type==='rabbit'){
    const fur=mat('#edf0e8');
    addMesh(g,new THREE.SphereGeometry(.35,12,10),fur,0,.4,0).scale.set(1,.9,1.2);
    addMesh(g,new THREE.SphereGeometry(.24,12,10),fur,0,.68,.28);
    for(const sx of [-.12,.12]) { const ear=addMesh(g,new THREE.CapsuleGeometry(.07,.42,4,8),fur,sx,.99,.28); ear.rotation.z=sx<0?-.18:.18; }
    addMesh(g,new THREE.SphereGeometry(.045,8,6),mat('#343737'),-.08,.72,.48);addMesh(g,new THREE.SphereGeometry(.045,8,6),mat('#343737'),.08,.72,.48);
  } else {
    const armor=mat('#242a30',.36,.7), trim=mat('#8e3935',.5,.4), visor=mat('#d8a36e',.3,.3);
    addMesh(g,new THREE.BoxGeometry(.8,1.1,.5),armor,0,1.0,0);
    addMesh(g,new THREE.SphereGeometry(.3,10,9),armor,0,1.8,.02);
    addMesh(g,new THREE.BoxGeometry(.42,.08,.07),visor,0,1.82,.29);
    addMesh(g,new THREE.BoxGeometry(.95,.22,.57),trim,0,1.48,0);
    for(const sx of [-.48,.48]) addMesh(g,new THREE.CylinderGeometry(.12,.16,.85,7),armor,sx,1.0,0);
    addMesh(g,new THREE.BoxGeometry(.11,1.4,.12),mat('#a9b3ba',.3,.75),.72,1.0,.08).rotation.z=-.18;
    addMesh(g,new THREE.BoxGeometry(.22,.25,.18),armor,.72,.25,.08);
    for(const sx of [-.22,.22]) addMesh(g,new THREE.CylinderGeometry(.14,.17,.72,7),armor,sx,.35,0);
  }
  g.position.set(data.x,0,data.z);
  const label=makeLabelSprite(data.name,data.type==='knight'?'#f1b5a9':'#f2f0e4'); label.position.set(0,data.type==='bear'?2.35:1.85,0); g.add(label);
  const result=registerObject(g,data);
  if(data.kind==='monster') makeMonsterHealthBar(g,data);
  if(data.type==='rabbit') animated.push({obj:g,kind:'rabbit',baseY:0,phase:Math.random()*6});
  if(data.type==='bear') animated.push({obj:g,kind:'bear',baseY:0,phase:Math.random()*6});
  return result;
}
function clearWorld() {
  while(world.children.length) {
    const child=world.children.pop();
    child.traverse?.(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material){ if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose(); }});
  }
  pickables.length=0; objects.length=0; animated.length=0; mapObjects.clear();
}
function buildMap(mapId) {
  currentMap=mapId; selectedObject=null; clearWorld();
  const config=maps[mapId];
  scene.background.set(config.snow?'#a5beca':mapId==='forest'?'#688b7b':mapId==='mountain'?'#8b9794':'#8ba3a1');
  scene.fog.color.copy(scene.background);
  createGround(config);
  // perimeter mountains and rocky outcrops
  for(let i=0;i<11;i++){
    const x=-20+i*4, z=-13-(Math.random()*2);
    const peak=addMesh(world,new THREE.ConeGeometry(2.5+Math.random()*1.3,4+Math.random()*3,5),mat(config.snow?'#d8e4e5':'#64756e'),x,1.6,z,false);
    peak.rotation.y=Math.random();
    if(config.snow) addMesh(world,new THREE.ConeGeometry(1.35,2.3,5),mat('#f0f3ed'),x,3.0,z+.15,false);
  }
  // forests along edges
  for(let i=0;i<28;i++){
    const x=(Math.random()-.5)*40,z=(Math.random()-.5)*27;
    if(Math.abs(x)<5&&Math.abs(z)<5) continue;
    createTree(x,z,.65+Math.random()*.65,config.snow);
  }
  // kingdom castle and village
  const castle=createBuilding(-6,5,'castle',1.05);
  castle.userData.gameData={id:'home-castle',name:'Gorkha Citadel',type:'kingdom',kind:'castle',description:'Your fortified home and army rally point.',level:18,x:-6,z:5};
  registerObject(castle,castle.userData.gameData);
  for(const [x,z,k] of [[-10,3,'house'],[-11,7,'house'],[-3,8,'temple'],[-2,4,'house']]) createBuilding(x,z,k,.8);
  const resourceData = mapId==='snow' ? [
    {id:'r1',name:'Frozen Iron Vein',type:'iron',x:7,z:-2,quantity:620,maxQuantity:620,level:8,description:'Iron-rich rock exposed by ancient glaciers.'},
    {id:'r2',name:'Snow Pine Grove',type:'wood',x:-13,z:-5,quantity:450,maxQuantity:450,level:5,description:'Hardy pine trees that survive the high-altitude cold.'},
    {id:'r3',name:'Crystal Deposit',type:'gold',x:13,z:5,quantity:280,maxQuantity:280,level:11,description:'Rare crystals gleam beneath the frozen stone.'}
  ] : mapId==='mountain' ? [
    {id:'r1',name:'Iron Vein',type:'iron',x:7,z:-2,quantity:620,maxQuantity:620,level:8,description:'A rich deposit of mountain iron, ready for gathering.'},
    {id:'r2',name:'Stone Quarry',type:'stone',x:-13,z:-4,quantity:780,maxQuantity:780,level:6,description:'A rugged quarry with high-quality building stone.'},
    {id:'r3',name:'Gold Seam',type:'gold',x:13,z:5,quantity:300,maxQuantity:300,level:10,description:'A guarded seam of precious gold.'}
  ] : mapId==='forest' ? [
    {id:'r1',name:'Ancient Timber',type:'wood',x:7,z:-2,quantity:760,maxQuantity:760,level:7,description:'Dense old-growth timber suitable for construction.'},
    {id:'r2',name:'Herb Clearing',type:'food',x:-13,z:-4,quantity:380,maxQuantity:380,level:4,description:'Useful mountain herbs and provisions.'},
    {id:'r3',name:'Stone Outcrop',type:'stone',x:13,z:5,quantity:500,maxQuantity:500,level:5,description:'A compact outcrop of workable stone.'}
  ] : [
    {id:'r1',name:'Iron Vein',type:'iron',x:7,z:-2,quantity:620,maxQuantity:620,level:8,description:'A rich deposit of mountain iron, ready for gathering.'},
    {id:'r2',name:'Pine Timber',type:'wood',x:-13,z:-4,quantity:520,maxQuantity:520,level:5,description:'A grove of tall pines ready for gathering.'},
    {id:'r3',name:'Stone Quarry',type:'stone',x:13,z:5,quantity:780,maxQuantity:780,level:6,description:'A rugged quarry with high-quality building stone.'}
  ];
  resourceData.forEach(d=>createResource({...d,kind:'resource',kingdomId:mapId}));
  const monsterData=mapId==='snow'?[
    {id:'m1',name:'Snow Bear',type:'bear',kind:'monster',x:12,z:-7,level:9,health:100,description:'A territorial white bear prowling the frozen pass.',guard:'Hostile',reward:95},
    {id:'m2',name:'Snow Rabbit',type:'rabbit',kind:'animal',x:-2,z:-7,level:2,health:20,description:'A quick-footed rabbit native to the alpine snowfields.',guard:'Wildlife',reward:5},
    {id:'m3',name:'Dark Knight',type:'knight',kind:'monster',x:16,z:3,level:14,health:100,description:'An armored sentinel guarding the old mountain road.',guard:'Elite',reward:220}
  ]:[
    {id:'m1',name:'Snow Bear',type:'bear',kind:'monster',x:12,z:-7,level:9,health:100,description:'A territorial white bear that wandered down from the high passes.',guard:'Hostile',reward:95},
    {id:'m2',name:'Snow Rabbit',type:'rabbit',kind:'animal',x:-2,z:-7,level:2,health:20,description:'A quick-footed rabbit exploring the grassland edge.',guard:'Wildlife',reward:5},
    {id:'m3',name:'Dark Knight',type:'knight',kind:'monster',x:16,z:3,level:14,health:100,description:'An armored sentinel guarding an ancient trade route.',guard:'Elite',reward:220}
  ];
  monsterData.forEach(d=>createMonster({...d,kingdomId:mapId}));
  // travel gate / marker
  const gate=new THREE.Group(); gate.position.set(18,0,9);
  addMesh(gate,new THREE.TorusGeometry(1,.13,8,16),mat('#d1b66c',.4,.3),0,1.5,0).rotation.x=Math.PI/2;
  addMesh(gate,new THREE.CylinderGeometry(.08,.08,3,8),mat('#a78d56'),-1,1.5,0);
  addMesh(gate,new THREE.CylinderGeometry(.08,.08,3,8),mat('#a78d56'),1,1.5,0);
  const gateData={id:'travel-gate',name:'Mainland Travel Gate',kind:'travel',type:'travel',x:18,z:9,level:1,description:'Select a kingdom on the World Atlas to travel there.'};
  registerObject(gate,gateData); world.add(gate);
  const armyGroup=createArmy(); armyGroup.position.copy(army.position); armyGroup.position.y=.02; armyGroup.userData.isArmy=true;
  const armyLabel=makeLabelSprite('MAGAR VANGUARD','#d7e7f5'); armyLabel.position.set(0,3,0); armyGroup.add(armyLabel);
  registerObject(armyGroup,{id:'A-01',name:'Magar Vanguard',kind:'army',type:'army',level:18,description:'Your selected Nepalese-inspired infantry, cavalry, and archer force.',guard:'Friendly',x:army.position.x,z:army.position.z});
  mapObjects.set('army',armyGroup);
  if(army.state==='idle') army.position.copy(army.home);
  if(army.state==='idle') armyGroup.position.copy(army.home);
  world.add(armyGroup);
  // visual banners and distant stones
  for(let i=0;i<18;i++) createRock((Math.random()-.5)*39,(Math.random()-.5)*26,config.snow?'#d1d8d6':'#737e75',.5+Math.random()*.8);
  world.scale.setScalar(zoom);
  world.position.set(panX,0,panZ);
  updateMapText();
  refreshTargetUI();
  loadingBadge.style.display='none';
}
function updateMapText(){
  document.getElementById('mapName').textContent=maps[currentMap].name;
  document.getElementById('mapSubtitle').textContent=maps[currentMap].subtitle;
  document.querySelectorAll('.kingdom').forEach(b=>b.classList.toggle('active',b.dataset.map===currentMap));
}
function getGameData(obj) {
  let o=obj;
  while(o){if(o.userData?.gameData)return o.userData.gameData;o=o.parent;}
  return null;
}
function selectObject(obj) {
  const data=getGameData(obj);
  if(!data)return;
  selectedObject=data;
  // mark the selection with a ring
  if(window.selectionRing){scene.remove(window.selectionRing);window.selectionRing.geometry.dispose();window.selectionRing.material.dispose();}
  const ring=new THREE.Mesh(new THREE.RingGeometry(.7,.84,32),new THREE.MeshBasicMaterial({color:'#f0d18b',side:THREE.DoubleSide,transparent:true,opacity:.9,depthTest:false}));
  ring.rotation.x=-Math.PI/2; ring.position.set(obj.getWorldPosition(new THREE.Vector3()).x,.03,obj.getWorldPosition(new THREE.Vector3()).z);
  scene.add(ring);window.selectionRing=ring; ring.userData.follow=obj;
  refreshTargetUI(); toast(`${data.name} selected`);
}
function refreshTargetUI(){
  const d=selectedObject || objects.find(o=>o.data.kind==='resource')?.data;
  if(!d)return;
  const emoji=d.type==='wood'?'♣':d.type==='iron'?'⬟':d.type==='stone'?'◆':d.type==='gold'?'✦':d.type==='bear'?'🐻':d.type==='rabbit'?'🐇':d.type==='knight'?'♞':d.kind==='army'?'🛡️':d.kind==='kingdom'?'♜':'⌖';
  document.getElementById('targetEmoji').textContent=emoji;
  document.getElementById('targetName').textContent=d.name;
  document.getElementById('targetDescription').textContent=d.description||'An object in the kingdom.';
  document.getElementById('targetLevel').textContent=String(d.level??1).padStart(2,'0');
  document.getElementById('targetGuard').textContent=d.guard|| (d.kind==='monster'?'Hostile':d.kind==='resource'?'None':'Friendly');
  const artwork=document.getElementById('targetArtwork');
  artwork.className='target-artwork '+(d.kind==='monster'?'monster-target':d.kind==='animal'?'animal-target':'resource-target');
  document.getElementById('targetType').textContent=(d.kind||'OBJECT').replace(/-/g,' ').toUpperCase();
  const quantity=d.quantity ?? d.health ?? (d.kind==='army'?army.health:100);
  document.getElementById('targetQuantity').textContent=Number(quantity).toLocaleString();
  document.getElementById('quantityLabel').textContent=d.kind==='resource'?'REMAINING '+d.type.toUpperCase():d.kind==='monster'?'TARGET HEALTH':d.kind==='animal'?'WILDLIFE HEALTH':'STATUS';
  document.getElementById('quantityBar').style.width=`${Math.max(0,Math.min(100,(quantity/(d.maxQuantity||d.maxHealth||100))*100))}%`;
  document.getElementById('targetStatus').textContent=d.kind==='resource'?(d.quantity>0?'Available':'Depleted'):d.kind==='monster'?'Hostile':d.kind==='animal'?'Wildlife':d.kind==='army'?'Selected':'Friendly';
  document.getElementById('targetStatus').className=d.kind==='monster'?'status-warn':'status-good';
}
function toast(message){
  const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');
  clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('show'),2400);
}
function addLog(title,detail,icon='✦'){
  const log=document.getElementById('missionLog');
  const row=document.createElement('div');row.className='log-entry';
  const now=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  row.innerHTML=`<span class="log-icon">${icon}</span><div><b></b><small></small></div><time>${now}</time>`;
  row.querySelector('b').textContent=title;row.querySelector('small').textContent=detail;
  log.prepend(row);while(log.children.length>8)log.lastElementChild.remove();
}
function setMissionState(state,description,progress=0){
  army.state=state;
  document.getElementById('missionState').textContent=state.toUpperCase();
  document.getElementById('missionDescription').textContent=description;
  document.getElementById('missionProgress').style.width=`${progress}%`;
  document.getElementById('missionPip').style.background=state==='attacking'?'#d76859':state==='gathering'?'#d4b16a':state==='idle'?'#7fc497':'#81b9df';
  document.getElementById('missionTimer').textContent=state==='idle'?'No active mission':`${Math.round(Math.max(0,army.duration-army.timer))}s remaining · Demo simulation`;
  document.getElementById('activeMissionCount').textContent=state==='idle'?'0':'1';
  document.getElementById('healthText').textContent=`${Math.round(army.health)}%`;
  document.getElementById('healthBar').style.width=`${army.health}%`;
  document.getElementById('infantryCount').textContent=army.counts.infantry;
  document.getElementById('cavalryCount').textContent=army.counts.cavalry;
  document.getElementById('archerCount').textContent=army.counts.archer;
}
function nearestObjectData(dataPredicate){
  const list=objects.filter(o=>dataPredicate(o.data));
  if(!list.length)return null;
  return list.sort((a,b)=>new THREE.Vector3(a.data.x||0,0,a.data.z||0).distanceTo(army.position)-new THREE.Vector3(b.data.x||0,0,b.data.z||0).distanceTo(army.position))[0];
}
function beginMarch(target,missionType){
  if(!target){toast('Select a valid target first');return;}
  if(army.state!=='idle'){toast('Army is busy. Recall it before issuing another mission.');return;}
  if(target.kind==='kingdom'){toast('Use the World Atlas to travel between kingdoms.');return;}
  if(target.kind==='travel'){toast('Choose a kingdom from the World Atlas.');return;}
  if(missionType==='gather'&&target.kind!=='resource'){toast('Select a resource node to gather.');return;}
  if(missionType==='attack'&&target.kind!=='monster'&&target.kind!=='animal'){toast('Select a monster or wildlife target.');return;}
  if(missionType==='gather'&&target.quantity<=0){toast('This resource node is depleted.');return;}
  army.target=target;army.missionType=missionType;army.start=army.position.clone();
  army.destination=new THREE.Vector3(target.x||0,0,target.z||0);
  army.duration=Math.max(3,Math.round(army.position.distanceTo(army.destination)/3.2));
  army.timer=0;army.progress=0;
  setMissionState('marching',`Marching toward ${target.name}.`);
  addLog('March order issued',`Magar Vanguard is moving toward ${target.name}.`,'➤');
  toast(`Marching to ${target.name}`);
}
function returnHome(){
  if(army.state==='idle'){toast('Your army is already at home');return;}
  if(army.state==='returning'){toast('Army is already returning');return;}
  army.missionType='return';army.target=null;army.start=army.position.clone();army.destination=army.home.clone();army.timer=0;
  army.duration=Math.max(3,Math.round(army.position.distanceTo(army.home)/3.2));
  setMissionState('returning','Returning to Gorkha Citadel.');
  addLog('Recall order received','Your army is returning to the home kingdom.','↶');toast('Return march started');
}
function resolveArrival(){
  if(army.state==='returning'){
    army.position.copy(army.home);army.destination=null;army.target=null;army.missionType=null;
    setMissionState('idle','Your army has returned and is awaiting new orders.');
    addLog('Army returned home','Troops are ready for another command.','⌂');toast('Army returned home');return;
  }
  if(army.state==='marching'&&army.target){
    if(army.missionType==='gather'){
      setMissionState('gathering',`Gathering ${army.target.type} at ${army.target.name}.`);
      army.timer=0;army.duration=8;
      addLog('Gathering started',`Troops are working at ${army.target.name}.`,'⛏');toast('Gathering started');
    } else if(army.missionType==='attack'){
      setMissionState('attacking',`Engaging ${army.target.name}.`);
      army.timer=0;army.duration=6;
      addLog('Battle started',`Magar Vanguard engaged ${army.target.name}.`,'⚔');toast('Battle started');
    } else {
      setMissionState('idle','Army reached the destination.');
    }
  }
}
function finishGathering(){
  const t=army.target;if(!t){returnHome();return;}
  const amount=Math.min(t.quantity,Math.floor(75+army.counts.infantry*.35));
  t.quantity-=amount;
  const key=t.type==='wood'?'wood':t.type==='stone'?'stone':t.type==='iron'||t.type==='gold'?'iron':'food';
  resources[key]=(resources[key]||0)+amount;
  document.getElementById(key+'Count').textContent=resources[key].toLocaleString();
  refreshTargetUI();
  addLog('Gathering complete',`Collected ${amount} ${t.type}. Army is returning home.`,'⛏');
  toast(`Collected ${amount} ${t.type}`);
  army.start=army.position.clone();army.destination=army.home.clone();army.target=null;army.missionType='return';army.timer=0;army.duration=Math.max(3,Math.round(army.position.distanceTo(army.home)/3.2));
  setMissionState('returning','Resources secured. Returning to Gorkha Citadel.');
}
function finishAttack(){
  const t=army.target;if(!t){returnHome();return;}
  if(t.kind==='monster' && t.health<=0){
    resources.food+=t.reward||50;document.getElementById('foodCount').textContent=resources.food.toLocaleString();
    addLog('Victory',`${t.name} defeated. Army gained ${t.reward||50} supplies.`,'⚔');
    const defeatedGroup=objects.find(o=>o.data===t)?.group; if(defeatedGroup) defeatedGroup.userData.defeated=true;
    refreshTargetUI(); army.target=null;army.destination=army.home.clone();army.missionType='return';army.timer=0;army.duration=Math.max(3,Math.round(army.position.distanceTo(army.home)/3.2));
    setMissionState('returning','Monster defeated. Returning to the kingdom.'); return;
  }
  const winPower=army.counts.infantry*1.2+army.counts.cavalry*2.5+army.counts.archer*1.4;
  const enemyPower=(t.level||1)*13;
  const damage=Math.max(10,Math.min(95,Math.round(winPower/(winPower+enemyPower)*100)));
  if(t.type==='rabbit'){
    resources.food+=5;document.getElementById('foodCount').textContent=resources.food.toLocaleString();
    addLog('Wildlife encounter complete','Collected 5 food from the encounter.','✦');toast('Encounter complete · +5 food');
  } else if(damage>=55){
    resources.food+=t.reward||50;document.getElementById('foodCount').textContent=resources.food.toLocaleString();
    addLog('Victory',`${t.name} defeated. Army gained ${t.reward||50} supplies.`,'⚔');toast(`Victory · +${t.reward||50} food`);
    army.health=Math.max(25,army.health-(100-damage)*.35);
    if(t.type==='bear'||t.type==='knight'){
      t.health=0;updateMonsterHealthBar(t);t.description='Defeated in battle. This encounter is complete for this demo session.';
      const group=objects.find(o=>o.data.id===t.id)?.group;if(group)group.visible=false;
    }
  } else {
    army.health=Math.max(15,army.health-22);
    army.counts.infantry=Math.max(0,army.counts.infantry-Math.ceil((100-damage)/18));
    addLog('Battle ended with losses',`The enemy resisted. Army took casualties and is returning.`,'⚠');toast('Battle costly · returning to recover');
  }
  refreshTargetUI();
  army.target=null;army.destination=army.home.clone();army.missionType='return';army.timer=0;army.duration=Math.max(3,Math.round(army.position.distanceTo(army.home)/3.2));
  setMissionState('returning','Battle resolved. Returning to the kingdom.');
}
function updateArmy(dt){
  const group=mapObjects.get('army');if(!group)return;
  if(army.state==='marching'||army.state==='returning'){
    army.timer+=dt;
    const t=Math.min(1,army.timer/army.duration);
    if(army.destination){
      army.position.lerpVectors(army.start||group.position,army.destination,t);
      group.position.x=army.position.x;group.position.z=army.position.z;
      const dx=army.destination.x-group.position.x,dz=army.destination.z-group.position.z;
      if(Math.abs(dx)+Math.abs(dz)>.01)group.rotation.y=Math.atan2(dx,dz);
    }
    setMissionState(army.state,army.state==='returning'?'Returning to Gorkha Citadel.':`Marching toward ${army.target?.name||'destination'}.`,t*100);
    if(t>=1){army.position.copy(army.destination);group.position.copy(army.destination);resolveArrival();}
  } else if(army.state==='gathering'){
    army.timer+=dt;const p=Math.min(1,army.timer/army.duration);
    setMissionState('gathering',`Gathering ${army.target?.type||'resources'}…`,p*100);
    if(p>=1)finishGathering();
  } else if(army.state==='attacking'){
    army.timer+=dt;const p=Math.min(1,army.timer/army.duration);
    if(army.target && army.target.health>0 && clock.elapsedTime>=nextHitAt){ applyMonsterHit(army.target); nextHitAt=clock.elapsedTime+.72; }
    if(army.target && army.target.health<=0){ finishAttack(); return; }
    setMissionState('attacking',`Fighting ${army.target?.name||'target'}…`,p*100);
    const group=mapObjects.get('army');if(group)group.rotation.y+=dt*0.6;
    if(p>=1)finishAttack();
  }
}
function resize(){
  const w=viewport.clientWidth,h=viewport.clientHeight;
  if(!w||!h)return;
  renderer.setSize(w,h,false);
  const aspect=w/h, halfH=12/zoom,halfW=halfH*aspect;
  camera.left=-halfW;camera.right=halfW;camera.top=halfH;camera.bottom=-halfH;
  camera.updateProjectionMatrix();
}
function applyZoom(next){
  zoom=Math.max(.65,Math.min(1.65,next));
  world.scale.setScalar(zoom);
  world.position.set(panX,0,panZ);
  document.getElementById('zoomLabel').textContent=`${Math.round(zoom*100)}%`;
  resize();
}
function onPointerDown(e){pointerDown={x:e.clientX,y:e.clientY,panX,panZ};dragMoved=false;}
function onPointerMove(e){
  if(!pointerDown)return;
  const dx=e.clientX-pointerDown.x,dy=e.clientY-pointerDown.y;
  if(Math.abs(dx)+Math.abs(dy)>4)dragMoved=true;
  if(dragMoved){
    const scale=.035/zoom;panX=pointerDown.panX+dx*scale;panZ=pointerDown.panZ+dy*scale;
    world.position.set(panX,0,panZ);
  }
}
function onPointerUp(e){
  if(!pointerDown)return;
  if(!dragMoved){
    const rect=renderer.domElement.getBoundingClientRect();
    const mouse=new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
    const ray=new THREE.Raycaster();ray.setFromCamera(mouse,camera);
    const hits=ray.intersectObjects(pickables,true);
    if(hits.length)selectObject(hits[0].object);
  }
  pointerDown=null;
}
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.05), elapsed=clock.elapsedTime;
  updateArmy(dt);
  const squad=mapObjects.get('army');
  if(squad?.userData.models){
    const moving=army.state==='marching'||army.state==='returning';
    const fighting=army.state==='attacking';
    const mining=army.state==='gathering';
    squad.userData.models.forEach((unit,i)=>{
      const parts=unit.userData.animParts||{};
      const phase=elapsed* (moving?8:fighting?10:mining?5:1.4) + i*.72;
      if(parts.miningTool) parts.miningTool.visible=mining;
      const active=moving||fighting||mining;
      unit.position.y=active?Math.abs(Math.sin(phase))*(moving?.13:fighting?.06:.035):Math.sin(phase)*.012;
      unit.rotation.z=moving?Math.sin(phase)*.035:0;
      if(parts.arms) parts.arms.forEach((a,j)=>{
        const swing=moving?Math.sin(phase+(j*Math.PI))*.45:fighting?(j===0?Math.sin(phase)*.9:-.15):mining?(j===0?Math.max(0,Math.sin(phase))*1.05:-.25):0;
        a.mesh.rotation.z=a.base+swing*a.side;
      });
      if(parts.weapons) parts.weapons.forEach((w,j)=>{
        w.mesh.rotation.z=w.base+(fighting?Math.sin(phase)*.65:moving?Math.sin(phase)*.15:0);
      });
      if(parts.miningTool) parts.miningTool.rotation.z=-.25+(mining?Math.max(0,Math.sin(phase))*1.0:0);
      if(parts.type==='cavalry'&&unit.userData.horse){unit.userData.horse.position.y=moving?Math.abs(Math.sin(phase))*0.08:0;}
    });
    const banner=squad.children.find(c=>c.userData.banner);
    if(banner) banner.rotation.y=Math.sin(elapsed*2.2)*.12;
  }
  for(const a of animated){
    if(a.kind==='rabbit'){a.obj.position.y=.04+Math.abs(Math.sin(elapsed*4+a.phase))*.06;a.obj.rotation.y=Math.sin(elapsed*.6+a.phase)*.3;}
    if(a.kind==='bear'){a.obj.position.y=.01+Math.sin(elapsed*1.7+a.phase)*.025;a.obj.rotation.y=Math.sin(elapsed*.25+a.phase)*.08;}
  }
  for(let i=combatEffects.length-1;i>=0;i--){
    const fx=combatEffects[i]; fx.age+=dt; fx.sprite.position.y=fx.startY+fx.age*1.15; fx.sprite.material.opacity=Math.max(0,1-fx.age/fx.duration);
    if(fx.age>=fx.duration){fx.group.remove(fx.sprite);fx.sprite.material.map?.dispose();fx.sprite.material.dispose();combatEffects.splice(i,1);}
  }
  for(const entry of objects){
    const g=entry.group, d=entry.data;
    if(d.healthBar && g.visible){ d.healthBar.quaternion.copy(camera.quaternion); d.healthBar.visible=(d.health||0)>0; }
    if(g.userData.hitFlashUntil && elapsed<g.userData.hitFlashUntil){g.position.x+=(Math.random()-.5)*.035;g.position.z+=(Math.random()-.5)*.035;}
  }
  if(window.selectionRing?.userData.follow){
    const p=window.selectionRing.userData.follow.getWorldPosition(new THREE.Vector3());
    window.selectionRing.position.set(p.x,.035,p.z);
    window.selectionRing.rotation.z=elapsed*.2;
  }
  renderer.render(scene,camera);
}
function travelToMap(mapId){
  if(mapId===currentMap)return;
  if(army.state!=='idle'){toast('Return your army home before changing kingdom in this prototype.');return;}
  buildMap(mapId);
  army.position.copy(army.home);army.home.set(-6,0,5);
  // Each kingdom scene gets a local home spawn.
  army.position.set(-6,0,5);army.home.copy(army.position);
  mapObjects.get('army')?.position.copy(army.position);
  panX=0;panZ=0;applyZoom(1);
  addLog('Kingdom entered',`Travelled to ${maps[mapId].name}.`,'⌖');
  toast(`Entered ${maps[mapId].name}`);
}
document.querySelectorAll('.kingdom').forEach(btn=>btn.addEventListener('click',()=>travelToMap(btn.dataset.map)));
document.getElementById('marchBtn').addEventListener('click',()=>beginMarch(selectedObject,'march'));
document.getElementById('mineBtn').addEventListener('click',()=>beginMarch(selectedObject,'gather'));
document.getElementById('attackBtn').addEventListener('click',()=>beginMarch(selectedObject,'attack'));
document.getElementById('returnBtn').addEventListener('click',returnHome);
document.getElementById('zoomIn').addEventListener('click',()=>applyZoom(zoom+.12));
document.getElementById('zoomOut').addEventListener('click',()=>applyZoom(zoom-.12));
document.getElementById('resetView').addEventListener('click',()=>{panX=0;panZ=0;world.position.set(0,0,0);applyZoom(1);});
renderer.domElement.addEventListener('pointerdown',onPointerDown);
window.addEventListener('pointermove',onPointerMove);
window.addEventListener('pointerup',onPointerUp);
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();applyZoom(zoom+(e.deltaY<0?.08:-.08));},{passive:false});
window.addEventListener('resize',resize);
window.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT')return;
  if(e.key.toLowerCase()==='m')beginMarch(selectedObject,'march');
  if(e.key.toLowerCase()==='g')beginMarch(selectedObject,'gather');
  if(e.key.toLowerCase()==='a')beginMarch(selectedObject,'attack');
  if(e.key.toLowerCase()==='r')returnHome();
});
buildMap('valley');
resize();
animate();
setMissionState('idle','Your army is awaiting orders at the kingdom gate.');
selectedObject=objects.find(o=>o.data.kind==='resource')?.data||null;
refreshTargetUI();
setTimeout(()=>toast('Select a resource or monster, then issue a command.'),650);
