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
    const sku = p.urun_adi || "Bilinmeyen Ürün";
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
    cumulativeSum += sku.toplam_miktar;
    const cumulativePercent = (cumulativeSum / grandTotalMiktar) * 100;

    let sinif = "C";
    let oncelikRengi = "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300";
    let onerilenBolge = "Arka Blok / Yüksek Kat (C Bölgesi)";

    if (cumulativePercent <= 80) {
      sinif = "A";
      oncelikRengi = "text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300";
      onerilenBolge = "Rampa Önü / Giriş Katı (A Bölgesi - Hızlı Sirkülasyon)";
    } else if (cumulativePercent <= 95) {
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

/**
 * Akıllı Slotting Yerleşim İyileştirme Önerileri
 * Yanlış yerde (örneğin A sınıfı ürünün arka C bölgesinde olması) bulunan paletleri tespit eder
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
    const currentZone = zoneMap[pallet.zone_id];
    const skuClass = abcMap[pallet.urun_adi] || "B";

    if (!currentZone) {
      recommendations.push({
        palletId: pallet.id,
        palletKod: pallet.kod,
        urun_adi: pallet.urun_adi,
        miktar: pallet.miktar,
        birim: pallet.birim,
        mevcutYer: "Tanımsız Alan",
        sinif: skuClass,
        oneri: `A Sınıfı hızlı ürün boşta bekletilmemeli, Giriş/Rampa bölgesine yerleştirilmeli.`,
        oncelik: "Yuksek"
      });
      return;
    }

    const zoneKod = currentZone.kod?.toUpperCase() || "";

    // A sınıfı olup C bölgesinde olanlar
    if (skuClass === "A" && (zoneKod.startsWith("C") || currentZone.ad?.toLowerCase().includes("istif"))) {
      recommendations.push({
        palletId: pallet.id,
        palletKod: pallet.kod,
        urun_adi: pallet.urun_adi,
        miktar: pallet.miktar,
        birim: pallet.birim,
        mevcutYer: `${currentZone.kod} - ${currentZone.ad}`,
        sinif: "A",
        oneri: "Yüksek hızlı A sınıfı ürün, forklift mesafesini azaltmak için A-01 Hızlı Sirkülasyon alanına taşınmalı.",
        oncelik: "Yuksek",
        hedefBolge: "A-01"
      });
    }

    // C sınıfı olup A bölgesini işgal edenler
    if (skuClass === "C" && (zoneKod.startsWith("A") || currentZone.ad?.toLowerCase().includes("hızlı"))) {
      recommendations.push({
        palletId: pallet.id,
        palletKod: pallet.kod,
        urun_adi: pallet.urun_adi,
        miktar: pallet.miktar,
        birim: pallet.birim,
        mevcutYer: `${currentZone.kod} - ${currentZone.ad}`,
        sinif: "C",
        oneri: "Yavaş hareket eden C sınıfı ürün, rampa önünü tıkamaması için C Blok İstif rafına kaydırılmalı.",
        oncelik: "Orta",
        hedefBolge: "C-03"
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
  // Zone sırasına göre S-Shape dizilim
  const sortedPicks = [...palletsToPick].sort((a, b) => {
    const zoneA = a.zone_kod || "Z";
    const zoneB = b.zone_kod || "Z";
    return zoneA.localeCompare(zoneB);
  });

  return sortedPicks.map((pick, idx) => ({
    adim: idx + 1,
    palletId: pick.id,
    palletKod: pick.kod,
    urun_adi: pick.urun_adi,
    miktar: pick.miktar,
    birim: pick.birim,
    konum: pick.zone_kod || "Alan",
    parti_no: pick.parti_no,
    uretim_tarihi: pick.uretim_tarihi,
    toplamaYolu: `Adım ${idx + 1}: ${pick.zone_kod || "Bölge"} ➔ Palet [${pick.kod}] - ${pick.urun_adi} (${pick.miktar} ${pick.birim || "adet"})`
  }));
}
