import { IsArray, IsNotEmpty,  IsNumber,  IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class FiltersDto {
  @ApiProperty({
    type: String,
    example: '202401',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    type: String,
    example: '202401',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  endDate: string;


  @ApiProperty({
      type: [String],
      example: ['**********', '**********'],
      required: true,
    })
    @IsArray()
    @IsNotEmpty()
    @IsString({ each: true })
    branches: string[];

    @ApiProperty({
      type: [String],
      example: ['**********', '**********'],
      required: true,
    })
    @IsArray()
    @IsNotEmpty()
    @IsString({ each: true })
    departments: string[];
  }


  export class BalanceSheetFiltersDto {
  @ApiProperty({
    type: String,
    example: '202401',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    type: String,
    example: '202401',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  endDate: string;
}

export class IncomeStatementDto {
   @ApiProperty({
    type: String,
    example: '202401',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    type: String,
    example: '202401',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  endDate: string;

   @ApiProperty({
    type: Number,
    example: 65537,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  uniqBranchId: number;
}

export class CashFlowStatementDto {
   @ApiProperty({
    type: String,
    example: '202401',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  reportingMonth: string;

}