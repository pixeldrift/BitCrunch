"use strict";

// A simple player for the headless game. It plays whole games on the fake clock so
// tests can check invariants over hundreds of blocks, and so difficulty curves can
// be compared by how long the bot survives.

const { createWorld, seededRandom } = require("./harness");

// Strategies pick a column (0..3) for the falling block
const strategies = {
    // Anywhere at all
    random: (game, rng) => Math.floor(rng() * 4),

    // Prefer a column whose top block matches the falling one, else the lowest stack
    sensible: (game, rng) => {
        const block = game.activeBlock;
        let best = 0, bestScore = -Infinity;
        for (let c = 0; c < 4; c++) {
            const column = game.board.column(c * 100);
            const top = column[0];
            const height = column.length;
            let score = -height * 2 + rng() * 0.5;
            if (top && block.value !== null && top.value === block.value) score += 6;
            if (top && block.type.name === "Wild") score += 3;
            if (height >= 11) score -= 50;
            if (score > bestScore) { bestScore = score; best = c; }
        }
        return best;
    },
};

// Check the board is consistent: every block sits in the cell that matches its
// position, and nothing is left hanging over a gap.
function checkBoard(game) {
    const problems = [];
    const cells = game.board.cells;

    cells.forEach((column, c) => {
        let seenEmpty = false;
        for (let r = column.length - 1; r >= 0; r--) {
            const b = column[r];
            if (b === null) { seenEmpty = true; continue; }
            if (b.x !== c * 100 || b.y !== r * 60) problems.push(`block ${b.type.name} at (${b.x},${b.y}) is stored in cell ${c},${r}`);
            if (seenEmpty) problems.push(`floating block ${b.type.name} at column ${c}, row ${r}`);
        }
    });

    if (game.board.floating.size > 0) problems.push(`${game.board.floating.size} block(s) stuck floating`);
    return problems;
}

// Play until the game ends or maxBlocks have been placed.
// Returns { blocks, level, score, over, problems }
function playGame({ seed = 1, maxBlocks = 200, strategy = "sensible", check = true, setup = null } = {}) {
    const world = createWorld(seed);
    const game = world.startPlaying();
    if (setup) setup(game, world);

    const rng = seededRandom(seed * 7919 + 13); // The bot's own randomness, separate from the game's
    const pick = strategies[strategy];
    const problems = [];

    let placed = 0;
    let last = null; // The block we most recently dropped
    while (game.state === "playing" && placed < maxBlocks) {
        // Wait for the next block to appear (animations and merges take a moment)
        let waited = 0;
        while ((!game.activeBlock || game.activeBlock === last) && game.state === "playing" && waited < 20000) {
            world.clock.advance(50);
            waited += 50;
        }
        if (game.state !== "playing") break;
        if (!game.activeBlock) { problems.push("no block appeared"); break; }

        // Let everything settle (no timers left), then check, before the bot moves
        let settleTime = 0;
        while (world.clock.pendingTimeouts() > 0 && settleTime < 3000) { world.clock.advance(20); settleTime += 20; }
        if (check) {
            if (world.clock.pendingTimeouts() > 0) problems.push(`after ${placed} blocks: still busy after 3 s`);
            problems.push(...checkBoard(game).map(p => `after ${placed} blocks: ${p}`));
        }
        if (game.activeBlock !== last && !game.activeBlock) break;

        const block = game.activeBlock;
        last = block;
        const column = pick(game, rng);
        let guard = 0;
        while (game.activeBlock === block && game.activeBlock.x !== column * 100 && guard++ < 4) {
            if (game.activeBlock.x < column * 100) game.moveRight(); else game.moveLeft();
        }

        game.drop();
        if (block.type.name === "Blaster") {
            // The blaster doesn't drop: let it fall and land on its own
            let t = 0;
            while (game.activeBlock === block && game.state === "playing" && t < 30000) { world.clock.advance(100); t += 100; }
        }
        placed++;
    }

    return {
        blocks: game.blocksPlaced ?? placed,
        level: game.level ?? 1,
        score: game.score,
        over: game.state === "gameOver",
        problems,
        game, world,
    };
}

module.exports = { playGame, checkBoard, strategies };
