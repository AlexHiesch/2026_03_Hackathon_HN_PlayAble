import { State } from '../state.js';
import { globalState } from '../global-state.js';
import { Config } from '../config.js';
import { ForestResources } from './forest-resources.js';
import { play } from '../audio.js';

// Forward declarations resolved at runtime
let WinTalking, HurtFlyingStart, HurtTrapAnimation, HurtRockAnimation, HurtBranchAnimation;

export function resolveForestDeps(deps) {
    WinTalking = deps.WinTalking;
    HurtFlyingStart = deps.HurtFlyingStart;
    HurtTrapAnimation = deps.HurtTrapAnimation;
    HurtRockAnimation = deps.HurtRockAnimation;
    HurtBranchAnimation = deps.HurtBranchAnimation;
}

export class Playing extends State {
    constructor(context) {
        super(context);
        this.arrowUpFocus = false;
        this.arrowDownFocus = false;
        this.hugoJumpingTime = null;
        this.hugoCrawlingTime = null;
        this.lastTime = globalState.frameTime;
        this.oldSecond = null;
        this.HUGO_X_POS = 16;
        this.needsBackground = 'PRE';
        this.needsBottom = 'PRE';

        this.hintShownForIndex = -1;
        this.hintStartTime = null;
        this.hintType = null;
        this.HINT_LOOKAHEAD = 1;
        this.HINT_DURATION = 1.0;
    }

    processEvents(phoneEvents) {
        if (!this.arrowUpFocus && !this.arrowDownFocus) {
            if (phoneEvents.press_2) {
                this.arrowUpFocus = true;
                this.hugoJumpingTime = globalState.frameTime;
            }
            if (phoneEvents.press_8) {
                this.arrowDownFocus = true;
                this.hugoCrawlingTime = globalState.frameTime;
            }
        }

        if (this.context.forest_parallax_pos > Config.FOREST_MAX_TIME) {
            this.context.forest_parallax_pos = Config.FOREST_MAX_TIME;
            this.context.forest_reached_end = true;
            return WinTalking;
        } else {
            this.context.forest_parallax_pos += (globalState.frameTime - this.lastTime) * Config.FOREST_GAME_SPEED;
            this.lastTime = globalState.frameTime;
        }

        let integer = Math.floor(this.context.forest_parallax_pos) + 1;
        if (integer >= Config.FOREST_MAX_TIME) integer = Config.FOREST_MAX_TIME - 1;

        if (this.oldSecond === null) {
            this.oldSecond = Math.floor(this.context.forest_parallax_pos);
        }

        // Hint system
        const hintCheckIndex = integer + this.HINT_LOOKAHEAD;
        if (hintCheckIndex < this.context.forest_obstacles.length && hintCheckIndex !== this.hintShownForIndex) {
            const upcoming = this.context.forest_obstacles[hintCheckIndex];
            if (upcoming !== 0) {
                const needsJump = [1, 2, 3].includes(upcoming);
                let hintType;
                if (this.context.forest_controls_inverted) {
                    hintType = needsJump ? 'ocho' : 'dos';
                } else {
                    hintType = needsJump ? 'dos' : 'ocho';
                }
                // Hint audio (may be missing)
                if (hintType === 'dos' && ForestResources.sfx_hint_dos) {
                    play(ForestResources.sfx_hint_dos);
                } else if (ForestResources.sfx_hint_ocho) {
                    play(ForestResources.sfx_hint_ocho);
                }
                this.hintShownForIndex = hintCheckIndex;
                this.hintStartTime = globalState.frameTime;
                this.hintType = hintType;
            }
        }

        if (this.hintStartTime && globalState.frameTime - this.hintStartTime > this.HINT_DURATION) {
            this.hintType = null;
        }

        if (this.arrowUpFocus && globalState.frameTime - this.hugoJumpingTime > 0.75) {
            this.hugoJumpingTime = null;
            this.arrowUpFocus = false;
        }
        if (this.arrowDownFocus && globalState.frameTime - this.hugoCrawlingTime > 0.75) {
            this.hugoCrawlingTime = null;
            this.arrowDownFocus = false;
        }

        if (this.oldSecond !== Math.floor(this.context.forest_parallax_pos)) {
            if (this.context.forest_obstacles[integer] !== 0 && !Config.GOD_MODE) {
                const obs = this.context.forest_obstacles[integer];
                if (obs === 1 && !this.arrowUpFocus) {
                    play(ForestResources.sfx_hugo_launch);
                    play(ForestResources.sfx_catapult_eject);
                    this.context.forest_obstacles[integer] = 0;
                    return HurtFlyingStart;
                } else if (obs === 2 && !this.arrowUpFocus) {
                    play(ForestResources.sfx_hugo_hittrap);
                    this.context.forest_obstacles[integer] = 0;
                    return HurtTrapAnimation;
                } else if (obs === 3 && !this.arrowUpFocus) {
                    play(ForestResources.sfx_hugo_hitlog);
                    this.context.forest_obstacles[integer] = 0;
                    return HurtRockAnimation;
                } else if (obs === 4) {
                    if (this.arrowDownFocus) {
                        play(ForestResources.sfx_tree_swush);
                    } else {
                        play(ForestResources.sfx_hugo_hitlog);
                        this.context.forest_obstacles[integer] = 0;
                        return HurtBranchAnimation;
                    }
                }
            }

            if (this.arrowUpFocus && this.context.forest_sacks[integer] !== 0) {
                if (this.context.forest_sacks[integer] === 1) {
                    this.context.forest_score += 100;
                    this.context.forest_normal_sacks_collected += 1;
                    play(ForestResources.sfx_sack_normal);
                    this.context.forest_sacks[integer] = 0;
                } else if (this.context.forest_sacks[integer] === 2) {
                    this.context.forest_score += 250;
                    this.context.forest_golden_sacks_collected += 1;
                    play(ForestResources.sfx_sack_bonus);
                    this.context.forest_sacks[integer] = 0;
                }
            }
        }

        if (this.getFrameIndex() % 8 === 0 && !this.arrowUpFocus) {
            const walkSfx = [
                ForestResources.sfx_hugo_walk0, ForestResources.sfx_hugo_walk1,
                ForestResources.sfx_hugo_walk2, ForestResources.sfx_hugo_walk3,
                ForestResources.sfx_hugo_walk4
            ];
            play(walkSfx[Math.floor(Math.random() * 5)]);
        }

        this.oldSecond = Math.floor(this.context.forest_parallax_pos);
        return null;
    }

