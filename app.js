import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDaVsm4cs9O-R0plj1hk62Iy1uU2IYZLfc",
    authDomain: "sipa-d4ec9.firebaseapp.com",
    projectId: "sipa-d4ec9",
    storageBucket: "sipa-d4ec9.firebasestorage.app",
    messagingSenderId: "560354492263",
    appId: "1:560354492263:web:653ac26f811153537c79c2"
};

const app = initializeApp(firebaseConfig);

// App Check — pega aquí tu Site Key de reCAPTCHA v3 (paso 3 de la guía anterior)
initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider("6Lfrq4QtAAAAAJUubozaJmp-DXEwvSuwSyzsNi1X"),
    isTokenAutoRefreshEnabled: true
});

const auth = getAuth(app);
const db = getFirestore(app);
const NOMBRE_SUPERVISOR_LPMD = "ALFREDO CRUZADO PALACIOS";
const DOMINIO_INSTITUCIONAL = "pj.gob.pe";

        const repositorios = ["SÓTANO NCPP", "SAENZ PEÑA", "PADILLA", "DUNAS", "DOMUS"];
        const listaPersonalRoles = {
            "JORGE DESPOSORIO": "Responsable de Archivo",
            "ROBERTO DÁVILA": "Personal de Archivo",
            "ALFREDO CRUZADO": "Personal de Archivo",
            "LUIS EPIFANÍA": "Personal de Archivo",
            "JORGE IZQUIERDO": "Personal de Archivo",
            "MANUEL BARANDIARAN": "Personal de Archivo",
            "RAÚL RODRIGUEZ": "Personal de Archivo",
            "TEÓFILO GABINO": "Personal de Archivo",
            "IVÁN ROCHA": "Personal de Archivo",
            "ROSA CHUMBES": "Personal de Archivo"
        };

        const dataMaestra = {
            personal: [
                "ALFREDO CRUZADO", "RAÚL RODRIGUEZ", "JORGE DESPOSORIO", 
                "JORGE IZQUIERDO", "LUIS EPIFANÍA", "MANUEL BARANDIARAN", 
                "ROBERTO DÁVILA", "TEÓFILO GABINO", "IVÁN ROCHA"
            ],
            repositorios: [
                "SÓTANO NCPP", "SAENZ PEÑA", "PADILLA", "DUNAS", "DOMUS"
            ]
        };

        const PERMISOS = {
            reingresos_escritura: ["ALFREDO CRUZADO", "ACRUZADO", "ROBERTO DAVILA", "RDAVILA", "JORGE IZQUIERDO", "JIZQUIERDO", "MANUEL BARANDIARAN", "MBARANDIARAN"],
            inventario_escritura: ["ALFREDO CRUZADO", "ACRUZADO", "ROBERTO DAVILA", "RDAVILA", "JORGE IZQUIERDO", "JIZQUIERDO", "MANUEL BARANDIARAN", "MBARANDIARAN", "TEOFILO GABINO", "TGABINO"],
            microformas_escritura: ["ALFREDO CRUZADO", "ACRUZADO"],
            // NUEVO: usuarios de vigilancia habilitados para dar visto bueno de SALIDA e INGRESO
            // por cada repositorio. Solo se listan aquí los repositorios que SÍ cuentan con
            // vigilante asignado (Sótano NCPP, Sáenz Peña y Padilla). Los repositorios que
            // no aparecen en este mapa (Dunas, Domus) se consideran "sin vigilancia" y ese
            // paso del flujo se salta automáticamente.
            // ⚠️ IMPORTANTE: reemplazar estos nombres/alias por los usuarios reales que se
            // creen en Firebase Auth para cada vigilante (ej: "vigilante.sotano@pj.gob.pe").
            vigilancia_repositorios: {
                "SÓTANO NCPP": ["VIGILANTE SOTANO NCPP", "VSOTANO", "VIGILANCIA SOTANO"],
                "SAENZ PEÑA": ["VIGILANTE SAENZ PEÑA", "VSAENZPENA", "VIGILANCIA SAENZ PEÑA"],
                "PADILLA": ["VIGILANTE PADILLA", "VPADILLA", "VIGILANCIA PADILLA"]
            },
            // NUEVO: quién puede EDITAR o ELIMINAR un reingreso YA GUARDADO desde la
            // vista "Consultar Historial de Reingresos". Es más restrictivo que
            // reingresos_escritura (que solo habilita CREAR nuevos registros): por
            // pedido explícito, únicamente Jorge Izquierdo y Manuel Barandiaran (además
            // del administrador) pueden editar/eliminar reingresos ya existentes. El
            // resto del personal (Roberto Dávila, Jorge Desposorio, Luis Epifanía,
            // Teófilo Gabino, Raúl Rodriguez) y los vigilantes solo pueden ver/descargar.
            reingresos_edicion_historial: ["ALFREDO CRUZADO", "ACRUZADO", "JORGE IZQUIERDO", "JIZQUIERDO", "MANUEL BARANDIARAN", "MBARANDIARAN"],
            // NUEVO: quién puede dar el visto bueno final de RECEPCIÓN. Por defecto se asume
            // el mismo personal de archivo que puede generar reingresos.
            recepcion_reingresos: ["ALFREDO CRUZADO", "ACRUZADO", "ROBERTO DAVILA", "RDAVILA", "JORGE IZQUIERDO", "JIZQUIERDO", "MANUEL BARANDIARAN", "MBARANDIARAN"]
        };

        // ===== FLUJO DE APROBACIÓN DE REINGRESOS =====
        // Orden de etapas. Las etapas de vigilancia se saltan automáticamente si el
        // repositorio correspondiente no tiene vigilante asignado (ver PERMISOS.vigilancia_repositorios).
        const ORDEN_ESTADOS_REINGRESO = ["GENERADO", "VERIF_SALIDA", "VERIF_INGRESO", "RECEPCION", "COMPLETADO"];

        const ETIQUETAS_ESTADO_REINGRESO = {
            GENERADO: { texto: "Generado", clase: "secondary", icono: "bi-pencil-square" },
            VERIF_SALIDA: { texto: "Pend. Vigilancia Salida", clase: "warning", icono: "bi-shield-exclamation" },
            VERIF_INGRESO: { texto: "Pend. Vigilancia Ingreso", clase: "warning", icono: "bi-shield-exclamation" },
            RECEPCION: { texto: "Pend. Recepción", clase: "info", icono: "bi-inbox" },
            COMPLETADO: { texto: "Completado", clase: "success", icono: "bi-check-circle" }
        };

        function repositorioTieneVigilancia(repo) {
            return Object.prototype.hasOwnProperty.call(PERMISOS.vigilancia_repositorios, repo);
        }

        function puedeVigilarRepositorio(nombreUsuario, repo) {
            const lista = (PERMISOS.vigilancia_repositorios[repo] || []).map(n => normalizarTexto(n));
            return lista.includes(normalizarTexto(nombreUsuario));
        }

        function puedeRecepcionarReingreso(nombreUsuario) {
            return PERMISOS.recepcion_reingresos.map(n => normalizarTexto(n)).includes(normalizarTexto(nombreUsuario));
        }

        // Permiso para EDITAR/ELIMINAR un reingreso ya guardado (vista Consultar
        // Historial). Distinto de "puedeReingresos" (crear), ver PERMISOS.reingresos_edicion_historial.
        function puedeEditarEliminarReingresoGuardado(nombreUsuario) {
            return PERMISOS.reingresos_edicion_historial.map(n => normalizarTexto(n)).includes(normalizarTexto(nombreUsuario));
        }

        // La RECEPCIÓN de un reingreso es un visto bueno personal: solo el usuario que
        // figura como "solicitante" en ESE registro puede confirmar que lo recibió.
        // (puedeRecepcionarReingreso, arriba, sólo se usa como heurística general para
        // decidir si se muestra el enlace de menú "Verificación de Reingresos").
        function puedeRecepcionarRegistro(nombreUsuario, registro) {
            if (!registro || !registro.solicitante) return false;
            return normalizarTexto(nombreUsuario) === normalizarTexto(registro.solicitante);
        }

        // Dado un registro (con localSalida y local) y su estado actual, calcula el
        // siguiente estado saltando las etapas de vigilancia sin vigilante asignado.
        function calcularSiguienteEstadoReingreso(registro, estadoActual) {
            let idx = ORDEN_ESTADOS_REINGRESO.indexOf(estadoActual);
            if (idx === -1) idx = 0;
            idx++;
            while (idx < ORDEN_ESTADOS_REINGRESO.length - 1) {
                const etapa = ORDEN_ESTADOS_REINGRESO[idx];
                if (etapa === "VERIF_SALIDA" && !repositorioTieneVigilancia(registro.localSalida)) { idx++; continue; }
                if (etapa === "VERIF_INGRESO" && !repositorioTieneVigilancia(registro.local)) { idx++; continue; }
                break;
            }
            return ORDEN_ESTADOS_REINGRESO[idx];
        }

        // Usuario actual (nombre normalizado), usado por las funciones de vistos buenos.
        function obtenerNombreUsuarioActual() {
            return obtenerNombreCanonicoDeUsuario(auth.currentUser);
        }

        // Indica si el usuario actual tiene ALGUNA verificación pendiente que atender
        // (para decidir si se le muestra el enlace "Verificación de Reingresos").
        function usuarioTienePermisoDeVerificacion(nombreUsuario) {
            const esVigilante = Object.keys(PERMISOS.vigilancia_repositorios).some(repo => puedeVigilarRepositorio(nombreUsuario, repo));
            return esVigilante || puedeRecepcionarReingreso(nombreUsuario);
        }

        // NUEVO: un usuario "vigilancia exclusiva" es aquel que SOLO existe para dar vistos
        // buenos de vigilancia (guardianía) por repositorio — VSOTANO, VSAENZPENA, VPADILLA,
        // etc. Se detecta de forma EXPLÍCITA (no por descarte) comparando contra la propia
        // lista de vigilantes autorizados por repositorio (PERMISOS.vigilancia_repositorios),
        // que es la fuente de verdad de quién es "solo vigilancia". Esto evita que el personal
        // de archivo (que inicia sesión con su alias, no con su nombre completo) sea
        // confundido con un vigilante exclusivo solo por tener algún permiso de verificación.
        // Los vigilantes, además de su bandeja de verificación, pueden CONSULTAR el
        // historial de reingresos (solo lectura: ver y descargar PDF). No se les da
        // 'view-reingresos' (creación) — la protección de edición/eliminación en la
        // vista de consulta se aplica en renderTablaHistorialReingresos().
        const VISTAS_PERMITIDAS_VIGILANCIA = ['view-verificacion-reingresos', 'view-consultas-reingresos', 'view-perfil'];

        function esUsuarioVigilanciaExclusiva(nombreUsuario) {
            const u = normalizarTexto(nombreUsuario);
            if (esUsuarioAdministradorLog(u)) return false;
            const listaVigilanciaDedicada = Object.values(PERMISOS.vigilancia_repositorios)
                .flat()
                .map(n => normalizarTexto(n));
            return listaVigilanciaDedicada.includes(u);
        }

        function normalizarTexto(texto) {
            if (!texto) return '';
            return texto.trim().toUpperCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes/diacríticos (Á->A, Ñ->N, etc.)
                .replace(/\s+/g, ' ');
        }

        // ===== MAPEO DE ALIAS DE LOGIN -> NOMBRE CANÓNICO A MOSTRAR =====
        // Varias cuentas inician sesión con un alias corto (ej. "JIZQUIERDO") en vez
        // de su nombre completo. Este mapa centraliza la resolución para que, en toda
        // la aplicación (perfil, campos "Entregado por", auditorías, coincidencia con
        // el "Solicitante" de un reingreso, etc.), se use siempre el mismo nombre
        // canónico sin importar con qué alias inició sesión la persona.
        const ALIAS_A_NOMBRE_COMPLETO = {
            "VSOTANO": "VIGILANCIA SOTANO",
            "VSAENZPENA": "VIGILANCIA SAENZ PEÑA",
            "VPADILLA": "VIGILANCIA PADILLA",
            "IROCHA": "IVÁN ROCHA",
            "JIZQUIERDO": "JORGE IZQUIERDO",
            "RDAVILA": "ROBERTO DÁVILA",
            "JDESPOSORIO": "JORGE DESPOSORIO",
            "MBARANDIARAN": "MANUEL BARANDIARAN",
            "ARODRIGUEZ": "RAÚL RODRIGUEZ",
            "TGABINO": "TEÓFILO GABINO",
            "LEPIFANIA": "LUIS EPIFANÍA"
        };

        // Dado un nombre "crudo" (tal cual viene de Firebase, con o sin tildes), lo
        // resuelve a su nombre canónico si es un alias conocido; si no, lo devuelve
        // sin cambios (ya es un nombre completo u otro usuario no mapeado).
        function resolverNombreCanonico(nombreCrudo) {
            const clave = normalizarTexto(nombreCrudo);
            return ALIAS_A_NOMBRE_COMPLETO[clave] || nombreCrudo;
        }

        // Punto único para obtener el nombre canónico de un usuario de Firebase Auth
        // (objeto currentUser). Reemplaza el patrón repetido de "displayName o email"
        // agregando además la resolución de alias -> nombre completo.
        function obtenerNombreCanonicoDeUsuario(userObj) {
            if (!userObj) return 'DESCONOCIDO';
            const crudo = userObj.displayName ? userObj.displayName : (userObj.email ? userObj.email.split('@')[0] : '');
            return resolverNombreCanonico(normalizarTexto(crudo));
        }

        // Todo usuario que inicia sesión con uno de los alias mapeados en
        // ALIAS_A_NOMBRE_COMPLETO tiene el cambio de nombre de perfil BLOQUEADO,
        // para evitar que se desvincule del alias con el que fue dado de alta
        // (vigilantes VSOTANO/VSAENZPENA/VPADILLA y personal de archivo con alias
        // corto: IROCHA, JIZQUIERDO, RDAVILA, JDESPOSORIO, MBARANDIARAN,
        // ARODRIGUEZ, TGABINO, LEPIFANIA).
        const NOMBRES_CANONICOS_BLOQUEADOS = Object.values(ALIAS_A_NOMBRE_COMPLETO).map(normalizarTexto);

        function usuarioTieneNombreBloqueado(nombreUsuario) {
            return NOMBRES_CANONICOS_BLOQUEADOS.includes(normalizarTexto(nombreUsuario));
        }

        function esUsuarioAdministradorLog(nombreUsuario) {
            const u = normalizarTexto(nombreUsuario);
            return u === "ALFREDO CRUZADO" || u === "ACRUZADO";
        }

        function esUsuarioMicroformasVisualizador(nombreUsuario) {
            const u = normalizarTexto(nombreUsuario);
            return u === "ROBERTO DÁVILA" || u === "ROBERTO DAVILA" || u === "RDAVILA" || u === "JORGE DESPOSORIO" || u === "JDESPOSORIO" || esUsuarioAdministradorLog(u);
        }

        // ===== CONTROL DE ACCESO A MÓDULOS POR USUARIO =====
        // Todas las vistas (secciones) que existen en el sistema.
        const TODAS_LAS_VISTAS = [
            'view-dashboard', 'view-tarjetas', 'view-consultas-tarjetas', 'view-inventario',
            'view-consultas', 'view-reingresos', 'view-consultas-reingresos',
            'view-verificacion-reingresos', 'view-traslados', 'view-consultas-traslados',
            'view-microformas', 'view-perfil', 'view-configuracion', 'view-auditoria'
        ];

        // Subconjunto de módulos operativos para el acceso "limitado" (sin Dashboard,
        // sin Control de Microformas y sin Auditoría de Cambios).
        const VISTAS_ACCESO_LIMITADO = [
            'view-tarjetas', 'view-consultas-tarjetas', 'view-inventario', 'view-consultas',
            'view-reingresos', 'view-consultas-reingresos', 'view-verificacion-reingresos',
            'view-traslados', 'view-consultas-traslados', 'view-perfil', 'view-configuracion'
        ];

        // Título por defecto de cada vista, usado para redirigir al iniciar sesión.
        const TITULOS_VISTAS = {
            'view-dashboard': 'Dashboard Principal',
            'view-tarjetas': 'Generador de Tarjetas de Paquetes',
            'view-consultas-tarjetas': 'Consultar Historial de Tarjetas',
            'view-inventario': 'Carga de Inventario de Existencias',
            'view-consultas': 'Consultar Consolidados por Repositorio',
            'view-reingresos': 'Módulo Reingresos',
            'view-consultas-reingresos': 'Consultar Historial de Reingresos',
            'view-verificacion-reingresos': 'Verificación de Reingresos',
            'view-traslados': 'Módulo Formato de Traslado',
            'view-consultas-traslados': 'Consultar Historial de Traslados',
            'view-microformas': 'Control de Producción de Microformas',
            'view-perfil': 'Mi Perfil de Usuario',
            'view-configuracion': 'Consola de Configuración',
            'view-auditoria': 'Historial y Trazabilidad del Sistema'
        };

        // Roles explícitos de acceso a módulos, según lo definido por la coordinación.
        const ROLES_ACCESO_MODULOS = {
            // Acceso total: absolutamente todos los módulos, incluida Auditoría de Cambios.
            ACCESO_TOTAL: ["ALFREDO CRUZADO", "ACRUZADO"],
            // Todos los módulos EXCEPTO Auditoría de Cambios.
            ACCESO_SIN_AUDITORIA: ["ROBERTO DÁVILA", "ROBERTO DAVILA", "RDAVILA", "JORGE DESPOSORIO", "JDESPOSORIO"],
            // Acceso restringido a un subconjunto operativo de módulos (ver VISTAS_ACCESO_LIMITADO).
            ACCESO_LIMITADO: [
                "MANUEL BARANDIARAN", "MBARANDIARAN",
                "JORGE IZQUIERDO", "JIZQUIERDO",
                "IVÁN ROCHA", "IVAN ROCHA", "IROCHA",
                "TEÓFILO GABINO", "TEOFILO GABINO", "TGABINO",
                "RAÚL RODRIGUEZ", "RAUL RODRIGUEZ", "ARODRIGUEZ"
            ]
        };

        // Devuelve la lista de vistas permitidas para un usuario según su rol explícito,
        // o null si el usuario no tiene un rol explícito asignado (en cuyo caso se aplican
        // las reglas heredadas basadas en las funciones de permiso individuales).
        function obtenerVistasPermitidas(nombreUsuario) {
            const u = normalizarTexto(nombreUsuario);

            // Los usuarios de vigilancia exclusiva sólo ven Verificación de Reingresos
            // (y su propio Perfil, para poder gestionar su contraseña).
            if (esUsuarioVigilanciaExclusiva(u)) {
                return VISTAS_PERMITIDAS_VIGILANCIA;
            }

            if (ROLES_ACCESO_MODULOS.ACCESO_TOTAL.map(normalizarTexto).includes(u)) {
                return TODAS_LAS_VISTAS;
            }

            if (ROLES_ACCESO_MODULOS.ACCESO_SIN_AUDITORIA.map(normalizarTexto).includes(u)) {
                return TODAS_LAS_VISTAS.filter(v => v !== 'view-auditoria');
            }

            if (ROLES_ACCESO_MODULOS.ACCESO_LIMITADO.map(normalizarTexto).includes(u)) {
                return VISTAS_ACCESO_LIMITADO;
            }

            return null;
        }

        // Punto único de verificación de acceso a una vista, usado tanto para mostrar/ocultar
        // el menú lateral como para bloquear la navegación directa (switchView).
        function usuarioPuedeAccederVista(nombreUsuario, viewId) {
            const vistasExplicitas = obtenerVistasPermitidas(nombreUsuario);
            if (vistasExplicitas !== null) {
                return vistasExplicitas.includes(viewId);
            }
            // Reglas heredadas para el resto del personal de archivo (sin rol explícito).
            switch (viewId) {
                case 'view-auditoria':
                    return esUsuarioAdministradorLog(nombreUsuario);
                case 'view-microformas':
                    return esUsuarioMicroformasVisualizador(nombreUsuario);
                case 'view-verificacion-reingresos':
                    return usuarioTienePermisoDeVerificacion(nombreUsuario);
                default:
                    return true;
            }
        }

        function aplicarPermisos(nombreUsuario) {
            const usuarioLimpio = normalizarTexto(nombreUsuario);
            
            const reingresosLimpios = PERMISOS.reingresos_escritura.map(n => normalizarTexto(n));
            const inventarioLimpios = PERMISOS.inventario_escritura.map(n => normalizarTexto(n));
            const microformasLimpios = PERMISOS.microformas_escritura.map(n => normalizarTexto(n));

            const puedeReingresos = reingresosLimpios.includes(usuarioLimpio);
            const puedeInventario = inventarioLimpios.includes(usuarioLimpio);
            const puedeMicroformasEscritura = microformasLimpios.includes(usuarioLimpio);
            const puedeVerMicroformas = esUsuarioMicroformasVisualizador(usuarioLimpio);
            const esAdminLog = esUsuarioAdministradorLog(usuarioLimpio);

            const menuMicroformas = document.getElementById('menu-link-microformas');
            if (menuMicroformas) {
                menuMicroformas.style.display = puedeVerMicroformas ? 'flex' : 'none';
            }

            const menuAuditoria = document.getElementById('menu-link-auditoria');
            if (menuAuditoria) {
                menuAuditoria.style.display = esAdminLog ? 'flex' : 'none';
            }

            const menuVerificacion = document.getElementById('menu-link-verificacion-reingresos');
            if (menuVerificacion) {
                menuVerificacion.style.display = usuarioTienePermisoDeVerificacion(usuarioLimpio) ? 'flex' : 'none';
            }

            const btnImprimirDash = document.getElementById('btn-imprimir-dashboard');
            if (btnImprimirDash) {
                if (esAdminLog) {
                    btnImprimirDash.style.setProperty('display', 'flex', 'important');
                } else {
                    btnImprimirDash.style.setProperty('display', 'none', 'important');
                }
            }

            const btnNuevaMicroforma = document.getElementById('btn-nueva-microforma');
            if (btnNuevaMicroforma) {
                btnNuevaMicroforma.style.display = puedeMicroformasEscritura ? 'flex' : 'none';
            }

            document.getElementById('btn-guardar-reingreso')?.toggleAttribute('disabled', !puedeReingresos);
            
            const btnAgregarExpediente = document.querySelector('button[onclick="agregarFilaReingreso()"]');
            if (btnAgregarExpediente) {
                btnAgregarExpediente.disabled = !puedeReingresos;
                btnAgregarExpediente.style.pointerEvents = puedeReingresos ? 'auto' : 'none';
                btnAgregarExpediente.classList.toggle('opacity-50', !puedeReingresos);
            }

            const btnGenerarPDF = document.querySelector('button[onclick="generarReporteReingresoPDF()"]');
            if (btnGenerarPDF) {
                btnGenerarPDF.disabled = !puedeReingresos;
                btnGenerarPDF.style.pointerEvents = puedeReingresos ? 'auto' : 'none';
                btnGenerarPDF.classList.toggle('opacity-50', !puedeReingresos);
            }

            document.querySelectorAll('#view-reingresos input, #view-reingresos select').forEach(el => el.disabled = !puedeReingresos);

            document.getElementById('btn-guardar-traslado')?.removeAttribute('disabled');
            
            const btnAgregarTraslado = document.querySelector('button[onclick="agregarFilaTraslado()"]');
            if (btnAgregarTraslado) {
                btnAgregarTraslado.disabled = false;
                btnAgregarTraslado.style.pointerEvents = 'auto';
                btnAgregarTraslado.classList.remove('opacity-50');
            }

            const btnGenerarPDFTraslado = document.querySelector('button[onclick="generarReporteTrasladoPDF()"]');
            if (btnGenerarPDFTraslado) {
                btnGenerarPDFTraslado.disabled = false;
                btnGenerarPDFTraslado.style.pointerEvents = 'auto';
                btnGenerarPDFTraslado.classList.remove('opacity-50');
            }

            document.querySelectorAll('#view-traslados input, #view-traslados select').forEach(el => el.disabled = false);

            document.getElementById('form-inventario')?.querySelectorAll('input, select, button[type=submit]').forEach(el => el.disabled = !puedeInventario);

            const btnAgregarRango = document.querySelector('button[onclick="abrirModalRango()"]');
            if (btnAgregarRango) {
                btnAgregarRango.disabled = !puedeInventario;
                btnAgregarRango.style.pointerEvents = puedeInventario ? 'auto' : 'none';
                btnAgregarRango.classList.toggle('opacity-50', !puedeInventario);
            }

            // ===== ACCESO A MÓDULOS SEGÚN ROL EXPLÍCITO =====
            // Si el usuario tiene un rol explícito asignado (vigilancia exclusiva, acceso
            // total, acceso sin auditoría o acceso limitado), se aplica esa lista de vistas
            // permitidas al menú lateral, ocultando cualquier otro módulo.
            const vistasPermitidas = obtenerVistasPermitidas(usuarioLimpio);
            if (vistasPermitidas !== null) {
                document.querySelectorAll('#sidebar .nav-link[data-view]').forEach(enlace => {
                    const vista = enlace.dataset.view;
                    enlace.style.setProperty('display', vistasPermitidas.includes(vista) ? 'flex' : 'none', 'important');
                });
            }

            const esSoloVigilancia = esUsuarioVigilanciaExclusiva(usuarioLimpio);
            const badgeRolSidebar = document.getElementById('user-display-role');
            if (badgeRolSidebar && esSoloVigilancia) {
                badgeRolSidebar.innerText = 'Vigilancia';
            }
        }

        async function sincronizarUsuarioEnFirestore(user, nombreUsuario) {
            try {
                await setDoc(doc(db, "usuarios", user.uid), {
                    nombre: nombreUsuario,
                    email: user.email || '',
                    rol: listaPersonalRoles[nombreUsuario] || "Personal de Archivo",
                    actualizadoEn: Date.now()
                }, { merge: true });
            } catch (e) {
                console.error("No se pudo sincronizar usuarios/{uid}:", e);
            }
        }

        async function registrarInicioSesionEnCloud(user, nombreUsuario) {
            try {
                await addDoc(collection(db, "auditoria_logins"), {
                    email: user.email || '',
                    nombre: nombreUsuario,
                    timestamp: Date.now()
                });
            } catch (e) {
                console.error("Error al registrar login en Cloud:", e);
            }
        }

        let baseDatosInventario = []; 
        let listaRangosCenso = [];    
        let listaFaltantesModal = []; 
        let baseDatosReingresos = [];
        let baseDatosTraslados = [];
        let baseDatosMicroformas = [];
        let baseDatosTarjetas = [];
        let listaLogsAuditoria = [];
        let idReingresoEnEdicion = null;
        let idTrasladoEnEdicion = null;
        let idMicroformaEnEdicion = null;
        let modalInstance = null;
        let modalMicroformaInstance = null;

        // Variables para Paginación de 10 registros
        let paginaActualMicroformas = 1;
        let paginaActualAuditoria = 1;
        const registrosPorPagina = 10;

        function obtenerLogoArchivoBase64() {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = function() { resolve(null); };
                img.src = 'https://ecomindsetgo.github.io/saamir/LOGO%20ARCHIVO.png';
            });
        }

        window.addEventListener('DOMContentLoaded', () => {
            let correoGuardado = localStorage.getItem('saamir_ultimo_correo');
            if (correoGuardado) {
                if (correoGuardado.includes('@')) {
                    correoGuardado = correoGuardado.split('@')[0];
                    localStorage.setItem('saamir_ultimo_correo', correoGuardado);
                }
                const inputEmail = document.getElementById("login-alias");
                if (inputEmail) inputEmail.value = correoGuardado;
            }
            inicializarAniosIngresoTarjetas();
            if (document.querySelectorAll('#tabla-tarjetas-detalles tbody tr').length === 0) {
                window.agregarFilaTarjeta(5); // Iniciar con 5 filas vacías por defecto
            }
        });

        function inicializarAniosIngresoTarjetas() {
            const selectAnio = document.getElementById('tar-anio-ingreso');
            if (!selectAnio) return;
            selectAnio.innerHTML = '';
            const anioActual = new Date().getFullYear();
            for (let y = anioActual + 1; y >= 2015; y--) {
                selectAnio.options.add(new Option(y, y, false, y === anioActual));
            }
        }

        function cargarDataMaestra(usuarioActivoNombre = "") {
            const selectRepo = document.getElementById('inv-repositorio');
            const selectFiltroRepo = document.getElementById('filtro-repo');
            const selectRec = document.getElementById('inv-recibe');

            selectRepo.innerHTML = '<option value="" selected disabled>Seleccione repositorio...</option>';
            selectFiltroRepo.innerHTML = '<option value="">Todos los Repositorios</option>';

            repositorios.forEach(r => {
                selectRepo.options.add(new Option(r, r));
                selectFiltroRepo.options.add(new Option(r, r));
            });
            
            selectRec.innerHTML = '<option value="" selected disabled>Seleccione personal...</option>';
            Object.keys(listaPersonalRoles).forEach(p => {
                if (p !== usuarioActivoNombre) {
                    selectRec.options.add(new Option(p, p));
                }
            });
        }

        function inicializarSelectsReingresos() {
            const sSolicitante = document.getElementById('re-solicitante');
            const sLocal = document.getElementById('re-local');
            const sLocalSalida = document.getElementById('re-local-salida');
            const fSolicitante = document.getElementById('filtro-re-solicitante');
            const fEntregado = document.getElementById('filtro-re-entregado');

            sSolicitante.innerHTML = sLocal.innerHTML = '<option value="">Seleccione...</option>';
            if (sLocalSalida) sLocalSalida.innerHTML = '<option value="">Seleccione...</option>';
            if (fSolicitante) fSolicitante.innerHTML = '<option value="">Todos</option>';
            if (fEntregado) fEntregado.innerHTML = '<option value="">Todos</option>';

            dataMaestra.personal.forEach(p => {
                sSolicitante.innerHTML += `<option value="${p}">${p}</option>`;
                if (fSolicitante) fSolicitante.innerHTML += `<option value="${p}">${p}</option>`;
                if (fEntregado) fEntregado.innerHTML += `<option value="${p}">${p}</option>`;
            });

            dataMaestra.repositorios.forEach(r => {
                sLocal.innerHTML += `<option value="${r}">${r}</option>`;
                if (sLocalSalida) {
                    const etiquetaVigilancia = repositorioTieneVigilancia(r) ? '' : ' (sin vigilancia)';
                    sLocalSalida.innerHTML += `<option value="${r}">${r}${etiquetaVigilancia}</option>`;
                }
            });
        }

        function inicializarSelectsTraslados(usuarioActivoNombre = "") {
            const fEntregadoTr = document.getElementById('filtro-tr-entregado');
            if (fEntregadoTr) {
                fEntregadoTr.innerHTML = '<option value="">Todos</option>';
                dataMaestra.personal.forEach(p => {
                    fEntregadoTr.innerHTML += `<option value="${p}">${p}</option>`;
                });
            }

            const selectTrRecibe = document.getElementById('tr-recibe');
            if (selectTrRecibe) {
                selectTrRecibe.innerHTML = '<option value="" selected disabled>Seleccione personal...</option>';
                Object.keys(listaPersonalRoles).forEach(p => {
                    if (p !== usuarioActivoNombre) {
                        selectTrRecibe.options.add(new Option(p, p));
                    }
                });
            }
        }

        function resetFormularioReingreso() {
            idReingresoEnEdicion = null;
            const fFecha = document.getElementById('re-fecha');
            const fSolicitante = document.getElementById('re-solicitante');
            const fLocal = document.getElementById('re-local');
            const fLocalSalida = document.getElementById('re-local-salida');
            const tbody = document.querySelector('#tabla-reingresos tbody');
            const btnGuardar = document.getElementById('btn-guardar-reingreso');

            if (fFecha) fFecha.valueAsDate = new Date();
            if (fSolicitante) fSolicitante.value = '';
            if (fLocal) fLocal.value = '';
            if (fLocalSalida) fLocalSalida.value = '';
            if (tbody) tbody.innerHTML = '';
            if (btnGuardar) btnGuardar.innerHTML = '<i class="bi bi-cloud-upload me-2"></i>Guardar Registro';
        }

        function resetFormularioTraslado() {
            idTrasladoEnEdicion = null;
            const fFecha = document.getElementById('tr-fecha');
            const fRecibe = document.getElementById('tr-recibe');
            const tbody = document.querySelector('#tabla-traslados tbody');
            const btnGuardar = document.getElementById('btn-guardar-traslado');

            if (fFecha) fFecha.valueAsDate = new Date();
            if (fRecibe) fRecibe.value = '';
            if (tbody) tbody.innerHTML = '';
            if (btnGuardar) btnGuardar.innerHTML = '<i class="bi bi-cloud-upload me-2"></i>Guardar Registro';
            actualizarTotalTraslados();
        }

        window.iniciarNuevoReingreso = function() {
            resetFormularioReingreso();
            switchView('view-reingresos', 'Módulo Reingresos');
        };

        window.iniciarNuevoTraslado = function() {
            resetFormularioTraslado();
            switchView('view-traslados', 'Módulo Formato de Traslado');
        };

        window.toggleMenuMovil = function() {
            document.getElementById('sidebar').classList.toggle('sidebar-abierto');
            document.getElementById('sidebar-backdrop').classList.toggle('show');
        };

        window.cerrarMenuMovil = function() {
            document.getElementById('sidebar').classList.remove('sidebar-abierto');
            document.getElementById('sidebar-backdrop').classList.remove('show');
        };

        function switchView(viewId, titleText = "Dashboard Principal") {
            cerrarMenuMovil();

            const userTitleGuard = auth.currentUser ? obtenerNombreCanonicoDeUsuario(auth.currentUser) : '';
            if (esUsuarioVigilanciaExclusiva(userTitleGuard) && !VISTAS_PERMITIDAS_VIGILANCIA.includes(viewId)) {
                viewId = 'view-verificacion-reingresos';
                titleText = 'Verificación de Reingresos';
            }

            if (userTitleGuard && !usuarioPuedeAccederVista(userTitleGuard, viewId)) {
                Swal.fire('Acceso Denegado', 'No cuenta con autorización para visualizar este módulo.', 'error');
                return;
            }

            if (viewId === 'view-auditoria') {
                cargarHistorialAuditoriaGlobal();
            }

            if (viewId === 'view-microformas') {
                cargarMicroformasDesdeCloud();
            }

            if (viewId === 'view-traslados') {
                const userTitle = auth.currentUser ? obtenerNombreCanonicoDeUsuario(auth.currentUser) : '';
                inicializarSelectsTraslados(userTitle);
            }

            document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('#sidebar .nav-link').forEach(l => l.classList.remove('active'));
            document.getElementById(viewId).classList.add('active');
            document.getElementById('page-title').innerText = titleText;
            
            const link = Array.from(document.querySelectorAll('#sidebar .nav-link')).find(l => l.dataset.view === viewId || (l.getAttribute('onclick') && l.getAttribute('onclick').includes(viewId)));
            if(link) link.classList.add('active');

            if (viewId === 'view-consultas-reingresos') {
                cargarHistorialReingresos();
            }

            if (viewId === 'view-verificacion-reingresos') {
                window.cargarBandejaVerificacionReingresos();
            }

            if (viewId === 'view-consultas-traslados') {
                cargarHistorialTraslados();
            }

            if (viewId === 'view-consultas-tarjetas') {
                cargarHistorialTarjetas();
            }
        }

        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            let entrada = document.getElementById("login-alias").value.trim().toLowerCase();
            const password = document.getElementById('login-password').value;
            const email = entrada.includes('@') ? entrada : `${entrada}@${DOMINIO_INSTITUCIONAL}`;
            try {
                localStorage.setItem('saamir_ultimo_correo', entrada);
                await signInWithEmailAndPassword(auth, email, password);
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Acceso Autorizado', showConfirmButton: false, timer: 2000 });
            } catch (error) {
                Swal.fire('Error', 'Credenciales incorrectas.', 'error');
            }
        });

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                document.getElementById('login-container').style.display = 'none';
                document.getElementById('app-container').style.display = 'flex';
                
                const userTitle = obtenerNombreCanonicoDeUsuario(user);
                document.getElementById('user-display-name').innerText = userTitle;
                document.getElementById('user-display-role').innerText = listaPersonalRoles[userTitle] || "Personal de Archivo";
                document.getElementById('inv-registra').value = userTitle;
                
                const campoPersonalTarjetas = document.getElementById('tar-personal');
                if (campoPersonalTarjetas) campoPersonalTarjetas.value = userTitle;

                const fechaRecTarjetas = document.getElementById('tar-fecha-recepcion');
                if (fechaRecTarjetas && !fechaRecTarjetas.value) fechaRecTarjetas.valueAsDate = new Date();

                const campoEntregado = document.getElementById('re-entregado');
                if (campoEntregado) campoEntregado.value = userTitle;

                const campoEntregadoTr = document.getElementById('tr-entregado');
                if (campoEntregadoTr) campoEntregadoTr.value = userTitle;

                document.getElementById('perf-email').value = user.email || '';
                document.getElementById('perf-nombre').value = userTitle;
                const formClave = document.getElementById('form-perfil-clave');
                if (formClave) formClave.reset();

                // Restringe el cambio de nombre para los usuarios cuyo alias de login
                // está mapeado a un nombre canónico (vigilantes VSOTANO/VSAENZPENA/
                // VPADILLA y personal de archivo IROCHA/JIZQUIERDO/RDAVILA/JDESPOSORIO/
                // MBARANDIARAN/ARODRIGUEZ/TGABINO/LEPIFANIA): el campo queda bloqueado.
                const campoPerfNombre = document.getElementById('perf-nombre');
                const btnPerfDatos = document.querySelector('#form-perfil-datos button[type="submit"]');
                if (campoPerfNombre) {
                    const nombreBloqueado = usuarioTieneNombreBloqueado(userTitle);
                    campoPerfNombre.disabled = nombreBloqueado;
                    campoPerfNombre.readOnly = nombreBloqueado;
                    if (btnPerfDatos) btnPerfDatos.disabled = nombreBloqueado;
                }

                cargarDataMaestra(userTitle);
                aplicarPermisos(userTitle);
                sincronizarUsuarioEnFirestore(user, userTitle);
                registrarInicioSesionEnCloud(user, userTitle);
                inicializarSelectsReingresos();
                inicializarSelectsTraslados(userTitle);
                resetFormularioReingreso();
                resetFormularioTraslado();
                
                await cargarInventariosDesdeCloud().catch(err => console.error(err));
                await cargarHistorialReingresosParaDashboard().catch(err => console.error(err));
                if (usuarioTienePermisoDeVerificacion(userTitle)) {
                    await window.cargarBandejaVerificacionReingresos().catch(err => console.error(err));
                }
                if (esUsuarioVigilanciaExclusiva(userTitle)) {
                    switchView('view-verificacion-reingresos', 'Verificación de Reingresos');
                } else {
                    const vistasPermitidasInicio = obtenerVistasPermitidas(userTitle);
                    if (vistasPermitidasInicio && !vistasPermitidasInicio.includes('view-dashboard')) {
                        const primeraVista = vistasPermitidasInicio[0];
                        switchView(primeraVista, TITULOS_VISTAS[primeraVista] || '');
                    }
                }
                await cargarHistorialTrasladosParaDashboard().catch(err => console.error(err));
                await cargarMicroformasDesdeCloud().catch(err => console.error(err));
                await cargarHistorialTarjetas().catch(err => console.error(err));
            } else {
                document.getElementById('app-container').style.display = 'none';
                document.getElementById('login-container').style.display = 'flex';
            }
        });

        document.getElementById('btn-logout').addEventListener('click', () => {
            signOut(auth);
            document.getElementById('login-password').value = '';
        });

        document.getElementById('form-perfil-datos').addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            const nuevoNombre = normalizarTexto(document.getElementById('perf-nombre').value);
            if (!user) return;

            const nombreActual = obtenerNombreCanonicoDeUsuario(user);
            if (usuarioTieneNombreBloqueado(nombreActual)) {
                Swal.fire('Acción no permitida', 'Este usuario no tiene permitido cambiar su nombre.', 'warning');
                return;
            }

            try {
                await updateProfile(user, { displayName: nuevoNombre });
                document.getElementById('user-display-name').innerText = nuevoNombre;
                document.getElementById('user-display-role').innerText = listaPersonalRoles[nuevoNombre] || "Personal de Archivo";
                document.getElementById('inv-registra').value = nuevoNombre;
                
                const campoPersonalTarjetas = document.getElementById('tar-personal');
                if (campoPersonalTarjetas) campoPersonalTarjetas.value = nuevoNombre;

                const campoEntregado = document.getElementById('re-entregado');
                if (campoEntregado) campoEntregado.value = nuevoNombre;

                const campoEntregadoTr = document.getElementById('tr-entregado');
                if (campoEntregadoTr) campoEntregadoTr.value = nuevoNombre;
                
                cargarDataMaestra(nuevoNombre);
                inicializarSelectsTraslados(nuevoNombre);
                aplicarPermisos(nuevoNombre);
                sincronizarUsuarioEnFirestore(user, nuevoNombre);
                Swal.fire('Éxito', 'Perfil actualizado de forma interna.', 'success');
            } catch (error) { Swal.fire('Error', error.message, 'error'); }
        });

        document.getElementById('form-perfil-clave').addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            const nuevaClave = document.getElementById('perf-new-password').value;
            const confirmaClave = document.getElementById('perf-confirm-password').value;
            if (!user) return;
            if (nuevaClave !== confirmaClave) { Swal.fire('Aviso', 'Las claves no coinciden.', 'warning'); return; }
            try {
                await updatePassword(user, nuevaClave);
                document.getElementById('form-perfil-clave').reset();
                Swal.fire('Éxito', 'Contraseña modificada de forma segura.', 'success');
            } catch (error) {
                if (error.code === 'auth/requires-recent-login') {
                    const { value: pass } = await Swal.fire({ title: 'Seguridad', text: 'Escriba su clave actual:', input: 'password', showCancelButton: true });
                    if (pass) {
                        try {
                            const cred = EmailAuthProvider.credential(user.email, pass);
                            await reauthenticateWithCredential(user, cred);
                            await updatePassword(user, nuevaClave);
                            document.getElementById('form-perfil-clave').reset();
                            Swal.fire('Éxito', 'Contraseña cambiada.', 'success');
                        } catch(err) { Swal.fire('Error', 'Clave incorrecta.', 'error'); }
                    }
                } else { Swal.fire('Error', error.message, 'error'); }
            }
        });

        function puedeEditarMicroformas(nombreUsuario) {
            const u = normalizarTexto(nombreUsuario);
            return PERMISOS.microformas_escritura.map(n => normalizarTexto(n)).includes(u);
        }

        const REGEX_RANGO_PAQUETE = /^\s*(\d+)-(\d+)\s*$/;
        let contadorFilaSubrango = 0;

        function crearFilaSubrangoHTML(desde = '', hasta = '') {
            const idx = contadorFilaSubrango++;
            return `
                <div class="row g-2 align-items-center mb-2 subrango-row" data-idx="${idx}">
                    <div class="col-5">
                        <input type="text" class="form-control form-control-sm subrango-desde" placeholder="Desde. Ej: 23-916" value="${desde}" oninput="window.recalcularTotalPaquetesMicroforma()">
                    </div>
                    <div class="col-5">
                        <input type="text" class="form-control form-control-sm subrango-hasta" placeholder="Hasta. Ej: 23-963" value="${hasta}" oninput="window.recalcularTotalPaquetesMicroforma()">
                    </div>
                    <div class="col-1 text-center">
                        <span class="badge bg-light text-dark border subrango-cant" title="Cantidad de este sub-rango">0</span>
                    </div>
                    <div class="col-1 text-center">
                        <button type="button" class="btn btn-outline-danger btn-sm py-0 px-1" title="Quitar sub-rango" onclick="window.eliminarSubrangoMicroforma(this)"><i class="bi bi-x-lg"></i></button>
                    </div>
                </div>`;
        }

        window.agregarSubrangoMicroforma = function(desde = '', hasta = '') {
            const cont = document.getElementById('mf-subrangos-container');
            if (!cont) return;
            cont.insertAdjacentHTML('beforeend', crearFilaSubrangoHTML(desde, hasta));
            window.recalcularTotalPaquetesMicroforma();
        };

        window.eliminarSubrangoMicroforma = function(btn) {
            const fila = btn.closest('.subrango-row');
            if (fila) fila.remove();
            const cont = document.getElementById('mf-subrangos-container');
            if (cont && cont.children.length === 0) {
                window.agregarSubrangoMicroforma();
            }
            window.recalcularTotalPaquetesMicroforma();
        };

        function leerSubrangosMicroforma() {
            const filas = document.querySelectorAll('#mf-subrangos-container .subrango-row');
            const subrangos = [];
            let total = 0;
            let huboFilasInvalidas = false;

            filas.forEach(fila => {
                const desdeInput = fila.querySelector('.subrango-desde');
                const hastaInput = fila.querySelector('.subrango-hasta');
                const badgeCant = fila.querySelector('.subrango-cant');
                const desde = desdeInput.value.trim();
                const hasta = hastaInput.value.trim();

                if (!desde && !hasta) {
                    if (badgeCant) badgeCant.textContent = '0';
                    return;
                }

                const matchDesde = desde.match(REGEX_RANGO_PAQUETE);
                const matchHasta = hasta.match(REGEX_RANGO_PAQUETE);

                if (matchDesde && matchHasta) {
                    const numDesde = parseInt(matchDesde[2], 10);
                    const numHasta = parseInt(matchHasta[2], 10);

                    if (!isNaN(numDesde) && !isNaN(numHasta) && numHasta >= numDesde) {
                        const cant = (numHasta - numDesde) + 1;
                        if (badgeCant) badgeCant.textContent = cant;
                        subrangos.push({ desde, hasta, cantidad: cant });
                        total += cant;
                        return;
                    }
                }

                if (badgeCant) badgeCant.textContent = '?';
                huboFilasInvalidas = true;
            });

            return { subrangos, total, huboFilasInvalidas };
        }

        window.recalcularTotalPaquetesMicroforma = function() {
            const { total } = leerSubrangosMicroforma();
            const inputCant = document.getElementById('mf-cant-paquetes');
            const display = document.getElementById('mf-cant-paquetes-display');
            if (inputCant) inputCant.value = total;
            if (display) display.textContent = total;
        };

        window.calcularCantidadPaquetesMicroforma = function() {
            window.recalcularTotalPaquetesMicroforma();
        };

        function construirTextoRango(subrangos) {
            return subrangos.map((s, i) => {
                const tramo = `${s.desde} al ${s.hasta}`;
                return i === 0 ? tramo : `y del ${tramo}`;
            }).join(' ');
        }

        window.abrirModalMicroforma = function(id = null) {
            idMicroformaEnEdicion = id;
            document.getElementById('form-modal-microforma').reset();
            document.getElementById('mf-cant-paquetes').value = '';
            document.getElementById('mf-cant-paquetes-display').textContent = '0';

            const cont = document.getElementById('mf-subrangos-container');
            if (cont) cont.innerHTML = '';

            if (id !== null) {
                const item = baseDatosMicroformas.find(m => m.id === id);
                if (item) {
                    document.getElementById('mf-bloque').value = item.bloque || '';

                    if (Array.isArray(item.subrangos) && item.subrangos.length > 0) {
                        item.subrangos.forEach(s => window.agregarSubrangoMicroforma(s.desde || '', s.hasta || ''));
                    } else if (item.paqueteDesde && item.paqueteHasta) {
                        window.agregarSubrangoMicroforma(item.paqueteDesde, item.paqueteHasta);
                    } else if (item.rango && item.rango.includes(' al ')) {
                        const partes = item.rango.split(' al ');
                        window.agregarSubrangoMicroforma(partes[0].trim(), partes[1].trim());
                    } else {
                        window.agregarSubrangoMicroforma();
                    }

                    window.recalcularTotalPaquetesMicroforma();
                    document.getElementById('mf-juzgado').value = item.juzgado || '';
                    document.getElementById('mf-folios').value = item.folios || '';
                    document.getElementById('mf-imagenes').value = item.imagenes || '';
                    document.getElementById('mf-registros').value = item.registros || '';
                    document.getElementById('mf-expedientes').value = item.expedientes || '';
                    document.getElementById('mf-mes').value = item.mes || '';
                    document.getElementById('mf-fec-inicio').value = item.fecInicio || '';
                    document.getElementById('mf-fec-fin').value = item.fecFin || '';
                    document.getElementById('mf-fec-grabacion').value = item.fecGrabacion || '';
                    document.getElementById('modal-microforma-titulo').innerHTML = '<i class="bi bi-pencil-square me-2"></i>Editar Bloque de Microformas';
                    document.getElementById('btn-guardar-microforma').innerText = 'Guardar Cambios';
                }
            } else {
                window.agregarSubrangoMicroforma();
                document.getElementById('modal-microforma-titulo').innerHTML = '<i class="bi bi-file-earmark-plus me-2"></i>Registrar Bloque de Microformas';
                document.getElementById('btn-guardar-microforma').innerText = 'Guardar Bloque';
            }

            modalMicroformaInstance = new bootstrap.Modal(document.getElementById('modalMicroforma'));
            modalMicroformaInstance.show();
        };

        window.cerrarModalMicroforma = function() {
            idMicroformaEnEdicion = null;
            if (modalMicroformaInstance) modalMicroformaInstance.hide();
        };

        window.guardarMicroforma = async function() {
            const currentUserObj = auth.currentUser;
            const currentUserName = obtenerNombreCanonicoDeUsuario(currentUserObj);

            if (!puedeEditarMicroformas(currentUserName)) {
                Swal.fire('Acceso denegado', 'No cuenta con autorización para registrar o modificar bloques de microformas.', 'error');
                return;
            }

            const bloqueNum = parseInt(document.getElementById('mf-bloque').value, 10);
            const { subrangos, total, huboFilasInvalidas } = leerSubrangosMicroforma();

            if (huboFilasInvalidas) {
                Swal.fire('Rango inválido', 'Uno o más sub-rangos tienen formato incorrecto.', 'warning');
                return;
            }

            if (!bloqueNum || subrangos.length === 0) {
                Swal.fire('Campos incompletos', 'Por favor complete el N° de Bloque y al menos un sub-rango de paquetes válido.', 'warning');
                return;
            }

            const rangoCompleto = construirTextoRango(subrangos);

            const bloqueData = {
                bloque: bloqueNum,
                subrangos: subrangos,
                paqueteDesde: subrangos[0].desde,
                paqueteHasta: subrangos[0].hasta,
                rango: rangoCompleto,
                cantPaquetes: total,
                juzgado: document.getElementById('mf-juzgado').value.trim().toUpperCase(),
                folios: parseInt(document.getElementById('mf-folios').value, 10) || 0,
                imagenes: parseInt(document.getElementById('mf-imagenes').value, 10) || 0,
                registros: parseInt(document.getElementById('mf-registros').value, 10) || 0,
                expedientes: parseInt(document.getElementById('mf-expedientes').value, 10) || 0,
                mes: document.getElementById('mf-mes').value.trim().toUpperCase(),
                fecInicio: document.getElementById('mf-fec-inicio').value,
                fecFin: document.getElementById('mf-fec-fin').value,
                fecGrabacion: document.getElementById('mf-fec-grabacion').value,
                timestamp: Date.now()
            };

            try {
                if (idMicroformaEnEdicion) {
                    bloqueData.auditoriaEdicion = { nombre: currentUserName, timestamp: Date.now() };
                    await updateDoc(doc(db, "control_microformas", idMicroformaEnEdicion), bloqueData);
                    Swal.fire({ icon: 'success', title: 'Bloque Actualizado', text: 'Los cambios se guardaron correctamente.' });
                } else {
                    bloqueData.activo = true;
                    bloqueData.auditoriaCreacion = { nombre: currentUserName, timestamp: Date.now() };
                    await addDoc(collection(db, "control_microformas"), bloqueData);
                    Swal.fire({ icon: 'success', title: 'Bloque Registrado', text: 'El bloque de microformas se añadió con éxito.' });
                }

                cerrarModalMicroforma();
                await cargarMicroformasDesdeCloud();
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };

        async function cargarMicroformasDesdeCloud() {
            try {
                const querySnapshot = await getDocs(collection(db, "control_microformas"));
                baseDatosMicroformas = [];
                querySnapshot.forEach((docSnap) => {
                    const data = { id: docSnap.id, ...docSnap.data() };
                    if (data.activo !== false) baseDatosMicroformas.push(data);
                });

                baseDatosMicroformas.sort((a, b) => (a.bloque || 0) - (b.bloque || 0));
                renderTablaMicroformas();
                actualizarDashboardGlobal();
            } catch (e) {
                console.error("Error al cargar microformas:", e);
            }
        }

        function renderTablaMicroformas() {
            const tbody = document.getElementById('tabla-microformas-body');
            const tfoot = document.getElementById('tabla-microformas-foot');
            if (!tbody || !tfoot) return;

            tbody.innerHTML = '';
            if (baseDatosMicroformas.length === 0) {
                tbody.innerHTML = `<tr><td colspan="13" class="text-center text-muted py-4">No hay bloques registrados en el sistema.</td></tr>`;
                tfoot.innerHTML = '';
                document.getElementById('info-paginacion-microformas').innerText = 'Página 1 de 1';
                return;
            }

            // Paginación (10 registros por página)
            const totalPaginas = Math.ceil(baseDatosMicroformas.length / registrosPorPagina) || 1;
            if (paginaActualMicroformas > totalPaginas) paginaActualMicroformas = totalPaginas;
            if (paginaActualMicroformas < 1) paginaActualMicroformas = 1;

            const inicio = (paginaActualMicroformas - 1) * registrosPorPagina;
            const fin = inicio + registrosPorPagina;
            const registrosPaginados = baseDatosMicroformas.slice(inicio, fin);

            document.getElementById('info-paginacion-microformas').innerText = `Página ${paginaActualMicroformas} de ${totalPaginas} (Total: ${baseDatosMicroformas.length} registros)`;
            document.getElementById('btn-micro-prev').disabled = paginaActualMicroformas <= 1;
            document.getElementById('btn-micro-next').disabled = paginaActualMicroformas >= totalPaginas;

            let sumaPaquetes = 0;
            let sumaFolios = 0;
            let sumaImagenes = 0;
            let sumaRegistros = 0;
            let sumaExpedientes = 0;

            const currentUserObj = auth.currentUser;
            const currentUserName = obtenerNombreCanonicoDeUsuario(currentUserObj);
            const esEditor = puedeEditarMicroformas(currentUserName);

            registrosPaginados.forEach(item => {
                const folios = item.folios || 0;
                const imagenes = item.imagenes || 0;
                const registros = item.registros || 0;
                const expedientes = item.expedientes || 0;
                const cantPaquetes = item.cantPaquetes || 0;

                const fInicio = item.fecInicio ? item.fecInicio.split('-').reverse().join('/') : '';
                const fFin = item.fecFin ? item.fecFin.split('-').reverse().join('/') : '';
                const fGrab = item.fecGrabacion ? item.fecGrabacion.split('-').reverse().join('/') : '';
                const textoRango = item.rango || (item.paqueteDesde && item.paqueteHasta ? `${item.paqueteDesde} al ${item.paqueteHasta}` : 'N/A');

                const tr = `<tr>
                    <td class="fw-bold">${item.bloque ?? 'N/A'}</td>
                    <td class="text-start ps-2"><code>${textoRango}</code></td>
                    <td class="fw-bold">${cantPaquetes}</td>
                    <td class="text-start ps-2">${item.juzgado || 'N/A'}</td>
                    <td>${folios.toLocaleString()}</td>
                    <td class="fw-bold">${imagenes.toLocaleString()}</td>
                    <td>${registros.toLocaleString()}</td>
                    <td class="fw-bold">${expedientes.toLocaleString()}</td>
                    <td>${item.mes || 'N/A'}</td>
                    <td>${fInicio}</td>
                    <td>${fFin}</td>
                    <td>${fGrab}</td>
                    <td class="col-acciones no-print">
                        ${esEditor ? `
                            <button class="btn btn-xs btn-outline-primary py-0 px-1 me-1" onclick="window.abrirModalMicroforma('${item.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-xs btn-outline-danger py-0 px-1" onclick="window.eliminarMicroforma('${item.id}')" title="Eliminar"><i class="bi bi-trash"></i></button>
                        ` : `<span class="text-muted small">Sólo lectura</span>`}
                    </td>
                </tr>`;
                tbody.insertAdjacentHTML('beforeend', tr);
            });

            // Totales generales calculados sobre toda la base de datos
            baseDatosMicroformas.forEach(item => {
                sumaPaquetes += item.cantPaquetes || 0;
                sumaFolios += item.folios || 0;
                sumaImagenes += item.imagenes || 0;
                sumaRegistros += item.registros || 0;
                sumaExpedientes += item.expedientes || 0;
            });

            const totalBloques = baseDatosMicroformas.length;
            const promPaquetes = totalBloques > 0 ? (sumaPaquetes / totalBloques).toFixed(0) : 0;
            const promFolios = totalBloques > 0 ? Math.round(sumaFolios / totalBloques) : 0;
            const promImagenes = totalBloques > 0 ? Math.round(sumaImagenes / totalBloques) : 0;
            const promRegistros = totalBloques > 0 ? Math.round(sumaRegistros / totalBloques) : 0;
            const promExpedientes = totalBloques > 0 ? Math.round(sumaExpedientes / totalBloques) : 0;

            tfoot.innerHTML = `
                <tr class="table-warning">
                    <td colspan="2" class="text-end pe-3">TOTALES (GENERAL)</td>
                    <td>${sumaPaquetes}</td>
                    <td>-</td>
                    <td>${sumaFolios.toLocaleString()}</td>
                    <td>${sumaImagenes.toLocaleString()}</td>
                    <td>${sumaRegistros.toLocaleString()}</td>
                    <td>${sumaExpedientes.toLocaleString()}</td>
                    <td colspan="5"></td>
                </tr>
                <tr class="table-info">
                    <td colspan="2" class="text-end pe-3">PROMEDIO</td>
                    <td>${promPaquetes}</td>
                    <td>-</td>
                    <td>${promFolios.toLocaleString()}</td>
                    <td>${promImagenes.toLocaleString()}</td>
                    <td>${promRegistros.toLocaleString()}</td>
                    <td>${promExpedientes.toLocaleString()}</td>
                    <td colspan="5"></td>
                </tr>
            `;
        }

        window.cambiarPaginaMicroformas = function(direccion) {
            paginaActualMicroformas += direccion;
            renderTablaMicroformas();
        };

        window.eliminarMicroforma = async function(id) {
            const currentUserObj = auth.currentUser;
            const currentUserName = obtenerNombreCanonicoDeUsuario(currentUserObj);

            if (!puedeEditarMicroformas(currentUserName)) {
                Swal.fire('Acceso denegado', 'No cuenta con autorización para eliminar bloques de microformas.', 'error');
                return;
            }

            const confirmacion = await Swal.fire({
                icon: 'warning',
                title: '¿Eliminar bloque?',
                text: 'El bloque de microformas quedará inactivo.',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                confirmButtonColor: '#800000'
            });

            if (!confirmacion.isConfirmed) return;

            try {
                await updateDoc(doc(db, "control_microformas", id), { 
                    activo: false,
                    auditoriaEliminacion: { nombre: currentUserName, timestamp: Date.now() }
                });
                Swal.fire({ icon: 'success', title: 'Bloque eliminado', timer: 1500, showConfirmButton: false });
                await cargarMicroformasDesdeCloud();
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };

        let indiceEdicionRango = null;

        function abrirModalRango(index = null) {
            indiceEdicionRango = (index !== null && index !== undefined) ? index : null;
            document.getElementById('form-modal-rango').reset();
            document.getElementById('form-mod-add-faltante').reset();

            if (indiceEdicionRango !== null && listaRangosCenso[indiceEdicionRango]) {
                const r = listaRangosCenso[indiceEdicionRango];
                document.getElementById('mod-inicial').value = r.inicial;
                document.getElementById('mod-final').value = r.final;
                document.getElementById('mod-archivamiento').value = r.archivamiento;
                listaFaltantesModal = [...(r.detalleFaltantes || [])];
                document.getElementById('modal-rango-titulo').innerHTML = '<i class="bi bi-pencil-square me-2"></i>Editar Rango de Expedientes';
                document.getElementById('btn-guardar-rango-modal').innerText = 'Guardar Cambios';
            } else {
                listaFaltantesModal = [];
                document.getElementById('modal-rango-titulo').innerHTML = '<i class="bi bi-folder-plus me-2"></i>Configurar Rango de Expedientes';
                document.getElementById('btn-guardar-rango-modal').innerText = 'Agregar a Inventario';
            }

            renderTablaFaltantesModal();
            modalInstance = new bootstrap.Modal(document.getElementById('modalAgregarRango'));
            modalInstance.show();
        }

        function cerrarModalRango() {
            indiceEdicionRango = null;
            if(modalInstance) modalInstance.hide();
        }

        function extraerNumero(cadena) {
            if (!cadena) return 0;
            const match = cadena.match(/(\d+)(?!.*\d)/);
            return match ? parseInt(match[0], 10) : 0;
        }

        function extraerPrefijo(cadena) {
            if (!cadena) return '';
            const match = cadena.match(/(\d+)(?!.*\d)/);
            if (!match) return cadena.trim().toUpperCase();
            return cadena.slice(0, match.index).trim().toUpperCase();
        }

        document.getElementById('form-mod-add-faltante').addEventListener('submit', function(e) {
            e.preventDefault();
            const desdeStr = document.getElementById('mod-falt-desde').value.trim();
            let hastaStr = document.getElementById('mod-falt-hasta').value.trim();
            let cant = 1;

            if(!desdeStr) return;

            const rangoInicial = document.getElementById('mod-inicial').value.trim();
            const rangoFinal = document.getElementById('mod-final').value.trim();

            if (!rangoInicial || !rangoFinal) {
                Swal.fire('Atención', 'Primero complete el Número Inicial y Final del rango antes de registrar faltantes.', 'warning');
                return;
            }

            const prefijoRango = extraerPrefijo(rangoInicial);
            const prefijoDesde = extraerPrefijo(desdeStr);
            if (prefijoDesde !== prefijoRango) {
                Swal.fire('Código no coincide', `El expediente "${desdeStr}" no pertenece al código del rango.`, 'error');
                return;
            }

            const nRangoIni = extraerNumero(rangoInicial);
            const nRangoFin = extraerNumero(rangoFinal);
            const nDesde = extraerNumero(desdeStr);
            if (nDesde < nRangoIni || nDesde > nRangoFin) {
                Swal.fire('Fuera de rango', `El expediente "${desdeStr}" está fuera de los límites del rango.`, 'error');
                return;
            }

            if (!hastaStr || hastaStr === desdeStr) {
                hastaStr = "Único";
                cant = 1;
            } else {
                const prefijoHasta = extraerPrefijo(hastaStr);
                if (prefijoHasta !== prefijoRango) {
                    Swal.fire('Código no coincide', `El expediente "${hastaStr}" no pertenece al código del rango.`, 'error');
                    return;
                }
                const nD = nDesde;
                const nH = extraerNumero(hastaStr);
                if (nH < nRangoIni || nH > nRangoFin) {
                    Swal.fire('Fuera de rango', `El expediente "${hastaStr}" está fuera de los límites.`, 'error');
                    return;
                }
                if(nH < nD) { Swal.fire('Error', 'Rango de faltante al revés.', 'error'); return; }
                cant = (nH - nD) + 1;
            }

            listaFaltantesModal.push({ desde: desdeStr, hasta: hastaStr, cantidad: cant });
            document.getElementById('form-mod-add-faltante').reset();
            renderTablaFaltantesModal();
        });

        function renderTablaFaltantesModal() {
            const tbody = document.getElementById('mod-tabla-faltantes-body');
            tbody.innerHTML = '';
            if(listaFaltantesModal.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No se registran faltantes en este tramo.</td></tr>`;
                return;
            }
            listaFaltantesModal.forEach((f, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${f.desde}</td><td><span class="badge bg-secondary">${f.hasta}</span></td><td class="text-center fw-bold text-danger">${f.cantidad}</td><td class="text-end"><button type="button" class="btn btn-xs btn-outline-danger py-0 px-1" onclick="window.eliminarFaltanteInterno(${idx})"><i class="bi bi-x"></i></button></td>`;
                tbody.appendChild(tr);
            });
        }

        window.eliminarFaltanteInterno = function(index) {
            listaFaltantesModal.splice(index, 1);
            renderTablaFaltantesModal();
        };

        window.inyectarRangoAGrilla = function() {
            const ini = document.getElementById('mod-inicial').value.trim();
            const fin = document.getElementById('mod-final').value.trim();
            const arch = document.getElementById('mod-archivamiento').value;

            if(!ini || !fin) { Swal.fire('Atención', 'Defina los números del rango principal.', 'warning'); return; }

            const prefijoIni = extraerPrefijo(ini);
            const prefijoFin = extraerPrefijo(fin);
            if (prefijoIni !== prefijoFin) {
                Swal.fire('Formato inconsistente', `El Rango Inicial ("${ini}") y el Rango Final ("${fin}") no comparten el mismo código.`, 'error');
                return;
            }

            const nIni = extraerNumero(ini);
            const nFin = extraerNumero(fin);
            if(nFin < nIni) { Swal.fire('Error', 'Rango inválido.', 'error'); return; }

            const totalTeorico = (nFin - nIni) + 1;
            const totalFaltantes = listaFaltantesModal.reduce((sum, f) => sum + f.cantidad, 0);
            const totalReal = Math.max(0, totalTeorico - totalFaltantes);

            const rangoData = {
                inicial: ini,
                final: fin,
                archivamiento: arch,
                teorico: totalTeorico,
                faltantes: totalFaltantes,
                real: totalReal,
                detalleFaltantes: [...listaFaltantesModal]
            };

            if (indiceEdicionRango !== null && listaRangosCenso[indiceEdicionRango]) {
                listaRangosCenso[indiceEdicionRango] = rangoData;
            } else {
                listaRangosCenso.push(rangoData);
            }
            indiceEdicionRango = null;

            cerrarModalRango();
            renderGrillaGrandeCenso();
            calcularConsolidadoGlobal();
        };

        function renderGrillaGrandeCenso() {
            const body = document.getElementById('tabla-censo-rangos-body');
            body.innerHTML = '';
            if(listaRangosCenso.length === 0) {
                body.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Ningún rango cargado al lote. Use el botón superior.</td></tr>`;
                return;
            }
            listaRangosCenso.forEach((r, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><code>${r.inicial}</code></td>
                    <td><code>${r.final}</code></td>
                    <td><span class="badge ${r.archivamiento==='Definitivo'?'bg-danger':'bg-warning text-dark'}">${r.archivamiento}</span></td>
                    <td class="text-center bg-light">${r.teorico}</td>
                    <td class="text-center text-danger fw-bold">${r.faltantes}</td>
                    <td class="text-center table-success fw-bold text-success">${r.real}</td>
                    <td class="text-end">
                        <button type="button" class="btn btn-sm btn-outline-primary py-0 px-1.5 me-1" onclick="window.editarRangoDeGrilla(${idx})"><i class="bi bi-pencil"></i></button>
                        <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-1.5" onclick="window.quitarRangoDeGrilla(${idx})"><i class="bi bi-trash3"></i></button>
                    </td>
                `;
                body.appendChild(tr);
            });
        }

        window.quitarRangoDeGrilla = function(index) {
            listaRangosCenso.splice(index, 1);
            renderGrillaGrandeCenso();
            calcularConsolidadoGlobal();
        };

        window.editarRangoDeGrilla = function(index) {
            abrirModalRango(index);
        };

        function calcularConsolidadoGlobal() {
            let sumT = 0, sumF = 0, sumR = 0;
            listaRangosCenso.forEach(r => { sumT += r.teorico; sumF += r.faltantes; sumR += r.real; });
            document.getElementById('calc-total-teorico').innerText = sumT;
            document.getElementById('calc-total-faltantes').innerText = sumF;
            document.getElementById('calc-total-real').innerText = sumR;
        }

        let idLoteEnEdicion = null;

        document.getElementById('form-inventario').addEventListener('submit', async (e) => {
            e.preventDefault();
            if(listaRangosCenso.length === 0) {
                Swal.fire('Atención', 'Debe inyectar al menos un rango para guardar el consolidado.', 'warning');
                return;
            }

            const currentUserObj = auth.currentUser;
            const currentUserName = obtenerNombreCanonicoDeUsuario(currentUserObj);

            const consolidadoLote = {
                repositorio: document.getElementById('inv-repositorio').value,
                fecha: document.getElementById('inv-fecha').value,
                registra: document.getElementById('inv-registra').value, 
                recibe: document.getElementById('inv-recibe').value,
                observaciones: document.getElementById('inv-observaciones').value.trim() || 'Ninguna.',
                totalTeorico: parseInt(document.getElementById('calc-total-teorico').innerText, 10),
                totalFaltantes: parseInt(document.getElementById('calc-total-faltantes').innerText, 10),
                totalReal: parseInt(document.getElementById('calc-total-real').innerText, 10),
                matrizRangos: [...listaRangosCenso]
            };

            const esEdicion = !!idLoteEnEdicion;

            try {
                if (esEdicion) {
                    consolidadoLote.auditoriaEdicion = {
                        uid: currentUserObj?.uid || null,
                        nombre: currentUserName,
                        timestamp: Date.now()
                    };
                    await updateDoc(doc(db, "censo_institucional", idLoteEnEdicion), consolidadoLote);
                } else {
                    consolidadoLote.createdAt = Date.now();
                    consolidadoLote.activo = true;
                    consolidadoLote.auditoria = {
                        uid: currentUserObj?.uid || null,
                        nombre: currentUserName,
                        timestamp: Date.now()
                    };
                    await addDoc(collection(db, "censo_institucional"), consolidadoLote);
                }

                idLoteEnEdicion = null;
                document.getElementById('form-inventario').reset();
                document.getElementById('inv-fecha').valueAsDate = new Date();
                
                document.getElementById('inv-registra').value = currentUserName;
                document.getElementById('btn-guardar-inventario').innerText = 'Cerrar y Guardar Consolidado';

                listaRangosCenso = [];
                renderGrillaGrandeCenso();
                calcularConsolidadoGlobal();

                await cargarInventariosDesdeCloud();
                Swal.fire({ icon: 'success', title: esEdicion ? 'Inventario Actualizado' : 'Inventario Guardado', text:'Los registros se acoplaron de forma segura.' });
            } catch (error) { Swal.fire('Error', error.message, 'error'); }
        });

        async function cargarInventariosDesdeCloud() {
            try {
                const querySnapshot = await getDocs(collection(db, "censo_institucional"));
                baseDatosInventario = [];
                querySnapshot.forEach((doc) => {
                    const data = { id: doc.id, ...doc.data() };
                    if (data.activo !== false) baseDatosInventario.push(data);
                });

                baseDatosInventario.sort((a, b) => {
                    const ta = (a.createdAt && a.createdAt.toMillis) ? a.createdAt.toMillis() : (a.createdAt || a.auditoria?.timestamp || 0);
                    const tb = (b.createdAt && b.createdAt.toMillis) ? b.createdAt.toMillis() : (b.createdAt || b.auditoria?.timestamp || 0);
                    return tb - ta;
                });

                actualizarDashboardGlobal();
                filtrarRegistros();
            } catch (error) { console.error(error); }
        }

        async function cargarHistorialReingresosParaDashboard() {
            try {
                const querySnapshot = await getDocs(collection(db, "reingresos"));
                baseDatosReingresos = [];
                querySnapshot.forEach((doc) => {
                    const data = { id: doc.id, ...doc.data() };
                    if (data.activo !== false) baseDatosReingresos.push(data);
                });
                baseDatosReingresos.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                actualizarDashboardGlobal();
            } catch (error) {
                console.error(error);
            }
        }

        async function cargarHistorialTrasladosParaDashboard() {
            try {
                const querySnapshot = await getDocs(collection(db, "traslados"));
                baseDatosTraslados = [];
                querySnapshot.forEach((doc) => {
                    const data = { id: doc.id, ...doc.data() };
                    if (data.activo !== false) baseDatosTraslados.push(data);
                });
                baseDatosTraslados.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            } catch (error) {
                console.error(error);
            }
        }

        function actualizarDashboardGlobal() {
            let sT = 0, sF = 0, sR = 0;
            baseDatosInventario.forEach(lote => { 
                sT += Number(lote.totalTeorico) || 0; 
                sF += Number(lote.totalFaltantes) || 0; 
                sR += Number(lote.totalReal) || 0; 
            });

            document.getElementById('dash-total-teorico').innerText = sT;
            document.getElementById('dash-total-faltantes').innerText = sF;
            document.getElementById('dash-total-real').innerText = sR;

            const porcentajeIntegridad = sT > 0 ? ((sR / sT) * 100).toFixed(2) : "100.00";
            document.getElementById('dash-porcentaje').innerText = porcentajeIntegridad + "%";
            const elPorcentaje = document.getElementById('dash-porcentaje');
            elPorcentaje.style.color = porcentajeIntegridad < 90 ? 'var(--sipa-primary)' : 'inherit';

            let sumBloques = baseDatosMicroformas.length;
            let sumPaquetes = 0;
            let sumExpedientes = 0;
            let sumImágenes = 0;
            let sumFolios = 0;

            baseDatosMicroformas.forEach(m => {
                sumPaquetes += Number(m.cantPaquetes) || 0;
                sumExpedientes += Number(m.expedientes) || 0;
                sumImágenes += Number(m.imagenes) || 0;
                sumFolios += Number(m.folios) || 0;
            });

            document.getElementById('dash-micro-bloques').innerText = sumBloques.toLocaleString();
            document.getElementById('dash-micro-paquetes').innerText = sumPaquetes.toLocaleString();
            document.getElementById('dash-micro-expedientes').innerText = sumExpedientes.toLocaleString();
            document.getElementById('dash-micro-imagenes').innerText = sumImágenes.toLocaleString();
            document.getElementById('dash-micro-folios').innerText = sumFolios.toLocaleString();

            const hoyStr = new Date().toISOString().split('T')[0];
            const mesActualStr = hoyStr.substring(0, 7);

            let reingresosMesCount = 0;
            let reingresosHoyCount = 0;
            let totalAcompanadosCount = 0;

            baseDatosReingresos.forEach(reg => {
                const fechaReg = reg.fecha || '';
                if (fechaReg.startsWith(mesActualStr)) reingresosMesCount++;
                if (fechaReg === hoyStr) reingresosHoyCount++;
                if (reg.expedientes && Array.isArray(reg.expedientes)) {
                    reg.expedientes.forEach(e => {
                        totalAcompanadosCount += parseInt(e.acomp, 10) || 0;
                    });
                }
            });

            document.getElementById('dash-reingresos-mes').innerText = reingresosMesCount;
            document.getElementById('dash-reingresos-hoy').innerText = reingresosHoyCount;
            document.getElementById('dash-total-acompanados').innerText = totalAcompanadosCount;
        }

        function renderizarFiltrosConsultas(datos) {
            const body = document.getElementById('tabla-consultas-body');
            document.getElementById('contador-registros').innerText = `${datos.length} Lote(s) Registrado(s)`;
            body.innerHTML = '';
            if(datos.length === 0) {
                body.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No se acoplan lotes.</td></tr>`;
                return;
            }
            datos.forEach(l => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${l.fecha || 'N/A'}</td><td class="fw-semibold text-primary">${l.repositorio || 'N/A'}</td><td class="text-center fw-bold">${(l.matrizRangos || []).length}</td><td class="text-center">${l.totalTeorico ?? 0}</td><td class="text-center text-danger fw-bold">${l.totalFaltantes ?? 0}</td><td class="text-center table-success fw-bold text-success">${l.totalReal ?? 0}</td><td class="small">${l.registra || 'N/A'}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-danger py-1 px-2 me-1" onclick="window.generarPDFInstitucional('${l.id}')"><i class="bi bi-file-pdf"></i> PDF</button>
                        <button class="btn btn-sm btn-outline-primary py-1 px-2 me-1" onclick="window.editarLoteInventario('${l.id}')"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-secondary py-1 px-2" onclick="window.eliminarRegistroLocal('${l.id}')"><i class="bi bi-trash3"></i></button>
                    </td>
                `;
                body.appendChild(tr);
            });
        }

        function filtrarRegistros() {
            const fRepo = document.getElementById('filtro-repo').value;
            const fTexto = document.getElementById('filtro-texto').value.toLowerCase().trim();
            const res = baseDatosInventario.filter(l => {
                const mR = fRepo === "" || l.repositorio === fRepo;
                const mT = fTexto === "" ||
                    (l.registra || "").toLowerCase().includes(fTexto) ||
                    (l.repositorio || "").toLowerCase().includes(fTexto) ||
                    (l.fecha || "").includes(fTexto);
                return mR && mT;
            });
            renderizarFiltrosConsultas(res);
        }

        window.eliminarRegistroLocal = function(id) {
            Swal.fire({
                title: '¿Expulsar Lote del Inventario?', text: "El lote quedará marcado como inactivo.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#800000', confirmButtonText: 'Sí, borrar'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const currentUserObj = auth.currentUser;
                    const currentUserName = obtenerNombreCanonicoDeUsuario(currentUserObj);

                    await updateDoc(doc(db, "censo_institucional", id), {
                        activo: false,
                        auditoriaEliminacion: {
                            uid: currentUserObj?.uid || null,
                            nombre: currentUserName,
                            timestamp: Date.now()
                        }
                    });
                    await cargarInventariosDesdeCloud();
                }
            });
        };

        window.editarLoteInventario = function(id) {
            const lote = baseDatosInventario.find(l => l.id === id);
            if (!lote) return;

            idLoteEnEdicion = id;
            document.getElementById('inv-repositorio').value = lote.repositorio || '';
            document.getElementById('inv-fecha').value = lote.fecha || '';
            document.getElementById('inv-registra').value = lote.registra || '';
            document.getElementById('inv-recibe').value = lote.recibe || '';
            document.getElementById('inv-observaciones').value = (lote.observaciones && lote.observaciones !== 'Ninguna.') ? lote.observaciones : '';

            listaRangosCenso = JSON.parse(JSON.stringify(lote.matrizRangos || []));
            renderGrillaGrandeCenso();
            calcularConsolidadoGlobal();

            document.getElementById('btn-guardar-inventario').innerText = 'Guardar Cambios del Lote';
            switchView('view-inventario', `Editando Lote: ${lote.repositorio || ''} (${lote.fecha || ''})`);
        };

        window.iniciarNuevoInventario = function() {
            idLoteEnEdicion = null;
            document.getElementById('form-inventario').reset();
            document.getElementById('inv-fecha').valueAsDate = new Date();
            if (auth.currentUser) {
                document.getElementById('inv-registra').value = auth.currentUser.displayName ? normalizarTexto(auth.currentUser.displayName) : normalizarTexto(auth.currentUser.email.split('@')[0]);
            }
            document.getElementById('btn-guardar-inventario').innerText = 'Cerrar y Guardar Consolidado';
            listaRangosCenso = [];
            renderGrillaGrandeCenso();
            calcularConsolidadoGlobal();
            switchView('view-inventario', 'Carga de Inventario de Existencias');
        };

        window.cargarHistorialAuditoriaGlobal = async function() {
            try {
                const tbody = document.getElementById('tabla-auditoria-global');
                if (!tbody) return;
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Cargando registros de auditoría...</td></tr>`;

                listaLogsAuditoria = [];
                const selectUsuario = document.getElementById('filtro-aud-usuario');
                const usuarioSeleccionadoPrevio = selectUsuario ? selectUsuario.value : '';
                if(selectUsuario) selectUsuario.innerHTML = '<option value="">Todos los usuarios</option>';
                const setUsuariosUnicos = new Set();

                try {
                    const snapLogins = await getDocs(collection(db, "auditoria_logins"));
                    snapLogins.forEach(docSnap => {
                        const d = docSnap.data();
                        const timestamp = d.timestamp || 0;
                        const nombreUser = d.nombre || d.email || 'Desconocido';
                        setUsuariosUnicos.add(nombreUser);
                        listaLogsAuditoria.push({
                            fechaISO: timestamp ? new Date(timestamp).toISOString().split('T')[0] : '',
                            fecha: timestamp ? new Date(timestamp).toLocaleString() : 'N/A',
                            timestamp: timestamp,
                            modulo: 'Seguridad / Sesiones',
                            accion: 'Inicio de Sesión',
                            usuario: nombreUser,
                            detalle: `Acceso autorizado al sistema desde el correo: ${d.email || 'N/A'}`
                        });
                    });
                } catch(err) { console.warn(err); }

                try {
                    const snapCenso = await getDocs(collection(db, "censo_institucional"));
                    snapCenso.forEach(docSnap => {
                        const d = docSnap.data();
                        const timestampCreacion = d.auditoria?.timestamp || d.createdAt || 0;
                        const userCreacion = d.auditoria?.nombre || d.registra || 'Desconocido';
                        setUsuariosUnicos.add(userCreacion);
                        
                        listaLogsAuditoria.push({
                            fechaISO: timestampCreacion ? new Date(timestampCreacion).toISOString().split('T')[0] : '',
                            fecha: timestampCreacion ? new Date(timestampCreacion).toLocaleString() : 'N/A',
                            timestamp: timestampCreacion,
                            modulo: 'Inventario de Existencias',
                            accion: d.createdAt ? 'Creación de Lote' : 'Actualización de Lote',
                            usuario: userCreacion,
                            detalle: `Repositorio: ${d.repositorio} | Fecha ejecución: ${d.fecha} | Total Real: ${d.totalReal}`
                        });
                    });
                } catch(err) { console.warn(err); }

                if(selectUsuario) {
                    setUsuariosUnicos.forEach(u => {
                        selectUsuario.innerHTML += `<option value="${u}">${u}</option>`;
                    });
                    selectUsuario.value = usuarioSeleccionadoPrevio;
                }

                listaLogsAuditoria.sort((a, b) => b.timestamp - a.timestamp);
                filtrarAuditoria();

            } catch (error) {
                console.error(error);
                document.getElementById('tabla-auditoria-global').innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">Error al cargar el historial de cambios.</td></tr>`;
            }
        };

        window.filtrarAuditoria = function() {
            const fFecha = document.getElementById('filtro-aud-fecha')?.value || '';
            const fAccion = document.getElementById('filtro-aud-accion')?.value || '';
            const fUsuario = document.getElementById('filtro-aud-usuario')?.value || '';

            const logsFiltrados = listaLogsAuditoria.filter(l => {
                const matchFecha = fFecha === '' || l.fechaISO === fFecha;
                const matchAccion = fAccion === '' || l.accion.includes(fAccion);
                const matchUsuario = fUsuario === '' || l.usuario === fUsuario;
                return matchFecha && matchAccion && matchUsuario;
            });

            paginaActualAuditoria = 1; // Reiniciar a página 1 al filtrar
            renderTablaAuditoria(logsFiltrados);
        };

        window.limpiarFiltrosAuditoria = function() {
            document.getElementById('filtro-aud-fecha').value = '';
            document.getElementById('filtro-aud-accion').value = '';
            document.getElementById('filtro-aud-usuario').value = '';
            filtrarAuditoria();
        };

        let logsFiltradosCache = [];

        function renderTablaAuditoria(logs) {
            logsFiltradosCache = logs;
            const tbody = document.getElementById('tabla-auditoria-global');
            if(!tbody) return;
            tbody.innerHTML = '';
            
            if (logs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No hay registros de auditoría que coincidan con los filtros.</td></tr>`;
                document.getElementById('info-paginacion-auditoria').innerText = 'Página 1 de 1';
                return;
            }

            const totalPaginas = Math.ceil(logs.length / registrosPorPagina) || 1;
            if (paginaActualAuditoria > totalPaginas) paginaActualAuditoria = totalPaginas;
            if (paginaActualAuditoria < 1) paginaActualAuditoria = 1;

            const inicio = (paginaActualAuditoria - 1) * registrosPorPagina;
            const fin = inicio + registrosPorPagina;
            const registrosPaginados = logs.slice(inicio, fin);

            document.getElementById('info-paginacion-auditoria').innerText = `Página ${paginaActualAuditoria} de ${totalPaginas} (Total: ${logs.length} registros)`;
            document.getElementById('btn-aud-prev').disabled = paginaActualAuditoria <= 1;
            document.getElementById('btn-aud-next').disabled = paginaActualAuditoria >= totalPaginas;

            registrosPaginados.forEach(l => {
                let badgeColor = 'bg-success';
                if (l.accion.includes('Eliminación')) badgeColor = 'bg-danger';
                if (l.accion.includes('Actualización') || l.accion.includes('Edición')) badgeColor = 'bg-warning text-dark';
                if (l.accion.includes('Inicio de Sesión')) badgeColor = 'bg-info text-dark';

                const tr = `<tr>
                    <td><small>${l.fecha}</small></td>
                    <td><span class="badge bg-secondary">${l.modulo}</span></td>
                    <td><span class="badge ${badgeColor}">${l.accion}</span></td>
                    <td class="fw-bold text-dark">${l.usuario}</td>
                    <td><small class="text-muted">${l.detalle}</small></td>
                </tr>`;
                tbody.insertAdjacentHTML('beforeend', tr);
            });
        }

        window.cambiarPaginaAuditoria = function(direccion) {
            paginaActualAuditoria += direccion;
            renderTablaAuditoria(logsFiltradosCache);
        };

        window.imprimirReporteAuditoria = function() {
            const contenido = document.getElementById('tabla-auditoria-container');
            if (!contenido) return;

            const ventana = window.open('', '', 'height=700,width=900');
            ventana.document.write('<html><head><title>Reporte de Auditoría - SAAMIR</title>');
            ventana.document.write('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">');
            ventana.document.write('<style>body { padding: 20px; font-family: Inter, sans-serif; }</style>');
            ventana.document.write('</head><body>');
            ventana.document.write('<h4 class="mb-3">Reporte General de Trazabilidad y Auditoría - SAAMIR</h4>');
            ventana.document.write(contenido.outerHTML);
            ventana.document.write('</body></html>');
            ventana.document.close();
            ventana.focus();
            setTimeout(() => {
                ventana.print();
                ventana.close();
            }, 600);
        };

        function mostrarModalPreviewPDF(url, nombreArchivo) {
            document.getElementById('pdf-preview-iframe').src = url;
            document.getElementById('btn-descargar-pdf-preview').onclick = () => {
                const a = document.createElement('a');
                a.href = url;
                a.download = nombreArchivo;
                a.click();
            };
            new bootstrap.Modal(document.getElementById('modal-pdf-preview')).show();
        }

        window.generarPDFInstitucional = async function(id) {
            const lote = baseDatosInventario.find(l => l.id === id);
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();

            const logoData = await obtenerLogoArchivoBase64();
            if (logoData) {
                doc.addImage(logoData, 'PNG', 15, 10, 18, 18);
            }

            doc.setFont("Inter", "bold"); doc.setFontSize(11); doc.setTextColor(40, 40, 40);
            doc.text("CORTE SUPERIOR DE JUSTICIA DEL SANTA", pageWidth / 2, 16, { align: "center" });
            doc.setFontSize(9.5); doc.setFont("Inter", "normal");
            doc.text("ARCHIVO DESCONCENTRADO DE LA CSJSA", pageWidth / 2, 21, { align: "center" });

            doc.setFont("Inter", "bold"); doc.setFontSize(11); doc.setTextColor(128, 0, 0); 
            doc.text("SAAMIR - Sistema de Administración de Archivos, Microformas, Inventario y Reportes", pageWidth / 2, 27, { align: "center" });
            doc.setLineWidth(0.4); doc.setDrawColor(128, 0, 0); doc.line(15, 31, pageWidth - 15, 31);
            
            doc.setFontSize(11); doc.setTextColor(0, 0, 0);
            doc.text("INFORME CONSOLIDADO DE INVENTARIO DE EXISTENCIAS", pageWidth / 2, 38, { align: "center" });

            doc.setFontSize(9.5);
            doc.setFont("Inter", "bold");
            doc.text("Repositorio / Sede:", 15, 45);
            doc.setFont("Inter", "normal");
            doc.text(String(lote.repositorio), 48, 45);

            doc.setFont("Inter", "bold");
            doc.text("Fecha de Ejecución:", 15, 50);
            doc.setFont("Inter", "normal");
            doc.text(String(lote.fecha), 48, 50);

            const filasTablaAutotable = lote.matrizRangos.map((r, idx) => [
                (idx + 1).toString(),
                r.inicial,
                r.final,
                r.archivamiento,
                r.teorico.toString(),
                r.faltantes.toString(),
                r.real.toString()
            ]);

            filasTablaAutotable.push([ 'Σ', 'TOTAL CONSOLIDADO', '-', '-', lote.totalTeorico.toString(), lote.totalFaltantes.toString(), lote.totalReal.toString() ]);

            doc.autoTable({
                startY: 55,
                margin: { left: 15, right: 15 },
                theme: 'grid',
                headStyles: { fillColor: [128, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 9 },
                styles: { fontSize: 8.5, font: 'Inter', cellPadding: 2 },
                columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 1: { cellWidth: 33, halign: 'center' }, 2: { cellWidth: 33, halign: 'center' }, 3: { cellWidth: 30, halign: 'center' }, 4: { cellWidth: 24, halign: 'center' }, 5: { cellWidth: 24, halign: 'center' }, 6: { cellWidth: 24, halign: 'center' } },
                head: [['Item', 'Rango Inicial', 'Rango Final', 'Archivamiento', 'Teórico', 'Faltantes', 'Total Real Físico']],
                body: filasTablaAutotable
            });

            let currentY = doc.lastAutoTable.finalY + 6;
            doc.setFont("Inter", "bold"); doc.setFontSize(8.5);
            doc.text("DETALLE ESPECÍFICO DE EXPEDIENTES EXCLUIDOS:", 15, currentY);
            currentY += 2;

            const subFaltantesBody = [];
            lote.matrizRangos.forEach(r => {
                if(r.detalleFaltantes && r.detalleFaltantes.length > 0) {
                    r.detalleFaltantes.forEach(f => {
                        subFaltantesBody.push([`${r.inicial} - ${r.final}`, r.archivamiento, f.desde, f.hasta, `${f.cantidad} unidad(es)`]);
                    });
                }
            });

            if(subFaltantesBody.length === 0) {
                subFaltantesBody.push(['-', '-', 'El lote completo coincide con los rangos correlativos. Sin exclusiones.', '-', '-']);
            }

            doc.autoTable({
                startY: currentY,
                margin: { left: 15, right: 15 },
                theme: 'striped',
                headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], halign: 'center', fontSize: 8 },
                styles: { fontSize: 7.5, cellPadding: 1.5 },
                head: [['Rango', 'Archivamiento', 'Faltante Desde', 'Faltante Hasta', 'Cantidad']],
                body: subFaltantesBody
            });

            currentY = doc.lastAutoTable.finalY + 6;
            doc.setFont("Inter", "bold"); doc.setFontSize(8.5);
            doc.text("OBSERVACIONES GENERALES DEL INVENTARIO:", 15, currentY);
            currentY += 4;
            doc.setFont("Inter", "normal"); doc.setFontSize(8);
            const obsTexto = lote.observaciones && lote.observaciones !== 'Ninguna.' ? lote.observaciones : 'Ninguna.';
            const splitObs = doc.splitTextToSize(obsTexto, pageWidth - 30);
            doc.text(splitObs, 15, currentY);
            currentY += (splitObs.length * 4) + 12;

            if (currentY > 255) { doc.addPage(); currentY = 30; }
            doc.setLineWidth(0.3);
            doc.line(35, currentY, 95, currentY);
            doc.line(115, currentY, 175, currentY);

            currentY += 4;
            doc.setFont("Inter", "bold"); doc.setFontSize(8);
            doc.text("USUARIO QUE REGISTRA", 65, currentY, { align: "center" });
            doc.text("USUARIO QUE RECIBE", 145, currentY, { align: "center" });

            currentY += 4;
            doc.setFont("Inter", "normal"); doc.setFontSize(7.5);
            doc.text(String(lote.registra || 'N/A').toUpperCase(), 65, currentY, { align: "center" });
            doc.text(String(lote.recibe || 'N/A').toUpperCase(), 145, currentY, { align: "center" });

            currentY += 4;
            doc.text("Personal de Archivo", 65, currentY, { align: "center" });
            doc.text("Personal de Archivo", 145, currentY, { align: "center" });

            const blobUrl = doc.output('bloburl');
            const repoLimpio = (lote.repositorio || '').replace(/[^a-zA-Z0-9]/g, '_');
            mostrarModalPreviewPDF(blobUrl, `INVENTARIO_${repoLimpio}_${lote.fecha}.pdf`);
        };

        window.guardarReingreso = async function() {
            const expedientes = Array.from(document.querySelectorAll("#tabla-reingresos tbody tr")).map(tr => {
                const inputs = tr.querySelectorAll('input, select');
                return { paquete: inputs[0].value, exp: inputs[1].value, folios: inputs[2].value, juzgado: inputs[3].value, tipo: inputs[4].value, acomp: inputs[5].value };
            });

            if (expedientes.length === 0) {
                Swal.fire('Atención', 'Agregue al menos un expediente antes de guardar.', 'warning');
                return;
            }

            const localSalida = document.getElementById('re-local-salida')?.value || '';
            const localDestino = document.getElementById('re-local').value;

            if (!localSalida) {
                Swal.fire('Atención', 'Seleccione el Local de Salida antes de guardar.', 'warning');
                return;
            }

            try {
                const currentUserObj = auth.currentUser;
                const currentUserName = obtenerNombreUsuarioActual();

                if (idReingresoEnEdicion) {
                    const registroPrevio = baseDatosReingresos.find(r => r.id === idReingresoEnEdicion);

                    // Al editar (normalmente porque fue observado/devuelto), el registro
                    // vuelve a iniciar el flujo de aprobación desde cero con los datos corregidos.
                    const datosActualizados = {
                        fecha: document.getElementById('re-fecha').value,
                        solicitante: document.getElementById('re-solicitante').value,
                        local: localDestino,
                        localSalida,
                        entregado: document.getElementById('re-entregado').value,
                        expedientes,
                        estado: calcularSiguienteEstadoReingreso({ localSalida, local: localDestino }, "GENERADO"),
                        auditoriaVigilanciaSalida: null,
                        auditoriaVigilanciaIngreso: null,
                        auditoriaRecepcion: null,
                        auditoriaEdicion: {
                            uid: currentUserObj?.uid || null,
                            nombre: currentUserName,
                            timestamp: Date.now()
                        }
                    };

                    await updateDoc(doc(db, "reingresos", idReingresoEnEdicion), datosActualizados);
                    Swal.fire({ icon: 'success', title: 'Reingreso Actualizado', text: 'Los cambios se guardaron y el flujo de verificación se reinició.' });
                } else {
                    const correlativo = await obtenerSiguienteCorrelativoReingreso();
                    const datos = {
                        correlativo,
                        fecha: document.getElementById('re-fecha').value,
                        solicitante: document.getElementById('re-solicitante').value,
                        local: localDestino,
                        localSalida,
                        entregado: document.getElementById('re-entregado').value,
                        expedientes,
                        createdAt: Date.now(),
                        activo: true,
                        estado: calcularSiguienteEstadoReingreso({ localSalida, local: localDestino }, "GENERADO"),
                        auditoriaGeneracion: {
                            uid: currentUserObj?.uid || null,
                            nombre: currentUserName,
                            timestamp: Date.now()
                        },
                        auditoriaVigilanciaSalida: null,
                        auditoriaVigilanciaIngreso: null,
                        auditoriaRecepcion: null,
                        historialObservaciones: [],
                        // Se mantiene por compatibilidad con reportes/lógica anterior
                        auditoria: {
                            uid: currentUserObj?.uid || null,
                            nombre: currentUserName,
                            timestamp: Date.now()
                        }
                    };

                    await addDoc(collection(db, "reingresos"), datos);
                    Swal.fire({ icon: 'success', title: 'Registro guardado con éxito', text: 'Estado actual: ' + ETIQUETAS_ESTADO_REINGRESO[datos.estado].texto + '.' });
                }

                resetFormularioReingreso();
                await cargarHistorialReingresosParaDashboard();
                switchView('view-consultas-reingresos', 'Consultar Historial de Reingresos');
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };

        window.guardarTraslado = async function() {
            const fecha = document.getElementById('tr-fecha').value;
            const entregado = document.getElementById('tr-entregado').value;
            const recibe = document.getElementById('tr-recibe').value;

            if (!recibe) {
                Swal.fire('Atención', 'Debe seleccionar quién recibe el traslado.', 'warning');
                return;
            }

            const paquetes = Array.from(document.querySelectorAll("#tabla-traslados tbody tr")).map(tr => {
                const desde = tr.querySelector('.tr-desde').value.trim();
                const hasta = tr.querySelector('.tr-hasta').value.trim();
                const inputs = tr.querySelectorAll('input, select');
                return { 
                    paqueteDesde: desde,
                    paqueteHasta: hasta || desde,
                    rangoTexto: hasta && hasta !== desde ? `${desde} al ${hasta}` : desde,
                    cantidad: parseInt(tr.querySelector('.tr-cant').textContent, 10) || 1,
                    juzgado: inputs[2].value, 
                    repoSalida: inputs[3].value, 
                    repoIngreso: inputs[4].value, 
                    motivo: inputs[5].value 
                };
            });

            if (paquetes.length === 0) {
                Swal.fire('Atención', 'Agregue al menos un rango de paquetes antes de guardar el traslado.', 'warning');
                return;
            }

            try {
                const currentUserObj = auth.currentUser;
                const currentUserName = obtenerNombreCanonicoDeUsuario(currentUserObj);

                if (idTrasladoEnEdicion) {
                    const datosActualizados = {
                        fecha,
                        entregado,
                        recibe,
                        paquetes,
                        auditoriaEdicion: {
                            uid: currentUserObj?.uid || null,
                            nombre: currentUserName,
                            timestamp: Date.now()
                        }
                    };

                    await updateDoc(doc(db, "traslados", idTrasladoEnEdicion), datosActualizados);
                    Swal.fire({ icon: 'success', title: 'Traslado Actualizado', text: 'Los cambios se guardaron correctamente.' });
                } else {
                    const correlativo = await obtenerSiguienteCorrelativoTraslado();
                    const datos = {
                        correlativo,
                        fecha,
                        entregado,
                        recibe,
                        paquetes,
                        createdAt: Date.now(),
                        activo: true,
                        auditoria: {
                            uid: currentUserObj?.uid || null,
                            nombre: currentUserName,
                            timestamp: Date.now()
                        }
                    };

                    await addDoc(collection(db, "traslados"), datos);
                    Swal.fire({ icon: 'success', title: 'Formato de traslado guardado con éxito' });
                }

                resetFormularioTraslado();
                await cargarHistorialTrasladosParaDashboard();
                switchView('view-consultas-traslados', 'Consultar Historial de Traslados');
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };

        window.editarReingreso = function(id) {
            if (!puedeEditarEliminarReingresoGuardado(obtenerNombreUsuarioActual())) {
                Swal.fire('Acceso de solo consulta', 'Tu usuario no tiene permiso para editar reingresos ya guardados.', 'info');
                return;
            }

            const registro = baseDatosReingresos.find(r => r.id === id);
            if (!registro) return;

            if (registro.estado && registro.estado !== 'GENERADO') {
                Swal.fire('No editable', 'Este reingreso ya está en verificación y no puede editarse mientras no sea observado/devuelto.', 'info');
                return;
            }

            idReingresoEnEdicion = id;
            document.getElementById('re-fecha').value = registro.fecha || '';
            document.getElementById('re-solicitante').value = registro.solicitante || '';
            document.getElementById('re-local').value = registro.local || '';
            const campoLocalSalidaEdit = document.getElementById('re-local-salida');
            if (campoLocalSalidaEdit) campoLocalSalidaEdit.value = registro.localSalida || '';
            document.getElementById('re-entregado').value = registro.entregado || '';

            const tbody = document.querySelector('#tabla-reingresos tbody');
            tbody.innerHTML = '';

            if (registro.expedientes && Array.isArray(registro.expedientes)) {
                registro.expedientes.forEach(e => {
                    const fila = `<tr>
                        <td><input type="text" class="form-control form-control-sm" placeholder="Paquete" value="${e.paquete || ''}"></td>
                        <td><input type="text" class="form-control form-control-sm" placeholder="Expediente" value="${e.exp || ''}"></td>
                        <td><input type="number" class="form-control form-control-sm" value="${e.folios || 0}"></td>
                        <td><input type="text" class="form-control form-control-sm" placeholder="Juzgado" value="${e.juzgado || ''}"></td>
                        <td>
                            <select class="form-select form-select-sm">
                                <option value="Transitorio" ${e.tipo === 'Transitorio' ? 'selected' : ''}>Transitorio</option>
                                <option value="Definitivo" ${e.tipo === 'Definitivo' ? 'selected' : ''}>Definitivo</option>
                            </select>
                        </td>
                        <td><input type="number" class="form-control form-control-sm" value="${e.acomp || 0}"></td>
                        <td class="text-center">
                            <button class="btn btn-outline-danger btn-sm" onclick="this.parentElement.parentElement.remove()">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>`;
                    tbody.insertAdjacentHTML('beforeend', fila);
                });
            }

            document.getElementById('btn-guardar-reingreso').innerHTML = '<i class="bi bi-cloud-upload me-2"></i>Guardar Cambios';
            switchView('view-reingresos', `Editando Reingreso N° ${registro.correlativo}`);
        };

        window.editarTraslado = function(id) {
            const registro = baseDatosTraslados.find(r => r.id === id);
            if (!registro) return;

            idTrasladoEnEdicion = id;
            document.getElementById('tr-fecha').value = registro.fecha || '';
            document.getElementById('tr-entregado').value = registro.entregado || '';
            document.getElementById('tr-recibe').value = registro.recibe || '';

            const tbody = document.querySelector('#tabla-traslados tbody');
            tbody.innerHTML = '';

            if (registro.paquetes && Array.isArray(registro.paquetes)) {
                registro.paquetes.forEach((e, idx) => {
                    agregarFilaTraslado(e.paqueteDesde || e.paquete || '', e.paqueteHasta || e.paquete || '', e.juzgado || '', e.repoSalida || '', e.repoIngreso || '', e.motivo || '');
                });
            }

            document.getElementById('btn-guardar-traslado').innerHTML = '<i class="bi bi-cloud-upload me-2"></i>Guardar Cambios';
            actualizarTotalTraslados();
            switchView('view-traslados', `Editando Traslado N° ${registro.correlativo}`);
        };

        async function obtenerSiguienteCorrelativoReingreso() {
            const snapshotActual = await getDocs(collection(db, "reingresos"));
            let maxCorrelativo = 0;
            snapshotActual.forEach((docSnap) => {
                const c = Number(docSnap.data().correlativo) || 0;
                if (c > maxCorrelativo) maxCorrelativo = c;
            });
            return maxCorrelativo + 1;
        }

        async function obtenerSiguienteCorrelativoTraslado() {
            const snapshotActual = await getDocs(collection(db, "traslados"));
            let maxCorrelativo = 0;
            snapshotActual.forEach((docSnap) => {
                const c = Number(docSnap.data().correlativo) || 0;
                if (c > maxCorrelativo) maxCorrelativo = c;
            });
            return maxCorrelativo + 1;
        }

        window.eliminarReingreso = async function(id) {
            if (!puedeEditarEliminarReingresoGuardado(obtenerNombreUsuarioActual())) {
                Swal.fire('Acceso de solo consulta', 'Tu usuario no tiene permiso para eliminar reingresos ya guardados.', 'info');
                return;
            }

            const registro = baseDatosReingresos.find(r => r.id === id);
            const confirmacion = await Swal.fire({
                icon: 'warning',
                title: '¿Eliminar reingreso?',
                text: registro ? `Se eliminará el registro N° ${registro.correlativo}.` : '',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                confirmButtonColor: '#800000'
            });
            if (!confirmacion.isConfirmed) return;

            try {
                const currentUserObj = auth.currentUser;
                const currentUserName = obtenerNombreCanonicoDeUsuario(currentUserObj);

                await updateDoc(doc(db, "reingresos", id), {
                    activo: false,
                    auditoriaEliminacion: {
                        uid: currentUserObj?.uid || null,
                        nombre: currentUserName,
                        timestamp: Date.now()
                    }
                });
                Swal.fire({ icon: 'success', title: 'Registro eliminado', timer: 1500, showConfirmButton: false });
                await window.cargarHistorialReingresos();
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };

        window.eliminarTraslado = async function(id) {
            const registro = baseDatosTraslados.find(r => r.id === id);
            const confirmacion = await Swal.fire({
                icon: 'warning',
                title: '¿Eliminar traslado?',
                text: registro ? `Se eliminará el formato N° ${registro.correlativo}.` : '',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                confirmButtonColor: '#800000'
            });
            if (!confirmacion.isConfirmed) return;

            try {
                const currentUserObj = auth.currentUser;
                const currentUserName = obtenerNombreCanonicoDeUsuario(currentUserObj);

                await updateDoc(doc(db, "traslados", id), {
                    activo: false,
                    auditoriaEliminacion: {
                        uid: currentUserObj?.uid || null,
                        nombre: currentUserName,
                        timestamp: Date.now()
                    }
                });
                Swal.fire({ icon: 'success', title: 'Registro eliminado', timer: 1500, showConfirmButton: false });
                await window.cargarHistorialTraslados();
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };

        window.cargarHistorialReingresos = async function() {
            try {
                const querySnapshot = await getDocs(collection(db, "reingresos"));
                baseDatosReingresos = [];
                querySnapshot.forEach((doc) => {
                    const data = { id: doc.id, ...doc.data() };
                    if (data.activo !== false) baseDatosReingresos.push(data);
                });
                baseDatosReingresos.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                filtrarHistorialReingresos();
            } catch (error) {
                console.error(error);
            }
        };

        window.cargarHistorialTraslados = async function() {
            try {
                const querySnapshot = await getDocs(collection(db, "traslados"));
                baseDatosTraslados = [];
                querySnapshot.forEach((doc) => {
                    const data = { id: doc.id, ...doc.data() };
                    if (data.activo !== false) baseDatosTraslados.push(data);
                });
                baseDatosTraslados.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                filtrarHistorialTraslados();
            } catch (error) {
                console.error(error);
            }
        };

        window.filtrarHistorialReingresos = function() {
            const fSolicitante = document.getElementById('filtro-re-solicitante')?.value || '';
            const fEntregado = document.getElementById('filtro-re-entregado')?.value || '';
            const fFecha = document.getElementById('filtro-re-fecha')?.value || '';
            const fEstado = document.getElementById('filtro-re-estado')?.value || '';
            const fTexto = (document.getElementById('busqueda-reingresos')?.value || '').toLowerCase().trim();

            const filtrados = baseDatosReingresos.filter(r => {
                const mSolicitante = fSolicitante === '' || r.solicitante === fSolicitante;
                const mEntregado = fEntregado === '' || r.entregado === fEntregado;
                const mFecha = fFecha === '' || r.fecha === fFecha;
                const mEstado = fEstado === '' || (r.estado || 'GENERADO') === fEstado;
                const mTexto = fTexto === '' || (r.local || '').toLowerCase().includes(fTexto) || (r.localSalida || '').toLowerCase().includes(fTexto) ||
                    (r.expedientes || []).some(e => (e.paquete || '').toLowerCase().includes(fTexto) || (e.exp || '').toLowerCase().includes(fTexto));
                return mSolicitante && mEntregado && mFecha && mEstado && mTexto;
            });

            renderTablaHistorialReingresos(filtrados);
        };

        window.filtrarHistorialTraslados = function() {
            const fEntregado = document.getElementById('filtro-tr-entregado')?.value || '';
            const fFecha = document.getElementById('filtro-tr-fecha')?.value || '';
            const fTexto = (document.getElementById('busqueda-traslados')?.value || '').toLowerCase().trim();

            const filtrados = baseDatosTraslados.filter(r => {
                const mEntregado = fEntregado === '' || r.entregado === fEntregado;
                const mFecha = fFecha === '' || r.fecha === fFecha;
                const mTexto = fTexto === '' || (r.entregado || '').toLowerCase().includes(fTexto) ||
                    (r.paquetes || []).some(e => (e.paqueteDesde || '').toLowerCase().includes(fTexto) || (e.paqueteHasta || '').toLowerCase().includes(fTexto) || (e.motivo || '').toLowerCase().includes(fTexto) || (e.repoSalida || '').toLowerCase().includes(fTexto) || (e.repoIngreso || '').toLowerCase().includes(fTexto));
                return mEntregado && mFecha && mTexto;
            });

            renderTablaHistorialTraslados(filtrados);
        };

        function renderTablaHistorialReingresos(registros) {
            const tbody = document.getElementById('tabla-historial-reingresos');
            if(!tbody) return;
            tbody.innerHTML = '';
            if (registros.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Sin reingresos registrados.</td></tr>`;
                return;
            }

            // Solo quienes tienen permiso explícito (Alfredo Cruzado, Jorge Izquierdo,
            // Manuel Barandiaran) ven Editar/Eliminar. Todos los demás (resto de
            // personal de archivo y vigilantes) están en modo SOLO CONSULTA: ver y
            // descargar el PDF de cada reingreso.
            const soloLectura = !puedeEditarEliminarReingresoGuardado(obtenerNombreUsuarioActual());

            registros.forEach(data => {
                const estado = data.estado || 'GENERADO';
                const etiqueta = ETIQUETAS_ESTADO_REINGRESO[estado] || ETIQUETAS_ESTADO_REINGRESO.GENERADO;
                const badgeEstado = `<span class="badge bg-${etiqueta.clase}"><i class="bi ${etiqueta.icono} me-1"></i>${etiqueta.texto}</span>`;
                const botonesAccion = soloLectura
                    ? `<button class="btn btn-sm btn-danger py-1 px-2" onclick="window.generarPDFReingresoDesdeRegistro('${data.id}')" title="Ver / Descargar PDF">
                            <i class="bi bi-file-pdf"></i>
                        </button>`
                    : `<button class="btn btn-sm btn-danger py-1 px-2 me-1" onclick="window.generarPDFReingresoDesdeRegistro('${data.id}')" title="Ver PDF">
                            <i class="bi bi-file-pdf"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary py-1 px-2 me-1" onclick="window.editarReingreso('${data.id}')" title="Editar Registro">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger py-1 px-2" onclick="window.eliminarReingreso('${data.id}')" title="Eliminar Registro">
                            <i class="bi bi-trash"></i>
                        </button>`;
                const fila = `<tr>
                    <td>${data.fecha || 'N/A'}</td>
                    <td>${resolverNombreCanonico(data.solicitante) || 'N/A'}</td>
                    <td>${data.local || 'N/A'}</td>
                    <td>${resolverNombreCanonico(data.entregado) || 'N/A'}</td>
                    <td>${data.expedientes ? data.expedientes.length : 0}</td>
                    <td>${badgeEstado}</td>
                    <td class="text-end">${botonesAccion}</td>
                </tr>`;
                tbody.insertAdjacentHTML('beforeend', fila);
            });
        }

        function renderTablaHistorialTraslados(registros) {
            const tbody = document.getElementById('tabla-historial-traslados');
            if(!tbody) return;
            tbody.innerHTML = '';
            if (registros.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">Sin traslados registrados.</td></tr>`;
                return;
            }
            registros.forEach(data => {
                const totalPaqSuma = (data.paquetes || []).reduce((acc, p) => acc + (parseInt(p.cantidad, 10) || 1), 0);
                const fila = `<tr>
                    <td>${data.fecha || 'N/A'}</td>
                    <td>${resolverNombreCanonico(data.entregado) || 'N/A'}</td>
                    <td>${totalPaqSuma}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-danger py-1 px-2 me-1" onclick="window.generarPDFTrasladoDesdeRegistro('${data.id}')" title="Ver PDF">
                            <i class="bi bi-file-pdf"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary py-1 px-2 me-1" onclick="window.editarTraslado('${data.id}')" title="Editar Registro">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger py-1 px-2" onclick="window.eliminarTraslado('${data.id}')" title="Eliminar Registro">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>`;
                tbody.insertAdjacentHTML('beforeend', fila);
            });
        }

        // ===== BANDEJA DE VERIFICACIÓN DE REINGRESOS (Vigilancia Salida / Ingreso / Recepción) =====
        window.cargarBandejaVerificacionReingresos = async function() {
            try {
                const querySnapshot = await getDocs(collection(db, "reingresos"));
                baseDatosReingresos = [];
                querySnapshot.forEach((doc) => {
                    const data = { id: doc.id, ...doc.data() };
                    if (data.activo !== false) baseDatosReingresos.push(data);
                });
                baseDatosReingresos.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

                const nombreActual = obtenerNombreUsuarioActual();
                const pendientes = baseDatosReingresos.filter(r => {
                    const estado = r.estado || 'GENERADO';
                    if (estado === 'VERIF_SALIDA') return puedeVigilarRepositorio(nombreActual, r.localSalida);
                    if (estado === 'VERIF_INGRESO') return puedeVigilarRepositorio(nombreActual, r.local);
                    if (estado === 'RECEPCION') return puedeRecepcionarRegistro(nombreActual, r);
                    return false;
                });

                renderBandejaVerificacionReingresos(pendientes);
            } catch (error) {
                console.error(error);
            }
        };

        function renderBandejaVerificacionReingresos(registros) {
            const tbody = document.getElementById('tabla-bandeja-verificacion-reingresos');
            if (!tbody) return;
            tbody.innerHTML = '';
            if (registros.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4"><i class="bi bi-check2-circle me-1"></i>No tienes reingresos pendientes de verificación.</td></tr>`;
                return;
            }
            registros.forEach(data => {
                const estado = data.estado || 'GENERADO';
                const etiqueta = ETIQUETAS_ESTADO_REINGRESO[estado] || ETIQUETAS_ESTADO_REINGRESO.GENERADO;
                const fila = `<tr>
                    <td>${String(data.correlativo ?? '-').toString().padStart(3, '0')}</td>
                    <td>${data.fecha || 'N/A'}</td>
                    <td>${data.localSalida || 'N/A'}</td>
                    <td>${data.local || 'N/A'}</td>
                    <td>${data.expedientes ? data.expedientes.length : 0}</td>
                    <td><span class="badge bg-${etiqueta.clase}"><i class="bi ${etiqueta.icono} me-1"></i>${etiqueta.texto}</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-success py-1 px-2 me-1" onclick="window.darVistoBuenoReingreso('${data.id}')" title="Dar Visto Bueno">
                            <i class="bi bi-check-lg"></i> Visto Bueno
                        </button>
                        <button class="btn btn-sm btn-outline-danger py-1 px-2 me-1" onclick="window.observarReingreso('${data.id}')" title="Observar">
                            <i class="bi bi-x-lg"></i> Observar
                        </button>
                        <button class="btn btn-sm btn-outline-secondary py-1 px-2" onclick="window.generarPDFReingresoDesdeRegistro('${data.id}')" title="Ver PDF">
                            <i class="bi bi-file-pdf"></i>
                        </button>
                    </td>
                </tr>`;
                tbody.insertAdjacentHTML('beforeend', fila);
            });
        }

        window.darVistoBuenoReingreso = async function(id) {
            const registro = baseDatosReingresos.find(r => r.id === id);
            if (!registro) return;

            const estadoActual = registro.estado || 'GENERADO';
            const currentUserObj = auth.currentUser;
            const currentUserName = obtenerNombreUsuarioActual();

            let campoAuditoria = null;
            let autorizado = false;

            if (estadoActual === 'VERIF_SALIDA') {
                campoAuditoria = 'auditoriaVigilanciaSalida';
                autorizado = puedeVigilarRepositorio(currentUserName, registro.localSalida);
            } else if (estadoActual === 'VERIF_INGRESO') {
                campoAuditoria = 'auditoriaVigilanciaIngreso';
                autorizado = puedeVigilarRepositorio(currentUserName, registro.local);
            } else if (estadoActual === 'RECEPCION') {
                campoAuditoria = 'auditoriaRecepcion';
                autorizado = puedeRecepcionarRegistro(currentUserName, registro);
            }

            if (!campoAuditoria) {
                Swal.fire('Atención', 'Este reingreso no tiene una verificación pendiente en este momento.', 'info');
                return;
            }
            if (!autorizado) {
                Swal.fire('Sin permiso', 'Tu usuario no está autorizado para dar el visto bueno en esta etapa.', 'error');
                return;
            }

            const { value: observaciones, isConfirmed } = await Swal.fire({
                title: 'Confirmar Visto Bueno',
                text: `Reingreso N° ${String(registro.correlativo ?? '-').toString().padStart(3, '0')} — ${ETIQUETAS_ESTADO_REINGRESO[estadoActual].texto}`,
                input: 'textarea',
                inputLabel: 'Observaciones (opcional)',
                inputPlaceholder: 'Ej: conforme, sin novedad...',
                showCancelButton: true,
                confirmButtonText: 'Dar Visto Bueno',
                confirmButtonColor: '#198754'
            });
            if (!isConfirmed) return;

            const siguienteEstado = calcularSiguienteEstadoReingreso(registro, estadoActual);

            try {
                await updateDoc(doc(db, "reingresos", id), {
                    estado: siguienteEstado,
                    [campoAuditoria]: {
                        uid: currentUserObj?.uid || null,
                        nombre: currentUserName,
                        timestamp: Date.now(),
                        observaciones: observaciones || ''
                    }
                });
                Swal.fire({ icon: 'success', title: 'Visto bueno registrado', text: 'Nuevo estado: ' + ETIQUETAS_ESTADO_REINGRESO[siguienteEstado].texto, timer: 2000, showConfirmButton: false });
                await window.cargarBandejaVerificacionReingresos();
                await cargarHistorialReingresosParaDashboard();
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };

        window.observarReingreso = async function(id) {
            const registro = baseDatosReingresos.find(r => r.id === id);
            if (!registro) return;

            const estadoActual = registro.estado || 'GENERADO';
            const currentUserName = obtenerNombreUsuarioActual();

            let autorizado = false;
            if (estadoActual === 'VERIF_SALIDA') autorizado = puedeVigilarRepositorio(currentUserName, registro.localSalida);
            else if (estadoActual === 'VERIF_INGRESO') autorizado = puedeVigilarRepositorio(currentUserName, registro.local);
            else if (estadoActual === 'RECEPCION') autorizado = puedeRecepcionarRegistro(currentUserName, registro);

            if (!autorizado) {
                Swal.fire('Sin permiso', 'Tu usuario no está autorizado para observar en esta etapa.', 'error');
                return;
            }

            const { value: motivo } = await Swal.fire({
                title: '¿Observar este reingreso?',
                text: 'El registro volverá a estado "Generado" para que el solicitante corrija los datos. Se perderán los vistos buenos previos.',
                input: 'textarea',
                inputLabel: 'Motivo de la observación',
                inputPlaceholder: 'Describe el problema encontrado...',
                inputValidator: (v) => !v ? 'Debes indicar el motivo' : undefined,
                showCancelButton: true,
                confirmButtonText: 'Observar',
                confirmButtonColor: '#dc3545'
            });
            if (!motivo) return;

            try {
                const historialPrevio = Array.isArray(registro.historialObservaciones) ? registro.historialObservaciones : [];
                const nuevoHistorial = historialPrevio.concat([{
                    etapa: estadoActual,
                    nombre: currentUserName,
                    motivo,
                    timestamp: Date.now()
                }]);

                await updateDoc(doc(db, "reingresos", id), {
                    estado: "GENERADO",
                    auditoriaVigilanciaSalida: null,
                    auditoriaVigilanciaIngreso: null,
                    auditoriaRecepcion: null,
                    historialObservaciones: nuevoHistorial
                });
                Swal.fire({ icon: 'info', title: 'Reingreso observado', text: 'Se devolvió al solicitante para corrección.' });
                await window.cargarBandejaVerificacionReingresos();
                await cargarHistorialReingresosParaDashboard();
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };

        async function construirPDFReingreso({ correlativo, fecha, solicitante, local, localSalida, entregado, expedientes, estado, auditoriaGeneracion, auditoriaVigilanciaSalida, auditoriaVigilanciaIngreso, auditoriaRecepcion }) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();

            const logoData = await obtenerLogoArchivoBase64();
            if (logoData) {
                doc.addImage(logoData, 'PNG', 15, 10, 18, 18);
            }

            doc.setFont("Inter", "bold"); doc.setTextColor(20, 20, 20); doc.setFontSize(11);
            doc.text("REPORTE DE EXPEDIENTES REINGRESADOS", pageWidth / 2, 16, { align: "center" });

            doc.setFont("Inter", "bold"); doc.setTextColor(128, 0, 0); doc.setFontSize(9.5);
            doc.text("SAAMIR - Sistema de Administración de Archivos, Microformas, Inventario y Reportes", pageWidth / 2, 22, { align: "center" });

            doc.setDrawColor(128, 0, 0); doc.setLineWidth(0.4);
            doc.line(15, 27, pageWidth - 15, 27);

            doc.setFont("Inter", "bold"); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
            doc.text(`Correlativo (ID): ${String(correlativo).padStart(3, '0')}`, 15, 34);
            doc.text(`Fecha: ${fecha}`, pageWidth - 15, 34, { align: "right" });
            doc.text(`Solicitante: ${resolverNombreCanonico(solicitante)}`, 15, 40);
            doc.text(`Estado: ${(ETIQUETAS_ESTADO_REINGRESO[estado || 'GENERADO'] || ETIQUETAS_ESTADO_REINGRESO.GENERADO).texto}`, pageWidth - 15, 40, { align: "right" });
            doc.text(`Local de Salida: ${localSalida || 'N/A'}`, 15, 46);
            doc.text(`Local de Reingreso: ${local}`, pageWidth - 15, 46, { align: "right" });
            doc.text(`Entregado por: ${resolverNombreCanonico(entregado)}`, 15, 52);

            let totalTransitorio = 0;
            let totalDefinitivo = 0;
            let totalAcompanados = 0;

            const filasTabla = expedientes.map((e, idx) => {
                if (e.tipo === 'Transitorio') totalTransitorio++;
                if (e.tipo === 'Definitivo') totalDefinitivo++;
                totalAcompanados += parseInt(e.acomp, 10) || 0;

                return [
                    (idx + 1).toString(), 
                    e.paquete || '-', 
                    e.exp || '-', 
                    e.folios || '0', 
                    e.juzgado || '-', 
                    e.tipo || 'Transitorio', 
                    e.acomp || '0', 
                    local
                ];
            });

            doc.autoTable({
                startY: 56,
                margin: { left: 15, right: 15 },
                theme: 'grid',
                head: [['N°', 'N° Paquete', 'N° Expediente', 'Folios', 'Juzgado', 'Tipo', 'Acompañados', 'Repositorio']],
                body: filasTabla,
                headStyles: { fillColor: [128, 0, 0], textColor: [255, 255, 255], fontSize: 8.5, halign: 'center' },
                styles: { fontSize: 8, font: 'Inter', halign: 'center', cellPadding: 2 }
            });

            let currentY = doc.lastAutoTable.finalY + 8;
            doc.setFont("Inter", "bold"); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0);
            doc.text(`Total AT (Archivamiento Transitorio): ${totalTransitorio}`, 15, currentY);
            doc.text(`Total AD (Archivamiento Definitivo): ${totalDefinitivo}`, pageWidth / 2, currentY);
            
            currentY += 5;
            doc.text(`Total Expedientes: ${expedientes.length}`, 15, currentY);
            currentY += 5;
            doc.text(`Total Acompañados: ${totalAcompanados}`, 15, currentY);

            // ===== BLOQUE DE FIRMAS / VISTOS BUENOS DEL FLUJO DE APROBACIÓN =====
            // 1) Generó  2) Vigilancia Salida  3) Vigilancia Ingreso  4) Recepción
            currentY += 20;
            if (currentY > 235) { doc.addPage(); currentY = 30; }

            const formatearVB = (auditoriaObj) => {
                if (!auditoriaObj || !auditoriaObj.nombre) return { nombre: 'PENDIENTE', fecha: '' };
                const f = auditoriaObj.timestamp ? new Date(auditoriaObj.timestamp).toLocaleDateString('es-PE') : '';
                // Se resuelve el alias a su nombre canónico al momento de MOSTRARLO,
                // para que registros antiguos guardados con el alias crudo (ej. "VSAENZPENA")
                // también se vean con el nombre completo (ej. "VIGILANCIA SAENZ PEÑA").
                return { nombre: resolverNombreCanonico(auditoriaObj.nombre), fecha: f };
            };

            // El V°B° de esta columna corresponde a quien REMITE/ENTREGA físicamente el
            // paquete (campo "entregado"), no a quien lo solicitó ni necesariamente a
            // quien digitó el registro en el sistema. Se usa siempre el campo "entregado"
            // como fuente de verdad; auditoriaGeneracion solo aporta la fecha si falta.
            const vbGeneracion = formatearVB(auditoriaGeneracion);
            vbGeneracion.nombre = resolverNombreCanonico(entregado) || resolverNombreCanonico(auditoriaGeneracion?.nombre) || 'N/A';

            const vbSalidaAplica = repositorioTieneVigilancia(localSalida);
            const vbIngresoAplica = repositorioTieneVigilancia(local);
            const vbSalida = vbSalidaAplica ? formatearVB(auditoriaVigilanciaSalida) : { nombre: 'SIN VIGILANCIA ASIGNADA', fecha: '' };
            const vbIngreso = vbIngresoAplica ? formatearVB(auditoriaVigilanciaIngreso) : { nombre: 'SIN VIGILANCIA ASIGNADA', fecha: '' };
            const vbRecepcion = formatearVB(auditoriaRecepcion);

            const columnasFirma = [
                { titulo: '1. Remitió / Entregó', dato: vbGeneracion, x: 15 },
                { titulo: '2. Vigilancia Salida', dato: vbSalida, x: 15 + (pageWidth - 30) / 4 },
                { titulo: '3. Vigilancia Ingreso', dato: vbIngreso, x: 15 + 2 * (pageWidth - 30) / 4 },
                { titulo: '4. Recepción', dato: vbRecepcion, x: 15 + 3 * (pageWidth - 30) / 4 }
            ];
            const anchoCol = (pageWidth - 30) / 4 - 6;

            // Leyenda "V°B°" sobre la línea de cada columna (en lugar de "Firma"),
            // acorde con el flujo de aprobación digital por etapas del sistema.
            doc.setFont("Inter", "bold"); doc.setFontSize(7); doc.setTextColor(90, 90, 90);
            columnasFirma.forEach(col => {
                doc.text('V°B°', col.x + anchoCol / 2, currentY - 2, { align: "center" });
            });
            doc.setTextColor(0, 0, 0);

            doc.setLineWidth(0.3);
            columnasFirma.forEach(col => {
                doc.line(col.x, currentY, col.x + anchoCol, currentY);
            });

            let yFirma = currentY + 4;
            doc.setFont("Inter", "bold"); doc.setFontSize(7);
            columnasFirma.forEach(col => {
                doc.text(col.dato.nombre.toUpperCase(), col.x + anchoCol / 2, yFirma, { align: "center", maxWidth: anchoCol });
            });

            yFirma += 8;
            doc.setFont("Inter", "normal"); doc.setFontSize(6.5); doc.setTextColor(90, 90, 90);
            columnasFirma.forEach(col => {
                doc.text(col.titulo, col.x + anchoCol / 2, yFirma, { align: "center" });
                if (col.dato.fecha) doc.text(col.dato.fecha, col.x + anchoCol / 2, yFirma + 3.5, { align: "center" });
            });
            doc.setTextColor(0, 0, 0);

            const blobUrl = doc.output('bloburl');
            mostrarModalPreviewPDF(blobUrl, `REINGRESOS_${String(correlativo).padStart(3, '0')}_${fecha}.pdf`);
        };

        async function construirPDFTraslado({ correlativo, fecha, entregado, recibe, paquetes }) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();

            const logoData = await obtenerLogoArchivoBase64();
            if (logoData) {
                doc.addImage(logoData, 'PNG', 15, 10, 18, 18);
            }

            doc.setFont("Inter", "bold"); doc.setTextColor(20, 20, 20); doc.setFontSize(11);
            doc.text("FORMATO DE TRASLADO DE PAQUETES", pageWidth / 2, 16, { align: "center" });

            doc.setFont("Inter", "bold"); doc.setTextColor(128, 0, 0); doc.setFontSize(9.5);
            doc.text("SAAMIR - Sistema de Administración de Archivos, Microformas, Inventario y Reportes", pageWidth / 2, 22, { align: "center" });

            doc.setDrawColor(128, 0, 0); doc.setLineWidth(0.4);
            doc.line(15, 27, pageWidth - 15, 27);

            doc.setFont("Inter", "bold"); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
            doc.text(`Correlativo (ID): ${String(correlativo).padStart(3, '0')}`, 15, 34);
            doc.text(`Fecha: ${fecha}`, pageWidth - 15, 34, { align: "right" });
            doc.text(`Entregado por: ${resolverNombreCanonico(entregado)}`, 15, 40);
            doc.text(`Recibido por: ${resolverNombreCanonico(recibe) || 'N/A'}`, pageWidth - 15, 40, { align: "right" });

            let sumaTotalPaq = 0;
            const filasTabla = paquetes.map((e, idx) => {
                const rangoStr = e.rangoTexto || (e.paqueteDesde && e.paqueteHasta ? (e.paqueteDesde === e.paqueteHasta ? e.paqueteDesde : `${e.paqueteDesde} al ${e.paqueteHasta}`) : (e.paquete || '-'));
                const cant = parseInt(e.cantidad, 10) || 1;
                sumaTotalPaq += cant;

                return [
                    (idx + 1).toString(),
                    rangoStr,
                    cant.toString(),
                    e.juzgado || '-',
                    e.repoSalida || '-',
                    e.repoIngreso || '-',
                    e.motivo || '-'
                ];
            });

            doc.autoTable({
                startY: 45,
                margin: { left: 15, right: 15 },
                theme: 'grid',
                head: [['Ítem', 'Rango Paquetes', 'Cant.', 'Juzgado', 'Repo. Salida', 'Repo. Ingreso', 'Motivo']],
                body: filasTabla,
                headStyles: { fillColor: [128, 0, 0], textColor: [255, 255, 255], fontSize: 8.5, halign: 'center' },
                styles: { fontSize: 8, font: 'Inter', halign: 'center', cellPadding: 2 }
            });

            let currentY = doc.lastAutoTable.finalY + 8;
            doc.setFont("Inter", "bold"); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
            doc.text(`Total general de paquetes trasladados: ${sumaTotalPaq}`, 15, currentY);

            currentY += 25;
            if (currentY > 255) { doc.addPage(); currentY = 30; }

            doc.setLineWidth(0.3);
            doc.line(35, currentY, 95, currentY);
            doc.line(115, currentY, 175, currentY);

            currentY += 4;
            doc.setFont("Inter", "bold"); doc.setFontSize(8);
            doc.text(`Entregado por: ${resolverNombreCanonico(entregado)}`, 65, currentY, { align: "center" });
            doc.text(`Recibido por: ${resolverNombreCanonico(recibe) || 'N/A'}`, 145, currentY, { align: "center" });

            const blobUrl = doc.output('bloburl');
            mostrarModalPreviewPDF(blobUrl, `TRASLADO_${String(correlativo).padStart(3, '0')}_${fecha}.pdf`);
        }

        window.generarReporteReingresoPDF = async function() {
            const expedientes = Array.from(document.querySelectorAll("#tabla-reingresos tbody tr")).map(tr => {
                const inputs = tr.querySelectorAll('input, select');
                return { paquete: inputs[0].value, exp: inputs[1].value, folios: inputs[2].value, juzgado: inputs[3].value, tipo: inputs[4].value, acomp: inputs[5].value };
            });

            if (expedientes.length === 0) {
                Swal.fire('Atención', 'Agregue al menos un expediente antes de generar el reporte.', 'warning');
                return;
            }

            const registroEnEdicionActual = idReingresoEnEdicion ? baseDatosReingresos.find(r => r.id === idReingresoEnEdicion) : null;

            await construirPDFReingreso({
                correlativo: registroEnEdicionActual ? registroEnEdicionActual.correlativo : await obtenerSiguienteCorrelativoReingreso(),
                fecha: document.getElementById('re-fecha').value,
                solicitante: document.getElementById('re-solicitante').value,
                local: document.getElementById('re-local').value,
                localSalida: document.getElementById('re-local-salida')?.value || '',
                entregado: document.getElementById('re-entregado').value,
                expedientes,
                estado: registroEnEdicionActual ? registroEnEdicionActual.estado : 'GENERADO',
                auditoriaGeneracion: registroEnEdicionActual ? registroEnEdicionActual.auditoriaGeneracion : null,
                auditoriaVigilanciaSalida: registroEnEdicionActual ? registroEnEdicionActual.auditoriaVigilanciaSalida : null,
                auditoriaVigilanciaIngreso: registroEnEdicionActual ? registroEnEdicionActual.auditoriaVigilanciaIngreso : null,
                auditoriaRecepcion: registroEnEdicionActual ? registroEnEdicionActual.auditoriaRecepcion : null
            });
        };

        window.generarReporteTrasladoPDF = async function() {
            const recibe = document.getElementById('tr-recibe').value;
            if (!recibe) {
                Swal.fire('Atención', 'Seleccione quién recibe antes de generar el reporte.', 'warning');
                return;
            }

            const paquetes = Array.from(document.querySelectorAll("#tabla-traslados tbody tr")).map(tr => {
                const desde = tr.querySelector('.tr-desde').value.trim();
                const hasta = tr.querySelector('.tr-hasta').value.trim();
                const inputs = tr.querySelectorAll('input, select');
                return { 
                    paqueteDesde: desde,
                    paqueteHasta: hasta || desde,
                    rangoTexto: hasta && hasta !== desde ? `${desde} al ${hasta}` : desde,
                    cantidad: parseInt(tr.querySelector('.tr-cant').textContent, 10) || 1,
                    juzgado: inputs[2].value, 
                    repoSalida: inputs[3].value, 
                    repoIngreso: inputs[4].value, 
                    motivo: inputs[5].value 
                };
            });

            if (paquetes.length === 0) {
                Swal.fire('Atención', 'Agregue al menos un rango de paquetes antes de generar el reporte de traslado.', 'warning');
                return;
            }

            await construirPDFTraslado({
                correlativo: idTrasladoEnEdicion ? baseDatosTraslados.find(r => r.id === idTrasladoEnEdicion)?.correlativo : await obtenerSiguienteCorrelativoTraslado(),
                fecha: document.getElementById('tr-fecha').value,
                entregado: document.getElementById('tr-entregado').value,
                recibe,
                paquetes
            });
        };

        window.generarPDFReingresoDesdeRegistro = async function(id) {
            const registro = baseDatosReingresos.find(r => r.id === id);
            if (!registro) return;
            await construirPDFReingreso({
                correlativo: registro.correlativo ?? '-',
                fecha: registro.fecha,
                solicitante: registro.solicitante,
                local: registro.local,
                localSalida: registro.localSalida || '',
                entregado: registro.entregado,
                expedientes: registro.expedientes || [],
                estado: registro.estado || 'GENERADO',
                auditoriaGeneracion: registro.auditoriaGeneracion,
                auditoriaVigilanciaSalida: registro.auditoriaVigilanciaSalida,
                auditoriaVigilanciaIngreso: registro.auditoriaVigilanciaIngreso,
                auditoriaRecepcion: registro.auditoriaRecepcion
            });
        };

        window.generarPDFTrasladoDesdeRegistro = async function(id) {
            const registro = baseDatosTraslados.find(r => r.id === id);
            if (!registro) return;
            await construirPDFTraslado({
                correlativo: registro.correlativo ?? '-',
                fecha: registro.fecha,
                entregado: registro.entregado,
                recibe: registro.recibe,
                paquetes: registro.paquetes || []
            });
        };

        window.generarPDFMicroformasInstitucional = async function() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();

            const logoData = await obtenerLogoArchivoBase64();
            if (logoData) {
                doc.addImage(logoData, 'PNG', 15, 10, 18, 18);
            }

            doc.setFont("Inter", "bold");
            doc.setFontSize(11);
            doc.setTextColor(40, 40, 40);
            doc.text("CORTE SUPERIOR DE JUSTICIA DEL SANTA", pageWidth / 2, 16, { align: "center" });

            doc.setFontSize(9.5);
            doc.setFont("Inter", "normal");
            doc.text("Archivo Desconcentrado - Línea de Producción de Microformas Digitales", pageWidth / 2, 21, { align: "center" });

            doc.setFont("Inter", "bold");
            doc.setFontSize(11);
            doc.setTextColor(128, 0, 0);
            doc.text("CONTROL DE PRODUCCIÓN DE MICROFORMAS DIGITALES", pageWidth / 2, 27, { align: "center" });

            doc.setLineWidth(0.4);
            doc.setDrawColor(128, 0, 0);
            doc.line(15, 31, pageWidth - 15, 31);

            if (baseDatosMicroformas.length === 0) {
                Swal.fire('Atención', 'No hay registros de microformas para generar el PDF.', 'warning');
                return;
            }

            const aNumero = (valor) => {
                if (valor === null || valor === undefined || valor === '') return 0;
                if (typeof valor === 'number') return valor;
                const limpio = String(valor).replace(/[^\d-]/g, '');
                const n = parseInt(limpio, 10);
                return isNaN(n) ? 0 : n;
            };

            const normalizarRango = (texto) => {
                if (!texto) return texto;
                return String(texto).split(' y del ').map(parte => {
                    const m = parte.trim().match(/^(.+?)\s+al\s+(.+)$/i);
                    if (m) {
                        const desde = m[1].trim();
                        const hasta = m[2].trim();
                        return desde === hasta ? desde : `${desde} al ${hasta}`;
                    }
                    return parte.trim();
                }).join(' y del ');
            };

            let sumaPaquetes = 0;
            let sumaFolios = 0;
            let sumaImagenes = 0;
            let sumaRegistros = 0;
            let sumaExpedientes = 0;

            const filas = baseDatosMicroformas.map(item => {
                const fIni = item.fecInicio ? item.fecInicio.split('-').reverse().join('/') : '';
                const fFin = item.fecFin ? item.fecFin.split('-').reverse().join('/') : '';
                const fGrab = item.fecGrabacion ? item.fecGrabacion.split('-').reverse().join('/') : '';

                const textoRangoBase = item.rango || (
                    item.paqueteDesde && item.paqueteHasta
                        ? (item.paqueteDesde === item.paqueteHasta
                            ? `${item.paqueteDesde}`
                            : `${item.paqueteDesde} al ${item.paqueteHasta}`)
                        : 'N/A'
                );
                const textoRango = normalizarRango(textoRangoBase);

                const cantPaquetes = aNumero(item.cantPaquetes);
                const folios = aNumero(item.folios);
                const imagenes = aNumero(item.imagenes);
                const registros = aNumero(item.registros);
                const expedientes = aNumero(item.expedientes);

                sumaPaquetes += cantPaquetes;
                sumaFolios += folios;
                sumaImagenes += imagenes;
                sumaRegistros += registros;
                sumaExpedientes += expedientes;

                return [
                    item.bloque ?? 'N/A',
                    textoRango,
                    cantPaquetes,
                    item.juzgado || 'N/A',
                    folios,
                    imagenes,
                    registros,
                    expedientes,
                    item.mes || 'N/A',
                    fIni,
                    fFin,
                    fGrab
                ];
            });

            filas.push([
                'TOTAL',
                '-',
                sumaPaquetes,
                '-',
                sumaFolios,
                sumaImagenes,
                sumaRegistros,
                sumaExpedientes,
                '-',
                '-',
                '-',
                '-'
            ]);

            doc.autoTable({
                startY: 38,
                margin: { left: 15, right: 15 },
                theme: 'grid',
                tableWidth: 267,
                headStyles: { fillColor: [128, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8 },
                styles: { fontSize: 7.5, font: 'Inter', cellPadding: 2, halign: 'center', overflow: 'linebreak', valign: 'middle' },
                columnStyles: {
                    0: { cellWidth: 18 },
                    1: { cellWidth: 32 },
                    2: { cellWidth: 16 },
                    3: { cellWidth: 51 },
                    4: { cellWidth: 18 },
                    5: { cellWidth: 18 },
                    6: { cellWidth: 18 },
                    7: { cellWidth: 16 },
                    8: { cellWidth: 20 },
                    9: { cellWidth: 20 },
                    10: { cellWidth: 20 },
                    11: { cellWidth: 20 }
                },
                head: [[
                    { content: 'BLOQUE', rowSpan: 2 },
                    { content: 'RANGO PAQUETES', rowSpan: 2 },
                    { content: 'CANT. PAQ.', rowSpan: 2 },
                    { content: 'JUZGADO', rowSpan: 2 },
                    { content: 'FOLIOS / IMÁGENES', colSpan: 2 },
                    { content: 'TOTAL REG.', rowSpan: 2 },
                    { content: 'CANT. EXP.', rowSpan: 2 },
                    { content: 'MES', rowSpan: 2 },
                    { content: 'FECHAS', colSpan: 2 },
                    { content: 'GRABACIÓN', rowSpan: 2 }
                ],
                [
                    'FOLIOS',
                    'IMÁGENES',
                    'INICIO',
                    'FIN'
                ]],
                body: filas
            });

            let currentY = doc.lastAutoTable.finalY + 28;
            if (currentY > 180) { doc.addPage(); currentY = 30; }

            doc.setLineWidth(0.3);
            doc.line(70, currentY, 140, currentY);
            doc.line(160, currentY, 230, currentY);

            currentY += 4;
            doc.setFont("Inter", "bold");
            doc.setFontSize(8);
            doc.text("VALIDADO POR JEFATURA", 195, currentY, { align: "center" });

            currentY += 4;
            doc.setFont("Inter", "bold");
            doc.setFontSize(7.5);
            doc.text(NOMBRE_SUPERVISOR_LPMD, 105, currentY, { align: "center" });
            doc.text("RESPONSABLE DE ARCHIVO DESCONCENTRADO", 195, currentY, { align: "center" });

            currentY += 3.5;
            doc.setFont("Inter", "normal");
            doc.setFontSize(7);
            doc.text("SUPERVISOR DE LA LÍNEA DE PRODUCCIÓN DE MICROFORMAS DIGITALES (LPMD)", 105, currentY, { align: "center" });

            currentY += 3.5;
            doc.text("CORTE SUPERIOR DE JUSTICIA DEL SANTA", 105, currentY, { align: "center" });

            currentY += 8;
            const fechaGeneracionMf = new Date().toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            doc.setFont("Inter", "italic");
            doc.setFontSize(7.5);
            doc.setTextColor(90, 90, 90);
            doc.text(`Fecha de creación / impresión: ${fechaGeneracionMf}`, pageWidth / 2, currentY, { align: "center" });

            const blobUrl = doc.output('bloburl');
            const fechaHoy = new Date().toISOString().split('T')[0];
            mostrarModalPreviewPDF(blobUrl, `CONTROL_MICROFORMAS_${fechaHoy}.pdf`);
        };

        window.generarPDFDashboardGlobal = async function() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();

            const logoData = await obtenerLogoArchivoBase64();
            if (logoData) {
                doc.addImage(logoData, 'PNG', 15, 10, 18, 18);
            }

            doc.setFont("Inter", "bold"); doc.setFontSize(11); doc.setTextColor(40, 40, 40);
            doc.text("CORTE SUPERIOR DE JUSTICIA DEL SANTA", pageWidth / 2, 16, { align: "center" });
            doc.setFontSize(9.5); doc.setFont("Inter", "normal");
            doc.text("Archivo Desconcentrado - Dashboard Global Institucional", pageWidth / 2, 21, { align: "center" });

            doc.setFont("Inter", "bold"); doc.setFontSize(11); doc.setTextColor(128, 0, 0); 
            doc.text("SAAMIR - REPORTE EJECUTIVO GLOBAL", pageWidth / 2, 27, { align: "center" });
            doc.setLineWidth(0.4); doc.setDrawColor(128, 0, 0); doc.line(15, 31, pageWidth - 15, 31);

            let sT = document.getElementById('dash-total-teorico').innerText;
            let sF = document.getElementById('dash-total-faltantes').innerText;
            let sR = document.getElementById('dash-total-real').innerText;
            let pI = document.getElementById('dash-porcentaje').innerText;

            let mB = document.getElementById('dash-micro-bloques').innerText;
            let mP = document.getElementById('dash-micro-paquetes').innerText;
            let mE = document.getElementById('dash-micro-expedientes').innerText;
            let mIm = document.getElementById('dash-micro-imagenes').innerText;
            let mFo = document.getElementById('dash-micro-folios').innerText;

            let rM = document.getElementById('dash-reingresos-mes').innerText;
            let rH = document.getElementById('dash-reingresos-hoy').innerText;
            let tA = document.getElementById('dash-total-acompanados').innerText;

            doc.setFont("Inter", "bold"); doc.setFontSize(9.5); doc.setTextColor(0, 0, 0);
            doc.text("1. RESUMEN DE INVENTARIO INSTITUCIONAL", 15, 39);

            doc.autoTable({
                startY: 42,
                margin: { left: 15, right: 15 },
                theme: 'grid',
                headStyles: { fillColor: [128, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
                styles: { fontSize: 8, font: 'Inter', halign: 'center' },
                head: [['Total Teórico General', 'Total Faltantes Excluidos', 'Total Real en Custodia', 'Porcentaje de Integridad']],
                body: [[sT, sF, sR, pI]]
            });

            let currentY = doc.lastAutoTable.finalY + 10;
            doc.setFont("Inter", "bold"); doc.setFontSize(9.5);
            doc.text("2. PRODUCCIÓN DE MICROFORMAS DIGITALES (ACUMULADO)", 15, currentY);

            doc.autoTable({
                startY: currentY + 3,
                margin: { left: 15, right: 15 },
                theme: 'grid',
                headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
                styles: { fontSize: 8, font: 'Inter', halign: 'center' },
                head: [['Bloques', 'Paquetes', 'Expedientes', 'Imágenes', 'Folios']],
                body: [[mB, mP, mE, mIm, mFo]]
            });

            currentY = doc.lastAutoTable.finalY + 10;
            doc.setFont("Inter", "bold"); doc.setFontSize(9.5);
            doc.text("3. MÉTRICAS OPERATIVAS DE REINGRESOS", 15, currentY);

            doc.autoTable({
                startY: currentY + 3,
                margin: { left: 15, right: 15 },
                theme: 'grid',
                headStyles: { fillColor: [90, 90, 90], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
                styles: { fontSize: 8, font: 'Inter', halign: 'center' },
                head: [['Reingresos del Mes', 'Reingresos de Hoy', 'Total Acompañados']],
                body: [[rM, rH, tA]]
            });

            currentY = doc.lastAutoTable.finalY + 12;
            if (currentY > 270) { doc.addPage(); currentY = 30; }

            const fechaGeneracion = new Date().toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            doc.setFont("Inter", "italic"); doc.setFontSize(7.5); doc.setTextColor(90, 90, 90);
            doc.text(`Fecha de creación / impresión: ${fechaGeneracion}`, pageWidth / 2, currentY, { align: "center" });

            const blobUrl = doc.output('bloburl');
            const fechaHoy = new Date().toISOString().split('T')[0];
            mostrarModalPreviewPDF(blobUrl, `REPORTE_GLOBAL_${fechaHoy}.pdf`);
        };

        // MOTOR DE GENERACIÓN DE TARJETAS DE PAQUETES (PDF HORIZONTAL 2x1 AJUSTADO)
        async function construirPDFTarjetas({ anioIngreso, personal, tipoArchivo, repositorio, juzgado, juez, fechaRecepcion, oficio, paquetesData }) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' }); // Horizontal (landscape: 297 x 210 mm)
            
            const logoData = await obtenerLogoArchivoBase64();

            const dibujarTarjeta = (x, y, dataPaquete) => {
                const w = 130; // Ancho óptimo por tarjeta
                const h = 186; // Alto optimizado para ocupar uniformemente la página horizontal sin verse achatada

                doc.setDrawColor(30, 30, 30);
                doc.setLineWidth(0.4);
                doc.setFillColor(255, 255, 255);
                doc.rect(x, y, w, h, 'FD');

                if (logoData) {
                    doc.addImage(logoData, 'PNG', x + 5, y + 4, 12, 12);
                }
                
                doc.setFont("Inter", "bold");
                doc.setFontSize(10);
                doc.setTextColor(20, 20, 20);
                doc.text("PODER JUDICIAL DEL PERÚ", x + w / 2, y + 7, { align: "center" });
                
                doc.setFontSize(6.5);
                doc.text("CORTE SUPERIOR DE JUSTICIA DEL SANTA - ARCHIVO DESCONCENTRADO", x + w / 2, y + 11.5, { align: "center" });

                doc.setLineWidth(0.3);
                doc.line(x + 4, y + 14, x + w - 4, y + 14);

                let cursorY = y + 17;
                const altoFila = 11.5; // Espacio vertical generoso para evitar aplastamiento

                const filaDato = (label, valor) => {
                    doc.setFont("Inter", "bold");
                    doc.setFontSize(7);
                    doc.setTextColor(70, 70, 70);
                    doc.text(label, x + 5, cursorY + 4);

                    doc.setDrawColor(80, 80, 80);
                    doc.setFillColor(248, 248, 248);
                    doc.rect(x + 40, cursorY, w - 45, altoFila, 'FD');

                    doc.setFont("Inter", "bold");
                    doc.setFontSize(8.5);
                    doc.setTextColor(10, 10, 10);
                    doc.text(String(valor || ''), x + 40 + ((w - 45) / 2), cursorY + (altoFila / 2) + 1, { align: "center" });
                    cursorY += altoFila + 2.5;
                };

                filaDato("TIPO DE ARCHIVO", tipoArchivo);
                filaDato("JUZGADO", juzgado);
                filaDato("JUEZ", juez);

                // Paquete N° (Doble caja año / número)
                doc.setFont("Inter", "bold");
                doc.setFontSize(7);
                doc.setTextColor(70, 70, 70);
                doc.text("PAQUETE N°", x + 5, cursorY + 4);

                const halfW = (w - 45) / 2;
                doc.setDrawColor(80, 80, 80);
                doc.setFillColor(248, 248, 248);
                doc.rect(x + 40, cursorY, halfW, altoFila, 'FD');
                doc.rect(x + 40 + halfW, cursorY, halfW, altoFila, 'FD');

                doc.setFont("Inter", "bold");
                doc.setFontSize(9);
                doc.text(String(anioIngreso || ''), x + 40 + (halfW / 2), cursorY + (altoFila / 2) + 1, { align: "center" });
                doc.text(String(dataPaquete.nroPaq || ''), x + 40 + halfW + (halfW / 2), cursorY + (altoFila / 2) + 1, { align: "center" });

                doc.setFont("Inter", "normal");
                doc.setFontSize(5);
                doc.setTextColor(100, 100, 100);
                doc.text("AÑO DE INGRESO", x + 40 + (halfW / 2), cursorY + altoFila + 2.5, { align: "center" });
                doc.text("NÚMERO PAQUETE", x + 40 + halfW + (halfW / 2), cursorY + altoFila + 2.5, { align: "center" });

                cursorY += altoFila + 4.5;

                filaDato("CANT. EXPEDIENTES", dataPaquete.cantExp);
                filaDato("AÑO EXPEDIENTES", dataPaquete.anioExp);
                filaDato("DOC. ING. ARCHIVO", oficio);
                filaDato("FECHA RECEPCIÓN", fechaRecepcion);
                filaDato("TRABAJADO POR", personal);
                filaDato("REPOSITORIO", repositorio);
            };

            for (let i = 0; i < paquetesData.length; i += 2) {
                if (i > 0) doc.addPage();
                
                const yPos = 12;
                dibujarTarjeta(14, yPos, paquetesData[i]);

                if (i + 1 < paquetesData.length) {
                    dibujarTarjeta(153, yPos, paquetesData[i + 1]);
                }
            }

            const blobUrl = doc.output('bloburl');
            return blobUrl;
        }

        window.guardarYGenerarPDFTarjetas = async function() {
            const anioIngreso = document.getElementById('tar-anio-ingreso').value;
            const personal = document.getElementById('tar-personal').value;
            const tipoArchivo = document.getElementById('tar-tipo-archivo').value;
            const repositorio = document.getElementById('tar-repositorio').value;
            const juzgado = document.getElementById('tar-juzgado').value.trim().toUpperCase();
            const juez = document.getElementById('tar-juez').value.trim().toUpperCase();
            const fechaRecepcionRaw = document.getElementById('tar-fecha-recepcion').value;
            const fechaRecepcion = fechaRecepcionRaw ? fechaRecepcionRaw.split('-').reverse().join('/') : '';
            const oficio = document.getElementById('tar-oficio').value.trim().toUpperCase();

            const filas = document.querySelectorAll('#tabla-tarjetas-detalles tbody tr');
            if (filas.length === 0) {
                Swal.fire('Atención', 'Agregue al menos una fila de paquete en la tabla.', 'warning');
                return;
            }

            const paquetesData = [];
            filas.forEach(tr => {
                const nroPaq = tr.querySelector('.tar-nro-paq').value.trim();
                const cantExp = tr.querySelector('.tar-cant-exp').value.trim();
                const anioExp = tr.querySelector('.tar-anio-exp').value.trim();
                if (nroPaq) {
                    paquetesData.push({ nroPaq, cantExp: cantExp || '0', anioExp: anioExp || '-' });
                }
            });

            if (paquetesData.length === 0) {
                Swal.fire('Atención', 'Ingrese al menos un número de paquete válido en las filas.', 'warning');
                return;
            }

            const currentUserObj = auth.currentUser;
            const currentUserName = obtenerNombreCanonicoDeUsuario(currentUserObj);

            const tarjetaLote = {
                anioIngreso,
                personal,
                tipoArchivo,
                repositorio,
                juzgado,
                juez,
                fechaRecepcion: fechaRecepcionRaw,
                oficio,
                paquetesData,
                createdAt: Date.now(),
                activo: true,
                auditoria: { nombre: currentUserName, timestamp: Date.now() }
            };

            try {
                await addDoc(collection(db, "tarjetas_paquetes"), tarjetaLote);
                const blobUrl = await construirPDFTarjetas(tarjetaLote);
                const fechaHoy = new Date().toISOString().split('T')[0];
                mostrarModalPreviewPDF(blobUrl, `TARJETAS_PAQUETES_${fechaHoy}.pdf`);
                await cargarHistorialTarjetas();
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };

        async function cargarHistorialTarjetas() {
            try {
                const querySnapshot = await getDocs(collection(db, "tarjetas_paquetes"));
                baseDatosTarjetas = [];
                querySnapshot.forEach((docSnap) => {
                    const data = { id: docSnap.id, ...docSnap.data() };
                    if (data.activo !== false) baseDatosTarjetas.push(data);
                });
                baseDatosTarjetas.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                filtrarHistorialTarjetas();
            } catch (error) {
                console.error(error);
            }
        }

        window.filtrarHistorialTarjetas = function() {
            const fJuzgado = (document.getElementById('filtro-tar-juzgado')?.value || '').toLowerCase().trim();
            const fRepo = document.getElementById('filtro-tar-repositorio')?.value || '';
            const fTexto = (document.getElementById('busqueda-tarjetas')?.value || '').toLowerCase().trim();

            const filtrados = baseDatosTarjetas.filter(t => {
                const mJuzgado = fJuzgado === '' || (t.juzgado || '').toLowerCase().includes(fJuzgado);
                const mRepo = fRepo === '' || t.repositorio === fRepo;
                const mTexto = fTexto === '' || 
                    (t.juez || '').toLowerCase().includes(fTexto) ||
                    (t.oficio || '').toLowerCase().includes(fTexto) ||
                    (t.personal || '').toLowerCase().includes(fTexto);
                return mJuzgado && mRepo && mTexto;
            });

            renderTablaHistorialTarjetas(filtrados);
        };

        function renderTablaHistorialTarjetas(registros) {
            const tbody = document.getElementById('tabla-historial-tarjetas');
            if (!tbody) return;
            tbody.innerHTML = '';
            if (registros.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Sin bloques de tarjetas registrados.</td></tr>`;
                return;
            }
            registros.forEach(data => {
                const fechaStr = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'N/A';
                const totalPaq = data.paquetesData ? data.paquetesData.length : 0;
                const fila = `<tr>
                    <td>${fechaStr}</td>
                    <td><strong>${data.juzgado || 'N/A'}</strong><br><small class="text-muted">${data.juez || ''}</small></td>
                    <td><span class="badge bg-secondary">${data.tipoArchivo || ''}</span><br><small>${data.repositorio || ''}</small></td>
                    <td class="text-center fw-bold">${totalPaq}</td>
                    <td>${data.personal || 'N/A'}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-danger py-1 px-2 me-1" onclick="window.reimprimirTarjetas('${data.id}')" title="Generar PDF">
                            <i class="bi bi-file-pdf"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger py-1 px-2" onclick="window.eliminarTarjetasLote('${data.id}')" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>`;
                tbody.insertAdjacentHTML('beforeend', fila);
            });
        }

        window.reimprimirTarjetas = async function(id) {
            const lote = baseDatosTarjetas.find(t => t.id === id);
            if (!lote) return;
            const blobUrl = await construirPDFTarjetas(lote);
            mostrarModalPreviewPDF(blobUrl, `TARJETAS_${lote.juzgado || 'LOTE'}.pdf`);
        };

        window.eliminarTarjetasLote = async function(id) {
            const confirmacion = await Swal.fire({
                icon: 'warning',
                title: '¿Eliminar bloque de tarjetas?',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                confirmButtonColor: '#800000'
            });
            if (!confirmacion.isConfirmed) return;

            try {
                await updateDoc(doc(db, "tarjetas_paquetes", id), { activo: false });
                Swal.fire({ icon: 'success', title: 'Registro eliminado', timer: 1500, showConfirmButton: false });
                await cargarHistorialTarjetas();
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };

        window.switchView = switchView;
        window.abrirModalRango = abrirModalRango;
        window.cerrarModalRango = cerrarModalRango;
        window.filtrarRegistros = filtrarRegistros;
