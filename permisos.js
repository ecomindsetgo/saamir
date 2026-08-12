/**
 * ARCHIVO: permisos.js
 * Gestión centralizada de permisos, roles y niveles de acceso
 * Última actualización: 2026-08-12
 */

const PERMISOS = {
    // ÁREA DE ARCHIVO - Roles operativos (Generación y Recepción)
    archivo_escritura: [
        "ALFREDO CRUZADO",
        "ACRUZADO"
    ],

    // VIGILANCIA - Local de Salida (solo visualización y validación de salida)
    vigilancia_salida: [
        "VIGILANTE_SALIDA_1",
        "VIGILANTE_SALIDA_2",
        "VIGILANTE_SALIDA_3"
    ],

    // VIGILANCIA - Repositorio de Ingreso (solo visualización y validación de ingreso)
    vigilancia_ingreso: [
        "VIGILANTE_INGRESO_SOTANO",
        "VIGILANTE_INGRESO_PADILLA",
        "VIGILANTE_INGRESO_DUNAS"
    ],

    // MICROFORMAS - Permisos de escritura y lectura
    microformas_escritura: [
        "ALFREDO CRUZADO",
        "ACRUZADO",
        "ROBERTO DÁVILA",
        "ROBERTO DAVILA",
        "RDAVILA",
        "JORGE DESPOSORIO",
        "JDESPOSORIO"
    ],

    microformas_lectura: [
        "ALFREDO CRUZADO",
        "ACRUZADO",
        "ROBERTO DÁVILA",
        "ROBERTO DAVILA",
        "RDAVILA",
        "JORGE DESPOSORIO",
        "JDESPOSORIO"
    ],

    // AUDITORÍA - Solo administradores
    auditoria: [
        "ALFREDO CRUZADO",
        "ACRUZADO"
    ]
};

/**
 * Función: verificarPermisoRol
 * Valida si un usuario tiene permisos específicos
 * @param {string} nombreUsuario - Nombre del usuario (normalizado)
 * @param {string} permiso - Clave del permiso (ej: "archivo_escritura")
 * @returns {boolean}
 */
function verificarPermisoRol(nombreUsuario, permiso) {
    if (!nombreUsuario || !permiso) return false;
    const u = normalizarTexto(nombreUsuario);
    return PERMISOS[permiso]?.map(n => normalizarTexto(n)).includes(u) || false;
}

/**
 * Función: obtenerRolesUsuario
 * Retorna todos los roles/permisos que posee un usuario
 * @param {string} nombreUsuario - Nombre del usuario
 * @returns {Array<string>} - Array con los roles asignados
 */
function obtenerRolesUsuario(nombreUsuario) {
    if (!nombreUsuario) return [];
    const u = normalizarTexto(nombreUsuario);
    const roles = [];

    if (verificarPermisoRol(u, "archivo_escritura")) roles.push("archivo_escritura");
    if (verificarPermisoRol(u, "vigilancia_salida")) roles.push("vigilancia_salida");
    if (verificarPermisoRol(u, "vigilancia_ingreso")) roles.push("vigilancia_ingreso");
    if (verificarPermisoRol(u, "microformas_escritura")) roles.push("microformas_escritura");
    if (verificarPermisoRol(u, "microformas_lectura")) roles.push("microformas_lectura");
    if (verificarPermisoRol(u, "auditoria")) roles.push("auditoria");

    return roles;
}

/**
 * Función: esUsuarioArchivoAdmin
 * Verifica si el usuario puede generar y recepcionar reingresos
 * @param {string} nombreUsuario
 * @returns {boolean}
 */
function esUsuarioArchivoAdmin(nombreUsuario) {
    return verificarPermisoRol(nombreUsuario, "archivo_escritura");
}

/**
 * Función: esVigilanciaDelSalida
 * Verifica si el usuario puede validar salidas
 * @param {string} nombreUsuario
 * @returns {boolean}
 */
function esVigilanciaDelSalida(nombreUsuario) {
    return verificarPermisoRol(nombreUsuario, "vigilancia_salida");
}

/**
 * Función: esVigilanciaDelIngreso
 * Verifica si el usuario puede validar ingresos
 * @param {string} nombreUsuario
 * @returns {boolean}
 */
function esVigilanciaDelIngreso(nombreUsuario) {
    return verificarPermisoRol(nombreUsuario, "vigilancia_ingreso");
}

/**
 * Función: puedeEditarMicroformas
 * Verifica si el usuario puede crear/editar microformas
 * @param {string} nombreUsuario
 * @returns {boolean}
 */
function puedeEditarMicroformas(nombreUsuario) {
    return verificarPermisoRol(nombreUsuario, "microformas_escritura");
}

/**
 * Función: tieneAccesoAuditoria
 * Verifica si el usuario puede ver auditoría
 * @param {string} nombreUsuario
 * @returns {boolean}
 */
function tieneAccesoAuditoria(nombreUsuario) {
    return verificarPermisoRol(nombreUsuario, "auditoria");
}
