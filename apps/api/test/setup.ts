process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.API_PREFIX = 'v1';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/salonos?schema=public';
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.APP_VERSION = '0.1.0-test';
