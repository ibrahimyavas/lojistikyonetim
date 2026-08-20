/**
 * Akıllı Depo Slotting (Yerleşim) & Wave Picking (Toplama Dalgası) Optimizasyonu
 * - ABC Velocity (Pareto 80/15/5 Analizi)
 * - Rampa / Çıkış Kapısına Yakınlık ve Ergonomi Skorlama
 * - Wave & Batch Picking Dalga Oluşturucu ve Koridor Gezinme (S-Shape Pick Path)
 */

/**
 * Palet ve Ürün Hareketlerine Göre ABC Sınıflandırması
 * A Sınıfı: Toplam sevkiyat hacminin %80'ini oluşturan hızlı kalemler (Rampa yanı)
 * B Sınıfı: Sonraki %15'lik orta hızlı kalemler (Orta koridorlar)
 * C Sınıfı: Kalan %5'lik yavaş hareket eden kalemler (Üst/arka raflar)
 */
export function calculateAbcVelocityAnalysis(pallets, movements = []) {
  // Ürün bazında hareket ve miktar topla
  const skuStats = {};

  pallets.forEach((p) => {
    // NOT: `pallets` her zaman gerçek API'den (worker/pallets.js palletRow)
    // geldiği için alan adları camelCase (urunAdi, warehouseId, zoneId...) -
    // snake_case değil. Bu satırda daha önce `p.urun_adi` kullanılıyordu,
    // hep undefined olduğu için TÜM paletler "Bilinmeyen Ürün" altında
    // toplanıyor, ABC analizi hiç anlamlı çalışmıyordu.
    const sku = p.urunAdi || "Bilinmeyen Ürün";
    if (!skuStats[sku]) {
      skuStats[sku] = {
        urun_adi: sku,
        palet_adedi: 0,
        toplam_miktar: 0,
        birim: p.birim || "adet",
        hareket_sayisi: 0,
        depodaki_adet: p.durum === "depoda" ? 1 : 0
      };
    }
    skuStats[sku].palet_adedi += 1;
    skuStats[sku].toplam_miktar += Number(p.miktar) || 0;
  });

  movements.forEach((m) => {
    // Hareket sayacı
    Object.keys(skuStats).forEach((sku) => {
      skuStats[sku].hareket_sayisi += 1;
    });
  });

  // Skuları toplam hacme/frekansa göre sırala
  const sortedSkus = Object.values(skuStats).sort(
    (a, b) => b.toplam_miktar - a.toplam_miktar || b.palet_adedi - a.palet_adedi
  );

  const grandTotalMiktar = sortedSkus.reduce((sum, s) => sum + s.toplam_miktar, 0) || 1;

  let cumulativeSum = 0;
  const categorized = sortedSkus.map((sku) => {
    // Sınıf, bu kalemi EKLEMEDEN ÖNCEKİ kümülatif yüzdeye göre belirlenir,
    // ekledikten SONRAKİ değere göre değil. Aksi halde tek başına hacmin
    // %90'ını oluşturan (küçük işletmelerde çok olağan) TEK bir baskın ürün,
    // kendi eklenişiyle kümülatif oranı 80'in üzerine tek adımda taşıdığı
    // için en KÖTÜ sınıfa (C - "arka blok") düşüyordu; oysa depodaki en çok
    // hareket eden ürün odur ve gerçekte A sınıfı (rampa önü) olmalı.
    // "Önceki kümülatif < 80" kontrolü, bir kalemin eşiği aşarak %80'e
    // ULAŞTIRAN kalem olması durumunda da doğru şekilde A sayılmasını sağlar.
    const previousCumulativePercent = (cumulativeSum / grandTotalMiktar) * 100;
    cumulativeSum += sku.toplam_miktar;
    const cumulativePercent = (cumulativeSum / grandTotalMiktar) * 100;

    let sinif = "C";
    let oncelikRengi = "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300";
    let onerilenBolge = "Arka Blok / Yüksek Kat (C Bölgesi)";

    if (previousCumulativePercent < 80) {
      sinif = "A";
      oncelikRengi = "text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300";
      onerilenBolge = "Rampa Önü / Giriş Katı (A Bölgesi - Hızlı Sirkülasyon)";
    } else if (previousCumulativePercent < 95) {
      sinif = "B";
      oncelikRengi = "text-blue-700 bg-blue-100 dark:bg-blue-950 dark:text-blue-300";
      onerilenBolge = "Standart Raf Katları (B Bölgesi)";
    }

    return {
      ...sku,
      cumulativePercent: Number(cumulativePercent.toFixed(1)),
      sinif,
      oncelikRengi,
      onerilenBolge
    };
  });

  return categorized;
}

