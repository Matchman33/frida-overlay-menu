import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

test("package accepts the consumer's Java Bridge as an unrestricted peer", () => {
  assert.equal(packageJson.name, "frida-ui-runtime");
  assert.equal(packageJson.version, "2.0.0");
  assert.equal(packageJson.dependencies?.["frida-java-bridge"], undefined);
  assert.equal(packageJson.peerDependencies?.["frida-java-bridge"], "*");
  assert.equal(packageJson.devDependencies?.["frida-java-bridge"], "7.0.4");
});

test("external-style Gadget agent contains exactly one Java Bridge Runtime", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "frida-ui-runtime-"));
  const output = join(temporary, "agent.js");
  try {
    execFileSync(process.execPath, [
      join(root, "node_modules", "frida-compile", "dist", "cli.js"),
      join(root, "tests", "fixtures", "java-runtime-agent.ts"),
      "-o",
      output,
    ], { cwd: root, stdio: "pipe" });
    const bundle = await readFile(output, "utf8");
    const constructions = bundle.match(/new Runtime\w*\(\)/g) ?? [];
    assert.equal(constructions.length, 1);
    assert.doesNotMatch(bundle, /globalThis\.Java/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
