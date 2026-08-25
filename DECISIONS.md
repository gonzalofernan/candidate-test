# Decisiones Tecnicas

> Documento de decisiones relevantes tomadas durante la implementacion de la prueba.
> Se priorizan decisiones estructurales, bugs reales detectados y compromisos de producto/arquitectura.

## Informacion del Candidato

- **Nombre:** Gonzalo Fernández de la Torre
- **Fecha:** 2026-08-24
- **Tiempo dedicado:** Aproximadamente 8-10 horas

---

## Decisiones de Arquitectura

### 1. No utilizar Zustand como estado central del chat

**Contexto:** El producto requiere que cada alumno tenga su propio historico de chat, pero el contenido academico de un curso es comun para multiples alumnos. Al revisar el frontend aparecia la duda de si usar Zustand como store global (segun aparecia package.json) o mantener una arquitectura mas simple apoyada en backend y estado local de React.

**Opciones consideradas:**
1. Usar Zustand como store central del chat en frontend para mensajes, conversacion activa y parte de la logica de estado.
2. No usar Zustand como pieza central y persistir el historico en backend, almacenando los embeddings del contenido una sola vez por curso y reutilizandolos entre conversaciones y alumnos.

**Decision:** He optado por no utilizar Zustand como estado central del chat. El historico del chat se trata como dato persistente del backend y los embeddings como conocimiento compartido por curso. El frontend queda como una capa ligera de interfaz, responsable solo del estado efimero de UX, mientras que MongoDB es la fuente de verdad tanto para conversaciones como para chunks indexados.

**Consecuencias:** Esta decision reduce complejidad en frontend y evita duplicar fuentes de verdad entre un store global y el backend. Tambien deja mas claro que estado es persistente y que estado es puramente visual o transitorio. Zustand podria tener sentido si el chat se repartiera entre muchas pantallas o necesitara coordinacion global compleja en cliente, pero en esta prueba React Query y estado local cubren mejor el problema real.

---

### 2. Separar indexacion y consulta en el flujo RAG

**Contexto:** El sistema RAG necesita embeddings del contenido de los cursos para poder recuperar contexto relevante en el chat. La duda arquitectonica era si esos embeddings debian generarse repetidamente durante el uso normal de la aplicacion o si debian tratarse como un recurso persistente que se crea una vez y se reutiliza.

**Opciones consideradas:**
1. Generar o recalcular embeddings de los cursos durante las sesiones de los alumnos o al iniciar conversaciones.
2. Separar indexacion y consulta: crear embeddings una vez por curso y reutilizarlos en cada pregunta, reindexando solo cuando cambie el material.

**Decision:** He optado por separar claramente la fase de indexacion de la fase de consulta. Los embeddings del contenido del curso se generan una sola vez por curso mediante un proceso explicito de indexacion y quedan almacenados en MongoDB. Durante el uso normal del chat, solo se genera el embedding de la pregunta del alumno y se busca similitud contra los chunks ya indexados.

**Consecuencias:** Esta decision reduce coste, latencia y complejidad operativa, ya que evita recalcular embeddings del curso en cada sesion o conversacion. Tambien encaja mejor con la naturaleza del dominio: el contenido academico cambia poco y puede tratarse como conocimiento persistente. Como contrapartida, cuando cambie el material de un curso es necesario lanzar una reindexacion explicita para mantener el conocimiento actualizado.

---

### 3. Asociar conversaciones a un curso o permitir modo libre

**Contexto:** Una vez implementado el flujo RAG aparecio una incoherencia de dominio: las conversaciones pertenecian al alumno, pero la recuperacion semantica podia buscar en todos los cursos indexados sin distinguir sobre cual estaba preguntando el usuario. Eso podia mezclar chunks de cursos distintos en una misma respuesta, reduciendo la precision del asistente.

**Opciones consideradas:**
1. Mantener un chat completamente global para todas las preguntas y buscar siempre entre todos los cursos.
2. Obligar a que toda conversacion estuviera asociada a un curso concreto, sin posibilidad de preguntas abiertas.
3. Permitir dos modos: conversacion asociada a un curso cuando el alumno quiere dudas focalizadas, y modo libre cuando quiere una conversacion general sin curso definido.

**Decision:** He optado por un modelo mixto. Cada conversacion puede tener un `courseId` opcional: si existe, el RAG filtra la busqueda semantica a ese curso; si no existe, la conversacion funciona en modo libre y puede consultar toda la base de conocimiento. De esta forma la precision mejora en el caso academico principal, pero no se pierde flexibilidad para preguntas generales o transversales.

