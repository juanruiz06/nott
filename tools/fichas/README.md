# Páginas de local, de evento y de ciudad

Genera `nott.es/<ciudad>/`, `nott.es/<ciudad>/<local>/` y `nott.es/<ciudad>/<local>/<evento>/`,
más `sitemap.xml` y `robots.txt`. La spec es la 134 v2 de `nott-es/nox`
(`docs/spec-fichas-web-seo-2026-11.md`).

| Fichero            | Qué es                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `build.mjs`        | Lee Supabase, construye las páginas y las escribe. Node 22, sin dependencias              |
| `plantillas.mjs`   | El HTML y los datos estructurados (JSON-LD) de cada tipo de página                       |
| `ciudades.json`    | Nombre y entradilla de cada ciudad (a mano). Una ciudad que falta hace fallar el build   |
| `manifest.json`    | Lo que escribió la última pasada. Lo escribe el build: no se toca a mano                 |
| `muestra.json`     | Datos de prueba para los tests                                                           |
| `build.test.mjs`   | `node --test tools/fichas/build.test.mjs`                                                |
| `../../assets/fichas.css` | Estilos, encima de `puente.css`                                                   |

## De dónde salen los datos

- `public.get_web_venues()`: las páginas de local publicadas (tabla `venue_web`, con revisión del
  owner). Es obligatoria: si devuelve 0 filas o falla, el build falla y no borra nada.
- `venta.eventos_web()`: los eventos públicos del SaaS 2.0 de los locales vinculados. Es opcional:
  mientras no exista en la base (`PGRST202` o `PGRST106`), las páginas salen sin eventos.

Las dos se llaman con la key publicable. Ninguna clave secreta entra en este repo.

## Reglas

- **Solo escribe y borra lo que apunta en `manifest.json`.** Si una ruta generada choca con una
  página hecha a mano (legal, puentes, home), falla.
- Una ciudad no puede llamarse como una ruta que ya existe en la raíz (`RESERVADOS` en `build.mjs`).
- Todo texto de la base se escapa; los enlaces de fuera solo valen con `https://` y llevan
  `rel="nofollow"`.
- La compra de un evento es la ficha del SaaS (`lista.nott.es/saas/f/<slug>`): aquí solo se enlaza.

## En local

```bash
SUPABASE_URL=https://<proyecto>.supabase.co SUPABASE_PUBLISHABLE_KEY=sb_publishable_… node tools/fichas/build.mjs
```

Escribe en la raíz de este repo. Con `NOINDEX=1`, todas las páginas llevan `noindex`.

## La Action

`.github/workflows/fichas.yml` corre cada hora y commitea solo si algo cambió. Está apagada hasta
que la variable del repo `FICHAS_ACTIVAS` valga `1`. Freno de emergencia: `FICHAS_NOINDEX=1` y
lanzarla a mano.
