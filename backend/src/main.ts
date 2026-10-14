import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import {
  AllExceptionsFilter,
  LoggerService,
  ResponseInterceptor,
  AuditInterceptor,
} from './common';
import { ClickHouseService } from './infra/clickhouse';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // ─── Security ───
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ─── Trust proxy ───
  const httpAdapter = app.getHttpAdapter().getInstance();
  if (httpAdapter && httpAdapter.set) {
    httpAdapter.set('trust proxy', 1);
  }

  // ─── CORS ───
  const allowedOrigins = (
    process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:3001'
  )
    .split(',')
    .map((s) => s.trim());

  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'Idempotency-Key'],
  });

  const reflector = app.get(Reflector);

  // ─── Interceptor (အရင်) ───
  app.useGlobalInterceptors(
    new ResponseInterceptor(reflector),
    new AuditInterceptor(reflector, app.get(ClickHouseService), app.get(LoggerService)),
  );

  // ─── Filter ───
  app.useGlobalFilters(new AllExceptionsFilter());

  // ─── Pipe ───
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: false,
      validationError: {
        target: false,
        value: false,
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
    .addTag('attachments', 'File attachments')
    .addTag('notifications', 'Notifications')
    .addTag('admin', 'Admin dashboard + logs')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(port);
  logger.log(`🚀 Server running on http://localhost:${port}`, 'Bootstrap');
  console.log(`📚 Swagger docs: http://localhost:${port}/api`);
}
void bootstrap();
