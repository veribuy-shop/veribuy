import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  Headers,
  UnauthorizedException,
  ParseUUIDPipe,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { TransactionsService } from './transactions.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, PaginationDto, Public } from '@veribuy/common';

interface AuthenticatedUser {
  userId: string;
  role: string;
}

/** Timing-safe comparison for internal service tokens. */
function validateInternalToken(provided: string | undefined): void {
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  if (!expected) {
    throw new UnauthorizedException('Server misconfiguration: INTERNAL_SERVICE_TOKEN not set');
  }
  if (!provided) {
    throw new UnauthorizedException('Invalid x-internal-service token');
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new UnauthorizedException('Invalid x-internal-service token');
  }
}

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('orders')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  createOrder(@Body() createOrderDto: CreateOrderDto, @CurrentUser() user: AuthenticatedUser) {
    if (createOrderDto.buyerId !== user.userId && user.role !== 'ADMIN') {
      throw new ForbiddenException('You can only create orders for yourself');
    }
    return this.transactionsService.createOrder(createOrderDto);
  }

  @Post('orders/:orderId/confirm-payment')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  async confirmPayment(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body('paymentIntentId') paymentIntentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const order = await this.transactionsService.getOrder(orderId);
    if (order.buyerId !== user.userId && user.role !== 'ADMIN') {
      throw new ForbiddenException('You can only confirm payment for your own orders');
    }
    return this.transactionsService.confirmPayment(orderId, paymentIntentId);
  }

  /**
   * Internal confirm-payment — called by the BFF Stripe webhook handler.
   * No JWT required; validated via x-internal-service header with timingSafeEqual.
   */
  @Post('orders/:orderId/confirm-payment/internal')
  @Public()
  async confirmPaymentInternal(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body('paymentIntentId') paymentIntentId: string,
    @Headers('x-internal-service') internalService: string,
  ) {
    validateInternalToken(internalService);
    return this.transactionsService.confirmPayment(orderId, paymentIntentId);
  }

  @Patch('orders/:orderId/status')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  async updateOrderStatus(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== 'ADMIN') {
      const order = await this.transactionsService.getOrder(orderId);
      if (order.buyerId !== user.userId && order.sellerId !== user.userId) {
        throw new ForbiddenException('You can only update orders you are involved in');
      }
    }
    return this.transactionsService.updateOrderStatus(orderId, updateOrderStatusDto, user.role);
  }

  /**
   * Internal status update — called by the BFF Stripe webhook handler.
   * No JWT required; validated via x-internal-service header with timingSafeEqual.
   * DI-03: The state machine is enforced for all callers — internal callers are
   * NOT granted full ADMIN bypass. Only transitions valid from the order's
   * current state are permitted.
   */
  @Patch('orders/:orderId/status/internal')
  @Public()
  async updateOrderStatusInternal(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
    @Headers('x-internal-service') internalService: string,
  ) {
    validateInternalToken(internalService);
    return this.transactionsService.updateOrderStatus(orderId, updateOrderStatusDto, 'INTERNAL');
  }

  /**
   * Lookup an order by Stripe PaymentIntent ID.
   * Validated via x-internal-service header with timingSafeEqual.
   */
  @Get('orders/by-payment-intent/:paymentIntentId')
  @Public()
  getOrderByPaymentIntentId(
    @Param('paymentIntentId') paymentIntentId: string,
    @Headers('x-internal-service') internalService: string,
  ) {
    validateInternalToken(internalService);
    return this.transactionsService.getOrderByPaymentIntentId(paymentIntentId);
  }

  @Get('orders')
  @Roles('ADMIN')
  getAllOrders(@Query() pagination: PaginationDto) {
    return this.transactionsService.getAllOrders(pagination);
  }

  @Get('orders/buyer/:buyerId')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  getOrdersByBuyer(
    @Param('buyerId', ParseUUIDPipe) buyerId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== 'ADMIN' && buyerId !== user.userId) {
      throw new ForbiddenException('You can only view your own orders');
    }
    return this.transactionsService.getOrdersByBuyer(buyerId, pagination);
  }

  @Get('orders/seller/:sellerId')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  getOrdersBySeller(
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== 'ADMIN' && sellerId !== user.userId) {
      throw new ForbiddenException('You can only view your own orders');
    }
    return this.transactionsService.getOrdersBySeller(sellerId, pagination);
  }

  @Get('orders/:orderId')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  async getOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const order = await this.transactionsService.getOrder(orderId);
    if (user.role !== 'ADMIN' && order.buyerId !== user.userId && order.sellerId !== user.userId) {
      throw new ForbiddenException('You can only view orders you are involved in');
    }
    return order;
  }

  @Post('orders/:orderId/refund')
  @Roles('ADMIN')
  refundOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.transactionsService.refundOrder(orderId);
  }
}
