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

        // Draw at the screen's pixel density (capped: every extra pixel costs
        // frame time on a phone). All drawing code keeps using the 400 x 790
        // logical size; the context scales it up.
        this.totalHeight = Config.GRID_HEIGHT + Config.HUD_HEIGHT;
        this.scale = Math.max(1, Math.min(window.devicePixelRatio || 1, Config.MAX_PIXEL_RATIO));
        canvas.width = Math.round(Config.GRID_WIDTH * this.scale);
        canvas.height = Math.round(this.totalHeight * this.scale);
        this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

        this.hud = new Hud();
        this.overlayTimer = null;   // Timer for the pause / game-over fill animation
        this.imageCache = new Map();// Pre-rendered glows and the scorebar, keyed by name
        this.hudKey = null;         // What the HUD last drew, so it's only redrawn on change

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
            image.width = Math.round(width * this.scale);
            image.height = Math.round(height * this.scale);
            image.logicalWidth = width;
            image.logicalHeight = height;

            const g = image.getContext("2d");
            g.scale(this.scale, this.scale);
            drawFn(g);
            this.imageCache.set(key, image);
        }
        return image;
    } // cached


    // Draw a cached image with its top-left at (x, y), at its logical size
    blit(image, x, y) {
        this.ctx.drawImage(image, x, y, image.logicalWidth, image.logicalHeight);
    } // blit


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
            x: (event.clientX - rect.left) * (Config.GRID_WIDTH / rect.width),
            y: (event.clientY - rect.top) * (this.totalHeight / rect.height),
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

        // The grid redraws every frame, clipped to its own area so it can never
        // spill onto the HUD (shaking moves it a few pixels)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, Config.HUD_HEIGHT, Config.GRID_WIDTH, Config.GRID_HEIGHT);
        ctx.clip();
        ctx.clearRect(0, Config.HUD_HEIGHT, Config.GRID_WIDTH, Config.GRID_HEIGHT);

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
            case GameState.HELP:      this.drawHelpScreen(game); break;
        }

        ctx.restore(); // Shake and grid offset
        ctx.restore(); // Clip

        // The HUD only changes now and then, so it's redrawn only when it does
        if (this.currentHudKey(game) !== this.hudKey) this.drawHud(game);

        if (shakeOffset) game.requestDraw(); // Keep frames coming if the loop isn't running
    } // draw


    // Everything the HUD shows, as a string. When it changes, the HUD needs redrawing.
    currentHudKey(game) {
        return `${game.score}|${game.level}|${game.junkCountdown}|${game.audio.musicOn}|${game.audio.sfxOn}|${game.options.drawScorebar}`;
    } // currentHudKey


    drawHud(game) {
        this.hudKey = this.currentHudKey(game);
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
        const pad = Renderer.SCOREBAR_SHADOW_PAD;
        const bar = Sprites.scoreBar;

        return this.cached("scorebar", 300 + pad * 2, 42 + pad * 2, g => {
            g.shadowColor = "rgba(0, 0, 0, 0.5)";
            g.shadowOffsetX = 10;
            g.shadowOffsetY = 10;
            g.shadowBlur = 20;
            g.drawImage(this.spriteSheet, bar.x, bar.y, bar.width, bar.height, pad, pad, 300, 42);
        });
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

        this.drawHelpButton(Config.HELP_BUTTONS.welcome, true);

        ctx.fillStyle = "white";
        ctx.font = "24px Silkscreen";
        ctx.textAlign = "center";
        ctx.fillText(Config.VERSION, 200, 698);
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
            this.blit(this.ghostImage(), active.x - pad, ghostY - pad);
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
            this.blit(this.explosionGlow(explosion.frame), explosion.x - pad, explosion.y - pad);
            ctx.globalCompositeOperation = "source-over";
            this.drawSprite(frame, explosion.x, explosion.y, BLOCK_WIDTH, BLOCK_HEIGHT);
        }

        if (effects.lightning) this.drawLightning(effects.lightning);

        // The active block goes on top
        if (active) {
            this.drawSprite(active.type.sprite, active.x, active.y, BLOCK_WIDTH, BLOCK_HEIGHT);
        }

        if (game.options.showScorePopups) this.drawPopups(effects.popups);
        if (effects.banner) this.drawBanner(effects.banner);
        if (game.options.drawRowNumbers) this.drawRowNumbers();
    } // drawPlayingScreen


    // "LEVEL 5", big in the middle of the grid, fading out
    drawBanner(banner) {
        const ctx = this.ctx;
        const fadeTime = 0.5;
        const remaining = Config.LEVEL_BANNER_TIME - banner.age;

        ctx.globalAlpha = Math.max(0, Math.min(1, remaining / fadeTime));
        ctx.font = "48px Silkscreen";
        ctx.textAlign = "center";
        ctx.lineWidth = 8;
        ctx.strokeStyle = "#682f00";
        ctx.fillStyle = "#f16d01";
        ctx.strokeText(banner.text, 200, 300);
        ctx.fillText(banner.text, 200, 300);
        ctx.globalAlpha = 1;
    } // drawBanner


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
        const k = this.scale; // Source coordinates are in the image's own pixels
        ctx.drawImage(glow, 0, 0, glowWidth * k, (pad + length) * k, x - pad, y - pad, glowWidth, pad + length);
        ctx.drawImage(glow, 0, (pad + maxLength) * k, glowWidth * k, pad * k, x - pad, y + length, glowWidth, pad);
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
        blocks.forEach(({ x, y }) => this.blit(glow, x - glowPad, y - glowPad));

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


    // Fill the grid with one block type, bottom row first, one block per `speed` ms.
    // A speed of 0 fills it all at once.
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

            if (speed > 0) this.overlayTimer = setTimeout(drawNext, speed);
            else drawNext();
        };
        drawNext();
    } // fillGrid


    showPause(game, animate = true) {
        const ctx = this.ctx;

        this.fillGrid(BlockCatalog.byName("Teal"), animate ? 5 : 0, () => {
            ctx.fillStyle = "#f16d01";
            ctx.font = "60px Silkscreen";
            ctx.textAlign = "center";
            ctx.strokeStyle = "#682f00";
            ctx.lineWidth = 6;

            this.withDropShadow(() => {
                ctx.strokeText("PAUSED", 200, 380);
                ctx.fillText("PAUSED", 200, 380);
            });

            this.drawHelpButton(Config.HELP_BUTTONS.paused);
        });
    } // showPause


    showScoreboard(game, animate = true) {
        const ctx = this.ctx;

        // Clean slate
        this.inGridSpace(() => {
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(0, 0, Config.GRID_WIDTH, Config.GRID_HEIGHT);
            this.drawGridBackground();
        });

        this.fillGrid(BlockCatalog.byName("Orange"), animate ? 20 : 0, () => {
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


    // ====================
    // Help screen
    // ====================

    // The "HOW TO PLAY" button (in grid space). On the title screen it's just text.
    drawHelpButton(rect, textOnly = false) {
        const ctx = this.ctx;

        if (!textOnly) {
            this.withDropShadow(() => {
                this.drawSprite(BlockCatalog.byName("Teal").sprite, rect.x, rect.y, rect.width, rect.height);
            });
        }

        const label = "HOW TO PLAY";
        const x = rect.x + rect.width / 2;
        const y = rect.y + rect.height / 2 + 7;

        ctx.font = "20px Silkscreen";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#682f00";
        ctx.fillStyle = "#f16d01";
        ctx.strokeText(label, x, y);
        ctx.fillText(label, x, y);

        if (textOnly) { // Underline, so it reads as a link
            const half = ctx.measureText(label).width / 2;
            ctx.fillStyle = "#682f00";
            ctx.fillRect(x - half - 2, y + 5, half * 2 + 4, 5);
            ctx.fillStyle = "#f16d01";
            ctx.fillRect(x - half, y + 6, half * 2, 3);
        }
    } // drawHelpButton


    // Is a canvas point on this screen's "HOW TO PLAY" button?
    helpButtonAt(game, point) {
        const rect = Config.HELP_BUTTONS[game.state];
        if (!rect) return false;
        const y = point.y - Config.HUD_HEIGHT; // Canvas -> grid space
        return point.x >= rect.x && point.x <= rect.x + rect.width &&
               y >= rect.y && y <= rect.y + rect.height;
    } // helpButtonAt


    // What was tapped on the help screen? "close", "back" or "next"
    helpTargetAt(point) {
        const c = Config.HELP_CLOSE;
        const y = point.y - Config.HUD_HEIGHT;
        if (point.x >= c.x && point.x <= c.x + c.width && y >= c.y && y <= c.y + c.height) return "close";
        return point.x < Config.GRID_WIDTH / 2 ? "back" : "next";
    } // helpTargetAt


    // Break text into lines no wider than maxWidth (using the current font)
    wrapText(text, maxWidth) {
        const lines = [];
        let line = "";
        for (const word of text.split(" ")) {
            const attempt = line ? line + " " + word : word;
            if (line && this.ctx.measureText(attempt).width > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = attempt;
            }
        }
        if (line) lines.push(line);
        return lines;
    } // wrapText


    drawHelpScreen(game) {
        const ctx = this.ctx;
        const W = Config.GRID_WIDTH, H = Config.GRID_HEIGHT;
        const pages = game.helpPages;
        const page = pages[game.helpPage];
        const MARGIN = 24;

        // Dim the grid so the text reads clearly
        this.drawGridBackground();
        ctx.fillStyle = "rgba(6, 20, 28, 0.9)";
        ctx.fillRect(0, 0, W, H);

        // Title
        ctx.textAlign = "center";
        ctx.font = "28px Silkscreen";
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#682f00";
        ctx.fillStyle = "#f16d01";
        ctx.strokeText(page.title, W / 2 - 14, 50);
        ctx.fillText(page.title, W / 2 - 14, 50);

        // Close button: an X
        const c = Config.HELP_CLOSE;
        const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#f16d01";
        ctx.beginPath();
        ctx.moveTo(cx - 9, cy - 9); ctx.lineTo(cx + 9, cy + 9);
        ctx.moveTo(cx + 9, cy - 9); ctx.lineTo(cx - 9, cy + 9);
        ctx.stroke();
        ctx.lineCap = "butt";

        // Body
        let y = 92;
        for (const item of page.items) y = this.drawHelpItem(item, y, MARGIN, W - MARGIN * 2);

        // Footer: page dots, and what the taps do
        const dotSize = 10, gap = 10;
        const dotsWidth = pages.length * dotSize + (pages.length - 1) * gap;
        pages.forEach((_, i) => {
            ctx.fillStyle = i === game.helpPage ? "#f16d01" : "rgba(255, 255, 255, 0.25)";
            ctx.fillRect(W / 2 - dotsWidth / 2 + i * (dotSize + gap), H - 40, dotSize, dotSize);
        });

        ctx.font = "14px Silkscreen";
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.textAlign = "left";
        if (game.helpPage > 0) ctx.fillText("< BACK", MARGIN, H - 14);
        ctx.textAlign = "right";
        ctx.fillText(game.helpPage < pages.length - 1 ? "NEXT >" : "DONE >", W - MARGIN, H - 14);
    } // drawHelpScreen


    // Draw one piece of help content at height y. Returns the height where the next piece starts.
    drawHelpItem(item, y, x, width) {
        const ctx = this.ctx;
        ctx.textAlign = "left";

        switch (item.type) {
            case "paragraph": {
                ctx.font = "15px Silkscreen";
                ctx.fillStyle = "#e8f1f2";
                for (const line of this.wrapText(item.text, width)) {
                    ctx.fillText(line, x, y + 14);
                    y += 21;
                }
                return y + 12;
            }

            case "heading": {
                ctx.font = "18px Silkscreen";
                ctx.fillStyle = "#f16d01";
                ctx.fillText(item.text, x, y + 16);
                ctx.fillStyle = "rgba(241, 109, 1, 0.5)";
                ctx.fillRect(x, y + 24, width, 2);
                return y + 38;
            }

            case "rows": {
                const keyWidth = 124;
                ctx.font = "14px Silkscreen";
                for (const [key, text] of item.rows) {
                    const keyLines = this.wrapText(key, keyWidth);
                    const textLines = this.wrapText(text, width - keyWidth - 10);
                    ctx.fillStyle = "#f16d01";
                    keyLines.forEach((l, i) => ctx.fillText(l, x, y + 13 + i * 19));
                    ctx.fillStyle = "#e8f1f2";
                    textLines.forEach((l, i) => ctx.fillText(l, x + keyWidth + 10, y + 13 + i * 19));
                    y += Math.max(keyLines.length, textLines.length) * 19 + 11;
                }
                return y + 6;
            }

            case "block": {
                const type = BlockCatalog.byName(item.name);
                this.drawSprite(type.sprite, x, y, 63, 38);

                ctx.font = "16px Silkscreen";
                ctx.fillStyle = "#f16d01";
                ctx.fillText(item.name.toUpperCase(), x + 78, y + 14);

                ctx.font = "13px Silkscreen";
                ctx.fillStyle = "#e8f1f2";
                const lines = this.wrapText(item.text, width - 78);
                lines.forEach((l, i) => ctx.fillText(l, x + 78, y + 32 + i * 17));
                return y + Math.max(48, 26 + lines.length * 17 + 8);
            }

            case "numbers": {
                const w = 36, h = 22, gap = 3;
                const total = BlockCatalog.numbers.length * (w + gap) - gap;
                BlockCatalog.numbers.forEach((t, i) =>
                    this.drawSprite(t.sprite, x + (width - total) / 2 + i * (w + gap), y, w, h));
                return y + h + 14;
            }
        }
        return y;
    } // drawHelpItem
} // class Renderer
