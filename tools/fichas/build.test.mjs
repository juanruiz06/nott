// Tests del generador de páginas (spec 134 v2 §7). node --test tools/fichas/
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { construir, escribir } from './build.mjs';
import { isoLocal, resumen, urlSegura } from './plantillas.mjs';

const muestra = JSON.parse(await readFile(new URL('./muestra.json', import.meta.url), 'utf8'));
const ciudades = JSON.parse(await readFile(new URL('./ciudades.json', import.meta.url), 'utf8'));
const copia = () => structuredClone(muestra);
const ahora = new Date(muestra.ahora);
const hacer = (datos = copia(), extra = {}) =>
  construir({ locales: datos.locales, eventosWeb: datos.eventosWeb, ciudades, ahora, ...extra });
const ldDe = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1]),
  );

test('genera ciudad, locales, eventos vigentes, sitemap y robots', () => {
  const { archivos, avisos } = hacer();
  assert.deepEqual([...archivos.keys()].sort(), [
    'murcia/bar-dos/index.html',
    'murcia/index.html',
    'murcia/sala-uno/abc123def456/index.html',
    'murcia/sala-uno/index.html',
    'murcia/sala-uno/semana000001/index.html',
    'robots.txt',
    'sitemap.xml',
  ]);
  assert.ok(avisos.some((a) => a.includes('sinpagina001')), 'avisa del evento de un local sin página');
});

test('escapa la descripción y el título en el HTML y en el JSON-LD', () => {
  const d = copia();
  const malo = '</script><script>alert(1)</script> & "comillas"';
  d.locales[0].description = malo + ' ' + d.locales[0].description;
  d.eventosWeb.eventos[0].titulo = malo;
  const { archivos } = hacer(d);
  for (const ruta of ['murcia/sala-uno/index.html', 'murcia/sala-uno/abc123def456/index.html']) {
    const html = archivos.get(ruta);
    assert.ok(!html.includes('<script>alert(1)'), `${ruta}: el script sale inerte`);
    assert.equal(html.match(/<\/script>/g).length, html.match(/<script/g).length, `${ruta}: no cierra etiquetas de más`);
    assert.ok(ldDe(html).length > 0);
  }
});

test('un local sin dirección, horario ni portada sale entero y sin huecos', () => {
  const html = hacer().archivos.get('murcia/bar-dos/index.html');
  assert.ok(!html.includes('Dirección'));
  assert.ok(!html.includes('Horario'));
  assert.ok(!html.includes('class="portada"'));
  assert.ok(!/undefined|null|NaN/.test(html.replace(/"sameAs"/g, '')), 'sin «undefined» ni «null» en la página');
  assert.ok(html.includes('https://www.instagram.com/bardos/'));
  assert.ok(!html.includes('>Entradas<'), 'sin enlace de venta no hay botón «Entradas»');
});

test('lo que no está en la lista blanca no llega a la página', () => {
  const html = hacer().archivos.get('murcia/bar-dos/index.html');
  assert.ok(!html.includes('google-web.example'));
});

test('ciudad reservada, ruta repetida y 0 locales hacen fallar el build', () => {
  const r = copia();
  r.locales[0].city_slug = 'privacidad';
  assert.throws(() => hacer(r), /reservada/);
  const dup = copia();
  dup.locales[1].slug = 'sala-uno';
  assert.throws(() => hacer(dup), /misma ruta/);
  assert.throws(() => hacer({ locales: [], eventosWeb: null }), /0 locales/);
  const sinCiudad = copia();
  sinCiudad.locales[0].city_slug = 'cartagena';
  assert.throws(() => hacer(sinCiudad), /ciudades\.json/);
});

test('sin eventos del SaaS (PGRST202) las páginas salen sin «Próximas noches» y con «¿Es tu local?»', () => {
  const d = copia();
  d.eventosWeb = null;
  const { archivos } = hacer(d);
  const html = archivos.get('murcia/sala-uno/index.html');
  assert.ok(!html.includes('Próximas noches'));
  assert.ok(html.includes('¿Es tu local?'));
  assert.ok(html.includes('href="https://fourvenues.com/es/sala-uno" rel="nofollow noopener">Entradas'));
  assert.equal([...archivos.keys()].filter((k) => k.split('/').length > 3).length, 0);
});

test('un local vinculado enseña sus noches, «Entradas» va a ellas y no pide «¿Es tu local?»', () => {
  const html = hacer().archivos.get('murcia/sala-uno/index.html');
  assert.ok(html.includes('Próximas noches'));
  assert.ok(html.includes('href="#noches">Entradas'));
  assert.ok(!html.includes('¿Es tu local?'));
  assert.ok(html.includes('Ilustración de NOTT'), 'portada de IA con su leyenda');
  assert.ok(!html.includes('Ya pasó'), 'un evento terminado no sale');
});

