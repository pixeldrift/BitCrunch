"use strict";

// ====================
// BOARD
// ====================

// The settled blocks and the questions you can ask about them. Pure data:
// no drawing, no timers, no sound.
class Board {
    constructor() {
        this.blocks = [];
    }

    clear() { this.blocks = []; }

    add(block) { this.blocks.push(block); }

    // Returns true if the block was on the board
    remove(block) {
        const index = this.blocks.indexOf(block);
        if (index === -1) return false;
        this.blocks.splice(index, 1);
        return true;
    }

    blockAt(x, y) {
        return this.blocks.find(b => b.x === x && b.y === y) || null;
    }

    blockBelow(block) {
        return this.blockAt(block.x, block.y + Config.BLOCK_HEIGHT);
    }

    // Blocks in a column, top to bottom
    column(x) {
        return this.blocks.filter(b => b.x === x).sort((a, b) => a.y - b.y);
    }

    isSpawnBlocked(x) {
        return this.blocks.some(b => b.x === x && b.y === 0);
    }

    // The highest Y a falling block at (x, y) can reach before it rests on
    // something: just above the nearest block below it, or the floor.
    landingY(x, y) {
        let limit = Config.GRID_HEIGHT - Config.BLOCK_HEIGHT;
        for (const b of this.column(x)) {
            if (b.y > y) {
                limit = Math.min(limit, b.y - Config.BLOCK_HEIGHT);
                break;
            }
        }
        return limit;
    }

    // Where the ghost block is drawn: on top of the column's highest block
    ghostY(x) {
        let ghostY = 0;
        for (let y = 0; y <= Config.GRID_HEIGHT - Config.BLOCK_HEIGHT; y += Config.BLOCK_HEIGHT) {
            if (this.blocks.some(b => b.x === x && b.y === y)) break;
            ghostY = y;
        }
        return ghostY;
    }

    // Would a block at column x (currently at height y) overlap anything?
    isColumnBlocked(x, y) {
        return this.blocks.some(b =>
            b.x === x &&
            b.y < y + Config.BLOCK_HEIGHT &&
            b.y + Config.BLOCK_HEIGHT > y
        );
    }

    // Largest number value on the board (1 if there are none)
    maxValue() {
        let max = 1;
        for (const b of this.blocks) {
            if (b.value !== null && b.value > max) max = b.value;
        }
        return max;
    }
} // class Board
