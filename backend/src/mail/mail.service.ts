import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NodeEnv,
  parseFrontendOrigins,
  type EnvironmentVariables,
} from '../config/env.validation';
import {
  passwordChangedEmail,
  passwordResetEmail,
  welcomeEmail,
  type MailContent,
} from './mail.templates';

const MAILJET_SEND_URL = 'https://api.mailjet.com/v3.1/send';
const SEND_TIMEOUT_MS = 10_000;

/**
 * Envío de emails transaccionales con Mailjet (API v3.1).
 * Nunca lanza: un email que falla se registra en el log pero no rompe el flujo
 * (registro, recuperación de contraseña), igual que en el legado.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  sendWelcome(to: string, userName: string): Promise<boolean> {
    return this.send(to, welcomeEmail(userName));
  }

  sendPasswordReset(
    to: string,
    userName: string,
    resetToken: string,
  ): Promise<boolean> {
    const link = `${this.frontendUrl()}/login.html?token=${encodeURIComponent(resetToken)}`;
    if (!this.isConfigured() && this.isDevelopment()) {
      // Sin Mailjet en desarrollo: el link se muestra en consola para poder probar el flujo.
      this.logger.log(`Link de recuperación para ${to}: ${link}`);
    }
    return this.send(to, passwordResetEmail(userName, link));
  }

  sendPasswordChanged(to: string, userName: string): Promise<boolean> {
    return this.send(to, passwordChangedEmail(userName));
  }

  private async send(to: string, content: MailContent): Promise<boolean> {
    const publicKey = this.config.get('MAILJET_API_KEY_PUBLIC', {
      infer: true,
    });
    const privateKey = this.config.get('MAILJET_API_KEY_PRIVATE', {
      infer: true,
    });
    if (!publicKey || !privateKey) {
      this.logger.warn(
        `Mailjet sin configurar: no se envió "${content.subject}" a ${to}`,
      );
      return false;
    }

    try {
      const response = await fetch(MAILJET_SEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${publicKey}:${privateKey}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Messages: [
            {
              From: {
                Email: this.config.get('FROM_EMAIL', { infer: true }),
                Name: this.config.get('FROM_NAME', { infer: true }),
              },
              To: [{ Email: to }],
              Subject: content.subject,
              HTMLPart: content.html,
            },
          ],
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.error(
          `Mailjet respondió HTTP ${response.status} al enviar "${content.subject}" a ${to}: ${await response.text()}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(
        `No se pudo enviar "${content.subject}" a ${to}: ${String(error)}`,
      );
      return false;
    }
  }

  private isConfigured(): boolean {
    return Boolean(
      this.config.get('MAILJET_API_KEY_PUBLIC', { infer: true }) &&
      this.config.get('MAILJET_API_KEY_PRIVATE', { infer: true }),
    );
  }

  private isDevelopment(): boolean {
    return this.config.get('NODE_ENV', { infer: true }) === NodeEnv.Development;
  }

  private frontendUrl(): string {
    return parseFrontendOrigins(
      this.config.get('FRONTEND_URL', { infer: true }),
    )[0];
  }
}
