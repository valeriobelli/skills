import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "routing.mjs");

// Each test gets its own state dir, config dir and two sibling project dirs.
function sandbox() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "subagent-routing-")));
  const dirs = {
    state: join(root, "state"),
    config: join(root, "config"),
    work: join(root, "work"),
    workOther: join(root, "work-other"),
  };
  for (const dir of Object.values(dirs)) mkdirSync(dir, { recursive: true });
  return dirs;
}

function run(dirs, args, cwd = dirs.work) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      SUBAGENT_ROUTING_STATE_DIR: dirs.state,
      SUBAGENT_ROUTING_CONFIG_DIR: dirs.config,
    },
  });
  return {
    code: result.status,
    stderr: result.stderr,
    json: result.status === 0 ? JSON.parse(result.stdout) : null,
  };
}

function ledgerLines(dirs) {
  try {
    return readFileSync(join(dirs.state, "ledger.jsonl"), "utf8").split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function writeLedger(dirs, entries) {
  writeFileSync(
    join(dirs.state, "ledger.jsonl"),
    entries.map((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry))).join("\n") + "\n",
  );
}

function writeRoutes(dirs, content) {
  writeFileSync(
    join(dirs.config, "routes.json"),
    typeof content === "string" ? content : JSON.stringify(content),
  );
}

function batch(day, overrides = {}) {
  return {
    type: "batch",
    ts: `${day}T10:00:00.000Z`,
    project: "/projects/a",
    tool: "opencode",
    row: "checklist",
    shape: "sql-migration-check",
    tier: "small",
    model: "claude-agent/haiku",
    count: 1,
    charter: "Check a migration against the locking checklist",
    ...overrides,
  };
}

test("context with no files reports a missing routing file and no shapes", () => {
  const dirs = sandbox();
  const { code, json } = run(dirs, ["context"]);
  assert.equal(code, 0);
  assert.deepEqual(json, { routesStatus: "missing", restricted: false, candidates: null, shapes: [] });
});

test("an unknown command exits with code 2", () => {
  const dirs = sandbox();
  assert.equal(run(dirs, ["promote"]).code, 2);
  assert.equal(run(dirs, []).code, 2);
});

test("context lists every shape and skips corrupt ledger lines", () => {
  const dirs = sandbox();
  writeLedger(dirs, [
    batch("2026-01-05"),
    "{not json",
    batch("2026-01-06", { row: "locate", shape: "locate", charter: "Find usages" }),
    { type: "status", ts: "2026-01-07T10:00:00.000Z", shape: "locate", status: "promoted" },
  ]);
  const { json } = run(dirs, ["context"]);
  assert.deepEqual(
    json.shapes.map((shape) => [shape.shape, shape.row, shape.batches, shape.status]),
    [
      ["sql-migration-check", "checklist", 1, null],
      ["locate", "locate", 1, "promoted"],
    ],
  );
});

test("an unrestricted project gets every candidate", () => {
  const dirs = sandbox();
  writeRoutes(dirs, {
    version: 1,
    tiers: { small: ["claude-agent/haiku", "github-copilot/claude-haiku-5.5"], mid: ["claude-agent/sonnet"] },
    sameProviderOnly: [dirs.work],
  });
  const { json } = run(dirs, ["context", "--provider", "claude-agent"], dirs.workOther);
  assert.equal(json.routesStatus, "ok");
  assert.equal(json.restricted, false);
  assert.deepEqual(json.candidates, {
    small: ["claude-agent/haiku", "github-copilot/claude-haiku-5.5"],
    mid: ["claude-agent/sonnet"],
  });
});

test("a restricted project only gets candidates on the session provider", () => {
  const dirs = sandbox();
  writeRoutes(dirs, {
    version: 1,
    tiers: { small: ["github-copilot/claude-haiku-5.5", "claude-agent/haiku"], mid: ["openrouter/anthropic/claude-sonnet-5.5"] },
    sameProviderOnly: [dirs.work],
  });
  const nested = join(dirs.work, "packages", "api");
  mkdirSync(nested, { recursive: true });
  const { json } = run(dirs, ["context", "--provider", "claude-agent"], nested);
  assert.equal(json.restricted, true);
  assert.deepEqual(json.candidates, { small: ["claude-agent/haiku"], mid: [] });
});

test("a restricted project with no provider given gets no candidates", () => {
  const dirs = sandbox();
  writeRoutes(dirs, { version: 1, tiers: { small: ["claude-agent/haiku"] }, sameProviderOnly: [dirs.work] });
  const { json } = run(dirs, ["context"]);
  assert.equal(json.restricted, true);
  assert.deepEqual(json.candidates, { small: [] });
});

test("a malformed routing file is reported as invalid with exit code 0", () => {
  const dirs = sandbox();
  writeRoutes(dirs, "{ not json");
  const broken = run(dirs, ["context"]);
  assert.equal(broken.code, 0);
  assert.equal(broken.json.routesStatus, "invalid");
  assert.equal(broken.json.candidates, null);
  writeRoutes(dirs, { version: 1 });
  assert.equal(run(dirs, ["context"]).json.routesStatus, "invalid");
});
