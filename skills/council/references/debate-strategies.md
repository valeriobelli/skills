# Debate strategies

The skill ships two wired strategies. Pick the non-default only when the task clearly fits.

## 1. Debate rounds (default)

Structure: N critic agents, one synthesizer (the main thread). Every round, all N agents attack the *same current plan draft* in parallel. The synthesizer revises after each round.

```
Round 1: empty plan → N critics seed proposals + critiques → synth produces draft v1
Round 2: draft v1     → N critics attack v1                  → synth produces draft v2
...
```

**When to use:** default for nearly all plans. Cheap, flat, parallelizable. Works for implementation, debugging, architecture, strategy.

**When to switch away:** task has clear asymmetric structure — defender vs. attacker (security, threat modeling, migration rollback).

## 2. Red team vs blue team

Structure: 1 builder/defender agent (blue), 1+ attackers (red). Blue maintains and defends the plan; red attacks specific surfaces. Alternating turns.

```
Round k:
  Blue writes/defends plan vk, explicitly addressing prior round red attacks.
  Red proposes new failure modes / exploits / breakages.
```

**Invocation:** `/council strategy=red-blue <context>`.

**When to use:** security threat modeling, migration/rollback planning, anything where a hostile environment can cause specific failures. Also good for "what could go wrong on rollout day" planning.

**When NOT to use:** non-adversarial problems where there's no natural attacker (most refactors, internal product decisions) — the framing forces artificial separation.

## Prompt-structure differences (red-blue specifics)

Red-blue is *not* "debate rounds with role labels." It has a different turn structure:

- **Blue's prompt:** "You are the plan's author. Your prior plan (or empty if round 1) is below. Update it to explicitly address each red-team attack from round N-1. Your output IS the new plan draft."
- **Red's prompt:** "You are the attacker. Below is the current plan. Surface 3–5 attack surfaces: untrusted inputs, partial-failure modes, race conditions, abuse vectors, rollback paths. For each, name the prerequisite for the attack and the realistic impact."

The synthesizer keeps the blue output as the plan, and folds red's attacks into the Risks & tradeoffs section. Rounds end the same way: severity-weighted convergence stop.

## Selecting a strategy

1. Is there a natural adversary (security, untrusted input, rollback failure scenarios)? → **red-blue**.
2. Otherwise → **debate rounds** (default).

Other classical multi-agent debate strategies (proposer + arbiter, multi-proposer + judge) are intentionally not wired into this skill — they didn't justify the orchestration cost for the v1 use cases. If you want one of those for a specific task, run the prompt structure manually.
