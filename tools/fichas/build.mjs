#!/usr/bin/env node
// Genera las páginas de local, de evento y de ciudad de nott.es desde Supabase (spec 134 v2 de
// nott-es/nox, docs/spec-fichas-web-seo-2026-11.md). Node 22, sin dependencias.
//
//   SUPABASE_URL=… SUPABASE_PUBLISHABLE_KEY=sb_publishable_… node tools/fichas/build.mjs
//   NOINDEX=1 …   → todas las páginas con noindex (el freno de emergencia)
//
// Lee dos RPC con la key publicable:
//   - public.get_web_venues()  → las páginas de local publicadas (obligatoria: con 0 filas falla);
//   - venta.eventos_web()      → los eventos públicos del SaaS 2.0 (opcional: si aún no existe en
//                                la base, PGRST202/PGRST106, las páginas salen sin eventos).
//
// Solo escribe y borra lo que apunta en tools/fichas/manifest.json. Nunca toca una página hecha a
// mano (legal, puentes, home): si una ruta generada choca con un fichero que no es suyo, falla.

import { mkdir, readFile, readdir, rm, rmdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ORIGEN,
  paginaCiudad,
  paginaEvento,
  paginaLocal,
  rutaCiudad,
  rutaEvento,
  rutaLocal,
} from './plantillas.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ = resolve(AQUI, '..', '..');
const MANIFEST = 'tools/fichas/manifest.json';

/** Lo que ya vive en la raíz de nott.es: ninguna ciudad puede llamarse así. */
export const RESERVADOS = new Set([
  'a',
  'e',
  'f',
  'g',
  'o',
  'p',
  'u',
  'v',
  'noche',
  'luminata',
  'descargar',
  'privacidad',
  'terminos',
  'soporte',
  'seguridad-infantil',
  'eliminar-cuenta',
  'concurso-luminata',
  'pantalla-luminata',
  'assets',
  'tools',
  '.well-known',
  '.github',
]);

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_EVENTO = /^[a-z0-9]{12}$/;
const DIA = 24 * 60 * 60 * 1000;
const MAX_NOCHES = 8;
const MAX_SEMANA = 12;
const MAX_OTROS = 6;

// ─── Datos ────────────────────────────────────────────────────────────────────────────────────

async function rpc(url, key, nombre, esquema) {
  const res = await fetch(`${url}/rest/v1/rpc/${nombre}`, {
    method: 'POST',
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      ...(esquema ? { 'Content-Profile': esquema, 'Accept-Profile': esquema } : {}),
    },
    body: '{}',
    signal: AbortSignal.timeout(30_000),
  });
  const texto = await res.text();
  let cuerpo;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    cuerpo = texto;
  }
  return { ok: res.ok, status: res.status, cuerpo };
}

/** Las dos lecturas. Un fallo de red o de la base lanza: la Action se pone en rojo sin tocar nada. */
export async function leer({ url, key }) {
  if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY.');
  const base = url.replace(/\/+$/, '');
  const locales = await rpc(base, key, 'get_web_venues');
  if (!locales.ok || !Array.isArray(locales.cuerpo)) {
    throw new Error(`get_web_venues respondió ${locales.status}: ${JSON.stringify(locales.cuerpo)}`);
  }
  const eventos = await rpc(base, key, 'eventos_web', 'venta');
  let eventosWeb = null;
  if (eventos.ok) eventosWeb = eventos.cuerpo;
  else if (['PGRST202', 'PGRST106'].includes(eventos.cuerpo?.code)) eventosWeb = null;
  else throw new Error(`venta.eventos_web respondió ${eventos.status}: ${JSON.stringify(eventos.cuerpo)}`);
  return { locales: locales.cuerpo, eventosWeb };
}

// ─── Construir (puro) ─────────────────────────────────────────────────────────────────────────

const fichero = (ruta) => `${ruta.replace(/^\//, '')}index.html`;
const dia = (t) => (t ? new Date(t).toISOString().slice(0, 10) : null);

