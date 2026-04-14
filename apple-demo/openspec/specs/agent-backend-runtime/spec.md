# agent-backend-runtime Specification

## Purpose
Define the runtime guarantees for the migrated agent backend, including package layout, governed execution behavior, metadata surfaces, and workspace behavior exposed to the workbench.
## Requirements
### Requirement: Migrated runtime package layout
The system SHALL provide a standalone runtime package at `apps/agent-backend` that contains the source code, runtime assets, configuration files, release scripts, extensions, tests, runtime working directories, and dist output required to run the migrated agent backend without depending on the legacy `ref_code/apps/agent-backend` layout.

#### Scenario: Source layout is complete after migration
- **WHEN** the migration is applied
- **THEN** `apps/agent-backend` MUST contain `src/`, `assets/`, `scripts/`, `extensions/`, `tests/`, `workspace/`, `data/`, and configuration files needed by the runtime

#### Scenario: Dist output remains service-local
- **WHEN** the migrated package is built
- **THEN** the compiled runtime MUST be emitted under `apps/agent-backend/dist`
- **AND** the runtime MUST be startable from that dist directory without reading files from `ref_code/apps/agent-backend`

### Requirement: Runtime behavior parity in the new package
The migrated package SHALL preserve the existing agent-backend product behavior, including authenticated agent execution, session persistence, planner/build phase handling, tool provider dispatch, structured runtime logging, memory management, and gateway/MCP integration.

#### Scenario: Core runtime routes remain available
- **WHEN** the migrated backend starts successfully
- **THEN** it MUST expose the same agent runtime route families for agents, runtime bootstrap, agent execution, files, memory, and gateway tools

#### Scenario: Planner and build phases remain enforceable
- **WHEN** a workspace-agent session enters planning and then transitions to build
- **THEN** the migrated runtime MUST preserve plan persistence, approval state, and approved-skill enforcement before build execution proceeds

### Requirement: Skill and agent assets remain executable in source and dist modes
The migrated runtime SHALL package agent definitions, shared canonical skill packages, governed script manifests, Node-executable skill script entries, and related references so that runtime execution can resolve the intended canonical skill assets in both source and dist modes while exposing only the governed skill surface to agents and end users.

#### Scenario: Governed runtime surface resolves shared canonical skill assets and script manifests
- **WHEN** the runtime builds the available skill set for an agent
- **THEN** it MUST resolve execution against canonical skill assets packaged under `apps/agent-backend/assets/skills/**`
- **AND** it MUST continue to resolve agent definitions from `apps/agent-backend/assets/agents/**`
- **AND** it MUST include only skills that are approved through the managed skill governance layer for that agent surface
- **AND** any executable automation for those skills MUST be derived from canonical governed script manifests rather than from free-form shell text in `SKILL.md`

#### Scenario: Skill tool denies unmanaged or unapproved skills
- **WHEN** an execution requests a skill that exists in canonical assets but is not approved in the governed surface for the current request
- **THEN** the runtime MUST deny the skill-tool load for that skill
- **AND** the runtime MUST avoid exposing the raw skill body through the governed execution path

#### Scenario: Dist build preserves governed skill execution
- **WHEN** the dist package is assembled and later executes an approved governed skill
- **THEN** any runtime-sensitive canonical skill references, governed script manifests, and Node-executable script entries MUST still resolve to the dist layout expected by the released package
- **AND** governed skill approval MUST continue to apply in dist mode

### Requirement: Browser proxying and service-side auth lookup remain distinct
The migrated system SHALL continue to support browser access through same-origin proxy routes while requiring the backend service to use an explicit configured auth base URL for server-to-server current-user lookup.

#### Scenario: Browser access uses same-origin API namespaces
- **WHEN** the frontend calls backend APIs in the migrated product
- **THEN** browser traffic MUST remain compatible with same-origin proxy access to `/agent/api/*` and `/web/api/*`

#### Scenario: Service auth lookup uses configured backend address
- **WHEN** the migrated agent backend validates the current user
- **THEN** it MUST call the configured web-backend base URL for `/web/api/auth/me` instead of assuming a browser-relative proxy path

### Requirement: Runtime metadata SHALL expose governed skill surfaces
The runtime SHALL expose governed skill metadata to agent detail, bootstrap, and execution-planning surfaces so that runtime behavior matches managed skill policy for the current agent binding and lifecycle state, and SHALL include the metadata foundation's canonical passthrough fields in those surfaces without changing runtime behavior.

#### Scenario: Agent detail returns only published bound skills with governed identity and canonical passthrough metadata
- **WHEN** the frontend or another client requests agent detail for a governed agent surface
- **THEN** the runtime MUST return only managed skills that are `published` and bound for that surface
- **AND** each returned skill MUST contain the governed user-visible name resolved for that agent surface rather than raw canonical skill identity
- **AND** each returned skill MUST include any available canonical passthrough metadata mirrored from the canonical `SKILL.md`

#### Scenario: Planner candidate skills follow published approval
- **WHEN** the runtime selects candidate skills for planning or build execution
- **THEN** it MUST choose candidates from the governed visible skill set that is both `published` and bound for the current request
- **AND** draft or unbound skills MUST NOT appear as planner candidates for governed runtime users

#### Scenario: Upload or overwrite reset hides skill until publication
- **WHEN** a canonical skill package is uploaded or overwritten and the managed skill resets to `draft`
- **THEN** subsequent bootstrap, governed discovery, and execution authorization paths MUST treat that skill as unavailable
- **AND** the runtime MUST keep that skill out of governed runtime surfaces until the administrator explicitly republishes it

#### Scenario: Execution catalog includes canonical passthrough metadata without policy activation
- **WHEN** the runtime builds an execution catalog or agent definition for a governed skill surface
- **THEN** it MUST include the canonical metadata fields mirrored by the metadata foundation when those fields are present
- **AND** it MUST preserve omitted optional metadata as absent in the execution surface
- **AND** it MUST NOT treat the presence of `allowed-tools`, `user-invocable`, `disable-model-invocation`, `model`, `effort`, or `context` as a behavior change in this change

### Requirement: Runtime session metadata SHALL support preview-rich workbench history rails
The runtime SHALL expose session-list metadata that is sufficient for the frontend to render a preview-rich history rail, identify each session's local activity state, perform explicit session deletion flows for idle and active sessions, and clear deletable historical sessions in bulk for the active agent while preserving the currently excluded session and any active sessions.

#### Scenario: Session list includes preview-ready metadata and local activity state
- **WHEN** a client requests the session list for an agent
- **THEN** each returned session item MUST include a stable one-line preview string suitable for history-rail display
- **AND** each returned session item MUST continue to identify the session, title, and update timing needed for rail ordering and selection
- **AND** each returned session item MUST include enough session-local activity metadata for the frontend to distinguish idle, running, stop-pending, and unresolved pending-question sessions

#### Scenario: Idle session deletion removes persisted session state
- **WHEN** a client issues a confirmed delete for a session that does not currently have an active run or an unresolved pending question
- **THEN** the runtime MUST delete the persisted session record for that user and agent
- **AND** the runtime MUST remove persisted messages, summaries, plans, interactions, and session metadata that belong exclusively to that deleted session

#### Scenario: Running or stop-pending session deletion succeeds without waiting for terminal completion
- **WHEN** a client issues a confirmed delete for a session that currently has an active run or is waiting for stop convergence
- **THEN** the runtime MUST accept the delete instead of rejecting it with an occupancy conflict
- **AND** the runtime MUST remove persisted messages, summaries, plans, interactions, and session metadata that belong exclusively to that deleted session
- **AND** the runtime MUST request cancellation of the associated run if one is still active

#### Scenario: Awaiting-question session deletion succeeds and clears pending interaction state
- **WHEN** a client issues a confirmed delete for a session that currently has an unresolved pending question and no active run
- **THEN** the runtime MUST accept the delete instead of rejecting it with an occupancy conflict
- **AND** the runtime MUST remove the persisted pending interaction together with the rest of that session's persisted state
- **AND** the runtime MUST release any local occupancy state that marks the session as awaiting a question response

#### Scenario: Deleted session id cannot be recreated by stale writes
- **WHEN** a stale run, interaction continuation, protocol-state update, plan write, summary write, or session-metadata write arrives after that session has been deleted
- **THEN** the runtime MUST reject that session-scoped write for the deleted `sessionId`
- **AND** the runtime MUST NOT recreate the session record or any session-owned derived data from that stale write

#### Scenario: Bulk history clear removes every deletable historical session for the active agent
- **WHEN** a client issues a confirmed bulk-clear request for an active agent with an excluded current session id
- **THEN** the runtime MUST delete every persisted idle session for that authenticated user and active agent except the excluded session
- **AND** the runtime MUST preserve any session that currently has an active run or an unresolved pending question
- **AND** the runtime MUST remove persisted messages, summaries, plans, interactions, and session metadata that belong exclusively to each deleted session

#### Scenario: Bulk history clear can preserve no current session when none is excluded
- **WHEN** a client issues a confirmed bulk-clear request for an active agent without providing an excluded session id
- **THEN** the runtime MUST treat every persisted idle session for that authenticated user and active agent as a deletable target
- **AND** the runtime MUST preserve any session that currently has an active run or an unresolved pending question
- **AND** the runtime MUST return a successful response when those idle targets are removed

#### Scenario: Bulk history clear reports the deletion and preservation outcome
- **WHEN** the runtime completes a bulk-clear history request
- **THEN** the response MUST identify how many sessions were deleted for that request
- **AND** the response MUST include the excluded session id when one was preserved
- **AND** the response MUST identify which active session ids were skipped from deletion

### Requirement: Runtime workspace metadata SHALL support workspace sidebar entry and minimal workspace opening
The runtime SHALL expose `user + agent` scoped workspace metadata and supported file-open/save contracts that are sufficient for the frontend to render the right-side workspace sidebar as `upload` and `project` trees, open supported files for review or editing, save editable files in place, and recover runtime-written project files without introducing user-visible file version management in this change.

#### Scenario: Workspace metadata can populate grouped tree nodes
- **WHEN** a client requests workspace metadata for the current authenticated user and selected agent
- **THEN** the runtime MUST return enough structured metadata to render `upload` and `project` groupings together with file and folder tree nodes
- **AND** each node MUST expose a stable frontend identifier together with the workspace-relative path or label needed for display and later interaction

#### Scenario: Workspace metadata uses `upload` and `project` labels
- **WHEN** the runtime shapes grouped workspace metadata for the sidebar
- **THEN** uploaded user materials MUST be grouped under the user-facing label `upload`
- **AND** runtime-written or manually created workspace files and folders MUST be grouped under the user-facing label `project`

#### Scenario: Workspace metadata is not keyed by session title
- **WHEN** the client switches between multiple sessions for the same user and agent
- **THEN** the runtime MUST continue to resolve the same workspace metadata scope for that `user + agent` pair
- **AND** the runtime MUST NOT require the workspace heading or root grouping to be derived from a session title

#### Scenario: Opening a supported workspace file returns an editor-capable payload with writability
- **WHEN** a client opens a supported workspace file from the sidebar or a referenced artifact result
- **THEN** the runtime MUST return the file descriptor and content payload needed for the frontend to render that file in the workspace editor
- **AND** the returned payload MUST identify the supported file mode, workspace-relative path, source, and whether that file is writable

#### Scenario: Saving an editable workspace file updates the current file in place
- **WHEN** a client saves updates to an editable workspace file in either `upload` or `project` within the current `user + agent` workspace
- **THEN** the runtime MUST persist the new file content against that same workspace file
- **AND** the runtime MUST NOT require the client to create or choose a visible versioned copy

#### Scenario: Runtime-written project files are recoverable through workspace metadata
- **WHEN** a runtime tool successfully writes a file into the current scoped workspace `project/` root
- **THEN** the runtime MUST register that file as a `project` workspace entry that can later appear in the sidebar and be opened through the normal workspace file flow
- **AND** the workspace-visible label for that entry MUST preserve the file's full relative path inside the scoped `project/` root

### Requirement: Uploaded files SHALL become reusable workspace entries for the current `user + agent` workspace
The runtime SHALL treat uploaded files as reusable editable `upload` workspace entries so that uploaded assets can appear in the workspace sidebar, preserve their original filenames or relative paths, participate in later workspace-opening flows across sessions for the same `user + agent` workspace, and accept in-place saves.

