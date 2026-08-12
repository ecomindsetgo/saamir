/**
 * ARCHIVO: reingresos-flujo.js
 * Funciones de flujo y validación para el módulo de reingresos
 * Maneja: Guardado inicial, vistos buenos de salida/ingreso/recepción
 * Última actualización: 2026-08-12
 */

/**
 * Función: guardarReingresoInicial
 * Guarda un nuevo reingreso con estado PENDIENTE_VIGILANCIA_SALIDA
 * Registra automáticamente el visto bueno del creador (Archivo)
 */
window.guardarReingresoInicial = async function() {
    try {
        const usuarioActivoNombre = localStorage.getItem("usuarioActivoNombre") || "DESCONOCIDO";
        
        // Validar que sea usuario de Archivo
        if (!esUsuarioArchivoAdmin(usuarioActivoNombre)) {
            alert("❌ Solo usuarios del Área de Archivo pueden crear reingresos");
            return;
        }

        // Recopilar datos del formulario
        const fecha = document.getElementById("re-fecha")?.value;
        const solicitante = document.getElementById("re-solicitante")?.value;
        const local = document.getElementById("re-local")?.value;
        const entregado = usuarioActivoNombre;

        if (!fecha || !solicitante || !local) {
            alert("⚠️ Complete todos los campos requeridos (Fecha, Solicitante, Local)");
            return;
        }

        // Capturar filas de expedientes
        const filas = document.querySelectorAll("#tabla-reingresos tbody tr");
        if (filas.length === 0) {
            alert("⚠️ Agregue al menos un expediente al reingreso");
            return;
        }

        const expedientes = [];
        filas.forEach((fila, idx) => {
            const paquete = fila.cells[0]?.querySelector("input")?.value || "";
            const expediente = fila.cells[1]?.querySelector("input")?.value || "";
            const folios = fila.cells[2]?.querySelector("input")?.value || "0";
            const juzgado = fila.cells[3]?.querySelector("input")?.value || "";
            const tipo = fila.cells[4]?.querySelector("select")?.value || "";
            const acompanado = fila.cells[5]?.querySelector("input")?.value || "0";

            expedientes.push({
                item: idx + 1,
                paquete,
                expediente,
                folios: parseInt(folios),
                juzgado,
                tipo,
                acompanado: parseInt(acompanado)
            });
        });

        // Crear objeto de reingreso
        const nuevoReingreso = {
            correlativo: await obtenerSiguienteCorrelativoReingreso(),
            fecha,
            solicitante,
            local,
            entregado,
            estado: ESTADOS_REINGRESO.PENDIENTE_VIGILANCIA_SALIDA,
            expedientes,
            vistosBuenos: [
                {
                    rol: "archivo_creador",
                    usuario: usuarioActivoNombre,
                    timestamp: new Date().toISOString(),
                    descripcion: "Registro creado y validado"
                }
            ],
            fechaCreacion: new Date().toISOString(),
            fechaModificacion: new Date().toISOString()
        };

        // Guardar en Firestore
        const user = auth.currentUser;
        if (!user) {
            alert("❌ No hay sesión activa");
            return;
        }

        await addDoc(collection(db, "reingresos"), nuevoReingreso);

        // Registrar en auditoría
        await registrarEnAuditoria(usuarioActivoNombre, "Reingresos", "Creación de Reingreso", 
            `Correlativo: ${nuevoReingreso.correlativo} | Local: ${local} | Expedientes: ${expedientes.length}`);

        alert(`✅ Reingreso guardado exitosamente\nCorrelativo: ${nuevoReingreso.correlativo}\nEstado: ${obtenerDescripcionEstado(nuevoReingreso.estado)}`);
        
        resetFormularioReingreso();
        await cargarHistorialReingresos();

    } catch (error) {
        console.error("Error al guardar reingreso:", error);
        alert("❌ Error al guardar el reingreso: " + error.message);
    }
};

/**
 * Función: registrarVistoBuenoSalida
 * Valida la salida del reingreso (rol: vigilancia_salida)
 * Estado: PENDIENTE_VIGILANCIA_SALIDA → PENDIENTE_VIGILANCIA_INGRESO
 */
window.registrarVistoBuenoSalida = async function(reingresoId) {
    try {
        const usuarioActivoNombre = localStorage.getItem("usuarioActivoNombre") || "DESCONOCIDO";
        
        if (!esVigilanciaDelSalida(usuarioActivoNombre)) {
            alert("❌ No tiene permisos para validar salidas");
            return;
        }

        const confirmacion = confirm(
            "¿Confirmar validación de SALIDA?\n\nEsto marcará el reingreso como verificado en el local de salida."
        );
        if (!confirmacion) return;

        const reingresoRef = doc(db, "reingresos", reingresoId);
        const reingresoSnap = await getDoc(reingresoRef);

        if (!reingresoSnap.exists()) {
            alert("❌ Reingreso no encontrado");
            return;
        }

        const datoActual = reingresoSnap.data();

        if (datoActual.estado !== ESTADOS_REINGRESO.PENDIENTE_VIGILANCIA_SALIDA) {
            alert("⚠️ Este reingreso no está en estado de validación de salida");
            return;
        }

        // Agregar visto bueno
        const vistosBuenos = datoActual.vistosBuenos || [];
        vistosBuenos.push({
            rol: "vigilancia_salida",
            usuario: usuarioActivoNombre,
            timestamp: new Date().toISOString(),
            descripcion: "Validación de salida completada"
        });

        // Actualizar estado
        await updateDoc(reingresoRef, {
            estado: ESTADOS_REINGRESO.PENDIENTE_VIGILANCIA_INGRESO,
            vistosBuenos,
            fechaModificacion: new Date().toISOString()
        });

        await registrarEnAuditoria(usuarioActivoNombre, "Reingresos", "Validación de Salida",
            `Reingreso: ${datoActual.correlativo} | Local: ${datoActual.local}`);

        alert("✅ Visto bueno de SALIDA registrado\nEl reingreso avanza a validación de ingreso");
        await cargarHistorialReingresos();

    } catch (error) {
        console.error("Error al registrar visto bueno de salida:", error);
        alert("❌ Error: " + error.message);
    }
};

