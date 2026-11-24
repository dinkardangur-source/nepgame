import * as THREE from 'three';
import {
  AnimationController,
  AnimationState,
  ClipCatalogEntry,
} from './AnimationController';

export type TroopRigId = 'magar_infantry' | 'limbu_archer' | 'thakuri_cavalry';
export type MonsterRigId =
  | 'slime'
  | 'orc'
  | 'goblin'
  | 'wolf'
  | 'skeleton_knight'
  | 'ogre'
  | 'death_knight'
  | 'skeleton_dragon';

export type UnitRigId = TroopRigId | MonsterRigId;

export interface BuiltUnitRig {
  rigId: UnitRigId;
  displayName: string;
  isPlaceholderProcedural: true;
  rootGroup: THREE.Group;
  controller: AnimationController;
  element: 'physical' | 'poison' | 'shadow' | 'fire' | 'frost';
  level: number;
}

// Clip cache so identical rig types share GPU KeyframeTracks
const CLIP_CACHE = new Map<
  string,
  {
    clips: Partial<Record<AnimationState, ClipCatalogEntry>>;
    customClips: Record<string, ClipCatalogEntry>;
  }
>();

function qTrack(nodeName: string, times: number[], eulers: Array<[number, number, number]>): THREE.QuaternionKeyframeTrack {
  const values: number[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (const [rx, ry, rz] of eulers) {
    e.set(rx, ry, rz, 'XYZ');
    q.setFromEuler(e);
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${nodeName}.quaternion`, times, values);
}

function vTrack(
  nodeName: string,
  prop: 'position' | 'scale',
  times: number[],
  vecs: Array<[number, number, number]>
): THREE.VectorKeyframeTrack {
  const values: number[] = [];
  for (const [x, y, z] of vecs) {
    values.push(x, y, z);
  }
  return new THREE.VectorKeyframeTrack(`${nodeName}.${prop}`, times, values);
}

function makeClip(
  name: string,
  label: string,
  duration: number,
  tracks: THREE.KeyframeTrack[],
  loopOnce = false,
  clampWhenFinished = false
): ClipCatalogEntry {
  const clip = new THREE.AnimationClip(name, duration, tracks);
  clip.optimize();
  return { clip, label, loopOnce, clampWhenFinished };
}

function buildHumanoidClips(rigId: TroopRigId | 'orc' | 'goblin' | 'skeleton_knight' | 'ogre' | 'death_knight'): {
  clips: Partial<Record<AnimationState, ClipCatalogEntry>>;
  customClips: Record<string, ClipCatalogEntry>;
} {
  const cacheKey = `humanoid:${rigId}`;
  const cached = CLIP_CACHE.get(cacheKey);
  if (cached) return cached;

  const isHeavy = rigId === 'ogre' || rigId === 'death_knight';
  const isArcher = rigId === 'limbu_archer';
  const stride = isHeavy ? 0.55 : 0.72;
  const speedScale = isHeavy ? 1.35 : 1.0;

  const idle = makeClip(`${rigId}_idle`, 'Idle Breathing', 1.8 * speedScale, [
    vTrack('pelvis', 'position', [0, 0.9 * speedScale, 1.8 * speedScale], [
      [0, 1.0, 0],
      [0, 1.04, 0],
      [0, 1.0, 0],
    ]),
    qTrack('torso', [0, 0.9 * speedScale, 1.8 * speedScale], [
      [0.02, 0, 0],
      [-0.03, 0, 0],
      [0.02, 0, 0],
    ]),
    qTrack('armR', [0, 0.9 * speedScale, 1.8 * speedScale], [
      [0.12, 0, -0.15],
      [0.06, 0, -0.18],
      [0.12, 0, -0.15],
    ]),
    qTrack('armL', [0, 0.9 * speedScale, 1.8 * speedScale], [
      [0.12, 0, 0.15],
      [0.06, 0, 0.18],
      [0.12, 0, 0.15],
    ]),
  ]);

  const walk = makeClip(`${rigId}_walk`, rigId === 'goblin' ? 'Sneak / Walk' : 'Walking', 0.9 * speedScale, [
    vTrack('pelvis', 'position', [0, 0.225 * speedScale, 0.45 * speedScale, 0.675 * speedScale, 0.9 * speedScale], [
      [0, 1.0, 0],
      [0, 1.07, 0],
      [0, 1.0, 0],
      [0, 1.07, 0],
      [0, 1.0, 0],
    ]),
    qTrack('torso', [0, 0.45 * speedScale, 0.9 * speedScale], [
      [rigId === 'goblin' ? 0.28 : 0.08, -0.08, 0],
      [rigId === 'goblin' ? 0.32 : 0.08, 0.08, 0],
      [rigId === 'goblin' ? 0.28 : 0.08, -0.08, 0],
    ]),
    qTrack('legL', [0, 0.45 * speedScale, 0.9 * speedScale], [
      [stride, 0, 0],
      [-stride, 0, 0],
      [stride, 0, 0],
    ]),
    qTrack('legR', [0, 0.45 * speedScale, 0.9 * speedScale], [
      [-stride, 0, 0],
      [stride, 0, 0],
      [-stride, 0, 0],
    ]),
    qTrack('armL', [0, 0.45 * speedScale, 0.9 * speedScale], [
      [-stride * 0.6, 0, 0.18],
      [stride * 0.6, 0, 0.18],
      [-stride * 0.6, 0, 0.18],
    ]),
    qTrack('armR', [0, 0.45 * speedScale, 0.9 * speedScale], [
      [stride * 0.6, 0, -0.18],
      [-stride * 0.6, 0, -0.18],
      [stride * 0.6, 0, -0.18],
    ]),
  ]);

  const run = makeClip(`${rigId}_run`, rigId === 'death_knight' ? 'Charging' : 'Running', 0.56 * speedScale, [
    vTrack('pelvis', 'position', [0, 0.14 * speedScale, 0.28 * speedScale, 0.42 * speedScale, 0.56 * speedScale], [
      [0, 0.95, 0],
      [0, 1.14, 0],
      [0, 0.95, 0],
      [0, 1.14, 0],
      [0, 0.95, 0],
    ]),
    qTrack('torso', [0, 0.28 * speedScale, 0.56 * speedScale], [
      [0.24, -0.12, 0],
      [0.24, 0.12, 0],
      [0.24, -0.12, 0],
    ]),
    qTrack('legL', [0, 0.28 * speedScale, 0.56 * speedScale], [
      [1.05, 0, 0],
      [-1.05, 0, 0],
      [1.05, 0, 0],
    ]),
    qTrack('legR', [0, 0.28 * speedScale, 0.56 * speedScale], [
      [-1.05, 0, 0],
      [1.05, 0, 0],
      [-1.05, 0, 0],
    ]),
    qTrack('armL', [0, 0.28 * speedScale, 0.56 * speedScale], [
      [-0.9, 0, 0.22],
      [0.9, 0, 0.22],
      [-0.9, 0, 0.22],
    ]),
    qTrack('armR', [0, 0.28 * speedScale, 0.56 * speedScale], [
      [0.9, 0, -0.22],
      [-0.9, 0, -0.22],
      [0.9, 0, -0.22],
    ]),
  ]);

  const march = makeClip(`${rigId}_march`, 'Marching Formation', 0.8, [
    vTrack('pelvis', 'position', [0, 0.2, 0.4, 0.6, 0.8], [
      [0, 1.0, 0],
      [0, 1.08, 0],
      [0, 1.0, 0],
      [0, 1.08, 0],
      [0, 1.0, 0],
    ]),
    qTrack('torso', [0, 0.4, 0.8], [
      [0.05, 0, 0],
      [0.05, 0, 0],
      [0.05, 0, 0],
    ]),
    qTrack('legL', [0, 0.4, 0.8], [
      [0.85, 0, 0],
      [-0.85, 0, 0],
      [0.85, 0, 0],
    ]),
    qTrack('legR', [0, 0.4, 0.8], [
      [-0.85, 0, 0],
      [0.85, 0, 0],
      [-0.85, 0, 0],
    ]),
    qTrack('armR', [0, 0.4, 0.8], [
      [-0.45, 0, -0.15],
      [-0.35, 0, -0.15],
      [-0.45, 0, -0.15],
    ]),
    qTrack('armL', [0, 0.4, 0.8], [
      [-0.55, 0.25, 0.15],
      [-0.5, 0.25, 0.15],
      [-0.55, 0.25, 0.15],
    ]),
  ]);

  const attack = isArcher
    ? makeClip(
        `${rigId}_attack`,
        'Arrow Shooting',
        0.65,
        [
          qTrack('torso', [0, 0.25, 0.45, 0.65], [
            [0, -0.45, 0],
            [0, -0.55, 0],
            [0, -0.3, 0],
            [0, 0, 0],
          ]),
          qTrack('armL', [0, 0.25, 0.45, 0.65], [
            [-1.35, 0.35, 0],
            [-1.4, 0.4, 0],
            [-1.35, 0.35, 0],
            [0.12, 0, 0.15],
          ]),
          qTrack('armR', [0, 0.25, 0.45, 0.65], [
            [-1.25, -0.1, -0.35],
            [-1.3, -0.45, -0.5],
            [-0.4, 0, -0.25],
            [0.12, 0, -0.15],
          ]),
        ],
        true
      )
    : makeClip(
        `${rigId}_attack`,
        rigId === 'magar_infantry'
          ? 'Khukuri Slash'
          : rigId === 'ogre'
            ? 'Weapon Smash'
            : rigId === 'death_knight'
              ? 'Heavy Sword Strike'
              : 'Weapon Attack',
        0.62 * speedScale,
        [
          qTrack('torso', [0, 0.2 * speedScale, 0.38 * speedScale, 0.62 * speedScale], [
            [0, -0.45, 0],
            [-0.18, -0.55, 0],
            [0.32, 0.52, 0],
            [0, 0, 0],
          ]),
          qTrack('armR', [0, 0.2 * speedScale, 0.38 * speedScale, 0.62 * speedScale], [
            [-0.6, 0, -0.25],
            [-2.35, -0.25, -0.45],
            [0.65, 0.35, -0.12],
            [0.12, 0, -0.15],
          ]),
          qTrack('armL', [0, 0.2 * speedScale, 0.38 * speedScale, 0.62 * speedScale], [
            [-0.4, 0.3, 0.2],
            [-0.85, 0.45, 0.2],
            [-0.3, 0.1, 0.2],
            [0.12, 0, 0.15],
          ]),
        ],
        true
      );

  const block = makeClip(
    `${rigId}_block`,
    rigId === 'magar_infantry' ? 'Wooden Shield Block' : 'Shield / Guard Block',
    0.75,
    [
      vTrack('pelvis', 'position', [0, 0.2, 0.55, 0.75], [
        [0, 1.0, 0],
        [0, 0.88, 0],
        [0, 0.9, 0],
        [0, 1.0, 0],
      ]),
      qTrack('torso', [0, 0.2, 0.55, 0.75], [
        [0.08, 0.25, 0],
        [0.16, 0.42, 0],
        [0.16, 0.42, 0],
        [0.02, 0, 0],
      ]),
      qTrack('armL', [0, 0.2, 0.55, 0.75], [
        [-0.95, 0.55, 0.25],
        [-1.32, 0.95, 0.32],
        [-1.32, 0.95, 0.32],
        [0.12, 0, 0.15],
      ]),
    ],
    true
  );

  const mine = makeClip(`${rigId}_mine`, 'Mining Swing', 0.85, [
    qTrack('torso', [0, 0.3, 0.55, 0.85], [
      [-0.1, 0, 0],
      [-0.35, 0, 0],
      [0.48, 0, 0],
      [-0.1, 0, 0],
    ]),
    qTrack('armR', [0, 0.3, 0.55, 0.85], [
      [-1.2, 0, -0.2],
      [-2.4, 0, -0.1],
      [-0.35, 0, -0.1],
      [-1.2, 0, -0.2],
    ]),
    qTrack('armL', [0, 0.3, 0.55, 0.85], [
      [-1.0, 0.2, 0.2],
      [-2.2, 0.2, 0.1],
      [-0.25, 0.2, 0.1],
      [-1.0, 0.2, 0.2],
    ]),
  ]);

  const gather = makeClip(`${rigId}_gather`, 'Resource Gathering', 0.95, [
    vTrack('pelvis', 'position', [0, 0.45, 0.95], [
      [0, 0.92, 0],
      [0, 0.78, 0],
      [0, 0.92, 0],
    ]),
    qTrack('torso', [0, 0.45, 0.95], [
      [0.35, 0, 0],
      [0.62, 0, 0],
      [0.35, 0, 0],
    ]),
    qTrack('armL', [0, 0.45, 0.95], [
      [-0.85, 0.2, 0.1],
      [-1.15, -0.1, 0.1],
      [-0.85, 0.2, 0.1],
    ]),
    qTrack('armR', [0, 0.45, 0.95], [
      [-0.85, -0.2, -0.1],
      [-1.15, 0.1, -0.1],
      [-0.85, -0.2, -0.1],
    ]),
  ]);

  const rally = makeClip(`${rigId}_rally`, 'Rallying Warcry', 0.9, [
    vTrack('pelvis', 'position', [0, 0.45, 0.9], [
      [0, 1.0, 0],
      [0, 1.12, 0],
      [0, 1.0, 0],
    ]),
    qTrack('armR', [0, 0.45, 0.9], [
      [-2.4, 0, -0.2],
      [-2.75, 0, -0.3],
      [-2.4, 0, -0.2],
    ]),
    qTrack('head', [0, 0.45, 0.9], [
      [-0.2, 0, 0],
      [-0.35, 0, 0],
      [-0.2, 0, 0],
    ]),
  ]);

  const cast = makeClip(
    `${rigId}_cast`,
    rigId === 'limbu_archer'
      ? 'Bow Aiming'
      : rigId === 'ogre'
        ? 'Ground Slam'
        : rigId === 'death_knight'
          ? 'Dark Special Strike'
          : 'Special Cast',
    0.9,
    isArcher
      ? [
          qTrack('torso', [0, 0.45, 0.9], [
            [0, -0.5, 0],
            [0, -0.52, 0],
            [0, -0.5, 0],
          ]),
          qTrack('armL', [0, 0.45, 0.9], [
            [-1.4, 0.45, 0],
            [-1.42, 0.45, 0],
            [-1.4, 0.45, 0],
          ]),
          qTrack('armR', [0, 0.45, 0.9], [
            [-1.3, -0.4, -0.45],
            [-1.32, -0.48, -0.48],
            [-1.3, -0.4, -0.45],
          ]),
        ]
      : [
          vTrack('pelvis', 'position', [0, 0.3, 0.55, 0.9], [
            [0, 1.0, 0],
            [0, 1.42, 0],
            [0, 0.85, 0],
            [0, 1.0, 0],
          ]),
          qTrack('armL', [0, 0.3, 0.55, 0.9], [
            [-0.4, 0, 0.2],
            [-2.6, 0, 0.25],
            [0.45, 0, 0.15],
            [0.12, 0, 0.15],
          ]),
          qTrack('armR', [0, 0.3, 0.55, 0.9], [
            [-0.4, 0, -0.2],
            [-2.6, 0, -0.25],
            [0.45, 0, -0.15],
            [0.12, 0, -0.15],
          ]),
        ],
    true
  );

  const damage = makeClip(
    `${rigId}_damage`,
    'Injured Reaction',
    0.45,
    [
      qTrack('torso', [0, 0.15, 0.45], [
        [0, 0, 0],
        [-0.38, 0.18, -0.12],
        [0, 0, 0],
      ]),
      qTrack('head', [0, 0.15, 0.45], [
        [0, 0, 0],
        [-0.35, -0.2, 0],
        [0, 0, 0],
      ]),
    ],
    true
  );

  const heal = makeClip(
    `${rigId}_heal`,
    isArcher ? 'Reloading Arrow' : 'Heal / Recover',
    0.75,
    isArcher
      ? [
          qTrack('armR', [0, 0.25, 0.5, 0.75], [
            [0.1, 0, -0.15],
            [-2.2, -0.45, 0.35],
            [-1.1, 0.1, -0.2],
            [0.1, 0, -0.15],
          ]),
          qTrack('torso', [0, 0.35, 0.75], [
            [0, 0, 0],
            [0.08, -0.2, 0],
            [0, 0, 0],
          ]),
        ]
      : [
          vTrack('pelvis', 'position', [0, 0.38, 0.75], [
            [0, 1.0, 0],
            [0, 1.15, 0],
            [0, 1.0, 0],
          ]),
          qTrack('armL', [0, 0.38, 0.75], [
            [-0.4, 0, 0.2],
            [-1.6, 0, 0.45],
            [-0.4, 0, 0.2],
          ]),
          qTrack('armR', [0, 0.38, 0.75], [
            [-0.4, 0, -0.2],
            [-1.6, 0, -0.45],
            [-0.4, 0, -0.2],
          ]),
        ],
    true
  );

  const victory = makeClip(
    `${rigId}_victory`,
    'Victory Cheer',
    1.1,
    [
      vTrack('pelvis', 'position', [0, 0.3, 0.6, 0.85, 1.1], [
        [0, 1.0, 0],
        [0, 1.32, 0],
        [0, 1.0, 0],
        [0, 1.24, 0],
        [0, 1.0, 0],
      ]),
      qTrack('armR', [0, 0.3, 0.6, 1.1], [
        [-2.5, 0, -0.35],
        [-2.8, 0, -0.5],
        [-2.4, 0, -0.3],
        [-2.6, 0, -0.4],
      ]),
      qTrack('armL', [0, 0.3, 0.6, 1.1], [
        [-2.2, 0, 0.35],
        [-2.5, 0, 0.45],
        [-2.1, 0, 0.3],
        [-2.3, 0, 0.38],
      ]),
    ],
    true
  );

  const death = makeClip(
    `${rigId}_death`,
    'Death Collapse',
    0.85,
    [
      vTrack('pelvis', 'position', [0, 0.35, 0.85], [
        [0, 1.0, 0],
        [0, 0.65, -0.2],
        [0, 0.25, -0.55],
      ]),
      qTrack('pelvis', [0, 0.35, 0.85], [
        [0, 0, 0],
        [-0.75, 0, 0.12],
        [-1.48, 0, 0.2],
      ]),
      qTrack('armL', [0, 0.85], [
        [0.12, 0, 0.15],
        [-0.6, 0, 0.8],
      ]),
      qTrack('armR', [0, 0.85], [
        [0.12, 0, -0.15],
        [-0.6, 0, -0.8],
      ]),
    ],
    true,
    true
  );

  const clips: Partial<Record<AnimationState, ClipCatalogEntry>> = {
    IDLE: idle,
    WALK: walk,
    RUN: run,
    MARCH: march,
    ATTACK: attack,
    BLOCK: block,
    MINE: mine,
    GATHER: gather,
    RALLY: rally,
    CAST: cast,
    DAMAGE: damage,
    HEAL: heal,
    VICTORY: victory,
    DEATH: death,
  };

  const customClips: Record<string, ClipCatalogEntry> = {};
  if (rigId === 'magar_infantry') {
    customClips.STANDING_GUARD = makeClip('magar_guard', 'Standing Guard', 2.0, [
      qTrack('torso', [0, 1.0, 2.0], [
        [0, 0.12, 0],
        [0, -0.12, 0],
        [0, 0.12, 0],
      ]),
      qTrack('armL', [0, 1.0, 2.0], [
        [-0.7, 0.4, 0.2],
        [-0.72, 0.4, 0.2],
        [-0.7, 0.4, 0.2],
      ]),
      qTrack('armR', [0, 1.0, 2.0], [
        [-0.55, 0, -0.15],
        [-0.58, 0, -0.15],
        [-0.55, 0, -0.15],
      ]),
    ]);
    customClips.RETURN_MARCH = makeClip('magar_return', 'Returning March', 0.85, [
      vTrack('pelvis', 'position', [0, 0.21, 0.42, 0.64, 0.85], [
        [0, 1.0, 0],
        [0, 1.06, 0],
        [0, 1.0, 0],
        [0, 1.06, 0],
        [0, 1.0, 0],
      ]),
      qTrack('legL', [0, 0.425, 0.85], [
        [0.7, 0, 0],
        [-0.7, 0, 0],
        [0.7, 0, 0],
      ]),
      qTrack('legR', [0, 0.425, 0.85], [
        [-0.7, 0, 0],
        [0.7, 0, 0],
        [-0.7, 0, 0],
      ]),
      qTrack('armR', [0, 0.425, 0.85], [
        [0.2, 0, -0.2],
        [-0.2, 0, -0.2],
        [0.2, 0, -0.2],
      ]),
    ]);
  }
  if (rigId === 'limbu_archer') {
    customClips.BOW_AIM = cast;
    customClips.RELOAD_ARROW = heal;
  }

  const out = { clips, customClips };
  CLIP_CACHE.set(cacheKey, out);
  return out;
}

function buildCavalryClips(): {
  clips: Partial<Record<AnimationState, ClipCatalogEntry>>;
  customClips: Record<string, ClipCatalogEntry>;
} {
  const cacheKey = 'cavalry:thakuri';
  const cached = CLIP_CACHE.get(cacheKey);
  if (cached) return cached;

  const idle = makeClip('cav_idle', 'Horse Idle', 1.9, [
    vTrack('horseBody', 'position', [0, 0.95, 1.9], [
      [0, 1.05, 0],
      [0, 1.09, 0],
      [0, 1.05, 0],
    ]),
    qTrack('horseHead', [0, 0.95, 1.9], [
      [0.2, 0, 0],
      [0.32, 0.08, 0],
      [0.2, 0, 0],
    ]),
    qTrack('riderTorso', [0, 0.95, 1.9], [
      [0.04, 0, 0],
      [-0.02, 0, 0],
      [0.04, 0, 0],
    ]),
  ]);

  const walk = makeClip('cav_walk', 'Horse Walking', 0.9, [
    vTrack('horseBody', 'position', [0, 0.22, 0.45, 0.68, 0.9], [
      [0, 1.05, 0],
      [0, 1.11, 0],
      [0, 1.05, 0],
      [0, 1.11, 0],
      [0, 1.05, 0],
    ]),
    qTrack('horseLegFL', [0, 0.45, 0.9], [[0.55, 0, 0], [-0.55, 0, 0], [0.55, 0, 0]]),
    qTrack('horseLegFR', [0, 0.45, 0.9], [[-0.55, 0, 0], [0.55, 0, 0], [-0.55, 0, 0]]),
    qTrack('horseLegBL', [0, 0.45, 0.9], [[-0.55, 0, 0], [0.55, 0, 0], [-0.55, 0, 0]]),
    qTrack('horseLegBR', [0, 0.45, 0.9], [[0.55, 0, 0], [-0.55, 0, 0], [0.55, 0, 0]]),
  ]);

  const run = makeClip('cav_run', 'Horse Running', 0.55, [
    vTrack('horseBody', 'position', [0, 0.14, 0.28, 0.42, 0.55], [
      [0, 1.02, 0],
      [0, 1.24, 0],
      [0, 1.0, 0],
      [0, 1.2, 0],
      [0, 1.02, 0],
    ]),
    qTrack('horseBody', [0, 0.28, 0.55], [
      [-0.12, 0, 0],
      [0.12, 0, 0],
      [-0.12, 0, 0],
    ]),
    qTrack('horseLegFL', [0, 0.28, 0.55], [[0.95, 0, 0], [-0.85, 0, 0], [0.95, 0, 0]]),
    qTrack('horseLegFR', [0, 0.28, 0.55], [[0.75, 0, 0], [-0.95, 0, 0], [0.75, 0, 0]]),
    qTrack('horseLegBL', [0, 0.28, 0.55], [[-0.95, 0, 0], [0.85, 0, 0], [-0.95, 0, 0]]),
    qTrack('horseLegBR', [0, 0.28, 0.55], [[-0.75, 0, 0], [0.95, 0, 0], [-0.75, 0, 0]]),
  ]);

  const gallop = makeClip('cav_gallop', 'Horse Galloping', 0.42, [
    vTrack('horseBody', 'position', [0, 0.21, 0.42], [
      [0, 0.98, 0],
      [0, 1.32, 0],
      [0, 0.98, 0],
    ]),
    qTrack('horseBody', [0, 0.21, 0.42], [
      [-0.18, 0, 0],
      [0.18, 0, 0],
      [-0.18, 0, 0],
    ]),
    qTrack('horseLegFL', [0, 0.21, 0.42], [[1.15, 0, 0], [-1.05, 0, 0], [1.15, 0, 0]]),
    qTrack('horseLegFR', [0, 0.21, 0.42], [[1.05, 0, 0], [-1.15, 0, 0], [1.05, 0, 0]]),
    qTrack('horseLegBL', [0, 0.21, 0.42], [[-1.15, 0, 0], [1.05, 0, 0], [-1.15, 0, 0]]),
    qTrack('horseLegBR', [0, 0.21, 0.42], [[-1.05, 0, 0], [1.15, 0, 0], [-1.05, 0, 0]]),
  ]);

  const march = makeClip('cav_march', 'Cavalry Marching', 0.72, [
    vTrack('horseBody', 'position', [0, 0.36, 0.72], [
      [0, 1.05, 0],
      [0, 1.15, 0],
      [0, 1.05, 0],
    ]),
    qTrack('horseLegFL', [0, 0.36, 0.72], [[0.7, 0, 0], [-0.7, 0, 0], [0.7, 0, 0]]),
    qTrack('horseLegFR', [0, 0.36, 0.72], [[-0.7, 0, 0], [0.7, 0, 0], [-0.7, 0, 0]]),
    qTrack('horseLegBL', [0, 0.36, 0.72], [[-0.7, 0, 0], [0.7, 0, 0], [-0.7, 0, 0]]),
    qTrack('horseLegBR', [0, 0.36, 0.72], [[0.7, 0, 0], [-0.7, 0, 0], [0.7, 0, 0]]),
    qTrack('riderArmR', [0, 0.36, 0.72], [[-1.1, 0, -0.1], [-1.05, 0, -0.1], [-1.1, 0, -0.1]]),
  ]);

  const attack = makeClip(
    'cav_attack',
    'Mounted Weapon Attack',
    0.62,
    [
      qTrack('riderTorso', [0, 0.22, 0.42, 0.62], [
        [0, -0.4, 0],
        [0.15, -0.5, 0],
        [0.25, 0.55, 0],
        [0, 0, 0],
      ]),
      qTrack('riderArmR', [0, 0.22, 0.42, 0.62], [
        [-0.8, 0, -0.2],
        [-2.2, 0, -0.35],
        [0.45, 0.2, -0.1],
        [-0.6, 0, -0.15],
      ]),
    ],
    true
  );

  const charge = makeClip(
    'cav_charge',
    'Charging Attack',
    0.75,
    [
      vTrack('horseBody', 'position', [0, 0.25, 0.55, 0.75], [
        [0, 1.05, 0],
        [0, 1.28, 0.35],
        [0, 1.08, 0.5],
        [0, 1.05, 0],
      ]),
      qTrack('riderTorso', [0, 0.35, 0.75], [
        [0.32, 0, 0],
        [0.38, 0, 0],
        [0.05, 0, 0],
      ]),
      qTrack('riderArmR', [0, 0.35, 0.75], [
        [-1.45, 0, -0.1],
        [-1.55, 0, -0.05],
        [-0.6, 0, -0.15],
      ]),
    ],
    true
  );

  const turn = makeClip(
    'cav_turn',
    'Horse Turning',
    0.65,
    [
      qTrack('horseBody', [0, 0.32, 0.65], [
        [0, 0, 0],
        [0, 0.52, -0.22],
        [0, 0, 0],
      ]),
      qTrack('horseHead', [0, 0.32, 0.65], [
        [0.2, 0, 0],
        [0.2, 0.6, -0.18],
        [0.2, 0, 0],
      ]),
    ],
    true
  );

  const stop = makeClip(
    'cav_stop',
    'Horse Stopping / Rear',
    0.7,
    [
      qTrack('horseBody', [0, 0.3, 0.7], [
        [0, 0, 0],
        [-0.45, 0, 0],
        [0, 0, 0],
      ]),
      qTrack('horseLegFL', [0, 0.3, 0.7], [
        [0, 0, 0],
        [-0.75, 0, 0],
        [0, 0, 0],
      ]),
      qTrack('horseLegFR', [0, 0.3, 0.7], [
        [0, 0, 0],
        [-0.75, 0, 0],
        [0, 0, 0],
      ]),
    ],
    true
  );

  const victory = makeClip(
    'cav_victory',
    'Cavalry Victory',
    1.0,
    [
      qTrack('horseBody', [0, 0.45, 1.0], [
        [0, 0, 0],
        [-0.38, 0, 0],
        [0, 0, 0],
      ]),
      qTrack('riderArmR', [0, 0.45, 1.0], [
        [-2.5, 0, -0.2],
        [-2.8, 0, -0.3],
        [-2.4, 0, -0.2],
      ]),
    ],
    true
  );

  const damage = makeClip(
    'cav_damage',
    'Cavalry Injured',
    0.45,
    [
      qTrack('riderTorso', [0, 0.2, 0.45], [
        [0, 0, 0],
        [-0.35, 0, -0.15],
        [0, 0, 0],
      ]),
    ],
    true
  );

  const death = makeClip(
    'cav_death',
    'Cavalry Death',
    0.9,
    [
      vTrack('horseBody', 'position', [0, 0.45, 0.9], [
        [0, 1.05, 0],
        [0, 0.65, 0],
        [0, 0.32, 0],
      ]),
      qTrack('horseBody', [0, 0.45, 0.9], [
        [0, 0, 0],
        [0, 0, 0.85],
        [0, 0, 1.48],
      ]),
    ],
    true,
    true
  );

  const out = {
    clips: {
      IDLE: idle,
      WALK: walk,
      RUN: run,
      MARCH: march,
      RALLY: gallop,
      ATTACK: attack,
      CAST: charge,
      BLOCK: turn,
      GATHER: stop,
      MINE: stop,
      HEAL: idle,
      VICTORY: victory,
      DAMAGE: damage,
      DEATH: death,
    },
    customClips: {
      HORSE_GALLOP: gallop,
      CHARGING_ATTACK: charge,
      HORSE_TURNING: turn,
      HORSE_STOPPING: stop,
    },
  };
  CLIP_CACHE.set(cacheKey, out);
  return out;
}

function buildSlimeClips() {
  const cacheKey = 'monster:slime';
  const cached = CLIP_CACHE.get(cacheKey);
  if (cached) return cached;

  const idle = makeClip('slime_idle', 'Idle Bouncing', 1.1, [
    vTrack('body', 'scale', [0, 0.55, 1.1], [
      [1.06, 0.88, 1.06],
      [0.92, 1.16, 0.92],
      [1.06, 0.88, 1.06],
    ]),
    vTrack('body', 'position', [0, 0.55, 1.1], [
      [0, 0.55, 0],
      [0, 0.78, 0],
      [0, 0.55, 0],
    ]),
  ]);

  const walk = makeClip('slime_walk', 'Slime Hopping Walk', 0.72, [
    vTrack('body', 'position', [0, 0.36, 0.72], [
      [0, 0.55, 0],
      [0, 1.25, 0],
      [0, 0.55, 0],
    ]),
    vTrack('body', 'scale', [0, 0.12, 0.36, 0.72], [
      [1.18, 0.74, 1.18],
      [0.88, 1.24, 0.88],
      [0.95, 1.12, 0.95],
      [1.18, 0.74, 1.18],
    ]),
  ]);

  const attack = makeClip(
    'slime_attack',
    'Jumping Attack',
    0.7,
    [
      vTrack('body', 'position', [0, 0.25, 0.45, 0.7], [
        [0, 0.55, 0],
        [0, 1.85, 0.55],
        [0, 0.45, 0.7],
        [0, 0.55, 0],
      ]),
      vTrack('body', 'scale', [0, 0.25, 0.45, 0.7], [
        [1.2, 0.75, 1.2],
        [0.85, 1.35, 0.85],
        [1.35, 0.65, 1.35],
        [1, 1, 1],
      ]),
    ],
    true
  );

  const damage = makeClip(
    'slime_damage',
    'Slime Damage',
    0.45,
    [
      vTrack('body', 'scale', [0, 0.18, 0.45], [
        [1, 1, 1],
        [1.45, 0.52, 1.45],
        [1, 1, 1],
      ]),
    ],
    true
  );

  const death = makeClip(
    'slime_death',
    'Slime Dissolve Death',
    0.8,
    [
      vTrack('body', 'scale', [0, 0.4, 0.8], [
        [1, 1, 1],
        [1.5, 0.35, 1.5],
        [1.9, 0.04, 1.9],
      ]),
      vTrack('body', 'position', [0, 0.8], [
        [0, 0.55, 0],
        [0, 0.05, 0],
      ]),
    ],
    true,
    true
  );

  const out = {
    clips: {
      IDLE: idle,
      WALK: walk,
      RUN: walk,
      MARCH: walk,
      ATTACK: attack,
      CAST: attack,
      DAMAGE: damage,
      DEATH: death,
      VICTORY: walk,
      BLOCK: damage,
    },
    customClips: {},
  };
  CLIP_CACHE.set(cacheKey, out);
  return out;
}

function buildWolfClips() {
  const cacheKey = 'monster:wolf';
  const cached = CLIP_CACHE.get(cacheKey);
  if (cached) return cached;

  const idle = makeClip('wolf_idle', 'Wolf Idle', 1.4, [
    vTrack('body', 'position', [0, 0.7, 1.4], [
      [0, 0.78, 0],
      [0, 0.82, 0],
      [0, 0.78, 0],
    ]),
    qTrack('head', [0, 0.7, 1.4], [
      [0, 0, 0],
      [0.08, 0.12, 0],
      [0, 0, 0],
    ]),
    qTrack('tail', [0, 0.7, 1.4], [
      [-0.2, 0.25, 0],
      [-0.2, -0.25, 0],
      [-0.2, 0.25, 0],
    ]),
  ]);

  const walk = makeClip('wolf_walk', 'Wolf Walking', 0.75, [
    qTrack('legFL', [0, 0.37, 0.75], [[0.65, 0, 0], [-0.65, 0, 0], [0.65, 0, 0]]),
    qTrack('legFR', [0, 0.37, 0.75], [[-0.65, 0, 0], [0.65, 0, 0], [-0.65, 0, 0]]),
    qTrack('legBL', [0, 0.37, 0.75], [[-0.65, 0, 0], [0.65, 0, 0], [-0.65, 0, 0]]),
    qTrack('legBR', [0, 0.37, 0.75], [[0.65, 0, 0], [-0.65, 0, 0], [0.65, 0, 0]]),
  ]);

  const run = makeClip('wolf_run', 'Wolf Running', 0.45, [
    vTrack('body', 'position', [0, 0.22, 0.45], [
      [0, 0.75, 0],
      [0, 1.05, 0],
      [0, 0.75, 0],
    ]),
    qTrack('legFL', [0, 0.22, 0.45], [[1.1, 0, 0], [-1.0, 0, 0], [1.1, 0, 0]]),
    qTrack('legFR', [0, 0.22, 0.45], [[0.9, 0, 0], [-1.1, 0, 0], [0.9, 0, 0]]),
    qTrack('legBL', [0, 0.22, 0.45], [[-1.1, 0, 0], [1.0, 0, 0], [-1.1, 0, 0]]),
    qTrack('legBR', [0, 0.22, 0.45], [[-0.9, 0, 0], [1.1, 0, 0], [-0.9, 0, 0]]),
  ]);

  const attack = makeClip(
    'wolf_bite',
    'Biting Attack',
    0.52,
    [
      vTrack('body', 'position', [0, 0.2, 0.52], [
        [0, 0.78, 0],
        [0, 0.86, 0.45],
        [0, 0.78, 0],
      ]),
      qTrack('jaw', [0, 0.16, 0.32, 0.52], [
        [0, 0, 0],
        [0.65, 0, 0],
        [-0.05, 0, 0],
        [0, 0, 0],
      ]),
    ],
    true
  );

  const jumpAttack = makeClip(
    'wolf_jump',
    'Jumping Lunge Attack',
    0.68,
    [
      vTrack('body', 'position', [0, 0.28, 0.52, 0.68], [
        [0, 0.78, 0],
        [0, 1.75, 0.6],
        [0, 0.85, 0.75],
        [0, 0.78, 0],
      ]),
      qTrack('body', [0, 0.28, 0.52, 0.68], [
        [0, 0, 0],
        [-0.32, 0, 0],
        [0.25, 0, 0],
        [0, 0, 0],
      ]),
    ],
    true
  );

  const damage = makeClip(
    'wolf_damage',
    'Wolf Damage',
    0.4,
    [qTrack('body', [0, 0.18, 0.4], [[0, 0, 0], [-0.25, 0, 0.2], [0, 0, 0]])],
    true
  );

  const death = makeClip(
    'wolf_death',
    'Wolf Death',
    0.75,
    [
      vTrack('body', 'position', [0, 0.75], [[0, 0.78, 0], [0, 0.25, 0]]),
      qTrack('body', [0, 0.75], [[0, 0, 0], [0, 0, 1.48]]),
    ],
    true,
    true
  );

  const out = {
    clips: {
      IDLE: idle,
      WALK: walk,
      RUN: run,
      MARCH: walk,
      ATTACK: attack,
      CAST: jumpAttack,
      DAMAGE: damage,
      DEATH: death,
      VICTORY: idle,
    },
    customClips: {
      JUMPING_ATTACK: jumpAttack,
    },
  };
  CLIP_CACHE.set(cacheKey, out);
  return out;
}

function buildDragonClips() {
  const cacheKey = 'monster:skeleton_dragon';
  const cached = CLIP_CACHE.get(cacheKey);
  if (cached) return cached;

  const idle = makeClip('dragon_idle', 'Dragon Idle & Wing Flap', 1.6, [
    vTrack('body', 'position', [0, 0.8, 1.6], [
      [0, 1.85, 0],
      [0, 2.05, 0],
      [0, 1.85, 0],
    ]),
    qTrack('wingL', [0, 0.8, 1.6], [[0, 0, 0.25], [0, 0, -0.45], [0, 0, 0.25]]),
    qTrack('wingR', [0, 0.8, 1.6], [[0, 0, -0.25], [0, 0, 0.45], [0, 0, -0.25]]),
    qTrack('tail', [0, 0.8, 1.6], [[0, 0.25, 0], [0, -0.25, 0], [0, 0.25, 0]]),
  ]);

  const fly = makeClip('dragon_fly', 'Flying Flight', 0.9, [
    vTrack('body', 'position', [0, 0.45, 0.9], [
      [0, 3.1, 0],
      [0, 3.75, 0],
      [0, 3.1, 0],
    ]),
    qTrack('wingL', [0, 0.45, 0.9], [[0, 0, 0.65], [0, 0, -0.85], [0, 0, 0.65]]),
    qTrack('wingR', [0, 0.45, 0.9], [[0, 0, -0.65], [0, 0, 0.85], [0, 0, -0.65]]),
  ]);

  const walk = makeClip('dragon_walk', 'Dragon Ground Walk', 1.1, [
    vTrack('body', 'position', [0, 0.55, 1.1], [
      [0, 1.35, 0],
      [0, 1.48, 0],
      [0, 1.35, 0],
    ]),
    qTrack('wingL', [0, 0.55, 1.1], [[0, 0, 0.15], [0, 0, 0.35], [0, 0, 0.15]]),
    qTrack('wingR', [0, 0.55, 1.1], [[0, 0, -0.15], [0, 0, -0.35], [0, 0, -0.15]]),
  ]);

  const fireBreath = makeClip(
    'dragon_breath',
    'Fire Breath Attack',
    1.1,
    [
      qTrack('head', [0, 0.3, 0.8, 1.1], [
        [0, 0, 0],
        [-0.35, 0, 0],
        [0.25, 0.25, 0],
        [0, 0, 0],
      ]),
      qTrack('jaw', [0, 0.3, 0.8, 1.1], [
        [0, 0, 0],
        [0.65, 0, 0],
        [0.65, 0, 0],
        [0, 0, 0],
      ]),
      qTrack('wingL', [0, 0.3, 0.8, 1.1], [[0, 0, 0.2], [0, 0, 0.7], [0, 0, 0.4], [0, 0, 0.2]]),
      qTrack('wingR', [0, 0.3, 0.8, 1.1], [[0, 0, -0.2], [0, 0, -0.7], [0, 0, -0.4], [0, 0, -0.2]]),
    ],
    true
  );

  const landing = makeClip(
    'dragon_land',
    'Dragon Landing',
    0.85,
    [
      vTrack('body', 'position', [0, 0.5, 0.85], [
        [0, 3.4, 0],
        [0, 1.65, 0],
        [0, 1.35, 0],
      ]),
      qTrack('wingL', [0, 0.5, 0.85], [[0, 0, 0.8], [0, 0, -0.3], [0, 0, 0.2]]),
      qTrack('wingR', [0, 0.5, 0.85], [[0, 0, -0.8], [0, 0, 0.3], [0, 0, -0.2]]),
    ],
    true
  );

  const damage = makeClip(
    'dragon_damage',
    'Dragon Damage',
    0.5,
    [qTrack('body', [0, 0.2, 0.5], [[0, 0, 0], [-0.3, 0.2, 0], [0, 0, 0]])],
    true
  );

  const death = makeClip(
    'dragon_death',
    'Dragon Death Collapse',
    1.1,
    [
      vTrack('body', 'position', [0, 0.5, 1.1], [
        [0, 1.85, 0],
        [0, 0.8, 0],
        [0, 0.45, 0],
      ]),
      qTrack('body', [0, 1.1], [[0, 0, 0], [0.2, 0, 1.4]]),
    ],
    true,
    true
  );

  const out = {
    clips: {
      IDLE: idle,
      WALK: walk,
      MARCH: walk,
      RUN: fly,
      ATTACK: fireBreath,
      CAST: fireBreath,
      BLOCK: landing,
      DAMAGE: damage,
      DEATH: death,
      VICTORY: fly,
    },
    customClips: {
      WING_MOVEMENT: idle,
      FLYING: fly,
      FIRE_BREATH: fireBreath,
      LANDING: landing,
    },
  };
  CLIP_CACHE.set(cacheKey, out);
  return out;
}

function makeJoint(name: string, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
}

function createHumanoidProceduralRig(rigId: TroopRigId | 'orc' | 'goblin' | 'skeleton_knight' | 'ogre' | 'death_knight'): {
  root: THREE.Group;
  displayName: string;
  element: BuiltUnitRig['element'];
  level: number;
} {
  const root = new THREE.Group();
  root.userData.isPlaceholderProceduralRig = true;

  const isOgre = rigId === 'ogre';
  const isDK = rigId === 'death_knight';
  const isSkel = rigId === 'skeleton_knight';
  const isOrc = rigId === 'orc';
  const isGoblin = rigId === 'goblin';

  const bodyScale = isOgre ? 1.55 : isDK ? 1.45 : isGoblin ? 0.78 : 1.0;
  root.scale.setScalar(bodyScale);

  const armorColor =
    rigId === 'magar_infantry'
      ? 0xb91c1c
      : rigId === 'limbu_archer'
        ? 0x15803d
        : isOrc
          ? 0x4d7c0f
          : isGoblin
            ? 0x84cc16
            : isSkel
              ? 0xe2e8f0
              : isOgre
                ? 0xb45309
                : isDK
                  ? 0x4c1d95
                  : 0x38bdf8;
  const skinColor = isOrc
    ? 0x65a30d
    : isGoblin
      ? 0xa3e635
      : isSkel
        ? 0xf1f5f9
        : isOgre
          ? 0xd97706
          : isDK
            ? 0x334155
            : 0xe7c6a5;
  const weaponColor = isOrc || isGoblin ? 0x78350f : isDK ? 0xa855f7 : 0xe2e8f0;

  const armorMat = new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.42, metalness: 0.45 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.72, metalness: 0.08 });
  const metalMat = new THREE.MeshStandardMaterial({ color: weaponColor, roughness: 0.25, metalness: 0.85 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.86, metalness: 0.05 });

  // Ground contact shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.68, 16),
    new THREE.MeshBasicMaterial({ color: 0x04070f, transparent: true, opacity: 0.42, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  const pelvis = makeJoint('pelvis', 0, 1.0, 0);
  root.add(pelvis);

  const torso = makeJoint('torso', 0, 0.1, 0);
  pelvis.add(torso);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), armorMat);
  chest.position.y = 0.36;
  chest.castShadow = true;
  torso.add(chest);

  // Shoulder pauldrons
  const pauldronGeo = new THREE.SphereGeometry(0.18, 8, 8);
  const pL = new THREE.Mesh(pauldronGeo, metalMat);
  pL.position.set(0.38, 0.65, 0);
  const pR = new THREE.Mesh(pauldronGeo, metalMat);
  pR.position.set(-0.38, 0.65, 0);
  torso.add(pL, pR);

  // Head + Helm/Crest
  const head = makeJoint('head', 0, 0.78, 0);
  torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skinMat);
  skull.position.y = 0.18;
  skull.castShadow = true;
  head.add(skull);

  if (rigId === 'magar_infantry' || isDK || isSkel) {
    const helm = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.26, 8), metalMat);
    helm.position.y = 0.36;
    head.add(helm);
  } else if (rigId === 'limbu_archer') {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.32, 7), armorMat);
    hood.position.set(0, 0.34, -0.04);
    hood.rotation.x = -0.2;
    head.add(hood);
  }

  // Left & Right Arms
  const armL = makeJoint('armL', 0.4, 0.62, 0);
  const armR = makeJoint('armR', -0.4, 0.62, 0);
  torso.add(armL, armR);
  const armGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.56, 7);
  armGeo.translate(0, -0.26, 0);
  armL.add(new THREE.Mesh(armGeo, skinMat));
  armR.add(new THREE.Mesh(armGeo, skinMat));

  // Weapon & Shield attachments
  if (rigId === 'limbu_archer') {
    // Bow on left hand, quiver on back
    const bowArc = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 6, 14, Math.PI), woodMat);
    bowArc.rotation.z = -Math.PI / 2;
    bowArc.rotation.y = Math.PI / 2;
    bowArc.position.set(0, -0.48, 0.18);
    armL.add(bowArc);
    const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.55, 6), woodMat);
    quiver.position.set(-0.12, 0.45, -0.24);
    quiver.rotation.z = -0.35;
    torso.add(quiver);
  } else {
    // Melee weapon on right hand (Khukuri / Sword / Club)
    const bladeLen = isDK || isOgre ? 1.1 : 0.72;
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, bladeLen, 0.14),
      rigId === 'orc' || isOgre ? woodMat : metalMat
    );
    blade.position.set(0, -0.52, bladeLen * 0.42);
    blade.rotation.x = Math.PI * 0.42;
    armR.add(blade);

    if (rigId === 'magar_infantry' || isSkel || isOrc) {
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 10), woodMat);
      shield.rotation.z = Math.PI / 2;
      shield.position.set(0.12, -0.42, 0.14);
      armL.add(shield);
    }
  }

  // Legs
  const legL = makeJoint('legL', 0.17, 0, 0);
  const legR = makeJoint('legR', -0.17, 0, 0);
  pelvis.add(legL, legR);
  const legGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.9, 7);
  legGeo.translate(0, -0.45, 0);
  legL.add(new THREE.Mesh(legGeo, armorMat));
  legR.add(new THREE.Mesh(legGeo, armorMat));

  const names: Record<string, string> = {
    magar_infantry: 'Magar Infantry Warrior (Procedural Rig)',
    limbu_archer: 'Limbu Archer Warrior (Procedural Rig)',
    orc: 'Orc Raider (Procedural Rig)',
    goblin: 'Goblin Sneak (Procedural Rig)',
    skeleton_knight: 'Skeleton Knight (Procedural Rig)',
    ogre: 'Ogre Crusher (Procedural Rig)',
    death_knight: 'Death Knight (Procedural Rig)',
  };

  const element: BuiltUnitRig['element'] =
    isDK ? 'shadow' : isSkel ? 'frost' : isOrc || isGoblin ? 'poison' : 'physical';
  const level = isDK ? 8 : isOgre ? 6 : isSkel ? 4 : isOrc || isGoblin ? 2 : 3;

  return { root, displayName: names[rigId] ?? rigId, element, level };
}

function createCavalryRig(): { root: THREE.Group; displayName: string } {
  const root = new THREE.Group();
  root.userData.isPlaceholderProceduralRig = true;

  const horseMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.68 });
  const maneMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35, metalness: 0.65 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.25, metalness: 0.85 });

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 16),
    new THREE.MeshBasicMaterial({ color: 0x04070f, transparent: true, opacity: 0.42, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  const horseBody = makeJoint('horseBody', 0, 1.05, 0);
  root.add(horseBody);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.62, 1.65), horseMat);
  barrel.castShadow = true;
  horseBody.add(barrel);

  const horseHead = makeJoint('horseHead', 0, 0.45, 0.78);
  horseBody.add(horseHead);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.68, 0.35), horseMat);
  neck.position.set(0, 0.2, 0.08);
  neck.rotation.x = 0.45;
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.52), horseMat);
  snout.position.set(0, 0.46, 0.32);
  snout.rotation.x = 0.25;
  horseHead.add(neck, snout);

  const legGeo = new THREE.CylinderGeometry(0.09, 0.07, 0.98, 6);
  legGeo.translate(0, -0.49, 0);
  const legPositions: Array<[string, number, number]> = [
    ['horseLegFL', 0.24, 0.62],
    ['horseLegFR', -0.24, 0.62],
    ['horseLegBL', 0.24, -0.62],
    ['horseLegBR', -0.24, -0.62],
  ];
  for (const [n, lx, lz] of legPositions) {
    const j = makeJoint(n, lx, -0.1, lz);
    j.add(new THREE.Mesh(legGeo, maneMat));
    horseBody.add(j);
  }

  // Rider mounted on horseBody
  const riderTorso = makeJoint('riderTorso', 0, 0.48, -0.05);
  horseBody.add(riderTorso);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.65, 0.34), armorMat);
  chest.position.y = 0.35;
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), steelMat);
  helm.position.y = 0.85;
  riderTorso.add(chest, helm);

  const riderArmR = makeJoint('riderArmR', -0.36, 0.56, 0.08);
  riderTorso.add(riderArmR);
  const lance = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.85, 6), steelMat);
  lance.rotation.x = Math.PI * 0.46;
  lance.position.set(0, -0.2, 0.68);
  riderArmR.add(lance);

  return { root, displayName: 'Thakuri Horse Cavalry (Procedural Rig)' };
}

function createSlimeRig(): THREE.Group {
  const root = new THREE.Group();
  root.userData.isPlaceholderProceduralRig = true;

  const slimeMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x15803d,
    emissiveIntensity: 0.35,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.88,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

  const body = makeJoint('body', 0, 0.55, 0);
  root.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 12), slimeMat);
  dome.scale.set(1.15, 0.85, 1.15);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: 0xa3e635 }));
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyeMat);
  eyeL.position.set(0.22, 0.12, 0.6);
  const eyeR = eyeL.clone();
  eyeR.position.x = -0.22;
  body.add(dome, core, eyeL, eyeR);

  return root;
}

function createWolfRig(): THREE.Group {
  const root = new THREE.Group();
  root.userData.isPlaceholderProceduralRig = true;

  const furMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });

  const body = makeJoint('body', 0, 0.78, 0);
  root.add(body);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.45, 1.25), furMat);
  body.add(torso);

  const head = makeJoint('head', 0, 0.25, 0.68);
  body.add(head);
  head.add(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.42), furMat));

  const jaw = makeJoint('jaw', 0, -0.08, 0.12);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.34), darkMat);
  lower.position.z = 0.12;
  jaw.add(lower);
  head.add(jaw);

  const tail = makeJoint('tail', 0, 0.12, -0.62);
  const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 6), darkMat);
  tailMesh.rotation.x = -Math.PI * 0.4;
  tailMesh.position.z = -0.22;
  tail.add(tailMesh);
  body.add(tail);

  const legGeo = new THREE.CylinderGeometry(0.07, 0.05, 0.65, 6);
  legGeo.translate(0, -0.32, 0);
  for (const [n, x, z] of [
    ['legFL', 0.18, 0.45],
    ['legFR', -0.18, 0.45],
    ['legBL', 0.18, -0.45],
    ['legBR', -0.18, -0.45],
  ] as const) {
    const leg = makeJoint(n, x, -0.12, z);
    leg.add(new THREE.Mesh(legGeo, furMat));
    body.add(leg);
  }

  return root;
}

function createSkeletonDragonRig(): THREE.Group {
  const root = new THREE.Group();
  root.userData.isPlaceholderProceduralRig = true;

  const boneMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45, metalness: 0.2 });
  const wingMembraneMat = new THREE.MeshStandardMaterial({
    color: 0x881337,
    roughness: 0.6,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const fireEyeMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });

  const body = makeJoint('body', 0, 1.85, 0);
  root.add(body);
  const ribcage = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.72, 1.85), boneMat);
  ribcage.castShadow = true;
  body.add(ribcage);

  const head = makeJoint('head', 0, 0.55, 1.12);
  body.add(head);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.36, 0.78), boneMat);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), fireEyeMat);
  eyeL.position.set(0.18, 0.08, 0.25);
  const eyeR = eyeL.clone();
  eyeR.position.x = -0.18;
  head.add(skull, eyeL, eyeR);

  const jaw = makeJoint('jaw', 0, -0.15, 0.1);
  const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.62), boneMat);
  jawMesh.position.z = 0.24;
  jaw.add(jawMesh);
  head.add(jaw);

  const wingL = makeJoint('wingL', 0.42, 0.28, 0.2);
  const wingR = makeJoint('wingR', -0.42, 0.28, 0.2);
  const wingLGeo = new THREE.BoxGeometry(2.1, 0.08, 1.15);
  wingLGeo.translate(1.05, 0, 0);
  const wingRGeo = new THREE.BoxGeometry(2.1, 0.08, 1.15);
  wingRGeo.translate(-1.05, 0, 0);
  wingL.add(new THREE.Mesh(wingLGeo, wingMembraneMat));
  wingR.add(new THREE.Mesh(wingRGeo, wingMembraneMat));
  body.add(wingL, wingR);

  const tail = makeJoint('tail', 0, 0.05, -0.95);
  const tailGeo = new THREE.ConeGeometry(0.24, 1.65, 6);
  tailGeo.rotateX(-Math.PI / 2);
  tailGeo.translate(0, 0, -0.82);
  tail.add(new THREE.Mesh(tailGeo, boneMat));
  body.add(tail);

  return root;
}

export function createProceduralUnitRig(rigId: UnitRigId): BuiltUnitRig {
  if (rigId === 'thakuri_cavalry') {
    const { root, displayName } = createCavalryRig();
    const { clips, customClips } = buildCavalryClips();
    return {
      rigId,
      displayName,
      isPlaceholderProcedural: true,
      rootGroup: root,
      controller: new AnimationController(displayName, root, clips, customClips),
      element: 'physical',
      level: 4,
    };
  }

  if (rigId === 'slime') {
    const root = createSlimeRig();
    const { clips, customClips } = buildSlimeClips();
    const displayName = 'Slime (Procedural Rig)';
    return {
      rigId,
      displayName,
      isPlaceholderProcedural: true,
      rootGroup: root,
      controller: new AnimationController(displayName, root, clips, customClips),
      element: 'poison',
      level: 1,
    };
  }

  if (rigId === 'wolf') {
    const root = createWolfRig();
    const { clips, customClips } = buildWolfClips();
    const displayName = 'Wolf (Procedural Rig)';
    return {
      rigId,
      displayName,
      isPlaceholderProcedural: true,
      rootGroup: root,
      controller: new AnimationController(displayName, root, clips, customClips),
      element: 'physical',
      level: 3,
    };
  }

  if (rigId === 'skeleton_dragon') {
    const root = createSkeletonDragonRig();
    const { clips, customClips } = buildDragonClips();
    const displayName = 'Skeleton Dragon (Procedural Rig)';
    return {
      rigId,
      displayName,
      isPlaceholderProcedural: true,
      rootGroup: root,
      controller: new AnimationController(displayName, root, clips, customClips),
      element: 'fire',
      level: 10,
    };
  }

  const { root, displayName, element, level } = createHumanoidProceduralRig(rigId);
  const { clips, customClips } = buildHumanoidClips(rigId);
  return {
    rigId,
    displayName,
    isPlaceholderProcedural: true,
    rootGroup: root,
    controller: new AnimationController(displayName, root, clips, customClips),
    element,
    level,
  };
}
