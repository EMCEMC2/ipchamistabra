import { GoogleGenAI } from "@google/genai";
import { keyManager } from './keyManager';

export const aiService = {
    getClient: () => {
        const apiKey = keyManager.getKey('GEMINI_API_KEY');
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY not configured on server');
        }
        return new GoogleGenAI({ apiKey });
    },

    generateContent: async (model: string, contents: any, config?: any) => {
        const client = aiService.getClient();
        try {
            const response = await client.models.generateContent({
                model,
                contents,
                config
            });
            return response;
        } catch (error: any) {
            console.error('[AI Service] Generate Content Error:', error);
            throw error;
        }
    }
};
