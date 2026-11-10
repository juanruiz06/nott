# Invitaciones de grupo 2.0

`/g/<token>` abre la app por los enlaces universales existentes. GitHub Pages sirve `404.html`
si no está instalada: solo los tokens de grupo válidos se reenvían a `/g/?i=<token>`.
Los enlaces antiguos conservan su página. Los nuevos usan `g2_` seguido de 22 alfanuméricos.

La carta sigue [Figma 128:237](https://www.figma.com/design/HirhPqAUkurQ5162mL6CNh?node-id=128-237).
El nombre completo usa Bodoni; un separador explícito `/` permite dos líneas editoriales.
Ni ciudad, ni clase, ni cantidad de miembros se inventan. La web no enseña caras.

- iOS: el botón copia desde el gesto y después abre App Store. Si falla, lo dice y ofrece
  instalar y volver al enlace/QR. El banner de Safari y los enlaces externos no garantizan copia.
- Android: la tienda lleva `referrer=nott_group%3D<token>`. La app usa
  `expo-application.getInstallReferrerAsync()`, dependencia que ya existe en SDK 55.
- App instalada: el botón abre `nott://g/<token>`. En Android, el intent incluye fallback a Play
  con el mismo referrer.
- Escritorio: muestra el enlace canónico para abrirlo en el móvil.

`data-preview-url` en `g/index.html` apunta a la Edge `group-invitation-preview`. Envía un POST
sin cookies ni cabeceras secretas. La Edge solo publica título, emisor, condición y estado; la
RPC está cerrada a `anon` y `authenticated`. Un fallo transitorio conserva abrir/instalar y
explica que no se pudo cargar el nombre. Un 404 válido desactiva la invitación.

Antes de publicar esta web: aplicar la migración compatible y desplegar esa Edge en producción
con autorización; probar contra staging sustituyendo la URL localmente. No habilitar emisión de
enlaces hasta publicar el binario 2.0 que presenta el consentimiento. Este checkout no despliega.

Pruebas: `node --test assets/grupo.test.cjs`. Pendientes de dispositivo/tienda: Safari,
WhatsApp e Instagram (copia permitida/denegada y OTP que la reemplaza), instalación real desde
Google Play, primer arranque desde icono y volver al QR. Un navegador automatizado no demuestra
la recuperación tras instalar.

Fuentes verificadas el 10/11/2026:
[Expo Application SDK55](https://docs.expo.dev/versions/v55.0.0/sdk/application/#applicationgetinstallreferrerasync),
[Google Play Install Referrer](https://developer.android.com/google/play/installreferrer/library).
