import { Module } from '@nestjs/common';
import { UevidenceController } from './evidence.controller';
import { UevidenceService } from './evidence.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [CloudinaryModule, PrismaModule],
  controllers: [UevidenceController],
  providers: [UevidenceService],
  exports: [UevidenceService],
})
export class UevidenceModule {}
