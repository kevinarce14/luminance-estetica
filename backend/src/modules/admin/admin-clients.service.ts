import { Injectable } from '@nestjs/common';
import {
  AppointmentStatus,
  PaymentStatus,
  type Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseAdminSearch, userMatches } from './admin-search';
import { AdminClientsQueryDto } from './dto/admin-query.dto';
import {
  toUserContact,
  type ClientSummary,
} from './interfaces/admin.interfaces';

/** Clientes del panel con métricas acumuladas de su historial. */
@Injectable()
export class AdminClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async listClients(query: AdminClientsQueryDto): Promise<ClientSummary[]> {
    const where: Prisma.UserWhereInput = {
      isAdmin: false,
      ...(query.is_active !== undefined ? { isActive: query.is_active } : {}),
    };
    const search = await parseAdminSearch(this.prisma, query.search);
    if (search) {
      where.OR = userMatches(search);
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: query.skip,
      take: query.limit,
    });
    if (users.length === 0) {
      return [];
    }
    const userIds = users.map((user) => user.id);

    // Dos agregaciones para toda la página (no una consulta por cliente).
    const [byStatus, paid] = await Promise.all([
      this.prisma.appointment.groupBy({
        by: ['userId', 'status'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
        _max: { appointmentDate: true },
      }),
      this.prisma.payment.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, status: PaymentStatus.APPROVED },
        _sum: { amount: true },
      }),
    ]);

    const paidByUser = new Map(
      paid.map((row) => [row.userId, row._sum.amount ?? 0]),
    );

    return users.map((user) => {
      const rows = byStatus.filter((row) => row.userId === user.id);
      const count = (status?: AppointmentStatus) =>
        rows
          .filter((row) => status === undefined || row.status === status)
          .reduce((total, row) => total + row._count._all, 0);
      const lastDate = rows
        .map((row) => row._max.appointmentDate)
        .filter((date): date is Date => date !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0];

      return {
        ...toUserContact(user),
        is_active: user.isActive,
        created_at: user.createdAt.toISOString(),
        appointments_count: count(),
        completed_count: count(AppointmentStatus.COMPLETED),
        cancelled_count: count(AppointmentStatus.CANCELLED),
        last_appointment_date: lastDate?.toISOString() ?? null,
        total_paid: paidByUser.get(user.id) ?? 0,
      };
    });
  }
}
