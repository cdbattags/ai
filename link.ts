#!/usr/bin/env -S node --experimental-strip-types

import { execSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const REPO_DIR = dirname(new URL(import.meta.url).pathname);
const HOME = homedir();
const SRC = join(REPO_DIR, "src");
const VENDOR = join(REPO_DIR, "vendor");
const DEFAULT_NAME = "cdbattags";

function installTargets(workspace: boolean): Record<string, string> {
  if (workspace) {
    const cwd = process.cwd();
    return {
      cursor: join(cwd, ".cursor"),
      claude: join(cwd, ".claude"),
      opencode: join(cwd, ".opencode"),
    };
  }
  return {
    cursor: join(HOME, ".cursor"),
    claude: join(HOME, ".claude"),
    opencode: join(HOME, ".config", "opencode"),
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VendorConfig {
  [vendorName: string]: {
    skills?: Record<string, string>;
    rules?: Record<string, string>;
  };
}

interface Options {
  command: "build" | "install" | "all";
  name: string;
  workspace: boolean;
  tools: string[];
  mcpProfile: string;
  dryRun: boolean;
  clean: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USAGE = `
Usage: node link.ts [command] [options]
       npx ai-config [command] [options]

Commands:
  build               Build dist/<name>/ from src/ + vendor
  install [tool...]   Symlink dist/<name>/ into ~/ (cursor, claude, opencode, or all)
  (no command)        Build + install all

Options:
  --name NAME         Output directory name under dist/ (default: ${DEFAULT_NAME})
  --mcp PROFILE       MCP profile to use (default: base)
  --workspace         Install into cwd (.cursor/, .claude/) instead of ~/
  --dry-run           Show what would happen without doing it
  --clean             Remove installed symlinks
  -h, --help          Show this help
`.trim();

function log(msg: string): void {
  console.log(`  ${msg}`);
}

function header(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

function ensureSubmodules(): void {
  if (!existsSync(join(REPO_DIR, ".git"))) return;

  const markers = [
    join(VENDOR, "hutchic", ".gitignore"),
    join(VENDOR, "aussiegingersnap", "README.md"),
  ];
  if (markers.some((m) => !existsSync(m))) {
    header("Initializing submodules...");
    execSync("git submodule update --init --recursive", {
      cwd: REPO_DIR,
      stdio: "inherit",
    });
  }
}

function makeRelativeSymlink(
  target: string,
  linkPath: string,
  dryRun: boolean,
): void {
  const rel = relative(dirname(linkPath), target);
  const name = basename(linkPath);

  if (!existsSync(target) && !isSymlink(target)) {
    log(`SKIP ${name} (source missing)`);
    return;
  }

  if (dryRun) {
    log(`WOULD LINK ${linkPath} -> ${rel}`);
    return;
  }

  if (isSymlink(linkPath)) {
    unlinkSync(linkPath);
  }
  symlinkSync(rel, linkPath);
  log(`LINKED ${basename(dirname(linkPath))}/${name} -> ${rel}`);
}

function globByExt(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => join(dir, f));
}

function globDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() || d.isSymbolicLink())
    .map((d) => d.name)
    .sort()
    .map((name) => join(dir, name));
}

function loadVendorConfig(): VendorConfig {
  const path = join(REPO_DIR, "vendor.json");
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8")) as VendorConfig;
}

// ---------------------------------------------------------------------------
// Build: src/ + vendor/ -> dist/
// ---------------------------------------------------------------------------

function wipeDist(dist: string): void {
  if (existsSync(dist)) {
    rmSync(dist, { recursive: true });
  }
}

function buildCursor(dist: string, mcpProfile: string, dryRun: boolean): void {
  header(`Build ${basename(dist)}/cursor/`);
  const out = join(dist, "cursor");
  ensureDir(join(out, "rules"));
  ensureDir(join(out, "skills"));
  ensureDir(join(out, "commands"));

  log("Rules (src):");
  for (const rule of globByExt(join(SRC, "rules"), ".mdc")) {
    makeRelativeSymlink(rule, join(out, "rules", basename(rule)), dryRun);
  }

  log("Skills (src):");
  for (const skill of globDirs(join(SRC, "skills"))) {
    makeRelativeSymlink(skill, join(out, "skills", basename(skill)), dryRun);
  }

  const vendorConfig = loadVendorConfig();
  for (const [vendorName, config] of Object.entries(vendorConfig)) {
    if (config.skills) {
      log(`Skills (vendor/${vendorName}):`);
      for (const [name, path] of Object.entries(config.skills)) {
        const target = join(VENDOR, vendorName, path);
        makeRelativeSymlink(target, join(out, "skills", name), dryRun);
      }
    }
    if (config.rules) {
      log(`Rules (vendor/${vendorName}):`);
      for (const [name, path] of Object.entries(config.rules)) {
        const target = join(VENDOR, vendorName, path);
        makeRelativeSymlink(target, join(out, "rules", name), dryRun);
      }
    }
  }

  const cmdDir = join(SRC, "cursor", "commands");
  const cmds = globByExt(cmdDir, ".md");
  if (cmds.length > 0) {
    log("Commands:");
    for (const cmd of cmds) {
      makeRelativeSymlink(cmd, join(out, "commands", basename(cmd)), dryRun);
    }
  }

  composeMcp(mcpProfile, join(out, "mcp.json"), dryRun);
}

function buildClaude(dist: string, dryRun: boolean): void {
  header(`Build ${basename(dist)}/claude/`);
  const out = join(dist, "claude");
  ensureDir(join(out, "commands"));
  ensureDir(join(out, "skills"));

  makeRelativeSymlink(
    join(SRC, "claude", "CLAUDE.md"),
    join(out, "CLAUDE.md"),
    dryRun,
  );
  makeRelativeSymlink(
    join(SRC, "claude", "settings.json"),
    join(out, "settings.json"),
    dryRun,
  );

  const cmdDir = join(SRC, "claude", "commands");
  const cmds = globByExt(cmdDir, ".md");
  if (cmds.length > 0) {
    log("Commands:");
    for (const cmd of cmds) {
      makeRelativeSymlink(cmd, join(out, "commands", basename(cmd)), dryRun);
    }
  }

  log("Skills (src):");
  for (const skill of globDirs(join(SRC, "skills"))) {
    makeRelativeSymlink(skill, join(out, "skills", basename(skill)), dryRun);
  }

  const vendorConfig = loadVendorConfig();
  for (const [vendorName, config] of Object.entries(vendorConfig)) {
    if (config.skills) {
      log(`Skills (vendor/${vendorName}):`);
      for (const [name, path] of Object.entries(config.skills)) {
        const target = join(VENDOR, vendorName, path);
        makeRelativeSymlink(target, join(out, "skills", name), dryRun);
      }
    }
  }
}

function buildOpenCode(dist: string, dryRun: boolean): void {
  header(`Build ${basename(dist)}/opencode/`);
  const out = join(dist, "opencode");
  ensureDir(join(out, "skills"));

  makeRelativeSymlink(
    join(SRC, "opencode", "opencode.json"),
    join(out, "opencode.json"),
    dryRun,
  );

  log("Skills (src):");
  for (const skill of globDirs(join(SRC, "skills"))) {
    makeRelativeSymlink(skill, join(out, "skills", basename(skill)), dryRun);
  }

  const vendorConfig = loadVendorConfig();
  for (const [vendorName, config] of Object.entries(vendorConfig)) {
    if (config.skills) {
      log(`Skills (vendor/${vendorName}):`);
      for (const [name, path] of Object.entries(config.skills)) {
        const target = join(VENDOR, vendorName, path);
        makeRelativeSymlink(target, join(out, "skills", name), dryRun);
      }
    }
  }
}

function composeMcp(
  profile: string,
  dest: string,
  dryRun: boolean,
): void {
  const profileFile = join(SRC, "mcp", "profiles", `${profile}.txt`);

  if (!existsSync(profileFile)) {
    const available = readdirSync(join(SRC, "mcp", "profiles"))
      .filter((f) => f.endsWith(".txt"))
      .map((f) => f.replace(/\.txt$/, ""));
    console.error(`Error: MCP profile '${profile}' not found`);
    console.error(`Available profiles: ${available.join(", ")}`);
    process.exit(1);
  }

  log(`MCP profile '${profile}':`);

  const servers = readFileSync(profileFile, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const mcpServers: Record<string, unknown> = {};

  for (const server of servers) {
    const serverFile = join(SRC, "mcp", "servers", `${server}.json`);
    if (!existsSync(serverFile)) {
      log(`  SKIP ${server} (no config)`);
      continue;
    }
    const config = JSON.parse(readFileSync(serverFile, "utf-8"));
    Object.assign(mcpServers, config);
    log(`  ADD ${server}`);
  }

  const output = JSON.stringify({ mcpServers }, null, 2) + "\n";

  if (dryRun) {
    log(`WOULD WRITE ${basename(dest)}`);
    return;
  }

  writeFileSync(dest, output);
  log(`WROTE ${basename(dest)}`);
}

function build(name: string, mcpProfile: string, dryRun: boolean): void {
  const dist = join(REPO_DIR, "dist", name);
  if (!dryRun) {
    wipeDist(dist);
  }
  buildCursor(dist, mcpProfile, dryRun);
  buildClaude(dist, dryRun);
  buildOpenCode(dist, dryRun);
}

// ---------------------------------------------------------------------------
// Install: dist/ -> ~/
// ---------------------------------------------------------------------------

function installTool(
  name: string,
  tool: string,
  workspace: boolean,
  dryRun: boolean,
  clean: boolean,
): void {
  const dist = join(REPO_DIR, "dist", name);
  const src = join(dist, tool);
  const targets = installTargets(workspace);
  const dest = targets[tool];
  if (!dest) {
    console.error(`Unknown tool: ${tool}`);
    return;
  }

  const scope = workspace ? "workspace" : "user";
  header(`Install ${tool} -> ${dest}/ (${scope})`);

  if (!existsSync(src)) {
    log(`SKIP (dist/${name}/${tool}/ not found; run build first)`);
    return;
  }

  installDir(src, dest, dryRun, clean);
}

function installDir(
  srcDir: string,
  destDir: string,
  dryRun: boolean,
  clean: boolean,
): void {
  ensureDir(destDir);

  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      installDir(srcPath, destPath, dryRun, clean);
      continue;
    }

    if (clean) {
      if (isSymlink(destPath)) {
        const target = readlinkSync(destPath);
        if (target.includes(REPO_DIR) || existsSync(srcPath)) {
          if (dryRun) {
            log(`WOULD REMOVE ${destPath}`);
          } else {
            unlinkSync(destPath);
            log(`REMOVED ${destPath}`);
          }
        }
      }
      continue;
    }

    if (dryRun) {
      log(`WOULD LINK ${destPath} -> ${srcPath}`);
    } else {
      if (isSymlink(destPath) || existsSync(destPath)) {
        unlinkSync(destPath);
      }
      symlinkSync(srcPath, destPath);
      log(`LINKED ${destPath}`);
    }
  }
}

function install(
  name: string,
  tools: string[],
  workspace: boolean,
  dryRun: boolean,
  clean: boolean,
): void {
  for (const tool of tools) {
    installTool(name, tool, workspace, dryRun, clean);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    command: "all",
    name: DEFAULT_NAME,
    workspace: false,
    tools: [],
    mcpProfile: "base",
    dryRun: false,
    clean: false,
  };

  const validTools = ["cursor", "claude", "opencode"];
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i]!;
    switch (arg) {
      case "build":
        opts.command = "build";
        break;
      case "install":
        opts.command = "install";
        break;
      case "cursor":
      case "claude":
      case "opencode":
        opts.tools.push(arg);
        break;
      case "all":
        opts.tools = [...validTools];
        break;
      case "--name":
        i++;
        if (i >= argv.length) {
          console.error("Error: --name requires a value");
          process.exit(1);
        }
        opts.name = argv[i]!;
        break;
      case "--mcp":
        i++;
        if (i >= argv.length) {
          console.error("Error: --mcp requires a profile name");
          process.exit(1);
        }
        opts.mcpProfile = argv[i]!;
        break;
      case "--workspace":
        opts.workspace = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--clean":
        opts.clean = true;
        break;
      case "-h":
      case "--help":
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        console.log(USAGE);
        process.exit(1);
    }
    i++;
  }

  if (opts.tools.length === 0) {
    opts.tools = [...validTools];
  }

  return opts;
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));

  ensureSubmodules();

  switch (opts.command) {
    case "build":
      build(opts.name, opts.mcpProfile, opts.dryRun);
      break;
    case "install":
      install(opts.name, opts.tools, opts.workspace, opts.dryRun, opts.clean);
      break;
    case "all":
      build(opts.name, opts.mcpProfile, opts.dryRun);
      install(opts.name, opts.tools, opts.workspace, opts.dryRun, opts.clean);
      break;
  }

  console.log("\nDone.");
}

main();
