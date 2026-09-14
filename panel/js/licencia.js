/* ══ LA LICENCIA ════════════════════════════════════════════════════════════
   Una cadena firmada por el servidor. Dice a qué grupo vale, hasta cuándo, de
   quién es y —esto es lo importante— **qué plantilla tiene asignada**.

   ## Por qué la plantilla va DENTRO de la licencia

   Hubo una versión de esto que dejaba al cliente soltar un `.zip` con su
   plantilla. Se quitó, y no por gusto:

     - Cuesta almacenamiento por cliente, y el servidor ya está renderizando.
     - Es superficie de ataque: parsear un fichero arbitrario que sube un
       desconocido, en el mismo sitio donde vive la licencia.
     - Y sobre todo contradice el modelo. Si la plantilla es el producto, no
       puede entrar por donde el cliente quiera. Entra por donde tú la asignas.

   Así que aquí no se elige nada. La licencia dice qué plantilla toca y el
   panel la enseña; no hay selector porque no hay nada que seleccionar.

   ## Lo que este fichero NO hace

   No valida. Puede leer el contenido del token —va en base64url a la vista—
   pero **no puede comprobar la firma**: se hace con un secreto que sólo está
   en el servidor, y que esté sólo ahí es justamente lo que hace que el sistema
   valga para algo.

   O sea que todo lo que se enseñe desde aquí es «esto es lo que dice el
   papel», no «esto es verdad». La verdad la dice el servidor al conectar, y si
   el papel y el servidor discrepan, manda el servidor. Se avisa así en la
   interfaz a propósito: prometer validez desde el navegador sería mentir, y
   sería la clase de mentira que un cliente descubre en directo.             */

/** La plantilla que tiene todo el mundo, se pague o no. */
export const PLANTILLA_LIBRE = 'libre';

/**
 * El catálogo.
 *
 * Aquí NO se decide quién tiene derecho a qué: eso lo dice la licencia, que va
 * firmada. Esto es sólo cómo se llama cada una y qué trae, para poder
 * enseñarla. Añadir una entrada aquí no le da acceso a nadie.
 */
export const CATALOGO = {
  [PLANTILLA_LIBRE]: {
    nombre: 'Gratis',
    nota: 'Marcador, compra y selección de agentes. Con la marca de agua de Easy HUD.',
  },
  'cristal-v1': {
    nombre: 'Cristal V1',
    nota: 'Las siete pantallas, ceremonias de ronda y pausa. Sin marca de agua.',
  },
};

export const nombrePlantilla = (id) => CATALOGO[id]?.nombre ?? id;

/**
 * A qué plantillas da derecho una licencia.
 *
 * El token puede traer `p` como una cadena —una sola— o como lista. Se acepta
 * lo uno y lo otro porque las primeras licencias se emitieron con una cadena y
 * romperlas no aportaría nada.
 *
 * La libre entra SIEMPRE, incluso en premium: alguien que paga no debería
 * perder la opción de emitir con la sencilla el día que le convenga. Y cuando
 * no hay licencia, la lista es exactamente esa — una — así que el panel no
 * enseña un selector de un solo elemento, que es una pregunta con una sola
 * respuesta posible.
 */
export function plantillasDe(token) {
  const c = leeToken(token);
  const suyas = c === null ? [] : Array.isArray(c.plantilla) ? c.plantilla : [c.plantilla];
  const vistas = new Set([PLANTILLA_LIBRE]);
  for (const id of suyas) {
    if (typeof id === 'string' && id !== '') vistas.add(id);
  }
  return [...vistas];
}

/**
 * Abre el contenido de un token SIN comprobar la firma.
 *
 * @returns {{grupo: string, caduca: Date, cliente: string, plantilla: string} | null}
 */
export function leeToken(token) {
  if (typeof token !== 'string') return null;

  const punto = token.lastIndexOf('.');
  if (punto <= 0) return null;

  try {
    const cuerpo = token.slice(0, punto);
    /* base64url -> base64. `atob` no entiende `-` ni `_`. */
    const base = cuerpo.replace(/-/g, '+').replace(/_/g, '/');
    const relleno = base + '='.repeat((4 - (base.length % 4)) % 4);
    const c = JSON.parse(atob(relleno));

    if (typeof c.g !== 'string' || typeof c.exp !== 'number') return null;

    return {
      grupo: c.g,
      caduca: new Date(c.exp * 1000),
      cliente: typeof c.c === 'string' ? c.c : 'sin nombre',
      /* Puede venir una cadena o una lista. Los tokens emitidos antes de que
         existieran las plantillas no traen `p` y se quedan con la libre:
         quedarse sin overlay por una licencia vieja sería peor que darle de
         más a alguien que ya había pagado. */
      plantilla: Array.isArray(c.p) || (typeof c.p === 'string' && c.p !== '') ? c.p : PLANTILLA_LIBRE,
    };
  } catch {
    return null;
  }
}

/** Días que le quedan. Negativo si ya caducó. */
export function diasQueQuedan(caduca) {
  return Math.floor((caduca.getTime() - Date.now()) / 86400000);
}
