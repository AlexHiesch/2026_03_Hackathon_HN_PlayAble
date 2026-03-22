/**
 * Web Audio API based audio system.
 * Replaces the UDP audio server from the Python version.
 */

let audioCtx = null;
const bufferCache = {};
let nextInstanceId = 1;
const activeInstances = {};

export function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

export function getAudioContext() {
    return audioCtx;
}

async function loadBuffer(url) {
    if (bufferCache[url]) return bufferCache[url];
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        bufferCache[url] = audioBuffer;
        return audioBuffer;
    } catch (e) {
        console.warn(`Failed to load audio: ${url}`, e);
        return null;
    }
}

export async function preloadAudio(url) {
    return loadBuffer(url);
}

export function play(url, loops = 0) {
    if (!audioCtx || !url) return null;

    const buffer = bufferCache[url];
    if (!buffer) {
        // Try to load and play async
        loadBuffer(url).then(buf => {
            if (buf) _playBuffer(buf, url, loops);
        });
        return null;
    }

    return _playBuffer(buffer, url, loops);
}

function _playBuffer(buffer, url, loops) {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const gainNode = audioCtx.createGain();
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (loops === -1) {
        source.loop = true;
    } else if (loops > 0) {
        source.loop = true;
        // Stop after loops * duration
        setTimeout(() => {
            try { source.stop(); } catch(e) {}
        }, buffer.duration * (loops + 1) * 1000);
    }

    source.start(0);

    const id = nextInstanceId++;
    activeInstances[id] = { source, gainNode, url };
    source.onended = () => { delete activeInstances[id]; };
    return id;
}

export function stop(instanceId, fadeDuration = 0) {
    if (instanceId == null || !activeInstances[instanceId]) return;

    const { source, gainNode } = activeInstances[instanceId];

    if (fadeDuration > 0 && audioCtx) {
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + fadeDuration / 1000);
        setTimeout(() => {
            try { source.stop(); } catch(e) {}
            delete activeInstances[instanceId];
        }, fadeDuration);
    } else {
        try { source.stop(); } catch(e) {}
        delete activeInstances[instanceId];
    }
}

export function stopAll() {
    for (const id of Object.keys(activeInstances)) {
        stop(parseInt(id));
    }
}
