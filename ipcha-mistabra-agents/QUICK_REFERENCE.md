# IPCHA MISTABRA Agent Swarm - Quick Reference

## 🎯 Agent Quick Lookup

| Agent | Icon | Primary Job | Intervenes When |
|-------|------|-------------|-----------------|
| ORCHESTRATOR | 🎯 | Task coordination | Session start, phase change |
| ARCHITECT | 🏗️ | System design | New feature, tech decision |
| CODER | 💻 | Implementation | Build task assigned |
| CRITIC | 🔍 | Code review | Code submitted |
| CLEANER | 🧹 | Refactoring | Code smell detected |
| DOCS | 📚 | Documentation | Feature completed |
| CODE_SENTINEL | 🛡️ | Code quality | Loop/hallucination detected |
| TRADE_SENTINEL | ⚠️ | Risk validation | Trading logic written |
| DESIGN_SENTINEL | 🎨 | UI enforcement | Frontend code written |
| SYSTEM_SENTINEL | 🔴 | System health | Cross-agent conflict |

---

## 🚨 Intervention Commands

```
[CODE INTERVENTION: LOOP_DETECTED]
[CODE INTERVENTION: HALLUCINATION]
[CODE INTERVENTION: ANTI_PATTERN]

[TRADE RISK ALERT: CRITICAL]
[TRADE RISK ALERT: HIGH]
[TRADE RISK ALERT: WARNING]

[DESIGN VIOLATION: COLOR]
[DESIGN VIOLATION: TYPOGRAPHY]
[DESIGN VIOLATION: ANIMATION]

[SYSTEM HALT: DEADLOCK]
[SYSTEM HALT: TOKEN_OVERFLOW]
[SYSTEM HALT: CONFLICT]
```

---

## 💰 Trading Rules (MEMORIZE)

| Rule | Value | Enforcement |
|------|-------|-------------|
| Max Position | 5% of portfolio | BLOCK |
| Max Loss/Trade | 2% of portfolio | BLOCK |
| Min Risk:Reward | 1:2 | WARN |
| Max Leverage | 3x (10x absolute max) | BLOCK |
| Price Precision | 8 decimals | BLOCK |
| Stop-Loss | Required always | BLOCK |

---

## 🎨 Cyberpunk Colors (COPY-PASTE)

```css
--neon-green: #00ff9d;    /* Primary */
--hot-pink: #ff006e;      /* Secondary */
--cyber-blue: #00d4ff;    /* Accent */
--deep-black: #0a0a0f;    /* Background */
--amber: #ffaa00;         /* Warning */
--red-alert: #ff3366;     /* Danger */
```

**FORBIDDEN:** Pastel colors, purple-pink gradients, muted tones

---

## 🔤 Typography (COPY-PASTE)

```css
/* Headers */
font-family: 'Orbitron', 'Share Tech Mono', monospace;

/* Body/Code */
font-family: 'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', monospace;
```

**FORBIDDEN:** Arial, Times New Roman, Comic Sans, Inter, Roboto

---

## 📁 File Structure Quick Map

```
src/
├── components/
│   ├── charts/      ← CandlestickChart, VolumeChart
│   ├── dashboard/   ← PriceDisplay, MarketStats, OrderBook
│   ├── trading/     ← TradingPanel, PositionManager
│   ├── ai/          ← AnalysisPanel, ChatInterface
│   └── ui/          ← GlowingCard, CyberButton
├── hooks/           ← useWebSocket, usePriceData
├── lib/
│   ├── calculations/ ← indicators.ts, risk.ts
│   └── api/         ← exchange.ts, claude.ts
├── stores/          ← priceStore, tradingStore
├── types/           ← market.ts, trading.ts
└── styles/          ← cyberpunk-theme.css
```

---

## ⚡ Quick Code Patterns

### Financial Calculation (ALWAYS USE)
```typescript
import Decimal from 'decimal.js';

const calculatePosition = (price: Decimal, quantity: Decimal): Decimal => {
  return price.times(quantity);
};
// NEVER: price * quantity (floating point!)
```

### WebSocket with Reconnect
```typescript
const useWebSocket = (url: string) => {
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;
    
    const connect = () => {
      ws = new WebSocket(url);
      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };
    
    connect();
    return () => {
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [url]);
};
```

### Glow Effect CSS
```css
.glow-border {
  border: 1px solid var(--neon-green);
  box-shadow: 
    0 0 5px var(--neon-green),
    0 0 10px var(--neon-green),
    inset 0 0 5px rgba(0, 255, 157, 0.1);
}
```

---

## 📋 Review Checklist

### Before Submitting Code
- [ ] TypeScript strict mode passes
- [ ] No `any` types
- [ ] Decimal.js for money
- [ ] Error handling complete
- [ ] Types for all props

### Before Trading Logic Deploy
- [ ] Position limits active
- [ ] Stop-loss implemented
- [ ] Risk calculations verified
- [ ] No hardcoded values

### Before UI Merge
- [ ] Cyberpunk colors only
- [ ] Correct fonts
- [ ] Glow effects present
- [ ] Animations smooth

---

## 🎮 Session Starters

### Full Swarm (Complex Tasks)
```
Activate full IPCHA MISTABRA agent swarm for: [TASK]
```

### Quick Build (Simple Features)
```
@CODER: Implement [component] with cyberpunk styling
@CRITIC: Review when complete
```

### Design Focus
```
@DESIGN_SENTINEL: Active monitoring
@CODER: Build [UI component]
Enforce cyberpunk aesthetic strictly
```

### Trading Logic Focus
```
@TRADE_SENTINEL: Active monitoring
@CODER: Implement [trading feature]
Risk validation required before merge
```

---

## 🔗 Key Files

| File | Purpose |
|------|---------|
| `IPCHA_MISTABRA_AGENT_SWARM.md` | Complete specification |
| `CLAUDE.md` | Project config for Claude Code |
| `AGENT_PROMPTS.md` | Copy-paste prompts |
| `ARCHITECTURE_DIAGRAMS.md` | Visual diagrams |

---

*"אפכא מסתברא" - Precision through contrarian thinking*
