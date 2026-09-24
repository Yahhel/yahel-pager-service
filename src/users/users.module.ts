import { Module } from '@nestjs/common';
import { AuthModule } from '@shared/auth';
import { DBModule } from '@shared/schemas';
import { UsersAdminsController } from './users.admins.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [DBModule, AuthModule],
  controllers: [UsersController, UsersAdminsController],
  providers: [UsersService],
})
export class UsersModule {}
