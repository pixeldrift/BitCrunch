"use strict";

// ====================
// DIFFICULTY
// ====================

// How hard the game is at each level. All the numbers live in Config; this class
// turns "blocks placed so far" into levels, speeds and junk. Pure functions, so
// a headless bot can play with them to compare curves.
class Difficulty {
    // Level 1 for the first blocks, +1 every BLOCKS_PER_LEVEL blocks placed
    static levelFor(blocksPlaced) {
        return 1 + Math.floor(blocksPlaced / Config.BLOCKS_PER_LEVEL);
    }

    // How fast the falling block moves on its own, in pixels per second.
    // Eases toward MAX_FALL_SPEED: each level closes a fixed fraction of the
    // remaining gap, so the early levels step up the most and later ones barely
    // change (it feels steadily harder without becoming unplayable).
    static fallSpeed(level) {
        const gap = Config.MAX_FALL_SPEED - Config.BASE_FALL_SPEED;
        return Config.MAX_FALL_SPEED - gap * Math.pow(Config.FALL_SPEED_DECAY, level - 1);
    }

    // Seconds for a block to fall from the top to the bottom of an empty grid
    static fallTime(level) {
        return Config.GRID_HEIGHT / Difficulty.fallSpeed(level);
    }

    // The pause between a block landing and its merge: less breathing room each level
    static mergeDelay(level) {
        return Math.max(Config.MIN_MERGE_DELAY, Config.MERGE_DELAY - (level - 1) * Config.MERGE_DELAY_STEP);
    }

    // How many blocks between junk, or null if there's no junk yet at this level
    static junkInterval(level) {
        if (level < Config.JUNK_START_LEVEL) return null;
        const interval = Config.JUNK_START_INTERVAL - (level - Config.JUNK_START_LEVEL) * Config.JUNK_INTERVAL_STEP;
        return Math.max(Config.JUNK_MIN_INTERVAL, interval);
    }

    // How many junk blocks arrive each time: 1, then 2, then 3 (never a full row of 4)
    static junkCount(level) {
        const extra = Math.floor((level - Config.JUNK_START_LEVEL) / Config.JUNK_COUNT_STEP);
        return Math.max(1, Math.min(3, 1 + extra));
    }

    // How likely each special is, relative to the others. The helpful ones (that
    // clear blocks) get rarer as the level rises and the harmful Bug gets commoner.
    static specialWeight(name, level) {
        const steps = level - 1;
        if (name === "Bug") return Math.min(4, 1 + 0.2 * steps);
        if (name === "Bomb" || name === "Nuke" || name === "Zap" || name === "Blaster") {
            return Math.max(0.4, Math.pow(0.95, steps));
        }
        return 1;
    }
} // class Difficulty
