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


//-----> 🔌 NUEVO: arma la tabla estilo consola (3 columnas: pendientes /
//-----> completos / fallidos) a partir de 3 arreglos de nombres de repo.
//-----> Si una columna tiene menos elementos que las otras, esa celda
//-----> simplemente queda vacia en esa fila.
function construirTablaMatrix(pendientes, completos, fallidos) {
    const filasMax = Math.max(pendientes.length, completos.length, fallidos.length);

    const tabla = document.createElement("table");

    const encabezado = document.createElement("tr");
    encabezado.innerHTML = `
        <th>Pendientes</th>
        <th>Completos</th>
        <th>Fallidos</th>
    `;
    tabla.appendChild(encabezado);

    if (filasMax === 0) {
        const filaVacia = document.createElement("tr");
        filaVacia.innerHTML = `<td colspan="3" class="celda-vacia">Sin repositorios todavía.</td>`;
        tabla.appendChild(filaVacia);
        return tabla;
    }

    for (let i = 0; i < filasMax; i++) {
        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td>${pendientes[i] || ""}</td>
            <td>${completos[i] || ""}</td>
            <td>${fallidos[i] || ""}</td>
        `;
        tabla.appendChild(fila);
    }

    return tabla;
}

// =====================================================================
// SECCION DE EBER: minería con progreso por fase
// =====================================================================
async function cargarProgresoFases() {
    const contenedor = document.getElementById("progreso-fases");

    try {
        const res = await fetch(`${URL_API_MINERIA}/api/pipeline/stats`);
        if (!res.ok) throw new Error("Sin datos de pipeline aún");
        const stats = await res.json();

        contenedor.innerHTML = `
            <p class="texto-ayuda">${stats.totalAvailable}+ repositorios disponibles</p>
            ${barraFase("FASE 1", stats.phase1Approved, stats.totalAvailable)}
            ${barraFase("FASE 2", stats.phase2Approved, stats.phase1Approved)}
            ${barraFase("FASE 3 — Filtro técnico", stats.phase3Approved, stats.phase2Approved)}
            <p class="fila-dato">Scoring completado <span class="valor exito">${stats.scoredCount} repos</span></p>
        `;

        if (stats.phase3Approved > 0 && stats.scoredCount === stats.phase3Approved) {
            document.getElementById("banner-completo").style.display = "block";
        }

    } catch (error) {
        contenedor.innerHTML = `<p class="texto-ayuda">Aún no hay una corrida completa del pipeline.</p>`;
    }
}

function barraFase(nombre, aprobados, base) {
    const porcentaje = base > 0 ? Math.round((aprobados / base) * 100) : 0;
    return `
        <div class="fila-dato">
            <span>${nombre}: ${aprobados} aprobados</span>
        </div>
        <div style="background:var(--color-neutro-fondo); border-radius:8px; height:8px; overflow:hidden; margin-bottom:0.5rem;">
            <div style="width:${porcentaje}%; background:var(--color-primario); height:100%;"></div>
        </div>
    `;
}

async function cargarRankingMineria() {
    const contenedor = document.getElementById("lista-ranking-mineria");

    try {
        const res = await fetch(`${URL_API_MINERIA}/api/ranking/all`);
        const repos = await res.json();

        const top5 = repos.slice(0, 5);
        const resto = repos.slice(5);

        let html = "<table><thead><tr><th>Rank</th><th>Repo</th><th>Score</th></tr></thead><tbody>";

        top5.forEach(r => {
            html += `<tr><td>⭐ #${r.rank}</td><td>${r.fullName}</td><td>${r.totalScore.toFixed(1)}</td></tr>`;
        });
        resto.forEach(r => {
            html += `<tr><td>#${r.rank}</td><td>${r.fullName}</td><td>${r.totalScore.toFixed(1)}</td></tr>`;
        });

        html += "</tbody></table>";
        contenedor.innerHTML = html;

    } catch (error) {
        contenedor.innerHTML = `<p class="texto-ayuda">Sin datos de ranking aún.</p>`;
    }
}

document.getElementById("btn-refresh-mineria").addEventListener("click", () => {
    cargarProgresoFases();
    cargarRankingMineria();
});

document.getElementById("btn-export-csv").addEventListener("click", () => {
    window.open(`${URL_API_MINERIA}/api/export/csv`, "_blank");
});

