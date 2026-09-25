export interface RegisteredComponent {
  getId(): string;
  getValue?(): unknown;
  captureState?(): unknown;
  dispose?(): void | Promise<void>;
}

export interface ComponentEntry<T extends RegisteredComponent> {
  component: T;
  tabId: string;
  ownerId?: string;
  container?: unknown;
}

export class ComponentRegistry<T extends RegisteredComponent = RegisteredComponent> {
  private readonly components = new Map<string, ComponentEntry<T>>();

  public add(component: T, tabId: string, ownerId?: string): void {
    const id = component.getId();
    if (!id) throw new Error("Component identifier cannot be empty");
    if (this.components.has(id)) {
      throw new Error(`Component ${id} is already registered`);
    }
    this.components.set(id, { component, tabId, ownerId });
  }

  public get(id: string): T | undefined {
    return this.components.get(id)?.component;
  }

  public getEntry(id: string): ComponentEntry<T> | undefined {
    return this.components.get(id);
  }

  public remove(id: string): ComponentEntry<T> | undefined {
    const entry = this.components.get(id);
    if (entry) this.components.delete(id);
    return entry;
  }

  public attach(id: string, container: unknown): void {
    const entry = this.components.get(id);
    if (!entry) throw new Error(`Component ${id} is not registered`);
    entry.container = container;
  }

  public childrenOf(ownerId: string): ComponentEntry<T>[] {
    return Array.from(this.components.values()).filter(
      entry => entry.ownerId === ownerId,
    );
  }

  public values(): IterableIterator<ComponentEntry<T>> {
    return this.components.values();
  }

  public captureState(): Record<string, unknown> {
    const state: Record<string, unknown> = {};
    for (const [id, { component }] of this.components) {
      state[id] = component.captureState?.() ?? component.getValue?.();
    }
    return state;
  }

  public clear(): void {
    this.components.clear();
  }
}
