import React, { useEffect, useState } from 'react';
import { Shield, Lock, Save, AlertTriangle } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_TRADING_API_URL || 'http://localhost:3000';

export const KeyMigration: React.FC = () => {
    const [showModal, setShowModal] = useState(false);
    const [adminSecret, setAdminSecret] = useState('');
    const [status, setStatus] = useState<'IDLE' | 'MIGRATING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [error, setError] = useState('');

    useEffect(() => {
        const geminiKey = localStorage.getItem('GEMINI_API_KEY');
        if (geminiKey) {
            setShowModal(true);
        }
    }, []);

    const handleMigration = async () => {
        const geminiKey = localStorage.getItem('GEMINI_API_KEY');
        if (!geminiKey) return;

        setStatus('MIGRATING');
        setError('');

        try {
            const response = await fetch(`${BACKEND_URL}/api/keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-secret': adminSecret
                },
                body: JSON.stringify({
                    geminiKey: geminiKey
                })
            });

            // Wait, the backend keys route maps:
            // apiKey -> BINANCE_TESTNET_KEY
            // apiSecret -> BINANCE_TESTNET_SECRET
            // tradingKey -> TRADING_API_KEY
            
            // But I want to migrate GEMINI_API_KEY!
            // I need to update the backend route to support GEMINI_API_KEY.
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.details || data.error || 'Migration Failed');
            }

            // Success
            localStorage.removeItem('GEMINI_API_KEY');
            setStatus('SUCCESS');
            setTimeout(() => {
                setShowModal(false);
                window.location.reload();
            }, 2000);

        } catch (err: any) {
            setStatus('ERROR');
            setError(err.message);
        }
    };

    if (!showModal) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
            <div className="bg-terminal-card border border-yellow-500/50 rounded-lg shadow-2xl max-w-md w-full p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500" />

                <div className="flex items-center gap-3 mb-6 text-yellow-500">
                    <div className="p-3 bg-yellow-500/10 rounded-full">
                        <Shield size={32} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold font-mono tracking-wider">SECURITY UPDATE</h2>
                        <p className="text-xs text-yellow-400 font-mono">KEY MIGRATION REQUIRED</p>
                    </div>
                </div>

                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-6">
                    <p className="text-xs text-yellow-200 leading-relaxed">
                        We have upgraded our security protocols. Your AI API Key is currently stored in your browser (LocalStorage), which is not secure.
                    </p>
                    <p className="text-xs text-yellow-200 leading-relaxed mt-2 font-bold">
                        Please migrate your key to the secure backend server.
                    </p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-mono text-terminal-muted mb-1">ADMIN SECRET (Required to authorize)</label>
                        <div className="relative">
                            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-muted" />
                            <input
                                type="password"
                                value={adminSecret}
                                onChange={(e) => setAdminSecret(e.target.value)}
                                className="w-full bg-terminal-bg border border-terminal-border rounded p-2 pl-9 text-xs font-mono text-terminal-text focus:border-terminal-accent outline-none transition-colors"
                                placeholder="Enter Admin Secret..."
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 p-2 rounded border border-red-500/20">
                            <AlertTriangle size={12} />
                            <span>{error}</span>
                        </div>
                    )}

                    {status === 'SUCCESS' && (
                        <div className="flex items-center gap-2 text-green-400 text-xs bg-green-500/10 p-2 rounded border border-green-500/20">
                            <Shield size={12} />
                            <span>Migration Successful! Reloading...</span>
                        </div>
                    )}

                    <button
                        onClick={handleMigration}
                        disabled={!adminSecret || status === 'MIGRATING' || status === 'SUCCESS'}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 text-black rounded text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        {status === 'MIGRATING' ? (
                            <span className="animate-pulse">MIGRATING...</span>
                        ) : (
                            <>
                                <Save size={16} />
                                MIGRATE TO SECURE STORAGE
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
