# Monitor de Fatiga Facial

Aplicación local para monitoreo de fatiga facial en el navegador. Usa la cámara
del dispositivo, MediaPipe Face Landmarker, heurísticas sobre landmarks faciales
y una alerta sonora para advertir cuando aparecen señales compatibles con
somnolencia.

El proyecto está pensado para funcionar sin backend: el video se procesa en el
navegador, los frames no se guardan y no se envían datos faciales a servidores.

> Este software es un prototipo de investigación y asistencia. No es un sistema
> de seguridad certificado y no debe usarse como única medida de prevención.

## Stack Técnico

- React 19 + TypeScript + Vite
- MediaPipe Tasks Vision Face Landmarker
- WebRTC `getUserMedia` para acceso a cámara
- Canvas 2D para análisis liviano de iluminación
- Web Audio API para alertas sonoras
- MapLibre GL para mapa en navegador
- Mapbox Directions API para calculo de rutas
- TailwindCSS 4 para estilos
- ESLint + Prettier para calidad de código

## Instalación

En Windows:

```bash
npm.cmd install
```

En macOS o Linux:

```bash
npm install
```

## Ejecutar Localmente

En Windows:

```bash
npm.cmd run dev
```

En macOS o Linux:

```bash
npm run dev
```

Luego abre la URL que aparece en la terminal, normalmente:

```text
http://localhost:5173/
```

En la app, pulsa `Iniciar cámara` y acepta el permiso de cámara.

Para calcular rutas GPS, crea un archivo `.env.local` basado en `.env.example`:

```bash
VITE_MAPBOX_ACCESS_TOKEN=tu_token_de_mapbox
```

El mapa puede abrir sin token usando teselas abiertas, pero `Calcular ruta`
requiere Mapbox Directions. En celulares, camara y GPS confiables requieren
HTTPS fuera de `localhost`; usa un tunel HTTPS o una configuracion local segura
para pruebas reales. Para una demo web desde laptop o una URL sin GPS real, usa
`GPS demo` en la vista `Ruta` y luego `Calcular ruta`.

Para probar desde un celular, ejecuta Vite escuchando en la red local:

```bash
npm.cmd run dev -- --host 0.0.0.0
```

Después abre en el celular la URL de red que muestra Vite, por ejemplo:

```text
http://192.168.x.x:5173/
```

El celular y la computadora deben estar en la misma red. En algunos navegadores
móviles, el acceso a cámara exige HTTPS o `localhost`; si la cámara no abre desde
IP local, prueba con un túnel HTTPS o con la configuración de permisos del
navegador.

## Comandos Útiles

```bash
npm.cmd run build
npm.cmd run lint
npm.cmd run format
```

En macOS o Linux, usa `npm run ...` en lugar de `npm.cmd run ...`.

## Funciones Principales

- Detección facial local con MediaPipe Face Landmarker.
- Cálculo de métricas faciales en vivo.
- Estimación de fatiga con puntuación de 0 a 100.
- Señales de ojos cerrados, bostezo, inclinación de cabeza, quietud facial y
  parpadeo repetido.
- Lectura más tolerante de ojos y boca cuando el rostro está parcialmente de
  perfil.
- Alerta sonora con cooldown configurable.
- Estado visual de detección: despierto, posible fatiga, somnolencia, sin rostro
  o cámara no disponible.
- Modo pantalla completa para uso desde celular.
- Vista `Ruta` con GPS real, busqueda de destino por texto, mapa, velocidad,
  rumbo, progreso de ruta, siguiente giro, ETA y alertas de curvas cerradas.
- Modo Visibilidad Móvil para baja luz, contraluz e iluminación insuficiente.

## Modo Visibilidad Móvil

El Modo Visibilidad Móvil mejora la experiencia de monitoreo facial con cámara
frontal en situaciones de baja luz, contraluz o iluminación deficiente. Está
diseñado para ayudar sin alterar el flujo principal de detección: MediaPipe sigue
analizando el video original, no un frame procesado.

### Análisis de iluminación

El hook `useLightingAnalysis` toma una muestra pequeña del video en un canvas de
96x54 cada 500 ms aproximadamente. Calcula:

