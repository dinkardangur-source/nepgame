import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export type AnimationState =
  | 'IDLE'
  | 'WALK'
  | 'RUN'
  | 'MARCH'
  | 'ATTACK'
  | 'BLOCK'
  | 'GATHER'
  | 'MINE'
  | 'RALLY'
  | 'CAST'
  | 'DAMAGE'
  | 'HEAL'
  | 'VICTORY'
  | 'DEATH';

export type ZoomLodLevel = 'Close' | 'Medium' | 'Far';

export const ANIMATION_STATE_PRIORITY: Record<AnimationState, number> = {
  IDLE: 0,
  WALK: 20,
  RUN: 25,
  MARCH: 30,
  GATHER: 45,
  MINE: 45,
  RALLY: 50,
  HEAL: 55,
  VICTORY: 60,
  ATTACK: 70,
  CAST: 70,
  BLOCK: 75,
  DAMAGE: 80,
  DEATH: 100,
};

const ONE_SHOT_STATES = new Set<AnimationState>([
  'ATTACK',
  'BLOCK',
  'CAST',
  'DAMAGE',
  'HEAL',
  'VICTORY',
  'DEATH',
]);

export interface ClipCatalogEntry {
  clip: THREE.AnimationClip;
  label: string;
  loopOnce?: boolean;
  clampWhenFinished?: boolean;
}

export interface AnimationDiagnostics {
  modelName: string;
  currentState: AnimationState;
  currentClipLabel: string;
  previousState: AnimationState | null;
  clipDuration: number;
  currentTime: number;
  isTransitioning: boolean;
  transitionLabel: string;
  speedMultiplier: number;
  zoomLod: ZoomLodLevel;
}

/**
 * Unified AnimationController wrapping Three.js AnimationMixer + AnimationAction
 * with priority handling, cross-fade blending, interruption rules, and zoom LOD pacing.
 */
export class AnimationController {
  public readonly modelName: string;
  public readonly rootObject: THREE.Object3D;
  public readonly mixer: THREE.AnimationMixer;

  private clipsByState: Map<AnimationState, ClipCatalogEntry> = new Map();
  private customNamedClips: Map<string, ClipCatalogEntry> = new Map();
  private actionsByKey: Map<string, THREE.AnimationAction> = new Map();

  private currentState: AnimationState = 'IDLE';
  private currentKey = 'IDLE';
  private currentClipLabel = 'Idle';
  private previousState: AnimationState | null = null;
  private activeAction: THREE.AnimationAction | null = null;
  private fallbackState: AnimationState = 'IDLE';

  private speedMultiplier = 1.0;
  private zoomLod: ZoomLodLevel = 'Close';
  private transitionTimer = 0;
  private lodAccumulator = 0;
  private isDead = false;
  private onStateFinishedCb?: (finishedState: AnimationState) => void;

  constructor(
    modelName: string,
    rootObject: THREE.Object3D,
    clipMap: Partial<Record<AnimationState, ClipCatalogEntry>>,
    customClips?: Record<string, ClipCatalogEntry>,
    onStateFinished?: (finishedState: AnimationState) => void
  ) {
    this.modelName = modelName;
    this.rootObject = rootObject;
    this.mixer = new THREE.AnimationMixer(rootObject);
    this.onStateFinishedCb = onStateFinished;

    (Object.keys(clipMap) as AnimationState[]).forEach((state) => {
      const entry = clipMap[state];
      if (entry) {
        this.clipsByState.set(state, entry);
      }
    });

    if (customClips) {
      Object.entries(customClips).forEach(([k, entry]) => {
        this.customNamedClips.set(k, entry);
      });
    }

    this.mixer.addEventListener('finished', this.handleMixerFinished);
    this.playState('IDLE', { force: true, fadeDuration: 0 });
  }

