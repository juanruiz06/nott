const test = require("node:test");
const assert = require("node:assert/strict");
const group = require("./grupo.js");
const token = "g2_abcdefghijklmnopqrstuv";

test("la ruta y el puente GitHub Pages conservan el mismo token", () => {
  for (const href of [
    "https://nott.es/g/" + token,
    "https://nott.es/g/?i=" + token,
  ]) {
    assert.equal(group.tokenFromLocation({ href }), token);
  }
  for (const href of [
    "https://nott.es/g/?i=" + token + "&i=" + token,
    "https://nott.es/g/<script>",
    "https://nott.es/g/?i=abcdefghijklmnopqrstuv",
    "https://nott.es/g/" + token + "?i=" + token,
  ]) {
    assert.equal(group.tokenFromLocation({ href }), "");
  }
});

test("Play transporta token en referrer y el intent conserva el mismo fallback", () => {
  const play = new URL(group.playUrl(token));
  assert.equal(play.searchParams.get("id"), "com.juanruiz.nox");
  assert.equal(
    new URLSearchParams(play.searchParams.get("referrer")).get("nott_group"),
    token,
  );
  assert.ok(
    group
      .openUrl(token, true)
      .includes(encodeURIComponent(group.playUrl(token))),
  );
  assert.equal(group.openUrl(token, false), "nott://g/" + token);
});

test("copiar sucede antes de ir a la tienda y un fallo jamás dice guardado", async () => {
  const events = [];
  assert.equal(
    await group.saveAndInstall(
      token,
      { writeText: async (text) => events.push(text) },
      (url) => events.push(url),
    ),
    true,
  );
  assert.deepEqual(events, [
    "https://nott.es/g/" + token,
    "https://apps.apple.com/es/app/id6797049428",
  ]);
  events.length = 0;
  assert.equal(
    await group.saveAndInstall(
      token,
      {
        writeText: async () => {
          throw new Error("denied");
        },
      },
      (url) => events.push(url),
    ),
    false,
  );
  assert.equal(
    await group.saveAndInstall(token, undefined, (url) => events.push(url)),
    false,
  );
  assert.deepEqual(events, []);
});
