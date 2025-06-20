import { Injectable } from "@nestjs/common";
import { MssqlService } from "../db/db.service";
import { AccountDescriptionMap } from "../dto/accountDescriptionOptionMap";

@Injectable()
export class KpiService {
  constructor(private readonly mssqlService: MssqlService) {}

  async findDeptIncomeKpi(payload: any) {
    const { startDate, endDate, branches, departments } = payload;

    console.log("here", startDate, endDate, payload);
    const res = await this.mssqlService.query(`SELECT
    gab.UniqDepartment,
    d.NameOf AS DepartmentName,
    gab.UniqBranch,
    b.NameOf AS BranchName,

    -- Income
    SUM(CASE
        WHEN gag.GroupCode = 50 THEN gab.Amount * -1 ELSE 0
    END) AS CommissionIncome,

    SUM(CASE
        WHEN gag.GroupCode = 60 THEN gab.Amount * -1 ELSE 0
    END) AS OtherIncome,

    SUM(CASE
        WHEN gag.GroupCode IN (50, 60) THEN gab.Amount * -1 ELSE 0
    END) AS TotalIncome,

    -- Total Expense
    SUM(CASE
        WHEN ga.TypeCode = 'X' THEN gab.Amount ELSE 0
    END) AS TotalExpense,

	-- Personal Cost
	SUM(CASE
        WHEN ga.TypeCode = 'X' AND ga.Account IN ('7010') THEN gab.Amount
        ELSE 0
    END) AS PersonalCost,

	--  Other Direct Cost
	SUM(CASE WHEN ga.TypeCode = 'X' AND ga.Account = '7180' THEN gab.Amount ELSE 0 END) AS OtherDirectCost,

	--- Total direct cost = personal cost + other direct cost

	--- P&L b/f Ind Cost = Total Income - Total Direct Cost

	-- Total Indirect Cost
	SUM(CASE WHEN ga.TypeCode = 'X' AND ga.Account <> '7180' AND ga.Account <> '7010' THEN gab.Amount ELSE 0 END) AS OtherIndirectCost,

	-- Total Operating Expense
	SUM(CASE
        WHEN ga.TypeCode = 'X' THEN gab.Amount ELSE 0
    END) AS TotalOperatingCost



FROM GlAccount ga
JOIN GlAccountBalance gab ON ga.UniqGlAccount = gab.UniqGlAccount
JOIN GlAccountGroup gag ON ga.UniqGlAccountGroup = gag.UniqGlAccountGroup
JOIN Department d ON gab.UniqDepartment = d.UniqDepartment
JOIN Branch b ON gab.UniqBranch = b.UniqBranch

WHERE gab.UniqAgency = 65537
  AND gab.FiscalAccountingMonth BETWEEN ${startDate} AND ${endDate}
  AND gab.Amount <> 0
  AND gab.UniqDepartment > -1

GROUP BY
    gab.UniqDepartment, d.NameOf,
    gab.UniqBranch, b.NameOf

ORDER BY
    b.NameOf, d.NameOf;
`);

    let result = res;
    if (departments && departments.length > 0) {
      result = result.filter((e) => departments.includes(e.DepartmentName));
    }
    if (branches && branches.length > 0) {
      result = result.filter((e) => branches.includes(e.BranchName));
    }

    result = result.map((e) => ({
      ...e,
      totalDirectCost: e.PersonalCost + e.OtherDirectCost,
      pl_bf_ind_cost: e.TotalIncome - (e.PersonalCost + e.OtherDirectCost),
    }));

    const groupedResult: any = Object.values(
      result.reduce((acc, e) => {
        const deptName = e.DepartmentName;

        // Initialize accumulator for this department if not exists
        if (!acc[deptName]) {
          acc[deptName] = {
            UniqDepartment: e.UniqDepartment,
            DepartmentName: deptName,
            UniqBranch: null, // Set to null as branches are aggregated
            BranchName: null, // Set to null as branches are aggregated
            CommissionIncome: 0,
            OtherIncome: 0,
            TotalIncome: 0,
            TotalExpense: 0,
            PersonalCost: 0,
            OtherDirectCost: 0,
            OtherIndirectCost: 0,
            TotalOperatingCost: 0,
            totalDirectCost: 0,
            pl_bf_ind_cost: 0,
          };
        }

        // Aggregate numerical fields
        acc[deptName].CommissionIncome += e.CommissionIncome;
        acc[deptName].OtherIncome += e.OtherIncome;
        acc[deptName].TotalIncome += e.TotalIncome;
        acc[deptName].TotalExpense += e.TotalExpense;
        acc[deptName].PersonalCost += e.PersonalCost;
        acc[deptName].OtherDirectCost += e.OtherDirectCost;
        acc[deptName].OtherIndirectCost += e.OtherIndirectCost;
        acc[deptName].TotalOperatingCost += e.TotalOperatingCost;
        acc[deptName].totalDirectCost += e.totalDirectCost;
        acc[deptName].pl_bf_ind_cost += e.pl_bf_ind_cost;

        return acc;
      }, {})
    );

    const total = {
      UniqDepartment: null,
      DepartmentName: "Total",
      UniqBranch: null,
      BranchName: null,
      CommissionIncome: 0,
      OtherIncome: 0,
      TotalIncome: 0,
      TotalExpense: 0,
      PersonalCost: 0,
      OtherDirectCost: 0,
      OtherIndirectCost: 0,
      TotalOperatingCost: 0,
      totalDirectCost: 0,
      pl_bf_ind_cost: 0,
    };

    groupedResult.forEach((e) => {
      total.CommissionIncome += e.CommissionIncome;
      total.OtherIncome += e.OtherIncome;
      total.TotalIncome += e.TotalIncome;
      total.TotalExpense += e.TotalExpense;
      total.PersonalCost += e.PersonalCost;
      total.OtherDirectCost += e.OtherDirectCost;
      total.OtherIndirectCost += e.OtherIndirectCost;
      total.TotalOperatingCost += e.TotalOperatingCost;
      total.totalDirectCost += e.totalDirectCost;
      total.pl_bf_ind_cost += e.pl_bf_ind_cost;
    });

    groupedResult.push(total);
    return groupedResult;
  }

