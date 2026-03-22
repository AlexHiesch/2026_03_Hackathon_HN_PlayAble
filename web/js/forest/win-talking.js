import { State } from '../state.js';
import { Animation } from '../animation.js';
import { ForestResources } from './forest-resources.js';
import { play } from '../audio.js';

export class WinTalking extends State {
    constructor(context) {
        super(context);
        this.needsBackground = 'PRE';
        this.needsBottom = 'PRE';
    }

    onEnter() {
        super.onEnter();
        play(ForestResources.speak_levelcompleted);
    }

    processEvents(phoneEvents) {
        if (this.getFrameIndex() >= ForestResources.sync_levelcompleted.length) {
            return 'NullState'; // End forest game
        }
        return null;
    }

    render(ctx) {
        const frame = Animation.getSyncFrame(
            ForestResources.hugo_telllives, ForestResources.sync_levelcompleted, this.getFrameIndex()
        );
        if (frame) ctx.drawImage(frame, 80, 20);
    }
}
