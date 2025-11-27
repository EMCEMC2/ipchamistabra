# BTC News Agent

## Overview

The BTC News Agent is an autonomous intelligence system that continuously monitors and delivers real-time Bitcoin-related news to the IPCHA MISTABRA trading dashboard.

## Features

### 1. Real-Time News Fetching

- Uses Gemini AI with Google Search integration
- Fetches 5-7 current BTC news items from the past 24 hours
- Prioritizes market-moving events (HIGH, MEDIUM, LOW severity)

### 2. Auto-Refresh System

- Automatically updates news every **5 minutes**
- Manual refresh button with spinning animation
- Manual refresh button with spinning animation
- Logs warning if API unavailable (no mock data)

### 3. Sentiment Analysis

Each news item includes BTC sentiment classification:

- **BULLISH**: Positive for Bitcoin price (ETF inflows, institutional adoption, rate cuts)
- **BEARISH**: Negative for Bitcoin price (rate hikes, hacks, negative regulations)
- **NEUTRAL**: Informational without clear directional bias

### 4. News Categories

- **NEWS**: General crypto market news (CoinDesk, Cointelegraph, Bloomberg)
- **MACRO**: Federal Reserve, CPI data, interest rates, DXY movements
- **WHALE**: Large BTC transfers (> $50M) tracked via Whale Alert
- **ONCHAIN**: Exchange flows, miner activity, network metrics

## Implementation

### Service Location

```
services/btcNewsAgent.ts
```

### Component Integration

```typescript
import { btcNewsAgent } from "../services/btcNewsAgent";

// Start agent
useEffect(() => {
  const handleNewsUpdate = (news: IntelItem[]) => {
    setLiveNews(news);
  };

  btcNewsAgent.start(handleNewsUpdate);

  return () => {
    btcNewsAgent.stop(handleNewsUpdate);
  };
}, []);

// Manual refresh
const handleRefresh = async () => {
  await btcNewsAgent.refresh();
};
```

### Data Structure

```typescript
interface IntelItem {
  id: string;
  title: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  category: "NEWS" | "ONCHAIN" | "MACRO" | "WHALE";
  timestamp: number;
  source: string;
  summary: string;
  btcSentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
}
```

## UI Components

### IntelDeck Component

Located: `components/IntelDeck.tsx`

**Features:**

- Live news feed with real-time updates
- Color-coded category badges
- Sentiment indicators (green/red/gray)
- Refresh button with animation
- Loading state with spinner
- Hover effects for better UX

### Visual Design

- **Category Badges:**

  - MACRO: Blue accent
  - ONCHAIN: Green accent
  - WHALE: Purple accent
  - NEWS: Yellow accent

- **Sentiment Badges:**

  - BULLISH: Green background
  - BEARISH: Red background
  - NEUTRAL: Gray background

- **Layout:**
  - Compact news cards with hover effects
  - Timestamp in HH:MM format
  - High severity marked with warning icon
  - Source attribution at bottom

## API Requirements

### Gemini API Key

The agent requires a valid Gemini API key to function:

1. **Environment Variable:**

   ```bash
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

2. **localStorage:**

   ```javascript
   localStorage.setItem("GEMINI_API_KEY", "your_api_key_here");
   ```

3. **Fallback Behavior:**
   - If no API key found or API fails, logs warning
   - No fake news is injected

## Performance

### Update Frequency

- **Auto-refresh**: Every 5 minutes
- **Manual refresh**: Instant (via button)
- **Initial load**: Fetches immediately on mount

### Optimization

- Singleton pattern prevents multiple agent instances
- Callbacks managed with Set for efficient updates
- JSON parsing with error handling
- Graceful fallback to mock data

## Monitoring

### Console Logs

```
[BTC News Agent] Initialized
[BTC News Agent] Starting...
[BTC News Agent] ✅ Fetched 7 news items
[IntelDeck] Received news update: 7 items
```

### Error Handling

```
[BTC News Agent] Error fetching news: <error message>
[BTC News Agent] No API key, using fallback
```

## Testing

### Local Development

1. Start dev server: `npm run dev`
2. Navigate to Terminal view
3. Switch to "INTEL FEED" tab in bottom panel
4. Observe live news loading
5. Click refresh button to manually update

### Production Deployment

- Railway automatically picks up changes
- Builds with Vite bundle
- Environment variables loaded from Railway settings

## Future Enhancements

### Planned Features

1. **WebSocket Integration**: Real-time news push notifications
2. **Filtering System**: Filter by category/sentiment
3. **Bookmarking**: Save important news items
4. **Notifications**: Desktop alerts for HIGH severity news
5. **Historical Archive**: Store and search past news
6. **Multi-Source Aggregation**: Add CoinGecko, Messari APIs
7. **Sentiment Score**: Numerical score for BTC impact (-100 to +100)
8. **News Charts**: Visualize sentiment over time

### Performance Improvements

1. **Caching**: Store recent news in localStorage
2. **Incremental Updates**: Only fetch new items
3. **Background Worker**: Move fetching to Web Worker
4. **Compression**: Minimize payload size

## Troubleshooting

### News Not Loading

1. Check API key is set correctly
2. Verify internet connection
3. Check console for error messages
4. Check logs for failure messages

### Outdated News

1. Click manual refresh button
2. Check auto-refresh interval (5 minutes)
3. Verify Gemini API quota not exceeded

### Missing Sentiment

1. All news items should have btcSentiment
2. Fallback uses pre-defined sentiments
3. Check Gemini response format

## Credits

- **AI Model**: Google Gemini 2.0 Flash
- **News Sources**: CoinDesk, Bloomberg, Cointelegraph, Whale Alert
- **Developer**: IPCHA MISTABRA Intelligence Team
- **Last Updated**: November 27, 2025

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Deployment**: Railway (Auto-deploy from GitHub main branch)
