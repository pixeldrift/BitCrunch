"use strict";

// ====================
// BOARD
// ====================

// The settled blocks, stored as a 4 x 12 grid of cells so any lookup is a direct
// index instead of a search. Pure data: no drawing, no timers, no sound.
//
// A block is either IN the grid (its x/y sit exactly on a cell) or FLOATING
// (mid-animation, e.g. the arc of a swap). Floating blocks are drawn but aren't
// found by any query until they're placed.
//
// Always change a placed block's position with move(), or the grid and the
// block's own x/y would disagree.
class Board {
    constructor() {
        this.cells = Array.from({ length: Config.COLUMNS }, () => new Array(Config.ROWS).fill(null));
        this.floating = new Set();
    }

    clear() {
        this.cells.forEach(column => column.fill(null));
        this.floating.clear();
    }


    // ----- Coordinates -----

    // The cell index for an x or y that sits exactly on the grid, else -1
    static columnOf(x) {
        const c = x / Config.BLOCK_WIDTH;
        return Number.isInteger(c) && c >= 0 && c < Config.COLUMNS ? c : -1;
    }

    static rowOf(y) {
        const r = y / Config.BLOCK_HEIGHT;
        return Number.isInteger(r) && r >= 0 && r < Config.ROWS ? r : -1;
    }


    // ----- Adding, removing, moving -----

    // Put a block on the board: in its cell if it's on the grid, otherwise floating
    add(block) {
        const c = Board.columnOf(block.x), r = Board.rowOf(block.y);
        if (c >= 0 && r >= 0 && this.cells[c][r] === null) {
            this.cells[c][r] = block;
        } else {
            this.floating.add(block);
        }
    }

    // Add a block that is about to animate off the grid
    addFloating(block) { this.floating.add(block); }

    // Settle a floating block into its cell
    place(block) {
        this.floating.delete(block);
        this.add(block);
    }

    // Returns true if the block was on the board
    remove(block) {
        if (this.floating.delete(block)) return true;

        const c = Board.columnOf(block.x), r = Board.rowOf(block.y);
        if (c >= 0 && r >= 0 && this.cells[c][r] === block) {
            this.cells[c][r] = null;
            return true;
        }
        return false;
    }

    // Move a placed block to a new Y (it must stay in its column)
    move(block, y) {
        const c = Board.columnOf(block.x), r = Board.rowOf(block.y);
        if (c >= 0 && r >= 0 && this.cells[c][r] === block) this.cells[c][r] = null;
        block.y = y;
        this.add(block);
    }

    // Is this block on the board right now?
    has(block) {
        if (this.floating.has(block)) return true;
        const c = Board.columnOf(block.x), r = Board.rowOf(block.y);
        return c >= 0 && r >= 0 && this.cells[c][r] === block;
    }


    // ----- Looking at blocks -----

    blockAt(x, y) {
        const c = Board.columnOf(x), r = Board.rowOf(y);
        return c >= 0 && r >= 0 ? this.cells[c][r] : null;
    }

    blockBelow(block) {
        return this.blockAt(block.x, block.y + Config.BLOCK_HEIGHT);
    }

    // Blocks in a column, top to bottom
    column(x) {
        const c = Board.columnOf(x);
        return c < 0 ? [] : this.cells[c].filter(b => b !== null);
    }

    // Visit every block, grid and floating (used for drawing)
    each(fn) {
        for (const column of this.cells) {
            for (const block of column) if (block !== null) fn(block);
        }
        this.floating.forEach(fn);
    }

    // Every block as an array (for tests and tools; the game loop uses each())
    get blocks() {
        const all = [];
        this.each(b => all.push(b));
        return all;
    }

    isSpawnBlocked(x) {
        return this.blockAt(x, 0) !== null;
    }

    // The highest Y a falling block at (x, y) can reach before it rests on
    // something: just above the nearest block below it, or the floor.
    landingY(x, y) {
        const c = Board.columnOf(x);
        let limit = Config.GRID_HEIGHT - Config.BLOCK_HEIGHT;
        if (c < 0) return limit;

        const firstRow = Math.floor(y / Config.BLOCK_HEIGHT) + 1; // First row strictly below y
        for (let r = Math.max(firstRow, 0); r < Config.ROWS; r++) {
            if (this.cells[c][r] !== null) {
                return Math.min(limit, r * Config.BLOCK_HEIGHT - Config.BLOCK_HEIGHT);
            }
        }
        return limit;
    }

    // Where the ghost block is drawn: on top of the column's highest block
    ghostY(x) {
        const c = Board.columnOf(x);
        if (c < 0) return 0;
        for (let r = 0; r < Config.ROWS; r++) {
            if (this.cells[c][r] !== null) return Math.max(r - 1, 0) * Config.BLOCK_HEIGHT;
        }
        return (Config.ROWS - 1) * Config.BLOCK_HEIGHT;
    }

    // Would a block at column x (currently at height y) overlap anything?
    isColumnBlocked(x, y) {
        const c = Board.columnOf(x);
        if (c < 0) return false;
        for (let r = 0; r < Config.ROWS; r++) {
            const top = r * Config.BLOCK_HEIGHT;
            if (this.cells[c][r] !== null &&
                top < y + Config.BLOCK_HEIGHT && top + Config.BLOCK_HEIGHT > y) return true;
        }
        return false;
    }

    // Largest number value on the board (1 if there are none)
    maxValue() {
        let max = 1;
        for (const column of this.cells) {
            for (const b of column) {
                if (b !== null && b.value !== null && b.value > max) max = b.value;
            }
        }
        return max;
    }


    // ----- Gravity -----

    // Drop every block as far as it can fall. Returns the blocks that moved, in
    // reading order (columns left to right, top to bottom within each column).
    settle() {
        const moved = [];
        for (let c = 0; c < Config.COLUMNS; c++) {
            const fallen = [];
            let target = Config.ROWS - 1;

            for (let r = Config.ROWS - 1; r >= 0; r--) {
                const block = this.cells[c][r];
                if (block === null) continue;

                if (r !== target) {
                    this.cells[c][r] = null;
                    this.cells[c][target] = block;
                    block.y = target * Config.BLOCK_HEIGHT;
                    fallen.push(block);
                }
                target--;
            }
            moved.push(...fallen.reverse()); // Bottom-up -> top-down
        }
        return moved;
    }
} // class Board
