# skills

Cross-tool **agent skills** and **Claude Code plugins**.

A *skill* is a folder with a `SKILL.md` — YAML frontmatter plus Markdown instructions — that a coding agent loads on demand to perform a specialized task well and repeatably. This repo follows the [Agent Skills open standard](https://agentskills.io), so a single canonical `skills/` tree is consumable by Claude Code, OpenCode, Codex, Gemini, Cursor, and others.

## Available skills

| Skill | What it does |
|-------|--------------|
| [`council`](skills/council/SKILL.md) | Adversarial multi-agent debate that stress-tests a high-stakes plan — multiple critics argue against it in parallel, a synthesizer keeps what survives. |
| [`human-style-writing`](skills/human-style-writing/SKILL.md) | Rewrites or generates prose (Italian & English) without LLM tics. Activates only on explicit request ("make this sound human", "de-llmify this"). |

## Install

Pick whichever fits your agent. All four read the same `skills/` source.

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

Installs a themed bundle with `/plugin` — `reasoning` (`council`) or `writing` (`human-style-writing`):

```
/plugin marketplace add valeriobelli/skills
/plugin install reasoning
/plugin install writing
```

### git clone + symlink (tool-agnostic fallback)

```bash
git clone https://github.com/valeriobelli/skills ~/src/skills
ln -s ~/src/skills/skills/council ~/.claude/skills/council   # Claude Code
ln -s ~/src/skills/skills/council ~/.agents/skills/council   # OpenCode also reads ~/.agents/skills and ~/.claude/skills
```

## Tool support

| Tool | How it consumes this repo |
|------|---------------------------|
| Claude Code | Plugin marketplace (`/plugin`), or `.claude/skills` symlink, or `npx skills` |
| OpenCode | Reads `.claude/skills` and `.agents/skills` natively; install via `npx skills` or symlink |
| Codex / Gemini / Cursor | `npx skills` installs into each tool's skills dir |
| GitHub Copilot | `npx skills` / `gh skill` translate `SKILL.md` into Copilot's `.github/` prompt-file layout on install. Copilot has no native `SKILL.md` loader — support is **installer-translated, not native**. |

## Repository layout

```
skills/<name>/SKILL.md   canonical, open-standard skills (source of truth)
.claude-plugin/          Claude Code marketplace catalog (themed bundles)
plugins/                 non-skill plugin components (commands/agents/hooks/mcp), added as needed
templates/               scaffold for new skills
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) to add a skill or a themed plugin bundle.

## License

[MIT](LICENSE)
