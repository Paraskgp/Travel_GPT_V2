<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Agent Operating Rules

## The workflow — follow this every single time, no exceptions

This is not a suggestion. This is the only acceptable way to make a change in this codebase.

```
BEFORE TOUCHING CODE:
  1. Read README.md                          — understand the project structure
  2. Read product-specs/overview.md          — understand what modules exist and why
  3. Read product-specs/[module].md          — understand what this module does, its success
                                               criteria, its assumptions, its open items
  4. Read implementation-plan/[module].md    — understand the current technical design
  5. Read the relevant code                  — understand what is actually implemented

  6. Update product-specs/[module].md        — what is changing and why
  7. Update implementation-plan/[module].md  — how it changes technically, update unit tests

THEN AND ONLY THEN:
  8. Write the code

AFTER WRITING THE CODE:
  9. npx tsc --noEmit                        — must pass, zero errors
 10. Run the relevant unit test or audit step
 11. Mark the item done with a date in implementation-plan/[module].md
```

Skipping steps 1–7 and jumping to step 8 is the single most common way to produce code that is technically correct but architecturally wrong. It produces parallel reimplementations, duplicated logic, broken interfaces, and documentation that lies. Do not do it.

If you are unsure which module a change belongs to, that question gets resolved in step 3, not in step 8.

---

## Document hierarchy

```
product-specs/          WHAT and WHY  — product-level, founder-readable
implementation-plan/    HOW           — technical design, engineer-readable
code                    The implementation of the above two layers
README.md               Navigation — how to find anything in this repo fast
```

**If code and specs disagree, specs win. Fix the code.**
**If a spec is wrong, fix the spec first, then fix the code.**
**If a spec is missing, write it before writing the code.**

---

## Mandatory sections — product-specs/[module].md

Every module spec must contain all of these. If a section cannot be filled in, write it as an open item — never skip it.

| Section | What goes here |
|---|---|
| **What it does** | One paragraph. What this module produces and why it matters to the product. |
| **Inputs** | What enters this module. Plain English, not types. |
| **Outputs** | What this module produces. Plain English, not types. |
| **Success criteria** | Checkable, specific statements of correctness. Each must be verifiable. |
| **Evaluation criteria** | How quality is scored beyond pass/fail. The rubric used by evals. |
| **Simplifying assumptions** | What has been deliberately simplified or scoped out. Honest about tradeoffs. |
| **Open items** | Unresolved questions, deferred decisions, known gaps. Dated when added. |

---

## Mandatory sections — implementation-plan/[module].md

| Section | What goes here |
|---|---|
| **Owns** | The function(s) and file(s) that implement this module. |
| **Inputs / Outputs** | TypeScript types. |
| **Steps** | Internal execution steps in order. |
| **Caching** | Cache key, TTL, invalidation trigger. "None" if not applicable. |
| **Failure handling** | Fatal or non-fatal. What the fallback is. |
| **Unit tests** | One test per success criterion in the product spec. Each test names the criterion it covers. Missing tests listed as open items. |
| **Open technical items** | Deferred decisions, known limitations, performance concerns. Dated. |

---

## Interface before implementation

Before writing a function body, write its signature and a JSDoc comment first:
- What goes in
- What comes out
- Whether it throws or returns a safe default on failure

This forces you to think about the contract before the mechanics. A function with a well-defined contract is reusable. A function written to satisfy one caller is not.

---

## Scripts call production code — never reimplement it

Any script, audit tool, eval, or dev utility must call the same functions that production calls. Never copy logic from a module into a script. If a script needs pipeline behavior, import the pipeline function. A script that reimplements production logic will silently diverge, produce different results, and mislead you.

If a function does not exist as a standalone callable unit yet, extract it first, then call it from both the production path and the script. That extraction is the right fix — not a copy.

---

## One place per concern

Before writing any new logic, search the codebase for an existing implementation. If it exists, import it. If it almost fits, refactor it to fit. Never duplicate.

The moment the same logic appears in two files, one of them is a bug.

Module ownership is strict:
- Cache logic lives in the cache module. Nothing reads or writes cache files directly.
- LLM calls live in the LLM client. Nothing constructs API requests elsewhere.
- Prompt assembly lives in the prompts module. No prompt text is inlined in TypeScript.
- Pipeline logic lives in pipeline functions. Route handlers are thin wrappers.

If code outside a module is managing that module's internals, that is a boundary violation. Fix it by moving the logic into the module.

---

## No silent behavior

No hardcoded limits without a comment explaining why. No silent fallbacks that swallow real errors during development. No magic numbers. If a value affects behavior, it is named, documented, and intentional.

Silent behavior hides bugs and makes evaluation results meaningless — you cannot trust a score if the system is silently altering its inputs.

---

## Fail loudly in scripts, gracefully in production

Production route handlers catch failures and return safe defaults — the user must never see a 500 because a non-critical module failed.

Scripts, audit tools, and evals do the opposite — let errors throw, let the process exit non-zero. You want to know immediately when something breaks in development. Do not copy the graceful-failure pattern from production into scripts.

---

## Every exported function has a contract comment

One JSDoc block per exported function. A new agent reading this function for the first time should understand what it does, what it returns, and how it fails — without reading the implementation. If that is not possible from the comment alone, the comment is incomplete.

---

## Before creating a new module, answer these questions

1. Does existing code already do this? If yes, extend it — do not create a parallel implementation.
2. Where does this belong? Pipeline concern → `lib/pipeline/`. Utility → `lib/utils/`. External service wrapper → `lib/[service]/`.
3. Does it have a product spec entry?
4. Does it have an implementation plan entry?
5. Does it have at least a stub unit test?

If any answer is no, resolve it before writing the module body.

---

## Every module boundary is a potential service boundary

Design every module as if it will become a network call. Each module takes data in, returns data out, has no side effects outside its contract, and shares no state with other modules.

The test: could this module be replaced with an HTTP call to a remote service without changing a single line in its callers? If yes, the boundary is clean. If no, something is leaking through — find it and fix it.

This costs nothing today and preserves full architectural flexibility for tomorrow. Modules that leak internals make independent scaling, deployment, and replacement expensive. Modules with clean boundaries make it trivial.

---

## TypeScript is non-negotiable

`npx tsc --noEmit` passes before any work is considered done. Type errors are not warnings. A codebase with type errors is a codebase with hidden assumptions — assumptions that will break at runtime in ways that are hard to diagnose.
