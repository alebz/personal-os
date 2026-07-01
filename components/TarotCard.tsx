'use client'

import { CSSProperties, useEffect, useState } from 'react'

type Suit = 'major' | 'cups' | 'pentacles' | 'swords' | 'wands'

interface Card {
  id:       number
  name:     string
  numeral?: string
  img:      string
  emoji:    string
  suit:     Suit
  theme:    string
  body:     string
  rev:      string
}

const BASE     = 'https://www.sacred-texts.com/tarot/pkt/img'
const LS_DAILY = 'tarot_v2_daily'
const LS_DECK  = 'tarot_v2_deck'

const SUIT_COLOR: Record<Suit, string> = {
  major:     'oklch(0.78 0.14 65)',
  cups:      'oklch(0.65 0.16 240)',
  pentacles: 'oklch(0.68 0.14 150)',
  swords:    'oklch(0.70 0.08 275)',
  wands:     'oklch(0.72 0.18 45)',
}

// Hand-cut card edge: corners offset 1–3 px from a perfect rectangle
const CARD_CLIP = 'polygon(0.77% 1.19%, 3.08% 0.24%, 96.92% 0.71%, 99.23% 1.43%, 98.85% 98.81%, 96.54% 99.76%, 2.69% 99.52%, 0.38% 98.10%)'

const FLOAT_KF = `
@keyframes tarotCardFloat {
  0%   { transform: perspective(1200px) rotateX(1deg) rotateY(-0.5deg) translateY(0px); }
  50%  { transform: perspective(1200px) rotateX(0.8deg) rotateY(-0.5deg) translateY(-5px); }
  100% { transform: perspective(1200px) rotateX(1deg) rotateY(-0.5deg) translateY(0px); }
}
`

