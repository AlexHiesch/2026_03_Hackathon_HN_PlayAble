import { State } from '../state.js';
import { Animation } from '../animation.js';
import { ForestResources } from './forest-resources.js';
import { play } from '../audio.js';

let PlayingClass;
export function resolveTalkingAfterHurtDeps(deps) { PlayingClass = deps.Playing; }

export class TalkingAfterHurt extends State {
    constructor(context) {
        super(context);
        this.needsBackground = 'PRE';
        this.needsBottom = 'PRE';
        this.sync = context.forest_lives === 1 ? ForestResources.sync_lastlife : ForestResources.sync_dieonce;
    }

    onEnter() {
        super.onEnter();
        const speak = this.context.forest_lives === 1 ? ForestResources.speak_lastlife : ForestResources.speak_dieonce;
        play(speak);
    }

    processEvents(phoneEvents) {
        if (this.getFrameIndex() >= this.sync.length) {
            return PlayingClass;
        }
        return null;
    }

    render(ctx) {
        const frame = Animation.getSyncFrame(ForestResources.hugo_telllives, this.sync, this.getFrameIndex());
        if (frame) ctx.drawImage(frame, 80, 20);
    }
}
