let audioContext = null;

const getAudioContext = () => {
    if (typeof window === 'undefined') return null;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audioContext) {
        audioContext = new AudioContextCtor();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => { });
    }
    return audioContext;
};

const playTone = (context, frequency, startAt, duration, type = 'sine', gainValue = 0.07) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
};

const SOUND_PATTERNS = {
    move: [{ frequency: 520, duration: 0.08, type: 'triangle', gain: 0.05 }],
    capture: [
        { frequency: 420, duration: 0.07, type: 'square', gain: 0.06 },
        { frequency: 300, duration: 0.11, delay: 0.05, type: 'square', gain: 0.06 },
    ],
    start: [
        { frequency: 500, duration: 0.07, type: 'triangle', gain: 0.06 },
        { frequency: 660, duration: 0.11, delay: 0.06, type: 'triangle', gain: 0.07 },
    ],
    win: [
        { frequency: 523, duration: 0.1, type: 'sine', gain: 0.07 },
        { frequency: 659, duration: 0.1, delay: 0.1, type: 'sine', gain: 0.07 },
        { frequency: 784, duration: 0.18, delay: 0.2, type: 'sine', gain: 0.08 },
    ],
    lose: [
        { frequency: 440, duration: 0.1, type: 'sawtooth', gain: 0.06 },
        { frequency: 370, duration: 0.1, delay: 0.1, type: 'sawtooth', gain: 0.06 },
        { frequency: 311, duration: 0.16, delay: 0.2, type: 'sawtooth', gain: 0.06 },
    ],
    warning: [{ frequency: 880, duration: 0.18, type: 'square', gain: 0.08 }],
};

export const playGameSound = (soundKey, options = {}) => {
    const { enabled = true } = options;
    if (!enabled) return;

    const pattern = SOUND_PATTERNS[soundKey];
    if (!pattern || pattern.length === 0) return;

    try {
        const context = getAudioContext();
        if (!context) return;
        const now = context.currentTime;
        pattern.forEach((tone) => {
            playTone(
                context,
                tone.frequency,
                now + (tone.delay || 0),
                tone.duration,
                tone.type,
                tone.gain,
            );
        });
    } catch (error) {
    }
};
