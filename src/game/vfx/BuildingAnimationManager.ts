import * as THREE from 'three';
import {
  BarrierFactionColorKey,
  ProtectionBarrierInstance,
  createProtectionBarrier,
  disposeProtectionBarrier,
  setBarrierFaction,
  triggerBarrierImpact,
  updateProtectionBarrier,
} from './ProtectionBarrierShader';
import type { VFXManager } from './VFXManager';

export type BuildingRigType =
  | 'player_castle'
  | 'external_castle'
  | 'c_shrine'
  | 'b_shrine'
  | 'a_shrine'
  | 'alliance_citadel';

export interface AnimatedBuildingRig {
  id: string;
  buildingType: BuildingRigType;
  displayName: string;
  rootGroup: THREE.Group;
  flags: THREE.Mesh[];
  torches: THREE.Mesh[];
  windows: THREE.Mesh[];
  gateDoor: THREE.Object3D | null;
  fountainWater: THREE.Object3D | null;
  scaffoldGroup: THREE.Group | null;
  crystalGroup: THREE.Object3D | null;
  crystalMat: THREE.MeshStandardMaterial | null;
  runesRings: THREE.Object3D[];
  fourPillars: Array<{ mesh: THREE.Mesh; beam: THREE.Mesh; mat: THREE.MeshStandardMaterial }>;
  emblemGroup: THREE.Object3D | null;
  barrier: ProtectionBarrierInstance;
  gateOpenTarget: number;
  gateOpenProgress: number;
  upgradeTimer: number;
  isBurning: boolean;
  smokeTimer: number;
  capturePhaseTimer: number;
  capturePendingFaction: BarrierFactionColorKey | null;
}

export class BuildingAnimationManager {
  public readonly buildings: AnimatedBuildingRig[] = [];
  private readonly vfx: VFXManager;
  private isNightGlow = false;
  private readonly _pos = new THREE.Vector3();

  constructor(vfx: VFXManager) {
    this.vfx = vfx;
  }

  public setNightMode(night: boolean): void {
    this.isNightGlow = night;
    for (const b of this.buildings) {
      for (const w of b.windows) {
        const mat = w.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = night ? 1.85 : 0.25;
      }
    }
  }

