/** Plantillas HTML de los emails (mismos textos y links que el backend FastAPI). */

export interface MailContent {
  subject: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:24px;background:#f7f1ee;font-family:Arial,sans-serif;color:#3d2c2e">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
    <h1 style="margin:0 0 24px;font-size:22px;color:#b07a7a">Luminance Studio</h1>
    ${body}
    <p style="margin-top:32px;font-size:12px;color:#8a7a7b">Luminance Studio by Cande</p>
  </div>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${href}" style="background:#b07a7a;color:#ffffff;padding:12px 24px;border-radius:999px;text-decoration:none">${label}</a></p>`;
}

export function welcomeEmail(userName: string): MailContent {
  const name = escapeHtml(userName);
  return {
    subject: '¡Bienvenida a Luminance Studio! ✨',
    html: layout(
      'Bienvenida a Luminance Studio',
      `<p>¡Hola ${name}!</p>
       <p>Tu cuenta fue creada con éxito. Ya podés reservar tus turnos online.</p>`,
    ),
  };
}

/** El link apunta a /login.html?token=…: el frontend lo redirige a la pantalla de nueva contraseña. */
export function passwordResetEmail(
  userName: string,
  resetLink: string,
): MailContent {
  const name = escapeHtml(userName);
  return {
    subject: 'Recuperar Contraseña - Luminance Studio',
    html: layout(
      'Recuperá tu contraseña',
      `<p>Hola ${name},</p>
       <p>Recibimos una solicitud para restablecer tu contraseña.</p>
       ${button(escapeHtml(resetLink), 'Restablecer Contraseña')}
       <p>El link vence en 1 hora y sirve una sola vez. Si no lo pediste, ignorá este email.</p>`,
    ),
  };
}

export function passwordChangedEmail(userName: string): MailContent {
  const name = escapeHtml(userName);
  return {
    subject: 'Tu contraseña fue actualizada - Luminance Studio',
    html: layout(
      'Contraseña actualizada',
      `<p>Hola ${name},</p>
       <p>Tu contraseña se cambió correctamente. Si no fuiste vos, contactanos de inmediato.</p>`,
    ),
  };
}

/** Fechas ya formateadas en la hora del studio (ver formatForHumans). */
export function appointmentCancelledEmail(
  userName: string,
  serviceName: string,
  when: string,
): MailContent {
  return {
    subject: `Turno Cancelado - ${serviceName}`,
    html: layout(
      'Turno cancelado',
      `<p>Hola ${escapeHtml(userName)},</p>
       <p>Tu turno de <strong>${escapeHtml(serviceName)}</strong> del ${escapeHtml(when)} fue cancelado.</p>
       <p>Podés reservar un nuevo horario cuando quieras desde la web.</p>`,
    ),
  };
}

export function appointmentRescheduledEmail(
  userName: string,
  serviceName: string,
  previousWhen: string,
  newWhen: string,
): MailContent {
  return {
    subject: `Turno Reprogramado - ${serviceName}`,
    html: layout(
      'Turno reprogramado',
      `<p>Hola ${escapeHtml(userName)},</p>
       <p>Tu turno de <strong>${escapeHtml(serviceName)}</strong> cambió de horario:</p>
       <p>Antes: ${escapeHtml(previousWhen)}<br>Ahora: <strong>${escapeHtml(newWhen)}</strong></p>`,
    ),
  };
}

export function paymentConfirmedEmail(
  userName: string,
  serviceName: string,
  amount: string,
  when: string,
): MailContent {
  return {
    subject: `✅ Pago Confirmado - ${serviceName}`,
    html: layout(
      'Pago confirmado',
      `<p>Hola ${escapeHtml(userName)},</p>
       <p>Recibimos tu pago exitosamente. Tu turno está 100% confirmado.</p>
       <p><strong>Servicio:</strong> ${escapeHtml(serviceName)}<br>
          <strong>Monto pagado:</strong> ${escapeHtml(amount)}<br>
          <strong>Turno:</strong> ${escapeHtml(when)}</p>`,
    ),
  };
}
