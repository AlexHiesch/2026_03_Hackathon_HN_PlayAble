/**
 * All forest hurt/damage states consolidated in one file.
 * Ported from game/forest/hurt_*.py
 */
import { State } from '../state.js';
import { Animation } from '../animation.js';
import { ForestResources as R } from './forest-resources.js';
import { play } from '../audio.js';
import { reduceLives } from './forest-utils.js';

// ── Branch hit ──────────────────────────────────────────────────────────

export class HurtBranchAnimation extends State {
    constructor(ctx) { super(ctx); this.needsBottom = 'POST'; }
    onEnter() { super.onEnter(); play(R.sfx_birds); }
    processEvents() {
        return this.getFrameIndexFast() >= R.hugohitlog.length ? HurtBranchTalking : null;
    }
    render(ctx) {
        const f = Animation.getFrame(R.hugohitlog, this.getFrameIndexFast());
        if (f) ctx.drawImage(f, 0, 0);
    }
}

class HurtBranchTalking extends State {
    constructor(ctx) { super(ctx); this.needsBottom = 'POST'; }
    onEnter() { super.onEnter(); play(R.speak_hitlog); }
    processEvents() {
        if (this.getFrameIndex() >= R.sync_hitlog.length) return reduceLives(this.context, 4);
        return null;
    }
    render(ctx) {
        const f = Animation.getSyncFrame(R.hugohitlog_talk, R.sync_hitlog, this.getFrameIndex());
        if (f) ctx.drawImage(f, 0, 0);
    }
}

// ── Catapult / Flying ───────────────────────────────────────────────────

export class HurtFlyingStart extends State {
    onEnter() { super.onEnter(); play(R.speak_catapult_up); }
    processEvents() {
        if (this.getFrameIndexFast() >= R.catapult_fly.length) return HurtFlyingTalking;
        if (this.oneShot(2.7, 'crash')) play(R.sfx_hugo_screenklir);
        if (this.oneShot(2.7, 'uy')) play(R.speak_catapult_hit);
        return null;
    }
    render(ctx) {
        const f = Animation.getFrame(R.catapult_fly, this.getFrameIndexFast());
        if (f) ctx.drawImage(f, 0, 0);
    }
}

class HurtFlyingTalking extends State {
    onEnter() { super.onEnter(); play(R.speak_catapult_talktop); }
    processEvents() {
        return this.getFrameIndex() >= R.sync_catapult_talktop.length ? HurtFlyingFalling : null;
    }
    render(ctx) {
        const f = Animation.getSyncFrame(R.catapult_airtalk, R.sync_catapult_talktop, this.getFrameIndex());
        if (f) ctx.drawImage(f, 0, 0);
    }
}

class HurtFlyingFalling extends State {
    onEnter() { super.onEnter(); play(R.speak_catapult_down); play(R.sfx_hugo_crash); }
    processEvents() {
        return this.getFrameIndexFast() >= R.catapult_fall.length ? HurtFlyingHangAnim : null;
    }
    render(ctx) {
        const f = Animation.getFrame(R.catapult_fall, this.getFrameIndexFast());
        if (f) ctx.drawImage(f, 0, 0);
    }
}

class HurtFlyingHangAnim extends State {
    onEnter() { super.onEnter(); play(R.sfx_hugo_hangstart); }
    processEvents() {
        return this.getFrameIndexFast() >= R.catapult_hang.length ? HurtFlyingHangTalking : null;
    }
    render(ctx) {
        const f = Animation.getFrame(R.catapult_hang, this.getFrameIndexFast());
        if (f) ctx.drawImage(f, 0, 0);
    }
}

class HurtFlyingHangTalking extends State {
    onEnter() { super.onEnter(); play(R.speak_catapult_hang); play(R.sfx_hugo_hang); }
    processEvents() {
        if (this.getFrameIndex() >= R.sync_catapult_hang.length) return reduceLives(this.context, 1);
        return null;
    }
    render(ctx) {
        if (R.catapult_hang[12]) ctx.drawImage(R.catapult_hang[12], 0, 0);
        const f = Animation.getSyncFrame(R.catapult_hangspeak, R.sync_catapult_hang, this.getFrameIndex());
        if (f) ctx.drawImage(f, 115, 117);
    }
}

// ── Rock hit ────────────────────────────────────────────────────────────

export class HurtRockAnimation extends State {
    constructor(ctx) { super(ctx); this.needsBottom = 'POST'; }
    processEvents() {
        return this.getFrameIndexFast() >= R.hugo_lookrock.length ? HurtRockHitAnimation : null;
    }
    render(ctx) {
        const f = Animation.getFrame(R.hugo_lookrock, this.getFrameIndexFast());
        if (f) ctx.drawImage(f, 0, 0);
    }
}

class HurtRockHitAnimation extends State {
    constructor(ctx) { super(ctx); this.needsBottom = 'POST'; }
    processEvents() {
        return this.getFrameIndexFast() >= R.hit_rock.length ? HurtRockTalking : null;
    }
    render(ctx) {
        const f = Animation.getFrame(R.hit_rock, this.getFrameIndexFast());
        if (f) ctx.drawImage(f, 0, 0);
    }
}

class HurtRockTalking extends State {
    constructor(ctx) { super(ctx); this.needsBottom = 'POST'; }
    onEnter() { super.onEnter(); play(R.speak_rock); }
    processEvents() {
        if (this.getFrameIndex() >= R.sync_rock.length) return reduceLives(this.context, 3);
        return null;
    }
    render(ctx) {
        const f = Animation.getSyncFrame(R.hit_rock_sync, R.sync_rock, this.getFrameIndex());
        if (f) ctx.drawImage(f, 0, 0);
    }
}

// ── Trap hit ────────────────────────────────────────────────────────────

export class HurtTrapAnimation extends State {
    processEvents() {
        return this.getFrameIndex() >= R.hugo_traphurt.length ? HurtTrapTalking : null;
    }
    render(ctx) {
        const f = Animation.getFrame(R.hugo_traphurt, this.getFrameIndex());
        if (f) ctx.drawImage(f, 0, 0);
    }
}

class HurtTrapTalking extends State {
    onEnter() { super.onEnter(); play(R.speak_trap); }
    processEvents() {
        if (this.getFrameIndex() >= R.sync_trap.length) return reduceLives(this.context, 2);
        return null;
    }
    render(ctx) {
        const f = Animation.getSyncFrame(R.hugo_traptalk, R.sync_trap, this.getFrameIndex());
        if (f) ctx.drawImage(f, 0, 0);
    }
}
