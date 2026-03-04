#!/usr/bin/env node
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const compiled = join(root, "link.js");
const source = join(root, "link.ts");

const args = existsSync(compiled)
  ? [compiled, ...process.argv.slice(2)]
  : ["--experimental-strip-types", source, ...process.argv.slice(2)];

execFileSync(process.execPath, args, { stdio: "inherit" });
