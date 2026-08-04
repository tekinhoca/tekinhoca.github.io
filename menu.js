// tekinhoca.github.io — Ortak Menü
// Yeni sayfa eklenince sadece bu dosyayı güncelle.

const MENU_ITEMS = [
  { label: "Ana Sayfa",            href: "https://tekinhoca.github.io/" },
  { label: "Atatürk ve Matematik", href: "ataturk-matematik.html" },
  { label: "Matematik Tarihi",     href: "matematik-tarihi.html" },
  { label: "Estetik Matematik",    href: "estetik-matematik.html" },
  { label: "Matematik Hikayeleri", href: "matematik-hikayeleri.html" },
  { label: "Hesaplama Araçları",   href: "hesap-araclar.html" },
  { label: "Mantık-Zekâ Oyunları", href: "html-oyunlar.html" },
  { label: "Ortaokul Matematik",   href: "ortaokul-matematik.html" },
  { label: "Kulüp Dosyaları",      href: "kulup-dosyalari.html" },
];

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
    burger.textContent = "MENÜ";
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
