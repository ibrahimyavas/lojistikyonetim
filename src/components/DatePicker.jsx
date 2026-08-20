import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { trDate, todayISO } from "../lib/format.js";

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function toISO(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// JS's getDay() is Sunday-first (0=Sun); we want Monday-first columns.
function mondayIndex(jsDay) {
  return (jsDay + 6) % 7;
}

function partsOf(iso) {
  if (iso && /^\d{4}-\d{2}-\d{2}/.test(iso)) {
    const [y, m] = iso.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

// Drop-in replacement for <input type="date">: same value/onChange contract
// (ISO "YYYY-MM-DD" in, ISO string out) but a calendar dropdown styled to
// match the app instead of the browser's native (inconsistent-looking)
// picker.
export default function DatePicker({ id, value, onChange, placeholder = "Tarih seçin", allowClear = false }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => partsOf(value));
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openCalendar() {
    setView(partsOf(value)); // re-sync to current value (or today) each open
    setOpen((v) => !v);
  }

  function shiftMonth(delta) {
    setView(({ year, month }) => {
      const total = year * 12 + month + delta;
      return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
    });
  }

  function selectDay(day) {
    onChange(toISO(view.year, view.month, day));
    setOpen(false);
  }

  const totalDays = daysInMonth(view.year, view.month);
  const leadingBlanks = mondayIndex(new Date(view.year, view.month, 1).getDay());
  const today = todayISO();

  return (
    <div className="date-picker" ref={rootRef}>
      <button type="button" id={id} className="date-picker-trigger" onClick={openCalendar}>
        <CalendarDays size={14} />
        {value ? trDate(value) : <span className="muted">{placeholder}</span>}
      </button>

      {open && (
        <div className="date-picker-panel">
          <div className="date-picker-header">
            <button type="button" className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Önceki ay">
              <ChevronLeft size={14} />
            </button>
            <span>
              {MONTHS[view.month]} {view.year}
            </span>
            <button type="button" className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Sonraki ay">
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="date-picker-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="date-picker-grid">
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
              const iso = toISO(view.year, view.month, day);
              return (
                <button
                  type="button"
                  key={iso}
                  className={`date-picker-day ${iso === today ? "is-today" : ""} ${iso === value ? "is-selected" : ""}`}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="date-picker-footer">
            <button
              type="button"
              className="date-picker-link"
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
            >
              Bugün
            </button>
            {allowClear && (
              <button
                type="button"
                className="date-picker-link"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Temizle
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
