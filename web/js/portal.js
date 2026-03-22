import { games, getGameById } from './game-catalog.js';

let gameModule = null;
let gameActive = false;

const ACCESSIBILITY_ICONS = {
    voice: { label: 'Voice Control', icon: '&#127908;', cls: 'badge-voice' },
    keyboard: { label: 'Keyboard', icon: '&#9000;', cls: 'badge-keyboard' },
    simplified: { label: 'Simplified', icon: '&#9734;', cls: 'badge-simplified' },
    gesture: { label: 'Gesture', icon: '&#9995;', cls: 'badge-gesture' },
};

// --- Router ---

function getRoute() {
    const hash = window.location.hash || '#/';
    return hash.slice(1) || '/';
}

function navigate(path) {
    window.location.hash = '#' + path;
}

export function initPortal() {
    window.addEventListener('hashchange', onRouteChange);
    onRouteChange();
}

function onRouteChange() {
    const route = getRoute();
    const content = document.getElementById('app-content');
    const header = document.getElementById('portal-header');
    const gameContainer = document.getElementById('game-container');

    // Match routes
    if (route.match(/^\/game\/([^/]+)\/play$/)) {
        const id = route.match(/^\/game\/([^/]+)\/play$/)[1];
        enterGamePlay(id, content, header, gameContainer);
        return;
    }

    // If leaving game play, clean up
    if (gameActive) {
        exitGamePlay(content, header, gameContainer);
    }

    header.style.display = '';
    gameContainer.style.display = 'none';
    content.style.display = '';

    // Update active nav link
    document.querySelectorAll('#portal-header nav a').forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === '#' + route);
    });

    if (route === '/' || route === '') {
        renderHome(content);
    } else if (route === '/library') {
        renderLibrary(content);
    } else if (route.match(/^\/game\/([^/]+)$/)) {
        const id = route.match(/^\/game\/([^/]+)$/)[1];
        renderGameDetail(id, content);
    } else if (route === '/settings') {
        renderSettings(content);
    } else {
        content.innerHTML = '<div class="portal-page"><h2>Page not found</h2><a href="#/">Go home</a></div>';
    }

    window.scrollTo(0, 0);
}

// --- Game Play ---

async function enterGamePlay(id, content, header, gameContainer) {
    const game = getGameById(id);
    if (!game || game.status !== 'playable') {
        navigate('/library');
        return;
    }

    header.style.display = 'none';
    content.style.display = 'none';
    gameContainer.style.display = 'flex';
    gameActive = true;

    // Add exit button
    let exitBtn = document.getElementById('exit-game-btn');
    if (!exitBtn) {
        exitBtn = document.createElement('button');
        exitBtn.id = 'exit-game-btn';
        exitBtn.textContent = 'Exit Game';
        exitBtn.addEventListener('click', () => navigate('/game/' + id));
        gameContainer.appendChild(exitBtn);
    }
    exitBtn.style.display = 'block';
    exitBtn.onclick = () => navigate('/game/' + id);

    // Show input mode chooser
    const startScreen = document.getElementById('start-screen');
    startScreen.style.display = 'none';

    const inputModes = await showInputModeChooser(gameContainer);

    // Show loading screen
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.style.display = 'flex';
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = 'Loading...';

    // Load TF.js + import game module in parallel
    await Promise.all([
        inputModes.includes('speech') ? loadTensorFlow() : Promise.resolve(),
        gameModule ? Promise.resolve() : import('./main.js').then(m => { gameModule = m; }),
    ]);

    // Start the game with chosen input modes
    try {
        await gameModule.init({ startState: 'TvShowPlaying', inputModes });
    } catch (err) {
        console.error('Game init failed:', err);
        if (loadingText) loadingText.textContent = 'Error: ' + err.message;
    }
}

function exitGamePlay(content, header, gameContainer) {
    if (gameModule) {
        gameModule.cleanup();
    }
    gameActive = false;

    const exitBtn = document.getElementById('exit-game-btn');
    if (exitBtn) exitBtn.style.display = 'none';

    // Reset game UI
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.style.display = 'none';
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = 'none';
}

