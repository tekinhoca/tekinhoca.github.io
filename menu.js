// tekinhoca.github.io — Ortak Menü
// Yeni sayfa eklenince sadece bu dosyayı güncelle.

const MENU_ITEMS = [
  { label: "Ana Sayfa",            href: "https://tekinhoca.github.io/",
    title: "Ana",        accent: "Sayfa",               sub: "Matematik · Zekâ Oyunları · Kulübü" },
  { label: "Hesaplama Araçları",   href: "hesap-araclar.html",
    title: "Hesaplama",    accent: "Araçları",           sub: "Formülleri Gör · Örnekleri Karşılaştır · Uygulayarak Öğren" },
  { label: "Ortaokul Matematik",   href: "ortaokul-matematik.html",
    title: "İnteraktif",   accent: "Ortaokul Matematik", sub: "Eğlen · Keşfet · Uygula · Öğren" },
  { label: "Mantık-Zekâ Oyunları", href: "html-oyunlar.html",
    title: "Mantık ve",    accent: "Zekâ Oyunları",      sub: "Oyna · Düşün · Kendini Geliştir" },
  { label: "Kulüp Dosyaları",      href: "kulup-dosyalari.html",
    title: "Kulüp",        accent: "Dosyaları",          sub: "Oku · İzle · Keşfet" },
  { label: "Atatürk ve Matematik", href: "ataturk-matematik.html",
    title: "Atatürk ve",   accent: "Matematik",          sub: "Geometri Terimleri · Eğitim Reformu · Dil Devrimi" },
  { label: "Matematik Tarihi",     href: "matematik-tarihi.html",
    title: "Matematiğin",  accent: "Tarihi",             sub: "Sayıların, Şekillerin ve Fikirlerin Büyük Yolculuğu" },
  { label: "Estetik Matematik",    href: "estetik-matematik.html",
    title: "Estetik",      accent: "Matematik",          sub: "Sayıların Gizli Güzelliği" },
  { label: "Matematik Hikayeleri", href: "matematik-hikayeleri.html",
    title: "Matematik",    accent: "Hikayeleri",         sub: "Sayıların Ardındaki Efsaneler · Paradokslar · Deha Anları" },
];
// label: menüde görünen ad. title / accent / sub: kaydırma önizlemesindeki başlık kartı
// (title normal, accent altın-italik, sub alt başlık). Yeni sayfa eklerken üçünü de doldur;
// boş bırakırsan kartta yalnızca label gösterilir.

// ── TEMA — localStorage'dan oku, hemen uygula (flash önleme) ──
(function () {
  const saved = localStorage.getItem('th-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();

(function () {
  const current = window.location.pathname.split("/").pop() || "index.html";

  const nav = document.getElementById("site-nav");
  if (!nav) return;

  const inner = document.createElement("div");
  inner.className = "nav-inner";

  MENU_ITEMS.forEach(function (item) {
    const a = document.createElement("a");

    // "Ana Sayfa" linki için: offline (file://) modda yerel index.html'e,
    // online (https://) modda ise canonical adrese yönlendir.
    if (item.href === "https://tekinhoca.github.io/" && window.location.protocol === "file:") {
      a.href = "index.html";
    } else {
      a.href = item.href;
    }

    a.textContent = item.label;
    if (item.href === current) a.className = "active";
    inner.appendChild(a);
  });

  nav.appendChild(inner);

  inner.classList.remove("open");
  if (document.getElementById("burger")) {
    document.getElementById("burger").classList.remove("open");
  }

  // ── NAV YÜKSEKLİĞİ — sayfa içi #id bağlantılarının menü altında
  // kalmaması için gerçek yüksekliği ölç ve CSS değişkenine yaz.
  // Menü satır sayısı ekran genişliğine göre değiştiğinden (sarma),
  // sabit bir piksel değeri yerine her zaman güncel değeri kullanırız.
  function updateNavHeight() {
    document.documentElement.style.setProperty("--nav-height", nav.offsetHeight + "px");
  }
  updateNavHeight();
  window.addEventListener("load", updateNavHeight);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(updateNavHeight);
  }
  let navResizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(navResizeTimer);
    navResizeTimer = setTimeout(updateNavHeight, 150);
  });

  let burger = document.getElementById("burger");
  if (burger) {
    burger.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg><span>MENÜ</span>';
    burger.addEventListener("click", function () {
      inner.classList.toggle("open");
      burger.classList.toggle("open");
      updateNavHeight();
    });
    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target)) {
        inner.classList.remove("open");
        burger.classList.remove("open");
        updateNavHeight();
      }
    });
    inner.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        inner.classList.remove("open");
        burger.classList.remove("open");
        updateNavHeight();
      });
    });
  }

  // ── TEMA TOGGLE BUTONU ──
  const toggle = document.createElement("button");
  toggle.id = "theme-toggle";
  toggle.title = "Gece / Gündüz modu";
  toggle.setAttribute("aria-label", "Gece veya gündüz moduna geç");

  function getTheme() {
    return document.documentElement.getAttribute("data-theme") || "light";
  }
  function setIcon() {
    toggle.textContent = getTheme() === "dark" ? "☀" : "☾";
  }
  setIcon();

  toggle.addEventListener("click", function () {
    const next = getTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("th-theme", next);
    setIcon();
  });

  document.body.appendChild(toggle);
})();

