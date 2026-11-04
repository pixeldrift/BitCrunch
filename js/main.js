"use strict";

// ====================
// MAIN
// ====================
// Wires the pieces together and starts the game. This is the only file that
// touches the page itself (the canvas element and the font).

(function main() {
    const canvas = document.getElementById("gameCanvas"); // Named in the HTML

    const renderer = new Renderer(canvas);
    const audio = new AudioManager();
    const game = new Game(renderer, audio);

    new KeyboardController(game);
    new MouseController(game, renderer, canvas);
    new TouchController(game, renderer, canvas);
    new WindowController(game);

    // Load the pixel font from Google Fonts
    const font = new FontFace(
        "Silkscreen",
        "url(https://fonts.gstatic.com/s/silkscreen/v4/m8JXjfVPf62XiF7kO-i9YLNla0GA1dM.woff2)"
    );
    font.load().then(loaded => document.fonts.add(loaded)).catch(() => {});

    // Show the welcome screen once the images and fonts are ready
    Promise.all([renderer.whenReady(), document.fonts.ready]).then(() => {
        renderer.prepare();
        game.draw();
        audio.playTheme(); // Starts on the first tap or key press if the browser blocks it now
        console.log("It's time to BitCrunch!");
    });

    // Exposed for the browser console and automated tests
    window.game = game;
})();
