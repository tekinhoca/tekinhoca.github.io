/* =============================================================
   İFADE MOTORU — KLASİK HESAP MAKİNESİ İÇİN İFADE DEĞERLENDİRİCİ
   =============================================================
   Bu dosya, Aşama 3'teki "hesap-parser.js" (serbest Türkçe cümle
   ayrıştırıcısı) İLE KARIŞTIRILMAMALIDIR. Bu, tamamen farklı bir
   iş yapar: kullanıcının buton veya klavyeyle oluşturduğu SEMBOLİK
   matematiksel ifadeyi (örn. "125×48+√625-2^3") standart işlem
   önceliği kurallarıyla değerlendirir.

   DESTEKLENEN SÖZDİZİMİ:
   - Dört işlem: + - × (veya x, *) ÷ (veya /)
   - Parantez: ( )
   - Üs: ^ (sağdan birleşimli, örn. 2^3^2 = 2^(3^2))
   - Kök: √( ... )  veya  sqrt( ... )  — PARANTEZ ZORUNLUDUR.
     Bilinçli tasarım kararı: "√25^2" gibi parantezsiz kullanımlarda
     "(√25)^2 mi yoksa √(25^2) mi?" belirsizliği oluşacağından, kök
     her zaman açık parantezle kullanılmalıdır. Klasik modülün arayüz
     tarafında "√" butonu otomatik olarak "√(" ve ")" çiftini birlikte
     ekleyecek, kullanıcı sadece arayı dolduracaktır.
   - Faktöriyel: sonek olarak ! (örn. 5!)
   - Yüzde: sonek olarak % (örn. 50% = 0.5; standart hesap makinesi
     kuralı, bağlamsal "200 + %10" yorumu YAPILMAZ — bilinçli sınırlama)
   - Trigonometri: sin(...), cos(...), tan(...) — DERECE cinsinden
     (bilinçli tasarım kararı: hedef kitle lise/ortaokul düzeyi Türk
     öğrenciler olduğundan varsayılan derece; radyan modu V1'de yok)
   - Logaritma: log(...) (taban 10), ln(...) (doğal logaritma)
   - Sabitler: π (pi), e (Euler sayısı)
   - Ondalık ayırıcı olarak hem nokta hem virgül kabul edilir

   HATA YÖNETİMİ:
   Sözdizimi hatalarında ve tanımsız işlemlerde (sıfıra bölme,
   negatif faktöriyel vb.) Error fırlatılır; arayüz bunu yakalayıp
   kullanıcıya gösterir.
   ============================================================= */

