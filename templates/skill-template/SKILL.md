---
name: skill-template
description: One or two sentences describing WHEN this skill should activate — the agent reads this to decide relevance. Be specific about triggers and about when NOT to use it. Do not describe the skill's internals here.
# --- optional fields (safe across tools; unknown keys are ignored) ---
# version: 0.1.0
# author: Your Name
# tags: [category, category]
# license: MIT
---

# skill-template

One-line statement of what this skill does and the outcome it produces.

## Why this exists

The problem this skill solves and why a plain prompt is not enough. Keep it short.

## When to use

- Concrete trigger phrases or situations.
- Task shapes where this skill pays off.

## When NOT to use

- Cheaper alternative for the trivial case.
- Situations where a different skill fits better.

## Workflow

1. Step one.
2. Step two.
3. Step three.

<!--
Keep SKILL.md lean. Push long reference material, examples, and scripts into
sibling directories loaded on demand (progressive disclosure):
  references/   long-form docs the agent reads only when needed
  scripts/      executable helpers
  templates/    files the skill fills in
  examples/     worked examples
The folder name MUST equal the `name` field above (lowercase, hyphenated).
-->