#### Scenario: Upload response can be associated with the active agent workspace
- **WHEN** a user uploads one or more supported files for the active workbench flow
- **THEN** the runtime MUST return metadata that can be associated with the current `user + agent` workspace
- **AND** the frontend MUST be able to place those uploaded assets into the workspace sidebar without inventing transient identifiers client-side

#### Scenario: Uploaded entry preserves relative path and opens with the correct mode
- **WHEN** a user uploads a supported text, Markdown, or CSV file for the active workbench flow
- **THEN** the resulting workspace entry MUST preserve the user-visible relative path shown in the `upload` tree
- **AND** opening that entry later MUST still resolve the supported editor mode appropriate for that file content

#### Scenario: Uploaded upload files can be saved in place
- **WHEN** a client saves an uploaded workspace file in the current `user + agent` scope
- **THEN** the runtime MUST write the updated content back to that tracked upload path
- **AND** later workspace metadata and file-open requests MUST continue to resolve the same uploaded entry identity

#### Scenario: UTF-8 multipart filename remains readable across the workspace flow
- **WHEN** a client uploads a supported file whose multipart filename or relative path contains UTF-8 characters such as Chinese
- **THEN** the runtime MUST preserve that user-visible path without mojibake in the upload response, workspace metadata, and later file-open payloads
- **AND** the stored workspace entry MUST remain reachable through the normal scoped upload path derived from that readable path

#### Scenario: Different sessions can recover the same uploaded workspace entries
- **WHEN** the user opens different persisted sessions for the same active agent
- **THEN** the runtime MUST allow the frontend to recover the same `user + agent` workspace entries for sidebar rendering across those sessions

### Requirement: Runtime workspace storage SHALL be isolated by `user + agent`
The runtime SHALL isolate workspace files, generated artifacts, and workspace metadata by the authenticated user and selected agent rather than mixing them in a single global workspace bucket.

#### Scenario: Different users do not share the same agent workspace
- **WHEN** two different authenticated users use the same agent
- **THEN** their uploaded files, generated files, and workspace metadata MUST remain isolated from each other

#### Scenario: Different agents do not share the same user workspace
- **WHEN** the same authenticated user uses two different agents
- **THEN** each agent MUST resolve an independent workspace scope for `upload`, `project`, and workspace metadata

### Requirement: Runtime session-message APIs SHALL preserve protocol message state for the workbench
The runtime SHALL expose session-message payloads and protocol-state update behavior that allow the workbench to recover and persist interactive protocol messages for a session, including richer structured UI state such as form values, list selections, table state, and persisted message overrides.

#### Scenario: Session history returns protocol payload and protocol state
- **WHEN** a client requests session message history for a session that contains a persisted assistant protocol message
- **THEN** the runtime MUST return that message as a protocol-capable message view
- **AND** the message view MUST include any persisted protocol UI state for that message when such state exists

#### Scenario: Protocol state update persists for a specific session message
- **WHEN** a client updates protocol UI state for a valid session message
- **THEN** the runtime MUST persist that protocol state against the addressed session message
- **AND** later reads of the same session message MUST return the updated protocol state

#### Scenario: Rich structured protocol state is preserved without lossy narrowing
- **WHEN** a client persists nested protocol state for form, selection, table, or message-override recovery
- **THEN** the runtime MUST preserve that structured protocol state without flattening it into a note-only representation
- **AND** subsequent reads MUST return enough structure for the frontend to restore the interactive protocol view

### Requirement: Runtime SHALL persist hidden injected skill-context messages separately from visible tool traces
The runtime SHALL allow governed skill loads to inject canonical skill content into session history as hidden skill-context messages that remain available to subsequent model turns and session recovery without appearing as ordinary user-visible assistant chat bubbles.

#### Scenario: Successful skill load persists both trace and hidden context
- **WHEN** `skill:skill` successfully loads an approved governed skill
- **THEN** the runtime MUST persist the normal successful tool trace for that invocation
- **AND** the runtime MUST also persist a separate hidden skill-context message containing the canonical skill content for later context reuse

#### Scenario: Subsequent turns receive hidden skill context
- **WHEN** a later model turn is built from session history after a successful `skill:skill` invocation
- **THEN** the runtime MUST include the persisted hidden skill-context message in the model-visible session message pool
- **AND** the runtime MUST NOT require the model to recover that skill context by reparsing an old tool summary string

#### Scenario: Failed skill load does not persist hidden skill context
- **WHEN** `skill:skill` fails because the skill is missing, denied, or invalid
- **THEN** the runtime MUST NOT persist a hidden skill-context message for that failed invocation

### Requirement: Runtime session history views SHALL hide runtime-only skill-context messages from the workbench
The runtime SHALL keep hidden skill-context messages available for internal context reconstruction while excluding them from the ordinary session-history view returned to the workbench.

#### Scenario: Workbench history omits hidden skill-context messages
- **WHEN** a client requests session message history for a session that contains persisted hidden skill-context messages
- **THEN** the runtime MUST exclude those hidden skill-context messages from the returned ordinary session-history view
- **AND** the returned visible message stream MUST continue to contain the normal user-visible text, protocol, and result messages

#### Scenario: Session recovery still retains hidden skill-context messages internally
- **WHEN** the runtime later rebuilds context for the same persisted session
- **THEN** it MUST still be able to read the hidden skill-context messages from internal session storage
- **AND** the omission from the workbench history view MUST NOT remove those messages from internal context reconstruction

### Requirement: Runtime SHALL expose planner decision APIs that keep session plan state authoritative
The runtime SHALL allow the workbench to approve or revise the current plan through a session-scoped plan-decision API while keeping session plan state authoritative on the backend.

#### Scenario: Approving a plan updates session planner/build state
- **WHEN** a client submits an `approve` decision for a valid session plan
- **THEN** the runtime MUST persist that plan decision
- **AND** the returned session metadata MUST reflect the resulting approved plan state and active primary agent mode

#### Scenario: Revising a plan keeps the session in planning mode
- **WHEN** a client submits a `revise` decision for a valid session plan
- **THEN** the runtime MUST persist that decision
- **AND** the returned session metadata MUST keep the session in planner mode with a draft-style plan state

#### Scenario: Runtime rejects approval while planning questions remain unresolved
- **WHEN** a client submits an `approve` decision for a plan that still contains unresolved planning questions
- **THEN** the runtime MUST reject that approval request
- **AND** the runtime MUST avoid mutating the session into build mode for that blocked decision

### Requirement: Runtime run results SHALL expose structured outputs needed for rich workbench messages
The runtime SHALL preserve structured terminal result metadata and canonical persisted message metadata so that the workbench can distinguish protocol outputs, structured domain results, and structured runtime failures without reparsing raw assistant text.

#### Scenario: Completed run returns protocol output distinctly
- **WHEN** a run completes with protocol output
- **THEN** the terminal run result MUST identify that output as protocol-capable rather than only plain text

#### Scenario: Completed run returns structured domain result distinctly
- **WHEN** a run completes with a structured domain result such as row preview data or an artifact reference
- **THEN** the terminal run result MUST identify that structured result distinctly from plain text
- **AND** the runtime MUST preserve the structured payload needed by the frontend to render a richer message surface
- **AND** artifact references MUST continue to preserve the file identity fields needed by the frontend to open the referenced workspace file through the existing artifact entry point

#### Scenario: Persisted short-circuit structured message remains distinguishable after reload
- **WHEN** session history is later loaded for a run that previously completed with a short-circuit structured output
- **THEN** the runtime MUST return that assistant message as a structured message view rather than only a plain text message
- **AND** the workbench MUST be able to recover the same protocol or domain-result shape without reparsing a raw JSON text bubble

#### Scenario: Failed run returns structured runtime failure metadata
- **WHEN** a run terminates in error
- **THEN** the runtime MUST include structured runtime failure metadata in its terminal failure contract
- **AND** the client MUST be able to distinguish that structured failure context from a generic text-only error string

### Requirement: Runtime SHALL expose stable protocol action contracts for workbook-coupled flows
The runtime SHALL expose stable protocol action contracts for workbook-coupled flows so the workbench can distinguish executable workbook actions from generic protocol tools.

#### Scenario: Workbook-coupled tool action exposes the tool identifier and structured input
- **WHEN** a runtime flow emits a workbook-coupled protocol tool action such as gateway invocation or row modification
- **THEN** the emitted protocol action MUST identify the governed tool route through its tool identifier
- **AND** the emitted action MUST preserve the structured tool input needed by the frontend to decide whether it can execute that action in the current workbench context

#### Scenario: Protocol output remains distinguishable from plain text when workbook actions are present
- **WHEN** a completed run returns a protocol output that includes workbook-coupled actions
- **THEN** the terminal run result MUST continue to identify that output as protocol-capable
- **AND** the runtime MUST preserve the full structured action payload instead of collapsing it into plain text

### Requirement: Runtime migration SHALL preserve the current newui frontend contract
The system SHALL migrate `agent-V2-base` backend capabilities into `apps/agent-backend` without breaking the current `newui` frontend contract that is already consumed by `apps/web`, including the structured short-circuit result path used by the workbench.

#### Scenario: Workspace APIs remain available after backend capability migration
- **WHEN** the migrated `apps/agent-backend` starts successfully
- **THEN** it MUST continue to expose the current workspace-related endpoints used by `apps/web`
- **AND** the runtime MUST continue to return workspace payloads in the `tasks -> groups -> files` structure expected by the current workbench

#### Scenario: Stream and terminal message contracts remain frontend-compatible for structured short-circuit outputs
- **WHEN** the current `newui` frontend invokes the migrated runtime through `/agent/api/agent/run`
- **THEN** the runtime MUST continue to emit stream and terminal events compatible with the current frontend conversation flow
- **AND** protocol or domain-result short-circuit runs MUST NOT require the frontend to consume raw JSON assistant text deltas in order to render the final structured message correctly

### Requirement: Runtime migration SHALL preserve the current project auth context
The system SHALL keep `apps/agent-backend` aligned with the current repository authentication and authorization context instead of adopting the source repository's reduced auth lookup model.

#### Scenario: Current-user lookup preserves role-aware auth context
- **WHEN** the migrated agent backend resolves the current authenticated user
- **THEN** it MUST remain compatible with the current repository auth response shape that includes role-aware user context
- **AND** backend migration MUST NOT require the runtime to fall back to a `userId`-only auth contract

### Requirement: Runtime devlogs SHALL support backend file persistence without requiring frontend log UI
The system SHALL add devlog file persistence and redaction to `apps/agent-backend` while keeping log persistence independent from any migrated frontend log-view experience.

#### Scenario: Devlogs are written to redacted JSONL files
- **WHEN** file-based runtime logging is enabled for the migrated backend
- **THEN** the runtime MUST append devlog entries to service-side JSONL files
- **AND** the runtime MUST apply configured sensitive-data redaction before those entries are written to disk

#### Scenario: Log persistence does not require log-view frontend assets
- **WHEN** the backend migration is applied
- **THEN** devlog file persistence MUST work without introducing a dedicated frontend log-view page or frontend log-view runtime into the current repository

### Requirement: Runtime SHALL consume upstream `/chat/completions` responses as incremental streams
The runtime SHALL process upstream model responses from `/chat/completions` incrementally instead of waiting for a complete JSON payload before continuing execution.

#### Scenario: Text output is assembled from upstream stream chunks
- **WHEN** the runtime issues a model request to an upstream provider that returns text deltas as a stream
- **THEN** the runtime MUST incrementally assemble those deltas into the in-flight assistant output
- **AND** the runtime MUST preserve the final assembled assistant text for terminal result construction

#### Scenario: Tool calls are assembled from upstream stream chunks
- **WHEN** the upstream provider streams tool call identifiers, names, or argument fragments across multiple chunks
- **THEN** the runtime MUST incrementally assemble the complete tool call payload before tool execution continues
- **AND** the runtime MUST avoid executing a partial or malformed tool call assembled from incomplete fragments

#### Scenario: Final stream metadata closes the model step
- **WHEN** the upstream stream reaches its terminal finish signal
- **THEN** the runtime MUST derive the final finish reason and terminal model-step payload from the assembled stream state
- **AND** the runtime MUST avoid requiring a second non-streaming fetch to finalize the same model step

### Requirement: Runtime SHALL apply watchdog timeout semantics to streaming model requests
The runtime SHALL treat model-request timeout handling as watchdog-based progress monitoring using only explicit first-byte and idle timeout thresholds rather than a default hard deadline on total elapsed duration.

