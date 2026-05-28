@AGENTS.md

---

## Pre-code gate — say this out loud before writing any code

Before writing or editing any code, state the following in your response:

> "Docs updated: product-specs/[module].md and implementation-plan/[module].md reflect this change."

If you cannot say this because the docs are not yet updated, update them first. Do not proceed to code until this line appears in your response. This is not optional.

If the user says "sure" or "do it" — that approves the approach, not permission to skip the docs. Update the docs, then write the code.

---

## When the user approves a change verbally

Sequence:
1. Confirm which product-spec and implementation-plan files need updating
2. Update those files
3. State: "Docs updated: ..."
4. Then write the code

Skipping steps 1–3 violates the workflow in AGENTS.md even if the user has already approved the change.
