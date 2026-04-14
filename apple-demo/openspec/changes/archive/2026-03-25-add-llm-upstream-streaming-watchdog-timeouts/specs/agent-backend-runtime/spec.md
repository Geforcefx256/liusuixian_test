## ADDED Requirements

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
The runtime SHALL treat model-request timeout handling as watchdog-based progress monitoring rather than a default hard deadline on total elapsed duration.

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
