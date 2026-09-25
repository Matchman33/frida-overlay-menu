export type LifecycleState =
  | "created"
  | "mounted"
  | "icon-visible"
  | "menu-visible"
  | "hidden"
  | "disposing"
  | "disposed";

export class LifecycleController {
  private queue: Promise<void> = Promise.resolve();
  private currentState: LifecycleState = "created";

  public get state(): LifecycleState {
    return this.currentState;
  }

  public get disposed(): boolean {
    return this.currentState === "disposed";
  }

  public transition(next: LifecycleState): void {
    if (this.currentState === "disposed" && next !== "disposed") {
      throw new Error(`Cannot transition disposed lifecycle to ${next}`);
    }
    if (this.currentState === "disposing" && next !== "disposed") {
      throw new Error(`Cannot transition disposing lifecycle to ${next}`);
    }
    this.currentState = next;
  }

  public run<T>(name: string, operation: () => T | Promise<T>): Promise<T> {
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
