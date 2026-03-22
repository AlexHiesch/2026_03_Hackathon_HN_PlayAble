import { Config } from '../config.js';
import { VideoState } from './video-state.js';
import { getState, registerState } from './states.js';

export class HaveLuck extends VideoState {
    constructor(context) {
        const c = Config.COUNTRY;
        super(context, `assets/videos/${c}/have_luck.mp4`, false, `assets/audio_for_videos/${c}/have_luck.mp3`);
    }

    processEvents(phoneEvents) {
        super.processEvents(phoneEvents);
        if (phoneEvents.hungup) return getState('Attract');
        if (this.videoEnded()) return getState('Instructions');
        return null;
    }
}

registerState('HaveLuck', HaveLuck);