**Consecuencias:** Esta decision hace el dominio mas coherente, porque una conversacion ya puede expresar explicitamente de que curso trata. Tambien mejora la calidad del RAG al evitar contaminacion entre embeddings de cursos distintos y permite reflejar en backend y frontend el alcance real de cada conversacion. Como contrapartida, anade una pequena complejidad de producto y de interfaz, ya que el usuario debe poder elegir entre modo libre y curso concreto al iniciar una conversacion.

---

### 4. Mantener historial persistente y recuperable por conversacion

**Contexto:** El chat no solo debia responder, sino tambien permitir retomar conversaciones anteriores del alumno. Eso implicaba que el historial no podia tratarse como estado temporal de la sesion actual ni como una simple secuencia de mensajes aislados.

**Opciones consideradas:**
1. Mantener solo la conversacion activa en memoria y perder el contexto al cambiar o recargar.
2. Persistir mensajes, pero sin exponer una lista clara de conversaciones reutilizables.
3. Tratar la conversacion como entidad persistente de primer nivel, con su propio historial, apertura posterior y eliminacion independiente.

**Decision:** He optado por modelar el historial por conversaciones persistentes. Cada conversacion del alumno se guarda en MongoDB, puede listarse, reabrirse y eliminarse de forma independiente, mientras que los mensajes quedan asociados a su `conversationId`.

**Consecuencias:** Esta decision encaja mejor con el producto, porque permite retomar dudas anteriores, mantener continuidad contextual y dar al historial un comportamiento real de aplicacion, no solo de demo. Ademas ha permitido implementar listado de conversaciones, borrado independiente y paginacion de mensajes al hacer scroll hacia arriba.

---

### 5. Usar SSE sobre HTTP POST para el streaming

**Contexto:** El streaming de respuestas era un requisito "Should Have". Habia que decidir si introducir una infraestructura mas pesada como WebSocket o resolverlo con un mecanismo mas simple y acotado al caso de uso actual, que es emision unidireccional del servidor al cliente durante una respuesta del chat.

**Opciones consideradas:**
1. Implementar WebSocket para cubrir streaming y futuras interacciones bidireccionales.
2. Mantener solo respuesta no streaming.
3. Implementar streaming con eventos SSE serializados sobre una peticion HTTP POST, consumidos desde `fetch()` en frontend.

**Decision:** He optado por SSE sobre POST. El backend emite eventos `start`, `delta`, `done` y `error`, y el frontend los consume incrementalmente para pintar la respuesta del asistente segun llega.

**Consecuencias:** Esta decision reduce complejidad tecnica respecto a WebSocket, porque no exige capa extra de conexion persistente ni gestion de sesiones bidireccionales. Ademas encaja bien con el flujo actual del producto, donde solo hace falta enviar una pregunta y recibir una respuesta incremental. Como contrapartida, si en el futuro se quiere cancelacion avanzada, presencia, colaboracion o multiplexacion de eventos, WebSocket podria pasar a ser una mejor opcion.

---

### 6. Exponer en el chat el catalogo de cursos del endpoint de estudiante mientras no se confirme la regla de acceso

**Contexto:** El selector de alcance del chat necesita mostrar cursos seleccionables. A nivel de producto quedaba una duda no resuelta: si el alumno debe ver solo cursos en los que participa o si puede ver todo el catalogo disponible en plataforma.

**Opciones consideradas:**
1. Filtrar desde ya el selector para mostrar unicamente cursos con progreso o matriculacion del alumno.
2. Mostrar el catalogo que devuelve `/students/:id/courses`, enriquecido con progreso cuando exista, y posponer el filtrado estricto hasta confirmar la regla de negocio.

**Decision:** He optado por mantener por ahora el selector alineado con el endpoint actual de estudiante, que devuelve el catalogo con informacion de progreso del alumno cuando existe. No se ha introducido todavia un filtro estricto por matriculacion porque esa regla de acceso no estaba confirmada.

**Consecuencias:** Esta decision evita inventar una restriccion funcional no validada y mantiene consistencia entre frontend y backend. Como contrapartida, el selector puede mostrar cursos en los que el alumno todavia no tiene actividad. Si producto confirma que el acceso debe limitarse a cursos matriculados, esta parte deberia endurecerse en backend.

---

## Bugs Encontrados

### Bug 1. Reutilizacion incorrecta del historial cacheado entre conversaciones

**Ubicacion**
- **Archivo:** `apps/api/src/modules/chat/chat.service.ts`
- **Metodo:** `startNewConversation`

