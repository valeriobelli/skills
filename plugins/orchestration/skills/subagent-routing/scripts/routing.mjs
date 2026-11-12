#!/usr/bin/env node
// Ledger and routing-file helper for the subagent-routing skill.
// Commands: context, record, mark. Output is JSON on stdout.
// Exit codes: 0 ok, 2 bad arguments. No dependencies.

import { readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

const CHARTERS_KEPT = 5;
const MIN_BATCHES = 3;
const MIN_DAYS = 2;

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

function realPath(path) {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function expandHome(path) {
  return path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path;
}

// Returns { status: "ok" | "missing" | "invalid", routes }.
function readRoutes() {
  let text;
  try {
    text = readFileSync(routesPath(), "utf8");
  } catch {
    return { status: "missing", routes: null };
  }
  try {
    const routes = JSON.parse(text);
    const valid =
      routes !== null &&
      typeof routes === "object" &&
      !Array.isArray(routes) &&
      routes.tiers !== null &&
      typeof routes.tiers === "object" &&
      !Array.isArray(routes.tiers);
    return valid ? { status: "ok", routes } : { status: "invalid", routes: null };
  } catch {
    return { status: "invalid", routes: null };
  }
}

function isRestricted(routes, cwd) {
  const prefixes = Array.isArray(routes.sameProviderOnly) ? routes.sameProviderOnly : [];
  return prefixes
    .filter((prefix) => typeof prefix === "string")
    .some((prefix) => {
      const root = realPath(expandHome(prefix));
      return cwd === root || cwd.startsWith(root + sep);
    });
}

// A model reference is "provider/model#variant"; the provider ends at the first "/".
function providerOf(reference) {
  return reference.split("/")[0];
}

// In a restricted project only the session's provider is eligible. With no
// provider given, nothing is: the rule fails closed.
function candidatesFor(routes, restricted, provider) {
  const candidates = {};
  for (const [tier, references] of Object.entries(routes.tiers)) {
    const list = Array.isArray(references)
      ? references.filter((reference) => typeof reference === "string")
      : [];
    candidates[tier] = restricted
      ? list.filter((reference) => providerOf(reference) === provider)
      : list;
  }
  return candidates;
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
    });
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
      shape.row = entry.row ?? shape.row;
      shape.batches += 1;
      if (typeof entry.ts === "string") shape.days.add(entry.ts.slice(0, 10));
      if (typeof entry.project === "string") shape.projects.add(entry.project);
      if (entry.charter && !shape.charters.includes(entry.charter)) {
        shape.charters.push(entry.charter);
      }
    }
    if (entry.type === "status") shape.status = entry.status;
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
  const restricted = routes ? isRestricted(routes, process.cwd()) : false;
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
