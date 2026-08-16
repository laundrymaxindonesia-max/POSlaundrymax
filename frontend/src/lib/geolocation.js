/**
 * getGeolocation — thin promise wrapper around navigator.geolocation.
 *
 * Returns `{ lat, lng, accuracy }` on success. Rejects with a user-facing
 * Error message on failure so callers can toast the reason directly.
 *
 * Uses `enableHighAccuracy: true` for GPS-grade fix (~5m), which drains
 * battery a bit more but is the right trade-off for attendance + delivery
 * proof. Timeout defaults to 10s so we don't hang the UI when a fix isn't
 * possible (indoor kiosks, airplane mode).
 */
export function getGeolocation({ timeout = 10000, maximumAge = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Perangkat tidak mendukung GPS / geolocation."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy, // in meters
        });
      },
      (err) => {
        const msgs = {
          1: "Akses lokasi ditolak. Aktifkan izin GPS di browser lalu coba lagi.",
          2: "Lokasi tidak tersedia (sinyal GPS lemah).",
          3: "Timeout — sinyal GPS terlalu lambat. Coba dekat jendela / di luar ruangan.",
        };
        reject(new Error(msgs[err.code] || `Gagal mengambil lokasi: ${err.message}`));
      },
      { enableHighAccuracy: true, timeout, maximumAge }
    );
  });
}