  async findBrachIncomeKpi(payload: any) {
    const { startDate, endDate, branches, departments } = payload;

    console.log("here", startDate, endDate, payload);
    const res = await this.mssqlService.query(`SELECT
    gab.UniqDepartment,
    d.NameOf AS DepartmentName,
    gab.UniqBranch,
    b.NameOf AS BranchName,

    -- Income
    SUM(CASE
        WHEN gag.GroupCode = 50 THEN gab.Amount * -1 ELSE 0
    END) AS CommissionIncome,

    SUM(CASE
        WHEN gag.GroupCode = 60 THEN gab.Amount * -1 ELSE 0
    END) AS OtherIncome,

    SUM(CASE
        WHEN gag.GroupCode IN (50, 60) THEN gab.Amount * -1 ELSE 0
    END) AS TotalIncome,

    -- Total Expense
    SUM(CASE
        WHEN ga.TypeCode = 'X' THEN gab.Amount ELSE 0
    END) AS TotalExpense,

	-- Personal Cost
	SUM(CASE
        WHEN ga.TypeCode = 'X' AND ga.Account IN ('7010') THEN gab.Amount
        ELSE 0
    END) AS PersonalCost,

	--  Other Direct Cost
	SUM(CASE WHEN ga.TypeCode = 'X' AND ga.Account = '7180' THEN gab.Amount ELSE 0 END) AS OtherDirectCost,

	--- Total direct cost = personal cost + other direct cost

	--- P&L b/f Ind Cost = Total Income - Total Direct Cost

	-- Total Indirect Cost
	SUM(CASE WHEN ga.TypeCode = 'X' AND ga.Account <> '7180' AND ga.Account <> '7010' THEN gab.Amount ELSE 0 END) AS OtherIndirectCost,

	-- Total Operating Expense
	SUM(CASE
        WHEN ga.TypeCode = 'X' THEN gab.Amount ELSE 0
    END) AS TotalOperatingCost



FROM GlAccount ga
JOIN GlAccountBalance gab ON ga.UniqGlAccount = gab.UniqGlAccount
JOIN GlAccountGroup gag ON ga.UniqGlAccountGroup = gag.UniqGlAccountGroup
JOIN Department d ON gab.UniqDepartment = d.UniqDepartment
JOIN Branch b ON gab.UniqBranch = b.UniqBranch

WHERE gab.UniqAgency = 65537
  AND gab.FiscalAccountingMonth BETWEEN ${startDate} AND ${endDate}
  AND gab.Amount <> 0
  AND gab.UniqDepartment > -1

GROUP BY
    gab.UniqDepartment, d.NameOf,
    gab.UniqBranch, b.NameOf

ORDER BY
    b.NameOf, d.NameOf;
`);

    let result = res;
    if (departments && departments.length > 0) {
      result = result.filter((e) => departments.includes(e.DepartmentName));
    }
    if (branches && branches.length > 0) {
      result = result.filter((e) => branches.includes(e.BranchName));
    }

    result = result.map((e) => ({
      ...e,
      totalDirectCost: e.PersonalCost + e.OtherDirectCost,
      pl_bf_ind_cost: e.TotalIncome - (e.PersonalCost + e.OtherDirectCost),
    }));

    const groupedResult: any = Object.values(
      result.reduce((acc, e) => {
        const branchName = e.BranchName;

        // Initialize accumulator for this department if not exists
        if (!acc[branchName]) {
          acc[branchName] = {
            UniqDepartment: null,
            DepartmentName: null,
            UniqBranch: e.UniqBranch, // Set to null as branches are aggregated
            BranchName: branchName, // Set to null as branches are aggregated
            CommissionIncome: 0,
            OtherIncome: 0,
            TotalIncome: 0,
            TotalExpense: 0,
            PersonalCost: 0,
            OtherDirectCost: 0,
            OtherIndirectCost: 0,
            TotalOperatingCost: 0,
            totalDirectCost: 0,
            pl_bf_ind_cost: 0,
          };
        }

        // Aggregate numerical fields
        acc[branchName].CommissionIncome += e.CommissionIncome;
        acc[branchName].OtherIncome += e.OtherIncome;
        acc[branchName].TotalIncome += e.TotalIncome;
        acc[branchName].TotalExpense += e.TotalExpense;
        acc[branchName].PersonalCost += e.PersonalCost;
        acc[branchName].OtherDirectCost += e.OtherDirectCost;
        acc[branchName].OtherIndirectCost += e.OtherIndirectCost;
        acc[branchName].TotalOperatingCost += e.TotalOperatingCost;
        acc[branchName].totalDirectCost += e.totalDirectCost;
        acc[branchName].pl_bf_ind_cost += e.pl_bf_ind_cost;

        return acc;
      }, {})
    );
    const total = {
      UniqDepartment: null,
      DepartmentName: "Total",
      UniqBranch: null,
      BranchName: null,
      CommissionIncome: 0,
      OtherIncome: 0,
      TotalIncome: 0,
      TotalExpense: 0,
      PersonalCost: 0,
      OtherDirectCost: 0,
      OtherIndirectCost: 0,
      TotalOperatingCost: 0,
      totalDirectCost: 0,
      pl_bf_ind_cost: 0,
    };

    groupedResult.forEach((e) => {
      total.CommissionIncome += e.CommissionIncome;
      total.OtherIncome += e.OtherIncome;
      total.TotalIncome += e.TotalIncome;
      total.TotalExpense += e.TotalExpense;
      total.PersonalCost += e.PersonalCost;
      total.OtherDirectCost += e.OtherDirectCost;
      total.OtherIndirectCost += e.OtherIndirectCost;
      total.TotalOperatingCost += e.TotalOperatingCost;
      total.totalDirectCost += e.totalDirectCost;
      total.pl_bf_ind_cost += e.pl_bf_ind_cost;
    });

    groupedResult.push(total);
    return groupedResult;
  }

