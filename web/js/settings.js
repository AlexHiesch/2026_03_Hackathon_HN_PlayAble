/**
 * User settings with localStorage persistence.
 */

const STORAGE_KEY = 'hugo_settings';

const DEFAULTS = {
    crtEnabled: true,
    scanlineIntensity: 0.25,
    curvature: 0.12,
    vignetteIntensity: 0.4,
    chromaticAberration: 0.3,
    volume: 1.0,
    speechEnabled: true,
};

export const settings = { ...DEFAULTS };

export function initSettings() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            Object.assign(settings, JSON.parse(saved));
        }
    } catch (e) {
        // Ignore
    }
}

export function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        // Ignore
    }
}

export function resetSettings() {
    Object.assign(settings, DEFAULTS);
    saveSettings();
}
