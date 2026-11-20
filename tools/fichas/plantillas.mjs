// Plantillas de las páginas de local y de ciudad de nott.es (spec 134 v2 de nott-es/nox).
// Estructura sacada de referencias de Mobbin (20/11): foto a sangre con el nombre encima, datos en
// filas con icono, una sola acción fija abajo en el móvil, la app en un banner pequeño y la ciudad
// como lista con miniaturas. Todo es HTML completo, legible sin JavaScript. Todo texto que llega de
// la base pasa por `h()` (HTML) o por `jsonLd()` (datos estructurados).

export const ORIGEN = 'https://nott.es';
const APP_STORE = 'https://apps.apple.com/es/app/id6797049428?ct=web-local';
const PLAY =
  'https://play.google.com/store/apps/details?id=com.juanruiz.nox&referrer=utm_source%3Dnott.es%26utm_medium%3Dweb-local';
const SOPORTE = 'soporte@nott.es';

/** Escapa un texto para HTML (contenido y atributos). */
export function h(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Un texto con párrafos separados por una línea en blanco, como <p> escapados. */
export function parrafos(texto) {
  return String(texto ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${h(p)}</p>`)
    .join('');
}

/** JSON-LD inerte dentro de <script>: ningún `<` puede cerrar la etiqueta. */
export function jsonLd(objeto) {
  const texto = JSON.stringify(objeto).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${texto}</script>`;
}

/** Solo enlaces https; cualquier otra cosa (javascript:, http:, basura) no sale. */
export function urlSegura(url) {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

const TIPOS = {
  club: { texto: 'Discoteca', plural: 'Discotecas', schema: 'NightClub' },
  nightclub: { texto: 'Discoteca', plural: 'Discotecas', schema: 'NightClub' },
  pub: { texto: 'Pub', plural: 'Pubs', schema: 'BarOrPub' },
  bar: { texto: 'Bar de copas', plural: 'Bares de copas', schema: 'BarOrPub' },
  lounge: { texto: 'Bar de copas', plural: 'Bares de copas', schema: 'BarOrPub' },
  festival: { texto: 'Festival', plural: 'Festivales', schema: 'EventVenue' },
  festival_venue: { texto: 'Sala de conciertos', plural: 'Salas de conciertos', schema: 'EventVenue' },
};
export const tipoDe = (t) =>
  TIPOS[t] ?? { texto: 'Local', plural: 'Otros locales', schema: 'LocalBusiness' };

const DIAS = {
  Mo: ['lunes', 'Monday'],
  Tu: ['martes', 'Tuesday'],
  We: ['miércoles', 'Wednesday'],
  Th: ['jueves', 'Thursday'],
  Fr: ['viernes', 'Friday'],
  Sa: ['sábado', 'Saturday'],
  Su: ['domingo', 'Sunday'],
};

/** La primera frase de un texto, cortada a `max` caracteres sin partir palabras. */
export function resumen(texto, max = 155) {
  const limpio = String(texto ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  // Una frase acaba en . ! ? seguido de espacio y mayúscula: «R.E.M. es» no corta.
  const frase = limpio.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)[0];
  if (frase.length <= max) return frase;
  return frase.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

/** El resumen para la lista de la ciudad, sin repetir el nombre: «Odiseo es un complejo…» → «Un complejo…». */
export function subtitulo(local, max = 90) {
  const r = resumen(local.description, 200);
  const sin = r.startsWith(`${local.name} es `) ? r.slice(local.name.length + 4) : r;
  const frase = sin.charAt(0).toUpperCase() + sin.slice(1);
  return frase.length <= max ? frase : frase.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

/** El título más largo que cabe en 60 caracteres, de las opciones dadas. */
function titulo(...opciones) {
  return opciones.find((t) => t.length <= 60) ?? opciones[opciones.length - 1];
}

/** «fourvenues.com» de una URL, para la línea pequeña de una fila. */
function dominio(url) {
  try {
    return new URL(url).hostname.replace(/^(www|site)\./, '');
  } catch {
    return '';
  }
}

/** «@salarevolver» de una URL de Instagram. */
function cuentaInstagram(url) {
  const m = /instagram\.com\/([A-Za-z0-9._]+)/.exec(url ?? '');
  return m ? `@${m[1]}` : 'Instagram';
}

// ─── Rutas ────────────────────────────────────────────────────────────────────────────────────

export const rutaCiudad = (c) => `/${c}/`;
export const rutaLocal = (l) => `/${l.city_slug}/${l.slug}/`;

// ─── Iconos (trazo, 24×24, currentColor) ─────────────────────────────────────────────────────

const ICONO = {
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/>',
  ticket:
    '<path d="M4 8.5V6.8C4 6.4 4.4 6 4.8 6h14.4c.4 0 .8.4.8.8v1.7a2.5 2.5 0 0 0 0 5v1.7c0 .4-.4.8-.8.8H4.8c-.4 0-.8-.4-.8-.8v-1.7a2.5 2.5 0 0 0 0-5Z"/><path d="M14.5 6.5v11" stroke-dasharray="1.6 1.8"/>',
  insta:
    '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="17" cy="7" r=".9" fill="currentColor" stroke="none"/>',
  reloj: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  salir: '<path d="M9 7h8v8"/><path d="M17 7 7 17"/>',
  flecha: '<path d="m9 6 6 6-6 6"/>',
};
const icono = (n, clase = '') =>
  `<svg class="ico ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONO[n]}</svg>`;

// ─── Piezas comunes ───────────────────────────────────────────────────────────────────────────

function cabecera({ titulo: t, descripcion, ruta, imagen, noindex, ld, clase }) {
  const url = ORIGEN + ruta;
  const img = imagen ?? `${ORIGEN}/og.png`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta name="theme-color" content="#0c0a10">
<meta name="color-scheme" content="dark">
<title>${h(t)}</title>
<meta name="description" content="${h(descripcion)}">
<link rel="canonical" href="${h(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="NOTT">
<meta property="og:locale" content="es_ES">
<meta property="og:title" content="${h(t)}">
<meta property="og:description" content="${h(descripcion)}">
<meta property="og:image" content="${h(img)}">
<meta property="og:url" content="${h(url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${h(t)}">
<meta name="twitter:description" content="${h(descripcion)}">
<meta name="twitter:image" content="${h(img)}">
<link rel="icon" href="/favicon.png" type="image/png" sizes="64x64">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/bricolage-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/hanken-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/puente.css?v=1">
<link rel="stylesheet" href="/assets/fichas.css?v=2">
<meta name="apple-itunes-app" content="app-id=6797049428">
${jsonLd({ '@context': 'https://schema.org', '@graph': ld })}
</head>
<body class="f ${clase}">
`;
}

function barra(venueId) {
  const abrir = venueId ? `/v/?i=${encodeURIComponent(venueId)}` : '/descargar/';
  return `<header class="f-barra"><a class="f-marca" href="/"><img src="/favicon.png" alt="" width="24" height="24"><span>NOTT</span></a><a class="f-pastilla" href="${h(abrir)}">Abrir la app</a></header>
`;
}

function pie(asunto) {
  const mailto = `mailto:${SOPORTE}?subject=${encodeURIComponent(asunto)}`;
  return `<footer class="f-pie">
<a href="${h(mailto)}">¿Algo está mal en esta página?</a>
<nav><a href="/privacidad/">Privacidad</a><a href="/terminos/">Términos</a><a href="/soporte/">Soporte</a></nav>
<p>© NOTT · nott.es</p>
</footer>
`;
}

function migas(items) {
  const html = items
    .map((it, i) =>
      i === items.length - 1
        ? `<li aria-current="page">${h(it.nombre)}</li>`
        : `<li><a href="${h(it.ruta)}">${h(it.nombre)}</a></li>`,
    )
    .join('');
  return `<nav class="f-migas" aria-label="Migas"><ol>${html}</ol></nav>\n`;
}

function migasLd(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.nombre,
      item: ORIGEN + it.ruta,
    })),
  };
}

/** El banner pequeño de la app: una línea y un botón. */
function bannerApp(venueId, texto) {
  const abrir = venueId ? `/v/?i=${encodeURIComponent(venueId)}` : '/descargar/';
  return `<aside class="f-app">
<img src="/apple-touch-icon.png" alt="" width="44" height="44">
<div><b>${h(texto)}</b><span>Gratis en <a href="${h(APP_STORE)}">App Store</a> y <a href="${h(PLAY)}">Google Play</a></span></div>
<a class="f-btn f-btn-claro" href="${h(abrir)}">Abrir</a>
</aside>
`;
}

function fila({ href, ico, titulo: t, sub, externo }) {
  const rel = externo ? ' rel="nofollow noopener"' : '';
  const inner = `${icono(ico)}<span class="f-fila-txt"><b>${h(t)}</b>${sub ? `<small>${h(sub)}</small>` : ''}</span>`;
  return href
    ? `<li><a class="f-fila" href="${h(href)}"${rel}>${inner}${icono(externo ? 'salir' : 'flecha', 'f-fila-ir')}</a></li>`
    : `<li><div class="f-fila">${inner}</div></li>`;
}

// ─── Página de un local ───────────────────────────────────────────────────────────────────────

/**
 * @param {object} local   fila de get_web_venues
 * @param {object} ctx     { ciudad, otros (locales de la ciudad), noindex }
 */
export function paginaLocal(local, ctx) {
  const tipo = tipoDe(local.venue_type);
  const ruta = rutaLocal(local);
  const portada = urlSegura(local.cover_url);
  const ticket = urlSegura(local.ticket_url);
  const instagram = urlSegura(local.instagram_url);
  const consulta = encodeURIComponent(`${local.name}, ${local.address ?? ctx.ciudad.nombre}`);
  const mapa = `https://www.google.com/maps/search/?api=1&query=${consulta}`;
  const items = [
    { nombre: 'NOTT', ruta: '/' },
    { nombre: ctx.ciudad.nombre, ruta: rutaCiudad(local.city_slug) },
    { nombre: local.name, ruta },
  ];

  const negocio = {
    '@type': tipo.schema,
    '@id': `${ORIGEN}${ruta}#local`,
    name: local.name,
    url: ORIGEN + ruta,
    description: local.description,
  };
  if (portada) negocio.image = portada;
  if (local.address) {
    negocio.address = {
      '@type': 'PostalAddress',
      streetAddress: local.address,
      addressLocality: ctx.ciudad.nombre,
      addressCountry: 'ES',
    };
  }
  const horario = Array.isArray(local.opening_hours) && local.opening_hours.length > 0;
  if (horario) {
    negocio.openingHoursSpecification = local.opening_hours.map((t) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: (t.days ?? []).filter((d) => DIAS[d]).map((d) => `https://schema.org/${DIAS[d][1]}`),
      opens: t.opens,
      closes: t.closes,
    }));
  }
  if (instagram) negocio.sameAs = [instagram];

  const t = titulo(
    `${local.name}, ${ctx.ciudad.nombre}: entradas y cómo llegar | NOTT`,
    `${local.name} · ${tipo.texto} en ${ctx.ciudad.nombre} | NOTT`,
    `${local.name} · ${tipo.texto} en ${ctx.ciudad.nombre}`,
    `${local.name} | NOTT`,
  );

  let html = cabecera({
    titulo: t,
    descripcion: resumen(local.description),
    ruta,
    imagen: portada,
    noindex: ctx.noindex,
    ld: [negocio, migasLd(items)],
    clase: 'f-local',
  });
  html += barra(local.venue_id);

  // Portada a sangre con el nombre encima.
  html += `<section class="f-hero${portada ? '' : ' f-hero-sin'}">
${portada ? `<img class="f-hero-img" src="${h(portada)}" alt="${h(local.cover_source === 'ai' ? `Ilustración de ${local.name}` : local.name)}" width="1200" height="800" fetchpriority="high">` : ''}
<div class="f-hero-txt">
<p class="f-tipo">${h(tipo.texto)} · ${h(ctx.ciudad.nombre)}</p>
<h1>${h(local.name)}</h1>
</div>
${portada && local.cover_source === 'ai' ? '<span class="f-ilu">Ilustración de NOTT</span>' : ''}
</section>
<main class="f-main">
`;
  html += migas(items);
  html += `<div class="f-cols">
<section class="f-texto">${parrafos(local.description)}</section>
<div class="f-lado">
<section class="f-info" aria-labelledby="info">
<h2 id="info">Información</h2>
<ul class="f-filas">
`;
  html += fila({ href: mapa, ico: 'pin', titulo: 'Cómo llegar', sub: local.address ?? `${local.name}, ${ctx.ciudad.nombre}`, externo: true });
  if (ticket) html += fila({ href: ticket, ico: 'ticket', titulo: 'Entradas', sub: dominio(ticket), externo: true });
  if (instagram) html += fila({ href: instagram, ico: 'insta', titulo: 'Instagram', sub: cuentaInstagram(instagram), externo: true });
  if (horario) {
    const lineas = local.opening_hours
      .map((x) => `${(x.days ?? []).filter((d) => DIAS[d]).map((d) => DIAS[d][0]).join(', ')}: ${x.opens}–${x.closes}`)
      .join(' · ');
    html += fila({ ico: 'reloj', titulo: 'Horario', sub: lineas });
  }
  html += `</ul>
</section>
${bannerApp(local.venue_id, `Mira quién va a ${local.name} esta noche`)}
</div>
</div>
`;
  if (ctx.otros.length > 0) {
    html += `<section class="f-mas">
<div class="f-mas-cab"><h2>Más sitios en ${h(ctx.ciudad.nombre)}</h2><a href="${h(rutaCiudad(local.city_slug))}">Ver todos</a></div>
<ul class="f-carrusel">${ctx.otros
      .map((o) => {
        const img = urlSegura(o.cover_url);
        return `<li><a href="${h(rutaLocal(o))}">${img ? `<img src="${h(img)}" alt="" width="240" height="300" loading="lazy" decoding="async">` : '<span class="f-sin-foto"></span>'}<b>${h(o.name)}</b><small>${h(tipoDe(o.venue_type).texto)}</small></a></li>`;
      })
      .join('')}</ul>
</section>
`;
  }
  const asunto = `Quiero vender entradas de ${local.name} con NOTT`;
  html += `<p class="f-tuyo">¿Es tu local? <a href="mailto:${h(SOPORTE)}?subject=${h(encodeURIComponent(asunto))}">Vende tus entradas con NOTT</a></p>
</main>
`;
  html += pie(`Error en la página de ${local.name}`);
  // Una sola acción fija abajo en el móvil: entradas si las hay; si no, cómo llegar.
  html += ticket
    ? `<div class="f-fija"><a class="f-btn f-btn-oro" href="${h(ticket)}" rel="nofollow noopener">${icono('ticket')}Entradas</a></div>\n`
    : `<div class="f-fija"><a class="f-btn f-btn-oro" href="${h(mapa)}" rel="nofollow noopener">${icono('pin')}Cómo llegar</a></div>\n`;
  return html + '</body>\n</html>\n';
}

// ─── Página de una ciudad ─────────────────────────────────────────────────────────────────────

export function paginaCiudad(citySlug, ctx) {
  const ruta = rutaCiudad(citySlug);
  const items = [
    { nombre: 'NOTT', ruta: '/' },
    { nombre: ctx.ciudad.nombre, ruta },
  ];
  const grupos = new Map();
  for (const l of ctx.locales) {
    const g = tipoDe(l.venue_type).plural;
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(l);
  }
  const lista = {
    '@type': 'ItemList',
    itemListElement: ctx.locales.map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: ORIGEN + rutaLocal(l),
      name: l.name,
    })),
  };
  let html = cabecera({
    titulo: titulo(
      `Discotecas en ${ctx.ciudad.nombre}: dónde salir esta noche | NOTT`,
      `Discotecas en ${ctx.ciudad.nombre} | NOTT`,
    ),
    descripcion: resumen(ctx.ciudad.entradilla),
    ruta,
    noindex: ctx.noindex,
    ld: [lista, migasLd(items)],
    clase: 'f-ciudad',
  });
  html += barra(null);
  html += `<main class="f-main">
`;
  html += migas(items);
  html += `<section class="f-cab">
<h1>Discotecas y bares de copas en ${h(ctx.ciudad.nombre)}</h1>
<p>${h(ctx.ciudad.entradilla)}</p>
</section>
`;
  for (const [g, locales] of grupos) {
    html += `<section class="f-grupo">
<h2>${h(g)} <span>${locales.length}</span></h2>
<ul class="f-lista">${locales
      .map((l) => {
        const img = urlSegura(l.cover_url);
        return `<li><a href="${h(rutaLocal(l))}">${img ? `<img src="${h(img)}" alt="" width="160" height="160" loading="lazy" decoding="async">` : '<span class="f-sin-foto"></span>'}<span class="f-lista-txt"><b>${h(l.name)}</b><small>${h(subtitulo(l))}</small></span>${icono('flecha', 'f-fila-ir')}</a></li>`;
      })
      .join('')}</ul>
</section>
`;
  }
  html += bannerApp(null, `Mira quién sale esta noche en ${ctx.ciudad.nombre}`);
  html += `</main>
`;
  html += pie(`Error en la página de ${ctx.ciudad.nombre}`);
  return html + '</body>\n</html>\n';
}
