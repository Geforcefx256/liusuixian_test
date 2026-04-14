## Context

The workbench already routes MML text files through the Monaco-backed text editor path, but the editor still binds MML content to `plaintext`. That means the text view does not distinguish MML command structure from generic text, does not highlight the comment forms users actually write, and does not yet feel like a domain-aware correction surface.

The product boundary from the previous Monaco integration remains valid:

- Monaco is the text editor engine, not a new workspace shell.
- The workbench store remains authoritative for file content, dirty state, save state, and follow-up processing context.
- The MML toolbar remains a shell-owned structured projection of the leading header comment.

This change therefore does not redesign the workbench model. It introduces an MML-specific language layer inside Monaco so that the existing MML text-view path becomes more readable and more domain-oriented without changing save behavior or metadata ownership.

## Goals / Non-Goals

**Goals:**
- Introduce a dedicated Monaco language for MML text view rather than continuing to treat MML as plain text.
- Provide domain-oriented lexical highlighting for MML statements so command-heavy files are easier to read and review.
- Support the comment forms users need in practice: `/* ... */`, `// ...`, and `# ...`.
- Keep MML comment highlighting separate from MML toolbar metadata parsing.
- Preserve the existing store-centered save and follow-up model.
- Create a language-layer foundation that can support later completion, hover, or diagnostics work.

**Non-Goals:**
- Building a full MML parser or semantic validator in this change.
- Defining a complete cross-vendor MML grammar.
- Introducing command completion catalogs, hover documentation, or diagnostics in this change.
- Changing CSV behavior or plain-text behavior.
- Expanding MML toolbar metadata parsing beyond the existing standard leading header comment.

## Decisions

### Decision: Register a dedicated Monaco language for MML

MML text view SHALL bind Monaco models to a dedicated language id, for example `mml`, rather than reusing `plaintext`.

Rationale:
- MML now has enough distinct editing needs that a dedicated language boundary is clearer than theme-only customization.
- A separate language id provides a stable place for tokenizer rules, comment behavior, and future editor features.
- It prevents MML-specific behavior from leaking into normal text files.

Alternatives considered:
- Keep using `plaintext` and apply only visual theme adjustments.

Why not:
- That would not provide reliable tokenization, comment semantics, or a clean extension path for future MML editor features.

### Decision: Treat the first MML editor upgrade as lexical, not parser-first

The first MML language layer SHALL use Monaco language configuration plus a Monarch tokenizer focused on stable statement structure rather than complete semantic parsing.

The tokenizer should follow Huawei-style command structure first:

`VERB OBJECT: PARAM=VALUE[, PARAM=VALUE ...];`

The tokenizer will distinguish:
- block comments
- supported single-line comments
- command verbs
- command objects
- parameter identifiers
- assignment operators
- value forms
- delimiters
- statement terminators
- fallback identifiers

Rationale:
- The product need is readability and editing confidence in the text surface.
- Real-world MML dialects may vary by vendor or version, so a parser-first design would likely overfit too early.
- The most stable signal from Huawei-style MML samples is statement position rather than generic word shape.
- A lexical approach is enough to make the editor feel domain-aware while leaving room for later semantic features.

Alternatives considered:
- Build a parser-backed semantic editor from the start.

Why not:
- That would significantly expand scope, require a more complete language model than the current product needs, and create a larger maintenance burden before real usage data is gathered.

### Decision: Support three comment forms in the editor language

The MML Monaco language SHALL recognize the following comment forms:
- block comments: `/* ... */`
- slash line comments: `// ...`
- hash line comments: `# ...`

Rationale:
- Users explicitly need all three forms in the text view.
- Supporting the comment syntax users actually write improves readability for annotated review flows and draft commands.
- Comment recognition belongs in the language layer rather than in ad hoc UI rules.

Alternatives considered:
- Support only the existing header-style block comment form.
- Support block comments and `//`, but not `#`.

Why not:
- That would not match the user's stated editing needs and would keep the text view weaker than the intended domain-editor experience.

### Decision: Keep editor comment tokenization separate from business metadata parsing

MML comment highlighting SHALL NOT redefine which comment text drives workbench toolbar metadata. Only the standard leading header comment remains eligible to supply `网元类型` and `网元版本` through the existing store parsing path.

That means:
- the leading standard header `/* ME TYPE=<type>, Version=<version> */` keeps its current business meaning
- other block comments remain comments only
- `// ...` comments remain comments only
- `# ...` comments remain comments only

Rationale:
- Users need richer comment support in the editor, but metadata parsing must remain narrow and predictable.
- Expanding metadata semantics to all comment forms would create ambiguity and couple editor tokenization to business behavior.
- The current save-time convergence and toolbar model already depend on a tightly scoped header contract.

Alternatives considered:
- Let any supported comment form carry MML metadata.

