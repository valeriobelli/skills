.PHONY: sync check validate

# Regenerate the Claude Code plugin mirror from skills/ + bundles.json.
sync:
	node scripts/sync-bundles.mjs

# Verify the mirror is in lockstep with the source (used by CI).
check:
	node scripts/sync-bundles.mjs --check

# Full pre-commit gate: mirror in sync, then Claude + skill schema validation.
validate: check
	claude plugin validate .
	npx skills add . --list
