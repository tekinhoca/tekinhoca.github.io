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
  const IM = global.IfadeMotoru;

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

  const TURKCE_SAYILAR = {
    sıfır:0, sifir:0, bir:1, iki:2, uc:3, üç:3, dort:4, dört:4, dördü:4,
    bes:5, beş:5, alti:6, altı:6, yedi:7, sekiz:8, dokuz:9, on:10,
    onbir:11, oniki:12, onuc:13, onüç:13, ondort:14, ondört:14,
    onbeş:15, onbes:15, onaltı:16, onalti:16, onyedi:17, onsekiz:18,
    ondokuz:19, yirmi:20, otuz:30, kirk:40, kırk:40, elli:50,
    altmis:60, altmış:60, yetmis:70, yetmiş:70, seksen:80, doksan:90,
    yüz:100, yuz:100, bin:1000
  };

  const BIRLER_SAYI = { bir:1, iki:2, uc:3, üç:3, dort:4, dört:4, bes:5, beş:5, alti:6, altı:6, yedi:7, sekiz:8, dokuz:9 };
  const ONLAR_SAYI = { on:10, yirmi:20, otuz:30, kirk:40, kırk:40, elli:50, altmis:60, altmış:60, yetmis:70, yetmiş:70, seksen:80, doksan:90 };

  function turkceSayiSozu(sozcuk) {
    let s = String(sozcuk).toLocaleLowerCase('tr-TR').trim();
    if (Object.prototype.hasOwnProperty.call(TURKCE_SAYILAR, s)) return TURKCE_SAYILAR[s];

    // Birleşik sayılar: "yirmi beş", "otuz iki" vb.
    const parcalar = s.split(/\s+/).filter(Boolean);
    if (parcalar.length === 2) {
      const onlar = ONLAR_SAYI[parcalar[0]];
      const birler = BIRLER_SAYI[parcalar[1]];
      if (onlar != null && birler != null) return onlar + birler;
    }

    // "onbir", "oniki", ... gibi bitişik 11-19 biçimleri.
    for (const bir of Object.keys(BIRLER_SAYI)) {
      if (s === 'on' + bir) return 10 + BIRLER_SAYI[bir];
    }

    // Kesir ve iyelik ifadelerinde sayı sözcüğü ek alabilir:
    // "ikisi", "üçü", "dördü", "beşi", "altısı" vb.
    const ekler = ['si','sı','su','sü','i','ı','u','ü'];
    for (const ek of ekler) {
      if (s.endsWith(ek) && s.length > ek.length) {
        const govde = s.slice(0, -ek.length);
        if (Object.prototype.hasOwnProperty.call(TURKCE_SAYILAR, govde)) {
          return TURKCE_SAYILAR[govde];
        }
      }
    }
    return null;
  }

  function turkceSiraSayisiSozu(sozcuk) {
    const s = String(sozcuk).toLocaleLowerCase('tr-TR').trim();
    const dogrudan = {
      birinci:1, ikinci:2, üçüncü:3, ucuncu:3, dördüncü:4, dorduncu:4,
      beşinci:5, besinci:5, altıncı:6, altinci:6, yedinci:7,
      sekizinci:8, dokuzuncu:9, onuncu:10, yirminci:20, otuzuncu:30,
      kırkıncı:40, kirkıncı:40, ellinci:50, altmışıncı:60, altıncı:6,
      yetmişinci:70, sekseninci:80, doksanıncı:90, yüzüncü:100, yuzuncu:100,
      bininci:1000
    };
    if (Object.prototype.hasOwnProperty.call(dogrudan, s)) return dogrudan[s];

    // "yirmi birinci", "otuz ikinci" vb. birleşik sıra sayıları.
    const parcalar = s.split(/\s+/).filter(Boolean);
    if (parcalar.length === 2) {
      const onlar = ONLAR_SAYI[parcalar[0]];
      const birler = turkceSiraSayisiSozu(parcalar[1]);
      if (onlar != null && birler != null && birler < 10) return onlar + birler;
    }

    // Sayısal sıra: "10uncu" / "10.uncu" gibi yaygın klavye biçimleri.
    const m = s.match(/^(\d+)\.?\s*(inci|ıncı|uncu|üncü)$/i);
    if (m) return Number(m[1]);
    return null;
  }

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

  const KALIPLAR = [

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

    // "yüzde 10 fazlası 550" -> 500
    regexKalip('yuzde-fazlasi-ters', 'yuzde',
      /^y[uü]zde\s+\{SAYI(\d+)\}\s+fazlas[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => {
        const oran = sayiAl(s, a);
        if (oran <= -100) throw new Error('Yüzde oranı -100 veya daha küçük olamaz.');
        return sayiAl(s, b) / (1 + oran / 100);
      }),

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

    /* ---- % İŞARETİYLE YÜZDE: EKLİ VE ZİNCİRLİ BİÇİMLER ---- */
    // Normalleştirmede % işareti sayı kaydında tutulur. Bu kurallar,
    // yüzde kelimesiyle yazılan karşılıkları bozmadan % biçimlerini
    // aynı matematiksel anlama bağlar.

    // "20'nin %50 fazlası" -> 30
    {
      id: 'yuzde-isaretli-fazlasi',
      tur: 'yuzde',
      esle: function (metin, sayilar) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+fazlas[ıi]$/i);
        if (!m) return null;
        const oran = sayilar[Number(m[2])];
        if (!oran || !oran.yuzdeIsaretiVar) return null;
        return [Number(m[1]), Number(m[2])];
      },
      hesapla: (s, [a, b]) => HM.yuzdeArtir(sayiAl(s, a), sayiAl(s, b))
    },

    // "%50 fazlası 30" -> 20
    {
      id: 'yuzde-isaretli-fazlasi-ters',
      tur: 'yuzde',
      esle: function (metin, sayilar) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+fazlas[ıi]\s+\{SAYI(\d+)\}$/i);
        if (!m) return null;
        const oran = sayilar[Number(m[1])];
        if (!oran || !oran.yuzdeIsaretiVar) return null;
        return [Number(m[1]), Number(m[2])];
      },
      hesapla: (s, [a, b]) => {
        const oran = sayiAl(s, a);
        if (oran <= -100) throw new Error('Yüzde oranı -100 veya daha küçük olamaz.');
        return sayiAl(s, b) / (1 + oran / 100);
      }
    },

    // "20'nin %50 eksiği" -> 10
    {
      id: 'yuzde-isaretli-eksigi',
      tur: 'yuzde',
      esle: function (metin, sayilar) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+eksi(?:ği|si)$/i);
        if (!m) return null;
        const oran = sayilar[Number(m[2])];
        if (!oran || !oran.yuzdeIsaretiVar) return null;
        return [Number(m[1]), Number(m[2])];
      },
      hesapla: (s, [a, b]) => HM.yuzdeAzalt(sayiAl(s, a), sayiAl(s, b))
    },

    // "%50 eksiği 10" -> 20
    {
      id: 'yuzde-isaretli-eksigi-ters',
      tur: 'yuzde',
      esle: function (metin, sayilar) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+eksi(?:ği|si)\s+\{SAYI(\d+)\}$/i);
        if (!m) return null;
        const oran = sayilar[Number(m[1])];
        if (!oran || !oran.yuzdeIsaretiVar) return null;
        return [Number(m[1]), Number(m[2])];
      },
      hesapla: (s, [a, b]) => {
        const oran = sayiAl(s, a);
        if (oran >= 100) throw new Error('Yüzde oranı 100 veya daha büyük olamaz.');
        return sayiAl(s, b) / (1 - oran / 100);
      }
    },

    // "%50'si 20" -> 40; "%60'ı 18" -> 30
    {
      id: 'yuzde-isaretli-ters',
      tur: 'yuzde',
      esle: function (metin, sayilar) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}$/i);
        if (!m) return null;
        const oran = sayilar[Number(m[1])];
        if (!oran || !oran.yuzdeIsaretiVar) return null;
        return [Number(m[1]), Number(m[2])];
      },
      hesapla: (s, [a, b]) => {
        const oran = sayiAl(s, a);
        if (oran === 0) throw new Error('Yüzde oranı sıfır olamaz.');
        return sayiAl(s, b) * 100 / oran;
      }
    },

    /* ---- YÜZDE / KESİR / KAT / DEĞİŞİM: PANEL ÖRNEKLERİ ---- */

    // "yüzde 25'i 30" -> 120
    regexKalip('yuzde-ters', 'yuzde',
      /^y[uü]zde\s+\{SAYI(\d+)\}\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => {
        const oran = sayiAl(s, a);
        if (oran === 0) throw new Error('Yüzde oranı sıfır olamaz.');
        return sayiAl(s, b) * 100 / oran;
      }),

    // "200'ün bir bölü dördü" -> 50
    // Yazıyla ifade edilen "pay bölü payda" biçimi.
    {
      id: 'kesir-bolu-sozcu',
      tur: 'kesir',
      esle: function (metin) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+([a-zçğıöşü]+)\s+b[oö]l[uü]\s+([a-zçğıöşü]+)$/i);
        if (!m) return null;
        const pay = turkceSayiSozu(m[2]);
        const payda = turkceSayiSozu(m[3]);
        if (pay == null || payda == null || payda === 0) return null;
        this._geciciKesir = { payda: payda, pay: pay };
        return [Number(m[1])];
      },
      hesapla: function (s, [a]) {
        const k = this._geciciKesir;
        return sayiAl(s, a) * k.pay / k.payda;
      }
    },

    // "bir bölü ikisi" / "üç bölü beşi" -> doğrudan kesir değeri
    {
      id: 'kesir-bolu-sozcu-yalin',
      tur: 'kesir',
      esle: function (metin) {
        const m = metin.match(/^([a-zçğıöşü]+)\s+b[oö]l[uü]\s+(bir|iki|üç|dört|dördü|beş|altı|yedi|sekiz|dokuz|on)(?:si|sı|su|sü|i|ı|u|ü)?$/i);
        if (!m) return null;
        const pay = turkceSayiSozu(m[1]);
        const payda = turkceSayiSozu(m[2]);
        if (pay == null || payda == null || payda === 0) return null;
        this._geciciKesir = { payda: payda, pay: pay };
        return [];
      },
      hesapla: function () {
        const k = this._geciciKesir;
        return k.pay / k.payda;
      }
    },

    // "bir bölü dördü 200" -> 800
    {
      id: 'kesir-bolu-sozcu-ters',
      tur: 'kesir',
      esle: function (metin) {
        const m = metin.match(/^([a-zçğıöşü]+)\s+b[oö]l[uü]\s+([a-zçğıöşü]+)\s+\{SAYI(\d+)\}$/i);
        if (!m) return null;
        const pay = turkceSayiSozu(m[1]);
        const payda = turkceSayiSozu(m[2]);
        if (pay == null || payda == null || pay === 0) return null;
        this._geciciKesir = { payda: payda, pay: pay };
        return [Number(m[3])];
      },
      hesapla: function (s, [a]) {
        const k = this._geciciKesir;
        return sayiAl(s, a) * k.payda / k.pay;
      }
    },

    // "200'ün 1 bölü 5'i" -> 40
    {
      id: 'kesir-bolu-sayi',
      tur: 'kesir',
      esle: function (metin, sayilar) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+b[oö]l[uü]\s+\{SAYI(\d+)\}$/i);
        if (!m) return null;
        const pay = sayiAl(sayilar, Number(m[2]));
        const payda = sayiAl(sayilar, Number(m[3]));
        if (payda === 0) return null;
        return [Number(m[1]), Number(m[2]), Number(m[3])];
      },
      hesapla: function (s, [a, b, c]) {
        return sayiAl(s, a) * sayiAl(s, b) / sayiAl(s, c);
      }
    },

    // "1 bölü 5'i 200" -> 1000
    {
      id: 'kesir-bolu-sayi-ters',
      tur: 'kesir',
      esle: function (metin, sayilar) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+b[oö]l[uü]\s+\{SAYI(\d+)\}\s+\{SAYI(\d+)\}$/i);
        if (!m) return null;
        const pay = sayiAl(sayilar, Number(m[1]));
        const payda = sayiAl(sayilar, Number(m[2]));
        if (pay === 0) return null;
        return [Number(m[1]), Number(m[2]), Number(m[3])];
      },
      hesapla: function (s, [a, b, c]) {
        return sayiAl(s, c) * sayiAl(s, b) / sayiAl(s, a);
      }
    },

    // "400'ün 5'te 2'si" / "400ün 5te 2si" -> 160
    // Sayısal payda/pay, normalleştirme sırasında yer tutuculara dönüşür;
    // ekler sayilar[] içindeki ek alanında korunur.
    {
      id: 'kesir-te-sayi',
      tur: 'kesir',
      esle: function (metin, sayilar) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+\{SAYI(\d+)\}$/i);
        if (!m) return null;
        const temel = Number(m[1]), payda = Number(m[2]), pay = Number(m[3]);
        const paydaEk = (sayilar[payda] && sayilar[payda].ek || '').toLocaleLowerCase('tr-TR');
        const payEk = (sayilar[pay] && sayilar[pay].ek || '').toLocaleLowerCase('tr-TR');
        if (!/^(te|ta|de|da)$/.test(paydaEk)) return null;
        if (!/^(si|sı|su|sü|i|ı|u|ü)$/.test(payEk)) return null;
        if (sayiAl(sayilar, payda) === 0) return null;
        return [temel, payda, pay];
      },
      hesapla: function (s, [a, b, c]) {
        return sayiAl(s, a) * sayiAl(s, c) / sayiAl(s, b);
      }
    },

    // "400'ün 5'te ikisi" -> 160
    {
      id: 'kesir-te-sozcu',
      tur: 'kesir',
      esle: function (metin, sayilar) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+(bir|iki|üç|dört|dördü|beş|altı|yedi|sekiz|dokuz|on)(?:si|sı|su|sü|i|ı|u|ü)?$/i);
        if (!m) return null;
        const temel = Number(m[1]), paydaIndex = Number(m[2]);
        const paydaEk = (sayilar[paydaIndex] && sayilar[paydaIndex].ek || '').toLocaleLowerCase('tr-TR');
        if (!/^(te|ta|de|da)$/.test(paydaEk)) return null;
        const pay = turkceSayiSozu(m[3]);
        const payda = sayiAl(sayilar, paydaIndex);
        if (pay == null || payda === 0) return null;
        this._geciciKesir = { payda: payda, pay: pay };
        return [temel];
      },
      hesapla: function (s, [a]) {
        const k = this._geciciKesir;
        return sayiAl(s, a) * k.pay / k.payda;
      }
    },

    // "300'ün beşte ikisi", "300'ün üçte biri" vb. -> kesir değeri
    {
      id: 'kesir-sozcu',
      tur: 'kesir',
      esle: function (metin) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+([a-zçğıöşü]+)te\s+(bir|iki|üç|dört|dördü|beş|altı|yedi|sekiz|dokuz|on)(?:si|sı|su|sü|i|ı|u|ü)?$/i);
        if (!m) return null;
        const payda = turkceSayiSozu(m[2]);
        const pay = turkceSayiSozu(m[3]);
        if (payda == null || pay == null || payda === 0) return null;
        this._geciciKesir = { payda: payda, pay: pay };
        return [Number(m[1])];
      },
      hesapla: function (s, [a]) {
        const k = this._geciciKesir;
        if (!k) throw new Error('Kesir ifadesi anlaşılamadı.');
        return sayiAl(s, a) * k.pay / k.payda;
      }
    },

    // "beşte ikisi 120", "üçte biri 60" vb. -> başlangıç sayısı
    {
      id: 'kesir-sozcu-ters',
      tur: 'kesir',
      esle: function (metin) {
        const m = metin.match(/^([a-zçğıöşü]+)te\s+(bir|iki|üç|dört|dördü|beş|altı|yedi|sekiz|dokuz|on)(?:si|sı|su|sü|i|ı|u|ü)?\s+\{SAYI(\d+)\}$/i);
        if (!m) return null;
        const payda = turkceSayiSozu(m[1]);
        const pay = turkceSayiSozu(m[2]);
        if (payda == null || pay == null || pay === 0) return null;
        this._geciciKesir = { payda: payda, pay: pay };
        return [Number(m[3])];
      },
      hesapla: function (s, [a]) {
        const k = this._geciciKesir;
        if (!k) throw new Error('Kesir ifadesi anlaşılamadı.');
        return sayiAl(s, a) * k.payda / k.pay;
      }
    },

    /* ---- YARIM / KESİRİN BASİT KALIPLARI ---- */

    // "45'in yarısı" -> 22,5
    regexKalip('yarisi', 'kesir',
      /^\{SAYI(\d+)\}\s+yar[ıi]s[ıi]$/i,
      (s, [a]) => sayiAl(s, a) / 2),

    // "yarısı 45" -> 90
    regexKalip('yarisi-ters', 'kesir',
      /^yar[ıi]s[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [a]) => sayiAl(s, a) * 2),

    /* ---- BASİT EKLEME / ÇIKARMA TERSLERİ ---- */

    // "35'in 15 eksiği" -> 20
    regexKalip('eksigi', 'dort_islem',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+eksi(?:ğ|g)i$/i,
      (s, [a, b]) => HM.cikar(sayiAl(s, a), sayiAl(s, b))),

    // "15 eksiği 35" -> 50
    regexKalip('eksigi-ters', 'dort_islem',
      /^\{SAYI(\d+)\}\s+eksi(?:ğ|g)i\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => HM.topla(sayiAl(s, a), sayiAl(s, b))),

    /* ---- BİLEŞİK: "A'nın yarısının B fazlası/eksiği" ---- */
    // "70'in yarısının 5 fazlası" -> 40
    regexKalip('bilesik-yarim-fazla', 'dort_islem',
      /^\{SAYI(\d+)\}\s+yar[ıi]s[ıi]n[ıi]n\s+\{SAYI(\d+)\}\s+fazlas[ıi]$/i,
      (s, [a, b]) => HM.topla(sayiAl(s, a) / 2, sayiAl(s, b))),

    // "70'in yarısının 5 eksiği" -> 30
    regexKalip('bilesik-yarim-eksi', 'dort_islem',
      /^\{SAYI(\d+)\}\s+yar[ıi]s[ıi]n[ıi]n\s+\{SAYI(\d+)\}\s+eksi(?:ğ|g)i$/i,
      (s, [a, b]) => HM.cikar(sayiAl(s, a) / 2, sayiAl(s, b))),

    // "yarısının 30 fazlası 70" -> 80
    regexKalip('bilesik-yarim-fazla-ters', 'dort_islem',
      /^yar[ıi]s[ıi]n[ıi]n\s+\{SAYI(\d+)\}\s+fazlas[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => HM.carp(HM.cikar(sayiAl(s, b), sayiAl(s, a)), 2)),

    // "yarısının 30 eksiği 70" -> 200
    regexKalip('bilesik-yarim-eksi-ters', 'dort_islem',
      /^yar[ıi]s[ıi]n[ıi]n\s+\{SAYI(\d+)\}\s+eksi(?:ğ|g)i\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => HM.carp(HM.topla(sayiAl(s, b), sayiAl(s, a)), 2)),

    // "75'in yarısının 8 katı" -> 300
    regexKalip('bilesik-yarim-kat', 'dort_islem',
      /^\{SAYI(\d+)\}\s+yar[ıi]s[ıi]n[ıi]n\s+\{SAYI(\d+)\}\s+kat[ıi]$/i,
      (s, [a, b]) => HM.carp(sayiAl(s, a) / 2, sayiAl(s, b))),

    /* ---- BİLEŞİK: "A'nın Cte B'sinin D fazlası/eksiği" ---- */
    // "70'in üçte ikisinin 5 fazlası" -> 51,666...
    {
      id: 'bilesik-kesir-fazla',
      tur: 'kesir',
      esle: function (metin) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+([a-zçğıöşü]+)te\s+(bir|iki|üç|dört|dördü|beş|altı|yedi|sekiz|dokuz|on)(?:si|sı|su|sü|i|ı|u|ü)?n[ıi]n\s+\{SAYI(\d+)\}\s+fazlas[ıi]$/i);
        if (!m) return null;
        const payda = turkceSayiSozu(m[2]);
        const pay = turkceSayiSozu(m[3]);
        if (payda == null || pay == null || payda === 0) return null;
        this._geciciKesir = { payda, pay };
        return [Number(m[1]), Number(m[4])];
      },
      hesapla: function (s, [a, b]) {
        const k = this._geciciKesir;
        return HM.topla(sayiAl(s, a) * k.pay / k.payda, sayiAl(s, b));
      }
    },

    {
      id: 'bilesik-kesir-eksi',
      tur: 'kesir',
      esle: function (metin) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+([a-zçğıöşü]+)te\s+(bir|iki|üç|dört|dördü|beş|altı|yedi|sekiz|dokuz|on)(?:si|sı|su|sü|i|ı|u|ü)?n[ıi]n\s+\{SAYI(\d+)\}\s+eksi(?:ğ|g)i$/i);
        if (!m) return null;
        const payda = turkceSayiSozu(m[2]);
        const pay = turkceSayiSozu(m[3]);
        if (payda == null || pay == null || payda === 0) return null;
        this._geciciKesir = { payda, pay };
        return [Number(m[1]), Number(m[4])];
      },
      hesapla: function (s, [a, b]) {
        const k = this._geciciKesir;
        return HM.cikar(sayiAl(s, a) * k.pay / k.payda, sayiAl(s, b));
      }
    },

    /* ---- BİLEŞİK: ters kesirli zincirler ---- */
    {
      id: 'bilesik-kesir-fazla-ters',
      tur: 'kesir',
      esle: function (metin) {
        const m = metin.match(/^([a-zçğıöşü]+)te\s+(bir|iki|üç|dört|dördü|beş|altı|yedi|sekiz|dokuz|on)(?:si|sı|su|sü|i|ı|u|ü)?n[ıi]n\s+\{SAYI(\d+)\}\s+fazlas[ıi]\s+\{SAYI(\d+)\}$/i);
        if (!m) return null;
        const payda = turkceSayiSozu(m[1]);
        const pay = turkceSayiSozu(m[2]);
        if (payda == null || pay == null || pay === 0) return null;
        this._geciciKesir = { payda, pay };
        return [Number(m[3]), Number(m[4])];
      },
      hesapla: function (s, [a, b]) {
        const k = this._geciciKesir;
        return (sayiAl(s, b) - sayiAl(s, a)) * k.payda / k.pay;
      }
    },

    {
      id: 'bilesik-kesir-eksi-ters',
      tur: 'kesir',
      esle: function (metin) {
        const m = metin.match(/^([a-zçğıöşü]+)te\s+(bir|iki|üç|dört|dördü|beş|altı|yedi|sekiz|dokuz|on)(?:si|sı|su|sü|i|ı|u|ü)?n[ıi]n\s+\{SAYI(\d+)\}\s+eksi(?:ğ|g)i\s+\{SAYI(\d+)\}$/i);
        if (!m) return null;
        const payda = turkceSayiSozu(m[1]);
        const pay = turkceSayiSozu(m[2]);
        if (payda == null || pay == null || pay === 0) return null;
        this._geciciKesir = { payda, pay };
        return [Number(m[3]), Number(m[4])];
      },
      hesapla: function (s, [a, b]) {
        const k = this._geciciKesir;
        return (sayiAl(s, b) + sayiAl(s, a)) * k.payda / k.pay;
      }
    },

    /* ---- BİLEŞİK: "A'nın B fazlasının/eksiğinin C katı/kesri" ---- */

    // "70'in 20 fazlasının beşte biri" -> 18
    // (70 + 20) × 1/5
    {
      id: 'bilesik-fazla-kesir',
      tur: 'kesir',
      esle: function (metin) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+fazlas[ıi]n[ıi]n\s+([a-zçğıöşü]+)te\s+(bir|iki|üç|dört|dördü|beş|altı|yedi|sekiz|dokuz|on)(?:si|sı|su|sü|i|ı|u|ü)?$/i);
        if (!m) return null;
        const payda = turkceSayiSozu(m[3]);
        const pay = turkceSayiSozu(m[4]);
        if (payda == null || pay == null || payda === 0) return null;
        this._geciciKesir = { payda, pay };
        return [Number(m[1]), Number(m[2])];
      },
      hesapla: function (s, [a, b]) {
        const k = this._geciciKesir;
        return (sayiAl(s, a) + sayiAl(s, b)) * k.pay / k.payda;
      }
    },

    // "20 fazlasının beşte biri 15" -> 55
    {
      id: 'bilesik-fazla-kesir-ters',
      tur: 'kesir',
      esle: function (metin) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+fazlas[ıi]n[ıi]n\s+([a-zçğıöşü]+)te\s+(bir|iki|üç|dört|dördü|beş|altı|yedi|sekiz|dokuz|on)(?:si|sı|su|sü|i|ı|u|ü)?\s+\{SAYI(\d+)\}$/i);
        if (!m) return null;
        const payda = turkceSayiSozu(m[2]);
        const pay = turkceSayiSozu(m[3]);
        if (payda == null || pay == null || pay === 0) return null;
        this._geciciKesir = { payda, pay };
        return [Number(m[1]), Number(m[4])];
      },
      hesapla: function (s, [a, b]) {
        const k = this._geciciKesir;
        return sayiAl(s, b) * k.payda / k.pay - sayiAl(s, a);
      }
    },

    // "80'in 20 fazlasının 2 katı" -> 200
    regexKalip('bilesik-fazla-kat', 'dort_islem',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+fazlas[ıi]n[ıi]n\s+\{SAYI(\d+)\}\s+kat[ıi]$/i,
      (s, [a, b, c]) => HM.carp(HM.topla(sayiAl(s, a), sayiAl(s, b)), sayiAl(s, c))),

    // "20 fazlasının 2 katı 70" -> 15
    regexKalip('bilesik-fazla-kat-ters', 'dort_islem',
      /^\{SAYI(\d+)\}\s+fazlas[ıi]n[ıi]n\s+\{SAYI(\d+)\}\s+kat[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [a, b, c]) => HM.bol(sayiAl(s, c), sayiAl(s, b)) - sayiAl(s, a)),

    // Aynı yapının "eksiği" biçimleri de desteklenir.
    regexKalip('bilesik-eksi-kat', 'dort_islem',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+eksi(?:ğ|g)inin\s+\{SAYI(\d+)\}\s+kat[ıi]$/i,
      (s, [a, b, c]) => HM.carp(HM.cikar(sayiAl(s, a), sayiAl(s, b)), sayiAl(s, c))),

    // "3 katı 75" -> 25
    regexKalip('kat-ters', 'dort_islem',
      /^\{SAYI(\d+)\}\s+kat[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => HM.bol(sayiAl(s, b), sayiAl(s, a))),

    // "120'nin 15 fazlası" -> 135
    regexKalip('fazlasi', 'dort_islem',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+fazlas[ıi]$/i,
      (s, [a, b]) => HM.topla(sayiAl(s, a), sayiAl(s, b))),

    // "15 fazlası 135" -> 120
    regexKalip('fazlasi-ters', 'dort_islem',
      /^\{SAYI(\d+)\}\s+fazlas[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => HM.cikar(sayiAl(s, b), sayiAl(s, a))),

    // "4'e oranı 3" -> 12
    regexKalip('oran-ters', 'oran',
      /^\{SAYI(\d+)\}\s+oran[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => HM.carp(sayiAl(s, a), sayiAl(s, b))),

    // "3 katının 20 eksiği 355" -> 125
    regexKalip('bilesik-kat-eksi-ters', 'dort_islem',
      /^\{SAYI(\d+)\}\s+kat[ıi]n[ıi]n\s+\{SAYI(\d+)\}\s+eksi(?:ğ|g)i\s+\{SAYI(\d+)\}$/i,
      (s, [a, b, c]) => HM.bol(HM.topla(sayiAl(s, c), sayiAl(s, b)), sayiAl(s, a))),

    // "2 katının 3 fazlası 23" -> 10
    regexKalip('kat-fazla-ters', 'dort_islem',
      /^\{SAYI(\d+)\}\s+kat[ıi]n[ıi]n\s+\{SAYI(\d+)\}\s+fazlas[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [a, b, c]) => HM.bol(HM.cikar(sayiAl(s, c), sayiAl(s, b)), sayiAl(s, a))),

    // "karekökü 12" -> 144
    regexKalip('karekoku-ters', 'us_kok',
      /^karek[oö]k[uü]\s+\{SAYI(\d+)\}$/i,
      (s, [a]) => HM.us(sayiAl(s, a), 2)),

    /* ---- "KAÇ" İÇEREN TERS / KARŞILAŞTIRMALI SORGULAR ---- */

    // "30, 120'nin kaçta kaçı?" -> 1/4
    regexKalip('kacta-kaci', 'kesir',
      /^\{SAYI(\d+)\}\s*,?\s*\{SAYI(\d+)\}\s+ka[cç]ta\s+ka[cç][ıi]$/i,
      (s, [a, b]) => {
        const r = HM.oranSadelestir(sayiAl(s, a), sayiAl(s, b));
        return r.a + '/' + r.b;
      }),

    // "120'nin kaçta kaçı 30?" -> 1/4
    regexKalip('kacta-kaci-ters', 'kesir',
      /^\{SAYI(\d+)\}\s+ka[cç]ta\s+ka[cç][ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => {
        const r = HM.oranSadelestir(sayiAl(s, b), sayiAl(s, a));
        return r.a + '/' + r.b;
      }),

    // "120'nin kaçta biri 30?" -> 1/4
    regexKalip('kacta-biri', 'kesir',
      /^\{SAYI(\d+)\}\s+ka[cç]ta\s+bir[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => {
        const oran = sayiAl(s, b) / sayiAl(s, a);
        if (oran <= 0) throw new Error('Geçerli bir pozitif kesir elde edilemedi.');
        const r = HM.oranSadelestir(sayiAl(s, b), sayiAl(s, a));
        return r.a + '/' + r.b;
      }),

    // "30, 120'nin yüzde kaçı?" -> %25
    regexKalip('yuzde-kaci', 'yuzde',
      /^\{SAYI(\d+)\}\s*,?\s*\{SAYI(\d+)\}\s+y[uü]zde\s+ka[cç][ıi]$/i,
      (s, [a, b]) => {
        const temel = sayiAl(s, b);
        if (temel === 0) throw new Error('Sıfırın yüzde kaçı hesaplanamaz.');
        return '%' + sayiFormatla(sayiAl(s, a) / temel * 100);
      }),

    // "120'nin yüzde kaçı 30?" -> %25
    regexKalip('yuzde-kaci-ters', 'yuzde',
      /^\{SAYI(\d+)\}\s+y[uü]zde\s+ka[cç][ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => {
        const temel = sayiAl(s, a);
        if (temel === 0) throw new Error('Sıfırın yüzde kaçı hesaplanamaz.');
        return '%' + sayiFormatla(sayiAl(s, b) / temel * 100);
      }),

    // "120, 30'un kaç katı?" -> 4
    regexKalip('kac-kati', 'dort_islem',
      /^\{SAYI(\d+)\}\s*,?\s*\{SAYI(\d+)\}\s+ka[cç]\s+kat[ıi]$/i,
      (s, [a, b]) => HM.bol(sayiAl(s, a), sayiAl(s, b))),

    // "30'un kaç katı 120?" -> 4
    regexKalip('kac-kati-ters', 'dort_islem',
      /^\{SAYI(\d+)\}\s+ka[cç]\s+kat[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => HM.bol(sayiAl(s, b), sayiAl(s, a))),

    // "20, 15'in kaç fazlası?" / "15'in kaç fazlası 20?" -> 5
    regexKalip('kac-fazlasi', 'dort_islem',
      /^\{SAYI(\d+)\}\s*,?\s*\{SAYI(\d+)\}\s+ka[cç]\s+fazlas[ıi]$/i,
      (s, [a, b]) => {
        const fark = sayiAl(s, a) - sayiAl(s, b);
        if (fark < 0) throw new Error('İlk sayı ikinci sayıdan büyük olmalı.');
        return fark;
      }),

    regexKalip('kac-fazlasi-ters', 'dort_islem',
      /^\{SAYI(\d+)\}\s+ka[cç]\s+fazlas[ıi]\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => {
        const fark = sayiAl(s, b) - sayiAl(s, a);
        if (fark < 0) throw new Error('Son sayı ilk sayıdan büyük olmalı.');
        return fark;
      }),

    // "20, 25'in kaç eksiği?" / "25'in kaç eksiği 20?" -> 5
    regexKalip('kac-eksigi', 'dort_islem',
      /^\{SAYI(\d+)\}\s*,?\s*\{SAYI(\d+)\}\s+ka[cç]\s+eksi(?:ğ|g)i$/i,
      (s, [a, b]) => {
        const fark = sayiAl(s, b) - sayiAl(s, a);
        if (fark < 0) throw new Error('İlk sayı ikinci sayıdan küçük olmalı.');
        return fark;
      }),

    regexKalip('kac-eksigi-ters', 'dort_islem',
      /^\{SAYI(\d+)\}\s+ka[cç]\s+eksi(?:ğ|g)i\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => {
        const fark = sayiAl(s, a) - sayiAl(s, b);
        if (fark < 0) throw new Error('İlk sayı son sayıdan büyük olmalı.');
        return fark;
      }),

    // "120, 100'ün yüzde kaç fazlası?" -> %20
    regexKalip('yuzde-kac-fazlasi', 'yuzde',
      /^\{SAYI(\d+)\}\s*,?\s*\{SAYI(\d+)\}\s+y[uü]zde\s+ka[cç]\s+fazlas[ıi]$/i,
      (s, [a, b]) => {
        const temel = sayiAl(s, b);
        if (temel === 0) throw new Error('Sıfıra göre yüzde artışı hesaplanamaz.');
        const fark = sayiAl(s, a) - temel;
        if (fark < 0) throw new Error('İlk sayı ikinci sayıdan büyük olmalı.');
        return '%' + sayiFormatla(fark / temel * 100);
      }),

    // "80, 100'ün yüzde kaç eksiği?" -> %20
    regexKalip('yuzde-kac-eksigi-direkt', 'yuzde',
      /^\{SAYI(\d+)\}\s*,?\s*\{SAYI(\d+)\}\s+y[uü]zde\s+ka[cç]\s+eksi(?:ğ|g)i$/i,
      (s, [a, b]) => {
        const temel = sayiAl(s, b);
        if (temel === 0) throw new Error('Sıfıra göre yüzde azalışı hesaplanamaz.');
        const fark = temel - sayiAl(s, a);
        if (fark < 0) throw new Error('İlk sayı ikinci sayıdan küçük olmalı.');
        return '%' + sayiFormatla(fark / temel * 100);
      }),

    // "100'ün yüzde kaç eksiği 80?" -> %20
    regexKalip('yuzde-kac-eksigi', 'yuzde',
      /^\{SAYI(\d+)\}\s+y[uü]zde\s+ka[cç]\s+eksi(?:ğ|g)i\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => {
        const temel = sayiAl(s, a);
        if (temel === 0) throw new Error('Sıfıra göre yüzde azalışı hesaplanamaz.');
        const fark = temel - sayiAl(s, b);
        if (fark < 0) throw new Error('Sonuç ilk sayıdan küçük olmalı.');
        return '%' + sayiFormatla(fark / temel * 100);
      }),

    // "80'i 100 yapmak için kaç artırmalı?" -> 20
    regexKalip('kac-artirmali', 'dort_islem',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+yapmak\s+i[cç]in\s+ka[cç]\s+art[ıi]rmal[ıi]$/i,
      (s, [a, b]) => {
        const fark = sayiAl(s, b) - sayiAl(s, a);
        if (fark < 0) throw new Error('Hedef sayı başlangıç sayısından büyük olmalı.');
        return fark;
      }),

    // "100'ü 80 yapmak için kaç azaltmalı?" -> 20
    regexKalip('kac-azaltmali', 'dort_islem',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+yapmak\s+i[cç]in\s+ka[cç]\s+azaltmal[ıi]$/i,
      (s, [a, b]) => {
        const fark = sayiAl(s, a) - sayiAl(s, b);
        if (fark < 0) throw new Error('Hedef sayı başlangıç sayısından küçük olmalı.');
        return fark;
      }),

    // "80'i 100 yapmak için yüzde kaç artırmalı?" -> %25
    regexKalip('yuzde-kac-artirmali', 'yuzde',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+yapmak\s+i[cç]in\s+y[uü]zde\s+ka[cç]\s+art[ıi]rmal[ıi]$/i,
      (s, [a, b]) => {
        const baslangic = sayiAl(s, a);
        if (baslangic === 0) throw new Error('Sıfırdan yüzde artışı hesaplanamaz.');
        const fark = sayiAl(s, b) - baslangic;
        if (fark < 0) throw new Error('Hedef sayı başlangıç sayısından büyük olmalı.');
        return '%' + sayiFormatla(fark / baslangic * 100);
      }),

    // "100'ü 80 yapmak için yüzde kaç azaltmalı?" -> %20
    regexKalip('yuzde-kac-azaltmali', 'yuzde',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+yapmak\s+i[cç]in\s+y[uü]zde\s+ka[cç]\s+azaltmal[ıi]$/i,
      (s, [a, b]) => {
        const baslangic = sayiAl(s, a);
        if (baslangic === 0) throw new Error('Sıfırdan yüzde azalışı hesaplanamaz.');
        const fark = baslangic - sayiAl(s, b);
        if (fark < 0) throw new Error('Hedef sayı başlangıç sayısından küçük olmalı.');
        return '%' + sayiFormatla(fark / baslangic * 100);
      }),

    // "25'e kaç eklersek 40 olur?" -> 15
    regexKalip('kac-eklersek', 'dort_islem',
      /^\{SAYI(\d+)\}\s+ka[cç]\s+eklersek\s+\{SAYI(\d+)\}\s+olur$/i,
      (s, [a, b]) => HM.cikar(sayiAl(s, b), sayiAl(s, a))),

    // "40'tan kaç çıkarırsak 25 kalır?" -> 15
    regexKalip('kac-cikarirsak', 'dort_islem',
      /^\{SAYI(\d+)\}\s+ka[cç]\s+[cç][ıi]kar[ıi]rsak\s+\{SAYI(\d+)\}\s+kal[ıi]r$/i,
      (s, [a, b]) => HM.cikar(sayiAl(s, a), sayiAl(s, b))),

    // "8'i kaçla çarparsak 56 olur?" -> 7
    regexKalip('kacla-carp', 'dort_islem',
      /^\{SAYI(\d+)\}\s+ka[cç]la\s+[cç]arparsak\s+\{SAYI(\d+)\}\s+olur$/i,
      (s, [a, b]) => HM.bol(sayiAl(s, b), sayiAl(s, a))),

    // "56'yı kaça bölersek 8 olur?" -> 7
    regexKalip('kaca-bol', 'dort_islem',
      /^\{SAYI(\d+)\}\s+ka[cç]a\s+b[oö]lersek\s+\{SAYI(\d+)\}\s+olur$/i,
      (s, [a, b]) => HM.bol(sayiAl(s, a), sayiAl(s, b))),

    /* ---- BİLEŞİK: "A'nın B katının C eksiği/fazlası" ---- */
    regexKalip('bilesik-kat-eksi', 'dort_islem',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+kat[ıi](?:n[ıi]n)?\s+\{SAYI(\d+)\}\s+eksi(?:ği|si)$/i,
      (s, [a, b, c]) => HM.cikar(HM.carp(sayiAl(s, a), sayiAl(s, b)), sayiAl(s, c))),

    regexKalip('bilesik-kat-fazla', 'dort_islem',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+kat[ıi](?:n[ıi]n)?\s+\{SAYI(\d+)\}\s+fazlas[ıi]$/i,
      (s, [a, b, c]) => HM.topla(HM.carp(sayiAl(s, a), sayiAl(s, b)), sayiAl(s, c))),

    /* ---- BASİT: "A'nın B katı" (tek başına) ---- */
    regexKalip('kat-tek', 'dort_islem',
      /^\{SAYI(\d+)\}\s+\{SAYI(\d+)\}\s+kat[ıi](?:n[ıi]n)?$/i,
      (s, [a, b]) => HM.carp(sayiAl(s, a), sayiAl(s, b))),

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

    /* ---- ÜS / KÖK ---- */
    // "5'in ikinci kuvveti" / "5'in onuncu kuvveti"
    {
      id: 'kuvveti-ordinal', tur: 'us_kok',
      esle: function (metin) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+([a-zçğıöşü]+(?:\s+[a-zçğıöşü]+)?)\s+kuvveti$/i);
        if (!m) return null;
        const ussu = turkceSiraSayisiSozu(m[2]);
        if (ussu == null) return null;
        this._geciciUs = ussu;
        return [Number(m[1])];
      },
      hesapla: function (s, [a]) { return HM.us(sayiAl(s, a), this._geciciUs); }
    },
    // "5 üssü 2" / "5 üssü iki"
    {
      id: 'ussu', tur: 'us_kok',
      esle: function (metin, sayilar) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+üssü\s+(.+)$/i);
        if (!m) return null;
        const ussu = /^\{SAYI(\d+)\}$/.test(m[2])
          ? sayiAl(sayilar, Number(m[2].match(/\d+/)[0]))
          : turkceSayiSozu(m[2]);
        if (ussu == null) return null;
        this._geciciUs = ussu;
        return [Number(m[1])];
      },
      hesapla: function (s, [a]) { return HM.us(sayiAl(s, a), this._geciciUs); }
    },
    // "karesi 25" / "ikinci kuvveti 25"
    {
      id: 'kuvveti-ters', tur: 'us_kok',
      esle: function (metin) {
        const m = metin.match(/^(.+?)\s+kuvveti\s+\{SAYI(\d+)\}$/i);
        if (!m) return null;
        const ussu = turkceSiraSayisiSozu(m[1]);
        if (ussu == null) return null;
        this._geciciUs = ussu;
        return [Number(m[2])];
      },
      hesapla: function (s, [a]) { return HM.kok(sayiAl(s, a), this._geciciUs); }
    },
    regexKalip('karesi', 'us_kok', /^\{SAYI(\d+)\}\s+karesi$/i,
      (s, [a]) => HM.us(sayiAl(s, a), 2)),
    regexKalip('kupu', 'us_kok', /^\{SAYI(\d+)\}\s+k[uü]p[uü]$/i,
      (s, [a]) => HM.us(sayiAl(s, a), 3)),
    regexKalip('karesi-ters', 'us_kok', /^karesi\s+\{SAYI(\d+)\}$/i,
      (s, [a]) => HM.kok(sayiAl(s, a), 2)),
    regexKalip('kupu-ters', 'us_kok', /^k[uü]p[uü]\s+\{SAYI(\d+)\}$/i,
      (s, [a]) => HM.kok(sayiAl(s, a), 3)),
    regexKalip('karekoku', 'us_kok', /^\{SAYI(\d+)\}\s+karek[oö]k[uü]$/i,
      (s, [a]) => HM.kok(sayiAl(s, a), 2)),
    regexKalip('koku', 'us_kok', /^\{SAYI(\d+)\}\s+k[oö]k[uü]$/i,
      (s, [a]) => HM.kok(sayiAl(s, a), 2)),
    regexKalip('karekoku-ters-kisa', 'us_kok', /^k[oö]k[uü]\s+\{SAYI(\d+)\}$/i,
      (s, [a]) => HM.us(sayiAl(s, a), 2)),
    regexKalip('karekoku-ters-kok', 'us_kok', /^k[oö]k\s+\{SAYI(\d+)\}$/i,
      (s, [a]) => HM.kok(sayiAl(s, a), 2)),
    regexKalip('karekoku-ters-esdeger', 'us_kok', /^karek[oö]k\s+\{SAYI(\d+)\}$/i,
      (s, [a]) => HM.kok(sayiAl(s, a), 2)),
    regexKalip('kupkoku', 'us_kok', /^\{SAYI(\d+)\}\s+k[uü]pk[oö]k[uü]$/i,
      (s, [a]) => HM.kok(sayiAl(s, a), 3)),
    regexKalip('karekoku-ters', 'us_kok', /^karek[oö]k[uü]\s+\{SAYI(\d+)\}$/i,
      (s, [a]) => HM.us(sayiAl(s, a), 2)),

    /* ---- EBOB / EKOK ---- */
    regexKalip('ebob', 'sayi_teorisi',
      /^\{SAYI(\d+)\}(?:\s+ile)?\s+\{SAYI(\d+)\}(?:'?[a-zçğıöşü]*)?\s+ebob'?[a-zçğıöşü]*$/i,
      (s, [a, b]) => HM.ebob(sayiAl(s, a), sayiAl(s, b))),
    regexKalip('ekok', 'sayi_teorisi',
      /^\{SAYI(\d+)\}(?:\s+ile)?\s+\{SAYI(\d+)\}(?:'?[a-zçğıöşü]*)?\s+ekok'?[a-zçğıöşü]*$/i,
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

    /* ---- FAKTÖRİYEL ---- */
    regexKalip('faktoriyel', 'faktoriyel', /^\{SAYI(\d+)\}\s+fakt[oö]riyel$/i,
      (s, [a]) => HM.faktoriyel(sayiAl(s, a))),

    /* ---- ORAN ---- */
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

  /* ---------- BİLİMSEL FONKSİYON ALGILAMA ---------- */

  // Akıllı mod bu fonksiyonları henüz çözmez; ancak kullanıcının ne
  // istediğini tanıyıp Klasik Hesap Makinesi'ne yönlendirebilir.
  function bilimselFonksiyonIceriyorMu(girdi) {
    const s = String(girdi).trim();
    const desen = /(^|[^a-zçğıöşü])(asin|acos|atan|acot|sinh|cosh|tanh|coth|cot|sin|cos|tan|log|ln)(?=\s*(?:\d|\(|[.,]))/i;
    return desen.test(s);
  }

  /* ---------- DOĞRUDAN MATEMATİKSEL İFADE ---------- */

  // Akıllı modda doğal Türkçe kalıplarına ek olarak, denklem içermeyen
  // saf aritmetik ifadeleri de kabul ederiz:  (70+20)/2, 7!, 8 x 5,
  // 100:4 gibi. Burada x yalnızca çarpma işaretidir; denklem sözdizimi
  // (ör. 2x+5=17) özellikle kabul edilmez.
  function matematikselIfadeMi(girdi) {
    const s = String(girdi).trim();
    if (!s || !/\d/.test(s)) return false;
    if (/[=a-zçğıöşü]/i.test(s.replace(/[xX]/g, ''))) return false;
    if (!/[+\-*/^×÷:!%().,xX]/.test(s)) return false;
    return /^[0-9\s+\-*/^×÷:!%().,xX·]+$/.test(s);
  }

  function matematikselIfadeHesapla(girdi) {
    if (!IM || typeof IM.hesapla !== 'function') return null;
    return IM.hesapla(
      String(girdi)
        .replace(/·/g, '*')
        .replace(/:/g, '/')
        .replace(/[×xX]/g, '*')
        // Akıllı modda nokta çarpma işaretidir; ondalık sayılar Türkçe
        // gösterimle virgül kullanır.
        .replace(/\./g, '*')
    );
  }

  /* ---------- % İŞARETİNDEN SONRA YAZIYLA SAYI ---------- */

  // "%50'si yirmi" gibi girişlerde TR normalleştirme, yüzde işaretinin
  // kendisini korurken "yirmi" sözcüğünü genel metinde sayıya çevirmediği
  // için özel bir ön-normalleştirme gerekir. Yalnızca % işaretli bir ifadenin
  // hemen ardından gelen bir/iki sözcüklü sayıyı dönüştürür; diğer Türkçe
  // metne dokunmaz.
  function yuzdeIsaretindenSonraYaziSayiyiNormallestir(girdi) {
    const sayiSozleri = [
      'bir','iki','üç','uc','dört','dort','beş','bes','altı','alti','yedi','sekiz','dokuz','on',
      'on bir','onbir','on iki','oniki','on üç','onuc','onüç','on dört','ondort','ondört',
      'on beş','onbes','onaltı','on altı','onyedi','on yedi','onsekiz','on sekiz','ondokuz','on dokuz',
      'yirmi','otuz','kırk','kirk','elli','altmış','altmis','yetmiş','yetmis','seksen','doksan'
    ].sort((a,b)=>b.length-a.length);
    const govde = sayiSozleri
      .map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'))
      .join('|');
    const re = new RegExp(`(%\\s*\\d+(?:[.,]\\d+)?(?:['’]?[a-zçğıöşü]{0,6})?)\\s+(${govde})(?=$|[^a-zçğıöşü])`, 'gi');
    return String(girdi).replace(re, function(tam, yuzdeBolumu, yaziSayi) {
      const deger = turkceSayiSozu(yaziSayi);
      return deger == null ? tam : yuzdeBolumu + ' ' + deger;
    });
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

    if (bilimselFonksiyonIceriyorMu(girdiMetni)) {
      return {
        basarili: false,
        tur: 'bilimsel_fonksiyon',
        mesaj: "Bilimsel fonksiyon içeren ifadeleri Akıllı Hesap Makinesi henüz çözemiyor. Bu tür işlemleri Klasik Hesap Makinesi'ndeki bilimsel fonksiyonlarla hesaplayabilirsiniz."
      };
    }

    // Önce saf aritmetik ifadeyi dene. Başarısız olursa doğal dil parser'ına
    // geçilir; böylece mevcut Türkçe kalıplar aynı şekilde çalışmaya devam eder.
    if (matematikselIfadeMi(girdiMetni)) {
      try {
        const sonuc = matematikselIfadeHesapla(girdiMetni);
        return {
          basarili: true,
          tur: 'aritmetik_ifade',
          kalipId: 'aritmetik-ifade',
          sonuc: sayiFormatla(sonuc)
        };
      } catch (e) {
        return {
          basarili: false,
          tur: 'aritmetik_ifade',
          mesaj: e.message || 'Matematiksel ifade hesaplanamadı.'
        };
      }
    }

    const yuzdeYaziNormallestirilmis = yuzdeIsaretindenSonraYaziSayiyiNormallestir(girdiMetni);
    const normallesme = TRN.metniNormallestir(yuzdeYaziNormallestirilmis);
    const metin = sonEkleriTemizle(normallesme.normalizedText);
    const sayilar = normallesme.sayilar;

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
