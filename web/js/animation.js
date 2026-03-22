export class Animation {
    static getSyncFrame(animations, syncs, frameIndex) {
        if (frameIndex >= syncs.length) frameIndex = syncs.length - 1;
        let frame = syncs[frameIndex] - 1;
        if (frame < 0) frame = 0;
        if (frame >= animations.length) frame = animations.length - 1;
        return animations[frame];
    }

    static getFrame(animations, frameIndex) {
        if (frameIndex >= animations.length) frameIndex = animations.length - 1;
        return animations[frameIndex];
    }
}
