"use strict";

// ====================
// MAIN
// ====================
// Wires the pieces together and starts the game. This is the only file that
// touches the page itself (the canvas element).

(function main() {
    const canvas = document.getElementById("gameCanvas"); // Named in the HTML

    const renderer = new Renderer(canvas);
    const audio = new AudioManager();
    const game = new Game(renderer, audio);

    // A phone or tablet's main pointer is a finger. Laptops with touchscreens still report a mouse/trackpad.
    game.options.touchDevice = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);

    new KeyboardController(game);
    new MouseController(game, renderer, canvas);
    new TouchController(game, renderer, canvas);
    new WindowController(game);

    // Show the welcome screen once the images and fonts are ready
    // The font comes from index.html (self-hosted); wait for it so the first screen isn't drawn in a fallback font
    const fontReady = document.fonts.load('24px Silkscreen').catch(() => {});

    Promise.all([renderer.whenReady(), fontReady]).then(() => {
        renderer.prepare();
        game.draw();
        audio.playTheme(); // Starts on the first tap or key press if the browser blocks it now
        console.log("It's time to BitCrunch!");
    });

    // Exposed for the browser console and automated tests
    window.game = game;
})();
