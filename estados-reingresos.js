/**
 * ARCHIVO: estados-reingresos.js
 * Gestión de estados y flujo de validaciones para reingresos
 * Estados: PENDIENTE_VIGILANCIA_SALIDA → PENDIENTE_VIGILANCIA_INGRESO → PENDIENTE_RECEPCION → RECEPCIONADO
 * Última actualización: 2026-08-12
 */

// Constantes de estados
const ESTADOS_REINGRESO = {
    PENDIENTE_VIGILANCIA_SALIDA: "PENDIENTE_VIGILANCIA_SALIDA",
    PENDIENTE_VIGILANCIA_INGRESO: "PENDIENTE_VIGILANCIA_INGRESO",
    PENDIENTE_RECEPCION: "PENDIENTE_RECEPCION",
    RECEPCIONADO: "RECEPCIONADO"
};

/**
 * Función: obtenerDescripcionEstado
 * Retorna una descripción legible del estado
 * @param {string} estado
 * @returns {string}
 */
function obtenerDescripcionEstado(estado) {
    const descripciones = {
        [ESTADOS_REINGRESO.PENDIENTE_VIGILANCIA_SALIDA]: "Pendiente de Validación (Local Salida)",
        [ESTADOS_REINGRESO.PENDIENTE_VIGILANCIA_INGRESO]: "En Tránsito - Validando Ingreso",
        [ESTADOS_REINGRESO.PENDIENTE_RECEPCION]: "Pendiente Recepción Final",
        [ESTADOS_REINGRESO.RECEPCIONADO]: "Recepcionado ✓"
    };
    return descripciones[estado] || "Estado Desconocido";
}

/**
 * Función: obtenerColorEstado
 * Retorna clase Bootstrap para el color del badge según estado
 * @param {string} estado
 * @returns {string}
 */
function obtenerColorEstado(estado) {
    const colores = {
        [ESTADOS_REINGRESO.PENDIENTE_VIGILANCIA_SALIDA]: "bg-warning",
        [ESTADOS_REINGRESO.PENDIENTE_VIGILANCIA_INGRESO]: "bg-info",
        [ESTADOS_REINGRESO.PENDIENTE_RECEPCION]: "bg-secondary",
        [ESTADOS_REINGRESO.RECEPCIONADO]: "bg-success"
    };
    return colores[estado] || "bg-light";
}

/**
 * Función: obtenerIconoEstado
 * Retorna icono Bootstrap según estado
 * @param {string} estado
 * @returns {string}
 */
function obtenerIconoEstado(estado) {
    const iconos = {
        [ESTADOS_REINGRESO.PENDIENTE_VIGILANCIA_SALIDA]: "bi-clock-history",
        [ESTADOS_REINGRESO.PENDIENTE_VIGILANCIA_INGRESO]: "bi-arrow-right-circle",
        [ESTADOS_REINGRESO.PENDIENTE_RECEPCION]: "bi-hourglass-split",
        [ESTADOS_REINGRESO.RECEPCIONADO]: "bi-check-circle-fill"
    };
    return iconos[estado] || "bi-question-circle";
}

/**
 * Función: puedeValidarSalida
 * Determina si el usuario logueado puede dar visto bueno de salida
 * @param {string} usuarioNombre
 * @param {string} estadoActual
 * @returns {boolean}
 */
function puedeValidarSalida(usuarioNombre, estadoActual) {
    return (
        esVigilanciaDelSalida(usuarioNombre) &&
        estadoActual === ESTADOS_REINGRESO.PENDIENTE_VIGILANCIA_SALIDA
    );
}

/**
 * Función: puedeValidarIngreso
 * Determina si el usuario logueado puede dar visto bueno de ingreso
 * @param {string} usuarioNombre
 * @param {string} estadoActual
 * @returns {boolean}
 */
function puedeValidarIngreso(usuarioNombre, estadoActual) {
    return (
        esVigilanciaDelIngreso(usuarioNombre) &&
        estadoActual === ESTADOS_REINGRESO.PENDIENTE_VIGILANCIA_INGRESO
    );
}

/**
 * Función: puedeRecepcionar
 * Determina si el usuario logueado puede dar recepción final
 * @param {string} usuarioNombre
 * @param {string} estadoActual
 * @returns {boolean}
 */
function puedeRecepcionar(usuarioNombre, estadoActual) {
    return (
        esUsuarioArchivoAdmin(usuarioNombre) &&
        estadoActual === ESTADOS_REINGRESO.PENDIENTE_RECEPCION
    );
}

/**
 * Función: puedeEditarReingreso
 * Solo Archivo puede editar reingresos en estado PENDIENTE_VIGILANCIA_SALIDA
 * @param {string} usuarioNombre
 * @param {string} estadoActual
 * @returns {boolean}
 */
function puedeEditarReingreso(usuarioNombre, estadoActual) {
    return (
        esUsuarioArchivoAdmin(usuarioNombre) &&
        estadoActual === ESTADOS_REINGRESO.PENDIENTE_VIGILANCIA_SALIDA
    );
}

/**
 * Función: puedeEliminarReingreso
 * Solo Archivo puede eliminar reingresos en estado PENDIENTE_VIGILANCIA_SALIDA
 * @param {string} usuarioNombre
 * @param {string} estadoActual
 * @returns {boolean}
 */
function puedeEliminarReingreso(usuarioNombre, estadoActual) {
    return (
        esUsuarioArchivoAdmin(usuarioNombre) &&
        estadoActual === ESTADOS_REINGRESO.PENDIENTE_VIGILANCIA_SALIDA
    );
}

/**
 * Función: construirBadgeEstado
 * Construye HTML de badge con estado
 * @param {string} estado
 * @returns {string}
 */
function construirBadgeEstado(estado) {
    const color = obtenerColorEstado(estado);
    const icono = obtenerIconoEstado(estado);
    const descripcion = obtenerDescripcionEstado(estado);
    return `<span class="badge ${color}"><i class="bi ${icono} me-1"></i> ${descripcion}</span>`;
}

/**
 * Función: obtenerFiltrosEstadoPorRol
 * Retorna los estados que debe ver cada rol según su responsabilidad
 * @param {string} usuarioNombre
 * @returns {Array<string>}
 */
function obtenerFiltrosEstadoPorRol(usuarioNombre) {
    if (esVigilanciaDelSalida(usuarioNombre)) {
        return [ESTADOS_REINGRESO.PENDIENTE_VIGILANCIA_SALIDA];
    }
    if (esVigilanciaDelIngreso(usuarioNombre)) {
        return [ESTADOS_REINGRESO.PENDIENTE_VIGILANCIA_INGRESO];
    }
    if (esUsuarioArchivoAdmin(usuarioNombre)) {
        // Archivo ve TODO
        return Object.values(ESTADOS_REINGRESO);
    }
    return [];
}
