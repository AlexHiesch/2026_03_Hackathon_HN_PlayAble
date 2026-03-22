/**
 * Hand gesture recognition using MediaPipe Hands.
 * Runs entirely in-browser via WebAssembly. Detects hand landmarks,
 * counts extended fingers, and maps gestures to PhoneEvents.
 */

const VISION_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18';

let handLandmarker = null;
let videoEl = null;
let canvasEl = null;
let canvasCtx = null;
let labelEl = null;
let overlayEl = null;
let stream = null;
let detecting = false;
let animFrameId = null;
let lastDetectTime = 0;

let pendingEvents = {};
let lastEventTime = {};
const DEBOUNCE_MS = 600;
const DETECT_INTERVAL_MS = 66; // ~15fps detection
const STABILITY_FRAMES = 3; // require gesture stable for N frames before firing
let stableGesture = null;
let stableCount = 0;
let heartCooldown = 0;
let heartParticles = [];

// MediaPipe hand landmark connections for drawing
const HAND_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],       // thumb
    [0,5],[5,6],[6,7],[7,8],       // index
    [0,9],[9,10],[10,11],[11,12],  // middle
    [0,13],[13,14],[14,15],[15,16],// ring
    [0,17],[17,18],[18,19],[19,20],// pinky
    [5,9],[9,13],[13,17],          // palm
];

// Finger tip, PIP, and MCP landmark indices
const FINGER_TIPS = [4, 8, 12, 16, 20]; // thumb, index, middle, ring, pinky
const FINGER_PIPS = [3, 6, 10, 14, 18];
const FINGER_MCPS = [2, 5, 9, 13, 17];

/**
 * Load MediaPipe Tasks Vision and create HandLandmarker.
 * Returns true if successful.
 */
export async function initGesture() {
    try {
        // Dynamic import of the ESM vision bundle from CDN
        const vision = await import(/* webpackIgnore: true */ `${VISION_CDN}/vision_bundle.mjs`);
        const { FilesetResolver, HandLandmarker } = vision;

        const fileset = await FilesetResolver.forVisionTasks(
            `${VISION_CDN}/wasm`
        );

        handLandmarker = await HandLandmarker.createFromOptions(fileset, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        console.log('Hand gesture model loaded.');
        return true;
    } catch (e) {
        console.warn('Hand gesture model failed to load:', e);
        handLandmarker = null;
        return false;
    }
}

/**
 * Start webcam and begin gesture detection loop.
 */
export async function startGestureTracking() {
    if (!handLandmarker) return;
    if (detecting) return;

    overlayEl = document.getElementById('gesture-overlay');
    videoEl = document.getElementById('gesture-video');
    canvasEl = document.getElementById('gesture-canvas');
    labelEl = document.getElementById('gesture-label');

    if (!overlayEl || !videoEl || !canvasEl) return;

    canvasCtx = canvasEl.getContext('2d');

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: 'user' },
            audio: false,
        });
        videoEl.srcObject = stream;
        await videoEl.play();

        canvasEl.width = videoEl.videoWidth || 320;
        canvasEl.height = videoEl.videoHeight || 240;

        overlayEl.style.display = 'block';
        detecting = true;
        detectLoop();
        console.log('Gesture tracking started.');
    } catch (e) {
        console.warn('Camera access denied or unavailable:', e);
    }
}

/**
 * Stop gesture detection and release camera.
 */
export function stopGestureTracking() {
    detecting = false;
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }
    if (videoEl) {
        videoEl.srcObject = null;
    }
    if (overlayEl) {
        overlayEl.style.display = 'none';
    }
    pendingEvents = {};
}

/**
 * Drain pending gesture events into a PhoneEvents object.
 */
export function drainGestureEvents(phoneEvents) {
    for (const key of Object.keys(pendingEvents)) {
        phoneEvents[key] = true;
    }
    pendingEvents = {};
}

// --- Detection Loop ---

function detectLoop() {
    if (!detecting) return;
    animFrameId = requestAnimationFrame(detectLoop);

    const now = performance.now();
    if (now - lastDetectTime < DETECT_INTERVAL_MS) return;
    lastDetectTime = now;

    if (!videoEl || videoEl.readyState < 2) return;

    try {
        const results = handLandmarker.detectForVideo(videoEl, now);
        drawAnnotations(results);
        processGesture(results);
    } catch (e) {
        // Silently ignore detection errors (e.g., video not ready)
    }
}

