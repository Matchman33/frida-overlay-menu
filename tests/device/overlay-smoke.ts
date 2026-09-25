import {
  Button,
  CheckBoxGroup,
  Collapsible,
  FloatMenu,
  NumberInput,
  Selector,
  Slider,
  Switch,
  TextInput,
  TextView,
} from "../../src/index.js";
import { getJavaListenerDiagnostics } from "../../src/android-listener.js";
import { iconBase64 } from "../../icon.js";

type TestGlobals = typeof globalThis & {
  overlayMenu?: FloatMenu;
  overlayStart?: () => Promise<void>;
  overlayRunSmoke?: () => Promise<void>;
  overlayPresent?: (mode?: "icon" | "menu") => Promise<void>;
  overlayConceal?: () => Promise<void>;
  overlayStop?: () => Promise<void>;
  overlayStress?: (count?: number) => Promise<void>;
  overlayDisposeAndReport?: () => Promise<void>;
  overlayListenerStats?: () => { pools: number; callbacks: number };
};

const globals = globalThis as TestGlobals;
let dynamicComponentIndex = 0;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function createDynamicComponent(index: number): TextView | Switch | Slider {
  const sequence = (index - 1) % 3;
  if (sequence === 0) {
    return new TextView(
      `dynamic-text-${index}`,
      `Dynamic Text #${index}`,
      "note",
    );
  }
  if (sequence === 1) {
    return new Switch(
      `dynamic-switch-${index}`,
      `Dynamic Switch #${index}`,
      false,
    );
  }
  return new Slider(
    `dynamic-slider-${index}`,
    `Dynamic Slider #${index}`,
    0,
    10,
    index % 11,
  );
}

function addDynamicComponent(menu: FloatMenu): void {
  void (async () => {
    const index = ++dynamicComponentIndex;
    const component = createDynamicComponent(index);
    await menu.addComponent(component, "controls");
    await menu.toast(`Created ${component.getId()}`);
    console.log(`[DEVICE_TEST] created dynamic component ${component.getId()}`);
  })().catch(error => console.error(
    "[DEVICE_TEST] dynamic component creation failed",
    error instanceof Error ? error.stack || error.message : String(error),
  ));
}

async function buildMenu(): Promise<FloatMenu> {
  console.log("[DEVICE_TEST] launch menu");
  return FloatMenu.launch({
    title: "Frida UI Runtime",
    version: "device-test",
    width: 820,
    height: 1100,
    icon: {
      base64: iconBase64,
      width: 140,
      height: 140,
    },
    tabs: [
      { id: "controls", label: "Controls" },
      { id: "status", label: "Status" },
    ],
    activeTab: "controls",
  }, async menu => {
    console.log("[DEVICE_TEST] add initial components");
    await menu.addComponent(new TextView(
      "intro",
      "Lifecycle and state test running",
      "note",
    ), "controls");
    await menu.addComponent(new Button(
      "create-dynamic",
      "Create Dynamic Component",
      "primary",
      () => addDynamicComponent(menu),
    ), "controls");
    await menu.addComponent(new Switch("enabled", "Enabled", false), "controls");
    await menu.addComponent(new Slider("level", "Level", 0, 10, 3), "controls");
    await menu.addComponent(new Button("throw", "Throw test error", "danger", () => {
      throw new Error("intentional device callback failure");
    }), "controls");
    await menu.addComponent(new TextView(
      "status",
      "Conceal keeps views and values alive",
    ), "status");
    await menu.addComponent(new Selector(
      "mode",
      "Mode",
      [{ label: "Normal" }, { label: "Compatibility" }],
    ), "status");
    await menu.addComponent(new NumberInput("count", 3, "Count", "Enter count"), "status");
    await menu.addComponent(new TextInput("note", "ready", "Note", "Enter note"), "status");
    await menu.addComponent(new CheckBoxGroup(
      "features",
      "Features",
      [{ id: "a", label: "A" }, { id: "b", label: "B" }],
      ["a"],
    ), "status");
    await menu.addComponent(new Collapsible("advanced", "Advanced", false), "status");
  });
}

