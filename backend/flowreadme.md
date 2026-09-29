backend/README.md မှာ (သို့) စိတ်ထဲ မှတ်ထား —

Module	တာဝန်
users/	User CRUD, profile
auth/	Register, Login, JWT, OTP
tickets/	Ticket product (create, list, detail)
orders/	Order/Booking (user က ticket ဝယ်)
payments/	Payment (mock), status
support/	Support ticket, chat, attachment
common/	Shared code (guards, filters, utils)


npm i @nestjs/mongoose mongoose @nestjs/config


import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TicketsModule } from './tickets/tickets.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { SupportModule } from './support/support.module';

@Module({
  imports: [
    // 1. .env ကို global ဖတ်
    ConfigModule.forRoot({ isGlobal: true }),

    // 2. MongoDB ချိတ်
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
      }),
    }),

    // 3. Feature modules
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
export class AppModule {}



