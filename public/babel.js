/* Babel script-tag adapter: plugs Babel into any store page, no React and no build step.
 *
 *   <script src="https://<babel-host>/babel.js" data-store="croiala" data-template="home" async></script>
 *
 * Attributes on the script tag:
 *   data-store     store id; its brand kit and registry live in Babel (data/stores/<id>.json)
 *   data-template  home | category | product (default home)
 *   data-product   product id on a product page
 *   data-consent   "personalization" when the store's own consent banner said yes (default: no consent,
 *                  so no visitor id and nothing remembered between visits)
 *   data-endpoint  Babel's base URL (default: where this script was loaded from)
 *
 * Markup the store adds to the page it already renders:
 *   data-babel-block="<BlockId>"     a section Babel may restyle, reorder, collapse or hide
 *   data-variant="<name>"            one rendering of that section; the default one visible, the rest `hidden`
 *                                    (keep `[hidden] { display: none !important }` in the store's CSS for first paint)
 *   data-babel-label="Products"      optional: the section name on its "Show …" button when collapsed
 *   data-babel-event="product_click" a click on this element is that interaction (data-babel-product, data-babel-value)
 *   data-babel-focus="price"         what this element is; a look of 1.5 s or more becomes a block_dwell signal
 *
 * Babel only ever picks among what the store rendered: it shows one variant, moves sections, sets theme
 * variables (--babel-gap, --babel-radius, --babel-type-scale) and data-babel-dialect / data-babel-contrast on <html>.
 * It never writes HTML (text only), and if Babel cannot be reached the page stays exactly as the store wrote it.
 */
