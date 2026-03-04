#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
execFileSync(
  process.execPath,
  ["--experimental-strip-types", join(root, "link.ts"), ...process.argv.slice(2)],
  { stdio: "inherit" },
);
