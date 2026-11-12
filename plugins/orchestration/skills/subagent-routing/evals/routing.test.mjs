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
    routesProblem: null,
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
  assert.equal(json.routesProblem, null);
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

  // With no usable home directory, ~ cannot be resolved, so the file is rejected.
  assert.equal(ok(dirs, ["context"], { env: { HOME: "" } }).routesStatus, "invalid");

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
    assert.equal(typeof json.routesProblem, "string");
    assert.equal(json.restricted, null);
    assert.equal(json.candidates, null);
  }
});

test("a routing file with a malformed restriction, reference or key is invalid", () => {
  const dirs = sandbox();
  const malformed = [
    { tiers: twoProviders, SameProviderOnly: [dirs.work] },
    { tiers: twoProviders, sameProviderOnly: null },
    { tiers: twoProviders, version: 2 },
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
    assert.equal(typeof json.routesProblem, "string");
    assert.equal(json.restricted, null);
    assert.equal(json.candidates, null);
  }
});

test("a routing file that cannot be read is invalid, not missing", () => {
  const dirs = sandbox();
  mkdirSync(join(dirs.config, "routes.json"));
  const json = ok(dirs, ["context"]);
  assert.equal(json.routesStatus, "invalid");
  assert.match(json.routesProblem, /cannot be read/);
  assert.equal(json.restricted, null);
});

const recordArgs = [
  "record",
  "--row", "checklist",
  "--shape", "sql-migration-check",
  "--tier", "small",
  "--model", "claude-agent/haiku",
  "--count", "3",
  "--charter", "Check a migration against the locking checklist",
  "--tool", "opencode",
];

test("record appends one batch entry", () => {
  const dirs = sandbox();
  assert.equal(ok(dirs, recordArgs).recorded, true);
  const lines = ledgerLines(dirs);
  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.type, "batch");
  assert.equal(entry.project, dirs.work);
  assert.equal(entry.row, "checklist");
  assert.equal(entry.shape, "sql-migration-check");
  assert.equal(entry.tier, "small");
  assert.equal(entry.model, "claude-agent/haiku");
  assert.equal(entry.count, 3);
  assert.equal(entry.tool, "opencode");
  assert.match(entry.ts, /^\d{4}-\d{2}-\d{2}T.*Z$/);
});

test("record creates the state directory and keeps one entry per line", () => {
  const dirs = sandbox();
  rmSync(dirs.state, { recursive: true });
  ok(dirs, recordArgs);
  const json = ok(dirs, recordArgs);
  assert.equal(json.shape.batches, 2);
  assert.deepEqual(
    ledgerLines(dirs).map((line) => JSON.parse(line).shape),
    ["sql-migration-check", "sql-migration-check"],
  );
});

test("record starts a new line when the ledger has lost its final newline", () => {
  const dirs = sandbox();
  writeFileSync(
    join(dirs.state, "ledger.jsonl"),
    [batch("2026-01-05"), batch("2026-01-06")].map((entry) => JSON.stringify(entry)).join("\n"),
  );
  const json = ok(dirs, recordArgs);
  assert.equal(ledgerLines(dirs).length, 3);
  assert.equal(json.shape.batches, 3);
  assert.equal(json.promote, true);
});

test("record trims, flattens and truncates the charter", () => {
  const dirs = sandbox();
  const long = `  first line\nsecond   line ${"x".repeat(300)}  `;
  ok(dirs, ["record", "--row", "extract", "--shape", "extract", "--tier", "inherit", "--tool", "opencode", "--charter", long]);
  const entry = JSON.parse(ledgerLines(dirs)[0]);
  assert.equal(entry.charter.length, 200);
  assert.ok(entry.charter.startsWith("first line second line x"));
});

test("record stores a null model for an inherited batch", () => {
  const dirs = sandbox();
  ok(dirs, ["record", "--row", "explain", "--shape", "explain", "--tier", "inherit", "--model", "ignored/model", "--tool", "claude-code"]);
  const entry = JSON.parse(ledgerLines(dirs)[0]);
  assert.equal(entry.model, null);
  assert.equal(entry.count, 1);
  assert.equal(entry.charter, "");
});