  async balanceSheetKpi(payload: any) {
    try {
      const { startDate, endDate } = payload;
      const res = await this.mssqlService.query(
        `
      DECLARE @StartMonth VARCHAR(6) = COALESCE(@0, (SELECT MIN(FiscalAccountingMonth) FROM GlAccountBalance WHERE UniqAgency = 65537));
      DECLARE @EndMonth VARCHAR(6) = COALESCE(@1, (SELECT MAX(FiscalAccountingMonth) FROM GlAccountBalance WHERE UniqAgency = 65537));

      SELECT
          -- Total Assets
          (SELECT SUM(gab.Amount) AS TotalAmount
           FROM GlAccount ga
           JOIN GlAccountBalance gab ON ga.UniqGlAccount = gab.UniqGlAccount
           WHERE gab.UniqAgency = 65537
           AND (gab.FiscalAccountingMonth BETWEEN @StartMonth AND @EndMonth OR (@StartMonth IS NULL AND @EndMonth IS NULL))
           AND ga.TypeCode = 'A') AS total_assets,

          -- Current Assets Details
          (SELECT SUM(gab.Amount) AS CashShortTermDeposits
           FROM GlAccount ga
           JOIN GlAccountBalance gab ON ga.UniqGlAccount = gab.UniqGlAccount
           WHERE gab.UniqAgency = 65537
           AND (gab.FiscalAccountingMonth BETWEEN @StartMonth AND @EndMonth OR (@StartMonth IS NULL AND @EndMonth IS NULL))
           AND ga.Account IN ('2200', '2651', '2800')) AS cash_short_term_deposits,

          (SELECT SUM(gab.Amount) AS Receivables
           FROM GlAccount ga
           JOIN GlAccountBalance gab ON ga.UniqGlAccount = gab.UniqGlAccount
           WHERE gab.UniqAgency = 65537
           AND (gab.FiscalAccountingMonth BETWEEN @StartMonth AND @EndMonth OR (@StartMonth IS NULL AND @EndMonth IS NULL))
           AND ga.Account IN ('2650', '2900')) AS receivables,

          (SELECT SUM(gab.Amount) AS InterCo
           FROM GlAccount ga
           JOIN GlAccountBalance gab ON ga.UniqGlAccount = gab.UniqGlAccount
           WHERE gab.UniqAgency = 65537
           AND (gab.FiscalAccountingMonth BETWEEN @StartMonth AND @EndMonth OR (@StartMonth IS NULL AND @EndMonth IS NULL))
           AND ga.Account = '2800') AS interco,

          (SELECT SUM(gab.Amount) AS NetCurrentAsset
           FROM GlAccount ga
           JOIN GlAccountBalance gab ON ga.UniqGlAccount = gab.UniqGlAccount
           JOIN GlAccountGroup gag ON ga.UniqGlAccountGroup = gag.UniqGlAccountGroup
           WHERE gab.UniqAgency = 65537
           AND (gab.FiscalAccountingMonth BETWEEN @StartMonth AND @EndMonth OR (@StartMonth IS NULL AND @EndMonth IS NULL))
           AND ga.TypeCode = 'A'
           AND gag.GroupCode = 20) AS total_current_asset,

          (SELECT SUM(gab.Amount) AS FreeCashFlow
           FROM GlAccount ga
           JOIN GlAccountBalance gab ON ga.UniqGlAccount = gab.UniqGlAccount
           WHERE gab.UniqAgency = 65537
           AND (gab.FiscalAccountingMonth BETWEEN @StartMonth AND @EndMonth OR (@StartMonth IS NULL AND @EndMonth IS NULL))
           AND ga.Account = '2950') AS free_cash_flow,

          (SELECT SUM(gab.Amount) AS NonCurrentAssets
           FROM GlAccount ga
           JOIN GlAccountBalance gab ON ga.UniqGlAccount = gab.UniqGlAccount
           JOIN GlAccountGroup gag ON ga.UniqGlAccountGroup = gag.UniqGlAccountGroup
           WHERE gab.UniqAgency = 65537
           AND (gab.FiscalAccountingMonth BETWEEN @StartMonth AND @EndMonth OR (@StartMonth IS NULL AND @EndMonth IS NULL))
           AND ga.TypeCode = 'A'
           AND gag.GroupCode = 10) AS non_current_assets,

          -- Total Liabilities
          (SELECT SUM(gab.Amount) AS TotalAmount
           FROM GlAccount ga
           JOIN GlAccountBalance gab ON ga.UniqGlAccount = gab.UniqGlAccount
           WHERE gab.UniqAgency = 65537
           AND (gab.FiscalAccountingMonth BETWEEN @StartMonth AND @EndMonth OR (@StartMonth IS NULL AND @EndMonth IS NULL))
           AND ga.TypeCode = 'L') AS total_liabilities,

          -- Current Liabilities Details
          (SELECT SUM(gab.Amount) AS OtherAccruals
           FROM GlAccount ga
           JOIN GlAccountBalance gab ON ga.UniqGlAccount = gab.UniqGlAccount
           WHERE gab.UniqAgency = 65537
           AND (gab.FiscalAccountingMonth BETWEEN @StartMonth AND @EndMonth OR (@StartMonth IS NULL AND @EndMonth IS NULL))
           AND ga.Account = '3000') AS other_accruals,

          (SELECT SUM(gab.Amount) AS Payables
           FROM GlAccount ga
           JOIN GlAccountBalance gab ON ga.UniqGlAccount = gab.UniqGlAccount
           WHERE gab.UniqAgency = 65537
           AND (gab.FiscalAccountingMonth BETWEEN @StartMonth AND @EndMonth OR (@StartMonth IS NULL AND @EndMonth IS NULL))
           AND ga.Account = '3020') AS payables,

          (SELECT SUM(gab.Amount) AS InterCo
           FROM GlAccount ga
           JOIN GlAccountBalance gab ON ga.UniqGlAccount = gab.UniqGlAccount
           WHERE gab.UniqAgency = 65537
           AND (gab.FiscalAccountingMonth BETWEEN @StartMonth AND @EndMonth OR (@StartMonth IS NULL AND @EndMonth IS NULL))
           AND ga.Account = '3010') AS interco_liability,

          (SELECT SUM(gab.Amount) AS NonCurrentLiabilities
           FROM GlAccount ga
           JOIN GlAccountBalance gab ON ga.UniqGlAccount = gab.UniqGlAccount
           JOIN GlAccountGroup gag ON ga.UniqGlAccountGroup = gag.UniqGlAccountGroup
           WHERE gab.UniqAgency = 65537
           AND (gab.FiscalAccountingMonth BETWEEN @StartMonth AND @EndMonth OR (@StartMonth IS NULL AND @EndMonth IS NULL))
           AND ga.TypeCode = 'L'
           AND gag.GroupCode = 35) AS non_current_liabilities
      `,
        [startDate, endDate]
      );

      return res.map((e) => ({
        ...e,
        total_current_lability: e.total_liabilities - e.non_current_liabilities,
        shareholder_equity:
          Math.abs(e.total_assets) - Math.abs(e.total_liabilities),
        current_ratio:
          e.total_current_asset /
          (e.total_liabilities - e.non_current_liabilities),
      }));
    } catch (error) {
      console.error("Error in balanceSheetKpi:", error.message);
      return null;
    }
  }

