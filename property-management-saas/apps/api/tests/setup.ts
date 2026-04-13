/**
 * Vitest global setup file.
 * Runs before all test suites.
 *
 * Use this to:
 * - Set environment variables for tests
 * - Initialize mock databases or services
 * - Configure global test utilities
 */

// Ensure we're in test environment
process.env.NODE_ENV = 'test';

// Suppress noisy logs during testing
process.env.LOG_LEVEL = 'silent';
