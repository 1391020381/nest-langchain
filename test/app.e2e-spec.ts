import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Learning API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => app.close());

  it('导出 LangGraph Mermaid 图且不需要模型密钥', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/graphs/support-router/mermaid')
      .expect(200);

    expect(response.body.mermaid).toContain('router');
    expect(response.body.mermaid).toContain('refund');
  });
});
