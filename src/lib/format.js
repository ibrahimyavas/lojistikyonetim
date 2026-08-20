export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function trDate(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

// String comparison works correctly for ISO "YYYY-MM-DD" dates - no Date
// parsing/timezone ambiguity needed.
export function isPastDate(iso) {
  if (!iso) return false;
  return iso < todayISO();
}

const TURKISH_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

// "2026-08-19" -> "Bugün" / "Dün" / "19 Ağustos 2026" - the header shown
// above each day's group in the date-grouped tables (Sevkiyat, Depo
// Transferleri).
export function dayLabel(iso) {
  if (!iso) return "Tarihsiz";
  if (iso === todayISO()) return "Bugün";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  // UTC-based, matching todayISO()'s own convention (see its definition) so
  // "Dün" and "Bugün" never disagree with each other near midnight.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (iso === yesterday) return "Dün";
  return `${d} ${TURKISH_MONTHS[m - 1] ?? m} ${y}`;
}

// Buckets `items` by the date `getDate(item)` returns ("YYYY-MM-DD" or
// falsy), most recent day first; undated items land in one "Tarihsiz"
// bucket at the end rather than being scattered or dropped.
export function groupByDate(items, getDate) {
  const buckets = new Map(); // dateKey ("" = undated) -> items[]
  for (const item of items) {
    const key = getDate(item) || "";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  const dated = [...buckets.entries()]
    .filter(([key]) => key !== "")
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, groupItems]) => ({ key, label: dayLabel(key), items: groupItems }));
  const undated = buckets.get("");
  if (undated?.length) dated.push({ key: "undated", label: "Tarihsiz", items: undated });
  return dated;
}