  public createBuildingRig(
    id: string,
    buildingType: BuildingRigType,
    faction: BarrierFactionColorKey = 'neutral'
  ): AnimatedBuildingRig {
    const rootGroup = new THREE.Group();
    const flags: THREE.Mesh[] = [];
    const torches: THREE.Mesh[] = [];
    const windows: THREE.Mesh[] = [];
    const runesRings: THREE.Object3D[] = [];
    const fourPillars: AnimatedBuildingRig['fourPillars'] = [];
    let gateDoor: THREE.Object3D | null = null;
    let fountainWater: THREE.Object3D | null = null;
    let scaffoldGroup: THREE.Group | null = null;
    let crystalGroup: THREE.Object3D | null = null;
    let crystalMat: THREE.MeshStandardMaterial | null = null;
    let emblemGroup: THREE.Object3D | null = null;

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.72, metalness: 0.15 });
    const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.82 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.28, metalness: 0.8 });
    const flagMat = new THREE.MeshStandardMaterial({
      color: faction === 'enemy' ? 0xef4444 : faction === 'player' ? 0x38bdf8 : 0xfacc15,
      roughness: 0.65,
      side: THREE.DoubleSide,
    });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const winMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: this.isNightGlow ? 1.85 : 0.25,
    });

    let barrierRadius = 6.5;
    let displayName = 'Building';

    if (buildingType === 'player_castle' || buildingType === 'external_castle') {
      const isExt = buildingType === 'external_castle';
      const s = isExt ? 1.25 : 1.0;
      barrierRadius = isExt ? 7.2 : 6.0;
      displayName = isExt ? 'External Kingdom Castle' : 'Player Castle';

      const base = new THREE.Mesh(new THREE.BoxGeometry(5.6 * s, 0.8, 5.6 * s), darkStoneMat);
      base.position.y = 0.4;
      const keep = new THREE.Mesh(new THREE.BoxGeometry(3.2 * s, 3.6 * s, 3.2 * s), stoneMat);
      keep.position.y = 0.8 + 1.8 * s;
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(2.5 * s, 1.9 * s, 4),
        new THREE.MeshStandardMaterial({
          color: isExt ? 0x991b1b : 0x1d4ed8,
          roughness: 0.45,
          metalness: 0.3,
        })
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 0.8 + 3.6 * s + 0.95 * s;
      rootGroup.add(base, keep, roof);

      // 4 Corner Towers + Flags + Torches
      const off = 2.15 * s;
      const tGeo = new THREE.CylinderGeometry(0.55 * s, 0.65 * s, 3.1 * s, 8);
      const tCapGeo = new THREE.ConeGeometry(0.72 * s, 1.0 * s, 8);
      for (const [tx, tz] of [
        [-off, -off],
        [off, -off],
        [-off, off],
        [off, off],
      ]) {
        const tower = new THREE.Mesh(tGeo, stoneMat);
        tower.position.set(tx, 0.8 + 1.55 * s, tz);
        const cap = new THREE.Mesh(tCapGeo, goldMat);
        cap.position.set(tx, 0.8 + 3.1 * s + 0.5 * s, tz);
        rootGroup.add(tower, cap);

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 5), goldMat);
        pole.position.set(tx, 0.8 + 3.6 * s + 0.8, tz);
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.48, 4, 2), flagMat);
        banner.position.set(tx + 0.48, 0.8 + 3.6 * s + 1.15, tz);
        rootGroup.add(pole, banner);
        flags.push(banner);

        const torch = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.48, 6), flameMat);
        torch.position.set(tx, 2.3 * s, tz > 0 ? tz + 0.55 : tz - 0.55);
        rootGroup.add(torch);
        torches.push(torch);
      }

      // Windows on Keep
      for (const wx of [-0.7 * s, 0.7 * s]) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.65), winMat);
        win.position.set(wx, 2.8 * s, 1.62 * s);
        rootGroup.add(win);
        windows.push(win);
      }

      // Hinged Gate Door
      const gatePivot = new THREE.Group();
      gatePivot.position.set(-0.65 * s, 0.8, 1.66 * s);
      const doorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.3 * s, 1.55 * s, 0.16),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 })
      );
      doorMesh.position.set(0.65 * s, 0.78 * s, 0);
      gatePivot.add(doorMesh);
      rootGroup.add(gatePivot);
      gateDoor = gatePivot;

      // Courtyard Fountain
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.3, 12), stoneMat);
      basin.position.set(0, 0.92, 2.35 * s);
      const spout = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 0.9, 8),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 })
      );
      spout.position.set(0, 1.45, 2.35 * s);
      rootGroup.add(basin, spout);
      fountainWater = spout;

      // Upgrade / Construction glowing outline scaffold (hidden until upgrade triggered)
      scaffoldGroup = new THREE.Group();
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(5.9 * s, 6.2 * s, 5.9 * s)),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
      );
      outline.position.y = 3.1 * s;
      scaffoldGroup.add(outline);
      scaffoldGroup.visible = false;
      rootGroup.add(scaffoldGroup);
    } else if (buildingType === 'c_shrine' || buildingType === 'b_shrine' || buildingType === 'a_shrine') {
      const tierScale = buildingType === 'a_shrine' ? 1.4 : buildingType === 'b_shrine' ? 1.18 : 1.0;
      barrierRadius = buildingType === 'a_shrine' ? 7.6 : buildingType === 'b_shrine' ? 6.4 : 5.4;
      displayName =
        buildingType === 'a_shrine' ? 'A Shrine Sanctum' : buildingType === 'b_shrine' ? 'B Shrine Bastion' : 'C Shrine Outpost';

      const crystalHex =
        buildingType === 'a_shrine' ? 0xa855f7 : buildingType === 'b_shrine' ? 0x38bdf8 : 0x22c55e;

      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.6 * tierScale, 3.1 * tierScale, 1.1, 8), stoneMat);
      plinth.position.y = 0.55;
      rootGroup.add(plinth);

      crystalMat = new THREE.MeshStandardMaterial({
        color: crystalHex,
        emissive: crystalHex,
        emissiveIntensity: buildingType === 'a_shrine' ? 1.4 : buildingType === 'b_shrine' ? 0.95 : 0.65,
        roughness: 0.14,
        metalness: 0.5,
      });
      const crys = new THREE.Group();
      crys.position.y = 3.2 * tierScale;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.15 * tierScale, 0), crystalMat);
      gem.scale.set(0.75, 1.45, 0.75);
      crys.add(gem);
      rootGroup.add(crys);
      crystalGroup = crys;

      const ringCount = buildingType === 'a_shrine' ? 3 : buildingType === 'b_shrine' ? 2 : 1;
      for (let i = 0; i < ringCount; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry((1.85 + i * 0.55) * tierScale, 0.06, 8, 28),
          new THREE.MeshBasicMaterial({ color: crystalHex, transparent: true, opacity: 0.78 })
        );
        ring.rotation.x = Math.PI / 2 + (i % 2 === 0 ? 0.28 : -0.28);
        ring.position.y = 2.8 * tierScale + i * 0.35;
        rootGroup.add(ring);
        runesRings.push(ring);
      }
    } else {
      // Alliance Citadel / Congress (4 Light Pillars, Floating Crystal, Gold Rings, Runes, Emblem)
      barrierRadius = 9.2;
      displayName = 'Alliance Congress Citadel';

      const podium = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.4, 1.2, 8), stoneMat);
      podium.position.y = 0.6;
      const rotunda = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 2.6, 12), darkStoneMat);
      rotunda.position.y = 2.5;
      rootGroup.add(podium, rotunda);

      // 4 Energy Pillars continuously emitting upward light
      const pOff = 3.4;
      for (const [px, pz] of [
        [-pOff, -pOff],
        [pOff, -pOff],
        [-pOff, pOff],
        [pOff, pOff],
      ]) {
        const pMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 1.1,
          roughness: 0.25,
          metalness: 0.55,
        });
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 4.4, 8), pMat);
        pillar.position.set(px, 2.8, pz);
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.55, 7.5, 10, 1, true),
          new THREE.MeshBasicMaterial({
            color: 0xfacc15,
            transparent: true,
            opacity: 0.36,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        beam.position.set(px, 8.2, pz);
        rootGroup.add(pillar, beam);
        fourPillars.push({ mesh: pillar, beam, mat: pMat });
      }

      // Central floating & rotating crystal
      crystalMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.35,
        roughness: 0.1,
        metalness: 0.45,
      });
      const crys = new THREE.Group();
      crys.position.y = 5.8;
      const mainCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.35, 0), crystalMat);
      mainCrystal.scale.set(0.78, 1.55, 0.78);
      crys.add(mainCrystal);
      rootGroup.add(crys);
      crystalGroup = crys;

      // Pulsating Golden Energy Rings + Rotating Ground Runes
      const goldRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.5, 0.09, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.85 })
      );
      goldRing.rotation.x = Math.PI / 2;
      goldRing.position.y = 5.6;
      const groundRune = new THREE.Mesh(
        new THREE.RingGeometry(3.8, 4.6, 24),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
        })
      );
      groundRune.rotation.x = -Math.PI / 2;
      groundRune.position.y = 1.24;
      rootGroup.add(goldRing, groundRune);
      runesRings.push(goldRing, groundRune);

      // Animated Alliance Emblem hovering above crystal
      const emb = new THREE.Group();
      emb.position.y = 8.4;
      const shield = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), goldMat);
      shield.scale.set(1.1, 1.2, 0.35);
      emb.add(shield);
      rootGroup.add(emb);
      emblemGroup = emb;
    }

    const barrier = createProtectionBarrier(barrierRadius, faction);
    rootGroup.add(barrier.group);

    const rig: AnimatedBuildingRig = {
      id,
      buildingType,
      displayName,
      rootGroup,
      flags,
      torches,
      windows,
      gateDoor,
      fountainWater,
      scaffoldGroup,
      crystalGroup,
      crystalMat,
      runesRings,
      fourPillars,
      emblemGroup,
      barrier,
      gateOpenTarget: 0,
      gateOpenProgress: 0,
      upgradeTimer: 0,
      isBurning: false,
      smokeTimer: 0,
      capturePhaseTimer: 0,
      capturePendingFaction: null,
    };
    this.buildings.push(rig);
    return rig;
  }

  public toggleGate(building: AnimatedBuildingRig): void {
    building.gateOpenTarget = building.gateOpenTarget > 0.5 ? 0 : 1;
  }

  public triggerUpgrade(building: AnimatedBuildingRig): void {
    building.upgradeTimer = 2.4;
    if (building.scaffoldGroup) building.scaffoldGroup.visible = true;
    building.rootGroup.getWorldPosition(this._pos);
    this.vfx.spawnVerticalBeam(this._pos, 0x38bdf8, 16, 2.0, 1.8);
    this.vfx.spawnBurst(this._pos, 'magic_mote', 18, { speed: 3.5, gravity: 2.2, life: 1.4 });
    this.vfx.spawnBurst(this._pos, 'construction_dust', 12, { speed: 3.2, gravity: -2.0, life: 0.9 });
  }

  public triggerCaptureSequence(
    building: AnimatedBuildingRig,
    newFaction: BarrierFactionColorKey = 'alliance'
  ): void {
    building.capturePhaseTimer = 1.6;
    building.capturePendingFaction = newFaction;
    // Deactivate old barrier & pillars first
    building.barrier.targetActivation = 0.0;
    for (const p of building.fourPillars) {
      p.beam.visible = false;
      p.mat.emissiveIntensity = 0.12;
    }
    building.rootGroup.getWorldPosition(this._pos);
    this.vfx.spawnBurst(this._pos, 'magic_mote', 16, { speed: 4.5, gravity: 1.5, life: 1.0 });
  }

  public triggerBattleDamage(building: AnimatedBuildingRig, isHeavy = false): void {
    building.isBurning = true;
    building.barrier.damageCracks = Math.min(1, building.barrier.damageCracks + 0.35);
    triggerBarrierImpact(building.barrier);
    building.rootGroup.getWorldPosition(this._pos);
    this._pos.y += 2.2;
    this.vfx.spawnBurst(this._pos, 'rock_debris', isHeavy ? 14 : 8, { speed: 5.5, gravity: -12, life: 0.7 });
    this.vfx.spawnBurst(this._pos, 'fire_breath', isHeavy ? 12 : 6, { speed: 3.5, gravity: 1.8, life: 0.7 });
    this.vfx.spawnShockwave(building.rootGroup.position, 0xf97316, isHeavy ? 8.5 : 5.5, 0.55);
    if (isHeavy) {
      this.vfx.triggerCameraShake(0.45);
    }
  }

  public triggerRepair(building: AnimatedBuildingRig): void {
    building.isBurning = false;
    building.barrier.damageCracks = 0;
    building.barrier.targetActivation = 1.0;
    building.rootGroup.getWorldPosition(this._pos);
    this._pos.y += 1.5;
    this.vfx.spawnBurst(this._pos, 'heal_mote', 16, { speed: 2.5, gravity: 2.4, life: 1.2 });
    this.vfx.spawnShockwave(building.rootGroup.position, 0x34d399, 6.2, 0.65);
  }

  public update(delta: number, elapsed: number): void {
    const dt = Math.min(0.05, delta);
    for (const b of this.buildings) {
      updateProtectionBarrier(b.barrier, dt, elapsed);

      // Castle flags & banners wave
      for (let i = 0; i < b.flags.length; i++) {
        b.flags[i].rotation.y = Math.sin(elapsed * 5.2 + i * 0.9) * 0.28;
      }

      // Flickering torches
      for (let i = 0; i < b.torches.length; i++) {
        const sc = 0.85 + Math.sin(elapsed * 16 + i * 1.7) * 0.22;
        b.torches[i].scale.set(sc, 0.85 + Math.cos(elapsed * 19 + i) * 0.3, sc);
      }

      // Gate opening / closing
      if (b.gateDoor) {
        b.gateOpenProgress = THREE.MathUtils.damp(b.gateOpenProgress, b.gateOpenTarget, 6.0, dt);
        b.gateDoor.rotation.y = -b.gateOpenProgress * (Math.PI * 0.48);
      }

      // Fountain splash
      if (b.fountainWater) {
        const fs = 0.88 + Math.sin(elapsed * 7.5) * 0.16;
        b.fountainWater.scale.set(fs, 0.9 + Math.cos(elapsed * 9) * 0.2, fs);
      }

      // Chimney smoke / burning smoke
      b.smokeTimer += dt;
      if (b.smokeTimer >= (b.isBurning ? 0.25 : 0.95)) {
        b.smokeTimer = 0;
        if (b.buildingType === 'player_castle' || b.buildingType === 'external_castle' || b.isBurning) {
          b.rootGroup.getWorldPosition(this._pos);
          this._pos.y += b.isBurning ? 3.2 : 4.8;
          this.vfx.spawnBurst(
            this._pos,
            b.isBurning ? 'fire_breath' : 'death_smoke',
            b.isBurning ? 5 : 2,
            { speed: 1.4, gravity: 2.2, life: 1.2, scale: b.isBurning ? 1.1 : 0.7 }
          );
        }
      }

      // Shrine & Citadel crystal rotation, energy rings, emblem
      if (b.crystalGroup) {
        b.crystalGroup.rotation.y += dt * (b.capturePhaseTimer > 0 ? 5.2 : 1.15);
        b.crystalGroup.position.y += Math.sin(elapsed * 2.6) * dt * 0.28;
      }
      if (b.crystalMat) {
        const baseGlow = b.buildingType === 'a_shrine' || b.buildingType === 'alliance_citadel' ? 1.3 : 0.75;
        b.crystalMat.emissiveIntensity = baseGlow + Math.sin(elapsed * 3.8) * 0.35;
      }
      for (let i = 0; i < b.runesRings.length; i++) {
        b.runesRings[i].rotation.z += dt * (i % 2 === 0 ? 1.1 : -0.9);
      }
      if (b.emblemGroup) {
        b.emblemGroup.rotation.y += dt * 1.6;
        b.emblemGroup.position.y = 8.4 + Math.sin(elapsed * 2.4) * 0.25;
      }

      // Upgrade animation finish flash
      if (b.upgradeTimer > 0) {
        b.upgradeTimer -= dt;
        if (b.upgradeTimer <= 0) {
          b.upgradeTimer = 0;
          if (b.scaffoldGroup) scaffoldOff(b.scaffoldGroup);
          b.rootGroup.getWorldPosition(this._pos);
          this.vfx.spawnShockwave(this._pos, 0xfacc15, 8.5, 0.7);
          this.vfx.spawnBurst(this._pos, 'gold_sparkle', 20, { speed: 5.5, gravity: 1.0, life: 1.0 });
        }
      }

      // Capture choreography completion
      if (b.capturePhaseTimer > 0) {
        b.capturePhaseTimer -= dt;
        if (b.capturePhaseTimer <= 0 && b.capturePendingFaction) {
          const nextFac = b.capturePendingFaction;
          b.capturePendingFaction = null;
          setBarrierFaction(b.barrier, nextFac);
          b.barrier.targetActivation = 1.0;
          const colorHex = nextFac === 'alliance' ? 0xfacc15 : nextFac === 'player' ? 0x38bdf8 : 0xef4444;
          if (b.crystalMat) {
            b.crystalMat.color.setHex(colorHex);
            b.crystalMat.emissive.setHex(colorHex);
          }
          for (const p of b.fourPillars) {
            p.beam.visible = true;
            p.mat.emissiveIntensity = 1.25;
          }
          b.rootGroup.getWorldPosition(this._pos);
          this.vfx.spawnShockwave(this._pos, colorHex, 11.5, 0.85);
          this.vfx.spawnVerticalBeam(this._pos, colorHex, 20, 2.4, 1.3);
          this.vfx.triggerCameraShake(0.5);
        }
      }
    }
  }

  public clear(): void {
    for (const b of this.buildings) {
      disposeProtectionBarrier(b.barrier);
    }
    this.buildings.length = 0;
  }
}

function scaffoldOff(g: THREE.Group) {
  g.visible = false;
}
