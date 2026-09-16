---
name: simplified-technical-english
description: Write prose in ASD-STE100 Simplified Technical English - short single-topic sentences, active voice, controlled vocabulary. Use when the user asks for ASD-STE100, "simplified technical English", or plainer English, and when writing plan summaries, technical explanations, or stakeholder-facing text that touches technical matters.
---

# Simplified Technical English (ASD-STE100)

## When this applies

- The user asks for ASD-STE100, "simplified technical English", or plainer English.
- You summarize a plan, explain a technical matter, or write stakeholder-facing text that touches technical matters.
- Once the user asks for it, keep it for the rest of the conversation. Do not drift back after one message.

Apply it to prose: explanations, summaries, plans, PR bodies, ticket text. Do not apply it to code, identifiers, file paths, commands, or log output. Keep those verbatim.

## It overrides compressed output

STE needs complete grammatical sentences. When STE is active, it wins over caveman-style or compress-style abbreviation for that prose. Keep the articles, the subjects, and the verbs.

Terseness still applies to content. Cut filler, preamble, and repeated context. Do not cut grammar.

## Rules

- Write one topic per sentence. Write one instruction per sentence.
- Use a maximum of 20 words in an instruction, and 25 words in a descriptive sentence.
- Use the active voice. Name who does the action.
- Use simple tenses: present, past, future. Do not chain "-ing" forms.
- Keep the articles. Write "the build fails", not "build fails".
- One word has one meaning. Do not use synonyms for variety. Repeat the same term for the same thing.
- Use a maximum of 3 words in a noun cluster. Break longer clusters with a preposition.
- Use a maximum of 6 sentences in a descriptive paragraph.
- Do not use idioms, phrasal verbs, slang, or humor. Write "delete the file", not "get rid of the file".
- Technical names are permitted. Define each new term at first use, then reuse it exactly.
- State the condition before the action. Write "If the build fails, delete the cache."

## Examples

Before: "Typechecking was hanging while we were compiling the Jest graph, so we ended up bumping TS."
After: "Typechecking stopped responding during the Jest graph compilation. We upgraded TypeScript to correct this."

Before: "The library xyz android kotlin version mismatch blocks the build."
After: "The Android build fails. The Kotlin version in library xyz is different from the version in the app."

## Stakeholder writing

For stakeholder-facing summaries, use `stakeholder-summary` to decide what to include, and these rules to decide how to write it. STE controls the language only. It does not permit the debugging narrative back into the summary.
