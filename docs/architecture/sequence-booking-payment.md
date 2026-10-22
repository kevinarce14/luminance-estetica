# Secuencia: reserva y pago con MercadoPago

Flujo completo desde que la clienta elige un horario hasta que el turno queda confirmado.
Es el mismo flujo que verifica el test E2E `turnera → pago con MercadoPago → retorno al sitio`
([`web/e2e/booking.spec.ts`](../../web/e2e/booking.spec.ts)).

```mermaid
sequenceDiagram
    autonumber
    actor C as Clienta
    participant W as Frontend (React)
    participant A as API (NestJS)
    participant DB as PostgreSQL (Neon)
    participant MP as MercadoPago
    participant M as Mailjet

    Note over C,W: 1. Elegir horario
    C->>W: Abre la turnera y elige fecha y servicio
    W->>A: POST /api/availability/available-slots
    A->>DB: Horario del día (excepción o franja semanal) y turnos CONFIRMED
    A-->>W: Grilla en hora del estudio (ocupados y antes de 2 h → no disponibles)

    Note over C,A: 2. Reservar
    C->>W: Elige un horario y confirma
    W->>A: POST /api/appointments (JWT)
    A->>A: Valida fecha futura, anticipación, días máximos y horario de atención
    A->>DB: ¿Hay un turno confirmado que se superponga?
    A->>DB: INSERT appointment (PENDING)
    A-->>W: 201 · turno pendiente
    W->>C: Redirige a /pago?appointment_id=…

    Note over C,MP: 3. Iniciar el pago
    C->>W: Elige "Mercado Pago"
    W->>A: POST /api/payments/create-preference (JWT)
    A->>DB: ¿El turno es suyo, sigue pendiente y el horario está libre?
    A->>MP: POST /checkout/preferences (precio de la base, external_reference = ID del turno)
    MP-->>A: preference_id + init_point
    A->>DB: UPSERT payment (PENDING) · un pago por turno
    A-->>W: init_point
    W->>MP: Redirige al checkout
    C->>MP: Paga

    Note over MP,M: 4. Confirmación por webhook (asíncrona)
    MP->>A: POST /api/payments/webhook (x-signature, data.id)
    A->>A: Valida la firma HMAC-SHA256
    A->>MP: GET /v1/payments/{id} (estado real del pago)
    MP-->>A: approved · monto · external_reference
    A->>A: Decide la transición (idempotente, nunca retrocede un pago aprobado)
    alt Monto correcto y horario libre
        A->>DB: Transacción: payment APPROVED + appointment CONFIRMED
        A--)M: Email "Pago confirmado"
    else Monto menor, turno cancelado u horario ya ocupado
        A->>DB: Registra el cobro con una nota para que lo revise el admin
    end
    A-->>MP: 200 OK (un error al consultar responde 502 y MercadoPago reintenta)

    Note over C,W: 5. Retorno al sitio
    MP->>W: Redirige a /pago/exitoso?collection_status=approved&external_reference=…
    W->>A: GET /api/appointments/{id} (JWT)
    A-->>W: Turno CONFIRMED con su pago APPROVED
    W->>C: "¡Pago Exitoso!" · el horario deja de ofrecerse en la turnera
```

## Puntos clave

- **Precio confiable:** el monto que envía el navegador se ignora; se cobra el precio del
  servicio guardado en la base.
- **Webhook seguro e idempotente:** se valida la firma y se consulta a MercadoPago el estado real
  del pago, sin confiar en el contenido de la notificación. Las notificaciones repetidas o
  desordenadas no duplican confirmaciones ni emails.
- **El horario se ocupa al confirmar:** un turno `PENDING` no bloquea la agenda; un turno
  `CONFIRMED` sí, durante la duración de su servicio. Por eso la API vuelve a revisar
  superposiciones al iniciar el pago y al confirmarlo.
- **Retorno y webhook son independientes:** la página `/pago/exitoso` consulta el turno a la API,
  y la confirmación la hace siempre el webhook.
- **Tarjeta rechazada:** MercadoPago redirige a `/pago/fallido` y el webhook marca el pago como
  `REJECTED`. El turno sigue pendiente y la clienta puede reintentar; se reutiliza el mismo pago.
- **Pago en efectivo:** la clienta lo coordina por WhatsApp y el admin lo registra desde el panel
  con `POST /api/payments/cash-payment`, que confirma el turno.
