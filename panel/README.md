# Panel de operador

La pantalla desde la que se mueve la emisión. **No sale por antena**: sale en
el móvil del que realiza, o en su segundo monitor.

    http://TU-VPS:5300/panel/?groupCode=123&token=eyJ...

## Dos niveles

La primera vez no hay servidor, ni torneo, ni equipos. Abrir directamente en
los mandos de directo sería enseñar la mitad de en medio de una historia, así
que hay dos niveles y el segundo no aparece hasta que el primero está resuelto:

| | |
|---|---|
| **Asistente** | 01 Plantilla · 02 Servidor · 03 Torneo · 04 Equipos · 05 Serie · 06 Patrocinio · 07 Listo |
| **Panel** | 01 Directo · 02 Torneo · 03 Equipos · 04 Serie · 05 Patrocinio · 06 Ajustes |

**Todo lo que se puede saltar va después de todo lo que no.** El primer paso es
obligatorio; del segundo en adelante hay botón de saltar, porque un torneo
puede arrancar con el overlay en blanco y rellenarse en caliente. Un asistente
que obliga a rellenar cinco pantallas antes de dejarte probar si la cosa
conecta es un asistente que se abandona a la mitad.

Durante el asistente **la navegación del panel no está**. El único camino es
hacia delante, o hacia atrás por el raíl de pasos ya hechos.

### Los campos se mudan, no se duplican

El nombre del torneo se toca en el paso 02 y también en su pestaña. Son **el
mismo nodo del DOM**, que cambia de sitio según el modo. Dos copias del mismo
campo acaban discrepando el día que alguien toca una y no la otra — y ese día
será en antena.

## No hay paso de licencia, pero sí de plantilla

El **derecho** se compra en la web y viaja firmado dentro del token. La
**elección** entre lo que ese derecho incluye se hace aquí, porque un premium
con varias plantillas tiene que poder cambiar de una a otra entre torneos sin
escribirte.

Así que el paso 01 enseña sólo las plantillas que la licencia incluye, con la
puesta marcada en rojo — el mismo idioma que un mando en antena, para que
«elegida» y «encendido» se lean igual en todo el panel. La vista previa es un
**esquema**, no una captura: una captura envejece con el diseño y acaba
enseñando algo que ya no existe.

Cuando sólo hay derecho a una —el plan gratis— **el paso desaparece del raíl**
y los demás se renumeran. No basta con saltarlo: un paso listado y a la vez
inalcanzable parece una avería, o peor, parece que a ti te falta algo que otros
sí tienen.

La libre entra siempre en la lista, también en premium: quien paga no debería
perder la opción de emitir con la sencilla el día que le convenga.

Y el derecho se comprueba **en cada lectura**, no sólo al elegir: una licencia
caduca o baja de plan, y lo que quedó guardado en el navegador no se entera.
Sin eso, el panel seguiría ofreciendo direcciones de una plantilla que el
servidor ya no va a entregar, y el realizador lo descubriría con OBS abierto.

Lo que no hay es clave que teclear. La licencia llega sola en
el enlace con el que se abre el panel desde su cuenta (`?token=…`), se guarda
al vuelo y **se borra de la barra de direcciones** en el acto: no queda en el
historial ni en una captura del móvil, y el operador no acaba compartiendo por
Discord un enlace con su licencia dentro creyendo que comparte «la web del
panel».

Pedir una clave habría sido pedirle al cliente que copie a mano algo que
nosotros ya sabemos, en el paso donde más gente abandona.

**Sin licencia no hay error: hay plan gratis.** El instalador gratuito es esta
misma consola sin nada que elegir, así que Ajustes dice `Plan · Gratis` y el
panel funciona. Lo que la licencia abre o cierra lo decide el servidor, no
esta pantalla.

Hubo una versión que dejaba soltar un `.zip` con la plantilla dentro. Se quitó:
cuesta almacenamiento por cliente, es superficie de ataque —parsear un fichero
arbitrario justo donde vive la licencia— y sobre todo contradice el modelo. Si
la plantilla es el producto, no puede entrar por donde el cliente quiera.

El panel **no valida la licencia**, y lo dice en pantalla. Puede leer lo que
pone —plantilla, grupo, caducidad, cliente— porque va en base64url a la vista,
pero la firma se hace con un secreto que sólo está en el servidor, y que esté
sólo ahí es lo que hace que el sistema valga para algo. Lo que se enseña es
«esto es lo que dice el papel»; la verdad la dice el servidor al conectar.

