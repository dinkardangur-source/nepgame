# Himalayan Realms — React Isometric Strategy Application

A modern full-stack React + TypeScript + Three.js kingdom strategy simulation set in mythical Himalayan realms, powered by Vite and Node.js.

## Architecture & Technology Stack

- **Frontend**: React 19, TypeScript, Three.js (WebGL 3D Isometric Viewport, Orthographic Camera, GLTF loader)
- **Styling**: Tailored Himalayan Kingdom UI with Barlow Condensed typography and tactical overlays
- **Backend**: Express + Node.js (with live Vite middleware mode in development and static asset serving in production)
- **AI Integrations**:
  - **Veo 3.1 Fast**: Generates dynamic cinematic fantasy video sequences from realm snapshots and photographs
  - **Gemini Nano Banana 2.1**: Synthesizes and edits 3D character art, concepts, and custom army portraits

## Key Features

1. **3D Isometric Kingdom Mainland**:
   - Interactive Himalayan terrain with 4 distinct provinces: Gorkha Central Valley, Himshikhar Glaciers, Ironcrest Ridges, and Green Mandala.
   - 3D models (`.glb`) loaded for Himalayan pines, the Gorkha hill-fort keep, and gold, iron, stone, and timber resource nodes with procedural fallback.
   - Smooth camera controls: drag-to-pan, scroll-to-zoom, reset view, and smooth pan-to-province.

2. **Army Vanguard & Tactical Command**:
   - Magar Vanguard squad consisting of Infantry, Mountain Cavalry, and Himalayan Archers.
   - Dynamic power calculation, health bars, and articulated squad marching/combat/mining animations.
   - Orders: March to target, Gather resources, Attack threats, and Recall to Citadel (`M`, `G`, `A`, `R`, `B`, `F`, `Tab`).

3. **Recruitment & Barracks Queue**:
   - Active recruitment queue for Magar Infantry, Mountain Cavalry, and Himalayan Archers with real-time countdowns and progress bars.

4. **Interactive Kingdom Minimap**:
   - 2D Canvas radar displaying terrain, citadel, resource nodes, threats, army location, and camera view frustum.
   - Layer toggling (All, Nodes, Buildings, Army, Threats) and click-to-pan navigation.

5. **Contextual On-Object Action HUD & Modals**:
   - Floating contextual action bubble anchored above clicked 3D objects.
   - **Troop Dispatch Modal**: Custom troop ratio sliders, power forecasts, and victory projections.
   - **Tactical Scout Intelligence Report**: Weakness scans, counter unit recommendations, and +30% assault bonuses.
   - **Kingdom Architecture & Blueprints**: Upgrade structures and build new economic/military blueprints (Watermill, Foundry, Timber Mill, Masonry, Stables, Archery Range, Sentinel Bastion, Chorten Shrine).

6. **AI Realm Studios**:
   - **AI Realm Art Studio**: Generate or edit character concepts with Nano Banana 2.1 and apply them directly as the Vanguard portrait.
   - **Veo 3.1 Video Animator**: Animate static snapshots into high-definition atmospheric video sequences.

## Development

```bash
# Start full-stack dev server on http://0.0.0.0:3000
npm run dev

# Build client production bundle
npm run build

# Type check
npm run lint
```
