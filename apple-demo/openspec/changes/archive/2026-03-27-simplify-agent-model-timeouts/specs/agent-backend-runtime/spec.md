## ADDED Requirements

### Requirement: Runtime SHALL load model streaming timeout policy only from config.json
The runtime SHALL load model streaming timeout policy only from `apps/agent-backend/config.json` using `streamFirstByteTimeoutMs` and `streamIdleTimeoutMs`, and it MUST NOT allow environment variables to override those values.

#### Scenario: Configured streaming timeouts are loaded from config.json
- **WHEN** `config.json` defines `streamFirstByteTimeoutMs` and `streamIdleTimeoutMs` for the resolved model
- **THEN** the runtime MUST apply those exact values to the streaming watchdog

#### Scenario: Environment variables do not override model streaming timeouts
- **WHEN** process environment defines legacy model timeout override variables
- **THEN** the runtime MUST ignore those variables for model timeout configuration
- **AND** the effective watchdog thresholds MUST still come from `config.json`

### Requirement: Runtime SHALL reject legacy requestTimeoutMs model configuration
The runtime MUST reject legacy model timeout field `requestTimeoutMs` anywhere in runtime model configuration instead of silently interpreting it as a fallback timeout.

#### Scenario: Legacy requestTimeoutMs fails startup validation
- **WHEN** `config.json` declares `requestTimeoutMs` in `agent.defaultModel`, `agent.modelRegistry`, or `agent.modelsByAgent`
- **THEN** runtime startup MUST fail with an explicit configuration error
- **AND** the runtime MUST NOT silently map that value into streaming timeout fields

## MODIFIED Requirements

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
