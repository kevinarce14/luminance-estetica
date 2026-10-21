import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AppointmentsService } from './appointments.service';
import { MyAppointmentsQueryDto } from './dto/appointment.dto';
import {
  toAppointmentWithDetails,
  type AppointmentWithDetails,
} from './interfaces/appointment-response.interface';

/**
 * GET /api/users/me/appointments. Vive en este módulo (y no en UsersModule) para que
 * la lógica de turnos quede en un solo lugar.
 */
@Controller('users/me/appointments')
@UseGuards(JwtAuthGuard)
export class MyAppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  async list(
    @CurrentUser() user: User,
    @Query() query: MyAppointmentsQueryDto,
  ): Promise<AppointmentWithDetails[]> {
    const appointments = await this.appointmentsService.listMineByWhen(
      user,
      query,
    );
    return appointments.map(toAppointmentWithDetails);
  }
}
