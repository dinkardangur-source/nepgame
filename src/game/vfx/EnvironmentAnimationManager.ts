import * as THREE from 'three';
import type { BuildingAnimationManager } from './BuildingAnimationManager';
import type { VFXManager } from './VFXManager';

import type { ShadowProjectionState } from '../shadows';

export type TimeOfDayMode = 'day' | 'dusk' | 'night';

interface LightingPreset {
  sunColor: THREE.Color;
  sunIntensity: number;
  /** Offset from sunLight.target toward active sun/moon light (determines shadow angle & elevation) */
  sunOffset: THREE.Vector3;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  fogColor: THREE.Color;
  bgColor: THREE.Color;
  contactOpacity: number;
  contactOffsetFactor: number;
  elongation: number;
}

const PRESETS: Record<TimeOfDayMode, LightingPreset> = {
  day: {
    sunColor: new THREE.Color(0xfff5dc),
    sunIntensity: 2.35,
    sunOffset: new THREE.Vector3(-85, 138, 72),
    hemiSky: new THREE.Color(0xbae6fd),
    hemiGround: new THREE.Color(0x3a4d34),
    hemiIntensity: 1.05,
    fogColor: new THREE.Color(0xcce2ec),
    bgColor: new THREE.Color(0x0f172a),
    contactOpacity: 0.72,
    contactOffsetFactor: 0.22,
    elongation: 1.06,
  },
  dusk: {
    sunColor: new THREE.Color(0xfb923c),
    sunIntensity: 2.05,
    sunOffset: new THREE.Vector3(-148, 56, 94),
    hemiSky: new THREE.Color(0xfdba74),
    hemiGround: new THREE.Color(0x2e1f33),
    hemiIntensity: 0.78,
    fogColor: new THREE.Color(0x4c2b3f),
    bgColor: new THREE.Color(0x1f1427),
    contactOpacity: 0.62,
    contactOffsetFactor: 0.56,
    elongation: 1.32,
  },
  night: {
    sunColor: new THREE.Color(0x93c5fd),
    sunIntensity: 1.25,
    sunOffset: new THREE.Vector3(96, 118, -74),
    hemiSky: new THREE.Color(0x4b7bec),
    hemiGround: new THREE.Color(0x0f172a),
    hemiIntensity: 0.62,
    fogColor: new THREE.Color(0x0d1528),
    bgColor: new THREE.Color(0x070b14),
    contactOpacity: 0.5,
    contactOffsetFactor: 0.3,
    elongation: 1.14,
  },
};

export interface EnvironmentStageRefs {
  group: THREE.Group;
  grassMesh: THREE.InstancedMesh;
  grassBaseTransforms: Array<{ x: number; z: number; scale: number; phase: number }>;
  trees: THREE.Object3D[];
  birds: THREE.Group[];
  clouds: THREE.Group[];
  riverShaderMat: THREE.ShaderMaterial;
  waterfallMesh: THREE.Mesh;
  pondRipples: THREE.Mesh[];
}

const RIVER_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RIVER_FRAGMENT = `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float flow = sin(vUv.x * 26.0 - uTime * 3.8) * 0.5 + 0.5;
    float foam = smoothstep(0.75, 0.98, sin((vUv.y * 10.0 + vUv.x * 14.0 - uTime * 3.2)));
    vec3 baseCol = mix(vec3(0.08, 0.36, 0.62), vec3(0.18, 0.62, 0.88), flow);
    vec3 finalCol = mix(baseCol, vec3(0.85, 0.96, 1.0), foam * 0.45);
    gl_FragColor = vec4(finalCol, 0.86);
  }
`;

export class EnvironmentAnimationManager {
  private mode: TimeOfDayMode = 'day';
  private sunLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private scene: THREE.Scene | null = null;
  private buildingManager: BuildingAnimationManager | null = null;
  private vfx: VFXManager | null = null;
  private stage: EnvironmentStageRefs | null = null;

