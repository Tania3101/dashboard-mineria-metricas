// =====================================================================
// CONFIGURACION: las URLs base de las dos APIs.
// Cada quien reemplaza la suya con su URL real de Render.
// =====================================================================
const URL_API_MINERIA   = "https://mining-api-ilqr.onrender.com";
const URL_API_METRICAS  = "https://sd-java-metrics-extractor.onrender.com";


// =====================================================================
// FUNCIONES DE AYUDA (ya listas, no hay que tocarlas)
// =====================================================================

//-----> Cambia el texto y el color de la etiqueta de estado
function actualizarEtiquetaEstado(idEtiqueta, texto, tipo) {
    // tipo puede ser: "exito", "alerta", "error", o vacio (neutro)
    const etiqueta = document.getElementById(idEtiqueta);
    etiqueta.textContent = texto;
    etiqueta.className = "etiqueta-estado" + (tipo ? " " + tipo : "");
}

//-----> Crea una fila visual tipo "Nombre: Valor".
//-----> El tercer parametro es opcional: "exito", "error" o "alerta"
//-----> para que el numero se pinte de verde/rojo/amarillo. Si no se
//-----> manda, el valor se ve en negro normal (como antes).
function crearFilaDato(nombre, valor, tipo) {
    const fila = document.createElement("div");
    fila.className = "fila-dato";

    const claseValor = "valor" + (tipo ? " " + tipo : "");
    fila.innerHTML = `<span>${nombre}</span><span class="${claseValor}">${valor}</span>`;
    return fila;
}

//-----> Limpia un contenedor y le pone un mensaje de error legible
function mostrarError(idContenedor, mensaje) {
    const contenedor = document.getElementById(idContenedor);
    contenedor.innerHTML = "";
    const p = document.createElement("p");
    p.className = "texto-ayuda";
    p.textContent = "⚠️ " + mensaje;
    contenedor.appendChild(p);
}

// =====================================================================
// SECCION DE EBER: minería de repositorios
// =====================================================================
async function cargarMineria() {
    const contenedor = document.getElementById("contenido-mineria");

    try {
        const respuesta = await fetch(`${URL_API_MINERIA}/api/catalog/status`);
        const datos = await respuesta.json();

        contenedor.innerHTML = "";
        contenedor.appendChild(crearFilaDato("Pendientes", datos.pending));
        contenedor.appendChild(crearFilaDato("Completos", datos.complete, "exito"));
        contenedor.appendChild(crearFilaDato("Fallidos", datos.failed, "error"));

        // Actualiza también la etiqueta de estado con un resumen rápido
        if (datos.pending === 0) {
            actualizarEtiquetaEstado("estado-mineria", "Todo procesado", "exito");
        } else {
            actualizarEtiquetaEstado("estado-mineria", `${datos.pending} pendientes`, "alerta");
        }

    } catch (error) {
        mostrarError("contenido-mineria", "No se pudo conectar con la API de minería.");
        actualizarEtiquetaEstado("estado-mineria", "Error de conexión", "error");
    }
}

//-----> Boton para disparar /api/mining/run, con polling hasta que termine
document.getElementById("btn-run-mineria").addEventListener("click", async () => {
    const boton = document.getElementById("btn-run-mineria");
    boton.disabled = true;
    actualizarEtiquetaEstado("estado-mineria", "Iniciando...", "alerta");

    try {
        await fetch(`${URL_API_MINERIA}/api/mining/run`, { method: "POST" });
        pollEstadoMineria(boton);
    } catch (error) {
        actualizarEtiquetaEstado("estado-mineria", "Error al iniciar", "error");
        boton.disabled = false;
    }
});

