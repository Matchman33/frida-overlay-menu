import Java from "./java-runtime.js";
import { Logger } from "./logger.js";

type JavaCallback = (...args: any[]) => any;

export interface JavaListenerHandle {
  readonly instance: any;
  $new(): any;
  dispose(): void;
}

export interface JavaListenerOptions {
  key: string;
  owner?: string;
  interfaceClass: any;
  callbacks: Record<string, JavaCallback>;
  fallback?: Record<string, any>;
}

interface ListenerPool {
  listenerClass: any;
  callbacks: Map<string, Record<string, JavaCallback>>;
  fallback: Record<string, any>;
}

const pools = new Map<string, ListenerPool>();
const owners = new Map<string, Set<() => void>>();
const sessionSuffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
let nextListenerId = 1;

function sanitizeClassSegment(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z_]/.test(sanitized) ? sanitized : `L_${sanitized}`;
}

function createPool(options: JavaListenerOptions): ListenerPool {
  const callbacks = new Map<string, Record<string, JavaCallback>>();
  const fallback = options.fallback ?? {};
  const methods: Record<string, (...args: any[]) => any> = {};

  for (const methodName of Object.keys(options.callbacks)) {
    methods[methodName] = function (this: any, ...args: any[]): any {
      const callbackId = String(this.callbackId.value);
      const callback = callbacks.get(callbackId)?.[methodName];
      if (!callback) return fallback[methodName];
      try {
        return callback(...args);
      } catch (error) {
        Logger.instance.error(
          `[JavaListener:${options.key}.${methodName}] callback failed:`,
          error,
        );
        return fallback[methodName];
      }
    };
  }

  const listenerClass = Java.registerClass({
    name: `com.fridauiruntime.listener.${sanitizeClassSegment(options.key)}_${sessionSuffix}`,
    implements: [options.interfaceClass],
    fields: { callbackId: "java.lang.String" },
    methods,
  });

  return { listenerClass, callbacks, fallback };
}

export function createJavaListener(
  options: JavaListenerOptions,
): JavaListenerHandle {
  const methodNames = Object.keys(options.callbacks).sort().join(",");
  const poolKey = `${options.key}:${methodNames}`;
  let pool = pools.get(poolKey);
  if (!pool) {
    pool = createPool(options);
    pools.set(poolKey, pool);
  }

  const callbackId = String(nextListenerId++);
  pool.callbacks.set(callbackId, options.callbacks);
  const instance = pool.listenerClass.$new();
  instance.callbackId.value = callbackId;

  let disposed = false;
  const handle: JavaListenerHandle = {
    instance,
    $new: () => instance,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      pool!.callbacks.delete(callbackId);
      const owned = options.owner ? owners.get(options.owner) : undefined;
      owned?.delete(handle.dispose);
      if (options.owner && owned?.size === 0) owners.delete(options.owner);
      try {
        instance.callbackId.value = "";
      } catch {}
    },
  };
  if (options.owner) {
    let owned = owners.get(options.owner);
    if (!owned) {
      owned = new Set();
      owners.set(options.owner, owned);
    }
    owned.add(handle.dispose);
  }
  return handle;
}

export function disposeJavaListenerOwner(owner: string): void {
  const owned = owners.get(owner);
  if (!owned) return;
  owners.delete(owner);
  for (const dispose of Array.from(owned)) dispose();
}

export function getJavaListenerDiagnostics(): {
  pools: number;
  callbacks: number;
} {
  let callbacks = 0;
  for (const pool of pools.values()) callbacks += pool.callbacks.size;
  return { pools: pools.size, callbacks };
}
