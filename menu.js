// tekinhoca.github.io — Ortak Menü
// Yeni sayfa eklenince sadece bu dosyayı güncelle.

const MENU_ITEMS = [
  { label: "Ana Sayfa",            href: "index.html" },
  { label: "Atatürk ve Matematik", href: "ataturk-matematik.html" },
  { label: "Matematik Tarihi",     href: "matematik-tarihi.html" },
  { label: "Matematik Oyunları",   href: "matematik-oyunlari.html" },
  { label: "Estetik Matematik",    href: "estetik-matematik.html" },
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

  // Hamburger menü (mobil)
  const burger = document.getElementById("burger");
  if (burger) {
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
  }
})();
