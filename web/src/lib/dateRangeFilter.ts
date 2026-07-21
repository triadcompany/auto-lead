import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from "date-fns";

export const PERIOD_OPTIONS = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "semana_passada", label: "Semana Passada" },
  { value: "este_mes", label: "Este Mês" },
  { value: "mes_passado", label: "Mês Passado" },
  { value: "ultimos_3_meses", label: "Últimos 3 Meses" },
  { value: "custom", label: "Data Personalizada" },
  { value: "maximo", label: "Máximo" },
] as const;

export function getDateRange(period: string, customDateRange?: { from?: Date; to?: Date }) {
  const now = new Date();
  switch (period) {
    case "hoje":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "ontem": {
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    }
    case "semana_passada":
      return { start: startOfWeek(subWeeks(now, 1)), end: endOfWeek(subWeeks(now, 1)) };
    case "este_mes":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "mes_passado": {
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
    case "ultimos_3_meses":
      return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    case "custom":
      if (customDateRange?.from && customDateRange?.to) {
        return { start: startOfDay(customDateRange.from), end: endOfDay(customDateRange.to) };
      }
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "maximo":
      return { start: new Date(2020, 0, 1), end: now };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}
