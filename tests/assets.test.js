"use strict";

// Checks that the files the page, the service worker, and the audio code point at
// all exist and agree with each other.

const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const exists = f => fs.existsSync(path.join(root, f));

const html = read("index.html");
const sw = read("sw.js");

test("every script in index.html exists, and loads in a sensible order", () => {
    const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
    assert.ok(scripts.length >= 10);
    scripts.forEach(f => assert.ok(exists(f), "missing " + f));
    // Game code depends on the files before it
    const order = n => scripts.indexOf(`js/${n}.js`);
    assert.ok(order("Config") < order("Block") && order("Difficulty") < order("Game") && order("Game") < order("main"));
});

test("service worker: caches every script, and every file it lists exists", () => {
    const listed = [...sw.matchAll(/^\s+"([^"]+)",?$/gm)].map(m => m[1]);
    [...html.matchAll(/<script src="([^"]+)"/g)].forEach(m => assert.ok(listed.includes(m[1]), m[1] + " is not in sw.js"));
    listed.filter(f => f !== "./").forEach(f => assert.ok(exists(f), "sw.js lists missing file " + f));
});

test("service worker: cache version matches the game version", () => {
    const gameVersion = /VERSION: "v([\d.]+)/.exec(read("js/Config.js"))[1];
    const cacheVersion = /CACHE_VERSION = "([\d.]+)"/.exec(sw)[1];
    assert.strictEqual(cacheVersion, gameVersion);
});

test("manifest: valid, and its icons exist", () => {
    const manifest = JSON.parse(read("manifest.webmanifest"));
    assert.strictEqual(manifest.short_name, "BitCrunch");
    manifest.icons.forEach(i => assert.ok(exists(i.src), "missing " + i.src));
});

test("audio: every sound effect and music file in the code exists", () => {
    const audio = read("js/AudioManager.js");
    const names = [...audio.match(/SFX_NAMES = \[([\s\S]*?)\]/)[1].matchAll(/"(\w+)"/g)].map(m => m[1]);
    assert.strictEqual(names.length, 20);
    names.forEach(n => assert.ok(exists(`audio/sfx/${n}Sound.mp3`), "missing sfx " + n));
    [...audio.matchAll(/file: "([^"]+)"/g)].forEach(m => assert.ok(exists(m[1]), "missing music " + m[1]));
});

test("fonts: the self-hosted files exist and index.html points at them", () => {
    ["fonts/silkscreen-400.woff2", "fonts/silkscreen-700.woff2", "fonts/OFL.txt"].forEach(f => assert.ok(exists(f), f));
    assert.ok(!html.includes("fonts.googleapis.com"), "still loading fonts from Google");
});
