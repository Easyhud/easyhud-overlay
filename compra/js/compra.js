/* ══ Fase de compra ═════════════════════════════════════════════════════════
   Construye el tablero a partir de window.COMPRA. Los estilos viven en
   css/compra.css; aquí solo se decide QUÉ se pinta, no cómo se ve. */
/*
 * ÚNICO cambio respecto al fichero que salió de diseño: esto era una función
 * que se ejecutaba sola al cargar y leía `window.COMPRA` una vez. Ahora es
 * una función con nombre que se llama cada vez que cambian los datos.
 *
 * El resto —qué se pinta y en qué orden— está intacto.
 */
window.pintaCompra = (D) => {
  const { iconoAgente, iconoArma, iconoHabilidad, iconoUltimate, CREDITOS, recortePoligono, tramos } = window.HUD;

  /** Créditos con punto de miles SIEMPRE (3.900, 10.500): `toLocaleString('es-ES')` no agrupa las cifras de cuatro dígitos. */
  const miles = (n) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const el = (t, c) => { const n = document.createElement(t); if (c) n.className = c; return n; };
  const fondo = u => 'background-image:url(' + u + ')';
  const CAPAS = 26;   // capas del logo extruido

  const ESCUDO = {
    heavy: './assets/escudo-pesado.png',
    light: './assets/escudo-ligero.png',
    regen: './assets/escudo-regen.png'
  };
  const TG = 'https://trackercdn.com/cdn/tracker.gg/valorant/icons/';
  const MOTIVO = {
    elim: TG + 'eliminationwin1.png',
    detonate: TG + 'explosionwin1.png',
    defuse: TG + 'diffusewin1.png',
    time: TG + 'timewin1.png'
  };

  /*
   * El color de cada equipo sigue a su BANDO, no a su lado: el equipo se queda
   * donde está toda la partida (como en el marcador del combate) y en la
   * segunda mitad cambia de color. Sin `D.lados` (fotograma suelto), por lado.
   */
  const colorDe = (i) => {
    const bando = D.lados?.[i];
    const ataca = bando === 'attack' ? true : bando === 'defense' ? false : i === 0;
    // Atacante ROJO, defensor VERDE (el verde suave de compra es el del defensor).
    return ataca
      ? { c: 'var(--def)', cl: 'var(--def-light)', luzSerie: 'var(--def-light)' }
      : { c: 'var(--atk)', cl: 'var(--atk-claro)', luzSerie: 'var(--atk-light)' };
  };

  /* ── Media fila ─────────────────────────────────────────────────────────── */
  function mitad(p, lado) {
    const der = lado === 1;
    const m = el('div', 'mitad' + (der ? ' mitad--der' : '') + (p?.desconectado ? ' mitad--desconectada' : ''));
    const color = colorDe(lado);
    m.style.setProperty('--c', color.c);
    m.style.setProperty('--cl', color.cl);

    /* Sin jugador —roster incompleto: la fuente no trajo a los cinco— se
       devuelve media fila vacía en vez de reventar el tablero entero. */
    if (!p) return m;

    /* Sin coste conocido (0) no está lista, y el polígono no baja de tres. */
    const lados = Math.max(3, p.ultMax);
    const lista = p.ultMax > 0 && p.ult >= p.ultMax;
    /* El claro del atacante en compra es el verde suave, no el celeste-verdoso
       que usa la barra de vida en combate. */
    const luz = color.cl;
    const col = color.c;

    /* Insignia de definitiva: polígono de tantos lados como puntos cuesta. */
    const ulti = el('div', 'ulti-c' + (lista ? ' ulti-c--lista' : ''));
    const trazo = el('div', 'ulti-c__trazo');
    trazo.style.cssText = recortePoligono(lados);
    if (lista) trazo.style.filter = 'drop-shadow(0 0 5px rgb(255 255 255 / 85%)) drop-shadow(0 0 12px rgb(255 255 255 / 55%))';
    ulti.append(trazo);
    tramos(lados, p.ult, lista ? luz : col)
      .forEach(css => { const s = el('span'); s.style.cssText = css; ulti.append(s); });
    const dentro = el('div', 'ulti-c__dentro');
    dentro.style.cssText = recortePoligono(lados);
    dentro.innerHTML = '<i class="ulti-c__icono" style="' + fondo(iconoUltimate(p.agente)) + '"></i>';
    ulti.append(dentro);

    /* Las tres básicas, con sus rombos de carga. */
    const basicas = el('div', 'basicas');
    p.cargas.forEach((tiene, k) => {
      const w = el('div', 'hab-c');
      /* Un rombo por carga que cabe; el icono, entero / a medias / apagado. */
      const cabe = Math.max(1, tiene, p.cargasMax?.[k] ?? 0);
      const rombos = Array.from({ length: cabe },
        (_, q) => '<i class="' + (q < tiene ? 'on' : '') + '"></i>').join('');
      const estado = tiene === 0 ? ' hab-c__icono--vacio' : tiene < cabe ? ' hab-c__icono--gastada' : '';
      w.innerHTML = '<i class="hab-c__icono' + estado + '" style="'
          + fondo(iconoHabilidad(p.agente, k)) + '"></i>'
        + '<div class="hab-c__cargas">' + rombos + '</div>';
      basicas.append(w);
    });

    const hab = el('div', 'equipo-hab');
    hab.append(basicas, ulti);

    m.innerHTML =
      '<div class="mitad__filo"></div>'
      + '<div class="dinero">'
        + '<span class="dinero__gasto">' + (p.credito === null ? '' : '−' + miles(p.gasto)) + '</span>'
        + '<i class="dinero__icono" style="' + fondo(CREDITOS) + '"></i>'
        + '<span class="dinero__saldo">' + (p.credito === null ? '—' : miles(p.credito)) + '</span>'
      + '</div>'
      + '<div class="corte"></div>';
    m.append(hab);
    m.insertAdjacentHTML('beforeend',
      '<span class="elastico"></span>'
      + '<div class="corte"></div>'
      + '<div class="equipo-arma">'
        + '<i class="escudo-c' + (p.escudo === 'none' ? ' escudo-c--sin' : '') + '" style="'
          + (p.escudo === 'none' ? '' : fondo(ESCUDO[p.escudo])) + '"></i>'
        /* Como la primaria: si no hay, se apaga en vez de pedir una imagen
           que no existe. `url()` vacío hace que el navegador intente cargar
           la propia página como imagen. */
        + '<i class="arma-sec" style="'
          + (p.secundaria ? fondo(iconoArma(p.secundaria)) : 'opacity:0') + '"></i>'
        + '<i class="arma-pri' + (p.primaria ? '' : ' arma-pri--vacia') + '" style="'
          + (p.primaria ? fondo(iconoArma(p.primaria)) : '') + '"></i>'
      + '</div>'
      + '<div class="ident">'
        + '<div class="ident__retrato" style="' + fondo(iconoAgente(p.agente)) + '"></div>'
        /* El rótulo del que abandonó va DEBAJO del nick: al lado le comía el
           sitio y el nick se quedaba en una letra. */
        + '<span class="ident__nick">' + p.nick
          + (p.desconectado ? '<small class="ident__fuera">desconectado</small>' : '') + '</span>'
        + '<span class="ident__kda">' + p.kda + '</span>'
      + '</div>');
    return m;
  }

  /* ── Logo extruido del bloque de banco ──────────────────────────────────── */
  function extruido(logo) {
    const w = el('div', 'extruido');
    const orb = el('div');
    for (let k = 0; k < CAPAS; k++) {
      const i = el('i');
      const u = k / (CAPAS - 1);
      i.style.backgroundImage = 'url(' + logo + ')';
      i.style.transform = 'translate(' + ((k - (CAPAS - 1) / 2) * 0.9).toFixed(1) + 'px,'
        + (-(k - (CAPAS - 1) / 2) * 0.8).toFixed(1) + 'px)';
      if (k < CAPAS - 1) i.style.filter = 'brightness(' + (0.12 + u * 0.3).toFixed(2) + ') saturate(0)';
      orb.append(i);
    }
    w.append(orb);
    return w;
  }

  function banco(i) {
    const der = i === 1;
    const eq = D.equipos[i];
    const total = D.jugadores[i].reduce((a, p) => a + (p.credito ?? 0), 0);
    const b = el('div', 'banco' + (der ? ' banco--der' : ''));
    b.style.setProperty('--c', colorDe(i).c);
    b.append(extruido(eq.logo));
    b.insertAdjacentHTML('beforeend',
      '<div class="banco__texto">'
        + '<span class="banco__tri">' + eq.tricode + '</span>'
        + '<div class="banco__fila">'
          + '<span class="banco__etq">valor neto</span>'
          + '<i class="banco__icono" style="' + fondo(CREDITOS) + '"></i>'
          + '<span class="banco__val">' + miles(total) + '</span>'
        + '</div>'
      + '</div>');
    return b;
  }

  function tiempos(i) {
    const eq = D.equipos[i];
    const t = el('div', 'tiempos');
    t.style.setProperty('--cl', colorDe(i).cl);
    const pips = Array.from({ length: eq.tiemposTotal },
      (_, k) => '<i class="' + (k < eq.tiempos ? 'on' : '') + '"></i>').join('');
    t.innerHTML = '<span class="tiempos__etq">tiempos</span><div class="tiempos__pips">' + pips + '</div>';
    return t;
  }

  /**
   * Doce rondas por mitad: el corte va entre la 12 y la 13.
   *
   * En PRÓRROGA el bloque de la derecha se alarga. No es un capricho: estaba
   * escrito a fuego de la 13 a la 24, así que a partir de la 25 las rondas
   * simplemente desaparecían del tablero — y la prórroga es justo el momento en
   * que el público más mira el historial.
   *
   * Se alarga y no se abre un bloque nuevo porque las columnas reparten el
   * ancho entre ellas (`flex: 1 1 0`): cuatro columnas más caben solas, sin
   * desbordar la banda ni tocar el diseño.
   */
  function historial(desde, hasta) {
    const h = el('div', 'historial');
    for (let n = desde; n <= hasta; n++) {
      const jugada = n <= D.jugadas;
      const gana = jugada ? D.ganadores[n - 1] : null;
      const etq = String(n).padStart(2, '0');
      const c = el('div', 'hcol');
      if (!jugada) {
        /* Ronda futura: una sola celda con el número, sin marca. */
        c.innerHTML = '<span class="hcel hcel--pend">' + etq + '</span>';
      } else if (gana === 0 || gana === 1) {
        /*
         * `gana` es el ÍNDICE DE EQUIPO: 0 arriba, 1 abajo, fijo toda la
         * partida. El color lo pone el bando de ese equipo esa ronda —verde si
         * atacaba, rojo si defendía—, así al cambiar de mitad solo cambia el
         * color, no la fila. La otra celda lleva el número.
         */
        const color = D.bandos[n - 1] === 'attack' ? 'hcel--atk' : 'hcel--def';
        const icono = '<i style="' + fondo(MOTIVO[D.motivos[n - 1]]) + '"></i>';
        c.innerHTML =
          '<span class="hcel' + (gana === 0 ? ' hcel--gana ' + color : '') + '">'
            + (gana === 0 ? icono : etq) + '</span>'
          + '<span class="hcel' + (gana === 1 ? ' hcel--gana ' + color : '') + '">'
            + (gana === 1 ? icono : etq) + '</span>';
      } else {
        /*
         * Ronda jugada pero sin ganador conocido (la fuente no lo trajo). Se
         * pinta neutra —el número en las dos celdas, sin icono ni color— en vez
         * de inventar un bando. Mejor un hueco honesto que un ganador falso.
         */
        c.innerHTML = '<span class="hcel">' + etq + '</span><span class="hcel">' + etq + '</span>';
      }
      h.append(c);
    }
    return h;
  }

  /* ── Pintado ────────────────────────────────────────────────────────────── */
  /*
   * Se vacían los contenedores antes de construir. El tablero de compra se
   * rehace entero y no pasa nada: solo cambia cuando alguien compra, no diez
   * veces por segundo, y sus animaciones se disparan con una clase en
   * `.tablero`, que sobrevive porque el contenedor no se toca.
   */
  const banda = document.querySelector('#banda');
  banda.textContent = '';
  const izq = el('div', 'banda__mitad banda__mitad--izq');
  izq.append(banco(0), tiempos(0), historial(1, 12));
  const der = el('div', 'banda__mitad banda__mitad--der');
  /* La segunda mitad llega hasta la 24, o hasta donde haya llegado la prórroga.
     `D.jugadas` es la última ronda con resultado, así que las columnas de
     prórroga aparecen según se juegan y no antes. */
  der.append(historial(13, Math.max(24, D.jugadas)), tiempos(1), banco(1));
  banda.append(izq, der);

  const filas = document.querySelector('#filas');
  filas.textContent = '';
  /* Se recorre el máximo de los dos equipos: si la fuente trae distinto número
     de jugadores por lado (roster incompleto), no se pierde ninguno y `mitad`
     rellena el hueco del que falte. */
  const nFilas = Math.max(D.jugadores[0].length, D.jugadores[1].length);
  for (let k = 0; k < nFilas; k += 1) {
    const f = el('div', 'fila');
    f.append(mitad(D.jugadores[0][k], 0), el('div', 'fila__sep'), mitad(D.jugadores[1][k], 1));
    filas.append(f);
  }

  /* «compra 7», o «prórroga 2» en prórroga. Lo decide el adaptador; si se
     abre esta pantalla suelta con los datos de ejemplo, se cae a lo de antes. */
  document.querySelector('#ronda').textContent = D.etiquetaRonda ?? ('compra ' + D.ronda);

  /* El marcador de arriba, que en el fotograma iba escrito a mano. */
  D.equipos.forEach((equipo, i) => {
    const caja = document.querySelectorAll('.marcador .equipo')[i];
    if (caja === undefined) return;
    caja.style.setProperty('--c', colorDe(i).c);
    const logo = caja.querySelector('.equipo__logo');
    if (equipo.logo) logo.src = equipo.logo;
    logo.style.display = equipo.logo ? '' : 'none';
    caja.querySelector('.equipo__tri').textContent = equipo.tricode;
    caja.querySelector('.equipo__tanto').textContent = equipo.tanto;
  });

  /*
   * Marcadores de serie.
   *
   * Si el adaptador trae el estado de cada mapa —lo normal con servidor
   * detrás— se usa: dice cuáles se ganaron de verdad y cuál se está jugando.
   * Sin él se cuenta `mapsWon`, que es lo que había y lo que sigue valiendo
   * para mirar esta pantalla suelta.
   */
  [0, 1].forEach((i) => {
    const franja = document.querySelector(i === 0 ? '.serie--izq' : '.serie--der');
    if (franja === null) return;
    franja.style.setProperty('--cl', colorDe(i).luzSerie);
    const estados = D.serieMapas?.[i] ?? null;
    franja.textContent = '';
    for (let k = 0; k < (D.mapasParaGanar ?? 0); k += 1) {
      const marca = document.createElement('i');
      if (estados === null) {
        if (k < (D.serie[i] ?? 0)) marca.className = 'on';
      } else {
        if (estados[k] === 'gana') marca.className = 'on';
        if (estados[k] === 'en-curso') marca.className = 'en-curso';
        const titulo = D.titulosMapas?.[i]?.[k] ?? '';
        if (titulo !== '') marca.title = titulo;
      }
      franja.append(marca);
    }
  });

  /*
   * Modo mínimo: se apaga la franja de arriba y se queda el tablero.
   *
   * Es la misma regla que en combate —el realizador puede tener su propio
   * marcador— y aquí importa igual: esta pantalla dibuja la misma barra.
   */
  const minimo = D.minimo === true;
  for (const pieza of document.querySelectorAll('.marcador, .ronda-chip, .aleta, .serie')) {
    pieza.style.visibility = minimo ? 'hidden' : '';
  }
};
