// node --test assets/puente.test.cjs
// La página puente con un DOM de mentira: lo justo para ver qué hace con el código de quien invita.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const FUENTE = fs.readFileSync(path.join(__dirname, "puente.js"), "utf8");
const CODIGO = "AbCdEfGhIjKlMnOpQrStUv";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9)";
const APP_STORE = "https://apps.apple.com/es/app/id6797049428";
const PLAY = "https://play.google.com/store/apps/details?id=com.juanruiz.nox";

function elemento(href) {
  const e = {
    attrs: href ? { href } : {},
    hidden: false,
    textContent: "",
    hijos: [],
    oyentes: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    addEventListener(tipo, fn) { this.oyentes[tipo] = fn; },
    appendChild(h) { this.hijos.push(h); },
  };
  return e;
}

/** Monta la página: devuelve sus piezas y lo que se copió o adónde se navegó. */
function montar({ ua, search, clipboard }) {
  const padre = elemento();
  const dl = elemento(); dl.parentNode = padre;
  const piezas = {
    open: elemento(), "step-open": elemento(), missing: elemento(), "dl-hint": dl,
    ios: elemento(APP_STORE), android: elemento(PLAY), padre,
  };
  const location = { origin: "https://nott.es", pathname: "/a/", search, hash: "", href: "https://nott.es/a/" + search };
  const window = { location };
  const document = {
    documentElement: elemento(),
    getElementById: (id) => piezas[id] || null,
    querySelector: (sel) => (sel.includes("only-android") ? piezas.android : sel.includes("only-ios") ? piezas.ios : null),
    createElement: () => elemento(),
  };
  const navigator = { userAgent: ua, maxTouchPoints: 5, clipboard };
  vm.runInNewContext(FUENTE, { window, document, navigator });
  window.NottPuente.init({
    path: (param, ok) => { const c = ok(param("c"), window.NottPuente.CODE); return "feed" + (c ? "?c=" + c : ""); },
    codigo: (param) => param("c"),
  });
  return { piezas, location };
}

test("Android: Google Play recibe el código, también si se llega desde «Abrir en NOTT» sin la app", () => {
  const { piezas } = montar({ ua: ANDROID, search: "?c=" + CODIGO });
  const play = new URL(piezas.android.getAttribute("href"));
  assert.equal(new URLSearchParams(play.searchParams.get("referrer")).get("nott_code"), CODIGO);
  const intent = piezas.open.getAttribute("href");
  const fallback = decodeURIComponent(intent.match(/S\.browser_fallback_url=([^;]+)/)[1]);
  assert.equal(new URLSearchParams(new URL(fallback).searchParams.get("referrer")).get("nott_code"), CODIGO);
});

test("iPhone: al tocar «Descargar» copia este enlace y después va a la App Store", async () => {
  const copiado = [];
  const { piezas, location } = montar({
    ua: IPHONE, search: "?c=" + CODIGO,
    clipboard: { writeText: (t) => { copiado.push(t); return Promise.resolve(); } },
  });
  assert.match(piezas["dl-hint"].textContent, /copiamos tu invitación/);
  let prevenido = false;
  piezas.ios.oyentes.click({ preventDefault() { prevenido = true; } });
  await new Promise((r) => setImmediate(r));
  assert.equal(prevenido, true);
  assert.deepEqual(copiado, ["https://nott.es/a/?c=" + CODIGO]);
  assert.equal(location.href, APP_STORE);
});

test("iPhone: si el navegador no deja copiar, va a la App Store igual", async () => {
  const { piezas, location } = montar({
    ua: IPHONE, search: "?c=" + CODIGO,
    clipboard: { writeText: () => Promise.reject(new Error("NotAllowedError")) },
  });
  piezas.ios.oyentes.click({ preventDefault() {} });
  await new Promise((r) => setImmediate(r));
  assert.equal(location.href, APP_STORE);
});

test("iPhone sin portapapeles: el botón es el enlace de siempre y no promete copiar nada", () => {
  const { piezas } = montar({ ua: IPHONE, search: "?c=" + CODIGO, clipboard: undefined });
  assert.equal(piezas.ios.oyentes.click, undefined);
  assert.equal(piezas["dl-hint"].textContent, "");
});

test("sin código, o con uno que no tiene forma de código, la página no cambia", () => {
  for (const search of ["", "?c=marta", "?c=" + CODIGO + "x"]) {
    const copia = { writeText: () => Promise.resolve() };
    const a = montar({ ua: ANDROID, search });
    assert.equal(a.piezas.android.getAttribute("href"), PLAY);
    const i = montar({ ua: IPHONE, search, clipboard: copia });
    assert.equal(i.piezas.ios.oyentes.click, undefined);
  }
});

test("«de» enseña a quién buscar, y solo si tiene forma de @", () => {
  const con = montar({ ua: IPHONE, search: "?c=" + CODIGO + "&de=marta.ruiz" });
  assert.equal(con.piezas.padre.hijos.length, 1);
  assert.equal(con.piezas.padre.hijos[0].textContent, "Si NOTT te pregunta quién te invitó, busca @marta.ruiz.");
  const raro = montar({ ua: IPHONE, search: "?c=" + CODIGO + "&de=%3Cscript%3E" });
  assert.equal(raro.piezas.padre.hijos.length, 0);
  const sinCodigo = montar({ ua: IPHONE, search: "?de=marta" });
  assert.equal(sinCodigo.piezas.padre.hijos.length, 0);
});
