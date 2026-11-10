/* La web transporta una invitación; la incorporación y su aceptación ocurren en la app. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NottGroup = api;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";
  var TOKEN = /^g2_[0-9A-Za-z]{22}$/;
  var PLAY = "https://play.google.com/store/apps/details?id=com.juanruiz.nox";
  var APP_STORE = "https://apps.apple.com/es/app/id6797049428";

  function tokenFromLocation(location) {
    try {
      var url = new URL(location.href);
      var path = url.pathname.match(/^\/g\/(g2_[0-9A-Za-z]{22})\/?$/);
      var values = url.searchParams.getAll("i");
      if (path) return values.length === 0 ? path[1] : "";
      return values.length === 1 && TOKEN.test(values[0]) ? values[0] : "";
    } catch (_) {
      return "";
    }
  }
  function invitationUrl(token) {
    return TOKEN.test(token) ? "https://nott.es/g/" + token : "";
  }
  function playUrl(token) {
    return TOKEN.test(token)
      ? PLAY + "&referrer=" + encodeURIComponent("nott_group=" + token)
      : PLAY;
  }
  function openUrl(token, android) {
    if (!TOKEN.test(token)) return "";
    if (!android) return "nott://g/" + token;
    return (
      "intent://g/" +
      token +
      "#Intent;scheme=nott;package=com.juanruiz.nox;S.browser_fallback_url=" +
      encodeURIComponent(playUrl(token)) +
      ";end"
    );
  }
  function paintTitle(element, title) {
    element.textContent = "";
    var parts = title.split(" / ");
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
      element.textContent = title;
      return;
    }
    var first = document.createElement("span");
    first.className = "group-title-first";
    first.textContent = parts[0];
    var last = document.createElement("span");
    last.className =
      parts[1].length <= 6
        ? "group-title-last group-title-short"
        : "group-title-last";
    last.textContent = parts[1];
    element.append(first, last);
  }
  async function saveAndInstall(token, clipboard, navigate) {
    var url = invitationUrl(token);
    if (!url || !clipboard || typeof clipboard.writeText !== "function")
      return false;
    try {
      // Se llama directamente dentro del gesto: Safari no admite copiar tras una petición.
      await clipboard.writeText(url);
    } catch (_) {
      return false;
    }
    navigate(APP_STORE);
    return true;
  }
  function init() {
    var token = tokenFromLocation(window.location);
    if (!token) return false;
    var root = document.getElementById("group-invitation");
    document.querySelector(".wrap").hidden = true;
    root.hidden = false;
    document.documentElement.classList.add("group-mode");
    var os = document.documentElement.getAttribute("data-os");
    var install = document.getElementById("group-install");
    var open = document.getElementById("group-open");
    var hint = document.getElementById("group-hint");
    var feedback = document.getElementById("group-feedback");
    var fallback = document.getElementById("group-store-fallback");
    open.href = openUrl(token, os === "android");
    if (os === "android") {
      install.textContent = "Instalar NOTT";
      hint.textContent =
        "Al instalar desde Google Play, NOTT recuperará la invitación. Si no aparece, vuelve a abrir este enlace.";
      install.addEventListener("click", function () {
        window.location.assign(playUrl(token));
      });
    } else if (os === "ios") {
      var saving = false;
      install.addEventListener("click", async function () {
        if (saving) return;
        saving = true;
        install.disabled = true;
        var saved = await saveAndInstall(
          token,
          navigator.clipboard,
          function (url) {
            window.location.assign(url);
          },
        );
        feedback.textContent = saved
          ? "Invitación copiada. Al abrir NOTT, toca «Tengo un enlace o un código» y Pegar."
          : "No se ha podido copiar. Instala NOTT y vuelve a abrir este enlace o a escanear el QR.";
        fallback.hidden = saved;
        saving = false;
        install.disabled = false;
      });
    } else {
      install.hidden = true;
      open.hidden = true;
      document.getElementById("group-desktop").hidden = false;
      document.getElementById("group-canonical").textContent =
        invitationUrl(token);
      hint.textContent =
        "Abre este mismo enlace en tu móvil para instalar NOTT y entrar en el grupo.";
    }
    var endpoint = root.getAttribute("data-preview-url");
    if (endpoint) {
      var controller = new AbortController();
      var timeout = setTimeout(function () {
        controller.abort();
      }, 5_000);
      fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token }),
        signal: controller.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
      })
        .then(async function (response) {
          if (response.status === 404) {
            document.getElementById("group-title").textContent =
              "Este enlace ya no vale.";
            feedback.textContent =
              "Pide a quien te lo envió una invitación nueva.";
            install.hidden = true;
            open.hidden = true;
            hint.hidden = true;
            return;
          }
          if (!response.ok) throw new Error("preview-unavailable");
          var data = await response.json();
          if (
            typeof data.titulo !== "string" ||
            typeof data.emisor !== "string" ||
            data.estado !== "disponible"
          )
            throw new Error("preview-unavailable");
          paintTitle(document.getElementById("group-title"), data.titulo);
          document.getElementById("group-sender").textContent =
            "Invitación de " + data.emisor;
        })
        .catch(function () {
          // Una caída de la previa no significa que el enlace esté caducado.
          feedback.textContent =
            "Ahora no podemos mostrar el nombre del grupo. Podrás comprobar la invitación en NOTT.";
        })
        .finally(function () {
          clearTimeout(timeout);
        });
    }
    return true;
  }
  return {
    tokenFromLocation: tokenFromLocation,
    invitationUrl: invitationUrl,
    playUrl: playUrl,
    openUrl: openUrl,
    saveAndInstall: saveAndInstall,
    init: init,
  };
});
