/* =============================================================
   TR NORMALLEŞTİRME KATMANI (Aşama 2)
   =============================================================
   Bu dosya, kullanıcının serbest Türkçe girdisindeki SAYILARI ve
   onlara bitişik/kesmeli EKLERİ tanıyıp, geri kalan metni anahtar
   kelime eşleştirmesi (Aşama 3 — mini-parser) için sadeleştirir.

   NE YAPAR:
   - "120'nin", "120nin", "120 nin" gibi farklı yazımları aynı sayı
     (120) olarak tanır ve metinde {SAYI0}, {SAYI1}... yer tutucusuyla
     değiştirir; ekler ayrıca döndürülür.
   - "%25", "25'i", "144'ün" gibi yüzde/kesme işaretli sayıları da
     aynı mekanizmayla yakalar.
   - Türkçe ondalık biçimini yorumlar (bkz. ONDALIK BİÇİM KARARI).
   - Yazıyla yazılan temel ve birleşik Türkçe sayıları da tanır:
     "dört", "yirmi üç", "yüz", "yüz yirmi beş", "bin iki yüz" vb.
   - Sayı sözcüklerinin yaygın hâl/iyelik eklerini de tanır:
     "yirminin", "yüzün", "üçü", "dördü" vb.

   NE YAPMAZ:
   - Anahtar kelimeleri (yüzde, kat, eksik, EBOB, karekök vb.) tanımaz;
     bu iş Aşama 3'teki mini-parser'a aittir.
   - Kesir kalıplarındaki "beşte üçü", "üçte ikisi" gibi sözcükleri
     sayıya dönüştürmez; kesir parser'ının bu ifadeleri kendi kurallarıyla
     çözmesine izin verir.

   ONDALIK BİÇİM KARARI (bilinçli tasarım kararı — belgeye not edilmeli):
   - Virgül (,) HER ZAMAN ondalık ayırıcı sayılır (Türkçe standart).
   - Nokta (.) binlik ayırıcı olarak yorumlanır EĞER tam olarak
     3'erli gruplar hâlinde tekrarlanıyorsa (örn. "1.234", "12.345,67").
   - Aksi hâlde tek bir nokta ondalık ayırıcı olarak kabul edilir
     (örn. "12.5" -> 12.5). Bu, İngilizce/klavye alışkanlığıyla yazılan
     ondalıkları da kapsar. Belirsiz kalabilecek tek durum "1.234"
     biçimidir; bu her zaman binlik olarak yorumlanır (1234), ondalık
     olarak değil — çünkü Türkçe metinde ondalık her zaman virgülle yazılır
     kabul edilir.
   ============================================================= */

