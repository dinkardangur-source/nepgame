import * as THREE from 'three';
import type { AnimationState } from './AnimationController';
import type { BuiltUnitRig } from './ProceduralRigLibrary';
import type { VFXManager } from './VFXManager';

export interface FloatingCombatText {
  id: string;
  text: string;
  isCrit: boolean;
  isHeal: boolean;
  worldPos: THREE.Vector3;
  age: number;
  maxAge: number;
}

export interface CombatAttackOptions {
  damage: number;
  isCrit?: boolean;
  isBlocked?: boolean;
  isKill?: boolean;
  specialKey?: string;
}

interface ActiveHitFlash {
  meshes: Array<{ mat: THREE.MeshStandardMaterial; origHex: number; origIntensity: number }>;
  timer: number;
  duration: number;
}

export class CombatManager {
  private readonly vfx: VFXManager;
  private readonly onFloatingText?: (entry: FloatingCombatText) => void;
  private readonly activeFlashes: ActiveHitFlash[] = [];
  private readonly _atkPos = new THREE.Vector3();
  private readonly _defPos = new THREE.Vector3();
  private readonly _dir = new THREE.Vector3();
  private readonly _stepPos = new THREE.Vector3();
  private uid = 0;

  constructor(vfx: VFXManager, onFloatingText?: (entry: FloatingCombatText) => void) {
    this.vfx = vfx;
    this.onFloatingText = onFloatingText;
  }

  private emitFloatingText(
    worldPos: THREE.Vector3,
    text: string,
    isCrit = false,
    isHeal = false
  ): void {
    if (!this.onFloatingText) return;
    this.uid += 1;
    this.onFloatingText({
      id: `dmg-${this.uid}-${Date.now()}`,
      text,
      isCrit,
      isHeal,
      worldPos: worldPos.clone(),
      age: 0,
      maxAge: 1.15,
    });
  }

