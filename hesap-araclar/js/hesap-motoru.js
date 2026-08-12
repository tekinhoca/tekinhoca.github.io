/* =============================================================
   HESAP MOTORU — ORTAK HESAPLAMA KATMANI (Aşama 1)
   =============================================================
   Bu dosya, Hesap Makinesi (Klasik + Akıllı) ve ileride EBOB-EKOK,
   Yüzde Hesaplamaları gibi konuya özel araçların paylaşacağı temel
   matematik fonksiyonlarını içerir.

   TASARIM KARARI:
   Fonksiyonlar SADECE nihai sonucu döndürür; ara adım / çözüm
   gösterimi içermez. Adım adım anlatım gereken konular, kendi
   konuya özel araçlarında (örn. EBOB-EKOK sayfası) ayrıca ele alınır.

   HATA YÖNETİMİ:
   Geçersiz girdi durumunda fonksiyonlar sayısal bir "hata sonucu"
   üretmek yerine throw ile Error fırlatır. Çağıran kod (arayüz veya
   parser) bunu try/catch ile yakalayıp kullanıcıya uygun mesaj
   gösterecektir. Bu dosya arayüzden habersizdir.
   ============================================================= */

(function (global) {
  'use strict';

  /* ---------- YARDIMCI DOĞRULAMALAR ---------- */

  function sayiMi(deger) {
    return typeof deger === 'number' && Number.isFinite(deger);
  }

  function dogrulaSayi(deger, adBilgisi) {
    if (!sayiMi(deger)) {
      throw new Error((adBilgisi || 'Değer') + ' geçerli bir sayı olmalı.');
    }
    return deger;
  }

  function dogrulaTamsayi(deger, adBilgisi) {
    dogrulaSayi(deger, adBilgisi);
    if (!Number.isInteger(deger)) {
      throw new Error((adBilgisi || 'Değer') + ' bir tam sayı olmalı.');
    }
    return deger;
  }

  function dogrulaPozitifTamsayi(deger, adBilgisi) {
    dogrulaTamsayi(deger, adBilgisi);
    if (deger <= 0) {
      throw new Error((adBilgisi || 'Değer') + ' pozitif bir tam sayı olmalı.');
    }
    return deger;
  }

  /* ---------- DÖRT İŞLEM ---------- */

  function topla(a, b) {
    dogrulaSayi(a, 'İlk sayı');
    dogrulaSayi(b, 'İkinci sayı');
    return a + b;
  }

  function cikar(a, b) {
    dogrulaSayi(a, 'İlk sayı');
    dogrulaSayi(b, 'İkinci sayı');
    return a - b;
  }

  function carp(a, b) {
    dogrulaSayi(a, 'İlk sayı');
    dogrulaSayi(b, 'İkinci sayı');
    return a * b;
  }

  function bol(a, b) {
    dogrulaSayi(a, 'İlk sayı');
    dogrulaSayi(b, 'İkinci sayı');
    if (b === 0) {
      throw new Error('Sıfıra bölme tanımsızdır.');
    }
    return a / b;
  }

  /* ---------- YÜZDE ---------- */

  // sayının yüzde kaçı: örn. 120'nin yüzde 25'i -> yuzdeninDegeri(120, 25) = 30
  function yuzdeninDegeri(sayi, yuzde) {
    dogrulaSayi(sayi, 'Sayı');
    dogrulaSayi(yuzde, 'Yüzde değeri');
    return (sayi * yuzde) / 100;
  }

  // sayı1, sayı2'nin yüzde kaçıdır: örn. 80, 120'nin yüzde kaçı -> yuzdeKac(80, 120) = 66.666...
  function yuzdeKac(sayi1, sayi2) {
    dogrulaSayi(sayi1, 'İlk sayı');
    dogrulaSayi(sayi2, 'İkinci sayı');
    if (sayi2 === 0) {
      throw new Error('Sıfıra göre yüzde hesaplanamaz.');
    }
    return (sayi1 / sayi2) * 100;
  }

  // sayı, yüzde kadar artırılır: örn. 120 yüzde 25 artırılırsa -> yuzdeArtir(120, 25) = 150
  function yuzdeArtir(sayi, yuzde) {
    dogrulaSayi(sayi, 'Sayı');
    dogrulaSayi(yuzde, 'Yüzde değeri');
    return sayi + yuzdeninDegeri(sayi, yuzde);
  }

  // sayı, yüzde kadar azaltılır: örn. 120 yüzde 25 azaltılırsa -> yuzdeAzalt(120, 25) = 90
  function yuzdeAzalt(sayi, yuzde) {
    dogrulaSayi(sayi, 'Sayı');
    dogrulaSayi(yuzde, 'Yüzde değeri');
    return sayi - yuzdeninDegeri(sayi, yuzde);
  }

  /* ---------- ÜS / KÖK ---------- */

  function us(taban, ussu) {
    dogrulaSayi(taban, 'Taban');
    dogrulaSayi(ussu, 'Üs');
    const sonuc = Math.pow(taban, ussu);
    if (!Number.isFinite(sonuc)) {
      throw new Error('Sonuç hesaplanamadı (aşırı büyük veya tanımsız değer).');
    }
    return sonuc;
  }

  // kok(144) -> karekök, kok(27, 3) -> küpkök vb.
  function kok(sayi, derece) {
    dogrulaSayi(sayi, 'Sayı');
    const d = (derece === undefined || derece === null) ? 2 : derece;
    dogrulaSayi(d, 'Kök derecesi');
    if (d === 0) {
      throw new Error('Kök derecesi sıfır olamaz.');
    }
    if (sayi < 0) {
      if (Number.isInteger(d) && d % 2 !== 0) {
        // negatif sayının tek dereceden kökü tanımlıdır (örn. küpkök)
        return -Math.pow(-sayi, 1 / d);
      }
      throw new Error('Negatif sayının çift dereceden kökü gerçek sayılarda tanımsızdır.');
    }
    return Math.pow(sayi, 1 / d);
  }

  /* ---------- FAKTÖRİYEL ---------- */

  function faktoriyel(n) {
    dogrulaTamsayi(n, 'Sayı');
    if (n < 0) {
      throw new Error('Negatif sayıların faktöriyeli tanımsızdır.');
    }
    if (n > 170) {
      // 170! üzeri IEEE-754 double'da Infinity'e taşar
      throw new Error('Sayı çok büyük; faktöriyel hesaplanamıyor.');
    }
    let sonuc = 1;
    for (let i = 2; i <= n; i++) {
      sonuc *= i;
    }
    return sonuc;
  }

  /* ---------- SAYI TEORİSİ: EBOB / EKOK / ASAL ÇARPANLAR / BÖLENLER ---------- */

  function ebobIkili(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b !== 0) {
      const gecici = b;
      b = a % b;
      a = gecici;
    }
    return a;
  }

  // ebob(84, 126) veya ebob(12, 18, 24) gibi ikiden fazla sayı da desteklenir
  function ebob(...sayilar) {
    if (sayilar.length < 2) {
      throw new Error('EBOB için en az iki sayı gerekli.');
    }
    sayilar.forEach((s, i) => dogrulaPozitifTamsayi(s, (i + 1) + '. sayı'));
    return sayilar.reduce((acc, s) => ebobIkili(acc, s));
  }

  function ekokIkili(a, b) {
    return Math.abs(a * b) / ebobIkili(a, b);
  }

  function ekok(...sayilar) {
    if (sayilar.length < 2) {
      throw new Error('EKOK için en az iki sayı gerekli.');
    }
    sayilar.forEach((s, i) => dogrulaPozitifTamsayi(s, (i + 1) + '. sayı'));
    return sayilar.reduce((acc, s) => ekokIkili(acc, s));
  }

  // asalCarpanlar(360) -> [2,2,2,3,3,5]
  function asalCarpanlar(n) {
    dogrulaPozitifTamsayi(n, 'Sayı');
    if (n === 1) {
      return [];
    }
    const sonuc = [];
    let kalan = n;
    let bolen = 2;
    while (bolen * bolen <= kalan) {
      while (kalan % bolen === 0) {
        sonuc.push(bolen);
        kalan /= bolen;
      }
      bolen++;
    }
    if (kalan > 1) {
      sonuc.push(kalan);
    }
    return sonuc;
  }

  // bolenler(28) -> [1,2,4,7,14,28]
  function bolenler(n) {
    dogrulaPozitifTamsayi(n, 'Sayı');
    const sonuc = [];
    for (let i = 1; i <= n; i++) {
      if (n % i === 0) {
        sonuc.push(i);
      }
    }
    return sonuc;
  }

  function asalMi(n) {
    dogrulaPozitifTamsayi(n, 'Sayı');
    if (n === 1) {
      return false;
    }
    for (let i = 2; i * i <= n; i++) {
      if (n % i === 0) {
        return false;
      }
    }
    return true;
  }

  /* ---------- ORAN ---------- */

  // oran(80, 120) -> {a:2, b:3} biçiminde sadeleştirilmiş oran
  function oranSadelestir(a, b) {
    dogrulaPozitifTamsayi(a, 'İlk sayı');
    dogrulaPozitifTamsayi(b, 'İkinci sayı');
    const ortakBolen = ebobIkili(a, b);
    return { a: a / ortakBolen, b: b / ortakBolen };
  }

  /* ---------- PERMÜTASYON / KOMBİNASYON ---------- */

  function permutasyon(n, r) {
    dogrulaTamsayi(n, 'n');
    dogrulaTamsayi(r, 'r');
    if (n < 0 || r < 0 || r > n) {
      throw new Error('Geçersiz n, r değerleri (0 ≤ r ≤ n olmalı).');
    }
    return faktoriyel(n) / faktoriyel(n - r);
  }

  function kombinasyon(n, r) {
    dogrulaTamsayi(n, 'n');
    dogrulaTamsayi(r, 'r');
    if (n < 0 || r < 0 || r > n) {
      throw new Error('Geçersiz n, r değerleri (0 ≤ r ≤ n olmalı).');
    }
    return faktoriyel(n) / (faktoriyel(r) * faktoriyel(n - r));
  }

  /* ---------- DIŞA AKTARIM ---------- */

  const HesapMotoru = {
    // dört işlem
    topla,
    cikar,
    carp,
    bol,
    // yüzde
    yuzdeninDegeri,
    yuzdeKac,
    yuzdeArtir,
    yuzdeAzalt,
    // üs / kök
    us,
    kok,
    // faktöriyel
    faktoriyel,
    // sayı teorisi
    ebob,
    ekok,
    asalCarpanlar,
    bolenler,
    asalMi,
    // oran
    oranSadelestir,
    // permütasyon / kombinasyon
    permutasyon,
    kombinasyon
  };

  global.HesapMotoru = HesapMotoru;

  // Node/CommonJS ortamında test edilebilmesi için (tarayıcıda etkisizdir)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HesapMotoru;
  }

})(typeof window !== 'undefined' ? window : globalThis);
