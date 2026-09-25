import assert from "node:assert/strict";
import test from "node:test";

import {
  assertJavaBridgeCompatible,
  ensureWindowNotFocusable,
  getApplicationContext,
  getOverlayWindowType,
  getWindowManager,
  readDisplayDensity,
  readDisplaySize,
  runWhenJavaReady,
  scheduleOnMainThread,
  waitForApplicationContext,
  waitForJavaAvailable,
} from "../lib/android-runtime.js";

function staticField(value) {
  return { value };
}

test("accepts bridge versions that expose the required runtime capabilities", () => {
  assert.doesNotThrow(() => assertJavaBridgeCompatible({
    use() {},
    perform() {},
    scheduleOnMainThread() {},
  }));
  assert.doesNotThrow(() => assertJavaBridgeCompatible({
    use() {},
    performNow() {},
    scheduleOnMainThread() {},
  }));
});

test("reports missing Java Bridge capabilities before startup", () => {
  assert.throws(
    () => assertJavaBridgeCompatible({ use() {} }),
    /performNow or perform, scheduleOnMainThread/,
  );
});

test("falls back when ActivityThread.currentApplication is hidden", () => {
  const context = { getResources() {}, getSystemService() {} };
  const application = { getApplicationContext: () => context };
  const java = {
    use(name) {
      if (name === "android.app.ActivityThread") {
        return { currentApplication: () => null, currentActivityThread: () => null };
      }
      if (name === "android.app.AppGlobals") {
        return { getInitialApplication: () => application };
      }
      throw new Error(name);
    },
  };

  assert.equal(getApplicationContext(java), context);
});

test("uses the application itself when getApplicationContext is masked", () => {
  const application = {
    getApplicationContext: () => null,
    getResources() {},
    getSystemService() {},
  };
  const java = {
    use(name) {
      if (name === "android.app.ActivityThread") {
        return { currentApplication: () => application };
      }
      throw new Error(name);
    },
  };

  assert.equal(getApplicationContext(java), application);
});

test("accepts a usable WindowManager service when interface casts are blocked", () => {
  const service = { addView() {}, updateViewLayout() {}, removeView() {} };
  const java = {
    use() { return {}; },
    cast() { throw new Error("cast blocked"); },
  };
  const context = { getSystemService: name => name === "window" ? service : null };

  assert.equal(getWindowManager(java, context), service);
});

test("skips a successful WindowManager cast when Guise hides ViewManager methods", () => {
  const service = { implementation: "android.view.WindowManagerImpl" };
  const unusableWindowManager = { implementation: service.implementation };
  const usableViewManager = {
    addView() {},
    updateViewLayout() {},
    removeView() {},
  };
  const java = {
    use(name) { return { name }; },
    cast(_value, klass) {
      return klass.name === "android.view.WindowManager"
        ? unusableWindowManager
        : usableViewManager;
    },
  };
  const context = { getSystemService: () => service };

  assert.equal(getWindowManager(java, context), usableViewManager);
});

test("chooses window type by framework fields instead of spoofable SDK_INT", () => {
  assert.equal(getOverlayWindowType({ TYPE_APPLICATION_OVERLAY: staticField(2038) }), 2038);
  assert.equal(getOverlayWindowType({ TYPE_PHONE: staticField(2002) }), 2002);
  assert.equal(getOverlayWindowType({ TYPE_SYSTEM_ALERT: staticField(2003) }), 2003);
});

test("rejects invalid spoofed display metrics and uses the real display fallback", () => {
  const metrics = { widthPixels: staticField(0), heightPixels: staticField(-1) };
  const context = { getResources: () => ({ getDisplayMetrics: () => metrics }) };
  const windowManager = {
    getDefaultDisplay: () => ({
      getRealMetrics(target) {
        target.widthPixels.value = 1080;
        target.heightPixels.value = 2400;
      },
    }),
  };

  assert.deepEqual(readDisplaySize(context, windowManager), { width: 1080, height: 2400 });
});

test("falls back to a safe density when a spoofing module returns an invalid value", () => {
  const context = {
    getResources: () => ({
      getDisplayMetrics: () => ({ density: staticField(0) }),
    }),
  };

  assert.equal(readDisplayDensity(context), 1);
});

test("restores FLAG_NOT_FOCUSABLE when window flags are mutated", () => {
  const params = { flags: staticField(0x20) };
  const layoutParams = { FLAG_NOT_FOCUSABLE: staticField(0x08) };

  assert.equal(ensureWindowNotFocusable(params, layoutParams), true);
  assert.equal(params.flags.value, 0x28);
  assert.equal(ensureWindowNotFocusable(params, layoutParams), false);
  assert.equal(params.flags.value, 0x28);
});

test("Java readiness has a hard timeout when perform never invokes its callback", async () => {
  const java = { perform() {} };
  await assert.rejects(
    waitForApplicationContext(java, 20, 1),
    /Timed out waiting for Android Application context/,
  );
});

test("waits for the consumer-provided Java Bridge to become available", async () => {
  const java = { available: false, use() {} };
  setTimeout(() => { java.available = true; }, 5);
  await waitForJavaAvailable(java, 100, 1);
  assert.equal(java.available, true);
});

test("Java Bridge availability has a hard timeout", async () => {
  const java = { available: false, use() {} };
  await assert.rejects(
    waitForJavaAvailable(java, 20, 1),
    /Timed out waiting for Frida Java Bridge/,
  );
});

test("application readiness retries transient bridge access failures", async () => {
  const context = { getResources() {}, getSystemService() {} };
  const application = { getApplicationContext: () => context };
  let performReads = 0;
  const java = {
    get perform() {
      performReads++;
      if (performReads < 3) throw new Error("Java is not available yet");
      return callback => callback();
    },
    use(name) {
      if (name === "android.app.ActivityThread") {
        return { currentApplication: () => application };
      }
      throw new Error(name);
    },
  };

  assert.equal(await waitForApplicationContext(java, 100, 1), context);
  assert.equal(performReads, 3);
});

test("application readiness prefers performNow during early injection", async () => {
  const context = { id: "context" };
  const application = { getApplicationContext: () => context };
  let performCalls = 0;
  let performNowCalls = 0;
  const java = {
    perform() { performCalls += 1; },
    performNow(callback) {
      performNowCalls += 1;
      callback();
    },
    use(name) {
      if (name === "android.app.ActivityThread") {
        return { currentApplication: () => application };
      }
      throw new Error(`unexpected class ${name}`);
    },
  };

  assert.equal(await waitForApplicationContext(java, 100, 1), context);
  assert.equal(performNowCalls, 1);
  assert.equal(performCalls, 0);
});

test("runWhenJavaReady catches synchronous Java.perform failures", async () => {
  const java = { perform() { throw new Error("bridge unavailable"); } };
  await assert.rejects(
    runWhenJavaReady(java, () => 1, 20, "test operation"),
    /bridge unavailable/,
  );
});

test("main thread scheduling has a hard timeout", async () => {
  const java = { scheduleOnMainThread() {} };
  await assert.rejects(
    scheduleOnMainThread(java, () => 1, 20, "test main thread operation"),
    /Timed out waiting for Android main thread/,
  );
});
