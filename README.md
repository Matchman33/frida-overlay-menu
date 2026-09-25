# frida-ui-runtime

Lifecycle-safe Android overlay UI runtime for Frida scripts.

The runtime creates native Android views through the consumer-installed
`frida-java-bridge` peer dependency. The consumer selects the bridge version;
the runtime validates the capabilities it needs and never depends on a
REPL-provided global `Java` object.

## Requirements

- Frida with Java support in the target Android process
- Overlay permission for the target application
- Android `WindowManager` access
- `frida-compile` for bundling TypeScript entrypoints

## Install

```bash
npm install frida-ui-runtime frida-java-bridge
```

## Quick Start

```typescript
import {
  Button,
  FloatMenu,
  Slider,
  Switch,
  TextView,
} from "frida-ui-runtime";

async function main(): Promise<void> {
  const menu = await FloatMenu.launch({
    title: "Runtime Tools",
    width: 820,
    height: 1100,
    icon: {
      base64: iconBase64,
      width: 160,
      height: 160,
    },
    tabs: [
      { id: "controls", label: "Controls" },
      { id: "status", label: "Status" },
    ],
    activeTab: "controls",
  }, async menu => {
    await menu.addComponent(
      new Switch("enabled", "Enabled", false),
      "controls",
    );
    await menu.addComponent(
      new Slider("level", "Level", 0, 10, 3),
      "controls",
    );
    await menu.addComponent(
      new Button("run", "Run", "primary", () => console.log("run")),
      "controls",
    );
    await menu.addComponent(
      new TextView("status", "Ready"),
      "status",
    );
  });

  // Components remain dynamic after the floating icon is visible.
  await menu.addComponent(new TextView("late", "Added later"), "status");
}

void main().catch(error => console.error(error));
```

The entrypoint runs directly in a Gadget local script and does not require a
REPL. `FloatMenu.launch()` waits for the consumer-provided Java Bridge, Android
application context, and main thread. It shows the floating icon only after the
setup callback completes.

`frida-java-bridge` is an unrestricted peer dependency. Install one bridge
version in the consuming project and let the package manager resolve both the
application and this runtime to that instance. Version `7.0.4` is only the
library's development and regression-test baseline.

At startup the runtime checks for `use`, `scheduleOnMainThread`, and either
`performNow` or `perform`. An incompatible bridge fails early with
`JavaBridgeCompatibilityError` and a list of missing capabilities.

## Lifecycle

`FloatMenu` serializes lifecycle operations so concurrent calls cannot attach or detach the same window twice.

```typescript
await menu.mount();          // Create and attach both windows, initially hidden
await menu.present("icon"); // Show only the floating icon
await menu.present("menu"); // Show only the menu
await menu.conceal();        // Hide visually; keep the icon hotspot touchable
await menu.toggle();         // Toggle icon/menu presentation
await menu.dispose();        // Remove windows and release listeners/components
```

`FloatMenu.create()` remains available as a low-level API that returns a hidden
menu. Prefer `FloatMenu.launch()` for Gadget entrypoints. Calling `present()`
without a mode defaults to the floating icon.

The minimize button returns to the visible icon. The close button calls
`conceal()`: both surfaces disappear visually, but the icon window stays
transparent and touchable at its previous position. Tapping that location opens
the menu directly. The close interaction also shows a Toast explaining where to
tap. The views and component state remain mounted throughout.

Use `dispose()` only when the overlay is no longer needed and its state may be
released.

## State

```typescript
const snapshot = menu.captureState();
await menu.conceal();

await menu.present("menu");
menu.restoreState(snapshot);
```

Component IDs must be unique. Duplicate IDs are rejected instead of silently replacing an existing component.

Components can be added or removed after launch, including while the overlay is
concealed:

```typescript
await menu.conceal();
await menu.addComponent(new TextView("dynamic", "Added while hidden"));
await menu.removeComponent("dynamic");
await menu.present();
```

## Overlay Permission

Permission is checked before any window is attached. If permission is missing,
the runtime shows a Toast and throws `OverlayPermissionError`. Override the
Toast text with `permissionDeniedMessage` when needed.

## Custom Icon

`icon.base64` accepts raw Base64 or a `data:image/...;base64,` value. File paths
and network URLs are intentionally unsupported. Invalid image data fails launch
with `InvalidOverlayIconError` instead of creating a blank icon window.

## Components

The root package exports:

- `Button`
- `Category`
- `CheckBoxGroup`
- `Collapsible`
- `NumberInput`
- `Selector`
- `Slider`
- `Switch`
- `TextInput`
- `TextView` (`Text` alias)
- `UIComponent` for custom controls

All component callbacks are isolated from the Java listener boundary. Callback failures are logged instead of escaping into Android's UI thread.

## Build And Test

```bash
npm test
npx frida-compile tests/device/overlay-smoke.ts -o tests/device/overlay-smoke.js
```

The repository includes an independent Android host app in `android-test-app`. Device testing does not load an application's production Frida script.

## Compatibility Notes

- Window type selection checks available framework fields instead of trusting spoofable `SDK_INT` values.
- Application context lookup falls back across `ActivityThread` and `AppGlobals`.
- `WindowManager` wrappers are validated for `addView`, `updateViewLayout`, and `removeView`. This handles environments where a module such as Guise allows an interface cast but hides the inherited `ViewManager` methods.
- Display metrics are validated before use and fall back to real display metrics when spoofed values are invalid.