  public triggerHitFlash(rig: BuiltUnitRig, flashHex = 0xef4444, duration = 0.22): void {
    const meshes: ActiveHitFlash['meshes'] = [];
    rig.rootGroup.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive && typeof mat.emissiveIntensity === 'number') {
        meshes.push({
          mat,
          origHex: mat.emissive.getHex(),
          origIntensity: mat.emissiveIntensity,
        });
        mat.emissive.setHex(flashHex);
        mat.emissiveIntensity = 1.15;
      }
    });
    if (meshes.length > 0) {
      this.activeFlashes.push({ meshes, timer: duration, duration });
    }
  }

  public spawnMonsterLevelAura(rig: BuiltUnitRig): void {
    rig.rootGroup.getWorldPosition(this._atkPos);
    const auraKind =
      rig.element === 'fire'
        ? 'fire_breath'
        : rig.element === 'poison'
          ? 'poison_cloud'
          : rig.element === 'shadow'
            ? 'dark_aura'
            : 'magic_mote';
    const auraColor =
      rig.element === 'fire'
        ? 0xf97316
        : rig.element === 'poison'
          ? 0x22c55e
          : rig.element === 'shadow'
            ? 0xa855f7
            : 0x38bdf8;
    const count = Math.min(12, 3 + Math.floor(rig.level * 0.8));
    this.vfx.spawnBurst(this._atkPos, auraKind, count, {
      speed: 1.4,
      gravity: 1.8,
      life: 0.9,
      colorHex: auraColor,
    });
  }

  public triggerStateVfx(
    rig: BuiltUnitRig,
    state: AnimationState,
    customKey?: string,
    targetWorldPos?: THREE.Vector3
  ): void {
    rig.rootGroup.getWorldPosition(this._atkPos);
    const yaw = rig.rootGroup.rotation.y;

    if (state === 'WALK' || state === 'RUN' || state === 'MARCH') {
      const isCav = rig.rigId === 'thakuri_cavalry';
      const count = state === 'MARCH' || customKey?.includes('GALLOP') ? (isCav ? 10 : 7) : 4;
      this.vfx.spawnBurst(this._atkPos, 'dust', count, {
        speed: isCav ? 3.2 : 1.8,
        gravity: -4,
        life: 0.55,
      });
      return;
    }

    if (state === 'MINE') {
      this.vfx.spawnBurst(this._atkPos, 'spark', 6, { speed: 3.8, gravity: -9, life: 0.45 });
      this.vfx.spawnBurst(this._atkPos, 'rock_debris', 5, { speed: 3.2, gravity: -11, life: 0.5 });
      return;
    }

    if (state === 'GATHER') {
      this.vfx.spawnBurst(this._atkPos, 'leaf', 5, { speed: 2.0, gravity: -1.5, life: 0.9 });
      this.vfx.spawnBurst(this._atkPos, 'dust', 3, { speed: 1.5, gravity: -3, life: 0.45 });
      return;
    }

    if (state === 'RALLY' || state === 'VICTORY') {
      const col = state === 'VICTORY' ? 0xfacc15 : 0x38bdf8;
      this.vfx.spawnShockwave(this._atkPos, col, 4.4, 0.6);
      this.vfx.spawnBurst(this._atkPos, 'gold_sparkle', 10, { speed: 3.5, gravity: 1.5, life: 0.85 });
      return;
    }

    if (state === 'HEAL') {
      this.vfx.spawnBurst(this._atkPos, 'heal_mote', 12, { speed: 2.2, gravity: 2.4, life: 1.0 });
      this.emitFloatingText(this._atkPos.clone().setY(this._atkPos.y + 2.4), '+180', false, true);
      return;
    }

    if (state === 'BLOCK') {
      this.vfx.spawnShockwave(this._atkPos, 0x38bdf8, 3.0, 0.38);
      this.vfx.spawnBurst(this._atkPos, 'spark', 8, { speed: 4.5, gravity: -7, life: 0.4 });
      return;
    }

    if (state === 'DAMAGE') {
      this.triggerHitFlash(rig, 0xef4444, 0.22);
      this.vfx.spawnBurst(this._atkPos.clone().setY(this._atkPos.y + 1.2), 'spark', 8, {
        speed: 4.2,
        gravity: -10,
        life: 0.4,
        colorHex: 0xf87171,
      });
      return;
    }

    if (state === 'DEATH') {
      this.vfx.spawnBurst(this._atkPos, 'death_smoke', 16, { speed: 2.8, gravity: 1.6, life: 1.15 });
      if (rig.element === 'shadow' || rig.element === 'fire') {
        this.vfx.spawnBurst(this._atkPos, rig.element === 'fire' ? 'fire_breath' : 'dark_aura', 10, {
          speed: 3.2,
          gravity: 1.8,
          life: 0.9,
        });
      }
      return;
    }

    if (state === 'ATTACK' || state === 'CAST') {
      if (rig.rigId === 'limbu_archer') {
        const start = this._atkPos.clone().add(new THREE.Vector3(0, 1.55, 0));
        const end = targetWorldPos
          ? targetWorldPos.clone().add(new THREE.Vector3(0, 1.2, 0))
          : start.clone().add(new THREE.Vector3(Math.sin(yaw) * 9, -0.3, Math.cos(yaw) * 9));
        this.vfx.spawnBurst(start, 'spark', 5, { speed: 2.2, gravity: -2, life: 0.3 });
        this.vfx.spawnProjectile(start, end, 'arrow', 0.36, (impactPos) => {
          this.vfx.spawnBurst(impactPos, 'spark', 8, { speed: 4.5, gravity: -9, life: 0.45 });
        });
        return;
      }

      if (rig.rigId === 'skeleton_dragon' || customKey === 'FIRE_BREATH') {
        const mouth = this._atkPos.clone().add(new THREE.Vector3(0, 1.9, 0));
        this._dir.set(Math.sin(yaw), -0.15, Math.cos(yaw));
        for (let step = 1; step <= 3; step++) {
          this._stepPos.copy(mouth).addScaledVector(this._dir, step * 1.6);
          this.vfx.spawnBurst(this._stepPos, 'fire_breath', 8, {
            speed: 3.8 + step,
            gravity: 1.4,
            life: 0.65,
            scale: 1.15,
          });
        }
        this.vfx.spawnShockwave(this._atkPos, 0xf97316, 6.2, 0.55);
        this.vfx.triggerCameraShake(0.35);
        return;
      }

      if (rig.rigId === 'ogre' && customKey === 'GROUND_SLAM') {
        this.vfx.spawnShockwave(this._atkPos, 0xf59e0b, 7.2, 0.58);
        this.vfx.spawnBurst(this._atkPos, 'rock_debris', 12, { speed: 5.5, gravity: -13, life: 0.6 });
        this.vfx.triggerCameraShake(0.45);
        return;
      }

      if (rig.rigId === 'death_knight') {
        this.vfx.spawnSlashTrail(this._atkPos, yaw, 0xa855f7, 2.3, 0.2);
        this.vfx.spawnBurst(this._atkPos, 'dark_aura', 10, { speed: 3.5, gravity: 1.2, life: 0.7 });
        return;
      }

      if (rig.rigId === 'slime') {
        this.vfx.spawnBurst(this._atkPos, 'poison_cloud', 9, { speed: 2.4, gravity: 0.8, life: 0.8 });
        this.vfx.spawnShockwave(this._atkPos, 0x22c55e, 3.2, 0.42);
        return;
      }

      if (rig.rigId === 'thakuri_cavalry') {
        this.vfx.spawnBurst(this._atkPos, 'dust', 10, { speed: 3.8, gravity: -5, life: 0.55 });
        this.vfx.spawnSlashTrail(this._atkPos, yaw, 0xfacc15, 2.0, 0.3);
        this.vfx.spawnShockwave(this._atkPos, 0xfacc15, 4.5, 0.45);
        return;
      }

      // Default melee (Magar Khukuri, Orc, Goblin, Wolf, Skeleton Knight)
      const slashCol =
        rig.rigId === 'magar_infantry'
          ? 0xfef08a
          : rig.rigId === 'skeleton_knight'
            ? 0x38bdf8
            : 0xf97316;
      this.vfx.spawnSlashTrail(this._atkPos, yaw, slashCol, 1.75, 0.25);
      this.vfx.spawnBurst(
        this._atkPos.clone().add(new THREE.Vector3(Math.sin(yaw) * 1.1, 1.1, Math.cos(yaw) * 1.1)),
        'spark',
        7,
        { speed: 4.0, gravity: -8, life: 0.42 }
      );
    }
  }

  public executeAttack(
    attacker: BuiltUnitRig,
    defender: BuiltUnitRig,
    options: CombatAttackOptions
  ): void {
    attacker.rootGroup.getWorldPosition(this._atkPos);
    defender.rootGroup.getWorldPosition(this._defPos);

    // Orient units toward each other
    attacker.rootGroup.lookAt(this._defPos.x, attacker.rootGroup.position.y, this._defPos.z);
    defender.rootGroup.lookAt(this._atkPos.x, defender.rootGroup.position.y, this._atkPos.z);

    if (options.specialKey) {
      attacker.controller.playNamedClip(options.specialKey, 'CAST', 0.14);
    } else {
      attacker.controller.playState('ATTACK', { force: true, fadeDuration: 0.14 });
    }
    this.triggerStateVfx(attacker, options.specialKey ? 'CAST' : 'ATTACK', options.specialKey, this._defPos);

    const resolveImpact = () => {
      if (options.isBlocked) {
        defender.controller.playState('BLOCK', { force: true, fadeDuration: 0.1 });
        this.triggerStateVfx(defender, 'BLOCK');
        this.emitFloatingText(this._defPos.clone().setY(this._defPos.y + 2.4), 'BLOCKED', false, false);
        return;
      }

      if (options.isKill) {
        defender.controller.playState('DEATH', { force: true, fadeDuration: 0.12 });
        this.triggerStateVfx(defender, 'DEATH');
        attacker.controller.playState('VICTORY', { force: true, fadeDuration: 0.25 });
        this.triggerStateVfx(attacker, 'VICTORY');
      } else {
        defender.controller.playState('DAMAGE', { force: true, fadeDuration: 0.1 });
        this.triggerStateVfx(defender, 'DAMAGE');
      }

      if (options.isCrit) {
        this.vfx.spawnShockwave(this._defPos, 0xfacc15, 5.2, 0.48);
        this.vfx.spawnBurst(this._defPos.clone().setY(this._defPos.y + 1.2), 'spark', 14, {
          speed: 5.5,
          gravity: -9,
          life: 0.55,
        });
        this.vfx.triggerCameraShake(0.42);
        this.emitFloatingText(
          this._defPos.clone().setY(this._defPos.y + 2.7),
          `CRIT -${options.damage}!`,
          true,
          false
        );
      } else {
        this.emitFloatingText(
          this._defPos.clone().setY(this._defPos.y + 2.3),
          `-${options.damage}`,
          false,
          false
        );
      }
    };

    if (attacker.rigId === 'limbu_archer') {
      // Arrow impact triggers after projectile travel (~360ms)
      setTimeout(resolveImpact, 340);
    } else {
      resolveImpact();
    }
  }

  public update(delta: number): void {
    for (let i = this.activeFlashes.length - 1; i >= 0; i--) {
      const f = this.activeFlashes[i];
      f.timer -= delta;
      if (f.timer <= 0) {
        for (const m of f.meshes) {
          m.mat.emissive.setHex(m.origHex);
          m.mat.emissiveIntensity = m.origIntensity;
        }
        this.activeFlashes.splice(i, 1);
      }
    }
  }
}
