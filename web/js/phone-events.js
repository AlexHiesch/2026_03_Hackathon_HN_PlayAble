export class PhoneEvents {
    constructor() {
        this.offhook = false;
        this.hungup = false;
        this.press_1 = false;
        this.press_2 = false;
        this.press_3 = false;
        this.press_4 = false;
        this.press_5 = false;
        this.press_6 = false;
        this.press_7 = false;
        this.press_8 = false;
        this.press_9 = false;
        this.press_0 = false;
        this.skip = false;
    }

    anySet() {
        return this.offhook || this.hungup || this.skip ||
            this.press_1 || this.press_2 || this.press_3 ||
            this.press_4 || this.press_5 || this.press_6 ||
            this.press_7 || this.press_8 || this.press_9 ||
            this.press_0;
    }
}
