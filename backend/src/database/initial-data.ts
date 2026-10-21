import { hash } from 'bcryptjs';
import type { Prisma, PrismaClient } from '../generated/prisma/client';

/**
 * Datos iniciales (idempotente): administrador, catálogo de servicios y horario semanal,
 * los mismos que crea el backend FastAPI al arrancar (create_initial_data).
 * Lo usan `npm run db:seed` y el servidor de pruebas E2E.
 */

export const INITIAL_SERVICES: Prisma.ServiceCreateInput[] = [
  {
    name: 'Lifting de Pestañas',
    description:
      'Tratamiento profesional que realza, alarga y curva tus pestañas naturales.',
    durationMinutes: 60,
    price: 15000,
    category: 'pestañas',
  },
  {
    name: 'Laminado de Cejas',
    description:
      'Técnica que peina, moldea y fija las cejas dándoles forma perfecta.',
    durationMinutes: 45,
    price: 12000,
    category: 'cejas',
  },
  {
    name: 'Henna de Cejas',
    description:
      'Coloración natural de cejas con henna, rellena espacios y define la forma.',
    durationMinutes: 30,
    price: 8000,
    category: 'cejas',
  },
  {
    name: 'Depilación Láser - Zona Pequeña',
    description:
      'Eliminación permanente del vello. Zonas: axilas, bigote, mentón.',
    durationMinutes: 30,
    price: 10000,
    category: 'laser',
  },
  {
    name: 'Depilación Láser - Zona Mediana',
    description:
      'Eliminación permanente del vello. Zonas: brazos, media pierna, cavado.',
    durationMinutes: 45,
    price: 18000,
    category: 'laser',
  },
  {
    name: 'Depilación Láser - Zona Grande',
    description:
      'Eliminación permanente del vello. Zonas: piernas completas, espalda.',
    durationMinutes: 60,
    price: 25000,
    category: 'laser',
  },
  {
    name: 'Radiofrecuencia Facial',
    description:
      'Tratamiento anti-aging con radiofrecuencia, estimula colágeno.',
    durationMinutes: 60,
    price: 20000,
    category: 'facial',
  },
  {
    name: 'VelaShape - Modelado Corporal',
    description: 'Tratamiento corporal con radiofrecuencia y vacumterapia.',
    durationMinutes: 60,
    price: 25000,
    category: 'corporal',
  },
  {
    name: 'Pedicuría Spa',
    description:
      'Tratamiento completo de pies: exfoliación, hidratación, esmaltado y masaje.',
    durationMinutes: 60,
    price: 12000,
    category: 'pies',
  },
];

/** Lunes a Sábado (0=Domingo … 6=Sábado), de 09:00 a 20:00. */
const BUSINESS_DAYS = [1, 2, 3, 4, 5, 6];
const OPENING = new Date('1970-01-01T09:00:00Z');
const CLOSING = new Date('1970-01-01T20:00:00Z');

/** Mismo costo que PasswordService (y que passlib en el legado). */
const BCRYPT_ROUNDS = 12;

export interface InitialAdmin {
  email: string;
  password: string;
  fullName: string;
}

export interface SeedSummary {
  adminCreated: boolean;
  adminEmail: string;
  createdServices: number;
  createdDays: number;
}

/** Admin inicial desde INITIAL_ADMIN_* (con los mismos valores por defecto que el legado). */
export function initialAdminFromEnv(env: NodeJS.ProcessEnv): InitialAdmin {
  return {
    email: (env.INITIAL_ADMIN_EMAIL ?? 'admin@luminancestudio.com')
      .trim()
      .toLowerCase(),
    password: env.INITIAL_ADMIN_PASSWORD ?? 'ChangeThisPassword123!',
    fullName: env.INITIAL_ADMIN_NAME ?? 'Admin',
  };
}

export async function seedInitialData(
  prisma: PrismaClient,
  admin: InitialAdmin,
): Promise<SeedSummary> {
  const adminExists = await prisma.user.findUnique({
    where: { email: admin.email },
  });
  if (!adminExists) {
    await prisma.user.create({
      data: {
        email: admin.email,
        fullName: admin.fullName,
        phone: '',
        hashedPassword: await hash(admin.password, BCRYPT_ROUNDS),
        isAdmin: true,
      },
    });
  }

  let createdServices = 0;
  for (const data of INITIAL_SERVICES) {
    const exists = await prisma.service.findFirst({
      where: { name: data.name },
    });
    if (!exists) {
      await prisma.service.create({ data });
      createdServices += 1;
    }
  }

  let createdDays = 0;
  for (const dayOfWeek of BUSINESS_DAYS) {
    const exists = await prisma.availability.findFirst({
      where: { dayOfWeek },
    });
    if (!exists) {
      await prisma.availability.create({
        data: { dayOfWeek, startTime: OPENING, endTime: CLOSING },
      });
      createdDays += 1;
    }
  }

  return {
    adminCreated: !adminExists,
    adminEmail: admin.email,
    createdServices,
    createdDays,
  };
}
