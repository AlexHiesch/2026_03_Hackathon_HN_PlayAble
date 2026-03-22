import { Config } from '../config.js';
import { VideoState } from './video-state.js';
import { getState, registerState } from './states.js';

export class Press5 extends VideoState {
    constructor(context) {
        const c = Config.COUNTRY;
        super(context, `assets/videos/${c}/press_5.mp4`, true, `assets/audio_for_videos/${c}/press_5.mp3`);
    }

    processEvents(phoneEvents) {
        super.processEvents(phoneEvents);
        if (phoneEvents.hungup) return getState('Attract');
        if (phoneEvents.press_5) return getState('HaveLuck');
        return null;
    }

    render(ctx) {
        super.render(ctx);
        if (this.hasLooped) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(80, 100, 160, 40);
            ctx.fillStyle = '#fff';
            ctx.font = '16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Press Space', 160, 125);
            ctx.textAlign = 'start';
        }
    }
}

registerState('Press5', Press5);
