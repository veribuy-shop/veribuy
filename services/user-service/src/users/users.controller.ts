import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard, RolesGuard, CurrentUser, Roles } from '@veribuy/common';

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
}
