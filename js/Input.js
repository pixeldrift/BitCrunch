"use strict";

// ====================
// INPUT
// ====================
// Each controller turns raw browser events into plain Game commands
// (moveLeft, drop, togglePause...). The game doesn't know where they came from.

// Shared between the controllers: when the last touch happened, so the click the
// browser sends after a tap can be ignored.
const inputState = { lastTouchTime: -Infinity };


class KeyboardController {
    static DEV_SPECIALS = {
        Digit1: "Bug", Digit2: "Wild", Digit3: "Swap", Digit4: "Bomb",
        Digit5: "Magnet", Digit6: "Zap", Digit7: "Nuke", Digit8: "Blaster",
    };

    constructor(game) {
        this.game = game;
        document.addEventListener("keydown", event => this.onKeyDown(event));
    }

    onKeyDown(event) {
        const game = this.game;

        // The help screen has its own keys
        if (game.isHelp) {
            switch (event.key) {
                case "Escape": case "Enter": case " ": case "h": case "H": case "?": game.closeHelp(); break;
                case "ArrowRight": case "d": case "D": game.helpGo(1); break;
                case "ArrowLeft": case "a": case "A": game.helpGo(-1); break;
            }
            return;
        }

        // H opens the instructions (from the title, pause, or game-over screens)
        if (event.key === "h" || event.key === "H" || event.key === "?") {
            game.openHelp();
            if (game.isHelp) return;
        }

        // Any key on the scoreboard goes back to the welcome screen
        if (game.isGameOver) {
            game.returnToWelcome();
            return;
        }

        // Enter on the welcome screen starts the game
        if (!game.isRunning && event.key === "Enter") {
            game.resetGame();
            return;
        }

        switch (event.key) {
            case "m": case "M": game.toggleMusic(); break;
            case "f": case "F": game.toggleSfx(); break;
            case "t": case "T": game.nextTrack(); break;
        }

        if (game.isRunning) {
            switch (event.key) {
                case "ArrowLeft": case "a": case "A": game.moveLeft(); break;
                case "ArrowRight": case "d": case "D": game.moveRight(); break;
                case "ArrowDown": case " ": case "s": case "S": game.drop(); break;
                case "Escape": case "p": case "P": game.togglePause(); break;
                case "q": case "Q": case "x": case "X": game.endGame(); break;
                case "g": case "G": game.toggleGhost(); break;
            }
        }

        if (Config.DEV_KEYS_ENABLED && game.activeBlock) this.onDevKey(event);
    } // onKeyDown


    // Cheat keys for testing: Shift+1..8 = specials, 1..9 = number blocks
    onDevKey(event) {
        if (event.shiftKey) {
            const name = KeyboardController.DEV_SPECIALS[event.code];
            const type = name && BlockCatalog.byName(name);
            if (type && type.enabled) this.game.devSetActiveBlockType(type);
        } else if (event.code.startsWith("Digit")) {
            const digit = parseInt(event.code.replace("Digit", ""), 10);
            if (digit >= 1 && digit <= 9) {
                const type = BlockCatalog.byValue(Math.pow(2, digit - 1));
                if (type) this.game.devSetActiveBlockType(type);
            }
        }
    } // onDevKey
} // class KeyboardController


class MouseController {
    constructor(game, renderer, canvas) {
        this.game = game;
        this.renderer = renderer;

        canvas.addEventListener("click", e => this.onClick(e));
        canvas.addEventListener("mousemove", e => this.onMove(e));
        canvas.addEventListener("mousedown", e => this.onDown(e));
        canvas.addEventListener("contextmenu", e => e.preventDefault());
    }

    // Is a canvas point on the welcome screen's Play button?
    static overPlayButton(point) {
        const b = Config.PLAY_BUTTON;
        const y = point.y - Config.HUD_HEIGHT; // Canvas -> grid space
        return point.x >= b.x && point.x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
    }

    onClick(event) {
        // Touches are handled by the TouchController; ignore the synthetic click
        if (performance.now() - inputState.lastTouchTime < 800) return;

        const game = this.game;
        const point = this.renderer.toCanvasPoint(event);

        // HUD buttons work in any game state
        const hudButton = this.renderer.hud.buttonAt(point.x, point.y);
        if (hudButton) {
            this.renderer.hud.activate(hudButton, game);
            return;
        }

        if (game.isHelp) {
            this.onHelpTap(point);
        } else if (this.renderer.helpButtonAt(game, point)) {
            game.openHelp();
        } else if (game.isGameOver) {
            game.resetGame();
        } else if (game.isPaused) {
            game.togglePause();
        } else if (game.state === GameState.WELCOME && MouseController.overPlayButton(point)) {
            game.resetGame();
            game.audio.play("drop");
        } else {
            game.drop();
        }
    } // onClick

    // A click or tap on the help screen: the X closes it; the left half goes back, the right half forward
    onHelpTap(point) {
        const target = this.renderer.helpTargetAt(point);
        if (target === "close") this.game.closeHelp();
        else if (target === "back") this.game.helpGo(-1);
        else this.game.helpNext();
    } // onHelpTap

