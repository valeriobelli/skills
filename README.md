# skills

Cross-tool **agent skills** and **Claude Code plugins**.

A *skill* is a folder with a `SKILL.md` — YAML frontmatter plus Markdown instructions — that a coding agent loads on demand to perform a specialized task well and repeatably. This repo follows the [Agent Skills open standard](https://agentskills.io), so the same `SKILL.md` files are consumable by Claude Code, OpenCode, Codex, Gemini, Cursor, and others.

## Available skills

| Skill | Bundle | What it does |
|-------|--------|--------------|
| [`council`](plugins/reasoning/skills/council/SKILL.md) | `reasoning` | Adversarial multi-agent debate that stress-tests a high-stakes plan — multiple critics argue against it in parallel, a synthesizer keeps what survives. |
| [`decompose`](plugins/reasoning/skills/decompose/SKILL.md) | `reasoning` | Turns one large or vague task into a set of small executable tasks — rough split, then one-question-at-a-time interrogation with the user, then writes the survivors to a board (Backlog.md or a task manager over MCP). |
| [`human-style-writing`](plugins/writing/skills/human-style-writing/SKILL.md) | `writing` | Rewrites or generates prose (Italian & English) without LLM tics. Activates only on explicit request ("make this sound human", "de-llmify this"). |
| [`stakeholder-summary`](plugins/writing/skills/stakeholder-summary/SKILL.md) | `writing` | Turns technical work into a short summary for a non-engineering reader — a ticket, release note, changelog entry, or status update. |

## Install

Pick whichever fits your agent. All four read the same `SKILL.md` files.

### `npx skills` (works across 70+ agents, incl. Copilot, Cursor, Codex)

Uses [vercel-labs/skills](https://github.com/vercel-labs/skills) to install into your agent's directory (symlink by default, so updates are a `git pull`):

```bash
npx skills add valeriobelli/skills          # interactive: pick skills + target agent
npx skills add valeriobelli/skills council  # a specific skill
```

### `gh skill` (GitHub CLI — preview)

```bash
gh skill search council
gh skill install valeriobelli/skills council
```

> `gh skill` is a preview feature; requires a recent `gh`. If your `gh` doesn't have it, use one of the other channels.

### Claude Code plugin marketplace

Installs a themed bundle with `/plugin` — `reasoning` (`council`, `decompose`) or `writing` (`human-style-writing`, `stakeholder-summary`):

```
/plugin marketplace add valeriobelli/skills
/plugin install reasoning
/plugin install writing
```

### git clone + symlink (tool-agnostic fallback)

```bash
git clone https://github.com/valeriobelli/skills ~/src/skills
ln -s ~/src/skills/plugins/reasoning/skills/council ~/.claude/skills/council   # Claude Code
ln -s ~/src/skills/plugins/reasoning/skills/council ~/.agents/skills/council   # OpenCode also reads ~/.agents/skills and ~/.claude/skills
```

## Tool support

| Tool | How it consumes this repo |
|------|---------------------------|
| Claude Code | Plugin marketplace (`/plugin`), or a `~/.claude/skills` symlink, or `npx skills` |
| OpenCode | Reads `~/.claude/skills` and `~/.agents/skills` natively; install via `npx skills` or symlink |
| Codex / Gemini / Cursor | `npx skills` installs into each tool's skills dir |
| GitHub Copilot | `npx skills` / `gh skill` translate `SKILL.md` into Copilot's `.github/` prompt-file layout on install. Copilot has no native `SKILL.md` loader — support is **installer-translated, not native**. |

## Repository layout

```
plugins/<bundle>/skills/<name>/SKILL.md     the skills themselves (SOURCE OF TRUTH)
plugins/<bundle>/skills/<name>/references/  optional files a SKILL.md loads on demand
plugins/<bundle>/.claude-plugin/plugin.json per-bundle Claude Code manifest
.claude-plugin/marketplace.json             catalog listing every bundle
templates/skill-template/                   scaffold for new skills
```

There is no generated mirror and no build step: what you edit is what installs. A skill lives in exactly one place — the bundle directory it belongs to.

The per-bundle nesting isn't cosmetic. claude.ai discovers a plugin's skills by scanning `<source>/skills/` and ignores the marketplace `skills` filter array, so each bundle needs its own `source` subtree. The CLI installers (`npx skills`, `gh skill`, Copilot, OpenCode) walk the repo and pick up the same `SKILL.md` files, so one tree serves both.

## Contributing

Run this once per clone, before your first commit:

```bash
make prepare-repo
```

It points git's `core.hooksPath` at [`.githooks/`](.githooks), whose `pre-commit` hook runs `make validate` — `claude plugin validate .` plus `npx skills add . --list` — so a malformed `SKILL.md` or plugin manifest is caught before it becomes a commit. That's stricter than CI, which can only run the `npx skills` half (no `claude` CLI on the runner).

`core.hooksPath` is local git config and is never carried over by `git clone`, so every contributor and every fresh clone needs the command again. You can still run `make validate` on its own at any time, and `git commit --no-verify` bypasses the hook when you deliberately want to commit work in progress.

See [CONTRIBUTING.md](CONTRIBUTING.md) to add a skill or a themed plugin bundle.

## License

[MIT](LICENSE)
