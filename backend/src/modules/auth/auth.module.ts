import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { EnvironmentVariables } from '../../config/env.validation';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // HS256 con SECRET_KEY y la misma duración que el legado: los JWT de FastAPI y
    // NestJS son intercambiables mientras convivan.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('SECRET_KEY', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn:
            config.get('ACCESS_TOKEN_EXPIRE_MINUTES', { infer: true }) * 60,
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleAuthService, JwtStrategy],
})
export class AuthModule {}
