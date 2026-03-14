// tekinhoca.github.io — Ortak Menü
// Yeni sayfa eklenince sadece bu dosyayı güncelle.

const MENU_ITEMS = [
  { label: "Ana Sayfa",            href: "index.html" },
  { label: "Atatürk ve Matematik", href: "ataturk-matematik.html" },
  { label: "Matematik Tarihi",     href: "matematik-tarihi.html" },
  { label: "Estetik Matematik",    href: "estetik-matematik.html" },
  { label: "Matematik Hikayeleri", href: "matematik-hikayeleri.html" },
  { label: "Matematik Oyunları",   href: "matematik-oyunlari.html" },
  { label: "Ortaokul Matematik",   href: "ortaokul-matematik.html" },
  { label: "Kulüp Dosyaları",      href: "kulup-dosyalari.html" },
];

(function () {
  // Aktif sayfayı belirle
  const current = window.location.pathname.split("/").pop() || "index.html";

  // Nav HTML'i oluştur
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

  // Sayfa yüklenince menüyü her zaman kapalı başlat
  inner.classList.remove("open");
  if (document.getElementById("burger")) {
    document.getElementById("burger").classList.remove("open");
  }

  // Hamburger menü (mobil)
  let burger = document.getElementById("burger");
  if (burger) {
    burger.textContent = "MENÜ";
    burger.addEventListener("click", function () {
      inner.classList.toggle("open");
      burger.classList.toggle("open");
    });
    // Dışarı tıklanınca kapat
    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target)) {
        inner.classList.remove("open");
        burger.classList.remove("open");
      }
    });
    // Menü bağlantısına tıklanınca menüyü kapat
    inner.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        inner.classList.remove("open");
        burger.classList.remove("open");
      });
    });
  }
})();
