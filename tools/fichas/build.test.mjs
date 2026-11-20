// Tests del generador de páginas (spec 134 v2 §7). node --test tools/fichas/build.test.mjs
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { construir, escribir } from './build.mjs';
import { resumen, subtitulo, urlSegura } from './plantillas.mjs';

const muestra = JSON.parse(await readFile(new URL('./muestra.json', import.meta.url), 'utf8'));
const ciudades = JSON.parse(await readFile(new URL('./ciudades.json', import.meta.url), 'utf8'));
const copia = () => structuredClone(muestra);
const hacer = (datos = copia(), extra = {}) => construir({ locales: datos.locales, ciudades, ...extra });
const ldDe = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test('genera ciudad, locales, sitemap y robots', () => {
  const { archivos } = hacer();
  assert.deepEqual([...archivos.keys()].sort(), [
    'murcia/bar-dos/index.html',
    'murcia/index.html',
    'murcia/sala-uno/index.html',
    'robots.txt',
    'sitemap.xml',
  ]);
});

test('escapa la descripción en el HTML y en el JSON-LD', () => {
  const d = copia();
  d.locales[0].description = '</script><script>alert(1)</script> & "comillas" ' + d.locales[0].description;
  const html = hacer(d).archivos.get('murcia/sala-uno/index.html');
  assert.ok(!html.includes('<script>alert(1)'), 'el script sale inerte');
  assert.equal(html.match(/<\/script>/g).length, html.match(/<script/g).length, 'no cierra etiquetas de más');
  assert.ok(ldDe(html).length > 0);
});

test('un local sin dirección, horario, portada ni venta sale entero y sin huecos', () => {
  const html = hacer().archivos.get('murcia/bar-dos/index.html');
  assert.ok(!html.includes('<b>Horario</b>'));
  assert.ok(!html.includes('f-hero-img'));
  assert.ok(html.includes('f-hero-sin'));
  assert.ok(!/undefined|NaN|>null</.test(html), 'sin «undefined» ni «null» en la página');
  assert.ok(html.includes('@bardos'), 'la fila de Instagram enseña la cuenta');
  assert.ok(!html.includes('<b>Entradas</b>'), 'sin enlace de venta no hay fila de entradas');
  assert.ok(!/<title>[^<]*entradas/.test(html), 'ni «entradas» en el título');
  assert.ok(html.includes('class="f-fija"><a class="f-btn f-btn-oro" href="https://www.google.com/maps/'), 'la acción fija es «Cómo llegar»');
});

test('con enlace de venta: fila «Entradas» con nofollow y la acción fija va a la venta', () => {
  const html = hacer().archivos.get('murcia/sala-uno/index.html');
  assert.ok(html.includes('href="https://fourvenues.com/es/sala-uno" rel="nofollow noopener"'));
  assert.ok(html.includes('<small>fourvenues.com</small>'));
  assert.ok(html.includes('<title>Sala Uno, Murcia: entradas y cómo llegar | NOTT</title>'));
  assert.ok(html.includes('class="f-fija"><a class="f-btn f-btn-oro" href="https://fourvenues.com/es/sala-uno"'));
  assert.ok(html.includes('Ilustración de NOTT'), 'portada de IA con su leyenda');
  assert.ok(html.includes('¿Es tu local?'));
  assert.ok(html.includes('<b>Horario</b>'));
});

test('el JSON-LD del local lleva su tipo, dirección y horario, sin coordenadas', () => {
  const ld = ldDe(hacer().archivos.get('murcia/sala-uno/index.html'))[0]['@graph'];
  const local = ld.find((n) => n['@type'] === 'NightClub');
  assert.equal(local.address.streetAddress, 'Calle de Prueba 1, Murcia');
  assert.equal(local.openingHoursSpecification[0].dayOfWeek.length, 3);
  assert.ok(!('geo' in local));
  assert.ok(ld.some((n) => n['@type'] === 'BreadcrumbList'));
});

test('lo que no está en la lista blanca no llega a la página', () => {
  const html = hacer().archivos.get('murcia/bar-dos/index.html');
  assert.ok(!html.includes('google-web.example'));
});

test('enlaces que no son https no salen', () => {
  const d = copia();
  d.locales[0].ticket_url = 'javascript:alert(1)';
  d.locales[1].instagram_url = 'http://instagram.com/x';
  const { archivos } = hacer(d);
  assert.ok(!archivos.get('murcia/sala-uno/index.html').includes('javascript:'));
  assert.ok(!archivos.get('murcia/bar-dos/index.html').includes('http://instagram.com'));
});

