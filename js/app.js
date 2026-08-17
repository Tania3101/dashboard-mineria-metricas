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

//-----> 🔌 NUEVO: convierte un valor de metricsStatus ("pending",
//-----> "complete", o ausente) en una palabra + color legibles
function traducirFaseStatus(valor) {
    if (valor === "complete") return { texto: "Completa", tipo: "exito" };
    if (valor === "pending") return { texto: "Pendiente", tipo: "alerta" };
    return { texto: "Sin iniciar", tipo: "" };
}

//-----> 🔌 NUEVO: crea la fila visual de un repo en progreso, mostrando
//-----> por separado como va su fase estatica y su fase dinamica
function crearFilaRepoEnProgreso(idRepo, metricsStatus) {
    const fila = document.createElement("div");
    fila.className = "fila-repo";

    const status = metricsStatus || {};
    const estatica = traducirFaseStatus(status.static);
    const dinamica = traducirFaseStatus(status.dynamic);

    fila.innerHTML = `
        <span class="fila-repo-nombre">${idRepo}</span>
        <span class="fila-repo-badges">
            <span class="badge-fase ${estatica.tipo}">Estática: ${estatica.texto}</span>
            <span class="badge-fase ${dinamica.tipo}">Dinámica: ${dinamica.texto}</span>
        </span>
    `;
    return fila;
}

//-----> 🔌 NUEVO: crea la fila visual de un repo "solo estatico completo",
//-----> mostrando la razon por la que la fase dinamica no genero datos
function crearFilaRepoSoloEstatico(idRepo, razonSinDatos) {
    const fila = document.createElement("div");
    fila.className = "fila-repo";

    fila.innerHTML = `
        <span class="fila-repo-nombre">${idRepo}</span>
        <span class="texto-ayuda">${razonSinDatos || "Sin razón registrada."}</span>
    `;
    return fila;
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
                cargarMineria();
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
        const respuesta = await fetch(`${URL_API_METRICAS}/api/metrics/summary`);

        if (!respuesta.ok) {
            throw new Error(`La API respondio con error ${respuesta.status}`);
        }

        const datos = await respuesta.json();

        contenedor.innerHTML = "";

        const statusRepos = datos.reposPorStatus;
        contenedor.appendChild(crearFilaDato("Pendientes", statusRepos.pending));
        contenedor.appendChild(crearFilaDato("En progreso", statusRepos.metrics_in_progress, "alerta"));
        //-----> 🔌 NUEVO: repos con estatica completa pero sin datos dinamicos
        contenedor.appendChild(crearFilaDato("Solo estáticos", statusRepos.metrics_static_only, "alerta"));
        contenedor.appendChild(crearFilaDato("Completados", statusRepos.metrics_complete, "exito"));
        contenedor.appendChild(crearFilaDato("Fallidos", statusRepos.metrics_failed, "error"));

        // 🔌 NUEVO: suma los 3 pedazos de espacio en vez de mostrar solo
        // el de metricas estaticas
        const espacioTotalMB =
            (datos.espacioRepoCatalogMB || 0) +
            (datos.espacioRepoClassMetricsMB || 0) +
            (datos.espacioRepoDynamicMetricsMB || 0);

        contenedor.appendChild(
            crearFilaDato("Espacio total usado en Mongo", espacioTotalMB.toFixed(2) + " MB")
        );

    } catch (error) {
        mostrarError("contenido-metricas", "No se pudo conectar con la API de métricas.");
    }
}

//-----> 🔌 NUEVO: carga la lista de repos "en progreso" con el detalle
//-----> de en que fase van (estatica/dinamica)
async function cargarReposEnProgreso() {
    const contenedor = document.getElementById("lista-en-progreso");

    try {
        const respuesta = await fetch(`${URL_API_METRICAS}/api/metrics/repos`);

        if (!respuesta.ok) {
            throw new Error(`La API respondio con error ${respuesta.status}`);
        }

        const repos = await respuesta.json();
        const enProgreso = repos.filter(r => r.status === "metrics_in_progress");

        contenedor.innerHTML = "";

        if (enProgreso.length === 0) {
            const p = document.createElement("p");
            p.className = "texto-ayuda";
            p.textContent = "Ningún repo en progreso ahora mismo.";
            contenedor.appendChild(p);
            return;
        }

        enProgreso.forEach(repo => {
            contenedor.appendChild(crearFilaRepoEnProgreso(repo._id, repo.metricsStatus));
        });

    } catch (error) {
        mostrarError("lista-en-progreso", "No se pudo cargar la lista de repos en progreso.");
    }
}