#### Scenario: Missing first chunk triggers first-byte timeout
- **WHEN** the runtime starts an upstream streaming model request and no valid stream chunk arrives within the configured first-byte timeout window
- **THEN** the runtime MUST fail that model request as a timeout
- **AND** the resulting runtime failure MUST remain distinguishable from an HTTP error or explicit user cancellation

#### Scenario: Healthy stream is not terminated solely by elapsed duration
- **WHEN** an upstream streaming model request continues to deliver valid incremental progress over time
- **THEN** the runtime MUST allow that request to continue beyond the previous whole-request elapsed duration threshold
- **AND** the runtime MUST NOT terminate that healthy stream solely because cumulative elapsed time has grown large

#### Scenario: Stream stall triggers idle timeout
- **WHEN** an upstream streaming model request has already started but then fails to make further valid progress within the configured idle timeout window
- **THEN** the runtime MUST fail that model request as a timeout
- **AND** the runtime MUST classify the failure separately from a healthy long-running stream

### Requirement: Runtime SHALL fail explicitly when streaming execution ends without a valid completed result
The runtime SHALL surface streaming interruptions, timeouts, and cancellations as explicit terminal failures instead of converting partial upstream output into a successful completed assistant message.

#### Scenario: Upstream stream interruption does not become a successful assistant result
- **WHEN** an upstream model stream terminates unexpectedly before a valid terminal model-step result is assembled
- **THEN** the runtime MUST surface that run as an error or cancellation through its terminal event contract
- **AND** the runtime MUST NOT persist the partial upstream output as a successfully completed assistant final message

#### Scenario: Timeout failure remains visible to the browser-facing stream contract
- **WHEN** a first-byte timeout or idle timeout terminates a model stream
- **THEN** the runtime MUST emit a browser-facing terminal failure through the existing `/agent/api/agent/run` event flow
- **AND** the runtime MUST preserve structured runtime error metadata for the client

### Requirement: Runtime SHALL preserve the current browser-facing stream contract while adopting upstream streaming
The runtime SHALL keep the current browser-facing `/agent/api/agent/run` NDJSON contract compatible while changing the internal model-call path to true upstream streaming.

#### Scenario: Existing workbench client remains compatible with phase-1 upstream streaming
- **WHEN** the current `apps/web` workbench invokes `/agent/api/agent/run` after the upstream streaming change is applied
- **THEN** the runtime MUST continue to emit NDJSON events compatible with the current client parser
- **AND** the runtime MUST preserve the existing terminal result structure expected by the workbench

### Requirement: Runtime tool deny policy SHALL coexist with governed runtime surfaces
The system SHALL support a runtime tool deny list in addition to the governed skill and agent surfaces already enforced by the current repository, but shipped deletion of a runtime tool MUST be expressed by removing that tool from shipped configuration and runtime fallback semantics rather than by keeping a deny-only tombstone.

#### Scenario: Denied runtime tools are excluded without removing governed skill metadata
- **WHEN** the runtime catalog is built with configured denied tools
- **THEN** denied tools MUST be excluded from tool catalog and invocation
- **AND** governed agent metadata and governed skill metadata MUST continue to be resolved through the current managed skill governance path

#### Scenario: Governed skill approval remains authoritative when deny list is empty
- **WHEN** no runtime tool deny entries are configured
- **THEN** the runtime MUST continue to enforce governed skill visibility and approval exactly through the managed skill governance layer
- **AND** the absence of denied tools MUST NOT broaden the governed skill surface beyond what the managed registry allows

#### Scenario: Configured local grep deny stays authoritative
- **WHEN** runtime configuration places `local:grep` in the runtime tool deny list
- **THEN** the runtime MUST exclude that local tool from catalog and invocation
- **AND** the local tool provider implementation MAY remain packaged for future re-enablement through configuration changes

#### Scenario: Deleted transform_rows does not survive through deny-only semantics
- **WHEN** the shipped runtime no longer supports `transform_rows` on gateway or MCP paths
- **THEN** shipped configuration MUST remove `transform_rows` from gateway/MCP default configuration and enabled tool lists
- **AND** shipped runtime deny configuration MUST NOT retain `gateway:*:transform_rows` or `mcp:*:transform_rows` entries as the primary deletion mechanism
- **AND** the runtime MUST NOT rely on deny-only masking to represent that deleted tool as removed

### Requirement: Runtime SHALL expose workspace-scoped `local:grep` for executor agents
The runtime SHALL expose a `local:grep` tool for executor agents as the canonical local content-search capability and SHALL stop exposing `local:search_in_files` once this change is applied.

#### Scenario: Executor tool catalog exposes only `local:grep` for local content search
- **WHEN** the runtime builds the local tool catalog for an execution-capable agent surface
- **THEN** it MUST expose `local:grep` as the local content-search tool
- **AND** it MUST NOT expose `local:search_in_files` as a separate searchable local tool

#### Scenario: Planner surface does not gain `local:grep`
- **WHEN** the runtime builds the tool surface for planner-only execution contexts
- **THEN** it MUST NOT newly expose `local:grep` to that planner surface as part of this change

### Requirement: Runtime SHALL execute `local:grep` with vendored ripgrep assets
The runtime SHALL execute `local:grep` with a vendored `ripgrep 15.1.0` binary packaged under `apps/agent-backend/assets/vendor/ripgrep/` and SHALL select the binary by supported runtime target instead of depending on a host-installed `rg`.

#### Scenario: Linux runtime selects vendored ripgrep by platform, architecture, and libc
- **WHEN** `local:grep` executes on Linux
- **THEN** the runtime MUST resolve the vendored `rg` binary using `platform + arch + libc`
- **AND** it MUST select the matching target directory for the current runtime before invoking the search

#### Scenario: Windows runtime selects vendored ripgrep by platform and architecture
- **WHEN** `local:grep` executes on Windows
- **THEN** the runtime MUST resolve the vendored `rg.exe` binary using `platform + arch`
- **AND** it MUST invoke that vendored binary instead of a PATH-discovered `rg`

#### Scenario: macOS runtime selects vendored ripgrep by platform and architecture
- **WHEN** `local:grep` executes on macOS
- **THEN** the runtime MUST resolve the vendored `rg` binary using `platform + arch`
- **AND** it MUST invoke that vendored binary instead of a PATH-discovered `rg`

#### Scenario: Dist build preserves vendored ripgrep assets
- **WHEN** `apps/agent-backend` is assembled into dist output
- **THEN** the packaged assets MUST include the vendored `ripgrep` target directories required by this change
- **AND** `local:grep` in dist mode MUST resolve those packaged assets without reading from the source tree

### Requirement: Runtime SHALL keep `local:grep` scoped to the current workspace
The runtime SHALL limit `local:grep` to paths rooted in the current resolved workspace scope and SHALL reject paths that escape that workspace.

#### Scenario: Search path is rooted to workspace scope
- **WHEN** `local:grep` executes with no explicit base path
- **THEN** it MUST search from the current resolved workspace root
- **AND** it MUST treat the search as scoped to that workspace only

#### Scenario: Escaping the workspace is rejected
- **WHEN** `local:grep` receives a base path or derived path that resolves outside the current workspace root
- **THEN** the runtime MUST fail the tool invocation explicitly
- **AND** it MUST NOT run `rg` against that out-of-workspace path

### Requirement: Runtime SHALL surface explicit `local:grep` diagnostics
The runtime SHALL emit runtime logs that make vendored `ripgrep` selection and `local:grep` execution diagnosable, and SHALL distinguish successful no-match results from execution failures.

#### Scenario: Ripgrep selection is logged before or during first use
- **WHEN** the runtime selects the vendored binary for `local:grep`
- **THEN** it MUST log the resolved platform, architecture, libc classification when applicable, target triple, binary path, and `rg --version` result

#### Scenario: Successful no-match search is not reported as a failure
- **WHEN** `local:grep` completes successfully and `rg` returns no matches
- **THEN** the runtime MUST record that invocation as a successful no-match outcome
- **AND** it MUST NOT classify that result as a tool execution failure

#### Scenario: Ripgrep execution failure is reported with diagnostics
- **WHEN** vendored `rg` is missing, not executable, fails to start, times out, or exits with an unexpected non-zero code
- **THEN** the runtime MUST fail `local:grep` explicitly
- **AND** the runtime logs MUST include the resolved binary path, invocation context, exit code or signal when available, and stderr details when available

### Requirement: Runtime SHALL expose active-file-aware invocation context for workspace follow-up actions
The runtime SHALL allow follow-up Agent actions to include an explicit active workspace file so the current file can be treated as the primary file context while preserving the wider workspace as supplementary context.

#### Scenario: Active file is accepted as primary follow-up context
- **WHEN** a client starts a follow-up Agent run from the workspace flow and includes an active workspace file
- **THEN** the runtime MUST preserve that active file distinctly from the broader workspace file list
- **AND** downstream execution MUST be able to treat that active file as the primary file context for the run

#### Scenario: Workspace file list remains available as supplementary context
- **WHEN** a client submits an active file together with other available workspace files
- **THEN** the runtime MUST preserve the wider workspace file list for supplementary context
- **AND** the presence of those additional files MUST NOT erase the identity of the active file

### Requirement: Runtime SHALL recognize and update standard MML headers for supported text files
The runtime SHALL recognize standard leading MML header comments in supported text files and SHALL support round-tripping those parsed values through file-open and file-save operations.

#### Scenario: Opening a text file with a standard MML header returns parsed MML metadata
- **WHEN** a supported text file begins with a header comment of the form `/* ME TYPE=<type>, Version=<version> */`
- **THEN** the runtime MUST identify that file as MML-capable for the workspace editor
- **AND** the file-open payload MUST include the parsed `网元类型` and `网元版本` values needed by the frontend toolbar

#### Scenario: Saving updated MML metadata rewrites the file header
- **WHEN** a client saves an opened MML file after changing the parsed `网元类型` or `网元版本`
- **THEN** the runtime MUST rewrite the leading MML header comment to reflect the saved values
- **AND** later opens of that file MUST return the updated parsed metadata

#### Scenario: Text file without a recognized MML header remains plain text
- **WHEN** a supported text file does not contain a recognized leading MML header comment
- **THEN** the runtime MUST treat that file as a normal text file for workspace opening
- **AND** the runtime MUST NOT fabricate MML toolbar metadata for that file

### Requirement: Runtime model selection MUST align with the source repository provider registry semantics
The system SHALL resolve active runtime models using the same semantic rules as the source repository, including normalization of legacy global active-model configuration into the current runtime selection contract.

#### Scenario: Legacy active model name resolves to the configured source-baseline model
- **WHEN** configuration provides a legacy global active-model reference that points to an entry in the model registry
- **THEN** the runtime MUST resolve that reference to the corresponding model configuration
- **AND** the resolved runtime metadata MUST expose that model as the active global model source

#### Scenario: Agent-specific model binding overrides the global active model
- **WHEN** a specific agent has its own model binding and a separate global active model also exists
- **THEN** the runtime MUST use the agent-specific binding for that agent
- **AND** the global active model MUST remain the fallback for agents without an explicit binding

### Requirement: Runtime MUST fully support the source-baseline huaweiHisApi provider contract
The system SHALL preserve the source repository's `huaweiHisApi` provider contract across configuration, runtime request construction, and runtime metadata exposure.

#### Scenario: Huawei HIS API model entry preserves custom headers and custom body
- **WHEN** the configured active model is a `huaweiHisApi` registry entry with custom headers and custom request body fields
- **THEN** the runtime MUST send those configured headers and body fields with the provider request
- **AND** the runtime MUST avoid replacing them with an unrelated provider alias during execution

#### Scenario: Runtime metadata exposes the configured huaweiHisApi provider identity
- **WHEN** a client requests runtime bootstrap or runtime model metadata while `huaweiHisApi` is active
- **THEN** the runtime MUST report `huaweiHisApi` as the configured provider identity
- **AND** the metadata MUST remain consistent with the resolved active model entry

### Requirement: Auth-integrated runtime origin policy MUST match the source SSO baseline
The system SHALL apply the source repository's wildcard-capable same-origin allowlist behavior to the agent-backend routes that rely on authenticated browser session context.

#### Scenario: Agent backend accepts configured wildcard development origins
- **WHEN** the agent-backend same-origin policy is configured with the same wildcard origin pattern used by the source repository baseline
- **THEN** matching authenticated browser requests to state-changing agent routes MUST be accepted
- **AND** the runtime MUST keep the authenticated request flow intact