//-----> Boton para disparar /api/mining/run, con polling hasta que termine.
//-----> El nuevo HTML ya no tiene el span "estado-mineria", asi que el
//-----> propio boton muestra el estado en su texto mientras corre.
document.getElementById("btn-run-mineria").addEventListener("click", async () => {
    const boton = document.getElementById("btn-run-mineria");
    boton.disabled = true;
    boton.textContent = "Iniciando...";

    try {
        await fetch(`${URL_API_MINERIA}/api/mining/run`, { method: "POST" });
        boton.textContent = "Corriendo...";
        pollEstadoMineria(boton);
    } catch (error) {
        boton.textContent = "Error al iniciar";
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
                boton.textContent = "Corriendo...";
            } else if (status === "completed") {
                clearInterval(intervalo);
                boton.textContent = "Correr minería";
                boton.disabled = false;
                cargarProgresoFases();
                cargarRankingMineria();
            } else if (status.startsWith("error")) {
                clearInterval(intervalo);
                boton.textContent = "Error en el proceso";
                boton.disabled = false;
            }
        } catch (error) {
            clearInterval(intervalo);
            boton.textContent = "Error de conexión";
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
        contenedor.appendChild(crearFilaDato("Completados", statusRepos.metrics_complete, "exito"));
        contenedor.appendChild(crearFilaDato("Fallidos", statusRepos.metrics_failed, "error"));

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

//-----> Llena el selector con los repos que aun faltan por analizar
async function cargarRepoUnicoSelect() {
    const select = document.getElementById("select-repo-unico");

    try {
        const respuesta = await fetch(`${URL_API_METRICAS}/api/metrics/repos`);

        if (!respuesta.ok) {
            throw new Error(`La API respondio con error ${respuesta.status}`);
        }

        const repos = await respuesta.json();
        const pendientes = repos.filter(r => !r.status || r.status === "pending");

        select.innerHTML = "";

        if (pendientes.length === 0) {
            select.innerHTML = `<option value="">No hay repos pendientes</option>`;
            return;
        }

        const opcionInicial = document.createElement("option");
        opcionInicial.value = "";
        opcionInicial.textContent = `Selecciona un repo (${pendientes.length} pendientes)`;
        select.appendChild(opcionInicial);

        pendientes.forEach(repo => {
            const opcion = document.createElement("option");
            opcion.value = repo._id;
            opcion.textContent = repo._id;
            select.appendChild(opcion);
        });

    } catch (error) {
        select.innerHTML = `<option value="">⚠️ No se pudo cargar la lista de repos</option>`;
    }
}

//-----> Boton para disparar /api/metrics/run?repo=... para el repo elegido
document.getElementById("btn-run-repo-unico").addEventListener("click", async () => {
    const boton = document.getElementById("btn-run-repo-unico");
    const select = document.getElementById("select-repo-unico");
    const idRepo = select.value;
    const elementoEstado = document.getElementById("estado-repo-unico");

    if (idRepo === "") {
        elementoEstado.textContent = "Selecciona un repo de la lista.";
        return;
    }

    //-----> 🔌 NUEVO: limpia las fases del analisis anterior antes de arrancar uno nuevo
    document.getElementById("fases-repo-unico").innerHTML = "";

    try {
        boton.disabled = true;
        boton.textContent = "Iniciando...";
        elementoEstado.innerHTML = `<span class="spinner"></span>Iniciando...`;

        const respuesta = await fetch(
            `${URL_API_METRICAS}/api/metrics/run?repo=${encodeURIComponent(idRepo)}`,
            { method: "POST" }
        );

        if (respuesta.status === 409) {
            elementoEstado.textContent = "⚠️ Ya hay un proceso corriendo, espera a que termine.";
            boton.disabled = false;
            boton.textContent = "Analizar";
            return;
        }

        elementoEstado.innerHTML = `<span class="spinner"></span>Iniciando análisis de: ${idRepo}...`;
        revisarEstadoMetricas(boton, idRepo);

    } catch (error) {
        elementoEstado.textContent = "⚠️ Error al iniciar.";
        boton.disabled = false;
        boton.textContent = "Analizar";
    }
});

//-----> 🔌 NUEVO: nombres legibles para cada fase que manda el backend
const NOMBRES_FASE = {
    estatica: "Métricas estáticas",
    benchmarks: "Benchmarks",
    caminos: "Cronómetro de caminos"
};

//-----> 🔌 NUEVO: pinta la lista de fases; cada una se queda fija en pantalla
//-----> con spinner mientras corre, palomita si termino bien, o equis si
//-----> fallo / se omitio (por ejemplo si benchmarks fallo y caminos nunca corrio).
function renderizarFases(fases) {
    const contenedor = document.getElementById("fases-repo-unico");
    contenedor.innerHTML = "";

    fases.forEach(fase => {
        //-----> Las que ni siquiera han arrancado no se muestran todavia
        if (fase.estado === "pendiente") return;

        const fila = document.createElement("div");
        fila.className = "fila-fase";

        let icono = "";
        let mensajeExtra = "";

        switch (fase.estado) {
            case "en_progreso":
                icono = `<span class="spinner"></span>`;
                break;
            case "completada":
                icono = `<span class="icono-fase-ok">✓</span>`;
                break;
            case "fallida":
                icono = `<span class="icono-fase-error">✗</span>`;
                mensajeExtra = " — revisa el CSV de incidencias";
                break;
            case "omitida":
                icono = `<span class="icono-fase-error">✗</span>`;
                mensajeExtra = " — no se ejecutó, revisa el CSV de incidencias";
                break;
        }

        fila.innerHTML = `${icono}<span>${NOMBRES_FASE[fase.nombre] || fase.nombre}${mensajeExtra}</span>`;
        contenedor.appendChild(fila);
    });
}

//-----> Antes un solo hipo de red hacia clearInterval() de inmediato; ahora
//-----> solo se da por vencido despues de varios fallos SEGUIDOS.
const INTENTOS_FALLIDOS_ANTES_DE_RENDIRSE = 3;

//-----> Da sensacion de progreso real mostrando cuanto tiempo lleva el analisis
function formatoTranscurrido(segundosTotales) {
    const min = Math.floor(segundosTotales / 60);
    const seg = segundosTotales % 60;
    return `${min}m ${String(seg).padStart(2, "0")}s`;
}

//-----> Revisa /api/metrics/status repetidamente hasta que el proceso termine
function revisarEstadoMetricas(botonQueDisparo, idRepo) {
    let fallosConsecutivos = 0;
    const elementoEstado = document.getElementById("estado-repo-unico");
    const inicio = Date.now();

    const intervalo = setInterval(async () => {
        try {
            const respuesta = await fetch(`${URL_API_METRICAS}/api/metrics/status`);
            if (!respuesta.ok) {
                throw new Error(`HTTP ${respuesta.status}`);
            }
            const estado = await respuesta.json();

            //-----> Una respuesta exitosa reinicia el contador de fallos
            fallosConsecutivos = 0;

            //-----> 🔌 NUEVO: pinta el progreso por fase, siempre con lo mas reciente
            renderizarFases(estado.fases || []);

            if (!estado.corriendo) {
                clearInterval(intervalo);
                botonQueDisparo.disabled = false;
                botonQueDisparo.textContent = "Analizar";
                elementoEstado.textContent = `✅ Terminado: ${idRepo}`;

                cargarMetricas();
                cargarRepoUnicoSelect();
            } else {
                //-----> 🔌 MODIFICADO: el detalle de fase ahora vive en renderizarFases(),
                //-----> aqui solo queda el mensaje generico + contador de tiempo
                const transcurrido = formatoTranscurrido(Math.floor((Date.now() - inicio) / 1000));
                elementoEstado.innerHTML =
                    `<span class="spinner"></span>Corriendo análisis de ${idRepo} · ${transcurrido}`;
            }
        } catch (error) {
            fallosConsecutivos++;

            if (fallosConsecutivos < INTENTOS_FALLIDOS_ANTES_DE_RENDIRSE) {
                elementoEstado.innerHTML = `<span class="spinner"></span>Reintentando conexión...`;
                return;
            }

            clearInterval(intervalo);
            botonQueDisparo.disabled = false;
            botonQueDisparo.textContent = "Analizar";
            elementoEstado.textContent = "⚠️ Error de conexión";
        }
    }, 5000);
}


// =====================================================================
// ARRANQUE: al cargar la pagina, pide los datos de ambas secciones
// =====================================================================
cargarProgresoFases();
cargarRankingMineria();
cargarMetricas();
cargarRepoUnicoSelect();