test("record accepts a model alias for claude-code and a reference for opencode", () => {
  const dirs = sandbox();
  const base = ["record", "--row", "extract", "--shape", "extract", "--tier", "small"];
  ok(dirs, [...base, "--tool", "claude-code", "--model", "haiku"]);
  ok(dirs, [...base, "--tool", "opencode", "--model", "openrouter/anthropic/claude-haiku-5.5#low"]);
  assert.deepEqual(
    ledgerLines(dirs).map((line) => JSON.parse(line).model),
    ["haiku", "openrouter/anthropic/claude-haiku-5.5#low"],
  );
});

test("record rejects bad arguments and writes nothing", () => {
  const dirs = sandbox();
  const valid = ["--row", "extract", "--shape", "extract", "--tier", "small", "--model", "claude-agent/haiku", "--tool", "opencode"];
  // A later occurrence of a flag wins, so each case overrides one valid value.
  const rejected = [
    [["--tier", "large"], /--tier must be one of/],
    [["--shape", "Not Kebab"], /--shape must be kebab-case/],
    [["--row", "Not Kebab"], /--row must be a kebab-case rubric row/],
    [["--tool", "cursor"], /--tool must be one of/],
    [["--count", "0"], /--count must be a whole number/],
    [["--count", "1.5"], /--count must be a whole number/],
    [["--count", "abc"], /--count must be a whole number/],
    [["--model", "haiku"], /--model must be/],
    [["--model", ""], /--model must be/],
    [["--model", `claude-agent/${"x".repeat(300)}`], /--model must be/],
    [["--tool", "claude-code"], /--model must be/],
  ];
  for (const [override, message] of rejected) {
    const { code, stderr } = run(dirs, ["record", ...valid, ...override]);
    assert.equal(code, 2, override.join(" "));
    assert.match(stderr, message);
  }
  const missingRow = run(dirs, ["record", ...valid.slice(2)]);
  assert.equal(missingRow.code, 2);
  assert.match(missingRow.stderr, /--row must be/);
  const missingModel = run(dirs, ["record", "--row", "extract", "--shape", "extract", "--tier", "small", "--tool", "opencode"]);
  assert.equal(missingModel.code, 2);
  assert.match(missingModel.stderr, /--model must be/);
  assert.equal(ledgerLines(dirs).length, 0);
});

test("three batches on one day do not meet the threshold", () => {
  const dirs = sandbox();
  const today = new Date().toISOString().slice(0, 10);
  writeLedger(dirs, [batch(today), batch(today)]);
  const json = ok(dirs, recordArgs);
  assert.equal(json.shape.batches, 3);
  assert.equal(json.shape.days, 1);
  assert.equal(json.promote, false);
});

test("three batches on two days meet the threshold", () => {
  const dirs = sandbox();
  writeLedger(dirs, [batch("2026-01-05"), batch("2026-01-05", { project: "/projects/b" })]);
  const json = ok(dirs, recordArgs);
  assert.equal(json.shape.batches, 3);
  assert.equal(json.shape.days, 2);
  assert.equal(json.promote, true);
  assert.deepEqual(json.shape.projects, ["/projects/a", "/projects/b", dirs.work]);
  assert.deepEqual(json.shape.charters, ["Check a migration against the locking checklist"]);
});

test("two batches on two days do not meet the threshold", () => {
  const dirs = sandbox();
  writeLedger(dirs, [batch("2026-01-05")]);
  const json = ok(dirs, recordArgs);
  assert.equal(json.shape.batches, 2);
  assert.equal(json.shape.days, 2);
  assert.equal(json.promote, false);
});

test("a shape with a status is not proposed again", () => {
  const dirs = sandbox();
  writeLedger(dirs, [
    batch("2026-01-05"),
    batch("2026-01-06"),
    batch("2026-01-07"),
    { type: "status", ts: "2026-01-08T10:00:00.000Z", shape: "sql-migration-check", status: "declined" },
  ]);
  const json = ok(dirs, recordArgs);
  assert.equal(json.shape.batches, 4);
  assert.equal(json.shape.status, "declined");
  assert.equal(json.promote, false);
});
