"use strict";

// ====================
// GAME
// ====================

// Where we are in the life of a game
const GameState = Object.freeze({
    WELCOME:   "welcome",   // Title screen
    COUNTDOWN: "countdown", // 3, 2, 1
    PLAYING:   "playing",
    PAUSED:    "paused",
    GAME_OVER: "gameOver",
});


// Remembers the best score between visits
class HighScoreStore {
    static load() {
        try {
            const stored = localStorage.getItem(Config.HIGH_SCORE_KEY);
            return stored === null ? 0 : parseInt(stored, 10) || 0;
        } catch (e) {
            return 0; // localStorage can be unavailable (private browsing)
        }
    }

    static save(score) {
        try {
            localStorage.setItem(Config.HIGH_SCORE_KEY, score);
        } catch (e) { /* ignore */ }
    }
} // class HighScoreStore


// The rules of BitCrunch. Owns the board, the state machine, scoring, and the
// timers. It never touches the DOM: drawing goes through `renderer` and sound
// through `audio`, and input arrives as plain method calls (moveLeft, drop...).
class Game {
    constructor(renderer, audio) {
        this.renderer = renderer;
        this.audio = audio;

        this.board = new Board();
        this.effects = new Effects();
        this.spawner = new BlockSpawner(this.board);

        this.options = {
            showGhost: true,
            showScorePopups: true,
            drawRowNumbers: false,
            drawScorebar: true,
        };

        this.ui = { hoverPlayButton: false }; // Pointer hover state, set by input

        this.highScore = HighScoreStore.load();

        this.state = GameState.WELCOME;
        this.score = 0;
        this.blocksPlaced = 0;       // Blocks landed this game; drives the level
        this.blocksSinceJunk = 0;
        this.countdownValue = 3;
        this.activeBlock = null;     // The falling block
        this.dropping = false;       // Player dropped the block and it's on its way down
        this.swapInProgress = false; // A swap animation is running

        this.timers = new Set();     // Every pending timeout/interval, so a reset can cancel them
        this.animationFrameId = null;
        this.lastFrameTime = null;
        this.drawRequested = false;
        this.laserTimer = null;

        // A landed block is "resolving" while it merges and things settle; the next
        // block waits for that to finish
        this.resolvingSince = null;

        // Safety net: if no block has appeared for a long time (something got
        // stuck), make one. It must not fire during normal merges, or the next
        // block would appear while the last one is still merging.
        this.spawnWatchdog = setInterval(() => {
            if (this.state !== GameState.PLAYING || this.activeBlock || this.swapInProgress) return;
            const stuck = this.resolvingSince !== null &&
                performance.now() - this.resolvingSince > Config.RESOLVE_TIMEOUT;
            if (this.resolvingSince === null || stuck) this.createBlock();
        }, Config.SPAWN_CHECK_INTERVAL);
    } // constructor


    // ====================
    // State
    // ====================

    get isPlaying() { return this.state === GameState.PLAYING; }
    get isPaused() { return this.state === GameState.PAUSED; }
    get isGameOver() { return this.state === GameState.GAME_OVER; }
    get isRunning() { return this.isPlaying || this.isPaused; } // A game is in progress

    get level() { return Difficulty.levelFor(this.blocksPlaced); }

    // Blocks until the next junk arrives, or null if there's no junk at this level
    get junkCountdown() {
        const interval = Difficulty.junkInterval(this.level);
        return interval === null ? null : Math.max(1, interval - this.blocksSinceJunk);
    }

    // Clear everything and start a fresh game
    resetGame() {
        this.stopLoop();
        this.clearTimers();
        this.renderer.cancelOverlay();

        this.score = 0;
        this.blocksPlaced = 0;
        this.blocksSinceJunk = 0;
        this.board.clear();
        this.effects.reset();
        this.activeBlock = null;
        this.dropping = false;
        this.swapInProgress = false;
        this.resolvingSince = null;
        this.countdownValue = 3;

        this.audio.stopTheme();
        this.audio.stopMusic();
        this.audio.startMusic();

        this.startCountdown();
    } // resetGame


