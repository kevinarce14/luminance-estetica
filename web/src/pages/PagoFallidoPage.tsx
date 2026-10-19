import { PagePlaceholder } from '../components/common/PagePlaceholder.tsx'

export function PagoFallidoPage() {
  return (
    <PagePlaceholder
      title="Pago no procesado"
      legacyFile="frontend/pago-fallido.html"
      description="Retorno de MercadoPago cuando el pago falla o se rechaza."
    />
  )
}
