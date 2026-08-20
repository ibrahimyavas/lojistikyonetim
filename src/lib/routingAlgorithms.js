/**
 * Gelişmiş Rota Optimizasyonu & VRP / TSP Algoritma Motoru
 * - Haversine ve Yol Eğrilik Matrisi
 * - Nearest Neighbor + 2-Opt Yerel Arama Sezgisi
 * - CVRPTW (Kapasite ve Zaman Pencereli Araç Rotalama)
 * - Yakıt Tüketimi ve GLEC Standardı Karbon Emisyonu Hesabı
 */

// Türkiye Lojistik Hub ve Şehir Koordinat Kütüphanesi
export const TURKEY_COORDINATES = {
  "merkez_tuzla": { ad: "Merkez Ana Depo (Tuzla)", lat: 40.8533, lng: 29.3033, tip: "depo" },
  "gebze_osb": { ad: "Anadolu Bölge Deposu (Gebze)", lat: 40.8142, lng: 29.4358, tip: "depo" },
  "izmir_kemalpasa": { ad: "Ege Lojistik Merkezi (Kemalpaşa)", lat: 38.4286, lng: 27.4189, tip: "depo" },
  "bursa_nilufer": { ad: "Bursa Dağıtım Noktası", lat: 40.2144, lng: 28.9833, tip: "musteri" },
  "ankara_sincan": { ad: "Ankara Lojistik Üssü", lat: 39.9722, lng: 32.5833, tip: "musteri" },
  "eskisehir_osb": { ad: "Eskişehir OSB Dağıtım", lat: 39.7767, lng: 30.5206, tip: "musteri" },
  "tekirdag_corlu": { ad: "Trakya Dağıtım (Çorlu)", lat: 41.1592, lng: 27.8000, tip: "musteri" },
  "kocaeli_izmit": { ad: "İzmit Müşteri Teslimat", lat: 40.7654, lng: 29.9408, tip: "musteri" },
  "yalova_merkez": { ad: "Yalova Dağıtım Noktası", lat: 40.6550, lng: 29.2769, tip: "musteri" },
  "balikesir_merkez": { ad: "Balıkesir Hub", lat: 39.6484, lng: 27.8826, tip: "musteri" },
  "sakarya_adapazari": { ad: "Sakarya Dağıtım", lat: 40.7731, lng: 30.4042, tip: "musteri" }
};

/**
 * İki koordinat arasındaki Haversine kuş uçuşu mesafesi (km)
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Dünya yarıçapı km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Karayolu gerçek mesafe çarpanı (Türkiye topoğrafyası için ortalama ~1.28)
 */
export function estimateRoadDistanceKm(lat1, lon1, lat2, lon2) {
  const crowKm = haversineDistanceKm(lat1, lon1, lat2, lon2);
  return Number((crowKm * 1.28).toFixed(1));
}

/**
 * Ortalama sürüş süresi tahmini (Trafik ve ortalama ticari araç hızına göre)
 */
export function estimateTravelTimeMinutes(distanceKm, isCityCenter = false) {
  const avgSpeedKmH = isCityCenter ? 40 : 70; // km/s
  return Math.round((distanceKm / avgSpeedKmH) * 60);
}

/**
 * Yakıt Tüketimi (Litre) & GLEC Standardı Karbon Emisyonu Hesabı
 * @param {number} totalKm - Toplam mesafe
 * @param {number} loadWeightTon - Yük ağırlığı (Ton)
 * @param {string} vehicleType - tir | kamyon | kamyonet | panelvan
 */
