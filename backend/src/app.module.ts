import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TicketsModule } from './tickets/tickets.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { SupportModule } from './support/support.module';
import { SharedModule, LoggerModule, RequestIdMiddleware } from './common';
import { HealthModule } from './health/health.module';
import {  RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
export const { ObserveModule, ObserveInstrument } = createObserveModule();
import { SecurityModule } from './common/security';
import { RedisModule } from './infra/redis';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtModuleOptions, JwtService  } from '@nestjs/jwt';
import { JwtAuthGuard } from './common';
import type { StringValue } from 'ms';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from './infra/mail/mail.module';
import { SeedModule } from './seeds/seed.module';


@Module({
imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database Connection
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
      }),
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      global: true,                    // ← global ဖြစ်စေ
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m') as StringValue,
        },
      }),
    }),

    // Infrastructure & Common Modules
    MailModule,
    RedisModule,
    SecurityModule,
    LoggerModule,
    SharedModule,
    HealthModule,

    // Core RBAC Modules
    PermissionsModule,
    RolesModule,

    // Feature Modules
    UsersModule,
    AuthModule,
    TicketsModule,
    OrdersModule,
    PaymentsModule,
    SupportModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [AppService,
    {
    provide: APP_GUARD,
    useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
