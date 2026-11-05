"use strict";

// ====================
// CONFIG
// ====================
// Every tunable number and every sprite rectangle in one place. Nothing in
// here depends on the DOM, so it ports directly to another platform.

const Config = Object.freeze({
    VERSION: "v0.04.1 (Beta)",

    // Layout. The canvas is a HUD strip on top of the playing grid, so the HUD
    // never covers blocks. Game logic uses grid coordinates (0,0 is the top-left
    // of the grid); the Renderer shifts the grid down by HUD_HEIGHT.
    GRID_WIDTH: 400,
    GRID_HEIGHT: 720,
    HUD_HEIGHT: 84,
    BLOCK_WIDTH: 100,
    BLOCK_HEIGHT: 60,
    COLUMNS: 4,
    ROWS: 12,

    // Timing and speeds
    DROP_SPEED: 2000,            // Pixels per second when the player drops a block
    MERGE_DELAY: 200,            // ms between landing and merging
    GRAVITY_DELAY: 100,          // ms before gravity / chain merges run
    COUNTDOWN_STEP: 1000,        // ms each countdown number is on screen
    SPAWN_CHECK_INTERVAL: 1000,  // ms between safety-net checks for a missing block
    RESOLVE_TIMEOUT: 8000,       // ms a landing may take to resolve before the next block is forced
    LASER_DURATION: 100,         // ms the blaster beam is visible
    EXPLOSION_FRAME_DURATION: 80,// ms per explosion frame

    // Floating score popups (per 1/60 s, so they look the same at any frame rate)
    SCORE_POPUP_RISE_SPEED: 2,   // Pixels
    SCORE_POPUP_FADE_SPEED: 1,   // Percent alpha

    // Difficulty: the game gets harder every few blocks (see Difficulty.js)
    BLOCKS_PER_LEVEL: 10,        // A new level every this many blocks placed
    BASE_FALL_SPEED: 60,         // Pixels per second at level 1 (12 s to cross the grid)
    FALL_SPEED_GROWTH: 1.12,     // Each level multiplies the speed by this...
    MAX_FALL_SPEED: 480,         // ...up to this (1.5 s to cross the grid)
    MIN_MERGE_DELAY: 60,         // The pause after landing shrinks to this
    MERGE_DELAY_STEP: 10,        // ...by this many ms per level
    JUNK_START_LEVEL: 4,         // Junk blocks start rising from this level
    JUNK_START_INTERVAL: 18,     // Blocks between junk at the first junk level
    JUNK_INTERVAL_STEP: 1,       // ...fewer each level
    JUNK_MIN_INTERVAL: 10,        // ...but never faster than this
    JUNK_COUNT_STEP: 8,          // One more junk block per row of junk every this many levels (max 3)
    LEVEL_BANNER_TIME: 1.6,      // Seconds the "LEVEL n" banner shows

    // Spawning
    SPECIAL_BLOCK_CHANCE: 10,    // Percent chance a new block is a special

    // Developer keys (Shift+1..8 = specials, 1..9 = number blocks)
    DEV_KEYS_ENABLED: true,

    // Touch gestures, in canvas pixels
    TOUCH_LOCK_DISTANCE: 12,     // Movement before a touch counts as a drag/swipe
    TOUCH_SWIPE_DISTANCE: 60,    // Vertical travel to drop / pause

    MAX_PIXEL_RATIO: 2,          // Sharper on retina screens, capped for speed

    HIGH_SCORE_KEY: "bitCrunchHighScore",

    // The "HOW TO PLAY" button on each screen that has one (grid coordinates),
    // keyed by the game state it appears in
    HELP_BUTTONS: Object.freeze({
        welcome:  Object.freeze({ x: 100, y: 590, width: 200, height: 48 }),
        paused:   Object.freeze({ x: 100, y: 440, width: 200, height: 48 }),
        gameOver: Object.freeze({ x: 100, y: 420, width: 200, height: 48 }),
    }),

    // The close button (an X) at the top right of the help screen (grid coordinates)
    HELP_CLOSE: Object.freeze({ x: 336, y: 14, width: 50, height: 44 }),

    // The Play button on the welcome screen (grid coordinates)
    PLAY_BUTTON: Object.freeze({ x: 50, y: 450, width: 300, height: 120 }),
});


// Rectangles on the sprite sheet (graphics/BitCrunch-Sprite-Sheet.png)
const Sprites = Object.freeze({
    logo:               { x: 0,   y: 0,    width: 400, height: 400 },
    gameGrid:           { x: 0,   y: 0,    width: 400, height: 720 },
    scoreBoard:         { x: 300, y: 720,  width: 300, height: 240 },
    scoreBar:           { x: 300, y: 960,  width: 300, height: 42 },
    playButton:         { x: 0,   y: 720,  width: 300, height: 120 },
    playButtonHighlight:{ x: 0,   y: 840,  width: 300, height: 120 },
    laser:              { x: 500, y: 660,  width: 100, height: 60 },
    lightning:          { x: 0,   y: 1020, width: 400, height: 60 },
    explosion: [
        { x: 500, y: 420, width: 100, height: 60 },
        { x: 500, y: 480, width: 100, height: 60 },
        { x: 500, y: 540, width: 100, height: 60 },
    ],
});
