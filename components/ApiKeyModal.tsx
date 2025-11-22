import React, { useState } from 'react';
import { Key, AlertTriangle, Save, RefreshCw } from 'lucide-react';

export const ApiKeyModal: React.FC = () => {
    const [inputKey, setInputKey] = useState('');

    const handleSave = () => {
        if (inputKey.trim().length > 10) {
            localStorage.setItem('GEMINI_API_KEY', inputKey.trim());
            window.location.reload();
        }
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
                        <h2 className="text-xl font-bold font-mono tracking-wider">SYSTEM HALTED</h2>
                        <p className="text-xs text-red-400 font-mono">CRITICAL SECURITY ALERT</p>
                    </div>
                </div>

                <div className="space-y-4 font-mono text-sm text-gray-300">
                    <p>
                        The Neural Core cannot initialize because the <strong className="text-white">Gemini API Key</strong> is missing or invalid.
                    </p>

                    <div className="bg-black/50 border border-terminal-border p-3 rounded text-xs text-gray-400">
                        <p className="mb-2">Option 1: Add to <code className="text-terminal-accent">.env.local</code> file:</p>
                        <code className="block bg-black p-2 rounded text-green-400">
                            VITE_GEMINI_API_KEY=your_key_here
                        </code>
                    </div>

                    <div className="flex items-center gap-2 my-4">
                        <div className="h-px bg-terminal-border flex-1" />
                        <span className="text-xs text-gray-500">OR TEMPORARY OVERRIDE</span>
                        <div className="h-px bg-terminal-border flex-1" />
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Enter API Key Manually (Saved to Local Storage)</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Key size={14} className="absolute left-3 top-3 text-gray-500" />
                                <input
                                    type="password"
                                    value={inputKey}
                                    onChange={(e) => setInputKey(e.target.value)}
                                    placeholder="AIzaSy..."
                                    className="w-full bg-black border border-terminal-border rounded py-2 pl-9 pr-3 focus:border-terminal-accent focus:outline-none text-white"
                                />
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={inputKey.length < 10}
                                className="bg-terminal-accent text-black px-4 py-2 rounded font-bold hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Save size={16} />
                                INIT
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-terminal-border flex justify-center">
                    <button
                        onClick={() => window.location.reload()}
                        className="text-xs text-gray-500 hover:text-white flex items-center gap-2 transition-colors"
                    >
                        <RefreshCw size={12} />
                        Reload System
                    </button>
                </div>
            </div>
        </div>
    );
};
