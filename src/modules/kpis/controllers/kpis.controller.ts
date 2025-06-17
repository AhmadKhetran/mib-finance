import { Body, Controller, Get, Post } from '@nestjs/common';
import { KpiService } from '../services/kpis.service';
import { ApiTags, ApiBearerAuth} from '@nestjs/swagger';
import { BalanceSheetFiltersDto, FiltersDto } from '../dto/filters.dto';

@ApiTags('kpis')
@Controller('kpi')
export class KpiController {
    constructor(private readonly kpiService: KpiService) {}

    @ApiBearerAuth()
    @Post('depts-income-api')
    findDeptIncome(
      @Body() dto: FiltersDto
    ) {
      return this.kpiService.findDeptIncomeKpi(dto);
    }

    @ApiBearerAuth()
    @Post('branch-income-api')
    findBranchIncome(
      @Body() dto: FiltersDto
    ) {
      return this.kpiService.findBrachIncomeKpi(dto);
    }

    @ApiBearerAuth()
    @Post('balance-sheet')
    find(
      @Body() dto: BalanceSheetFiltersDto
    ) {
      return this.kpiService.balanceSheetKpi(dto);
    }
}
