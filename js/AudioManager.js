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
    // `tracks` are { file, lufs } entries; see AudioManager.volumeFor()
    constructor(tracks) {
        this.tracks = tracks.map((info, i) => {
            const track = new Audio(info.file);
            track.loop = false;
            track.volume = AudioManager.volumeFor(info.lufs);
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

    // Every music file with its measured loudness (integrated LUFS, from ffmpeg's
    // ebur128 filter). Volumes are computed from these so all tracks sound equally
    // loud against the sound effects.
    static THEME = { file: "audio/music/music-a.mp3", lufs: -13.3 };

    static MUSIC = [
        { file: "audio/music/music-b.mp3", lufs: -9.2 },
        { file: "audio/music/music-c.mp3", lufs: -10.2 },
        { file: "audio/music/music-d.mp3", lufs: -10.5 },
        { file: "audio/music/music-e.mp3", lufs: -15.2 },
        { file: "audio/music/music-f.mp3", lufs: -8.0 },
    ];

    // The level every track is matched to. This is track b at volume 0.2,
    // which is what the game originally used to balance music against effects.
    // Raise or lower this one number to make all the music louder or quieter.
    static MUSIC_TARGET_LUFS = -23.2;

    // The volume (0..1) that brings a track of the given loudness to the target
    static volumeFor(lufs) {
        return Math.min(1, Math.pow(10, (AudioManager.MUSIC_TARGET_LUFS - lufs) / 20));
    }

    constructor() {
        this.sfxOn = true;
        this.musicOn = true;
        this.sfx = new SfxPlayer(AudioManager.SFX_NAMES, "audio/sfx");
        this.music = new MusicPlayer(AudioManager.MUSIC);

        // The short theme that loops on the welcome and game-over screens
        this.theme = new Audio(AudioManager.THEME.file);
        this.theme.loop = true;
        this.theme.volume = AudioManager.volumeFor(AudioManager.THEME.lufs);
        this.theme.preload = "auto";
        this.themeWanted = false; // True while a screen that wants the theme is showing

        // Browsers won't play audio before the first tap or key press, so if the
        // title screen asked for the theme too early, start it on that first gesture.
        const retry = () => { if (this.themeWanted) this.playTheme(); };
        ["pointerdown", "touchend", "click", "keydown"].forEach(type =>
            window.addEventListener(type, retry, { passive: true })
        );
    }

    // Play a sound effect by name (see SFX_NAMES)
    play(name) {
        if (this.sfxOn) this.sfx.play(name);
    }

    // Loop the welcome / game-over theme (if music is on)
    playTheme() {
        this.themeWanted = true;
        if (this.musicOn && this.theme.paused) this.theme.play().catch(() => {});
    }

    stopTheme() {
        this.themeWanted = false;
        this.theme.pause();
        this.theme.currentTime = 0;
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
        // Whatever is supposed to be playing right now: the theme, or the game music
        const active = this.themeWanted ? this.theme : this.music.current;

        if (this.musicOn) active.pause(); else active.play().catch(() => {});
        this.musicOn = !this.musicOn;
    }
} // class AudioManager