**Descripcion del bug**
Al iniciar una nueva conversacion, el codigo reutilizaba el historial cacheado de una conversacion previa y luego lo vaciaba con una mutacion sobre el mismo array. Como ambos historiales compartian referencia en memoria, limpiar el nuevo historial tambien podia borrar el historial cacheado de la conversacion anterior.

**Causa raiz**
Gestion incorrecta de referencias mutables dentro de `conversationCache`. En lugar de crear un array nuevo para la nueva conversacion, se reutilizaba el mismo array obtenido desde cache.

**Solucion aplicada**
Se crea siempre un array nuevo para la conversacion recien iniciada y se almacena con su `conversationId` propio en cache. Ademas, se reviso la actualizacion de cache en `sendMessage` para mantenerla alineada con los mensajes persistidos.

**Como lo detecte**
El enunciado indicaba que habia un bug intencional en el modulo de chat. Al revisar `startNewConversation` y cruzarlo con el comportamiento esperado del historico, se vio el aliasing de arrays y la posibilidad de contaminacion entre conversaciones.

---

### Bug 2. El historial no mostraba correctamente conversaciones anteriores en la UI

**Ubicacion**
- **Archivo:** `apps/web/src/pages/Chat.tsx`
- **Area:** hidratacion del historial y gestion de estado local al abrir conversaciones

**Descripcion del bug**
Al crear nuevas conversaciones o cambiar de una a otra, el panel lateral podia mostrar el historial pero el contenido abierto no siempre se cargaba o se mezclaba con mensajes ya presentes en memoria. Eso hacia parecer que la conversacion anterior "no existia" o que no era recuperable desde el historial.

**Causa raiz**
La sincronizacion entre el historial remoto y el estado local del chat no estaba bien resuelta. Habia riesgo de sobreescribir mensajes optimistas, conservar mensajes de otra conversacion o limpiar errores en momentos incorrectos.

**Solucion aplicada**
Se rehizo la hidratacion del historial por `conversationId`, se reseteo el estado efimero al cambiar de conversacion y se protegio la actualizacion de mensajes para no mezclar respuestas activas con historiales cargados desde backend.

**Como lo detecte**
Aparecio al probar el historial desde la UI: al crear varias conversaciones, el rail lateral mostraba entradas pero abrirlas no devolvia siempre el contenido esperado.

---

### Bug 3. Las respuestas y el historial mostraban caracteres corruptos

**Ubicacion**
- **Frontend:** `apps/web/src/pages/Chat.tsx`, `apps/web/src/components/ChatMessage.tsx`, `apps/web/src/pages/Dashboard.tsx`
- **Utilidad:** `apps/web/src/utils/text.ts`

**Descripcion del bug**
Varios mensajes aparecian con caracteres corruptos en tildes, signos de apertura o flechas. El problema afectaba tanto a textos del sistema como a contenido del historial.

**Causa raiz**
Mezcla de literales con codificacion incorrecta y contenido posiblemente interpretado con charset equivocado en algun punto del flujo.

**Solucion aplicada**
Se corrigieron los literales dañados y se anadio una normalizacion defensiva de texto en frontend para reparar patrones comunes de mojibake antes de pintar el contenido.

**Como lo detecte**
Fue visible al revisar el historial y las respuestas del chat en castellano, donde aparecian signos y vocales acentuadas corruptas.

---

### Bug 4. Al abrir conversaciones largas el scroll no aterrizaba de forma fiable en el ultimo mensaje

**Ubicacion**
- **Frontend:** `apps/web/src/pages/Chat.tsx`
- **Area:** apertura de conversaciones con historico paginado y auto-scroll inicial

**Descripcion del bug**
En algunas conversaciones largas, al reabrir el chat la vista no quedaba situada en el ultimo mensaje, sino a mitad del historial. El problema era especialmente visible en conversaciones con bastante contenido, donde la combinacion de hidratacion, scroll automatico y restauracion de posicion podia dejar la interfaz en un punto intermedio.

**Causa raiz**
La apertura de una conversacion reutilizaba la misma logica de auto-scroll suave que se usa al recibir mensajes nuevos. Esa animacion competia con la carga del historico y con la logica de paginacion superior, provocando un aterrizaje inconsistente en ciertos casos.

**Solucion aplicada**
Se separo el comportamiento de scroll inicial del comportamiento de streaming. Al hidratar una conversacion ya existente, el chat fuerza un posicionamiento inmediato al final del historial en lugar de usar desplazamiento suave, y mantiene la restauracion de posicion solo para la carga de paginas antiguas.

**Como lo detecte**
Aparecio al abrir una conversacion larga desde el historial y comprobar que la pantalla no empezaba en el ultimo bloque de mensajes, pese a que conversaciones mas cortas no presentaban el mismo sintoma.

