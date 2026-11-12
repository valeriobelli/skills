#!/usr/bin/env node
// Ledger and routing-file helper for the subagent-routing skill.
// Commands: context, record, mark. Output is JSON on stdout.
// Exit codes: 0 ok, 2 bad arguments or an internal error. No dependencies.

import { appendFileSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

const CHARTER_MAX = 200;
const CHARTERS_KEPT = 5;
const MIN_BATCHES = 3;
const MIN_DAYS = 2;
const TIERS = ["small", "mid", "inherit"];
const TOOLS = ["claude-code", "opencode"];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// A UTC timestamp as written by Date.prototype.toISOString.
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T.*Z$/;
// "provider/model" with an optional "#variant"; the provider ends at the first "/".
const REFERENCE = /^[^/#\s]+\/[^#\s]+(#\S+)?$/;
const ROUTES_KEYS = ["version", "tiers", "sameProviderOnly"];

const env = process.env;

function routesPath() {
  const dir =
    env.SUBAGENT_ROUTING_CONFIG_DIR ||
    join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "subagent-routing");
  return join(dir, "routes.json");
}

function ledgerPath() {
  const dir =
    env.SUBAGENT_ROUTING_STATE_DIR ||
    join(env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "subagent-routing");
  return join(dir, "ledger.jsonl");
}

function fail(message) {
  process.stderr.write(`routing: ${message}\n`);
  process.exit(2);
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// The native variant also resolves letter case on case-insensitive filesystems.
function realPath(path) {
  try {
    return realpathSync.native(path);
  } catch {
    return resolve(path);
  }
}

// Leaves the path alone when there is no usable home directory, so that the
// caller sees a path that is not absolute.
function expandHome(path) {
  const home = homedir();
  const startsAtHome = path === "~" || path.startsWith("~/");
  return startsAtHome && isAbsolute(home) ? join(home, path.slice(1)) : path;
}

function isUnder(root, path) {
  const rest = relative(root, path);
  return rest === "" || (rest !== ".." && !rest.startsWith(`..${sep}`) && !isAbsolute(rest));
}

// Returns the reason a routing file cannot be used, or null when it is valid.
// Strict on purpose: a file that is only partly understood must not be used,
// because a restriction that is silently dropped (a misspelled key, a relative
// path) sends code to a provider the user excluded.
function routesProblem(routes) {
  if (!isPlainObject(routes)) return "the file must hold a JSON object";
  const unknown = Object.keys(routes).find((key) => !ROUTES_KEYS.includes(key));
  if (unknown !== undefined) return `unknown key "${unknown}"`;
  if (routes.version !== undefined && routes.version !== 1) return '"version" must be 1';
  if (!isPlainObject(routes.tiers)) return '"tiers" must be an object';
  for (const [tier, references] of Object.entries(routes.tiers)) {
    const valid =
      Array.isArray(references) &&
      references.every((reference) => typeof reference === "string" && REFERENCE.test(reference));
    if (!valid) return `tier "${tier}" must be a list of provider/model references`;
  }
  const prefixes = routes.sameProviderOnly;
  const prefixesValid =
    prefixes === undefined ||
    (Array.isArray(prefixes) &&
      prefixes.every((prefix) => typeof prefix === "string" && isAbsolute(expandHome(prefix))));
  if (!prefixesValid) {
    return '"sameProviderOnly" must be a list of absolute paths or paths that start with ~/';
  }
  return null;
}

// Returns { status: "ok" | "missing" | "invalid", problem, routes }.
function readRoutes() {
  const invalid = (problem) => ({ status: "invalid", problem, routes: null });
  let text;
  try {
    text = readFileSync(routesPath(), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { status: "missing", problem: null, routes: null };
    return invalid(`the file cannot be read (${error.code})`);
  }
  let routes;
  try {
    routes = JSON.parse(text);
  } catch {
    return invalid("the file is not valid JSON");
  }
  const problem = routesProblem(routes);
  return problem ? invalid(problem) : { status: "ok", problem: null, routes };
}

function isRestricted(routes, cwd) {
  return (routes.sameProviderOnly ?? []).some((prefix) =>
    isUnder(realPath(expandHome(prefix)), cwd),
  );
}

function providerOf(reference) {
  return reference.split("/")[0];
}

// In a restricted project only the session's provider is eligible. With no
// provider given, nothing is: the rule fails closed.
function candidatesFor(routes, restricted, provider) {
  return Object.fromEntries(
    Object.entries(routes.tiers).map(([tier, references]) => [
      tier,
      restricted
        ? references.filter((reference) => Boolean(provider) && providerOf(reference) === provider)
        : references,
    ]),
  );
}

function readLedger() {
  let text;
  try {
    text = readFileSync(ledgerPath(), "utf8");
  } catch {
    return [];
  }
  return text
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    })
    .filter(isPlainObject);
}

function append(entry) {
  mkdirSync(dirname(ledgerPath()), { recursive: true });
  appendFileSync(ledgerPath(), `${JSON.stringify(entry)}\n`);
}

function summarize(entries) {
  const shapes = new Map();
  for (const entry of entries) {
    if (typeof entry.shape !== "string") continue;
    const shape = shapes.get(entry.shape) ?? {
      shape: entry.shape,
      row: null,
      batches: 0,
      days: new Set(),
      projects: new Set(),
      status: null,
      charters: [],
    };
    if (entry.type === "batch") {
      shape.batches += 1;
      if (typeof entry.row === "string") shape.row = entry.row;
      if (typeof entry.ts === "string" && UTC_TIMESTAMP.test(entry.ts)) {
        shape.days.add(entry.ts.slice(0, 10));
      }
      if (typeof entry.project === "string") shape.projects.add(entry.project);
      if (typeof entry.charter === "string" && entry.charter && !shape.charters.includes(entry.charter)) {
        shape.charters.push(entry.charter);
      }
    }
    if (entry.type === "status" && typeof entry.status === "string") shape.status = entry.status;
    shapes.set(entry.shape, shape);
  }
  return [...shapes.values()].map((shape) => ({
    shape: shape.shape,
    row: shape.row,
    batches: shape.batches,
    days: shape.days.size,
    projects: [...shape.projects],
    status: shape.status,
    charters: shape.charters.slice(-CHARTERS_KEPT),
    promote:
      shape.batches >= MIN_BATCHES && shape.days.size >= MIN_DAYS && shape.status === null,
  }));
}

function context(args) {
  const { values } = parseArgs({ args, options: { provider: { type: "string" } } });
  const { status, problem, routes } = readRoutes();
  // With an invalid routing file the restriction is unknown, not absent.
  let restricted = status === "invalid" ? null : false;
  if (routes) restricted = isRestricted(routes, realPath(process.cwd()));
  print({
    routesStatus: status,
    routesProblem: problem,
    restricted,
    candidates: routes ? candidatesFor(routes, restricted, values.provider) : null,
    shapes: summarize(readLedger()),
  });
}

function record(args) {
  const { values } = parseArgs({
    args,
    options: {
      row: { type: "string" },
      shape: { type: "string" },
      tier: { type: "string" },
      model: { type: "string" },
      count: { type: "string", default: "1" },
      charter: { type: "string", default: "" },
      tool: { type: "string" },
    },
  });
  if (!values.row || !KEBAB.test(values.row)) fail("--row must be a kebab-case rubric row");
  if (!values.shape || !KEBAB.test(values.shape)) fail("--shape must be kebab-case");
  if (!TIERS.includes(values.tier)) fail(`--tier must be one of ${TIERS.join(", ")}`);
  if (!TOOLS.includes(values.tool)) fail(`--tool must be one of ${TOOLS.join(", ")}`);
  const count = Number(values.count);
  if (!Number.isInteger(count) || count < 1) fail("--count must be a positive integer");

  append({
    type: "batch",
    ts: new Date().toISOString(),
    project: process.cwd(),
    tool: values.tool,
    row: values.row,
    shape: values.shape,
    tier: values.tier,
    model: values.tier === "inherit" ? null : (values.model ?? null),
    count,
    charter: values.charter.replace(/\s+/g, " ").trim().slice(0, CHARTER_MAX),
  });

  const shape = summarize(readLedger()).find((item) => item.shape === values.shape);
  print({ recorded: true, promote: shape.promote, shape });
}

const commands = { context, record };
const [command, ...rest] = process.argv.slice(2);
if (!Object.hasOwn(commands, command)) fail("usage: routing.mjs <context|record> [options]");
try {
  commands[command](rest);
} catch (error) {
  fail(error.message);
}
