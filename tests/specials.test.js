"use strict";

// Each special block, dropped onto a hand-built board. The expected boards for the
// non-random ones were checked against the original hand-written game
// (archive/original-v0.02.2) before this suite existed.

const { createWorld } = require("./harness");

// Set up a board from { column: [names top-to-bottom] }, drop a block, let it all play out
function play({ cols, drop: [name, column], wait = 2500, fireOnly = false, seed = 7 }) {
    const world = createWorld(1);
    const game = world.startPlaying();
    game.createBlock = () => {};            // no new blocks while we watch
    game.activeBlock = null;
    game.board.clear();
    game.score = 0;
    game.swapInProgress = false;
    game.dropping = false;

    const make = (x, y, n) => world.run(`new Block(${x}, ${y}, BlockCatalog.byName("${n}"))`);

    for (const [col, names] of Object.entries(cols)) {
        names.slice().reverse().forEach((n, i) => game.board.add(make(Number(col) * 100, 660 - i * 60, n)));
    }

    game.activeBlock = make(column * 100, 0, name);
    world.seed(seed);
    game.drop();
    world.clock.advance(fireOnly ? 600 : wait);

    const list = game.board.blocks
        .map(b => [b.x, Math.round(b.y), b.type.name])
        .sort((p, q) => p[0] - q[0] || p[1] - q[1])
        .map(p => p.join(":"))
        .join(" ");
    return { list, score: game.score };
}

const cases = {
    swap:      [{ cols: { 0: ["1", "2", "4"] }, drop: ["Swap", 0] }, "0:540:2 0:600:1 0:660:4", 0],
    swapShort: [{ cols: { 0: ["1"] }, drop: ["Swap", 0] }, "0:660:1", 0],
    swapMerge: [{ cols: { 0: ["4", "2", "2"] }, drop: ["Swap", 0] }, "0:540:2 0:600:4 0:660:2", 0],
    bomb:      [{ cols: { 1: ["2", "4"] }, drop: ["Bomb", 1] }, "100:660:4", 2],
    bombNone:  [{ cols: {}, drop: ["Bomb", 1] }, "", 0],
    bugOnWild: [{ cols: { 2: ["Wild"] }, drop: ["Bug", 2] }, "", 0],
    wildOnBug: [{ cols: { 2: ["Bug"] }, drop: ["Wild", 2] }, "", 0],
    wildOnNum: [{ cols: { 2: ["8"] }, drop: ["Wild", 2] }, "200:660:16", 16],
    zap:       [{ cols: { 0: ["2"], 1: ["4"], 2: ["8"], 3: ["16"] }, drop: ["Zap", 1] }, "", 30],
    zapGap:    [{ cols: { 0: ["2"], 2: ["8"], 3: ["16"] }, drop: ["Zap", 2] }, "0:660:2", 24],
    nuke:      [{ cols: { 3: ["2", "4", "8"] }, drop: ["Nuke", 3] }, "", 14],
    merge256:  [{ cols: { 0: ["256"] }, drop: ["256", 0] }, "", 768],
    chain:     [{ cols: { 0: ["16", "8", "4", "2"] }, drop: ["2", 0] }, "0:420:2 0:480:16 0:540:8 0:600:4 0:660:2", 2],
    blaster:   [{ cols: { 3: ["4", "8"] }, drop: ["Blaster", 3], fireOnly: true }, "300:660:8", 4],
};

for (const [name, [setup, expectedBoard, expectedScore]] of Object.entries(cases)) {
    test("special: " + name, () => {
        const result = play(setup);
        assert.strictEqual(result.list, expectedBoard);
        assert.strictEqual(result.score, expectedScore);
    });
}

test("special: magnet keeps the same blocks, rearranged, and is deterministic", () => {
    const setup = { cols: { 1: ["1", "2", "4", "8", "16"] }, drop: ["Magnet", 1] };
    const a = play(setup), b = play(setup);
    assert.strictEqual(a.list, b.list);
    const values = a.list.split(" ").map(s => s.split(":")[2]).sort();
    assert.deepStrictEqual(values, ["1", "16", "2", "4", "8"]);
    assert.strictEqual(a.score, 0);
});
