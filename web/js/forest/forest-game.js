import { globalState } from '../global-state.js';
import { Config } from '../config.js';
import { ForestResources as R } from './forest-resources.js';
import { play, stop } from '../audio.js';
import { WaitIntro, resolveWaitIntroDeps } from './wait-intro.js';
import { Playing, resolveForestDeps } from './playing.js';
import { WinTalking } from './win-talking.js';
import { TalkingAfterHurt, resolveTalkingAfterHurtDeps } from './talking-after-hurt.js';
import { TalkingGameOver } from './talking-game-over.js';
import { HurtBranchAnimation, HurtFlyingStart, HurtRockAnimation, HurtTrapAnimation } from './hurt-states.js';

// Resolve circular deps
resolveForestDeps({ WinTalking, HurtFlyingStart, HurtTrapAnimation, HurtRockAnimation, HurtBranchAnimation });
resolveWaitIntroDeps({ Playing });
resolveTalkingAfterHurtDeps({ Playing });

// String-to-class mapping for reduceLives returns
const STATE_MAP = {
    'TalkingAfterHurt': TalkingAfterHurt,
    'TalkingGameOver': TalkingGameOver,
    'NullState': 'NullState',
};

export class ForestGame {
    constructor(context) {
        this.context = context;
        context.forest_score = 0;
        context.forest_lives = 3;
        context.forest_parallax_pos = 0;
        context.forest_obstacles = this.generateObstacles();
        context.forest_sacks = this.generateSacks();
        context.forest_leaves = this.generateLeaves();

        this.ended = false;
        this._state = new WaitIntro(context);
        this._state.onEnter();

        this.context.forest_bg_atmosphere_id = play(R.sfx_bg_atmosphere);
        this.forestBgAtmosphereStart = globalState.frameTime;
    }

    processEvents(phoneEvents) {
        let nextState = this._state.processEvents(phoneEvents);

        // Resolve string state names to classes
        if (typeof nextState === 'string') {
            nextState = STATE_MAP[nextState] || null;
        }

        if (nextState !== null) {
            this._state.onExit();
            if (nextState === 'NullState') {
                this.end();
            } else {
                this._state = new nextState(this.context);
                this._state.onEnter();
            }
        }

        // Replay atmosphere loop
        if (!this.ended && globalState.frameTime - this.forestBgAtmosphereStart >= 5.5) {
            this.context.forest_bg_atmosphere_id = play(R.sfx_bg_atmosphere);
            this.forestBgAtmosphereStart = globalState.frameTime;
        }
    }

    render(ctx) {
        if (this._state.needsBackground === 'PRE') this.renderBackground(ctx);
        if (this._state.needsBottom === 'PRE') this.renderBottom(ctx);

        this._state.render(ctx);

        if (this._state.needsBackground === 'POST') this.renderBackground(ctx);
        if (this._state.needsBottom === 'POST') this.renderBottom(ctx);
    }

    renderBackground(ctx) {
        const hillsSpeed = 6 * Config.FOREST_BG_SPEED_MULTIPLIER;
        const treesSpeed = 12 * Config.FOREST_BG_SPEED_MULTIPLIER;
        const grassSpeed = 30 * Config.FOREST_BG_SPEED_MULTIPLIER;
        const pp = this.context.forest_parallax_pos;

        if (R.bg_gradient) ctx.drawImage(R.bg_gradient, 0, 0);

        if (R.bg_hillsday[0]) {
            const w = R.bg_hillsday[0].width;
            const hx = this.newMod(-pp * hillsSpeed, w);
            ctx.drawImage(R.bg_hillsday[0], hx, 0);
            ctx.drawImage(R.bg_hillsday[0], hx + w, 0);
        }

        if (R.bg_trees[0]) {
            const w = R.bg_trees[0].width;
            const tx = this.newMod(-pp * treesSpeed, w);
            ctx.drawImage(R.bg_trees[0], tx, -24);
            ctx.drawImage(R.bg_trees[0], tx + w, -24);
        }

        if (R.bg_ground[0]) {
            const w = R.bg_ground[0].width;
            const gx = this.newMod(-pp * Config.FOREST_GROUND_SPEED, w);
            for (let i = 0; i < 5; i++) ctx.drawImage(R.bg_ground[0], gx + i * w, 158);
        }

        if (R.grass[0]) {
            const w = R.grass[0].width;
            const grx = this.newMod(-pp * grassSpeed, w);
            for (let i = 0; i < 12; i++) ctx.drawImage(R.grass[0], grx + i * w, 172);
        }

        if (R.end_mountain[0]) {
            const mx = 320 - 96 - (pp - Config.FOREST_MAX_TIME) * Config.FOREST_GROUND_SPEED;
            ctx.drawImage(R.end_mountain[0], mx, -16);
        }
    }

    renderBottom(ctx) {
        if (R.scoreboard) ctx.drawImage(R.scoreboard, 0, 184);
        for (let i = 0; i < this.context.forest_lives; i++) {
            if (R.hugo_lives[0]) ctx.drawImage(R.hugo_lives[0], i * 40 + 32, 188);
        }

        // Score
        const xScoreRight = 150 + 24 * 6;
        const yScore = 194;
        const xSpace = 24;
        const score = Math.floor(this.context.forest_score);

        if (R.score_numbers[0]) {
            if (score === 0) {
                this.drawScoreDigit(ctx, 0, xScoreRight - xSpace, yScore);
                return;
            }
            const digits = [];
            let temp = score;
            while (temp > 0) { digits.push(temp % 10); temp = Math.floor(temp / 10); }
            for (let i = 0; i < digits.length; i++) {
                this.drawScoreDigit(ctx, digits[i], xScoreRight - xSpace * (i + 1), yScore);
            }
        }
    }

    drawScoreDigit(ctx, digit, x, y) {
        const img = R.score_numbers[0];
        if (!img) return;
        const w = 32, h = 33;
        const sx = 1 + (digit % 5) * (w + 1);
        const sy = 1 + Math.floor(digit / 5) * (h + 1);
        ctx.drawImage(img, sx, sy, w, h, x, y, w, h);
    }

    end() {
        this._state.onExit();
        stop(this.context.forest_bg_atmosphere_id);
        this.ended = true;
    }

    newMod(a, b) {
        const res = a % b;
        if (!res) return res;
        return a < 0 ? res - b : res;
    }

    generateObstacles() {
        const out = [];
        for (let i = 0; i < Config.FOREST_MAX_TIME; i++) {
            out.push(Math.random() < 0.65 ? 0 : Math.floor(Math.random() * 4) + 1);
        }
        out[0] = out[1] = out[2] = out[3] = 0;
        for (let i = 0; i < out.length - 1; i++) {
            if (out[i] !== 0) out[i + 1] = 0;
        }
        return out;
    }

    generateSacks() {
        const out = [];
        for (let i = 0; i < Config.FOREST_MAX_TIME; i++) {
            const r = Math.random();
            out.push(r < 0.7 ? 0 : (r < 0.91 ? 1 : 2));
        }
        return out;
    }

    generateLeaves() {
        const arr = [];
        for (let i = 0; i < Config.FOREST_MAX_TIME; i++) {
            arr.push(Math.random() < 0.5 ? 1 : 2);
        }
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] === 2) arr[i + 1] = 0;
        }
        return arr;
    }
}
