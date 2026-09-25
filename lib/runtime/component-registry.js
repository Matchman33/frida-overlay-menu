export class ComponentRegistry {
    constructor() {
        this.components = new Map();
    }
    add(component, tabId, ownerId) {
        const id = component.getId();
        if (!id)
            throw new Error("Component identifier cannot be empty");
        if (this.components.has(id)) {
            throw new Error(`Component ${id} is already registered`);
        }
        this.components.set(id, { component, tabId, ownerId });
    }
    get(id) {
        return this.components.get(id)?.component;
    }
    getEntry(id) {
        return this.components.get(id);
    }
    remove(id) {
        const entry = this.components.get(id);
        if (entry)
            this.components.delete(id);
        return entry;
    }
    attach(id, container) {
        const entry = this.components.get(id);
        if (!entry)
            throw new Error(`Component ${id} is not registered`);
        entry.container = container;
    }
    childrenOf(ownerId) {
        return Array.from(this.components.values()).filter(entry => entry.ownerId === ownerId);
    }
    values() {
        return this.components.values();
    }
    captureState() {
        const state = {};
        for (const [id, { component }] of this.components) {
            state[id] = component.captureState?.() ?? component.getValue?.();
        }
        return state;
    }
    clear() {
        this.components.clear();
    }
}
