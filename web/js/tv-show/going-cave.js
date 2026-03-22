import { Config } from '../config.js';
import { VideoState } from './video-state.js';
import { getState, registerState } from './states.js';

export class GoingCave extends VideoState {
    constructor(context) {
        const c = Config.COUNTRY;
        super(context, `assets/videos/${c}/scylla_cave.mp4`, false, `assets/audio_for_videos/${c}/scylla_cave.mp3`);
    }

    processEvents(phoneEvents) {
        super.processEvents(phoneEvents);
        if (phoneEvents.hungup) return getState('Attract');
        if (this.videoEnded()) return getState('InCave');
        return null;
    }
}

registerState('GoingCave', GoingCave);
