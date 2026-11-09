/**
 * KYF app-wide footer (`js/kyf-footer.js`)
 * One sticky line on every page: feedback address on the left, app version and a
 * Refresh button on the right. Include with a single <script> tag; it loads its own
 * stylesheet (css/kyf-footer.css) and replaces any older per-page feedback bar.
 *
 * To release: bump KYF_APP_VERSION below (this is the only place it lives).
 */
(function () {
  "use strict";

  var KYF_APP_VERSION = "1.5.0";
  var FEEDBACK_EMAIL = "info@vividnova.com";

  window.KYF_APP_VERSION = KYF_APP_VERSION;

  function addStylesheet() {
    if (document.getElementById("kyf-footer-css")) return;
    var link = document.createElement("link");
    link.id = "kyf-footer-css";
    link.rel = "stylesheet";
    link.href = "css/kyf-footer.css?v=" + KYF_APP_VERSION;
    document.head.appendChild(link);
  }

  /**
   * Re-download this page and every script/stylesheet it uses, bypassing the HTTP cache,
   * then reload. Saved portfolio, goals and cadence data (IndexedDB / localStorage) are untouched.
   */
  async function refreshApp(btn) {
    btn.disabled = true;
    btn.textContent = "Refreshing…";
    try {
      var urls = [location.href.split("#")[0]];
      document.querySelectorAll("script[src], link[rel='stylesheet'][href]").forEach(function (el) {
        urls.push(el.src || el.href);
      });
      if (window.caches && caches.keys) {
        var keys = await caches.keys();
        await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }
      await Promise.all(urls.map(function (u) {
        return fetch(u, { cache: "reload" }).catch(function () { /* offline: reload anyway */ });
      }));
    } finally {
      location.reload();
    }
  }

  function buildFooter() {
    if (document.getElementById("kyf-footer")) return;

    // Retire older per-page feedback bars so there is only ever one footer
    document.querySelectorAll(".sticky-footer").forEach(function (el) { el.remove(); });

    var bar = document.createElement("footer");
    bar.id = "kyf-footer";
    bar.className = "kyf-footer";
    bar.setAttribute("role", "contentinfo");

    var msg = document.createElement("span");
    msg.className = "kyf-footer-msg";
    msg.appendChild(document.createTextNode("Questions, comments, feedback write to "));
    var mail = document.createElement("a");
    mail.href = "mailto:" + FEEDBACK_EMAIL;
    mail.textContent = FEEDBACK_EMAIL;
    msg.appendChild(mail);

    var meta = document.createElement("span");
    meta.className = "kyf-footer-meta";
    var ver = document.createElement("span");
    ver.className = "kyf-footer-version";
    ver.textContent = "KYF v" + KYF_APP_VERSION;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kyf-footer-refresh";
    btn.textContent = "↻ Refresh";
    btn.title = "Get the latest version of the app. Your saved data is not touched.";
    btn.addEventListener("click", function () { refreshApp(btn); });
    meta.appendChild(ver);
    meta.appendChild(btn);

    bar.appendChild(msg);
    bar.appendChild(meta);
    document.body.appendChild(bar);
    document.body.classList.add("has-kyf-footer");
  }

  function init() {
    addStylesheet();
    buildFooter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
