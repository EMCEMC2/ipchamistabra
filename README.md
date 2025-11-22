# IPCHA MISTABRA - BitMind Trading Terminal

An elite trading dashboard featuring AI-powered market analysis, real-time Bitcoin tracking, and advanced technical analysis.

## 🚀 Features

- **Real-Time Market Data**: Live BTC price from Binance WebSocket
- **AI Analysis**: Powered by Google Gemini for market insights
- **Market Regime Detection**: Real-time volatility and trend classification
- **Agent Swarm**: Multi-agent AI system for comprehensive market analysis
- **Fear & Greed Index**: Live sentiment tracking
- **Technical Indicators**: RSI, MACD, EMA, ADX calculated from live data
- **Terminal Aesthetic**: Cyberpunk-inspired UI with dark theme

## 📦 Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Custom terminal theme
- **State Management**: Zustand
- **AI**: Google Gemini 2.0 (Flash + Thinking models)
- **Charts**: HTML5 Canvas (custom implementation)
- **Real-Time Data**: Binance WebSocket API

## 🛠️ Setup

### Prerequisites
- Node.js 18+
- Google Gemini API Key ([Get one here](https://aistudio.google.com/app/apikey))

### Installation

```bash
# Clone the repository
git clone https://github.com/EMCEMC2/ipchamistabra.git
cd ipchamistabra

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Add your Gemini API key to .env.local
# VITE_GEMINI_API_KEY=your_api_key_here

# Start development server
npm run dev
```

Visit `http://localhost:3003`

### Build for Production

```bash
npm run build
npm run preview
```

## 🔐 Environment Variables

Create a `.env.local` file in the root directory:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

## 🌐 Deployment

This project is configured for Railway deployment:

1. Push to GitHub
2. Connect your GitHub repo to Railway
3. Add `VITE_GEMINI_API_KEY` to Railway environment variables
4. Deploy automatically

## 📊 Dashboard Tabs

- **TERMINAL**: Real-time chart, technical indicators, and metrics
- **SWARM COUNCIL**: Multi-agent AI analysis system
- **ML CORTEX**: Market regime detection and volatility analysis
- **JOURNAL**: Trade history and performance tracking

## 🎨 UI Components

- 7 High-Density Metric Cards (Price, Sentiment, VIX, BTC.D, OI, Funding, L/S Ratio)
- Interactive TradingView-style chart
- AI Command Center with natural language queries
- Global intel feed (news & alerts)

## 📈 Data Sources

- **Binance API**: Real-time price, OHLCV candles
- **Alternative.me**: Fear & Greed Index
- **Google Gemini**: Macro metrics (VIX, DXY), derivatives data, AI analysis
- **Calculated**: Volatility, trend strength, market regimes

## 🔧 Scripts

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

## 📝 License

MIT License

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a PR.

## ⚠️ Disclaimer

This dashboard is for educational and research purposes only. Not financial advice. Trade at your own risk.

---

**Built with 🧠 by IPCHA MISTABRA Team**

Live Demo: [Coming Soon]
