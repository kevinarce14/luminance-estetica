import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { MyAppointmentsController } from './my-appointments.controller';

@Module({
  imports: [AvailabilityModule],
  controllers: [AppointmentsController, MyAppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