#### Scenario: Agent backend still rejects unmatched origins
- **WHEN** an authenticated browser request targets a protected state-changing agent route from an origin outside the configured wildcard or exact allowlist
- **THEN** the runtime MUST reject the request explicitly
- **AND** the route MUST NOT continue into agent execution

### Requirement: Shared runtime dependencies MUST align with the source repository baseline for overlapping packages
The system SHALL use the source repository's declared versions as the dependency baseline for overlapping third-party packages used by `apps/web`, `apps/web-backend`, and `apps/agent-backend`.

#### Scenario: Overlapping package versions follow the source baseline
- **WHEN** a third-party package is used in both the current repository and the source repository
- **THEN** the current repository MUST adopt the source repository's declared version for that overlapping package
- **AND** the affected package manifests and lockfiles MUST reflect that baseline after alignment

#### Scenario: Dependency alignment does not require monorepo structure rollback
- **WHEN** overlapping package versions are aligned to the source baseline
- **THEN** the current repository MUST keep its existing `apps/*` package structure
- **AND** dependency alignment MUST NOT require restoring the source repository's full monorepo layout

### Requirement: Runtime SHALL separate tool runtime retry from model recovery
The runtime SHALL process build/agent loop tool failures through two distinct policies: runtime retry for transient invocation failures and model recovery for recoverable semantic failures surfaced back to the model.

#### Scenario: Transient invocation failure uses runtime retry
- **WHEN** a tool invocation fails with a transient failure type that is eligible for automatic retry
- **THEN** the runtime MUST retry that same invocation without requiring the model to emit a new tool call
- **AND** the retry count MUST be tracked against that invocation rather than the whole run

#### Scenario: Recoverable semantic failure uses model recovery
- **WHEN** a tool invocation fails with a recoverable semantic or validation-style failure
- **THEN** the runtime MUST emit a structured tool error payload back into the active conversation
- **AND** the model MUST be allowed to issue a corrected follow-up tool call within the configured recovery budget for that tool-call chain

#### Scenario: Local parameter and path failures stay recoverable even when surfaced as execution errors
- **WHEN** a local tool failure can be normalized to a parameter, path, payload, or command-syntax problem using tool-specific classification rules
- **THEN** the runtime MUST classify that failure as model-recoverable even if the provider returned a coarse execution failure type
- **AND** the runtime MUST avoid terminating the run before the model receives a structured opportunity to correct the input

### Requirement: Runtime SHALL scope model recovery budgets per tool-call chain
The runtime SHALL count model recovery attempts per tool-call chain instead of sharing a single recovery budget across the entire run.

#### Scenario: One failed tool chain does not consume another chain's recovery budget
- **WHEN** tool chain A exhausts its model recovery budget
- **THEN** a later independent tool chain B MUST still receive its own configured model recovery budget

#### Scenario: Repeated failures within one tool chain consume only that chain's budget
- **WHEN** the model repeatedly corrects and reissues the same tool intent within one tool-call chain
- **THEN** the runtime MUST decrement only that chain's model recovery counter
- **AND** the runtime MUST stop granting additional recovery once that chain reaches the configured limit

#### Scenario: Initial recoverable failure does not consume correction-call budget
- **WHEN** a tool-call chain is first opened by a recoverable failure
- **THEN** the runtime MUST NOT decrement that chain's model recovery budget for the initial failure itself
- **AND** the runtime MUST only decrement the budget when the model issues a subsequent correction call within the same chain

#### Scenario: Switching to another tool closes the current chain
- **WHEN** the model receives a recoverable failure for tool A and then invokes tool B instead of immediately re-invoking tool A
- **THEN** the runtime MUST treat the tool A chain as closed
- **AND** any later invocation of tool A MUST start a new chain with a fresh model recovery budget

### Requirement: Runtime SHALL expose tool failure policy in config.json
The runtime SHALL load tool failure policy configuration from `apps/agent-backend/config.json` so operators can control recovery counts, retry counts, and loop-detection thresholds without code changes.

#### Scenario: Configured recovery and retry limits are loaded at startup
- **WHEN** `config.json` defines tool recovery, runtime retry, or loop detection values
- **THEN** the runtime MUST apply those configured values to build/agent loop execution

#### Scenario: Invalid tool failure policy configuration fails fast
- **WHEN** `config.json` provides invalid numeric or boolean values for tool failure policy
- **THEN** runtime startup MUST fail with an explicit configuration error
- **AND** the runtime MUST NOT silently fall back to hidden defaults for those invalid fields

#### Scenario: Model recovery configuration counts correction calls
- **WHEN** `config.json` defines the model recovery budget
- **THEN** the configured value MUST represent the number of correction calls the model may issue after an initial recoverable failure
- **AND** the runtime MUST NOT interpret that value as a total-failures counter

### Requirement: Runtime SHALL restrict automatic retry to eligible idempotent tools
The runtime SHALL only perform automatic runtime retry for tool invocations that are explicitly marked as eligible for runtime retry and safe to repeat.

#### Scenario: Eligible idempotent tool is retried automatically
- **WHEN** an idempotent tool that supports runtime retry fails with a transient failure
- **THEN** the runtime MUST retry that invocation up to the configured invocation retry limit

#### Scenario: Non-idempotent or ineligible tool is not retried automatically
- **WHEN** a tool is not marked as eligible for runtime retry
- **THEN** the runtime MUST NOT automatically replay that invocation
- **AND** the runtime MUST either surface the failure for model recovery or fail the run according to the failure policy

#### Scenario: Non-idempotent command execution is not retried automatically
- **WHEN** `local:run_command` fails due to timeout, non-zero exit, or other non-idempotent execution outcomes
- **THEN** the runtime MUST NOT perform automatic runtime retry for that invocation
- **AND** the runtime MUST classify the failure for either terminal stop or model recovery according to the configured failure policy

### Requirement: Runtime SHALL stop tool-call chains that show no progress
The runtime SHALL detect repeated failure patterns within a tool-call chain and stop execution once configured no-progress thresholds are met.

#### Scenario: Same failure pattern triggers explicit stop
- **WHEN** the same tool-call chain repeats the same normalized tool failure pattern up to the configured same-failure threshold
- **THEN** the runtime MUST terminate that chain
- **AND** the resulting runtime failure metadata MUST indicate that execution stopped because no progress was detected

#### Scenario: Same outcome with varied parameters also triggers stop
- **WHEN** the same tool-call chain keeps producing the same normalized failure outcome while varying arguments
- **THEN** the runtime MUST terminate that chain once the configured same-outcome threshold is reached
- **AND** the runtime MUST avoid continuing to spend additional loop steps on that repeated no-progress sequence

#### Scenario: No-progress thresholds count only correction calls
- **WHEN** a recoverable failure first opens a tool-call chain
- **THEN** that initial failure MUST NOT count toward same-failure or same-outcome thresholds
- **AND** only subsequent correction calls within that chain MUST advance the no-progress counters

### Requirement: Runtime SHALL expose a stable notes companion field for select question interactions
The runtime SHALL attach exactly one optional `notes` text field to every pending question interaction that contains at least one `select` field so users can submit supplementary context without changing the structured primary answer.

#### Scenario: Select question payload includes one optional notes field
- **WHEN** the runtime creates a pending question interaction whose visible fields include at least one `select` field
- **THEN** the interaction payload MUST include exactly one additional optional text field for `notes`
- **AND** that `notes` field MUST remain semantically separate from the primary answer field or fields

#### Scenario: Notes field does not replace the structured primary answer
- **WHEN** the runtime validates a reply for a pending select-based question interaction
- **THEN** any submitted `notes` value MUST be treated only as supplementary context
- **AND** the runtime MUST continue to require the structured primary answer fields according to the question contract

### Requirement: Runtime SHALL normalize only lossless string-array question options before validation
The runtime SHALL attempt explicit normalization of malformed `local:question` select options only when the original input can be converted into the canonical options-array shape without guessing.

#### Scenario: Valid JSON string array is normalized explicitly
- **WHEN** a `local:question` invocation provides `options` as a string whose content is a valid JSON array of option objects
- **THEN** the runtime MUST parse that string into the canonical options-array shape before building the question interaction
- **AND** the runtime MUST record an explicit warning or diagnostic that normalization occurred

#### Scenario: Non-lossless malformed options skip normalization
- **WHEN** a `local:question` invocation provides malformed `options` that cannot be parsed as a valid JSON array without guessing
- **THEN** the runtime MUST NOT silently coerce those options into a canonical array
- **AND** the runtime MUST continue into the explicit degraded-question path instead of pretending the original structure was valid

### Requirement: Runtime SHALL degrade exhausted local-question validation loops into plain assistant text
The runtime SHALL convert repeated `local:question` validation failures into an explicit degraded question interaction once the configured model-recovery budget for that same tool-call chain is exhausted, instead of leaving the user at a terminal runtime tool failure or switching the session back to ordinary plain-text chat input.

#### Scenario: Exhausted question validation loop becomes a degraded pending interaction
- **WHEN** a `local:question` tool-call chain fails with `question_validation_error`
- **AND** the runtime reaches `model_recovery_exhausted` for that same chain
- **THEN** the runtime MUST create exactly one degraded pending question interaction rather than appending only a plain assistant text message
- **AND** the degraded interaction MUST remain resumable through the existing reply / reject continuation path

#### Scenario: Degraded interaction preserves user-readable context from the failed question
- **WHEN** the runtime creates a degraded question interaction after exhausting a `local:question` validation loop
- **THEN** the degraded payload MUST preserve the original user-facing `prompt`
- **AND** the payload MUST include a user-readable explanation that structured question collection failed
- **AND** the payload MUST include any reference option text that can be extracted reliably from the malformed input without guessing hidden structure

#### Scenario: Degraded interaction uses text answer plus notes
- **WHEN** the runtime creates a degraded question interaction
- **THEN** the degraded payload MUST expose a required text field for the primary `answer`
- **AND** the degraded payload MUST expose exactly one optional `notes` field for supplementary context

#### Scenario: User reply after degradation resumes through question continuation
- **WHEN** a user replies to the degraded question interaction
- **THEN** the runtime MUST validate and persist that reply through the same question-response continuation path used for other pending interactions
- **AND** the runtime MUST NOT require the client to fall back to ordinary `/agent/run` input for that blocked session

### Requirement: Runtime SHALL generate deterministic chat-style summaries for pending question interactions
The runtime SHALL derive the assistant summary text for a pending question interaction from the trusted interaction payload by using stable formatting rules instead of model-generated phrasing or raw option expansion.

#### Scenario: Single text-field question summary identifies the requested input
- **WHEN** the runtime creates awaiting-interaction output for a pending question whose only primary answer field is a `text` field
- **AND** the user-facing prompt is missing or generic
- **THEN** the summary MUST identify the requested input by using that field's user-visible label
- **AND** the summary MUST end with a continuation cue that tells the user the run will continue after the answer is filled

#### Scenario: Single select-field question summary avoids option expansion
- **WHEN** the runtime creates awaiting-interaction output for a pending question whose only primary answer field is a `select` field
- **THEN** the summary MUST identify the requested choice by using the prompt or that field's user-visible label
- **AND** the summary MUST NOT enumerate the select options inside the assistant bubble

#### Scenario: Multi-field question summary enumerates all primary field labels
- **WHEN** the runtime creates awaiting-interaction output for a pending question with multiple primary answer fields
- **THEN** the summary MUST enumerate all primary field labels in the declared field order
- **AND** the summary MUST preserve the user-facing prompt when that prompt is available

#### Scenario: Supplementary notes field does not drive the summary
- **WHEN** a pending question interaction also contains an optional supplementary `notes` field
- **THEN** the runtime MUST exclude that `notes` field from the summary when at least one other primary answer field is present
- **AND** the summary MUST continue to describe the primary information needed to unblock the run

#### Scenario: Degraded question summary stays concise
- **WHEN** the runtime creates awaiting-interaction output for a degraded question interaction
- **THEN** the summary MUST identify the information the user needs to provide by using the trusted prompt or field labels
- **AND** the summary MUST NOT include the degraded failure reason or reference option list in the assistant bubble

#### Scenario: Summary falls back conservatively when trusted metadata is unusable
- **WHEN** trusted prompt and field-label metadata are both unavailable or unusable for a pending question interaction
- **THEN** the runtime MUST fall back to a generic waiting sentence
- **AND** it MUST still preserve the structured pending interaction payload for the question card and continuation flow

