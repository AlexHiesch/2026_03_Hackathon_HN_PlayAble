import { State } from '../state.js';
import { Config } from '../config.js';
import { getState, registerState } from './states.js';
import { loadStaticImage } from '../resource.js';

let instructionImg = null;

export class Instructions extends State {
    onEnter() {
        super.onEnter();
        if (!instructionImg) {
            loadStaticImage('images/instruction_Forest.png').then(img => { instructionImg = img; });
        }
    }

    processEvents(phoneEvents) {
        if (phoneEvents.hungup) return getState('Attract');
        if (this.getStateTime() > Config.INSTRUCTIONS_TIMEOUT) return getState('TvShowPlaying');
        return null;
    }

    render(ctx) {
        if (instructionImg) {
            ctx.drawImage(instructionImg, 0, 0);
        } else {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, 320, 240);
            ctx.fillStyle = '#fff';
            ctx.font = '16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Arrow Up / W = Jump', 160, 80);
            ctx.fillText('Arrow Down / S = Duck', 160, 110);
            ctx.fillText('Or say "jump" / "duck"', 160, 140);
            ctx.fillText('Get ready!', 160, 180);
            ctx.textAlign = 'start';
        }
    }
}

registerState('Instructions', Instructions);
