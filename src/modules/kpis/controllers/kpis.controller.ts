import { Controller, Get } from '@nestjs/common';
import { KpiService } from '../services/kpis.service';
import { ApiTags, ApiBearerAuth} from '@nestjs/swagger';

@ApiTags('kpis')
@Controller('kpi')
export class KpiController {
    constructor(private readonly kpiService: KpiService) {}

    @ApiBearerAuth()
    @Get('sample')
    findAllVendors() {
      return this.kpiService.findKpi();
    }
}
