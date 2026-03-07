import { Controller, Post, Get, Patch, Delete, Body, Query, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard, RolesGuard, Roles, Public, CurrentUser, PaginationDto } from '@veribuy/common';

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

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@CurrentUser() user: any) {
    // The JwtAuthGuard already verified the token
    // Just return the user info
    return {
      userId: user.userId,
      email: user.email,
      role: user.role,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: any, @Body('refreshToken') refreshToken: string) {
    await this.authService.logout(refreshToken);
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
    @Param('userId') userId: string,
    @Body() updateData: { name?: string; role?: 'USER' | 'ADMIN' },
  ) {
    return this.authService.updateUser(userId, updateData);
  }

  @Delete('admin/users/:userId')
  @Roles('ADMIN')
  async deleteUser(@Param('userId') userId: string, @CurrentUser() user: any) {
    return this.authService.deleteUser(userId, user.userId);
  }
}
