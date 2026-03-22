import { State } from '../state.js';
import { getState, registerState } from './states.js';

export class InScoreboard extends State {
    constructor(context) {
        super(context);
        this.totalScore = context.forest_score +
            (context.forest_reached_end ? 1500 : 0) -
            (3 - context.forest_lives) * 100;
    }

    processEvents(phoneEvents) {
        if (phoneEvents.hungup) return getState('Attract');
        if (this.getStateTime() > 5) {
            this.context.forest_score = this.totalScore;
            return getState('GoingCave');
        }
        return null;
    }

    render(ctx) {
        ctx.fillStyle = '#1a0a2e';
        ctx.fillRect(0, 0, 320, 240);

        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SCOREBOARD', 160, 30);

        ctx.font = '14px monospace';
        ctx.fillStyle = '#fff';

        const c = this.context;
        const rows = [
            [`Sacks: ${c.forest_normal_sacks_collected} x 100`, c.forest_normal_sacks_collected * 100],
            [`Golden: ${c.forest_golden_sacks_collected} x 250`, c.forest_golden_sacks_collected * 250],
            [c.forest_reached_end ? 'Finished!' : 'Not finished', c.forest_reached_end ? 1500 : 0],
            [`Lives lost: ${3 - c.forest_lives}`, -(3 - c.forest_lives) * 100],
        ];

        for (let i = 0; i < rows.length; i++) {
            ctx.textAlign = 'left';
            ctx.fillText(rows[i][0], 30, 70 + i * 30);
            ctx.textAlign = 'right';
            ctx.fillText(String(rows[i][1]), 290, 70 + i * 30);
        }

        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`TOTAL: ${this.totalScore}`, 160, 210);
        ctx.textAlign = 'start';
    }
}

registerState('InScoreboard', InScoreboard);
