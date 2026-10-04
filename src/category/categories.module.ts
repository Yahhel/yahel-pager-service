import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { DBModule } from '@shared/schemas';
import { CategoriesAdminsController } from './categories.admins.controller';
import { CategoriesController } from './categories.controller';

@Module({
  imports: [DBModule],
  controllers: [CategoriesController, CategoriesAdminsController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
