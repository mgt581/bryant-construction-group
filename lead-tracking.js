(function () {
  "use strict";

  var config = window.LEADGEN_CONFIG || {};
  var prefix = String(config.storagePrefix || "leadgen").replace(/[^a-z0-9_-]/gi, "_");

  function clean(value) {
    return String(value || "").trim();
  }

  function get(storage, key) {
    try { return storage.getItem(prefix + "_" + key) || ""; } catch (_) { return ""; }
  }

  function set(storage, key, value) {
    try { storage.setItem(prefix + "_" + key, value); } catch (_) {}
  }

  function createId(kind) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return kind + "-" + window.crypto.randomUUID();
    }
    var values = new Uint32Array(4);
    window.crypto.getRandomValues(values);
    return kind + "-" + Array.from(values).map(function (value) { return value.toString(16); }).join("");
  }

  function stable(storage, key, kind) {
    var value = get(storage, key);
    if (!value) {
      value = createId(kind);
      set(storage, key, value);
    }
    return value;
  }

  function firstTouch() {
    var stored = get(sessionStorage, "first_touch");
    if (stored) {
      try { return JSON.parse(stored); } catch (_) {}
    }
    var params = new URLSearchParams(location.search);
    var value = {
      referrer: document.referrer || "",
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_term: params.get("utm_term") || "",
      utm_content: params.get("utm_content") || "",
      gclid: params.get("gclid") || "",
      fbclid: params.get("fbclid") || "",
      msclkid: params.get("msclkid") || ""
    };
    set(sessionStorage, "first_touch", JSON.stringify(value));
    return value;
  }

  function attribution() {
    var touch = firstTouch();
    var landingPage = get(sessionStorage, "landing_page");
    if (!landingPage) {
      landingPage = location.href;
      set(sessionStorage, "landing_page", landingPage);
    }
    return Object.assign({}, touch, {
      page: location.href,
      landing_page: landingPage,
      source: touch.utm_source || "website",
      medium: touch.utm_medium,
      campaign: touch.utm_campaign,
      term: touch.utm_term,
      content: touch.utm_content,
      session_id: stable(sessionStorage, "session_id", "session"),
      client_id: stable(localStorage, "client_id", "client")
    });
  }

  function trackEvent(name, detail, options) {
    var eventName = clean(name);
    if (!eventName) return;
    var payload = Object.assign({}, attribution(), detail || {}, { event_name: eventName });
    if (options && options.store === false) return;
    var endpoint = clean(config.eventEndpoint || "/api/lead-event");
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      try {
        if (navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }))) return;
      } catch (_) {}
    }
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true
    }).catch(function () {});
  }

  function clickTracking() {
    document.addEventListener("click", function (click) {
      var link = click.target && click.target.closest ? click.target.closest("a[href]") : null;
      if (!link) return;
      var raw = link.getAttribute("href") || "";
      var detail = { link_text: clean(link.textContent), link_url: link.href };
      if (raw.indexOf("tel:") === 0) {
        detail.phone_number = raw.slice(4);
        trackEvent("phone_click", detail);
      } else if (raw.indexOf("mailto:") === 0) {
        detail.email_address = raw.slice(7).split("?")[0];
        trackEvent("email_click", detail);
      } else if (/wa\.me|whatsapp\.com/i.test(link.href)) {
        detail.whatsapp_number = (link.href.match(/wa\.me\/([^?]+)/) || [])[1] || "";
        trackEvent("whatsapp_click", detail);
      } else if (/contact|quote|enquir/i.test(raw + " " + link.textContent)) {
        trackEvent("quote_cta_click", detail);
      }
    });
  }

  function init() {
    clickTracking();
    trackEvent("page_view", { page_title: document.title, page_location: location.href });
  }

  window.LeadGen = {
    getAttribution: attribution,
    trackEvent: trackEvent,
    trackLead: function (formName) {
      trackEvent("generate_lead", { form_name: formName || "Website quote form" }, { store: false });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
