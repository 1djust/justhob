import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

describe('API Health Check', () => {
  it('GET /health should return status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    const data = response.json();

    expect(response.statusCode).toBe(200);
    expect(data).toEqual({ status: 'ok' });
  });
});

describe('API Auth Routes', () => {
  it('POST /api/auth/login without body should return 400 or 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {},
    });

    // Should reject empty credentials
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(response.statusCode).toBeLessThan(500);
  });

  it('GET /api/auth/me without token should return 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('API Protected Routes', () => {
  it('GET /api/workspaces without auth should return 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/workspaces',
    });

    expect(response.statusCode).toBe(401);
  });
});
