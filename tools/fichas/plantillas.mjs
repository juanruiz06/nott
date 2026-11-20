// Plantillas de las páginas de local, de evento y de ciudad de nott.es (spec 134 v2 de nott-es/nox).
// Todo es HTML completo, legible sin JavaScript. Todo texto que llega de la base pasa por `h()`
// (HTML) o por `jsonLd()` (datos estructurados): la descripción de un evento la escribe la
// organización, y la de un local la escribirá el local.

export const ORIGEN = 'https://nott.es';
export const FICHA_SAAS = 'https://lista.nott.es/saas/f/';
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
  const frase = limpio.match(/^.+?[.!?](\s|$)/)?.[0]?.trim() ?? limpio;
  if (frase.length <= max) return frase;
  return frase.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

/** El título más largo que cabe en 60 caracteres, de las opciones dadas. */
function titulo(...opciones) {
  return opciones.find((t) => t.length <= 60) ?? opciones[opciones.length - 1];
}

// ─── Fechas ───────────────────────────────────────────────────────────────────────────────────

function partes(fecha, zona, opciones) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('es-ES', { timeZone: zona, ...opciones })
      .formatToParts(new Date(fecha))
      .map((p) => [p.type, p.value]),
  );
}

/** «sáb 27 dic · 23:30», en la hora del evento. */
export function fechaCorta(fecha, zona) {
  const p = partes(fecha, zona, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${p.weekday.replace('.', '')} ${p.day} ${p.month.replace('.', '')} · ${p.hour}:${p.minute}`;
}

/** «sábado 27 de diciembre», en la hora del evento. */
export function fechaLarga(fecha, zona) {
  const p = partes(fecha, zona, { weekday: 'long', day: 'numeric', month: 'long' });
  return `${p.weekday} ${p.day} de ${p.month}`;
}

/** «2026-12-27T23:30:00+01:00»: la hora local del evento con su desfase (lo pide schema.org). */
export function isoLocal(fecha, zona) {
  const p = partes(fecha, zona, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  });
  const desfase = p.timeZoneName === 'GMT' ? '+00:00' : p.timeZoneName.replace('GMT', '');
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${desfase}`;
}

/** «desde 12 €», «Gratis» o «Con lista». */
export function precioTexto(ev) {
  if (ev.precio_desde_centimos == null) return 'Con lista';
  if (ev.precio_desde_centimos === 0) return 'Gratis';
  const euros = ev.precio_desde_centimos / 100;
  const cifra = Number.isInteger(euros) ? String(euros) : euros.toFixed(2).replace('.', ',');
  return `desde ${cifra} €`;
}

// ─── Rutas ────────────────────────────────────────────────────────────────────────────────────

export const rutaCiudad = (c) => `/${c}/`;
export const rutaLocal = (l) => `/${l.city_slug}/${l.slug}/`;
export const rutaEvento = (l, ev) => `/${l.city_slug}/${l.slug}/${ev.slug}/`;

/** A dónde lleva «Comprar entradas» de un evento, o null si no hay dónde. */
export function urlCompra(ev) {
  if (ev.estado === 'cancelado') return null;
  if (ev.ticketing === 'externo') return urlSegura(ev.enlace_externo);
  return /^[a-z0-9]{12}$/.test(ev.slug) ? FICHA_SAAS + ev.slug : null;
}

// ─── Piezas comunes ───────────────────────────────────────────────────────────────────────────

function cabecera({ titulo: t, descripcion, ruta, imagen, noindex, ld }) {
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
<link rel="stylesheet" href="/assets/fichas.css?v=1">
<meta name="apple-itunes-app" content="app-id=6797049428">
${jsonLd({ '@context': 'https://schema.org', '@graph': ld })}
</head>
<body>
<div class="wrap ficha">
<header class="top"><a class="brand" href="/"><img src="/favicon.png" alt="" width="22" height="22"><span>NOTT</span></a></header>
<main>
`;
}

function pie(asunto) {
  const mailto = `mailto:${SOPORTE}?subject=${encodeURIComponent(asunto)}`;
  return `</main>
<footer>
<p class="fix"><a href="${h(mailto)}">¿Algo está mal en esta página?</a></p>
<nav><a href="/privacidad/">Privacidad</a><a href="/terminos/">Términos</a><a href="/soporte/">Soporte</a></nav>
<p>© NOTT · nott.es</p>
</footer>
</div>
</body>
</html>
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
  return `<nav class="migas" aria-label="Migas"><ol>${html}</ol></nav>\n`;
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

function llamadaApp(venueId, texto) {
  return `<section class="app">
<h2>${h(texto)}</h2>
<p>Con NOTT ves qué planes hay esta noche y quién de tu gente va.</p>
<div class="buttons">
<a class="btn btn-gold" href="/v/?i=${h(encodeURIComponent(venueId))}">Abrir en NOTT</a>
<div class="tiendas"><a class="btn btn-ghost" href="${h(APP_STORE)}">App Store</a><a class="btn btn-ghost" href="${h(PLAY)}">Google Play</a></div>
</div>
</section>
`;
}

function tarjetaEvento(local, ev) {
  const cartel = urlSegura(ev.cartel_url);
  const estado =
    ev.estado === 'cancelado'
      ? '<span class="chip chip-off">Cancelado</span>'
      : ev.agotado
        ? '<span class="chip chip-off">Agotado</span>'
        : `<span class="chip">${h(precioTexto(ev))}</span>`;
  return `<li><a class="noche" href="${h(rutaEvento(local, ev))}">${
    cartel
      ? `<img src="${h(cartel)}" alt="" width="120" height="150" loading="lazy" decoding="async">`
      : '<span class="cartel-vacio" aria-hidden="true"></span>'
  }<span class="noche-txt"><span class="noche-fecha">${h(fechaCorta(ev.empieza_en, ev.zona_horaria))}</span><span class="noche-titulo">${h(ev.titulo)}</span>${estado}</span></a></li>`;
}

// ─── Página de un local ───────────────────────────────────────────────────────────────────────

/**
 * @param {object} local   fila de get_web_venues
 * @param {object} ctx     { ciudad, eventos (del local, ya filtrados y ordenados), vinculado,
 *                           otros (locales de la ciudad), noindex }
 */
export function paginaLocal(local, ctx) {
  const tipo = tipoDe(local.venue_type);
  const ruta = rutaLocal(local);
  const conNoches = ctx.eventos.length > 0;
  const portada = urlSegura(local.cover_url);
  const ticket = urlSegura(local.ticket_url);
  const instagram = urlSegura(local.instagram_url);
  const consulta = encodeURIComponent(`${local.name}, ${ctx.ciudad.nombre}`);
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
  if (Array.isArray(local.opening_hours) && local.opening_hours.length > 0) {
    negocio.openingHoursSpecification = local.opening_hours.map((t) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: (t.days ?? [])
        .filter((d) => DIAS[d])
        .map((d) => `https://schema.org/${DIAS[d][1]}`),
      opens: t.opens,
      closes: t.closes,
    }));
  }
  if (instagram) negocio.sameAs = [instagram];

  const t = conNoches
    ? titulo(
        `${local.name}, ${ctx.ciudad.nombre}: entradas y próximas noches | NOTT`,
        `${local.name}, ${ctx.ciudad.nombre}: entradas | NOTT`,
        `${local.name}: entradas | NOTT`,
      )
    : titulo(
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
  });
  html += migas(items);
  html += `<section class="cabeza">
<h1>${h(local.name)}</h1>
<p class="kicker">${h(tipo.texto)} · ${h(ctx.ciudad.nombre)}</p>
</section>
`;
  if (portada) {
    const ia = local.cover_source === 'ai';
    html += `<figure class="portada"><img src="${h(portada)}" alt="${h(ia ? `Ilustración de ${local.name}` : local.name)}" width="1200" height="800" fetchpriority="high">${
      ia ? '<figcaption>Ilustración de NOTT</figcaption>' : ''
    }</figure>
`;
  }
  if (conNoches) {
    html += `<section class="noches" id="noches">
<h2>Próximas noches</h2>
<ul>${ctx.eventos.map((ev) => tarjetaEvento(local, ev)).join('')}</ul>
</section>
`;
  }
  html += `<section class="texto"><p>${h(local.description)}</p></section>
<section class="datos">
`;
  if (local.address) html += `<p><span>Dirección</span>${h(local.address)}</p>\n`;
  if (Array.isArray(local.opening_hours) && local.opening_hours.length > 0) {
    const lineas = local.opening_hours
      .map(
        (t) =>
          `${(t.days ?? [])
            .filter((d) => DIAS[d])
            .map((d) => DIAS[d][0])
            .join(', ')}: ${t.opens}–${t.closes}`,
      )
      .map((l) => h(l))
      .join('<br>');
    html += `<p><span>Horario</span>${lineas}</p>\n`;
  }
  html += `<div class="buttons">
`;
  if (conNoches) html += `<a class="btn btn-gold" href="#noches">Entradas</a>\n`;
  else if (ticket) html += `<a class="btn btn-gold" href="${h(ticket)}" rel="nofollow noopener">Entradas</a>\n`;
  html += `<a class="btn btn-ghost" href="https://www.google.com/maps/search/?api=1&amp;query=${h(consulta)}" rel="nofollow noopener">Cómo llegar</a>
`;
  if (instagram) html += `<a class="btn btn-ghost" href="${h(instagram)}" rel="nofollow noopener">Instagram</a>\n`;
  html += `</div>
</section>
`;
  html += llamadaApp(local.venue_id, 'Mira quién va esta noche');
  if (!ctx.vinculado) {
    const asunto = `Quiero vender entradas de ${local.name} con NOTT`;
    html += `<section class="tuyo"><a href="mailto:${h(SOPORTE)}?subject=${h(encodeURIComponent(asunto))}">¿Es tu local? Vende tus entradas con NOTT</a></section>
`;
  }
  if (ctx.otros.length > 0) {
    html += `<section class="mas">
<h2>Más sitios en ${h(ctx.ciudad.nombre)}</h2>
<ul>${ctx.otros.map((o) => `<li><a href="${h(rutaLocal(o))}">${h(o.name)}</a></li>`).join('')}</ul>
</section>
`;
  }
  return html + pie(`Error en la página de ${local.name}`);
}

