// api.js - Cliente de API para Luminance Estética
// Incluir este archivo en todas las páginas HTML

/**
 * Configuración de la API
 */
const API_CONFIG = {
    // Cambiar según el entorno
    BASE_URL: 'http://localhost:8000',  // Desarrollo local
    // BASE_URL: 'https://tu-backend.render.com',  // Producción
    API_PREFIX: '/api',
    TIMEOUT: 10000, // 10 segundos
};

/**
 * Helper para construir URLs completas
 */
function getApiUrl(endpoint) {
    return `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}${endpoint}`;
}

/**
 * Helper para obtener el token JWT del localStorage
 */
function getAuthToken() {
    return localStorage.getItem('auth_token');
}

/**
 * Helper para guardar el token JWT
 */
function saveAuthToken(token) {
    localStorage.setItem('auth_token', token);
}

/**
 * Helper para eliminar el token JWT (logout)
 */
function removeAuthToken() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
}

/**
 * Helper para guardar datos del usuario
 */
function saveUserData(userData) {
    localStorage.setItem('user_data', JSON.stringify(userData));
}

/**
 * Helper para obtener datos del usuario
 */
function getUserData() {
    const data = localStorage.getItem('user_data');
    return data ? JSON.parse(data) : null;
}

/**
 * Helper para verificar si el usuario está logueado
 */
function isLoggedIn() {
    return !!getAuthToken();
}

/**
 * Helper para verificar si el usuario es admin
 */
function isAdmin() {
    const userData = getUserData();
    return userData && userData.is_admin === true;
}

/**
 * Helper genérico para hacer peticiones a la API
 */
async function apiRequest(endpoint, options = {}) {
    const url = getApiUrl(endpoint);
    const token = getAuthToken();

    // Headers por defecto
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // Agregar token si existe (excepto para login/register)
    if (token && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Configuración de la petición
    const config = {
        method: options.method || 'GET',
        headers: headers,
        ...options,
    };

    // Agregar body si existe
    if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, config);

        let data = null;
        const text = await response.text();

        try {
            data = text ? JSON.parse(text) : null;
        } catch (e) {
            data = null;
        }

        // Si la respuesta no es OK, lanzar error
        if (!response.ok) {
            throw {
                status: response.status,
                message: data.detail || data.message || 'Error en la petición',
                data: data
            };
        }

        return data;
    } catch (error) {
        // Si es error 401, logout automático
        if (error.status === 401) {
            removeAuthToken();
            // Opcional: redirigir a login
            // window.location.href = '/login.html';
        }

        console.error('Error en API:', error);
        throw error;
    }
}

// ============================================
// AUTENTICACIÓN
// ============================================

/**
 * Registrar nuevo usuario
 */
async function register(userData) {
    const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
            email: userData.email,
            full_name: userData.full_name,
            phone: userData.phone || '',
            password: userData.password
        }
    });

    return data;
}

/**
 * Iniciar sesión
 */
async function login(email, password) {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    try {
        const url = getApiUrl('/auth/login');
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()  // ← Importante
        });

        // Leer como texto primero
        const text = await response.text();
        console.log('Respuesta del servidor:', text);
        
        // Intentar parsear
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('❌ El servidor no retornó JSON:', text);
            throw new Error('Error de conexión con el servidor');
        }

        if (!response.ok) {
            throw {
                status: response.status,
                message: data.detail || 'Error en el login'
            };
        }

        // Guardar token
        if (data.access_token) {
            saveAuthToken(data.access_token);
            const userData = await getCurrentUser();
            saveUserData(userData);
        }

        return data;

    } catch (error) {
        console.error('Error en login:', error);
        throw error;
    }
}

/**
 * Cerrar sesión
 */
function logout() {
    removeAuthToken();
    window.location.href = '/bienvenida.html';
}

/**
 * Solicitar reseteo de contraseña
 */
async function requestPasswordReset(email) {
    return await apiRequest('/auth/password-reset', {
        method: 'POST',
        body: { email }
    });
}

// ============================================
// USUARIOS
// ============================================

/**
 * Obtener datos del usuario actual
 */
async function getCurrentUser() {
    return await apiRequest('/users/me');
}

/**
 * Actualizar perfil del usuario
 */
async function updateProfile(userData) {
    return await apiRequest('/users/me', {
        method: 'PUT',
        body: userData
    });
}

/**
 * Obtener turnos del usuario actual
 */
async function getMyAppointments() {
    return await apiRequest('/users/me/appointments');
}

// ============================================
// SERVICIOS
// ============================================

/**
 * Obtener todos los servicios activos
 */
async function getServices(category = null) {
    let endpoint = '/services/?is_active=true';
    if (category) {
        endpoint += `&category=${category}`;
    }
    return await apiRequest(endpoint);
}

/**
 * Obtener un servicio específico
 */
async function getService(serviceId) {
    return await apiRequest(`/services/${serviceId}`);
}

/**
 * Obtener servicios por categoría
 */
async function getServicesByCategory(category) {
    return await apiRequest(`/services/category/${category}`);
}

// ============================================
// DISPONIBILIDAD
// ============================================

/**
 * Obtener horarios disponibles para un servicio en una fecha
 */
