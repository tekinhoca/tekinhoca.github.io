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

  const TURKCE_SAYILAR = { bir:1, iki:2, uc:3, üç:3, dort:4, dört:4, bes:5, beş:5, alti:6, altı:6, yedi:7, sekiz:8, dokuz:9, on:10 };
  function turkceSayiSozu(sozcuk) {
    return TURKCE_SAYILAR[String(sozcuk).toLocaleLowerCase('tr-TR')] ?? null;
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

    /* ---- YÜZDE / KESİR / KAT / DEĞİŞİM: PANEL ÖRNEKLERİ ---- */

    // "yüzde 25'i 30" -> 120
    regexKalip('yuzde-ters', 'yuzde',
      /^y[uü]zde\s+\{SAYI(\d+)\}\s+\{SAYI(\d+)\}$/i,
      (s, [a, b]) => {
        const oran = sayiAl(s, a);
        if (oran === 0) throw new Error('Yüzde oranı sıfır olamaz.');
        return sayiAl(s, b) * 100 / oran;
      }),

    // "300'ün beşte ikisi", "300'ün üçte biri" vb. -> kesir değeri
    {
      id: 'kesir-sozcu',
      tur: 'kesir',
      esle: function (metin) {
        const m = metin.match(/^\{SAYI(\d+)\}\s+([a-zçğıöşü]+)te\s+(bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on)(?:si|sı)$/i);
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
        const m = metin.match(/^([a-zçğıöşü]+)te\s+(bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on)(?:si|sı)\s+\{SAYI(\d+)\}$/i);
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
