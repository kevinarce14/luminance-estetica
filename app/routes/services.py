# app/routes/services.py
"""
Endpoints para gestión de servicios del estudio.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.routes.deps import get_current_admin
from app.models.service import Service
from app.schemas.service import (
    ServiceCreate,
    ServiceUpdate,
    ServiceResponse,
    ServicePublic
)

router = APIRouter(prefix="/services", tags=["Servicios"])


@router.get("/", response_model=List[ServicePublic])
def list_services(
    skip: int = 0,
    limit: int = 100,
    category: str | None = None,
    is_active: bool = True,
    db: Session = Depends(get_db)
):
    """
    Listar servicios disponibles.
    
    Query params:
    - **skip**: Paginación
    - **limit**: Límite de resultados
    - **category**: Filtrar por categoría (pestañas, cejas, laser, etc.)
    - **is_active**: Solo servicios activos (default: True)
    
    **No requiere autenticación** - Endpoint público para que los clientes vean los servicios.
    """
    query = db.query(Service)
    
    # Filtros
    if is_active is not None:
        query = query.filter(Service.is_active == is_active)
    
    if category:
        query = query.filter(Service.category == category.lower())
    
    services = query.offset(skip).limit(limit).all()
    
    return services


@router.get("/{service_id}", response_model=ServicePublic)
def get_service(
    service_id: int,
    db: Session = Depends(get_db)
):
    """
    Obtener detalles de un servicio específico.
    
    **No requiere autenticación** - Endpoint público.
    """
    service = db.query(Service).filter(Service.id == service_id).first()
    
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado"
        )
    
    return service


@router.get("/category/{category}", response_model=List[ServicePublic])
def get_services_by_category(
    category: str,
    db: Session = Depends(get_db)
):
    """
    Obtener servicios por categoría.
    
    Categorías disponibles:
    - pestañas
    - cejas
    - laser
    - facial
    - corporal
    - pies
    - otros
    
    **No requiere autenticación** - Endpoint público.
    """
    services = (
        db.query(Service)
        .filter(Service.category == category.lower())
        .filter(Service.is_active == True)
        .all()
    )
    
    return services


# ========== ENDPOINTS DE ADMIN ==========


@router.post("/", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
def create_service(
    service_data: ServiceCreate,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Crear un nuevo servicio (solo admin).
    
    Requiere permisos de administrador.
    """
    # Verificar que no exista un servicio con el mismo nombre
    existing = db.query(Service).filter(Service.name == service_data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un servicio con ese nombre"
        )
    
    # Crear servicio
    db_service = Service(**service_data.model_dump())
    
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    
    return db_service


@router.put("/{service_id}", response_model=ServiceResponse)
def update_service(
    service_id: int,
    service_data: ServiceUpdate,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Actualizar un servicio existente (solo admin).
    
    Requiere permisos de administrador.
    """
    service = db.query(Service).filter(Service.id == service_id).first()
    
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado"
        )
    
    # Actualizar campos proporcionados
    update_data = service_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(service, field, value)
    
    db.commit()
    db.refresh(service)
    
    return service


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Eliminar un servicio (solo admin).
    
    **NOTA**: Mejor opción es desactivar el servicio en lugar de eliminarlo
    para mantener el historial de turnos.
    
    Requiere permisos de administrador.
    """
    service = db.query(Service).filter(Service.id == service_id).first()
    
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado"
        )
    
    # Verificar si tiene turnos asociados
    from app.models.appointment import Appointment
    has_appointments = db.query(Appointment).filter(
        Appointment.service_id == service_id
    ).first()
    
    if has_appointments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar un servicio con turnos asociados. Considera desactivarlo en su lugar."
        )
    
    db.delete(service)
    db.commit()
    
    return None


@router.put("/{service_id}/toggle-active", response_model=ServiceResponse)
def toggle_service_active(
    service_id: int,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Activar/desactivar un servicio (solo admin).
    
    Cambiar is_active es mejor que eliminar para mantener historial.
    
    Requiere permisos de administrador.
    """
    service = db.query(Service).filter(Service.id == service_id).first()
    
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado"
        )
    
    service.is_active = not service.is_active
    db.commit()
    db.refresh(service)
    
    return service

@router.get("/admin/all", response_model=List[ServiceResponse])
def list_all_services_admin(
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Listar TODOS los servicios (activos e inactivos) - Solo admin.
    
    Requiere permisos de administrador.
    """
    services = db.query(Service).all()
    return services