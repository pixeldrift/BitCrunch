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
    constructor(names, folder, context) {
        this.elements = new Map(); // name -> <audio>, used for the fallback path
        this.buffers = new Map();  // name -> decoded AudioBuffer
        this.context = context;    // Shared AudioContext, or null if unsupported

        names.forEach(name => {
            const element = new Audio(`${folder}/${name}Sound.mp3`);
            element.preload = "auto";
            this.elements.set(name, element);
            if (this.context) this.load(name, element.src);
        });
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
    // `tracks` are { file, lufs } entries. The manager sets each track's volume
    // (see AudioManager.attachMusic) and starts playback.
    constructor(tracks, audio) {
        this.audio = audio;
        this.tracks = tracks.map((info, i) => {
            const track = new Audio(info.file);
            track.loop = false;
            audio.attachMusic(track, info.lufs);
            track.preload = i === 0 ? "auto" : "none"; // Don't download all the music up front
            track.addEventListener("ended", () => this.next());
            return track;
        });
        this.index = 0;
    }

    get current() { return this.tracks[this.index]; }
    get isPaused() { return this.current.paused; }

    play() { this.audio.playElement(this.current); }
    pause() { this.current.pause(); }

    stop() {
        this.current.pause();
        this.current.currentTime = 0;
    }

    // Back to the first track, stopped
    rewind() {
        this.stop();
        this.index = 0;
    }

    next() {
        this.current.pause();
        this.index = (this.index + 1) % this.tracks.length;
        this.play();
    }
} // class MusicPlayer


// The welcome / pause / game-over theme. Web Audio can loop a decoded buffer with no
// gap at all, which an <audio loop> can't (browsers leave a small pause at the wrap).
// Falls back to an <audio> element if decoding isn't possible.
class ThemePlayer {
    constructor(audio, info) {
        this.audio = audio;
        this.info = info;
        this.playing = false;   // Should it be playing right now?
        this.buffer = null;
        this.source = null;     // The running loop
        this.gain = null;
        this.fallback = null;   // <audio> element, only if Web Audio can't be used

        if (!audio.routeMusic) { this.useFallback(); return; }

        fetch(info.file)
            .then(response => response.arrayBuffer())
            .then(data => new Promise((resolve, reject) => audio.context.decodeAudioData(data, resolve, reject)))
            .then(buffer => {
                this.buffer = buffer;
                this.gain = audio.context.createGain();
                this.gain.gain.value = AudioManager.volumeFor(info.lufs);
                this.gain.connect(audio.context.destination);
                if (this.playing) this.startSource(); // It was asked for while loading
            })
            .catch(() => this.useFallback());
    }

    useFallback() {
        this.fallback = new Audio(this.info.fallback);
        this.fallback.loop = true;
        this.fallback.preload = "auto";
        this.audio.attachMusic(this.fallback, this.info.lufs);
        if (this.playing) this.audio.playElement(this.fallback);
    }

    // Same idea as an <audio> element's `paused`
    get paused() {
        return this.fallback ? this.fallback.paused : !this.playing;
    }

    play() {
        if (this.fallback) { this.playing = true; this.audio.playElement(this.fallback); return; }
        if (this.playing) return;
        this.playing = true;
        if (this.buffer) this.startSource();
    }

    // Stop; the next play() starts from the beginning
    pause() {
        this.playing = false;
        if (this.fallback) { this.fallback.pause(); this.fallback.currentTime = 0; }
        this.stopSource();
    }

    stop() { this.pause(); }

    startSource() {
        this.stopSource();
        const source = this.audio.context.createBufferSource();
        source.buffer = this.buffer;
        source.loop = true;
        source.connect(this.gain);
        source.start(0); // While the context is still locked this waits, then starts from the top
        this.source = source;
    }

