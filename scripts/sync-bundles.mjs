#!/usr/bin/env node
// Regenerate the Claude Code plugin mirror from the canonical skills/ tree.
//
// Source of truth (hand-edited):
//   - skills/<name>/           canonical, open-standard skills
//   - bundles.json             which skills belong to which themed bundle
//
// Generated (DO NOT EDIT BY HAND — this script owns them):
//   - .claude-plugin/marketplace.json
//   - plugins/<bundle>/.claude-plugin/plugin.json
//   - plugins/<bundle>/skills/<name>/**   (byte-for-byte copy of skills/<name>/)
//
// Why the mirror exists: claude.ai scopes a plugin's skills by scanning
// <source>/skills/ and ignores the marketplace `skills` filter array, so each
// bundle needs its own source subtree. The CLIs (npx skills, Copilot, OpenCode)
// keep reading the flat canonical skills/ instead.
//
// Usage:
//   node scripts/sync-bundles.mjs           regenerate the mirror
//   node scripts/sync-bundles.mjs --check    verify the mirror is in sync (CI); exit 1 if not

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const die = (msg) => {
  console.error(`sync-bundles: ${msg}`);
  process.exit(1);
};

// ---- read + validate inputs -------------------------------------------------

const bundlesPath = path.join(ROOT, "bundles.json");
if (!fs.existsSync(bundlesPath)) die("bundles.json not found at repo root");

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(bundlesPath, "utf8"));
} catch (e) {
  die(`bundles.json is not valid JSON: ${e.message}`);
}

const { marketplace, bundles } = manifest;
if (!marketplace?.name) die("bundles.json: marketplace.name is required");
if (!Array.isArray(bundles) || bundles.length === 0) die("bundles.json: bundles[] must be a non-empty array");

const readFrontmatterName = (skillMd) => {
  const text = fs.readFileSync(skillMd, "utf8");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const nameLine = m[1].split(/\r?\n/).find((l) => /^name\s*:/.test(l));
  return nameLine ? nameLine.replace(/^name\s*:\s*/, "").trim().replace(/^["']|["']$/g, "") : null;
};

// Validate every referenced skill exists and its frontmatter name matches its folder.
const seen = new Set();
for (const b of bundles) {
  if (!b.name) die("a bundle is missing `name`");
  if (!Array.isArray(b.skills) || b.skills.length === 0) die(`bundle "${b.name}" must list at least one skill`);
  for (const skill of b.skills) {
    const skillMd = path.join(ROOT, "skills", skill, "SKILL.md");
    if (!fs.existsSync(skillMd)) die(`bundle "${b.name}" references skills/${skill}, but skills/${skill}/SKILL.md is missing`);
    const fmName = readFrontmatterName(skillMd);
    if (fmName && fmName !== skill) die(`skills/${skill}/SKILL.md frontmatter name "${fmName}" must equal its folder name "${skill}"`);
    seen.add(skill);
  }
}
// Warn (don't fail) about canonical skills that no bundle ships — they still install via npx.
for (const entry of fs.readdirSync(path.join(ROOT, "skills"), { withFileTypes: true })) {
  if (entry.isDirectory() && !seen.has(entry.name)) {
    console.warn(`sync-bundles: note — skills/${entry.name} is in no bundle (fine for npx, absent from the Claude marketplace)`);
  }
}

// ---- build the desired generated tree (in memory) ---------------------------

const jsonText = (obj) => JSON.stringify(obj, null, 2) + "\n";

// desired: relPath -> { text } for generated JSON, or { copyFrom } for byte copies
const desired = new Map();

desired.set(
  path.join(".claude-plugin", "marketplace.json"),
  {
    text: jsonText({
      name: marketplace.name,
      owner: marketplace.owner ?? { name: "" },
      metadata: marketplace.metadata ?? {},
      plugins: bundles.map((b) => ({
        name: b.name,
        description: b.description ?? "",
        source: `./plugins/${b.name}`,
        strict: false,
        version: b.version ?? "0.1.0",
        keywords: b.keywords ?? [],
      })),
    }),
  }
);

const PLUGINS_README = `# plugins/ — generated, do not edit

Everything under \`plugins/\` is **generated** by [\`scripts/sync-bundles.mjs\`](../scripts/sync-bundles.mjs)
from the canonical [\`skills/\`](../skills) tree and the [\`bundles.json\`](../bundles.json) manifest.

It exists only so **claude.ai** scopes each themed plugin correctly: claude.ai discovers a
plugin's skills by scanning \`<source>/skills/\` and ignores the marketplace \`skills\` filter array,
so every bundle needs its own \`source\` subtree here. The CLIs (\`npx skills\`, Copilot, OpenCode)
never read this directory — they consume the flat \`skills/\` source directly.

To change what a bundle contains, edit \`bundles.json\` (and/or the skill under \`skills/\`), then run:

\`\`\`bash
make sync          # or: node scripts/sync-bundles.mjs
\`\`\`

Editing files here by hand will be overwritten on the next sync and rejected by CI (\`make check\`).
`;
desired.set(path.join("plugins", "README.md"), { text: PLUGINS_README });

const walk = (absDir, relBase) => {
  const out = [];
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, entry.name);
    const rel = path.join(relBase, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, rel));
    else if (entry.isFile()) out.push({ abs, rel });
  }
  return out;
};