// --- Finger Counting ---

function dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function countFingers(landmarks, handedness) {
    let count = 0;

    // Skip thumb for general counting — it's too unreliable via x-position.
    // Thumb is only checked in isThumbUp() for the specific thumbs-up gesture.

    // Index, Middle, Ring, Pinky: finger is extended if tip is farther from
    // wrist than the MCP joint. This works regardless of hand orientation
    // (forehand or backhand).
    const wrist = landmarks[0];
    for (let i = 1; i < 5; i++) {
        const tipDist = dist(landmarks[FINGER_TIPS[i]], wrist);
        const mcpDist = dist(landmarks[FINGER_MCPS[i]], wrist);
        if (tipDist > mcpDist * 1.3) {
            count++;
        }
    }

    return count;
}

function isThumbUp(landmarks, handedness) {
    const isRightHand = handedness === 'Right';
    const thumbExtended = isRightHand
        ? landmarks[4].x < landmarks[3].x
        : landmarks[4].x > landmarks[3].x;

    if (!thumbExtended) return false;

    // Thumb tip above wrist
    if (landmarks[4].y > landmarks[0].y) return false;

    // All other fingers closed (distance-based, works forehand or backhand)
    const wrist = landmarks[0];
    for (let i = 1; i < 5; i++) {
        const tipDist = dist(landmarks[FINGER_TIPS[i]], wrist);
        const mcpDist = dist(landmarks[FINGER_MCPS[i]], wrist);
        if (tipDist > mcpDist * 1.3) {
            return false;
        }
    }
    return true;
}

function isHandUp(landmarks) {
    return landmarks[0].y > landmarks[9].y;
}

function isHandDown(landmarks) {
    return landmarks[0].y < landmarks[9].y;
}

// --- Heart Gesture Detection ---

function isHeartShape(results) {
    if (results.landmarks.length < 2) return false;

    const h0 = results.landmarks[0];
    const h1 = results.landmarks[1];

    // Both hands need fingertips curled inward (not extended) — forming the heart curves
    const wrist0 = h0[0], wrist1 = h1[0];
    for (let i = 1; i < 5; i++) {
        const tip0 = dist(h0[FINGER_TIPS[i]], wrist0);
        const mcp0 = dist(h0[FINGER_MCPS[i]], wrist0);
        if (tip0 > mcp0 * 1.3) return false; // finger extended = not heart
        const tip1 = dist(h1[FINGER_TIPS[i]], wrist1);
        const mcp1 = dist(h1[FINGER_MCPS[i]], wrist1);
        if (tip1 > mcp1 * 1.3) return false;
    }

    // Thumb tips should be close together (touching to form the bottom of the heart)
    const thumbDist = dist(h0[4], h1[4]);
    if (thumbDist > 0.15) return false;

    // Index fingertips should be close together (touching at top of heart)
    const indexDist = dist(h0[8], h1[8]);
    if (indexDist > 0.15) return false;

    // Thumbs should be below index fingers (heart shape: point at bottom)
    const avgThumbY = (h0[4].y + h1[4].y) / 2;
    const avgIndexY = (h0[8].y + h1[8].y) / 2;
    if (avgThumbY < avgIndexY) return false; // thumbs should be lower (higher y)

    return true;
}

function spawnHearts() {
    const container = document.getElementById('game-container');
    if (!container) return;

    const emojis = ['❤️', '💕', '💖', '💗', '💓', '💘', '💝'];
    for (let i = 0; i < 35; i++) {
        const heart = document.createElement('div');
        heart.className = 'heart-particle';
        heart.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        heart.style.left = (10 + Math.random() * 80) + '%';
        heart.style.animationDelay = (Math.random() * 1.0) + 's';
        heart.style.animationDuration = (2 + Math.random() * 2.5) + 's';
        heart.style.fontSize = (18 + Math.random() * 36) + 'px';
        container.appendChild(heart);
        setTimeout(() => heart.remove(), 5000);
    }
}

// --- Gesture Processing ---

