class SoundManager {
    constructor() {
        this.sounds = {};
        this.musicEnabled = true;
        this.sfxEnabled = true;
        this.volume = 0.5;
        this.unlockAttempted = false;
        this.warnedBlocked = false;
        
        this.soundMap = {
            'join': '/audio/tone.mp3',
            'powerup': '/audio/tone.mp3',
            'arrow': '/audio/sound.mp3',
            'victory': '/audio/tone.mp3'
        };

        this.loadSounds();
        this.setupUnlockHandlers();
    }
    
    loadSounds() {
        Object.entries(this.soundMap).forEach(([name, path]) => {
            const audio = new Audio(path);
            audio.volume = this.volume;
            this.sounds[name] = audio;
        });
    }
    
    play(soundName) {
        if (!this.sfxEnabled) return;
        
        const sound = this.sounds[soundName];
        if (sound) {
            const clone = sound.cloneNode();
            clone.volume = this.volume;
            clone.play().catch(err => {
                if (!this.warnedBlocked && err && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
                    this.warnedBlocked = true;
                    console.warn('Audio blocked until the overlay receives a user interaction.');
                }
                console.warn(`Failed to play sound ${soundName}:`, err);
            });
        }
    }

    setupUnlockHandlers() {
        if (typeof document === 'undefined') return;
        const unlock = () => this.unlockAudio();
        ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click'].forEach(eventName => {
            document.addEventListener(eventName, unlock, { once: true });
        });
    }

    unlockAudio() {
        if (this.unlockAttempted) return;
        this.unlockAttempted = true;
        const firstSound = Object.values(this.sounds)[0];
        if (!firstSound) return;
        const clone = firstSound.cloneNode();
        clone.volume = 0;
        const playPromise = clone.play();
        if (playPromise && typeof playPromise.then === 'function') {
            playPromise.then(() => {
                clone.pause();
                clone.currentTime = 0;
            }).catch(() => {
                this.unlockAttempted = false;
            });
        }
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.volume;
        });
    }
    
    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        return this.musicEnabled;
    }
    
    toggleSfx() {
        this.sfxEnabled = !this.sfxEnabled;
        return this.sfxEnabled;
    }
}

const soundManager = new SoundManager();
