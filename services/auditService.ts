import { useStore } from '../store/useStore';

export const exportAuditLog = () => {
    const state = useStore.getState();
    
    const auditData = {
        exportTimestamp: new Date().toISOString(),
        account: {
            balance: state.balance,
            dailyPnL: state.dailyPnL,
            dailyLossLimit: state.dailyLossLimit,
            isCircuitBreakerTripped: state.isCircuitBreakerTripped
        },
        riskProfile: state.riskOfficer,
        activePositions: state.positions,
        tradeHistory: state.journal,
        systemStatus: {
            isLiveMode: state.isLiveMode,
            isSwarmActive: state.isSwarmActive
        }
    };

    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `ipcha-audit-log-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
