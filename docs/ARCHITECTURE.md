# 🏗️ Architecture & Flow Diagrams

## System Architecture

```mermaid
graph TB
    subgraph "User Layer"
        U[User]
        CLI[CLI/Terminal]
    end
    
    subgraph "Automation Layer"
        K6[k6 Load Test Runner]
        PS[play_optimized.js]
        ARC[AdaptiveRateController]
    end
    
    subgraph "Token Management"
        TS[token_sync.js Daemon]
        CDP[Chrome CDP]
        CS[Cloud Solver<br/>CapSolver/2Captcha]
    end
    
    subgraph "Monitoring"
        MON[monitor.sh/bat]
        LOG[Log Files]
        COMP[compare_performance.js]
    end
    
    subgraph "Configuration"
        AT[auto_tune.cjs]
        ENV[.env Config]
    end
    
    subgraph "Target Server"
        API[Liputan6 API]
        RC[reCAPTCHA]
    end
    
    U -->|Commands| CLI
    CLI -->|Run| K6
    CLI -->|Generate config| AT
    CLI -->|Monitor| MON
    CLI -->|Compare| COMP
    
    AT -->|Generate| ENV
    K6 -->|Load| PS
    PS -->|Use| ARC
    PS -->|Read| ENV
    
    PS -->|Request token| TS
    TS -->|Solve via| CDP
    TS -->|Or solve via| CS
    
    PS -->|HTTP requests| API
    API -->|Require| RC
    
    PS -->|Write| LOG
    MON -->|Read| LOG
    COMP -->|Read| LOG
    
    ARC -->|Adapt| PS
```

## Request Flow Diagram

```mermaid
sequenceDiagram
    participant K6 as k6 Runner
    participant PS as play_optimized.js
    participant ARC as AdaptiveController
    participant TS as token_sync.js
    participant API as Liputan6 API
    
    K6->>PS: Start iteration
    PS->>ARC: Initialize controller
    
    PS->>TS: Request token
    TS->>TS: Check cache (115s)
    alt Token cached
        TS-->>PS: Return cached token
    else Token expired
        TS->>TS: Solve captcha
        TS-->>PS: Return new token
    end
    
    loop Until token expires (115s)
        PS->>ARC: Get batch size
        ARC-->>PS: Current batch (2-12)
        
        PS->>API: Open sessions (batch)
        API-->>PS: Session tokens
        
        PS->>ARC: Record results
        ARC->>ARC: Calculate success rate
        ARC->>ARC: Adjust batch size
        
        alt Success rate good
            ARC->>ARC: Increase batch
        else Success rate poor
            ARC->>ARC: Decrease batch
        end
        
        PS->>API: Submit scores (batch)
        API-->>PS: Points & rank
        
        PS->>ARC: Get delay
        alt Throttle needed
            ARC-->>PS: Long delay
            PS->>PS: Sleep(8-15s)
        else Normal operation
            ARC-->>PS: Short delay
            PS->>PS: Sleep(1-3s)
        end
    end
    
    PS->>TS: Request new token
    TS->>TS: Refresh token
    TS-->>PS: New token
```

## Adaptive Rate Control Algorithm

```mermaid
stateDiagram-v2
    [*] --> Initializing
    
    Initializing --> Stabilizing: Start with initial batch
    
    Stabilizing --> Accelerating: 3+ successes + SR >= 75%
    Stabilizing --> Growing: 2+ successes + SR >= 67%
    Stabilizing --> Slowing: SR < 75%
    Stabilizing --> Decelerating: 2+ errors
    
    Accelerating --> Stabilizing: Batch += 2
    Accelerating --> Decelerating: Error detected
    
    Growing --> Stabilizing: Batch += 1
    Growing --> Decelerating: Error detected
    
    Slowing --> Stabilizing: Batch -= 1
    Slowing --> Decelerating: More errors
    
    Decelerating --> Stabilizing: Batch *= 0.6
    Decelerating --> Cooldown: Serious errors
    
    Cooldown --> Stabilizing: Cooldown expired
    
    state Accelerating {
        [*] --> CheckSuccess
        CheckSuccess --> IncreaseBatch: SR >= 75%
        IncreaseBatch --> ReduceCooldown
        ReduceCooldown --> [*]
    }
    
    state Decelerating {
        [*] --> CheckErrors
        CheckErrors --> ReduceBatch: Errors >= 2
        ReduceBatch --> IncreaseCooldown
        IncreaseCooldown --> [*]
    }
```

## Error Handling Flow

