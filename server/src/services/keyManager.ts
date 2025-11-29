import fs from 'fs';
import path from 'path';

const SECRETS_FILE = path.join(process.cwd(), 'secrets.json');

interface Secrets {
    BINANCE_TESTNET_KEY?: string;
    BINANCE_TESTNET_SECRET?: string;
    TRADING_API_KEY?: string;
    GEMINI_API_KEY?: string;
}

// Ensure secrets file exists
if (!fs.existsSync(SECRETS_FILE)) {
    fs.writeFileSync(SECRETS_FILE, JSON.stringify({}, null, 2));
}

export const keyManager = {
    getSecrets: (): Secrets => {
        try {
            if (fs.existsSync(SECRETS_FILE)) {
                return JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8'));
            }
        } catch (error) {
            console.error('Failed to read secrets file:', error);
        }
        return {};
    },

    setSecrets: (newSecrets: Partial<Secrets>) => {
        const current = keyManager.getSecrets();
        const updated = { ...current, ...newSecrets };
        fs.writeFileSync(SECRETS_FILE, JSON.stringify(updated, null, 2));
    },

    // Helper to get a key (Env var takes precedence, then secrets file)
    getKey: (keyName: keyof Secrets): string => {
        if (process.env[keyName]) return process.env[keyName]!;
        const secrets = keyManager.getSecrets();
        return secrets[keyName] || '';
    }
};
