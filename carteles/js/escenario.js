/* Escala el lienzo fijo de 1920×1080 al viewport.
   Por qué en JS y no en CSS: transform:scale() exige un <number> y
   min(100vw/1920, …) evalúa a una <length>, así que toda la propiedad se
   descarta. Y por qué escribiendo en el NODO y no en estado de framework:
   así sobrevive a remontajes y recargas en caliente.
   RESERVA: se descuentan 68px de alto (--toolbar) para que la pieza no quede
   pegada al borde inferior en OBS. Si no quieres reserva, pon RESERVA = 0. */
(() => {
  const RESERVA = 0;
  const ajusta = () => {
    if (!innerWidth || !innerHeight) return;
    const k = Math.max(0.05, Math.min(innerWidth / 1920, (innerHeight - RESERVA) / 1080));
    document.querySelectorAll('.escenario').forEach(n => {
      n.style.transform = 'translate(-50%,-50%) scale(' + k + ')';
    });
  };
  ajusta();
  addEventListener('resize', ajusta);
  addEventListener('load', ajusta);
  /* Red de seguridad: al montar, el contenedor puede no tener tamaño todavía. */
  setInterval(ajusta, 250);
})();