const DECK: Card[] = [
  // ─ ARCANOS MAYORES ──────────────────────────────────────────────────────────
  { id: 0,  suit: 'major', name: 'El Loco',              numeral: '0',     img: 'ar00.jpg', emoji: '🃏',
    theme: 'Comienzo puro, potencial sin forma',
    body: 'El Loco avanza al borde del precipicio con una rosa blanca y un pequeño fardo — despreocupado, sin cargas. El perro advierte pero no detiene. El sol pleno ilumina desde atrás. Observa el horizonte y el borde compartiendo el mismo encuadre: peligro y posibilidad coexisten en todo inicio genuino. Este es el punto cero antes del viaje.',
    rev: 'Invertida: imprudencia sin conciencia, o parálisis que bloquea un salto verdaderamente necesario.' },

  { id: 1,  suit: 'major', name: 'El Mago',              numeral: 'I',     img: 'ar01.jpg', emoji: '✨',
    theme: 'Voluntad, habilidad, manifestación',
    body: 'El Mago está ante una mesa con los cuatro símbolos de los palos. Canaliza poder celestial con una mano y señala la tierra con la otra. El lemniscata marca voluntad infinita. Observa las cuatro herramientas dispuestas: vara, cáliz, espada, pentáculo. Tiene todo lo necesario. La pregunta es si elegirá dirigirlo.',
    rev: 'Invertida: habilidad mal usada, manipulación, o talento real bloqueado por la duda propia.' },

  { id: 2,  suit: 'major', name: 'La Suma Sacerdotisa',  numeral: 'II',    img: 'ar02.jpg', emoji: '🌙',
    theme: 'Intuición, misterio, conocimiento oculto',
    body: 'Sentada entre las columnas B y J del Templo de Salomón, guarda el velo entre mundos. Las granadas y la luna creciente señalan conocimiento cíclico. El pergamino en su regazo está medio oculto. Observa lo que permanece velado, lo que queda en sombra. Ella sabe pero no habla directamente — la respuesta debe buscarse hacia adentro.',
    rev: 'Invertida: intuición reprimida, secretos usados como daño, o exceso de fe en la evidencia racional.' },

  { id: 3,  suit: 'major', name: 'La Emperatriz',        numeral: 'III',   img: 'ar03.jpg', emoji: '🌿',
    theme: 'Abundancia, fertilidad, naturaleza creadora',
    body: 'La Emperatriz reposa entre trigales y bosque, un escudo de Venus a su lado y una cascada detrás. Doce estrellas la coronan. Es la abundancia física — de tierra, cuerpo y arte. Observa el trigo a sus pies (cosecha lista) y el agua en movimiento (abundancia fluyendo). Esta carta pregunta qué está maduro y listo para crecer.',
    rev: 'Invertida: bloqueo creativo, descuido propio o del entorno, o cuidado que asfixia en lugar de nutrir.' },

  { id: 4,  suit: 'major', name: 'El Emperador',         numeral: 'IV',    img: 'ar04.jpg', emoji: '👑',
    theme: 'Autoridad, estructura, estabilidad',
    body: 'El Emperador en su trono de piedra tallado con cuatro cabezas de carnero — Aries, signo de la conquista. Montañas detrás; ninguna suavidad en el paisaje. Cetro y orbe marcan dominio mundano. Observa la armadura bajo sus ropas (siempre listo para la batalla) y la rigidez de su postura. El orden sostenido por pura fuerza de voluntad y disciplina.',
    rev: 'Invertida: control dominante, rigidez que se quiebra, o autoridad ejercida desde la inseguridad.' },

  { id: 5,  suit: 'major', name: 'El Hierofante',        numeral: 'V',     img: 'ar05.jpg', emoji: '🔔',
    theme: 'Tradición, institución, enseñanza sagrada',
    body: 'Sentado en una iglesia entre dos columnas, flanqueado por dos monjes que buscan guía, bendice con el signo formal de la bendición. Dos llaves cruzadas a sus pies. Observa a los monjes (quienes necesitan un guía) y las llaves (puertas espirituales e institucionales). Marca el encuentro con sabiduría heredada: tradición, doctrina o un maestro formal.',
    rev: 'Invertida: dogma, conformidad ciega, o una ruptura con la tradición que es en sí misma la lección.' },

  { id: 6,  suit: 'major', name: 'Los Enamorados',       numeral: 'VI',    img: 'ar06.jpg', emoji: '❤️',
    theme: 'Elección, valores, unión significativa',
    body: 'Un hombre y una mujer en un jardín; un ángel bendice desde arriba. La serpiente enrolla el árbol del fruto detrás de la mujer — el Edén antes de la elección. Él mira a ella; ella mira hacia el ángel. Observa la dirección de cada mirada. Esta carta marca una elección entre valores fundamentales, no solo entre personas.',
    rev: 'Invertida: valores desalineados, miedo al compromiso, o elección tomada por razones equivocadas.' },

  { id: 7,  suit: 'major', name: 'El Carro',             numeral: 'VII',   img: 'ar07.jpg', emoji: '🏆',
    theme: 'Voluntad, impulso, fuerza controlada',
    body: 'Un guerrero coronado en un carro tirado por dos esfinges — una negra, una blanca — mirando en direcciones opuestas. No sostiene riendas; controla por pura voluntad. Observa las esfinges mirando hacia lados contrarios (fuerzas opuestas unificadas) y la ausencia de riendas. La victoria aquí viene de la disciplina y la dirección, no de la fuerza bruta.',
    rev: 'Invertida: pérdida de dirección, agresión sin control, o avanzar sin saber hacia dónde.' },

  { id: 8,  suit: 'major', name: 'La Fuerza',            numeral: 'VIII',  img: 'ar08.jpg', emoji: '🦁',
    theme: 'Valor, paciencia, maestría interior',
    body: 'Una mujer de blanco cierra suavemente la boca de un león. Sin armadura — solo flores la coronan. El lemniscata flota arriba. Observa la suavidad de sus manos (no aprietan, no fuerzan) y la expresión dispuesta del león (no sometido). La verdadera fuerza aquí es compostura ante lo salvaje. Es la paciencia actuando, no la dominancia impuesta.',
    rev: 'Invertida: autoduda alimentando el miedo, o forzar donde la gentileza era necesaria.' },

  { id: 9,  suit: 'major', name: 'El Ermitaño',          numeral: 'IX',    img: 'ar09.jpg', emoji: '🏔️',
    theme: 'Soledad, sabiduría interior, guía',
    body: 'Un anciano en un pico nevado con una linterna que contiene una estrella de seis puntas. Mira hacia abajo — guiando a quienes están abajo, no buscando a quienes están arriba. Su bastón sostiene, no ataca. Observa qué ilumina su luz y qué deja en sombra. Marca el retiro deliberado para encontrar lo que no puede hallarse en compañía.',
    rev: 'Invertida: aislamiento que se convierte en exilio, o rechazo de guía genuina cuando se ofrece.' },

  { id: 10, suit: 'major', name: 'La Rueda de la Fortuna', numeral: 'X',   img: 'ar10.jpg', emoji: '🎡',
    theme: 'Ciclos, destino, puntos de inflexión',
    body: 'Una rueda gira en el cielo con letras hebreas y símbolos alquímicos. Cuatro criaturas en las esquinas — león, águila, ángel, toro — no giran. Solo la rueda se mueve. Observa los testigos fijos y el centro giratorio. La fortuna cambia; la pregunta es si estás en la rueda u observándola desde fuera.',
    rev: 'Invertida: resistencia a un ciclo necesario, o repetición de patrones sin reconocer su naturaleza.' },

  { id: 11, suit: 'major', name: 'La Justicia',          numeral: 'XI',    img: 'ar11.jpg', emoji: '⚖️',
    theme: 'Verdad, responsabilidad, medida justa',
    body: 'Una figura con balanzas en una mano y espada de doble filo en la otra. La corona es simple y geométrica — no decorativa. Observa las balanzas niveladas (no inclinadas por preferencia) y la espada de doble filo (la verdad corta en ambas direcciones). Esta carta pesa antes de consolar. ¿Qué es realmente verdad y cuáles son sus consecuencias?',
    rev: 'Invertida: resultados injustos, evasión de responsabilidad, o juicio nublado por sesgo.' },

  { id: 12, suit: 'major', name: 'El Colgado',           numeral: 'XII',   img: 'ar12.jpg', emoji: '🙃',
    theme: 'Rendición, nueva perspectiva, pausa elegida',
    body: 'Un hombre cuelga por un pie de un árbol vivo, brazos detrás, expresión serena. Un halo marca esto como elección, no castigo. Su cuerpo forma una cruz; su pierna doblada, un triángulo alquímico de transformación. Observa el rostro tranquilo (lo eligió) y el árbol vivo (algo nutre esta pausa). Soltar el control para ganar otra clase de claridad.',
    rev: 'Invertida: estancamiento sin propósito, martirio sin crecimiento, o pausa que no cambia nada.' },

  { id: 13, suit: 'major', name: 'La Muerte',            numeral: 'XIII',  img: 'ar13.jpg', emoji: '💀',
    theme: 'Transición, finales, lo que sigue',
    body: 'Un esqueleto en armadura negra cabalga un caballo blanco. El sol sale en el horizonte distante. Observa el caballo blanco (la pureza del final — no malicioso) y el sol naciente (algo sigue necesariamente). El niño mira hacia el horizonte. Esta carta habla de lo que debe cerrarse para que otra cosa pueda abrirse — no el fin, sino el umbral.',
    rev: 'Invertida: miedo a los finales que bloquea el cambio necesario, o cambio ya en marcha pero inconscientemente resistido.' },

  { id: 14, suit: 'major', name: 'La Templanza',         numeral: 'XIV',   img: 'ar14.jpg', emoji: '🌅',
    theme: 'Equilibrio, flujo, integración activa',
    body: 'Un ángel con un pie en tierra y otro en agua vierte líquido entre dos cálices — siempre fluyendo, sin derramar. Un disco solar marca la frente. Observa el líquido fluyendo contra la gravedad (algo trabajando más allá de las reglas normales) y los pies equilibrados. La moderación aquí es proceso activo y alquímico — refinamiento continuo, no restricción.',
    rev: 'Invertida: exceso en cualquier dirección, impaciencia con la integración lenta, o armonía forzada que no es real.' },

  { id: 15, suit: 'major', name: 'El Diablo',            numeral: 'XV',    img: 'ar15.jpg', emoji: '😈',
    theme: 'Atadura, sombra, cadenas elegidas',
    body: 'Baphomet sentado en un pedestal; dos humanos encadenados abajo — pero las cadenas son flojas, fáciles de quitar. Un pentáculo invertido marca la inversión de la prioridad espiritual. Observa las cadenas flojas (podrían irse pero eligen quedarse) y los pequeños cuernos crecidos en los humanos (se están volviendo lo que los ata). ¿De qué está hecha realmente esta atadura?',
    rev: 'Invertida: liberarse de una adicción o sistema de creencias, o nombrar finalmente lo que ha estado en la sombra.' },

  { id: 16, suit: 'major', name: 'La Torre',             numeral: 'XVI',   img: 'ar16.jpg', emoji: '⚡',
    theme: 'Ruptura, revelación, colapso necesario',
    body: 'Una torre golpeada por un rayo; una corona soplada de la cima; figuras cayendo por las ventanas. El rayo es divino — no aleatorio. Observa la corona cayendo primero (la falsa autoridad colapsa antes que la estructura) y las figuras en caída libre (aún no han aterrizado). Lo que La Torre golpea fue construido sobre terreno falso. El colapso revela algo más verdadero.',
    rev: 'Invertida: aferrarse con más fuerza para evitar el colapso, o un desmantelamiento más silencioso de la misma estructura falsa.' },

  { id: 17, suit: 'major', name: 'La Estrella',          numeral: 'XVII',  img: 'ar17.jpg', emoji: '⭐',
    theme: 'Esperanza, renovación, visión clara tras la tormenta',
    body: 'Una mujer desnuda de rodillas en un estanque vierte agua de dos jarras — una al estanque, una a la tierra. Ocho estrellas brillan arriba. Un ibis descansa en un árbol — el intelecto vuelto a posarse. Observa las dos corrientes (nutriendo lo interior y exterior simultáneamente) y la postura abierta (vulnerabilidad en quietud). Después del colapso, la claridad regresa.',
    rev: 'Invertida: fe perdida tras la dificultad, pensamiento ilusorio confundido con esperanza fundamentada, o cinismo como defensa.' },

  { id: 18, suit: 'major', name: 'La Luna',              numeral: 'XVIII', img: 'ar18.jpg', emoji: '🌙',
    theme: 'Ilusión, inconsciente, camino incierto',
    body: 'Una luna llena proyecta luz reflejada sobre un cangrejo que emerge del agua, un camino entre dos torres, y dos cánidos aullando. La luz reflejada distorsiona; las cosas no son lo que parecen. Observa el cangrejo (instinto emergiendo de las profundidades) y las dos torres (el camino pasa entre, no por ellas). No todo lo iluminado aquí es real.',
    rev: 'Invertida: claridad rompiéndose a través de la confusión, o miedos reprimidos que emergen de forma útil en lugar de desestabilizadora.' },

  { id: 19, suit: 'major', name: 'El Sol',               numeral: 'XIX',   img: 'ar19.jpg', emoji: '☀️',
    theme: 'Alegría, vitalidad, consciencia plena de día',
    body: 'Un niño en un caballo blanco con los brazos abiertos ante un jardín amurallado. Girasoles bordean el muro; el sol irradia rayos rectos y ondulados — energía solar y lunar unificadas. Observa los brazos abiertos del niño (nada oculto, nada defendido) y el muro del jardín (la alegría existe dentro de una estructura). Lo que puede verse aquí es genuinamente real.',
    rev: 'Invertida: alegría nublada, inflación del ego, o búsqueda exterior de lo que solo viene de adentro.' },

  { id: 20, suit: 'major', name: 'El Juicio',            numeral: 'XX',    img: 'ar20.jpg', emoji: '📯',
    theme: 'Despertar, rendición de cuentas, un nuevo llamado',
    body: 'Un ángel toca una trompeta desde arriba; figuras se levantan de sus tumbas en respuesta. Una cruz en el estandarte marca autoridad espiritual equilibrada. Observa todas las figuras levantándose (ninguna escapa a este llamado) y el niño emergiendo entre ellas (un nuevo yo junto a los más antiguos). Una cuenta final que también abre algo completamente nuevo.',
    rev: 'Invertida: rechazar el llamado, negar el balance personal, o una convocatoria que aún no puede escucharse.' },

  { id: 21, suit: 'major', name: 'El Mundo',             numeral: 'XXI',   img: 'ar21.jpg', emoji: '🌍',
    theme: 'Culminación, integración, ciclo cerrado',
    body: 'Una figura danzante envuelta en una guirnalda de laurel sostiene dos varas y se mueve libremente. Las cuatro criaturas de las esquinas — las mismas que en la Rueda — observan desde posiciones fijas. Observa la guirnalda (un ciclo completado) y la postura de la bailarina (como el Colgado, pero ahora liberada). Lleva lo que tenía el Mago, y danza con ello.',
    rev: 'Invertida: casi-culminación que no cierra, o alcanzar una meta sin comprender lo que significa.' },

  // ─ COPAS ────────────────────────────────────────────────────────────────────
  { id: 22, suit: 'cups', name: 'As de Copas',       img: 'cu01.jpg', emoji: '🏆',
    theme: 'Nuevo comienzo emocional, don del sentir',
    body: 'Una mano emerge de una nube sosteniendo un cáliz que desborda en cinco corrientes. Una paloma desciende llevando una oblea; flores de loto emergen del agua abajo. Observa los torrentes desbordantes (abundancia más allá de lo que el cáliz puede contener) y la paloma (algo llegando desde arriba). Un don de apertura emocional o espiritual — ofrecido libremente, aún necesita ser recibido.',
    rev: 'Invertida: oferta emocional rechazada o perdida, bloqueo creativo, o entumecimiento a pesar de la apertura disponible.' },

  { id: 23, suit: 'cups', name: 'Dos de Copas',      img: 'cu02.jpg', emoji: '💑',
    theme: 'Asociación, reconocimiento mutuo',
    body: 'Dos figuras intercambian cálices mirándose. Sobre ellas flota el caduceo coronado con una cabeza de león — el bastón de Hermes, de curación y poder. Observa el intercambio igual (ninguno da más) y el caduceo (este vínculo porta tanto medicina como fuerza). Reconocimiento mutuo entre iguales, en amor o colaboración. Algo real está siendo reconocido.',
    rev: 'Invertida: desequilibrio en una alianza, comunicación rota, o un vínculo que parecía mutuo pero no lo era.' },

  { id: 24, suit: 'cups', name: 'Tres de Copas',     img: 'cu03.jpg', emoji: '🎊',
    theme: 'Celebración, comunidad, abundancia compartida',
    body: 'Tres mujeres elevan cálices en círculo, rodeadas de cosecha — calabazas, uvas, frutas en el suelo. Las tres se miran; nadie queda excluido. Observa la cosecha (algo cultivado juntas) y la formación circular (sin jerarquía). La alegría compartida se multiplica. Marca abundancia comunitaria genuina — un momento de culminación celebrado en lugar de guardado en privado.',
    rev: 'Invertida: celebración usada para evitar algo, vacío dentro del grupo, o exclusión del círculo.' },

  { id: 25, suit: 'cups', name: 'Cuatro de Copas',   img: 'cu04.jpg', emoji: '😐',
    theme: 'Contemplación, retiro, oferta perdida',
    body: 'Una figura sentada bajo un árbol, brazos cruzados, ante tres cálices en el suelo. Una mano de una nube ofrece un cuarto — pero él no lo ve. Observa los tres cálices ya presentes (abundancia que no percibe) y el cuarto ofrecido sin ser visto. Meditación o retiro que pierde la oportunidad. A veces el don se extiende justo cuando la atención mira hacia otro lado.',
    rev: 'Invertida: reengancharse después del retiro, o darse cuenta de lo que se ignoraba mientras se miraba hacia adentro.' },

  { id: 26, suit: 'cups', name: 'Cinco de Copas',    img: 'cu05.jpg', emoji: '😢',
    theme: 'Pérdida, duelo, lo que permanece en pie',
    body: 'Una figura encapuchada mira tres cálices derramados mientras dos cálices llenos permanecen detrás. Un puente lleva a un castillo distante. Observa los dos cálices en pie (lo que queda — real y pleno) y el puente (el camino adelante existe y es visible). El duelo aquí es real y esta carta no lo minimiza. Pero la postura enfrenta la pérdida, no el resto.',
    rev: 'Invertida: empezar a girar del duelo hacia lo que queda, o duelo prolongado más allá de lo que puede enseñar.' },

  { id: 27, suit: 'cups', name: 'Seis de Copas',     img: 'cu06.jpg', emoji: '🌸',
    theme: 'Inocencia, nostalgia, ofrenda del pasado',
    body: 'Un niño ofrece un cáliz lleno de flores blancas a un niño más pequeño en un patio de piedra antigua. La arquitectura está detenida en el tiempo. Observa la diferencia de escala (el mayor da al menor — el recuerdo pasando hacia adelante) y las flores blancas (intención pura, sin transacción). Un momento de generosidad inocente, o un regreso a algo que fue simple.',
    rev: 'Invertida: vivir en el pasado a expensas del presente, o retorno forzado a patrones familiares.' },

  { id: 28, suit: 'cups', name: 'Siete de Copas',    img: 'cu07.jpg', emoji: '🌫️',
    theme: 'Fantasía, ilusión, demasiadas visiones',
    body: 'Una figura en sombra ante siete nubes, cada una con una visión diferente — castillo, dragón, corona, figura velada, torre, joyas, serpiente. Todo aparece simultáneamente; nada parece claramente real. Observa la figura anónima (la tentación de todos) y la exhibición imposible y simultánea. Cuando todo aparece como opción, nada ha sido aún elegido. La imaginación requiere suelo.',
    rev: 'Invertida: claridad rompiendo la ilusión, o una decisión finalmente tomada pese a la confusión de opciones.' },

  { id: 29, suit: 'cups', name: 'Ocho de Copas',     img: 'cu08.jpg', emoji: '🌙',
    theme: 'Partida, búsqueda de profundidad, salida deliberada',
    body: 'Una figura encapuchada se aleja de ocho cálices apilados bajo un cielo nocturno con luna llena y creciente — transición en marcha. Los cálices están ordenados, no abandonados apresuradamente. Observa los cálices organizados (algo valorado, dejado deliberadamente) y la figura moviéndose hacia arriba y lejos. No es fracaso sino partida elegida hacia algo con más profundidad.',
    rev: 'Invertida: regreso prematuro de una partida, o deambular sin dirección después de dejar algo atrás.' },

  { id: 30, suit: 'cups', name: 'Nueve de Copas',    img: 'cu09.jpg', emoji: '😊',
    theme: 'Satisfacción, deseo cumplido, contento',
    body: 'Un hombre sentado ante nueve cálices en un estante curvo, brazos cruzados, expresión complacida. Bien vestido y satisfecho de sí mismo. Observa los cálices dispuestos detrás (su colección, su acumulación) y su postura autosatisfecha (compartir no es el modo actual). Llamada a menudo la "carta del deseo". Lo que se deseaba ha llegado — la pregunta es si satisface completamente.',
    rev: 'Invertida: exceso, satisfacción hueca, o felicidad construida sobre algo no tan sólido como parece.' },

  { id: 31, suit: 'cups', name: 'Diez de Copas',     img: 'cu10.jpg', emoji: '🌈',
    theme: 'Armonía duradera, familia, pertenencia genuina',
    body: 'Una pareja y dos niños juntos, brazos levantados, ante una casa y un río. Un arco iris arquea diez cálices en el cielo. Observa la unidad familiar (pertenencia, comunidad completada) y el arco del arco iris (no un pico permanente sino el arco completo de un ciclo). Marca felicidad relacional genuina — la sensación de haber llegado a algún lugar realmente real.',
    rev: 'Invertida: discordia bajo una apariencia feliz, distanciamiento familiar, o contento que no aguanta la presión.' },

  { id: 32, suit: 'cups', name: 'Paje de Copas',     img: 'cupa.jpg', emoji: '🐟',
    theme: 'Mensajes creativos, comienzos intuitivos',
    body: 'Un joven a la orilla del agua sostiene un cáliz del que asoma un pez. Lo mira con suave sorpresa. Observa el pez inesperado (imaginación surgiendo involuntariamente del inconsciente) y la expresión abierta del joven (recibiendo, no dirigiendo). Es el inicio de la inteligencia emocional — un mensaje de la vida interior pidiendo ser notado.',
    rev: 'Invertida: inmadurez creativa, expresión emocional sin arraigo, o ignorar lo que la vida interior señala.' },

  { id: 33, suit: 'cups', name: 'Caballero de Copas', img: 'cuku.jpg', emoji: '🦜',
    theme: 'Búsqueda romántica, empresa idealista',
    body: 'Un caballero en un caballo gris avanza lentamente, sosteniendo suavemente un cáliz hacia adelante. Su casco brota alas — influencia de Mercurio. El paso es deliberado, no una carga. Observa el caballo tranquilo (esto es persecución, no batalla) y el casco alado (ideas llevadas por el viento). El idealista romántico — acercándose con sentimiento, atraído por la belleza.',
    rev: 'Invertida: mal humor, manipulación emocional, o idealismo que resiste cualquier arraigo práctico.' },

  { id: 34, suit: 'cups', name: 'Reina de Copas',    img: 'cuqu.jpg', emoji: '🔮',
    theme: 'Empatía, profundidad emocional, saber interior',
    body: 'La Reina sentada en su trono a la orilla del agua, sosteniendo un cáliz cerrado y ornamentado que contempla sin abrirlo. Ondinas decoran su trono. Observa el cáliz cerrado (misterios que sostiene y cuida sin necesidad de exhibir) y su posición en el límite del agua (entre mundos interior y exterior). Sostiene profundidad emocional sin ahogarse en ella.',
    rev: 'Invertida: desbordamiento emocional, codependencia, o empatía desplegada como medio de control.' },

  { id: 35, suit: 'cups', name: 'Rey de Copas',      img: 'cuki.jpg', emoji: '🌊',
    theme: 'Maestría emocional, autoridad tranquila',
    body: 'El Rey en un trono de piedra en mar abierto. Un colgante de pez en su cuello; un barco visible a lo lejos. El agua se mueve alrededor de su trono sin desalojarlo. Observa el mar turbulento que no lo mueve (maestría, no supresión) y el collar de pez (honra las profundidades). Lidera desde la inteligencia emocional, no anulando el sentir.',
    rev: 'Invertida: inestabilidad emocional en un rol de liderazgo, o usar la empatía como herramienta de manipulación.' },

  // ─ PENTÁCULOS ───────────────────────────────────────────────────────────────
  { id: 36, suit: 'pentacles', name: 'As de Pentáculos',     img: 'pe01.jpg', emoji: '🪙',
    theme: 'Comienzo material, oportunidad concreta',
    body: 'Una mano emerge de una nube sosteniendo un solo pentáculo. Abajo: un jardín con una puerta que se abre a un camino cultivado. Observa el arco (un punto de entrada al mundo material) y la moneda única (semilla, no cosecha). Una oportunidad concreta — proyecto, contrato o inversión que se presenta. El mundo material listo para recibir lo que se le aporte con compromiso.',
    rev: 'Invertida: oportunidad material perdida, planificación deficiente, o codicia bloqueando un buen inicio.' },

  { id: 37, suit: 'pentacles', name: 'Dos de Pentáculos',    img: 'pe02.jpg', emoji: '⚖️',
    theme: 'Equilibrio dinámico, malabares de prioridades',
    body: 'Una figura danza haciendo malabares con dos monedas rodeadas por un lemniscata horizontal. Barcos suben y bajan en olas agitadas detrás. Observa el bucle infinito en las monedas (este equilibrio no tiene punto fijo final) y el mar agitado (las condiciones externas no son estables, aun así gestiona). Mantener varias cosas en movimiento — no crisis, sino ajuste constante requerido.',
    rev: 'Invertida: desequilibrio que se inclina, decisiones financieras pobres, o agobio por demasiadas responsabilidades.' },

  { id: 38, suit: 'pentacles', name: 'Tres de Pentáculos',   img: 'pe03.jpg', emoji: '🏗️',
    theme: 'Artesanía, colaboración, habilidad reconocida',
    body: 'Un artesano trabaja en una catedral mientras dos arquitectos consultan planos — los tres a altura similar, los tres necesarios. Observa la catedral (estructura ambiciosa que requiere muchos tipos de pericia) y los tres roles distintos (hacedor, planificador, mecenas). Es la habilidad reconocida dentro de una estructura colaborativa. Trabajar con otros hacia algo que ninguno podría construir solo.',
    rev: 'Invertida: falta de trabajo en equipo, trabajo no reconocido, o artesanía pobre presentada como habilidad.' },

  { id: 39, suit: 'pentacles', name: 'Cuatro de Pentáculos', img: 'pe04.jpg', emoji: '😤',
    theme: 'Aferrarse, control, seguridad como barrera',
    body: 'Una figura coronada se aferra a monedas — una en la cabeza, una bajo cada pie, una apretada al pecho. Una ciudad está detrás de él, de la que se ha alejado. Observa la postura aislada (nada puede entrar ni salir) y la ciudad de la que se excluye por su propia posición. La riqueza como barrera en lugar de fundamento. Seguridad tan apretada que se convierte en el problema.',
    rev: 'Invertida: soltar el control, generosidad que fluye, o derrumbe del acaparamiento que permite movimiento.' },

  { id: 40, suit: 'pentacles', name: 'Cinco de Pentáculos',  img: 'pe05.jpg', emoji: '🌨️',
    theme: 'Dificultad, exclusión, ayuda cercana',
    body: 'Dos figuras luchan en la nieve ante un vitral iluminado de una iglesia. Uno está herido; ambos están delgados. La iglesia está cálida pero no entran. Observa el vitral iluminado (la ayuda está presente pero no se accede a ella) y el pie vendado (sufrimiento específico, no abstracto). Dificultad vivida junto a refugio disponible que aún no se entra ni se pide.',
    rev: 'Invertida: aceptar ayuda después de rechazarla, inicio de recuperación, o encontrar calor después de un período de exclusión.' },

  { id: 41, suit: 'pentacles', name: 'Seis de Pentáculos',   img: 'pe06.jpg', emoji: '🎁',
    theme: 'Dar y recibir, poder de la generosidad',
    body: 'Un mercader sostiene balanzas y da monedas a dos figuras arrodilladas. Observa las balanzas (¿es este dar verdaderamente equilibrado, o cargado por el poder?) y las figuras arrodilladas (la dinámica de poder de la caridad). Tanto dar como recibir conllevan su propia responsabilidad y vulnerabilidad. Las posiciones no son permanentes.',
    rev: 'Invertida: dar con condiciones, intercambio injusto, o deuda que crea dependencia.' },

  { id: 42, suit: 'pentacles', name: 'Siete de Pentáculos',  img: 'pe07.jpg', emoji: '🌱',
    theme: 'Paciencia, evaluación a mitad, crecimiento largo',
    body: 'Un agricultor se apoya en un bastón mirando un arbusto cargado de pentáculos. Ha estado trabajando; ahora hace una pausa para observar. Observa la pausa evaluativa (no detener — verificar) y el crecimiento abundante (algo desarrollado de un esfuerzo sostenido). Una carta de paciencia recompensada — y del momento necesario de evaluación honesta antes del empuje final.',
    rev: 'Invertida: impaciencia que socava el largo esfuerzo, pobre retorno de inversión real, o rechazo a evaluar honestamente.' },

  { id: 43, suit: 'pentacles', name: 'Ocho de Pentáculos',   img: 'pe08.jpg', emoji: '🔨',
    theme: 'Construcción de habilidad, trabajo enfocado, artesanía',
    body: 'Un artesano martilla un pentáculo en su banco; seis monedas completadas cuelgan detrás; una yace a sus pies — trabajo en progreso. Un pueblo distante es visible pero no está allí. Observa la serie de monedas completadas (repetición que construye maestría real) y su concentración total. El trabajo es el punto ahora mismo. No glamoroso, no terminado — pero la habilidad se acumula.',
    rev: 'Invertida: trabajo chapucero tras apariencia hábil, perfeccionismo bloqueando la producción, o atención puesta en otro lugar.' },

  { id: 44, suit: 'pentacles', name: 'Nueve de Pentáculos',  img: 'pe09.jpg', emoji: '🌺',
    theme: 'Abundancia ganada, autosuficiencia, refinamiento',
    body: 'Una figura elegante en un viñedo exuberante con un halcón encapuchado en su mano enguantada. Nueve pentáculos cuelgan entre las vides. Un caracol avanza a sus pies. Observa el halcón entrenado (esta abundancia requirió disciplina — ella la construyó) y el caracol (acumulación lenta y segura). Ella es la fuente de su propia riqueza. El jardín es genuinamente suyo.',
    rev: 'Invertida: dependencia financiera, abundancia perteneciente a otro, o lujo sin seguridad real por debajo.' },

  { id: 45, suit: 'pentacles', name: 'Diez de Pentáculos',   img: 'pe10.jpg', emoji: '🏛️',
    theme: 'Legado, riqueza familiar, fundamentos duraderos',
    body: 'Un anciano sentado en un arco mientras una pareja joven y niños interactúan cerca. Perros a sus pies. Los pentáculos están dispuestos en el Árbol de la Vida cabalístico. Observa las tres generaciones presentes simultáneamente (pasado, presente y futuro) y la arquitectura (algo construido para sobrevivir a su constructor). ¿Qué se ha acumulado que persistirá más allá del individuo?',
    rev: 'Invertida: conflicto familiar por herencia, legado inestable, o riqueza que ha perdido significado y comunidad.' },

  { id: 46, suit: 'pentacles', name: 'Paje de Pentáculos',   img: 'pepa.jpg', emoji: '🌿',
    theme: 'Aprendizaje práctico, curiosidad enfocada',
    body: 'Un joven en campo abierto sostiene un pentáculo en alto y lo examina de cerca. Flores a sus pies; montañas a lo lejos. Observa el examen enfocado (estudiando, no admirando) y el campo abierto (espacio para desarrollarse, aún sin construir). El inicio de la inteligencia práctica — un estudiante del mundo material comprometido con entender cómo funcionan realmente las cosas.',
    rev: 'Invertida: falta de enfoque, estudio práctico abandonado, o una oportunidad real no tomada lo suficientemente en serio.' },

  { id: 47, suit: 'pentacles', name: 'Caballero de Pentáculos', img: 'peku.jpg', emoji: '🐎',
    theme: 'Confiabilidad, método constante, progreso fidedigno',
    body: 'Un caballero inmóvil en un pesado caballo de tiro, sosteniendo un pentáculo y examinándolo. Campos labrados se extienden detrás. Observa el caballo quieto (sin urgencia, sin prisa) y el campo ya labrado (trabajo metódico ya completado y continuando). La figura más confiable del mazo — no emocionante, no rápida, pero absolutamente fiable. El camino lento y correcto, mantenido aunque nadie observe.',
    rev: 'Invertida: terquedad confundida con constancia, exceso de cautela que no produce movimiento, o seguir sin propósito.' },

  { id: 48, suit: 'pentacles', name: 'Reina de Pentáculos',  img: 'pequ.jpg', emoji: '🐇',
    theme: 'Abundancia nutricia, calidez práctica',
    body: 'La Reina en un trono de naturaleza tallada, rodeada de vegetación desbordante, sosteniendo tiernamente un gran pentáculo. Un conejo salta en la base — fertilidad y ciclo natural. Observa el jardín abundante que simultáneamente mantiene e inhabita, y el sostenimiento suave de la moneda. Calidez y sentido práctico combinados — hacer un hogar real de los materiales disponibles.',
    rev: 'Invertida: cuidado asfixiante, ansiedad financiera que supera la generosidad, o abundancia mal gestionada por miedo.' },

  { id: 49, suit: 'pentacles', name: 'Rey de Pentáculos',    img: 'peki.jpg', emoji: '🐂',
    theme: 'Maestría material, éxito mundano, poder arraigado',
    body: 'El Rey en un trono de toros tallados, rodeado de vides y uvas exuberantes. Su manto está cubierto de imágenes de viñedo. Sostiene cetro y pentáculo. Observa los toros (Tauro — paciente, terrenal, metódico) y el crecimiento floreciente alrededor de su trono (su riqueza sustenta a otros). Dominó el mundo material no por suerte sino por método constante a lo largo del tiempo.',
    rev: 'Invertida: materialismo sin ética, corrupción de la riqueza, o éxito medido solo en dinero.' },

  // ─ ESPADAS ──────────────────────────────────────────────────────────────────
  { id: 50, suit: 'swords', name: 'As de Espadas',      img: 'sw01.jpg', emoji: '⚔️',
    theme: 'Claridad mental, verdad, avance decisivo',
    body: 'Una mano sostiene una espada erguida desde una nube. Una corona entretejida con laurel y olivo cuelga de la hoja. Abajo: montañas rocosas, el mar. Observa la corona en la hoja (pensamiento y autoridad combinados) y el laurel y olivo (victoria y paz son ambas posibles). Un don puro de claridad — una verdad que ya no puede evitarse, o una visión que corta limpiamente.',
    rev: 'Invertida: confusión, comunicación deficiente, o claridad aplicada cruelmente en lugar de constructivamente.' },

  { id: 51, suit: 'swords', name: 'Dos de Espadas',     img: 'sw02.jpg', emoji: '🙈',
    theme: 'Punto muerto, venda elegida, evasión',
    body: 'Una figura vendada sentada con brazos cruzados, sosteniendo dos espadas horizontales en equilibrio. Una luna creciente en el cielo nocturno; el mar detrás. Observa la venda puesta por ella misma (elige no ver) y las espadas perfectamente equilibradas (nada se inclina, nada se mueve). Una pausa deliberada — a veces descanso útil, a veces evasión.',
    rev: 'Invertida: el desbordamiento fuerza una decisión, o una elección tomada por miedo en lugar de claridad.' },

  { id: 52, suit: 'swords', name: 'Tres de Espadas',    img: 'sw03.jpg', emoji: '💔',
    theme: 'Desamor, duelo, verdad dolorosa nombrada',
    body: 'Tres espadas atraviesan un corazón rojo ante un cielo tormentoso con lluvia cayendo. Nada está suavizado aquí — es directo. Observa la lluvia (algo está lavando a través de la herida) y las tres espadas (a veces una de ellas es tu propia acción). Esta carta pide nombrar claramente lo que ha sido herido, y enfrentarlo en lugar de evitarlo.',
    rev: 'Invertida: recuperación en marcha, o dolor prolongado más allá de lo que puede enseñar aferrándose a la historia.' },

  { id: 53, suit: 'swords', name: 'Cuatro de Espadas',  img: 'sw04.jpg', emoji: '😴',
    theme: 'Descanso, recuperación, retiro estratégico',
    body: 'Una figura yace en efigie sobre una tumba; tres espadas montadas en la pared arriba; una debajo de la figura. Una vidriera muestra una oración. Observa la postura horizontal descansada (elegida, no derrotada) y las espadas fuera de uso (potencial guardado en reserva). Después del esfuerzo o el conflicto, esto marca la recuperación necesaria. La figura está viva — esto es una pausa, no un fin.',
    rev: 'Invertida: inquietud que impide la recuperación necesaria, o regresar del descanso antes de que estuviera completo.' },

  { id: 54, suit: 'swords', name: 'Cinco de Espadas',   img: 'sw05.jpg', emoji: '😏',
    theme: 'Victoria hueca, costos del conflicto, aftermath',
    body: 'Una figura con una sonrisa burlona recoge tres espadas mientras dos figuras abatidas se alejan. Dos espadas permanecen sin recoger en el suelo. Observa la sonrisa burlona (ganar no es lo mismo que tener razón) y las figuras que parten (algo en la relación fue el costo real). Una batalla fue ganada, pero con un precio. Esta carta pregunta: ¿qué clase de victoria es esta?',
    rev: 'Invertida: arrepentimiento después de una victoria hueca, o un conflicto finalmente liberado después de ser sostenido demasiado tiempo.' },

  { id: 55, suit: 'swords', name: 'Seis de Espadas',    img: 'sw06.jpg', emoji: '⛵',
    theme: 'Transición, movimiento hacia terreno más tranquilo',
    body: 'Un barquero guía un bote con una mujer y un niño a bordo, cabezas inclinadas. Seis espadas se yerguen en la proa. Agua agitada a la derecha; agua más tranquila adelante a la izquierda. Observa la dirección del viaje (alejándose de la turbulencia) y las espadas erguidas en la proa (los pensamientos y recuerdos vienen — no desaparecen). Esta es transición práctica, no escape.',
    rev: 'Invertida: resistir un movimiento necesario, o regresar hacia el agua agitada cuando el camino más tranquilo es visible.' },

  { id: 56, suit: 'swords', name: 'Siete de Espadas',   img: 'sw07.jpg', emoji: '🦊',
    theme: 'Estrategia, independencia, evasión',
    body: 'Una figura carga cinco espadas alejándose de un campamento militar, dejando dos detrás, mirando sobre su hombro. Observa la mirada hacia atrás (es completamente consciente del riesgo) y las dos espadas dejadas (no lo toma todo — estratégico). Pensamiento astuto y táctico, o engaño — la carta no juzga cuál. No toda estrategia es deshonesta; no toda evasión es cobardía.',
    rev: 'Invertida: el engaño sale a la luz, culpa por algo evadido, o sincerarse después de un retiro.' },

  { id: 57, suit: 'swords', name: 'Ocho de Espadas',    img: 'sw08.jpg', emoji: '🤐',
    theme: 'Restricción mental, trampa autoimpuesta',
    body: 'Una figura vendada y atada ligeramente está en un anillo de ocho espadas. Suelo mojado bajo ella. Las espadas no la tocan — hay brechas entre ellas. Observa las ataduras flojas (podría liberarse las manos) y los huecos en el anillo de espadas (podría salir caminando). La trampa es la venda y la creencia, no muros reales. La jaula es real solo mientras se cree en ella.',
    rev: 'Invertida: encontrar la salida, o descubrir que una restricción era mantenida en gran parte por la creencia.' },

  { id: 58, suit: 'swords', name: 'Nueve de Espadas',   img: 'sw09.jpg', emoji: '😰',
    theme: 'Ansiedad, miedo nocturno, sufrimiento mental',
    body: 'Una figura se sienta en la cama, cabeza entre las manos, en la oscuridad. Nueve espadas cuelgan horizontalmente en la pared. Una colcha muestra símbolos zodiacales y rosas talladas. Observa el contexto nocturno (los pensamientos de medianoche se amplifican, distorsionados por la oscuridad) y el zodiaco en la colcha (el universo continúa; esta es una fase pasajera). El sufrimiento es real pero puede superar la situación real.',
    rev: 'Invertida: emergiendo de un período mental oscuro, o comenzando a confrontar los miedos en lugar de habitarlos.' },

  { id: 59, suit: 'swords', name: 'Diez de Espadas',    img: 'sw10.jpg', emoji: '😮',
    theme: 'Fondo, derrota, final necesario',
    body: 'Una figura boca abajo con diez espadas en la espalda. A lo lejos, el cielo comienza a aclararse sobre agua tranquila. Su mano forma un mudra — intencional incluso en el colapso. Observa el horizonte que se aclara (punto más bajo — luego gira) y la posición de la mano (no completamente rendido sino aceptando). Este es el suelo. Es también el punto de inflexión.',
    rev: 'Invertida: negativa a reconocer que algo ha terminado, o prolongar un colapso ya completado.' },

  { id: 60, suit: 'swords', name: 'Paje de Espadas',    img: 'swpa.jpg', emoji: '🌬️',
    theme: 'Vigilancia, mente ágil, curiosidad alerta',
    body: 'Un joven en terreno elevado, espada en alto, observando el viento mover las nubes arriba. Pájaros vuelan detrás. Observa la posición elevada (vigilancia, análisis, aún no compromiso) y la espada en alto (listo, estudiando, sin golpear). Curiosidad aguda y vigilancia — una mente que observa y mapea antes de comprometerse. La espada aún no ha sido plenamente probada.',
    rev: 'Invertida: chismes, curiosidad usada como vigilancia, o la atención que se inclina hacia la paranoia.' },

  { id: 61, suit: 'swords', name: 'Caballero de Espadas', img: 'swku.jpg', emoji: '🌪️',
    theme: 'Velocidad, decisión, cortar a través',
    body: 'Un caballero carga a todo galope, espada en alto, cabello y melena del caballo ondeando al viento. Árboles se doblan detrás. Observa la velocidad pura (sin hesitación, sin verificar) y los árboles doblados (la fuerza registrándose en todo lo cercano). La figura más rápida y decisiva del mazo — brillante en una emergencia, potencialmente destructiva como modo predeterminado.',
    rev: 'Invertida: imprudencia, agresión sin dirección, o velocidad que daña antes de resolver.' },

  { id: 62, suit: 'swords', name: 'Reina de Espadas',   img: 'swqu.jpg', emoji: '🗡️',
    theme: 'Claridad, franqueza, independencia ganada',
    body: 'La Reina sentada en alto, una mano extendida hacia adelante, la otra sosteniendo una espada erguida. El cielo está despejado; una mariposa descansa en su corona. Observa el cielo despejado (nada nubla su visión) y la mano extendida (invitando comunicación directa y honesta). Ha conocido la pérdida y de ella ganó claridad. No suaviza la verdad, pero tampoco la empuña descuidadamente.',
    rev: 'Invertida: crueldad disfrazada de honestidad, amargura, o cortar el sentir hasta el punto del frío.' },

  { id: 63, suit: 'swords', name: 'Rey de Espadas',     img: 'swki.jpg', emoji: '👁️',
    theme: 'Autoridad mental, poder justo, pensamiento preciso',
    body: 'El Rey en un trono de piedra, espada apuntando recto hacia arriba, mirando directamente al observador. El cielo está casi despejado. Observa la espada vertical (sostenida para la justicia, no alzada para herir) y la mirada directa (nada desviado ni evitado). La mente en su punto más poderoso y responsable — usando el pensamiento y el lenguaje con precisión. Mayor autoridad del palo.',
    rev: 'Invertida: tiranía intelectual, abuso de la autoridad racional, o principio rígido aplicado sin compasión.' },

  // ─ VARITAS ──────────────────────────────────────────────────────────────────
  { id: 64, suit: 'wands', name: 'As de Varitas',       img: 'wa01.jpg', emoji: '🔥',
    theme: 'Chispa creativa, nueva iniciativa, fuerza vital',
    body: 'Una mano emerge de una nube sosteniendo una varita con hojas brotando — viva y en crecimiento, no madera tallada. Abajo: un río, un castillo distante, colinas abiertas. Observa la varita viva (no una herramienta muerta sino algo que crece) y el paisaje abierto (hacia donde podría ir esta energía). Un impulso creativo puro — la chispa antes del proyecto. Toda empresa nacida de la pasión comienza aquí.',
    rev: 'Invertida: bloqueo creativo, proyecto demorado, o energía de fuerza vital mal dirigida o suprimida.' },

  { id: 65, suit: 'wands', name: 'Dos de Varitas',      img: 'wa02.jpg', emoji: '🌍',
    theme: 'Visión futura, mundo en mano, pre-partida',
    body: 'Una figura en un muro de castillo sostiene un pequeño globo, mirando al mar. Una varita está montada en el muro; él sostiene otra. Observa el globo en su mano (el mundo dimensionado y sostenido) y el mar aún no cruzado (es el momento de la visión antes del viaje). La idea se ha convertido en intención física. El viaje no ha comenzado pero la decisión de ir ha sido tomada.',
    rev: 'Invertida: planificación que nunca lleva a la acción, o miedo a lo desconocido bloqueando expansión legítima.' },

  { id: 66, suit: 'wands', name: 'Tres de Varitas',     img: 'wa03.jpg', emoji: '⛵',
    theme: 'Expansión, primera inversión enviada, observando retornos',
    body: 'Una figura de espaldas observa barcos navegar en un amplio mar. Tres varitas plantadas a su alrededor. Observa los barcos en el agua (inversiones ya enviadas) y su postura de observación (esperando lo que regresa). La primera fase está completa — los barcos fueron enviados. Ahora viene la atención paciente a lo que vuelve. Éxito temprano, no llegada final.',
    rev: 'Invertida: retrasos en planes ya lanzados, o expansión encontrando complicaciones inesperadas a mitad del viaje.' },

  { id: 67, suit: 'wands', name: 'Cuatro de Varitas',   img: 'wa04.jpg', emoji: '🎉',
    theme: 'Celebración, umbral, alegría comunitaria',
    body: 'Cuatro varitas forman un dosel colgado de flores y frutos sobre dos figuras celebrando. Un castillo y personas reunidas están al fondo. Observa la estructura del dosel (un umbral — algo ha sido cruzado) y la reunión detrás (esta alegría es comunitaria, no privada). Un regreso a casa, un proyecto completado, un hito de cosecha — celebración genuina de algo ganado juntos.',
    rev: 'Invertida: tensión bajo la celebración, un hito sin el reconocimiento adecuado, o conflicto familiar en un umbral.' },

  { id: 68, suit: 'wands', name: 'Cinco de Varitas',    img: 'wa05.jpg', emoji: '🥊',
    theme: 'Competencia, fricción productiva, ideas en conflicto',
    body: 'Cinco figuras se enfrentan con varitas — pero nadie parece ganar ni resultar seriamente herido. No hay una dirección clara de ataque. Observa el desorden (fuerzas competidoras en múltiples direcciones, sin autoridad única) y las varitas mismas (no espadas — esto es disputa, no violencia). Competencia sana, fricción creativa, o la energía caótica inicial de múltiples ideas chocando antes de consolidarse.',
    rev: 'Invertida: evitar un conflicto que debería ocurrir, o agresión competitiva que podría canalizarse constructivamente.' },

  { id: 69, suit: 'wands', name: 'Seis de Varitas',     img: 'wa06.jpg', emoji: '🏅',
    theme: 'Victoria, reconocimiento público, elogio ganado',
    body: 'Un jinete en un caballo blanco avanza entre una multitud que aclama, coronado con una guirnalda de laurel, varita en alto. Observa el caballo blanco (esta victoria es limpia) y la multitud (el reconocimiento es público y genuino). Un momento de reconocimiento ganado — el trabajo ha sido visto y nombrado por otros. La carta pregunta: ¿cuál es tu relación con el reconocimiento externo?',
    rev: 'Invertida: fracaso de reconocimiento, arrogancia ante una victoria, o victoria que no se siente como se esperaba.' },

  { id: 70, suit: 'wands', name: 'Siete de Varitas',    img: 'wa07.jpg', emoji: '🛡️',
    theme: 'Mantener terreno, defensa bajo presión',
    body: 'Una figura se defiende en terreno elevado contra seis varitas atacando desde abajo. Sus pies calzan zapatos distintos — fue tomado por sorpresa. Observa la ventaja del terreno elevado (posicional) y los zapatos diferentes (esta defensa no fue completamente planeada — es improvisada). Mantener una posición bajo desafío real. ¿Vale la pena defender esto, y tienes la ventaja para sostenerlo?',
    rev: 'Invertida: ceder bajo presión, o defensividad innecesaria que invita aún más desafío.' },

  { id: 71, suit: 'wands', name: 'Ocho de Varitas',     img: 'wa08.jpg', emoji: '✈️',
    theme: 'Velocidad, impulso, cosas en rápido movimiento',
    body: 'Ocho varitas vuelan por el aire despejado sobre un paisaje abierto — sin figura, solo movimiento. Están apuntadas, no dispersas. Observa la trayectoria (van hacia algún lugar específico) y la ausencia de una figura dirigente (el lanzamiento ya ocurrió — esto es impulso puro). Mensajes llegando, planes acelerando, una fase de movimiento coordinado rápido. Capta la energía mientras está en movimiento.',
    rev: 'Invertida: retrasos, malcomunicación que interrumpe el impulso, o la prisa causando el tipo de error que crea.' },

  { id: 72, suit: 'wands', name: 'Nueve de Varitas',    img: 'wa09.jpg', emoji: '🤕',
    theme: 'Resiliencia, curtido por la batalla, último empuje necesario',
    body: 'Una figura vendada se apoya en una varita, mirando atrás con cautela. Ocho varitas se yerguen detrás como una cerca. Observa el vendaje (ha recibido golpes reales antes de este momento) y la cautela (no es paranoia — la experiencia le ha enseñado a esperar otro desafío). Etapa tardía de un largo esfuerzo. El fin está cerca; se necesita un último empuje. Cansado, no terminado.',
    rev: 'Invertida: rendirse justo antes del fin, o negativa obstinada a reconocer cuándo la lucha real ha terminado.' },

  { id: 73, suit: 'wands', name: 'Diez de Varitas',     img: 'wa10.jpg', emoji: '😤',
    theme: 'Carga, sobrecarga, cerca de la meta',
    body: 'Una figura carga un pesado fardo de diez varitas, el cuerpo doblado por el peso, avanzando hacia un pueblo distante. Observa la dirección del viaje (ya casi allí — el pueblo es visible) y la postura doblada (este es un costo real, no imaginado). La carga es pesada porque el trabajo fue grande y está casi completo. Delegar no es abandono. Llegar importa más que cargar todo.',
    rev: 'Invertida: incapacidad de delegar, cargas autoimpuestas aplastantes, o finalmente soltar lo que era demasiado pesado.' },

  { id: 74, suit: 'wands', name: 'Paje de Varitas',     img: 'wapa.jpg', emoji: '🦎',
    theme: 'Entusiasmo, disposición creativa, aventura',
    body: 'Un joven en el desierto estudia una varita brotante con curiosidad. Salamandras decoran su túnica — criaturas de fuego, símbolos de transformación por el calor. Observa el desierto (esta energía crece incluso sin entorno fácil) y las salamandras (el fuego y el cambio como estado natural). Energía cruda y entusiasta aún no dirigida a una forma específica. Disposición antes de conocer la dirección.',
    rev: 'Invertida: ideas que emocionan pero no van a ningún lado, energía creativa sin disciplina suficiente para formar algo.' },

  { id: 75, suit: 'wands', name: 'Caballero de Varitas', img: 'waku.jpg', emoji: '🐎',
    theme: 'Pasión, carga ardiente, impulso feroz',
    body: 'Un caballero en un caballo encabritado carga en el desierto, varita en alto. Su armadura muestra salamandras; su caballo apenas está contenido. Observa el caballo encabritado (fuerza al borde del control) y el fondo del desierto (intensidad pura, sin agua refrescante cerca). Todo fuego, toda velocidad, todo compromiso. Carismático y audaz, posiblemente imprudente. Aporta enorme energía a lo que comienza.',
    rev: 'Invertida: prisa que causa errores, energía apasionada sin seguimiento, o velocidad que pierde la meta en movimiento.' },

  { id: 76, suit: 'wands', name: 'Reina de Varitas',    img: 'waqu.jpg', emoji: '🌻',
    theme: 'Confianza, autoridad creativa, presencia magnética',
    body: 'La Reina en un trono tallado con leones sosteniendo una varita en una mano y un girasol en la otra. Un gato negro a sus pies. Observa el girasol (se orienta naturalmente hacia la vitalidad y la luz) y el gato negro (la sombra a sus pies, reconocida e integrada — no oculta). Autoridad creativa confiada y cálida. Sabe lo que quiere y no se disculpa por ello.',
    rev: 'Invertida: celos, agresión confundida con confianza, o energía creativa que se agotó y se volvió controladora.' },

  { id: 77, suit: 'wands', name: 'Rey de Varitas',      img: 'waki.jpg', emoji: '🦁',
    theme: 'Liderazgo visionario, maestría creativa',
    body: 'El Rey inclinado hacia adelante en su trono de leones — no descansando, sino activamente presente. Una salamandra y un lagarto vivo aparecen a sus pies. Su varita brota hojas vivas. Observa su postura hacia adelante (actúa, no espera) y la varita viva (su poder sigue siendo generativo, no almacenado). Un líder audaz y carismático que inspira estando completamente comprometido con su propia visión.',
    rev: 'Invertida: arrogancia, comportamiento dominante, o una visión tan audaz que supera a todos los que lo rodean.' },
]

