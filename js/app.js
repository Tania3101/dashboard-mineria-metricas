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

//-----> Crea una fila visual simple tipo "Nombre: Valor"
function crearFilaDato(nombre, valor) {
    const fila = document.createElement("div");
    fila.className = "fila-dato";
    fila.innerHTML = `<span>${nombre}</span><span class="valor">${valor}</span>`;
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
        contenedor.appendChild(crearFilaDato("Completos", datos.complete));
        contenedor.appendChild(crearFilaDato("Fallidos", datos.failed));

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

//-----> TODO (Eber): boton para disparar /api/mining/run
document.getElementById("btn-run-mineria").addEventListener("click", async () => {
    // Eber: aqui va el POST a su endpoint /run, deshabilitar el boton
    // mientras corre, y volver a llamar cargarMineria() cuando termine.
    console.log("TODO: implementar boton de mineria");
});


// =====================================================================
// SECCION DE TANIA: extracción de métricas
// TODO (Tania): llenar esta funcion para que pinte los datos reales
// de tu API dentro de #contenido-metricas
// =====================================================================
async function cargarMetricas() {
    const contenedor = document.getElementById("contenido-metricas");

    try {
        // Tania: aqui va el fetch() a tu endpoint /api/metrics/summary

        contenedor.innerHTML = "";
        contenedor.appendChild(crearFilaDato("Pendiente de implementar", "—"));

    } catch (error) {
        mostrarError("contenido-metricas", "No se pudo conectar con la API de métricas.");
    }
}

//-----> TODO (Tania): boton para disparar /api/metrics/run
document.getElementById("btn-run-metricas").addEventListener("click", async () => {
    // Tania: aqui va el POST a tu endpoint /run
    console.log("TODO: implementar boton de metricas");
});


// =====================================================================
// ARRANQUE: al cargar la pagina, pide los datos de ambas secciones
// =====================================================================
cargarMineria();
cargarMetricas();
