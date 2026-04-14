## ADDED Requirements

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
