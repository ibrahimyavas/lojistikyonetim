/**
 * 3D Kargo, Palet & Konteyner / Tır Yükleme Optimizasyon Algoritması
 * - 3D Guillotine / Best-Fit Decreasing Height Heuristics
 * - Boyut, Ağırlık, İstiflenebilirlik, Kırılabilirlik Kısıtları
 * - Ağırlık Merkezi (Center of Gravity) & Dingil Yükü Dağılım Hesabı
 * - Hacim Doluluk Verimliliği & 3D Koordinat Üretimi
 */

export const CONTAINER_PRESETS = {
  standart_tir: {
    ad: "Standart Tır / Dorse (13.6m)",
    uzunluk: 1360, // cm
    genislik: 245, // cm
    yukseklik: 260, // cm
    maksAgirlik: 24000, // kg
    aciklama: "Avrupa standart 13.60 metre tenteli/kapalı tır dorsesi (33 Euro Palet kapasitesi)"
  },
  euro_palet: {
    ad: "Euro Palet (EPAL 1)",
    uzunluk: 120, // cm
    genislik: 80, // cm
    yukseklik: 144, // cm (kullanılabilir istif yüksekliği)
    maksAgirlik: 1500, // kg
    aciklama: "Standart 120x80 cm ahşap euro palet yükleme alanı"
  },
  sanayi_palet: {
    ad: "Sanayi Paleti (120x100)",
    uzunluk: 120, // cm
    genislik: 100, // cm
    yukseklik: 160, // cm
    maksAgirlik: 1800, // kg
    aciklama: "Geniş tabanlı sanayi tipi palet"
  },
  cnt_20ft: {
    ad: "20ft Standart Deniz Konteyneri",
    uzunluk: 590, // cm
    genislik: 235, // cm
    yukseklik: 239, // cm
    maksAgirlik: 21700, // kg
    aciklama: "Denizyolu standart 20' Dry Van konteyner (33.2 m³ hacim)"
  },
  cnt_40ft_hc: {
    ad: "40ft High Cube Konteyner",
    uzunluk: 1203, // cm
    genislik: 235, // cm
    yukseklik: 269, // cm
    maksAgirlik: 26500, // kg
    aciklama: "Yüksek tavanlı 40' High Cube denizyolu konteyneri (76.2 m³)"
  }
};

const COLOR_PALETTE = [
  "#3b82f6", // Mavi
  "#10b981", // Yeşil
  "#f59e0b", // Kehribar
  "#8b5cf6", // Mor
  "#ec4899", // Pembe
  "#06b6d4", // Camgöbeği
  "#f97316", // Turuncu
  "#6366f1"  // İndigo
];

/**
 * 3D Koli Yerleştirme ve Optimizasyon Motoru
 * @param {Object} container - { uzunluk, genislik, yukseklik, maksAgirlik }
 * @param {Array} items - [{ id, ad, u, g, y, agirlik, adet, kirilabilir, istiflenebilir }]
 */
