import { State } from '../state.js';
import { play, stop } from '../audio.js';

export class VideoState extends State {
    constructor(context, videoUrl, loop, audioUrl) {
        super(context);
        this.videoUrl = videoUrl;
        this.loop = loop;
        this.audioUrl = audioUrl;
        this.audioInstanceId = null;
        this.videoEl = null;
        this.hasLooped = false;
        this._skipped = false;
    }

    onEnter() {
        super.onEnter();
        this.videoEl = document.createElement('video');
        this.videoEl.playsInline = true;

        if (this.loop) {
            this.videoEl.loop = true;
            this.videoEl.addEventListener('ended', () => { this.hasLooped = true; });
        }

        // Try to play video with its own audio first (works after user gesture)
        this.videoEl.muted = false;
        this.videoEl.src = this.videoUrl;
        this.videoEl.play().then(() => {
            this.audioInstanceId = null;
        }).catch(() => {
            this.videoEl.muted = true;
            this.videoEl.play().catch(() => {});
            if (this.audioUrl) {
                this.audioInstanceId = play(this.audioUrl);
            }
        });
    }

    processEvents(phoneEvents) {
        if (phoneEvents.skip) {
            this._skipped = true;
        }
        return null;
    }

    /** Override in subclass to customize the skip hint text. */
    getSkipHint() {
        return 'SHIFT or say "no" to skip';
    }

    render(ctx) {
        if (this.videoEl && this.videoEl.readyState >= 2) {
            ctx.drawImage(this.videoEl, 0, 0, 320, 240);
        }

        // Show skip hint after 1.5 seconds with fade-in
        const t = this.getStateTime();
        if (t > 1.5) {
            const alpha = Math.min(1, (t - 1.5) / 0.5);
            const hint = this.getSkipHint();
            const textW = ctx.measureText ? 14 * hint.length * 0.6 : 140;

            // Background pill
            const pillW = textW + 24;
            const pillH = 28;
            const pillX = 160 - pillW / 2;
            const pillY = 208;

            ctx.fillStyle = `rgba(0,0,0,${0.65 * alpha})`;
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(pillX, pillY, pillW, pillH, 14);
                ctx.fill();
            } else {
                ctx.fillRect(pillX, pillY, pillW, pillH);
            }

            // Text
            ctx.fillStyle = `rgba(255,255,255,${0.9 * alpha})`;
            ctx.font = 'bold 13px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(hint, 160, pillY + 19);
            ctx.textAlign = 'start';
        }
    }

    onExit() {
        super.onExit();
        if (this.videoEl) {
            this.videoEl.pause();
            this.videoEl.src = '';
            this.videoEl = null;
        }
        if (this.audioInstanceId != null) {
            stop(this.audioInstanceId);
            this.audioInstanceId = null;
        }
    }

    videoEnded() {
        return (this.videoEl && this.videoEl.ended) || this._skipped;
    }
}
