export class LifecycleController {
    constructor() {
        this.queue = Promise.resolve();
        this.currentState = "created";
    }
    get state() {
        return this.currentState;
    }
    get disposed() {
        return this.currentState === "disposed";
    }
    transition(next) {
        if (this.currentState === "disposed" && next !== "disposed") {
            throw new Error(`Cannot transition disposed lifecycle to ${next}`);
        }
        if (this.currentState === "disposing" && next !== "disposed") {
            throw new Error(`Cannot transition disposing lifecycle to ${next}`);
        }
        this.currentState = next;
    }
    run(name, operation) {
        const result = this.queue.then(async () => {
            if (this.disposed && name !== "dispose") {
                throw new Error(`Cannot run ${name}: lifecycle is disposed`);
            }
            return operation();
        });
        this.queue = result.then(() => undefined, () => undefined);
        return result;
    }
}
