"use strict";

// ====================
// HUD
// ====================

// The strip above the grid: music toggle, score, sound effects toggle.
// The icons are real buttons: input asks buttonAt() what was hit and then
// calls activate().
class Hud {
    constructor() {
        const h = Config.HUD_HEIGHT;
        this.buttons = {
            music: { x: 0, y: 0, width: 50, height: h },
            sfx: { x: Config.GRID_WIDTH - 50, y: 0, width: 50, height: h },
        };
        this.scorebarY = 14;
    }

    // Which button is under a canvas point (not grid point)? null if none.
    buttonAt(x, y) {
        for (const [name, r] of Object.entries(this.buttons)) {
            if (x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height) return name;
        }
        return null;
    }

    activate(name, game) {
        if (name === "music") game.toggleMusic();
        else if (name === "sfx") game.toggleSfx();
    }

    draw(ctx, game, scorebarImage, shadowPad) {
        const w = Config.GRID_WIDTH;
        const h = Config.HUD_HEIGHT;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#222";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#f16d01";
        ctx.fillRect(0, h - 2, w, 2);

        const textY = this.scorebarY + 28;

        if (game.options.drawScorebar) {
            ctx.drawImage(scorebarImage, 50 - shadowPad, this.scorebarY - shadowPad);

            ctx.fillStyle = "white";
            ctx.font = "24px Silkscreen";
            ctx.textAlign = "right";
            ctx.fillText(game.score, 308, textY);
        }

        // Toggle icons stay visible but dim when off, so they can be turned back on
        ctx.font = "24px Silkscreen";
        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.globalAlpha = game.audio.musicOn ? 1 : 0.3;
        ctx.fillText("♪", this.buttons.music.x + this.buttons.music.width / 2, textY);
        ctx.globalAlpha = game.audio.sfxOn ? 1 : 0.3;
        ctx.fillText("♫", this.buttons.sfx.x + this.buttons.sfx.width / 2, textY);
        ctx.globalAlpha = 1;
    }
} // class Hud