    // Show the title screen again
    returnToWelcome() {
        this.state = GameState.WELCOME;
        this.renderer.cancelOverlay();
        this.audio.playTheme();
        this.draw();
    } // returnToWelcome


    startCountdown() {
        this.audio.play("start");
        this.state = GameState.COUNTDOWN;
        this.countdownValue = 3;
        this.draw();

        const timer = this.every(Config.COUNTDOWN_STEP, () => {
            this.countdownValue--;
            if (this.countdownValue <= 0) {
                this.cancelTimer(timer);
                this.beginPlay();
            } else {
                this.draw();
            }
        });
    } // startCountdown


    beginPlay() {
        this.state = GameState.PLAYING;
        this.createBlock();
        this.draw();
        this.startLoop();
        this.audio.startMusic();
    } // beginPlay


    togglePause() {
        if (!this.isRunning) return;

        if (this.isPlaying) {
            this.state = GameState.PAUSED;
            this.stopLoop();
            this.audio.pauseMusic();
            this.audio.playTheme(); // The theme loops while paused
            this.audio.play("pause");
            this.renderer.showPause(this);
        } else {
            this.state = GameState.PLAYING;
            this.renderer.cancelOverlay();
            this.audio.stopTheme();
            this.audio.resumeMusic();
            this.startLoop();
        }
    } // togglePause


    pauseIfPlaying() {
        if (this.isPlaying) this.togglePause();
    } // pauseIfPlaying


    endGame() {
        this.state = GameState.GAME_OVER;
        this.stopLoop();
        this.activeBlock = null;
        this.dropping = false;

        if (this.score > this.highScore) {
            this.highScore = this.score;
            HighScoreStore.save(this.highScore);
        }

        this.audio.stopMusic();
        this.audio.play("gameOver");
        this.audio.playTheme();

        this.renderer.showScoreboard(this);
        this.renderer.drawHud(this);

        console.log("Game over! Score: " + this.score + ", high score: " + this.highScore);
    } // endGame


    // ====================
    // Timers
    // ====================
    // All delayed work goes through these so resetGame() can cancel it. (Stray
    // timers from a finished game used to be able to spawn blocks in the next one.)

    after(ms, fn) {
        const id = setTimeout(() => {
            this.timers.delete(id);
            fn();
        }, ms);
        this.timers.add(id);
        return id;
    } // after

    every(ms, fn) {
        const id = setInterval(fn, ms);
        this.timers.add(id);
        return id;
    } // every

    cancelTimer(id) {
        clearTimeout(id);
        clearInterval(id);
        this.timers.delete(id);
    } // cancelTimer

    clearTimers() {
        this.timers.forEach(id => { clearTimeout(id); clearInterval(id); });
        this.timers.clear();
        this.laserTimer = null;
    } // clearTimers


    // ====================
    // Loop and drawing
    // ====================

    startLoop() {
        if (!this.isPlaying || this.animationFrameId !== null) return;

        this.lastFrameTime = null;
        const tick = timestamp => {
            if (!this.isPlaying) {
                this.animationFrameId = null;
                return;
            }

            // Seconds since the last frame; capped so a stall doesn't teleport blocks
            const dt = this.lastFrameTime === null
                ? 0 : Math.min((timestamp - this.lastFrameTime) / 1000, 0.05);
            this.lastFrameTime = timestamp;

            this.update(dt);
            this.draw();
            this.animationFrameId = requestAnimationFrame(tick);
        };
        this.animationFrameId = requestAnimationFrame(tick);
    } // startLoop


    stopLoop() {
        if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
    } // stopLoop


    draw() {
        this.renderer.draw(this);
    } // draw


    // Ask for a redraw without drawing right now. While the loop runs it already
    // draws every frame, so this does nothing. Otherwise it schedules one draw per
    // frame, no matter how many callers ask. Paused and game-over screens are
    // static, so they're never redrawn over.
    requestDraw() {
        if (this.animationFrameId !== null || this.drawRequested) return;
        if (this.isPaused || this.isGameOver) return;

        this.drawRequested = true;
        requestAnimationFrame(() => {
            this.drawRequested = false;
            if (!this.isPaused && !this.isGameOver) this.draw();
        });
    } // requestDraw