- brillo promedio
- contraste aproximado
- proporción de píxeles oscuros
- proporción de píxeles muy claros
- posible contraluz
- confianza de la clasificación

Con esas métricas clasifica la escena como:

- `normal`
- `low-light`
- `backlit`
- `insufficient`

El análisis es liviano, se limpia al desmontar y no guarda frames.

### Mejora visual por software

Cuando está activada, la app aplica filtros CSS moderados al elemento `<video>`:

- baja luz: más brillo, contraste y saturación leve
- contraluz: brillo y contraste moderados
- noche manual: refuerzo más fuerte pero controlado
- off: sin filtros

Estos filtros solo cambian cómo se ve el video en pantalla. No se usan como
entrada de MediaPipe.

### Luz perimetral de pantalla

La luz perimetral es una capa blanca translúcida en los bordes del área de
cámara. En celular ayuda a que la pantalla ilumine el rostro sin tapar el video
ni los controles principales.

Intensidades disponibles:

- `off`: sin luz
- `low`: luz suave
- `medium`: luz visible, valor por defecto
- `high`: luz más fuerte para baja luz real

En modo `auto`, se activa automáticamente cuando la condición es baja luz o luz
insuficiente. En modo `night`, se activa manualmente siempre que la intensidad no
sea `off`.

La intensidad efectiva también escala sola: sube según qué tan oscuro esté el
video y aumenta otro tramo si el modelo ya cargó pero no logra reconocer un
rostro. El selector `low`, `medium` o `high` funciona como base; `off` siempre
mantiene la luz apagada.

### Capacidades reales de cámara

Después de obtener el stream, `useCamera` intenta leer capacidades del track de
video con `getCapabilities()` y `getSettings()`. Si el navegador lo permite,
`applyCameraEnhancements` intenta aplicar de forma segura:

- compensación de exposición
- frame rate estable
- resolución mínima estable
- torch cuando existe y no es cámara frontal

Si esas APIs no existen o el navegador rechaza un constraint, la app continúa
funcionando sin romper la detección.

### Recomendaciones de iluminación

La UI muestra un badge discreto sobre la cámara:

- Normal
- Baja luz
- Contraluz
- Luz insuficiente

Cuando la condición no es normal, muestra una recomendación corta. Si no se
detecta rostro y la iluminación es mala, el mensaje se enriquece con:

```text
Centra tu rostro y mejora la iluminación.
```

## Configuración Disponible

La interfaz permite ajustar:

- umbral de cierre de ojos
- duración mínima de cierre de ojos
- sensibilidad de bostezo
- pausa entre alertas
- sensibilidad general: baja, media o alta
- sonido activado/desactivado
- modo visibilidad: auto, noche, contraluz u off
- luz de pantalla: off, baja, media o alta
- mejora visual por CSS
- mejora de cámara cuando el navegador lo soporte

Los defaults están en `src/types/settings.types.ts`.

## Cómo Funciona la Detección

La app ejecuta inferencia de puntos faciales sobre los frames de la cámara en el
navegador. Cada frame se analiza con varias señales:

- Eye Aspect Ratio (EAR): valores bajos sugieren ojos cerrados.
- Mouth Aspect Ratio (MAR): valores altos sugieren bostezo.
- Pose de cabeza: las matrices de transformación facial de MediaPipe estiman
  pitch, yaw y roll.
- Movimiento facial: cambios pequeños en landmarks durante un periodo prolongado
  pueden indicar quietud sospechosa.
- Parpadeo: parpadeos repetidos en una ventana de tiempo aumentan la puntuación
  de fatiga.

El analizador suaviza métricas por frame, mide cuánto tiempo persiste cada señal
y actualiza una puntuación de fatiga de 0 a 100. La alerta se activa cuando la
puntuación supera el umbral de somnolencia o cuando los ojos permanecen cerrados
por más tiempo del configurado.

Cuando la cara está girada, la app usa la pose de cabeza para entrar en un modo
de confiabilidad reducida. En ese caso prioriza el ojo con mayor visibilidad y
valida bostezos con apertura vertical de boca relativa a la escala del rostro.
Si el perfil es demasiado extremo, la app evita disparar señales fuertes y
prefiere advertir que el rostro está fuera de ángulo.

