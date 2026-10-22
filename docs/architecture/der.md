# Diagrama Entidad-Relación

Modelo de datos de la API, definido en [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma).
Todas las tablas viven en el schema PostgreSQL `luminance-estetica` (la base de Neon es compartida
con otros proyectos) y las fechas se guardan como `timestamptz`, es decir, como instantes UTC.

```mermaid
erDiagram
    USER ||--o{ APPOINTMENT : "reserva"
    SERVICE ||--o{ APPOINTMENT : "se reserva en"
    APPOINTMENT ||--o| PAYMENT : "se paga con"
    USER ||--o{ PAYMENT : "realiza"

    USER {
        int id PK
        varchar email UK "único, en minúsculas"
        varchar full_name
        varchar phone "opcional"
        varchar hashed_password "bcrypt; vacío si la cuenta es de Google"
        boolean is_active
        boolean is_admin "rol administrador"
        timestamptz created_at
        timestamptz updated_at
    }

    SERVICE {
        int id PK
        varchar name
        text description
        int duration_minutes
        float price "en ARS"
        varchar category "pestañas, cejas, laser, facial, corporal, pies, otros"
        boolean is_active "inactivo = fuera del catálogo"
        varchar image_url
        timestamptz created_at
        timestamptz updated_at
    }

    APPOINTMENT {
        int id PK
        int user_id FK
        int service_id FK
        timestamptz appointment_date "instante UTC"
        enum status "PENDING, CONFIRMED, COMPLETED, CANCELLED"
        text notes
        boolean reminder_sent
        timestamptz cancelled_at
        text cancellation_reason
        timestamptz created_at
        timestamptz updated_at
    }

    PAYMENT {
        int id PK
        int appointment_id FK,UK "un pago por turno"
        int user_id FK
        float amount "precio del servicio en la base"
        varchar currency "ARS"
        enum payment_method "MERCADOPAGO, CASH, TRANSFER, CARD_POS"
        enum status "PENDING, APPROVED, REJECTED, CANCELLED, REFUNDED"
        varchar mercadopago_id
        varchar mercadopago_preference_id
        varchar transaction_id UK
        text payment_details "comprobante o datos del medio"
        text error_message "motivo de rechazo o nota para revisión"
        timestamptz created_at
        timestamptz updated_at
        timestamptz approved_at
    }

    AVAILABILITY {
        int id PK
        int day_of_week "0 = domingo … 6 = sábado (franja semanal)"
        date specific_date "excepción: feriado u horario especial"
        time start_time "hora del estudio"
        time end_time
        boolean is_available "false = día cerrado"
        timestamptz created_at
        timestamptz updated_at
    }
```

## Relaciones

| Relación | Cardinalidad | Regla |
|---|---|---|
| `User` → `Appointment` | 1 a N | Cada turno pertenece a una clienta (o al admin, si reserva en el estudio). |
| `Service` → `Appointment` | 1 a N | Un servicio con turnos no se puede eliminar; se desactiva. |
| `Appointment` → `Payment` | 1 a 0..1 | `appointment_id` es único: reintentar un pago reutiliza el mismo registro. |
| `User` → `Payment` | 1 a N | Permite listar los pagos de cada clienta y el total pagado. |

`Availability` no tiene claves foráneas. Cada fila es **una franja semanal** (`day_of_week`) o
**una excepción** para una fecha (`specific_date`): nunca las dos a la vez. Para calcular el horario
de un día se toma la excepción de esa fecha si existe y, si no, la franja semanal.

## Estados

```mermaid
stateDiagram-v2
    direction LR
    state "Turno" as T {
        [*] --> PENDING: reserva
        PENDING --> CONFIRMED: pago aprobado o confirmación del admin
        PENDING --> CANCELLED: cancelación
        CONFIRMED --> COMPLETED: el admin lo completa
        CONFIRMED --> CANCELLED: cancelación
    }
```

```mermaid
stateDiagram-v2
    direction LR
    state "Pago" as P {
        [*] --> PENDING: checkout iniciado
        PENDING --> APPROVED: webhook o admin
        PENDING --> REJECTED: webhook o admin
        PENDING --> CANCELLED
        APPROVED --> REFUNDED: reembolso o contracargo
    }
```

Solo un turno **CONFIRMED** ocupa su horario, durante la duración de su servicio. Un pago aprobado
nunca vuelve atrás por una notificación tardía: la única salida es el reembolso.

> La tabla `coupons` existe en la base (heredada de la primera versión) pero ningún flujo la usa
> todavía, por eso no aparece en el diagrama.
