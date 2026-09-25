# Dynamic Component And Hide Toast Design

## Scope

Extend the independent device overlay test and the close-button interaction.
This change does not alter component APIs or the programmatic `conceal()`
contract.

## Dynamic Component Test

The `Controls` tab will contain a `Create Dynamic Component` button. Each click
creates one component using a repeating sequence:

1. `TextView`
2. `Switch`
3. `Slider`

Every component receives a monotonic unique ID and a label containing its
sequence number. Components are attached through the public
`FloatMenu.addComponent()` API after launch, so the test exercises runtime view
creation, listener registration, layout attachment, and state capture.

Button callback failures are caught and logged by the existing safe callback
boundary. Successful creation shows a short Toast identifying the new
component.

## Close-Button Toast

Clicking the header close button will:

1. Conceal the menu and icon visually.
2. Keep the transparent icon hotspot mounted and touchable at its previous
   coordinates.
3. Show the Toast `菜单已隐藏，点击原悬浮图标位置可重新打开`.

The public `menu.conceal()` method remains silent. This prevents programmatic
conceal operations, startup flows, and stress tests from producing unsolicited
Toast messages.

If Toast display fails, the overlay remains concealed and the error is logged;
the close interaction must not reopen or dispose the windows.

## Permission Test

With `SYSTEM_ALERT_WINDOW` denied, loading the independent device agent must:

- show the configured missing-permission Toast;
- reject overlay launch with `OverlayPermissionError`;
- leave no partially attached overlay windows.

After verification, permission will be restored and the updated device agent
will be loaded into the independent test APK for manual testing.

## Verification

- Unit tests continue to pass.
- The device agent compiles with one Java Bridge Runtime and no global Java
  dependency.
- Permission-denied Toast is observed on the device.
- Dynamic button creates Text, Switch, and Slider components in order.
- Close hides all visible overlay content and displays the guidance Toast.
- Tapping the original icon position opens the menu again.
- Minimize still returns to a visible, non-focusable icon.
