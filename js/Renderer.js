"use strict";

// ====================
// RENDERER
// ====================

// Draws the game onto a canvas. It reads game state and never changes it.
// Nothing here knows about input or sound.
class Renderer {
    static SCOREBAR_SHADOW_PAD = 50;
    static LASER_GLOW_PAD = 28;

    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        canvas.width = Config.GRID_WIDTH;
        canvas.height = Config.GRID_HEIGHT + Config.HUD_HEIGHT;

        this.hud = new Hud();
        this.overlayTimer = null;   // Timer for the pause / game-over fill animation
        this.scorebarImage = null;  // Cached scorebar with its drop shadow
        this.imageCache = new Map();// Pre-rendered glows, keyed by name

        this.spriteSheet = new Image();
        this.spriteSheet.src = "graphics/BitCrunch-Sprite-Sheet.png";
        this.logoImage = new Image();
        this.logoImage.src = "graphics/Bit-Crunch-Logo.png";
    } // constructor


    // Resolves when the sprite sheet and logo are ready to draw
    whenReady() {
        const loaded = img => img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise(resolve => img.addEventListener("load", resolve, { once: true }));
        return Promise.all([loaded(this.spriteSheet), loaded(this.logoImage)]);
    } // whenReady


    // Build the glow images up front so the first explosion doesn't hitch
    prepare() {
        Sprites.explosion.forEach((_, i) => this.explosionGlow(i));
        this.laserGlow();
        this.ghostImage();
        this.zapGlow();
        this.getScorebarImage();
    } // prepare


    // ====================
    // Pre-rendered glows
    // ====================
    // Blur (shadowBlur) is very slow on mobile GPUs when drawn every frame. So
    // each glow is blurred ONCE into an offscreen canvas, then drawn each frame
    // as a plain image, which is cheap.

    // Render drawFn(ctx) into a new canvas of the given size, once per key
    cached(key, width, height, drawFn) {
        let image = this.imageCache.get(key);
        if (!image) {
            image = document.createElement("canvas");
            image.width = width;
            image.height = height;
            drawFn(image.getContext("2d"));
            this.imageCache.set(key, image);
        }
        return image;
    } // cached


    // Draw only the soft halo of a sprite's shape (not the sprite itself). A
    // shadow can't be drawn without its object, so the sprite is drawn far off
    // the canvas and its shadow is offset back into view.
    drawHalo(g, sprite, x, y, width, height, color, blur, passes) {
        const FAR = 4000;
        g.shadowColor = color;
        g.shadowBlur = blur;
        g.shadowOffsetX = FAR;
        for (let i = 0; i < passes; i++) {
            g.drawImage(
                this.spriteSheet,
                sprite.x, sprite.y, sprite.width, sprite.height,
                x - FAR, y, width, height
            );
        }
    } // drawHalo


    // Halo for one explosion frame
    explosionGlow(frame) {
        const PAD = 28;
        const sprite = Sprites.explosion[frame];
        return this.cached(`explosion${frame}`, sprite.width + PAD * 2, sprite.height + PAD * 2, g =>
            this.drawHalo(g, sprite, PAD, PAD, sprite.width, sprite.height, "rgba(255, 150, 20, 1)", 22, 2));
    } // explosionGlow


    // Halo for a laser beam long enough to reach the bottom of the grid. Shorter
    // beams use slices of it (see drawLaser).
    laserGlow() {
        const PAD = Renderer.LASER_GLOW_PAD;
        const sprite = Sprites.laser;
        return this.cached("laser", sprite.width + PAD * 2, Config.GRID_HEIGHT + PAD * 2, g =>
            this.drawHalo(g, sprite, PAD, PAD, sprite.width, Config.GRID_HEIGHT, "rgba(255, 140, 0, 1)", 20, 3));
    } // laserGlow


    // The ghost block: faint fill and outline with an orange glow
    ghostImage() {
        const PAD = 30;
        return this.cached("ghost", Config.BLOCK_WIDTH + PAD * 2, Config.BLOCK_HEIGHT + PAD * 2, g => {
            g.lineWidth = 3;
            g.fillStyle = "rgba(173, 216, 230, 0.1)";
            g.strokeStyle = "rgba(241, 109, 1, 0.25)";
            g.shadowColor = "rgba(241, 109, 1, 0.5)";
            g.shadowBlur = 16;
            g.fillRect(PAD, PAD, Config.BLOCK_WIDTH, Config.BLOCK_HEIGHT);
            g.strokeRect(PAD, PAD, Config.BLOCK_WIDTH, Config.BLOCK_HEIGHT);
        });
    } // ghostImage


    // The yellow glow behind each zapped block
    zapGlow() {
        const PAD = 44;
        const inset = 2;
        return this.cached("zap", Config.BLOCK_WIDTH + PAD * 2, Config.BLOCK_HEIGHT + PAD * 2, g => {
            g.shadowColor = "rgba(255, 255, 0, 1)";
            g.shadowBlur = 30;
            g.fillStyle = "rgba(255, 255, 0, 0.25)";
            g.fillRect(PAD + inset, PAD + inset, Config.BLOCK_WIDTH - inset * 2, Config.BLOCK_HEIGHT - inset * 2);
        });
    } // zapGlow


    // Convert a pointer event to canvas coordinates. The canvas is scaled with
    // CSS on small screens, so client pixels are scaled back to drawing space.
    toCanvasPoint(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (event.clientY - rect.top) * (this.canvas.height / rect.height),
        };
    } // toCanvasPoint


    // ====================
    // Frame
    // ====================

    // Draw the current screen for the game's state. The paused and game-over
    // screens are drawn once (showPause / showScoreboard) and left alone.
    draw(game) {
        if (game.isPaused || game.isGameOver) return;

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Screen shake moves the grid but never the HUD
        const shakeOffset = game.effects.shakeOffset();
        ctx.save();
        if (shakeOffset) ctx.translate(shakeOffset.x, shakeOffset.y);

        // Everything below the HUD is drawn in grid space
        ctx.translate(0, Config.HUD_HEIGHT);
        ctx.font = "24px Silkscreen";

        switch (game.state) {
            case GameState.WELCOME:   this.drawWelcomeScreen(game); break;
            case GameState.COUNTDOWN: this.drawCountdownScreen(game); break;
            case GameState.PLAYING:   this.drawPlayingScreen(game); break;
        }

        ctx.restore();

        this.drawHud(game);

        if (shakeOffset) game.requestDraw(); // Keep frames coming if the loop isn't running
    } // draw


    drawHud(game) {
        this.hud.draw(this.ctx, game, this.getScorebarImage(), Renderer.SCOREBAR_SHADOW_PAD);
    } // drawHud


    // Run a drawing function in grid space (below the HUD). For drawing that
    // happens outside of draw(), like the timed fill animation.
    inGridSpace(drawFn) {
        this.ctx.save();
        this.ctx.translate(0, Config.HUD_HEIGHT);
        drawFn();
        this.ctx.restore();
    } // inGridSpace


    // Draw with the standard soft drop shadow
    withDropShadow(drawFn) {
        const ctx = this.ctx;
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowOffsetX = 10;
        ctx.shadowOffsetY = 10;
        ctx.shadowBlur = 20;
        drawFn();
        ctx.restore();
    } // withDropShadow


    drawSprite(sprite, x, y, width = sprite.width, height = sprite.height) {
        this.ctx.drawImage(
            this.spriteSheet,
            sprite.x, sprite.y, sprite.width, sprite.height,
            x, y, width, height
        );
    } // drawSprite


    drawGridBackground() {
        this.drawSprite(Sprites.gameGrid, 0, 0, Config.GRID_WIDTH, Config.GRID_HEIGHT);
    } // drawGridBackground


    // The scorebar has a blurred drop shadow, which is expensive to draw every
    // frame. Render it once into an offscreen canvas and reuse that.
    getScorebarImage() {
        if (this.scorebarImage) return this.scorebarImage;

        const pad = Renderer.SCOREBAR_SHADOW_PAD;
        const bar = Sprites.scoreBar;
        const off = document.createElement("canvas");
        off.width = 300 + pad * 2;
        off.height = 42 + pad * 2;

        const offCtx = off.getContext("2d");
        offCtx.shadowColor = "rgba(0, 0, 0, 0.5)";
        offCtx.shadowOffsetX = 10;
        offCtx.shadowOffsetY = 10;
        offCtx.shadowBlur = 20;
        offCtx.drawImage(this.spriteSheet, bar.x, bar.y, bar.width, bar.height, pad, pad, 300, 42);

        this.scorebarImage = off;
        return off;
    } // getScorebarImage


    // ====================
    // Screens
    // ====================

    drawWelcomeScreen(game) {
        const ctx = this.ctx;

        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, Config.GRID_WIDTH, Config.GRID_HEIGHT);
        this.drawGridBackground();

        this.withDropShadow(() => {
            const logo = Sprites.logo;
            ctx.drawImage(this.logoImage, logo.x, logo.y, logo.width, logo.height);

            // Play button, highlighted when the pointer is over it
            const sprite = game.ui.hoverPlayButton ? Sprites.playButtonHighlight : Sprites.playButton;
            const b = Config.PLAY_BUTTON;
            this.drawSprite(sprite, b.x, b.y, b.width, b.height);
        });

        ctx.fillStyle = "white";
        ctx.font = "24px Silkscreen";
        ctx.textAlign = "center";
        ctx.fillText(Config.VERSION, 200, 640);
    } // drawWelcomeScreen


    drawCountdownScreen(game) {
        const ctx = this.ctx;

        this.drawGridBackground();

        ctx.fillStyle = "#f16d01";
        ctx.font = "100px Silkscreen";
        ctx.textAlign = "center";
        ctx.strokeStyle = "#682f00";
        ctx.lineWidth = 6;

        this.withDropShadow(() => {
            ctx.strokeText(game.countdownValue, 200, 390);
            ctx.fillText(game.countdownValue, 200, 390);
        });
    } // drawCountdownScreen


    drawPlayingScreen(game) {
        const ctx = this.ctx;
        const { BLOCK_WIDTH, BLOCK_HEIGHT } = Config;
        const effects = game.effects;
        const active = game.activeBlock;

        this.drawGridBackground();

        // Settled blocks (the ones exploding are drawn by their explosion)
        game.board.each(block => {
            if (block.exploding) return;
            this.drawSprite(block.type.sprite, block.x, block.y, BLOCK_WIDTH, BLOCK_HEIGHT);
        });

        // Where the active block would land
        const ghostY = active ? game.board.ghostY(active.x) : null;

        if (active && game.options.showGhost) {
            const pad = 30; // Matches ghostImage()
            ctx.drawImage(this.ghostImage(), active.x - pad, ghostY - pad);
        }

        // Blaster beam, from the blaster down to the landing spot
        if (effects.laser && active) {
            this.drawLaser(active.x, active.y + BLOCK_HEIGHT, ghostY - active.y + BLOCK_HEIGHT);
        }

        // Explosions
        for (const explosion of effects.explosions) {
            const frame = Sprites.explosion[explosion.frame];
            if (!frame) continue;

            // Glow adds light (additive), then the explosion itself on top
            const pad = 28; // Matches explosionGlow()
            ctx.globalCompositeOperation = "lighter";
            ctx.drawImage(this.explosionGlow(explosion.frame), explosion.x - pad, explosion.y - pad);
            ctx.globalCompositeOperation = "source-over";
            this.drawSprite(frame, explosion.x, explosion.y, BLOCK_WIDTH, BLOCK_HEIGHT);
        }

        if (effects.lightning) this.drawLightning(effects.lightning);

        // The active block goes on top
        if (active) {
            this.drawSprite(active.type.sprite, active.x, active.y, BLOCK_WIDTH, BLOCK_HEIGHT);
        }

        if (game.options.showScorePopups) this.drawPopups(effects.popups);
        if (game.options.drawRowNumbers) this.drawRowNumbers();
    } // drawPlayingScreen


    // The beam, with its glow. `length` is how far down it reaches.
    drawLaser(x, y, length) {
        const ctx = this.ctx;
        const pad = Renderer.LASER_GLOW_PAD;
        const glow = this.laserGlow();
        const glowWidth = Config.BLOCK_WIDTH + pad * 2;
        const maxLength = Config.GRID_HEIGHT;
        length = Math.min(length, maxLength);

        // The glow image is for a full-height beam: take the top and body, then
        // the rounded bottom end, so any shorter beam gets a proper glow.
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(glow, 0, 0, glowWidth, pad + length, x - pad, y - pad, glowWidth, pad + length);
        ctx.drawImage(glow, 0, pad + maxLength, glowWidth, pad, x - pad, y + length, glowWidth, pad);
        ctx.globalCompositeOperation = "source-over";

        this.drawSprite(Sprites.laser, x, y, Config.BLOCK_WIDTH, length);
    } // drawLaser


    drawLightning({ centerX, rowY, blocks }) {
        const ctx = this.ctx;
        const { BLOCK_WIDTH, BLOCK_HEIGHT } = Config;
        const sprite = Sprites.lightning;

        const xs = blocks.map(b => b.x);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);

        // Glow around each zapped block
        const glow = this.zapGlow();
        const glowPad = 44; // Matches zapGlow()
        blocks.forEach(({ x, y }) => ctx.drawImage(glow, x - glowPad, y - glowPad));

        const halfWidth = BLOCK_WIDTH / 2;
        const rightWidth = maxX + BLOCK_WIDTH - (centerX + halfWidth);
        const leftWidth = (centerX + halfWidth) - minX;

        // Rightward bolt
        ctx.drawImage(
            this.spriteSheet,
            sprite.x, sprite.y, rightWidth, sprite.height,
            centerX + halfWidth, rowY, rightWidth, sprite.height
        );

        // Mirrored leftward bolt
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(
            this.spriteSheet,
            sprite.x, sprite.y, leftWidth, sprite.height,
            -(centerX + halfWidth), rowY, leftWidth, sprite.height
        );
        ctx.restore();
    } // drawLightning


    drawPopups(popups) {
        const ctx = this.ctx;
        ctx.fillStyle = "#ffffff";
        ctx.font = "30px Silkscreen";
        ctx.textAlign = "center";

        for (const popup of popups) {
            ctx.globalAlpha = Math.max(popup.alpha, 0);
            ctx.fillText(popup.text, popup.x, popup.y);
        }
        ctx.globalAlpha = 1;
    } // drawPopups


    drawRowNumbers() {
        const ctx = this.ctx;
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "16px Silkscreen";
        ctx.textAlign = "left";

        for (let i = 0; i < Config.ROWS; i++) {
            const y = i * Config.BLOCK_HEIGHT + Config.BLOCK_HEIGHT / 2 + 5;
            ctx.fillText(Config.ROWS - i, 5, y);
        }
    } // drawRowNumbers


    // ====================
    // Pause and game-over overlays
    // ====================
    // These fill the grid block by block over time, then sit still. Nothing
    // redraws over them until the game leaves that state.

    cancelOverlay() {
        if (this.overlayTimer !== null) clearTimeout(this.overlayTimer);
        this.overlayTimer = null;
    } // cancelOverlay


    // Fill the grid with one block type, bottom row first, one block per `speed` ms
    fillGrid(blockType, speed, callback = null) {
        this.cancelOverlay();

        const { BLOCK_WIDTH, BLOCK_HEIGHT, GRID_WIDTH, GRID_HEIGHT } = Config;
        let x = 0;
        let y = GRID_HEIGHT - BLOCK_HEIGHT;

        const drawNext = () => {
            if (y < 0) {
                this.overlayTimer = null;
                if (callback) this.inGridSpace(callback);
                return;
            }

            this.inGridSpace(() => this.drawSprite(blockType.sprite, x, y, BLOCK_WIDTH, BLOCK_HEIGHT));

            x += BLOCK_WIDTH;
            if (x >= GRID_WIDTH) {
                x = 0;
                y -= BLOCK_HEIGHT;
            }

            this.overlayTimer = setTimeout(drawNext, speed);
        };
        drawNext();
    } // fillGrid


    showPause(game) {
        const ctx = this.ctx;

        this.fillGrid(BlockCatalog.byName("Teal"), 5, () => {
            ctx.fillStyle = "#f16d01";
            ctx.font = "60px Silkscreen";
            ctx.textAlign = "center";
            ctx.strokeStyle = "#682f00";
            ctx.lineWidth = 6;

            this.withDropShadow(() => {
                ctx.strokeText("PAUSED", 200, 380);
                ctx.fillText("PAUSED", 200, 380);
            });
        });
    } // showPause


    showScoreboard(game) {
        const ctx = this.ctx;

        // Clean slate
        this.inGridSpace(() => {
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(0, 0, Config.GRID_WIDTH, Config.GRID_HEIGHT);
            this.drawGridBackground();
        });

        this.fillGrid(BlockCatalog.byName("Orange"), 20, () => {
            this.withDropShadow(() => {
                const board = Sprites.scoreBoard;
                this.drawSprite(board, 50, 150, 300, 240);
            });

            ctx.fillStyle = "white";
            ctx.font = "38px Silkscreen";
            ctx.textAlign = "center";
            ctx.fillText(game.score, 200, 290);
            ctx.fillText(game.highScore, 200, 366);
        });
    } // showScoreboard
} // class Renderer
