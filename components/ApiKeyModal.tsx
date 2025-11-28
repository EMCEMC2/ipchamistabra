import React, { useState } from 'react';
import { Key, AlertTriangle, Save, RefreshCw, Shield, ExternalLink } from 'lucide-react';
import { useStore } from '../store/useStore';

interface ApiKeyModalProps {
    errorMessage?: string;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ errorMessage }) => {
    const [geminiKey, setGeminiKey] = useState('');
    const [error, setError] = useState(errorMessage || '');

    const isLeakedKeyError = error.includes('leaked') || error.includes('403') || error.includes('PERMISSION_DENIED');

    const handleSave = () => {
        const key = geminiKey.trim();

        if (key.length < 10) {
            setError('API key is too short');
            return;
        }

        if (!key.startsWith('AIza')) {
            setError('Invalid key format. Gemini keys start with "AIza"');
            return;
        }

        localStorage.setItem('GEMINI_API_KEY', key);
        window.location.reload();
    };

    const handleGetKey = () => {
        window.open('https://aistudio.google.com/apikey', '_blank');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            <div className="bg-terminal-card border border-red-500/50 rounded-lg shadow-2xl max-w-md w-full p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 animate-pulse" />

                <div className="flex items-center gap-3 mb-6 text-red-500">
                    <div className="p-3 bg-red-500/10 rounded-full">
                        <AlertTriangle size={32} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold font-mono tracking-wider">
                            {isLeakedKeyError ? 'API KEY REVOKED' : 'SYSTEM CONFIG'}
                        </h2>
                        <p className="text-xs text-red-400 font-mono">
                            {isLeakedKeyError ? 'KEY REPORTED AS LEAKED' : 'API KEY REQUIRED'}
                        </p>
                    </div>
                </div>

                {isLeakedKeyError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                        <p className="text-xs text-red-300 leading-relaxed">
                            Your API key was flagged as compromised by Google. This happens when keys appear in:
                        </p>
                        <ul className="text-[10px] text-red-300/70 mt-2 space-y-1 list-disc list-inside">
                            <li>Screenshots shared publicly</li>
                            <li>Code committed to GitHub</li>
                            <li>Browser network logs</li>
                        </ul>
                        <p className="text-xs text-red-300 mt-2 font-bold">
                            Generate a NEW key below. The old key cannot be reused.
                        </p>
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-mono text-terminal-muted mb-1">GEMINI API KEY</label>
                        <div className="relative">
                            <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-muted" />
                            <input
                                type="password"
                                value={geminiKey}
                                onChange={(e) => {
                                    setGeminiKey(e.target.value);
                                    setError('');
                                }}
                                className="w-full bg-terminal-bg border border-terminal-border rounded p-2 pl-9 text-xs font-mono text-terminal-text focus:border-terminal-accent outline-none transition-colors"
                                placeholder="AIza..."
                            />
                        </div>
                        {error && (
                            <p className="text-[10px] text-red-400 mt-1">{error}</p>
                        )}
                    </div>

                    <button
                        onClick={handleGetKey}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded text-xs font-bold hover:bg-blue-500/30 transition-all"
                    >
                        <ExternalLink size={14} />
                        GET NEW API KEY FROM GOOGLE AI STUDIO
                    </button>

                    <div className="p-3 bg-terminal-bg border border-terminal-border rounded-lg">
                        <p className="text-[10px] text-terminal-muted leading-relaxed">
                            <span className="text-terminal-accent font-bold">Steps:</span><br />
                            1. Click the button above to open Google AI Studio<br />
                            2. Sign in with your Google account<br />
                            3. Click "Create API Key"<br />
                            4. Copy the key and paste it above
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button
                            onClick={handleSave}
                            disabled={geminiKey.trim().length < 10}
                            className="flex items-center gap-2 px-4 py-2 bg-terminal-accent text-black rounded text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
