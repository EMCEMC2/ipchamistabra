import fs from 'fs';
import path from 'path';

export interface AuditLogEntry {
    timestamp: string;
    action: 'ORDER_PLACED' | 'ORDER_CANCELLED' | 'ORDER_FAILED' | 'ERROR';
    orderId?: string;
    symbol?: string;
    side?: string;
    quantity?: number;
    price?: number;
    status: 'SUCCESS' | 'FAILURE';
    error?: string;
    correlationId?: string;
}

const LOG_DIR = path.join(process.cwd(), 'audit_logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

export const auditService = {
    logOrderAction: async (entry: Omit<AuditLogEntry, 'timestamp'>) => {
        const timestamp = new Date().toISOString();
        const logEntry: AuditLogEntry = {
            timestamp,
            ...entry
        };

        const dateStr = timestamp.split('T')[0];
        let logFile = path.join(LOG_DIR, `audit-${dateStr}.log`);

        // Simple Rotation: Check size, if > 10MB, append timestamp to filename
        try {
            const stats = await fs.promises.stat(logFile).catch(() => null);
            if (stats && stats.size > 10 * 1024 * 1024) { // 10MB
                const timeStr = timestamp.replace(/[:.]/g, '-');
                logFile = path.join(LOG_DIR, `audit-${dateStr}-${timeStr}.log`);
            }
        } catch (e) {
            // Ignore stat errors
        }

        const logLine = JSON.stringify(logEntry) + '\n';

        // Async append
        fs.appendFile(logFile, logLine, (err) => {
            if (err) {
                console.error('[AuditService] Failed to write to log file:', err);
            }
        });
    }
};
