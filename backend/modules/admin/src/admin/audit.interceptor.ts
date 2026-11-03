import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../../../src/database/prisma.service';

const UUID = '[0-9a-fA-F-]{36}';

/** The admin actions worth recording. Anything else an admin does isn't logged. */
const AUDITED_ACTIONS: { method: string; path: RegExp; action: string; targetType: string }[] = [
  { method: 'PUT', path: new RegExp(`^/listings/(${UUID})/status$`), action: 'Changed listing status', targetType: 'listing' },
  { method: 'PATCH', path: new RegExp(`^/listings/(${UUID})$`), action: 'Edited listing', targetType: 'listing' },
  { method: 'DELETE', path: new RegExp(`^/listings/(${UUID})$`), action: 'Deleted listing', targetType: 'listing' },
  { method: 'PATCH', path: new RegExp(`^/trust-lens/(${UUID})/status$`), action: 'Reviewed listing', targetType: 'listing' },
  { method: 'POST', path: new RegExp(`^/trust-lens/(${UUID})/rerun$`), action: 'Re-ran device check', targetType: 'listing' },
  { method: 'PATCH', path: new RegExp(`^/transactions/orders/(${UUID})/status$`), action: 'Changed order status', targetType: 'order' },
  { method: 'POST', path: new RegExp(`^/transactions/orders/(${UUID})/refund$`), action: 'Refunded order', targetType: 'order' },
  { method: 'DELETE', path: new RegExp(`^/transactions/orders/(${UUID})$`), action: 'Deleted unpaid order', targetType: 'order' },
  { method: 'PATCH', path: new RegExp(`^/auth/admin/users/(${UUID})$`), action: 'Changed user', targetType: 'user' },
  { method: 'DELETE', path: new RegExp(`^/auth/admin/users/(${UUID})$`), action: 'Deleted user', targetType: 'user' },
];

/** Builds the note from named fields only, so passwords or tokens can never reach the log. */
export function auditNote(body: Record<string, unknown> | undefined): string | null {
  if (!body) return null;
  const parts: string[] = [];
  for (const key of ['status', 'role', 'isActive']) {
    if (body[key] !== undefined && body[key] !== null) parts.push(`${key}: ${String(body[key])}`);
  }
  const reason = body.reason ?? body.reviewNotes;
  if (typeof reason === 'string' && reason.trim()) parts.push(reason.trim().slice(0, 500));
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Records successful admin actions. A logging failure never blocks the action itself. */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AdminAuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    if (request?.user?.role !== 'ADMIN') return next.handle();

    const path = String(request.originalUrl ?? request.url ?? '').split('?')[0];
    for (const entry of AUDITED_ACTIONS) {
      const match = request.method === entry.method ? entry.path.exec(path) : null;
      if (!match) continue;
      return next.handle().pipe(
        tap(() => {
          this.prisma.adminAuditLog
            .create({
              data: {
                adminId: request.user.userId,
                action: entry.action,
                targetType: entry.targetType,
                targetId: match[1],
                note: auditNote(request.body),
              },
            })
            .catch((err: Error) => this.logger.error(`Failed to record admin action: ${err.message}`));
        }),
      );
    }
    return next.handle();
  }
}