## Estructura del Proyecto

```text
src/
  components/
    AlertBanner.tsx
    CameraView.tsx
    DetectionStatus.tsx
    FatiguePanel.tsx
    InfoSection.tsx
    MetricsPanel.tsx
    NavigationView.tsx
    RouteAssistantPanel.tsx
    RouteMapView.tsx
    SettingsPanel.tsx
  hooks/
    useAudioAlert.ts
    useCamera.ts
    useDrowsinessDetection.ts
    useFullscreen.ts
    useGpsTracking.ts
    useLightingAnalysis.ts
    useRouteProgress.ts
  services/
    drowsinessAnalyzer.ts
    faceDetectionService.ts
    routeService.ts
  types/
    detection.types.ts
    navigation.types.ts
    settings.types.ts
    visibility.types.ts
  utils/
    cameraEnhancements.ts
    landmarkUtils.ts
    mathUtils.ts
    routeGeometryUtils.ts
    visibilityUtils.ts
  App.tsx
  main.tsx
  styles.css
```

Los modelos y archivos WASM de MediaPipe se sirven localmente desde:

```text
public/mediapipe/
```

Esto evita depender de un CDN en tiempo de ejecución.

## Privacidad

- Los frames de la cámara se procesan localmente en el navegador.
- No hay backend.
- No se sube video a ningún servidor.
- No se guardan imágenes, video, perfiles biométricos ni frames de análisis de
  iluminación.
- Los landmarks y métricas viven solo en memoria durante la sesión.

## Limitaciones

- Los umbrales EAR, MAR y pose son heurísticos y pueden requerir calibración por
  persona.
- Gafas, mascarillas, sombras fuertes, contraluz extremo, desenfoque por
  movimiento o mala posición de cámara reducen la precisión.
- El soporte de perfil mejora gestos moderados de lado, pero no puede recuperar
  landmarks que la cámara ya no ve.
- El Modo Visibilidad Móvil ayuda, pero no reemplaza buena iluminación real.
- Las capacidades avanzadas de cámara dependen del navegador y del dispositivo.
  En iOS/Safari pueden estar limitadas o no existir.
- Algunos navegadores requieren interacción del usuario antes de permitir audio.
- El sistema no ha sido validado contra datasets clínicos o automotrices de
  somnolencia.

## Asistente de Ruta GPS

La vista `Ruta` usa `navigator.geolocation.watchPosition` con alta precision como
fuente principal. Si la alta precision no responde, intenta una lectura
aproximada del navegador para facilitar pruebas web. Cuando el navegador no
entrega `speed` o `heading`, la app los
estima a partir de lecturas GPS consecutivas y muestra un estado degradado si la
precision no es suficiente.

El origen de la ruta es la ubicacion GPS actual. El destino principal se ingresa
como direccion, nombre de lugar o punto de interes y se resuelve con Mapbox
Geocoding; las coordenadas lat/lng siguen disponibles como respaldo manual. La
ruta se calcula con Mapbox Directions. La app proyecta la posicion GPS sobre la
ruta para estimar distancia restante, ETA, duracion restante, proximo giro,
salida de ruta y curvas cerradas dentro de la ventana de advertencia.

Limitaciones de esta primera version:

- No incluye trafico en vivo, reportes comunitarios ni limites oficiales de
  velocidad.
- El recalculo automatico al desviarse depende de tener GPS activo, destino
  seleccionado y token Mapbox valido; usa un cooldown para evitar llamadas en
  bucle.
- En desktop puede funcionar como apoyo de desarrollo, pero la ubicacion suele
  venir de Wi-Fi/IP y no representa GPS de carretera.
- El boton `GPS demo` fija un origen de prueba en Bogota para validar rutas en
  navegador cuando no hay permiso, HTTPS o sensor GPS disponible.

## Mejoras Futuras

- Calibración inicial por usuario.
- PWA offline.
- Mejor estimación de pose de cabeza en condiciones difíciles.
- Registro local de eventos sin guardar video ni imágenes faciales.
- Dashboard de eventos y tendencias de fatiga.
- Integración opcional con alarma externa por hardware.
- Evaluación con datasets especializados de somnolencia.
