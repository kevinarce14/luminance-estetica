import { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

/** Con menos dígitos, comparar teléfonos solo por números da demasiados falsos positivos. */
const MIN_PHONE_DIGITS = 3;

/** Término de búsqueda del panel ya interpretado. */
export interface AdminSearch {
  /** Texto para coincidencias parciales sin distinguir mayúsculas. */
  text: string;
  /** "#123" o "123": también puede ser el ID de un turno. */
  id?: number;
  /** Clientes cuyo teléfono (solo dígitos) contiene los dígitos buscados. */
  phoneUserIds: number[];
}

/**
 * Interpreta el buscador del panel. Los teléfonos se guardan con espacios o guiones
 * ("11 4444-7788"), así que además se comparan solo sus dígitos ("44447788").
 */
export async function parseAdminSearch(
  prisma: PrismaService,
  raw: string | undefined,
): Promise<AdminSearch | null> {
  const text = raw?.trim();
  if (!text) {
    return null;
  }
  const idCandidate = text.replace(/^#/, '');
  const digits = text.replace(/\D/g, '');

  let phoneUserIds: number[] = [];
  if (digits.length >= MIN_PHONE_DIGITS) {
    const rows = await prisma.$queryRaw<Array<{ id: number }>>(
      Prisma.sql`SELECT id FROM "luminance-estetica"."users"
                 WHERE regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') LIKE ${`%${digits}%`}`,
    );
    phoneUserIds = rows.map((row) => row.id);
  }

  return {
    text,
    id: /^\d+$/.test(idCandidate) ? Number(idCandidate) : undefined,
    phoneUserIds,
  };
}

export function containsInsensitive(text: string): Prisma.StringFilter {
  return { contains: text, mode: 'insensitive' };
}

/** Condiciones sobre el cliente (nombre, email, teléfono con o sin formato). */
export function userMatches(search: AdminSearch): Prisma.UserWhereInput[] {
  const like = containsInsensitive(search.text);
  return [
    { fullName: like },
    { email: like },
    { phone: like },
    ...(search.phoneUserIds.length > 0
      ? [{ id: { in: search.phoneUserIds } }]
      : []),
  ];
}
