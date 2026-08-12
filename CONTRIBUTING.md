# Contributing

## Add a skill

1. Pick the bundle it belongs to — `reasoning`, `writing`, or [a new one](#add-a-themed-plugin-bundle) — and copy the scaffold into it:

   ```bash
   cp -r templates/skill-template plugins/<bundle>/skills/<your-skill-name>
   ```

2. Rules that keep the skill portable across tools:
   - Folder name is **lowercase, hyphen-separated** (e.g. `code-review`) and MUST equal the `name` frontmatter field.
   - `SKILL.md` (uppercase, exactly) with `---`-delimited YAML frontmatter, **no whitespace before the opening `---`**.
   - **Required** frontmatter: `name`, `description`.
   - **Optional** (safe everywhere; unknown keys are ignored): `version`, `author`, `tags`, `license`, `metadata`.
   - `description` is the trigger the agent reads to decide relevance — say *when to use* and *when not to*, not how it works internally. Keep it under ~1024 chars.

3. **Progressive disclosure** — keep `SKILL.md` lean. Push long material into sibling dirs the agent loads only when needed:
   - `references/` long-form docs · `scripts/` helpers · `templates/` fill-in files · `examples/` worked cases.

4. That's the whole registration step — placing the folder inside a bundle is what makes the skill installable from the Claude marketplace. Then validate (below).

## Where skill content lives

`plugins/<bundle>/skills/<name>/SKILL.md` is the **only** place skill content lives. There is no generated mirror and no build step — what you edit is what installs, so every file here is hand-edited.

The per-bundle nesting is required by **claude.ai**, which scopes a plugin's skills by scanning `<source>/skills/` and ignores the marketplace `skills` filter array — so each bundle needs its own `source` subtree. The CLI installers (`npx skills`, `gh skill`, Copilot, OpenCode) walk the repo and read the same `SKILL.md` files, so one tree serves both.

The tradeoff: a skill belongs to exactly one bundle. Listing it in two would mean two copies drifting apart — move it, or redraw the bundle boundaries instead.

## Add a themed plugin bundle

Two manifests, both hand-edited:

1. `plugins/<bundle>/.claude-plugin/plugin.json` — `name` (must equal the directory name), `version`, `description`, `author`.
2. [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) — append to `plugins[]`: `name`, `description`, `version`, `source` (`"./plugins/<bundle>"`), `strict: false`, `keywords`.

Keep `version` **identical** in both. At install time `plugin.json` wins and the marketplace entry's version is silently ignored, so a mismatch misleads anyone reading the catalog; `claude plugin validate .` warns when they diverge.

## Validate before committing

```bash
make validate          # runs both checks below
```

or individually:

```bash
claude plugin validate .   # marketplace + plugin.json + skill schema
npx skills add . --list    # confirm skills are discovered with descriptions
```

Confirm each `SKILL.md` frontmatter has `name` matching its folder and a non-empty `description`.
