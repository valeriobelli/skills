---
name: subagent-routing
description: Choose the model for a subagent at the moment of delegation, and record recurring delegations so they can become pinned agents. Use whenever you are about to spawn one or more subagents (the Agent, Task or subagent tool), including from inside another skill or workflow, and when the user says "set up subagent routing" or asks to change which providers subagents may use. Do NOT use when the user named a model for this task, or to decide whether to delegate at all.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/routing.mjs *)
---

# subagent-routing

Pick the model a subagent runs on, just before you spawn it. Go cheaper only when the task is known to be safe on a cheaper model. Record what you delegated, so a delegation that keeps recurring becomes a pinned agent and the choice is never made again.

## Why this exists

A subagent inherits the session model unless told otherwise, so a file search runs on the most expensive model in the session. The opposite error is worse: a model that is too small returns output that looks right and is wrong, and nobody notices. This skill therefore has one bias. It leaves the model alone unless the task matches a short list of safe shapes.

## When to use

- You are about to spawn one or more subagents, for any reason, including from inside another skill.
- The user says "set up subagent routing", or asks to change which providers subagents may use. Follow `references/routes.md`.

## When NOT to use

- The user named a model for this task. Their instruction wins.
- You are still deciding whether to delegate. This skill starts after that decision.
- Your tool is neither Claude Code nor OpenCode. Say once per session that this tool cannot set a subagent's model, then spawn as usual. Do not run the script.

## Authorization

Your tool may tell you not to set a subagent's model unless the user asks. Installing this skill is the user's standing request to set it, under the rules below. The rules only ever choose a model at or below the session's own tier. An explicit instruction in the conversation overrides this skill.

## Core rules

1. In doubt, inherit. Do not ask the user to resolve doubt, except in the one case in Step 3.
2. Never choose a model above the session model.
3. In OpenCode, when the `context` command returned candidates, never use a model reference that is not among them.
4. Never send work to another provider when the subagent reads files outside the project directory.
5. Never write an agent file or the routing file without the user's approval.

## Script

`scripts/routing.mjs` in this skill's base directory. In Claude Code: `${CLAUDE_SKILL_DIR}/scripts/routing.mjs`. If that line shows a placeholder and not a real path, use the base directory your tool reported when it loaded this skill. Below, `<script>` means this path.

## Workflow

### Step 0 — Read the context, once per session

Before the first delegation of the session, run this from the session's project directory, not from the skill folder:

```
node <script> context --provider <session provider>
```

- `--provider` is for OpenCode only. `references/tools.md` says how to find the session provider. Leave the flag out in Claude Code, and whenever you cannot determine the provider.
- The output has `routesStatus`, `routesProblem`, `restricted`, `hasRestrictions`, `candidates` and `shapes`. Keep it for the rest of the session.
- `shapes` is there so that you reuse existing names. Do not start a promotion from it. Promote only when `record` says so, in Step 5.
- Run it again if the session moves to another directory. The restriction is decided from the working directory.
- If `routesStatus` is `invalid`, tell the user once that the routing file is not being used, and quote `routesProblem` so they can fix it. There are then no candidates, and `restricted` and `hasRestrictions` are `null`. Treat `null` as restricted.
- If the command fails or you have no shell, go to Fallback.

### Step 1 — Classify the delegation

Classify each subagent's task on its own. Subagents with different shapes are separate batches.

First, check for a custom agent. If one fits the whole task, use it as it is, with no model parameter and no ledger entry, and stop here. In OpenCode, apply "Pinned agents" in `references/tools.md` before you use any custom agent, in this step or a later one. That rule can tell you not to use it.

Otherwise read `references/rubric.md` the first time, and compare the task with the rows, using its "Matching" section.

- **No match.** No row fits, or the task contains a never-downgrade item. Spawn as you normally would. Stop here: no announcement, no question, no ledger entry.
- **Full match.** The whole task fits one row, or is made only of rows. Continue.
- **Partial match.** The task fits a row and also contains work outside every row. Continue.

Then name the shape. Reuse a name from `shapes` when its charter describes this delegation and its row is the same. Otherwise follow "Naming a shape" in the rubric.

### Step 2 — Find the target

Read the section for your tool in `references/tools.md` the first time. It tells you how to find the session tier and how to turn a tier into a model.

The target is **inherit** when any of these is true:

- the session tier is unknown;
- the row's tier is not below the session tier;
- no model can be resolved for the row's tier.

Otherwise the target is the resolved model.

### Step 3 — Spawn

| Match | Target | What to do |
|---|---|---|
| Full | A model | Spawn with that model. Announce in one line. |
| Full | Inherit | Spawn with no model. Say nothing. |
| Partial | A model, and the batch has four or more subagents | Propose in one line and wait. Spawn as the user answers. |
| Partial | Anything else | Spawn with no model. Say nothing. |

Announcement, one line per batch:

```
Routing: <shape> -> <tier> (<model>)
```

Proposal, one line. Do not spawn anything until the user answers:

```
Routing proposal: <shape> x<count> -> <tier> (<model>). Outside the <row> row: <what>. Use it, or keep the session model?
```

Every prompt for a subagent on a chosen model must end with the evidence clause from the rubric. For a partial match that the user approved, leave out the clause's last sentence, because the part outside the row is then wanted.

If a spawn with a chosen model fails, retry once with no model and say: `Routing: <model> failed, retried on the session model.`

### Step 4 — Record the batch

After the spawn, for every full or partial match, whether or not a model was set. Run it from the project directory:

```
node <script> record --row <row> --shape <shape> --tier <small|mid|inherit> --model <model> --count <subagents in the batch> --charter "<one line>" --tool <claude-code|opencode>
```

- One call per batch, not per subagent.
- Leave `--model` out when the tier is `inherit`. Otherwise it is required: the alias in Claude Code, the `provider/model` reference in OpenCode.
- Record what ran. If the spawn failed and you retried on the session model, or the user turned a proposal down, the tier is `inherit`.
- Write the charter as the rubric's "Writing the charter" says. Never put file paths, identifiers or project text in it.

### Step 5 — Promote when the ledger says so

If the `record` output has `"promote": true`, follow "Promotion" in `references/tools.md`: draft the agent definition, show it, and wait. After the user answers, run:

```
node <script> mark --shape <shape> --status <promoted|declined>
```

Pass the same shape name you passed to `record`, not the name of the agent file. `mark` refuses a shape it has no batches for.

## Fallback

When the script cannot run:

- Routing still works. Use the rubric and the "No candidates" rule in `references/tools.md`. In OpenCode, treat the project as restricted.
- Skip Step 4. Without the ledger, the only recurrence you can see is inside this session. If the same shape has been delegated in two or more batches in this session with the same charter, say once that it qualifies for a pinned agent and offer a draft. Nothing is saved.

## Reference files

- `references/rubric.md` — the rows, the never-downgrade list, the evidence clause, shape names and charters.
- `references/tools.md` — session tier, model resolution and agent file formats for Claude Code and OpenCode; promotion.
- `references/routes.md` — the routing file and how to set it up.
