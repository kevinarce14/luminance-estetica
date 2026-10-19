/** Estado que se pasa a /turnera al reservar desde un servicio (reemplaza `selected_service_id` del legado). */
export interface TurneraLocationState {
  serviceId?: number
}

/** Estado que reciben /login y /register: ruta protegida a la que volver tras autenticarse. */
export interface AuthRedirectState {
  from?: string
}

/** Estado extra de /login: aviso y email precargado (ej. cuenta creada pero falló el auto-login). */
export interface LoginLocationState extends AuthRedirectState {
  notice?: string
  email?: string
}

/** Contexto que MainLayout expone a sus páginas vía `<Outlet context>`. */
export interface MainLayoutOutletContext {
  /** Contenedor del header donde una página puede montar su sub-navegación con un portal. */
  subnavContainer: HTMLElement | null
}