(function (global) {
  'use strict';

  /* ---------- SAYI DİZGİSİ ÇÖZÜMLEME ---------- */

  // "1.234,56" | "1.234" | "1234,56" | "12.5" | "1234" -> float
  function sayiCozumle(dizgi) {
    if (typeof dizgi !== 'string') {
      throw new Error('sayiCozumle bir metin bekler.');
    }
    const s = dizgi.trim();

    // Türkçe tam biçim: binlik nokta(lar) + isteğe bağlı ondalık virgül
    // örn: 1.234  |  12.345,67  |  1.234.567
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
      const [tamKisim, ondalikKisim] = s.split(',');
      const tamSayi = tamKisim.split('.').join('');
      return ondalikKisim !== undefined
        ? parseFloat(tamSayi + '.' + ondalikKisim)
        : parseFloat(tamSayi);
    }

    // Sadece virgül: ondalık ayırıcı olarak virgül
    if (/^\d+,\d+$/.test(s)) {
      return parseFloat(s.replace(',', '.'));
    }

    // Sadece nokta (binlik grup deseni tutmuyor): ondalık ayırıcı olarak nokta
    if (/^\d+\.\d+$/.test(s)) {
      return parseFloat(s);
    }

    // Düz tam sayı
    if (/^\d+$/.test(s)) {
      return parseInt(s, 10);
    }

    throw new Error('"' + dizgi + '" geçerli bir sayı biçiminde değil.');
  }

  /* ---------- YAZIYLA YAZILAN SAYILAR ---------- */

  const BIRLER = {
    sıfır: 0, sifir: 0, bir:1, iki:2, üç:3, uc:3, dört:4, dort:4, dörd:4,
    beş:5, bes:5, altı:6, alti:6, yedi:7, sekiz:8, dokuz:9
  };
  const ONLAR = {
    on:10, yirmi:20, otuz:30, kırk:40, kirk:40, elli:50,
    altmış:60, altmis:60, yetmiş:70, yetmis:70, seksen:80, doksan:90
  };

  const SAYI_EKLERI = [
    // Sayı sözcüklerinin iyelik biçimleri: "ellisinin", "yirmisinin" vb.
    'sinin', 'sının', 'sunun', 'sünün',
    'inin', 'ının', 'unun', 'ünün',
    'nin', 'nın', 'nun', 'nün',
    'yin', 'yın', 'yun', 'yün',
    'in', 'ın', 'un', 'ün',
    'ye', 'ya', 'yi', 'yı', 'yu', 'yü',
    'e', 'a', 'i', 'ı', 'u', 'ü',
    'si', 'sı', 'su', 'sü'
  ].sort((a, b) => b.length - a.length);

  // Kesir parser'ının kullandığı "beşte", "üçte", "ikide" vb.
  // yapılara dokunmamak için locative ekleri ayrı tutulur.
  const KESIR_LOKATIF_EKLERI = ['te', 'ta', 'de', 'da'];

  const BIRLER_ANAHTARLARI = Object.keys(BIRLER);
  const ONLAR_ANAHTARLARI = Object.keys(ONLAR);

  function sayiSozcuguMu(s) {
    return Object.prototype.hasOwnProperty.call(BIRLER, s) ||
           Object.prototype.hasOwnProperty.call(ONLAR, s) ||
           s === 'yüz' || s === 'yuz' || s === 'bin';
  }

  function sayiSozcuguGovdeVeEk(s) {
    const k = String(s).toLocaleLowerCase('tr-TR');
    if (sayiSozcuguMu(k)) return { govde: k, ek: '' };

    // "beşte", "üçte", "yirmide" gibi kesir paydalarını olduğu gibi bırak.
    for (const ek of KESIR_LOKATIF_EKLERI) {
      if (k.endsWith(ek) && k.length > ek.length) {
        const govde = k.slice(0, -ek.length);
        if (sayiSozcuguMu(govde)) return null;
      }
    }

    for (const ek of SAYI_EKLERI) {
      if (!k.endsWith(ek) || k.length <= ek.length) continue;
      const govde = k.slice(0, -ek.length);
      if (sayiSozcuguMu(govde)) return { govde: govde, ek: ek };
    }
    return null;
  }

  function basitSayiSozcuguCoz(s) {
    const k = String(s).toLocaleLowerCase('tr-TR');
    if (Object.prototype.hasOwnProperty.call(BIRLER, k)) return BIRLER[k];
    if (Object.prototype.hasOwnProperty.call(ONLAR, k)) return ONLAR[k];
    if (k === 'yüz' || k === 'yuz') return 100;
    if (k === 'bin') return 1000;
    return null;
  }

  /**
   * Türkçe tam sayı sözcüğünü çözer.
   * Desteklenen yapı: 0–999.999.999 aralığındaki yaygın Türkçe biçimler.
   * Örn. "yirmi üç", "yüz yirmi beş", "iki yüz bin", "üç bin dört yüz on iki".
   */
  function yaziSayiGovdesiCoz(metin) {
    const k = String(metin)
      .toLocaleLowerCase('tr-TR')
      .replace(/\s+/g, ' ')
      .trim();
    if (!k) return null;

    const parcalar = k.split(' ');
    let toplam = 0;
    let grup = 0;
    let herhangiBirSayi = false;

    for (let i = 0; i < parcalar.length; i++) {
      const p = parcalar[i];
      const basit = basitSayiSozcuguCoz(p);

      if (basit == null) return null;
      herhangiBirSayi = true;

      if (basit === 100) {
        grup = (grup || 1) * 100;
      } else if (basit === 1000) {
        toplam += (grup || 1) * 1000;
        grup = 0;
      } else {
        grup += basit;
      }
    }

    return herhangiBirSayi ? toplam + grup : null;
  }

  // Türkçede yazım kuralı gereği ayrı yazılması gereken 21–99 arası
  // birleşik sayılar bazen kullanıcı tarafından hatalı biçimde bitişik
  // yazılabiliyor: "yirmiiki", "onbes", "otuzdört" gibi.
  // Bunları yalnızca sayı sözcüklerinden oluştuğu kesin olan kalıplarda
  // ayırıyoruz; böylece genel metindeki kelimelere müdahale etmiyoruz.
  function bitisikSayiSozcuguAyristir(kelime) {
    const k = String(kelime).toLocaleLowerCase('tr-TR');

    // Önce doğrudan sayı sözcüklerini kontrol et.
    if (sayiSozcuguMu(k)) return k;

    // Ek almış biçimlerde eki koruyarak sayı gövdesini ayır.
    // En uzun ekten başlayarak deniyoruz.
    for (const ek of SAYI_EKLERI) {
      if (!k.endsWith(ek) || k.length <= ek.length) continue;
      const govde = k.slice(0, -ek.length);
      const ayrilmisGovde = bitisikSayiSozcuguAyristir(govde);
      if (ayrilmisGovde && ayrilmisGovde !== govde) {
        const parcalar = ayrilmisGovde.split(' ');
        parcalar[parcalar.length - 1] += ek;
        return parcalar.join(' ');
      }
    }

    // On bir–on dokuz.
    const birler = Object.keys(BIRLER).filter(x => x !== 'sıfır' && x !== 'sifir');
    for (const bir of birler) {
      if (k === 'on' + bir) return 'on ' + bir;
    }

    // Yirmi iki, otuz dört, kırk beş vb.
    for (const on of ONLAR_ANAHTARLARI) {
      for (const bir of birler) {
        if (k === on + bir) return on + ' ' + bir;
      }
    }

    return null;
  }

  function yaziSayiTekParcaCoz(metin) {
    const k = String(metin).toLocaleLowerCase('tr-TR');
    const dogrudan = basitSayiSozcuguCoz(k);
    if (dogrudan != null) return dogrudan;

    if (/^on(?:bir|iki|üç|uc|dört|dort|beş|bes|altı|alti|yedi|sekiz|dokuz)$/.test(k)) {
      const bir = k.slice(2);
      return 10 + BIRLER[bir];
    }

    return null;
  }

  // Birden fazla sözcükten oluşan sayı grubunun son sözcüğünde ek varsa,
  // eki ayırıp sayı gövdesini çözer. Örn. "yirmi üçün" -> 23 + "ün".
  function yaziSayiGrubuCoz(sozcukler) {
    if (!sozcukler.length) return null;

    const son = sozcukler[sozcukler.length - 1];
    const govdeVeEk = sayiSozcuguGovdeVeEk(son);
    if (!govdeVeEk) return null;

    const govdeli = sozcukler.slice(0, -1).concat(govdeVeEk.govde);
    const govdeMetni = govdeli.join(' ');
    const deger = yaziSayiGovdesiCoz(govdeMetni);
    if (deger == null) return null;

    return { deger: deger, ek: govdeVeEk.ek };
  }

  function tokenSayiBaslangici(token) {
    const gv = sayiSozcuguGovdeVeEk(token);
    return !!gv;
  }

  /**
   * Metindeki sayı sözcüklerini sayısal yer tutuculara dönüştürür.
   * Kesir paydası biçimleri ("beşte", "üçte" vb.) özellikle korunur.
   */
  function yaziSayiEkleriniNormallestir(metin) {
    let hamMetin = String(metin).toLocaleLowerCase('tr-TR');
    hamMetin = hamMetin.split(/(\s+)/).map(function (parca) {
      if (/^\s+$/.test(parca) || parca === '') return parca;
      return bitisikSayiSozcuguAyristir(parca) || parca;
    }).join('');
    const tokens = hamMetin.split(/(\s+)/);
    let sonuc = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Boşlukları aynen koru.
      if (/^\s+$/.test(token) || token === '') {
        sonuc.push(token);
        continue;
      }

      // Sayı sözcüğünün başında olup olmadığımızı belirle.
      if (!tokenSayiBaslangici(token)) {
        sonuc.push(token);
        continue;
      }

      // "beşte ikisi", "üçte biri" gibi kesirlerin payını dönüştürme.
      // Önceki anlamlı token sayı + lokatif ek taşıyorsa mevcut sözcüğü
      // kesir parser'ına bırak.
      let oncekiAnlamli = null;
      for (let p = i - 1; p >= 0; p--) {
        if (!/^\s+$/.test(tokens[p]) && tokens[p] !== '') {
          oncekiAnlamli = tokens[p];
          break;
        }
      }
      if (oncekiAnlamli && oncekiAnlamli !== 'yüzde' && oncekiAnlamli !== 'yuzde' && /(?:te|ta|de|da)$/i.test(oncekiAnlamli)) {
        const oncekiGovde = oncekiAnlamli.slice(0, -2);
        if (sayiSozcuguMu(oncekiGovde)) {
          sonuc.push(token);
          continue;
        }
      }

      // Kesir paydası olan "beşte/üçte/yirmide" gibi biçimler özellikle
      // korunur; sonraki sözcük kesir payı olarak parser'a bırakılır.
      const ilkGovdeVeEk = sayiSozcuguGovdeVeEk(token);
      if (!ilkGovdeVeEk) {
        sonuc.push(token);
        continue;
      }

      // En fazla 4 sayı sözcüğünü birlikte değerlendir:
      // "yüz yirmi beş", "iki yüz otuz dört" gibi.
      // Aradaki boşluk token'ları atlanır; ilk sayı grubundan sonra gelen
      // matematik kelimesine geçilir.
      const aday = [ilkGovdeVeEk.govde];
      let j = i + 1;
      let sonGercekToken = i;
      let sonGecerli = yaziSayiTekParcaCoz(ilkGovdeVeEk.govde) != null ||
                        yaziSayiGovdesiCoz(ilkGovdeVeEk.govde) != null;

      // İlk sözcük zaten ekliyse ("yirminin", "yüzün" gibi),
      // sonraki sözcüğü aynı sayının parçası kabul etme.
      if (!ilkGovdeVeEk.ek) {
        while (j < tokens.length && aday.length < 4) {
          if (/^\s+$/.test(tokens[j])) {
            j++;
            continue;
          }
          const gv = sayiSozcuguGovdeVeEk(tokens[j]);
          if (!gv) break;

          aday.push(gv.govde);
          const deger = yaziSayiGovdesiCoz(aday.join(' '));
          if (deger == null) {
            aday.pop();
            break;
          }
          sonGercekToken = j;
          sonGecerli = true;
          j++;

          // Ekli son sözcük sayı grubunun sonudur.
          if (gv.ek) break;
        }
      }

      if (!sonGecerli) {
        sonuc.push(token);
        continue;
      }

      // Son geçerli sayı sözcüğüne ek geldiyse, onu da hesaba kat.
      // İlk token'da ek varsa zaten ilkGovdeVeEk ile ayrılmıştır.
      let kullanilacakSon = sonGercekToken;
      let kullanilacakAday = aday.slice();
      let ek = ilkGovdeVeEk.ek;

      // İlk token ekliydi ve devamında sayı sözcüğü yoksa zaten doğru.
      // Birden fazla sözcükte ek yalnızca son sözcükte kabul edilir.
      if (sonGercekToken > i) {
        const sonTokenGovdeVeEk = sayiSozcuguGovdeVeEk(tokens[sonGercekToken]);
        if (sonTokenGovdeVeEk && sonTokenGovdeVeEk.ek) {
          kullanilacakAday = aday.slice(0, -1).concat(sonTokenGovdeVeEk.govde);
          ek = sonTokenGovdeVeEk.ek;
        } else {
          ek = '';
        }
      }

      const deger = yaziSayiGovdesiCoz(kullanilacakAday.join(' '));
      if (deger == null) {
        sonuc.push(token);
        continue;
      }

      // Sonraki token'ları tüket.
      for (let k = i + 1; k <= kullanilacakSon; k++) {
        // Boşluklar dahil olmak üzere zaten çıktıdan çıkarılıyor.
      }
      i = kullanilacakSon;
      sonuc.push(String(deger));

      // Ek, sayısal normalleştirme açısından artık gereksizdir. Ancak
      // mevcut sayısal akışla tutarlı olmak için sayı yer tutucusunun
      // ek alanına aktarılması gerektiğinden burada eklenmez; SAYI_DESENI
      // yalnızca sayısal metni gördüğü için bu katmanın çıktısı doğrudan
      // "23" olur. Bu, "yirmi üçün katı" gibi ifadelerde parser'ın
      // beklediği {SAYI0} + "katı" yapısını sağlar.
      void ek;
    }

    return sonuc.join('');
  }

  /* ---------- SAYI + EK YAKALAMA ---------- */

  // Tek bir eşleşmede: [ % işareti ] [ sayı ] [ kesme ] [ bitişik ek (ör. nin, i, ün, ye) ]
  const SAYI_DESENI = new RegExp(
    "(%\\s*)?" +
    "(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)" +
    "([\'\u2018\u2019]?)" +
    "([a-zçğıöşü]{0,6})",
    "gi"
  );

  /**
   * Metindeki sayıları bulur, yer tutucuyla değiştirir.
   * @param {string} metin
   * @returns {{normalizedText: string, sayilar: Array<{deger:number, ek:string, yuzdeIsaretiVar:boolean, orijinal:string}>}}
   */
  function metniNormallestir(metin) {
    if (typeof metin !== 'string') {
      throw new Error('metniNormallestir bir metin bekler.');
    }

    const sayilar = [];
    let index = 0;

    const calisilanMetin = yaziSayiEkleriniNormallestir(metin.toLowerCase());

    const normalizedText = calisilanMetin.replace(
      SAYI_DESENI,
      function (tamEslesme, yuzdeIsareti, sayiDizgisi, kesme, ek) {
        let deger;
        try {
          deger = sayiCozumle(sayiDizgisi);
        } catch (e) {
          return tamEslesme;
        }
        const yerTutucu = '{SAYI' + index + '}';
        sayilar.push({
          deger: deger,
          ek: ek || '',
          yuzdeIsaretiVar: !!yuzdeIsareti,
          orijinal: tamEslesme.trim()
        });
        index++;
        return yerTutucu;
      }
    );

    // İKİNCİ GEÇİŞ: "125 nin", "25 i" gibi sayıya boşlukla ayrılmış
    // bilinen ekleri de temizle.
    const metinEkTemiz = normalizedText.replace(
      /(\{SAYI\d+\})\s+(inci|ıncı|uncu|üncü|nin|nın|nun|nün|yin|yın|yun|yün|in|ın|un|ün|ye|ya|si|sı|su|sü|yi|yı|yu|yü|ci|cı|cu|cü|i|ı|u|ü|e|a)(?![a-zçğıöşü])/gi,
      '$1'
    );

    const temizMetin = metinEkTemiz.replace(/\s+/g, ' ').trim();

    return { normalizedText: temizMetin, sayilar: sayilar };
  }

  /* ---------- DIŞA AKTARIM ---------- */

  const TRNormallestir = {
    sayiCozumle,
    metniNormallestir,
    // test/inceleme amacıyla dışa açık yardımcılar
    _yaziSayiGovdesiCoz: yaziSayiGovdesiCoz,
    _yaziSayiEkleriniNormallestir: yaziSayiEkleriniNormallestir
  };

  global.TRNormallestir = TRNormallestir;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TRNormallestir;
  }

})(typeof window !== 'undefined' ? window : globalThis);
