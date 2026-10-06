# `.well-known/` — enlaces que abren la app (iOS y Android)

`apple-app-site-association` (AASA) es lo que hace que iOS abra la app en vez del
navegador cuando alguien toca un enlace `https://nott.es/p/…`, `/e/…`, `/v/…`, `/u/…`,
`/g/…` o `/noche/…`. **Está activo**: la app lleva `associatedDomains` con
`applinks:nott.es` desde la 1.2.0 (y `applinks:getnox.es` desde la 1.1.0). El Team ID es
`NW3H8PF3XV.com.juanruiz.nox` (si cambiara, está en App Store Connect → Membership
details).

`/noche/*` (las noches especiales, como la de Luminata) se añadió en octubre de 2026. No
necesita build: la app ya entiende `https://nott.es/noche/<id>`; basta con que el path esté
aquí.

## Al cambiar el fichero

1. Comprobar que GitHub Pages lo sirve:

   ```bash
   curl -I https://nott.es/.well-known/apple-app-site-association
   ```

   Tiene que responder **200**. GitHub Pages lo sirve sin extensión como
   `application/octet-stream`; desde iOS 9.3 Apple **acepta** ese content-type (ya no
   exige `application/json` ni firma). Si algún día dejara de valer, la salida es mover
   el sitio a un hosting donde se pueda fijar la cabecera (Cloudflare Pages, Netlify).

2. Verificar lo que tiene la CDN de Apple
   (<https://app-site-association.cdn-apple.com/a/v1/nott.es>) DESPUÉS de publicar:
   la CDN lo cachea y puede tardar horas o un día en refrescarse. Los iPhone, además, lo
   vuelven a pedir al instalar o actualizar la app y de vez en cuando.

## Notas

- El fichero **no lleva extensión** a propósito: iOS lo pide exactamente en
  `/.well-known/apple-app-site-association`.
- La raíz del repo tiene `.nojekyll`, que es lo que hace que GitHub Pages publique las
  carpetas que empiezan por punto (sin él, `.well-known/` no se serviría).
- Si un iPhone aún no tiene el AASA nuevo, el enlace abre la página puente (`/p/`, `/e/`,
  `/v/`, `/u/`, `/g/`, `/a/`, `/noche/…`), que en iPhone intenta abrir la app sola (iOS
  pregunta "¿Abrir esta página en NOTT?"). No redirige sola a la App Store: el botón
  queda de respaldo.
- **Android no abre `/noche/…` todavía**: sus paths van en el binario (`intentFilters`
  de `app.json`), que hoy solo cubre `/p/ /e/ /v/ /u/ /g/`. Hasta el próximo binario,
  `/noche/…` cae en la página puente, que ofrece «Abrir en NOTT» con un `intent://`.


---

# `assetlinks.json` — App Links de Android

El equivalente de Android al AASA: hace que `https://nott.es/p/…`, `/e/…`, `/v/…`,
`/u/…` y `/g/…` abran NOTT en vez del navegador. Lo verifica el sistema por Digital Asset
Links, de forma **asíncrona** tras instalar (no al instante como en iOS), y si falla el
enlace simplemente cae al navegador.

Dos diferencias con el AASA que se prestan a confusión:

- **Aquí va el SHA-256, no el SHA-1.** Digital Asset Links solo acepta SHA-256. El SHA-1
  es lo que piden el cliente OAuth de Google Sign-In y la restricción de la key de Maps.
- **No se identifica con el Team ID sino con la huella del certificado que firma el APK.**

## ⚠️ Falta la huella de Google

La huella publicada hoy es la de la **upload key** de EAS, que es la que firma los APK de
`preview` que se instalan a mano. Con Play App Signing, Google **re-firma** el `.aab` con
SU propia clave, así que el binario que instala un usuario desde la tienda tiene otra
huella distinta y **los App Links no le funcionarán hasta que se añada aquí**.

En cuanto se suba el primer `.aab` a Play: Play Console → NOTT → Release → Setup →
**App integrity** → copiar el SHA-256 del *certificado de firma de la app* (no el de
carga) y **añadirlo** al array. Caben las dos y deben quedarse las dos.

Es el mismo gotcha que rompe el login con Google en producción: con la huella de Google
sin registrar, a ti te funciona todo y a quien instala desde la tienda le falla.

## Comprobarlo

- Generador y validador oficial: https://developers.google.com/digital-asset-links/tools/generator
- En un dispositivo: `adb shell pm verify-app-links --re-verify com.juanruiz.nox`
  y luego `adb shell pm get-app-links com.juanruiz.nox`
