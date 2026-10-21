import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Global: los módulos de dominio (auth, turnos, pagos) envían emails sin importarlo. */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
