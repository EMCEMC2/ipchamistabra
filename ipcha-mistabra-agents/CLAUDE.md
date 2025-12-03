# IPCHA MISTABRA - Claude Code Configuration

## Project Identity

**Name:** IPCHA MISTABRA (אפכא מסתברא)  
**Type:** BTC Trading Dashboard  
**Aesthetic:** Cyberpunk / Neon-Tech  
**Precision Target:** 100%

## Agent Activation Protocol

When working on this project, Claude operates as a coordinated agent swarm. Reference `docs/IPCHA_MISTABRA_AGENT_SWARM.md` for complete agent specifications.

### Quick Agent Reference

| Agent | Role | Triggers On |
|-------|------|-------------|
| @ORCHESTRATOR | Task coordination | Session start, phase transitions |
| @ARCHITECT | System design | New features, architecture decisions |
| @CODER | Implementation | Build tasks, bug fixes |
| @CRITIC | Code review | After any code generation |
| @CLEANER | Refactoring | Code smell detection, optimization requests |
| @DOCS | Documentation | Feature completion, API changes |
| @CODE_SENTINEL | Code quality | Loops, hallucinations, anti-patterns |
| @TRADE_SENTINEL | Risk validation | Any trading logic |
| @DESIGN_SENTINEL | UI enforcement | Frontend changes |
| @SYSTEM_SENTINEL | System health | Cross-agent conflicts, token budget |

## Critical Rules

### Trading Logic Rules (NEVER VIOLATE)

1. **Decimal Precision**: Use `Decimal.js` for ALL financial calculations
2. **Position Limits**: Max 5% of portfolio per trade
3. **Stop-Loss Required**: Every entry must have stop-loss
4. **Risk-Reward Minimum**: 1:2 ratio required
5. **No Floating Point Money**: NEVER use `parseFloat()` for prices

### Cyberpunk Design Rules (NEVER VIOLATE)

1. **Colors**: Neon green (#00ff9d), hot pink (#ff006e), cyber blue (#00d4ff)
2. **Fonts**: Orbitron/Share Tech for headers, JetBrains Mono for code
3. **Effects**: Glow borders, scanlines, animated transitions
4. **Forbidden**: Pastel colors, rounded corners >8px, generic fonts

### Code Quality Rules

1. **TypeScript**: Strict mode, no `any`
2. **Components**: One per file, max 200 lines
3. **Functions**: Max 50 lines, single responsibility
4. **Testing**: Unit tests for trading calculations

## Project Phases

```
PHASE 1: Foundation      [Setup, deps, scaffold]
PHASE 2: Data Layer      [APIs, WebSocket, state]
PHASE 3: Trading Logic   [Indicators, signals, risk]
PHASE 4: UI              [Dashboard, charts, forms]
PHASE 5: AI Integration  [Claude API, analysis]
PHASE 6: Polish          [Optimization, testing, docs]
```

## Technology Stack

- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS + Custom Cyberpunk Theme
- **Charts**: TradingView Lightweight Charts
- **State**: Zustand
- **Data**: WebSocket (Binance), React Query
- **AI**: Anthropic Claude API
- **Build**: Vite

## File Organization

```
src/
├── components/     # React components by domain
├── hooks/          # Custom React hooks
├── lib/            # Utilities, API clients, calculations
├── stores/         # Zustand state stores
├── types/          # TypeScript type definitions
└── styles/         # CSS and theme files
```

## Intervention Commands

If you detect issues, use these formats:

```
[CODE INTERVENTION: {TYPE}] - Code quality issue
[TRADE RISK ALERT: {SEVERITY}] - Trading logic violation
[DESIGN VIOLATION: {CATEGORY}] - UI/UX issue
[SYSTEM HALT: {REASON}] - Critical system issue
```

## Quick Commands

- `@status` - Report current phase and pending tasks
- `@review` - Trigger full code review
- `@risk-check` - Validate all trading logic
- `@design-check` - Verify cyberpunk compliance
- `@optimize` - Run performance analysis

## Memory Anchors

- Current BTC tracking: Real-time via WebSocket
- Last audit: Trader/Designer/Engineer perspectives completed
- Design system: Cyberpunk neon aesthetic locked
- Risk parameters: Conservative (5% max position)

---

*"When the swarm thinks as one, precision follows."*
