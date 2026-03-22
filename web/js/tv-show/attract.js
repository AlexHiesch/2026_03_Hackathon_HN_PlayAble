import { Config } from '../config.js';
import { VideoState } from './video-state.js';
import { getState, registerState } from './states.js';

export class Attract extends VideoState {
    constructor(context) {
        const c = Config.COUNTRY;
        super(context, `assets/videos/${c}/attract_demo.mp4`, true, `assets/audio_for_videos/${c}/attract_demo.mp3`);
    }

    getSkipHint() {
        return 'SPACE or say "go" to play';
    }

    processEvents(phoneEvents) {
        super.processEvents(phoneEvents);

        // Any of these starts the game
        if (phoneEvents.offhook || phoneEvents.press_5 || phoneEvents.skip) {
            return getState('TvShowPlaying');
        }

        // Press 1 for the full flow
        if (phoneEvents.press_1) {
            return getState('Initial');
        }

        return null;
    }
}

registerState('Attract', Attract);
