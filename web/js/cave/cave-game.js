import { globalState } from '../global-state.js';
import { Animation } from '../animation.js';
import { play, stop } from '../audio.js';
import { loadFrames, loadAudioAsset, loadSync } from '../resource.js';

/**
 * Simplified cave game for web.
 * Shows rope selection scene, player picks 3/6/9 (or says one/two/three),
 * then plays win/lose animation.
 */

// Cave resources (loaded on demand)
let caveRes = null;

async function ensureCaveResources() {
    if (caveRes) return caveRes;
    caveRes = {};
    caveRes.first_rope = await loadFrames('cave', 'first_rope');
    caveRes.second_rope = await loadFrames('cave', 'second_rope');
    caveRes.third_rope = await loadFrames('cave', 'third_rope');
    caveRes.talks = await loadFrames('cave', 'talks');
    caveRes.climbs = await loadFrames('cave', 'climbs');
    caveRes.scylla_leaves = await loadFrames('cave', 'scylla_leaves');
    caveRes.scylla_bird = await loadFrames('cave', 'scylla_bird');
    caveRes.scylla_ropes = await loadFrames('cave', 'scylla_ropes');
    caveRes.family_cage = await loadFrames('cave', 'family_cage');
    caveRes.hugo_puff_first = await loadFrames('cave', 'hugo_puff_first');
    caveRes.happy = await loadFrames('cave', 'happy');
    caveRes.score_font = await loadFrames('cave', 'score_font');

    caveRes.afskylia_snak = await loadAudioAsset('cave', 'afskylia_snak');
    caveRes.hiv_i_reb = await loadAudioAsset('cave', 'hiv_i_reb');
    caveRes.fodtrin1 = await loadAudioAsset('cave', 'fodtrin1');
    caveRes.puf = await loadAudioAsset('cave', 'puf');
    caveRes.fanfare = await loadAudioAsset('cave', 'fanfare');
    caveRes.fugle_skrig = await loadAudioAsset('cave', 'fugle_skrig');
    caveRes.skrig = await loadAudioAsset('cave', 'skrig');

    return caveRes;
}

export class CaveGame {
    constructor(context) {
        this.context = context;
        this.ended = false;
        this.phase = 'loading'; // loading → waiting → going_rope → result → done
        this.selectedRope = -1;
        this.phaseStart = globalState.frameTime;
        this.winType = -1; // -1 = lost, 0-2 = win types
        this.rollingScore = context.forest_score;
        this.resourcesReady = false;

        ensureCaveResources().then(() => {
            this.resourcesReady = true;
            this.phase = 'waiting';
            this.phaseStart = globalState.frameTime;
            play(caveRes.afskylia_snak);
        });
    }

    processEvents(phoneEvents) {
        if (!this.resourcesReady) return;
        const dt = globalState.frameTime - this.phaseStart;

        if (this.phase === 'waiting') {
            if (phoneEvents.press_3) { this.selectedRope = 0; this.startRope(); }
            else if (phoneEvents.press_6) { this.selectedRope = 1; this.startRope(); }
            else if (phoneEvents.press_9) { this.selectedRope = 2; this.startRope(); }
        } else if (this.phase === 'going_rope') {
            const anim = [caveRes.first_rope, caveRes.second_rope, caveRes.third_rope][this.selectedRope];
            const frameIdx = Math.floor(dt * 10);
            if (frameIdx >= anim.length) {
                // Random outcome
                const r = Math.floor(Math.random() * 4);
                if (r === 0) {
                    this.winType = -1; // Lost
                    play(caveRes.puf);
                } else {
                    this.winType = r - 1;
                    this.context.forest_score *= (r + 1);
                    play(caveRes.fanfare);
                }
                this.phase = 'result';
                this.phaseStart = globalState.frameTime;
            }
        } else if (this.phase === 'result') {
            if (dt > 4) {
                this.ended = true;
            }
        }
    }

    startRope() {
        this.phase = 'going_rope';
        this.phaseStart = globalState.frameTime;
        play(caveRes.hiv_i_reb);
    }

    render(ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 320, 240);

        if (!this.resourcesReady) {
            ctx.fillStyle = '#fff';
            ctx.font = '16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Loading cave...', 160, 120);
            ctx.textAlign = 'start';
            return;
        }

        const dt = globalState.frameTime - this.phaseStart;

        if (this.phase === 'waiting') {
            // Show first frame of ropes
            if (caveRes.first_rope[0]) ctx.drawImage(caveRes.first_rope[0], 0, 0);
            // Overlay instructions
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(80, 190, 160, 45);
            ctx.fillStyle = '#ffd700';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Choose a rope!', 160, 205);
            ctx.fillText('Say: 3/Left  6/Middle  9/Right', 160, 225);
            ctx.textAlign = 'start';
        } else if (this.phase === 'going_rope') {
            const anim = [caveRes.first_rope, caveRes.second_rope, caveRes.third_rope][this.selectedRope];
            const frameIdx = Math.min(Math.floor(dt * 10), anim.length - 1);
            const frame = anim[frameIdx];
            if (frame) ctx.drawImage(frame, 0, 0);
        } else if (this.phase === 'result') {
            if (this.winType === -1) {
                // Lost
                const anim = caveRes.hugo_puff_first;
                const frameIdx = Math.min(Math.floor(dt * 15), anim.length - 1);
                if (anim[frameIdx]) ctx.drawImage(anim[frameIdx], 0, 0);
            } else {
                // Won
                const anim = this.winType === 0 ? caveRes.scylla_bird :
                             this.winType === 1 ? caveRes.scylla_leaves :
                             caveRes.family_cage;
                const frameIdx = Math.min(Math.floor(dt * 10), anim.length - 1);
                if (anim[frameIdx]) ctx.drawImage(anim[frameIdx], 0, 0);
            }

            // Show score
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            const mult = this.winType === -1 ? 'x1' : `x${this.winType + 2}`;
            ctx.fillText(`Score: ${Math.floor(this.context.forest_score)} (${mult})`, 160, 220);
            ctx.textAlign = 'start';
        }

        // Always show score at bottom
        this.renderScore(ctx);
    }

    renderScore(ctx) {
        if (!caveRes.score_font.length) return;
        const score = Math.floor(this.rollingScore);
        if (this.rollingScore < this.context.forest_score) {
            this.rollingScore += Math.min(10, this.context.forest_score - this.rollingScore);
        }

        const digits = String(Math.max(0, score)).padStart(6, '0').split('').map(Number);
        for (let i = 0; i < digits.length; i++) {
            const d = caveRes.score_font[digits[i]];
            if (d) ctx.drawImage(d, 210 + i * 16, 203);
        }
    }
}
