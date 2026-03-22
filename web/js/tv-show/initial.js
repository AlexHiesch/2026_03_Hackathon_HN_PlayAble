import { Config } from '../config.js';
import { VideoState } from './video-state.js';
import { getState, registerState } from './states.js';

export class Initial extends VideoState {
    constructor(context) {
        const c = Config.COUNTRY;
        super(context, `assets/videos/${c}/hello_hello.mp4`, false, `assets/audio_for_videos/${c}/hello_hello.mp3`);
    }

    processEvents(phoneEvents) {
        super.processEvents(phoneEvents);
        if (phoneEvents.hungup) return getState('Attract');
        if (this.videoEnded()) return getState('Press5');
        return null;
    }
}

registerState('Initial', Initial);