function loadTensorFlow() {
    return new Promise((resolve) => {
        if (typeof speechCommands !== 'undefined') {
            resolve();
            return;
        }
        let loaded = 0;
        const total = 2;
        function check() {
            loaded++;
            if (loaded >= total) resolve();
        }

        const tf = document.createElement('script');
        tf.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0';
        tf.onload = () => {
            const sc = document.createElement('script');
            sc.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/speech-commands@0.5.4';
            sc.onload = check;
            sc.onerror = check;
            document.head.appendChild(sc);
        };
        tf.onerror = () => { loaded = total; resolve(); };
        document.head.appendChild(tf);

        // Timeout fallback
        setTimeout(resolve, 15000);
    });
}

// --- Input Mode Chooser ---

function showInputModeChooser(container) {
    return new Promise((resolve) => {
        const selected = new Set();

        const chooser = document.createElement('div');
        chooser.id = 'input-mode-chooser';
        chooser.innerHTML = `
            <div class="chooser-content">
                <h2>How do you want to play?</h2>
                <p class="chooser-sub">Keyboard always active. Select additional input methods:</p>
                <div class="chooser-options">
                    <button class="chooser-card" data-mode="speech">
                        <span class="chooser-icon">&#127908;</span>
                        <span class="chooser-label">Voice Control</span>
                        <span class="chooser-desc">Say "up", "down", "go" and numbers. Uses microphone.</span>
                    </button>
                    <button class="chooser-card" data-mode="gesture">
                        <span class="chooser-icon">&#9995;</span>
                        <span class="chooser-label">Hand Gestures</span>
                        <span class="chooser-desc">Show your hands to the camera. Palm up, fist, finger counts.</span>
                    </button>
                </div>
                <button class="chooser-start" id="chooser-start-btn">Start Game</button>
            </div>
        `;
        container.appendChild(chooser);

        chooser.querySelectorAll('.chooser-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                if (selected.has(mode)) {
                    selected.delete(mode);
                    btn.classList.remove('selected');
                } else {
                    selected.add(mode);
                    btn.classList.add('selected');
                }
            });
        });

        chooser.querySelector('#chooser-start-btn').addEventListener('click', () => {
            chooser.remove();
            resolve(Array.from(selected));
        });
    });
}

// --- Page Renderers ---

function renderHome(el) {
    const hugo = getGameById('hugo');
    const upcoming = games.filter(g => g.status === 'coming_soon');

    el.innerHTML = `
        <div class="portal-page home-page">
            <section class="hero">
                <div class="hero-content">
                    <h1 class="hero-title">Games for <span class="highlight">Everyone</span></h1>
                    <p class="hero-subtitle">An accessible gaming portal where anyone can play — with voice, keyboard, or simplified controls. No barriers, just fun.</p>
                    <div class="hero-features">
                        <div class="hero-feature">
                            <span class="hero-feature-icon">&#127908;</span>
                            <span>Voice Control</span>
                        </div>
                        <div class="hero-feature">
                            <span class="hero-feature-icon">&#9000;</span>
                            <span>Keyboard</span>
                        </div>
                        <div class="hero-feature">
                            <span class="hero-feature-icon">&#9734;</span>
                            <span>Accessible</span>
                        </div>
                        <div class="hero-feature">
                            <span class="hero-feature-icon">&#9995;</span>
                            <span>Hand Gestures</span>
                        </div>
                    </div>
                </div>
            </section>

            <section class="featured-section">
                <h2 class="section-title">Featured Game</h2>
                <div class="featured-card" onclick="window.location.hash='#/game/${hugo.id}'">
                    <div class="featured-image">
                        <img src="${hugo.coverImage}" alt="${hugo.title}" onerror="this.style.display='none'">
                    </div>
                    <div class="featured-info">
                        <h3>${hugo.title}</h3>
                        <p class="featured-subtitle">${hugo.subtitle}</p>
                        <p class="featured-desc">${hugo.description}</p>
                        <div class="badge-row">
                            ${renderBadges(hugo.accessibility)}
                        </div>
                        <a href="#/game/${hugo.id}/play" class="btn-primary" onclick="event.stopPropagation()">Play Now</a>
                    </div>
                </div>
            </section>

            <section class="coming-section">
                <h2 class="section-title">Coming Soon</h2>
                <div class="game-grid">
                    ${upcoming.map(g => renderGameCard(g)).join('')}
                </div>
            </section>

            <footer class="portal-footer">
                <p>PlayAble &mdash; Making games accessible to everyone.</p>
                <p class="footer-sub">Built with care. Voice-first. Barrier-free.</p>
            </footer>
        </div>
    `;
}

