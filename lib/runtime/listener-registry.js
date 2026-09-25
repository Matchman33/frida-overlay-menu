export class ListenerRegistry {
    constructor() {
        this.listeners = new Map();
    }
    add(owner, unsubscribe) {
        let owned = this.listeners.get(owner);
        if (!owned) {
            owned = new Set();
            this.listeners.set(owner, owned);
        }
        owned.add(unsubscribe);
        return () => {
            if (!owned.delete(unsubscribe))
                return;
            try {
                unsubscribe();
            }
            finally {
                if (owned.size === 0)
                    this.listeners.delete(owner);
            }
        };
    }
    clear(owner) {
        const owned = this.listeners.get(owner);
        if (!owned)
            return;
        this.listeners.delete(owner);
        for (const unsubscribe of owned) {
            try {
                unsubscribe();
            }
            catch { }
        }
    }
    clearAll() {
        for (const owner of Array.from(this.listeners.keys()))
            this.clear(owner);
    }
}