### Requirement: Runtime SHALL preserve separate machine-facing and user-facing tool failure payloads
The runtime SHALL provide structured failure data suitable for model recovery while continuing to expose readable runtime failure metadata to frontend consumers. Machine-facing tool error payloads written back into the active conversation MUST prioritize concise correction signals over runtime control metadata. For terminal failures, the runtime SHALL continue to return explicit runtime failure metadata except for the special case where an exhausted `local:question` validation loop is converted into a degraded pending interaction.

#### Scenario: Recoverable tool failure emits minimal correction payload
- **WHEN** a recoverable tool failure is written back into the conversation
- **THEN** the payload MUST include a stable error code, recoverable flag, retry-oriented metadata, and a concise error summary sufficient for the model to attempt correction
- **AND** the payload MUST avoid including unrelated runtime control metadata that does not help the model choose the next corrective tool call

#### Scenario: Tool error payload may include structured delta hints when reliably known
- **WHEN** the runtime or tool-specific validator can determine a stable field-level correction hint for a recoverable tool failure
- **THEN** the machine-facing payload MAY include structured delta fields such as failing field, expected shape, actual shape, or a short fix hint
- **AND** those fields MUST be omitted rather than guessed when the runtime cannot determine them reliably

#### Scenario: Runtime control metadata remains available outside the conversation payload
- **WHEN** a recoverable or terminal tool failure produces stop, retry, or chain diagnostics
- **THEN** the runtime MUST preserve that diagnostic metadata in runtime error and observability surfaces where applicable
- **AND** the runtime MUST NOT require the active conversation payload to mirror those same control fields

#### Scenario: Terminal runtime failure preserves user-facing summary for non-degraded failures
- **WHEN** execution terminates because tool retry, model recovery, or no-progress limits are reached
- **AND** the terminating branch is not a degraded `local:question` validation exhaustion path
- **THEN** the runtime MUST return structured runtime failure metadata with a frontend-consumable summary
- **AND** the returned metadata MUST remain distinguishable from the machine-facing tool error payload used inside the conversation loop

#### Scenario: Terminal runtime failure exposes explicit stop reason
- **WHEN** execution terminates because the runtime reached a terminal tool failure, recovery exhaustion, or no-progress stop
- **THEN** the runtime MUST return a structured stop reason in terminal runtime failure metadata
- **AND** that metadata MUST identify the tool name and normalized failure code that caused the stop

#### Scenario: Tool denial stays terminal and visible in logs
- **WHEN** a tool invocation fails with a deny-style outcome such as `TOOL_DENIED`
- **THEN** the runtime MUST terminate that tool invocation as a terminal failure instead of offering model recovery
- **AND** the runtime MUST record log fields sufficient to identify that the stop was caused by a deny decision and where that deny originated

### Requirement: Runtime SHALL emit observability data for tool retry and recovery behavior
The runtime SHALL record observability signals for automatic retries, model recovery attempts, no-progress stops, and tool-level failure distribution.

#### Scenario: Successful or failed retries emit retry observability
- **WHEN** runtime retry is attempted for a tool invocation
- **THEN** the runtime MUST record the retry attempt count and final outcome in its logs or metrics

#### Scenario: No-progress stop emits diagnostic context
- **WHEN** a tool-call chain is terminated due to no-progress detection
- **THEN** the runtime MUST record the tool identity, normalized failure outcome, and threshold that triggered the stop

### Requirement: Runtime SHALL persist short-circuit structured outputs as canonical assistant messages
The runtime SHALL persist each short-circuit structured output, including protocol, domain-result, and awaiting-interaction question pauses, as exactly one canonical assistant message that preserves trusted structured payloads separately from model-facing summary text.

#### Scenario: Protocol short-circuit creates one canonical assistant message
- **WHEN** a runtime tool short-circuits a run with protocol output
- **THEN** the runtime MUST persist exactly one assistant message for that structured output
- **AND** the runtime MUST NOT also persist a second assistant message that only mirrors the model's raw `tool_calls` content from the same step

#### Scenario: Domain-result short-circuit creates one canonical assistant message
- **WHEN** a runtime tool short-circuits a run with a structured domain result such as an artifact reference
- **THEN** the runtime MUST persist exactly one assistant message for that structured output
- **AND** that same message MUST remain the authoritative `assistantMessageId` returned by the terminal run result

#### Scenario: Awaiting-interaction short-circuit creates one canonical assistant message
- **WHEN** a runtime tool short-circuits a run with a pending question interaction
- **THEN** the runtime MUST persist exactly one assistant message for that structured output
- **AND** that same message MUST remain the authoritative `assistantMessageId` returned by the terminal run result

#### Scenario: Canonical short-circuit message separates structured payload from summary text
- **WHEN** the runtime persists a short-circuit structured output
- **THEN** it MUST preserve the structured payload in an explicit structured form rather than only as raw text JSON
- **AND** any companion assistant text used for previews, persisted history, or replay filtering MUST be generated from trusted tool or interaction data rather than copied from the model's raw response text

### Requirement: Runtime SHALL provide a user-isolated workspace write tool
The runtime SHALL provide a `write` tool that writes text content only into the current authenticated `user + agent` workspace under the scoped `project/` subtree instead of the product repository workspace.

#### Scenario: Write path is resolved under the scoped output root
- **WHEN** a tool call requests a relative path such as `reports/final/result.txt`
- **THEN** the runtime MUST resolve that write under the current `user + agent` workspace `project/` root
- **AND** the runtime MUST reject absolute paths or normalized paths that escape that scoped project root

#### Scenario: Parent directories are created automatically
- **WHEN** a write tool call targets a nested relative path whose parent directories do not yet exist
- **THEN** the runtime MUST create those parent directories automatically before writing
- **AND** the write MUST succeed without requiring a separate directory-creation tool call

#### Scenario: Rewriting the same canonical path updates one tracked workspace file
- **WHEN** the write tool is called again for the same canonical relative path in the same `user + agent` workspace
- **THEN** the runtime MUST overwrite that existing workspace file instead of registering a duplicate project entry
- **AND** the workspace file identity used for sidebar opening and artifact references MUST remain stable for that path

#### Scenario: Successful write returns a workspace-openable artifact reference
- **WHEN** the write tool completes successfully
- **THEN** the runtime MUST return a structured `artifact_ref` result that identifies the written workspace file
- **AND** that reference MUST be sufficient for the frontend to open the file through the existing artifact-result workflow

#### Scenario: Write outputs follow the same workspace aging policy
- **WHEN** workspace project cleanup removes expired project files for a `user + agent` workspace
- **THEN** files created through the write tool MUST follow the same aging window as other project files
- **AND** expiration MUST remove the persisted file content and its tracked workspace entry together

#### Scenario: Write logs omit file body content
- **WHEN** the write tool starts, succeeds, or fails
- **THEN** runtime logs for that tool call MUST record metadata only rather than the raw file body or a body preview
- **AND** the metadata MUST still preserve enough information to identify the requested path, operation status, and traceable request context

### Requirement: Runtime SHALL enforce the governed workbench composer upload contract
The runtime SHALL enforce the file-format contract exposed by the authenticated workbench composer so that accepted uploads become reusable workspace entries and unsupported uploads fail explicitly.

#### Scenario: Composer upload accepts governed text and table formats
- **WHEN** a client uploads a `.txt`, `.md`, or `.csv` file through the authenticated workbench composer flow
- **THEN** the runtime MUST accept that file into the current `user + agent` workspace
- **AND** the resulting upload MUST remain available through the existing reusable workspace-entry and file-open flows

#### Scenario: Unsupported composer upload is rejected explicitly
- **WHEN** a client uploads a file with an unsupported extension through the same composer upload flow
- **THEN** the runtime MUST reject that upload with an explicit validation failure
- **AND** the runtime MUST NOT create a reusable workspace entry for the rejected file

#### Scenario: Accepted txt uploads remain compatible with later MML-aware file opening
- **WHEN** the runtime accepts a `.txt` upload from the composer flow
- **THEN** the stored workspace file MUST remain compatible with the existing plain-text and MML-aware open-path rules
- **AND** the governed composer contract MUST still be expressed to users as `TXT / MD / CSV` rather than as a separate `MML` upload class

### Requirement: Runtime skill preload surfaces SHALL use canonical parsed skill metadata
The runtime SHALL use the same validated canonical skill metadata for governed skill-tool discovery text, session skill preload instructions, planner skill summaries, and managed canonical metadata sync.

#### Scenario: Skill tool lists canonical skill name and description
- **WHEN** the runtime builds the governed skill-tool discovery description for available skills
- **THEN** each listed skill MUST use the canonical parsed `name` and `description` from its `SKILL.md`
- **AND** the runtime MUST NOT inject manifest-id or empty-string fallback metadata into that discovery surface

#### Scenario: Session and planner preload surfaces stay aligned
- **WHEN** the runtime injects available skill metadata into session preload instructions and planner skill summaries
- **THEN** those surfaces MUST use the same canonical parsed skill metadata as the skill catalog
- **AND** the runtime MUST NOT show different `name` or `description` values for the same canonical skill across those preload surfaces

### Requirement: Invalid canonical skill metadata SHALL be excluded from runtime discovery
The runtime SHALL exclude canonical skills with invalid or incomplete required metadata from governed runtime discovery surfaces instead of exposing degraded metadata.

#### Scenario: Invalid canonical skill is absent from runtime discovery
- **WHEN** a canonical skill package has invalid frontmatter or is missing required canonical metadata
- **THEN** the runtime MUST exclude that skill from available runtime skill discovery and preload surfaces
- **AND** the runtime MUST NOT advertise that skill with synthesized fallback metadata

#### Scenario: Managed canonical metadata mirrors only valid canonical skills
- **WHEN** managed skill governance syncs canonical metadata from packaged skills
- **THEN** the canonical name and description fields MUST reflect the parsed `SKILL.md` metadata for valid skills only
- **AND** invalid canonical skill metadata MUST NOT be mirrored as if it were a valid canonical skill identity

### Requirement: Runtime SHALL persist resolved question interactions as canonical session messages
The runtime SHALL append a normalized `user` session message for each answered or rejected question interaction before the continuation run re-enters the model loop, so later turns can replay the resolved interaction from session history instead of relying on a transient interaction side channel.

#### Scenario: Answered question is appended to session history before continuation
- **WHEN** a client submits a valid reply for a pending question interaction
- **THEN** the runtime MUST mark that interaction as answered
- **AND** the runtime MUST append a normalized `user` message in the same session that records the authoritative resolved interaction context before continuation is allowed to start

#### Scenario: Rejected question is appended to session history before continuation
- **WHEN** a client explicitly rejects a pending question interaction
- **THEN** the runtime MUST mark that interaction as rejected
- **AND** the runtime MUST append a normalized `user` message in the same session that records the rejected interaction context before continuation is allowed to start

#### Scenario: Later model replay uses persisted session history rather than temporary continuation injection
- **WHEN** a build-phase or planner-phase model step is prepared after a question interaction has already been resolved
- **THEN** the runtime MUST source that resolved interaction context from persisted session messages in the same session
- **AND** the runtime MUST NOT require a temporary continuation-only message injection to reconstruct the resolved answer for model replay

### Requirement: Runtime SHALL keep awaiting-interaction placeholders out of future model replay
The runtime SHALL treat awaiting-interaction assistant summaries and awaiting-interaction tool snapshots as technical waiting artifacts rather than as authoritative future conversation context, even when the visible summary text is dynamically generated from the pending question payload.

#### Scenario: Waiting artifact does not become future model context
- **WHEN** the runtime builds model input for a session that previously paused on a pending question
- **THEN** the runtime MUST exclude the assistant waiting-summary text and awaiting-interaction tool snapshot from replay based on structured awaiting-interaction markers rather than exact string matching
- **AND** the persisted resolved `user` message for that interaction chain MUST remain the authoritative semantic replay signal

### Requirement: Runtime SHALL reject ordinary run input while a pending question blocks the session
The runtime SHALL refuse new ordinary conversation input for a session that still contains an unresolved question interaction, so the session cannot fork into a competing task chain before the blocking interaction is resolved.

#### Scenario: Pending question blocks a free-form run request
- **WHEN** a session still has a pending question interaction and a client submits ordinary `/agent/run` conversation input for that same session
- **THEN** the runtime MUST reject that run request explicitly
- **AND** the runtime MUST NOT start a competing model run that bypasses the pending interaction

#### Scenario: Dedicated continuation path remains allowed for the blocked session
- **WHEN** the same session resumes through the dedicated reply or reject flow followed by a continuation run that references the resolved interaction
- **THEN** the runtime MUST allow that continuation path
- **AND** the resumed execution MUST remain in the same session rather than being treated as an unrelated new conversation