test('ciudad reservada, ruta repetida, ciudad sin entradilla y 0 locales hacen fallar el build', () => {
  const r = copia();
  r.locales[0].city_slug = 'privacidad';
  assert.throws(() => hacer(r), /reservada/);
  const dup = copia();
  dup.locales[1].slug = 'sala-uno';
  assert.throws(() => hacer(dup), /misma ruta/);
  assert.throws(() => hacer({ locales: [] }), /0 locales/);
  const sinCiudad = copia();
  sinCiudad.locales[0].city_slug = 'cartagena';
  assert.throws(() => hacer(sinCiudad), /ciudades\.json/);
});

test('la ciudad agrupa por tipo, con miniaturas y enlaces a cada local', () => {
  const html = hacer().archivos.get('murcia/index.html');
  assert.ok(html.includes('<h2>Discotecas <span>1</span></h2>'));
  assert.ok(html.includes('<h2>Bares de copas <span>1</span></h2>'));
  assert.ok(html.includes('href="/murcia/sala-uno/"'));
  const lista = ldDe(html)[0]['@graph'].find((n) => n['@type'] === 'ItemList');
  assert.equal(lista.itemListElement.length, 2);
});

test('una descripción con línea en blanco sale en dos párrafos', () => {
  const d = copia();
  d.locales[1].description = 'Primer párrafo del bar.\n\nSegundo párrafo.';
  const html = hacer(d).archivos.get('murcia/bar-dos/index.html');
  assert.ok(html.includes('<section class="f-texto"><p>Primer párrafo del bar.</p><p>Segundo párrafo.</p></section>'));
});

test('el sitemap tiene exactamente las páginas generadas, y NOINDEX las marca todas', () => {
  const { archivos } = hacer();
  const locs = [...archivos.get('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const paginas = [...archivos.keys()]
    .filter((k) => k.endsWith('index.html'))
    .map((k) => `https://nott.es/${k.replace('index.html', '')}`);
  assert.deepEqual(locs.sort(), ['https://nott.es/', ...paginas].sort());
  for (const [ruta, html] of hacer(copia(), { noindex: true }).archivos)
    if (ruta.endsWith('.html')) assert.ok(html.includes('content="noindex"'), ruta);
  for (const [ruta, html] of archivos) if (ruta.endsWith('.html')) assert.ok(!html.includes('noindex'), ruta);
});

test('escribir: solo toca su manifest, borra lo que deja de salir y no pisa lo hecho a mano', async () => {
  const raiz = await mkdtemp(join(tmpdir(), 'fichas-'));
  await mkdir(join(raiz, 'tools/fichas'), { recursive: true });
  await mkdir(join(raiz, 'privacidad'), { recursive: true });
  await writeFile(join(raiz, 'privacidad/index.html'), 'a mano');

  await escribir(raiz, hacer().archivos);
  assert.ok((await readdir(join(raiz, 'murcia'))).includes('bar-dos'));

  const d = copia();
  d.locales.pop();
  const { borrados } = await escribir(raiz, hacer(d).archivos);
  assert.ok(borrados.includes('murcia/bar-dos/index.html'));
  assert.ok(!(await readdir(join(raiz, 'murcia'))).includes('bar-dos'), 'borra la carpeta vacía');
  assert.equal(await readFile(join(raiz, 'privacidad/index.html'), 'utf8'), 'a mano');

  await mkdir(join(raiz, 'murcia/otro'), { recursive: true });
  await writeFile(join(raiz, 'murcia/otro/index.html'), 'a mano');
  const choque = copia();
  choque.locales[1].slug = 'otro';
  await assert.rejects(escribir(raiz, hacer(choque).archivos), /no es del generador/);
});

test('ayudas: resumen y urlSegura', () => {
  assert.equal(resumen('Primera frase. Segunda frase.'), 'Primera frase.');
  assert.equal(resumen('Sala R.E.M. es una sala de conciertos. Otra frase.'), 'Sala R.E.M. es una sala de conciertos.');
  assert.equal(subtitulo({ name: 'Odiseo', description: 'Odiseo es un complejo de ocio de Murcia. Más.' }), 'Un complejo de ocio de Murcia.');
  assert.ok(resumen('a '.repeat(200)).length <= 155);
  assert.equal(urlSegura('http://x.example'), null);
  assert.equal(urlSegura('https://x.example/a'), 'https://x.example/a');
});
