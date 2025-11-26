import crypto from 'crypto';
import { config } from '../config';

export const binanceSigner = {
    sign: (queryString: string) => {
        if (!config.binance.apiSecret) {
            throw new Error('Binance API Secret is missing');
        }
        return crypto
            .createHmac('sha256', config.binance.apiSecret)
            .update(queryString)
            .digest('hex');
    }
};
