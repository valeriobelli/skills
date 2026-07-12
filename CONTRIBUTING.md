# Contributing

## Add a skill

1. Copy the scaffold:

   ```bash
   cp -r templates/skill-template skills/<your-skill-name>
   ```

2. Rules that keep the skill portable across tools:
   - Folder name is **lowercase, hyphen-separated** (e.g. `code-review`) and MUST equal the `name` frontmatter field.
   - `SKILL.md` (uppercase, exactly) with `---`-delimited YAML frontmatter, **no whitespace before the opening `---`**.
   - **Required** frontmatter: `name`, `description`.
   - **Optional** (safe everywhere; unknown keys are ignored): `version`, `author`, `tags`, `license`, `metadata`.
   - `description` is the trigger the agent reads to decide relevance — say *when to use* and *when not to*, not how it works internally. Keep it under ~1024 chars.

3. **Progressive disclosure** — keep `SKILL.md` lean. Push long material into sibling dirs the agent loads only when needed:
   - `references/` long-form docs · `scripts/` helpers · `templates/` fill-in files · `examples/` worked cases.

4. Register it in a themed bundle (below) so it's installable via the Claude marketplace.

## Source of truth vs. generated

The `skills/` tree is the **only** place skill content lives — it's the flat, open-standard source every CLI agent reads (`npx skills`, Copilot, OpenCode, …).

`plugins/` and `.claude-plugin/marketplace.json` are **generated** and must never be hand-edited. They exist only for **claude.ai**, which scopes a plugin's skills by scanning `<source>/skills/` and ignores the marketplace `skills` filter — so each bundle needs its own `source` subtree. [`scripts/sync-bundles.mjs`](scripts/sync-bundles.mjs) mirrors the canonical skills into per-bundle subtrees from a single hand-edited manifest, [`bundles.json`](bundles.json).

## Add / extend a themed plugin bundle

Edit [`bundles.json`](bundles.json) — **not** `marketplace.json`:

- Add the skill's folder name to an existing bundle's `skills` array, **or**
- Add a new object to `bundles[]`: `name`, `description`, `version`, `keywords`, and a `skills` array of bare skill folder names (e.g. `"council"`, which resolves to `skills/council`).

Then regenerate the mirror:

```bash
make sync          # or: node scripts/sync-bundles.mjs
```

A skill may belong to more than one bundle, or to none (it still installs via `npx skills`; it's just absent from the Claude marketplace). Commit the regenerated `plugins/**` and `marketplace.json` alongside your change.

## Validate before committing

```bash
make validate          # runs the three checks below
```

or individually:

```bash
make check             # generated mirror is in lockstep with skills/ + bundles.json
claude plugin validate .   # marketplace + plugin.json + skill schema
npx skills add . --list    # confirm skills are discovered with descriptions
```

`make check` (and CI) fail if you edited a skill or `bundles.json` without re-running `make sync`. Also confirm each `SKILL.md` frontmatter has `name` matching its folder and a non-empty `description`.
