import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateUserDto } from './dto/update-user.dto';
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