// ─── Página de un evento ──────────────────────────────────────────────────────────────────────

export function paginaEvento(local, ev, ctx) {
  const ruta = rutaEvento(local, ev);
  const cartel = urlSegura(ev.cartel_url);
  const compra = urlCompra(ev);
  const cancelado = ev.estado === 'cancelado';
  const items = [
    { nombre: 'NOTT', ruta: '/' },
    { nombre: ctx.ciudad.nombre, ruta: rutaCiudad(local.city_slug) },
    { nombre: local.name, ruta: rutaLocal(local) },
    { nombre: ev.titulo, ruta },
  ];
  const dia = fechaLarga(ev.empieza_en, ev.zona_horaria);
  const lugar = { '@type': 'Place', name: local.name, url: ORIGEN + rutaLocal(local) };
  lugar.address = {
    '@type': 'PostalAddress',
    addressLocality: ctx.ciudad.nombre,
    addressCountry: 'ES',
    ...(local.address ? { streetAddress: local.address } : {}),
  };
  const evento = {
    '@type': 'Event',
    name: ev.titulo,
    url: ORIGEN + ruta,
    startDate: isoLocal(ev.empieza_en, ev.zona_horaria),
    endDate: isoLocal(ev.termina_en, ev.zona_horaria),
    eventStatus: `https://schema.org/${cancelado ? 'EventCancelled' : 'EventScheduled'}`,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: lugar,
    organizer: { '@type': 'Organization', name: ev.organizacion },
  };
  if (cartel) evento.image = [cartel];
  if (ev.descripcion) evento.description = ev.descripcion;
  if (compra && ev.precio_desde_centimos != null) {
    evento.offers = {
      '@type': 'AggregateOffer',
      lowPrice: (ev.precio_desde_centimos / 100).toFixed(2),
      priceCurrency: ev.moneda ?? 'EUR',
      availability: `https://schema.org/${ev.agotado ? 'SoldOut' : 'InStock'}`,
      url: compra,
    };
  }

  const t = titulo(
    `${ev.titulo} · ${local.name}, ${ctx.ciudad.nombre} | NOTT`,
    `${ev.titulo} · ${local.name} | NOTT`,
    `${ev.titulo} | NOTT`,
  );
  let html = cabecera({
    titulo: t,
    descripcion: resumen(ev.descripcion || `${ev.titulo} en ${local.name}, ${ctx.ciudad.nombre}, el ${dia}.`),
    ruta,
    imagen: cartel,
    noindex: ctx.noindex,
    ld: [evento, migasLd(items)],
  });
  html += migas(items);
  html += `<section class="cabeza">
<p class="kicker">${h(fechaCorta(ev.empieza_en, ev.zona_horaria))}</p>
<h1>${h(ev.titulo)}</h1>
<p class="lugar">en <a href="${h(rutaLocal(local))}">${h(local.name)}</a> · Organiza ${h(ev.organizacion)}</p>
</section>
`;
  // La compra va antes del cartel: quien llega desde Google viene a comprar.
  html += `<section class="compra">
`;
  if (cancelado) html += '<p class="aviso">Este evento se ha cancelado.</p>\n';
  else {
    html += `<p class="precio">${h(ev.agotado ? 'Agotado' : precioTexto(ev))}</p>\n`;
    if (compra && !ev.agotado) {
      const rel = ev.ticketing === 'externo' ? ' rel="nofollow noopener"' : '';
      html += `<a class="btn btn-gold" href="${h(compra)}"${rel}>Comprar entradas</a>\n`;
    }
  }
  html += `</section>
`;
  if (cartel) {
    html += `<figure class="cartel"><img src="${h(cartel)}" alt="${h(ev.titulo)}" width="800" height="1000" fetchpriority="high"></figure>\n`;
  }
  if (ev.descripcion) html += `<section class="texto"><p>${h(ev.descripcion)}</p></section>\n`;
  html += llamadaApp(local.venue_id, 'Mira quién va');
  const otras = ctx.otras.filter((o) => o.slug !== ev.slug);
  if (otras.length > 0) {
    html += `<section class="noches">
<h2>Más noches en ${h(local.name)}</h2>
<ul>${otras.map((o) => tarjetaEvento(local, o)).join('')}</ul>
</section>
`;
  }
  return html + pie(`Error en la página de ${ev.titulo}`);
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
  });
  html += migas(items);
  html += `<section class="cabeza">
<h1>Discotecas y bares de copas en ${h(ctx.ciudad.nombre)}</h1>
<p class="lead">${h(ctx.ciudad.entradilla)}</p>
</section>
`;
  if (ctx.semana.length > 0) {
    html += `<section class="noches">
<h2>Esta semana en ${h(ctx.ciudad.nombre)}</h2>
<ul>${ctx.semana.map(({ local, ev }) => tarjetaEvento(local, ev)).join('')}</ul>
</section>
`;
  }
  for (const [g, locales] of grupos) {
    html += `<section class="mas">
<h2>${h(g)}</h2>
<ul>${locales.map((l) => `<li><a href="${h(rutaLocal(l))}">${h(l.name)}</a></li>`).join('')}</ul>
</section>
`;
  }
  return html + pie(`Error en la página de ${ctx.ciudad.nombre}`);
}
