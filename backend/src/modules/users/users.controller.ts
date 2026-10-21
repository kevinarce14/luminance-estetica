import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import { AdminOnly, Authenticated } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  toUserResponse,
  type UserResponse,
} from './interfaces/user-response.interface';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ===== Perfil propio (las rutas /me van antes que /:id) =====

  @Get('me')
  @Authenticated()
  getProfile(@CurrentUser() user: User): UserResponse {
    return toUserResponse(user);
  }

  @Put('me')
  @Authenticated()
  async updateProfile(
    @CurrentUser() user: User,
    @Body() body: UpdateProfileDto,
  ): Promise<UserResponse> {
    return toUserResponse(await this.usersService.updateProfile(user.id, body));
  }

  // ===== Administración =====

  @Get()
  @AdminOnly()
  async findAll(@Query() query: ListUsersQueryDto): Promise<UserResponse[]> {
    const users = await this.usersService.findAll(query);
    return users.map(toUserResponse);
  }

  @Get(':id')
  @AdminOnly()
  async findOne(@Param('id', ParseIdPipe) id: number): Promise<UserResponse> {
    return toUserResponse(await this.usersService.getById(id));
  }

  @Put(':id/toggle-active')
  @AdminOnly()
  async toggleActive(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser() admin: User,
  ): Promise<UserResponse> {
    return toUserResponse(await this.usersService.toggleActive(id, admin.id));
  }

  @Put(':id/make-admin')
  @AdminOnly()
  async makeAdmin(@Param('id', ParseIdPipe) id: number): Promise<UserResponse> {
    return toUserResponse(await this.usersService.makeAdmin(id));
  }
}
