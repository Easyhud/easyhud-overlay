/**
 * Lo que las pantallas se pasan por `window`.
 *
 * Los pintores salieron del paquete de diseño como scripts corrientes, no
 * como módulos, así que se publican en `window` y los adaptadores los llaman
 * desde ahí. Declararlo aquí es lo que permite revisar esas llamadas en vez
 * de que pasen como `any`.
 */
interface Window {
  /** Lo publican los ficheros `cdn.js` y `poligono.js` de cada pantalla. */
  HUD: Record<string, (...args: never[]) => string | string[]>;
  /** El pintor del tablero de compra. */
  pintaCompra: (datos: unknown) => void;
  /** El pintor de la selección de agentes. */
  pintaSeleccion: (datos: unknown) => void;
  /** El pintor de la pantalla de victoria. */
  pintaVictoria: (datos: unknown) => void;
}