    render(ctx) {
        const R = ForestResources;
        const fract = this.context.forest_parallax_pos - Math.floor(this.context.forest_parallax_pos);

        // Obstacles
        for (let index = 0; index < this.context.forest_obstacles.length; index++) {
            const obstaclePos = (index - this.context.forest_parallax_pos) * Config.FOREST_GROUND_SPEED;
            const obs = this.context.forest_obstacles[index];

            if (obs === 1 && R.catapult.length) { // Catapult
                const idx = this.getFrameIndex() % R.catapult.length;
                const dy = [45, 43, 39, 34, 29, 22, 14, 1];
                drawImg(ctx, R.catapult[idx], obstaclePos - 8, 112 + (dy[idx] || 0));
            }
            if (obs === 2 && R.trap.length) { // Trap
                const idx = this.getFrameIndex() % R.trap.length;
                const dy = [176, 173, 169, 165, 176, 176];
                drawImg(ctx, R.trap[idx], obstaclePos - 8, (dy[idx] || 176) - 24);
            }
            if (obs === 3 && R.rock.length) { // Rock
                const idx = this.getFrameIndex() % R.rock.length;
                drawImg(ctx, R.rock[idx], obstaclePos - Math.sin(fract * 2 * Math.PI) * 15, 120);
            }
            if (obs === 4 && R.tree.length) { // Tree branch
                const idx = this.getFrameIndex() % R.tree.length;
                drawImg(ctx, R.lone_tree[0], obstaclePos - 52, -40);
                drawImg(ctx, R.tree[idx], obstaclePos, 62);
            }
        }

        // Sacks
        for (let index = 0; index < this.context.forest_sacks.length; index++) {
            if (this.context.forest_sacks[index] !== 0 && R.sack[0]) {
                const sackPos = (index - this.context.forest_parallax_pos) * Config.FOREST_GROUND_SPEED;
                drawImg(ctx, R.sack[0], sackPos - 16, 32);
            }
        }

        // Leaves
        for (let index = 0; index < this.context.forest_leaves.length; index++) {
            const leavePos = (index - this.context.forest_parallax_pos) * Config.FOREST_GROUND_SPEED;
            if (this.context.forest_leaves[index] === 1 && R.leaves2[0]) {
                drawImg(ctx, R.leaves2[0], leavePos - 16, -10);
            } else if (this.context.forest_leaves[index] === 2 && R.leaves1[0]) {
                drawImg(ctx, R.leaves1[0], leavePos - 16, -10);
            }
        }

        // Arrows UI
        if (this.arrowUpFocus) {
            drawImg(ctx, R.arrows[1], 256, 17);
        } else {
            drawImg(ctx, R.arrows[0], 258, 19);
        }
        if (this.arrowDownFocus) {
            drawImg(ctx, R.arrows[3], 256, 54);
        } else {
            drawImg(ctx, R.arrows[2], 258, 56);
        }

        // Hugo
        if (this.arrowUpFocus && this.hugoJumpingTime) {
            const dt = (globalState.frameTime - this.hugoJumpingTime) / 0.75;
            const dy = -250 * dt * dt + 250 * dt - 22.5;
            const idx = this.getFrameIndex() % (R.hugo_jump.length || 1);
            drawImg(ctx, R.hugo_jump[idx], this.HUGO_X_POS, 40 - dy);
        } else if (this.arrowDownFocus) {
            const idx = this.getFrameIndex() % (R.hugo_crawl.length || 1);
            drawImg(ctx, R.hugo_crawl[idx], this.HUGO_X_POS, 105);
        } else {
            const idx = this.getFrameIndex() % (R.hugo_side.length || 1);
            drawImg(ctx, R.hugo_side[idx], this.HUGO_X_POS, 90);
        }

        // Hint overlay
        if (this.hintType === 'dos' && R.hint_overlay_dos) {
            drawImg(ctx, R.hint_overlay_dos, 0, 0);
        } else if (this.hintType === 'ocho' && R.hint_overlay_ocho) {
            drawImg(ctx, R.hint_overlay_ocho, 0, 0);
        }
    }
}

function drawImg(ctx, img, x, y) {
    if (img) ctx.drawImage(img, Math.round(x), Math.round(y));
}