    onMove(event) {
        const game = this.game;
        if (game.isPaused) return;

        const point = this.renderer.toCanvasPoint(event);

        // Highlight the Play button when hovered
        if (game.state === GameState.WELCOME) {
            const hovering = MouseController.overPlayButton(point);
            if (hovering !== game.ui.hoverPlayButton) {
                game.ui.hoverPlayButton = hovering;
                game.draw();
            }
        }

        // Steer the active block toward the mouse, one column at a time
        const block = game.activeBlock;
        if (block && game.isPlaying) {
            const targetX = Math.floor(point.x / Config.BLOCK_WIDTH) * Config.BLOCK_WIDTH;
            if (targetX < block.x) game.moveLeft();
            else if (targetX > block.x) game.moveRight();
        }
    } // onMove

    onDown(event) {
        if (event.button === 2) { // Right click pauses
            event.preventDefault();
            event.stopPropagation();
            this.game.togglePause();
        }
    } // onDown
} // class MouseController


// Touch and pen input, using Pointer Events.
//   Drag horizontally  -> the block follows your finger, column by column
//   Swipe down         -> drop the block (fire the blaster)
//   Swipe up           -> pause
//   Tap                -> nudge left/right by half of the screen, or start/resume
// Swipes fire as soon as the distance is reached, not when the finger lifts.
class TouchController {
    constructor(game, renderer, canvas) {
        this.game = game;
        this.renderer = renderer;
        this.canvas = canvas;
        this.reset();

        canvas.addEventListener("pointerdown", e => this.onDown(e));
        canvas.addEventListener("pointermove", e => this.onMove(e));
        canvas.addEventListener("pointerup", e => this.onUp(e));
        canvas.addEventListener("pointercancel", () => this.reset());
    }

    reset() {
        this.pointerId = null; // Only one finger is tracked at a time
        this.axis = null;      // "x" or "y" once the gesture direction is known
        this.fired = false;    // A one-shot swipe has already been triggered
        this.startX = 0;
        this.startY = 0;
        this.startColumn = 0;
    }

    onDown(event) {
        if (event.pointerType === "mouse") return; // Mouse has its own controller
        event.preventDefault();
        inputState.lastTouchTime = performance.now();

        if (this.pointerId !== null) return; // Ignore extra fingers

        this.reset();
        this.pointerId = event.pointerId;
        this.canvas.setPointerCapture?.(event.pointerId);

        const point = this.renderer.toCanvasPoint(event);
        this.startX = point.x;
        this.startY = point.y;
        this.startColumn = this.game.activeBlock ? this.game.activeBlock.column : 0;
    }

    onMove(event) {
        if (event.pointerId !== this.pointerId) return;
        event.preventDefault();
        inputState.lastTouchTime = performance.now();

        const point = this.renderer.toCanvasPoint(event);
        const dx = point.x - this.startX;
        const dy = point.y - this.startY;

        // Decide whether this is a horizontal drag or a vertical swipe
        if (this.axis === null) {
            if (Math.hypot(dx, dy) < Config.TOUCH_LOCK_DISTANCE) return;
            this.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        }

        const game = this.game;
        if (!game.isPlaying) return;

        if (this.axis === "x") {
            this.dragBlockTo(dx);
        } else if (!this.fired) {
            if (dy > Config.TOUCH_SWIPE_DISTANCE) {
                this.fired = true;
                game.drop();
            } else if (dy < -Config.TOUCH_SWIPE_DISTANCE) {
                this.fired = true;
                game.togglePause();
            }
        }
    }

    onUp(event) {
        if (event.pointerId !== this.pointerId) return;
        event.preventDefault();
        inputState.lastTouchTime = performance.now();

        const wasTap = this.axis === null;
        const point = this.renderer.toCanvasPoint(event);
        this.reset();

        if (wasTap) this.onTap(point);
    }

    // Step the active block toward the column under the finger
    dragBlockTo(dx) {
        const game = this.game;
        if (!game.activeBlock || game.dropping) return;

        const lastColumn = Config.COLUMNS - 1;
        const target = Math.max(0, Math.min(lastColumn,
            this.startColumn + Math.round(dx / Config.BLOCK_WIDTH)));

        for (let guard = 0; guard <= lastColumn && game.activeBlock; guard++) {
            const before = game.activeBlock.x;
            const column = game.activeBlock.column;
            if (column === target) break;

            if (column < target) game.moveRight(); else game.moveLeft();
            if (game.activeBlock && game.activeBlock.x === before) break; // Blocked
        }
    }

    onTap({ x, y }) {
        const game = this.game;

        // HUD buttons work in any game state
        const hudButton = this.renderer.hud.buttonAt(x, y);
        if (hudButton) {
            this.renderer.hud.activate(hudButton, game);
            return;
        }

        if (game.isHelp) {
            const target = this.renderer.helpTargetAt({ x, y });
            if (target === "close") game.closeHelp();
            else if (target === "back") game.helpGo(-1);
            else game.helpNext();
        } else if (this.renderer.helpButtonAt(game, { x, y })) {
            game.openHelp();
        } else if (game.isGameOver) {
            game.returnToWelcome();
        } else if (game.state === GameState.WELCOME) {
            game.resetGame();
        } else if (game.isPaused) {
            game.togglePause();
        } else if (game.isPlaying) {
            if (x < Config.GRID_WIDTH / 2) game.moveLeft(); else game.moveRight();
        }
    }
} // class TouchController


// Pause (never resume) when the player switches away from the game
class WindowController {
    constructor(game) {
        window.addEventListener("blur", () => game.pauseIfPlaying());
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                game.pauseIfPlaying();
                game.audio.suspend(); // Don't keep playing in the background
            } else {
                game.audio.resume();
            }
        });
    }
} // class WindowController