// Bir bölümün ABC sınıfını belirler: önce admin'in bölüme açıkça verdiği
// `sinif` alanına bakar (bkz. migrations/0007_zone_sinif.sql), yoksa eski
// kod/ad metin sezgisine ("A-..." ile başlıyor mu, adında "hızlı"/"istif"
// geçiyor mu) geri düşer - böylece hiç sınıflandırılmamış depolarda da
// öneriler tamamen durmuyor.
function inferZoneClass(zone) {
  if (zone.sinif) return zone.sinif;
  const kod = zone.kod?.toUpperCase() || "";
  const ad = zone.ad?.toLowerCase() || "";
  if (kod.startsWith("A") || ad.includes("hızlı") || ad.includes("rampa")) return "A";
  if (kod.startsWith("C") || ad.includes("istif")) return "C";
  return "B";
}

/**
 * Bir ürün için mal kabul sırasında OTOMATIK bölüm önerisi üretir.
 * 1) Ürünün bu depodaki ABC hız sınıfını hesaplar (calculateAbcVelocityAnalysis)
 *    - depoda daha önce hiç görülmemiş bir ürün nötr "B" sınıfı alır: ne
 *      hızlı şeride öncelik verilir ne de en arkaya itilir.
 * 2) Sınıfı eşleşen, dolu OLMAYAN (kapasite tanımsızsa her zaman uygun)
 *    bölümler arasından en boş olanı seçer (yük dengeleme).
 * 3) Eşleşen sınıfta uygun bölüm yoksa depodaki herhangi bir dolu olmayan
 *    bölüme geniş çeşitlemeyle düşer - hiçbir zaman "öneri yok" demeden
 *    önce depoyu tam taramadan pes etmez.
 * Geri dönen değer: { zoneId, zone, sinif, tamEslesme } ya da hiç uygun
 * (dolu olmayan) bölüm yoksa null.
 */
export function suggestZoneForProduct(urunAdi, pallets, zones, warehouseId) {
  if (!urunAdi || !warehouseId) return null;
  const zonesInWarehouse = zones.filter((z) => z.warehouseId === warehouseId);
  if (zonesInWarehouse.length === 0) return null;

  const palletsInWarehouse = pallets.filter((p) => p.warehouseId === warehouseId);
  const abcList = calculateAbcVelocityAnalysis(palletsInWarehouse);
  const productClass = abcList.find((item) => item.urun_adi === urunAdi)?.sinif || "B";

  const hasRoom = (z) => z.kapasite == null || z.doluluk < z.kapasite;
  const byLoad = (a, b) => {
    const ratioA = a.kapasite ? a.doluluk / a.kapasite : a.doluluk === 0 ? -1 : 0;
    const ratioB = b.kapasite ? b.doluluk / b.kapasite : b.doluluk === 0 ? -1 : 0;
    return ratioA - ratioB || a.doluluk - b.doluluk;
  };

  const matchingClass = zonesInWarehouse
    .filter((z) => inferZoneClass(z) === productClass && hasRoom(z))
    .sort(byLoad);
  if (matchingClass.length > 0) {
    return { zoneId: matchingClass[0].id, zone: matchingClass[0], sinif: productClass, tamEslesme: true };
  }

  const anyAvailable = zonesInWarehouse.filter(hasRoom).sort(byLoad);
  if (anyAvailable.length > 0) {
    return { zoneId: anyAvailable[0].id, zone: anyAvailable[0], sinif: productClass, tamEslesme: false };
  }

  return null;
}

/**
 * Akıllı Slotting Yerleşim İyileştirme Önerileri
 * Yanlış yerde (örneğin A sınıfı ürünün arka C bölgesinde olması) bulunan
 * paletleri tespit eder. Hedef bölge artık uydurma bir kod ("A-01" gibi)
 * DEĞİL, o depoda gerçekten var olan ve dolu olmayan bir bölüm -
 * suggestZoneForProduct ile aynı yerleştirme mantığını kullanır, böylece
 * öneri hiçbir zaman var olmayan/dolu bir bölümü işaret etmez.
 */
