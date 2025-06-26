class SoundManager {
    constructor() {
        this.sounds = {};
        this.musicEnabled = true;
        this.sfxEnabled = true;
        this.volume = 0.5;
        
        this.soundMap = {
            'join': '/audio/tone.mp3',
            'powerup': '/audio/tone.mp3',
            'arrow': '/audio/sound.mp3',
            'victory': '/audio/tone.mp3'
        };
        
        this.loadSounds();
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
                console.warn(`Failed to play sound ${soundName}:`, err);
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