(function (global) {
  'use strict';

  const HM = global.HesapMotoru;
  if (!HM) {
    throw new Error('IfadeMotoru, HesapMotoru modülüne ihtiyaç duyar. hesap-motoru.js dosyasını önce yükleyin.');
  }

  const FONKSIYONLAR = ['sqrt', 'sin', 'cos', 'tan', 'log', 'ln'];

  /* ---------- TOKENİZER ---------- */

  function tokenize(str) {
    const tokens = [];
    let i = 0;
    const n = str.length;

    while (i < n) {
      const c = str[i];

      if (/\s/.test(c)) { i++; continue; }

      // sayı (ondalık nokta içerebilir; virgül önceden noktaya çevrildi)
      if (/[0-9.]/.test(c)) {
        let j = i;
        let noktaSayisi = 0;
        while (j < n && /[0-9.]/.test(str[j])) {
          if (str[j] === '.') noktaSayisi++;
          j++;
        }
        if (noktaSayisi > 1) {
          throw new Error('Geçersiz sayı biçimi: "' + str.slice(i, j) + '"');
        }
        tokens.push({ type: 'sayi', value: parseFloat(str.slice(i, j)) });
        i = j;
        continue;
      }

      // fonksiyon adları
      const kalan = str.slice(i).toLowerCase();
      const bulunanFonksiyon = FONKSIYONLAR.find(function (f) { return kalan.startsWith(f); });
      if (bulunanFonksiyon) {
        tokens.push({ type: 'fonksiyon', value: bulunanFonksiyon });
        i += bulunanFonksiyon.length;
        continue;
      }

      if (c === '√') { tokens.push({ type: 'fonksiyon', value: 'sqrt' }); i++; continue; }
      if (c === 'π') { tokens.push({ type: 'sayi', value: Math.PI }); i++; continue; }
      if (c === 'e') { tokens.push({ type: 'sayi', value: Math.E }); i++; continue; }

      if ('+-*/^!%()'.indexOf(c) !== -1) {
        tokens.push({ type: 'islec', value: c });
        i++;
        continue;
      }

      throw new Error('Tanınmayan karakter: "' + c + '"');
    }

    return tokens;
  }

  /* ---------- ÖZYİNELEMELİ İNİŞ AYRIŞTIRICI ----------
     ifade    := terim (('+'|'-') terim)*
     terim    := kuvvet (('*'|'/') kuvvet)*
     kuvvet   := oncek ('^' kuvvet)?         (sağdan birleşimli)
     oncek    := '-' oncek | '+' oncek | sonek
     sonek    := birincil ('!' | '%')*
     birincil := SAYI | '(' ifade ')' | FONKSIYON '(' ifade ')'
  */

  function ayristiriciOlustur(tokens) {
    let pos = 0;

    function bak() { return tokens[pos]; }
    function ilerle() { return tokens[pos++]; }
    function islecMi(deger) {
      const t = bak();
      return !!t && t.type === 'islec' && t.value === deger;
    }

    function ifadeAyristir() {
      let deger = terimAyristir();
      while (islecMi('+') || islecMi('-')) {
        const op = ilerle().value;
        const sag = terimAyristir();
        deger = (op === '+') ? HM.topla(deger, sag) : HM.cikar(deger, sag);
      }
      return deger;
    }

    function terimAyristir() {
      let deger = kuvvetAyristir();
      while (islecMi('*') || islecMi('/')) {
        const op = ilerle().value;
        const sag = kuvvetAyristir();
        deger = (op === '*') ? HM.carp(deger, sag) : HM.bol(deger, sag);
      }
      return deger;
    }

    function kuvvetAyristir() {
      const taban = oncekAyristir();
      if (islecMi('^')) {
        ilerle();
        const us = kuvvetAyristir(); // sağdan birleşimli
        return HM.us(taban, us);
      }
      return taban;
    }

    function oncekAyristir() {
      if (islecMi('-')) { ilerle(); return -oncekAyristir(); }
      if (islecMi('+')) { ilerle(); return oncekAyristir(); }
      return sonekAyristir();
    }

    function sonekAyristir() {
      let deger = birincilAyristir();
      while (islecMi('!') || islecMi('%')) {
        const op = ilerle().value;
        deger = (op === '!') ? HM.faktoriyel(deger) : (deger / 100);
      }
      return deger;
    }

    function birincilAyristir() {
      const t = bak();
      if (!t) throw new Error('İfade eksik.');

      if (t.type === 'sayi') { ilerle(); return t.value; }

      if (t.type === 'islec' && t.value === '(') {
        ilerle();
        const deger = ifadeAyristir();
        if (!bak() || bak().value !== ')') throw new Error('Parantez kapatılmamış.');
        ilerle();
        return deger;
      }

      if (t.type === 'fonksiyon') {
        ilerle();
        if (!bak() || bak().value !== '(') {
          throw new Error('"' + t.value + '" fonksiyonundan sonra parantez bekleniyor.');
        }
        ilerle();
        const ic = ifadeAyristir();
        if (!bak() || bak().value !== ')') throw new Error('Parantez kapatılmamış.');
        ilerle();

        switch (t.value) {
          case 'sqrt': return HM.kok(ic, 2);
          case 'sin': return Math.sin(ic * Math.PI / 180);
          case 'cos': return Math.cos(ic * Math.PI / 180);
          case 'tan': return Math.tan(ic * Math.PI / 180);
          case 'log': return Math.log10(ic);
          case 'ln': return Math.log(ic);
          default: throw new Error('Bilinmeyen fonksiyon: ' + t.value);
        }
      }

      throw new Error('Beklenmeyen ifade: "' + (t.value !== undefined ? t.value : '') + '"');
    }

    return { ifadeAyristir: ifadeAyristir, tumTokenlerTuketildi: function () { return pos === tokens.length; } };
  }

  /* ---------- ANA GİRİŞ NOKTASI ---------- */

  function hesapla(ifadeMetni) {
    if (typeof ifadeMetni !== 'string' || ifadeMetni.trim() === '') {
      throw new Error('Boş ifade.');
    }

    const normalize = ifadeMetni
      .replace(/[×xX]/g, '*')
      .replace(/÷/g, '/')
      .replace(/,/g, '.');

    const tokens = tokenize(normalize);
    if (tokens.length === 0) {
      throw new Error('Boş ifade.');
    }

    const ayristirici = ayristiriciOlustur(tokens);
    const sonuc = ayristirici.ifadeAyristir();

    if (!ayristirici.tumTokenlerTuketildi()) {
      throw new Error('İfade hatalı: fazladan karakter var.');
    }
    if (typeof sonuc !== 'number' || !Number.isFinite(sonuc)) {
      throw new Error('Sonuç hesaplanamadı (tanımsız veya aşırı büyük değer).');
    }

    return sonuc;
  }

  /* ---------- DIŞA AKTARIM ---------- */

  const IfadeMotoru = { hesapla: hesapla };

  global.IfadeMotoru = IfadeMotoru;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = IfadeMotoru;
  }

})(typeof window !== 'undefined' ? window : globalThis);