export function generateSlottingRecommendations(pallets, zones, abcList) {
  const abcMap = {};
  abcList.forEach((item) => {
    abcMap[item.urun_adi] = item.sinif;
  });

  const zoneMap = {};
  zones.forEach((z) => {
    zoneMap[z.id] = z;
  });

  const recommendations = [];

  pallets.filter((p) => p.durum === "depoda").forEach((pallet) => {
    const currentZone = zoneMap[pallet.zoneId];
    const skuClass = abcMap[pallet.urunAdi] || "B";

    if (!currentZone) {
      const target = pallet.warehouseId
        ? suggestZoneForProduct(pallet.urunAdi, pallets, zones, pallet.warehouseId)
        : null;
      recommendations.push({
        palletId: pallet.id,
        palletKod: pallet.kod,
        urun_adi: pallet.urunAdi,
        miktar: pallet.miktar,
        birim: pallet.birim,
        mevcutYer: "Tanımsız Alan",
        sinif: skuClass,
        oneri: target
          ? `Bölümsüz palet - önerilen bölüm: ${target.zone.kod}${target.zone.ad ? ` (${target.zone.ad})` : ""}.`
          : "Bölümsüz palet - uygun (dolu olmayan) bir bölüm bulunamadı.",
        oncelik: "Yuksek",
        hedefBolge: target?.zone.kod || null
      });
      return;
    }

    const currentClass = inferZoneClass(currentZone);

    // Ürünün sınıfı, bulunduğu bölümün sınıfıyla uyuşmuyorsa (özellikle A
    // sınıfı hızlı ürün C bölgesinde ya da C sınıfı yavaş ürün A bölgesini
    // işgal ediyorsa) taşıma önerisi üret.
    if (skuClass !== currentClass && (skuClass === "A" || skuClass === "C")) {
      const target = pallet.warehouseId
        ? suggestZoneForProduct(pallet.urunAdi, pallets, zones, pallet.warehouseId)
        : null;
      const hedefKod = target?.zone.id !== currentZone.id ? target?.zone.kod : null;
      recommendations.push({
        palletId: pallet.id,
        palletKod: pallet.kod,
        urun_adi: pallet.urunAdi,
        miktar: pallet.miktar,
        birim: pallet.birim,
        mevcutYer: `${currentZone.kod} - ${currentZone.ad || ""}`.trim(),
        sinif: skuClass,
        oneri:
          skuClass === "A"
            ? `Yüksek hızlı A sınıfı ürün, forklift mesafesini azaltmak için${hedefKod ? ` ${hedefKod} bölümüne` : " hızlı sirkülasyon alanına"} taşınmalı.`
            : `Yavaş hareket eden C sınıfı ürün, rampa önünü tıkamaması için${hedefKod ? ` ${hedefKod} bölümüne` : " arka/istif alanına"} kaydırılmalı.`,
        oncelik: skuClass === "A" ? "Yuksek" : "Orta",
        hedefBolge: hedefKod || null
      });
    }
  });

  return recommendations;
}

/**
 * Toplama Dalgası & S-Shape Pick Path Optimizasyonu
 * Birden fazla siparişi birleştirir ve depoda minimum yürüme mesafeli toplama rotası çıkarır
 */
export function generateWavePickPath(palletsToPick, zones) {
  // Paletlerin kendisinde bölüm KODU yok, sadece zoneId var - gerçek kodu
  // zones listesinden buluyoruz (önceden `pick.zone_kod` diye var olmayan
  // bir alana bakılıyordu, bu yüzden rota her zaman "Alan"/"Bölge" gibi
  // anlamsız bir yer tutucu gösteriyordu).
  const zoneKodById = new Map(zones.map((z) => [z.id, z.kod]));
  const zoneKodOf = (pick) => zoneKodById.get(pick.zoneId) || null;

  // Zone koduna göre S-Shape dizilim
  const sortedPicks = [...palletsToPick].sort((a, b) => {
    const zoneA = zoneKodOf(a) || "Z";
    const zoneB = zoneKodOf(b) || "Z";
    return zoneA.localeCompare(zoneB);
  });

  return sortedPicks.map((pick, idx) => ({
    adim: idx + 1,
    palletId: pick.id,
    palletKod: pick.kod,
    urun_adi: pick.urunAdi,
    miktar: pick.miktar,
    birim: pick.birim,
    konum: zoneKodOf(pick) || "Alan",
    parti_no: pick.partiNo,
    uretim_tarihi: pick.uretimTarihi,
    toplamaYolu: `Adım ${idx + 1}: ${zoneKodOf(pick) || "Bölge"} ➔ Palet [${pick.kod}] - ${pick.urunAdi} (${pick.miktar} ${pick.birim || "adet"})`
  }));
}