//-----> Revisa el estado cada 5 segundos hasta que el pipeline termine
function pollEstadoMineria(boton) {
    const intervalo = setInterval(async () => {
        try {
            const respuesta = await fetch(`${URL_API_MINERIA}/api/mining/status`);
            const status = await respuesta.text();

            if (status === "running") {
                actualizarEtiquetaEstado("estado-mineria", "Corriendo...", "alerta");
            } else if (status === "completed") {
                clearInterval(intervalo);
                actualizarEtiquetaEstado("estado-mineria", "Completado", "exito");
                boton.disabled = false;
                cargarMineria(); // refresca con los datos nuevos
            } else if (status.startsWith("error")) {
                clearInterval(intervalo);
                actualizarEtiquetaEstado("estado-mineria", "Error en el proceso", "error");
                boton.disabled = false;
            }
        } catch (error) {
            clearInterval(intervalo);
            actualizarEtiquetaEstado("estado-mineria", "Error de conexión", "error");
            boton.disabled = false;
        }
    }, 5000);
}


// =====================================================================
// SECCION DE TANIA: extracción de métricas
// =====================================================================
async function cargarMetricas() {
    const contenedor = document.getElementById("contenido-metricas");

    try {
        // 1. Pide los datos a tu API
        const respuesta = await fetch(`${URL_API_METRICAS}/api/metrics/summary`);

        // 2. Si la API respondio con un error (ej. 500), lo detectamos aqui
        if (!respuesta.ok) {
            throw new Error(`La API respondio con error ${respuesta.status}`);
        }

        // 3. Convierte la respuesta a un objeto de JavaScript que podamos usar
        const datos = await respuesta.json();

        // 4. Limpia el mensaje de "Cargando..." antes de poner los datos reales
        contenedor.innerHTML = "";

        // 5. Pinta cada status del catalogo como una fila, con su color
        const statusRepos = datos.reposPorStatus;
        contenedor.appendChild(crearFilaDato("Pendientes", statusRepos.pending));
        contenedor.appendChild(crearFilaDato("En progreso", statusRepos.metrics_in_progress, "alerta"));
        contenedor.appendChild(crearFilaDato("Completados", statusRepos.metrics_complete, "exito"));
        contenedor.appendChild(crearFilaDato("Fallidos", statusRepos.metrics_failed, "error"));

        // 6. Pinta el espacio usado en Mongo
        contenedor.appendChild(
            crearFilaDato("Espacio usado (métricas estáticas)", datos.espacioRepoClassMetricsMB + " MB")
        );

    } catch (error) {
        mostrarError("contenido-metricas", "No se pudo conectar con la API de métricas.");
    }
}

//-----> Boton para disparar /api/metrics/run, con polling hasta que termine
document.getElementById("btn-run-metricas").addEventListener("click", async () => {
    const boton = document.getElementById("btn-run-metricas");

    try {
        boton.disabled = true;
        boton.textContent = "Iniciando...";

        const respuesta = await fetch(`${URL_API_METRICAS}/api/metrics/run`, {
            method: "POST"
        });

        if (respuesta.status === 409) {
            actualizarEtiquetaEstado("estado-metricas", "Ya hay un proceso corriendo", "alerta");
            boton.disabled = false;
            boton.textContent = "Correr análisis de métricas";
            return;
        }

        actualizarEtiquetaEstado("estado-metricas", "Corriendo...", "alerta");
        boton.textContent = "Corriendo...";

        revisarEstadoMetricas(boton);

    } catch (error) {
        actualizarEtiquetaEstado("estado-metricas", "Error al iniciar", "error");
        boton.disabled = false;
        boton.textContent = "Correr análisis de métricas";
    }
});

//-----> Revisa /api/metrics/status repetidamente hasta que el proceso termine
function revisarEstadoMetricas(boton) {
    const intervalo = setInterval(async () => {
        try {
            const respuesta = await fetch(`${URL_API_METRICAS}/api/metrics/status`);
            const estado = await respuesta.json();

            if (!estado.corriendo) {
                clearInterval(intervalo);
                boton.disabled = false;
                boton.textContent = "Correr análisis de métricas";
                actualizarEtiquetaEstado("estado-metricas", "Completado", "exito");
                cargarMetricas();
            }
        } catch (error) {
            clearInterval(intervalo);
            boton.disabled = false;
            boton.textContent = "Correr análisis de métricas";
            actualizarEtiquetaEstado("estado-metricas", "Error de conexión", "error");
        }
    }, 5000);
}


// =====================================================================
// ARRANQUE: al cargar la pagina, pide los datos de ambas secciones
// =====================================================================
cargarMineria();
cargarMetricas();