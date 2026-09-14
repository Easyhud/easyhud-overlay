/* ══ Selección de agentes — generador ══════════════════════════════════════
   Pinta las dos alineaciones desde SELECCION (js/datos-seleccion.js). El
   estático ya trae este mismo marcado escrito a mano; este fichero está para
   ver de dónde sale cada dato y para conectar datos reales.                 */
/*
 * ÚNICO cambio respecto al fichero de diseño: era una función que se
 * ejecutaba sola al cargar y leía un objeto global. Ahora se la llama con
 * los datos cada vez que cambian.
 */
window.pintaSeleccion = (D) => {
  const { retratoAgente, iconoPapel } = window.HUD;

  /* Extrusión del logo: capas OPACAS del mismo dibujo, oscurecidas hacia
     atrás. Con capas semitransparentes cada borde se suma al siguiente y el
     volumen parece un halo borroso en vez de un canto sólido.
     Cada capa solo lleva su número de orden; el desplazamiento y el brillo los
     calcula el CSS a partir de --k. */
  const CAPAS = 26;
  const extruido = () => {
    let s = '';
    for (let k = 0; k < CAPAS; k++) s += '<i style="--k: ' + k + ';"></i>';
    return s;
  };

  /* ── cabecera ── */
  const cab = document.getElementById('cabecera');
  if (cab) {
    const [izq, der] = D.equipos;
    cab.innerHTML =
      '<div class="sel-cab__mitad sel-cab__mitad--izq" style="--cl: var(--atk-light);">'
        + '<div class="sel-cab__fondo sel-cab__fondo--izq" style="--logo: url(\'' + izq.logo + '\');"><div>' + extruido() + '</div></div>'
        + '<span class="sel-cab__equipo">' + izq.nombre.toUpperCase() + '</span>'
        + '<span class="sel-cab__bando">' + izq.bando + '</span>'
      + '</div>'
      + '<div class="sel-cab__vs"><span>VS</span></div>'
      + '<div class="sel-cab__mitad" style="--cl: var(--def-light);">'
        + '<span class="sel-cab__bando">' + der.bando + '</span>'
        + '<span class="sel-cab__equipo">' + der.nombre.toUpperCase() + '</span>'
        + '<div class="sel-cab__fondo sel-cab__fondo--der" style="--logo: url(\'' + der.logo + '\');"><div>' + extruido() + '</div></div>'
      + '</div>';
  }

  /* ── una celda de retrato ──
     Tres estados, y ninguno es «muerto»: en selección nadie muere, así que no
     hay apagado. Solo: sin turno, dudando y confirmado. */
  const celda = (jug, k, lado, rueda) => {
    /*
     * Quién ha confirmado y quién está eligiendo, POR JUGADOR.
     *
     * El fichero de diseño lo deducía de un contador: los `k` primeros de la
     * fila han confirmado. Sirve para maquetar, pero en una partida real el
     * orden de bloqueo no es el de la alineación —el tercero puede confirmar
     * antes que el primero— y entonces el contador señalaría al jugador
     * equivocado. El contador sigue valiendo si no viene la marca.
     */
    const elegido = jug.elegido ?? k < D.elegidos[lado];
    const eligiendo = jug.elegido === undefined
      ? k === D.elegidos[lado]
      : jug.eligiendo === true;
    /* El que duda muestra un agente de la rueda, no el suyo. */
    const agente = elegido ? jug.agente
      : eligiendo ? D.rueda[(rueda + k * 3 + lado * 5) % D.rueda.length] : null;
    const nombre = elegido ? jug.nombre
      : eligiendo ? agente.charAt(0).toUpperCase() + agente.slice(1) : 'sin elegir';

    /* El desfase va del centro hacia fuera: es como se leen las dos
       alineaciones. */
    const orden = lado === 0 ? 4 - k : k;

    const clases = 'celda' + (elegido ? ' celda--elegido' : eligiendo ? ' celda--eligiendo' : '');
    const vars = '--c: var(' + (lado ? '--def' : '--atk') + '); --cl: var('
      + (lado ? '--def-light' : '--atk-light') + '); --orden: ' + orden + ';';

    return '<div class="' + clases + '" style="' + vars + '" data-lado="' + lado + '" data-pos="' + k + '">'
      + (agente
        ? '<div class="celda__retrato" style="background-image: url(\'' + retratoAgente(agente) + '\');"></div>'
        : '<div class="celda__hueco"></div>')
      + '<div class="celda__velo"></div>'
      + '<div class="celda__info">'
        + '<span class="celda__nick">' + jug.nick + '</span>'
        + '<div class="celda__meta">'
          + (elegido ? '<div class="celda__papel" style="background-image: url(\'' + iconoPapel(jug.papel) + '\');"></div>' : '')
          + '<span class="celda__agente">' + nombre + '</span>'
        + '</div>'
      + '</div>'
      + '<div class="celda__barra"></div>'
      + '<div class="celda__destello"></div>'
      + (eligiendo ? '<span class="celda__eligiendo">eligiendo</span>' : '')
    + '</div>';
  };

  /* ── banda ── */
  let rueda = 0;
  const banda = document.getElementById('banda');
  const pinta = () => {
    if (!banda) return;
    banda.innerHTML = D.equipos.map((eq, lado) =>
      '<div class="sel-fila">' + eq.jugadores.map((j, k) => celda(j, k, lado, rueda)).join('') + '</div>'
    ).join('');
  };
  pinta();

  /* El cambio de agente y el golpe al confirmar viven en seleccion-vivo.js:
     son cambios de estado sobre el marcado, no dibujo, así que los comparte
     con el estático en vez de duplicarlos aquí. */
};
