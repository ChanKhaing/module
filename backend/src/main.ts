import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule, ObserveInstrument } from './app.module';
import { NestFactory,Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import {
  AllExceptionsFilter,
  LoggerService,
  ResponseInterceptor,
} from './common';


async function bootstrap() {
  const app = await NestFactory.create(AppModule,{
        bufferLogs: true,                    // ← startup logs ကို buffer

  });
    const logger = app.get(LoggerService);
    app.useLogger(logger);       
  const reflector = app.get(Reflector);
    // ⚠️ Order အရေးကြီး
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
  
  // ─── Swagger (dev only) ───
  const config = new DocumentBuilder()
    .setTitle('Ticket Platform API')
    .setDescription('Backend API for ticket booking platform')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'access-token',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('roles', 'RBAC roles')
    .addTag('permissions', 'RBAC permissions')
    .addTag('tickets', 'Ticket products')
    .addTag('orders', 'Orders')
    .addTag('payments', 'Payments')
    .addTag('purchased-tickets', 'Purchased tickets')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  console.log(`📚 Swagger docs: http://localhost:${port}/api`);

  await app.listen(port);
  logger.log(`🚀 Server running on http://localhost:${port}`, 'Bootstrap');

}
void bootstrap();


// 1. Interceptor  → response wrap
// 2. Filter       → error catch
// 3. Pipe         → validation

// Filter က Interceptor ရဲ့ error ကို ဖမ်းမယ်။