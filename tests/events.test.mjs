import assert from "node:assert/strict";
import test from "node:test";

import { EventEmitter } from "../lib/event-emitter.js";
import { Logger } from "../lib/logger.js";

test("deferred event listener failures are reported instead of escaping", async () => {
  const messages = [];
  const logger = Logger.instance;
  const originalError = logger.error;
  logger.error = (...args) => messages.push(args.map(String).join(" "));

  try {
    const emitter = new EventEmitter();
    emitter.on("change", () => { throw new Error("listener failed"); });
    emitter.emit("change");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(messages.length, 1);
    assert.match(messages[0], /listener failed/);
  } finally {
    logger.error = originalError;
  }
});

test("Logger.on subscribes to log items without throwing", async () => {
  const logger = new Logger("none", { flushIntervalMs: 8 });
  const received = [];
  const unsubscribe = logger.on("log", (level, message) => {
    received.push({ level, message });
  });

  logger.setLevel("debug");
  logger.info("ready");
  await new Promise(resolve => setTimeout(resolve, 15));
  unsubscribe();

  assert.deepEqual(received, [{ level: "info", message: "ready" }]);
});
