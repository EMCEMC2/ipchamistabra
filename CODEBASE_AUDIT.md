# Codebase Architecture and Structural Integrity

## 1. Repository Structure and Modularity

- **Single-repo**: Front-end (React/Vite), services layer (signal generation, consensus, risk), workers for heavy calc, and a small Express server for Binance proxy/macro routes.
- **Separation of Concerns**:
  - **Data Ingestion**: `aggrService`, `binanceWebSocket`, `macroDataService`.
  - **Strategy/Consensus**: `tacticalSignals`, `agentConsensus`, `tradingWorker`.
  - **Risk**: `riskOfficer`.
  - **Execution**: `ExecutionPanelPro`, `binanceApi`.
  - **UI**: React components.

## 2. Core Trading Logic and Execution Engine

### 2.1 State Management

- **Global State**: Zustand (`useStore`) with persisted slices (positions, journal, riskOfficer) and volatile slices (price, feeds).
- **Concurrency**: Single-threaded main thread + Web Worker for tactical/consensus.
- **Synchronization**: Synchronous `setState` calls; worker avoids race conditions by operating on cloned state snapshots.

### 2.2 Order Routing and Latency

- **Flow**: `marketData` fetch → `worker` generate → signals stored → UI prefill → `binanceApi` REST → Proxy → Binance Testnet.
- **Latency**: No measured P99. Worker offload removes main-thread contention. Singleton pattern eliminates per-scan startup overhead.

## 3. Interconnectivity and External API Integration

- **Exchange API**: Binance REST wrapper (`binanceApi`) with server-side signing.
- **WebSockets**: Binance price feed; Aggr worker for order flow (Binance/OKX/Bybit).
- **Error Handling**: Basic try/catch with console warnings. No structured retry logic aside from worker backoff.

## 4. User Interface (UI/UX)

- **Visualization**: Real-time `lightweight-charts`. Order flow updates every second.
- **Performance**: Worker offload keeps render loop free.
- **Controls**: Manual execution panel, Risk Override Warning, Blocked Banner for outages.
- **Auditability**: LocalStorage journal and veto history. No backend logging surfaced in UI.

## 5. Algorithmic Agent Functionality

- **Inference**: No hosted ML. Tactical logic is deterministic (EMA/RSI/ATR).
- **Consensus**: Heuristic "virtual agents" (Vanguard, Datamind, etc.). Both Tactical and AI signals carry consensus votes.
- **AI Signals**: Sourced via Gemini external API. Decorated with synthetic confidence breakdown for UI consistency ("Glass Box").
- **Backtesting**: `backtestingService` exists and mirrors tactical logic, but lacks rigorous look-ahead bias checks beyond standard indicator lookbacks.

## 6. Security Posture

- **Auth**: API keys stored in `localStorage` (client) and `.env` (server).
- **Access Control**: No role-based access.
- **Failover**: Single Express instance. No DR/HA.

## 7. Comprehensive Deficiencies and Technical Debt

### 7.1 Critical Performance Bottlenecks

- **Worker Instantiation**: [RESOLVED] Implemented Singleton Worker pattern in `marketData.ts`.
- **Order Flow**: [RESOLVED] Implemented batched pruning (once/sec) in `dataProcessor.worker.ts`, reducing per-tick complexity to O(1).
- **State Serialization**: `JSON.stringify` for worker payloads is costly for large state.

### 7.2 Maintainability

- **Coupling**: UI imports services/store directly. No Dependency Injection.
- **Testing**: Hard to mock API clients.

### 7.3 Compliance

- **Audit Trails**: [PARTIAL] Added "Export Audit Log" (JSON) in UI. _Limitation: Client-side only, no server-side persistence._
- **Time Sync**: [RESOLVED] Added `checkTimeSync` in `DataSyncAgent` (warns on >5s skew). _Limitation: Pass-on-error. NTP/clock discipline still recommended._
- **Data Persistence**: No DB; relies on `localStorage`.

## 8. Recommended Next Actions

- **Audit Logging**: Add server-side audit logging for orders/cancels with exchange IDs and timestamps. Surface a minimal log viewer or API.
- **Security**: Remove keys from localStorage. Use backend-stored AI keys or a proxy. Tighten CORS to disallow no-origin.
- **Reliability**: Add retry/backoff and health checks for WS/REST. Consider a circuit breaker for Binance/Aggr.
- **Concurrency**: Fix `lastSignalBar` to be instance-scoped or store-scoped to avoid races.
- **Instrumentation**: Instrument latency (signal→order) and resource usage to replace speculative metrics.
