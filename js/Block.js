"use strict";

// ====================
// BLOCKS
// ====================

// A block on the board (or falling). A block only knows its position and its
// type; everything a type *does* lives in BlockType (BlockTypes.js). Merging
// and the magnet change a block's `type`, never the block object itself.
class Block {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.exploding = false; // True while its explosion animation plays
    }

    // Value follows the current type, so a block that merged 2 -> 4 is worth 4
    get value() { return this.type.value; }

    get column() { return Math.round(this.x / Config.BLOCK_WIDTH); }
    get row() { return Math.round(this.y / Config.BLOCK_HEIGHT); }
} // class Block
