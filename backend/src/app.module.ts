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

    // Infrastructure & Common Modules
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