/** Cada <script type="application/ld+json"> de una página tiene que ser JSON válido. */
function comprobarJsonLd(ruta, html) {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch (e) {
      throw new Error(`JSON-LD inválido en ${ruta}: ${e.message}`);
    }
  }
}

/**
 * De los datos a los ficheros. No toca disco ni red.
 * @returns {{ archivos: Map<string, string>, avisos: string[] }} rutas relativas a la raíz
 */
export function construir({ locales, eventosWeb, ciudades, ahora = new Date(), noindex = false }) {
  if (!Array.isArray(locales) || locales.length === 0) {
    throw new Error('get_web_venues devolvió 0 locales: no se genera nada (protege contra borrar la web).');
  }
  const avisos = [];
  const archivos = new Map();
  const poner = (ruta, contenido) => {
    if (archivos.has(ruta)) throw new Error(`Dos páginas dan la misma ruta: ${ruta}`);
    comprobarJsonLd(ruta, contenido);
    archivos.set(ruta, contenido);
  };

  // Locales y ciudades.
  const porCiudad = new Map();
  const porId = new Map();
  for (const l of locales) {
    if (!SLUG.test(l.city_slug ?? '') || !SLUG.test(l.slug ?? '')) {
      throw new Error(`Slug inválido: ${l.city_slug}/${l.slug}`);
    }
    if (RESERVADOS.has(l.city_slug)) {
      throw new Error(`La ciudad «${l.city_slug}» choca con una ruta reservada de nott.es.`);
    }
    if (!ciudades[l.city_slug]) {
      throw new Error(`Falta la ciudad «${l.city_slug}» en tools/fichas/ciudades.json (nombre y entradilla).`);
    }
    if (!porCiudad.has(l.city_slug)) porCiudad.set(l.city_slug, []);
    porCiudad.get(l.city_slug).push(l);
    porId.set(l.venue_id, l);
  }

  // Eventos del SaaS: solo los que pueden salir y cuyo local tiene página.
  const vinculados = new Set(eventosWeb?.locales_vinculados ?? []);
  const t0 = ahora.getTime();
  const eventosDe = new Map();
  for (const ev of eventosWeb?.eventos ?? []) {
    const fin = new Date(ev.termina_en).getTime();
    const inicio = new Date(ev.empieza_en).getTime();
    if (!['abierto', 'cancelado'].includes(ev.estado)) continue;
    if (!(fin > t0) || !(inicio <= t0 + 90 * DIA)) continue;
    if (!SLUG_EVENTO.test(ev.slug ?? '')) {
      avisos.push(`Evento con slug inválido, no sale: ${JSON.stringify(ev.slug)}`);
      continue;
    }
    if (!porId.has(ev.venue_id)) {
      avisos.push(`El evento ${ev.slug} es de un local sin página publicada (${ev.venue_id}): revisa su página.`);
      continue;
    }
    if (!eventosDe.has(ev.venue_id)) eventosDe.set(ev.venue_id, []);
    eventosDe.get(ev.venue_id).push(ev);
  }
  for (const lista of eventosDe.values()) lista.sort((a, b) => a.empieza_en.localeCompare(b.empieza_en));

  const sitemap = [{ loc: `${ORIGEN}/` }];
  for (const [citySlug, ls] of [...porCiudad].sort(([a], [b]) => a.localeCompare(b))) {
    const ciudad = ciudades[citySlug];
    const ordenados = [...ls].sort((a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name, 'es'));
    const semana = ordenados
      .flatMap((local) => (eventosDe.get(local.venue_id) ?? []).map((ev) => ({ local, ev })))
      .filter(({ ev }) => ev.estado === 'abierto' && new Date(ev.empieza_en).getTime() < t0 + 7 * DIA)
      .sort((a, b) => a.ev.empieza_en.localeCompare(b.ev.empieza_en))
      .slice(0, MAX_SEMANA);

    poner(fichero(rutaCiudad(citySlug)), paginaCiudad(citySlug, { ciudad, locales: ordenados, semana, noindex }));
    sitemap.push({
      loc: ORIGEN + rutaCiudad(citySlug),
      lastmod: ordenados.map((l) => dia(l.updated_at)).sort().at(-1),
    });

    for (const local of ordenados) {
      const eventos = eventosDe.get(local.venue_id) ?? [];
      const otros = ordenados.filter((o) => o.venue_id !== local.venue_id).slice(0, MAX_OTROS);
      poner(
        fichero(rutaLocal(local)),
        paginaLocal(local, {
          ciudad,
          eventos: eventos.slice(0, MAX_NOCHES),
          vinculado: vinculados.has(local.venue_id),
          otros,
          noindex,
        }),
      );
      sitemap.push({ loc: ORIGEN + rutaLocal(local), lastmod: dia(local.updated_at) });

      for (const ev of eventos) {
        poner(
          fichero(rutaEvento(local, ev)),
          paginaEvento(local, ev, { ciudad, otras: eventos.slice(0, MAX_NOCHES + 1), noindex }),
        );
        sitemap.push({ loc: ORIGEN + rutaEvento(local, ev), lastmod: dia(ev.actualizado_en) });
      }
    }
  }

  const urls = sitemap
    .map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
    .join('\n');
  archivos.set(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
  archivos.set('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${ORIGEN}/sitemap.xml\n`);
  return { archivos, avisos };
}

// ─── Escribir (solo lo del manifest) ──────────────────────────────────────────────────────────

async function existe(ruta) {
  try {
    await readFile(ruta);
    return true;
  } catch {
    return false;
  }
}

async function borrarVacias(raiz, dir) {
  let actual = dir;
  while (actual.startsWith(raiz) && actual !== raiz) {
    const dentro = await readdir(actual).catch(() => null);
    if (dentro === null || dentro.length > 0) return;
    await rmdir(actual);
    actual = dirname(actual);
  }
}

/**
 * Escribe `archivos` en `raiz` y borra lo que el manifest anterior tenía y ya no sale.
 * @returns {{ escritos: number, borrados: string[] }}
 */
export async function escribir(raiz, archivos) {
  const rutaManifest = join(raiz, MANIFEST);
  const anterior = new Set(
    (await existe(rutaManifest)) ? JSON.parse(await readFile(rutaManifest, 'utf8')).rutas : [],
  );
  for (const ruta of archivos.keys()) {
    const destino = resolve(raiz, ruta);
    if (relative(raiz, destino).startsWith('..')) throw new Error(`Ruta fuera de la web: ${ruta}`);
    if (!anterior.has(ruta) && (await existe(destino))) {
      throw new Error(`${ruta} ya existe y no es del generador: no se pisa una página hecha a mano.`);
    }
  }
  for (const [ruta, contenido] of archivos) {
    const destino = join(raiz, ruta);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, contenido);
  }
  const borrados = [...anterior].filter((r) => !archivos.has(r));
  for (const ruta of borrados) {
    await rm(join(raiz, ruta), { force: true });
    await borrarVacias(raiz, dirname(join(raiz, ruta)));
  }
  const rutas = [...archivos.keys()].sort();
  await writeFile(rutaManifest, JSON.stringify({ rutas }, null, 2) + '\n');
  return { escritos: rutas.length, borrados };
}

// ─── Main ─────────────────────────────────────────────────────────────────────────────────────

async function main() {
  const ciudades = JSON.parse(await readFile(join(AQUI, 'ciudades.json'), 'utf8'));
  const datos = await leer({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY });
  const { archivos, avisos } = construir({ ...datos, ciudades, noindex: process.env.NOINDEX === '1' });
  const { escritos, borrados } = await escribir(RAIZ, archivos);
  for (const a of avisos) console.warn(`aviso: ${a}`);
  console.log(
    `fichas: ${datos.locales.length} locales, ${datos.eventosWeb ? (datos.eventosWeb.eventos ?? []).length : 'sin'} eventos del SaaS; ` +
      `${escritos} ficheros, ${borrados.length} borrados${process.env.NOINDEX === '1' ? ' (NOINDEX)' : ''}.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`fichas: ${e.message}`);
    process.exit(1);
  });
}
