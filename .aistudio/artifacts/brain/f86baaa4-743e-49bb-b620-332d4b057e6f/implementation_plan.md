# Real-Time March Combat Sync, Dual-Tab Tactical Chat & World Search Radar

Align real-time troop arrival with monster impact (white flash blink, damage, and zero-HP smoke dissolution), introduce a bottom-left collapsible World & Alliance chat dock, and add a floating compass search radar for locating resource nodes (Wood, Farm, Gold, Stone/Crystal) and monsters (Bear, Rabbit, Wolf, Tree Monster) across Levels 1–5.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following technical and UX decisions have been confirmed via interactive clarification:
> - **Resource & Monster Search**: Floating compass search bar positioned at the top-center / upper-left with quick filters for category, entity type, and levels 1–5, smoothly panning the 3D camera and highlighting the matched target.
> - **World & Alliance Chat**: Pinned to the bottom-left as a translucent tactical dock with an effortless collapse/expand toggle, active message feed, sender badges, timestamps, and input bar.
> - **Combat Synchronization**: Decoupled from synthetic `setTimeout` delays in `App.tsx`; damage ticks, white flash flinches, floating combat text, and smoke vaporization trigger dynamically in real time when the marching troop brigade physically reaches within strike range ($\le 3.0$ units) of the monster on the 3D battlefield.

---

## 1. Overview & Core Concept

1. **Real-Time March & Strike Mechanics**:
   - The vanguard troop detachment marches across the Himalayan terrain toward the designated target monster.
   - Upon arriving in melee range ($\le 3.0$ units), the army executes weapon swings.
   - Each strike in real time triggers the monster's white emissive flash blink, flinch animation, floating damage numbers, and HP depletion.
   - When the monster reaches zero HP from the real-time blows, it bursts into radiant white light and vaporizes into 36 volumetric 3D smoke puffs drifting into the mountain air, after which the victorious vanguard returns to base.

2. **Unified World & Alliance Chat System**:
   - A bottom-left glassmorphic tactical communication dock with dual segmented tabs: **World** (global realm announcements, player banter, skirmish notices) and **Alliance** (tactical orders, resource requests, reinforcement alerts).
   - Expandable and collapsible to respect the 100% clear viewport standard.
   - Live interactive message posting with timestamps, player titles, and clean unboxed metadata.

3. **Floating Compass Search Radar**:
   - Floating search interface anchored with a compass insignia allowing commanders to find any node on the kingdom map.
   - **Monsters**: Bear, Rabbit, Wolf, Tree Monster across Levels 1, 2, 3, 4, 5 with distinct 3D visual models and procedural textures.
   - **Resources**: Wood (Forestry), Farm (Terrace Meadows), Gold (Sacred Seam), Stone/Crystal (Granite & Himalayan Quartz) across Levels 1, 2, 3, 4, 5.
   - Selecting or searching immediately calculates distance, smoothly pans the 3D camera to center the entity, and triggers a pulsing beacon ring.

---

## 2. User Experience & Visual Design

### Visual Identity & Theme
- **Color Palette**: Dark Himalayan obsidian (`#0b1219`), frosted glass (`rgba(15, 23, 42, 0.85)`), aged bronze borders (`rgba(223, 186, 110, 0.35)`), Tibetan gold accents (`#dfba6e`), crisp ivory typography (`#f8fafc`).
- **Typography**: `Plus Jakarta Sans` for tactical HUDs and chat prose, paired with tabular numerals (`font-mono tabular-nums`) for coordinates, levels, and damage counters.
- **Layout Rhythm**: Unobstructed central 3D battlefield. Chat anchored to bottom-left with compact minimize posture (`h-9` collapsed, `h-64` expanded). Floating search radar sits cleanly beneath topbar with popover filter dropdowns.

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Topbar: Resources & Coordinates]  [🔍 Floating Compass Search Radar]  │
│                                                                        │
│                          3D BATTLEFIELD                                │
│                   (Marching Vanguard Army ⚔️)                          │
│                                ↓ (Arrival Strike)                      │
│                  [White Flash 💥 -> Zero HP Smoke 💨]                  │
│                                                                        │
│                                                                        │
│ ┌───────────────────────────┐                                          │
│ │ [World] [Alliance]  [ ▾ ] │                                          │
│ │ Tactical Message Feed     │                                          │
│ │ [ Type dispatch...    ➤ ] │                                          │
│ └───────────────────────────┘                                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Key Product Decisions & Trade-Offs