// ── localStorage helpers ───────────────────────────────────────────────────────

interface DailyRecord { date: string; cardId: number; reversed: boolean }

function todayISO() { return new Date().toLocaleDateString('en-CA') }

function shuffled(ids: number[]): number[] {
  const a = [...ids]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function loadToday(): DailyRecord | null {
  try {
    const raw = localStorage.getItem(LS_DAILY)
    if (!raw) return null
    const r = JSON.parse(raw) as DailyRecord
    return r.date === todayISO() ? r : null
  } catch { return null }
}

function drawNext(excludeId?: number): { card: Card; reversed: boolean } {
  let remaining: number[]
  try { remaining = JSON.parse(localStorage.getItem(LS_DECK) ?? '[]') as number[] } catch { remaining = [] }
  remaining = remaining.filter(id => id !== excludeId)
  if (remaining.length === 0) {
    remaining = shuffled(DECK.map(c => c.id).filter(id => id !== excludeId))
  }
  const [cardId, ...rest] = remaining
  localStorage.setItem(LS_DECK, JSON.stringify(rest))
  const card = DECK.find(c => c.id === cardId) ?? DECK[0]
  const reversed = Math.random() < 0.5
  localStorage.setItem(LS_DAILY, JSON.stringify({ date: todayISO(), cardId: card.id, reversed }))
  return { card, reversed }
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TarotCard() {
  const [card,          setCard]          = useState<Card | null>(null)
  const [reversed,      setReversed]      = useState(false)
  const [flipped,       setFlipped]       = useState(false)
  const [imgOk,         setImgOk]         = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const today = loadToday()
    if (today) {
      const c = DECK.find(x => x.id === today.cardId)
      if (c) { setCard(c); setReversed(today.reversed); return }
    }
    const { card: c, reversed: rev } = drawNext()
    setCard(c); setReversed(rev)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function drawNew(e?: React.MouseEvent) {
    e?.stopPropagation()
    const { card: c, reversed: rev } = drawNext(card?.id)
    setCard(c); setReversed(rev); setImgOk(true); setFlipped(false)
  }

  if (!card) {
    return (
      <div className="relative w-full" style={{ paddingBottom: '150%' }}>
        <div className="absolute inset-0 flex items-center justify-center bg-ink-1/85" style={{ clipPath: CARD_CLIP }}>
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-ink-4/10 border-t-accent/60" />
        </div>
      </div>
    )
  }

  const color  = SUIT_COLOR[card.suit]
  const imgUrl = `${BASE}/${card.img}`

  const floatStyle: CSSProperties = reducedMotion
    ? { transform: 'perspective(1200px) rotateX(1deg) rotateY(-0.5deg)' }
    : { animation: 'tarotCardFloat 5s ease-in-out infinite', willChange: 'transform' }

  return (
    <>
      <style>{FLOAT_KF}</style>

      {/* Float + depth wrapper */}
      <div
        style={{
          ...floatStyle,
          boxShadow: '2px 3px 0px rgba(0,0,0,0.4), 0px 12px 35px rgba(0,0,0,0.35), 0px 4px 10px rgba(0,0,0,0.2)',
          borderRadius: 16,
        }}
      >
        <div style={{ perspective: '1200px' }}>
          <div className="relative w-full" style={{ paddingBottom: '150%' }}>
            {/* Flip container */}
            <div
              className="absolute inset-0"
              style={{
                transformStyle: 'preserve-3d',
                transition:     'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                transform:       flipped ? 'rotateY(180deg)' : 'none',
              }}
            >

          {/* ── FRONT: full-bleed image ────────────────────────────────── */}
          <div
            className="absolute inset-0 overflow-hidden cursor-pointer"
            style={{ backfaceVisibility: 'hidden', clipPath: CARD_CLIP }}
            onClick={() => setFlipped(true)}
          >
            {/* Full-bleed image or fallback */}
            {imgOk ? (
              <img
                src={imgUrl}
                alt={card.name}
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  filter:    'sepia(15%) contrast(1.05) brightness(0.98)',
                  transform: reversed ? 'rotate(180deg) scale(1.01)' : 'scale(1.01)',
                  transition: 'transform 0.4s ease',
                }}
                onError={() => setImgOk(false)}
              />
            ) : (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ background: `color-mix(in oklch, ${color} 12%, oklch(0.10 0.02 275))` }}
              >
                <span className="text-6xl leading-none" style={{ transform: reversed ? 'rotate(180deg)' : 'none' }}>{card.emoji}</span>
                <span className="text-center text-xs font-bold uppercase tracking-widest text-white/50">{card.name}</span>
              </div>
            )}

            {/* Top gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/65 to-transparent pointer-events-none" />

            {/* Numeral — top left */}
            {card.numeral && (
              <div className="absolute top-3 left-3.5 pointer-events-none">
                <span className="text-white/80 text-sm font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  {card.numeral}
                </span>
              </div>
            )}

            {/* Nueva button — top right */}
            <button
              onClick={drawNew}
              className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white/70 backdrop-blur-sm transition-colors hover:text-white/95"
              style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              ↺ nueva
            </button>

            {/* Bottom gradient */}
            <div
              className="absolute bottom-0 left-0 right-0 pointer-events-none"
              style={{ height: '32%', background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 55%, transparent 100%)' }}
            />

            {/* Card name + orientation — bottom */}
            <div className="absolute bottom-0 left-0 right-0 px-3.5 pb-3 pointer-events-none">
              <p className="text-white/90 text-[10px] font-bold uppercase tracking-[0.18em] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {card.name}
              </p>
              <p
                className="mt-0.5 text-[9px] font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                style={{ color: reversed ? 'oklch(0.78 0.14 65)' : 'oklch(0.68 0.18 150)' }}
              >
                {reversed ? '↓ Invertida' : '↑ Derecha'}
              </p>
            </div>
          </div>

          {/* ── BACK: interpretation ──────────────────────────────────── */}
          <div
            className="absolute inset-0 overflow-hidden flex flex-col cursor-pointer"
            style={{
              backfaceVisibility: 'hidden',
              transform:          'rotateY(180deg)',
              background:         'oklch(0.09 0.02 240)',
              clipPath:            CARD_CLIP,
            }}
            onClick={() => setFlipped(false)}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
              <button
                onClick={e => { e.stopPropagation(); setFlipped(false) }}
                className="text-[10px] text-white/35 transition-colors hover:text-white/60"
              >
                ← volver
              </button>
              <span
                className="text-[13px] font-bold"
                style={{ color: 'oklch(0.78 0.14 65)' }}
              >
                {reversed ? '↓' : '↑'}
              </span>
            </div>

            {/* Card name */}
            <div className="shrink-0 px-4 pb-1">
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-[0.18em]">
                {card.name}
              </p>
              <p
                className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.22em]"
                style={{ color }}
              >
                {card.theme}
              </p>
            </div>

            {/* Divider */}
            <div className="mx-4 mb-2 h-px shrink-0" style={{ background: `color-mix(in oklch, ${color} 25%, transparent)` }} />

            {/* Body — scrollable */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              <p className="text-[11.5px] leading-relaxed text-white/68">
                {card.body}
              </p>
              <div className="mt-3 border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] leading-relaxed text-white/32 italic">
                  {card.rev}
                </p>
              </div>
            </div>

            {/* Bottom hint */}
            <p className="shrink-0 pb-3 pt-2 select-none text-center text-[8.5px] text-white/18">
              tocar para nueva carta ▴
            </p>
          </div>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