/**
 * Función: registrarVistoBuenoIngreso
 * Valida el ingreso del reingreso (rol: vigilancia_ingreso)
 * Estado: PENDIENTE_VIGILANCIA_INGRESO → PENDIENTE_RECEPCION
 */
window.registrarVistoBuenoIngreso = async function(reingresoId) {
    try {
        const usuarioActivoNombre = localStorage.getItem("usuarioActivoNombre") || "DESCONOCIDO";
        
        if (!esVigilanciaDelIngreso(usuarioActivoNombre)) {
            alert("❌ No tiene permisos para validar ingresos");
            return;
        }

        const confirmacion = confirm(
            "¿Confirmar validación de INGRESO?\n\nEsto marcará el reingreso como recibido en el repositorio de destino."
        );
        if (!confirmacion) return;

        const reingresoRef = doc(db, "reingresos", reingresoId);
        const reingresoSnap = await getDoc(reingresoRef);

        if (!reingresoSnap.exists()) {
            alert("❌ Reingreso no encontrado");
            return;
        }

        const datoActual = reingresoSnap.data();

        if (datoActual.estado !== ESTADOS_REINGRESO.PENDIENTE_VIGILANCIA_INGRESO) {
            alert("⚠️ Este reingreso no está en estado de validación de ingreso");
            return;
        }

        // Agregar visto bueno
        const vistosBuenos = datoActual.vistosBuenos || [];
        vistosBuenos.push({
            rol: "vigilancia_ingreso",
            usuario: usuarioActivoNombre,
            timestamp: new Date().toISOString(),
            descripcion: "Validación de ingreso completada"
        });

        // Actualizar estado
        await updateDoc(reingresoRef, {
            estado: ESTADOS_REINGRESO.PENDIENTE_RECEPCION,
            vistosBuenos,
            fechaModificacion: new Date().toISOString()
        });

        await registrarEnAuditoria(usuarioActivoNombre, "Reingresos", "Validación de Ingreso",
            `Reingreso: ${datoActual.correlativo}`);

        alert("✅ Visto bueno de INGRESO registrado\nAguardando recepción final de Archivo");
        await cargarHistorialReingresos();

    } catch (error) {
        console.error("Error al registrar visto bueno de ingreso:", error);
        alert("❌ Error: " + error.message);
    }
};

/**
 * Función: registrarRecepcionFinal
 * Cierra el ciclo del reingreso (rol: archivo_escritura)
 * Estado: PENDIENTE_RECEPCION → RECEPCIONADO
 */
window.registrarRecepcionFinal = async function(reingresoId) {
    try {
        const usuarioActivoNombre = localStorage.getItem("usuarioActivoNombre") || "DESCONOCIDO";
        
        if (!esUsuarioArchivoAdmin(usuarioActivoNombre)) {
            alert("❌ Solo usuarios del Área de Archivo pueden recepcionar");
            return;
        }

        const confirmacion = confirm(
            "¿Confirmar RECEPCIÓN FINAL?\n\nEsto cerrará el ciclo del reingreso como completado."
        );
        if (!confirmacion) return;

        const reingresoRef = doc(db, "reingresos", reingresoId);
        const reingresoSnap = await getDoc(reingresoRef);

        if (!reingresoSnap.exists()) {
            alert("❌ Reingreso no encontrado");
            return;
        }

        const datoActual = reingresoSnap.data();

        if (datoActual.estado !== ESTADOS_REINGRESO.PENDIENTE_RECEPCION) {
            alert("⚠️ Este reingreso no está en estado de recepción final");
            return;
        }

        // Agregar visto bueno final
        const vistosBuenos = datoActual.vistosBuenos || [];
        vistosBuenos.push({
            rol: "archivo_receptor",
            usuario: usuarioActivoNombre,
            timestamp: new Date().toISOString(),
            descripcion: "Recepción final completada"
        });

        // Marcar como recepcionado
        await updateDoc(reingresoRef, {
            estado: ESTADOS_REINGRESO.RECEPCIONADO,
            vistosBuenos,
            fechaRecepcion: new Date().toISOString(),
            fechaModificacion: new Date().toISOString()
        });

        await registrarEnAuditoria(usuarioActivoNombre, "Reingresos", "Recepción Final",
            `Reingreso: ${datoActual.correlativo} | Ciclo completado`);

        alert("✅ RECEPCIÓN FINAL registrada\n¡Reingreso completado exitosamente!");
        await cargarHistorialReingresos();

    } catch (error) {
        console.error("Error al registrar recepción final:", error);
        alert("❌ Error: " + error.message);
    }
};

/**
 * Función: registrarEnAuditoria
 * Registra las acciones en la colección de auditoría
 */
async function registrarEnAuditoria(usuario, modulo, accion, detalles) {
    try {
        const user = auth.currentUser;
        if (!user) return;

        await addDoc(collection(db, "auditoria"), {
            usuario,
            modulo,
            accion,
            detalles,
            timestamp: new Date().toISOString(),
            email: user.email
        });
    } catch (error) {
        console.warn("No se registró en auditoría:", error);
    }
}
