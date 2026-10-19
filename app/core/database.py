# app/core/database.py
from sqlalchemy import create_engine, text, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Configuración del schema
SCHEMA_NAME = "luminance-estetica"

# Crear engine de SQLAlchemy
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    #echo=settings.DEBUG,   #print de db
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class para los modelos
Base = declarative_base()

# Configurar el schema en metadata
Base.metadata.schema = SCHEMA_NAME


# ===== EVENTOS DE CONEXIÓN =====

@event.listens_for(engine, "connect")
def set_search_path(dbapi_connection, connection_record):
    """
    Establece el search_path después de cada conexión.
    Esto asegura que todas las queries usen el schema correcto.
    """
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute(f'SET search_path TO "{SCHEMA_NAME}"')
        cursor.close()
    except Exception as e:
        print(f"⚠️  Advertencia al establecer search_path: {e}")


# ===== DEPENDENCIAS =====

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
        # Establecer search_path por seguridad
        db.execute(text(f'SET search_path TO "{SCHEMA_NAME}"'))
        db.commit()
        yield db
    finally:
        db.close()


# ===== INICIALIZACIÓN =====

def init_db():
    """
    Inicializa la base de datos.
    Crea todas las tablas si no existen.
    
    Maneja dos escenarios:
    1. Conexión con pooler (Neon) - intenta crear tablas normalmente
    2. Si falla, usa conexión directa temporal
    """
    print(f"🛠️  Inicializando base de datos en schema '{SCHEMA_NAME}'...")
    
    # Importar TODAS las clases de modelos
    from app.models.user import User
    from app.models.service import Service
    from app.models.availability import Availability
    from app.models.coupon import Coupon
    from app.models.appointment import Appointment
    from app.models.payment import Payment
    
    # Asegurar que todas las tablas usen el schema
    for table in Base.metadata.tables.values():
        table.schema = SCHEMA_NAME
    
    # Detectar si es conexión pooler
    is_pooler = "-pooler" in settings.DATABASE_URL or "?pooler=true" in settings.DATABASE_URL
    
    try:
        if is_pooler:
            #print("⚠️  Detectada conexión con pooler...")
            _init_with_pooler()
        else:
            print("✓  Usando conexión directa...")
            with engine.begin() as conn:
                conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA_NAME}"'))
            Base.metadata.create_all(bind=engine)
            print("✅ Base de datos inicializada")
            
    except Exception as e:
        print(f"❌ Error en inicialización estándar: {e}")
        print("🔄 Intentando método alternativo...")
        _init_with_direct_connection()


def _init_with_pooler():
    """
    Intenta crear tablas con conexión pooler.
    Neon con pooler puede tener limitaciones con DDL.
    """
    try:
        # Crear schema si no existe (puede fallar con pooler)
        with engine.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA_NAME}"'))
            conn.execute(text(f'SET search_path TO "{SCHEMA_NAME}"'))
        
        # Crear tablas
        Base.metadata.create_all(bind=engine)
        #print("✅ Base de datos inicializada con pooler")
        
    except Exception as e:
        print(f"⚠️  Pooler no permite DDL: {e}")
        raise  # Re-lanzar para que _init_with_direct_connection tome el control


def _init_with_direct_connection():
    """
    Crea tablas usando conexión directa (sin pooler).
    Método de fallback cuando pooler falla.
    """
    try:
        # Crear URL de conexión directa
        direct_url = settings.DATABASE_URL.replace("-pooler", "").replace("?pooler=true", "")
        
        #print(f"🔗 Conectando directamente a la base de datos...")
        temp_engine = create_engine(direct_url, echo=settings.DEBUG)
        
        # Crear schema
        with temp_engine.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA_NAME}"'))
            conn.execute(text(f'SET search_path TO "{SCHEMA_NAME}"'))
            #print(f"✅ Schema '{SCHEMA_NAME}' verificado")
        
        # Asegurar schema en todas las tablas
        for table in Base.metadata.tables.values():
            table.schema = SCHEMA_NAME
        
        # Crear tablas
        Base.metadata.create_all(bind=temp_engine)
        #print("✅ Tablas creadas con conexión directa")
        
        # Limpiar
        temp_engine.dispose()
        
    except Exception as e:
        print(f"❌ Error crítico en inicialización: {e}")
        print("\n⚠️  POSIBLES CAUSAS:")
        print("  1. DATABASE_URL incorrecta en .env")
        print("  2. Base de datos no accesible")
        print("  3. Permisos insuficientes para crear schema/tablas")
        print(f"\n📝 URL actual: {settings.DATABASE_URL[:50]}...")
        raise


