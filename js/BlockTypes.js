"use strict";

// ====================
// BLOCK TYPES
// ====================
// Each kind of block is a BlockType. A type owns its sprite and its behavior:
//   land(game, block, done)  - what happens when a block of this type settles
//   fire(game, block)        - what the drop command does (return true if handled)
// `game` provides the shared actions (removeBlock, explodeBlock, awardPoints,
// audio, board, ...). `done` must be called exactly once when the type has
// finished, so the game can spawn the next block.

class BlockType {
    constructor(name, spriteX, spriteY, { value = null, special = false } = {}) {
        this.name = name;
        this.value = value;       // Number blocks have a value; specials don't
        this.isSpecial = special; // Can spawn as a random special block
        this.enabled = special;   // Specials can be switched off for testing
        this.sprite = Object.freeze({
            x: spriteX, y: spriteY,
            width: Config.BLOCK_WIDTH, height: Config.BLOCK_HEIGHT
        });
    }

    get isNumber() { return this.value !== null; }

    // Default: just try the standard merge with whatever is below
    land(game, block, done) {
        game.standardMerge(block, done);
    }

    // Default: dropping means falling; the game handles that
    fire(game, block) {
        return false;
    }
} // class BlockType


class NumberBlockType extends BlockType {
    constructor(value, spriteY) {
        super(String(value), 400, spriteY, { value });
    }
} // class NumberBlockType


// Doesn't merge. Only other specials can remove it.
class BugBlockType extends BlockType {
    constructor(name = "Bug", spriteX = 500, spriteY = 300, special = true) {
        super(name, spriteX, spriteY, { special });
    }

    land(game, block, done) {
        const below = game.board.blockBelow(block);

        // Landing on a Wild removes both
        if (below?.type instanceof WildBlockType) {
            game.audio.play("wild");
            game.removeBlock(below);
            game.removeBlock(block);
            return done?.();
        }

        game.audio.play("bug");
        game.flickerBlock(block, BlockCatalog.byName("Orange"));
        return done?.();
    }
} // class BugBlockType


// Merges with any other block
class WildBlockType extends BlockType {
    constructor() { super("Wild", 500, 0, { special: true }); }

    land(game, block, done) {
        const below = game.board.blockBelow(block);

        // Landing on a Bug removes both
        if (below?.type instanceof BugBlockType) {
            game.removeBlock(below);
            game.audio.play("wild");
            game.removeBlock(block);
            return done?.();
        }

        game.standardMerge(block, done);
    }
} // class WildBlockType


// Swaps the two blocks below it
class SwapBlockType extends BlockType {
    constructor() { super("Swap", 500, 60, { special: true }); }

    land(game, block, done) {
        game.removeBlock(block);

        const upper = game.board.blockAt(block.x, block.y + Config.BLOCK_HEIGHT);
        const lower = game.board.blockAt(block.x, block.y + 2 * Config.BLOCK_HEIGHT);

        // Needs two blocks to swap
        if (!upper || !lower) {
            game.audio.play("fail");
            return done?.();
        }

        game.audio.play("swap");
        game.swapBlocks(upper, lower, done);
    }
} // class SwapBlockType


// Destroys the block it lands on
class BombBlockType extends BlockType {
    constructor() { super("Bomb", 500, 120, { special: true }); }

    land(game, block, done) {
        const below = game.board.blockBelow(block);

        // The bomb itself is removed right away
        game.board.remove(block);

        if (below) {
            game.board.remove(below);
            game.audio.play("bomb");
            game.explodeBlock(below);
            game.awardPoints(below);
        } else {
            game.audio.play("fail");
        }

        done?.();
    }
} // class BombBlockType


// Scrambles the blocks in its column
class MagnetBlockType extends BlockType {
    constructor() { super("Magnet", 500, 180, { special: true }); }

    land(game, block, done) {
        const column = game.board.column(block.x).filter(b => b !== block);

        if (column.length <= 1) {
            game.audio.play("fail");
            game.removeBlock(block);
            return done?.();
        }

        game.audio.play("magnet");

        // Shuffle the types (Fisher-Yates)
        const originalTypes = column.map(b => b.type);
        const shuffled = [...originalTypes];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Flicker random types for a moment, then settle on the shuffle
        let flickers = 0;
        const MAX_FLICKERS = 6;
        const timer = game.every(80, () => {
            if (flickers < MAX_FLICKERS) {
                column.forEach(b => {
                    b.type = originalTypes[Math.floor(Math.random() * originalTypes.length)];
                });
                flickers++;
                return;
            }

            game.cancelTimer(timer);
            column.forEach((b, i) => { b.type = shuffled[i]; });
            game.removeBlock(block);

            // Merge top-down
            let index = 0;
            const mergeNext = () => {
                if (index < column.length) {
                    game.mergeBlocks(column[index], () => {
                        index++;
                        mergeNext();
                    });
                } else {
                    done?.();
                }
            };
            mergeNext();
        });
    }
} // class MagnetBlockType


// Destroys the row of touching blocks it lands on
class ZapBlockType extends BlockType {
    constructor() { super("Zap", 500, 240, { special: true }); }

