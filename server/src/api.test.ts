import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './index.js';

describe('Codrix REST API Endpoints', () => {
  let authToken: string;

  it('GET /api/v1/health returns ok status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toContain('Codrix');
  });

  it('POST /api/v1/auth/login authenticates seed user and issues JWT', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@codrix.co.in',
        password: 'Password123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.activeTenant.slug).toBe('codrix-demo');
    expect(res.body.data.roles).toContain('COMPANY_ADMIN');
    authToken = res.body.data.token;
  });

  it('GET /api/v1/reports/overview returns dashboard KPI numbers', async () => {
    const res = await request(app)
      .get('/api/v1/reports/overview')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.kpis.employeeCount).toBeGreaterThan(0);
    expect(res.body.data.kpis.openJobsCount).toBeGreaterThan(0);
  });

  it('GET /api/v1/recruitment/pipeline returns stages and applications', async () => {
    const res = await request(app)
      .get('/api/v1/recruitment/pipeline')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/engineering/tasks returns project tasks', async () => {
    const res = await request(app)
      .get('/api/v1/engineering/tasks')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((t: any) => t.taskCode === 'TSK-001')).toBe(true);
  });
});