### Requirement: Runtime SHALL emit structured diagnostics for model request transport failures
The runtime SHALL record structured backend diagnostics for failed model requests so operators can distinguish failures that occur before response headers arrive from failures that happen after the upstream response has already started.

#### Scenario: Pre-response transport failure retains nested cause context
- **WHEN** a model request fails before the runtime receives an upstream HTTP response
- **THEN** the runtime MUST record a structured failure log that identifies the failure as occurring before response headers were received
- **AND** that log MUST include the provider, model name, request URL, run and turn identifiers, request latency, and any available nested transport-cause fields needed to diagnose the failure source

#### Scenario: Post-response failure remains distinguishable from pre-response transport failure
- **WHEN** the runtime has already received upstream response metadata but the request later fails during stream consumption, protocol parsing, or watchdog handling
- **THEN** the runtime MUST record diagnostic fields that distinguish that failure stage from a pre-response transport failure
- **AND** the diagnostic output MUST preserve any available HTTP status or stream-stage context needed for later triage

### Requirement: Runtime SHALL attribute failed model latency to model timing summaries
The runtime SHALL preserve failed model-call latency in its run-level timing summary so long waits on unsuccessful model requests remain visible as model time rather than being reported only as uncategorized runtime overhead.

#### Scenario: Failed model request contributes to model timing summary
- **WHEN** a model request fails after spending measurable time in provider communication
- **THEN** the runtime MUST include that elapsed latency in the model portion of the run timing summary
- **AND** the same elapsed time MUST NOT be reported solely as `otherCostTime`

#### Scenario: Tool-only timing remains separate from failed model timing
- **WHEN** a run includes tool execution metrics in addition to a failed model request
- **THEN** the run timing summary MUST continue to report tool time separately from model time
- **AND** adding failed model latency attribution MUST NOT collapse tool latency into the model bucket

### Requirement: Runtime tool catalog SHALL NOT include `local:bash`
The runtime SHALL NOT register or expose a `local:bash` tool. The governed skill script execution path (`skill:exec`) replaces all need for arbitrary shell execution.

#### Scenario: Tool catalog does not include bash
- **WHEN** the runtime builds the tool catalog for any agent request
- **THEN** the catalog MUST NOT include `local:bash`
- **AND** no sandbox configuration or seatbelt profile MUST exist in the runtime

#### Scenario: Runtime config does not carry sandbox fields
- **WHEN** the runtime configuration is loaded
- **THEN** it MUST NOT contain `sandbox` configuration fields (backend, timeoutSeconds, cpuSeconds, memoryMb)
- **AND** `RUNTIME_SANDBOX_*` environment variable overrides MUST NOT be recognized

#### Scenario: Governed script tools remain available without bash
- **WHEN** the current governed skill surface contains approved script tools
- **THEN** the runtime MUST expose governed script tools through `skill:exec`
- **AND** it MUST NOT require operators to enable any form of `local:bash` for script execution

### Requirement: Runtime SHALL provide an internal MML schema contract for table-view editing
The runtime SHALL preserve `/agent/api/files/mml-schema` as a frontend-compatible internal MML schema contract keyed by `networkType` and `networkVersion`, while sourcing the canonical schema from `web-backend` instead of owning a local MML rule catalog.

#### Scenario: Schema lookup returns command metadata for supported network context
- **WHEN** a client requests MML schema for a supported `networkType` and `networkVersion`
- **THEN** the runtime MUST fetch that schema from the canonical `web-backend` route
- **AND** it MUST return command-level and parameter-level metadata needed for MML table projection through the existing `/agent/api/files/mml-schema` response contract

#### Scenario: Unsupported network context returns no schema without breaking the workspace flow
- **WHEN** a client requests MML schema for a `networkType` and `networkVersion` pair that has no active canonical ruleset
- **THEN** the runtime MUST return an unavailable or empty schema result rather than fabricated command metadata
- **AND** the response MUST still allow the frontend to degrade the table view safely to read-only

#### Scenario: Conditional requiredness remains distinguishable from unconditional requiredness
- **WHEN** the runtime relays schema metadata for a parameter whose canonical workbook rule marks it as conditionally required
- **THEN** the returned parameter contract MUST preserve that parameter as conditionally required through `requiredMode` and condition metadata
- **AND** the runtime MUST NOT collapse that parameter into unconditional `required` semantics while proxying the canonical schema

### Requirement: Runtime SHALL proxy browser-authenticated MML schema lookup to web-backend
The runtime SHALL keep browser access on `/agent/api/files/mml-schema`, but it SHALL act only as a compatibility proxy and SHALL forward the authenticated browser session context to `web-backend` for canonical schema evaluation.

#### Scenario: Compatibility proxy forwards browser session context
- **WHEN** an authenticated browser request reaches `/agent/api/files/mml-schema`
- **THEN** the runtime MUST forward the relevant browser auth context needed by `web-backend` to evaluate the request
- **AND** the runtime MUST NOT require a separate new service token solely for MML schema proxying

#### Scenario: Compatibility proxy does not require local rule bootstrap
- **WHEN** `agent-backend` starts after this ownership migration
- **THEN** the runtime MUST NOT bootstrap or own a local Excel-backed MML rule database for schema lookup
- **AND** successful schema responses MUST remain available through the proxy as long as the canonical `web-backend` rule catalog is available

### Requirement: Runtime logging SHALL persist structured backend-only category files
The runtime SHALL persist operational logs through an explicit backend logger that records stable `category` and `component` fields at write time and writes redacted JSONL entries into category-specific daily files for shell-based inspection.

#### Scenario: Enabled runtime file logging writes entries into category-specific daily files
- **WHEN** runtime file logging is enabled and a module emits a persisted log entry
- **THEN** the runtime MUST append that entry to a JSONL file under `apps/agent-backend/data/logs/<YYYY-MM-DD>/<category>.jsonl`
- **AND** each persisted entry MUST include at least timestamp, level, category, component, message, and any scoped runtime identifiers needed for debugging

#### Scenario: Persisted runtime logs do not rely on console interception
- **WHEN** a runtime module needs a persisted operational log entry
- **THEN** the runtime MUST record that entry through the structured logger contract rather than through intercepted `console.*` output
- **AND** persisted file logging MUST remain functional without a console bridge

### Requirement: Structured logging migration SHALL keep config changes logging-only
The structured logging migration SHALL limit `apps/agent-backend/config.json` changes to logging-related settings so unrelated runtime behavior does not change as part of the logging rollout.

#### Scenario: Logging migration does not alter unrelated runtime configuration
- **WHEN** operators adopt config updates required by the structured logging migration
- **THEN** those updates MUST be limited to logging-related fields such as `runtime.providerLogging`, `runtime.fileLogging`, or documented logging-specific successors
- **AND** auth, model, tool, sandbox, workspace, and other unrelated configuration semantics MUST remain unchanged by this change

### Requirement: Runtime workspace file APIs SHALL support explicit downloads within the current user-agent scope
The runtime SHALL expose a scoped workspace file download contract that allows an authenticated client to download tracked upload and output files for the current `user + agent` workspace.

#### Scenario: Client downloads an uploaded or output workspace file in scope
- **WHEN** an authenticated client issues a workspace file download request for a tracked file in the current `user + agent` scope
- **THEN** the runtime MUST return the corresponding file as an attachment response
- **AND** that response MUST include the authoritative download filename for that workspace file

#### Scenario: Runtime rejects download outside the current workspace scope
- **WHEN** a client attempts to download a workspace file that does not belong to the current authenticated `user + agent` scope
- **THEN** the runtime MUST reject that download request explicitly
- **AND** the runtime MUST NOT disclose file contents from another scope

#### Scenario: Missing file storage fails explicitly during download
- **WHEN** the runtime resolves a tracked workspace file entry but cannot read the corresponding stored file content
- **THEN** the download request MUST fail explicitly
- **AND** the runtime MUST NOT fabricate a synthetic attachment response that hides the storage failure

### Requirement: Runtime workspace file APIs SHALL support explicit deletion within the current user-agent scope
The runtime SHALL expose an explicit workspace file deletion contract that allows the authenticated client to delete uploaded workspace files and registered `output` files within the current `user + agent` workspace scope.

#### Scenario: Client deletes an uploaded or output workspace file
- **WHEN** an authenticated client issues a delete request for a workspace file in the current `user + agent` scope
- **THEN** the runtime MUST delete the corresponding workspace file metadata entry
- **AND** the runtime MUST delete the corresponding file from the scoped workspace storage when that file exists

#### Scenario: Runtime rejects deletion outside the current workspace scope
- **WHEN** a client attempts to delete a file that does not belong to the current authenticated `user + agent` scope
- **THEN** the runtime MUST reject that delete request
- **AND** the runtime MUST NOT delete metadata or files belonging to another scope

### Requirement: Runtime workspace metadata SHALL reflect deletions immediately
After a workspace file is deleted successfully, the runtime SHALL make the resulting workspace metadata authoritative for later workspace list and open flows.

#### Scenario: Deleted file no longer appears in workspace metadata
- **WHEN** a workspace file deletion succeeds
- **THEN** subsequent workspace metadata reads for the same `user + agent` scope MUST omit that file entry

#### Scenario: Deleted file can no longer be opened through the normal workspace file flow
- **WHEN** a workspace file has already been deleted successfully
- **THEN** later open requests for that file MUST fail explicitly
- **AND** the runtime MUST NOT fabricate a fallback file payload for the deleted entry

### Requirement: Runtime deletion flow SHALL preserve explicit failure visibility
The runtime SHALL keep deletion failures explicit so that clients can surface real file-state problems instead of silently degrading behavior.

#### Scenario: File system or persistence failure aborts the delete response
- **WHEN** the runtime cannot complete the workspace file deletion because file removal or metadata persistence fails
- **THEN** the delete request MUST fail explicitly
- **AND** the runtime MUST NOT return a synthetic success response that hides the failure

### Requirement: Runtime workspace file APIs SHALL support constrained rename within the current user-agent scope
The runtime SHALL expose an explicit workspace file rename contract that allows the authenticated client to rename uploaded workspace files and path-addressed `project` workspace files within the current `user + agent` scope while preserving file identity.

#### Scenario: Client renames an uploaded workspace file in scope
- **WHEN** an authenticated client renames an uploaded workspace file in the current `user + agent` scope using a new basename with the same extension
- **THEN** the runtime MUST keep that file's stable identity fields unchanged
- **AND** the runtime MUST preserve the file's existing parent directory while replacing only the final basename segment

#### Scenario: Client renames a path-addressed project file in scope
- **WHEN** an authenticated client renames a writable project workspace file that has a stored `relativePath`
- **THEN** the runtime MUST preserve that file's existing parent directory within the scoped project root
- **AND** the runtime MUST replace only the final basename segment with the new basename

#### Scenario: Runtime rejects rename outside the current workspace scope
- **WHEN** a client attempts to rename a workspace file that does not belong to the current authenticated `user + agent` scope
- **THEN** the runtime MUST reject that rename request
- **AND** the runtime MUST NOT mutate metadata or disk files belonging to another scope

### Requirement: Runtime workspace metadata SHALL support explicit working folders
The runtime SHALL persist explicit `project` folder entries so the frontend can render empty folders, preserve stable folder identity, and reconcile folder renames without inventing synthetic placeholder nodes client-side.

#### Scenario: Project folder entry appears in workspace metadata without child files
- **WHEN** a user creates an empty folder under `project`
- **THEN** the runtime MUST persist a tracked workspace folder entry for that directory
- **AND** later workspace metadata reads MUST continue to expose that folder even when it contains no files

#### Scenario: Project folder metadata coexists with path-derived parent folders
- **WHEN** workspace metadata includes explicit project-folder entries together with files nested under deeper paths
- **THEN** the runtime MUST expose enough relative-path and node-type information for the frontend to build one coherent tree
- **AND** the runtime MUST NOT require the frontend to guess which empty folders are authoritative

### Requirement: Runtime workspace APIs SHALL support explicit working file and folder creation
The runtime SHALL expose explicit creation contracts for `project` files and folders within the current `user + agent` scope.

#### Scenario: Client creates a project folder
- **WHEN** an authenticated client requests creation of a folder under a valid `project` parent directory
- **THEN** the runtime MUST create that folder under the scoped project storage root
- **AND** the runtime MUST return tracked workspace metadata for the created folder