```mermaid
flowchart TD
    Start([Request Sent]) --> Check{Response Status}
    
    Check -->|200/201| Success[✅ Success]
    Check -->|429| Error429[⛔ Rate Limited]
    Check -->|500| Error500[⚠️ Server Error]
    Check -->|422| Error422[⚠️ Token Invalid]
    Check -->|Other| ErrorOther[❌ Other Error]
    
    Success --> Record[Record Success]
    Record --> IncConsec[consecutiveSuccess++]
    IncConsec --> CheckAccel{consecutiveSuccess >= 3?}
    CheckAccel -->|Yes| Accelerate[Batch += 2]
    CheckAccel -->|No| CheckGrow{consecutiveSuccess >= 2?}
    CheckGrow -->|Yes| Grow[Batch += 1]
    CheckGrow -->|No| Maintain[Maintain]
    
    Error429 --> Record429[Record Failure]
    Record429 --> Reduce429[Batch *= 0.6]
    Reduce429 --> Cooldown429[Cooldown += 2s]
    Cooldown429 --> Backoff429[Sleep 8-15s]
    
    Error500 --> Record500[Record Failure]
    Record500 --> Reduce500[Batch -= 1]
    Reduce500 --> Cooldown500[Cooldown += 1s]
    Cooldown500 --> Backoff500[Sleep 5-10s]
    
    Error422 --> RefreshToken[Force Refresh Token]
    RefreshToken --> BreakCycle[Break Cycle]
    
    ErrorOther --> RecordOther[Record Failure]
    RecordOther --> Sleep[Sleep 3s]
    
    Accelerate --> End([Continue])
    Grow --> End
    Maintain --> End
    Backoff429 --> End
    Backoff500 --> End
    BreakCycle --> End
    Sleep --> End
```

## Token Lifecycle

```mermaid
gantt
    title Token Captcha Lifecycle (120s validity)
    dateFormat  ss
    axisFormat %S
    
    section Token 1
    Solving captcha     :t1_solve, 00, 10s
    Active usage       :active, t1_active, after t1_solve, 115s
    Grace period       :crit, t1_grace, after t1_active, 5s
    
    section Rounds
    Round 1            :r1, 10, 8s
    Delay              :d1, after r1, 2s
    Round 2            :r2, after d1, 8s
    Delay              :d2, after r2, 2s
    Round 3            :r3, after d2, 8s
    Delay              :d3, after r3, 2s
    Round 4            :r4, after d3, 8s
    ...                :milestone, after r4, 0s
    
    section Token 2
    Refresh at 115s    :milestone, 125, 0s
```

## Performance Optimization Impact

```mermaid
graph LR
    subgraph "Before Optimization"
        B1[Fixed Batch: 5]
        B2[No Adaptation]
        B3[Simple Retry]
        B4[Token Waste]
        
        B1 --> BR1[SR: 60-70%]
        B2 --> BR2[Wins/Token: 12-18]
        B3 --> BR3[Error 429: 20-40/hr]
        B4 --> BR4[Utilization: 50-60%]
    end
    
    subgraph "After Optimization"
        A1[Adaptive Batch: 2-12]
        A2[Smart Adaptation]
        A3[Intelligent Recovery]
        A4[Max Utilization]
        
        A1 --> AR1[SR: 75-85%]
        A2 --> AR2[Wins/Token: 25-40]
        A3 --> AR3[Error 429: 5-15/hr]
        A4 --> AR4[Utilization: 80-90%]
    end
    
    BR1 -.->|+20%| AR1
    BR2 -.->|+100%| AR2
    BR3 -.->|-70%| AR3
    BR4 -.->|+50%| AR4
```

## Configuration Tuning Matrix

```mermaid
quadrantChart
    title Configuration Strategy Matrix
    x-axis Low Throughput --> High Throughput
    y-axis Low Safety --> High Safety
    
    quadrant-1 Balanced (Recommended)
    quadrant-2 Maximum Safety
    quadrant-3 Ultra Conservative
    quadrant-4 Maximum Speed
    
    "Default Config": [0.65, 0.55]
    "Fast Network + Off-Peak": [0.85, 0.45]
    "Slow Network + Peak": [0.35, 0.75]
    "Getting Errors": [0.25, 0.85]
    "High Performance": [0.75, 0.65]
    "Avoiding Ban": [0.15, 0.95]
```

## Data Flow Architecture

```mermaid
flowchart LR
    subgraph Input
        ENV[.env Config]
        USER[User Settings]
    end
    
    subgraph Processing
        AT[auto_tune.cjs]
        PS[play_optimized.js]
        ARC[AdaptiveController]
        TS[token_sync.js]
    end
    
    subgraph Output
        LOG[automation.log]
        JSON[api_records.jsonl]
        METRICS[k6 metrics]
    end
    
    subgraph Analysis
        MON[Real-time Monitor]
        COMP[Performance Compare]
        REPORT[JSON Report]
    end
    
    ENV --> PS
    USER --> AT
    AT --> ENV
    
    PS --> ARC
    PS --> TS
    ARC --> PS
    TS --> PS
    
    PS --> LOG
    PS --> JSON
    PS --> METRICS
    
    LOG --> MON
    LOG --> COMP
    COMP --> REPORT
```

## Success Rate Tracking Window

