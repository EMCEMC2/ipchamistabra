import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCcw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="h-full w-full flex flex-col items-center justify-center bg-black text-red-500 p-4 border border-red-500/30 rounded bg-[url('/grid.svg')] bg-center">
                    <AlertOctagon size={48} className="mb-4 animate-pulse" />
                    <h2 className="text-xl font-bold font-mono mb-2 tracking-widest">SYSTEM MALFUNCTION</h2>
                    <div className="bg-red-950/30 p-3 rounded border border-red-900/50 mb-4 max-w-md w-full">
                        <p className="text-xs font-mono text-red-400 text-center break-all">
                            {this.state.error?.message || "Critical process failure detected."}
                        </p>
                    </div>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500 rounded text-xs font-mono transition-colors uppercase tracking-wider"
                    >
                        <RefreshCcw size={14} />
                        Reboot Module
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