#### Scenario: Client creates a supported blank project file
- **WHEN** an authenticated client requests creation of a blank `TXT`、`MD`、or `MML` file under a valid `project` parent directory
- **THEN** the runtime MUST create that file with the correct extension under the scoped project storage root
- **AND** the runtime MUST return an editor-openable workspace file descriptor for the created file

#### Scenario: Create request fails explicitly on collision
- **WHEN** the requested project file or folder path already exists in the current `user + agent` workspace
- **THEN** the runtime MUST reject the create request explicitly
- **AND** the runtime MUST NOT auto-generate a different fallback name

### Requirement: Runtime workspace folder APIs SHALL support constrained rename within the current user-agent scope
The runtime SHALL expose an explicit folder-rename contract that allows the authenticated client to rename tracked `project` folders within the same parent directory while preserving descendant content.

#### Scenario: Client renames a tracked project folder in scope
- **WHEN** an authenticated client renames a tracked `project` folder using a new basename within the same parent directory
- **THEN** the runtime MUST keep that folder's stable identity unchanged
- **AND** the runtime MUST update descendant file and folder paths to resolve under the renamed branch

#### Scenario: Runtime rejects project-folder rename outside the v1 boundary
- **WHEN** a client attempts to rename a tracked project folder using a path that changes its parent directory or collides with another tracked folder
- **THEN** the runtime MUST reject that rename request explicitly
- **AND** the runtime MUST leave the existing folder metadata and disk paths unchanged

### Requirement: Runtime workspace rename SHALL reject requests outside the v1 naming boundary
The runtime SHALL fail explicitly when a rename request attempts to exceed the v1 rename boundary instead of silently degrading or auto-correcting the request.

#### Scenario: Runtime rejects rename that changes directory or extension
- **WHEN** a client submits a rename target that contains a path separator or changes the file extension
- **THEN** the runtime MUST reject that rename request explicitly
- **AND** the runtime MUST leave the existing file metadata and disk file unchanged

#### Scenario: Runtime rejects case-only rename
- **WHEN** a client submits a rename target whose basename differs only by letter casing from the current basename
- **THEN** the runtime MUST reject that rename request explicitly
- **AND** the runtime MUST NOT perform a case-only rename as part of v1 behavior

#### Scenario: Runtime rejects legacy output rename
- **WHEN** a client attempts to rename an output workspace file that does not have a stored `relativePath`
- **THEN** the runtime MUST reject that rename request explicitly
- **AND** the runtime MUST continue to preserve that file's existing read compatibility behavior

#### Scenario: Runtime rejects rename target collision
- **WHEN** the rename target would collide with another tracked workspace file of the same kind in the same `user + agent` scope
- **THEN** the runtime MUST reject that rename request explicitly
- **AND** the runtime MUST NOT auto-generate an alternate target name

### Requirement: Runtime workspace rename SHALL keep metadata and storage consistent
The runtime SHALL keep workspace metadata and scoped file storage consistent across successful and failed rename attempts.

#### Scenario: Successful rename updates later metadata and open flows
- **WHEN** a workspace file rename succeeds
- **THEN** subsequent workspace metadata reads for that `user + agent` scope MUST expose the renamed file under its new path and file name
- **AND** later workspace open requests MUST resolve the file through that new path

#### Scenario: Persistence failure rolls the rename back to the old state
- **WHEN** the runtime has already renamed the disk file but cannot persist the updated workspace metadata
- **THEN** the rename request MUST fail explicitly
- **AND** the runtime MUST restore the previous tracked file path and metadata instead of returning a synthetic success result

### Requirement: Runtime SHALL expose configurable tool display names for user-visible execution surfaces
The runtime SHALL allow user-visible tool names to be configured independently from the underlying tool identifiers and SHALL use that configured mapping, together with governed agent-scoped skill names, when emitting execution metadata consumed by the workbench.

#### Scenario: Tool-started event prefers configured display name
- **WHEN** a tool invocation begins and the runtime emits a `tool.started` stream event
- **AND** the invoked tool has a configured display name for its full tool identifier such as `skill:read_asset`
- **THEN** the runtime MUST set `displayName` in that event to the configured user-visible name
- **AND** the runtime MUST NOT expose the raw normalized tool identifier in place of that configured name

#### Scenario: Skill-started event uses governed agent-scoped skill name
- **WHEN** a governed skill invocation begins for the current agent surface
- **THEN** the runtime MUST set `displayName` in the `tool.started` event to that agent binding's governed user-visible skill name
- **AND** the runtime MUST NOT emit the canonical skill name or `skillId` as the user-visible event label

#### Scenario: Tool-started event falls back for unmapped tools
- **WHEN** a tool invocation begins for a tool that does not have a configured display name
- **THEN** the runtime MUST still emit a `tool.started` event successfully
- **AND** the runtime MUST fall back to the existing normalized tool-name presentation rather than failing the run

### Requirement: Runtime bootstrap SHALL publish tool display-name mappings for frontend summary rendering
The runtime SHALL publish the configured tool display-name mapping through runtime bootstrap so the frontend can render completed-turn tool summaries with the same naming policy used by streaming events.

#### Scenario: Bootstrap returns configured tool display-name map
- **WHEN** a client requests runtime bootstrap for an active agent
- **THEN** the bootstrap payload MUST include the runtime tool display-name mapping keyed by full tool identifier
- **AND** that mapping MUST be sufficient for the client to resolve names for built-in runtime tools such as `local:*` and `skill:*`

#### Scenario: Bootstrap keeps user-visible naming stable across the same runtime config
- **WHEN** the runtime configuration has not changed between bootstrap and later tool execution
- **THEN** the tool display names emitted in `tool.started` events MUST remain consistent with the names published through bootstrap
- **AND** the runtime MUST avoid requiring the frontend to hardcode an alternate naming table for the same tool set

### Requirement: Runtime skill catalog SHALL support in-process canonical reload
The runtime SHALL rebuild canonical skill discovery and governed skill projections after successful admin upload, overwrite, or delete operations without requiring an `agent-backend` process restart.

#### Scenario: Upload reload makes the new canonical skill immediately discoverable
- **WHEN** an administrator successfully uploads a valid canonical skill package
- **THEN** the runtime MUST reload the canonical skill catalog before the admin API reports success
- **AND** subsequent governed admin or runtime metadata requests MUST observe the uploaded skill without restarting the backend service

#### Scenario: Delete reload removes the canonical skill from governed runtime surfaces
- **WHEN** an administrator successfully deletes a managed skill and its canonical package
- **THEN** the runtime MUST reload the canonical skill catalog before the admin API reports success
- **AND** subsequent governed runtime discovery and execution paths MUST treat that skill as unavailable without restarting the backend service

### Requirement: Runtime SHALL preserve workspace execution across transport disconnects
The runtime SHALL treat client transport loss as a recoverable observation failure rather than as an implicit stop signal, while preserving explicit stop behavior for user-driven cancellation and session-local activity recovery.

#### Scenario: Stream disconnect does not cancel the active session run
- **WHEN** the client stream for an active session run closes before that run reaches a terminal state
- **THEN** the runtime MUST keep that run alive
- **AND** the runtime MUST NOT treat connection closure by itself as a cancellation request

#### Scenario: Explicit stop cancels only the addressed session run
- **WHEN** the client issues an explicit stop or cancel request for a specific active session run
- **THEN** the runtime MUST cancel that run
- **AND** the runtime MUST release only that session's active state after the run reaches its terminal cancellation state

#### Scenario: Runtime bootstrap exposes current-session activity metadata
- **WHEN** the workbench requests runtime bootstrap for a session that currently has an active run or an unresolved pending question
- **THEN** the runtime bootstrap response MUST include whether that session is active
- **AND** the response MUST identify that session's activity state
- **AND** the response MUST include the active run id when a run is currently in flight

#### Scenario: Runtime bootstrap does not convert another session into a global block
- **WHEN** the workbench requests runtime bootstrap for a session that is idle while another session in the same `user + agent` workspace is active
- **THEN** the runtime MUST continue reporting the requested session as idle
- **AND** the runtime MUST NOT surface another session as a global owner that blocks new runs for the requested session

### Requirement: Runtime build execution SHALL inject a budgeted skill listing reminder
The runtime SHALL inject a model-facing skill listing reminder for build/executor requests as a conversation reminder message based on the governed skill set already available to the current request, and SHALL keep full skill bodies behind explicit `skill:skill` loading.

#### Scenario: Executor reminder lists governed skills with summary-only fields
- **WHEN** the runtime prepares a build/executor model invocation for a request that has governed `availableSkills`
- **THEN** it MUST inject a skill listing reminder message derived from that governed skill set
- **AND** each listed skill MUST be summarized only by canonical `name`, `description`, and `when-to-use` when present
- **AND** the reminder MUST NOT inline the full `SKILL.md` body or unrelated metadata fields
- **AND** the reminder MUST NOT be appended to the top-level system prompt body for that request

#### Scenario: Skill tool remains the full-skill loading path
- **WHEN** the runtime exposes the `skill` tool during the same request
- **THEN** the tool description MUST provide static usage guidance rather than inlining the current skill catalog
- **AND** a full `SKILL.md` body MUST be returned only after the model explicitly loads an approved skill through the existing `skill:skill` path

#### Scenario: Discovery remains explicitly disabled in the first listing change
- **WHEN** the runtime builds the skill listing reminder in this change
- **THEN** it MUST treat discovery mode as `disabled` and use the current governed `availableSkills` as the input set
- **AND** discovery mode MAY remain an internal diagnostic/logging field rather than a model-visible reminder line
- **AND** any skill omitted from the final reminder MUST be attributable to explicit budget trimming or skipping rather than hidden relevance filtering

### Requirement: Runtime skill listing budgeting SHALL be explicit and observable
The runtime SHALL apply an explicit bounded budget to skill listing reminders and SHALL emit structured logs that explain how the reminder was built, trimmed, skipped, and injected.

#### Scenario: Oversized skill summary is trimmed predictably
- **WHEN** a skill summary would exceed the configured single-entry or total reminder budget
- **THEN** the runtime MUST trim or skip that summary according to the listing budget policy
- **AND** it MUST preserve the skill identity needed for the model to request that skill explicitly later

#### Scenario: Listing injection emits budget diagnostics
- **WHEN** the runtime injects a skill listing reminder into a build/executor model request
- **THEN** it MUST emit structured logs that distinguish listing-built, entry-trimmed, and reminder-injected events
- **AND** those logs MUST expose the source skill count, included skill count, trimmed skill count, discovery mode, reminder budget size, and reminder injection surface needed to debug listing behavior

### Requirement: Runtime SHALL require explicit surviving gateway and MCP tool identifiers
The runtime SHALL require explicit tool identifiers for gateway and MCP invocation paths once deleted legacy default-tool semantics are removed.

#### Scenario: MCP invocation without tool fails explicitly
- **WHEN** an MCP invocation request reaches execution without an explicit `tool` value
- **THEN** the runtime MUST fail that invocation explicitly
- **AND** it MUST NOT fall back to a deleted or implicit default tool name

#### Scenario: Gateway and MCP configuration parsing does not restore transform_rows through defaults
- **WHEN** gateway or MCP configuration omits tool lists, omits legacy default-tool fields, or loads shipped config files with empty tool arrays
- **THEN** the parsed runtime configuration MUST NOT synthesize `transform_rows` as a fallback tool
- **AND** runtime bootstrap and tool catalog payloads MUST NOT expose `transform_rows` through parsed defaults

#### Scenario: Repository test and sample surfaces stop treating transform_rows as canonical
- **WHEN** backend tests or sample runtime configuration exercise gateway/MCP tool parsing or invocation
- **THEN** those tests and samples MUST use surviving neutral tool identifiers instead of `transform_rows`
- **AND** the repository MUST NOT use `transform_rows` as the canonical example of a supported runtime tool

### Requirement: Runtime model configuration SHALL support explicit upstream response mode
The runtime SHALL allow each configured model to explicitly declare whether upstream model calls use streaming mode. The `stream` field MUST be supported on single-model configurations resolved from `agent.defaultModel`, `agent.modelRegistry.*`, and `modelsByAgent`, and omitted `stream` values MUST default to streaming mode.

#### Scenario: Omitted stream mode keeps existing runtime behavior
- **WHEN** a resolved model configuration does not declare `stream`
- **THEN** the runtime MUST treat that model as `stream: true`
- **AND** the runtime MUST continue to issue upstream model requests in streaming mode for that model

