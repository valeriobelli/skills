#!/usr/bin/env node
// Ledger and routing-file helper for the subagent-routing skill.
// Commands: context, record, mark. Output is JSON on stdout.
// Exit codes: 0 ok, 2 bad arguments or an internal error. No dependencies.

import { readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

const CHARTERS_KEPT = 5;
const MIN_BATCHES = 3;
const MIN_DAYS = 2;
// A UTC timestamp as written by Date.prototype.toISOString.
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T.*Z$/;
// "provider/model" with an optional "#variant"; the provider ends at the first "/".
const REFERENCE = /^[^/#\s]+\/[^#\s]+(#\S+)?$/;

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

function expandHome(path) {
  return path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path;
}

function isUnder(root, path) {
  const rest = relative(root, path);
  return rest === "" || (rest !== ".." && !rest.startsWith(`..${sep}`) && !isAbsolute(rest));
}

// Strict on purpose: a routing file that is only partly understood must not be
// used, because a restriction that is silently dropped sends code to a provider
// the user excluded.
function isValidRoutes(routes) {
  if (!isPlainObject(routes) || !isPlainObject(routes.tiers)) return false;
  const tiersValid = Object.values(routes.tiers).every(
    (references) =>
      Array.isArray(references) &&
      references.every((reference) => typeof reference === "string" && REFERENCE.test(reference)),
  );
  const prefixes = routes.sameProviderOnly ?? [];
  const prefixesValid =
    Array.isArray(prefixes) &&
    prefixes.every((prefix) => typeof prefix === "string" && isAbsolute(expandHome(prefix)));
  return tiersValid && prefixesValid;
}

// Returns { status: "ok" | "missing" | "invalid", routes }.
function readRoutes() {
  let text;
  try {
    text = readFileSync(routesPath(), "utf8");
  } catch (error) {
    return { status: error.code === "ENOENT" ? "missing" : "invalid", routes: null };
  }
  try {
    const routes = JSON.parse(text);
    return isValidRoutes(routes) ? { status: "ok", routes } : { status: "invalid", routes: null };
  } catch {
    return { status: "invalid", routes: null };
  }
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
  const { status, routes } = readRoutes();
  // With an invalid routing file the restriction is unknown, not absent.
  let restricted = status === "invalid" ? null : false;
  if (routes) restricted = isRestricted(routes, realPath(process.cwd()));
  print({
    routesStatus: status,
    restricted,
    candidates: routes ? candidatesFor(routes, restricted, values.provider) : null,
    shapes: summarize(readLedger()),
  });
}

const commands = { context };
const [command, ...rest] = process.argv.slice(2);
if (!Object.hasOwn(commands, command)) fail("usage: routing.mjs <context> [options]");
try {
  commands[command](rest);
} catch (error) {
  fail(error.message);
}
