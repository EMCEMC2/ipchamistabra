/**
 * MSW Server Setup
 * Mock server for testing API interactions
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Create the mock server with default handlers
export const server = setupServer(...handlers);

// Export types for handler customization
export { http, HttpResponse } from 'msw';
export { handlers };
