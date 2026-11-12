// Ledger and routing-file helper for the subagent-routing skill.
// Run it with node: `node routing.mjs <command>`.
// Commands: context, record, mark. Output is JSON on stdout.
// Exit codes: 0 ok, 2 bad arguments or an internal error. No dependencies.

import { appendFileSync, chmodSync, mkdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

const CHARTER_MAX = 200;
const CHARTERS_KEPT = 5;
const MIN_BATCHES = 3;
const MIN_DAYS = 2;
const MODEL_MAX = 200;
const TIERS = ["small", "mid", "inherit"];
const TOOLS = ["claude-code", "opencode"];
const STATUSES = ["promoted", "declined"];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// A Claude Code model alias such as "haiku".
const ALIAS = /^[a-z0-9][a-z0-9.-]*$/;
// A UTC timestamp as written by Date.prototype.toISOString.
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T.*Z$/;
// "provider/model" with an optional "#variant"; the provider ends at the first "/".
// No whitespace or control characters anywhere.
const REFERENCE = /^[^/#\s\p{Cc}]+\/[^#\s\p{Cc}]+(#[^\s\p{Cc}]+)?$/u;
const ROUTES_KEYS = ["version", "tiers", "sameProviderOnly"];
// "large" is never a target; it only tells the agent which session models are large.
const ROUTES_TIERS = ["small", "mid", "large"];
const NAME_MAX = 40;

const env = process.env;

function fail(message) {
  process.stderr.write(`routing: ${message}\n`);
  process.exit(2);
}

// A relative directory would be resolved against the working directory, which
// would let a repository supply its own routing file or ledger.
function absolute(dir, what) {
  if (!isAbsolute(dir)) fail(`the ${what} directory is not an absolute path; is HOME set?`);
  return dir;
}

function routesPath() {
  const dir =
    env.SUBAGENT_ROUTING_CONFIG_DIR ||
    join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "subagent-routing");
  return join(absolute(dir, "config"), "routes.json");
}

function ledgerPath() {
  const dir =
    env.SUBAGENT_ROUTING_STATE_DIR ||
    join(env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "subagent-routing");
  return join(absolute(dir, "state"), "ledger.jsonl");
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
  // Names from the file are shortened before they are echoed to the agent.
  const short = (name) => (name.length > NAME_MAX ? `${name.slice(0, NAME_MAX)}...` : name);
  if (!isPlainObject(routes)) return "the file must hold a JSON object";
  const unknown = Object.keys(routes).find((key) => !ROUTES_KEYS.includes(key));
  if (unknown !== undefined) return `unknown key "${short(unknown)}"`;
  if (routes.version !== undefined && routes.version !== 1) return '"version" must be 1';
  if (!isPlainObject(routes.tiers)) return '"tiers" must be an object';
  for (const [tier, references] of Object.entries(routes.tiers)) {
    if (!ROUTES_TIERS.includes(tier)) return `unknown tier "${short(tier)}"`;
    const valid =
      Array.isArray(references) &&
      references.every((reference) => typeof reference === "string" && REFERENCE.test(reference));
    if (!valid) return `tier "${short(tier)}" must be a list of provider/model references`;
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

// The ledger holds project paths, so it is readable by its owner only.
function append(entry) {
  const path = ledgerPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  // The mode below applies only to a new file, so a ledger that was copied or
  // restored keeps its own. Remove the access of other users before writing.
  try {
    chmodSync(path, statSync(path).mode & 0o700);
  } catch {
    // No ledger yet.
  }
  let existing = "";
  try {
    existing = readFileSync(path, "utf8");
  } catch {
    // No ledger yet.
  }
  // A ledger that lost its final newline would get this entry glued onto its
  // last line, and neither entry could be read back.
  const separator = existing === "" || existing.endsWith("\n") ? "" : "\n";
  appendFileSync(path, `${separator}${JSON.stringify(entry)}\n`, { mode: 0o600 });
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
    // Any status string turns promotion off, including one that a newer
    // version of this script may add. The last one wins.
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
    // A shape named after its row is the catch-all for one-off delegations.
    // Its batches have nothing in common, so there is no agent to pin.
    promote:
      shape.batches >= MIN_BATCHES &&
      shape.days.size >= MIN_DAYS &&
      shape.status === null &&
      shape.shape !== shape.row,
  }));
}

function context(args) {
  const { values } = parseArgs({ args, options: { provider: { type: "string" } } });
  const { status, problem, routes } = readRoutes();
  // With an invalid routing file the restriction is unknown, not absent.
  let restricted = status === "invalid" ? null : false;
  if (routes) restricted = isRestricted(routes, realPath(process.cwd()));
  // Whether any project at all is restricted: null when that is unknown.
  let hasRestrictions = status === "invalid" ? null : false;
  if (routes) hasRestrictions = (routes.sameProviderOnly ?? []).length > 0;
  print({
    routesStatus: status,
    routesProblem: problem,
    restricted,
    hasRestrictions,
    candidates: routes ? candidatesFor(routes, restricted, values.provider) : null,
    shapes: summarize(readLedger()),
  });
}

// Reads one shape's summary back from the ledger.
function findShape(name) {
  return summarize(readLedger()).find((shape) => shape.shape === name);
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
  if (!/^[1-9]\d{0,3}$/.test(values.count)) fail("--count must be a whole number from 1 to 9999");
  const inherit = values.tier === "inherit";
  if (!inherit) {
    const pattern = values.tool === "opencode" ? REFERENCE : ALIAS;
    const valid = values.model && values.model.length <= MODEL_MAX && pattern.test(values.model);
    if (!valid) {
      fail("--model must be a provider/model reference (opencode) or a model alias (claude-code)");
    }
  }
  // Cut by code point, so that a character outside the basic plane is never split.
  const charter = [...values.charter.replace(/\s+/g, " ").trim()]
    .slice(0, CHARTER_MAX)
    .join("")
    .trimEnd();

  append({
    type: "batch",
    ts: new Date().toISOString(),
    project: process.cwd(),
    tool: values.tool,
    row: values.row,
    shape: values.shape,
    tier: values.tier,
    model: inherit ? null : values.model,
    count: Number(values.count),
    charter,
  });

  const shape = findShape(values.shape);
  if (!shape) fail("the batch was written, but the ledger cannot be read back");
  print({ recorded: true, promote: shape.promote, shape });
}

// A later mark replaces an earlier one. There is no way to clear a status.
function mark(args) {
  const { values } = parseArgs({
    args,
    options: { shape: { type: "string" }, status: { type: "string" } },
  });
  if (!values.shape || !KEBAB.test(values.shape)) fail("--shape must be kebab-case");
  if (!STATUSES.includes(values.status)) fail(`--status must be one of ${STATUSES.join(", ")}`);
  // A shape name that was never recorded is a mistake: marking it would leave
  // the real shape proposing and add a shape that cannot be removed.
  if (!findShape(values.shape)?.batches) {
    fail(`--shape ${values.shape} has no recorded batches, or the ledger cannot be read`);
  }

  append({
    type: "status",
    ts: new Date().toISOString(),
    shape: values.shape,
    status: values.status,
  });

  print({ marked: true, shape: findShape(values.shape) });
}

const commands = { context, record, mark };
const [command, ...rest] = process.argv.slice(2);
if (!Object.hasOwn(commands, command)) fail("usage: routing.mjs <context|record|mark> [options]");
try {
  commands[command](rest);
} catch (error) {
  fail(error.message);
}
