# app/core/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Crear engine de SQLAlchemy
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Verifica conexiones antes de usarlas
    pool_size=10,  # Número de conexiones en el pool
    max_overflow=20,  # Conexiones adicionales permitidas
    echo=settings.DEBUG,  # Log SQL queries en modo debug
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class para los modelos
Base = declarative_base()


def get_db():
    """
    Dependencia para obtener una sesión de base de datos.
    
    Uso en endpoints FastAPI:
        @router.get("/")
        def endpoint(db: Session = Depends(get_db)):
            ...
    
    Yields:
        Session de SQLAlchemy
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Inicializa la base de datos.
    Crea todas las tablas si no existen.
    
    NOTA: En producción usar Alembic para migraciones.
    """
    from app.models import user, appointment, service, payment, availability, coupon
    
    Base.metadata.create_all(bind=engine)
    print("✅ Base de datos inicializada")


async def create_initial_data():
    """
    Crea datos iniciales necesarios para la aplicación.
    - Usuario administrador inicial
    - Horarios de disponibilidad por defecto
    - Servicios básicos
    
    Debe ejecutarse una sola vez al iniciar la aplicación.
    """
    from sqlalchemy.orm import Session
    from app.core.security import get_password_hash
    from app.models.user import User
    from app.models.availability import Availability
    from app.models.service import Service
    from datetime import time
    
    db: Session = SessionLocal()
    
    try:
        # ===== CREAR ADMIN INICIAL =====
        admin = db.query(User).filter(User.email == settings.INITIAL_ADMIN_EMAIL).first()
        
        if not admin:
            admin = User(
                email=settings.INITIAL_ADMIN_EMAIL,
                full_name=settings.INITIAL_ADMIN_NAME,
                hashed_password=get_password_hash(settings.INITIAL_ADMIN_PASSWORD),
                phone="",
                is_active=True,
                is_admin=True,
            )
            db.add(admin)
            db.commit()
            print(f"✅ Admin creado: {settings.INITIAL_ADMIN_EMAIL}")
        
        # ===== CREAR HORARIOS DE DISPONIBILIDAD POR DEFECTO =====
        # Días laborables desde settings
        for day in settings.business_days_list:
            existing = db.query(Availability).filter(
                Availability.day_of_week == day
            ).first()
            
            if not existing:
                availability = Availability(
                    day_of_week=day,
                    start_time=time.fromisoformat(settings.BUSINESS_HOURS_START),
                    end_time=time.fromisoformat(settings.BUSINESS_HOURS_END),
                    is_available=True
                )
                db.add(availability)
        
        db.commit()
        print("✅ Horarios de disponibilidad creados")
        
        # ===== CREAR SERVICIOS BÁSICOS =====
        default_services = [
            {
                "name": "Lifting de Pestañas",
                "description": "Tratamiento profesional que realza, alarga y curva tus pestañas naturales sin necesidad de extensiones.",
                "duration_minutes": 60,
                "price": 15000.00,
                "category": "pestañas",
                "is_active": True
            },
            {
                "name": "Laminado de Cejas",
                "description": "Técnica que peina, moldea y fija las cejas dándoles forma perfecta durante semanas.",
                "duration_minutes": 45,
                "price": 12000.00,
                "category": "cejas",
                "is_active": True
            },
            {
                "name": "Henna de Cejas",
                "description": "Coloración natural de cejas con henna, rellena espacios y define la forma.",
                "duration_minutes": 30,
                "price": 8000.00,
                "category": "cejas",
                "is_active": True
            },
            {
                "name": "Depilación Láser - Zona Pequeña",
                "description": "Eliminación permanente del vello con láser de última generación. Zonas: axilas, bigote, mentón.",
                "duration_minutes": 30,
                "price": 10000.00,
                "category": "laser",
                "is_active": True
            },
            {
                "name": "Depilación Láser - Zona Mediana",
                "description": "Eliminación permanente del vello. Zonas: brazos completos, media pierna, cavado completo.",
                "duration_minutes": 45,
                "price": 18000.00,
                "category": "laser",
                "is_active": True
            },
            {
                "name": "Depilación Láser - Zona Grande",
                "description": "Eliminación permanente del vello. Zonas: piernas completas, espalda completa.",
                "duration_minutes": 60,
                "price": 25000.00,
                "category": "laser",
                "is_active": True
            },
            {
                "name": "Radiofrecuencia Facial",
                "description": "Tratamiento anti-aging con radiofrecuencia, estimula colágeno y reafirma la piel.",
                "duration_minutes": 60,
                "price": 20000.00,
                "category": "facial",
                "is_active": True
            },
            {
                "name": "VelaShape - Modelado Corporal",
                "description": "Tratamiento corporal con radiofrecuencia y vacumterapia, reduce celulitis y moldea el cuerpo.",
                "duration_minutes": 60,
                "price": 25000.00,
                "category": "corporal",
                "is_active": True
            },
            {
                "name": "Pedicuría Spa",
                "description": "Tratamiento completo de pies: exfoliación, hidratación, esmaltado y masaje relajante.",
                "duration_minutes": 60,
                "price": 12000.00,
                "category": "pies",
                "is_active": True
            },
        ]
        
        for service_data in default_services:
            existing = db.query(Service).filter(
                Service.name == service_data["name"]
            ).first()
            
            if not existing:
                service = Service(**service_data)
                db.add(service)
        
        db.commit()
        print("✅ Servicios básicos creados")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creando datos iniciales: {str(e)}")
        raise
    
    finally:
        db.close()
