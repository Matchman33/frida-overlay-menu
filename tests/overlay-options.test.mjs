import assert from "node:assert/strict";
import test from "node:test";

import {
  InvalidOverlayIconError,
  normalizeIconBase64,
  OverlayPermissionError,
  requireOverlayPermission,
} from "../lib/runtime/overlay-options.js";

test("normalizes raw and data-URI Base64 icons", () => {
  assert.equal(normalizeIconBase64(" YWJjZA==\n"), "YWJjZA==");
  assert.equal(
    normalizeIconBase64("data:image/png;base64,YWJjZA=="),
    "YWJjZA==",
  );
});

test("rejects invalid Base64 icons", () => {
  assert.throws(
    () => normalizeIconBase64("not_base64!"),
    InvalidOverlayIconError,
  );
  assert.throws(() => normalizeIconBase64(""), InvalidOverlayIconError);
});

test("permission denial shows Toast before throwing", () => {
  const calls = [];
  assert.throws(
    () => requireOverlayPermission(
      false,
      "permission required",
      message => calls.push(`toast:${message}`),
    ),
    OverlayPermissionError,
  );
  assert.deepEqual(calls, ["toast:permission required"]);
});

test("permission denial preserves its error when Toast fails", () => {
  const toastErrors = [];
  assert.throws(
    () => requireOverlayPermission(
      false,
      "permission required",
      () => { throw new Error("toast failed"); },
      error => toastErrors.push(String(error)),
    ),
    OverlayPermissionError,
  );
  assert.deepEqual(toastErrors, ["Error: toast failed"]);
});
