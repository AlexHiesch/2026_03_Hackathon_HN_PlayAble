import { State } from '../state.js';
import { Animation } from '../animation.js';
import { ForestResources } from './forest-resources.js';
import { play } from '../audio.js';

export class TalkingGameOver extends State {
    constructor(context) {
        super(context);
        this.needsBackground = 'PRE';
        this.needsBottom = 'PRE';
    }

    onEnter() {
        super.onEnter();
        play(ForestResources.speak_gameover);
    }

    processEvents(phoneEvents) {
        if (this.getFrameIndex() >= ForestResources.sync_gameover.length) {
            return 'NullState';
        }
        return null;
    }

    render(ctx) {
        const frame = Animation.getSyncFrame(
            ForestResources.hugo_telllives, ForestResources.sync_gameover, this.getFrameIndex()
        );
        if (frame) ctx.drawImage(frame, 80, 20);
    }
}
