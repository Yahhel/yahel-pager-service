import { Module } from '@nestjs/common';
import { UserController } from './users.controller';
import { UsersAdminsController } from './users.admins.controller';
import { UserService } from './users.service';
import { DBModule } from '@shared/schemas';

@Module({
  imports: [DBModule],
  controllers: [UserController, UsersAdminsController],
  providers: [UserService],
  exports: [UserService],
})
export class UsersModule {}
