import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto, PaginatedResponse } from '@veribuy/common';

// Typed interface for the authenticated user (from JWT)
interface AuthenticatedUser {
  userId: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private notification: NotificationService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Generate a raw verification token; store its SHA-256 hash in the DB
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    let user: { id: string; name: string; email: string; role: string };
    try {
      user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          emailVerificationToken: tokenHash,
          emailVerificationExpiry: tokenExpiry,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });
    } catch (err: any) {
      // P2002 = unique constraint violation (email already exists)
      if (err?.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }

    // Fire verification email (fire-and-forget — never block registration)
    this.notification
      .sendVerificationEmail(user.email, user.name, rawToken)
      .catch((err) =>
        this.logger.error(`Failed to send verification email to ${user.email}: ${err?.message}`),
      );

    const tokens = await this.generateTokens(user.id, user.role);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException('Please verify your email address before logging in');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.role);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      ...tokens,
    };
  }

  async verifyEmail(rawToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: tokenHash },
    });

    if (!user) {
      throw new BadRequestException('Invalid or already used verification link');
    }

    if (!user.emailVerificationExpiry || user.emailVerificationExpiry < new Date()) {
      throw new BadRequestException('Verification link has expired. Please request a new one.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    });

    // Fire welcome email (fire-and-forget)
    this.notification
      .sendWelcomeEmail(user.email, user.name)
      .catch((err) =>
        this.logger.error(`Failed to send welcome email to ${user.email}: ${err?.message}`),
      );

    return { message: 'Email verified successfully' };
  }

  async resendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: tokenHash,
        emailVerificationExpiry: tokenExpiry,
      },
    });

    // Fire-and-forget
    this.notification
      .sendVerificationEmail(user.email, user.name, rawToken)
      .catch((err) =>
        this.logger.error(`Failed to resend verification email to ${user.email}: ${err?.message}`),
      );

    return { message: 'Verification email sent' };
  }

  async refreshToken(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!stored.user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.generateTokens(stored.user.id, stored.user.role);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async verifyAndHydrate(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not found or disabled');
    }

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  async getAllUsers(pagination: PaginationDto): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Admin methods
  async updateUser(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { role: dto.role as any }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteUser(userId: string, currentUserId: string) {
    // Prevent self-deletion
    if (userId === currentUserId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Revoke all refresh tokens before deleting the user
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Hard delete (cascade deletes refresh tokens via FK)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'User deleted successfully' };
  }

  private async generateTokens(userId: string, role: string) {
    // JWT payload contains only sub + role — no PII (email intentionally omitted)
    const payload = { sub: userId, role };

    const accessToken = this.jwtService.sign(payload as object);

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
    }

    const refreshExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';

    const refreshToken = this.jwtService.sign(payload as object, {
      secret: refreshSecret,
      expiresIn: refreshExpiration as any,
    });

    // Derive expiry from config string instead of hardcoding 7 days
    const expiresAt = this.parseExpiration(refreshExpiration);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private parseExpiration(exp: string): Date {
    const now = new Date();
    const match = /^(\d+)([smhd])$/.exec(exp);
    if (!match) {
      // Default to 7 days if format unrecognised
      now.setDate(now.getDate() + 7);
      return now;
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's': now.setSeconds(now.getSeconds() + value); break;
      case 'm': now.setMinutes(now.getMinutes() + value); break;
      case 'h': now.setHours(now.getHours() + value); break;
      case 'd': now.setDate(now.getDate() + value); break;
    }
    return now;
  }
}
