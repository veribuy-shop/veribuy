import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  Headers,
  UnauthorizedException,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import * as crypto from 'crypto';
import { TransactionsService } from './transactions.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateShippingDto } from './dto/update-shipping.dto';
import { RateOrderDto } from './dto/rate-order.dto';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, PaginationDto, Public, RoyalMailServiceTier } from '@veribuy/common';

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

  @Get('shipping/weight-profile')
  @Public()
  getWeightProfile(
    @Query('deviceType') deviceType: string = 'SMARTPHONE',
    @Query('brand') brand?: string,
    @Query('model') model?: string,
    @Query('quantity') quantity?: string,
  ) {
    const qty = quantity ? parseInt(quantity, 10) : 1;
    return this.transactionsService.getDeviceWeightProfile(deviceType, brand, model, isNaN(qty) ? 1 : qty);
  }

  @Get('shipping/quote')
  @Public()
  getShippingQuote(
    @Query('deviceType') deviceType: string = 'SMARTPHONE',
    @Query('brand') brand?: string,
    @Query('model') model?: string,
    @Query('quantity') quantity?: string,
    @Query('serviceTier') serviceTier: RoyalMailServiceTier = 'TRACKED_48',
    @Query('postcode') postcode?: string,
    @Query('itemValue') itemValue?: string,
  ) {
    const qty = quantity ? parseInt(quantity, 10) : 1;
    const val = itemValue ? parseFloat(itemValue) : undefined;
    return this.transactionsService.calculateShippingRate(deviceType, serviceTier, {
      brand,
      model,
      quantity: isNaN(qty) ? 1 : qty,
      destinationPostcode: postcode,
      itemValue: val && !isNaN(val) ? val : undefined,
    });
  }

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

  /**
   * Update shipping details on a PENDING order before payment.
   * Updates both the DB record and the Stripe PaymentIntent amount.
   */
  @Patch('orders/:orderId/shipping')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  async updateShipping(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() updateShippingDto: UpdateShippingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionsService.updateShipping(orderId, user.userId, updateShippingDto);
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
    // The acting party (buyer vs seller) is resolved from the order itself —
    // the global role alone is not sufficient to authorise a transition.
    return this.transactionsService.updateOrderStatus(
      orderId,
      updateOrderStatusDto,
      user.role,
      user.userId,
    );
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

  @Get('orders/:orderId/shipping-label')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  async getShippingLabel(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.transactionsService.getOrderShippingLabel(
      orderId,
      user.userId,
      user.role,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="royal-mail-label-${orderId.substring(0, 8)}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.end(pdfBuffer);
  }

  @Get('orders/:orderId/dropoff-locations')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  async getDropoffLocations(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Query('postcode') postcode: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionsService.getOrderDropoffLocations(
      orderId,
      user.userId,
      user.role,
      postcode,
    );
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

  @Delete('orders/:orderId')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  async deletePendingOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionsService.deletePendingOrder(orderId, user.userId, user.role);
  }

  @Post('orders/:orderId/refund')
  @Roles('ADMIN')
  refundOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.transactionsService.refundOrder(orderId);
  }

  @Post('orders/:orderId/rate')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  async rateOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() rateOrderDto: RateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionsService.rateOrder(orderId, user.userId, rateOrderDto);
  }

  @Get('orders/:orderId/rating')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  async getOrderRating(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const order = await this.transactionsService.getOrder(orderId);
    if (user.role !== 'ADMIN' && order.buyerId !== user.userId && order.sellerId !== user.userId) {
      throw new ForbiddenException('You can only view ratings for orders you are involved in');
    }
    return this.transactionsService.getOrderRating(orderId);
  }

  @Get('sellers/:sellerId/ratings')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  getSellerRatings(@Param('sellerId', ParseUUIDPipe) sellerId: string) {
    return this.transactionsService.getSellerRatings(sellerId);
  }
}
