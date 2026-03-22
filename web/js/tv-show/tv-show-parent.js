import { Config } from '../config.js';
import { GameData } from '../game-data.js';
import { getState } from './states.js';

// Import all states to trigger their registerState() calls
import './attract.js';
import './initial.js';
import './press-5.js';
import './have-luck.js';
import './instructions.js';
import './playing.js';
import './in-scoreboard.js';
import './going-cave.js';
import './in-cave.js';
import './ending.js';

export class TvShowParent {
    constructor(startState) {
        this.context = new GameData(Config.COUNTRY);
        const StateClass = getState(startState || 'Attract');
        this._state = new StateClass(this.context);
        this._state.onEnter();
    }

    handleEvents(phoneEvents) {
        const nextState = this._state.processEvents(phoneEvents);
        if (nextState !== null && nextState !== undefined) {
            this._state.onExit();
            this._state = new nextState(this.context);
            this._state.onEnter();
        }
    }

    render(ctx) {
        this._state.render(ctx);
    }

    isPlaying() {
        const Attract = getState('Attract');
        return !(this._state instanceof Attract);
    }

    cleanup() {
        if (this._state) {
            this._state.onExit();
            this._state = null;
        }
    }
}
