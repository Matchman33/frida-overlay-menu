import Java from "frida-java-bridge";
import { FloatMenu } from "../../src/index.js";

console.log(
  `[BRIDGE_FIXTURE] available=${Java.available} launch=${typeof FloatMenu.launch}`,
);
