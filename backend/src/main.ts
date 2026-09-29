import { AppModule, ObserveInstrument } from './app.module';
import { NestFactory,Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import {
  AllExceptionsFilter,
  ResponseInterceptor,
} from './common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const reflector = app.get(Reflector);

  // ─── Interceptor (အရင်) ───
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));

    // ─── Global Exception Filter  ───
  app.useGlobalFilters(new AllExceptionsFilter());

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
void bootstrap();


// 1. Interceptor  → response wrap
// 2. Filter       → error catch
// 3. Pipe         → validation

// Filter က Interceptor ရဲ့ error ကို ဖမ်းမယ်။