La licencia se guarda en `localStorage`. Tiene precio: queda en el disco de
quien abrió el panel. A cambio no hay que volver a pedir el enlace en cada
pestaña. El botón «olvidar la licencia» de Ajustes existe por esto, y es lo que
hay que usar en un equipo prestado.

## Por qué existe

Hasta ahora, para poner una pausa técnica había que estar sentado en el PC del
observador y pulsar una tecla. En un torneo de comunidad ese suele ser el que
está ocupado siguiendo la partida. Y la configuración del torneo —nombre,
logos, patrocinadores, marcador de la serie— viajaba dentro del paquete de
conexión del cliente, así que cambiar una coma a mitad de evento significaba
reiniciar el observador.

## Las dos conexiones, y por qué son dos

| | Puerto | Sala | Token |
|---|---|---|---|
| Ver lo que sale en antena | salida (5200) | código de grupo | el del overlay |
| Mandar | salida, espacio `/operador` | código de grupo | **el de operador** |

El token del overlay viaja en la URL de la fuente de navegador de OBS: el
cliente lo ve y puede pasárselo a quien quiera. Es un billete al portador y
sirve para lo que sirve — que un desconocido no se alimente del servidor.

Mover la emisión no puede colgar de un billete así, de modo que el mando va
por su propio canal, con su propio token y con el rol firmado dentro. Y al
revés que el del overlay, **falla hacia cerrado**: sin secreto no hay mando.
El del overlay falla hacia abierto a propósito, para no dejar un directo en
negro por un error de configuración; aquí la equivocación segura es la
contraria.

Si el token de operador falta o no vale, el panel **se queda en sólo lectura**
en vez de no abrir: mirar el estado de la emisión desde el móvil ya vale para
algo, y así un fallo de token no deja al realizador a ciegas.

## Lo que el panel NO decide

Nada. El panel no tiene estado propio: enseña siempre lo último que mandó el
servidor, que es exactamente lo que está en antena. Un botón encendido está
encendido de verdad, no porque lo hayamos pulsado.

Eso es lo que permite que el mismo interruptor lo mueva la tecla del PC del
observador, otra persona con el panel abierto en otro sitio, o el propio
servidor al agotarse una cuenta atrás — y que los tres lo vean igual.

La única excepción son los campos de texto mientras se escriben: se marcan en
rojo como sucios y se dejan en paz hasta guardarlos, porque el servidor manda
varias veces por segundo y si no borraría lo que se está tecleando.

## Las órdenes no reimplementan nada

Cada botón de directo se traduce al **mismo paquete que manda la tecla**
correspondiente del observador, y entra por la misma puerta del servidor. No
hay una segunda implementación que pueda desincronizarse: son la misma cosa
vista desde dos sitios. Y si este panel se queda sin red, las teclas siguen
funcionando — el mando a distancia se pierde, el mando no.

Los interruptores (`pausaTecnica`, `kdaCreditos`, los dos intercambios) se
mandan **sin argumento**: se le dice al servidor que cambie, no a qué posición
ir. Mandar la posición deseada invitaría a que dos personas pulsando a la vez
se pelearan por dejarlo como cada una lo vio hace medio segundo.

## La marca

Traducción literal del manual v1.0 (`easyhud-brand.html`), con tres reglas que
son restricciones y no gusto:

- **El naranja está prohibido**, en cualquier tinte o matiz, y prohibido sobre
  blanco. Marca registrada de un competidor en el espacio «easy + palabra».
- **El color de equipo viene del partido.** Vive sólo en `.equipo`, como filete
  lateral. Nunca es el acento de un botón, de un enlace ni de un dato.
- Ni cursivas, ni una tercera familia, ni texto por debajo de 4,5:1.

Y una consecuencia que resulta ser justo lo que necesita un realizador: como
los controles no llevan color, el rojo queda libre para significar **una sola
cosa** — esto está en antena. En una pantalla llena de botones, lo encendido se
lee desde el otro lado de la sala.

## Pendiente

El canal `/operador` **todavía no existe en el servidor**. Hasta que exista, el
panel se conecta, enseña el estado real del partido y se queda en sólo lectura.
