# Combate — el arte de diseño, en directo

El marcado y el CSS salen del fotograma estático `ARTE/COMBATE`. **El CSS no
se ha tocado ni una línea.** Lo que se añadió es lo que le faltaba al
fotograma para estar vivo:

| Fichero | Qué hace |
|---|---|
| `js/datos.js` | Habla con el servidor y traduce al vocabulario del diseño |
| `js/combate.js` | Construye las tarjetas y el marcador, y dispara las animaciones |
| `js/poligono.js` | La geometría de la insignia de definitiva |
| `js/cdn.js` + `js/catalogo.js` | Los 29 agentes y 20 armas del catálogo público |

## La geometría es la suya, no una aproximación

El fotograma traía los polígonos calculados dentro del marcado. `poligono.js`
los reproduce con la fórmula que se dedujo midiéndolos, y se comprobó que
salen **idénticos carácter a carácter**: mismo contorno, mismos tramos, mismo
hueco entre ellos.

Radio exterior 49.01, interior 38.02, y una separación de 2.163 unidades
**lineales** —no angulares—, que es lo que hace que el hueco se vea del mismo
grosor por fuera y por dentro.

## Por qué los nodos no se rehacen

Todo se crea una vez y después solo se le cambian los valores. No es una
optimización: es lo único que hace que las animaciones existan.

Un elemento **nuevo** vuelve a lanzar su animación desde cero. La primera
versión reconstruía el marcado en cada foto, así que el fogonazo de la
definitiva era un nodo distinto diez veces por segundo y **reventaba diez
veces por segundo** en lugar de una sola al llenarse la ulti. El diseño lo
dice expresamente: *"fogonazo ÚNICO… en directo, lo que late molesta"*.

Y una **transición** necesita que el nodo sea el mismo antes y después: la
barra de vida recreada nace ya en su anchura final y no se desliza nunca.

Se rehace solo lo que cambia de FORMA —los tramos de la insignia si la
definitiva cuesta otro número de puntos, los rombos si cambia el número de
cargas—, y eso pasa una vez por partida, no por foto.

## Las animaciones

El estado dice **cómo están** las cosas, no **qué acaba de pasar**. Así que
las animaciones se deducen comparando cada foto con la anterior:

| Qué pasó | Cómo se detecta | Clase |
|---|---|---|
| Recibe daño | La vida bajó y sigue vivo | `.es-dano` en la tarjeta, 360 ms |
| Baja propia | Pasó de vivo a muerto | `.tarjeta--muerta`, permanente |
| Baja | Pasó de vivo a muerto | `.es-baja-rival` en esa tarjeta, 520 ms |
| Usa habilidad | Una carga que estaba y ya no | `.es-habilidad` en esa habilidad, 420 ms |
| Definitiva lista | Puntos ≥ máximo | `.ulti--lista`, permanente |
| Entra el HUD | Tarjeta nueva | `.es-entra`, se quita al acabar |
| Cambia la cámara | El observado es otro | Cruce de opacidad del foco, 220 ms |

**`.es-baja-rival` va en la tarjeta del que cae, y solo en esa.** El documento
no dice sobre qué tarjeta va, y al principio se disparó en las cinco del bando
contrario: el resultado era media pantalla latiendo cada vez que alguien
moría. Lo decide el propio CSS, que dice para qué sirve — *"reconoce la baja
sin robar atención al juego"*—, y cinco tarjetas escalando a la vez es
exactamente robarla.

**El destello de daño cuelga del panel, no de la fila de vida.** Es
`position:absolute; inset:0`, así que llena su ancestro posicionado; dentro de
`.vida` ese ancestro es `.cab__texto`, que además recorta, y el destello salía
como un rectángulo sobre el nombre. El CSS dice lo que debe ser: *"destello
blanco sobre el retrato"*.

### El cruce del observado NO viene del diseño

`.tarjeta__foco` es un box-shadow fijo, sin transición ni fotogramas, y el
fotograma estático solo tenía una tarjeta observada — así que el cambio de
cámara nunca llegó a verse.

En emisión la cámara cambia de jugador cada pocos segundos, y un resplandor
ámbar que aparece de golpe en otro sitio tira del ojo más que el propio
juego. Se cruza en 220 ms, por opacidad: el que sale se apaga mientras el que
entra se enciende. Los diez focos están siempre montados; un elemento oculto
con `display:none` no transiciona, aparece y ya está.

**La transición se pone desde el JS para no tocar el CSS del diseño.** Es
provisional: si se decide otra cosa —más lento, un destello, nada—, su sitio
natural es la hoja de estilos.

## Lo que NO está

**El aviso de spike con su visor 3D**, quitado a propósito hasta que toque.
El marcado y el CSS siguen en `ARTE/COMBATE` para cuando se ponga.

## Lo que el juego no da

- **El arma es la que se lleva EN LA MANO**, no la mejor que se tiene. Hay un
  solo hueco y enseña una sola arma, que es lo que el juego da. Si alguien
  corre con el cuchillo fuera teniendo un Vandal, la tarjeta enseña el
  cuchillo: es la verdad de lo que pasa, y es lo que hace el HUD del juego.
  Deducir "la mejor que tiene" exigiría recordar lo que se le vio y seguiría
  enseñándola después de que la suelte.
- **Cargas de habilidad**: hoy sale una por habilidad. Si la plataforma las
  manda como número, saldrán las que sean; si las manda como booleano, una es
  lo máximo que se puede afirmar sin inventar. Se cierra con una partida real.

## Los assets

Cuatro no van al repositorio por ser arte de terceros; hay copia en
`ARTE/assets-originales/`. De ellos, en esta pantalla solo se usa
`backdrop-game.png`, que es la captura para encuadrar y **en emisión se quita**.
