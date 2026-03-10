import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  UnauthorizedException,
  ParseUUIDPipe,
} from '@nestjs/common';
import * as nodeCrypto from 'crypto';
import { UsersService } from './users.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateVerificationStatusDto } from './dto/update-verification-status.dto';
import { JwtAuthGuard, RolesGuard, CurrentUser, Roles, Public } from '@veribuy/common';

interface AuthenticatedUser {
  userId: string;
  role: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':userId/profile')
  async getProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Users can view their own profile, admins can view any profile
    if (user.userId !== userId && user.role !== 'ADMIN') {
      throw new ForbiddenException('You can only view your own profile');
    }
    return this.usersService.findByUserId(userId);
  }

  @Post(':userId/profile')
  @HttpCode(HttpStatus.CREATED)
  async createProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Users can only create their own profile
    if (user.userId !== userId) {
      throw new ForbiddenException('You can only create your own profile');
    }
    return this.usersService.createProfile(userId, dto);
  }

  @Put(':userId/profile')
  async updateProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Users can only update their own profile, admins can update any profile
    if (user.userId !== userId && user.role !== 'ADMIN') {
      throw new ForbiddenException('You can only update your own profile');
    }
    return this.usersService.updateProfile(userId, dto);
  }

  /**
   * Internal endpoint — called by trust-lens-service (and future services) to
   * advance a seller's KYC verificationStatus after a Trust Lens review.
   * Protected by timing-safe INTERNAL_SERVICE_TOKEN check (no JWT).
   */
  @Patch(':userId/verification-status')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateVerificationStatus(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Headers('x-internal-service') internalToken: string,
    @Body() body: UpdateVerificationStatusDto,
  ) {
    this.verifyInternalToken(internalToken);
    await this.usersService.updateVerificationStatus(userId, body.verificationStatus);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private verifyInternalToken(internalToken: string): void {
    const expected = process.env.INTERNAL_SERVICE_TOKEN;
    if (!expected) {
      throw new UnauthorizedException('Internal service token not configured');
    }

    let valid = false;
    try {
      const a = Buffer.from(internalToken ?? '');
      const b = Buffer.from(expected);
      valid = a.length === b.length && nodeCrypto.timingSafeEqual(a, b);
    } catch {
      valid = false;
    }

    if (!valid) {
      throw new UnauthorizedException('Invalid x-internal-service token');
    }
  }
}