(function () {
  "use strict";
  var me = document.currentScript; // only set while this script first runs
  if (!me || !me.dataset.store || window.__babelAdapter) return; // one instance per page
  window.__babelAdapter = true;
  // A store's own `display: grid` on a variant would beat the hidden attribute and show two variants at once.
  var css = document.createElement("style");
  css.textContent = "[data-babel-block][hidden],[data-babel-block] [data-variant][hidden]{display:none!important}";
  document.head.append(css);
  var API = (me.dataset.endpoint || new URL(me.src, location.href).origin).replace(/\/$/, "");
  var STORE = me.dataset.store;
  var TEMPLATE = me.dataset.template || "home";
  var PRODUCT = me.dataset.product || undefined;
  var CONSENT = me.dataset.consent === "personalization";

  var FLUSH_MS = 800, PAUSE_MS = 2000, IDLE_MS = 5000, DWELL_MS = 1500;
  // The events a store page can report by markup (a subset of the schema's EventType).
  var STORE_EVENTS = ["product_click", "category_click", "search", "filter", "sort", "gallery_swipe", "image_zoom",
    "hover_price", "review_open", "policy_open", "compare_add", "size_guide_open", "add_to_cart", "remove_from_cart",
    "checkout_start", "reorder_click", "back_nav"];
  var GAP = { airy: "2rem", comfortable: "1.25rem", compact: "0.75rem" };
  var root = document.documentElement;

  var visitId = null, t0 = 0, buffer = [], asking = false, wanted = false, standard = false;
  var slide = null, lastScroll = 0, lastActive = 0, idleSent = false, look = null, ui = null;
  var original = null; // the page as the store wrote it: Standard view puts this back

  var post = function (path, body) {
    // text/plain keeps this a "simple" cross-origin request (no preflight); the routes parse JSON regardless.
    return fetch(API + path, { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify(body) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  };
  var clean = function (s, n) { return s ? String(s).toLowerCase().replace(/[^a-z0-9_:.-]/g, "-").slice(0, n) : undefined; };
  var blockOf = function (el) { var b = el && el.closest && el.closest("[data-babel-block]"); return b ? b.getAttribute("data-babel-block") : undefined; };
  var variantsOf = function (block) {
    return Array.prototype.filter.call(block.querySelectorAll("[data-variant]"), function (v) {
      return v.closest("[data-babel-block]") === block;
    });
  };

  function track(type, extra) {
    if (!visitId) return;
    var e = { t: Math.max(0, Math.round(performance.now() - t0)), type: type };
    for (var k in extra) if (extra[k] !== undefined) e[k] = extra[k];
    buffer.push(e);
  }

  // ---- The page as written, and the slots sections can move between ----
  function snapshot() {
    var blocks = Array.prototype.slice.call(document.querySelectorAll("[data-babel-block]"));
    var slots = blocks.map(function (b) { var c = document.createComment("babel-slot"); b.before(c); return c; });
    original = {
      slots: slots,
      blocks: blocks.map(function (b, i) {
        var shown = variantsOf(b).filter(function (v) { return !v.hidden; })[0];
        return { el: b, id: b.getAttribute("data-babel-block"), variant: shown ? shown.dataset.variant : undefined, order: i + 1 };
      }),
    };
  }

  function collapseButton(block, on) {
    var btn = block.querySelector(":scope > .babel-show");
    if (!on) { if (btn) btn.remove(); return; }
    if (btn) return;
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "babel-show";
    btn.textContent = "Show " + (block.dataset.babelLabel || block.getAttribute("data-babel-block"));
    btn.addEventListener("click", function () {
      btn.remove();
      variantsOf(block).forEach(function (v) { if (v.dataset.babelOpen) { v.hidden = false; delete v.dataset.babelOpen; } });
      track("block_open", { blockId: block.getAttribute("data-babel-block") });
    });
    block.prepend(btn);
  }

  // Shows what a slide (or the original page) says. Unknown blocks and variants are skipped: the page keeps its own.
  function render(blocks, theme, dialect, contrast) {
    var byId = {};
    blocks.forEach(function (b) { byId[b.id] = b; });
    original.blocks.forEach(function (o) {
      var b = byId[o.id];
      if (!b) return;
      var vs = variantsOf(o.el);
      var known = vs.some(function (v) { return v.dataset.variant === b.variant; });
      o.el.hidden = b.variant === "hidden";
      if (known) vs.forEach(function (v) { v.hidden = v.dataset.variant !== b.variant || !!b.collapsed; delete v.dataset.babelOpen; });
      if (known && b.collapsed) vs.forEach(function (v) { if (v.dataset.variant === b.variant) v.dataset.babelOpen = "1"; });
      collapseButton(o.el, known && !!b.collapsed);
    });
    // Sections move between the slots the page had; ones the slide does not mention keep their place in line.
    var placed = original.blocks.slice().sort(function (a, b) {
      var x = byId[a.id] ? byId[a.id].order : a.order, y = byId[b.id] ? byId[b.id].order : b.order;
      return x - y || a.order - b.order;
    });
    placed.forEach(function (o, i) { if (original.slots[i].nextSibling !== o.el) original.slots[i].after(o.el); });

    if (theme) {
      root.style.setProperty("--babel-gap", GAP[theme.density] || GAP.comfortable);
      root.style.setProperty("--babel-radius", theme.radius + "px");
      root.style.setProperty("--babel-type-scale", String(theme.typeScale));
    } else ["--babel-gap", "--babel-radius", "--babel-type-scale"].forEach(function (k) { root.style.removeProperty(k); });
    if (dialect) root.dataset.babelDialect = dialect; else delete root.dataset.babelDialect;
    if (contrast) root.dataset.babelContrast = contrast; else delete root.dataset.babelContrast;
  }

  function show(next) {
    var prev = slide;
    slide = next;
    if (standard) return refreshUi();
    var calm = matchMedia("(prefers-reduced-motion: reduce)").matches || next.theme.motion === "reduced";
    render(next.blocks, next.theme, next.persona.dialect, next.theme.contrast);
    if (prev && !calm) {
      next.blocks.forEach(function (b) {
        var was = prev.blocks.filter(function (p) { return p.id === b.id; })[0];
        var el = document.querySelector('[data-babel-block="' + b.id + '"]');
        if (el && el.animate && (!was || was.variant !== b.variant || was.order !== b.order)) {
          el.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 400, easing: "ease-out" });
        }
      });
    }
    track("slide_shown", { value: next.index });
    refreshUi();
  }

  function setStandard(on) {
    standard = on;
    if (on) render(original.blocks, null, null, null);
    else if (slide) render(slide.blocks, slide.theme, slide.persona.dialect, slide.theme.contrast);
    track("view_switch", { value: on ? "standard" : "babel" });
    refreshUi();
  }

  // ---- The shopper's controls: Standard view (always one tap) and Why? ----
  function buildUi() {
    var bar = document.createElement("div");
    bar.className = "babel-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Page view");
    bar.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:2147483000;display:flex;gap:8px;align-items:flex-end;" +
      "font:14px/1.3 system-ui,sans-serif;max-width:calc(100vw - 32px)";
    var btn = function (text) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.style.cssText = "padding:8px 12px;border-radius:999px;border:1px solid #0003;background:#fff;color:#111;cursor:pointer;box-shadow:0 2px 8px #0002";
      return b;
    };
    var toggle = btn("Standard view");
    var why = btn("Why?");
    var panel = document.createElement("p");
    panel.id = "babel-why";
    panel.hidden = true;
    panel.style.cssText = "margin:0 0 4px;padding:10px 12px;border-radius:10px;background:#111;color:#fff;max-width:320px";
    why.setAttribute("aria-expanded", "false");
    why.setAttribute("aria-controls", panel.id);
    toggle.addEventListener("click", function () { setStandard(!standard); });
    why.addEventListener("click", function () {
      panel.hidden = !panel.hidden;
      why.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) track("why_open", {});
    });
    var col = document.createElement("div");
    col.style.cssText = "display:flex;flex-direction:column;align-items:flex-start";
    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px";
    row.append(toggle, why);
    col.append(panel, row);
    bar.append(col);
    document.body.append(bar);
    ui = { toggle: toggle, panel: panel };
  }

  function refreshUi() {
    if (!ui) buildUi();
    ui.toggle.textContent = standard ? "Personalized view" : "Standard view";
    ui.toggle.setAttribute("aria-pressed", String(standard));
    ui.panel.textContent = standard
      ? "You are seeing the store's standard page. Nothing is adapted."
      : slide ? "This view: " + slide.rationale + " Babel picks among layouts this store made; prices and products are the store's own."
      : "The store's standard page.";
  }

  // ---- Asking for a new slide, once the shopper pauses ----
  function ask() {
    if (!visitId || asking || standard) return;
    if (performance.now() - lastScroll < PAUSE_MS) { setTimeout(ask, 300); return; }
    asking = true;
    post("/api/slide", { visitId: visitId }).then(function (r) {
      asking = false;
      wanted = false;
      if (r && r.decision === "slide" && r.slide) show(r.slide);
    });
  }

  function flush() {
    var now = performance.now();
    if (visitId && !idleSent && now - lastActive > IDLE_MS) {
      idleSent = true;
      track("idle", { blockId: look ? look.block : undefined, value: Math.round(now - lastActive) });
    }
    if (!visitId || !buffer.length) return;
    post("/api/events", { visitId: visitId, events: buffer.splice(0, 200) }).then(function (r) {
      if (r && r.trigger && !wanted) { wanted = true; ask(); }
    });
  }

  function endLook() {
    var ms = look ? Math.round(performance.now() - look.since) : 0;
    if (look && ms >= DWELL_MS) track("block_dwell", { blockId: look.block, productId: PRODUCT, target: look.target, value: ms });
  }

  function listen() {
    var active = function () { lastActive = performance.now(); idleSent = false; };
    addEventListener("scroll", function () { lastScroll = performance.now(); active(); }, { passive: true });
    addEventListener("keydown", active);
    addEventListener("pointermove", function (e) {
      active();
      var f = e.target && e.target.closest && e.target.closest("[data-babel-focus]");
      var target = f ? clean(f.getAttribute("data-babel-focus"), 60) : undefined;
      if (target === (look && look.target)) return;
      endLook();
      look = target ? { target: target, block: blockOf(f), since: performance.now() } : null;
    }, { passive: true });
    document.addEventListener("click", function (e) {
      var el = e.target && e.target.closest && e.target.closest("[data-babel-event]");
      if (!el) return;
      var type = el.getAttribute("data-babel-event");
      if (STORE_EVENTS.indexOf(type) < 0) return; // a typo in the markup must not drop the whole batch
      var value = el.getAttribute("data-babel-value");
      track(type, {
        blockId: blockOf(el),
        productId: el.getAttribute("data-babel-product") || PRODUCT,
        value: value === null ? undefined : value.slice(0, 200),
      });
    }, true);
    addEventListener("pagehide", function () { endLook(); flush(); });
    setInterval(flush, FLUSH_MS);
  }

  function visitorId() {
    if (!CONSENT) return undefined;
    try { // consented, per-browser random id; no personal data
      var k = "babel.visitor";
      var id = localStorage.getItem(k);
      if (!id) { id = crypto.randomUUID(); localStorage.setItem(k, id); }
      return id;
    } catch (_) { return undefined; }
  }

  function start() {
    snapshot();
    var partner = {
      consent: { personalization: CONSENT, partnerData: false },
      visitor: { returning: false, visits: 1 },
      device: {
        pointer: matchMedia("(pointer: coarse)").matches ? "coarse" : "fine",
        viewportWidth: innerWidth,
        zoom: devicePixelRatio,
        prefersReducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        prefersContrast: matchMedia("(prefers-contrast: more)").matches,
      },
    };
    post("/api/visit", { store: STORE, template: TEMPLATE, productId: PRODUCT, partner: partner, visitorId: visitorId() })
      .then(function (r) {
        if (!r || !r.visitId || !r.slide) return; // Babel unreachable: the store's own page stays
        visitId = r.visitId;
        t0 = performance.now();
        lastActive = t0;
        listen();
        show(r.slide);
        track("page_view", { productId: PRODUCT });
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