    // Advance the game by dt seconds
    update(dt) {
        if (!this.isPlaying) return;

        this.effects.update(dt);

        const block = this.activeBlock;
        if (!block) return;

        const speed = this.dropping ? Config.DROP_SPEED : Difficulty.fallSpeed(this.level);
        const nextY = block.y + speed * dt;
        const limit = this.board.landingY(block.x, block.y);

        if (nextY >= limit) {
            block.y = Math.floor(Math.min(nextY, limit) / Config.BLOCK_HEIGHT) * Config.BLOCK_HEIGHT;
            this.landActiveBlock();
        } else {
            block.y = nextY;
        }
    } // update


    // ====================
    // Active block
    // ====================

    createBlock() {
        if (this.activeBlock || this.swapInProgress) return;

        const type = this.spawner.nextType(this.level);
        const x = Math.floor(Math.random() * Config.COLUMNS) * Config.BLOCK_WIDTH;

        // The stack reached the top
        if (this.board.isSpawnBlocked(x)) {
            this.endGame();
            return;
        }

        this.activeBlock = new Block(x, 0, type);
        this.dropping = false;
    } // createBlock


    // The falling block has come to rest
    landActiveBlock() {
        const block = this.activeBlock;
        this.activeBlock = null;
        this.board.add(block);

        this.awardPoints(block);
        this.audio.play("place");

        const levelBefore = this.level;
        this.blocksPlaced++;
        this.blocksSinceJunk++;
        if (this.level > levelBefore) this.levelUp();

        // Pause briefly so the player sees it land, then merge
        this.resolvingSince = performance.now();
        this.after(Difficulty.mergeDelay(this.level), () => {
            this.mergeBlocks(block, () => {
                this.dropping = false;
                this.resolvingSince = null;
                if (this.activeBlock || !this.isRunning) return;

                this.addJunkIfDue();
                if (!this.activeBlock && this.isRunning) this.createBlock();
            });
        });
    } // landActiveBlock


    levelUp() {
        this.audio.play("success");
        this.effects.showBanner(`LEVEL ${this.level}`);
    } // levelUp


    // Every so often, push junk up from the bottom of a few columns
    addJunkIfDue() {
        const interval = Difficulty.junkInterval(this.level);
        if (interval === null || this.blocksSinceJunk < interval) return;
        this.blocksSinceJunk = 0;

        // Columns with room for another block
        const columns = [0, 1, 2, 3].filter(c => this.board.cells[c][0] === null);
        if (columns.length === 0) {
            this.endGame(); // Every column is full to the top
            return;
        }

        // Choose some of them at random
        for (let i = columns.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [columns[i], columns[j]] = [columns[j], columns[i]];
        }
        const count = Math.min(Difficulty.junkCount(this.level), columns.length);

        for (const c of columns.slice(0, count)) {
            this.board.pushUp(c, new Block(c * Config.BLOCK_WIDTH, 0, BlockCatalog.junk));
        }

        this.audio.play("bug");
        this.shake(250, 3);
    } // addJunkIfDue


    moveLeft() { this.moveActiveBlock(-1); }
    moveRight() { this.moveActiveBlock(1); }

    moveActiveBlock(direction) {
        const block = this.activeBlock;
        if (!block || this.dropping || !this.isPlaying) return;

        const newX = block.x + direction * Config.BLOCK_WIDTH;
        if (newX < 0 || newX >= Config.GRID_WIDTH) return;
        if (this.board.isColumnBlocked(newX, block.y)) return;

        block.x = newX;
        this.audio.play(direction < 0 ? "left" : "right");
    } // moveActiveBlock


    // Drop the active block straight down (the Blaster fires instead)
    drop() {
        const block = this.activeBlock;
        if (!block || this.dropping || !this.isPlaying) return;

        if (block.type.fire(this, block)) return;

        this.dropping = true; // Falls fast, and can't be steered until it lands
        this.audio.play("drop");
    } // drop


