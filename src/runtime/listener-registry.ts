export type Unsubscribe = () => void;

export class ListenerRegistry {
  private readonly listeners = new Map<string, Set<Unsubscribe>>();

  public add(owner: string, unsubscribe: Unsubscribe): Unsubscribe {
    let owned = this.listeners.get(owner);
    if (!owned) {
      owned = new Set();
      this.listeners.set(owner, owned);
    }
    owned.add(unsubscribe);
    return () => {
      if (!owned!.delete(unsubscribe)) return;
      try {
        unsubscribe();
      } finally {
        if (owned!.size === 0) this.listeners.delete(owner);
      }
    };
  }

  public clear(owner: string): void {
    const owned = this.listeners.get(owner);
    if (!owned) return;
    this.listeners.delete(owner);
    for (const unsubscribe of owned) {
      try {
        unsubscribe();
      } catch {}
    }
  }

  public clearAll(): void {
    for (const owner of Array.from(this.listeners.keys())) this.clear(owner);
  }
}
