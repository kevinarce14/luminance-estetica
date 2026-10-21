import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AuthModule } from './modules/auth/auth.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ServicesModule } from './modules/services/services.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    MailModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ServicesModule,
    AvailabilityModule,
    AppointmentsModule,
    PaymentsModule,
  ],
})
export class AppModule {}