    toggleGhost() {
        this.options.showGhost = !this.options.showGhost;
    } // toggleGhost


    toggleSfx() {
        this.audio.toggleSfx();
        this.renderer.drawHud(this);
    } // toggleSfx


    toggleMusic() {
        this.audio.toggleMusic();
        if (this.isPaused) this.audio.pauseMusic(); // Turning music on shouldn't unpause it
        this.renderer.drawHud(this);
    } // toggleMusic


    nextTrack() {
        this.audio.nextTrack();
    } // nextTrack


    // Developer cheat: change the falling block's type
    devSetActiveBlockType(type) {
        if (this.activeBlock) this.activeBlock.type = type;
    } // devSetActiveBlockType


    // ====================
    // Scoring
    // ====================

    addScore(amount, x, y) {
        this.score += amount;
        this.effects.addPopup(x + Config.BLOCK_WIDTH / 2, y, amount);
    } // addScore

    // Score a block's current value (landing, or being destroyed)
    awardPoints(block) {
        if (block.value) this.addScore(block.value, block.x, block.y);
    } // awardPoints


    // ====================
    // Board actions (used by block types)
    // ====================

    // Remove a block, then let everything above it fall
    removeBlock(block, callback = null) {
        if (!block) return;
        if (!this.board.remove(block)) return;

        this.requestDraw();

        this.after(Config.GRAVITY_DELAY, () => {
            this.applyGravity(callback);
        });
    } // removeBlock


    // Let every block fall into empty space below it
    applyGravity(callback = null) {
        const fallen = this.board.settle();
        let pending = fallen.length;

        // After falling, each may merge with what it landed on
        fallen.forEach(block => {
            this.after(Config.GRAVITY_DELAY, () => {
                this.mergeBlocks(block, () => {
                    pending--;
                    if (pending === 0 && callback) callback();
                });
            });
        });

        // Nothing fell, so we're already done
        if (pending === 0 && callback) callback();
    } // applyGravity


    // Let a settled block do its thing (specials) or merge with the block below
    mergeBlocks(block, callback = null) {
        if (!block) return;

        // It may have been merged away or destroyed while waiting its turn
        if (!this.board.has(block)) return callback?.();

        block.type.land(this, block, callback);
    } // mergeBlocks


    // Combine with the block below if the values match (or one is Wild)
    standardMerge(block, callback = null) {
        const below = this.board.blockAt(block.x, block.y + Config.BLOCK_HEIGHT);
        if (!below) return callback?.();

        const isWild = block.type instanceof WildBlockType || below.type instanceof WildBlockType;
        const bothNumeric = block.value !== null && below.value !== null;
        const canMerge = isWild || (bothNumeric && block.value === below.value);
        if (!canMerge) return callback?.();

        const baseValue = block.value ?? below.value ?? 0;
        const upgradedValue = baseValue * 2;
        const upgradedType = BlockCatalog.byValue(upgradedValue);

        this.removeBlock(below);
        this.board.move(block, block.y + Config.BLOCK_HEIGHT);

        if (upgradedType) {
            block.type = upgradedType;
            this.addScore(upgradedValue, block.x, block.y);
            this.audio.play("merge");

            // Check again: the result may merge with the next block down
            this.after(Config.GRAVITY_DELAY, () => this.mergeBlocks(block, callback));
        } else {
            // Two 256s make a byte: they vanish for a bonus
            this.audio.play("merge");
            this.audio.play("success");
            this.addScore(upgradedValue, block.x, block.y);
            this.removeBlock(block);

            this.after(Config.GRAVITY_DELAY, () => callback?.());
        }
    } // standardMerge


    // ====================
    // Animations (used by block types)
    // ====================

    shake(duration, intensity) {
        this.effects.startShake(duration, intensity);
        this.requestDraw();
    } // shake


