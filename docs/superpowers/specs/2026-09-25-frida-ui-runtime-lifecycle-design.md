# Frida UI Runtime Lifecycle Design

## Goal

Rename the project to `frida-ui-runtime` and replace the implicit floating-menu lifecycle with an explicit, awaitable lifecycle. This is a breaking redesign; the former `frida-overlay-menu` lifecycle interface is removed.

The runtime must remain usable when device-identity modules alter Android framework values, preserve menu state while concealed, and release all Android and JavaScript resources when disposed.

## Public Interface

The preferred interface is asynchronous:

```ts
const menu = await FloatMenu.create(options);
await menu.mount();
await menu.present(icon);
await menu.present(menu);
await menu.conceal();
await menu.toggle();
await menu.dispose();
```

Lifecycle states are `created`, `mounted`, `icon-visible`, `menu-visible`, `hidden`, `disposing`, and `disposed`. Operations are serialized and idempotent. Invalid operations reject with descriptive errors.

Construction is asynchronous through `FloatMenu.create()`. The old constructor-driven initialization and `show`, `hide`, `toggleView`, and `destroy` methods are not part of the new interface. The sole consumer, `myheroes-pro`, is migrated after the runtime is stable.

## Runtime Modules

`AndroidRuntime` is the seam for Java readiness, application context lookup, main-thread scheduling, overlay permission checks, WindowManager access, and display metrics. It owns hard timeouts and converts Frida/Java failures into contextual errors.

`LifecycleController` serializes operations and owns state transitions. Callers never coordinate Java readiness or WindowManager ordering themselves.

`ComponentRegistry` owns component identity, tab membership, initialization, attachment, detachment, state capture, and disposal. Duplicate identifiers are rejected.

`ListenerRegistry` owns JavaScript subscriptions and Java listener dispatch tokens. Disposing a menu or removing a component clears all associated registrations.

`MenuStateStore` owns active tab, presentation mode, window position, and component values. Concealing a menu does not detach or dispose views. State can also be captured before disposal and restored into a new instance.

## Component Lifecycle

The preferred component lifecycle is:

```ts
initialize(context, menu)
attach(container)
detach()
dispose()
captureState()
restoreState(state)
```

Initialization and disposal are idempotent. All built-in components are migrated to the new lifecycle directly.

## Error Handling

All user callbacks pass through a safe invocation module. Exceptions are logged with the component identifier and event name and cannot escape into the Frida runtime.

All Android main-thread operations use one scheduler that checks disposal state, catches Java exceptions, and returns a Promise. Application readiness uses an independent timer so a missing `Java.perform` callback still rejects.

## Visibility And State

`conceal()` sets attached overlay roots to `View.GONE`. It does not change component values, active tabs, menu position, or listeners. `present()` restores the requested presentation mode. `dispose()` is the only operation that removes WindowManager views and releases component resources.

## Package Migration

The package is renamed to `frida-ui-runtime` with a new root export surface. Internal deep imports are removed from `myheroes-pro`; required component types are exported from the package root.

The tested Java bridge remains pinned to `7.0.4` in development. Supported peer versions are narrowed until additional versions pass device tests with Guise enabled.

## Verification

Unit tests cover state transitions, operation serialization, hard timeouts, callback isolation, duplicate identifiers, event cleanup, state restoration, and log batching.

A minimal Android 15 host application requests `SYSTEM_ALERT_WINDOW` and exposes a stable process for Frida attachment. Device tests run through `frida-server` and cover Guise enabled and disabled, visibility restoration, component state, callback failures, removal/re-addition, 100 lifecycle iterations, and high-volume logging.

## Non-Goals

This change does not alter game hooks, IL2CPP behavior, menu visual design, or feature-specific component semantics. It does not require dual-realm support.
