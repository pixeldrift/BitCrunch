"use strict";

const { createWorld } = require("./harness");

function newGame() {
    const world = createWorld(1);
    return { world, game: world.game };
}

test("help: opens from the title screen and returns to it", () => {
    const { game } = newGame();
    game.openHelp();
    assert.strictEqual(game.state, "help");
    game.closeHelp();
    assert.strictEqual(game.state, "welcome");
});

test("help: can't be opened while playing or counting down", () => {
    const { world, game } = newGame();
    game.resetGame();                       // Countdown
    game.openHelp();
    assert.strictEqual(game.state, "countdown");
    world.clock.advance(3100);              // Playing
    game.openHelp();
    assert.strictEqual(game.state, "playing");
});

test("help: from the pause screen, the game stays paused underneath and can resume", () => {
    const { world, game } = newGame();
    world.startPlaying();
    const block = game.activeBlock;
    game.togglePause();
    assert.strictEqual(game.state, "paused");

    game.openHelp();
    assert.strictEqual(game.state, "help");
    assert.ok(game.isRunning, "a paused game is still in progress while reading help");
    game.togglePause();                     // Must not resume behind the help screen
    assert.strictEqual(game.state, "help");

    game.closeHelp();
    assert.strictEqual(game.state, "paused");
    game.togglePause();
    assert.strictEqual(game.state, "playing");
    assert.strictEqual(game.activeBlock, block, "the falling block is untouched");
});

test("help: from the game-over screen, returns to game over", () => {
    const { world, game } = newGame();
    world.startPlaying();
    game.endGame();
    game.openHelp();
    assert.strictEqual(game.state, "help");
    assert.ok(!game.isRunning);
    game.closeHelp();
    assert.strictEqual(game.state, "gameOver");
});

test("help: pages are clamped, and tapping next on the last page closes", () => {
    const { game } = newGame();
    const last = 3; // Four pages
    game.openHelp();
    game.helpGo(-1);
    assert.strictEqual(game.helpPage, 0);
    for (let i = 0; i < 10; i++) game.helpGo(1);
    assert.strictEqual(game.helpPage, last);
    assert.strictEqual(game.state, "help");
    game.helpNext();
    assert.strictEqual(game.state, "welcome");
});

test("help: reopening starts on the first page", () => {
    const { game } = newGame();
    game.openHelp(); game.helpGo(2); game.closeHelp();
    game.openHelp();
    assert.strictEqual(game.helpPage, 0);
});

test("help content: pages are filled in, and every block it shows exists", () => {
    const { world } = newGame();
    const pages = JSON.parse(JSON.stringify(world.run("HelpContent.pages")));
    assert.strictEqual(pages.length, 4);
    const known = JSON.parse(JSON.stringify(world.run("BlockCatalog.all.map(t => t.name)")));
    for (const page of pages) {
        assert.ok(page.title && page.items.length > 0);
        for (const item of page.items.filter(i => i.type === "block")) {
            assert.ok(known.includes(item.name), "unknown block " + item.name);
            assert.ok(item.text.length > 0);
        }
    }
    // Every special block is explained somewhere
    const explained = pages.flatMap(p => p.items.filter(i => i.type === "block").map(i => i.name));
    JSON.parse(JSON.stringify(world.run("BlockCatalog.specials.map(t => t.name)")))
        .forEach(name => assert.ok(explained.includes(name), name + " is missing from the help screen"));
});