async def create_initial_data():
    """
    Crea datos iniciales necesarios para la aplicación.
    Se ejecuta después de init_db() al iniciar la aplicación.
    """
    #print(f"📦 Creando datos iniciales...")
    
    from sqlalchemy.orm import Session
    from app.core.security import get_password_hash
    from app.models.user import User
    from app.models.availability import Availability
    from app.models.service import Service
    from datetime import time
    from email_validator import EmailNotValidError, validate_email
    
    db: Session = SessionLocal()
    
    try:
        # Establecer search_path
        db.execute(text(f'SET search_path TO "{SCHEMA_NAME}"'))
        db.commit()
        
        # NORMALIZAR EMAIL (minúsculas y trim)
        admin_email_normalized = settings.INITIAL_ADMIN_EMAIL.strip().lower()
        # Validar con la misma regla que las respuestas (EmailStr): un email inválido
        # dejaría al admin sin poder usar /users/me (error 500 al serializar).
        try:
            validate_email(admin_email_normalized, check_deliverability=False)
        except EmailNotValidError as exc:
            raise RuntimeError(
                f"INITIAL_ADMIN_EMAIL inválido ('{settings.INITIAL_ADMIN_EMAIL}'): {exc}"
            ) from exc
        # ADMIN
        admin = db.query(User).filter(User.email == admin_email_normalized).first()
        if not admin:
            admin = User(
                email=admin_email_normalized,
                full_name=settings.INITIAL_ADMIN_NAME,
                hashed_password=get_password_hash(settings.INITIAL_ADMIN_PASSWORD),
                phone="",
                is_active=True,
                is_admin=True,
            )
            db.add(admin)
            db.commit()
            #print(f"✅ Admin creado: {settings.INITIAL_ADMIN_EMAIL}")
        else:
            print(f"ℹ️  Admin ya existe")
        
        # HORARIOS
        availability_count = 0
        for day in settings.business_days_list:
            if not db.query(Availability).filter(Availability.day_of_week == day).first():
                db.add(Availability(
                    day_of_week=day,
                    start_time=time.fromisoformat(settings.BUSINESS_HOURS_START),
                    end_time=time.fromisoformat(settings.BUSINESS_HOURS_END),
                    is_available=True
                ))
                availability_count += 1
        
        if availability_count > 0:
            db.commit()
            #print(f"✅ {availability_count} horarios creados")
        else:
            print("ℹ️  Horarios ya existen")
        
        # SERVICIOS
        services = [
            ("Lifting de Pestañas", "Tratamiento profesional que realza, alarga y curva tus pestañas naturales.", 60, 15000, "pestañas"),
            ("Laminado de Cejas", "Técnica que peina, moldea y fija las cejas dándoles forma perfecta.", 45, 12000, "cejas"),
            ("Henna de Cejas", "Coloración natural de cejas con henna, rellena espacios y define la forma.", 30, 8000, "cejas"),
            ("Depilación Láser - Zona Pequeña", "Eliminación permanente del vello. Zonas: axilas, bigote, mentón.", 30, 10000, "laser"),
            ("Depilación Láser - Zona Mediana", "Eliminación permanente del vello. Zonas: brazos, media pierna, cavado.", 45, 18000, "laser"),
            ("Depilación Láser - Zona Grande", "Eliminación permanente del vello. Zonas: piernas completas, espalda.", 60, 25000, "laser"),
            ("Radiofrecuencia Facial", "Tratamiento anti-aging con radiofrecuencia, estimula colágeno.", 60, 20000, "facial"),
            ("VelaShape - Modelado Corporal", "Tratamiento corporal con radiofrecuencia y vacumterapia.", 60, 25000, "corporal"),
            ("Pedicuría Spa", "Tratamiento completo de pies: exfoliación, hidratación, esmaltado y masaje.", 60, 12000, "pies"),
        ]
        
        services_count = 0
        for name, desc, duration, price, category in services:
            if not db.query(Service).filter(Service.name == name).first():
                db.add(Service(
                    name=name,
                    description=desc,
                    duration_minutes=duration,
                    price=price,
                    category=category,
                    is_active=True
                ))
                services_count += 1
        
        if services_count > 0:
            db.commit()
            #print(f"✅ {services_count} servicios creados")
        else:
            print("ℹ️  Servicios ya existen")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {str(e)}")
        raise
    finally:
        db.close()