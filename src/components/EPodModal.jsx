import React, { useRef, useState, useEffect } from "react";
import { X, CheckCircle, RefreshCw, Camera, PenTool, MapPin, User, Phone, ShieldCheck } from "lucide-react";
import { submitProofOfDelivery } from "../lib/api";

export default function EPodModal({ shipment, onClose, onSuccess }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const [aliciAdSoyad, setAliciAdSoyad] = useState(shipment?.tarafAdi || "");
  const [aliciTelefon, setAliciTelefon] = useState(shipment?.tarafTelefon || "");
  const [aliciTc, setAliciTc] = useState("");
  const [notlar, setNotlar] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Otomatik GPS konumu al
  useEffect(() => {
    if ("geolocation" in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
            accuracy: Math.round(pos.coords.accuracy)
          });
          setIsLocating(false);
        },
        (err) => {
          console.warn("GPS konumu alınamadı:", err);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // Canvas çizim fonksiyonları
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e293b";
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!aliciAdSoyad.trim()) {
      setError("Lütfen teslim alan kişi adını girin.");
      return;
    }
    if (!hasSignature) {
      setError("Lütfen dijital imza alanını doldurun.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const canvas = canvasRef.current;
      const imzaBase64 = canvas ? canvas.toDataURL("image/png") : "";

      await submitProofOfDelivery({
        shipmentId: shipment.id,
        aliciAdSoyad: aliciAdSoyad.trim(),
        aliciTelefon: aliciTelefon.trim() || null,
        aliciTcVeyaUnvan: aliciTc.trim() || null,
        imzaBase64,
        teslimFotografiUrl: photoPreview,
        teslimLat: gpsCoords?.lat || null,
        teslimLng: gpsCoords?.lng || null,
        notlar: notlar.trim() || null
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err?.message || "Teslim kanıtı kaydedilirken hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden my-8">
        {/* Başlık */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Dijital Teslim Kanıtı (e-POD)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-sm">
              {error}
            </div>
          )}

          {/* Sevkiyat Bilgi Özeti */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Sevkiyat / Alıcı:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{shipment?.tarafAdi}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Ürün:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{shipment?.urunAdi || "Genel Kargo"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Varış Adresi:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{shipment?.varisKonumu || "-"}</span>
            </div>
          </div>

          {/* Form Alanları */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Teslim Alan Ad Soyad *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={aliciAdSoyad}
                  onChange={(e) => setAliciAdSoyad(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Ahmet Yılmaz"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Telefon Numarası
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={aliciTelefon}
                  onChange={(e) => setAliciTelefon(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="0532 000 0000"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              T.C. Kimlik No veya Şirket Ünvanı (Opsiyonel)
            </label>
            <input
              type="text"
              value={aliciTc}
              onChange={(e) => setAliciTc(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="11 haneli T.C. veya Kaşe bilgisi"
            />
          </div>

          {/* Dijital İmza Alanı */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                <PenTool className="w-3.5 h-3.5 text-emerald-600" />
                Teslim Alanın Islak/Dijital İmzası *
              </label>
              <button
                type="button"
                onClick={clearSignature}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Temizle
              </button>
            </div>
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-1 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
              <canvas
                ref={canvasRef}
                width={480}
                height={160}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-36 bg-white dark:bg-slate-900 rounded-lg cursor-crosshair touch-none shadow-inner"
              />
              <span className="text-[11px] text-slate-400 py-1">
                {hasSignature ? "✓ İmza kaydedildi" : "Parmağınız veya mouse ile kutu içine imza atınız"}
              </span>
            </div>
          </div>

          {/* Fotoğraf ve GPS Kanıtı */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Teslim Fotoğrafı (Opsiyonel)
              </label>
              <label className="flex flex-col items-center justify-center p-3 border border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                {photoPreview ? (
                  <img src={photoPreview} alt="Teslim kanıtı" className="h-16 object-cover rounded-lg" />
                ) : (
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <span>Fotoğraf Ekle</span>
                  </div>
                )}
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                GPS Konum Doğrulaması
              </label>
              <div className="p-3 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2 h-16">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                {isLocating ? (
                  <span className="text-slate-500 animate-pulse">Konum alınıyor...</span>
                ) : gpsCoords ? (
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    <div>{gpsCoords.lat}, {gpsCoords.lng}</div>
                    <div className="text-emerald-600 font-medium">✓ ±{gpsCoords.accuracy}m doğruluk</div>
                  </div>
                ) : (
                  <span className="text-slate-400 text-[11px]">GPS bilgisi alınamadı (manuel onay)</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Teslimat Notu
            </label>
            <input
              type="text"
              value={notlar}
              onChange={(e) => setNotlar(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Hasarsız ve eksiksiz teslim edildi."
            />
          </div>

          {/* Butonlar */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition"
            >
              <CheckCircle className="w-4 h-4" />
              {saving ? "Kaydediliyor..." : "Teslimatı Onayla & İmzala"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
