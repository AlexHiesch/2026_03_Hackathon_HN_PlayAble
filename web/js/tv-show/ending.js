import { Config } from '../config.js';
import { VideoState } from './video-state.js';
import { getState, registerState } from './states.js';

export class Ending extends VideoState {
    constructor(context) {
        const c = Config.COUNTRY;
        super(context, `assets/videos/${c}/you_lost.mp4`, false, `assets/audio_for_videos/${c}/you_lost.mp3`);
    }

    processEvents(phoneEvents) {
        super.processEvents(phoneEvents);
        if (phoneEvents.hungup || this.videoEnded()) return getState('Attract');
        return null;
    }
}

registerState('Ending', Ending);
