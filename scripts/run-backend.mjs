import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const cmd = process.argv[2] ?? "api";

const env = fs.readFileSync(path.join(root, "opal.env"), "utf8");
const match = env.match(/^OPAL_PYTHON=(.+)$/m);
if (!match) {
  console.error("Add OPAL_PYTHON=... to opal.env (see opal.env.example)");
  process.exit(1);
}

const python = match[1].trim().replace(/^["']|["']$/g, "");
const result = spawnSync(python, [path.join(root, "backend/run.py"), cmd, ...process.argv.slice(3)], {
  cwd: root,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