---

## Suposiciones Realizadas

1. **Los embeddings se indexan por curso y no por alumno.**
   Se asume que el material academico es comun para todos los alumnos y que personalizar el conocimiento indexado por alumno no aporta valor suficiente para justificar el coste adicional.

2. **Un `courseId` opcional en conversacion es suficiente para modelar el alcance del RAG.**
   No se introdujo una entidad adicional de "workspace", "tema" o "contexto" porque para esta prueba el dominio principal se resuelve bien distinguiendo entre modo libre y modo por curso.

3. **El dashboard puede usar una visualizacion semanal estimada.**
   Como el seed no trae una serie temporal detallada por dia para graficar actividad real, se asumio que una distribucion visual derivada del tiempo total de estudio era suficiente para cerrar la experiencia base del dashboard.

4. **La trazabilidad tecnica debe persistirse aunque no se renderice en la UI.**
   Se asume que esa informacion puede ser util para debugging y evolucion futura del producto, aunque no sea valiosa para el usuario final.

5. **El frontend puede usar un `studentId` de prueba fijo.**
   La aplicacion no incluye autenticacion completa en esta prueba, asi que se asume un alumno seeded para recorrer el flujo funcional extremo a extremo.

6. **El selector de cursos del chat usa por ahora el catalogo devuelto por `/students/:id/courses`, no un filtro estricto por matriculacion.**
   Actualmente ese endpoint devuelve el catalogo global enriquecido con el progreso del alumno, por lo que un curso puede aparecer aunque el alumno no tenga actividad en el. Esto se mantiene asi mientras no se confirme la regla de negocio: si el alumno debe poder ver todos los cursos de la plataforma o solo aquellos en los que participa.

---

## Mejoras Futuras

Si tuviera mas tiempo, implementaria:

1. Cancelacion explicita de respuestas en streaming y timeout/cierre temprano desde frontend.
2. Reindexacion automatica o incremental del conocimiento cuando cambie el contenido de un curso.
3. Grafico de actividad semanal basado en eventos reales por dia, no en una distribucion estimada.
4. Filtrado de cursos en el selector del chat segun acceso real del alumno, una vez se confirme si la plataforma expone catalogo completo o solo cursos matriculados.
5. Panel interno de observabilidad para inspeccionar metadatos RAG sin exponerlos al alumno.
6. Autenticacion real y resolucion del `studentId` desde sesion en lugar de usar un alumno seeded fijo.
7. Citas o referencias visibles a los fragmentos recuperados por RAG cuando se quiera mas trazabilidad hacia el usuario final.

---

## Dificultades Encontradas

### 1. Mojibake y codificacion inconsistente
- **Problema:** Parte de la UI y algunos mensajes mostraban acentos y caracteres corruptos, lo que dificultaba validar el comportamiento real del chat.
- **Solucion:** Se corrigieron cadenas literales dañadas y se anadio una utilidad defensiva de normalizacion de texto en frontend.
- **Tiempo invertido:** Medio.

### 2. Sincronizacion entre streaming, fallback e historial
- **Problema:** El flujo del chat combinaba respuesta streaming, fallback a endpoint clasico e hidratacion posterior del historial, lo que podia generar condiciones de carrera o estados inconsistentes.
- **Solucion:** Se separaron mejor los estados de mensaje optimista, mensaje en streaming, historial cargado y error visible; ademas se reforzo la logica de reapertura de conversaciones.
- **Tiempo invertido:** Alto.

### 3. Coherencia de dominio entre chat general y chat por curso
- **Problema:** El RAG funcionaba tecnicamente, pero la precision era peor si la conversacion no distinguia de que curso venia la pregunta.
- **Solucion:** Se incorporo `courseId` opcional por conversacion y una seleccion explicita en frontend entre modo libre y curso concreto.
- **Tiempo invertido:** Medio.

### 4. Cierre de tests sobre una base ya parcialmente implementada
- **Problema:** Habia tests incompletos y comentarios heredados del scaffold inicial que ya no reflejaban el estado real del proyecto.
- **Solucion:** Se sustituyeron `it.todo()` por pruebas reales en backend y se limpiaron specs y ruido de consola en frontend.
- **Tiempo invertido:** Medio.

---

## Notas Adicionales

- El streaming quedo implementado con SSE sobre `POST /api/chat/message/stream`.
- La trazabilidad de RAG se conserva en backend, pero no se muestra al usuario final.
- El proyecto queda validado con builds de `candidate-web` y `candidate-api`, tests de backend por `nx` y tests web con `vitest`.
