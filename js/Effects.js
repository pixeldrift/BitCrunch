"use strict";

// ====================
// EFFECTS
// ====================

// Short-lived visual state: floating score popups, explosions, the blaster
// beam, the zap lightning, and screen shake. Game logic starts effects; the
// Renderer only reads them.
class Effects {
    constructor() {
        this.reset();
    }

    reset() {
        this.popups = [];     // { x, y, text, alpha }
        this.explosions = []; // { x, y, frame }
        this.laser = null;    // { x } while the beam is visible
        this.lightning = null;// { centerX, rowY, blocks:[{x,y}] } while flashing
        this.shake = null;    // { endTime, intensity }
    }

    addPopup(x, y, amount) {
        this.popups.push({ x, y, text: `+${amount}`, alpha: 1 });
    }

    startShake(duration, intensity) {
        this.shake = { endTime: performance.now() + duration, intensity };
    }

    // Current shake offset in pixels, or null when not shaking
    shakeOffset() {
        if (!this.shake) return null;
        if (performance.now() >= this.shake.endTime) {
            this.shake = null;
            return null;
        }
        const range = this.shake.intensity * 2;
        return { x: (Math.random() - 0.5) * range, y: (Math.random() - 0.5) * range };
    }

    // Advance animations. dt is in seconds; speeds are tuned per 1/60 s.
    update(dt) {
        const frames = dt * 60;
        for (let i = this.popups.length - 1; i >= 0; i--) {
            const popup = this.popups[i];
            popup.y -= Config.SCORE_POPUP_RISE_SPEED * frames;
            popup.alpha -= Config.SCORE_POPUP_FADE_SPEED / 100 * frames;
            if (popup.alpha <= 0) this.popups.splice(i, 1);
        }
    }
} // class Effects