test('evento propio: compra en la ficha del SaaS, JSON-LD Event con su hora local', () => {
  const html = hacer().archivos.get('murcia/sala-uno/abc123def456/index.html');
  assert.ok(html.includes('href="https://lista.nott.es/saas/f/abc123def456">Comprar entradas'));
  const ev = ldDe(html)[0]['@graph'].find((n) => n['@type'] === 'Event');
  assert.equal(ev.startDate, '2027-01-01T00:00:00+01:00');
  assert.equal(ev.offers.lowPrice, '25.00');
  assert.equal(ev.offers.availability, 'https://schema.org/InStock');
  assert.equal(ev.location.url, 'https://nott.es/murcia/sala-uno/');
  assert.ok(html.includes('desde 25 €'));
});

test('evento externo agotado: sin botón de compra, «Agotado», SoldOut y nofollow', () => {
  const d = copia();
  d.eventosWeb.eventos[1].agotado = false;
  let html = hacer(d).archivos.get('murcia/sala-uno/semana000001/index.html');
  assert.ok(html.includes('href="https://fourvenues.com/es/sala-uno/jueves" rel="nofollow noopener">Comprar entradas'));
  html = hacer().archivos.get('murcia/sala-uno/semana000001/index.html');
  assert.ok(!html.includes('Comprar entradas'));
  assert.ok(html.includes('Agotado'));
  const ev = ldDe(html)[0]['@graph'].find((n) => n['@type'] === 'Event');
  assert.equal(ev.offers.availability, 'https://schema.org/SoldOut');
});

test('evento cancelado: EventCancelled y sin compra; enlace externo sin https se omite', () => {
  const d = copia();
  d.eventosWeb.eventos[0].estado = 'cancelado';
  d.eventosWeb.eventos[1].enlace_externo = 'javascript:alert(1)';
  d.eventosWeb.eventos[1].agotado = false;
  const { archivos } = hacer(d);
  const cancelado = archivos.get('murcia/sala-uno/abc123def456/index.html');
  assert.ok(cancelado.includes('se ha cancelado'));
  assert.ok(!cancelado.includes('Comprar entradas'));
  assert.equal(
    ldDe(cancelado)[0]['@graph'].find((n) => n['@type'] === 'Event').eventStatus,
    'https://schema.org/EventCancelled',
  );
  assert.ok(!archivos.get('murcia/sala-uno/semana000001/index.html').includes('javascript:'));
});

test('«Esta semana» en la ciudad solo con lo de los próximos 7 días', () => {
  const html = hacer().archivos.get('murcia/index.html');
  assert.ok(html.includes('Esta semana en Murcia'));
  assert.ok(html.includes('Jueves universitario'));
  assert.ok(!html.includes('Nochevieja en Sala Uno'));
});

test('el sitemap tiene exactamente las páginas generadas, y NOINDEX las marca todas', () => {
  const { archivos } = hacer();
  const locs = [...archivos.get('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const paginas = [...archivos.keys()].filter((k) => k.endsWith('index.html')).map((k) => `https://nott.es/${k.replace('index.html', '')}`);
  assert.deepEqual(locs.sort(), ['https://nott.es/', ...paginas].sort());
  const con = hacer(copia(), { noindex: true }).archivos;
  for (const [ruta, html] of con) if (ruta.endsWith('.html')) assert.ok(html.includes('content="noindex"'), ruta);
  for (const [ruta, html] of archivos) if (ruta.endsWith('.html')) assert.ok(!html.includes('noindex'), ruta);
});

test('escribir: solo toca su manifest, borra lo que deja de salir y no pisa lo hecho a mano', async () => {
  const raiz = await mkdtemp(join(tmpdir(), 'fichas-'));
  await mkdir(join(raiz, 'tools/fichas'), { recursive: true });
  await mkdir(join(raiz, 'privacidad'), { recursive: true });
  await writeFile(join(raiz, 'privacidad/index.html'), 'a mano');

  await escribir(raiz, hacer().archivos);
  assert.ok((await readdir(join(raiz, 'murcia/sala-uno'))).includes('abc123def456'));

  const d = copia();
  d.locales.pop();
  d.eventosWeb.eventos = [];
  const { borrados } = await escribir(raiz, hacer(d).archivos);
  assert.ok(borrados.includes('murcia/bar-dos/index.html'));
  assert.ok(!(await readdir(join(raiz, 'murcia'))).includes('bar-dos'), 'borra la carpeta vacía');
  assert.ok(!(await readdir(join(raiz, 'murcia/sala-uno'))).includes('abc123def456'));
  assert.equal(await readFile(join(raiz, 'privacidad/index.html'), 'utf8'), 'a mano');

  await mkdir(join(raiz, 'murcia/otro'), { recursive: true });
  await writeFile(join(raiz, 'murcia/otro/index.html'), 'a mano');
  const choque = copia();
  choque.locales[1].slug = 'otro';
  await assert.rejects(escribir(raiz, hacer(choque).archivos), /no es del generador/);
});

test('ayudas: resumen, urlSegura e isoLocal', () => {
  assert.equal(resumen('Primera frase. Segunda frase.'), 'Primera frase.');
  assert.ok(resumen('a '.repeat(200)).length <= 155);
  assert.equal(urlSegura('http://x.example'), null);
  assert.equal(urlSegura('https://x.example/a'), 'https://x.example/a');
  assert.equal(isoLocal('2026-07-01T20:00:00Z', 'Europe/Madrid'), '2026-07-01T22:00:00+02:00');
});
