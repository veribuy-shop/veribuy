import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return this.tryOptionalAuth(context);
    }

    return super.canActivate(context);
  }

  /**
   * Public routes still identify the caller when a bearer token is sent, so
   * handlers can tailor responses (e.g. owners viewing their unpublished
   * listing). An invalid or missing token simply means "anonymous".
   */
  private async tryOptionalAuth(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request?.headers?.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return true;
    }
    try {
      await super.canActivate(context);
    } catch {
      request.user = undefined;
    }
    return true;
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
