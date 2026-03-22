export class Tween {
    static map(value, inMin, inMax, outMin, outMax) {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }

    static mapEaseIn(value, inMin, inMax, outMin, outMax) {
        let normalized = (value - inMin) / (inMax - inMin);
        if (normalized < 0) normalized = 0;
        if (normalized > 1) normalized = 1;
        const eased = normalized * normalized;
        return eased * (outMax - outMin) + outMin;
    }
}
