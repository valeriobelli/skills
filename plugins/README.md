# plugins/ — generated, do not edit

Everything under `plugins/` is **generated** by [`scripts/sync-bundles.mjs`](../scripts/sync-bundles.mjs)
from the canonical [`skills/`](../skills) tree and the [`bundles.json`](../bundles.json) manifest.

It exists only so **claude.ai** scopes each themed plugin correctly: claude.ai discovers a
plugin's skills by scanning `<source>/skills/` and ignores the marketplace `skills` filter array,
so every bundle needs its own `source` subtree here. The CLIs (`npx skills`, Copilot, OpenCode)
never read this directory — they consume the flat `skills/` source directly.

To change what a bundle contains, edit `bundles.json` (and/or the skill under `skills/`), then run:

```bash
make sync          # or: node scripts/sync-bundles.mjs
```

Editing files here by hand will be overwritten on the next sync and rejected by CI (`make check`).
