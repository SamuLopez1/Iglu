# Monitor de Fatiga Facial

MVP con enfoque de producción para detección local de somnolencia facial en el
navegador. La app usa la cámara del dispositivo, MediaPipe Face Landmarker,
señales basadas en puntos faciales y una alarma con Web Audio para advertir
cuando una persona podría estar quedándose dormida.

Este proyecto es un prototipo de software para investigación y prevención de
fatiga al conducir. No es un sistema de seguridad certificado y no debe usarse
como única medida de prevención.

## Stack Técnico

- React 19 + TypeScript + Vite
- MediaPipe Tasks Vision Face Landmarker
- WebRTC `getUserMedia` para acceso a cámara
- Web Audio API para alertas sonoras
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

## Cómo Ejecutar Localmente

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

En la app, haz clic en `Start camera` y acepta el permiso de cámara.

Comandos útiles:

```bash
npm.cmd run build
npm.cmd run lint
```

## Estructura del Proyecto

```text
src/
  components/
    AlertBanner.tsx
    CameraView.tsx
    DetectionStatus.tsx
    FatiguePanel.tsx
    MetricsPanel.tsx
    SettingsPanel.tsx
  hooks/
    useAudioAlert.ts
    useCamera.ts
    useDrowsinessDetection.ts
  services/
    drowsinessAnalyzer.ts
    faceDetectionService.ts
  types/
    detection.types.ts
    settings.types.ts
  utils/
    landmarkUtils.ts
    mathUtils.ts
  App.tsx
  main.tsx
```

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

El analizador suaviza las métricas por frame, mide cuánto tiempo persiste cada
señal y actualiza una puntuación de fatiga de 0 a 100. La alerta se activa cuando
la puntuación supera el umbral de somnolencia o cuando los ojos permanecen
cerrados por más tiempo del configurado. El sistema de audio aplica un cooldown
para evitar que la alarma se dispare continuamente.

## Configuración Disponible

La interfaz permite ajustar:

- Umbral de cierre de ojos
- Duración mínima de cierre de ojos
- Sensibilidad de bostezo
- Cooldown de alerta
- Sonido activado/desactivado
- Sensibilidad de detección: baja, media o alta

## Privacidad

- Los frames de la cámara se procesan localmente en el navegador.
- Este proyecto no tiene backend y no sube video a ningún servidor.
- Los landmarks faciales se usan solo en memoria durante el ciclo de detección.
- La app no almacena datos faciales, imágenes, video ni perfiles biométricos.

El runtime WASM de MediaPipe y el modelo Face Landmarker se sirven desde la
carpeta `public/mediapipe/` del propio proyecto. Esto evita fallos por CDN,
reduce dependencias externas en tiempo de ejecución y mantiene los frames de
video siempre dentro del navegador.

## Limitaciones del MVP

- Los umbrales de pose de cabeza pueden variar según el ángulo de cámara y la
  iluminación.
- Los umbrales EAR y MAR son heurísticos y pueden requerir calibración por
  persona.
- Gafas, mascarillas, poca luz, desenfoque por movimiento o mala posición de la
  cámara pueden reducir la precisión.
- Algunos navegadores requieren una interacción del usuario antes de permitir
  reproducción de audio.
- El sistema no ha sido validado contra datasets clínicos o automotrices de
  somnolencia.

## Mejoras Futuras

- Versión móvil.
- Soporte PWA offline con assets de MediaPipe alojados localmente.
- Mejor estimación de pose de cabeza y calibración por usuario.
- Registro de eventos sin almacenar video ni imágenes faciales.
- Dashboard para eventos y tendencias de fatiga.
- Integración con GPS o datos de velocidad.
- Soporte para alarma externa por hardware.
- Modelo de ML más robusto entrenado y evaluado con datasets de somnolencia.
