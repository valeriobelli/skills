# Evals

Two kinds of test live here.

## Unit tests

`routing.test.mjs` tests `scripts/routing.mjs`. From the repository root:

```bash
make test
```

`make test` relies on Node to expand a glob, which Node 20 cannot do. CI uses the version in `.node-version`. On an older Node, run the file directly: `node --test plugins/orchestration/skills/subagent-routing/evals/routing.test.mjs`.

Each test uses its own temporary directories, so it never touches your real ledger or routing file.

## Behaviour evals

`evals.json` holds seven cases: a prompt and the expectations to check in the transcript. They test what an agent does with the skill, so each one needs a real session.

### How to run a case

Run each case as the first message of a new top-level session, with the skill installed, and check the expectations against the transcript yourself.

Do not run the cases through an eval harness that hands the skill to a subagent. Such a harness loads the skill for the agent, so eval 1 would pass without measuring whether the skill loads. In OpenCode the subagent it uses cannot spawn subagents, so most cases could not run at all.

### Before you start

- The session model must be above the small tier: a Claude model other than haiku. On the small tier the skill correctly does nothing, and evals 1, 2, 5 and 7 fail.
- In Claude Code, `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` must not be set.
- The session's working directory is the root of this repository. The prompts refer to its files.
- For eval 1, no `AGENTS.md` or `CLAUDE.md` that the session reads may tell the agent to load this skill. Eval 1 measures whether the agent loads it by itself.

### Keep your own files out of it

Point the script at scratch directories. Without this, the runs write to your real ledger and can trigger a real promotion. Both variables must hold absolute paths; the script refuses relative ones. Do not use `XDG_CONFIG_HOME` for this: it would also move the tool's own configuration.

```bash
SKILL=plugins/orchestration/skills/subagent-routing
SCRATCH=$(mktemp -d)
mkdir "$SCRATCH/config"

# Evals 1 to 6: a fresh copy of the ledger fixture for each session
rm -rf "$SCRATCH/state" && cp -R "$SKILL/evals/files/state" "$SCRATCH/state"

# Eval 7 only: also the routing-file fixture
cp "$SKILL/evals/files/config/routes.json" "$SCRATCH/config/"

# Claude Code
SUBAGENT_ROUTING_STATE_DIR="$SCRATCH/state" SUBAGENT_ROUTING_CONFIG_DIR="$SCRATCH/config" claude

# OpenCode: --standalone gives the session its own server, so the variables reach the shell tool
SUBAGENT_ROUTING_STATE_DIR="$SCRATCH/state" SUBAGENT_ROUTING_CONFIG_DIR="$SCRATCH/config" opencode --standalone
```

Remove `"$SCRATCH/config/routes.json"` again before you go back to evals 1 to 6. It names a model that does not exist, which changes the result of evals 1 and 2 in OpenCode.

### The fixtures

`files/state/ledger.jsonl` holds one shape, `skill-frontmatter-check`, with three batches on two days in two projects. That already meets the promotion threshold, so the next `record` for that shape returns `"promote": true`. Eval 6 checks what the agent does with it.

`files/config/routes.json` lists one small-tier candidate, `example-missing/none-1`, which is in no catalogue. Eval 7 checks that the agent does not use it.

### After eval 6

Eval 6 must end with a draft and no file. If the agent wrote a file anyway, the eval failed and the file is in a real agents directory, because those are not redirected. Check for `skill-frontmatter-check.md` in `.claude/agents/`, `~/.claude/agents/`, `.opencode/agents/` and `~/.config/opencode/agents/`, and delete it.
