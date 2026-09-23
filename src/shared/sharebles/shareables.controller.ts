import { Controller } from '@nestjs/common';

import { ShareablesService } from './shareables.service';

@Controller()
export class ShareablesController {
  constructor(private readonly shareablesService: ShareablesService) {}

}
