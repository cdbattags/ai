---
name: process-monitoring
description: Wait for commands and processes to complete without using sleep or polling loops in shell. Use when running any shell command that needs to wait for completion, start a dev server, or monitor a background process.
---

# Process Monitoring Without Sleep

Never use `sleep`, `for` loops with delays, or `while ! curl; do sleep` polling patterns in the Cursor Shell tool. The Shell tool has built-in mechanisms for waiting.

## Core Principle

The Shell tool's `block_until_ms` parameter IS the wait mechanism. Terminal output files ARE the monitoring mechanism. You never need to build your own waiting logic.

## Pattern 1: Terminating Commands (build, seed, install, test)

Set `block_until_ms` higher than expected runtime. The shell blocks until the command finishes or the timeout is reached.

```
# Good: block for up to 120 seconds
Shell(command="pnpm db:seed", block_until_ms=120000)

# Bad: background then sleep-poll
Shell(command="pnpm db:seed &")
Shell(command="sleep 10 && check result")
```

If the command exceeds `block_until_ms`, it moves to background automatically. Check the terminal file for the `exit_code` footer.

## Pattern 2: Long-Running Commands (dev server, watcher)

Use `block_until_ms: 0` to immediately background, then read the terminal file to check for readiness markers.

```
# Step 1: Start in background
Shell(command="pnpm dev", block_until_ms=0)
# Returns terminal file path immediately

# Step 2: Read terminal file to check if ready
Read(path="/path/to/terminal/file.txt", offset=-20)
# Look for "ready in" or "Local: http://localhost:3000"
```

### Readiness markers by tool:

| Tool | Ready marker |
|------|-------------|
| Vite | `ready in` or `Local:   http://localhost:` |
| Next.js | `Ready in` or `started server on` |
| Express/Fastify | `listening on` |
| Any build | `exit_code:` footer in terminal file |

## Pattern 3: Checking if a Background Command Finished

Read the terminal file. If finished, an `exit_code` footer appears:

```
---
exit_code: 0
elapsed_ms: 12345
ended_at: 2026-03-01T...
---
```

If still running, the header shows `running_for_seconds` (updated every 5s).

## Pattern 4: Verifying a Running Server

Instead of curl polling, just read the terminal file output:

```
# Bad:
for i in 1 2 3 4 5; do curl -sf localhost:3000 && break; sleep 2; done

# Good:
Read(path="<terminal_file>", offset=-20)
# Check for Vite's "ready in" message
```

## What NEVER to Do

- `sleep N` for any reason
- `for i in 1 2 3 ...; do ... sleep ... done`
- `while ! curl ...; do sleep ...; done`
- `timeout 30 bash -c 'until curl ...; do sleep ...; done'`

All of these waste time or risk timing out when reading the terminal file is instant and reliable.

## Decision Tree

```
Need to wait for something?
├── Is it a terminating command? (build, test, seed, install)
│   └── Set block_until_ms to expected_runtime + buffer
│       └── If it backgrounds, Read the terminal file for exit_code
├── Is it a long-running server/watcher?
│   └── Start with block_until_ms: 0
│       └── Read terminal file for readiness marker
└── Need to verify a server is up?
    └── Read the terminal file for "ready" / "listening" marker
        └── If no terminal file, use a single curl (not a loop)
```
