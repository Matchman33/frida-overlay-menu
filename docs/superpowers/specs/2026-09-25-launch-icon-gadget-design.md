# Frida UI Runtime Launch And Gadget Design

Date: 2026-09-25

## Goal

Provide a Gadget-safe startup API that builds the initial menu before exposing
the overlay, shows the floating icon by default, supports a Base64 icon, and
reports missing overlay permission through a Toast. Components must remain
dynamic after startup.

## Public API

`FloatMenu.create(options, timeoutMs)` remains the low-level constructor. It
waits for Java and the Android application context but does not mount or show a
window.

The recommended API is:

```ts
const menu = await FloatMenu.launch(options, async menu => {
  await menu.addComponent(initialComponent);
});
```

`launch` performs these steps in order:

1. Wait for the consumer-provided Java Bridge to become available.
2. Create the menu without attaching windows.
3. Run the caller's synchronous or asynchronous setup callback.
4. Mount the overlay windows.
5. Present the floating icon.
6. Return the live `FloatMenu` instance.

If setup, mounting, or presentation fails, `launch` disposes the partially
created menu before rethrowing the original error.

## Dynamic Components

The setup callback defines only the components that must exist before the first
icon is shown. It does not freeze the component registry.

After `launch` resolves, callers may continue to use:

```ts
await menu.addComponent(component, tabId);
await menu.removeComponent(componentId);
```

Dynamic operations continue through the serialized lifecycle queue. Adding a
component to a mounted menu creates and attaches its Android view on the main
thread. Adding a component while the menu is concealed updates the retained
menu state, and the component appears when the menu is presented again. A
dynamic component failure rolls back only that component.

## Java Bridge

The runtime has exactly one Java Bridge implementation:

```ts
import Java from "frida-java-bridge";
export default Java;
```

`frida-java-bridge` is an unrestricted peer dependency (`*`). The consumer
selects and installs the bridge version. The runtime never installs a private
copy, so the consumer and UI runtime resolve the same module instance. Version
`7.0.4` remains a development dependency only for this repository's builds and
tests. All runtime modules import the shared adapter instead of importing the
package directly or reading `globalThis.Java`.

Startup validates the bridge capabilities it needs, waits for
`Java.available`, prefers `Java.performNow` for early Android framework access,
and falls back to `Java.perform` when necessary. Missing required bridge APIs
produce a descriptive compatibility error. This supports Gadget local scripts
without a REPL environment.

The package compatibility test compiles an external-style entrypoint that
imports both `frida-java-bridge` and `frida-ui-runtime`. It requires exactly one
Java Bridge `Runtime` construction. Zero or multiple constructions fail the
test.

## Floating Icon

The icon option is structured and accepts Base64 only:

```ts
icon: {
  base64: iconBase64,
  width: 160,
  height: 160,
}
```

Both raw Base64 and a `data:image/...;base64,` prefix are accepted. The runtime
validates that decoding produces non-empty bytes and a valid Android Bitmap.
Invalid icon data fails launch with a descriptive error instead of creating a
blank window. When `icon` is omitted, the built-in fallback icon is used.

## Overlay Permission

Permission is checked on the Android main thread immediately before the first
window is attached. When permission is denied, the runtime shows a Toast with
the default message `请先授予悬浮窗权限`, then throws
`OverlayPermissionError`. No overlay window is attached.

The message may be overridden through `permissionDeniedMessage`. Toast failure
is logged but does not replace the permission error.

## Default Presentation

`FloatMenu.launch` always presents the floating icon after successful setup.
It never opens the menu automatically. Clicking the icon presents the menu;
minimizing the menu returns to the icon.

The close (`X`) action calls `conceal()`. Conceal hides the menu and makes the
icon fully transparent while keeping its window visible, non-focusable, and
touchable at the same coordinates. Tapping that transparent hotspot presents
the menu directly. The component tree and active page remain mounted.

`FloatMenu.create` remains hidden until the caller explicitly calls `mount` or
`present`. Calling `present()` without a mode defaults to `icon`.

## Gadget Entrypoint

A production Gadget entrypoint invokes the startup API directly:

```ts
void FloatMenu.launch(options, async menu => {
  await buildMenu(menu);
}).catch(error => Logger.instance.error(error));
```

No global functions, REPL commands, or command-line evaluation are required.
The independent device smoke script follows this startup model.

## Verification

- Unit-test launch ordering and cleanup after setup failure.
- Test Java availability timeout and delayed availability.
- Test raw Base64 and data-URI normalization.
- Test invalid Base64 and invalid Bitmap rejection.
- Test permission denial Toast before `OverlayPermissionError`.
- Test dynamic add and remove after launch and while concealed.
- Compile an external-style Gadget agent importing both packages and verify one
  Java Bridge Runtime.
- Verify minimize shows the icon, while close leaves a transparent hotspot that
  reopens the menu from the icon's prior coordinates.
- Use only the independent Android test host for device overlay testing.
- Verify all overlay roots retain `FLAG_NOT_FOCUSABLE`.