#### Scenario: Explicit non-stream mode is preserved on the resolved model
- **WHEN** a resolved model configuration declares `stream: false`
- **THEN** the runtime MUST preserve that boolean on the resolved model configuration
- **AND** the runtime MUST use non-stream upstream requests for that model instead of forcing `stream: true`

### Requirement: Runtime provider client SHALL support both stream and non-stream OpenAI-compatible responses
The runtime SHALL parse OpenAI-compatible provider responses according to the resolved model's `stream` setting while preserving the same normalized execution result shape for downstream runtime code.

#### Scenario: Streaming mode continues to use SSE parsing
- **WHEN** the resolved model configuration is `stream: true`
- **THEN** the provider client MUST send `stream: true` in the upstream request body
- **AND** the provider client MUST continue to parse the upstream response as an SSE stream

#### Scenario: Non-stream mode parses JSON completion responses
- **WHEN** the resolved model configuration is `stream: false`
- **THEN** the provider client MUST send `stream: false` in the upstream request body
- **AND** the provider client MUST parse the upstream response body as a standard JSON completion payload
- **AND** the provider client MUST restore assistant text, finish reason, usage, and tool-call arguments into the same normalized result structure used by streaming mode

#### Scenario: Non-stream mode still requires usage
- **WHEN** the resolved model configuration is `stream: false`
- **AND** the upstream response omits usage
- **THEN** the provider client MUST fail the request explicitly instead of silently degrading token accounting

### Requirement: Non-stream mode SHALL preserve runtime compatibility boundaries
The runtime SHALL treat non-stream upstream mode as an internal provider-call detail and MUST NOT reinterpret retained streaming timeout fields as precise stream-stage guarantees in that mode.

#### Scenario: Workbench event contract remains unchanged for non-stream models
- **WHEN** a run uses a resolved model configuration with `stream: false`
- **THEN** the runtime MUST continue to emit the existing workbench-facing run events and terminal result structure
- **AND** the runtime MUST NOT expose a different frontend protocol solely because the upstream provider call was non-stream

#### Scenario: Streaming timeout fields remain compatibility fields in non-stream mode
- **WHEN** a resolved model configuration uses `stream: false`
- **THEN** the runtime MUST allow `streamFirstByteTimeoutMs` and `streamIdleTimeoutMs` to remain present on that model configuration
- **AND** the runtime MUST NOT treat those fields as guaranteeing true streaming-stage timeout semantics for that non-stream request

### Requirement: Runtime SHALL track active execution independently for each session within a shared workspace
The runtime SHALL admit concurrent runs for different sessions that share the same `user + agent` workspace, while keeping active-run and pending-question responsibility scoped to the owning session.

#### Scenario: Different sessions in the same shared workspace can run concurrently
- **WHEN** one session already has an active run for a given `user + agent` workspace and another session submits a new run for that same workspace
- **THEN** the runtime MUST admit the second session's run
- **AND** the runtime MUST track those sessions' active states independently

#### Scenario: The same session cannot start a second concurrent run
- **WHEN** a session already has an active run and that same session submits another run
- **THEN** the runtime MUST reject the second run with an explicit conflict response
- **AND** the runtime MUST NOT create a second concurrent run for that session

#### Scenario: Unresolved pending question blocks only the owning session
- **WHEN** a session has raised a pending question that still requires an answer or rejection
- **THEN** the runtime MUST reject ordinary new-run admission for that same session
- **AND** the runtime MUST continue allowing different sessions in the same shared workspace to start runs

#### Scenario: Different workspaces remain independently admissible
- **WHEN** two run requests target different workspace scopes because the authenticated user differs or the selected agent differs
- **THEN** the runtime MUST evaluate session activity independently for those scopes
- **AND** activity within one workspace MUST NOT block the other workspace from starting a run

### Requirement: Uploaded text files SHALL be normalized to UTF-8 before workspace persistence
The runtime SHALL detect the source encoding of supported uploaded text files and SHALL persist the normalized file content as UTF-8 within the scoped workspace upload store.

#### Scenario: UTF-8 text upload remains readable after persistence
- **WHEN** a user uploads a supported text, Markdown, CSV, or MML file whose content is already valid UTF-8
- **THEN** the runtime MUST persist that file as UTF-8 text in the scoped workspace upload path
- **AND** later open, save, and download flows MUST read back the same readable text content without mojibake

#### Scenario: BOM-prefixed Unicode text upload is normalized to UTF-8
- **WHEN** a user uploads a supported text file encoded as UTF-8 with BOM, UTF-16LE with BOM, or UTF-16BE with BOM
- **THEN** the runtime MUST detect the BOM-backed source encoding before workspace persistence
- **AND** the runtime MUST store the resulting file content as UTF-8 text without preserving the original BOM encoding in workspace storage

#### Scenario: GB18030-family Chinese text upload is normalized to UTF-8
- **WHEN** a user uploads a supported text file whose content is not valid UTF-8 but is valid GB18030-family Chinese text
- **THEN** the runtime MUST decode that file as GB18030-family text
- **AND** the runtime MUST persist the normalized content as UTF-8 text in the scoped workspace upload path

#### Scenario: Download returns normalized UTF-8 content
- **WHEN** a user downloads a previously uploaded supported text file that was normalized during upload
- **THEN** the runtime MUST return the UTF-8-normalized file bytes from workspace storage
- **AND** the runtime MUST NOT attempt to reconstruct or return the original pre-normalization byte encoding

### Requirement: Unsupported upload encodings SHALL fail explicitly
The runtime SHALL reject supported file uploads whose content cannot be reliably decoded as supported text encodings instead of persisting unreadable bytes that later open as mojibake.

#### Scenario: Unsupported text encoding upload is rejected
- **WHEN** a user uploads a supported file extension whose content is neither valid UTF-8, nor BOM-identified Unicode text, nor decodable supported GB18030-family text
- **THEN** the runtime MUST reject the upload with an explicit error response
- **AND** the runtime MUST NOT create or overwrite the scoped workspace upload entry for that file

#### Scenario: Non-text content disguised as a supported extension is rejected
- **WHEN** a user uploads binary or otherwise invalid non-text bytes using a supported text file extension
- **THEN** the runtime MUST fail the upload instead of storing the bytes as a workspace text file
- **AND** the error response MUST make it clear that the upload content is unsupported or not valid text

### Requirement: Local file editing SHALL match the normalized read_file text view
The agent backend SHALL ensure that `local:edit` matches `old_string` against the same newline-normalized text view exposed by `read_file`, so content copied from `read_file` remains editable across supported text line endings.

#### Scenario: Multi-line old_string from read_file matches a CRLF file
- **WHEN** `read_file` returns content for a text file stored with `\r\n` line endings
- **AND** the caller copies a multi-line `old_string` from that returned content without line-number prefixes
- **THEN** `local:edit` MUST evaluate that `old_string` against the same normalized text view used by `read_file`
- **AND** the replacement MUST succeed when the normalized content identifies a unique match

#### Scenario: LF files keep the existing exact-match behavior
- **WHEN** `read_file` returns content for a text file already stored with `\n` line endings
- **THEN** `local:edit` MUST preserve the existing exact string replacement behavior for the copied `old_string`
- **AND** successful edits MUST continue to report the correct replacement count

### Requirement: Local file editing SHALL preserve the file's dominant line ending style on write
After applying a replacement in the normalized edit view, the agent backend SHALL write the file back using the target file's dominant existing line ending style.

#### Scenario: Editing a CRLF file preserves CRLF on disk
- **WHEN** `local:edit` successfully updates a text file whose dominant existing line ending style is `\r\n`
- **THEN** the written file MUST keep `\r\n` line endings for the updated content
- **AND** the edit MUST NOT rewrite the entire file to `\n` line endings solely because the match was evaluated in a normalized view

#### Scenario: Replacement text containing normalized newlines is restored to the file style
- **WHEN** `local:edit` applies a `new_string` that contains `\n` in the normalized edit view
- **THEN** the persisted file MUST restore those newlines to the target file's dominant line ending style before writing

### Requirement: Runtime upgrade SHALL require explicit cleanup of legacy workspace naming data
The runtime SHALL reject startup when persisted workspace state still uses the retired `input`, `working`, `output`, `uploads/`, or `outputs/` naming, and SHALL rely on an explicit cleanup operation rather than runtime compatibility.

#### Scenario: Startup rejects legacy workspace roots
- **WHEN** backend initialization detects a scoped workspace that still contains legacy `uploads/` or `outputs/` directories
- **THEN** the runtime MUST fail startup explicitly
- **AND** the failure MUST instruct operators to run the dedicated legacy workspace cleanup command before restarting

#### Scenario: Startup rejects legacy persisted session workspace metadata
- **WHEN** backend initialization detects persisted session metadata that still contains workspace entries using legacy `groupId` or `source` values such as `input`, `working`, or `output`
- **THEN** the runtime MUST fail startup explicitly
- **AND** it MUST NOT silently drop or reinterpret those legacy workspace entries during normal startup

#### Scenario: Explicit cleanup removes legacy workspace naming state
- **WHEN** an operator runs the repository-owned cleanup command before upgrade
- **THEN** that cleanup MUST remove legacy workspace roots and persisted legacy workspace file metadata that use retired naming
- **AND** the next backend startup MUST proceed only if no legacy workspace naming artifacts remain

### Requirement: Runtime SHALL expose structured failure feedback for user-safe workbench rendering
The runtime SHALL expose structured failure metadata for model and tool errors so that the workbench can render user-safe summaries by default while retaining technical detail for diagnostics.

#### Scenario: Model-stage runtime errors include user-safe summary and separate diagnostic detail
- **WHEN** a run fails due to a model transport failure, timeout, or stream interruption
- **THEN** the runtime MUST emit a structured runtime error that includes a user-facing summary suitable for direct workbench display
- **AND** any lower-level diagnostic detail for that failure MUST remain available separately from the user-facing summary

#### Scenario: Terminal tool failures include tool-specific structured metadata
- **WHEN** a tool failure becomes terminal for the current run
- **THEN** the runtime MUST emit structured terminal failure metadata that includes the tool stage, user-facing summary, and tool identity needed by the workbench
- **AND** the runtime MUST expose terminal classification metadata such as stop reason or normalized failure code when that metadata exists

### Requirement: Runtime SHALL stream visible tool failure progress states to the workbench
The runtime SHALL expose non-terminal tool failure progress as stream events so that the workbench can distinguish retrying or recovering tool activity from terminal failure.

#### Scenario: Recoverable tool failure emits recovery progress event
- **WHEN** a tool invocation fails but the runtime chooses to retry or recover instead of terminating the run
- **THEN** the runtime MUST emit a stream event that identifies the tool failure as non-terminal recovery progress
- **AND** that event MUST include the tool identity and user-facing status text required for the workbench to update the active assistant process state

#### Scenario: Terminal tool failure does not rely on recovery-progress semantics
- **WHEN** a tool invocation fails and the runtime stops the run instead of continuing recovery
- **THEN** the runtime MUST terminate the run with terminal failure metadata rather than only emitting a recovery-progress event
- **AND** the terminal error path MUST remain sufficient for the workbench to render final failure feedback without inferring outcome from logs or raw text

### Requirement: Runtime SHALL expose admin-only session usage summaries for history inspection
The runtime SHALL provide a dedicated session usage summary query for history inspection that aggregates persisted assistant-message usage within a single session. This query MUST be restricted to `admin` and `super_admin` users and MUST remain independent from the ordinary run execution path.

#### Scenario: Admin requests usage summary for a persisted session
- **WHEN** an `admin` or `super_admin` requests the usage summary for a valid `sessionId`
- **THEN** the runtime MUST aggregate all persisted assistant-message `meta.usage` values for that session
- **AND** the response MUST include the cumulative `totalTokens` for that session

#### Scenario: Empty or pre-reply session returns a zero summary
- **WHEN** an `admin` or `super_admin` requests the usage summary for a session that has no persisted assistant messages with usage metadata
- **THEN** the runtime MUST return a successful summary response for that session
- **AND** the cumulative token counts in that response MUST be `0`

#### Scenario: Non-admin cannot read session usage summary
- **WHEN** a non-admin user requests the session usage summary for any session
- **THEN** the runtime MUST reject the request with an authorization error
- **AND** it MUST NOT expose the session's usage totals in the response body

#### Scenario: Usage query failure does not block ordinary conversation execution
- **WHEN** the dedicated session usage summary query fails for any reason
- **THEN** the runtime MUST surface that failure explicitly on the usage-query path
- **AND** it MUST NOT change run admission, streaming, or message persistence behavior for ordinary conversation requests

