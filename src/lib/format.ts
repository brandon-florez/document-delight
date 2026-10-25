export const BUSINESS_TZ = "America/Mexico_City";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Today's date (YYYY-MM-DD) in the business time zone. */
export function todayInBusinessTz(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(now);
}

function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, amount: number): string {
  const date = parseDay(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return toDay(date);
}

export function currentPeriod(now: Date = new Date()) {
  const [year, month] = todayInBusinessTz(now).split("-").map(Number);
  return { year: year!, month: month! };
}

/** First and last day (YYYY-MM-DD) of a month. */
export function monthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = new Date(Date.UTC(year, month, 1));
  return { start, end: addDays(toDay(next), -1) };
}

/** Monday and Sunday (YYYY-MM-DD) of the current week in the business time zone. */
export function currentWeek(now: Date = new Date()) {
  const today = todayInBusinessTz(now);
  const isoDay = parseDay(today).getUTCDay() || 7;
  const monday = addDays(today, 1 - isoDay);
  return { monday, sunday: addDays(monday, 6) };
}

export function monthLabel(year: number, month: number) {
  return `${MONTHS[month - 1]} ${year}`;
}

export function formatMoney(amount: number | null | undefined, currency: "USD" | "MXN") {
  const formatted = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
  return `${formatted} ${currency}`;
}

/** Worked time for the portal. Short sessions stay visible as minutes. */
export function formatMinutes(minutes: number | null | undefined) {
  const total = Math.max(0, Math.round(minutes ?? 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

export function formatHours(hours: number | null | undefined) {
  return formatMinutes((hours ?? 0) * 60);
}

/** "10 min registrados", "2 h registradas" o "1 h 8 min registrados". */
export function formatWorkedTime(hours: number | null | undefined) {
  const total = Math.max(0, Math.round((hours ?? 0) * 60));
  const wholeHours = Math.floor(total / 60);
  const mins = total % 60;
  const agreement = wholeHours > 0 && mins === 0 ? "registradas" : "registrados";
  return `${formatMinutes(total)} ${agreement}`;
}

export function formatDay(day: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDay(day));
}

export function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BUSINESS_TZ,
  }).format(new Date(timestamp));
}

export function formatDateTime(timestamp: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BUSINESS_TZ,
  }).format(new Date(timestamp));
}

/** Same folio the issue-invoice Edge Function sends to the PAC. */
export function invoiceLabel(invoice: { id: string; year: number; month: number }) {
  return `FAC-${invoice.year}${String(invoice.month).padStart(2, "0")}-${invoice.id
    .slice(0, 6)
    .toUpperCase()}`;
}
