import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { AdminAgendaService } from './admin-agenda.service';
import { AdminClientsService } from './admin-clients.service';
import { AdminReportsService } from './admin-reports.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [AvailabilityModule],
  controllers: [AdminController],
  providers: [AdminAgendaService, AdminClientsService, AdminReportsService],
})
export class AdminModule {}
