/* =============================================================
   HESAP PARSER — MİNİ KURAL MOTORU (Aşama 3)
   =============================================================
   Bu dosya, HesapMotoru (Aşama 1) ve TRNormallestir (Aşama 2)
   üzerine kurulu, serbest Türkçe girdiyi tanınmış bir işleme
   eşleyen kural motorunu içerir.

   MİMARİ:
   Bu bir "her cümleyi anlayan" dil işleme sistemi DEĞİLDİR.
   Sabit bir KALIP LİSTESİ üzerinde çalışır: her kalıp, normalize
   edilmiş metindeki {SAYIn} yer tutucularının etrafındaki anahtar
   kelimeleri tanır. Tanınmayan her ifade, yanlış sonuç üretmek
   yerine "anlaşılamadı" veya "yakın eşleşme önerisi" olarak
   raporlanır (belgedeki 3 aşamalı yaklaşım kararıyla tutarlı).

   ÜÇ SONUÇ TÜRÜ:
   1) basarili: true                -> doğrudan anlama, sonuç var
   2) basarili: false, tur:'yakin_eslesme' -> sayı var, işlem belirsiz
   3) basarili: false, tur:'anlasilamadi'  -> hiç tanınamadı
   ============================================================= */

(function (global) {
  'use strict';

  const HM = global.HesapMotoru;
  const TRN = global.TRNormallestir;

  if (!HM || !TRN) {
    throw new Error(
      'HesapParser, HesapMotoru ve TRNormallestir modüllerine ihtiyaç duyar. ' +
      'Lütfen hesap-motoru.js ve tr-normallestir.js dosyalarını bu dosyadan önce yükleyin.'
    );
  }

  /* ---------- YARDIMCI: SONDAKİ SORU/DOLGU KELİMELERİNİ TEMİZLE ---------- */

  function sonEkleriTemizle(metin) {
    let s = metin;
    // "... kaç?", "... kaçtır?", "... nedir?", "... ne kadar?" gibi soru
    // takılarını sondan temizle (birden fazla olabileceği için döngü)
    let onceki;
    do {
      onceki = s;
      s = s
        .replace(/\s*(kaçt[ıi]r|kaç|nedir|ne\s*kadard[ıi]r|ne\s*kadar|hesapla)\s*[?!.]*\s*$/i, '')
        .replace(/[?!.]+\s*$/, '')
        .trim();
    } while (s !== onceki);
    return s;
  }

  function sayiAl(sayilar, index) {
    const kayit = sayilar[index];
    if (!kayit) {
      throw new Error('Beklenen sayı bulunamadı.');
    }
    return kayit.deger;
  }

  /* ---------- SONUÇ BİÇİMLENDİRME ---------- */

  function sayiFormatla(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      return String(n);
    }
    if (Number.isInteger(n)) {
      return n.toString();
    }
    // en fazla 4 ondalık basamak, Türkçe virgülle
    const yuvarlak = Math.round(n * 10000) / 10000;
    return yuvarlak.toString().replace('.', ',');
  }

  /* ---------- KALIP TANIMLARI ----------
     Her kalıp: { id, tur, esle(metin, sayilar) -> [indeks,...]|null, hesapla(sayilar, indeksler) -> number|string }
  */

  function regexKalip(id, tur, desen, hesapla) {
    return {
      id: id,
      tur: tur,
      esle: function (metin) {
        const m = metin.match(desen);
        if (!m) return null;
        return m.slice(1).map(Number);
      },
      hesapla: hesapla
    };
  }


  /* ---------- KESİR SÖZCÜKLERİ ---------- */

  // Paydanın önce söylendiği Türkçe kesirler: "üçte biri", "beşte ikisi"...
  const KESIR_PAYDA = {
    'ikide': 2, 'üçte': 3, 'dörtte': 4, 'beşte': 5, 'altıda': 6, 'yedide': 7,
    'sekizde': 8, 'dokuzda': 9, 'onda': 10, 'onbirde': 11, 'onikide': 12,
    'onüçte': 13, 'ondörtte': 14, 'onbeşte': 15, 'onaltıda': 16,
    'onyedide': 17, 'onsekizde': 18, 'ondokuzda': 19, 'yirmide': 20
  };

  const KESIR_PAYDA_DESENI = Object.keys(KESIR_PAYDA)
    .sort((a, b) => b.length - a.length)
    .join('|');

  /* ---------- TERS İŞLEM YARDIMCILARI ---------- */

  function tersCarpma(sonuc, carpan) {
    if (carpan === 0) {
      throw new Error('Sıfırla çarpılan bir ifadenin başlangıç değeri tek başına belirlenemez.');
    }
    return HM.bol(sonuc, carpan);
  }

  function tersBolme(sonuc, bolen) {
    if (bolen === 0) {
      throw new Error('Sıfıra bölme ters işleminde kullanılamaz.');
    }
    return HM.carp(sonuc, bolen);
  }

  function tersYuzde(sonuc, yuzde) {
    if (yuzde === 0) {
      throw new Error('Yüzde 0 olduğunda başlangıç sayısı belirlenemez.');
    }
    return HM.bol(HM.carp(sonuc, 100), yuzde);
  }

  function tersYuzdeArtir(sonuc, yuzde) {
    const katsayi = 1 + yuzde / 100;
    if (katsayi === 0) {
      throw new Error('Bu yüzde değeri için başlangıç sayısı belirlenemez.');
    }
    return HM.bol(sonuc, katsayi);
  }

  function tersYuzdeAzalt(sonuc, yuzde) {
    const katsayi = 1 - yuzde / 100;
    if (katsayi === 0) {
      throw new Error('Yüzde 100 azaltılmış bir sayının başlangıç değeri belirlenemez.');
    }
    return HM.bol(sonuc, katsayi);
  }

  function tersKesir(sonuc, pay, payda) {
    if (pay === 0) {
      throw new Error('Pay 0 olduğunda başlangıç sayısı belirlenemez.');
    }
    return HM.bol(HM.carp(sonuc, payda), pay);
  }

  /* ---------- İLERİ YÖNLÜ İŞLEM ZİNCİRİ ----------
     Temel sayıdan başlayıp işlemleri soldan sağa uygular. Böylece
     "82nin 10 fazlasının yüzde ellisi" gibi ifadeler için her işlem
     kombinasyonunu ayrı bir regex olarak tanımlamak gerekmez.
  */

  const ORDINAL_US = {
    'birinci': 1, 'ikinci': 2, 'üçüncü': 3, 'dördüncü': 4, 'beşinci': 5,
    'altıncı': 6, 'yedinci': 7, 'sekizinci': 8, 'dokuzuncu': 9, 'onuncu': 10,
    'onbirinci': 11, 'onikinci': 12, 'onüçüncü': 13, 'ondördüncü': 14,
    'onbeşinci': 15, 'onaltıncı': 16, 'onyedinci': 17, 'onsekizinci': 18,
    'ondokuzuncu': 19, 'yirminci': 20
  };

  const KESIR_PAY_YAZI = {
    'biri': 1, 'birinin': 1,
    'ikisi': 2, 'ikisinin': 2,
    'üçü': 3, 'üçünün': 3,
    'dördü': 4, 'dördünün': 4,
    'beşi': 5, 'beşinin': 5,
    'altısı': 6, 'altısının': 6,
    'yedisi': 7, 'yedisinin': 7,
    'sekizi': 8, 'sekizinin': 8,
    'dokuzu': 9, 'dokuzunun': 9,
    'onu': 10, 'onunun': 10,
    'onbiri': 11, 'onbirinin': 11,
    'onikisi': 12, 'onikisinin': 12,
    'onüçü': 13, 'onüçünün': 13,
    'ondördü': 14, 'ondördünün': 14,
    'onbeşi': 15, 'onbeşinin': 15,
    'onaltısı': 16, 'onaltısının': 16,
    'onyedisi': 17, 'onyedisinin': 17,
    'onsekizi': 18, 'onsekizinin': 18,
    'ondokuzu': 19, 'ondokuzunun': 19,
    'yirmisi': 20, 'yirmisinin': 20
  };

  const KESIR_PAY_DESENI_ZINCIR = Object.keys(KESIR_PAY_YAZI)
    .sort((a, b) => b.length - a.length).join('|');

  function zincirHesapla(metin, sayilar) {
    const bas = metin.match(/^\{SAYI(\d+)\}/i);
    if (!bas) return null;

    let deger = sayiAl(sayilar, Number(bas[1]));
    let kalan = metin.slice(bas[0].length).trim();
    let islemSayisi = 0;

    function sonuc(deger) {
      return { tur: 'zincir', kalipId: 'zincir', sonuc: sayiFormatla(deger) };
    }

    while (kalan) {
      let m;

      // A + B / A - B / A × B
      m = kalan.match(/^\{SAYI(\d+)\}\s+fazla(?:s[ıi])?(?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?(?:\s+|$)/i);
      if (m) {
        deger = HM.topla(deger, sayiAl(sayilar, Number(m[1])));
        kalan = kalan.slice(m[0].length).trim(); islemSayisi++; continue;
      }
      m = kalan.match(/^\{SAYI(\d+)\}\s+(?:eksi(?:ği|si)|eksik)(?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?(?:\s+|$)/i);
      if (m) {
        deger = HM.cikar(deger, sayiAl(sayilar, Number(m[1])));
        kalan = kalan.slice(m[0].length).trim(); islemSayisi++; continue;
      }
      m = kalan.match(/^\{SAYI(\d+)\}\s+kat(?:[ıi])?(?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?(?:\s+|$)/i);
      if (m) {
        deger = HM.carp(deger, sayiAl(sayilar, Number(m[1])));
        kalan = kalan.slice(m[0].length).trim(); islemSayisi++; continue;
      }

      // Yüzde: değer, yüzde fazlası veya yüzde eksiği.
      m = kalan.match(/^y[uü]zde\s+\{SAYI(\d+)\}\s+fazla(?:s[ıi])?(?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?(?:\s+|$)/i);
      if (m) {
        deger = HM.yuzdeArtir(deger, sayiAl(sayilar, Number(m[1])));
        kalan = kalan.slice(m[0].length).trim(); islemSayisi++; continue;
      }
      m = kalan.match(/^y[uü]zde\s+\{SAYI(\d+)\}\s+(?:eksi(?:ği|si)|eksik)(?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?(?:\s+|$)/i);
      if (m) {
        deger = HM.yuzdeAzalt(deger, sayiAl(sayilar, Number(m[1])));
        kalan = kalan.slice(m[0].length).trim(); islemSayisi++; continue;
      }
      m = kalan.match(/^y[uü]zde\s+\{SAYI(\d+)\}(?:['’]?[ıi]s[ıi])?(?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?(?:\s+|$)/i);
      if (m) {
        deger = HM.yuzdeninDegeri(deger, sayiAl(sayilar, Number(m[1])));
        kalan = kalan.slice(m[0].length).trim(); islemSayisi++; continue;
      }

      // Yarım / çeyrek.
      m = kalan.match(/^yar[ıi]s[ıi](?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?(?:\s+|$)/i);
      if (m) {
        deger = HM.bol(deger, 2);
        kalan = kalan.slice(m[0].length).trim(); islemSayisi++; continue;
      }
      m = kalan.match(/^çeyreğ[ıi](?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?(?:\s+|$)/i);
      if (m) {
        deger = HM.bol(deger, 4);
        kalan = kalan.slice(m[0].length).trim(); islemSayisi++; continue;
      }

      // Yazıyla "üçte ikisi / beşte ikisinin".
      m = kalan.match(new RegExp('^(' + KESIR_PAYDA_DESENI + ')\\s+(' + KESIR_PAY_DESENI_ZINCIR + ')(?:\\s+|$)', 'i'));
      if (m) {
        const payda = KESIR_PAYDA[m[1].toLowerCase()];
        const pay = KESIR_PAY_YAZI[m[2].toLowerCase()];
        deger = HM.bol(HM.carp(deger, pay), payda);
        kalan = kalan.slice(m[0].length).trim(); islemSayisi++; continue;
      }

      // Sayısal "3'te 2'si / 3te 2si": ilk sayının eki paydadır.
      m = kalan.match(/^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}(?:\s+|$)/i);
      if (m) {
        const paydaKayit = sayilar[Number(m[1])];
        const payKayit = sayilar[Number(m[2])];
        if (paydaKayit && /(?:te|ta|de|da)$/i.test(paydaKayit.ek || '')) {
          deger = HM.bol(HM.carp(deger, payKayit.deger), paydaKayit.deger);
          kalan = kalan.slice(m[0].length).trim(); islemSayisi++; continue;
        }
      }

      // Kare / küp.
      m = kalan.match(/^karesi(?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?(?:\s+|$)/i);
      if (m) {
        deger = HM.us(deger, 2);
        kalan = kalan.slice(m[0].length).trim(); islemSayisi++; continue;
      }
      m = kalan.match(/^k[uü]p[uü](?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?(?:\s+|$)/i);
      if (m) {
        deger = HM.us(deger, 3);
        kalan = kalan.slice(m[0].length).trim(); islemSayisi++; continue;
      }

      // "ikinci/üçüncü/... kuvveti".
      const ordinalKeys = Object.keys(ORDINAL_US).sort((a, b) => b.length - a.length).join('|');
      m = kalan.match(new RegExp('^(' + ordinalKeys + ')\\s+kuvveti?(?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?(?:\\s+|$)', 'i'));
      if (m) {
        const us = ORDINAL_US[m[1].toLowerCase()];
        deger = HM.us(deger, us);
        kalan = kalan.slice(m[0].length).trim(); islemSayisi++; continue;
      }

      // "{SAYI}. kuvveti" veya "{SAYI} kuvveti".
      m = kalan.match(/^\{SAYI(\d+)\}\.?(?:\s+)kuvveti?(?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?(?:\s+|$)/i);
      if (m) {
        deger = HM.us(deger, sayiAl(sayilar, Number(m[1])));
        kalan = kalan.slice(m[0].length).trim(); islemSayisi++; continue;
      }

      // "üssü {SAYI}".
      m = kalan.match(/^[uü]ss[uü]\s+\{SAYI(\d+)\}(?:\s+|$)/i);
      if (m) {
        deger = HM.us(deger, sayiAl(sayilar, Number(m[1])));
        kalan = kalan.slice(m[0].length).trim(); islemSayisi++; continue;
      }

      // Zincirin bir parçası tanınmadıysa mevcut kalıplara bırak.
      return null;
    }

    return islemSayisi > 0 ? sonuc(deger) : null;
  }

  const KALIPLAR = [

    /* =========================================================
       TERS İŞLEMLER — SONUÇ VERİLİ, BAŞLANGIÇ SAYISI ARANIYOR
       ========================================================= */
    regexKalip('ters-zincir-yuzde', 'yuzde',
      /^yar[ıi]s[ıi]n[ıi]n\s+y[uü]zde\s+\{SAYI(\d+)\}\s+\{SAYI(\d+)\}$/i,
      (s, [p, sonuc]) => HM.carp(HM.bol(sayiAl(s, sonuc), sayiAl(s, p) / 100), 2)),

    regexKalip('ters-kat-zincir-yuzde', 'yuzde',
      /^\{SAYI(\d+)\}\s+kat[ıi]n[ıi]n\s+y[uü]zde\s+\{SAYI(\d+)\}\s+\{SAYI(\d+)\}$/i,
      (s, [kat, p, sonuc]) => HM.bol(HM.bol(HM.carp(sayiAl(s, sonuc), 100), sayiAl(s, p)), sayiAl(s, kat))),


    // "yüzde 25'i 50", "yüzde ellisi 50" -> başlangıç sayısı
    {
      id: 'ters-yuzde-temel',
      tur: 'yuzde',
      esle: function (metin, sayilar) {
        let m = metin.match(/^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?y[uü]zde\s+\{SAYI(\d+)\}\s+\{SAYI(\d+)\}$/i);
        if (m) return [Number(m[1]), Number(m[2])];

        // "yüzde yirmi beşi 50" gibi birleşik yazıyla yüzde.
        m = metin.match(/^y[uü]zde\s+\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+\{SAYI(\d+)\}$/i);
        if (!m) return null;
        const onlar = sayilar[Number(m[1])];
        const birler = sayilar[Number(m[2])];
        if (!onlar || !birler) return null;
        if (onlar.deger < 20 || onlar.deger > 90 || onlar.deger % 10 !== 0 || birler.deger < 1 || birler.deger > 9) {
          return null;
        }
        return [Number(m[1]), Number(m[2]), Number(m[3])];
      },
      hesapla: function (s, ix) {
        const yuzde = ix.length === 3
          ? sayiAl(s, ix[0]) + sayiAl(s, ix[1])
          : sayiAl(s, ix[0]);
        return tersYuzde(sayiAl(s, ix[ix.length - 1]), yuzde);
      }
    },

    regexKalip('ters-yuzde-fazlasi', 'yuzde',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?y[uü]zde\s+\{SAYI(\d+)\}\s+fazlas[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [p, sonuc]) => tersYuzdeArtir(sayiAl(s, sonuc), sayiAl(s, p))),

    regexKalip('ters-yuzde-eksigi', 'yuzde',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?y[uü]zde\s+\{SAYI(\d+)\}\s+eksi(?:ği|si)\s+\{SAYI(\d+)\}$/i,
      (s, [p, sonuc]) => tersYuzdeAzalt(sayiAl(s, sonuc), sayiAl(s, p))),

    regexKalip('ters-yarisi', 'kesir',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?yar[ıi]s[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [sonuc]) => tersBolme(sayiAl(s, sonuc), 2)),

    regexKalip('ters-ceyregi', 'kesir',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?çeyreğ[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [sonuc]) => tersBolme(sayiAl(s, sonuc), 4)),

    // "üçte ikisi 60", "beşte biri 60".
    {
      id: 'ters-kesir-payda-once-yazi',
      tur: 'kesir',
      esle: function (metin) {
        const desen = new RegExp(
          '^(?:\\{SAYI\\d+\\}\\s+say[ıi]n[ıi]n\\s+)?(' + KESIR_PAYDA_DESENI + ')\\s+\\{SAYI(\\d+)\\}\\s+\\{SAYI(\\d+)\\}$',
          'i'
        );
        const m = metin.match(desen);
        if (!m) return null;
        return [KESIR_PAYDA[m[1].toLowerCase()], Number(m[2]), Number(m[3])];
      },
      hesapla: function (s, [payda, pay, sonuc]) {
        return tersKesir(sayiAl(s, sonuc), sayiAl(s, pay), payda);
      }
    },

    // "5te 2si 60" / "5'te 2'si 60".
    {
      id: 'ters-kesir-payda-once-sayisal',
      tur: 'kesir',
      esle: function (metin, sayilar) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+\{SAYI(\d+)\}$/i);
        if (!m) return null;
        const payda = sayilar[Number(m[1])];
        const pay = sayilar[Number(m[2])];
        if (!payda || !pay) return null;
        if (!/(?:de|da|te|ta)$/i.test(payda.ek || '')) return null;
        if (!/(?:i|ı|u|ü|si|sı|su|sü)$/i.test(pay.ek || '')) return null;
        return [Number(m[1]), Number(m[2]), Number(m[3])];
      },
      hesapla: function (s, [payda, pay, sonuc]) {
        return tersKesir(sayiAl(s, sonuc), sayiAl(s, pay), sayiAl(s, payda));
      }
    },

    // "bir bölü beşi 60", "1 bölü 5'i 60".
    regexKalip('ters-kesir-bolu', 'kesir',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?\{SAYI(\d+)\}\s+b[oö]l[uü]\s+\{SAYI(\d+)\}\s+\{SAYI(\d+)\}$/i,
      (s, [pay, payda, sonuc]) => tersKesir(sayiAl(s, sonuc), sayiAl(s, pay), sayiAl(s, payda))),

    regexKalip('ters-fazlasi', 'dort_islem',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?\{SAYI(\d+)\}\s+fazlas[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [miktar, sonuc]) => HM.cikar(sayiAl(s, sonuc), sayiAl(s, miktar))),

    regexKalip('ters-eksigi', 'dort_islem',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?\{SAYI(\d+)\}\s+eksi(?:ği|si)\s+\{SAYI(\d+)\}$/i,
      (s, [miktar, sonuc]) => HM.topla(sayiAl(s, sonuc), sayiAl(s, miktar))),

    regexKalip('ters-kat', 'dort_islem',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?\{SAYI(\d+)\}\s+kat[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [kat, sonuc]) => tersCarpma(sayiAl(s, sonuc), sayiAl(s, kat))),

    regexKalip('ters-bolum', 'dort_islem',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?\{SAYI(\d+)\}\s+b[oö]l[uü]m[uü]\s+\{SAYI(\d+)\}$/i,
      (s, [bolen, sonuc]) => tersBolme(sayiAl(s, sonuc), sayiAl(s, bolen))),

    regexKalip('ters-kat-fazla', 'dort_islem',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?\{SAYI(\d+)\}\s+kat[ıi]n[ıi]n\s+\{SAYI(\d+)\}\s+fazlas[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [kat, miktar, sonuc]) => tersCarpma(HM.cikar(sayiAl(s, sonuc), sayiAl(s, miktar)), sayiAl(s, kat))),

    regexKalip('ters-kat-eksi', 'dort_islem',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?\{SAYI(\d+)\}\s+kat[ıi]n[ıi]n\s+\{SAYI(\d+)\}\s+eksi(?:ği|si)\s+\{SAYI(\d+)\}$/i,
      (s, [kat, miktar, sonuc]) => tersCarpma(HM.topla(sayiAl(s, sonuc), sayiAl(s, miktar)), sayiAl(s, kat))),

    regexKalip('ters-yarisi-fazla', 'kesir',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?yar[ıi]s[ıi]n[ıi]n\s+\{SAYI(\d+)\}\s+fazlas[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [miktar, sonuc]) => tersBolme(HM.cikar(sayiAl(s, sonuc), sayiAl(s, miktar)), 2)),

    regexKalip('ters-yarisi-eksi', 'kesir',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?yar[ıi]s[ıi]n[ıi]n\s+\{SAYI(\d+)\}\s+eksi(?:ği|si)\s+\{SAYI(\d+)\}$/i,
      (s, [miktar, sonuc]) => tersBolme(HM.topla(sayiAl(s, sonuc), sayiAl(s, miktar)), 2)),

    // "üçte ikisinin 10 fazlası 50", "beşte üçünün 5 eksiği 25".
    {
      id: 'ters-kesir-zincir-yazi',
      tur: 'kesir',
      esle: function (metin) {
        const paySozcukleri = {
          'biri': 1, 'birinin': 1,
          'ikisi': 2, 'ikisinin': 2,
          'üçü': 3, 'üçünün': 3,
          'dördü': 4, 'dördünün': 4,
          'beşi': 5, 'beşinin': 5,
          'altısı': 6, 'altısının': 6,
          'yedisi': 7, 'yedisinin': 7,
          'sekizi': 8, 'sekizinin': 8,
          'dokuzu': 9, 'dokuzunun': 9,
          'onu': 10, 'onunun': 10,
          'onbiri': 11, 'onbirinin': 11,
          'onikisi': 12, 'onikisinin': 12,
          'onüçü': 13, 'onüçünün': 13,
          'ondördü': 14, 'ondördünün': 14,
          'onbeşi': 15, 'onbeşinin': 15,
          'onaltısı': 16, 'onaltısının': 16,
          'onyedisi': 17, 'onyedisinin': 17,
          'onsekizi': 18, 'onsekizinin': 18,
          'ondokuzu': 19, 'ondokuzunun': 19,
          'yirmisi': 20, 'yirmisinin': 20
        };
        const payDeseni = Object.keys(paySozcukleri)
          .sort((a, b) => b.length - a.length)
          .join('|');
        const desen = new RegExp(
          '^(?:\\{SAYI\\d+\\}\\s+say[ıi]n[ıi]n\\s+)?(' + KESIR_PAYDA_DESENI + ')\\s+(' + payDeseni + ')\\s+(\\{SAYI\\d+\\})\\s+(fazlas[ıi]|eksi(?:ği|si))\\s+(\\{SAYI\\d+\\})$',
          'i'
        );
        const m = metin.match(desen);
        if (!m) return null;
        return [
          KESIR_PAYDA[m[1].toLowerCase()],
          paySozcukleri[m[2].toLowerCase()],
          Number(m[3].match(/\d+/)[0]),
          m[4].toLowerCase(),
          Number(m[5].match(/\d+/)[0])
        ];
      },
      hesapla: function (s, [payda, pay, miktar, islem, sonuc]) {
        const tersDislem = islem.indexOf('fazlas') === 0
          ? HM.cikar(sayiAl(s, sonuc), sayiAl(s, miktar))
          : HM.topla(sayiAl(s, sonuc), sayiAl(s, miktar));
        return tersKesir(tersDislem, pay, payda);
      }
    },

    /* ---- TERS ÜS / KÖK ---- */
    // Kare için iki gerçek çözüm olabileceğinden sonuç "±7" biçiminde verilir.
    regexKalip('ters-karesi', 'us_kok',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?karesi\s+\{SAYI(\d+)\}$/i,
      (s, [sonuc]) => {
        const n = sayiAl(s, sonuc);
        if (n < 0) throw new Error('Negatif bir sayının karesi gerçek sayılarda negatif olamaz.');
        const kok = Math.sqrt(n);
        return kok === 0 ? '0' : '±' + sayiFormatla(kok);
      }),

    regexKalip('ters-kupu', 'us_kok',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?k[uü]p[uü]\s+\{SAYI(\d+)\}$/i,
      (s, [sonuc]) => HM.kok(sayiAl(s, sonuc), 3)),

    regexKalip('ters-karekoku', 'us_kok',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?karek[oö]k[uü]\s+\{SAYI(\d+)\}$/i,
      (s, [sonuc]) => HM.us(sayiAl(s, sonuc), 2)),

    regexKalip('ters-kupkoku', 'us_kok',
      /^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?k[uü]pk[oö]k[uü]\s+\{SAYI(\d+)\}$/i,
      (s, [sonuc]) => HM.us(sayiAl(s, sonuc), 3)),

    /* ---- TERS FAKTÖRİYEL ---- */
    {
      id: 'ters-faktoriyel',
      tur: 'faktoriyel',
      esle: function (metin) {
        const m = metin.match(/^(?:\{SAYI\d+\}\s+say[ıi]n[ıi]n\s+)?fakt[oö]riyeli\s+\{SAYI(\d+)\}$/i);
        return m ? [Number(m[1])] : null;
      },
      hesapla: function (s, [sonuc]) {
        const hedef = sayiAl(s, sonuc);
        if (hedef < 1 || !Number.isInteger(hedef)) {
          throw new Error('Faktöriyel sonucu pozitif bir tam sayı olmalı.');
        }
        let f = 1;
        for (let n = 1; n <= 170; n++) {
          f *= n;
          if (f === hedef) return n;
          if (f > hedef) break;
        }
        throw new Error('Bu sayının tam sayı faktöriyeli bulunamadı.');
      }
    },

    /* ---- YÜZDE (özel biçimler önce, genel biçim en sonda) ---- */
    regexKalip('yuzde-artirilirsa', 'yuzde',
      /^\{SAYI(\d+)\}(?:\s+\S+)*?\s+y[uü]zde\s+\{SAYI(\d+)\}\s+art[ıi]r[ıi]l[ıi]rsa$/i,
      (s, [a, b]) => HM.yuzdeArtir(sayiAl(s, a), sayiAl(s, b))),

    regexKalip('yuzde-azaltilirsa', 'yuzde',
      /^\{SAYI(\d+)\}(?:\s+\S+)*?\s+y[uü]zde\s+\{SAYI(\d+)\}\s+azalt[ıi]l[ıi]rsa$/i,
      (s, [a, b]) => HM.yuzdeAzalt(sayiAl(s, a), sayiAl(s, b))),

    regexKalip('yuzde-fazlasi', 'yuzde',
      /^\{SAYI(\d+)\}(?:\s+\S+)*?\s+y[uü]zde\s+\{SAYI(\d+)\}\s+fazlas[ıi]$/i,
      (s, [a, b]) => HM.yuzdeArtir(sayiAl(s, a), sayiAl(s, b))),

    regexKalip('yuzde-eksigi', 'yuzde',
      /^\{SAYI(\d+)\}(?:\s+\S+)*?\s+y[uü]zde\s+\{SAYI(\d+)\}\s+eksi(?:ği|si)$/i,
      (s, [a, b]) => HM.yuzdeAzalt(sayiAl(s, a), sayiAl(s, b))),

    regexKalip('yuzde-temel', 'yuzde',
      /^\{SAYI(\d+)\}(?:\s+\S+)*?\s+y[uü]zde\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => HM.yuzdeninDegeri(sayiAl(s, a), sayiAl(s, b))),

    /* ---- YÜZDE İŞARETİYLE ("%" doğrudan sayıya bitişik, "yüzde" kelimesi yok) ---- */
    {
      id: 'yuzde-isaretli',
      tur: 'yuzde',
      esle: function (metin, sayilar) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}$/);
        if (!m) return null;
        const ikinciIndeks = Number(m[2]);
        if (sayilar[ikinciIndeks] && sayilar[ikinciIndeks].yuzdeIsaretiVar) {
          return [Number(m[1]), ikinciIndeks];
        }
        return null;
      },
      hesapla: (s, [a, b]) => HM.yuzdeninDegeri(sayiAl(s, a), sayiAl(s, b))
    },

    /* ---- BİLEŞİK: "A'nın B katının C eksiği/fazlası" ---- */
    regexKalip('bilesik-kat-eksi', 'dort_islem',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+kat[ıi](?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?\s+\{SAYI(\d+)\}\s+eksi(?:ği|si)$/i,
      (s, [a, b, c]) => HM.cikar(HM.carp(sayiAl(s, a), sayiAl(s, b)), sayiAl(s, c))),

    regexKalip('bilesik-kat-fazla', 'dort_islem',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+kat[ıi](?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?\s+\{SAYI(\d+)\}\s+fazlas[ıi]$/i,
      (s, [a, b, c]) => HM.topla(HM.carp(sayiAl(s, a), sayiAl(s, b)), sayiAl(s, c))),

    /* ---- BASİT: "A'nın B katı" (tek başına) ---- */
    regexKalip('kat-tek', 'dort_islem',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+kat[ıi](?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?$/i,
      (s, [a, b]) => HM.carp(sayiAl(s, a), sayiAl(s, b))),

    /* ---- BİLEŞİK: "A'nın B fazlasının/eksiğinin C katı" ---- */
    regexKalip('bilesik-fazla-kat', 'dort_islem',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+fazlas[ıi]n[ıi]n\s+\{SAYI(\d+)\}\s+kat[ıi](?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?$/i,
      (s, [a, b, c]) => HM.carp(HM.topla(sayiAl(s, a), sayiAl(s, b)), sayiAl(s, c))),

    regexKalip('bilesik-eksi-kat', 'dort_islem',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+eksi(?:ği|si)n[ıi]n\s+\{SAYI(\d+)\}\s+kat[ıi](?:n[ıi]n|n[uü]n|inin|ının|unun|ünün)?$/i,
      (s, [a, b, c]) => HM.carp(HM.cikar(sayiAl(s, a), sayiAl(s, b)), sayiAl(s, c))),

    /* ---- BASİT: "A'nın B fazlası/eksiği" ---- */
    regexKalip('basit-fazla', 'dort_islem',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+fazlas[ıi]$/i,
      (s, [a, b]) => HM.topla(sayiAl(s, a), sayiAl(s, b))),

    regexKalip('basit-eksi', 'dort_islem',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+eksi(?:ği|si)$/i,
      (s, [a, b]) => HM.cikar(sayiAl(s, a), sayiAl(s, b))),

    /* ---- DÖRT İŞLEM: SEMBOL ---- */
    regexKalip('carp-sembol', 'dort_islem', /^\{SAYI(\d+)\}\s*[x×*]\s*\{SAYI(\d+)\}$/i,
      (s, [a, b]) => HM.carp(sayiAl(s, a), sayiAl(s, b))),
    regexKalip('bol-sembol', 'dort_islem', /^\{SAYI(\d+)\}\s*[/÷]\s*\{SAYI(\d+)\}$/,
      (s, [a, b]) => HM.bol(sayiAl(s, a), sayiAl(s, b))),
    regexKalip('topla-sembol', 'dort_islem', /^\{SAYI(\d+)\}\s*\+\s*\{SAYI(\d+)\}$/,
      (s, [a, b]) => HM.topla(sayiAl(s, a), sayiAl(s, b))),
    regexKalip('cikar-sembol', 'dort_islem', /^\{SAYI(\d+)\}\s*-\s*\{SAYI(\d+)\}$/,
      (s, [a, b]) => HM.cikar(sayiAl(s, a), sayiAl(s, b))),

    /* ---- DÖRT İŞLEM: TÜRKÇE KELİME ---- */
    regexKalip('topla-kelime', 'dort_islem', /^\{SAYI(\d+)\}\s+art[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => HM.topla(sayiAl(s, a), sayiAl(s, b))),
    regexKalip('cikar-kelime', 'dort_islem', /^\{SAYI(\d+)\}\s+eksi\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => HM.cikar(sayiAl(s, a), sayiAl(s, b))),
    regexKalip('carp-kelime', 'dort_islem', /^\{SAYI(\d+)\}\s+[cç]arp[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => HM.carp(sayiAl(s, a), sayiAl(s, b))),
    regexKalip('bol-kelime', 'dort_islem', /^\{SAYI(\d+)\}\s+b[oö]l[uü]\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => HM.bol(sayiAl(s, a), sayiAl(s, b))),

    /* ---- KESİR / ORANLI PARÇA ---- */
    // "250'nin yarısı" -> 125
    regexKalip('yarisi', 'kesir',
      /^\{SAYI(\d+)\}\s+yar[ıi]s[ıi]$/i,
      (s, [a]) => HM.bol(sayiAl(s, a), 2)),

    regexKalip('ceyregi', 'kesir',
      /^\{SAYI(\d+)\}\s+çeyreğ[ıi]$/i,
      (s, [a]) => HM.bol(sayiAl(s, a), 4)),

    // "300'ün üçte biri", "300'ün beşte ikisi" vb.
    {
      id: 'kesir-payda-once-yazi',
      tur: 'kesir',
      esle: function (metin) {
        const desen = new RegExp(
          '^\\{SAYI(\\d+)\\}\\s+(' + KESIR_PAYDA_DESENI + ')\\s+\\{SAYI(\\d+)\\}$',
          'i'
        );
        const m = metin.match(desen);
        if (!m) return null;
        return [Number(m[1]), KESIR_PAYDA[m[2].toLowerCase()], Number(m[3])];
      },
      hesapla: function (s, [a, payda, pay]) {
        return HM.bol(HM.carp(sayiAl(s, a), sayiAl(s, pay)), payda);
      }
    },

    // "250'nin 1/2'si" ve kesmesiz "250nin 1/2si"
    regexKalip('kesir-cizgili', 'kesir',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s*\/\s*\{SAYI(\d+)\}$/i,
      (s, [a, b, c]) => HM.bol(HM.carp(sayiAl(s, a), sayiAl(s, b)), sayiAl(s, c))),

    // "250'nin 1 bölü 2'si" ve kesmesiz yazımlar
    regexKalip('kesir-bolu', 'kesir',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+b[oö]l[uü]\s+\{SAYI(\d+)\}$/i,
      (s, [a, b, c]) => HM.bol(HM.carp(sayiAl(s, a), sayiAl(s, b)), sayiAl(s, c))),

    /* ---- ÜS / KÖK ---- */
    regexKalip('karesi', 'us_kok', /^\{SAYI(\d+)\}\s+karesi$/i,
      (s, [a]) => HM.us(sayiAl(s, a), 2)),
    regexKalip('kupu', 'us_kok', /^\{SAYI(\d+)\}\s+k[uü]p[uü]$/i,
      (s, [a]) => HM.us(sayiAl(s, a), 3)),
    regexKalip('kuvveti', 'us_kok', /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+kuvveti$/i,
      (s, [a, b]) => HM.us(sayiAl(s, a), sayiAl(s, b))),
    regexKalip('karekoku', 'us_kok', /^\{SAYI(\d+)\}\s+karek[oö]k[uü]$/i,
      (s, [a]) => HM.kok(sayiAl(s, a), 2)),
    regexKalip('kupkoku', 'us_kok', /^\{SAYI(\d+)\}\s+k[uü]pk[oö]k[uü]$/i,
      (s, [a]) => HM.kok(sayiAl(s, a), 3)),

    /* ---- EBOB / EKOK ---- */
    regexKalip('ebob', 'sayi_teorisi',
      /^\{SAYI(\d+)\}(?:\s+ile)?\s+\{SAYI(\d+)\}(?:'?[a-zçğıöşü]*)?\s+ebob'?[a-zçğıöşü]*$/i,
      (s, [a, b]) => HM.ebob(sayiAl(s, a), sayiAl(s, b))),
    regexKalip('ekok', 'sayi_teorisi',
      /^\{SAYI(\d+)\}(?:\s+ile)?\s+\{SAYI(\d+)\}(?:'?[a-zçğıöşü]*)?\s+ekok[a-zçğıöşü]*$/i,
      (s, [a, b]) => HM.ekok(sayiAl(s, a), sayiAl(s, b))),

    /* ---- ASAL ÇARPANLAR / BÖLENLER / ASAL TESTİ ---- */
    regexKalip('asal-carpanlar', 'sayi_teorisi', /^\{SAYI(\d+)\}\s+asal\s+[cç]arpanlar[ıi]$/i,
      (s, [a]) => HM.asalCarpanlar(sayiAl(s, a)).join(' × ')),
    regexKalip('bolenler', 'sayi_teorisi', /^\{SAYI(\d+)\}\s+b[oö]lenleri$/i,
      (s, [a]) => HM.bolenler(sayiAl(s, a)).join(', ')),
    regexKalip('asal-testi', 'sayi_teorisi', /^\{SAYI(\d+)\}\s+asal\s+m[ıi]$/i,
      (s, [a]) => {
        const n = sayiAl(s, a);
        return HM.asalMi(n) ? (n + ' bir asal sayıdır.') : (n + ' bir asal sayı değildir.');
      }),

    /* ---- FAKTÖRİYEL: "6nın faktöriyeli" ---- */
    regexKalip('faktoriyel-iyelik', 'faktoriyel', /^\{SAYI(\d+)\}\s+fakt[oö]riyeli$/i,
      (s, [a]) => HM.faktoriyel(sayiAl(s, a))),

    /* ---- FAKTÖRİYEL ---- */
    regexKalip('faktoriyel', 'faktoriyel', /^\{SAYI(\d+)\}\s+fakt[oö]riyel$/i,
      (s, [a]) => HM.faktoriyel(sayiAl(s, a))),

    /* ---- ORAN ---- */
    // "4'e oranı 3" -> x / 4 = 3 -> x = 12
    regexKalip('ters-oran', 'oran', /^\{SAYI(\d+)\}\s+oran[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [payda, sonuc]) => HM.carp(sayiAl(s, payda), sayiAl(s, sonuc))),

    regexKalip('oran', 'oran', /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+oran[ıi]$/i,
      (s, [a, b]) => {
        const r = HM.oranSadelestir(sayiAl(s, a), sayiAl(s, b));
        return r.a + ':' + r.b;
      })
  ];

  /* ---------- YAKIN EŞLEŞME İPUÇLARI ---------- */

  const IPUCU_LISTESI = [
    { anahtar: /y[uü]zde/i, oneri: 'Yüzde hesaplama' },
    { anahtar: /ebob/i, oneri: 'EBOB hesaplama' },
    { anahtar: /ekok/i, oneri: 'EKOK hesaplama' },
    { anahtar: /kar[eeı]k[oö]k|k[uü]pk[oö]k|kök/i, oneri: 'Kök alma' },
    { anahtar: /kare|k[uü]p[uü]|kuvvet/i, oneri: 'Üs alma' },
    { anahtar: /fakt[oö]riyel/i, oneri: 'Faktöriyel hesaplama' },
    { anahtar: /asal/i, oneri: 'Asal çarpanlara ayırma / Asal sayı testi' },
    { anahtar: /b[oö]len/i, oneri: 'Bölenleri bulma' },
    { anahtar: /oran/i, oneri: 'Oran hesaplama' },
    { anahtar: /kat[ıi]|art[ıi]|eksi|[cç]arp[ıi]|b[oö]l[uü]/i, oneri: 'Dört işlem' }
  ];

  function yakinEslesmeOnerileri(metin) {
    const bulunanlar = [];
    IPUCU_LISTESI.forEach(function (ip) {
      if (ip.anahtar.test(metin) && bulunanlar.indexOf(ip.oneri) === -1) {
        bulunanlar.push(ip.oneri);
      }
    });
    return bulunanlar;
  }

  /* ---------- ANA GİRİŞ NOKTASI ---------- */

  /**
   * @param {string} girdiMetni Kullanıcının serbest metin girdisi
   * @returns {{
   *   basarili: boolean,
   *   tur: string,
   *   sonuc?: string,
   *   mesaj?: string,
   *   oneriler?: string[]
   * }}
   */
  function hesapla(girdiMetni) {
    if (typeof girdiMetni !== 'string' || girdiMetni.trim() === '') {
      return {
        basarili: false,
        tur: 'anlasilamadi',
        mesaj: 'Bir ifade yazmadınız. Lütfen ne hesaplamak istediğinizi yazın.'
      };
    }

    const normallesme = TRN.metniNormallestir(girdiMetni);
    const metin = sonEkleriTemizle(normallesme.normalizedText);
    const sayilar = normallesme.sayilar;

    // İleri yönlü zincirleri, eski tek-kalıp kurallarından önce çöz.
    // Böylece geniş bir yüzde regex'i zincirin bir bölümünü yanlış yorumlayamaz.
    try {
      const zincir = zincirHesapla(metin, sayilar);
      if (zincir) {
        return {
          basarili: true,
          tur: zincir.tur,
          kalipId: zincir.kalipId,
          sonuc: zincir.sonuc
        };
      }
    } catch (e) {
      return {
        basarili: false,
        tur: 'zincir',
        mesaj: e.message
      };
    }

    for (let i = 0; i < KALIPLAR.length; i++) {
      const kalip = KALIPLAR[i];
      const indeksler = kalip.esle(metin, sayilar);
      if (indeksler) {
        try {
          const ham = kalip.hesapla(sayilar, indeksler);
          const sonucMetni = (typeof ham === 'number') ? sayiFormatla(ham) : String(ham);
          return {
            basarili: true,
            tur: kalip.tur,
            kalipId: kalip.id,
            sonuc: sonucMetni
          };
        } catch (e) {
          return {
            basarili: false,
            tur: kalip.tur,
            mesaj: e.message
          };
        }
      }
    }

    // Hiçbir kalıp eşleşmedi
    if (sayilar.length === 0) {
      return {
        basarili: false,
        tur: 'anlasilamadi',
        mesaj: 'Bu ifadeyle hangi matematiksel işlemi yapmak istediğinizi anlayamadım.'
      };
    }

    const oneriler = yakinEslesmeOnerileri(metin);
    if (oneriler.length > 0) {
      return {
        basarili: false,
        tur: 'yakin_eslesme',
        mesaj: 'İfadenizi tam olarak anlayamadım. Şunlardan birini mi yapmak istiyorsunuz?',
        oneriler: oneriler
      };
    }

    return {
      basarili: false,
      tur: 'anlasilamadi',
      mesaj: 'Bu ifadeyle hangi matematiksel işlemi yapmak istediğinizi anlayamadım.'
    };
  }

  /* ---------- DIŞA AKTARIM ---------- */

  const HesapParser = {
    hesapla: hesapla,
    // test/inceleme amaçlı dışa açık yardımcılar
    _sonEkleriTemizle: sonEkleriTemizle,
    _kaliplar: KALIPLAR
  };

  global.HesapParser = HesapParser;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HesapParser;
  }

})(typeof window !== 'undefined' ? window : globalThis);
