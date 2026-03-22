import { globalState } from './global-state.js';
import { initAudio } from './audio.js';
import { loadManifest, countAssets, setTotalToLoad, setProgressCallback } from './resource.js';
import { initInput, pollInput } from './input.js';
import { initSpeech, startListening, stopListening, drainSpeechEvents } from './speech.js';
import { initGesture, startGestureTracking, stopGestureTracking, drainGestureEvents } from './gesture.js';
import { initForestResources } from './forest/forest-resources.js';
import { TvShowParent } from './tv-show/tv-show-parent.js';
import { WebGLRenderer } from './webgl-renderer.js';
import { settings, initSettings, saveSettings } from './settings.js';
import { Config } from './config.js';

function loadTFJS() {
    return new Promise((resolve) => {
        if (typeof speechCommands !== 'undefined') { resolve(); return; }
        const tf = document.createElement('script');
        tf.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0';
        tf.onload = () => {
            const sc = document.createElement('script');
            sc.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/speech-commands@0.5.4';
            sc.onload = resolve;
            sc.onerror = resolve;
            document.head.appendChild(sc);
        };
        tf.onerror = resolve;
        document.head.appendChild(tf);
        setTimeout(resolve, 15000);
    });
}

// Offscreen game canvas (fixed 320x240)
const gameCanvas = document.createElement('canvas');
gameCanvas.width = 320;
gameCanvas.height = 240;
const gameCtx = gameCanvas.getContext('2d');
gameCtx.imageSmoothingEnabled = false;

// Display canvas (WebGL output, responsive)
let displayCanvas;
let webglRenderer = null;
let tvShow = null;
let running = false;
let lastFrameTime = 0;
let initialized = false;

function resizeCanvas() {
    const container = document.getElementById('game-container');
    const maxW = container.clientWidth;
    const maxH = container.clientHeight;

    // Maintain 4:3 aspect ratio
    const aspect = 4 / 3;
    let w, h;
    if (maxW / maxH > aspect) {
        h = maxH;
        w = Math.round(h * aspect);
    } else {
        w = maxW;
        h = Math.round(w / aspect);
    }

    displayCanvas.style.width = w + 'px';
    displayCanvas.style.height = h + 'px';
}