function renderLibrary(el) {
    el.innerHTML = `
        <div class="portal-page library-page">
            <h1 class="page-title">Game Library</h1>
            <div class="filter-chips">
                <button class="chip active" data-filter="all">All Games</button>
                <button class="chip" data-filter="voice">Voice Control</button>
                <button class="chip" data-filter="keyboard">Keyboard</button>
            </div>
            <div class="game-grid">
                ${games.map(g => renderGameCard(g)).join('')}
            </div>
        </div>
    `;

    // Filter chips (visual only for MVP)
    el.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            el.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        });
    });
}

function renderGameDetail(id, el) {
    const game = getGameById(id);
    if (!game) {
        el.innerHTML = '<div class="portal-page"><h2>Game not found</h2><a href="#/library">Back to Library</a></div>';
        return;
    }

    const isPlayable = game.status === 'playable';

    el.innerHTML = `
        <div class="portal-page detail-page">
            <a href="#/library" class="back-link">&larr; Back to Library</a>
            <div class="detail-hero">
                <div class="detail-image">
                    ${game.coverImage
                        ? `<img src="${game.coverImage}" alt="${game.title}" onerror="this.style.display='none'">`
                        : `<div class="placeholder-cover">${game.title[0]}</div>`
                    }
                </div>
                <div class="detail-info">
                    <h1>${game.title}</h1>
                    ${game.subtitle ? `<p class="detail-subtitle">${game.subtitle}</p>` : ''}
                    <div class="detail-meta">
                        <span class="meta-tag">${game.genre}</span>
                        <span class="meta-tag">Age ${game.ageRating}</span>
                        <span class="meta-tag status-${game.status}">${isPlayable ? 'Playable' : 'Coming Soon'}</span>
                    </div>
                    <p class="detail-desc">${game.description}</p>
                    <div class="badge-row">
                        ${renderBadges(game.accessibility)}
                    </div>
                    ${isPlayable
                        ? `<a href="#/game/${game.id}/play" class="btn-primary btn-large">Play Now</a>`
                        : `<button class="btn-disabled" disabled>Coming Soon</button>`
                    }
                </div>
            </div>
            ${isPlayable && game.controls ? renderControlsSection(game.controls) : ''}
        </div>
    `;
}

