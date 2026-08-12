.PHONY: sync check validate

# Full pre-commit gate: mirror in sync, then Claude + skill schema validation.
validate: check
	claude plugin validate .
	npx skills add . --list
