/**
 * Keyboard input handler. Maps keys to PhoneEvents.
 */
import { PhoneEvents } from './phone-events.js';

const keysPressed = new Set();

export function initInput() {
    document.addEventListener('keydown', (e) => {
        keysPressed.add(e.code);
        e.preventDefault();
    });
    document.addEventListener('keyup', (e) => {
        keysPressed.delete(e.code);
    });
}

/**
 * Poll keyboard state and return PhoneEvents for this frame.
 */
export function pollInput() {
    const ev = new PhoneEvents();

    for (const code of keysPressed) {
        switch (code) {
            // Jump
            case 'ArrowUp': case 'KeyW': ev.press_2 = true; break;
            // Duck
            case 'ArrowDown': case 'KeyS': ev.press_8 = true; break;
            // Left/Right (mapped to 4/6 for cave)
            case 'ArrowLeft': case 'KeyA': ev.press_4 = true; break;
            case 'ArrowRight': case 'KeyD': ev.press_6 = true; break;
            // Confirm / Start
            case 'Space': case 'Enter': ev.press_5 = true; break;
            // Number keys
            case 'Digit1': case 'Numpad1': ev.press_1 = true; break;
            case 'Digit2': case 'Numpad2': ev.press_2 = true; break;
            case 'Digit3': case 'Numpad3': ev.press_3 = true; break;
            case 'Digit4': case 'Numpad4': ev.press_4 = true; break;
            case 'Digit5': case 'Numpad5': ev.press_5 = true; break;
            case 'Digit6': case 'Numpad6': ev.press_6 = true; break;
            case 'Digit7': case 'Numpad7': ev.press_7 = true; break;
            case 'Digit8': case 'Numpad8': ev.press_8 = true; break;
            case 'Digit9': case 'Numpad9': ev.press_9 = true; break;
            case 'Digit0': case 'Numpad0': ev.press_0 = true; break;
            // Phone off-hook
            case 'F1': ev.offhook = true; break;
            // Hang up
            case 'Escape': ev.hungup = true; break;
            // Skip video
            case 'ShiftLeft': case 'ShiftRight': ev.skip = true; break;
        }
    }

    // Clear pressed keys after polling (one-shot behavior)
    keysPressed.clear();

    return ev;
}
