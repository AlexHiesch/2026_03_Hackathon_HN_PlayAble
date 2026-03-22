import { globalState } from './global-state.js';

export class State {
    constructor(context) {
        this.startTime = null;
        this.events = {};
        this.context = context;
    }

    processEvents(phoneEvents) { return null; }
    render(ctx) {}

    onEnter() {
        this.startTime = globalState.frameTime;
    }

    onExit() {}

    getStateTime() {
        return globalState.frameTime - this.startTime;
    }

    getFrameIndex() {
        return Math.floor(this.getStateTime() * 10);
    }

    getFrameIndexFast() {
        return Math.floor(this.getStateTime() * 20);
    }

    oneShot(delta, name) {
        if (!(name in this.events) && globalState.frameTime - this.startTime > delta) {
            this.events[name] = globalState.frameTime - this.startTime;
            return true;
        }
        return false;
    }

    every(delta, name, offset = 0.0) {
        if (!(name in this.events)) {
            if (globalState.frameTime - this.startTime > offset) {
                this.events[name] = globalState.frameTime + delta;
                return true;
            }
        } else if (globalState.frameTime - this.events[name] >= 0) {
            this.events[name] = globalState.frameTime + delta;
            return true;
        }
        return false;
    }
}
