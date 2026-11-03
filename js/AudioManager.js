"use strict";

// ====================
// AUDIO
// ====================

// Short sound effects, played through the Web Audio API. Each effect is
// decoded once, then every play is a cheap one-shot buffer source, so rapid or
// overlapping effects (blaster shots, explosions) don't restart an <audio>
// element or re-decode an MP3 mid-frame. Falls back to the plain <audio>
// element if Web Audio isn't available or hasn't unlocked yet.
class SfxPlayer {
    constructor(names, folder) {
        this.elements = new Map(); // name -> <audio>, used for the fallback path
        this.buffers = new Map();  // name -> decoded AudioBuffer

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.context = AudioCtx ? new AudioCtx() : null;

        names.forEach(name => {
            const element = new Audio(`${folder}/${name}Sound.mp3`);
            element.preload = "auto";
            this.elements.set(name, element);
            if (this.context) this.load(name, element.src);
        });

        if (!this.context) return;

        // iOS keeps the audio context suspended until a user gesture
        const unlock = () => {
            if (this.context.state === "suspended") this.context.resume();
        };
        ["pointerdown", "touchend", "click", "keydown"].forEach(type =>
            window.addEventListener(type, unlock, { passive: true })
        );
    }

    load(name, url) {
        fetch(url)
            .then(response => response.arrayBuffer())
            .then(data => new Promise((resolve, reject) =>
                this.context.decodeAudioData(data, resolve, reject)))
            .then(buffer => this.buffers.set(name, buffer))
            .catch(() => {}); // The <audio> fallback still works
    }

    play(name) {
        const buffer = this.buffers.get(name);
        if (buffer && this.context.state === "running") {
            const source = this.context.createBufferSource();
            source.buffer = buffer;
            source.connect(this.context.destination);
            source.start(0);
            return;
        }

        const element = this.elements.get(name);
        if (!element) return;
        element.currentTime = 0;
        element.play().catch(() => {});
    }
} // class SfxPlayer


// Background music: a playlist that advances to the next track when one ends
class MusicPlayer {
    constructor(files) {
        this.tracks = files.map((file, i) => {
            const track = new Audio(file);
            track.loop = false;
            track.preload = i === 0 ? "auto" : "none"; // Don't download all the music up front
            track.addEventListener("ended", () => this.next());
            return track;
        });
        this.index = 0;
    }

    get current() { return this.tracks[this.index]; }
    get isPaused() { return this.current.paused; }

    play() { this.current.play().catch(() => {}); }
    pause() { this.current.pause(); }

    stop() {
        this.current.pause();
        this.current.currentTime = 0;
    }

    next() {
        this.current.pause();
        this.index = (this.index + 1) % this.tracks.length;
        this.play();
    }
} // class MusicPlayer


// Everything audible. The rest of the game only talks to this class.
class AudioManager {
    static SFX_NAMES = [
        "welcome", "start", "left", "right", "drop", "place", "merge", "pause",
        "gameOver", "bug", "wild", "swap", "bomb", "magnet", "zap", "nuke",
        "laser", "fail", "success", "smallBoom",
    ];

    static MUSIC_FILES = [
        "audio/music/music-b.mp3", "audio/music/music-c.mp3", "audio/music/music-d.mp3",
        "audio/music/music-e.mp3", "audio/music/music-f.mp3",
    ];

    constructor() {
        this.sfxOn = true;
        this.musicOn = true;
        this.sfx = new SfxPlayer(AudioManager.SFX_NAMES, "audio/sfx");
        this.music = new MusicPlayer(AudioManager.MUSIC_FILES);
    }

    // Play a sound effect by name (see SFX_NAMES)
    play(name) {
        if (this.sfxOn) this.sfx.play(name);
    }

    // Start the background music if it's enabled and not already playing
    startMusic() {
        if (this.musicOn && this.music.isPaused) this.music.play();
    }

    stopMusic() { this.music.stop(); }

    // For pausing and resuming the game
    pauseMusic() { this.music.pause(); }
    resumeMusic() { if (this.musicOn) this.music.play(); }

    nextTrack() { this.music.next(); }

    toggleSfx() {
        this.sfxOn = !this.sfxOn;
    }

    toggleMusic() {
        if (this.musicOn) this.music.pause(); else this.music.play();
        this.musicOn = !this.musicOn;
    }
} // class AudioManager