  private handleMixerFinished = (e: { action: THREE.AnimationAction }) => {
    if (e.action !== this.activeAction) return;
    const finishedState = this.currentState;
    this.onStateFinishedCb?.(finishedState);

    if (finishedState === 'DEATH') {
      this.isDead = true;
      return;
    }

    // Automatically return one-shot actions (ATTACK, DAMAGE, BLOCK, CAST, HEAL, VICTORY) to fallback
    if (ONE_SHOT_STATES.has(finishedState) && !this.isDead) {
      this.playState(this.fallbackState, { force: true, fadeDuration: 0.2 });
    }
  };

  private getOrCreateAction(key: string, entry: ClipCatalogEntry, isOneShot: boolean): THREE.AnimationAction {
    let action = this.actionsByKey.get(key);
    if (!action) {
      action = this.mixer.clipAction(entry.clip);
      this.actionsByKey.set(key, action);
    }
    const loopOnce = entry.loopOnce ?? isOneShot;
    action.setLoop(loopOnce ? THREE.LoopOnce : THREE.LoopRepeat, loopOnce ? 1 : Infinity);
    action.clampWhenFinished = entry.clampWhenFinished ?? key === 'DEATH';
    return action;
  }

  public setFallbackState(state: AnimationState): void {
    if (!ONE_SHOT_STATES.has(state)) {
      this.fallbackState = state;
    }
  }

  public playState(
    nextState: AnimationState,
    options?: {
      force?: boolean;
      fadeDuration?: number;
      customKey?: string;
    }
  ): boolean {
    const force = options?.force ?? false;
    const fadeDuration = options?.fadeDuration ?? 0.22;

    if (this.isDead && !force && nextState !== 'DEATH') {
      return false;
    }

    if (nextState !== 'DEATH' && this.isDead && force) {
      this.isDead = false;
    }

    // Priority & interruption check
    if (!force && this.activeAction && this.activeAction.isRunning()) {
      const curPrio = ANIMATION_STATE_PRIORITY[this.currentState];
      const nextPrio = ANIMATION_STATE_PRIORITY[nextState];
      if (nextState === this.currentState && (!options?.customKey || options.customKey === this.currentKey)) {
        return false;
      }
      if (ONE_SHOT_STATES.has(this.currentState) && nextPrio < curPrio) {
        if (!ONE_SHOT_STATES.has(nextState)) {
          this.fallbackState = nextState;
        }
        return false;
      }
    }

    if (!ONE_SHOT_STATES.has(nextState)) {
      this.fallbackState = nextState;
    }

    const lookupKey = options?.customKey ?? nextState;
    const entry =
      (options?.customKey ? this.customNamedClips.get(options.customKey) : undefined) ??
      this.clipsByState.get(nextState) ??
      this.clipsByState.get('IDLE');

    if (!entry) return false;

    const nextAction = this.getOrCreateAction(lookupKey, entry, ONE_SHOT_STATES.has(nextState));
    nextAction.enabled = true;
    nextAction.setEffectiveTimeScale(this.speedMultiplier);
    nextAction.setEffectiveWeight(1);

    if (this.activeAction && this.activeAction !== nextAction) {
      nextAction.reset();
      nextAction.play();
      if (fadeDuration > 0.01) {
        this.activeAction.crossFadeTo(nextAction, fadeDuration, true);
        this.transitionTimer = fadeDuration;
      } else {
        this.activeAction.stop();
        this.transitionTimer = 0;
      }
    } else {
      nextAction.reset().play();
      this.transitionTimer = 0;
    }

    this.previousState = this.currentState;
    this.currentState = nextState;
    this.currentKey = lookupKey;
    this.currentClipLabel = entry.label;
    this.activeAction = nextAction;
    if (nextState === 'DEATH') {
      this.isDead = true;
    }
    return true;
  }

  public playNamedClip(name: string, stateTag: AnimationState, fadeDuration = 0.2): boolean {
    if (!this.customNamedClips.has(name)) {
      return this.playState(stateTag, { force: true, fadeDuration });
    }
    return this.playState(stateTag, { force: true, fadeDuration, customKey: name });
  }

  public resetToIdle(): void {
    this.isDead = false;
    this.fallbackState = 'IDLE';
    this.mixer.stopAllAction();
    this.activeAction = null;
    this.playState('IDLE', { force: true, fadeDuration: 0.12 });
  }