Why not:
- That would create hidden business rules inside editor syntax and complicate save, parse, and toolbar behavior.

### Decision: Use conservative recognition for `#` comments

The MML language SHALL recognize `#` comments only in supported comment positions, preferably line-start or leading-whitespace positions, rather than treating every `#` character as the start of a comment.

Rationale:
- This reduces the chance of misclassifying future vendor-specific tokens or literal values.
- It keeps the first implementation safe while still supporting the user's intended comment usage.
- The rule can be widened later if real MML samples justify it.

Alternatives considered:
- Treat any `#` outside strings as a line comment start.

Why not:
- That increases the risk of accidental tokenization drift in unknown or vendor-specific syntax.

### Decision: Preserve the existing workbench authority model

The MML Monaco language layer SHALL affect editor tokenization and editing behavior only. Workspace file content, MML metadata, dirty state, save state, and continue-processing context remain authoritative in workbench state.

Rationale:
- The existing shell/editor boundary is already established and should remain stable.
- Syntax highlighting should not change save authority or business ownership.
- This keeps the MML language addition scoped to editor behavior rather than document lifecycle behavior.

Alternatives considered:
- Use editor-language state as a new source of document semantics.

Why not:
- That would blur the boundary between rendering concerns and business state, increasing implementation risk without clear product value.

### Decision: Treat the full command head before `:` as one command name

The first MML token model SHOULD treat the full command head before the first `:` as a single command name rather than splitting it into separate verb and object tokens.

Examples:
- `ADD RULE`
- `MOD NFPROFILE`
- `RMV SBIDIALTEST`
- `LST NFROUTEPLCY`
- `DSP PATHMTU`

The first MML token model SHOULD then treat:
- the full command head before `:` → command name
- tokens on the left side of `=` inside the command body → parameter identifiers
- tokens on the right side of `=` until `,` or `;` → values
- `:` `,` `;` → structural delimiters

Rationale:
- Huawei-style MML samples consistently use command structure such as `ADD PNFPROFILE:NFINSTANCEID="PCF_Instance_0", NFTYPE=NfPCF;`
- Users read command heads such as `ADD RULE` as complete command names rather than as programming-language-style `verb + object` pairs.
- Word-shape heuristics alone are too weak because command-head fragments, parameter identifiers, enum values, and some control-like values can all be uppercase identifiers.
- Position-based tokenization still matters, but the primary readability unit before `:` is the entire command name.

Alternatives considered:
- Split the command head into separate verb and object categories.
- Rely primarily on keyword catalogs and generic identifier classes.

Why not:
- Splitting the command head weakens the visual emphasis users expect from an MML editor and does not match the desired mental model of “command name + parameters”.
- Keyword-only classification would make the editor brittle, require a broader curated catalog too early, and still fail to distinguish structurally different uppercase tokens.

### Decision: Treat MML values as a family of value forms, not only strings and numbers

The first MML language layer SHOULD recognize at least the following value shapes on the right side of `=`:
- quoted strings such as `"PCF_Instance_0"`
- numbers such as `20`
- bareword enum-like values such as `YES`, `DATE`, `JUN`, `SUPI`
- symbolic bareword values such as `GMT+0800` and `NONBICC/NONSIP`
- prefixed literals such as `K'135`

Rationale:
- Huawei-style MML samples use multiple value forms in the same command family.
- Restricting value parsing to strings and numbers would flatten important distinctions and break common Huawei value shapes.
- These value forms can still be handled lexically without introducing a full semantic parser.

Alternatives considered:
- Treat all non-string, non-number values as generic identifiers.

Why not:
- That would under-highlight the command body and weaken the structural readability users expect from a domain editor.

### Decision: Support empty command bodies and multiple statements per line

The tokenizer SHOULD support:
- empty command bodies such as `LST NFROUTEPLCY:;`
- multiple consecutive statements in one line such as `...;ADD MOFC: ...;`

Rationale:
- Huawei-style MML samples show both patterns.
- Treating `:` as always requiring parameters would mis-tokenize valid `LST` statements.
- Treating each line as a single statement would fail on command streams that continue immediately after `;`.

Alternatives considered:
- Assume every command has at least one parameter pair and every line contains exactly one statement.

Why not:
- That assumption is contradicted by the Huawei-style samples already available for this change.

## Token Model

The first MML language pass should target a stable token model that is expressive enough for Huawei-style domain editing but tolerant of incomplete command catalogs.

Recommended token categories:
- `comment.block`
- `comment.line.slash`
- `comment.line.hash`
- `command.name`
- `key.parameter`
- `operator.assignment`
- `value.string`
- `value.number`
- `value.enum`
- `value.symbolic`
- `value.prefixed`
- `delimiter.separator`
- `delimiter.terminator`
- `identifier`
- `identifier.unknown`

