import React, { useState } from 'react';
import { Key, AlertTriangle, Save, RefreshCw, Shield } from 'lucide-react';
import { useStore } from '../store/useStore';

export const ApiKeyModal: React.FC = () => {
    const [geminiKey, setGeminiKey] = useState('');

    const handleSave = () => {
        let reload = false;
        if (geminiKey.trim().length > 10) {
            localStorage.setItem('GEMINI_API_KEY', geminiKey.trim());
            reload = true;
        }

        if (reload) window.location.reload();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            <div className="bg-terminal-card border border-red-500/50 rounded-lg shadow-2xl max-w-md w-full p-6 relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 animate-pulse" />

                <div className="flex items-center gap-3 mb-6 text-red-500">
                    <div className="p-3 bg-red-500/10 rounded-full">
                        <AlertTriangle size={32} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold font-mono tracking-wider">SYSTEM CONFIG</h2>
                        <p className="text-xs text-red-400 font-mono">API KEYS REQUIRED</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-mono text-terminal-muted mb-1">GEMINI API KEY (AI INTELLIGENCE)</label>
                        <div className="relative">
                            <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-muted" />
                            <input
                                type="password"
                                value={geminiKey}
                                onChange={(e) => setGeminiKey(e.target.value)}
                                className="w-full bg-terminal-bg border border-terminal-border rounded p-2 pl-9 text-xs font-mono text-terminal-text focus:border-terminal-accent outline-none transition-colors"
                                placeholder="sk-..."
                            />
                        </div>
                    </div>

                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <div className="flex items-center gap-2 text-blue-400 mb-2">
                            <Shield size={14} />
                            <span className="text-xs font-bold">SECURE BACKEND ACTIVE</span>
                        </div>
                        <p className="text-[10px] text-blue-300/70 leading-relaxed">
                            Binance API keys are now securely managed by the backend server. 
                            You do not need to enter them here. Ensure your backend server is running.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-4 py-2 bg-terminal-accent text-black rounded text-xs font-bold hover:brightness-110 transition-all"
                        >
                            <Save size={14} />
                            SAVE & RELOAD
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
