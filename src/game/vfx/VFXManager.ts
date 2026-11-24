import * as THREE from 'three';
import type { ZoomLodLevel } from './AnimationController';

export type VfxParticleKind =
  | 'dust'
  | 'spark'
  | 'wood_chip'
  | 'leaf'
  | 'rock_debris'
  | 'gold_sparkle'
  | 'food_sparkle'
  | 'crystal_shard'
  | 'fire_breath'
  | 'poison_cloud'
  | 'dark_aura'
  | 'heal_mote'
  | 'death_smoke'
  | 'construction_dust'
  | 'magic_mote';

interface PooledParticle {
  active: boolean;
  kind: VfxParticleKind;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  gravity: number;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  rotSpeed: number;
  rot: number;
  color: THREE.Color;
}

interface PooledShockwave {
  active: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  startRadius: number;
  endRadius: number;
}

interface PooledTrail {
  active: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
}

interface PooledProjectile {
  active: boolean;
  mesh: THREE.Group;
  trailLine: THREE.Line;
  trailPositions: Float32Array;
  start: THREE.Vector3;
  end: THREE.Vector3;
  arcHeight: number;
  life: number;
  maxLife: number;
  kind: 'arrow' | 'fireball';
  onImpact?: (pos: THREE.Vector3) => void;
}

interface PooledBeam {
  active: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  targetScaleY: number;
}

const PARTICLE_COLORS: Record<VfxParticleKind, number> = {
  dust: 0xd6d3d1,
  spark: 0xfef08a,
  wood_chip: 0xb45309,
  leaf: 0x4ade80,
  rock_debris: 0x94a3b8,
  gold_sparkle: 0xfacc15,
  food_sparkle: 0xa3e635,
  crystal_shard: 0x38bdf8,
  fire_breath: 0xf97316,
  poison_cloud: 0x22c55e,
  dark_aura: 0xa855f7,
  heal_mote: 0x34d399,
  death_smoke: 0x475569,
  construction_dust: 0xe7e5e4,
  magic_mote: 0x60a5fa,
};

export class VFXManager {
  public readonly rootGroup = new THREE.Group();
  private readonly particlePool: PooledParticle[] = [];
  private readonly particleMesh: THREE.InstancedMesh;
  private readonly shockwavePool: PooledShockwave[] = [];
  private readonly trailPool: PooledTrail[] = [];
  private readonly projectilePool: PooledProjectile[] = [];
  private readonly beamPool: PooledBeam[] = [];

  private enabled = true;
  private intensityMultiplier = 1.0;
  private zoomLod: ZoomLodLevel = 'Close';
  private isMobileMode = false;

  // Camera shake state
  private shakeIntensity = 0;
  private shakeDecay = 5.5;
  public readonly shakeOffset = new THREE.Vector3();

  // Telemetry
  private recentEffectLog: string[] = [];
  private readonly maxParticles = 240;

