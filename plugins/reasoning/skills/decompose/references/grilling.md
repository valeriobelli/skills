# Grilling dimensions

The question bank for Phase 2. One subtask at a time, one question at a time.

This is a bank, not a script. A subtask that takes four questions and is genuinely clear is finished; a subtask that takes twelve because every answer opens something new is telling you it should be two subtasks.

## Choosing dimensions

Always cover: **Scope**, **Done**, **Dependencies**.

Then add the ones the subtask actually earns:

| Add | When |
| --- | --- |
| Assumptions | The subtask uses a word whose meaning isn't fixed ("sync", "cache", "migrate", "support") |
| Data & state | It reads or writes persistent state, or changes a schema |
| Failure | It touches a boundary — network, filesystem, third party, user input |
| Users & rollout | The change is observable by someone outside the team |
| Reversibility | Undoing it after ship is non-trivial |
| Ownership | Work crosses a team, repo, or service boundary |

Skipping a dimension that doesn't apply is good judgement. Skipping one because the answer might be awkward is the failure mode.

## Question order

Go **Scope → Assumptions → Dependencies → Data → Failure → Users → Reversibility → Ownership → Done**. Scope first because it invalidates other questions cheaply — no point asking about rollout for something that turns out to be internal-only. Done last because it's a synthesis of everything above.

---

## The dimensions

### Scope — what's in, what's out

The single highest-yield dimension. Most bad tasks are bad because nobody drew the edge.

- What's explicitly *not* in this task, that a reasonable person might assume is?
- Does this cover every platform/app/surface, or one?
- Is this the whole change, or the first slice of it?
- If this takes three times longer than expected, what's the part you'd cut?

### Assumptions — the words doing hidden work

Find the term in the subtask title that could mean three things, and make the user pick one.

- When you say "<term>", what specifically happens?
- Is there an existing pattern in this repo for this, or is this a new one?
- Am I right that <X> stays as it is? *(a genuine yes/no, not a rhetorical one)*
- What's the thing about this you think is obvious but nobody wrote down?

### Dependencies — order and blocking

- What has to be true before this can start?
- Which of the other subtasks does this block?
- Is anything here waiting on a person or a decision outside this list?
- Could this ship on its own, or only together with something else?

### Data & state

- Does this change the shape of anything stored?
- What happens to data that already exists in the old shape?
- Is a migration needed, and is it reversible?
- Does anything read this data that we don't control?

### Failure — what breaks

- What's the most likely way this goes wrong in production?
- What should happen when <the boundary> is unavailable or slow?
- Is failing loudly or failing quietly the right behaviour here?
- What's the blast radius if this is subtly wrong for a week?

### Users & rollout

- Who notices this change, and how?
- Does this go out to everyone at once, or behind a flag?
- Does anything need to be communicated, documented, or translated?
- Is there a state where some users are on the old behaviour and some on the new? Is that OK?

### Reversibility

- If this turns out to be wrong, how do we undo it?
- Is there a point after which undoing is no longer practical?
- Does that change how carefully this one needs reviewing?

### Ownership

- Is any part of this outside what you can merge yourself?
- Does another team need to review or approve?
- Who's picking this up — you, a teammate, or an agent?

### Done — the acceptance criteria

Drive toward criteria that a grep or a test run could resolve. Keep pushing until each one names something concrete.

- How would you check this actually worked, without asking the person who wrote it?
- Is there a test that fails today and passes when this is done? What's it called?
- What would you look at in production the day after to know it's fine?
- What would make you reject this in review?

**The rewrite pass.** Before showing the subtask, run each criterion against this:

| Rejected | Accepted |
| --- | --- |
| Works correctly | `POST /api/jobs` returns 429 after 100 requests in 60s |
| Is well tested | `rate_limiter_burst_test` passes |
| Performance is acceptable | p99 on `/api/jobs` stays under 200ms |
| Handles errors | A 503 from the upstream surfaces as a retryable error, not a crash |
| Documentation updated | `README.md` documents the `RATE_LIMIT_WINDOW` env var |

Do the rewrite yourself, then show it. Don't make the user catch a vague criterion — but do let them correct your rewrite.

---

## Asking well

- **One question per message.** Stop after it. No "and also".
- **Make it answerable in a sentence.** If your question needs a paragraph to answer, it's really three questions.
- **Bring your homework.** A question with a repo-derived candidate answer attached respects the user's time. A question that could have been answered by reading one file wastes it.
- **Mark the source.** "From the repo: ..." — the user needs to see which part is your finding and which part is the question.
- **Don't ask what they already told you.** Answers carry across subtasks. If they said the RN app is out of scope in subtask 2, don't re-ask in subtask 5 — state it as a carried assumption and let them override.
- **Don't perform thoroughness.** Questions whose answer changes nothing about the work are noise. If you can't say what would change based on the answer, drop the question.
