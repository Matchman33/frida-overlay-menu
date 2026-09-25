import assert from "node:assert/strict";
import test from "node:test";

import { ComponentRegistry } from "../lib/runtime/component-registry.js";
import { LifecycleController } from "../lib/runtime/lifecycle-controller.js";
import { ListenerRegistry } from "../lib/runtime/listener-registry.js";
import { deferSafe } from "../lib/runtime/safe-runtime.js";

test("component registry rejects duplicate identifiers", () => {
  const registry = new ComponentRegistry();
  const component = { getId: () => "same", getValue: () => 1 };
  registry.add(component, "default");
  assert.throws(() => registry.add(component, "default"), /already registered/);
});

test("lifecycle operations are serialized and failures do not poison the queue", async () => {
  const lifecycle = new LifecycleController();
  const calls = [];
  const first = lifecycle.run("first", async () => {
    calls.push("first:start");
    await new Promise(resolve => setTimeout(resolve, 5));
    calls.push("first:end");
    lifecycle.transition("mounted");
  });
  const failed = lifecycle.run("failed", () => {
    calls.push("failed");
    throw new Error("expected failure");
  });
  const last = lifecycle.run("last", () => {
    calls.push("last");
    lifecycle.transition("hidden");
  });

  await first;
  await assert.rejects(failed, /expected failure/);
  await last;
  assert.deepEqual(calls, ["first:start", "first:end", "failed", "last"]);
  assert.equal(lifecycle.state, "hidden");
});

test("listener registry disposes each subscription once", () => {
  const registry = new ListenerRegistry();
  let disposed = 0;
  registry.add("component:a", () => disposed++);
  registry.clear("component:a");
  registry.clear("component:a");
  assert.equal(disposed, 1);
});

test("deferred user callback failures are reported instead of escaping", async () => {
  const errors = [];
  deferSafe("button:test", () => {
    throw new Error("callback failed");
  }, error => errors.push(error));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(errors.length, 1);
  assert.match(String(errors[0]), /button:test/);
  assert.match(String(errors[0]), /callback failed/);
});
