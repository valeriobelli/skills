# Tools

How to find the session tier, how to turn a tier into a model, and how to write a pinned agent, for each tool.

## Tiers

`small` and `mid` are targets. `large` is never a target. A tier is a target only when it is below the session tier.

When the session tier is unknown, the target is inherit.

Claude family, lowest to highest:

| Family | Tier |
|---|---|
| haiku | small |
| sonnet | mid |
| opus | large |
| fable | large |

A model belongs to a family when its ID contains the family name. A Claude model whose ID contains none of these names has an unknown tier.

## Where to run the script

Run every script command from the session's project directory, never from the skill folder. The script uses the working directory to decide whether the project is restricted, and records it as the project.

Run `context` again when the session moves to another directory, for example into a worktree.

## Claude Code

**Session tier.** Take the family of the session model from the table above. If the session model is not a Claude model, the tier is unknown.

**Setting the model.** The Agent tool's `model` parameter takes an alias only: `haiku`, `sonnet`, `opus` or `fable`.

| Tier | Alias |
|---|---|
| small | `haiku` |
| mid | `sonnet` |

**Limits.**

- When `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` is set to `1`, you cannot pass a model. The target is inherit. Check with `printenv CLAUDE_CODE_SUBAGENT_MODEL_FORCE`.
- An organisation allowlist may replace the model you chose. Claude Code shows its own warning. Do nothing extra.
- Claude Code talks to one provider at a time. Leave `--provider` out, and ignore `candidates`, `restricted` and `hasRestrictions`.

## OpenCode

**Session provider.** Look the session model up with the model lookup tool; your own provider is listed first. The session's reference is that catalogue entry, in the form `provider/model`. The provider is the text before the first `/`. Pass it to `context` as `--provider`. If you cannot determine it, leave the flag out. A restricted project then gets no candidates, which is the safe result.

**Session tier.** If the session model is a Claude model, take its family from the table above. Otherwise, if `candidates` lists the session model under a tier (`small`, `mid` or `large`), use that tier. Otherwise the tier is unknown. Compare references without the `#variant` part.

**Setting the model.** The subagent tool's `model` parameter takes `provider/model`, with an optional `#variant`. Take the reference from the model catalogue through the model lookup tool. Never write one from memory.

**With candidates** (`candidates` is an object). Take the list for the row's tier, in order. Use the first reference that passes both checks:

1. It is in the catalogue and its status is `active`.
2. Price guard. Compare the input price in the base entry of `cost`, the entry with no `tier` field. When the session model and the candidate both have one, the candidate's must be lower. An empty `cost` list means the price is missing: skip this check. A price of `0` is a real price, not a missing one.

Pass the reference exactly as listed, variant included. The target is inherit when the tier is absent from `candidates`, when its list is empty, or when no reference passes. Never add a reference of your own: the script has already removed the ones that the project restriction excludes.

**No candidates** (`candidates` is `null`, or the script could not run). Stay on the session's provider. If the session model is a Claude model, look on that provider for the row's family (`haiku` for small, `sonnet` for mid):

1. Use the bare alias when the provider has one: `<provider>/haiku`, `<provider>/sonnet`.
2. Otherwise use the active entry whose ID is the session model's ID with only the family name and version changed, so that any regional or vendor prefix stays the same.
3. If more than one entry is left, or none, the target is inherit.

For any other family, the target is inherit.

**Files outside the project.** If the task has the subagent read files outside the session's project directory, stay on the session's provider, whatever `restricted` says. The restriction is known only for the directory `context` ran in.

**Pinned agents.** A pinned agent is any custom agent whose definition has a `model`. The description you see does not show it. Read the definition of a custom agent, in its file or in the configuration, before you use it, in any step, when one of these is true:

- `restricted` is `true` or `null`;
- the subagent will read files outside the session's project directory.

Do not use the agent when its definition has a `model` on a provider other than the session's, when you cannot find the definition, or when you could not determine the session provider. Spawn the general agent with the same instructions and no model.

**Limit.** Models are enabled per project, so a reference that works in one repository can be missing in another. The catalogue check covers this.

## Other tools

Do not set a model and do not record. Say once per session that this tool cannot set a subagent's model, then spawn as usual.

## Promotion

Run this when `record` prints `"promote": true`.

