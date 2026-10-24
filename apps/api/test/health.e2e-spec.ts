import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';

describe('Health API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue({ checkConnection: jest.fn().mockResolvedValue(true) })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => app?.close());

  it('reports API and database readiness', async () => {
    await request(app.getHttpServer()).get('/v1/health').expect(200).expect(({ body }) => {
      expect(body.status).toBe('ok');
      expect(body.database).toBe('connected');
      expect(body.timestamp).toEqual(expect.any(String));
    });
  });

  it('exposes API version metadata', async () => {
    await request(app.getHttpServer()).get('/v1/system/version').expect(200).expect(({ body }) => {
      expect(body.name).toBe('SalonOS API');
      expect(body.version).toBeTruthy();
    });
  });
});