- **Real-Time Arrival Detection in Game Loop vs Pre-timed Timers**:
  - *Chosen Approach*: Army movement runs in the Three.js `animate` tick. A distance check (`dist <= 3.0`) directly governs the engagement transition. Combat damage, white flashes, and death smoke only fire when troops are in contact.
  - *Why*: Eliminates the bug where monsters were flashing and dying before the army had traversed the terrain.
- **Procedural 3D Monster Models for New Types**:
  - *Chosen Approach*: Build procedural 3–8 part composite `THREE.Group` models for Wolf (sleek snout, pointed ears, bristled spine, tail) and Tree Monster / Treant (gnarled root legs, bark trunk, foliage crown, glowing branch arms), fitting Himalayan lore.
  - *Why*: Zero external asset dependencies (prevents broken 404s) and fully integrates with the existing white flash and smoke dissolution system.
- **Unified Chat State with Simulated Realm Atmosphere**:
  - *Chosen Approach*: World & Alliance chat supports real-time player input, combined with organic realm activity events (e.g. alliance member joins, vanguard march reports, territory border alerts).

---

## 4. Technical Architecture & Component Flow

```
┌──────────────────────────────────────────────────────────────┐
│                           App.tsx                            │
│  - armyState ('IDLE' | 'MARCHING' | 'ATTACKING' | 'RETURN')  │
│  - chatMessages (World & Alliance state)                     │
│  - searchTarget & cameraPan target                           │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
       ┌───────▼────────┐             ┌────────▼────────┐
       │   GameCanvas   │             │ TacticalChatDock│
       │ (Three.js r160)│             │ (World/Alliance)│
       └───────┬────────┘             └─────────────────┘
               │
   ┌───────────┴───────────────────────────────┐
   │                                           │
┌──▼────────────────────────┐       ┌──────────▼─────────────────┐
│ Real-Time Arrival Strike  │       │ FloatingSearchRadar.tsx    │
│ - Troop proximity check   │       │ - Filter: Resource/Monster │
│ - White flash on damage   │       │ - Subtype: Bear/Wolf/Tree..│
│ - Zero HP smoke in air    │       │ - Level: 1 - 5             │
└───────────────────────────┘       │ - Camera fly-to & beacon   │
                                    └────────────────────────────┘
```

### Planned File Enhancements
1. **`src/game/GameCanvas.tsx`**:
   - Add Wolf and Tree Monster procedural 3D models with materials.
   - Populate level 1–5 resource nodes (Wood, Farm, Gold, Stone/Crystal) and monsters (Bear, Rabbit, Wolf, Tree Monster).
   - Rewrite combat trigger: execute melee strikes and monster damage exclusively upon physical arrival (`dist <= 3.0`), passing arrival events back to `App.tsx`.
   - Expose a `flyToTarget(pos: [number, number, number])` camera helper for the search radar.
2. **`src/components/TacticalChatDock.tsx` (New)**:
   - Dual-tabbed World & Alliance messaging console with collapsible drawer, message input, quick tactical pings, and rich timestamps.
3. **`src/components/WorldSearchRadar.tsx` (New)**:
   - Floating search bar with category pills (Resources vs Monsters), subtype selectors (Wood, Farm, Gold, Stonecrystal / Bear, Rabbit, Wolf, Tree Monster), and Level 1–5 stepper.
   - List matching nodes sorted by distance from citadel/camera, with a 1-click "Locate & March" button.
4. **`src/App.tsx`**:
   - Remove legacy pre-emptive `setTimeout` damage triggers from `handleDispatchConfirm`.
   - Integrate `TacticalChatDock` and `WorldSearchRadar`.
