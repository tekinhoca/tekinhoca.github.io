// tekinhoca.github.io — Ortak Menü
// Yeni sayfa eklenince sadece bu dosyayı güncelle.

const MENU_ITEMS = [
  { label: "Ana Sayfa",            href: "index.html" },
  { label: "Atatürk ve Matematik", href: "ataturk-matematik.html" },
  { label: "Matematik Tarihi",     href: "matematik-tarihi.html" },
  { label: "Estetik Matematik",    href: "estetik-matematik.html" },
  { label: "Matematik Hikayeleri", href: "matematik-hikayeleri.html" },
  { label: "HTML Zekâ Oyunları",   href: "html-oyunlar.html" },
  { label: "Flash Zekâ Oyunları",  href: "matematik-oyunlari.html" },
  { label: "Ortaokul Matematik",   href: "ortaokul-matematik.html" },
  { label: "Kulüp Dosyaları",      href: "kulup-dosyalari.html" },
];

(function () {
  const current = window.location.pathname.split("/").pop() || "index.html";

  const nav = document.getElementById("site-nav");
  if (!nav) return;

  const inner = document.createElement("div");
  inner.className = "nav-inner";

  MENU_ITEMS.forEach(function (item) {
    const a = document.createElement("a");
    a.href = item.href;
    a.textContent = item.label;
    if (item.href === current) a.className = "active";
    inner.appendChild(a);
  });

  nav.appendChild(inner);

  inner.classList.remove("open");
  if (document.getElementById("burger")) {
    document.getElementById("burger").classList.remove("open");
  }

  let burger = document.getElementById("burger");
  if (burger) {
    burger.textContent = "MENÜ";
    burger.addEventListener("click", function () {
      inner.classList.toggle("open");
      burger.classList.toggle("open");
    });
    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target)) {
        inner.classList.remove("open");
        burger.classList.remove("open");
      }
    });
    inner.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        inner.classList.remove("open");
        burger.classList.remove("open");
      });
    });
  }
})();
