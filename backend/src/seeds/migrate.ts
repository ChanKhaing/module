import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedRunner } from './seed.runner';

async function migrate() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const runner = app.get(SeedRunner);
    const result = await runner.run();

    console.log('✅ Migration done:', result);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await app.close();
  }
}

migrate();