import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, Public } from '@veribuy/common';
import { InvoicesService } from './invoices.service';
import { PaginationDto } from '@veribuy/common';
import * as nodeCrypto from 'crypto';

interface JwtUser {
  userId: string;
  role: string;
}

function validateInternalToken(req: { headers: Record<string, string | string[] | undefined> }): void {
  const token = req.headers['x-internal-service'];
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  if (!token || !expected) {
    throw new UnauthorizedException();
  }
  const tokenStr = Array.isArray(token) ? token[0] : token;
  const a = Buffer.from(tokenStr);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !nodeCrypto.timingSafeEqual(a, b)) {
    throw new UnauthorizedException();
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('transactions/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  /**
   * GET /transactions/invoices — Admin: list all invoices
   */
  @Get()
  @Roles('ADMIN')
  async getAllInvoices(@Query() pagination: PaginationDto) {
    return this.invoicesService.getAllInvoices(pagination);
  }

  /**
   * GET /transactions/invoices/buyer/:buyerId — Buyer's own invoices
   */
  @Get('buyer/:buyerId')
  @Roles('BUYER', 'ADMIN')
  async getInvoicesByBuyer(
    @Param('buyerId') buyerId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: JwtUser,
  ) {
    if (user.role !== 'ADMIN' && user.userId !== buyerId) {
      throw new ForbiddenException();
    }
    return this.invoicesService.getInvoicesByBuyer(buyerId, pagination);
  }

  /**
   * GET /transactions/invoices/order/:orderId — All invoices for an order
   */
  @Get('order/:orderId')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  async getInvoicesByOrder(@Param('orderId') orderId: string) {
    return this.invoicesService.getInvoicesByOrder(orderId);
  }

  /**
   * GET /transactions/invoices/:invoiceId — Get a single invoice
   */
  @Get(':invoiceId')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  async getInvoice(
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.invoicesService.getInvoice(invoiceId, user.userId, user.role === 'ADMIN');
  }

  /**
   * GET /transactions/invoices/order/:orderId/internal — Internal service call
   */
  @Public()
  @Get('order/:orderId/internal')
  async getInvoicesByOrderInternal(
    @Param('orderId') orderId: string,
    @Req() req: { headers: Record<string, string | string[] | undefined> },
  ) {
    validateInternalToken(req);
    return this.invoicesService.getInvoicesByOrder(orderId);
  }
}
