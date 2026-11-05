"use strict";

// A headless world for the game logic: loads the real game files into a Node
// vm context with a fake clock, a seeded Math.random, and stub audio/renderer.
// No browser needed. The clock only moves when a test calls clock.advance(ms),
// so even minutes of play run instantly and exactly the same every time.

const vm = require("vm");
const fs = require("fs");
const path = require("path");

const JS_DIR = path.join(__dirname, "..", "js");
const LOGIC_FILES = ["Config", "Block", "BlockTypes", "Board", "Effects", "Difficulty", "Game"];

class FakeClock {
    constructor() {
        this.now = 0;
        this.queue = [];   // { at, seq, fn, every }
        this.seq = 0;
        this.frame = 1000 / 60;
    }

    schedule(fn, delay, every = 0, raf = false) {
        const entry = { at: this.now + delay, seq: ++this.seq, fn, every, raf };
        this.queue.push(entry);
        return entry.seq;
    }

    // One-shot timers still waiting (not the repeating watchdog, not animation frames)
    pendingTimeouts() { return this.queue.filter(e => !e.every && !e.raf).length; }

    cancel(id) { this.queue = this.queue.filter(e => e.seq !== id); }

    // Next animation frame boundary
    nextFrame() {
        let t = (Math.floor(this.now / this.frame) + 1) * this.frame;
        if (t <= this.now + 1e-6) t += this.frame; // Guard against floating-point rounding
        return t;
    }

    advance(ms) {
        const end = this.now + ms;
        for (;;) {
            this.queue.sort((a, b) => a.at - b.at || a.seq - b.seq);
            const next = this.queue[0];
            if (!next || next.at > end) break;
            this.queue.shift();
            this.now = next.at;
            if (next.every) {
                next.at += next.every;
                this.queue.push(next);
            }
            next.fn(this.now);
        }
        this.now = end;
    }
}

// Small seeded random numbers (mulberry32)
function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// `config` overrides Config values for this world, e.g. { JUNK_START_LEVEL: 4 }
function createWorld(seed = 1, config = {}) {
    const clock = new FakeClock();
    const sandbox = {
        console: { log() {}, warn: console.warn, error: console.error },
        setTimeout: (fn, ms = 0) => clock.schedule(fn, ms),
        setInterval: (fn, ms) => clock.schedule(fn, ms, ms),
        clearTimeout: id => clock.cancel(id),
        clearInterval: id => clock.cancel(id),
        requestAnimationFrame: fn => clock.schedule(fn, clock.nextFrame() - clock.now, 0, true),
        cancelAnimationFrame: id => clock.cancel(id),
        performance: { now: () => clock.now },
    };
    const ctx = vm.createContext(sandbox);

    const world = {
        clock, ctx,
        run: code => vm.runInContext(code, ctx),
        seed(n) { vm.runInContext("Math.random = __rng", Object.assign(ctx, { __rng: seededRandom(n) })); },
    };

    LOGIC_FILES.forEach(name => {
        const file = path.join(JS_DIR, name + ".js");
        if (!fs.existsSync(file)) return;
        let code = fs.readFileSync(file, "utf8");
        if (name === "Config") {
            for (const [key, value] of Object.entries(config)) {
                const pattern = new RegExp(`(\\b${key}:\\s*)[^,\\n]+,`);
                if (!pattern.test(code)) throw new Error("Unknown Config key: " + key);
                code = code.replace(pattern, `$1${JSON.stringify(value)},`);
            }
        }
        vm.runInContext(code, ctx, { filename: file });
    });
    world.seed(seed);

    // A Game with silent stand-ins for sound and drawing
    ctx.__audio = {
        sfxOn: true, musicOn: true,
        play() {}, startMusic() {}, stopMusic() {}, pauseMusic() {}, resumeMusic() {},
        playTheme() {}, stopTheme() {}, toggleSfx() {}, toggleMusic() {}, nextTrack() {},
    };
    ctx.__renderer = {
        draw() {}, drawHud() {}, cancelOverlay() {}, showPause() {}, showScoreboard() {},
    };
    world.game = world.run("new Game(__renderer, __audio)");

    // Start a game and run the countdown, so a block is falling
    world.startPlaying = () => {
        world.game.resetGame();
        clock.advance(3100);
        return world.game;
    };

    return world;
}

module.exports = { createWorld, FakeClock, seededRandom };
