/* Escala el lienzo fijo de 1920×1080 al viewport.

   Por qué `zoom` y no `transform: scale()`:
   `transform: scale()` rasteriza el lienzo a su tamaño natural (1920×1080) y
   luego ESTIRA ese bitmap. Al ampliar —p.ej. una fuente de OBS a 2560×1440—
   todo sale borroso, porque es una imagen agrandada. `zoom` en cambio rehace
   el LAYOUT al tamaño final, así que el texto y los vectores se vuelven a
   dibujar nítidos a la resolución de salida. Es lo que hace que se vea igual
   de nítido a 1080, 1440 o 4K.

   Por qué en JS y no en CSS: el factor se calcula del viewport (no hay una
   función CSS que dé el mínimo de dos <length> como <number>). Y por qué
   escribiendo en el NODO: así sobrevive a remontajes y recargas en caliente.

   RESERVA: se descuentan px de alto (--toolbar) para no pegar la pieza al
   borde inferior en OBS. Si no quieres reserva, pon RESERVA = 0. */
(() => {
  const RESERVA = 0;
  /* Chromium (OBS, Electron, Chrome) soporta `zoom`. OJO: `CSS.supports('zoom',…)`
     devuelve false en Chromium aunque la propiedad funcione, así que se detecta
     mirando si existe en el estilo del nodo. Si algún día se abre en un navegador
     sin `zoom`, se cae a `transform: scale()` para no quedar roto. */
  const HAY_ZOOM = 'zoom' in document.documentElement.style;
  const ajusta = () => {
    if (!innerWidth || !innerHeight) return;
    const k = Math.max(0.05, Math.min(innerWidth / 1920, (innerHeight - RESERVA) / 1080));
    document.querySelectorAll('.escenario').forEach((n) => {
      if (HAY_ZOOM) {
        n.style.zoom = k;
        n.style.transform = 'translate(-50%,-50%)';
      } else {
        n.style.zoom = '';
        n.style.transform = 'translate(-50%,-50%) scale(' + k + ')';
      }
    });
  };
  ajusta();
  addEventListener('resize', ajusta);
  addEventListener('load', ajusta);
  /* Red de seguridad: al montar, el contenedor puede no tener tamaño todavía. */
  setInterval(ajusta, 250);
})();
