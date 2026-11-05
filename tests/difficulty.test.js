"use strict";

const { createWorld } = require("./harness");
const { playGame } = require("./bot");

const world = createWorld(1);
const D = (code) => world.run(code);

test("levels: a new one every 10 blocks placed", () => {
    assert.strictEqual(D("Difficulty.levelFor(0)"), 1);
    assert.strictEqual(D("Difficulty.levelFor(9)"), 1);
    assert.strictEqual(D("Difficulty.levelFor(10)"), 2);
    assert.strictEqual(D("Difficulty.levelFor(95)"), 10);
});

test("fall speed: 12 s to cross the grid at level 1, never slower, capped at 1.5 s", () => {
    assert.strictEqual(D("Difficulty.fallSpeed(1)"), 60);
    assert.strictEqual(D("Difficulty.fallTime(1)"), 12);
    let previous = 0;
    for (let level = 1; level <= 40; level++) {
        const speed = D(`Difficulty.fallSpeed(${level})`);
        assert.ok(speed >= previous, `level ${level} slower than the one before`);
        previous = speed;
    }
    assert.strictEqual(D("Difficulty.fallSpeed(40)"), 480);
    assert.strictEqual(D("Difficulty.fallTime(40)"), 1.5);
});

test("merge delay shrinks with level but has a floor", () => {
    assert.strictEqual(D("Difficulty.mergeDelay(1)"), 200);
    assert.ok(D("Difficulty.mergeDelay(5)") < 200);
    assert.strictEqual(D("Difficulty.mergeDelay(50)"), 60);
});

test("junk: none early, then more often, then more of it, never a full row", () => {
    assert.strictEqual(D("Difficulty.junkInterval(1)"), null);
    assert.strictEqual(D("Difficulty.junkInterval(3)"), null);
    assert.strictEqual(D("Difficulty.junkInterval(4)"), 18);
    assert.ok(D("Difficulty.junkInterval(8)") < D("Difficulty.junkInterval(4)"));
    assert.strictEqual(D("Difficulty.junkInterval(60)"), 10);
    assert.strictEqual(D("Difficulty.junkCount(4)"), 1);
    assert.strictEqual(D("Difficulty.junkCount(60)"), 3);
});

test("specials: helpful ones get rarer, Bug commoner, Wild unchanged", () => {
    assert.ok(D('Difficulty.specialWeight("Nuke", 10)') < D('Difficulty.specialWeight("Nuke", 1)'));
    assert.ok(D('Difficulty.specialWeight("Bug", 10)') > D('Difficulty.specialWeight("Bug", 1)'));
    assert.strictEqual(D('Difficulty.specialWeight("Wild", 10)'), 1);
    assert.strictEqual(D('Difficulty.specialWeight("Bomb", 1)'), 1);
});

// ----- In the game -----

test("the level goes up as blocks land, with a banner", () => {
    const w = createWorld(1);
    const game = w.startPlaying();
    game.blocksPlaced = 9;
    game.activeBlock.y = 600;       // Almost at the bottom
    w.clock.advance(2000);          // It lands
    assert.strictEqual(game.level, 2);
    assert.strictEqual(game.effects.banner.text, "LEVEL 2");
});

test("falling gets faster at higher levels", () => {
    const fallDistance = level => {
        const w = createWorld(1);
        const game = w.startPlaying();
        game.blocksPlaced = (level - 1) * 10;
        game.activeBlock.y = 0;
        w.clock.advance(1000);
        return game.activeBlock.y;
    };
    assert.ok(fallDistance(8) > fallDistance(1) * 2);
});

test("junk rises into columns that have room, and only when due", () => {
    const w = createWorld(1);
    const game = w.startPlaying();
    game.createBlock = () => {};
    game.activeBlock = null;
    game.blocksPlaced = 30;                 // Level 4: junk is on
    game.blocksSinceJunk = 0;
    game.addJunkIfDue();
    assert.strictEqual(game.board.blocks.length, 0, "too early for junk");

    game.blocksSinceJunk = 18;
    game.addJunkIfDue();
    const junk = game.board.blocks;
    assert.strictEqual(junk.length, 1);
    assert.strictEqual(junk[0].type.name, "Junk");
    assert.strictEqual(junk[0].y, 660);
    assert.strictEqual(game.blocksSinceJunk, 0);
});

test("junk pushes the column up, and a full column ends the game", () => {
    const w = createWorld(1);
    const game = w.startPlaying();
    game.createBlock = () => {};
    game.activeBlock = null;
    game.blocksPlaced = 30;
    const make = (x, y, n) => w.run(`new Block(${x}, ${y}, BlockCatalog.byName("${n}"))`);

    // Three columns packed to the top, one with a single block
    for (const c of [0, 1, 2]) for (let r = 0; r < 12; r++) game.board.add(make(c * 100, r * 60, "2"));
    game.board.add(make(300, 660, "8"));
    game.blocksSinceJunk = 18;
    game.addJunkIfDue();

    // The only column with room got the junk, and the 8 moved up one row
    assert.strictEqual(game.board.blockAt(300, 660).type.name, "Junk");
    assert.strictEqual(game.board.blockAt(300, 600).type.name, "8");

    // Now every column is full to the top: the next junk is game over
    game.board.add(make(300, 0, "4"));
    game.blocksSinceJunk = 18;
    game.addJunkIfDue();
    assert.strictEqual(game.state, "gameOver");
});

test("Wild landing on junk removes both", () => {
    const w = createWorld(1);
    const game = w.startPlaying();
    game.createBlock = () => {};
    game.activeBlock = null;
    game.board.add(w.run('new Block(0, 660, BlockCatalog.junk)'));
    game.activeBlock = w.run('new Block(0, 0, BlockCatalog.byName("Wild"))');
    game.drop();
    w.clock.advance(2000);
    assert.strictEqual(game.board.blocks.length, 0);
});

// ----- Balance guard rails -----
// The bot is a crude player, but if these fail the difficulty curve has been
// changed a lot. Tune in Config.js, then update the ranges on purpose.

test("balance: a decent bot survives a while but not forever", () => {
    const blocks = [];
    for (let seed = 1; seed <= 12; seed++) {
        blocks.push(playGame({ seed, maxBlocks: 600, strategy: "sensible", check: false, reaction: 0.8 }).blocks);
    }
    blocks.sort((a, b) => a - b);
    const median = blocks[Math.floor(blocks.length / 2)];
    assert.ok(median >= 70 && median <= 220, `median ${median} blocks is outside 70-220`);
    assert.ok(blocks[blocks.length - 1] < 600, "a bot survived 600 blocks: it's too easy again");
});

test("balance: playing randomly loses quickly", () => {
    const result = playGame({ seed: 1, maxBlocks: 600, strategy: "random", check: false });
    assert.ok(result.over && result.blocks < 150);
});
