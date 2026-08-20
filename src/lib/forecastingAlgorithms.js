/**
 * Talep Tahmini, Güvenlik Stoku & Otomatik Depo İkmal Motoru
 * - ROP (Reorder Point = Günlük Talep x Tedarik Süresi + Güvenlik Stoku)
 * - Otomatik Depo Transferi (Cross-Warehouse Auto-Replenishment) Öneri Motoru
 * - FEFO / FIFO Raf Ömrü ve Son Kullanma Tarihi Risk Matrisi
 */

/**
 * Reorder Point & Stok Sağlığı Hesaplayıcı
 */
export function calculateInventoryForecasts(pallets, warehouses, transfers = []) {
  // Ürün bazında stokları grupla
  const productStock = {};

  pallets.filter((p) => p.durum === "depoda").forEach((p) => {
    const key = `${p.warehouse_id}_${p.urun_adi}`;
    if (!productStock[key]) {
      productStock[key] = {
        warehouse_id: p.warehouse_id,
        urun_adi: p.urun_adi,
        mevcut_stok: 0,
        birim: p.birim || "adet",
        palet_sayisi: 0,
        en_eski_uretim: p.uretim_tarihi || null,
        partiler: []
      };
    }
    productStock[key].mevcut_stok += Number(p.miktar) || 0;
    productStock[key].palet_sayisi += 1;
    productStock[key].partiler.push({
      kod: p.kod,
      parti_no: p.parti_no,
      uretim_tarihi: p.uretim_tarihi,
      miktar: p.miktar
    });

    if (p.uretim_tarihi && (!productStock[key].en_eski_uretim || p.uretim_tarihi < productStock[key].en_eski_uretim)) {
      productStock[key].en_eski_uretim = p.uretim_tarihi;
    }
  });

  const warehouseMap = {};
  warehouses.forEach((w) => {
    warehouseMap[w.id] = w;
  });

  const forecastResults = [];
  const replenishmentAlerts = [];

  // Sabit parametreler (veya SKU bazlı tahmin)
  const defaultDailyDemand = 85; // Günlük ortalama talep adedi
  const leadTimeDays = 3; // Depolar arası ortalama sevk süresi (gün)
  const zScore = 1.65; // %95 Hizmet Seviyesi Güvenlik Katsayısı
  const demandStdDev = 15; // Günlük talep standart sapması

  // Güvenlik Stoku = Z * StandartSapma * sqrt(LeadTime)
  const safetyStock = Math.round(zScore * demandStdDev * Math.sqrt(leadTimeDays));
  // ROP = (Günlük Talep * Lead Time) + Güvenlik Stoku
  const reorderPoint = Math.round(defaultDailyDemand * leadTimeDays + safetyStock);

  Object.values(productStock).forEach((item) => {
    const wh = warehouseMap[item.warehouse_id] || { ad: "Depo" };
    const stockDaysRemaining = defaultDailyDemand > 0
      ? Number((item.mevcut_stok / defaultDailyDemand).toFixed(1))
      : 99;

    let durum = "Yeterli";
    let durumRenk = "text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300";

    if (item.mevcut_stok <= safetyStock) {
      durum = "Kritik Stok (Tükenme Riski)";
      durumRenk = "text-rose-700 bg-rose-100 dark:bg-rose-950 dark:text-rose-300";

      // Otomatik ikmal transfer önerisi oluştur
      replenishmentAlerts.push({
        urun_adi: item.urun_adi,
        hedef_depo_id: item.warehouse_id,
        hedef_depo_adi: wh.ad,
        kaynak_depo_id: "wh-merkez", // Merkez ana depodan besleme
        onerilen_miktar: reorderPoint * 2,
        birim: item.birim,
        sebep: `Mevcut stok (${item.mevcut_stok} ${item.birim}), güvenlik seviyesinin (${safetyStock}) altına düştü.`
      });
    } else if (item.mevcut_stok <= reorderPoint) {
      durum = "Sipariş Eşiği (ROP Altında)";
      durumRenk = "text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300";
    }

    forecastResults.push({
      ...item,
      depo_adi: wh.ad,
      gunluk_talep: defaultDailyDemand,
      guvenlik_stoku: safetyStock,
      rop: reorderPoint,
      kalan_gun: stockDaysRemaining,
      durum,
      durumRenk
    });
  });

  return {
    forecastResults,
    replenishmentAlerts,
    parameters: {
      dailyDemand: defaultDailyDemand,
      leadTimeDays,
      safetyStock,
      reorderPoint
    }
  };
}

/**
 * FEFO (First Expired First Out) & Raf Ömrü Risk Analizi
 */
export function calculateFefoRiskMatrix(pallets) {
  const today = new Date();
  const fefoRisks = [];

  pallets.filter((p) => p.durum === "depoda" && p.uretim_tarihi).forEach((p) => {
    const prodDate = new Date(p.uretim_tarihi);
    if (isNaN(prodDate.getTime())) return;

    // Ortalama raf ömrü 180 gün varsayalım
    const shelfLifeDays = 180;
    const expiryDate = new Date(prodDate.getTime() + shelfLifeDays * 24 * 60 * 60 * 1000);
    const diffTime = expiryDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let riskLevel = "Normal";
    let badgeClass = "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300";

    if (daysRemaining < 0) {
      riskLevel = "Süresi Dolmuş";
      badgeClass = "text-rose-700 bg-rose-100 dark:bg-rose-950 dark:text-rose-300";
    } else if (daysRemaining <= 30) {
      riskLevel = "Yüksek Risk (Öncelikli Sevk)";
      badgeClass = "text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-300";
    } else if (daysRemaining <= 60) {
      riskLevel = "Orta Risk (FEFO Takip)";
      badgeClass = "text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300";
    }

    fefoRisks.push({
      palletId: p.id,
      kod: p.kod,
      urun_adi: p.urun_adi,
      parti_no: p.parti_no,
      uretim_tarihi: p.uretim_tarihi,
      tahmini_skt: expiryDate.toISOString().split("T")[0],
      kalan_gun: daysRemaining,
      miktar: p.miktar,
      birim: p.birim,
      riskLevel,
      badgeClass
    });
  });

  return fefoRisks.sort((a, b) => a.kalan_gun - b.kalan_gun);
}