  private leafTimer = 0;
  private readonly _dummy = new THREE.Object3D();
  private readonly _leafPos = new THREE.Vector3();
  private readonly shadowState: ShadowProjectionState = {
    sunOffset: PRESETS.day.sunOffset.clone(),
    contactOpacity: PRESETS.day.contactOpacity,
    contactOffsetFactor: PRESETS.day.contactOffsetFactor,
    elongation: PRESETS.day.elongation,
    shadowYaw: Math.atan2(PRESETS.day.sunOffset.x, PRESETS.day.sunOffset.z),
    fallDirX: 0,
    fallDirZ: 0,
  };

  constructor() {
    this.recomputeDerivedShadowVectors();
  }

  private recomputeDerivedShadowVectors(): void {
    const sx = this.shadowState.sunOffset.x;
    const sz = this.shadowState.sunOffset.z;
    const len = Math.hypot(sx, sz) || 1;
    // Shadows fall horizontally away from sunOffset (-sx, -sz)
    this.shadowState.fallDirX = -sx / len;
    this.shadowState.fallDirZ = -sz / len;
    this.shadowState.shadowYaw = Math.atan2(sx, sz);
  }

  public getShadowState(): ShadowProjectionState {
    return this.shadowState;
  }

  public attachLights(
    scene: THREE.Scene,
    sunLight: THREE.DirectionalLight,
    hemiLight: THREE.HemisphereLight,
    buildingManager?: BuildingAnimationManager | null,
    vfx?: VFXManager | null
  ): void {
    this.scene = scene;
    this.sunLight = sunLight;
    this.hemiLight = hemiLight;
    this.buildingManager = buildingManager ?? null;
    this.vfx = vfx ?? null;
    this.applyImmediate(this.mode);
  }

  public setBuildingManager(bm: BuildingAnimationManager | null): void {
    this.buildingManager = bm;
    this.buildingManager?.setNightMode(this.mode === 'night');
  }

  public getTimeOfDay(): TimeOfDayMode {
    return this.mode;
  }

  public setTimeOfDay(mode: TimeOfDayMode): void {
    this.mode = mode;
    this.buildingManager?.setNightMode(mode === 'night');
  }

  public cycleTimeOfDay(): TimeOfDayMode {
    const next: TimeOfDayMode =
      this.mode === 'day' ? 'dusk' : this.mode === 'dusk' ? 'night' : 'day';
    this.setTimeOfDay(next);
    return next;
  }

  public applyImmediate(mode: TimeOfDayMode): void {
    this.mode = mode;
    const p = PRESETS[mode];
    this.shadowState.sunOffset.copy(p.sunOffset);
    this.shadowState.contactOpacity = p.contactOpacity;
    this.shadowState.contactOffsetFactor = p.contactOffsetFactor;
    this.shadowState.elongation = p.elongation;
    this.recomputeDerivedShadowVectors();

    if (this.sunLight) {
      this.sunLight.color.copy(p.sunColor);
      this.sunLight.intensity = p.sunIntensity;
      this.sunLight.position.copy(this.sunLight.target.position).add(this.shadowState.sunOffset);
    }
    if (this.hemiLight) {
      this.hemiLight.color.copy(p.hemiSky);
      this.hemiLight.groundColor.copy(p.hemiGround);
      this.hemiLight.intensity = p.hemiIntensity;
    }
    if (this.scene) {
      if (this.scene.fog && 'color' in this.scene.fog) {
        (this.scene.fog as THREE.Fog).color.copy(p.fogColor);
      }
      if (this.scene.background instanceof THREE.Color) {
        this.scene.background.copy(p.bgColor);
      }
    }
    this.buildingManager?.setNightMode(mode === 'night');
  }

