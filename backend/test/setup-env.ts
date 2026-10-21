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