// ══════════════════════════════════════════════════════════════
// SAYFALAR ARASI KAYDIRMA (yalnızca dokunmatik cihazlar)
// ──────────────────────────────────────────────────────────────
// • Sayfa sırası MENU_ITEMS'tan okunur. Menü sırasını değiştirirsen
//   kaydırma sırası da kendiliğinden değişir; bu bölüme dokunman gerekmez.
// • Son sayfadan sonra ilk sayfa (Ana Sayfa), Ana Sayfa'dan geriye son sayfa gelir.
// • ÖNİZLEME: Sıradaki sayfanın "başlık kartı" gösterilir (GİDİLECEK SAYFA,
//   süs çizgisi, başlık, alt başlık). Metinler MENU_ITEMS içindeki title / accent / sub
//   alanlarından, görünüm common.css sonundaki ".sw-card" kurallarından gelir.
//   Görsel dosyası gerekmez; her cihazda aynı görünür.
// • TARAYICI GEÇMİŞİ: Ana Sayfa'dan yapılan ilk kaydırma geçmişe yeni kayıt ekler
//   (location.assign). Zincirin devamındaki kaydırmalar o kaydı değiştirir
//   (location.replace). Böylece kaç sayfa gezilirse gezilsin GERİ → Ana Sayfa,
//   bir kez daha GERİ → siteye gelmeden önceki sayfa olur. Zincir içindeyken
//   Ana Sayfa'ya kaydırılırsa yeni kayıt açılmaz, history.back() ile mevcut
//   Ana Sayfa kaydına dönülür (geçmişte çift Ana Sayfa kaydı oluşmaz).
//   Zincirdeki sayfalar history.state içinde {sw:1} işaretiyle tanınır.
// • Sürgü, giriş kutusu, canvas ve yatay kaydırılan alanlarda başlayan
//   hareketler sayfa geçişini tetiklemez. Bir alanı da hariç tutmak için
//   o öğeye data-no-swipe niteliği verebilirsin.
// ══════════════════════════════════════════════════════════════
(function () {
  "use strict";

  // İframe içinde, dokunmatik olmayan cihazda veya translate özelliğini
  // desteklemeyen eski tarayıcıda çalışmaz (menü etkilenmez).
  if (window.self !== window.top) return;
  if (!("ontouchstart" in window) && !(navigator.maxTouchPoints > 0)) return;
  if (typeof MENU_ITEMS === "undefined" || MENU_ITEMS.length < 2) return;
  var html = document.documentElement;
  if (!("translate" in html.style)) return;

  // ── Ayarlar (gerçek telefonda denenerek değiştirilebilir) ──
  var DEAD_EDGE    = 20;    // ekran kenarında bu kadar pikselde başlayan dokunuş yok sayılır (tarayıcı geri/ileri hareketi)
  var INTENT_PX    = 10;    // yönün belirlenmesi için gereken ilk hareket
  var DIR_RATIO    = 1.5;   // yatay hareket, dikeyin en az bu katı olmalı
  var THRESHOLD    = 0.35;  // ekran genişliğinin bu oranı kadar sürüklenirse geçiş tamamlanır
  var FLICK_SPEED  = 0.45;  // piksel/ms — bundan hızlı bırakılırsa mesafe eşiği aranmaz
  var FLICK_MIN_PX = 50;    // hızlı hareketin en az bu kadar sürmesi gerekir
  var MIN_SCALE    = 0.7;   // önizlemenin başlangıç boyutu (yükseklik oranı)
  var ANIM_MS      = 240;   // geçiş animasyonu süresi
  var EASE         = "cubic-bezier(.2,.8,.2,1)";
  var KICKER_TEXT  = "GİDİLECEK SAYFA";   // kartın en üstündeki satır

  var reduceMotion = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var animMs = reduceMotion ? 0 : ANIM_MS;

  // ── Sayfa zinciri ──
  function slugOf(href) {
    var path;
    try { path = new URL(href, location.href).pathname; } catch (e) { path = String(href); }
    var name = path.split("/").pop().replace(/\.html?$/i, "");
    return name || "index";
  }
  var items = MENU_ITEMS.map(function (it) {
    return {
      label: it.label,
      href: it.href,
      slug: slugOf(it.href),
      title: it.title || it.label,   // kart başlığı (title yoksa menü adı)
      accent: it.accent || "",       // başlığın altın/italik bölümü
      sub: it.sub || ""              // alt başlık (boşsa gösterilmez)
    };
  });
  var n = items.length;
  var current = slugOf(location.href);
  var cur = -1;
  for (var i = 0; i < n; i++) { if (items[i].slug === current) { cur = i; break; } }
  if (cur < 0) return;
  var nextItem = items[(cur + 1) % n];
  var prevItem = items[(cur - 1 + n) % n];

  function hrefOf(it) {
    // Ana Sayfa bağlantısı mutlak adrestir; yerelde/başka adreste denerken o siteye
    // götürmemesi için, adres sitenin kendi adresiyle aynı değilse index.html kullanılır.
    if (it.slug === "index") {
      try {
        if (new URL(it.href, location.href).hostname === location.hostname) return it.href;
      } catch (e) {}
      return "index.html";
    }
    return it.href;
  }
  function afterLoad(fn) {
    if (document.readyState === "complete") fn();
    else window.addEventListener("load", fn);
  }

  // ── Önizleme kartı (header görünümü; renk ve yazı tipleri common.css'ten) ──
  function div(cls) {
    var d = document.createElement("div");
    if (cls) d.className = cls;
    return d;
  }
  function buildCard(it) {
    var card = div("sw-card");
    card.lang = "tr";
    var kicker = div("sw-kicker");
    kicker.textContent = KICKER_TEXT;
    var band = div("logo-band");
    band.appendChild(div("logo-line"));
    band.appendChild(div("logo-diamond"));
    band.appendChild(div("logo-line r"));
    var title = div("sw-title");
    title.appendChild(document.createTextNode(it.accent ? it.title + " " : it.title));
    if (it.accent) {
      var sp = document.createElement("span");
      sp.textContent = it.accent;
      title.appendChild(sp);
    }
    card.appendChild(kicker);
    card.appendChild(band);
    card.appendChild(title);
    if (it.sub) {
      var sub = div("sw-sub");
      sub.textContent = it.sub;
      card.appendChild(sub);
    }
    return card;
  }

  // ── Tarayıcı geçmişi işareti ──
  // chain: bu geçmiş kaydı "Ana Sayfa → kaydırma" zincirinin içinde mi?
  // (Yani hemen altındaki kayıt Ana Sayfa mı?)
  var chain = false;
  try { chain = !!(history.state && history.state.sw === 1); } catch (e) {}
  function markChain() {
    try {
      var s = history.state;
      if (s === null || typeof s === "undefined") s = {};
      if (typeof s !== "object") return;
      var copy = {};
      for (var k in s) { if (Object.prototype.hasOwnProperty.call(s, k)) copy[k] = s[k]; }
      copy.sw = 1;
      history.replaceState(copy, "");
      chain = true;
    } catch (e) {}
  }

  // ── Kaydırmayla gelinen sayfada: başlık kartını tam ekran koy, sayfa yüklenince sön ──
  var arrival = null;
  try {
    var raw = sessionStorage.getItem("sw-arrive");
    if (raw) { sessionStorage.removeItem("sw-arrive"); arrival = JSON.parse(raw); }
  } catch (e) {}
  if (arrival && arrival.slug === current && Date.now() - arrival.t < 8000) {
    if (arrival.mark) markChain();
    showArrivalCover();
  }

  function showArrivalCover() {
    var c = document.createElement("div");
    c.setAttribute("aria-hidden", "true");
    c.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483000;pointer-events:none;overflow:hidden;";
    c.appendChild(buildCard(items[cur]));
    html.appendChild(c);
    var gone = false;
    function hide() {
      if (gone) return;
      gone = true;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          c.style.transition = "opacity .25s ease";
          c.style.opacity = "0";
          setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 320);
        });
      });
    }
    afterLoad(function () {
      var f = document.fonts && document.fonts.ready;
      (f ? f : Promise.resolve()).then(hide, hide);
    });
    setTimeout(hide, 4000);
  }

  // ── Sürükleme durumu ──
  var st = null;          // dokunuş durumu
  var busy = false;       // animasyon sürerken yeni dokunuş kabul edilmez
  var kids = [];          // gövdenin kaydırılan doğrudan çocukları
  var peeks = { next: null, prev: null };
  var W = 0, H = 0, T = 0;
  var savedOverflowX = "";
  var raf = 0, pendingDx = 0;
  var navToken = 0;       // sayfa önbellekten geri yüklenirse bekleyen gezinmeleri geçersiz kılar

  function restTransform(dir) {
    var y = H * (1 - MIN_SCALE) / 2;
    var x = dir === "next" ? W : -W * MIN_SCALE;
    return "translate3d(" + x + "px," + y + "px,0) scale(" + MIN_SCALE + ")";
  }

  function makePeek(it, dir) {
    var d = document.createElement("div");
    d.setAttribute("aria-hidden", "true");
    d.style.cssText = "position:fixed;top:0;left:0;width:" + W + "px;height:" + H + "px;overflow:hidden;" +
      "z-index:-1;pointer-events:none;transform-origin:0 0;will-change:transform;visibility:hidden;" +
      "box-shadow:0 0 0 1px rgba(200,150,12,.35),0 0 28px rgba(0,0,0,.35);";
    d.style.transform = restTransform(dir);
    d.appendChild(buildCard(it));
    html.appendChild(d);
    return d;
  }

  // Önizleme yalnızca ilgili yönde ve ilk gerektiğinde oluşturulur
  function ensurePeek(dir) {
    if (!peeks[dir]) peeks[dir] = makePeek(dir === "next" ? nextItem : prevItem, dir);
    return peeks[dir];
  }

  function setAnim(ms) {
    var kt = ms > 0 ? "translate " + ms + "ms " + EASE : "none";
    var pt = ms > 0 ? "transform " + ms + "ms " + EASE : "none";
    kids.forEach(function (el) { el.style.transition = kt; });
    ["next", "prev"].forEach(function (k) { if (peeks[k]) peeks[k].style.transition = pt; });
  }

  function prepare() {
    W = html.clientWidth;
    H = window.innerHeight;
    T = W * THRESHOLD;
    kids = Array.prototype.filter.call(document.body.children, function (el) {
      var t = el.tagName;
      return t !== "SCRIPT" && t !== "STYLE" && t !== "LINK" && t !== "NOSCRIPT";
    });
    kids.forEach(function (el) { el.style.willChange = "translate"; });
    savedOverflowX = html.style.overflowX;
    html.style.overflowX = "hidden";
    setAnim(0);
  }

  function cleanup() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    kids.forEach(function (el) {
      el.style.translate = "";
      el.style.transition = "";
      el.style.willChange = "";
    });
    ["next", "prev"].forEach(function (k) {
      if (peeks[k] && peeks[k].parentNode) peeks[k].parentNode.removeChild(peeks[k]);
      peeks[k] = null;
    });
    html.style.overflowX = savedOverflowX;
    kids = [];
    st = null;
    busy = false;
  }

  // Sayfayı dx kadar kaydır, ilgili önizlemeyi parmağın arkasında konumlandır
  function apply(dx) {
    dx = Math.max(-W, Math.min(W, dx));
    var ad = Math.abs(dx);
    var p = Math.min(1, ad / T);
    var s = MIN_SCALE + (1 - MIN_SCALE) * p;
    var tx = dx + "px 0";
    kids.forEach(function (el) { el.style.translate = tx; });
    var dir = dx < 0 ? "next" : (dx > 0 ? "prev" : null);
    var k = dir ? ensurePeek(dir) : null;
    if (peeks.next) peeks.next.style.visibility = dx < 0 ? "visible" : "hidden";
    if (peeks.prev) peeks.prev.style.visibility = dx > 0 ? "visible" : "hidden";
    if (!k) return;
    var x = dx < 0 ? (W - ad) : (dx - s * W);
    var y = H * (1 - s) / 2;
    k.style.transform = "translate3d(" + x + "px," + y + "px,0) scale(" + s + ")";
  }

  function schedule(dx) {
    pendingDx = dx;
    if (!raf) raf = requestAnimationFrame(function () { raf = 0; apply(pendingDx); });
  }

  // Geçişi tamamla: eski sayfa tam çıkar, kart tam boyuta büyür, sonra gerçek sayfaya geç
  function commit(dir) {
    busy = true;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    var it = dir === "next" ? nextItem : prevItem;

    // Geçmiş yönetimi:
    //  assign  → Ana Sayfa'dan ilk kaydırma: Ana Sayfa kaydı geçmişte kalır
    //  back    → zincirden Ana Sayfa'ya: mevcut Ana Sayfa kaydına geri dön
    //  replace → zincir içinde veya zincir dışında: mevcut kaydı değiştir
    var mode, mark;
    if (current === "index") { mode = "assign"; mark = true; }
    else if (chain && it.slug === "index") { mode = "back"; mark = false; }
    else { mode = "replace"; mark = chain; }

    try { sessionStorage.setItem("sw-arrive", JSON.stringify({ slug: it.slug, t: Date.now(), mark: mark })); } catch (e) {}
    try { localStorage.setItem("sw-nudge", "1"); } catch (e) {}

    var k = ensurePeek(dir);
    void html.offsetWidth;
    setAnim(animMs);
    kids.forEach(function (el) { el.style.translate = (dir === "next" ? -W : W) + "px 0"; });
    if (peeks.next) peeks.next.style.visibility = dir === "next" ? "visible" : "hidden";
    if (peeks.prev) peeks.prev.style.visibility = dir === "prev" ? "visible" : "hidden";
    if (k) k.style.transform = "translate3d(0,0,0) scale(1)";

    var tok = ++navToken;
    setTimeout(function () {
      if (tok !== navToken) return;
      if (mode === "back") {
        history.back();
        // Geri gitme gerçekleşmezse (beklenmedik geçmiş durumu) normal geçişe dön
        setTimeout(function () { if (tok === navToken) location.replace(hrefOf(it)); }, 4000);
      } else if (mode === "assign") {
        location.assign(hrefOf(it));
      } else {
        location.replace(hrefOf(it));
      }
    }, animMs + 20);
    // Gezinme herhangi bir nedenle gerçekleşmezse sayfayı eski haline getir
    setTimeout(cleanup, 5000);
  }

  // Geçişi iptal et: sayfa yerine döner, önizleme kenara çekilir
  function rest(dir) {
    busy = true;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    setAnim(animMs);
    kids.forEach(function (el) { el.style.translate = "0px 0"; });
    var k = peeks[dir];
    if (k) k.style.transform = restTransform(dir);
    setTimeout(cleanup, animMs + 30);
  }

  // ── Hangi dokunuşlar yok sayılır ──
  var BLOCK_SEL = "input,textarea,select,[contenteditable],canvas,video,audio,iframe,[data-no-swipe],#site-nav";
  function blocked(el) {
    if (!el || !el.closest) return true;
    if (el.closest(BLOCK_SEL)) return true;
    for (var p = el; p && p !== document.body && p !== html; p = p.parentElement) {
      var cs = getComputedStyle(p);
      if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && p.scrollWidth > p.clientWidth + 1) return true;
    }
    return false;
  }

  function onStart(e) {
    if (busy) return;
    if (st && st.mode === "swipe") {            // ikinci parmak geldi: iptal
      var s0 = st; st = null;
      rest((s0.dx || 0) < 0 ? "next" : "prev");
      return;
    }
    st = null;
    if (e.touches.length !== 1) return;
    if (window.visualViewport && window.visualViewport.scale > 1.02) return;    // yakınlaştırılmışsa
    if (document.body.style.position === "fixed" || document.querySelector(".lightbox-overlay.show")) return;
    if (document.querySelector("#site-nav .nav-inner.open")) return;            // menü açıkken
    var sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed && String(sel).length) return;                  // metin seçilirken
    var t = e.touches[0];
    var vw = html.clientWidth;
    if (t.clientX < DEAD_EDGE || t.clientX > vw - DEAD_EDGE) return;
    if (blocked(e.target)) return;
    st = { x0: t.clientX, y0: t.clientY, mode: "pending", pts: [], dx: 0 };
  }

  function onMove(e) {
    if (!st || st.mode === "ignore" || busy) return;
    var t = e.touches[0];
    if (!t) return;
    var dx = t.clientX - st.x0, dy = t.clientY - st.y0;
    if (st.mode === "pending") {
      if (Math.abs(dx) < INTENT_PX && Math.abs(dy) < INTENT_PX) return;
      if (Math.abs(dx) > DIR_RATIO * Math.abs(dy)) {
        st.mode = "swipe";
        st.x0 = t.clientX;      // sayfa, yön belirlendiği noktadan itibaren parmağı izler
        dx = 0;
        prepare();
      } else {
        st.mode = "ignore";     // dikey hareket: normal sayfa kaydırması
        return;
      }
    }
    if (e.cancelable) e.preventDefault();
    var now = e.timeStamp || Date.now();
    st.pts.push({ x: t.clientX, t: now });
    while (st.pts.length > 2 && now - st.pts[0].t > 100) st.pts.shift();
    st.dx = dx;
    schedule(dx);
  }

  function onEnd() {
    if (!st) return;
    var s = st; st = null;
    if (s.mode !== "swipe") return;
    var dx = s.dx || 0, ad = Math.abs(dx);
    var v = 0, p = s.pts;
    if (p.length >= 2) {
      var dt = p[p.length - 1].t - p[0].t;
      if (dt > 0) v = (p[p.length - 1].x - p[0].x) / dt;
    }
    var flick = Math.abs(v) >= FLICK_SPEED && ad >= FLICK_MIN_PX && ((v < 0) === (dx < 0));
    if (ad >= T || flick) commit(dx < 0 ? "next" : "prev");
    else rest(dx < 0 ? "next" : "prev");
  }

  function onCancel() {
    if (!st) return;
    var s = st; st = null;
    if (s.mode === "swipe") rest((s.dx || 0) < 0 ? "next" : "prev");
  }

  document.addEventListener("touchstart",  onStart,  { passive: true });
  document.addEventListener("touchmove",   onMove,   { passive: false });
  document.addEventListener("touchend",    onEnd,    { passive: true });
  document.addEventListener("touchcancel", onCancel, { passive: true });
  // Sayfa tarayıcının geri/ileri önbelleğinden geri yüklenirse her şeyi sıfırla
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    navToken++;
    try { sessionStorage.removeItem("sw-arrive"); } catch (x) {}
    cleanup();
  });
  // Yatay kaydırmada tarayıcının kendi kenar/geri hareketini azalt
  html.style.overscrollBehaviorX = "none";

  // ── Ana Sayfa'da bir kez gösterilen kısa ipucu hareketi ──
  function maybeNudge() {
    if (current !== "index" || reduceMotion) return;
    if (!(window.matchMedia && matchMedia("(pointer: coarse)").matches)) return;
    try { if (localStorage.getItem("sw-nudge")) return; } catch (e) { return; }
    setTimeout(function () {
      if (busy || st || document.visibilityState !== "visible" || window.scrollY > 5) return;
      try { localStorage.setItem("sw-nudge", "1"); } catch (e) {}
      busy = true;
      prepare();
      ensurePeek("next");
      void html.offsetWidth;
      setAnim(320);
      apply(-Math.round(W * 0.12));
      setTimeout(function () { rest("next"); }, 700);
    }, 1400);
  }

  afterLoad(maybeNudge);
})();
