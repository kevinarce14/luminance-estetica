import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PasswordService } from './password.service';

export interface CreateUserData {
  email: string;
  fullName: string;
  phone?: string | null;
  /** null = cuenta de Google, sin contraseña. */
  password: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  /** Los emails se guardan y buscan siempre normalizados (trim + minúsculas). */
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: UsersService.normalizeEmail(email) },
    });
  }

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async getById(id: number): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  findAll(query: ListUsersQueryDto): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { isActive: query.is_active, isAdmin: query.is_admin },
      orderBy: { id: 'asc' },
      skip: query.skip,
      take: query.limit,
    });
  }

  async create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: UsersService.normalizeEmail(data.email),
        fullName: data.fullName,
        phone: data.phone ?? null,
        // Las cuentas de Google guardan un hash vacío, igual que el legado.
        hashedPassword: data.password
          ? await this.passwords.hash(data.password)
          : '',
      },
    });
  }

  updateProfile(id: number, data: UpdateProfileDto): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { fullName: data.full_name, phone: data.phone },
    });
  }

  async updatePassword(id: number, newPassword: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { hashedPassword: await this.passwords.hash(newPassword) },
    });
  }

  async toggleActive(id: number, currentAdminId: number): Promise<User> {
    const user = await this.getById(id);
    if (user.id === currentAdminId) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta');
    }
    return this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });
  }

  async makeAdmin(id: number): Promise<User> {
    const user = await this.getById(id);
    if (user.isAdmin) {
      throw new BadRequestException('El usuario ya es administrador');
    }
    return this.prisma.user.update({ where: { id }, data: { isAdmin: true } });
  }
}
