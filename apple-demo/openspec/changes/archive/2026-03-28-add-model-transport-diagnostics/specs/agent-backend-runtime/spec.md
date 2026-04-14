## ADDED Requirements

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
