import { Module } from '@nestjs/common';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { TrustLensSyncService } from './trust-lens-sync.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [CloudinaryModule, PrismaModule],
  controllers: [EvidenceController],
  providers: [EvidenceService, TrustLensSyncService],
  exports: [EvidenceService],
})
export class EvidenceModule {}