**1. Check the name.** If an agent named `<shape>` already exists, built in or custom, in any scope, do not replace it. Ask the user for another agent name. Use that name for the file and, in Claude Code, for the `name` field. The shape keeps its own name in the ledger.

**2. Choose the model.** Use the row's tier, resolved as above for your tool. If it cannot be resolved, leave the `model` field out.

**3. Choose the scope.**

| Condition | Scope |
|---|---|
| OpenCode, the model is on a provider other than the session's, and `hasRestrictions` is `false` | Global |
| OpenCode, the model is on a provider other than the session's, and `hasRestrictions` is `true` or `null` | Project |
| Any other case, and `shape.projects` has two or more entries | Global |
| Any other case, and `shape.projects` has one entry | Project |

The second row keeps an agent that sends work to another provider out of every restricted project. A project-scope agent exists only in the project it was written in. For that row, also add the file's path to the exclude file that `git rev-parse --git-path info/exclude` prints, so that the agent stays on this machine and does not reach a teammate who restricted the repository.

For any other project-scope agent, tell the user that the file will be tracked by git unless they exclude it.

This rule is the only protection when the tool picks a pinned agent without loading this skill. It does not cover a restriction that the user adds later: see "Changing it" in `references/routes.md`.

`shape.projects` holds working directories, so two folders of one repository count as two projects.

**4. Write the draft.** Build the body from `shape.charters` and the prompt of the current batch. Keep what stays the same between runs. Leave out the inputs that change. For global scope, also leave out anything that belongs to one project.

The description and the body must carry the row's limits, because the tool picks a pinned agent by its description and this skill is then not consulted.

When the shape is made of several rows, give the agent what every one of them needs in the tables below.

Claude Code — `.claude/agents/<shape>.md` (project) or `~/.claude/agents/<shape>.md` (global):

```markdown
---
name: <shape>
description: <one sentence: when to delegate to this agent>. Does not judge, diagnose or change anything.
tools: <see the tool list below>
model: <haiku|sonnet>
---

<charter, written as instructions to the agent>

<the evidence clause from the rubric, word for word>
```

Tool list by row:

| Row | `tools` |
|---|---|
| `locate`, `extract`, `checklist`, `charter-critic`, `explain` | `Read, Grep, Glob` |
| `run-and-report` | `Read, Grep, Glob, Bash` |
| `retrieve` | `Read, Grep, Glob, WebFetch, WebSearch` |

If the shape needs an MCP tool, add it to the list.

OpenCode — `.opencode/agents/<shape>.md` (project) or `~/.config/opencode/agents/<shape>.md` (global):

```markdown
---
description: <one sentence: when to delegate to this agent>. Does not judge, diagnose or change anything.
mode: subagent
model: <provider/model#variant>
permissions:
  - action: "*"
    resource: "*"
    effect: deny
  - action: read
    resource: "*"
    effect: allow
  - action: read
    resource: "*.env"
    effect: ask
  - action: read
    resource: "*.env.*"
    effect: ask
  - action: read
    resource: "*.env.example"
    effect: allow
  - action: glob
    resource: "*"
    effect: allow
  - action: grep
    resource: "*"
    effect: allow
  <one allow entry for each action in the table below>
---

<charter, written as instructions to the agent>

<the evidence clause from the rubric, word for word>
```

The last matching rule wins, so the first entry denies everything and the later ones allow what the row needs. The three `.env` entries restore OpenCode's default of asking before it reads an environment file, which the `read` entry above them would otherwise remove. Keep them. Extra actions to allow by row, each written like the first `read` entry:

| Row | Also allow |
|---|---|
| `locate`, `extract`, `checklist`, `charter-critic`, `explain` | nothing |
| `run-and-report` | `shell` |
| `retrieve` | `webfetch`, `websearch` |

If the shape needs an MCP tool, add an allow entry for it. Its action is `<server>_<tool>`.

**5. Show the draft** with its name, model, scope and target path. Wait for the user. If the user does not answer, do nothing, and do not run `mark`.

**6. After the answer.**

- Approved: write the file, then run `node <script> mark --shape <shape> --status promoted`.
- Declined: run `node <script> mark --shape <shape> --status declined`. The shape is not proposed again.
- `--shape` is always the shape's name in the ledger, also when the file got another name.

Both tools load a new agent file without a restart. One exception: in Claude Code, a session does not see an `agents` directory that did not exist when the session started. If you created the directory, tell the user to restart Claude Code.
