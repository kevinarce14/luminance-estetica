# app/schemas/__init__.py
"""
Schemas de Pydantic para validación de datos.
Definen la estructura de requests y responses de la API.
"""

from app.schemas.user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserResponse,
    UserLogin,
)

from app.schemas.service import (
    ServiceBase,
    ServiceCreate,
    ServiceUpdate,
    ServiceResponse,
)

from app.schemas.appointment import (
    AppointmentBase,
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentResponse,
    AppointmentWithDetails,
)

from app.schemas.payment import (
    PaymentBase,
    PaymentCreate,
    PaymentResponse,
    MercadoPagoWebhook,
)

from app.schemas.availability import (
    AvailabilityBase,
    AvailabilityCreate,
    AvailabilityUpdate,
    AvailabilityResponse,
    TimeSlot,
)

from app.schemas.coupon import (
    CouponBase,
    CouponCreate,
    CouponUpdate,
    CouponResponse,
    CouponValidate,
)

from app.schemas.auth import (
    Token,
    TokenData,
    PasswordReset,
    PasswordResetConfirm,
)

__all__ = [
    # User
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserLogin",
    # Service
    "ServiceBase",
    "ServiceCreate",
    "ServiceUpdate",
    "ServiceResponse",
    # Appointment
    "AppointmentBase",
    "AppointmentCreate",
    "AppointmentUpdate",
    "AppointmentResponse",
    "AppointmentWithDetails",
    # Payment
    "PaymentBase",
    "PaymentCreate",
    "PaymentResponse",
    "MercadoPagoWebhook",
    # Availability
    "AvailabilityBase",
    "AvailabilityCreate",
    "AvailabilityUpdate",
    "AvailabilityResponse",
    "TimeSlot",
    # Coupon
    "CouponBase",
    "CouponCreate",
    "CouponUpdate",
    "CouponResponse",
    "CouponValidate",
    # Auth
    "Token",
    "TokenData",
    "PasswordReset",
    "PasswordResetConfirm",
]