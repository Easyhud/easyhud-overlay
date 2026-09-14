/* La superficie del módulo: cinco funciones y dos punteros.
   ========================================================

   Es a propósito tan estrecha. Todo lo que el módulo enseña al mundo es dónde
   escribir el estado, dónde leer el dibujo, y una llamada para pasar de lo uno
   a lo otro. No hay ni un nombre que diga qué se está pintando. */

import { compon } from './escena';
import { arranca, entrada, ranuras } from './estado';
import { ordenes, cuantas, desbordo } from './ordenes';

export { entrada, ranuras, ordenes, cuantas, desbordo };

/** Se llama una vez, antes de nada. Reserva la memoria que vive entre fotogramas. */
export function inicia(): void {
  arranca();
}

/**
 * Compone un fotograma con lo que haya en la zona de entrada.
 *
 * `ahora` es un reloj monótono en milisegundos —el del propio navegador—, no
 * la hora del día: las animaciones miden intervalos, y un reloj que puede
 * saltar hacia atrás las rompería.
 *
 * @returns Cuántas ranuras ocupa el dibujo.
 */
export function dibuja(ahora: f64): i32 {
  compon(ahora);
  return cuantas();
}
