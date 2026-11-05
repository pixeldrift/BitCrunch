"use strict";

const { playGame } = require("./bot");

for (const seed of [1, 2, 3, 4, 5, 6]) {
    test(`bot game, seed ${seed}: board stays consistent for 150 blocks`, () => {
        const result = playGame({ seed, maxBlocks: 150, strategy: seed % 2 ? "sensible" : "random" });
        assert.deepStrictEqual(result.problems.slice(0, 5), []);
    });
}

test("a game can be restarted and starts clean", () => {
    const { game, world } = playGame({ seed: 3, maxBlocks: 20 });
    game.resetGame();
    world.clock.advance(3100);
    assert.strictEqual(game.score, 0);
    assert.strictEqual(game.board.blocks.length, 0);
    assert.strictEqual(game.state, "playing");
});
