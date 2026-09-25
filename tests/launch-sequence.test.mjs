import assert from "node:assert/strict";
import test from "node:test";

import { runLaunchSequence } from "../lib/runtime/launch-sequence.js";

test("launch runs setup before presenting the icon", async () => {
  const calls = [];
  const overlay = {
    async present(mode) { calls.push(`present:${mode}`); },
    async dispose() { calls.push("dispose"); },
  };

  const result = await runLaunchSequence(
    async () => { calls.push("create"); return overlay; },
    async value => { assert.equal(value, overlay); calls.push("setup"); },
  );

  assert.equal(result, overlay);
  assert.deepEqual(calls, ["create", "setup", "present:icon"]);
});

test("launch disposes a partially initialized overlay after setup failure", async () => {
  const calls = [];
  const overlay = {
    async present() { calls.push("present"); },
    async dispose() { calls.push("dispose"); },
  };

  await assert.rejects(
    runLaunchSequence(
      async () => { calls.push("create"); return overlay; },
      async () => { calls.push("setup"); throw new Error("setup failed"); },
    ),
    /setup failed/,
  );
  assert.deepEqual(calls, ["create", "setup", "dispose"]);
});

test("launch preserves the original failure when cleanup also fails", async () => {
  const cleanupErrors = [];
  const overlay = {
    async present() {},
    async dispose() { throw new Error("cleanup failed"); },
  };

  await assert.rejects(
    runLaunchSequence(
      async () => overlay,
      async () => { throw new Error("setup failed"); },
      error => cleanupErrors.push(String(error)),
    ),
    /setup failed/,
  );
  assert.deepEqual(cleanupErrors, ["Error: cleanup failed"]);
});
