# Himalayan Realms — Isometric Web Prototype

A browser-based HTML/CSS/JavaScript prototype for a Nepalese-inspired fantasy kingdom strategy game.

## Run locally

This project uses ES modules and imports Three.js from jsDelivr, so serve it over HTTP rather than opening `index.html` directly.

### Option A: Python
```bash
cd nepalese_fantasy_web_game
python -m http.server 8000
```
Open http://localhost:8000

### Option B: Node
```bash
npx serve .
```

Internet access is required for the CDN-hosted Three.js modules and Google Fonts.

## Prototype controls

- Click a map object to select it.
- Choose a kingdom from World Atlas to switch the visible kingdom scene.
- Drag the map to pan.
- Mouse wheel or +/- buttons to zoom.
- Select a resource node and press Gather Resources.
- Select a monster and press Attack Target.
- Use Return Home or press R to recall the army.
- Keyboard shortcuts: M = march, G = gather, A = attack, R = return.

## Scope and limitations

This is a local single-browser gameplay prototype. It includes an interactive Three.js isometric environment, procedural 3D trees, rock and ore resource nodes, hill-fort castle, village buildings, wildlife, and a 15-unit troop formation with marching, attack, and mining action animations; kingdom switching, army commands, demo gathering/combat logic, and a mission log.

The project now includes original GLB models under `assets/models/` for Himalayan pine trees, a Gorkha hill-fort castle, iron/stone/gold/wood resource nodes, a Magar-inspired infantry concept, and a mountain horse. Tree, castle, and resource GLBs load automatically through Three.js GLTFLoader, with procedural placeholders retained as a fallback. The 15-unit army has group marching, attack, and mining action animation using articulated procedural mesh parts.

It does NOT yet include:
- Online multiplayer, authentication, or a server-authoritative simulation.
- PostgreSQL persistence, anti-cheat validation, or reconnect-safe missions.
- Skeletal-rigged GLB troop clips; the included Magar infantry and horse GLBs are static art assets, while live squad actions currently use procedural mesh animation.
- Production pathfinding, sophisticated tactical combat, or cross-kingdom army travel.

The troop and monster models are procedural placeholders. Replace them with licensed or original GLB assets and connect a server (e.g. Node.js + Colyseus + PostgreSQL) before treating missions, combat, or rewards as authoritative.

## Project structure

```text
nepalese-fantasy-web-game/
├── index.html
├── style.css
├── src/main.js
├── assets/
│   └── models/       # Original GLB environment/resource/troop assets
└── README.md
```


## Startup fix

The page includes an import map for Three.js so the GLTFLoader bare `three` import resolves correctly in modern browsers. Keep internet access enabled for the CDN modules.
