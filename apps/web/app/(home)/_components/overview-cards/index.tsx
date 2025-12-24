'use client';

import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Activity, AlertTriangle, Clock, DollarSign, Package, Users } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminDashboardStats } from '@/hooks/useAdminDashboardStats';

import { OverviewCardsSkeleton } from './skeleton';

type IconEntry = {
  icon: LucideIcon;
  className?: string;
};

const ICON_MAP: Record<string, IconEntry> = {
  total_quotes: { icon: Package, className: 'text-primary' },
  pending_quotes: { icon: Clock, className: 'text-amber-500' },
  booking_revenue: { icon: DollarSign, className: 'text-emerald-600' },
  active_customers: { icon: Users, className: 'text-sky-500' },
};

const defaultCurrency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

const formatValue = (value: number, unit: 'count' | 'currency' | 'percentage', currency?: string) => {
  if (unit === 'currency') {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency ?? 'USD',
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return defaultCurrency.format(value);
    }
  }

  if (unit === 'percentage') {
    return `${value.toFixed(1)}%`;
  }

  return value.toLocaleString();
};

const formatDelta = (
  delta?: {
    absolute: number;
    relative?: number | null;
    direction: 'increase' | 'decrease' | 'flat';
    comparedTo?: string;
  },
) => {
  if (!delta) {
    return { label: 'Stable vs prior period', tone: 'text-muted-foreground' };
  }

  const prefix = delta.direction === 'decrease' ? '' : '+';
  const relative = delta.relative ?? null;
  const valueLabel = relative !== null ? `${prefix}${(relative * 100).toFixed(1)}%` : `${prefix}${delta.absolute.toLocaleString()}`;
  const suffix = delta.comparedTo ? ` vs ${delta.comparedTo}` : ' vs prior period';

  const tone = delta.direction === 'increase' ? 'text-emerald-600' : delta.direction === 'decrease' ? 'text-red-600' : 'text-muted-foreground';

  return { label: `${valueLabel}${suffix}`, tone };
};

export function OverviewCardsGroup({ period = '30d' }: { period?: string }) {
  const { data, isLoading, isError, error } = useAdminDashboardStats(period);

  const kpis = data?.kpis ?? [];

  const cards = useMemo(() => kpis.map((kpi) => {
    const { icon, className } = ICON_MAP[kpi.id] ?? { icon: Activity, className: 'text-muted-foreground' };
    const delta = formatDelta(kpi.delta ? {
      absolute: kpi.delta.absolute,
      relative: kpi.delta.relative ?? null,
      direction: kpi.delta.direction,
      comparedTo: kpi.delta.comparedTo,
    } : undefined);

    return {
      id: kpi.id,
      label: kpi.label,
      value: formatValue(kpi.value, kpi.unit, kpi.currency),
      delta,
      Icon: icon,
      iconClass: className,
    };
  }), [kpis]);

  if (isLoading) {
    return <OverviewCardsSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex items-center gap-3 rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        <span>{error?.message ?? 'Unable to load dashboard metrics.'}</span>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
        No dashboard metrics available for the selected window.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.id} className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {card.label}
            </CardTitle>
            <card.Icon className={`h-4 w-4 ${card.iconClass ?? 'text-primary'}`} aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-dark dark:text-white">{card.value}</div>
            <p className={`text-xs ${card.delta.tone}`}>{card.delta.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
