# skills

Cross-tool **agent skills** and **Claude Code plugins**.

A *skill* is a folder with a `SKILL.md` — YAML frontmatter plus Markdown instructions — that a coding agent loads on demand to perform a specialized task well and repeatably. This repo follows the [Agent Skills open standard](https://agentskills.io), so the same `SKILL.md` files are consumable by Claude Code, OpenCode, Codex, Gemini, Cursor, and others.

## Available skills

| Skill | Bundle | What it does |
|-------|--------|--------------|
| [`council`](plugins/reasoning/skills/council/SKILL.md) | `reasoning` | Adversarial multi-agent debate that stress-tests a high-stakes plan — multiple critics argue against it in parallel, a synthesizer keeps what survives. |
| [`decompose`](plugins/reasoning/skills/decompose/SKILL.md) | `reasoning` | Turns one large or vague task into a set of small executable tasks — rough split, then one-question-at-a-time interrogation with the user, then writes the survivors to a board (Backlog.md or a task manager over MCP). |
| [`human-style-writing`](plugins/writing/skills/human-style-writing/SKILL.md) | `writing` | Rewrites or generates prose (Italian & English) without LLM tics. Activates only on explicit request ("make this sound human", "de-llmify this"). |
| [`simplified-technical-english`](plugins/writing/skills/simplified-technical-english/SKILL.md) | `writing` | Rewrite the technical english using ASD-STE100 (Simplified Technical English) for a better human comprehension. |
| [`stakeholder-summary`](plugins/writing/skills/stakeholder-summary/SKILL.md) | `writing` | Turns technical work into a short summary for a non-engineering reader — a ticket, release note, changelog entry, or status update. |
| [`subagent-routing`](plugins/orchestration/skills/subagent-routing/SKILL.md) | `orchestration` | Chooses the model for a subagent at the moment of delegation — cheaper only for task shapes known to be safe — and turns delegations that keep recurring into pinned agents. |

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

Installs a themed bundle with `/plugin` — `reasoning` (`council`, `decompose`), `writing` (`human-style-writing`, `simplified-technical-english`, `stakeholder-summary`) or `orchestration` (`subagent-routing`):

```
/plugin marketplace add valeriobelli/skills
/plugin install reasoning
/plugin install writing
/plugin install orchestration
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

## Skill setup

Most skills need no setup. `subagent-routing` has a helper script and two files of its own.

### `subagent-routing`

- **Node.** The helper script needs Node 20 or later. Without Node the skill still chooses models, but it cannot keep its ledger.
- **Claude Code.** The skill declares its script in `allowed-tools`, so the script runs without a permission prompt in the turn that loads the skill. Claude Code clears that grant at your next message. For later turns, answer the first prompt with "Yes, and don't ask again", or add an allow rule with the script's full path to your settings: `Bash(node /full/path/to/subagent-routing/scripts/routing.mjs *)`.
- **OpenCode.** Allow the script, or every delegation raises a prompt:

  ```jsonc
  {
    "permissions": [
      { "action": "shell", "resource": "node *subagent-routing/scripts/routing.mjs *", "effect": "allow" }
    ]
  }
  ```

- **Other providers (OpenCode).** By default a subagent stays on the session's provider. To allow others, say "set up subagent routing". The skill writes `~/.config/subagent-routing/routes.json` after you approve its content.
- **Always on.** A skill loads when the agent judges it relevant, which is not every time. For reliable use, add this line to your `AGENTS.md` or `CLAUDE.md`:

  ```
  Before spawning a subagent, load the `subagent-routing` skill.
  ```

- **Ledger.** Delegations are counted in `~/.local/state/subagent-routing/ledger.jsonl`. Each entry holds a one-line general description of the delegation, never the prompt. Delete the file to reset the counts.

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

It points git's `core.hooksPath` at [`.githooks/`](.githooks), whose `pre-commit` hook runs `make validate` — the unit tests for bundled scripts (`make test`), `claude plugin validate .` and `npx skills add . --list` — so a failing script test or a malformed `SKILL.md` or plugin manifest is caught before it becomes a commit. That's stricter than CI, which runs the unit tests and the `npx skills` check but not `claude plugin validate` (no `claude` CLI on the runner).

`core.hooksPath` is local git config and is never carried over by `git clone`, so every contributor and every fresh clone needs the command again. You can still run `make validate` on its own at any time, and `git commit --no-verify` bypasses the hook when you deliberately want to commit work in progress.

See [CONTRIBUTING.md](CONTRIBUTING.md) to add a skill or a themed plugin bundle.

## License

[MIT](LICENSE)
