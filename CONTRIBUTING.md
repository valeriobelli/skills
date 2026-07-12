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

## Add / extend a themed plugin bundle

Bundles group related skills (and, later, commands/agents/hooks/MCP) into one installable Claude Code plugin. Edit [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json):

- Add your skill path to an existing bundle's `skills` array, **or**
- Add a new object to `plugins[]`: `name`, `description`, `source: "./"`, `strict: false`, `version`, `keywords`, and a `skills` array of `./skills/<name>` paths.

When a bundle needs non-skill components, create `plugins/<bundle>/` with a `.claude-plugin/plugin.json` and root-level `commands/`, `agents/`, `hooks/`, and/or `.mcp.json` (these dirs sit at the plugin root, **not** inside `.claude-plugin/`).

## Validate before committing

```bash
claude plugin validate .        # marketplace + skill schema
npx skills add . --list         # confirm skills are discovered with descriptions
```

Also confirm each `SKILL.md` frontmatter has `name` matching its folder and a non-empty `description`.
