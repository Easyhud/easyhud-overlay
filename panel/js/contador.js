/* Anima numeros con resorte critico (mismo damping/stiffness que "Count Up" de
   React Bits), pero en vanilla JS: sin React ni la libreria `motion`. Anima desde
   el ultimo valor pintado en el propio elemento hasta el nuevo. */
export function animaConteo(el, hasta, { duracion = 0.6, desde: desdeExplicito } = {}) {
  if (!el) return;
  const desde = desdeExplicito ?? Number(el.dataset.conteoValor ?? hasta);
  el.dataset.conteoValor = hasta;
  if (desde === hasta) {
    el.textContent = hasta;
    return;
  }

  const damping = 20 + 40 * (1 / duracion);
  const stiffness = 100 * (1 / duracion);
  let valor = desde;
  let velocidad = 0;
  let ultimo = null;

  function paso(t) {
    if (ultimo === null) ultimo = t;
    const dt = Math.min((t - ultimo) / 1000, 1 / 30);
    ultimo = t;

    const fuerza = -stiffness * (valor - hasta) - damping * velocidad;
    velocidad += fuerza * dt;
    valor += velocidad * dt;

    const llego = Math.abs(valor - hasta) < 0.01 && Math.abs(velocidad) < 0.01;
    el.textContent = llego ? hasta : Math.round(valor);
    if (!llego) requestAnimationFrame(paso);
  }
  requestAnimationFrame(paso);
}
