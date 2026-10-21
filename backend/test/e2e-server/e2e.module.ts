import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  initialAdminFromEnv,
  seedInitialData,
  type SeedSummary,
} from '../../src/database/initial-data';
import { AppointmentStatus } from '../../src/generated/prisma/client';
import { ParseIdPipe } from '../../src/common/pipes/parse-id.pipe';
import { PrismaService } from '../../src/prisma/prisma.service';
import { E2eMailbox, FakeMercadoPagoClient, type SentMail } from './fakes';

/** Tablas de la app, en orden seguro para TRUNCATE … CASCADE. */
const TABLES = [
  'payments',
  'appointments',
  'availability',
  'coupons',
  'users',
  'services',
];

@Injectable()
export class E2eService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailbox: E2eMailbox,
    private readonly mercadoPago: FakeMercadoPagoClient,
  ) {}

  seed(): Promise<SeedSummary> {
    return seedInitialData(this.prisma, initialAdminFromEnv(process.env));
  }

  /** Vacía todas las tablas (reinicia los IDs) y vuelve a cargar los datos iniciales. */
  async resetDatabase(): Promise<SeedSummary> {
    const tables = TABLES.map(
      (table) => `"luminance-estetica"."${table}"`,
    ).join(', ');
    await this.prisma.$executeRawUnsafe(
      `TRUNCATE ${tables} RESTART IDENTITY CASCADE`,
    );
    this.mailbox.clear();
    this.mercadoPago.clear();
    return this.seed();
  }

  resetTokenFor(email: string): string {
    const token = this.mailbox.resetTokenFor(email.trim().toLowerCase());
    if (!token) {
      throw new NotFoundException(
        `No se envió un email de recuperación a ${email}`,
      );
    }
    return token;
  }

  /** Mueve un turno a ayer (como si ya hubiera ocurrido) con el estado indicado. */
  async moveToPast(id: number, status: string): Promise<void> {
    const target = status.toUpperCase();
    if (!(target in AppointmentStatus)) {
      throw new NotFoundException(`Estado desconocido: ${status}`);
    }
    await this.prisma.appointment.update({
      where: { id },
      data: {
        appointmentDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        status: target as AppointmentStatus,
      },
    });
  }

  emails(): SentMail[] {
    return this.mailbox.messages;
  }
}

/**
 * Rutas auxiliares de las pruebas E2E (fuera del prefijo /api, igual que el harness
 * de FastAPI). Solo existen en el proceso de test/e2e-server: la app de producción no
 * importa este módulo.
 */
@Controller('__e2e__')
export class E2eController {
  constructor(private readonly e2e: E2eService) {}

  @Post('reset-db')
  @HttpCode(HttpStatus.OK)
  resetDatabase(): Promise<SeedSummary> {
    return this.e2e.resetDatabase();
  }

  @Post('seed')
  @HttpCode(HttpStatus.OK)
  seed(): Promise<SeedSummary> {
    return this.e2e.seed();
  }

  @Get('reset-token')
  resetToken(@Query('email') email = ''): { token: string } {
    return { token: this.e2e.resetTokenFor(email) };
  }

  @Get('emails')
  emails(): SentMail[] {
    return this.e2e.emails();
  }

  @Post('appointments/:id/move-to-past')
  @HttpCode(HttpStatus.OK)
  async moveToPast(
    @Param('id', ParseIdPipe) id: number,
    @Query('status') status = 'CONFIRMED',
  ): Promise<{ ok: true }> {
    await this.e2e.moveToPast(id, status);
    return { ok: true };
  }
}

export function createE2eModule(
  mailbox: E2eMailbox,
  mercadoPago: FakeMercadoPagoClient,
) {
  @Module({
    controllers: [E2eController],
    providers: [
      E2eService,
      { provide: E2eMailbox, useValue: mailbox },
      { provide: FakeMercadoPagoClient, useValue: mercadoPago },
    ],
  })
  class E2eModule {}
  return E2eModule;
}
