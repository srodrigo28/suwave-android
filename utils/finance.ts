/**
 * Equivalente nativo (parcial) dos helpers de financeiro/historico em
 * app/motorista/src/app/page.tsx:2995-3322 e 4880-4928.
 */

export type PeriodKey = 'today' | 'yesterday' | '7d' | '15d' | '30d' | 'custom';

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  '7d': '7 dias',
  '15d': '15 dias',
  '30d': '30 dias',
  custom: 'Personalizado',
};

export const PERIOD_OPTIONS: PeriodKey[] = ['today', 'yesterday', '7d', '15d', '30d', 'custom'];

export type HistoryFilter = 'all' | 'ride' | 'delivery' | 'planned_trip' | 'completed' | 'cancelled';

export const HISTORY_FILTERS: { key: HistoryFilter; label: string; icon: string }[] = [
  { key: 'all', label: 'Todas', icon: 'calendar' },
  { key: 'ride', label: 'Corridas', icon: 'truck' },
  { key: 'delivery', label: 'Entregas', icon: 'box' },
  { key: 'planned_trip', label: 'Rotas', icon: 'map' },
  { key: 'completed', label: 'Concluídas', icon: 'check' },
  { key: 'cancelled', label: 'Recusadas', icon: 'x' },
];

export function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateToLocalInputValue(date: Date) {
  return toISODate(date);
}

export function addDaysToInputDate(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function getPeriodRange(period: PeriodKey, customRange: { start: string; end: string }) {
  const start = new Date();
  const end = new Date();

  if (period === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (period === '7d') {
    start.setDate(start.getDate() - 6);
  } else if (period === '15d') {
    start.setDate(start.getDate() - 14);
  } else if (period === '30d') {
    start.setDate(start.getDate() - 29);
  } else if (period === 'custom') {
    return {
      start: customRange.start || toISODate(start),
      end: customRange.end || toISODate(end),
    };
  }

  return { start: toISODate(start), end: toISODate(end) };
}

export function formatISODateLabel(value: string) {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }
  return `${day}/${month}/${year}`;
}

export function formatPeriodRangeLabel(start: string, end: string) {
  if (start === end) {
    return formatISODateLabel(start);
  }
  return `${formatISODateLabel(start)} - ${formatISODateLabel(end)}`;
}

export function getWeekdayLabel(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) {
    return '';
  }
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { weekday: 'narrow' }).toUpperCase();
}

export function formatFinanceCurrency(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    currency: 'BRL',
    style: 'currency',
  });
}

export function formatFinanceDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Data não informada';
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatOnlineDuration(seconds?: number | null) {
  const totalMinutes = Math.max(0, Math.round((seconds ?? 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

export function formatTripDistanceKm(distanceKm?: number | null) {
  if (!distanceKm || distanceKm <= 0) {
    return '-- km';
  }

  return `${distanceKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

export function formatTripDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) {
    return '--';
  }

  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}
