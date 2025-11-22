import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Search, Cpu, ExternalLink, Mic, Volume2, VolumeX } from 'lucide-react';
import { ChatMessage, TradeSignal, ChartDataPoint } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateMarketAnalysis } from '../services/gemini';

export interface DashboardData {
  price: number;
  change: number;
  vix: number;
  btcd: number;
  sentiment: number;
}

interface AiCommandCenterProps {
  onNewAnalysis: (text: string) => void;
  marketData: DashboardData;
  signals: TradeSignal[];
  chartData: ChartDataPoint[];
  technicalIndicators?: {
    rsi: number;
    macd: { histogram: number; signal: number; macd: number };
    adx: number;
    atr: number;
    trend: string;
  };
}

// Polyfill for SpeechRecognition
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const AiCommandCenter: React.FC<AiCommandCenterProps> = ({ onNewAnalysis, marketData, signals, chartData, technicalIndicators }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      role: 'model',
      content: "BitMind Systems Online. Reasoning Engine Active. Ready to analyze Tactical v2 Signals.",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        executeCommand(transcript); // Auto-send on voice command
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const speakText = (text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;

    // Clean markdown for speech
    const cleanText = text.replace(/[*#_`]/g, '').replace(/https ?: \/\/\S+/g, 'source link');

    // Cancel existing
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 200)); // Speak first 200 chars to avoid annoyance
    utterance.rate = 1.1;
    utterance.pitch = 0.9;

    // Try to find a "tech" sounding voice
    const voices = window.speechSynthesis.getVoices();
    const techVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha'));
    if (techVoice) utterance.voice = techVoice;

    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const executeCommand = async (commandText: string) => {
    if (!commandText.trim() || isThinking) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: commandText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    // --- CONTEXT INJECTION ---
    // Format last 5 candles for context
    const recentCandles = chartData.slice(-5).map(c =>
      `[${new Date(c.time * 1000).toLocaleTimeString()}] O:${c.open} H:${c.high} L:${c.low} C:${c.close}`
    ).join('\n');

    // Format Technical Indicators
    const techContext = technicalIndicators ? `
    TECHNICAL INDICATORS (Live):
    - RSI (14): ${technicalIndicators.rsi.toFixed(2)}
    - MACD: Hist: ${technicalIndicators.macd.histogram.toFixed(4)}, Signal: ${technicalIndicators.macd.signal.toFixed(4)}
    - ADX (14): ${technicalIndicators.adx.toFixed(2)}
    - ATR (14): ${technicalIndicators.atr.toFixed(2)}
    - Trend (EMA 21/55): ${technicalIndicators.trend}
    ` : 'Technical data unavailable.';

    const marketContext = `
    MARKET DATA SNAPSHOT:
    - Price: $${marketData.price.toLocaleString()} (${marketData.change >= 0 ? '+' : ''}${marketData.change.toFixed(2)}%)
    - VIX: ${marketData.vix.toFixed(2)}
    - Sentiment: ${marketData.sentiment}
    - BTC Dominance: ${marketData.btcd.toFixed(1)}%
    
    ${techContext}

    RECENT PRICE ACTION (Last 5 Candles):
    ${recentCandles}
    
    USER QUERY:
    ${commandText}
    `;

    try {
      const response = await generateMarketAnalysis(marketContext, signals);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: response.text,
        sources: response.sources,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, aiMsg]);
      onNewAnalysis(response.text);
      speakText(response.text);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'model',
        content: "System Error: Connection to Neural Net interrupted.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSend = async () => {
    await executeCommand(input);
    setInput('');
  };

  const handleQuickAction = (action: string) => {
    let prompt = "";
    // Note: Context is now injected automatically in executeCommand
    switch (action) {
      case 'scan':
        prompt = "Scan current price action, RSI, and MACD. Look for divergences.";
        break;
      case 'strategy':
        prompt = "Analyze the current BitMind Tactical v2 signals. Are they aligned with the current volatility regime? Explain confluence.";
        break;
      case 'levels':
        prompt = "Identify key Support and Resistance levels based on the recent price action provided.";
        break;
      case 'correlation':
        prompt = "Analyze the correlation between BTC, VIX, and DXY based on the provided metrics. Is the market Risk-On or Risk-Off?";
        break;
    }

    if (prompt) executeCommand(prompt);
  };

  return (
    <div className="flex flex-col h-full bg-terminal-card border border-terminal-border rounded-lg overflow-hidden shadow-lg">
      <div className="p-3 border-b border-terminal-border bg-terminal-bg/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-terminal-accent">
          <Cpu size={18} />
          <span className="font-mono font-bold text-sm tracking-wider">AI STRATEGY CORE</span>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-1.5 rounded transition-colors ${voiceEnabled ? 'text-terminal-accent bg-terminal-accent/10' : 'text-terminal-muted hover:text-terminal-text'}`}
            title="Toggle Voice Response"
          >
            {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <div className="h-4 w-px bg-terminal-border mx-1"></div>
          {['scan', 'strategy', 'levels'].map(action => (
            <button
              key={action}
              onClick={() => handleQuickAction(action)}
              disabled={isThinking}
              className="text-[10px] uppercase px-2 py-1 bg-terminal-border hover:bg-terminal-accent hover:text-terminal-bg rounded transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-terminal-bg/20">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`flex items-start max-w-[95%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 shadow-md ${msg.role === 'model' ? 'bg-terminal-accent text-terminal-bg' : 'bg-terminal-border text-terminal-text'
                }`}>
                {msg.role === 'model' ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div className={`p-3 rounded-lg text-xs leading-relaxed shadow-sm ${msg.role === 'model' ? 'bg-terminal-bg border border-terminal-border/50' : 'bg-terminal-border text-terminal-text'
                }`}>
                <div className="prose prose-invert prose-sm max-w-none font-mono prose-p:leading-relaxed prose-headings:font-bold prose-a:text-terminal-accent">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-terminal-border/50">
                    <div className="text-[9px] uppercase text-terminal-muted mb-1 flex items-center gap-1">
                      <Search size={10} /> Intel Sources
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((source, idx) => (
                        <a
                          key={idx}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[9px] text-blue-400 hover:underline bg-blue-400/10 px-1.5 py-0.5 rounded"
                        >
                          {source.title.slice(0, 15)}... <ExternalLink size={8} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex items-center gap-2 text-terminal-accent text-xs font-mono animate-pulse px-4">
            <Cpu size={14} className="animate-spin" />
            RUNNING TACTICAL ANALYSIS...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-terminal-border bg-terminal-bg">
        <div className="flex gap-2">
          <button
            onClick={toggleListening}
            className={`p-2 rounded border transition-all ${isListening
              ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse'
              : 'bg-terminal-card border-terminal-border text-terminal-muted hover:text-terminal-text'
              }`}
            title="Voice Command"
          >
            <Mic size={18} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={isListening ? "Listening..." : "Query BitMind AI..."}
            className="flex-1 bg-terminal-card border border-terminal-border rounded px-3 py-2 text-xs focus:outline-none focus:border-terminal-accent font-mono transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={isThinking || !input.trim()}
            className="bg-terminal-accent text-terminal-bg px-3 py-2 rounded hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};