//-----> 🔌 NUEVO: carga la lista de repos "solo estatico completo" (la fase
//-----> estatica termino bien, pero la dinamica no genero datos), con la
//-----> razon guardada por el backend en metrics.dinamicas.razonSinDatos
async function cargarReposSoloEstaticos() {
    const contenedor = document.getElementById("lista-solo-estaticos");

    try {
        const respuesta = await fetch(`${URL_API_METRICAS}/api/metrics/repos`);

        if (!respuesta.ok) {
            throw new Error(`La API respondio con error ${respuesta.status}`);
        }

        const repos = await respuesta.json();
        const soloEstaticos = repos.filter(r => r.status === "metrics_static_only");

        contenedor.innerHTML = "";

        if (soloEstaticos.length === 0) {
            const p = document.createElement("p");
            p.className = "texto-ayuda";
            p.textContent = "Ningún repo en este estado ahora mismo.";
            contenedor.appendChild(p);
            return;
        }

        soloEstaticos.forEach(repo => {
            const razon = repo.metrics && repo.metrics.dinamicas
                ? repo.metrics.dinamicas.razonSinDatos
                : null;
            contenedor.appendChild(crearFilaRepoSoloEstatico(repo._id, razon));
        });

    } catch (error) {
        mostrarError("lista-solo-estaticos", "No se pudo cargar la lista de repos solo-estáticos.");
    }
}

//-----> Boton para disparar /api/metrics/run (TODOS los pendientes)
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

        revisarEstadoMetricas(boton, null);

    } catch (error) {
        actualizarEtiquetaEstado("estado-metricas", "Error al iniciar", "error");
        boton.disabled = false;
        boton.textContent = "Correr análisis de métricas";
    }
});

//-----> 🔌 NUEVO: boton para disparar /api/metrics/run?repo=... (UN repo)
document.getElementById("btn-run-repo-unico").addEventListener("click", async () => {
    const boton = document.getElementById("btn-run-repo-unico");
    const input = document.getElementById("input-repo-unico");
    const idRepo = input.value.trim();

    if (idRepo === "") {
        actualizarEtiquetaEstado("estado-repo-unico", "Escribe el nombre del repo (owner/nombre)", "alerta");
        return;
    }

    try {
        boton.disabled = true;
        boton.textContent = "Iniciando...";
        document.getElementById("estado-repo-unico").textContent = "";

        const respuesta = await fetch(
            `${URL_API_METRICAS}/api/metrics/run?repo=${encodeURIComponent(idRepo)}`,
            { method: "POST" }
        );

        if (respuesta.status === 409) {
            document.getElementById("estado-repo-unico").textContent =
                "⚠️ Ya hay un proceso corriendo, espera a que termine.";
            boton.disabled = false;
            boton.textContent = "Analizar solo este repo";
            return;
        }

        document.getElementById("estado-repo-unico").textContent = `Corriendo análisis de: ${idRepo}...`;
        revisarEstadoMetricas(boton, idRepo);

    } catch (error) {
        document.getElementById("estado-repo-unico").textContent = "⚠️ Error al iniciar.";
        boton.disabled = false;
        boton.textContent = "Analizar solo este repo";
    }
});

//-----> Revisa /api/metrics/status repetidamente hasta que el proceso
//-----> termine. Si "idRepo" no es null, es el boton de "un solo repo"
//-----> el que se reactiva; si es null, es el boton general.
function revisarEstadoMetricas(botonQueDisparo, idRepo) {
    const intervalo = setInterval(async () => {
        try {
            const respuesta = await fetch(`${URL_API_METRICAS}/api/metrics/status`);
            const estado = await respuesta.json();

            if (!estado.corriendo) {
                clearInterval(intervalo);
                botonQueDisparo.disabled = false;

                if (idRepo) {
                    botonQueDisparo.textContent = "Analizar solo este repo";
                    document.getElementById("estado-repo-unico").textContent =
                        `✅ Terminado: ${idRepo}`;
                } else {
                    botonQueDisparo.textContent = "Correr análisis de métricas";
                    actualizarEtiquetaEstado("estado-metricas", "Completado", "exito");
                }

                // Refresca todo lo que pudo haber cambiado
                cargarMetricas();
                cargarReposEnProgreso();
                cargarReposSoloEstaticos();
            }
        } catch (error) {
            clearInterval(intervalo);
            botonQueDisparo.disabled = false;
            botonQueDisparo.textContent = idRepo ? "Analizar solo este repo" : "Correr análisis de métricas";
            actualizarEtiquetaEstado("estado-metricas", "Error de conexión", "error");
        }
    }, 5000);
}


// =====================================================================
// ARRANQUE: al cargar la pagina, pide los datos de ambas secciones
// =====================================================================
cargarMineria();
cargarMetricas();
cargarReposEnProgreso();
cargarReposSoloEstaticos();