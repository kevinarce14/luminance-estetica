import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="placeholder">
      <h1>Página no encontrada</h1>
      <p className="placeholder__description">
        La ruta no existe en el nuevo frontend.
      </p>
      <Link to="/" className="btn btn-rosa">
        Volver al inicio
      </Link>
    </section>
  )
}
