## Context

The workbench already has two distinct assistant text presentations:

- raw bubble text, which preserves source newlines through CSS
- reading mode, which routes eligible assistant text through a controlled markdown-like HTML renderer

The reported regression sits in the second path. The original assistant text still contains line breaks, but the current paragraph renderer collapses multi-line paragraph input into a single visual line before it reaches the browser. The result is that planning output, pseudo-tabular text, and similar multiline content become harder to read once reading mode activates.

The scope is intentionally narrow:

- fix visual newline preservation for reading-mode assistant text
- keep current eligibility rules and manual toggle behavior
- do not add full GFM table parsing
- do not change backend message contracts or add dependencies

## Goals / Non-Goals

**Goals:**
- Preserve visible line breaks from the original assistant text when that message is rendered in reading mode.
- Keep the existing controlled renderer and current frontend-only ownership of this presentation concern.
- Avoid broad behavior changes to raw bubbles, protocol cards, rich-result cards, or backend payload formats.
- Add focused tests that lock in newline preservation for multiline reading-mode content.

**Non-Goals:**
- Implementing full Markdown or GFM compliance, including table parsing.
- Introducing a third-party markdown library or changing dependency versions.
- Reworking assistant reading-mode eligibility heuristics or the existing `阅读 / 原文` toggle semantics.
- Changing how backend sessions persist or classify message content.

## Decisions

### Decision: Preserve intra-paragraph source newlines explicitly in the controlled renderer

The reading-mode renderer SHALL preserve source line breaks inside ordinary text paragraphs by emitting explicit visual line breaks instead of flattening paragraph lines into a space-joined sentence.

Rationale:
- The problem is created before browser layout because paragraph lines are currently merged into one string.
- Emitting explicit visual breaks restores the user's intended reading structure without requiring a broader markdown engine.
- This stays inside the existing controlled-renderer security model.

Alternatives considered:
- Rely only on CSS `white-space: pre-wrap`: rejected because the renderer already normalizes paragraph content before styling is applied, so CSS alone does not reliably restore the lost breaks.
- Add full table parsing: rejected because the user only requires visual readability, not full markdown fidelity.

### Decision: Limit the fix to reading-mode paragraph rendering

The implementation SHALL target the assistant reading-mode paragraph path and SHALL leave raw text bubbles, protocol cards, pending-question prompts, code fences, lists, and blockquotes on their current rendering paths unless direct regression coverage shows they also depend on the same helper.

Rationale:
- Raw bubbles and several protocol-style surfaces already preserve line breaks through `pre-wrap`.
- The observed defect is concentrated in reading-mode assistant text.
- Narrowing the write surface reduces visual regressions elsewhere in the conversation stream.

Alternatives considered:
- Convert all conversation text surfaces to a shared newline-normalization layer: rejected because it broadens the change beyond the user request and increases regression risk.
- Disable reading mode for multiline content: rejected because it would remove an already valuable presentation path instead of correcting it.

### Decision: Keep paragraph-level fallback behavior simple and non-tabular

When multiline content looks like a table but is not supported as structured table markup by the controlled renderer, the system SHALL preserve the visible row-by-row line structure without promising semantic table rendering.

Rationale:
- The user explicitly accepts visual newline preservation without requiring markdown-perfect output.
- This avoids implying support for broader markdown semantics than the renderer actually guarantees.

Alternatives considered:
- Special-case pipe-delimited rows into `<table>` output: rejected because it creates a partial table parser with edge cases but without full markdown coverage.

### Decision: Add regression tests at the renderer and conversation presentation layers

The change SHALL add automated coverage for multiline reading-mode assistant content and for the absence of regressions in the existing raw-text path.

Rationale:
- This issue is easy to reintroduce because the broken behavior comes from a small renderer helper.
- A renderer-level assertion catches newline flattening early, while a UI-level assertion verifies the actual conversation presentation contract.

Alternatives considered:
- UI-only tests: rejected because they make it harder to isolate whether a failure comes from renderer logic or component wiring.

## Risks / Trade-offs

- [Risk] Preserving paragraph line breaks may make some previously compact reading-mode replies taller. → Mitigation: keep the change limited to explicit source newlines rather than changing all spacing rules.
- [Risk] Some multiline markdown inputs may still look imperfect because tables remain unsupported. → Mitigation: document the scope as visual newline preservation only and avoid claiming full markdown fidelity.
- [Risk] A too-broad renderer change could affect workspace markdown preview if the helper is shared. → Mitigation: review the shared helper call sites and add regression coverage for the intended conversation behavior before implementation is finalized.
- [Risk] Explicit `<br>` insertion inside paragraphs could interact unexpectedly with inline formatting. → Mitigation: preserve the current inline-formatting pipeline and add tests that cover inline code or emphasis across multiline paragraph input.