function renderControlsSection(controls) {
    return `
        <section class="controls-section">
            <h2 class="section-title">Controls</h2>
            <div class="controls-grid">
                <div class="controls-col">
                    <h3>Keyboard</h3>
                    ${controls.keyboard.map(c => `
                        <div class="control-item">
                            <span class="control-keys">${c.keys.map(k => `<kbd>${k}</kbd>`).join(' ')}</span>
                            <span class="control-action">${c.action}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="controls-col">
                    <h3>Voice Commands</h3>
                    ${controls.voice.map(c => `
                        <div class="control-item">
                            <span class="voice-cmd">"${c.cmd}"</span>
                            <span class="control-action">${c.action}</span>
                        </div>
                    `).join('')}
                </div>
                ${controls.gesture ? `
                <div class="controls-col">
                    <h3>Hand Gestures</h3>
                    ${controls.gesture.map(c => `
                        <div class="control-item">
                            <span class="gesture-cmd">${c.cmd}</span>
                            <span class="control-action">${c.action}</span>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
        </section>
    `;
}

function renderSettings(el) {
    const saved = JSON.parse(localStorage.getItem('playable-settings') || '{}');

    el.innerHTML = `
        <div class="portal-page settings-page">
            <h1 class="page-title">Accessibility Settings</h1>

            <div class="settings-group">
                <h2>Input Mode</h2>
                <p class="settings-desc">Choose how you interact with games.</p>
                <div class="input-mode-grid">
                    <label class="mode-card ${(saved.inputMode || 'standard') === 'standard' ? 'selected' : ''}">
                        <input type="radio" name="input-mode" value="standard" ${(saved.inputMode || 'standard') === 'standard' ? 'checked' : ''}>
                        <span class="mode-icon">&#9000;</span>
                        <span class="mode-label">Standard</span>
                        <span class="mode-desc">Keyboard controls</span>
                    </label>
                    <label class="mode-card ${saved.inputMode === 'voice' ? 'selected' : ''}">
                        <input type="radio" name="input-mode" value="voice" ${saved.inputMode === 'voice' ? 'checked' : ''}>
                        <span class="mode-icon">&#127908;</span>
                        <span class="mode-label">Voice</span>
                        <span class="mode-desc">Speak commands</span>
                    </label>
                    <label class="mode-card ${saved.inputMode === 'simplified' ? 'selected' : ''}">
                        <input type="radio" name="input-mode" value="simplified" ${saved.inputMode === 'simplified' ? 'checked' : ''}>
                        <span class="mode-icon">&#9734;</span>
                        <span class="mode-label">Simplified</span>
                        <span class="mode-desc">Fewer controls needed</span>
                    </label>
                </div>
            </div>

            <div class="settings-group">
                <h2>Visual Preferences</h2>
                <label class="setting-row">
                    <span>High Contrast</span>
                    <input type="checkbox" id="high-contrast" ${saved.highContrast ? 'checked' : ''}>
                </label>
                <label class="setting-row">
                    <span>Large Text</span>
                    <input type="checkbox" id="large-text" ${saved.largeText ? 'checked' : ''}>
                </label>
                <label class="setting-row">
                    <span>CRT Effects</span>
                    <input type="checkbox" id="portal-crt" ${saved.crtEnabled !== false ? 'checked' : ''}>
                </label>
            </div>

            <div class="settings-group">
                <h2>Audio</h2>
                <label class="setting-row">
                    <span>Volume</span>
                    <input type="range" id="portal-volume" min="0" max="100" value="${Math.round((saved.volume ?? 1) * 100)}">
                </label>
            </div>

            <div class="settings-actions">
                <button class="btn-primary" id="save-settings-btn">Save Settings</button>
                <button class="btn-secondary" id="reset-settings-btn">Reset to Defaults</button>
            </div>
        </div>
    `;

    // Mode card selection
    el.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
            el.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });

    // Save
    el.querySelector('#save-settings-btn').addEventListener('click', () => {
        const mode = el.querySelector('input[name="input-mode"]:checked');
        const data = {
            inputMode: mode ? mode.value : 'standard',
            highContrast: el.querySelector('#high-contrast').checked,
            largeText: el.querySelector('#large-text').checked,
            crtEnabled: el.querySelector('#portal-crt').checked,
            volume: el.querySelector('#portal-volume').value / 100,
        };
        localStorage.setItem('playable-settings', JSON.stringify(data));
        showToast('Settings saved!');
    });

    // Reset
    el.querySelector('#reset-settings-btn').addEventListener('click', () => {
        localStorage.removeItem('playable-settings');
        renderSettings(el);
        showToast('Settings reset to defaults.');
    });
}

// --- Helpers ---

function renderBadges(accessibilityList) {
    if (!accessibilityList) return '';
    return accessibilityList.map(key => {
        const info = ACCESSIBILITY_ICONS[key];
        if (!info) return '';
        return `<span class="access-badge ${info.cls}">${info.icon} ${info.label}</span>`;
    }).join('');
}

function renderGameCard(game) {
    const isPlayable = game.status === 'playable';
    return `
        <div class="game-card ${!isPlayable ? 'coming-soon' : ''}" onclick="window.location.hash='#/game/${game.id}'">
            <div class="card-image">
                ${game.coverImage
                    ? `<img src="${game.coverImage}" alt="${game.title}" onerror="this.parentElement.innerHTML='<div class=\\'placeholder-cover\\'>${game.title[0]}</div>'">`
                    : `<div class="placeholder-cover">${game.title[0]}</div>`
                }
                ${!isPlayable ? '<div class="coming-soon-overlay">Coming Soon</div>' : ''}
            </div>
            <div class="card-body">
                <h3 class="card-title">${game.title}</h3>
                <div class="badge-row small">
                    ${renderBadges(game.accessibility)}
                </div>
            </div>
        </div>
    `;
}

function showToast(msg) {
    let toast = document.getElementById('portal-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'portal-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}
