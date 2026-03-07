import { Controller, All, Req, Res, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

interface ServiceRoute {
  prefix: string;
  target: string;
}

@Controller('api')
export class ProxyController {
  private routes: ServiceRoute[];

  constructor(private configService: ConfigService) {
    this.routes = [
      { prefix: 'auth', target: `http://auth-service:${this.configService.get('AUTH_SERVICE_PORT', 3001)}` },
      { prefix: 'users', target: `http://user-service:${this.configService.get('USER_SERVICE_PORT', 3002)}` },
      { prefix: 'listings', target: `http://listing-service:${this.configService.get('LISTING_SERVICE_PORT', 3003)}` },
      { prefix: 'trust-lens', target: `http://trust-lens-service:${this.configService.get('TRUST_LENS_SERVICE_PORT', 3004)}` },
      { prefix: 'device-verification', target: `http://device-verification-service:${this.configService.get('DEVICE_VERIFICATION_SERVICE_PORT', 3005)}` },
      { prefix: 'evidence', target: `http://evidence-service:${this.configService.get('EVIDENCE_SERVICE_PORT', 3006)}` },
      { prefix: 'transactions', target: `http://transaction-service:${this.configService.get('TRANSACTION_SERVICE_PORT', 3007)}` },
      { prefix: 'notifications', target: `http://notification-service:${this.configService.get('NOTIFICATION_SERVICE_PORT', 3008)}` },
    ];
  }

  @All('*')
  async proxy(@Req() req: Request, @Res() res: Response) {
    // Extract path after /api/
    const fullPath = req.url.split('?')[0]; // Remove query string
    const apiPrefix = '/api/';
    if (!fullPath.startsWith(apiPrefix)) {
      throw new HttpException('Invalid request', HttpStatus.BAD_REQUEST);
    }
    
    const path = fullPath.substring(apiPrefix.length);
    const segments = path.split('/').filter(s => s); // Remove empty segments
    const servicePrefix = segments[0];

    if (!servicePrefix) {
      throw new HttpException('Service not specified', HttpStatus.BAD_REQUEST);
    }

    const route = this.routes.find((r) => r.prefix === servicePrefix);
    if (!route) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }

    const servicePath = segments.slice(1).join('/');
    const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    const targetUrl = servicePath 
      ? `${route.target}/${servicePrefix}/${servicePath}${queryString}`
      : `${route.target}/${servicePrefix}${queryString}`;

    try {
      const headers: Record<string, string> = {};
      if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
      }
      headers['Content-Type'] = req.headers['content-type'] || 'application/json';

      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      throw new HttpException('Service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