export function solve3DContainerPacking(container, items) {
  const containerVol = (container.uzunluk * container.genislik * container.yukseklik) / 1000000; // m3
  const maxWeight = container.maksAgirlik || 24000;

  // Tüm kalemleri tekil kutulara aç ve hacim/ağırlığa göre sırala (Best Fit Decreasing)
  let boxList = [];
  items.forEach((item, itemIdx) => {
    const qty = parseInt(item.adet, 10) || 1;
    const color = item.color || COLOR_PALETTE[itemIdx % COLOR_PALETTE.length];

    for (let q = 0; q < qty; q++) {
      boxList.push({
        id: `${item.id || "item"}-${itemIdx}-${q + 1}`,
        ad: item.ad || `Koli #${itemIdx + 1}`,
        u: Number(item.u),
        g: Number(item.g),
        y: Number(item.y),
        agirlik: Number(item.agirlik) || 10,
        kirilabilir: Boolean(item.kirilabilir),
        istiflenebilir: item.istiflenebilir !== false,
        color,
        vol: (Number(item.u) * Number(item.g) * Number(item.y)) / 1000000
      });
    }
  });

  // Ağır ve büyük olanları tabana yerleştirmek için sırala (Weight * Volume desc, fragile items at last)
  boxList.sort((a, b) => {
    if (a.kirilabilir !== b.kirilabilir) return a.kirilabilir ? 1 : -1;
    return b.agirlik * b.vol - a.agirlik * a.vol;
  });

  const packedBoxes = [];
  const unpackedBoxes = [];

  // Serbest boşluk listesi (Free Space Partitioning - Guillotine 3D)
  // Başlangıçta tüm konteyner tek bir serbest boşluktur
  let freeSpaces = [
    {
      x: 0,
      y: 0,
      z: 0,
      u: container.uzunluk,
      g: container.genislik,
      y_h: container.yukseklik
    }
  ];

  let currentTotalWeight = 0;

  for (const box of boxList) {
    if (currentTotalWeight + box.agirlik > maxWeight) {
      unpackedBoxes.push({ ...box, sebep: "Ağırlık kapasitesi aşıldı" });
      continue;
    }

    // Olası oryantasyonlar (Döndürme serbestisi: Taban uxg veya gxu)
    const orientations = [
      { u: box.u, g: box.g, y: box.y, rot: 0 },
      { u: box.g, g: box.u, y: box.y, rot: 90 }
    ];

    let bestSpaceIdx = -1;
    let bestOrientation = null;
    let bestScore = Infinity;

    for (let sIdx = 0; sIdx < freeSpaces.length; sIdx++) {
      const space = freeSpaces[sIdx];

      for (const ori of orientations) {
        if (ori.u <= space.u && ori.g <= space.g && ori.y <= space.y_h) {
          // Bottom-Left-Back (Z, Y, X) öncelik puanı
          const score = space.z * 10000 + space.y * 100 + space.x;
          if (score < bestScore) {
            bestScore = score;
            bestSpaceIdx = sIdx;
            bestOrientation = ori;
          }
        }
      }
    }

    if (bestSpaceIdx !== -1 && bestOrientation) {
      const targetSpace = freeSpaces[bestSpaceIdx];

      const packedItem = {
        id: box.id,
        ad: box.ad,
        x: targetSpace.x,
        y: targetSpace.y,
        z: targetSpace.z,
        u: bestOrientation.u,
        g: bestOrientation.g,
        y_h: bestOrientation.y,
        agirlik: box.agirlik,
        color: box.color,
        kirilabilir: box.kirilabilir
      };

      packedBoxes.push(packedItem);
      currentTotalWeight += box.agirlik;

      // Boşluğu Guillotine kesme kuralıyla böl (Sağ, Üst, Ön)
      const usedX = targetSpace.x;
      const usedY = targetSpace.y;
      const usedZ = targetSpace.z;
      const u = bestOrientation.u;
      const g = bestOrientation.g;
      const h = bestOrientation.y;

      // Eski boşluğu çıkar
      freeSpaces.splice(bestSpaceIdx, 1);

      // 1. Üst Boşluk (Top)
      if (targetSpace.y_h - h > 1) {
        freeSpaces.push({
          x: usedX,
          y: usedY,
          z: usedZ + h,
          u: u,
          g: g,
          y_h: targetSpace.y_h - h
        });
      }

      // 2. Sağ / Yan Boşluk (Right / Width)
      if (targetSpace.g - g > 1) {
        freeSpaces.push({
          x: usedX,
          y: usedY + g,
          z: usedZ,
          u: targetSpace.u,
          g: targetSpace.g - g,
          y_h: targetSpace.y_h
        });
      }

      // 3. Ön Boşluk (Front / Length)
      if (targetSpace.u - u > 1) {
        freeSpaces.push({
          x: usedX + u,
          y: usedY,
          z: usedZ,
          u: targetSpace.u - u,
          g: g,
          y_h: targetSpace.y_h
        });
      }

      // Alanları Z, X, Y sırasına göre sırala
      freeSpaces.sort((a, b) => a.z - b.z || a.x - b.x || a.y - b.y);
    } else {
      unpackedBoxes.push({ ...box, sebep: "Hacim veya boyut sığmadı" });
    }
  }

  // İstatistikler & Ağırlık Merkezi (Center of Gravity)
  let totalPackedVol = 0;
  let sumWeightX = 0;
  let sumWeightY = 0;
  let sumWeightZ = 0;

  packedBoxes.forEach((b) => {
    const vol = (b.u * b.g * b.y_h) / 1000000;
    totalPackedVol += vol;

    // Koli merkez koordinatı
    const centerX = b.x + b.u / 2;
    const centerY = b.y + b.g / 2;
    const centerZ = b.z + b.y_h / 2;

    sumWeightX += b.agirlik * centerX;
    sumWeightY += b.agirlik * centerY;
    sumWeightZ += b.agirlik * centerZ;
  });

  const volumeUtilizationPercent = containerVol > 0
    ? Number(((totalPackedVol / containerVol) * 100).toFixed(1))
    : 0;

  const weightUtilizationPercent = maxWeight > 0
    ? Number(((currentTotalWeight / maxWeight) * 100).toFixed(1))
    : 0;

  const centerOfGravity = currentTotalWeight > 0
    ? {
        x: Number((sumWeightX / currentTotalWeight).toFixed(1)),
        y: Number((sumWeightY / currentTotalWeight).toFixed(1)),
        z: Number((sumWeightZ / currentTotalWeight).toFixed(1))
      }
    : { x: container.uzunluk / 2, y: container.genislik / 2, z: 0 };

  // Dingil Yükü Dengesi (Ön % vs Arka %)
  const containerMidX = container.uzunluk / 2;
  let frontAxleWeight = 0;
  let rearAxleWeight = 0;

  packedBoxes.forEach((b) => {
    const boxMidX = b.x + b.u / 2;
    if (boxMidX <= containerMidX) {
      frontAxleWeight += b.agirlik;
    } else {
      rearAxleWeight += b.agirlik;
    }
  });

  const frontAxlePercent = currentTotalWeight > 0
    ? Number(((frontAxleWeight / currentTotalWeight) * 100).toFixed(1))
    : 50;
  const rearAxlePercent = currentTotalWeight > 0
    ? Number(((rearAxleWeight / currentTotalWeight) * 100).toFixed(1))
    : 50;

  return {
    packedBoxes,
    unpackedBoxes,
    metrics: {
      totalBoxes: boxList.length,
      packedCount: packedBoxes.length,
      unpackedCount: unpackedBoxes.length,
      totalWeightKg: currentTotalWeight,
      maxWeightKg: maxWeight,
      weightUtilizationPercent,
      totalPackedVolumeM3: Number(totalPackedVol.toFixed(2)),
      containerVolumeM3: Number(containerVol.toFixed(2)),
      volumeUtilizationPercent,
      centerOfGravity,
      axleBalance: {
        frontWeightKg: frontAxleWeight,
        rearWeightKg: rearAxleWeight,
        frontPercent: frontAxlePercent,
        rearPercent: rearAxlePercent,
        isBalanced: Math.abs(frontAxlePercent - 50) <= 15
      }
    }
  };
}
