/**
 * Speech recognition using TensorFlow.js Speech Commands model.
 * Runs entirely in-browser (~4MB model), recognizes 18 words
 * with ~200ms latency. No cloud dependency.
 */

let recognizer = null;
let isListening = false;
let lastWord = '';
let pendingEvents = {};
let lastEventTime = {};
const DEBOUNCE_MS = 400;

// The 18w model recognizes: "zero"-"nine", "up", "down", "left", "right",
// "go", "stop", "yes", "no", plus "_background_noise_" and "_unknown_"
const WORD_MAP = {
    'up':    'press_2',   // Jump
    'down':  'press_8',   // Duck
    'left':  'press_3',   // Rope 1
    'right': 'press_9',   // Rope 3
    'go':    'press_5',   // Start / confirm
    'stop':  'hungup',    // Hang up
    'yes':   'press_5',   // Confirm
    'no':    'skip',      // Skip video
    'zero':  'press_0',
    'one':   'press_1',
    'two':   'press_2',
    'three': 'press_3',
    'four':  'press_4',
    'five':  'press_5',
    'six':   'press_6',
    'seven': 'press_7',
    'eight': 'press_8',
    'nine':  'press_9',
};

/**
 * Initialize the speech model. Returns true if available.
 * Call this early — model download + warmup takes a few seconds.
 */
export async function initSpeech(onProgress) {
    if (typeof speechCommands === 'undefined') {
        console.warn('TensorFlow.js Speech Commands not loaded');
        return false;
    }

    try {
        if (onProgress) onProgress('Loading speech model...');

        // '18w' = 18-word vocabulary: zero-nine, up, down, left, right, go, stop, yes, no
        recognizer = speechCommands.create('BROWSER_FFT', undefined);
        await recognizer.ensureModelLoaded();

        console.log('Speech model loaded. Words:', recognizer.wordLabels());
        return true;
    } catch (e) {
        console.warn('Speech model failed to load:', e);
        recognizer = null;
        return false;
    }
}

export function startListening() {
    if (!recognizer) return;
    if (isListening) return;
    isListening = true;

    recognizer.listen(result => {
        const scores = result.scores;
        const labels = recognizer.wordLabels();

        // Find the highest-scoring word
        let maxIdx = 0;
        let maxScore = 0;
        for (let i = 0; i < scores.length; i++) {
            if (scores[i] > maxScore) {
                maxScore = scores[i];
                maxIdx = i;
            }
        }

        const word = labels[maxIdx];

        // Ignore noise/unknown or low confidence
        if (word === '_background_noise_' || word === '_unknown_') return;
        // Short words like "go" and "no" need a lower threshold
        const threshold = (word === 'go' || word === 'no' || word === 'up') ? 0.70 : 0.85;
        if (maxScore < threshold) return;

        const eventKey = WORD_MAP[word];
        if (!eventKey) return;

        const now = Date.now();
        if (lastEventTime[eventKey] && now - lastEventTime[eventKey] < DEBOUNCE_MS) return;

        console.log(`[speech] "${word}" (${(maxScore * 100).toFixed(0)}%) → ${eventKey}`);

        lastWord = word;
        pendingEvents[eventKey] = true;
        lastEventTime[eventKey] = now;
        updateMicUI(word);

    }, {
        probabilityThreshold: 0.65,
        invokeCallbackOnNoiseAndUnknown: false,
        overlapFactor: 0.5,
        // Echo cancellation + noise suppression to filter out game audio
        audioTrackConstraints: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        },
    });

    const indicator = document.getElementById('mic-indicator');
    if (indicator) indicator.style.display = 'flex';
    const icon = document.getElementById('mic-icon');
    if (icon) icon.classList.add('listening');
}

export function stopListening() {
    if (!recognizer || !isListening) return;
    isListening = false;
    recognizer.stopListening();
    const indicator = document.getElementById('mic-indicator');
    if (indicator) indicator.style.display = 'none';
}

/**
 * Drain pending speech events into a PhoneEvents object.
 */
export function drainSpeechEvents(phoneEvents) {
    for (const key of Object.keys(pendingEvents)) {
        phoneEvents[key] = true;
    }
    pendingEvents = {};
}

export function getLastWord() {
    return lastWord;
}

function updateMicUI(word) {
    const indicator = document.getElementById('mic-indicator');
    const wordEl = document.getElementById('mic-word');
    if (wordEl) {
        wordEl.textContent = word;
        wordEl.style.color = '#4f4';
    }
    if (indicator) {
        indicator.classList.add('recognized');
    }
    clearTimeout(updateMicUI._timeout);
    updateMicUI._timeout = setTimeout(() => {
        if (wordEl) wordEl.style.color = '#fff';
        if (indicator) indicator.classList.remove('recognized');
    }, 800);
}
