/* Geometría de la insignia de definitiva.
   ========================================

   El fotograma que salió de diseño traía estos polígonos ya calculados dentro
   del marcado, uno por tarjeta. Aquí se reproducen con la misma fórmula, para
   poder pintarlos con los puntos de ulti que lleguen del servidor en lugar de
   con los del ejemplo.

   Los números salen de medir el propio fotograma, no de inventarlos: el
   heptágono del ejemplo pasa por (50,0), (89.09,18.83), (98.75,61.13)… que es
   exactamente un polígono regular inscrito en un círculo de radio 50 centrado
   en (50,50), empezando arriba y girando a la derecha.

   La insignia tiene TANTOS LADOS COMO PUNTOS CUESTA la definitiva: seis puntos,
   hexágono; ocho, octógono. Es una forma de decir el coste sin escribir un
   número. */

/** Un punto del polígono regular, en porcentaje de la caja. */
function punto(k, lados) {
  const angulo = (2 * Math.PI * k) / lados;
  return [50 + 50 * Math.sin(angulo), 50 - 50 * Math.cos(angulo)];
}

/** El contorno, para recortar el fondo y el icono. */
export function recorte(lados) {
  const puntos = [];
  for (let k = 0; k < lados; k += 1) {
    const [x, y] = punto(k, lados);
    puntos.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return `polygon(${puntos.join(',')})`;
}

/*
 * Medidas del arco, sacadas del fotograma:
 *
 *   radio exterior 49.01, interior 38.02, y una separación entre tramos de
 *   2.16 unidades **lineales** —no angulares—, que es lo que hace que el hueco
 *   se vea del mismo grosor en el borde de fuera y en el de dentro.
 */
const R_FUERA = 49.01;
const R_DENTRO = 38.02;
const HUECO = 2.163;

function arco(radio, angulo) {
  return [50 + radio * Math.sin(angulo), 50 - radio * Math.cos(angulo)];
}

/**
 * Un tramo del anillo: el trozo de corona entre dos vértices.
 *
 * @param {number} k Qué tramo, de 0 a `lados - 1`
 */
function tramo(k, lados) {
  const paso = (2 * Math.PI) / lados;
  const separa = (radio) => Math.asin(HUECO / radio);

  const dFuera = separa(R_FUERA);
  const dDentro = separa(R_DENTRO);

  const puntos = [
    arco(R_FUERA, k * paso + dFuera),
    arco(R_FUERA, (k + 1) * paso - dFuera),
    arco(R_DENTRO, (k + 1) * paso - dDentro),
    arco(R_DENTRO, k * paso + dDentro),
  ];

  return `polygon(${puntos.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(',')})`;
}

/*
 * Los tres colores del anillo, tal como los usa el fotograma:
 *
 *   - Definitiva LISTA: todos los tramos en el color claro del bando. Es el
 *     estado que hay que ver de un vistazo desde el otro lado de la sala.
 *   - Viva y a medias: lo cargado en el color del bando, lo que falta casi
 *     transparente.
 *   - Muerto: lo cargado en blanco apagado. La ulti sigue ahí —no se pierde al
 *     morir— pero no compite con los vivos.
 */
const APAGADO = 'rgb(255 255 255 / 14%)';
const MUERTO = 'rgb(255 255 255 / 22%)';

/**
 * Los tramos de la insignia, ya con su color.
 *
 * @returns {string[]} Un `style` por tramo, listo para un `<span>`
 */
export function tramos(lados, cargados, { muerto = false, lista = false } = {}) {
  const estilos = [];
  for (let k = 0; k < lados; k += 1) {
    const cargado = k < cargados;
    let color;
    if (muerto) color = cargado ? MUERTO : APAGADO;
    else if (lista) color = 'var(--cl)';
    else color = cargado ? 'var(--c)' : APAGADO;

    estilos.push(`position:absolute;inset:0;clip-path:${tramo(k, lados)};background:${color}`);
  }
  return estilos;
}
