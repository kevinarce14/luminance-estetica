import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAgendaService } from './admin-agenda.service';
import { AdminClientsService } from './admin-clients.service';
import { AdminReportsService } from './admin-reports.service';
import {
  AdminAppointmentsQueryDto,
  AdminClientsQueryDto,
  AdminPaymentsQueryDto,
  MonthlyReportQueryDto,
  UpcomingQueryDto,
  YearlyReportQueryDto,
} from './dto/admin-query.dto';
import {
  toAppointmentAdminView,
  toPaymentAdminView,
  type AppointmentAdminView,
  type ClientSummary,
  type DashboardMetrics,
  type MonthlyReport,
  type PaymentAdminView,
  type YearlyReport,
} from './interfaces/admin.interfaces';

/**
 * Panel de administración (mismo contrato que /api/admin de FastAPI). Las acciones
 * (cambiar estados, cobrar, ABM) viven en los módulos de cada dominio y reutilizan sus
 * reglas: PUT /appointments/:id, POST /payments/cash-payment, PUT /payments/:id/status,
 * PUT /users/:id/toggle-active, /services y /availability.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly agenda: AdminAgendaService,
    private readonly clients: AdminClientsService,
    private readonly reports: AdminReportsService,
  ) {}

  @Get('dashboard')
  getDashboard(): Promise<DashboardMetrics> {
    return this.reports.getDashboard();
  }

  @Get('appointments')
  async listAppointments(
    @Query() query: AdminAppointmentsQueryDto,
  ): Promise<AppointmentAdminView[]> {
    const appointments = await this.agenda.listAppointments(query);
    return appointments.map(toAppointmentAdminView);
  }

  @Get('appointments/upcoming')
  async listUpcoming(
    @Query() query: UpcomingQueryDto,
  ): Promise<AppointmentAdminView[]> {
    const appointments = await this.agenda.listUpcoming(query.days);
    return appointments.map(toAppointmentAdminView);
  }

  @Get('appointments/today')
  async listToday(): Promise<AppointmentAdminView[]> {
    const appointments = await this.agenda.listToday();
    return appointments.map(toAppointmentAdminView);
  }

  @Get('payments')
  async listPayments(
    @Query() query: AdminPaymentsQueryDto,
  ): Promise<PaymentAdminView[]> {
    const payments = await this.agenda.listPayments(query);
    return payments.map(toPaymentAdminView);
  }

  @Get('clients')
  listClients(@Query() query: AdminClientsQueryDto): Promise<ClientSummary[]> {
    return this.clients.listClients(query);
  }

  @Get('reports/yearly')
  getYearlyReport(@Query() query: YearlyReportQueryDto): Promise<YearlyReport> {
    return this.reports.getYearlyReport(query.year);
  }

  @Get('reports/monthly')
  getMonthlyReport(
    @Query() query: MonthlyReportQueryDto,
  ): Promise<MonthlyReport> {
    return this.reports.getMonthlyReport(query.year, query.month);
  }
}