for (const b of bundles) {
  desired.set(
    path.join("plugins", b.name, ".claude-plugin", "plugin.json"),
    {
      text: jsonText({
        name: b.name,
        version: b.version ?? "0.1.0",
        description: b.description ?? "",
        ...(marketplace.owner ? { author: marketplace.owner } : {}),
      }),
    }
  );
  for (const skill of b.skills) {
    const srcDir = path.join(ROOT, "skills", skill);
    for (const { abs, rel } of walk(srcDir, "")) {
      desired.set(path.join("plugins", b.name, "skills", skill, rel), { copyFrom: abs });
    }
  }
}

// ---- enumerate what's currently on disk under managed paths -----------------

const actual = new Set();
const marketplaceRel = path.join(".claude-plugin", "marketplace.json");
if (fs.existsSync(path.join(ROOT, marketplaceRel))) actual.add(marketplaceRel);
const pluginsDir = path.join(ROOT, "plugins");
if (fs.existsSync(pluginsDir)) {
  for (const { rel } of walk(pluginsDir, "plugins")) actual.add(rel);
}

// ---- check mode -------------------------------------------------------------

const matches = (rel, spec) => {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return false;
  if (spec.text !== undefined) return fs.readFileSync(abs, "utf8") === spec.text;
  return fs.readFileSync(abs).equals(fs.readFileSync(spec.copyFrom));
};

if (CHECK) {
  const problems = [];
  for (const [rel, spec] of desired) if (!matches(rel, spec)) problems.push(`out of date or missing: ${rel}`);
  for (const rel of actual) if (!desired.has(rel)) problems.push(`stale (not in bundles.json): ${rel}`);
  if (problems.length) {
    console.error(`sync-bundles: generated mirror is OUT OF SYNC:\n  ${problems.join("\n  ")}`);
    console.error("\nRun `node scripts/sync-bundles.mjs` (or `make sync`) and commit the result.");
    process.exit(1);
  }
  console.log(`sync-bundles: mirror is in sync (${desired.size} generated files across ${bundles.length} bundles).`);
  process.exit(0);
}

// ---- write mode -------------------------------------------------------------

// Wipe the fully-managed plugins/ tree so renamed/removed bundles leave nothing behind.
fs.rmSync(pluginsDir, { recursive: true, force: true });

for (const [rel, spec] of desired) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (spec.text !== undefined) fs.writeFileSync(abs, spec.text);
  else fs.copyFileSync(spec.copyFrom, abs);
}

console.log(`sync-bundles: wrote ${desired.size} files — ${bundles.map((b) => b.name).join(", ")}.`);
