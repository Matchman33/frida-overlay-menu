import Java from "../java-runtime.js";
import { EventEmitter } from "../event-emitter.js";
import { applyStyle } from "./style/style.js";
export class UIComponent {
    constructor(id) {
        this.emitter = new EventEmitter();
        this.initialized = false;
        this.attached = false;
        this.disposed = false;
        this.disposers = new Set();
        this.id = id;
    }
    setMenu(menu) {
        this.menu = menu;
    }
    apply(role, theme) {
        if (!this.view)
            return;
        Java.scheduleOnMainThread(() => applyStyle(this.view, role, theme));
    }
    getView() {
        return this.view;
    }
    getValue() {
        return this.value;
    }
    getId() {
        return this.id;
    }
    setValue(value) {
        if (this.disposed)
            throw new Error(`Component ${this.id} is disposed`);
        this.value = value;
        if (this.initialized)
            this.updateView();
    }
    on(event, listener) {
        return this.emitter.on(event, listener);
    }
    off(event, listener) {
        this.emitter.off(event, listener);
    }
    emit(event, ...args) {
        this.emitter.emit(event, ...args);
    }
    initialize(context, menu) {
        if (this.disposed)
            throw new Error(`Component ${this.id} is disposed`);
        if (this.initialized)
            return;
        if (menu)
            this.menu = menu;
        this.createView(context);
        this.initialized = true;
    }
    own(dispose) {
        if (this.disposed) {
            dispose();
            return () => { };
        }
        let active = true;
        const release = () => {
            if (!active)
                return;
            active = false;
            this.disposers.delete(release);
            dispose();
        };
        this.disposers.add(release);
        return release;
    }
    attach(_container) {
        if (this.disposed)
            throw new Error(`Component ${this.id} is disposed`);
        this.attached = true;
    }
    detach() {
        this.attached = false;
    }
    captureState() {
        return this.value;
    }
    restoreState(state) {
        this.setValue(state);
    }
    dispose() {
        if (this.disposed)
            return;
        this.detach();
        for (const dispose of Array.from(this.disposers).reverse()) {
            try {
                dispose();
            }
            catch { }
        }
        this.disposers.clear();
        this.emitter.removeAllListeners();
        this.view = null;
        this.initialized = false;
        this.disposed = true;
    }
    get isInitialized() {
        return this.initialized;
    }
    get isAttached() {
        return this.attached;
    }
}
