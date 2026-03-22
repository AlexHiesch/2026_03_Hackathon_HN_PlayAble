/**
 * Asset loader - loads images and audio from the converted assets directory.
 */
import { preloadAudio } from './audio.js';

const imageCache = {};
let manifest = null;
let onProgress = null;
let totalToLoad = 0;
let loaded = 0;

export function setProgressCallback(cb) {
    onProgress = cb;
}

function updateProgress() {
    loaded++;
    if (onProgress) onProgress(loaded, totalToLoad);
}

export async function loadManifest() {
    const resp = await fetch('assets/manifest.json');
    manifest = await resp.json();
    return manifest;
}

export function getManifest() {
    return manifest;
}

/**
 * Load a single image and cache it.
 */
export function loadImage(path) {
    if (imageCache[path]) return Promise.resolve(imageCache[path]);
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            imageCache[path] = img;
            updateProgress();
            resolve(img);
        };
        img.onerror = () => {
            console.warn(`Failed to load image: ${path}`);
            updateProgress();
            resolve(null);
        };
        img.src = path;
    });
}

/**
 * Load frames for a sprite from the manifest.
 * Returns array of Image objects.
 */
export async function loadFrames(category, name) {
    if (!manifest) await loadManifest();

    const gfxKey = category + '_gfx';
    const entries = manifest[gfxKey] || [];
    const entry = entries.find(e => e.name === name);
    if (!entry) {
        console.warn(`No manifest entry for ${category}/${name}`);
        return [];
    }

    const frames = [];
    for (const frameInfo of entry.frames) {
        const path = `assets/${category}/${frameInfo.file}`;
        const img = await loadImage(path);
        frames.push(img);
    }
    return frames;
}

/**
 * Load a sync file (JSON array of frame indices).
 */
export async function loadSync(category, name) {
    const path = `assets/${category}/${name}.json`;
    try {
        const resp = await fetch(path);
        return await resp.json();
    } catch(e) {
        console.warn(`Failed to load sync: ${path}`);
        return [];
    }
}

/**
 * Load audio and return the URL for playback.
 */
export async function loadAudioAsset(category, name) {
    const url = `assets/${category}/${name}.mp3`;
    await preloadAudio(url);
    return url;
}

/**
 * Load a static image from assets directory.
 */
export async function loadStaticImage(path) {
    return loadImage(`assets/${path}`);
}

/**
 * Count total assets to load for progress tracking.
 */
export function countAssets() {
    if (!manifest) return 0;
    let count = 0;
    for (const key of ['forest_gfx', 'cave_gfx']) {
        for (const entry of (manifest[key] || [])) {
            count += entry.frameCount;
        }
    }
    // Audio files
    for (const key of ['forest_audio', 'cave_audio']) {
        count += (manifest[key] || []).length;
    }
    // Static images
    count += (manifest.static || []).length;
    return count;
}

export function setTotalToLoad(n) {
    totalToLoad = n;
    loaded = 0;
}
