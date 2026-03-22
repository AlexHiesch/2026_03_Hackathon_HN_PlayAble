import { State } from '../state.js';
import { ForestGame } from '../forest/forest-game.js';
import { getState, registerState } from './states.js';

export class TvShowPlaying extends State {
    constructor(context) {
        super(context);
        this.forest = new ForestGame(context);
    }

    processEvents(phoneEvents) {
        if (phoneEvents.hungup) return getState('Attract');
        if (this.forest.ended) return getState('InScoreboard');
        this.forest.processEvents(phoneEvents);
        return null;
    }

    render(ctx) {
        this.forest.render(ctx);
    }

    onExit() {
        super.onExit();
        if (this.forest && !this.forest.ended) this.forest.end();
        this.forest = null;
    }
}

registerState('TvShowPlaying', TvShowPlaying);