    // Play the explosion on a block, then remove it from the board
    explodeBlock(block, callback = null) {
        if (!block) return;

        const explosion = { x: block.x, y: block.y, frame: 0 };
        block.exploding = true;
        this.effects.explosions.push(explosion);
        this.audio.play("smallBoom");

        const frameCount = Sprites.explosion.length;
        let frame = 0;

        const step = () => {
            if (frame < frameCount) {
                explosion.frame = frame++;
                this.requestDraw();
                this.after(Config.EXPLOSION_FRAME_DURATION, step);
                return;
            }

            this.board.remove(block);
            this.effects.explosions = this.effects.explosions.filter(e => e !== explosion);
            block.exploding = false;
            callback?.();
        };
        step();
    } // explodeBlock


    // Briefly flicker a block between its own type and another
    flickerBlock(block, alternateType, flickers = 3, interval = 100) {
        const originalType = block.type;
        let count = 0;

        const toggle = () => {
            if (count < flickers) {
                block.type = block.type === originalType ? alternateType : originalType;
                count++;
                this.after(interval, toggle);
            } else {
                block.type = originalType;
            }
        };
        toggle();
    } // flickerBlock


    // Flash the zap lightning across a row, then call back
    flashLightning(centerX, rowY, blocks, callback = null) {
        const flashes = 3;
        const interval = 100;
        let step = 0;

        const flash = () => {
            const visible = step % 2 === 0;
            this.effects.lightning = visible ? { centerX, rowY, blocks } : null;
            this.requestDraw();
            step++;

            if (step < flashes * 2) {
                this.after(interval, flash);
            } else {
                this.effects.lightning = null;
                callback?.();
            }
        };
        flash();
    } // flashLightning


    // Fire the blaster's laser at the first block below it
    fireBlaster(blaster) {
        this.audio.play("laser");

        const target = this.board.column(blaster.x)
            .find(b => b.y > blaster.y && !b.exploding);

        if (target) {
            this.explodeBlock(target);
            this.awardPoints(target);
        }

        // Show the beam briefly
        if (this.laserTimer !== null) this.cancelTimer(this.laserTimer);
        this.effects.laser = { x: blaster.x };
        this.laserTimer = this.after(Config.LASER_DURATION, () => {
            this.effects.laser = null;
            this.laserTimer = null;
        });
    } // fireBlaster


    // Swap two vertically stacked blocks with an arcing animation. The upper
    // block ends up below, the lower one above.
    swapBlocks(upper, lower, callback = null) {
        this.swapInProgress = true;

        const centerY = (upper.y + lower.y) / 2;
        const radius = Config.BLOCK_HEIGHT / 2;
        const DURATION = 20 / 60 * 1000;

        // Animate copies, so the originals can be left out of the board
        const movingUpper = new Block(upper.x, upper.y, upper.type);
        const movingLower = new Block(lower.x, lower.y, lower.type);
        this.board.remove(upper);
        this.board.remove(lower);
        this.board.addFloating(movingUpper);
        this.board.addFloating(movingLower);

        const startTime = performance.now();

        const step = now => {
            const progress = Math.min((now - startTime) / DURATION, 1);
            const angle = Math.PI * progress;
            const offsetX = radius * Math.sin(angle);
            const offsetY = radius * Math.cos(angle);

            movingUpper.x = upper.x + offsetX;
            movingUpper.y = centerY - offsetY;
            movingLower.x = lower.x - offsetX;
            movingLower.y = centerY + offsetY;

            if (progress < 1) {
                requestAnimationFrame(step);
                return;
            }

            // Land exactly on the grid, with positions traded
            movingUpper.x = upper.x;
            movingLower.x = lower.x;
            movingUpper.y = lower.y;
            movingLower.y = upper.y;
            this.board.place(movingUpper);
            this.board.place(movingLower);

            // Short pause, then settle and merge
            this.after(300, () => {
                this.applyGravity(() => {
                    this.mergeBlocks(movingUpper);
                    this.mergeBlocks(movingLower);
                });

                this.swapInProgress = false;
                callback?.();
            });
        };
        requestAnimationFrame(step);
    } // swapBlocks
} // class Game