  /**
   * Builds rich animated environmental props (wind grass, swaying trees, river, waterfall, pond ripples, birds, clouds).
   */
  public buildAnimatedEnvironmentStage(scene: THREE.Scene, radius = 26): EnvironmentStageRefs {
    const group = new THREE.Group();
    group.name = 'AnimatedEnvironmentStage';

    // 1. Grass InstancedMesh (wind-swayed blades)
    const bladeCount = 140;
    const bladeGeo = new THREE.ConeGeometry(0.11, 0.65, 4);
    bladeGeo.translate(0, 0.32, 0);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.9 });
    const grassMesh = new THREE.InstancedMesh(bladeGeo, bladeMat, bladeCount);
    const grassBaseTransforms: EnvironmentStageRefs['grassBaseTransforms'] = [];
    for (let i = 0; i < bladeCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 7.5 + Math.random() * (radius - 9);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const scale = 0.75 + Math.random() * 0.75;
      grassBaseTransforms.push({ x, z, scale, phase: Math.random() * Math.PI * 2 });
    }
    group.add(grassMesh);

    // 2. Swaying Himalayan Pine Trees around perimeter
    const trees: THREE.Object3D[] = [];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.92 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1e5631, roughness: 0.85, flatShading: true });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.35;
      const r = radius - 3.5;
      const tree = new THREE.Group();
      tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.8, 6), trunkMat);
      trunk.position.y = 0.9;
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.8, 7), foliageMat);
      crown.position.y = 2.6;
      tree.add(trunk, crown);
      group.add(tree);
      trees.push(crown);
    }

    // 3. Flowing River Strip + Pond Ripples + Waterfall Spout
    const riverShaderMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: RIVER_VERTEX,
      fragmentShader: RIVER_FRAGMENT,
      transparent: true,
    });
    const river = new THREE.Mesh(new THREE.PlaneGeometry(44, 3.6, 16, 2), riverShaderMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, 0.06, -15.5);
    group.add(river);

    const pondGeo = new THREE.CircleGeometry(3.2, 24);
    pondGeo.rotateX(-Math.PI / 2);
    const pond = new THREE.Mesh(pondGeo, riverShaderMat);
    pond.position.set(-14, 0.07, -14);
    group.add(pond);

    const waterfallMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.25, 4.8, 10, 1, true),
      riverShaderMat
    );
    waterfallMesh.position.set(-14, 2.4, -17.2);
    group.add(waterfallMesh);

    const pondRipples: THREE.Mesh[] = [];
    for (let i = 0; i < 2; i++) {
      const rMesh = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 0.68, 24),
        new THREE.MeshBasicMaterial({
          color: 0xbae6fd,
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      rMesh.rotation.x = -Math.PI / 2;
      rMesh.position.set(-14, 0.1, -14);
      group.add(rMesh);
      pondRipples.push(rMesh);
    }

    // 4. Flying Bird Flock
    const birds: THREE.Group[] = [];
    const birdMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const bird = new THREE.Group();
      const wL = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), birdMat);
      wL.position.x = 0.25;
      const wR = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), birdMat);
      wR.position.x = -0.25;
      bird.add(wL, wR);
      bird.position.set(0, 12 + (i % 2) * 1.4, 0);
      group.add(bird);
      birds.push(bird);
    }

    // 5. Drifting Atmospheric Clouds
    const clouds: THREE.Group[] = [];
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xf1f5f9,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });
    for (let i = 0; i < 4; i++) {
      const cloud = new THREE.Group();
      for (let p = 0; p < 3; p++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1.8 + p * 0.35, 8, 6), cloudMat);
        puff.scale.set(1.5, 0.45, 1.0);
        puff.position.x = (p - 1) * 1.9;
        cloud.add(puff);
      }
      cloud.position.set(-18 + i * 12, 16 + (i % 2) * 2.2, -16 + (i % 2) * 8);
      group.add(cloud);
      clouds.push(cloud);
    }

    scene.add(group);
    this.stage = {
      group,
      grassMesh,
      grassBaseTransforms,
      trees,
      birds,
      clouds,
      riverShaderMat,
      waterfallMesh,
      pondRipples,
    };
    return this.stage;
  }

  public update(delta: number, elapsed: number): void {
    const dt = Math.min(0.05, delta);
    const p = PRESETS[this.mode];
    const lerpRate = 1 - Math.exp(-3.2 * dt);

    this.shadowState.sunOffset.lerp(p.sunOffset, lerpRate);
    this.shadowState.contactOpacity = THREE.MathUtils.lerp(
      this.shadowState.contactOpacity,
      p.contactOpacity,
      lerpRate
    );
    this.shadowState.contactOffsetFactor = THREE.MathUtils.lerp(
      this.shadowState.contactOffsetFactor,
      p.contactOffsetFactor,
      lerpRate
    );
    this.shadowState.elongation = THREE.MathUtils.lerp(
      this.shadowState.elongation,
      p.elongation,
      lerpRate
    );
    this.recomputeDerivedShadowVectors();

    if (this.sunLight) {
      this.sunLight.color.lerp(p.sunColor, lerpRate);
      this.sunLight.intensity = THREE.MathUtils.lerp(this.sunLight.intensity, p.sunIntensity, lerpRate);
      this.sunLight.position.copy(this.sunLight.target.position).add(this.shadowState.sunOffset);
    }
    if (this.hemiLight) {
      this.hemiLight.color.lerp(p.hemiSky, lerpRate);
      this.hemiLight.groundColor.lerp(p.hemiGround, lerpRate);
      this.hemiLight.intensity = THREE.MathUtils.lerp(this.hemiLight.intensity, p.hemiIntensity, lerpRate);
    }
    if (this.scene) {
      if (this.scene.fog && 'color' in this.scene.fog) {
        (this.scene.fog as THREE.Fog).color.lerp(p.fogColor, lerpRate);
      }
      if (this.scene.background instanceof THREE.Color) {
        this.scene.background.lerp(p.bgColor, lerpRate);
      }
    }

    if (!this.stage) return;

    // Wind grass sway
    for (let i = 0; i < this.stage.grassBaseTransforms.length; i++) {
      const g = this.stage.grassBaseTransforms[i];
      this._dummy.position.set(g.x, 0, g.z);
      this._dummy.rotation.set(
        Math.cos(elapsed * 2.1 + g.phase) * 0.14,
        g.phase,
        Math.sin(elapsed * 2.6 + g.phase) * 0.18
      );
      this._dummy.scale.setScalar(g.scale);
      this._dummy.updateMatrix();
      this.stage.grassMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.stage.grassMesh.instanceMatrix.needsUpdate = true;

    // Tree canopy wind sway + falling leaves
    for (let i = 0; i < this.stage.trees.length; i++) {
      this.stage.trees[i].rotation.z = Math.sin(elapsed * 1.8 + i) * 0.055;
      this.stage.trees[i].rotation.x = Math.cos(elapsed * 1.4 + i) * 0.035;
    }

    this.leafTimer += dt;
    if (this.leafTimer >= 1.25 && this.vfx && this.stage.trees.length > 0) {
      this.leafTimer = 0;
      const t = this.stage.trees[Math.floor(Math.random() * this.stage.trees.length)];
      t.getWorldPosition(this._leafPos);
      this._leafPos.y += 1.4;
      this.vfx.spawnBurst(this._leafPos, 'leaf', 2, { speed: 1.0, gravity: -1.1, life: 1.5 });
    }

    // River / Waterfall shader + Pond Ripples
    this.stage.riverShaderMat.uniforms.uTime.value = elapsed;
    for (let i = 0; i < this.stage.pondRipples.length; i++) {
      const ripple = this.stage.pondRipples[i];
      const phase = ((elapsed * 0.65 + i * 0.5) % 1);
      ripple.scale.setScalar(0.8 + phase * 3.6);
      (ripple.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.65;
    }

    // Birds circling overhead
    for (let i = 0; i < this.stage.birds.length; i++) {
      const b = this.stage.birds[i];
      const ang = elapsed * 0.45 + i * 0.6;
      const rad = 14 + (i % 3) * 2.5;
      b.position.x = Math.cos(ang) * rad;
      b.position.z = Math.sin(ang) * rad;
      b.rotation.y = -ang;
      const flap = Math.sin(elapsed * 12 + i) * 0.55;
      if (b.children[0]) b.children[0].rotation.z = flap;
      if (b.children[1]) b.children[1].rotation.z = -flap;
    }

    // Drifting clouds
    for (let i = 0; i < this.stage.clouds.length; i++) {
      const c = this.stage.clouds[i];
      c.position.x += dt * (0.9 + i * 0.15);
      if (c.position.x > 28) c.position.x = -28;
    }
  }

  public dispose(): void {
    if (!this.stage) return;
    this.stage.grassMesh.geometry.dispose();
    (this.stage.grassMesh.material as THREE.Material).dispose();
    this.stage.riverShaderMat.dispose();
    this.stage.group.parent?.remove(this.stage.group);
    this.stage = null;
  }
}