Expected structural behavior:
- `ADD RULE:RULENAME="A";` should treat `ADD RULE` as one command-name region and `RULENAME` as a parameter identifier.
- `ADD PNFPROFILE:NFINSTANCEID="PCF_Instance_0", NFTYPE=NfPCF;` should distinguish command name, parameter identifier, assignment operator, string value, enum-like value, separator, and terminator.
- `LST NFROUTEPLCY:;` should tokenize as a valid statement with an empty command body.
- `...;ADD MOFC: ...;` should allow tokenization to restart immediately after a statement terminator.
- Unknown objects or keys should still retain structural tokenization instead of collapsing the entire line into plain text.

## Comment and Tokenization Boundaries

The language should prefer predictable lexical boundaries:

1. Block comments have highest priority and consume content until `*/`.
2. Single-line comments are recognized only when the tokenizer is not already inside a string or block comment.
3. `#` comments are recognized only in supported comment positions.
4. String contents must not start comments when they contain `#`, `//`, or `/*`.
5. Tokenization should remain case-insensitive for command-oriented structures.
6. Statement tokenization should restart after `;` rather than assuming one command per line.
7. The full command head before `:` should be classified as a command-name region before any finer-grained fallback handling is attempted.
8. Tokens on the right side of `=` should be classified as value forms by position before falling back to generic identifier handling.

Example expectations:

```mml
/* ME TYPE=UNC, Version=20.11.3 */
ADD RULE:NAME="A";
```

```mml
# prepare
// validate
/* batch create */
ADD RULE:ID=1,NAME="ABC";
```

```mml
ADD RULE:DESC="A # not comment",NOTE="// not comment";
```

```mml
ADD PNFPROFILE:NFINSTANCEID="PCF_Instance_0", NFTYPE=NfPCF, NFSTATUS=Registered;
```

```mml
SET MBCPARA: MAXRESELLNK=0, TRANSTMR=5000;ADD MOFC: ON="ABSC", OOFFICT=BSC, SIG=NONBICC/NONSIP;
```

```mml
LST NFROUTEPLCY:;
```

```mml
ADD MMACLIDSG: CSCNAME="LOCAL", MAPFX=K'135, MASFX=K'7174, PT=MLC, FCC=CV136;
```

```mml
ADD RULE:NAME="A";
/* ME TYPE=AMF, Version=24.1.0 */
```

In the final example, the trailing block comment is highlighted as a comment but MUST NOT drive toolbar metadata because it is not the standard leading header.

## Integration Plan

1. Add an MML language registration module under the Monaco runtime path.
2. Define the MML language configuration for brackets, auto-closing pairs, surrounding pairs, and word boundaries.
3. Define the MML Monarch tokenizer and register it with Monaco once.
4. Update the workspace text editor to resolve `mml` files to the dedicated MML language id.
5. Preserve existing plain-text behavior for non-MML text files.
6. Extend frontend tests to cover language registration, MML model binding, and representative tokenization scenarios.

## Risks / Trade-offs

- [Risk] Real MML syntax may vary more than the first tokenizer expects. → Mitigation: prefer a conservative position-driven tokenizer with fallback identifier tokens rather than a strict grammar.
- [Risk] `#` comment support could be too broad and misclassify unknown syntax. → Mitigation: keep `#` recognition conservative in the first pass.
- [Risk] Users may interpret “domain editor” as including completion or diagnostics immediately. → Mitigation: define this change explicitly as a language-layer and lexical-highlighting upgrade, not a full semantic editor.
- [Risk] Editor rules and metadata rules could drift apart conceptually. → Mitigation: document and preserve the explicit boundary that editor tokenization does not change metadata parsing semantics.
- [Risk] A tokenizer designed around one-statement-per-line assumptions would fail on Huawei-style command streams. → Mitigation: make repeated statements and empty command bodies explicit design requirements.

## Migration Plan

1. Introduce the MML Monaco language registration and tokenizer.
2. Switch MML text models from `plaintext` to the dedicated MML language id.
3. Update editor tests that currently assume MML still uses `plaintext`.
4. Update the `agent-web-workbench` spec to define MML syntax-highlighting and comment-highlighting behavior.
5. Rollback strategy: revert the MML model binding to `plaintext` while leaving the rest of the Monaco text path unchanged.

## Open Questions

- Whether the first command-verb list should be a fixed curated set or an easily extensible keyword collection seeded from current Huawei-style samples.
- Whether line-continuation or vendor-specific multi-line command forms exist in user content and need explicit tokenizer support later.
- Whether additional Huawei-style value forms beyond quoted strings, numbers, symbolic barewords, and prefixed literals need explicit treatment in a later refinement.
- Whether a later phase should add command completion and hover based on the same token model after real usage feedback is gathered.
