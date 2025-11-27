# Codebase Deep Dive & Audit Report

## 1. Unused Components (Dead Code)

The following components are present in the codebase but are **not imported or rendered** in the main application (`App.tsx`). They appear to be legacy artifacts from previous iterations.

| Component                        | Status     | Recommendation                                                                          |
| :------------------------------- | :--------- | :-------------------------------------------------------------------------------------- |
| `components/ExecutionPanel.tsx`  | **UNUSED** | Replaced by `ExecutionPanelPro.tsx`. Safe to delete.                                    |
| `components/TradeSetupPanel.tsx` | **UNUSED** | Replaced by `ExecutionPanel.tsx` (and then `Pro`). Safe to delete.                      |
| `components/OrderBook.tsx`       | **UNUSED** | Replaced by the internal "Micro Depth" zone in `ExecutionPanelPro.tsx`. Safe to delete. |
| `components/PositionsPanel.tsx`  | **ACTIVE** | Used in `App.tsx` (Bottom View). Keep.                                                  |
| `components/MetricCard.tsx`      | **ACTIVE** | Used in `App.tsx` (Top Strip). Keep.                                                    |

## 2. Service Architecture Analysis

### WebSocket Redundancy

There is a naming overlap and potential confusion between two WebSocket services:

- `services/websocket.ts`: Handles **Public Ticker Data** (`btcusdt@ticker`). Exports `BinancePriceFeed`.
- **Numbers**: Tabular numbers (`font-variant-numeric: tabular-nums`) are correctly applied in `ExecutionPanelPro` for alignment.

### Layout

- **ExecutionPanelPro**: Fixed overlap issues with defensive CSS (`overflow-hidden`, `z-index`).
- **App.tsx**: Uses a 12-column grid.
  - Left (3): Signals & Order Flow
  - Center (6): Chart & Intel/Positions
  - Right (3): Metrics & Order Entry

## 4. Action Plan

1.  **Delete** unused components (`ExecutionPanel.tsx`, `TradeSetupPanel.tsx`, `OrderBook.tsx`) to reduce noise.
2.  **Integrate or Delete** `btcNewsAgent.ts`. If the "News Feed" feature is desired, it needs to be wired into `IntelDeck.tsx` or similar.
3.  **Rename** `services/websocket.ts` to `services/marketTicker.ts` for clarity.
