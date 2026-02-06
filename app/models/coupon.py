# app/models/coupon.py
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, Enum
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class DiscountType(str, enum.Enum):
    """
    Tipos de descuento.
    
    - PERCENTAGE: Descuento en porcentaje (ej: 20% off)
    - FIXED_AMOUNT: Descuento en monto fijo (ej: $5000 off)
    """
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"


class Coupon(Base):
    """
    Modelo de Cupón - Representa cupones de descuento.
    
    Los cupones permiten ofrecer promociones y descuentos a los clientes.
    
    Tipos de cupones:
        1. **Porcentaje**: Descuento del X% sobre el precio
           - discount_type = PERCENTAGE
           - discount_value = 20 (significa 20% de descuento)
        
        2. **Monto fijo**: Descuento de $X pesos
           - discount_type = FIXED_AMOUNT
           - discount_value = 5000 (significa $5000 de descuento)
    
    Campos:
        - code: Código del cupón (ej: "PROMO20", "BIENVENIDA")
        - description: Descripción de la promoción
        - discount_type: Tipo de descuento (percentage o fixed_amount)
        - discount_value: Valor del descuento
        - min_purchase_amount: Monto mínimo de compra requerido
        - max_uses: Cantidad máxima de usos totales
        - uses_count: Cantidad de veces que se usó
        - valid_from: Fecha de inicio de validez
        - valid_until: Fecha de fin de validez
        - is_active: Si el cupón está activo
    
    Ejemplos:
        # 20% de descuento, sin mínimo, hasta fin de mes
        code="PROMO20", discount_type=PERCENTAGE, discount_value=20
        
        # $5000 off, mínimo $20000, válido por 30 días
        code="BIENVENIDA", discount_type=FIXED_AMOUNT, discount_value=5000,
        min_purchase_amount=20000, max_uses=50
    """
    __tablename__ = "coupons"
    
    # ===== CAMPOS BÁSICOS =====
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    # Código único del cupón (ej: "PROMO20", "VERANO2024")
    
    description = Column(String(500), nullable=True)
    # Descripción de la promoción para mostrar al usuario
    
    # ===== DESCUENTO =====
    discount_type = Column(
        Enum(DiscountType),
        nullable=False
    )
    discount_value = Column(Float, nullable=False)
    # - Si discount_type = PERCENTAGE: valor entre 0-100 (ej: 20 = 20%)
    # - Si discount_type = FIXED_AMOUNT: monto en pesos (ej: 5000)
    
    min_purchase_amount = Column(Float, default=0, nullable=False)
    # Monto mínimo de compra para aplicar el cupón
    # 0 = sin mínimo
    
    # ===== LÍMITES DE USO =====
    max_uses = Column(Integer, nullable=True)
    # Cantidad máxima de veces que se puede usar el cupón
    # NULL = sin límite
    
    uses_count = Column(Integer, default=0, nullable=False)
    # Cantidad de veces que se ha usado el cupón
    
    # ===== VALIDEZ =====
    valid_from = Column(Date, nullable=True)
    # Fecha desde la cual el cupón es válido
    # NULL = válido desde ya
    
    valid_until = Column(Date, nullable=True)
    # Fecha hasta la cual el cupón es válido
    # NULL = sin fecha de expiración
    
    # ===== ESTADO =====
    is_active = Column(Boolean, default=True, nullable=False)
    # Si el cupón está activo y puede ser usado
    
    # ===== TIMESTAMPS =====
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True
    )
    
    def __repr__(self):
        return f"<Coupon {self.code} - {self.discount_value}{'%' if self.discount_type == DiscountType.PERCENTAGE else '$'}>"
    
    @property
    def is_valid(self):
        """Retorna True si el cupón es válido actualmente"""
        from datetime import date
        
        if not self.is_active:
            return False
        
        # Verificar si ha alcanzado el máximo de usos
        if self.max_uses and self.uses_count >= self.max_uses:
            return False
        
        # Verificar fechas de validez
        today = date.today()
        
        if self.valid_from and today < self.valid_from:
            return False
        
        if self.valid_until and today > self.valid_until:
            return False
        
        return True
    
    @property
    def remaining_uses(self):
        """Retorna la cantidad de usos restantes"""
        if not self.max_uses:
            return "Ilimitado"
        
        remaining = self.max_uses - self.uses_count
        return max(0, remaining)
    
    def calculate_discount(self, original_amount: float) -> float:
        """
        Calcula el monto de descuento para un precio dado.
        
        Args:
            original_amount: Precio original
            
        Returns:
            Monto del descuento
        """
        # Verificar mínimo de compra
        if original_amount < self.min_purchase_amount:
            return 0
        
        if self.discount_type == DiscountType.PERCENTAGE:
            # Descuento en porcentaje
            discount = original_amount * (self.discount_value / 100)
        else:
            # Descuento en monto fijo
            discount = self.discount_value
        
        # El descuento no puede ser mayor al precio original
        return min(discount, original_amount)
    
    def apply_discount(self, original_amount: float) -> float:
        """
        Aplica el descuento y retorna el precio final.
        
        Args:
            original_amount: Precio original
            
        Returns:
            Precio final después del descuento
        """
        discount = self.calculate_discount(original_amount)
        return max(0, original_amount - discount)