# Verification gate checklist

Run these checks against the final text. Each line is a binary check: present = failed. Sum the failures.

1. **Closing triad** — is there a three-parallel-element structure used as a climax or closer?
2. **"Not just X, but Y"** — present in either English or Italian, in any variant?
3. **Summary-style closing** — does the text end with something like "in conclusion / ultimately / this shows that"?
4. **Empty opener** — does the first sentence restate the question/topic without adding content?
5. **Lexical telltale words** — is at least one word from `patterns.md` section B present (check both English and Italian, depending on the text's language)?
6. **Recurring em-dash** — more than one occurrence of "—" every ~150 words?
7. **Unjustified bulleted list** — is there a bulleted list where 2-3 sentences of prose would be more natural, and the context doesn't call for a list format (e.g. step-by-step instructions)?
8. **Summary-style bold** — is bold repeatedly used on single keywords as if it were a scanner-friendly summary?
9. **Superfluous hedging** — is "it's worth noting / it is important to" or the Italian equivalents ("è importante notare / vale la pena sottolineare") present?
10. **Mechanical rhythm** — reading the paragraph aloud, do all sentences have similar length and syntactic structure, with no variation?
11. **Meta-commentary** — does the text announce the action ("let's analyze", "let me explain") instead of just doing it?

## Interpretation

- Count the failed checks (0–11).
- **≥3 failures** → forced rewrite, targeting only the failed items, then repeat the checklist.
- **After 2 rewrite cycles**, if ≥3 failures remain, deliver anyway and explicitly state which checks still fail and why (e.g. check 7 fails because the user explicitly requested a bulleted format — in that case it's not a real failure; note it as a justified exception and don't count it).

## Legitimate exceptions

Not every failure needs to be fixed at all costs:
- A bulleted list explicitly requested by the user is not a failure of check 7.
- A single isolated em-dash in a short text doesn't trigger check 6 (the threshold is about frequency, not absolute presence).
- A word from list B used in its specific technical sense (e.g. "leverage" in an actual finance context, "robust" in structural engineering) is not a tic — check 5 is about generic filler use, not correct technical vocabulary.