  public setSpeed(speed: number): void {
    this.speedMultiplier = Math.max(0.1, Math.min(3.0, speed));
    if (this.activeAction) {
      this.activeAction.setEffectiveTimeScale(this.speedMultiplier);
    }
  }

  public setZoomLod(lod: ZoomLodLevel): void {
    this.zoomLod = lod;
  }

  public update(delta: number): void {
    if (this.transitionTimer > 0) {
      this.transitionTimer = Math.max(0, this.transitionTimer - delta);
    }

    // Zoom LOD pacing: Far updates at ~12 Hz, Medium at ~30 Hz, Close every frame
    if (this.zoomLod === 'Far') {
      this.lodAccumulator += delta;
      if (this.lodAccumulator < 0.083) return;
      this.mixer.update(this.lodAccumulator);
      this.lodAccumulator = 0;
      return;
    }

    if (this.zoomLod === 'Medium') {
      this.lodAccumulator += delta;
      if (this.lodAccumulator < 0.033) return;
      this.mixer.update(this.lodAccumulator);
      this.lodAccumulator = 0;
      return;
    }

    this.lodAccumulator = 0;
    this.mixer.update(delta);
  }

  public getDiagnostics(): AnimationDiagnostics {
    const entry =
      this.customNamedClips.get(this.currentKey) ?? this.clipsByState.get(this.currentState);
    return {
      modelName: this.modelName,
      currentState: this.currentState,
      currentClipLabel: this.currentClipLabel,
      previousState: this.previousState,
      clipDuration: Number((entry?.clip.duration ?? 0).toFixed(2)),
      currentTime: Number((this.activeAction?.time ?? 0).toFixed(2)),
      isTransitioning: this.transitionTimer > 0,
      transitionLabel:
        this.transitionTimer > 0 && this.previousState
          ? `Blending ${this.previousState} -> ${this.currentState}`
          : 'Settled',
      speedMultiplier: this.speedMultiplier,
      zoomLod: this.zoomLod,
    };
  }

  public getAvailableCustomClips(): Array<{ key: string; label: string; state: AnimationState }> {
    const out: Array<{ key: string; label: string; state: AnimationState }> = [];
    this.customNamedClips.forEach((v, k) => {
      const inferred: AnimationState =
        k.includes('GUARD') || k.includes('BLOCK') || k.includes('LAND') || k.includes('TURN')
          ? 'BLOCK'
          : k.includes('RELOAD')
            ? 'HEAL'
            : k.includes('GALLOP')
              ? 'RALLY'
              : k.includes('CHARGE') || k.includes('AIM') || k.includes('BREATH') || k.includes('SLAM')
                ? 'CAST'
                : k.includes('STOP')
                  ? 'GATHER'
                  : k.includes('RETURN')
                    ? 'MARCH'
                    : 'IDLE';
      out.push({ key: k, label: v.label, state: inferred });
    });
    return out;
  }

  public dispose(): void {
    this.mixer.removeEventListener('finished', this.handleMixerFinished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.rootObject);
    this.actionsByKey.clear();
  }
}

/**
 * Optional GLTFLoader + SkeletonUtils adapter for future external GLB models.
 */
export async function loadExternalAnimatedRig(
  url: string,
  modelName: string
): Promise<{
  scene: THREE.Object3D;
  controller: AnimationController;
}> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const cloned = SkeletonUtils.clone(gltf.scene);
  const clipMap: Partial<Record<AnimationState, ClipCatalogEntry>> = {};

  for (const clip of gltf.animations) {
    const upper = clip.name.toUpperCase() as AnimationState;
    if (upper in ANIMATION_STATE_PRIORITY) {
      clipMap[upper] = { clip, label: clip.name };
    }
  }
  if (!clipMap.IDLE && gltf.animations[0]) {
    clipMap.IDLE = { clip: gltf.animations[0], label: gltf.animations[0].name };
  }

  const controller = new AnimationController(modelName, cloned, clipMap);
  return { scene: cloned, controller };
}