    land(game, block, done) {
        const rowY = block.y + Config.BLOCK_HEIGHT;
        const centerX = block.x;
        const step = Config.BLOCK_WIDTH;

        if (!game.board.blockAt(centerX, rowY)) {
            game.audio.play("fail");
            game.removeBlock(block);
            return done?.();
        }

        game.audio.play("zap");
        game.shake(300, 4);

        // Collect the unbroken run of blocks through the landing spot
        const positions = [{ x: centerX, y: rowY }];
        for (let x = centerX - step; x >= 0; x -= step) {
            if (!game.board.blockAt(x, rowY)) break;
            positions.push({ x, y: rowY });
        }
        for (let x = centerX + step; x < Config.GRID_WIDTH; x += step) {
            if (!game.board.blockAt(x, rowY)) break;
            positions.push({ x, y: rowY });
        }

        game.flashLightning(centerX, rowY, positions, () => {
            positions.forEach(pos => {
                const target = game.board.blockAt(pos.x, pos.y);
                if (!target) return;
                game.awardPoints(target);
                game.removeBlock(target);
            });

            game.removeBlock(block);
            done?.();
        });
    }
} // class ZapBlockType


// Destroys every block in its column
class NukeBlockType extends BlockType {
    constructor() { super("Nuke", 500, 360, { special: true }); }

    land(game, block, done) {
        const targets = game.board.column(block.x);

        if (targets.length === 0) {
            game.audio.play("fail");
            return done?.();
        }

        game.audio.play("nuke");
        game.shake(500, 8);

        const STAGGER = 100; // ms between the start of each explosion
        let finished = 0;

        targets.forEach((target, index) => {
            game.after(index * STAGGER, () => {
                game.explodeBlock(target, () => {
                    finished++;
                    if (finished === targets.length) {
                        game.removeBlock(block);
                        done?.();
                    }
                });
            });

            game.awardPoints(target);
        });
    }
} // class NukeBlockType


// Doesn't fall on command: fires a laser down its column instead
class BlasterBlockType extends BlockType {
    constructor() { super("Blaster", 500, 600, { special: true }); }

    // Landing (it eventually falls on its own): it explodes, and anything that
    // was resting on it falls into the gap before the next block appears
    land(game, block, done) {
        game.explodeBlock(block, () => game.applyGravity(done));
    }

    // The drop command fires the laser instead of dropping the block
    fire(game, block) {
        game.fireBlaster(block);
        return true;
    }
} // class BlasterBlockType


// Junk that rises from the bottom as the game goes on. Like a Bug it never
// merges, and only specials can clear it. (It is a kind of Bug, so a Wild
// landing on it removes both.)
class JunkBlockType extends BugBlockType {
    constructor() { super("Junk", 400, 600, false); }

    // Junk is placed directly, never "lands"
    land(game, block, done) {
        done?.();
    }
} // class JunkBlockType


// Plain colored blocks used for screen fills and flicker effects
class ScenerySpriteType extends BlockType {
    constructor(name, spriteY) { super(name, 400, spriteY); }
} // class ScenerySpriteType


// ====================
// CATALOG
// ====================

// All block types, in the same order as the sprite sheet / README
const BlockCatalog = (() => {
    const numbers = [1, 2, 4, 8, 16, 32, 64, 128, 256]
        .map((value, i) => new NumberBlockType(value, i * 60));

    const specials = [
        new BugBlockType(), new WildBlockType(), new SwapBlockType(),
        new BombBlockType(), new MagnetBlockType(), new ZapBlockType(),
        new NukeBlockType(), new BlasterBlockType(),
    ];

    const scenery = [
        new ScenerySpriteType("Orange", 540),
        new ScenerySpriteType("Teal", 660),
    ];
    const junk = new JunkBlockType();

    const all = [...numbers, ...specials, junk, ...scenery];

    return Object.freeze({
        numbers, specials, scenery, junk, all,
        byName: name => all.find(t => t.name === name) || null,
        byValue: value => numbers.find(t => t.value === value) || null,
    });
})();


// ====================
// SPAWNING
// ====================

// Chooses what the next block will be. Weighted toward small numbers, and
// larger numbers start appearing as the player builds bigger ones.
class BlockSpawner {
    constructor(board) {
        this.board = board;
    }

    nextType(level = 1) {
        const maxValue = this.board.maxValue();

        const weights = { 1: 50, 2: 30, 4: 15, 8: 5 };
        if (maxValue >= 8) weights[8] = 10;
        if (maxValue >= 16) weights[16] = 5;
        if (maxValue >= 32) weights[32] = 3;
        if (maxValue >= 64) weights[64] = 1;

        // Sometimes the block is special
        const roll = Math.random() * 100;
        if (roll < Config.SPECIAL_BLOCK_CHANCE) {
            const enabled = BlockCatalog.specials.filter(t => t.enabled);
            if (enabled.length > 0) {
                // Weighted: helpful specials get rarer and Bugs commoner with level
                const weights = enabled.map(t => Difficulty.specialWeight(t.name, level));
                let pick = Math.random() * weights.reduce((a, b) => a + b, 0);
                for (let i = 0; i < enabled.length; i++) {
                    pick -= weights[i];
                    if (pick < 0) return enabled[i];
                }
                return enabled[enabled.length - 1];
            }
        }

        // Otherwise a weighted number block
        const total = Object.values(weights).reduce((a, b) => a + b, 0);
        let pick = Math.floor(Math.random() * total);
        for (const value of Object.keys(weights).map(Number)) {
            pick -= weights[value];
            if (pick < 0) return BlockCatalog.byValue(value);
        }
        return BlockCatalog.numbers[0];
    }
} // class BlockSpawner