async function verifyState(menu: FloatMenu): Promise<void> {
  menu.setComponentValue("enabled", true);
  menu.setComponentValue("level", 7);
  const before = menu.captureState();
  assert(before.components.enabled === true, "switch state was not captured");
  assert(before.components.level === 7, "slider state was not captured");

  await menu.conceal();
  assert(menu.state === "hidden", "menu did not enter hidden state");
  assert(menu.getComponent<Switch>("enabled")?.getValue() === true, "switch state changed while hidden");
  assert(menu.getComponent<Slider>("level")?.getValue() === 7, "slider state changed while hidden");

  await menu.addComponent(
    new TextView("dynamic", "Added while concealed", "note"),
    "status",
  );
  assert(menu.getComponent<TextView>("dynamic"), "dynamic component was not registered");

  await menu.present("menu");
  const restoredState: string = menu.state;
  assert(restoredState === "menu-visible", "menu did not restore its presentation");
  await menu.removeComponent("dynamic");
  assert(!menu.getComponent("dynamic"), "dynamic component was not removed");
}

async function stress(count: number = 20): Promise<void> {
  let menu = globals.overlayMenu;
  for (let index = 0; index < count; index++) {
    await menu?.dispose();
    menu = await buildMenu();
    await menu.present(index % 2 === 0 ? "icon" : "menu");
    await menu.conceal();
  }
  assert(menu, "stress test did not create a menu");
  await menu.present("menu");
  globals.overlayMenu = menu;
  const diagnostics = getJavaListenerDiagnostics();
  assert(diagnostics.callbacks <= 30, `listener callbacks leaked: ${diagnostics.callbacks}`);
  console.log(`[DEVICE_TEST] listeners after stress: ${JSON.stringify(diagnostics)}`);
  console.log(`[DEVICE_TEST] lifecycle stress passed: ${count}`);
}

async function start(): Promise<void> {
  console.log("[DEVICE_TEST] start");
  await globals.overlayMenu?.dispose();
  const menu = await buildMenu();
  globals.overlayMenu = menu;
  assert(menu.state === "icon-visible", "launch did not default to icon mode");
  console.log("[DEVICE_TEST] floating icon ready");
}

globals.overlayStart = start;
globals.overlayRunSmoke = async () => {
  if (!globals.overlayMenu || globals.overlayMenu.state === "disposed") {
    await start();
  }
  const menu = globals.overlayMenu!;
  console.log("[DEVICE_TEST] verify state");
  await verifyState(menu);
  console.log("[DEVICE_TEST] overlay smoke passed");
};
globals.overlayPresent = async (mode = "menu") => {
  if (!globals.overlayMenu || globals.overlayMenu.state === "disposed") {
    await start();
  }
  await globals.overlayMenu!.present(mode);
};
globals.overlayConceal = async () => {
  await globals.overlayMenu?.conceal();
};
globals.overlayStop = async () => {
  await globals.overlayMenu?.dispose();
  globals.overlayMenu = undefined;
};
globals.overlayStress = stress;
globals.overlayListenerStats = getJavaListenerDiagnostics;
globals.overlayDisposeAndReport = async () => {
  await globals.overlayMenu?.dispose();
  globals.overlayMenu = undefined;
  const diagnostics = getJavaListenerDiagnostics();
  assert(diagnostics.callbacks === 0, `listeners remain after dispose: ${diagnostics.callbacks}`);
  console.log(`[DEVICE_TEST] listeners after dispose: ${JSON.stringify(diagnostics)}`);
};

void start().then(
  () => console.log("[DEVICE_TEST] Gadget-style startup passed"),
  error => console.error(
    "[DEVICE_TEST] startup failed",
    error instanceof Error ? error.stack || error.message : String(error),
  ),
);