    stopSource() {
        if (this.source) {
            try { this.source.stop(); } catch (e) { /* already stopped */ }
            this.source.disconnect();
            this.source = null;
        }
    }
} // class ThemePlayer


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
    // The theme is a lossless file trimmed to an exact musical loop (the notes land on
    // the beat grid across the wrap) and played gapless through Web Audio. The MP3 is
    // the fallback for where that isn't possible.
    static THEME = { file: "audio/music/theme-loop.flac", fallback: "audio/music/music-a.mp3", lufs: -13.3 };

    static MUSIC = [
        { file: "audio/music/music-b.mp3", lufs: -9.7 },
        { file: "audio/music/music-c.mp3", lufs: -10.8 },
        { file: "audio/music/music-d.mp3", lufs: -11.0 },
        { file: "audio/music/music-e.mp3", lufs: -15.7 },
        { file: "audio/music/music-f.mp3", lufs: -8.4 },
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

        // One Web Audio context for everything. Sound effects play through it as
        // buffers; music streams from <audio> elements routed through volume
        // (gain) nodes. iPhones ignore <audio>.volume, but honor gain nodes.
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.context = AudioCtx ? new AudioCtx() : null;

        // A page opened from disk (file://) can't be routed: the browser treats
        // the audio files as another origin and mutes them. Use plain volume there.
        this.routeMusic = this.context !== null && location.protocol !== "file:";
        this.musicGains = []; // Kept for inspection / tests

        this.sfx = new SfxPlayer(AudioManager.SFX_NAMES, "audio/sfx", this.context);
        this.music = new MusicPlayer(AudioManager.MUSIC, this);

        // The short theme that loops on the welcome and game-over screens
        this.theme = new ThemePlayer(this, AudioManager.THEME);
        this.themeWanted = false; // True while a screen that wants the theme is showing

        this.suspended = false;   // Silenced because the page is hidden
        this.resumeAfterHidden = { theme: false, music: false };

        // Browsers won't play audio before the first tap or key press: wake the
        // context then, and start the theme if the title screen asked for it early.
        const unlock = () => {
            if (this.context && this.context.state === "suspended" && !this.suspended) {
                this.context.resume();
            }
            if (this.themeWanted) this.playTheme();
        };
        ["pointerdown", "touchend", "click", "keydown"].forEach(type =>
            window.addEventListener(type, unlock, { passive: true })
        );
    }


    // Set an <audio> element's loudness from its measured level
    attachMusic(element, lufs) {
        const volume = AudioManager.volumeFor(lufs);

        if (!this.routeMusic) {
            element.volume = volume;
            return;
        }

        const gain = this.context.createGain();
        gain.gain.value = volume;
        this.context.createMediaElementSource(element).connect(gain).connect(this.context.destination);
        this.musicGains.push(gain);
    }


    // Play an <audio> element, waking the audio context if needed
    playElement(element) {
        if (this.context && this.context.state === "suspended" && !this.suspended) {
            this.context.resume();
        }
        element.play().catch(() => {});
    }


    // Silence everything while the page is hidden (iOS keeps playing otherwise)
    suspend() {
        if (this.suspended) return;
        this.suspended = true;
        this.resumeAfterHidden = { theme: !this.theme.paused, music: !this.music.isPaused };

        this.theme.pause();
        this.music.pause();
        if (this.context) this.context.suspend();
    }

    // Bring back whatever was playing before suspend()
    resume() {
        if (!this.suspended) return;
        this.suspended = false;
        if (this.context) this.context.resume();

        if (this.resumeAfterHidden.theme) this.theme.play();
        if (this.resumeAfterHidden.music) this.music.play();
        this.resumeAfterHidden = { theme: false, music: false };
    }

    // Play a sound effect by name (see SFX_NAMES)
    play(name) {
        if (this.sfxOn) this.sfx.play(name);
    }

    // Loop the welcome / game-over theme (if music is on)
    playTheme() {
        this.themeWanted = true;
        if (this.musicOn && this.theme.paused && !this.suspended) this.theme.play();
    }

    stopTheme() {
        this.themeWanted = false;
        this.theme.stop();
    }

    // Start the background music if it's enabled and not already playing
    startMusic() {
        if (this.musicOn && this.music.isPaused) this.music.play();
    }

    stopMusic() { this.music.stop(); }

    // A new game always starts the playlist from the top: B, C, D, E, F, then around again
    restartMusic() {
        this.music.rewind();
        this.startMusic();
    }

    // For pausing and resuming the game
    pauseMusic() { this.music.pause(); }
    resumeMusic() { if (this.musicOn) this.music.play(); }

    nextTrack() { this.music.next(); }

    toggleSfx() {
        this.sfxOn = !this.sfxOn;
    }

    toggleMusic() {
        // Whatever is supposed to be playing right now: the theme, or the game music
        const active = this.themeWanted ? this.theme : this.music;

        if (this.musicOn) active.pause(); else active.play();
        this.musicOn = !this.musicOn;
    }
} // class AudioManager
