# Luminance — Frontend (React 19 + TypeScript)

SPA de [Luminance Estética](../README.md), publicada en https://luminance-estetica.vercel.app.

```bash
npm install
npm run dev        # http://localhost:5173 · /api va por el proxy de Vite a la API local (:3000)
npm run build      # verifica tipos (incluye e2e y configs) y genera dist/
npm run lint       # oxlint
npm test           # Vitest
npm run test:e2e   # Playwright: requiere TEST_DATABASE_URL (base descartable)
```

- **URL de la API**: `src/config/api.ts` la resuelve sola (proxy en desarrollo, API de Render en
  producción). `VITE_API_BASE_URL` la fuerza y `API_PROXY_TARGET` cambia el destino del proxy
  (ver `.env.example`).
- **Estructura**: `pages/` (rutas), `components/`, `context/` (sesión), `hooks/`, `services/`
  (cliente HTTP por recurso), `types/` (contratos de la API) y `utils/` (fechas en la zona del
  estudio, reglas de la turnera).
- **Deploy**: Vercel con `web/` como raíz; `vercel.json` hace el fallback de la SPA a `index.html`.
