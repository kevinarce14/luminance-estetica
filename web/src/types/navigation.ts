/** Estado que se pasa a /turnera al reservar desde un servicio (reemplaza `selected_service_id` del legado). */
export interface TurneraLocationState {
  serviceId?: number
}

/** Contexto que MainLayout expone a sus páginas vía `<Outlet context>`. */
export interface MainLayoutOutletContext {
  /** Contenedor del header donde una página puede montar su sub-navegación con un portal. */
  subnavContainer: HTMLElement | null
}
