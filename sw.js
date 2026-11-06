"use strict";

// Service worker: caches the game so it loads fast and works offline.
//
// IMPORTANT: bump CACHE_VERSION (to match Config.VERSION in js/Config.js) whenever
// you ship a change, so players get the new files. tests/assets.test.js checks
// that this list matches index.html and that the version matches.

const CACHE_VERSION = "0.04.2";
const CACHE_NAME = "bitcrunch-" + CACHE_VERSION;

// Everything needed to start and play, downloaded when the game is first opened
const CORE_FILES = [
    "./",
    "index.html",
    "manifest.webmanifest",
    "js/Config.js",
    "js/Block.js",
    "js/BlockTypes.js",
    "js/Board.js",
    "js/Effects.js",
    "js/Difficulty.js",
    "js/HelpContent.js",
    "js/AudioManager.js",
    "js/Hud.js",
    "js/Renderer.js",
    "js/Game.js",
    "js/Input.js",
    "js/main.js",
    "graphics/BitCrunch-Sprite-Sheet.png",
    "graphics/Bit-Crunch-Logo.png",
    "fonts/silkscreen-400.woff2",
    "fonts/silkscreen-700.woff2",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/apple-touch-icon.png",
    "audio/music/music-a.mp3",
    "audio/sfx/welcomeSound.mp3",
    "audio/sfx/startSound.mp3",
    "audio/sfx/leftSound.mp3",
    "audio/sfx/rightSound.mp3",
    "audio/sfx/dropSound.mp3",
    "audio/sfx/placeSound.mp3",
    "audio/sfx/mergeSound.mp3",
    "audio/sfx/pauseSound.mp3",
    "audio/sfx/gameOverSound.mp3",
    "audio/sfx/bugSound.mp3",
    "audio/sfx/wildSound.mp3",
    "audio/sfx/swapSound.mp3",
    "audio/sfx/bombSound.mp3",
    "audio/sfx/magnetSound.mp3",
    "audio/sfx/zapSound.mp3",
    "audio/sfx/nukeSound.mp3",
    "audio/sfx/laserSound.mp3",
    "audio/sfx/failSound.mp3",
    "audio/sfx/successSound.mp3",
    "audio/sfx/smallBoomSound.mp3"
];

// The game music is big, so it's saved the first time each track is played
const MUSIC_PATH = "/audio/music/";

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_FILES)).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(names.filter(n => n.startsWith("bitcrunch-") && n !== CACHE_NAME).map(n => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== "GET" || url.origin !== self.location.origin) return;

    // <audio> asks for pieces of a file ("Range" requests)
    if (request.headers.has("range")) {
        event.respondWith(serveRange(request, event));
        return;
    }

    // Everything else: show the saved copy right away, and refresh it in the background
    event.respondWith(
        caches.open(CACHE_NAME).then(async cache => {
            const cached = await cache.match(request, { ignoreSearch: true });
            const refresh = fetch(request).then(response => {
                if (response.ok) cache.put(request, response.clone());
                return response;
            }).catch(() => null);

            if (cached) {
                event.waitUntil(refresh);
                return cached;
            }
            return (await refresh) || Response.error();
        })
    );
});

// Answer a Range request from the saved full file if we have it. If not, go to
// the network, and for music, quietly save the whole file for next time.
async function serveRange(request, event) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request.url, { ignoreSearch: true });

    if (!cached) {
        if (new URL(request.url).pathname.includes(MUSIC_PATH)) {
            event.waitUntil(cache.add(request.url).catch(() => {}));
        }
        return fetch(request);
    }

    const blob = await cached.blob();
    const match = /bytes=(\d*)-(\d*)/.exec(request.headers.get("range"));
    let start = match && match[1] !== "" ? parseInt(match[1], 10) : 0;
    let end = match && match[2] !== "" ? parseInt(match[2], 10) : blob.size - 1;
    if (match && match[1] === "" && match[2] !== "") { // "last N bytes"
        start = Math.max(0, blob.size - parseInt(match[2], 10));
        end = blob.size - 1;
    }
    end = Math.min(end, blob.size - 1);

    return new Response(blob.slice(start, end + 1), {
        status: 206,
        statusText: "Partial Content",
        headers: {
            "Content-Type": cached.headers.get("Content-Type") || "audio/mpeg",
            "Content-Length": String(end - start + 1),
            "Content-Range": `bytes ${start}-${end}/${blob.size}`,
            "Accept-Ranges": "bytes",
        },
    });
}
