'use client';

import { AlertTriangle, CheckCircle2, CircleHelp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deskTheme } from './shared';

type ServiceHealth = { name: string; status: string; responseTime: number };
type HealthData = { timestamp: string; overall: string; services: ServiceHealth[] } | null;

const STATUS_TEXT: Record<string, { label: string; tone: string }> = {
  healthy: { label: 'Working', tone: 'text-emerald-700' },
  degraded: { label: 'Having problems', tone: 'text-amber-700' },
  unhealthy: { label: 'Not responding', tone: 'text-red-700' },
};

/** Shows only what the last health check actually measured. */
export function SystemHealth({ data, loading, isDarkMode }: { data: HealthData; loading: boolean; isDarkMode: boolean }) {
  const theme = deskTheme(isDarkMode);

  if (!data) {
    return (
      <section className={cn('border rounded-2xl p-6 flex items-center gap-3', theme.card)} role="status">
        <CircleHelp className="w-5 h-5 text-slate-400" aria-hidden="true" />
        <p className={cn('text-sm', theme.muted)}>
          {loading ? 'Checking the system…' : 'We could not get a health result. Use Refresh to try again, and treat the status as unknown until then.'}
        </p>
      </section>
    );
  }

  const overall = STATUS_TEXT[data.overall] ?? { label: 'Unknown', tone: theme.muted };
  const allGood = data.overall === 'healthy';
  return (
    <div className="space-y-4">
      <section className={cn('border rounded-2xl p-5 flex items-center gap-3', theme.card)}>
        {allGood ? <CheckCircle2 className="w-6 h-6 text-emerald-600" aria-hidden="true" /> : <AlertTriangle className="w-6 h-6 text-amber-600" aria-hidden="true" />}
        <div>
          <h3 className={cn('text-base font-bold', overall.tone)}>{allGood ? 'Everything is working' : `System ${overall.label.toLowerCase()}`}</h3>
          <p className={cn('text-xs', theme.muted)}>Last checked {new Date(data.timestamp).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' })}</p>
        </div>
      </section>
      <section className={cn('border rounded-2xl overflow-hidden', theme.card)} aria-label="Services">
        <table className="w-full text-left text-xs">
          <thead className={theme.head}>
            <tr>
              <th className="p-3 font-semibold">Service</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold text-right">Response</th>
            </tr>
          </thead>
          <tbody className={cn('divide-y', theme.divider)}>
            {data.services.map((service) => {
              const status = STATUS_TEXT[service.status] ?? { label: service.status, tone: theme.muted };
              return (
                <tr key={service.name}>
                  <td className={cn('p-3 font-medium', theme.text)}>{service.name}</td>
                  <td className={cn('p-3 font-semibold', status.tone)}>{status.label}</td>
                  <td className={cn('p-3 text-right', theme.muted)}>{service.responseTime >= 0 ? `${Math.round(service.responseTime)} ms` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
