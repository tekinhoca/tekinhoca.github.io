/* =============================================================
   TR NORMALLEŞTİRME KATMANI (Aşama 2)
   =============================================================
   Bu dosya, kullanıcının serbest Türkçe girdisindeki SAYILARI ve
   onlara bitişik/kesmeli EKLERİ tanıyıp, geri kalan metni anahtar
   kelime eşleştirmesi (Aşama 3 — mini-parser) için sadeleştirir.

   NE YAPAR:
   - "120'nin", "120nin", "120 nin" gibi farklı yazımları aynı sayı
     (120) olarak tanır ve metinde {SAYI0}, {SAYI1}... yer tutucusuyla
     değiştirir; ekler ayrıca döndürülür (ileride gerekirse kullanılır).
   - "%25", "25'i", "144'ün" gibi yüzde/kesme işaretli sayıları da
     aynı mekanizmayla yakalar.
   - Türkçe ondalık biçimini yorumlar (bkz. ONDALIK BİÇİM KARARI).

   NE YAPMAZ:
   - Anahtar kelimeleri (yüzde, kat, eksik, EBOB, karekök vb.) tanımaz;
     bu iş Aşama 3'teki mini-parser'a aittir. Bu dosya yalnızca "sayı
     + ek" gürültüsünü temizler.

   ONDALIK BİÇİM KARARI (bilinçli tasarım kararı — belgeye not edilmeli):
   - Virgül (,) HER ZAMAN ondalık ayırıcı sayılır (Türkçe standart).
   - Nokta (.) binlik ayırıcı olarak yorumlanır EĞER tam olarak
     3'erli gruplar hâlinde tekrarlanıyorsa (örn. "1.234", "12.345,67").
   - Aksi hâlde tek bir nokta ondalık ayırıcı olarak kabul edilir
     (örn. "12.5" -> 12.5). Bu, İngilizce/klavye alışkanlığıyla yazılan
     ondalıkları da kapsar. Belirsiz kalabilecek tek durum "1.234"
     biçimidir; bu her zaman binlik olarak yorumlanır (1234), ondalık
     olarak değil — çünkü Türkçe metinde ondalık her zaman virgülle
     yazılır kabul edilir.
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

  /* ---------- SAYI + EK YAKALAMA ---------- */

  // Tek bir eşleşmede: [ % işareti ] [ sayı ] [ kesme ] [ bitişik ek (ör. nin, i, ün, ye) ]
  const SAYI_DESENI = new RegExp(
    "(%\\s*)?" +                              // 1: isteğe bağlı % işareti (önde)
    "(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)" + // 2: sayı
    "([\'\u2018\u2019]?)" +                    // 3: isteğe bağlı kesme işareti
    "([a-zçğıöşü]{0,6})",                       // 4: bitişik ek (küçük harf, en çok 6 karakter)
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

    let calisilanMetin = metin.toLowerCase();

    const normalizedText = calisilanMetin.replace(
      SAYI_DESENI,
      function (tamEslesme, yuzdeIsareti, sayiDizgisi, kesme, ek) {
        let deger;
        try {
          deger = sayiCozumle(sayiDizgisi);
        } catch (e) {
          // Sayı çözümlenemediyse eşleşmeyi olduğu gibi bırak (dokunma)
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

    // İKİNCİ GEÇİŞ: "125 nin", "25 i" gibi sayıya boşlukla ayrılmış yazılan
    // bilinen ekleri de temizle (belgedeki "120 nin yüzde 25 i" örneği gibi).
    // Not: Yalnızca {SAYIn} yer tutucusundan HEMEN sonra gelen ve listedeki
    // eklerle TAM eşleşen kelimeler temizlenir; anlamlı kelimeler (örn.
    // "katının", "eksiği") listede olmadığı için dokunulmaz.
    // ÖNEMLİ: JS regex'te \b, Türkçe harfleri (ç,ğ,ı,ö,ş,ü) "kelime karakteri"
    // saymaz; bu nedenle \b burada YANLIŞ eşleşmelere yol açar (örn. "yüzde"
    // kelimesinin başındaki "yü" hecesi ek gibi görünüp yanlışlıkla silinir).
    // Bunun yerine, eşleşmenin ardından başka bir Türkçe harf GELMEDİĞİNİ
    // kontrol eden bir negatif ileri-bakış (lookahead) kullanılıyor.
    const metinEkTemiz = normalizedText.replace(
      /(\{SAYI\d+\})\s+(inci|ıncı|uncu|üncü|nin|nın|nun|nün|yin|yın|yun|yün|in|ın|un|ün|ye|ya|si|sı|su|sü|yi|yı|yu|yü|ci|cı|cu|cü|i|ı|u|ü|e|a)(?![a-zçğıöşü])/gi,
      '$1'
    );

    // Fazla boşlukları sadeleştir
    const temizMetin = metinEkTemiz.replace(/\s+/g, ' ').trim();

    return { normalizedText: temizMetin, sayilar: sayilar };
  }

  /* ---------- DIŞA AKTARIM ---------- */

  const TRNormallestir = {
    sayiCozumle,
    metniNormallestir
  };

  global.TRNormallestir = TRNormallestir;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TRNormallestir;
  }

})(typeof window !== 'undefined' ? window : globalThis);