async function getAvailableSlots(serviceId, date) {
    return await apiRequest('/availability/available-slots', {
        method: 'POST',
        body: {
            service_id: serviceId,
            date: date  // Formato: "2024-02-10"
        }
    });
}

// ============================================
// TURNOS/CITAS
// ============================================

/**
 * Crear nuevo turno
 */
async function createAppointment(appointmentData) {
    return await apiRequest('/appointments/', {
        method: 'POST',
        body: {
            service_id: appointmentData.service_id,
            appointment_date: appointmentData.appointment_date,  // ISO format
            notes: appointmentData.notes || ''
        }
    });
}

/**
 * Obtener mis turnos
 */
async function getAppointments(statusFilter = null) {
    let endpoint = '/appointments/';
    if (statusFilter) {
        endpoint += `?status_filter=${statusFilter}`;
    }
    return await apiRequest(endpoint);
}

/**
 * Obtener detalles de un turno
 */
async function getAppointment(appointmentId) {
    return await apiRequest(`/appointments/${appointmentId}`);
}

/**
 * Cancelar turno
 */
async function cancelAppointment(appointmentId, reason) {
    return await apiRequest(`/appointments/${appointmentId}/cancel`, {
        method: 'POST',
        body: {
            cancellation_reason: reason
        }
    });
}

/**
 * Actualizar turno
 */
async function updateAppointment(appointmentId, updates) {
    return await apiRequest(`/appointments/${appointmentId}`, {
        method: 'PUT',
        body: updates
    });
}

// ============================================
// PAGOS
// ============================================

/**
 * Crear preferencia de pago en MercadoPago
 */
async function createPaymentPreference(appointmentId, amount) {
    return await apiRequest('/payments/create-preference', {
        method: 'POST',
        body: {
            appointment_id: appointmentId,
            amount: amount,
            currency: 'ARS',
            payment_method: 'mercadopago'
        }
    });
}

/**
 * Obtener información de un pago
 */
async function getPayment(paymentId) {
    return await apiRequest(`/payments/${paymentId}`);
}

/**
 * Obtener mis pagos
 */
async function getMyPayments() {
    return await apiRequest('/payments/');
}

// ============================================
// ADMIN (Solo para administradores)
// ============================================

/**
 * Obtener métricas del dashboard
 */
async function getDashboardMetrics() {
    return await apiRequest('/admin/dashboard');
}

/**
 * Obtener turnos de hoy
 */
async function getTodayAppointments() {
    return await apiRequest('/admin/appointments/today');
}

/**
 * Obtener próximos turnos
 */
async function getUpcomingAppointments(days = 7) {
    return await apiRequest(`/admin/appointments/upcoming?days=${days}`);
}

/**
 * Obtener reporte mensual
 */
async function getMonthlyReport(year, month) {
    return await apiRequest(`/admin/reports/monthly?year=${year}&month=${month}`);
}

// ============================================
// HELPERS DE UI
// ============================================

/**
 * Mostrar mensaje de éxito
 */
function showSuccess(message) {
    // Puedes personalizar esto según tu diseño
    alert(`✅ ${message}`);
}

/**
 * Mostrar mensaje de error
 */
function showError(message) {
    // Puedes personalizar esto según tu diseño
    alert(`❌ Error: ${message}`);
}

/**
 * Formatear fecha para mostrar
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/**
 * Formatear hora para mostrar
 */
function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Formatear precio
 */
function formatPrice(price) {
    return `$${price.toLocaleString('es-AR')}`;
}

/**
 * Verificar si el usuario debe estar logueado en esta página
 */
function requireAuth() {
    if (!isLoggedIn()) {
        alert('Debes iniciar sesión para acceder a esta página');
        window.location.href = '/bienvenida.html';
    }
}

/**
 * Verificar si el usuario debe ser admin
 */
function requireAdmin() {
    if (!isAdmin()) {
        alert('No tienes permisos de administrador');
        window.location.href = '/';
    }
}

/**
 * Actualizar UI según estado de autenticación
 */
function updateAuthUI() {
    const isAuth = isLoggedIn();
    const userData = getUserData();

    // Elementos que solo se muestran si está logueado
    const authElements = document.querySelectorAll('[data-auth-required]');
    authElements.forEach(el => {
        el.style.display = isAuth ? '' : 'none';
    });

    // Elementos que solo se muestran si NO está logueado
    const guestElements = document.querySelectorAll('[data-guest-only]');
    guestElements.forEach(el => {
        el.style.display = isAuth ? 'none' : '';
    });

    // Elementos solo para admin
    const adminElements = document.querySelectorAll('[data-admin-only]');
    adminElements.forEach(el => {
        el.style.display = isAdmin() ? '' : 'none';
    });

    // Actualizar nombre de usuario si existe
    const userNameElements = document.querySelectorAll('[data-user-name]');
    if (userData) {
        userNameElements.forEach(el => {
            el.textContent = userData.full_name;
        });
    }
}

// Ejecutar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
});

console.log('✅ API Client cargado correctamente');
console.log('📡 Backend URL:', API_CONFIG.BASE_URL);
console.log('🔐 Usuario logueado:', isLoggedIn());