```mermaid
timeline
    title Success Rate Sliding Window (20 samples)
    
    T0 : ✅ Success : SR: 100%
    T1 : ✅ Success : SR: 100%
    T2 : ❌ Failed : SR: 66%
    T3 : ✅ Success : SR: 75%
    T4 : ✅ Success : SR: 80%
    T5 : ✅ Success : SR: 83%
    T6 : ❌ Failed : SR: 71%
    T7 : ✅ Success : SR: 75%
    ... : ... : ...
    T19 : ✅ Success : SR: 82%
    T20 : Window Slides : Oldest removed
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Development"
        DEV[Local Machine]
        TEST[Test Environment]
    end
    
    subgraph "Production Options"
        VPS[VPS/Cloud Server]
        LOCAL[Local 24/7]
        DOCKER[Docker Container]
    end
    
    subgraph "Monitoring Stack"
        GRAFANA[Grafana Dashboard]
        PROM[Prometheus]
        ALERT[Alerting]
    end
    
    subgraph "External Services"
        CAPSOLVER[CapSolver API]
        TWOCAP[2Captcha API]
        PROXY[Proxy Pool]
    end
    
    DEV -->|Test| TEST
    TEST -->|Deploy| VPS
    TEST -->|Deploy| LOCAL
    TEST -->|Deploy| DOCKER
    
    VPS --> PROM
    LOCAL --> PROM
    DOCKER --> PROM
    
    PROM --> GRAFANA
    PROM --> ALERT
    
    VPS -.->|Optional| CAPSOLVER
    VPS -.->|Optional| TWOCAP
    VPS -.->|Optional| PROXY
```

## Rate Limiting State Machine

```mermaid
stateDiagram-v2
    [*] --> Normal: Initial State
    
    Normal --> Throttled: Error 429
    Normal --> Warning: SR < 75%
    Normal --> Optimal: SR >= 85%
    
    Optimal --> Accelerating: Increase batch
    Accelerating --> Optimal: Success
    Accelerating --> Throttled: Error 429
    
    Warning --> Normal: Improve SR
    Warning --> Throttled: More errors
    
    Throttled --> Cooldown: Serious
    Throttled --> Warning: Recovering
    
    Cooldown --> Warning: Timer expires
    
    Warning --> Normal: Stabilized
    
    Normal --> [*]: Stop
```

## Component Interaction

```mermaid
graph TD
    subgraph "Core Components"
        K6[k6 Runner]
        PS[Main Script]
        ARC[Rate Controller]
    end
    
    subgraph "Token Management"
        TS[Token Daemon]
        CACHE[Token Cache]
        SOLVER[Captcha Solver]
    end
    
    subgraph "Configuration"
        ENV[.env File]
        AUTO[Auto Tuner]
    end
    
    subgraph "Monitoring"
        LOG[Log Writer]
        MON[Monitor]
        METRICS[Metrics]
    end
    
    K6 -->|Execute| PS
    PS <-->|Control| ARC
    PS <-->|Get token| TS
    
    TS <-->|Cache| CACHE
    TS -->|Solve| SOLVER
    
    AUTO -->|Generate| ENV
    ENV -->|Config| PS
    
    PS -->|Write| LOG
    PS -->|Emit| METRICS
    LOG -->|Read| MON
```

---

## Key Metrics Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🚀 Real-time Performance Dashboard                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Performance Metrics:                                           │
│  ────────────────────────────────────────────────────────────  │
│    ✓ Total Wins:          287                                  │
│    ● Cycles:               12                                   │
│    📈 Success Rate:        82.3%  [████████░░] 🟢 EXCELLENT    │
│    💎 Wins per Cycle:      23.9                                 │
│    ⚡ Avg Batch Size:      7.2                                  │
│                                                                 │
│  Error Statistics:                                              │
│  ────────────────────────────────────────────────────────────  │
│    ⛔ Error 429:          7      [█░░░░░░░░░] 🟢 LOW          │
│    ⚠️  Error 500:          3      [░░░░░░░░░░] 🟢 VERY LOW     │
│                                                                 │
│  System Status:                                                 │
│  ────────────────────────────────────────────────────────────  │
│    🏆 EXCELLENT - System performing optimally                  │
│                                                                 │
│  Current Strategy:                                              │
│  ────────────────────────────────────────────────────────────  │
│    State:        ACCELERATING                                   │
│    Batch:        8 (trending ⬆)                                │
│    Delay:        1.2s (optimal)                                 │
│    Cooldown:     0s                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## System States Overview

| State | Batch Size | Delay | SR Target | Trigger |
|-------|-----------|-------|-----------|---------|
| **INITIALIZING** | Initial (8) | Normal | 75% | Start |
| **STABILIZING** | Maintain | Normal | 75% | Default |
| **ACCELERATING** | +2 | Short | 75% | 3+ success + SR ≥ 75% |
| **GROWING** | +1 | Short | 75% | 2+ success + SR ≥ 67% |
| **SLOWING** | -1 | Normal | 75% | SR < 75% |
| **DECELERATING** | ×0.6 | Long | 80% | 2+ errors |
| **COOLDOWN** | Min | Max | 85% | Serious errors |

---

**Architecture designed for:**
- 🎯 Maximum reliability
- ⚡ Optimal performance  
- 🔄 Self-adaptation
- 📊 Full observability
- 🛡️ Error resilience
