import Java from "../java-runtime.js";
import { EventEmitter } from "../event-emitter.js";
import { FloatMenu } from "../float-menu.js";
import { applyStyle } from "./style/style.js";

export abstract class UIComponent {
  protected emitter: EventEmitter = new EventEmitter();
  // 必须实例化button
  protected view: any; // Android View
  protected value: any;
  protected id: string;
  private initialized = false;
  private attached = false;
  private disposed = false;
  private disposers = new Set<() => void>();

  protected menu!: FloatMenu;

  constructor(id: string) {
    this.id = id;
  }

  public setMenu(menu: FloatMenu): void {
    this.menu = menu;
  }
  // 可选：给后续写通用样式留口子
  public apply(role: any, theme: any) {
    if (!this.view) return;
    // const { applyStyle } = require("../style/style"); // 也可以正常 import
    Java.scheduleOnMainThread(() => applyStyle(this.view, role, theme));
  }
  /**
   * Get the Android View associated with this component
   */
  public getView(): any {
    return this.view;
  }

  /**
   * Get current value of the component
   */
  public getValue(): any {
    return this.value;
  }

  public getId(): string {
    return this.id;
  }

  /**
   * Set value and update UI
   */
  public setValue(value: any): void {
    if (this.disposed) throw new Error(`Component ${this.id} is disposed`);
    this.value = value;
    if (this.initialized) this.updateView();
  }

  /**
   * Register event listener
   */
  public on(event: string, listener: (...args: any[]) => void): () => void {
    return this.emitter.on(event, listener);
  }

  /**
   * Unregister event listener
   */
  public off(event: string, listener: (...args: any[]) => void): void {
    this.emitter.off(event, listener);
  }

  /**
   * Emit event
   */
  protected emit(event: string, ...args: any[]): void {
    this.emitter.emit(event, ...args);
  }

  /**
   * Abstract method to create the Android View
   */
  protected abstract createView(context: any): void;

  /**
   * Initialize the component with Android context
   */
  public initialize(context: any, menu?: FloatMenu): void {
    if (this.disposed) throw new Error(`Component ${this.id} is disposed`);
    if (this.initialized) return;
    if (menu) this.menu = menu;
    this.createView(context);
    this.initialized = true;
  }

  /**
   * Abstract method to update the view when value changes
   */
  protected abstract updateView(): void;

  protected own(dispose: () => void): () => void {
    if (this.disposed) {
      dispose();
      return () => {};
    }
    let active = true;
    const release = () => {
      if (!active) return;
      active = false;
      this.disposers.delete(release);
      dispose();
    };
    this.disposers.add(release);
    return release;
  }

  /**
   * Called when component is added to container
   */
  public attach(_container?: any): void {
    if (this.disposed) throw new Error(`Component ${this.id} is disposed`);
    this.attached = true;
  }

  /**
   * Called when component is removed
   */
  public detach(): void {
    this.attached = false;
  }

  public captureState(): any {
    return this.value;
  }

  public restoreState(state: any): void {
    this.setValue(state);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.detach();
    for (const dispose of Array.from(this.disposers).reverse()) {
      try {
        dispose();
      } catch {}
    }
    this.disposers.clear();
    this.emitter.removeAllListeners();
    this.view = null;
    this.initialized = false;
    this.disposed = true;
  }

  public get isInitialized(): boolean {
    return this.initialized;
  }

  public get isAttached(): boolean {
    return this.attached;
  }
}
