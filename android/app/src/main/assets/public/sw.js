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
    "revision": "d644ae5128f0a43b62cc2fc883ddc2b7"
  }, {
    "url": "pwa-512x512.png",
    "revision": "60c3212f19438387767d0658e408a9a6"
  }, {
    "url": "pwa-192x192.png",
    "revision": "baee7932c47b483452047731c7d9d990"
  }, {
    "url": "index.html",
    "revision": "00780e48a9ca21d3b20058f1bce6f1fb"
  }, {
    "url": "favicon.ico",
    "revision": "bced82f6fc61f49f97449e34128d81fa"
  }, {
    "url": "favicon-32x32.png",
    "revision": "df67d26c20dc0d4f19da8ed3e04f0ddb"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "85c5f7ebbbffa62d1e0c9936f103d4cd"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/three-vendor-BDIn3zjl.js",
    "revision": null
  }, {
    "url": "assets/index-Bto2pHRJ.js",
    "revision": null
  }, {
    "url": "assets/index-BRYu6DSd.css",
    "revision": null
  }, {
    "url": "assets/StrategicWorldMapModal-BvQ-Fd81.js",
    "revision": null
  }, {
    "url": "assets/InsideKingdomView-BbDkZWWP.js",
    "revision": null
  }, {
    "url": "assets/CommandHubDrawer-UkLfYiEZ.js",
    "revision": null
  }, {
    "url": "assets/aistudio/screenshot_1_2be6e62f.png",
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
    "url": "assets/aistudio/Crystal_Alliance_Citadel_Strategy_Map_673bdea9.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Armored_Skeleton_Knight_with_Glowing_Eyes_8d07613d.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "85c5f7ebbbffa62d1e0c9936f103d4cd"
  }, {
    "url": "favicon-32x32.png",
    "revision": "df67d26c20dc0d4f19da8ed3e04f0ddb"
  }, {
    "url": "pwa-192x192.png",
    "revision": "baee7932c47b483452047731c7d9d990"
  }, {
    "url": "pwa-512x512.png",
    "revision": "60c3212f19438387767d0658e408a9a6"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "d644ae5128f0a43b62cc2fc883ddc2b7"
  }, {
    "url": "manifest.webmanifest",
    "revision": "98f2912af16916b673cc96689b431187"
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