  async getIncomeStatementOfBranch(dto: any) {
    try {
      const { startDate, endDate, uniqBranchId } = dto;

      const res = await this.mssqlService.query(
        `
    DECLARE @StartMonth VARCHAR(6) = @0; -- Start month
DECLARE @EndMonth VARCHAR(6) = @1;   -- End month
DECLARE @UniqBranch INT = @2;           -- Branch ID (Kingston)

SELECT
    ga.Account AS [AccountCode],
    MIN(ISNULL(clr.ResourceText, ga.Account)) AS [AccountDescription], -- Taking first description
    gag.GroupCode AS [GroupCode],
    MIN(ISNULL(clr2.ResourceText, gag.GroupCode)) AS [GroupDescription], -- Taking first group description
    CASE ga.TypeCode
        WHEN 'I' THEN 'Income'
        WHEN 'X' THEN 'Expense'
        ELSE 'Other'
    END AS [AccountType],
    SUM(CASE WHEN gab.UniqDepartment = 65539 THEN gab.Amount ELSE 0 END) AS [IndividualLines],
    SUM(CASE WHEN gab.UniqDepartment = 65541 THEN gab.Amount ELSE 0 END) AS [EmpBenefitCorp],
    SUM(CASE WHEN gab.UniqDepartment = 65538 THEN gab.Amount ELSE 0 END) AS [GeneralCorporate],
    SUM(CASE WHEN gab.UniqDepartment = 65537 THEN gab.Amount ELSE 0 END) AS [GeneralGovOfJamaica],
    SUM(CASE WHEN gab.UniqDepartment = 65543 THEN gab.Amount ELSE 0 END) AS [LifeDepartment]
FROM GlAccount ga
JOIN GlAccountBalance gab ON ga.UniqGlAccount = gab.UniqGlAccount
LEFT JOIN GlAccountGroup gag ON ga.UniqGlAccountGroup = gag.UniqGlAccountGroup
LEFT JOIN ConfigureLkLanguageResource clr ON clr.ConfigureLkLanguageResourceID = ga.ConfigureLkLanguageResourceID AND clr.CultureCode = 'en-US'
LEFT JOIN ConfigureLkLanguageResource clr2 ON clr2.ConfigureLkLanguageResourceID = gag.ConfigureLkLanguageResourceID AND clr2.CultureCode = 'en-US'
WHERE gab.UniqAgency = 65537
    AND gab.UniqBranch = @UniqBranch
    AND gab.FiscalAccountingMonth BETWEEN @StartMonth AND @EndMonth
    AND ga.TypeCode IN ('I', 'X') -- Focus on Income and Expense accounts
GROUP BY
    ga.Account,
    ga.TypeCode,
    gag.GroupCode
HAVING SUM(gab.Amount) <> 0
ORDER BY
    CASE ga.TypeCode WHEN 'I' THEN 1 ELSE 2 END, -- Income first, then Expenses
    gag.GroupCode,
    ga.Account;
    `,
        [startDate, endDate, uniqBranchId]
      );

      const fixedAccountDescription = res.map((e) => {
        const normalizedAccountCode = e.AccountCode.replace(/\s+/g, "");
        const correctDescription =
          AccountDescriptionMap[normalizedAccountCode] || e.AccountDescription;
        return {
          ...e,
          AccountDescription: correctDescription,
        };
      });


      const totalAddition = fixedAccountDescription.map((e) => {
        const total =
          e.IndividualLines +
          e.EmpBenefitCorp +
          e.GeneralCorporate +
          e.GeneralGovOfJamaica +
          e.LifeDepartment;
        return {
          ...e,
          total,
        };
      });


      //// Total expense calculation
      const totalExpenseObjects =  totalAddition.filter(e => e.AccountType === 'Expense')

      const totalExpense = {
      "AccountCode": "0000",
      "AccountDescription": "Total Expense",
      "GroupCode": 0,
      "GroupDescription": "Total Expense Department wise",
      "AccountType": "Income",
      "IndividualLines": 0,
      "EmpBenefitCorp": 0,
      "GeneralCorporate":0,
      "GeneralGovOfJamaica": 0,
      "LifeDepartment": 0,
      "total": 0
      }

      totalExpenseObjects.map(e => {
        totalExpense.IndividualLines += e.IndividualLines,
        totalExpense.EmpBenefitCorp += e.EmpBenefitCorp,
        totalExpense.GeneralCorporate += e.GeneralCorporate,
        totalExpense.GeneralGovOfJamaica += e.GeneralGovOfJamaica,
        totalExpense.LifeDepartment += e.LifeDepartment
        totalExpense.total += e.total
      })


      // total income calculation ////
      const totalIncomeObjects =  totalAddition.filter(e => e.AccountType === 'Income')

      const totalIncome = {
      "AccountCode": "0000",
      "AccountDescription": "Total Income",
      "GroupCode": 0,
      "GroupDescription": "Total Income Department wise",
      "AccountType": "Income",
      "IndividualLines": 0,
      "EmpBenefitCorp": 0,
      "GeneralCorporate":0,
      "GeneralGovOfJamaica": 0,
      "LifeDepartment": 0,
      "total": 0
      }


      totalIncomeObjects.map(e => {
        totalIncome.IndividualLines += e.IndividualLines,
        totalIncome.EmpBenefitCorp += e.EmpBenefitCorp,
        totalIncome.GeneralCorporate += e.GeneralCorporate,
        totalIncome.GeneralGovOfJamaica += e.GeneralGovOfJamaica,
        totalIncome.LifeDepartment += e.LifeDepartment
        totalIncome.total += e.total
      })


      //// Net profit loss calculation

      const NetProfitLoss = {
      "AccountCode": "0000",
      "AccountDescription": "Net Profit/Loss",
      "GroupCode": 0,
      "GroupDescription": "Net Profit/Loss",
      "AccountType": "Income",
      "IndividualLines": Math.abs(totalIncome.IndividualLines) - totalExpense.IndividualLines,
      "EmpBenefitCorp": Math.abs(totalIncome.EmpBenefitCorp) - totalExpense.EmpBenefitCorp,
      "GeneralCorporate":Math.abs(totalIncome.GeneralCorporate) - totalExpense.GeneralCorporate,
      "GeneralGovOfJamaica": Math.abs(totalIncome.GeneralGovOfJamaica) - totalExpense.GeneralGovOfJamaica,
      "LifeDepartment": Math.abs(totalIncome.LifeDepartment) - totalExpense.LifeDepartment,
      "total": Math.abs(totalIncome.total) - totalExpense.total
      }

      ///// Financial Expense Calculation

      const financialExpenseObjects = totalAddition.filter(e => e.GroupDescription === "Financial Expense")
      const financialExpenses = {
      "AccountCode": "0000",
      "AccountDescription": "Subtotal Financial Expense",
      "GroupCode": 0,
      "GroupDescription": "Subtotal Financial Expense",
      "AccountType": "Income",
      "IndividualLines": 0,
      "EmpBenefitCorp": 0,
      "GeneralCorporate":0,
      "GeneralGovOfJamaica": 0,
      "LifeDepartment": 0,
      "total": 0
      }

     financialExpenseObjects.map(e => {
        financialExpenses.IndividualLines += e.IndividualLines,
        financialExpenses.EmpBenefitCorp += e.EmpBenefitCorp,
        financialExpenses.GeneralCorporate += e.GeneralCorporate,
        financialExpenses.GeneralGovOfJamaica += e.GeneralGovOfJamaica,
        financialExpenses.LifeDepartment += e.LifeDepartment
        financialExpenses.total += e.total
      })

      /// Administrative Expense

      const administrativeExpenseObjects = totalAddition.filter(e => e.GroupDescription === "Administrative Expense")
      const administrativeExpenses = {
      "AccountCode": "0000",
      "AccountDescription": "Subtotal Administrative Expense",
      "GroupCode": 0,
      "GroupDescription": "Subtotal Administrative Expense",
      "AccountType": "Income",
      "IndividualLines": 0,
      "EmpBenefitCorp": 0,
      "GeneralCorporate":0,
      "GeneralGovOfJamaica": 0,
      "LifeDepartment": 0,
      "total": 0
      }

     administrativeExpenseObjects.map(e => {
        administrativeExpenses.IndividualLines += e.IndividualLines,
        administrativeExpenses.EmpBenefitCorp += e.EmpBenefitCorp,
        administrativeExpenses.GeneralCorporate += e.GeneralCorporate,
        administrativeExpenses.GeneralGovOfJamaica += e.GeneralGovOfJamaica,
        administrativeExpenses.LifeDepartment += e.LifeDepartment
        administrativeExpenses.total += e.total
      })


      ///  Commision and fee income

      const commisionAndFeeIncomeObjects = totalAddition.filter(e => e.GroupDescription === "Commision & Fee Income")
      const commisionAndFeeIncome = {
      "AccountCode": "0000",
      "AccountDescription": "Subtotal Commision & Fee Income",
      "GroupCode": 0,
      "GroupDescription": "Subtotal Commision & Fee Income",
      "AccountType": "Income",
      "IndividualLines": 0,
      "EmpBenefitCorp": 0,
      "GeneralCorporate":0,
      "GeneralGovOfJamaica": 0,
      "LifeDepartment": 0,
      "total": 0
      }

     commisionAndFeeIncomeObjects.map(e => {
        commisionAndFeeIncome.IndividualLines += e.IndividualLines,
        commisionAndFeeIncome.EmpBenefitCorp += e.EmpBenefitCorp,
        commisionAndFeeIncome.GeneralCorporate += e.GeneralCorporate,
        commisionAndFeeIncome.GeneralGovOfJamaica += e.GeneralGovOfJamaica,
        commisionAndFeeIncome.LifeDepartment += e.LifeDepartment
        commisionAndFeeIncome.total += e.total
      })

      // subtotal investment and other income
      const investmentAndOtherIncomeObjects = totalAddition.filter(e => e.GroupDescription === "Investments & Other Income")
      const investmentAndOtherIncome = {
      "AccountCode": "0000",
      "AccountDescription": "Subtotal Investment & Other Income",
      "GroupCode": 0,
      "GroupDescription": "Subtotal Investment & Other Income",
      "AccountType": "Income",
      "IndividualLines": 0,
      "EmpBenefitCorp": 0,
      "GeneralCorporate":0,
      "GeneralGovOfJamaica": 0,
      "LifeDepartment": 0,
      "total": 0
      }

     investmentAndOtherIncomeObjects.map(e => {
        investmentAndOtherIncome.IndividualLines += e.IndividualLines,
        investmentAndOtherIncome.EmpBenefitCorp += e.EmpBenefitCorp,
        investmentAndOtherIncome.GeneralCorporate += e.GeneralCorporate,
        investmentAndOtherIncome.GeneralGovOfJamaica += e.GeneralGovOfJamaica,
        investmentAndOtherIncome.LifeDepartment += e.LifeDepartment
        investmentAndOtherIncome.total += e.total
      })

      /// pushing in values
      totalAddition.push(totalExpense)
      totalAddition.push(totalIncome)
      totalAddition.push(NetProfitLoss)
      totalAddition.push(administrativeExpenses)
      totalAddition.push(financialExpenses)
      totalAddition.push(commisionAndFeeIncome)
      totalAddition.push(investmentAndOtherIncome)


      return totalAddition;
    } catch (error) {
      return {
        error: error.message,
        statusCode: 400,
      };
    }
  }
}
