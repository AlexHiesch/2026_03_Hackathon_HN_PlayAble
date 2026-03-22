import { State } from '../state.js';
import { CaveGame } from '../cave/cave-game.js';
import { getState, registerState } from './states.js';

export class InCave extends State {
    constructor(context) {
        super(context);
        this.cave = new CaveGame(context);
    }

    processEvents(phoneEvents) {
        if (phoneEvents.hungup) return getState('Attract');
        if (this.cave.ended) return getState('Ending');
        this.cave.processEvents(phoneEvents);
        return null;
    }

    render(ctx) {
        this.cave.render(ctx);
    }

    onExit() {
        super.onExit();
        this.cave = null;
    }
}

registerState('InCave', InCave);