export async function init(options = {}) {
    displayCanvas = document.getElementById('game-canvas');

    // Show loading screen
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('loading-screen').style.display = 'flex';

    if (!initialized) {
        // First-time setup (only runs once)
        initSettings();
        initAudio();
        initInput();

        // Init WebGL renderer
        try {
            webglRenderer = new WebGLRenderer(displayCanvas);
        } catch (e) {
            console.warn('WebGL 2 not available, falling back to Canvas 2D:', e);
            webglRenderer = null;
        }

        // Fullscreen on double-click
        displayCanvas.addEventListener('dblclick', () => {
            if (!document.fullscreenElement) {
                document.getElementById('game-container').requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen();
            }
        });

        // Load manifest & resources
        await loadManifest();
        const total = countAssets();
        setTotalToLoad(total);

        setProgressCallback((loaded, totalCount) => {
            const pct = totalCount > 0 ? Math.round((loaded / totalCount) * 100) : 0;
            document.getElementById('progress-fill').style.width = pct + '%';
            document.getElementById('loading-text').textContent = pct + '%';
        });

        await initForestResources();
        initialized = true;
    }

    const inputModes = options.inputModes || [];
    const loadingText = document.getElementById('loading-text');
    const inputPromises = [];

    // Init speech model if selected
    if (inputModes.includes('speech')) {
        inputPromises.push(
            initSpeech((msg) => {
                if (loadingText) loadingText.textContent = msg;
            }).then(available => {
                if (available) startListening();
            })
        );
    }

    // Init gesture model if selected
    if (inputModes.includes('gesture')) {
        if (loadingText) loadingText.textContent = 'Loading hand tracking...';
        inputPromises.push(
            initGesture().then(available => {
                if (available) startGestureTracking();
            })
        );
    }

    // Responsive sizing
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Wait for selected input models (non-blocking — game starts even if they fail)
    await Promise.allSettled(inputPromises);

    // Hide loading, start game
    document.getElementById('loading-screen').style.display = 'none';

    // Create game
    tvShow = new TvShowParent(options.startState);
    initSettingsUI(inputModes);
    running = true;
    lastFrameTime = performance.now() / 1000;
    globalState.frameTime = lastFrameTime;

    requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    if (!running) return;

    const now = timestamp / 1000;
    globalState.frameTime = now;

    // Target 30fps for game logic
    if (now - lastFrameTime < 1 / 30) {
        requestAnimationFrame(gameLoop);
        return;
    }
    lastFrameTime = now;

    // Poll input
    const phoneEvents = pollInput();

    // Merge speech and gesture events
    drainSpeechEvents(phoneEvents);
    drainGestureEvents(phoneEvents);

    // Update
    tvShow.handleEvents(phoneEvents);

    // Clear & render to offscreen canvas
    gameCtx.fillStyle = '#000';
    gameCtx.fillRect(0, 0, 320, 240);
    tvShow.render(gameCtx);

    // Output via WebGL with CRT effects, or fallback to Canvas 2D
    if (webglRenderer && webglRenderer.ready) {
        // Sync settings to shader uniforms
        webglRenderer.setUniforms({
            scanline_intensity: settings.crtEnabled ? settings.scanlineIntensity : 0,
            curvature: settings.crtEnabled ? settings.curvature : 0,
            vignette_intensity: settings.crtEnabled ? settings.vignetteIntensity : 0,
            chromatic_aberration: settings.crtEnabled ? settings.chromaticAberration : 0,
            wavyness: settings.crtEnabled ? 0.003 : 0,
        });
        webglRenderer.render(gameCanvas, now);
    } else {
        // Fallback: draw offscreen canvas directly via 2d context
        if (!displayCanvas._fallbackCtx) {
            displayCanvas._fallbackCtx = displayCanvas.getContext('2d');
            displayCanvas.classList.add('canvas2d');
        }
        const dpr = window.devicePixelRatio || 1;
        const w = Math.round(displayCanvas.clientWidth * dpr);
        const h = Math.round(displayCanvas.clientHeight * dpr);
        if (displayCanvas.width !== w || displayCanvas.height !== h) {
            displayCanvas.width = w;
            displayCanvas.height = h;
        }
        displayCanvas._fallbackCtx.imageSmoothingEnabled = false;
        displayCanvas._fallbackCtx.drawImage(gameCanvas, 0, 0, w, h);
    }

    requestAnimationFrame(gameLoop);
}

