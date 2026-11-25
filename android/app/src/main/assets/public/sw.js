/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "21557ec20aa110767b8d90aea719b9e3"
  }, {
    "url": "pwa-512x512.png",
    "revision": "b8ec51fd84d456994bb9ad093371da40"
  }, {
    "url": "pwa-192x192.png",
    "revision": "0344de50364150b300ca0e1b4d5d8c6e"
  }, {
    "url": "index.html",
    "revision": "026265382ca97597fe8eefd9fc17b1c0"
  }, {
    "url": "favicon.ico",
    "revision": "f45dcfb3745f264676dc150e335796d7"
  }, {
    "url": "favicon-32x32.png",
    "revision": "bc0af7f951d63cc40c558d249ab0a6be"
  }, {
    "url": "boot-crest.png",
    "revision": "b256f6249eefca1b11a492d7a56e1145"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "61b515a2223470e4a004619222e37b40"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/three-vendor-CBESww-1.js",
    "revision": null
  }, {
    "url": "assets/index-Cn6ldp9X.css",
    "revision": null
  }, {
    "url": "assets/index-CJz7exqk.js",
    "revision": null
  }, {
    "url": "assets/WorldMapTestMode-Ka4XiQO8.js",
    "revision": null
  }, {
    "url": "assets/StrategicWorldMapModal-Dewh1HZO.js",
    "revision": null
  }, {
    "url": "assets/InsideKingdomView--6jebuDu.js",
    "revision": null
  }, {
    "url": "assets/CommandHubDrawer-nRt0Tg8d.js",
    "revision": null
  }, {
    "url": "assets/AnimationTestModeModal-BdzGJYOT.js",
    "revision": null
  }, {
    "url": "assets/aistudio/screenshot_1_2be6e62f.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_93a70828.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_75c67cf1.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_3cae993f.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_2d5be945.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_250842e5.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Spectral_Bone_Dragon_Unleashed_b4e1a44d.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Magar_Warrior_Progression_Chart_55c15772.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Icy_Lich_King_with_Runeblade_ff11a57c.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Golden_Goblin_with_Treasure_Sack_3d6e0643.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Floating_Crystal_Shrine_0794aa82.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Fierce_Orc_Warrior_with_Branch_Club_2d06f5eb.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Fantasy_Kingdom_Player_Profile_Banner_ba29fba5.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Fantasy_Game_Profile_Dashboard_92c232d3.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Crystal_Alliance_Citadel_Strategy_Map_673bdea9.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Armored_Skeleton_Knight_with_Glowing_Eyes_8d07613d.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "61b515a2223470e4a004619222e37b40"
  }, {
    "url": "boot-crest.png",
    "revision": "b256f6249eefca1b11a492d7a56e1145"
  }, {
    "url": "favicon-32x32.png",
    "revision": "bc0af7f951d63cc40c558d249ab0a6be"
  }, {
    "url": "favicon.ico",
    "revision": "f45dcfb3745f264676dc150e335796d7"
  }, {
    "url": "pwa-192x192.png",
    "revision": "0344de50364150b300ca0e1b4d5d8c6e"
  }, {
    "url": "pwa-512x512.png",
    "revision": "b8ec51fd84d456994bb9ad093371da40"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "21557ec20aa110767b8d90aea719b9e3"
  }, {
    "url": "manifest.webmanifest",
    "revision": "c2746be445df3d55ddedc004db4c8b0e"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