function processGesture(results) {
    if (!results.landmarks || results.landmarks.length === 0) {
        if (labelEl) labelEl.textContent = '';
        return;
    }

    let totalFingers = 0;
    let gestureLabel = '';
    let eventKey = null;

    const hand0 = results.landmarks[0];
    const hand0ness = results.handednesses[0]?.[0]?.categoryName || 'Right';

    // Easter egg: heart shape with both hands
    if (results.landmarks.length === 2 && isHeartShape(results)) {
        gestureLabel = '❤️';
        const now = Date.now();
        if (now - heartCooldown > 3000) {
            heartCooldown = now;
            spawnHearts();
        }
        if (labelEl) labelEl.textContent = gestureLabel;
        return;
    }

    if (isThumbUp(hand0, hand0ness)) {
        gestureLabel = 'OK';
        eventKey = 'press_5';
    } else {
        for (let h = 0; h < results.landmarks.length; h++) {
            const lm = results.landmarks[h];
            const hn = results.handednesses[h]?.[0]?.categoryName || 'Right';
            totalFingers += countFingers(lm, hn);
        }

        if (totalFingers === 0) {
            gestureLabel = 'DUCK';
            eventKey = 'press_8';
        } else if (totalFingers === 4 && results.landmarks.length === 1) {
            if (isHandUp(hand0)) {
                gestureLabel = 'UP';
                eventKey = 'press_2';
            } else if (isHandDown(hand0)) {
                gestureLabel = 'DOWN';
                eventKey = 'press_8';
            } else {
                gestureLabel = '4';
            }
        } else if (totalFingers === 3 && results.landmarks.length === 1) {
            gestureLabel = '3';
            eventKey = 'press_3';
        } else if (totalFingers === 6) {
            gestureLabel = '6';
            eventKey = 'press_6';
        } else if (totalFingers === 8) {
            gestureLabel = '8';
            eventKey = 'press_9';
        } else if (totalFingers === 1) {
            gestureLabel = '1';
            eventKey = 'press_1';
        } else if (totalFingers === 2 && results.landmarks.length === 1) {
            gestureLabel = '2';
            eventKey = 'press_2';
        } else {
            gestureLabel = String(totalFingers);
        }
    }

    if (labelEl) {
        labelEl.textContent = gestureLabel;
    }

    // Require gesture to be stable for N frames before firing
    if (eventKey === stableGesture) {
        stableCount++;
    } else {
        stableGesture = eventKey;
        stableCount = 1;
    }

    if (eventKey && stableCount >= STABILITY_FRAMES) {
        const now = Date.now();
        if (!lastEventTime[eventKey] || now - lastEventTime[eventKey] >= DEBOUNCE_MS) {
            console.log(`[gesture] ${gestureLabel} → ${eventKey} (stable ${stableCount} frames)`);
            pendingEvents[eventKey] = true;
            lastEventTime[eventKey] = now;
        }
    }
}

// --- Annotation Drawing ---

function drawAnnotations(results) {
    if (!canvasCtx) return;

    const w = canvasEl.width;
    const h = canvasEl.height;

    canvasCtx.clearRect(0, 0, w, h);

    if (!results.landmarks || results.landmarks.length === 0) return;

    const colors = ['#00B894', '#6C5CE7'];

    for (let hi = 0; hi < results.landmarks.length; hi++) {
        const lm = results.landmarks[hi];
        const color = colors[hi % colors.length];

        // Draw connections
        canvasCtx.strokeStyle = color;
        canvasCtx.lineWidth = 2;
        for (const [a, b] of HAND_CONNECTIONS) {
            canvasCtx.beginPath();
            canvasCtx.moveTo(lm[a].x * w, lm[a].y * h);
            canvasCtx.lineTo(lm[b].x * w, lm[b].y * h);
            canvasCtx.stroke();
        }

        // Draw landmarks (fingertips larger)
        canvasCtx.fillStyle = '#fff';
        for (let i = 0; i < lm.length; i++) {
            const r = FINGER_TIPS.includes(i) ? 4 : 2;
            canvasCtx.beginPath();
            canvasCtx.arc(lm[i].x * w, lm[i].y * h, r, 0, Math.PI * 2);
            canvasCtx.fill();
        }
    }
}
