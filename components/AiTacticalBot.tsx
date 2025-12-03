import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MessageSquare,
  Activity,
  Brain,
  Send,
  RefreshCw,
  BarChart3,
  Target,
  TrendingUp,
  Sparkles,
  Zap,
  AlertTriangle,
  Clock,
  DollarSign,
  ChevronRight
} from 'lucide-react';
import { tacticalAI } from '../services/tacticalAI';
import { TacticalChatMessage, TradeSignal } from '../types';
import { useStore } from '../store/useStore';
import { usePriceData, useTechnicals, useSignalsData } from '../store/selectors';
import ReactMarkdown from 'react-markdown';

// Removed tab navigation - single chat panel only

const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<TacticalChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const signals = useStore(state => state.signals);
  const activeSignals = useMemo(() =>
    signals?.filter(s => s.status === 'ACTIVE') || [],
    [signals]
  );

  const quickPrompts = [
    { text: 'Market overview', icon: BarChart3 },
    { text: 'Should I long or short?', icon: Target },
    { text: 'Analyze order flow', icon: Activity },
    { text: 'Latest whale activity', icon: TrendingUp }
  ];

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      setApiKeyMissing(true);
    } else {
      setApiKeyMissing(false);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTimeIsrael = (timestamp: number): string => {
    try {
      return new Date(timestamp).toLocaleTimeString('en-IL', {
        timeZone: 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return new Date(timestamp).toLocaleTimeString();
    }
  };

  const handleSend = async (queryText?: string): Promise<void> => {
    const query = queryText || input.trim();

    if (!query || isProcessing) {
      return;
    }

    const userMessage: TacticalChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      const response = await tacticalAI.processQuery({
        query,
        context: {
          activeSignals
        }
      });

      setMessages(prev => [...prev, response]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const systemMessage: TacticalChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'system',
        content: `Error processing query: ${errorMessage}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, systemMessage]);
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col p-3 gap-3">
      {/* Messages Area - Scrollable Chat History */}
      <div className="flex-1 min-h-0 bg-white/5 rounded-lg border border-white/10 overflow-y-auto custom-scrollbar p-3 scroll-smooth">
        {apiKeyMissing ? (
          <div className="h-full flex flex-col items-center justify-center px-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md">
              <div className="flex items-center gap-3 mb-3">
                <MessageSquare size={24} className="text-red-400" />
                <h3 className="text-sm font-bold text-red-400 font-mono">API Key Required</h3>
              </div>
              <p className="text-sm text-red-200 mb-4 font-mono leading-relaxed">
                Chat requires Gemini API key. Add <span className="bg-black/40 px-2 py-0.5 rounded text-red-300">VITE_GEMINI_API_KEY</span> to your .env file.
              </p>
              <div className="bg-black/30 rounded-lg p-3 border border-red-500/20">
                <p className="text-xs text-gray-400 font-mono mb-2">Example .env configuration:</p>
                <code className="text-xs text-green-400 font-mono">VITE_GEMINI_API_KEY=your_api_key_here</code>
              </div>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <Sparkles size={32} className="text-green-400/50 mb-4" />
            <p className="text-sm text-gray-400 mb-4 font-mono">Ask me about the market</p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(prompt.text)}
                  disabled={isProcessing || apiKeyMissing}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-green-500/30 rounded-lg text-xs text-gray-400 hover:text-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <prompt.icon size={12} />
                  <span className="truncate">{prompt.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 min-h-0">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/30 text-green-100'
                      : msg.role === 'system'
                        ? 'bg-red-500/20 border border-red-500/30 text-red-200'
                        : 'bg-white/10 text-gray-200'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none text-sm">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                  <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-green-400/60' : 'text-gray-500'}`}>
                    {formatTimeIsrael(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area - Fixed at Bottom */}
      <div className="shrink-0 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={apiKeyMissing ? "API key required" : "Ask about markets..."}
          disabled={isProcessing || apiKeyMissing}
          className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 disabled:opacity-50 font-mono transition-all"
        />
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={isProcessing || !input.trim() || apiKeyMissing}
          className="shrink-0 px-4 py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-lg text-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isProcessing ? (
            <RefreshCw size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    </div>
  );
};

// Removed FlowPanel and SignalsPanel - functionality exists in terminal dashboard

export const AiTacticalBot: React.FC = () => {
  return (
    <div className="h-full flex flex-col bg-black/20 rounded-lg border border-white/10 overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-green-400" />
          <span className="text-sm font-bold text-white font-mono">TACTICAL AI</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded font-mono">
          v2.1
        </span>
      </div>

      {/* Chat Panel - Flexible Height with Internal Scroll */}
      <div className="flex-1 min-h-0">
        <ChatPanel />
      </div>
    </div>
  );
};

export default AiTacticalBot;
