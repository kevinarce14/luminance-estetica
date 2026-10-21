/**
 * Entorno de los tests e2e: valores fijos y sin credenciales externas
 * (las variables del proceso tienen prioridad sobre el .env).
 */
process.env.NODE_ENV = 'test';
process.env.SECRET_KEY = 'secreto-de-tests-e2e';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.MAILJET_API_KEY_PUBLIC = '';
process.env.MAILJET_API_KEY_PRIVATE = '';
// MercadoPago simulado (test/support/fake-mercadopago.ts) y firma de webhooks activada.
process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-e2e-access-token';
process.env.MERCADOPAGO_API_URL = 'http://127.0.0.1:4799';
process.env.MERCADOPAGO_WEBHOOK_SECRET = 'e2e-webhook-secret';
process.env.BACKEND_URL = '';