  // Zero-GC math scratchpads
  private readonly _dummy = new THREE.Object3D();
  private readonly _pos = new THREE.Vector3();
  private readonly _up = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene, isMobile = false) {
    this.isMobileMode = isMobile;
    this.rootGroup.name = 'SharedVFXManagerGroup';
    scene.add(this.rootGroup);

    // 1. Pooled InstancedMesh particles (single draw call for up to 240 active particles)
    const pGeo = new THREE.OctahedronGeometry(0.32, 0);
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, this.maxParticles);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    this.rootGroup.add(this.particleMesh);

    const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.maxParticles; i++) {
      this.particleMesh.setMatrixAt(i, zeroMat);
      this.particleMesh.setColorAt(i, new THREE.Color(0xffffff));
      this.particlePool.push({
        active: false,
        kind: 'spark',
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        gravity: 0,
        life: 0,
        maxLife: 1,
        startScale: 1,
        endScale: 0,
        rotSpeed: 0,
        rot: 0,
        color: new THREE.Color(0xffffff),
      });
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }

    // 2. Pooled Shockwave Rings
    const ringGeo = new THREE.RingGeometry(0.74, 1.0, 32);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 20; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      this.rootGroup.add(mesh);
      this.shockwavePool.push({
        active: false,
        mesh,
        mat,
        life: 0,
        maxLife: 0.5,
        startRadius: 1,
        endRadius: 6,
      });
    }

    // 3. Pooled Melee Slash Arc Trails (curved ribbon BufferGeometry)
    const slashGeo = new THREE.RingGeometry(1.1, 1.85, 18, 1, -Math.PI * 0.45, Math.PI * 0.9);
    slashGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(slashGeo, mat);
      mesh.visible = false;
      this.rootGroup.add(mesh);
      this.trailPool.push({
        active: false,
        mesh,
        mat,
        life: 0,
        maxLife: 0.28,
      });
    }

    // 4. Pooled Arrow & Fireball Projectiles with flight trail BufferGeometry
    const shaftGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 5);
    shaftGeo.rotateX(Math.PI / 2);
    const tipGeo = new THREE.ConeGeometry(0.16, 0.42, 6);
    tipGeo.rotateX(Math.PI / 2);
    tipGeo.translate(0, 0, 0.8);
    const shaftMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });

    for (let i = 0; i < 18; i++) {
      const mesh = new THREE.Group();
      const shaft = new THREE.Mesh(shaftGeo, shaftMat);
      const tip = new THREE.Mesh(tipGeo, fireMat);
      mesh.add(shaft, tip);
      mesh.visible = false;
      this.rootGroup.add(mesh);

      const trailPositions = new Float32Array(6 * 3);
      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
      const trailLine = new THREE.Line(
        trailGeo,
        new THREE.LineBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.8 })
      );
      trailLine.visible = false;
      trailLine.frustumCulled = false;
      this.rootGroup.add(trailLine);

      this.projectilePool.push({
        active: false,
        mesh,
        trailLine,
        trailPositions,
        start: new THREE.Vector3(),
        end: new THREE.Vector3(),
        arcHeight: 4,
        life: 0,
        maxLife: 0.5,
        kind: 'arrow',
      });
    }

    // 5. Pooled Vertical Energy Beams (Upgrade / Shrine Capture / Citadel)
    const beamGeo = new THREE.CylinderGeometry(0.85, 1.45, 1, 16, 1, true);
    beamGeo.translate(0, 0.5, 0);
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(beamGeo, mat);
      mesh.visible = false;
      this.rootGroup.add(mesh);
      this.beamPool.push({
        active: false,
        mesh,
        mat,
        life: 0,
        maxLife: 1.0,
        targetScaleY: 16,
      });
    }
  }

  private pushLog(label: string) {
    this.recentEffectLog.unshift(label);
    if (this.recentEffectLog.length > 5) {
      this.recentEffectLog.length = 5;
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.rootGroup.visible = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setIntensityMultiplier(mult: number): void {
    this.intensityMultiplier = Math.max(0.1, Math.min(2.5, mult));
  }

  public setZoomLod(lod: ZoomLodLevel): void {
    this.zoomLod = lod;
  }

  public setMobileMode(mobile: boolean): void {
    this.isMobileMode = mobile;
  }

  private getEffectiveSpawnCount(baseCount: number): number {
    if (!this.enabled) return 0;
    const lodMult = this.zoomLod === 'Far' ? 0.2 : this.zoomLod === 'Medium' ? 0.55 : 1.0;
    const hwMult = this.isMobileMode ? 0.6 : 1.0;
    return Math.max(1, Math.round(baseCount * this.intensityMultiplier * lodMult * hwMult));
  }

  public spawnBurst(
    pos: THREE.Vector3,
    kind: VfxParticleKind,
    count = 12,
    options?: {
      speed?: number;
      spread?: number;
      gravity?: number;
      life?: number;
      scale?: number;
      colorHex?: number;
    }
  ): void {
    const actualCount = this.getEffectiveSpawnCount(count);
    if (actualCount <= 0) return;

    const speed = options?.speed ?? 4.5;
    const spread = options?.spread ?? 1.2;
    const gravity = options?.gravity ?? -9.5;
    const baseLife = options?.life ?? 0.65;
    const scale = options?.scale ?? 1.0;
    const colorHex = options?.colorHex ?? PARTICLE_COLORS[kind];

    let spawned = 0;
    for (let i = 0; i < this.particlePool.length && spawned < actualCount; i++) {
      const p = this.particlePool[i];
      if (p.active) continue;
      p.active = true;
      p.kind = kind;
      p.pos.set(
        pos.x + (Math.random() - 0.5) * spread,
        pos.y + Math.random() * spread * 0.45,
        pos.z + (Math.random() - 0.5) * spread
      );
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.45 + Math.random() * 0.75);
      p.vel.set(
        Math.cos(ang) * spd,
        speed * (0.35 + Math.random() * 0.8),
        Math.sin(ang) * spd
      );
      p.gravity = gravity;
      p.life = 0;
      p.maxLife = baseLife * (0.75 + Math.random() * 0.5);
      p.startScale = scale * (0.75 + Math.random() * 0.55);
      p.endScale = kind === 'poison_cloud' || kind === 'death_smoke' ? scale * 1.9 : 0.05;
      p.rot = Math.random() * Math.PI;
      p.rotSpeed = (Math.random() - 0.5) * 8;
      p.color.setHex(colorHex);
      this.particleMesh.setColorAt(i, p.color);
      spawned++;
    }
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
    this.pushLog(kind.replace('_', ' '));
  }

  public spawnShockwave(
    pos: THREE.Vector3,
    colorHex: number,
    endRadius = 6.5,
    duration = 0.52
  ): void {
    if (!this.enabled) return;
    if (this.zoomLod === 'Far' && endRadius < 8) return;

    for (const sw of this.shockwavePool) {
      if (sw.active) continue;
      sw.active = true;
      sw.life = 0;
      sw.maxLife = duration;
      sw.startRadius = Math.max(0.5, endRadius * 0.16);
      sw.endRadius = endRadius;
      sw.mat.color.setHex(colorHex);
      sw.mat.opacity = 0.88;
      sw.mesh.position.set(pos.x, pos.y + 0.18, pos.z);
      sw.mesh.scale.setScalar(sw.startRadius);
      sw.mesh.visible = true;
      this.pushLog('Shockwave');
      break;
    }
  }

  public spawnSlashTrail(
    pos: THREE.Vector3,
    yaw: number,
    colorHex = 0xfef08a,
    scale = 1.6,
    tilt = 0.25
  ): void {
    if (!this.enabled || this.zoomLod === 'Far') return;
    for (const tr of this.trailPool) {
      if (tr.active) continue;
      tr.active = true;
      tr.life = 0;
      tr.maxLife = 0.26;
      tr.mat.color.setHex(colorHex);
      tr.mat.opacity = 0.92;
      tr.mesh.position.set(pos.x, pos.y + 1.4, pos.z);
      tr.mesh.rotation.set(tilt, yaw, 0);
      tr.mesh.scale.setScalar(scale * this.intensityMultiplier);
      tr.mesh.visible = true;
      this.pushLog('Weapon Trail');
      break;
    }
  }

  public spawnProjectile(
    start: THREE.Vector3,
    end: THREE.Vector3,
    kind: 'arrow' | 'fireball',
    duration = 0.45,
    onImpact?: (pos: THREE.Vector3) => void
  ): void {
    if (!this.enabled) {
      onImpact?.(end);
      return;
    }
    for (const pr of this.projectilePool) {
      if (pr.active) continue;
      pr.active = true;
      pr.kind = kind;
      pr.start.copy(start);
      pr.end.copy(end);
      pr.arcHeight = kind === 'arrow' ? Math.max(2.2, start.distanceTo(end) * 0.22) : Math.max(3.5, start.distanceTo(end) * 0.3);
      pr.life = 0;
      pr.maxLife = duration;
      pr.onImpact = onImpact;
      pr.mesh.position.copy(start);
      pr.mesh.scale.setScalar(kind === 'fireball' ? 1.8 : 1.0);
      pr.mesh.visible = true;
      (pr.trailLine.material as THREE.LineBasicMaterial).color.setHex(
        kind === 'fireball' ? 0xf97316 : 0xfef08a
      );
      pr.trailLine.visible = this.zoomLod !== 'Far';
      for (let i = 0; i < 6; i++) {
        pr.trailPositions[i * 3] = start.x;
        pr.trailPositions[i * 3 + 1] = start.y;
        pr.trailPositions[i * 3 + 2] = start.z;
      }
      (pr.trailLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      this.pushLog(kind === 'fireball' ? 'Fireball' : 'Arrow Flight');
      break;
    }
  }

  public spawnVerticalBeam(
    pos: THREE.Vector3,
    colorHex: number,
    height = 18,
    radius = 1.6,
    duration = 1.1
  ): void {
    if (!this.enabled) return;
    for (const b of this.beamPool) {
      if (b.active) continue;
      b.active = true;
      b.life = 0;
      b.maxLife = duration;
      b.targetScaleY = height;
      b.mat.color.setHex(colorHex);
      b.mat.opacity = 0.78;
      b.mesh.position.set(pos.x, pos.y, pos.z);
      b.mesh.scale.set(radius, 1, radius);
      b.mesh.visible = true;
      this.pushLog('Energy Beam');
      break;
    }
  }

  public triggerCameraShake(amount: number): void {
    if (!this.enabled) return;
    this.shakeIntensity = Math.min(2.2, Math.max(this.shakeIntensity, amount));
    this.pushLog('Camera Shake');
  }

  public update(delta: number): void {
    const dt = Math.min(0.05, delta);

    // 1. Update pooled InstancedMesh particles
    let anyParticleMatrixChange = false;
    for (let i = 0; i < this.particlePool.length; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;
      anyParticleMatrixChange = true;
      p.life += dt;
      const t = p.life / p.maxLife;
      if (t >= 1) {
        p.active = false;
        this._dummy.position.set(0, -999, 0);
        this._dummy.scale.set(0, 0, 0);
        this._dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }

      p.vel.y += p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.08 && p.gravity < 0) {
        p.pos.y = 0.08;
        p.vel.y *= -0.3;
        p.vel.x *= 0.72;
        p.vel.z *= 0.72;
      }
      p.rot += p.rotSpeed * dt;
      const sc = THREE.MathUtils.lerp(p.startScale, p.endScale, t);
      this._dummy.position.copy(p.pos);
      this._dummy.rotation.set(p.rot, p.rot * 0.7, 0);
      this._dummy.scale.setScalar(sc);
      this._dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, this._dummy.matrix);
    }
    if (anyParticleMatrixChange) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
    }

    // 2. Update shockwaves
    for (const sw of this.shockwavePool) {
      if (!sw.active) continue;
      sw.life += dt;
      const t = sw.life / sw.maxLife;
      if (t >= 1) {
        sw.active = false;
        sw.mesh.visible = false;
        continue;
      }
      const ease = 1 - Math.pow(1 - t, 3);
      const r = THREE.MathUtils.lerp(sw.startRadius, sw.endRadius, ease);
      sw.mesh.scale.setScalar(r);
      sw.mat.opacity = 0.88 * (1 - t);
    }

    // 3. Update slash trails
    for (const tr of this.trailPool) {
      if (!tr.active) continue;
      tr.life += dt;
      const t = tr.life / tr.maxLife;
      if (t >= 1) {
        tr.active = false;
        tr.mesh.visible = false;
        continue;
      }
      tr.mesh.rotateOnAxis(this._up, dt * 8.5);
      tr.mat.opacity = 0.92 * (1 - t);
    }

    // 4. Update projectiles
    for (const pr of this.projectilePool) {
      if (!pr.active) continue;
      pr.life += dt;
      const t = Math.min(1, pr.life / pr.maxLife);
      this._pos.lerpVectors(pr.start, pr.end, t);
      this._pos.y += Math.sin(t * Math.PI) * pr.arcHeight;
      pr.mesh.position.copy(this._pos);
      pr.mesh.lookAt(
        THREE.MathUtils.lerp(pr.start.x, pr.end.x, Math.min(1, t + 0.06)),
        THREE.MathUtils.lerp(pr.start.y, pr.end.y, Math.min(1, t + 0.06)) +
          Math.sin(Math.min(1, t + 0.06) * Math.PI) * pr.arcHeight,
        THREE.MathUtils.lerp(pr.start.z, pr.end.z, Math.min(1, t + 0.06))
      );

      // Shift trail positions back
      for (let k = 5; k > 0; k--) {
        pr.trailPositions[k * 3] = pr.trailPositions[(k - 1) * 3];
        pr.trailPositions[k * 3 + 1] = pr.trailPositions[(k - 1) * 3 + 1];
        pr.trailPositions[k * 3 + 2] = pr.trailPositions[(k - 1) * 3 + 2];
      }
      pr.trailPositions[0] = this._pos.x;
      pr.trailPositions[1] = this._pos.y;
      pr.trailPositions[2] = this._pos.z;
      (pr.trailLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

      if (t >= 1) {
        pr.active = false;
        pr.mesh.visible = false;
        pr.trailLine.visible = false;
        pr.onImpact?.(pr.end);
      }
    }

    // 5. Update vertical energy beams
    for (const b of this.beamPool) {
      if (!b.active) continue;
      b.life += dt;
      const t = b.life / b.maxLife;
      if (t >= 1) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }
      b.mesh.scale.y = THREE.MathUtils.lerp(2, b.targetScaleY, Math.sin(t * Math.PI));
      b.mat.opacity = 0.8 * Math.sin(t * Math.PI);
    }

    // 6. Camera shake decay
    if (this.shakeIntensity > 0.005) {
      this.shakeOffset.set(
        (Math.random() - 0.5) * this.shakeIntensity,
        (Math.random() - 0.5) * this.shakeIntensity * 0.5,
        (Math.random() - 0.5) * this.shakeIntensity
      );
      this.shakeIntensity *= Math.exp(-this.shakeDecay * dt);
    } else {
      this.shakeIntensity = 0;
      this.shakeOffset.set(0, 0, 0);
    }
  }

  public getActiveStats(): {
    activeParticles: number;
    activeShockwaves: number;
    activeProjectiles: number;
    activeTrails: number;
    recentEffects: string[];
  } {
    let activeParticles = 0;
    for (const p of this.particlePool) if (p.active) activeParticles++;
    let activeShockwaves = 0;
    for (const s of this.shockwavePool) if (s.active) activeShockwaves++;
    let activeProjectiles = 0;
    for (const pr of this.projectilePool) if (pr.active) activeProjectiles++;
    let activeTrails = 0;
    for (const tr of this.trailPool) if (tr.active) activeTrails++;

    return {
      activeParticles,
      activeShockwaves,
      activeProjectiles,
      activeTrails,
      recentEffects: [...this.recentEffectLog],
    };
  }

  public dispose(): void {
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.shockwavePool.forEach((s, idx) => {
      if (idx === 0) s.mesh.geometry.dispose();
      s.mat.dispose();
    });
    this.trailPool.forEach((t, idx) => {
      if (idx === 0) t.mesh.geometry.dispose();
      t.mat.dispose();
    });
    this.projectilePool.forEach((p) => {
      p.trailLine.geometry.dispose();
      (p.trailLine.material as THREE.Material).dispose();
    });
    this.beamPool.forEach((b, idx) => {
      if (idx === 0) b.mesh.geometry.dispose();
      b.mat.dispose();
    });
    this.rootGroup.parent?.remove(this.rootGroup);
  }
}
