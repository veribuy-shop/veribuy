import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard, RolesGuard, Roles, Public, CurrentUser, PaginationDto } from '@veribuy/common';

interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
}

@Controller('auth')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 10 verify-email requests per minute per IP (clicked from email link)
  @Get('verify-email')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  // 3 resend verification emails per hour per authenticated user
  @Post('send-verification-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  async sendVerificationEmail(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.resendVerificationEmail(user.userId);
  }

  // 3 registrations per hour per IP
  @Post('register')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // 5 login attempts per minute per IP
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // 10 refresh attempts per minute per IP
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  // 30 verify calls per minute per IP (used by middleware)
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async verify(@CurrentUser() user: AuthenticatedUser) {
    // JwtAuthGuard already verified the token; hydrate name+email from DB
    return this.authService.verifyAndHydrate(user.userId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogoutDto) {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  // Internal service-to-service: look up name+email for any userId.
  // Protected by INTERNAL_SERVICE_TOKEN — not a JWT route.
  @Get('internal/users/:userId')
  @Public()
  async internalGetUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Headers('x-internal-service') token: string,
  ) {
    const expected = process.env.INTERNAL_SERVICE_TOKEN;
    if (!expected) {
      throw new UnauthorizedException('Internal token not configured');
    }
    const tokenBuf    = Buffer.from(token    ?? '', 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (
      tokenBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(tokenBuf, expectedBuf)
    ) {
      throw new UnauthorizedException('Invalid internal service token');
    }
    return this.authService.verifyAndHydrate(userId);
  }

  // 5 password change attempts per 15 minutes per authenticated user
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.userId, dto);
  }

  // 3 forgot-password requests per hour per IP (anti-abuse; safe response always returned)
  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  // 5 reset-password attempts per 15 minutes per IP
  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('users')
  @Roles('ADMIN')
  async getAllUsers(@Query() pagination: PaginationDto) {
    return this.authService.getAllUsers(pagination);
  }

  // Admin endpoints
  @Patch('admin/users/:userId')
  @Roles('ADMIN')
  async updateUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.authService.updateUser(userId, dto);
  }

  @Delete('admin/users/:userId')
  @Roles('ADMIN')
  async deleteUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.authService.deleteUser(userId, user.userId);
  }
}
