import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ─── Global Validation Pipe ───
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // DTO မှာ မပါတဲ့ field → strip
      forbidNonWhitelisted: true,   // strip မလုပ်ဘူး → 400 error
      transform: true,              // type auto convert
      transformOptions: {
        enableImplicitConversion: true,   // "25" → 25
      },
      disableErrorMessages: false,  // dev မှာ error detail ပြ
      validationError: {
        target: false,              // error မှာ DTO object မပြ
        value: false,               // error မှာ value မပြ
      },
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  Logger.log(`🚀 Server running on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();