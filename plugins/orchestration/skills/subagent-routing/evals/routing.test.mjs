import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "routing.mjs");

const roots = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

// Each test gets its own state dir, config dir and two sibling project dirs.
function sandbox() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "subagent-routing-")));
  roots.push(root);
  const dirs = {
    root,
    state: join(root, "state"),
    config: join(root, "config"),
    work: join(root, "work"),
    workOther: join(root, "work-other"),
  };
  for (const dir of Object.values(dirs)) mkdirSync(dir, { recursive: true });
  return dirs;
}

function run(dirs, args, { cwd = dirs.work, env = {} } = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      SUBAGENT_ROUTING_STATE_DIR: dirs.state,
      SUBAGENT_ROUTING_CONFIG_DIR: dirs.config,
      ...env,
    },
  });
  return {
    code: result.status,
    stderr: result.stderr,
    json: result.status === 0 ? JSON.parse(result.stdout) : null,
  };
}

// Runs a command that must succeed and returns its JSON output.
function ok(dirs, args, options) {
  const { code, stderr, json } = run(dirs, args, options);
  assert.equal(code, 0, stderr);
  return json;
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

const twoProviders = {
  small: ["github-copilot/claude-haiku-5.5", "claude-agent/haiku"],
  mid: ["openrouter/anthropic/claude-sonnet-5.5#high"],
};

test("context with no files reports a missing routing file and no shapes", () => {
  const dirs = sandbox();
  assert.deepEqual(ok(dirs, ["context"]), {
    routesStatus: "missing",
    restricted: false,
    candidates: null,
    shapes: [],
  });
});

test("an unknown command exits with code 2", () => {
  const dirs = sandbox();
  assert.equal(run(dirs, ["promote"]).code, 2);
  assert.equal(run(dirs, []).code, 2);
});

test("context lists every shape and skips ledger lines that are not JSON objects", () => {
  const dirs = sandbox();
  writeLedger(dirs, [
    batch("2026-01-05"),
    "{not json",
    "null",
    "42",
    "[]",
    batch("2026-01-06", { row: "locate", shape: "locate", charter: "Find usages" }),
    { type: "status", ts: "2026-01-07T10:00:00.000Z", shape: "locate", status: "promoted" },
    { type: "status", ts: "2026-01-07T10:00:00.000Z", shape: "sql-migration-check" },
  ]);
  const json = ok(dirs, ["context"]);
  assert.deepEqual(
    json.shapes.map((shape) => [shape.shape, shape.row, shape.batches, shape.status]),
    [
      ["sql-migration-check", "checklist", 1, null],
      ["locate", "locate", 1, "promoted"],
    ],
  );
});

test("context keeps the last five distinct charters of a shape", () => {
  const dirs = sandbox();
  const charters = ["one", "two", "two", "three", "four", "five", "six"];
  writeLedger(dirs, charters.map((charter) => batch("2026-01-05", { charter })));
  const [shape] = ok(dirs, ["context"]).shapes;
  assert.equal(shape.batches, 7);
  assert.deepEqual(shape.charters, ["two", "three", "four", "five", "six"]);
});

test("an unrestricted project gets every candidate", () => {
  const dirs = sandbox();
  writeRoutes(dirs, { version: 1, tiers: twoProviders, sameProviderOnly: [dirs.work] });
  const json = ok(dirs, ["context", "--provider", "claude-agent"], { cwd: dirs.workOther });
  assert.equal(json.routesStatus, "ok");
  assert.equal(json.restricted, false);
  assert.deepEqual(json.candidates, twoProviders);
});

test("a restricted project only gets candidates on the session provider", () => {
  const dirs = sandbox();
  writeRoutes(dirs, { version: 1, tiers: twoProviders, sameProviderOnly: [dirs.work] });
  const nested = join(dirs.work, "packages", "api");
  mkdirSync(nested, { recursive: true });
  const json = ok(dirs, ["context", "--provider", "claude-agent"], { cwd: nested });
  assert.equal(json.restricted, true);
  assert.deepEqual(json.candidates, { small: ["claude-agent/haiku"], mid: [] });
});

test("a restricted project with no provider, or an empty one, gets no candidates", () => {
  const dirs = sandbox();
  writeRoutes(dirs, { version: 1, tiers: twoProviders, sameProviderOnly: [dirs.work] });
  for (const args of [["context"], ["context", "--provider", ""]]) {
    const json = ok(dirs, args);
    assert.equal(json.restricted, true);
    assert.deepEqual(json.candidates, { small: [], mid: [] });
  }
});

test("a prefix of / restricts every project", () => {
  const dirs = sandbox();
  writeRoutes(dirs, { version: 1, tiers: twoProviders, sameProviderOnly: ["/"] });
  assert.equal(ok(dirs, ["context"]).restricted, true);
  assert.equal(ok(dirs, ["context"], { cwd: dirs.workOther }).restricted, true);
});

test("a prefix written with ~ or through a symlink matches the project", () => {
  const dirs = sandbox();
  writeRoutes(dirs, { version: 1, tiers: twoProviders, sameProviderOnly: ["~/work"] });
  assert.equal(ok(dirs, ["context"], { env: { HOME: dirs.root } }).restricted, true);
  assert.equal(ok(dirs, ["context"], { cwd: dirs.workOther, env: { HOME: dirs.root } }).restricted, false);

  const link = join(dirs.root, "link");
  symlinkSync(dirs.work, link);
  writeRoutes(dirs, { version: 1, tiers: twoProviders, sameProviderOnly: [link] });
  assert.equal(ok(dirs, ["context"]).restricted, true);
});

test("a prefix in another letter case matches on a case-insensitive filesystem", (t) => {
  const dirs = sandbox();
  const upper = join(dirs.root, "WORK");
  if (!existsSync(upper)) return t.skip("case-sensitive filesystem");
  writeRoutes(dirs, { version: 1, tiers: twoProviders, sameProviderOnly: [upper] });
  assert.equal(ok(dirs, ["context"]).restricted, true);
});

test("a routing file that is not JSON or has no tiers is invalid, with exit code 0", () => {
  const dirs = sandbox();
  for (const content of ["{ not json", { version: 1 }, { tiers: [] }, []]) {
    writeRoutes(dirs, content);
    const json = ok(dirs, ["context", "--provider", "claude-agent"]);
    assert.equal(json.routesStatus, "invalid");
    assert.equal(json.restricted, null);
    assert.equal(json.candidates, null);
  }
});

test("a routing file with a malformed restriction or reference is invalid", () => {
  const dirs = sandbox();
  const malformed = [
    { tiers: twoProviders, sameProviderOnly: dirs.work },
    { tiers: twoProviders, sameProviderOnly: [42] },
    { tiers: twoProviders, sameProviderOnly: ["work"] },
    { tiers: twoProviders, sameProviderOnly: ["$HOME/work"] },
    { tiers: twoProviders, sameProviderOnly: [""] },
    { tiers: { small: "claude-agent/haiku" } },
    { tiers: { small: ["haiku"] } },
    { tiers: { small: [42] } },
  ];
  for (const content of malformed) {
    writeRoutes(dirs, content);
    const json = ok(dirs, ["context", "--provider", "claude-agent"]);
    assert.equal(json.routesStatus, "invalid", JSON.stringify(content));
    assert.equal(json.restricted, null);
    assert.equal(json.candidates, null);
  }
});

test("a routing file that cannot be read is invalid, not missing", () => {
  const dirs = sandbox();
  mkdirSync(join(dirs.config, "routes.json"));
  const json = ok(dirs, ["context"]);
  assert.equal(json.routesStatus, "invalid");
  assert.equal(json.restricted, null);
});
