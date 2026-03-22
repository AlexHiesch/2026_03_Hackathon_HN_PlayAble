import { State } from '../state.js';
import { Animation } from '../animation.js';
import { ForestResources } from './forest-resources.js';
import { play } from '../audio.js';

let PlayingClass;
export function resolveWaitIntroDeps(deps) { PlayingClass = deps.Playing; }

export class WaitIntro extends State {
    constructor(context) {
        super(context);
        this.needsBackground = 'PRE';
        this.needsBottom = 'PRE';
    }

    onEnter() {
        super.onEnter();
        play(ForestResources.speak_start);
    }

    processEvents(phoneEvents) {
        const idx = this.getFrameIndex();
        if (idx >= ForestResources.sync_start.length) {
            return PlayingClass;
        }
        return null;
    }

    render(ctx) {
        const idx = this.getFrameIndex();
        const frame = Animation.getSyncFrame(ForestResources.hugo_telllives, ForestResources.sync_start, idx);
        if (frame) ctx.drawImage(frame, 80, 20);
    }
}