export function calculateFuelAndEmissions(totalKm, loadWeightTon = 5, vehicleType = "kamyon") {
  // Araç bazlı 100km'deki baz tüketim (litre)
  let baseConsumptionPer100Km = 24; // Kamyon varsayılan
  let emissionFactorKgPerLiter = 2.68; // Dizel yakıt CO2 katsayısı (kg CO2 / L)

  if (vehicleType === "tir") {
    baseConsumptionPer100Km = 33;
  } else if (vehicleType === "kamyonet") {
    baseConsumptionPer100Km = 14;
  } else if (vehicleType === "panelvan") {
    baseConsumptionPer100Km = 9.5;
  }

  // Yük ağırlığına bağlı ek tüketim (+%1.5 per ton)
  const loadAdjustment = 1 + (loadWeightTon * 0.015);
  const totalFuelLiters = Number(((totalKm / 100) * baseConsumptionPer100Km * loadAdjustment).toFixed(1));
  const totalCo2Kg = Number((totalFuelLiters * emissionFactorKgPerLiter).toFixed(1));

  // Tahmini yakıt masrafı (Dizel ~44 TL/L)
  const estimatedFuelCostTL = Math.round(totalFuelLiters * 44);

  return {
    fuelLiters: totalFuelLiters,
    co2Kg: totalCo2Kg,
    fuelCostTL: estimatedFuelCostTL
  };
}

/**
 * Mesafe Matrisi Oluşturucu
 */
export function buildDistanceMatrix(points) {
  const n = points.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else {
        matrix[i][j] = estimateRoadDistanceKm(
          points[i].lat,
          points[i].lng,
          points[j].lat,
          points[j].lng
        );
      }
    }
  }
  return matrix;
}

/**
 * 2-Opt Yerel Arama (Local Search) ile TSP / Rota İyileştirme Algoritması
 * Başlangıç noktasını (index 0) sabit tutar ve ara durakların sırasını optimize eder.
 */
export function solveOptimalRoute2Opt(points) {
  if (!points || points.length <= 2) {
    return {
      orderedPoints: points ? [...points] : [],
      totalDistanceKm: calculateRouteTotalDistance(points || []),
      savingsKm: 0,
      savingsPercent: 0
    };
  }

  const initialDistance = calculateRouteTotalDistance(points);
  const distMatrix = buildDistanceMatrix(points);
  const n = points.length;

  // 1. Adım: Nearest Neighbor ile ilk geçerli çözüm
  let tour = [0];
  let unvisited = new Set(Array.from({ length: n - 1 }, (_, i) => i + 1));

  while (unvisited.size > 0) {
    const current = tour[tour.length - 1];
    let nearest = null;
    let minDist = Infinity;

    for (const cand of unvisited) {
      if (distMatrix[current][cand] < minDist) {
        minDist = distMatrix[current][cand];
        nearest = cand;
      }
    }

    tour.push(nearest);
    unvisited.delete(nearest);
  }

  // 2. Adım: 2-Opt Çapraz Kaldırma / İyileştirme Döngüsü
  let improved = true;
  let maxIterations = 500;
  let iterations = 0;

  function calculateTourDistance(t) {
    let d = 0;
    for (let i = 0; i < t.length - 1; i++) {
      d += distMatrix[t[i]][t[i + 1]];
    }
    return d;
  }

  let bestDistance = calculateTourDistance(tour);

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        // 2-opt swap (i ile k arasını ters çevir)
        const newTour = [
          ...tour.slice(0, i),
          ...tour.slice(i, k + 1).reverse(),
          ...tour.slice(k + 1)
        ];

        const newDist = calculateTourDistance(newTour);
        if (newDist < bestDistance - 0.01) {
          tour = newTour;
          bestDistance = newDist;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  const orderedPoints = tour.map((idx) => points[idx]);
  const finalDistance = Number(bestDistance.toFixed(1));
  const savingsKm = Number(Math.max(0, initialDistance - finalDistance).toFixed(1));
  const savingsPercent = initialDistance > 0 ? Number(((savingsKm / initialDistance) * 100).toFixed(1)) : 0;

  return {
    orderedPoints,
    totalDistanceKm: finalDistance,
    savingsKm,
    savingsPercent,
    iterations
  };
}

/**
 * Bir durak dizisinin toplam mesafesini hesaplar
 */
export function calculateRouteTotalDistance(points) {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += estimateRoadDistanceKm(
      points[i].lat,
      points[i].lng,
      points[i + 1].lat,
      points[i + 1].lng
    );
  }
  return Number(total.toFixed(1));
}
