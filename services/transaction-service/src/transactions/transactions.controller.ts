import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ForbiddenException, Headers, UnauthorizedException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, PaginationDto, Public } from '@veribuy/common';

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('orders')
  @Roles('USER', 'ADMIN')
  createOrder(@Body() createOrderDto: CreateOrderDto, @CurrentUser() user: any) {
    if (createOrderDto.buyerId !== user.userId && user.role !== 'ADMIN') {
      throw new ForbiddenException('You can only create orders for yourself');
    }
    return this.transactionsService.createOrder(createOrderDto);
  }

  @Post('orders/:orderId/confirm-payment')
  @Roles('USER', 'ADMIN')
  async confirmPayment(
    @Param('orderId') orderId: string,
    @Body('paymentIntentId') paymentIntentId: string,
    @CurrentUser() user: any,
  ) {
    const order = await this.transactionsService.getOrder(orderId);
    if (order.buyerId !== user.userId && user.role !== 'ADMIN') {
      throw new ForbiddenException('You can only confirm payment for your own orders');
    }
    return this.transactionsService.confirmPayment(orderId, paymentIntentId);
  }

  /**
   * Internal confirm-payment — called by the BFF Stripe webhook handler.
   * No JWT required; validated via x-internal-service header.
   */
  @Post('orders/:orderId/confirm-payment/internal')
  @Public()
  async confirmPaymentInternal(
    @Param('orderId') orderId: string,
    @Body('paymentIntentId') paymentIntentId: string,
    @Headers('x-internal-service') internalService: string,
  ) {
    if (!internalService || internalService !== process.env.INTERNAL_SERVICE_TOKEN) {
      throw new UnauthorizedException('Invalid x-internal-service token');
    }
    return this.transactionsService.confirmPayment(orderId, paymentIntentId);
  }

  @Patch('orders/:orderId/status')
  @Roles('USER', 'ADMIN')
  async updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
    @CurrentUser() user: any,
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
   * No JWT required; validated via x-internal-service header.
   * Actor role is treated as ADMIN to bypass state machine ownership check.
   */
  @Patch('orders/:orderId/status/internal')
  @Public()
  async updateOrderStatusInternal(
    @Param('orderId') orderId: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
    @Headers('x-internal-service') internalService: string,
  ) {
    if (!internalService || internalService !== process.env.INTERNAL_SERVICE_TOKEN) {
      throw new UnauthorizedException('Invalid x-internal-service token');
    }
    return this.transactionsService.updateOrderStatus(orderId, updateOrderStatusDto, 'ADMIN');
  }

  /**
   * Lookup an order by Stripe PaymentIntent ID.
   * Used by the BFF Stripe webhook handler to find orders when Stripe fires events.
   * Marked @Public() but requires the x-internal-service header — same pattern as
   * notification-service's /messages/internal endpoint.
   */
  @Get('orders/by-payment-intent/:paymentIntentId')
  @Public()
  getOrderByPaymentIntentId(
    @Param('paymentIntentId') paymentIntentId: string,
    @Headers('x-internal-service') internalService: string,
  ) {
    if (!internalService || internalService !== process.env.INTERNAL_SERVICE_TOKEN) {
      throw new UnauthorizedException('Invalid x-internal-service token');
    }
    return this.transactionsService.getOrderByPaymentIntentId(paymentIntentId);
  }

  @Get('orders')
  @Roles('ADMIN')
  getAllOrders(@Query() pagination: PaginationDto) {
    return this.transactionsService.getAllOrders(pagination);
  }

  @Get('orders/buyer/:buyerId')
  @Roles('USER', 'ADMIN')
  getOrdersByBuyer(@Param('buyerId') buyerId: string, @Query() pagination: PaginationDto, @CurrentUser() user: any) {
    if (user.role !== 'ADMIN' && buyerId !== user.userId) {
      throw new ForbiddenException('You can only view your own orders');
    }
    return this.transactionsService.getOrdersByBuyer(buyerId, pagination);
  }

  @Get('orders/seller/:sellerId')
  @Roles('USER', 'ADMIN')
  getOrdersBySeller(@Param('sellerId') sellerId: string, @Query() pagination: PaginationDto, @CurrentUser() user: any) {
    if (user.role !== 'ADMIN' && sellerId !== user.userId) {
      throw new ForbiddenException('You can only view your own orders');
    }
    return this.transactionsService.getOrdersBySeller(sellerId, pagination);
  }

  @Get('orders/:orderId')
  @Roles('USER', 'ADMIN')
  async getOrder(@Param('orderId') orderId: string, @CurrentUser() user: any) {
    const order = await this.transactionsService.getOrder(orderId);
    if (user.role !== 'ADMIN' && order.buyerId !== user.userId && order.sellerId !== user.userId) {
      throw new ForbiddenException('You can only view orders you are involved in');
    }
    return order;
  }

  @Post('orders/:orderId/refund')
  @Roles('ADMIN')
  refundOrder(@Param('orderId') orderId: string) {
    return this.transactionsService.refundOrder(orderId);
  }
}
