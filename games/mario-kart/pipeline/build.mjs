import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CHARACTERS } from "../logic.js";
import { modelSpec } from "../model-spec.js";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = root + "assets/mario-kart/";
await mkdir(out, { recursive: true });
await writeFile(
  out + "pack-spec.json",
  JSON.stringify(
    CHARACTERS.map((c) => modelSpec(c.id)),
    null,
    2,
  ),
);
const blender =
  process.env.BLENDER || "/Applications/Blender.app/Contents/MacOS/Blender";
const result = spawnSync(
  blender,
  ["-b", "-P", fileURLToPath(new URL("build.py", import.meta.url)), "--", out],
  { stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status || 1);
await writeFile(
  out + "manifest.json",
  JSON.stringify(
    {
      version: 1,
      generatedBy: "Pipeline Blender original do GameVitto",
      characters: CHARACTERS.map((c) => ({ id: c.id, file: c.id + ".glb" })),
    },
    null,
    2,
  ),
);