// Settings UI wiring
function initSettingsUI(inputModes) {
    const hasSpeech = inputModes.includes('speech');
    const hasGesture = inputModes.includes('gesture');

    // Voice help button
    const voiceBtn = document.getElementById('voice-help-btn');
    const voicePanel = document.getElementById('voice-help-panel');
    if (hasSpeech) voiceBtn.style.display = 'flex';
    voiceBtn.addEventListener('click', () => {
        voicePanel.style.display = voicePanel.style.display === 'none' ? 'block' : 'none';
    });

    // Gesture help button
    const gestureBtn = document.getElementById('gesture-help-btn');
    const gesturePanel = document.getElementById('gesture-help-panel');
    if (hasGesture) gestureBtn.style.display = 'flex';
    gestureBtn.addEventListener('click', () => {
        gesturePanel.style.display = gesturePanel.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', (e) => {
        if (!voiceBtn.contains(e.target) && !voicePanel.contains(e.target)) {
            voicePanel.style.display = 'none';
        }
        if (!gestureBtn.contains(e.target) && !gesturePanel.contains(e.target)) {
            gesturePanel.style.display = 'none';
        }
    });

    // Wire up input toggles in settings panel
    const voiceToggle = document.getElementById('voice-toggle');
    const gestureToggle = document.getElementById('gesture-toggle');
    if (voiceToggle) {
        voiceToggle.checked = hasSpeech;
        voiceToggle.addEventListener('change', async () => {
            if (voiceToggle.checked) {
                // Lazy-load TF.js if not yet loaded
                if (typeof speechCommands === 'undefined') {
                    await loadTFJS();
                }
                const ok = await initSpeech(() => {});
                if (ok) startListening();
                voiceBtn.style.display = 'flex';
            } else {
                stopListening();
                voiceBtn.style.display = 'none';
                voicePanel.style.display = 'none';
            }
        });
    }
    if (gestureToggle) {
        gestureToggle.checked = hasGesture;
        gestureToggle.addEventListener('change', async () => {
            if (gestureToggle.checked) {
                const ok = await initGesture();
                if (ok) await startGestureTracking();
                gestureBtn.style.display = 'flex';
            } else {
                stopGestureTracking();
                gestureBtn.style.display = 'none';
                gesturePanel.style.display = 'none';
            }
        });
    }

    // Game speed slider
    const speedSlider = document.getElementById('speed-slider');
    if (speedSlider) {
        speedSlider.value = Math.round(Config.FOREST_GAME_SPEED * 100);
        speedSlider.addEventListener('input', () => {
            Config.FOREST_GAME_SPEED = speedSlider.value / 100;
        });
    }

    // Mode toggle button
    const modeBtn = document.getElementById('mode-toggle');
    modeBtn.style.display = 'block';
    modeBtn.classList.toggle('active', settings.crtEnabled);
    modeBtn.textContent = settings.crtEnabled ? 'CRT' : 'Classic';
    modeBtn.addEventListener('click', () => {
        settings.crtEnabled = !settings.crtEnabled;
        modeBtn.classList.toggle('active', settings.crtEnabled);
        modeBtn.textContent = settings.crtEnabled ? 'CRT' : 'Classic';
        document.getElementById('crt-toggle').checked = settings.crtEnabled;
        saveSettings();
    });

    const btn = document.getElementById('settings-btn');
    const panel = document.getElementById('settings-panel');
    btn.style.display = 'flex';

    btn.addEventListener('click', () => {
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
    });
    document.getElementById('settings-close').addEventListener('click', () => {
        panel.style.display = 'none';
    });

    const crtToggle = document.getElementById('crt-toggle');
    const scanlineSlider = document.getElementById('scanline-slider');
    const curvatureSlider = document.getElementById('curvature-slider');
    const chromaticSlider = document.getElementById('chromatic-slider');
    const vignetteSlider = document.getElementById('vignette-slider');

    // Sync UI to current settings
    crtToggle.checked = settings.crtEnabled;
    scanlineSlider.value = Math.round(settings.scanlineIntensity * 100);
    curvatureSlider.value = Math.round(settings.curvature / 0.3 * 100);
    chromaticSlider.value = Math.round(settings.chromaticAberration / 1.0 * 100);
    vignetteSlider.value = Math.round(settings.vignetteIntensity / 1.0 * 100);

    crtToggle.addEventListener('change', () => {
        settings.crtEnabled = crtToggle.checked;
        modeBtn.classList.toggle('active', settings.crtEnabled);
        modeBtn.textContent = settings.crtEnabled ? 'CRT' : 'Classic';
        saveSettings();
    });
    scanlineSlider.addEventListener('input', () => {
        settings.scanlineIntensity = scanlineSlider.value / 100;
        saveSettings();
    });
    curvatureSlider.addEventListener('input', () => {
        settings.curvature = (curvatureSlider.value / 100) * 0.3;
        saveSettings();
    });
    chromaticSlider.addEventListener('input', () => {
        settings.chromaticAberration = (chromaticSlider.value / 100) * 1.0;
        saveSettings();
    });
    vignetteSlider.addEventListener('input', () => {
        settings.vignetteIntensity = (vignetteSlider.value / 100) * 1.0;
        saveSettings();
    });
}

export function cleanup() {
    running = false;
    if (tvShow) {
        tvShow = null;
    }
    if (webglRenderer) {
        webglRenderer = null;
    }
    stopListening();
    stopGestureTracking();
    window.removeEventListener('resize', resizeCanvas);
}
