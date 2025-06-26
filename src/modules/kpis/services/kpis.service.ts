import { Injectable } from "@nestjs/common";
import { MssqlService } from "../db/db.service";
import { AccountDescriptionMap } from "../dto/accountDescriptionOptionMap";
import { BalanceSheetQuery, IncomeStatementQuery } from "../queries/query";

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
      const totalExpenseObjects = totalAddition.filter(
        (e) => e.AccountType === "Expense"
      );

      const totalExpense = {
        AccountCode: "0000",
        AccountDescription: "Total Expense",
        GroupCode: 0,
        GroupDescription: "Total Expense Department wise",
        AccountType: "Income",
        IndividualLines: 0,
        EmpBenefitCorp: 0,
        GeneralCorporate: 0,
        GeneralGovOfJamaica: 0,
        LifeDepartment: 0,
        total: 0,
      };

      totalExpenseObjects.map((e) => {
        (totalExpense.IndividualLines += e.IndividualLines),
          (totalExpense.EmpBenefitCorp += e.EmpBenefitCorp),
          (totalExpense.GeneralCorporate += e.GeneralCorporate),
          (totalExpense.GeneralGovOfJamaica += e.GeneralGovOfJamaica),
          (totalExpense.LifeDepartment += e.LifeDepartment);
        totalExpense.total += e.total;
      });

      // total income calculation ////
      const totalIncomeObjects = totalAddition.filter(
        (e) => e.AccountType === "Income"
      );

      const totalIncome = {
        AccountCode: "0000",
        AccountDescription: "Total Income",
        GroupCode: 0,
        GroupDescription: "Total Income Department wise",
        AccountType: "Income",
        IndividualLines: 0,
        EmpBenefitCorp: 0,
        GeneralCorporate: 0,
        GeneralGovOfJamaica: 0,
        LifeDepartment: 0,
        total: 0,
      };

      totalIncomeObjects.map((e) => {
        (totalIncome.IndividualLines += e.IndividualLines),
          (totalIncome.EmpBenefitCorp += e.EmpBenefitCorp),
          (totalIncome.GeneralCorporate += e.GeneralCorporate),
          (totalIncome.GeneralGovOfJamaica += e.GeneralGovOfJamaica),
          (totalIncome.LifeDepartment += e.LifeDepartment);
        totalIncome.total += e.total;
      });

      //// Net profit loss calculation

      const NetProfitLoss = {
        AccountCode: "0000",
        AccountDescription: "Net Profit/Loss",
        GroupCode: 0,
        GroupDescription: "Net Profit/Loss",
        AccountType: "Income",
        IndividualLines:
          Math.abs(totalIncome.IndividualLines) - totalExpense.IndividualLines,
        EmpBenefitCorp:
          Math.abs(totalIncome.EmpBenefitCorp) - totalExpense.EmpBenefitCorp,
        GeneralCorporate:
          Math.abs(totalIncome.GeneralCorporate) -
          totalExpense.GeneralCorporate,
        GeneralGovOfJamaica:
          Math.abs(totalIncome.GeneralGovOfJamaica) -
          totalExpense.GeneralGovOfJamaica,
        LifeDepartment:
          Math.abs(totalIncome.LifeDepartment) - totalExpense.LifeDepartment,
        total: Math.abs(totalIncome.total) - totalExpense.total,
      };

      ///// Financial Expense Calculation

      const financialExpenseObjects = totalAddition.filter(
        (e) => e.GroupDescription === "Financial Expense"
      );
      const financialExpenses = {
        AccountCode: "0000",
        AccountDescription: "Subtotal Financial Expense",
        GroupCode: 0,
        GroupDescription: "Subtotal Financial Expense",
        AccountType: "Income",
        IndividualLines: 0,
        EmpBenefitCorp: 0,
        GeneralCorporate: 0,
        GeneralGovOfJamaica: 0,
        LifeDepartment: 0,
        total: 0,
      };

      financialExpenseObjects.map((e) => {
        (financialExpenses.IndividualLines += e.IndividualLines),
          (financialExpenses.EmpBenefitCorp += e.EmpBenefitCorp),
          (financialExpenses.GeneralCorporate += e.GeneralCorporate),
          (financialExpenses.GeneralGovOfJamaica += e.GeneralGovOfJamaica),
          (financialExpenses.LifeDepartment += e.LifeDepartment);
        financialExpenses.total += e.total;
      });

      /// Administrative Expense

      const administrativeExpenseObjects = totalAddition.filter(
        (e) => e.GroupDescription === "Administrative Expense"
      );
      const administrativeExpenses = {
        AccountCode: "0000",
        AccountDescription: "Subtotal Administrative Expense",
        GroupCode: 0,
        GroupDescription: "Subtotal Administrative Expense",
        AccountType: "Income",
        IndividualLines: 0,
        EmpBenefitCorp: 0,
        GeneralCorporate: 0,
        GeneralGovOfJamaica: 0,
        LifeDepartment: 0,
        total: 0,
      };

      administrativeExpenseObjects.map((e) => {
        (administrativeExpenses.IndividualLines += e.IndividualLines),
          (administrativeExpenses.EmpBenefitCorp += e.EmpBenefitCorp),
          (administrativeExpenses.GeneralCorporate += e.GeneralCorporate),
          (administrativeExpenses.GeneralGovOfJamaica += e.GeneralGovOfJamaica),
          (administrativeExpenses.LifeDepartment += e.LifeDepartment);
        administrativeExpenses.total += e.total;
      });

      ///  Commision and fee income

      const commisionAndFeeIncomeObjects = totalAddition.filter(
        (e) => e.GroupDescription === "Commision & Fee Income"
      );
      const commisionAndFeeIncome = {
        AccountCode: "0000",
        AccountDescription: "Subtotal Commision & Fee Income",
        GroupCode: 0,
        GroupDescription: "Subtotal Commision & Fee Income",
        AccountType: "Income",
        IndividualLines: 0,
        EmpBenefitCorp: 0,
        GeneralCorporate: 0,
        GeneralGovOfJamaica: 0,
        LifeDepartment: 0,
        total: 0,
      };

      commisionAndFeeIncomeObjects.map((e) => {
        (commisionAndFeeIncome.IndividualLines += e.IndividualLines),
          (commisionAndFeeIncome.EmpBenefitCorp += e.EmpBenefitCorp),
          (commisionAndFeeIncome.GeneralCorporate += e.GeneralCorporate),
          (commisionAndFeeIncome.GeneralGovOfJamaica += e.GeneralGovOfJamaica),
          (commisionAndFeeIncome.LifeDepartment += e.LifeDepartment);
        commisionAndFeeIncome.total += e.total;
      });

      // subtotal investment and other income
      const investmentAndOtherIncomeObjects = totalAddition.filter(
        (e) => e.GroupDescription === "Investments & Other Income"
      );
      const investmentAndOtherIncome = {
        AccountCode: "0000",
        AccountDescription: "Subtotal Investment & Other Income",
        GroupCode: 0,
        GroupDescription: "Subtotal Investment & Other Income",
        AccountType: "Income",
        IndividualLines: 0,
        EmpBenefitCorp: 0,
        GeneralCorporate: 0,
        GeneralGovOfJamaica: 0,
        LifeDepartment: 0,
        total: 0,
      };

      investmentAndOtherIncomeObjects.map((e) => {
        (investmentAndOtherIncome.IndividualLines += e.IndividualLines),
          (investmentAndOtherIncome.EmpBenefitCorp += e.EmpBenefitCorp),
          (investmentAndOtherIncome.GeneralCorporate += e.GeneralCorporate),
          (investmentAndOtherIncome.GeneralGovOfJamaica +=
            e.GeneralGovOfJamaica),
          (investmentAndOtherIncome.LifeDepartment += e.LifeDepartment);
        investmentAndOtherIncome.total += e.total;
      });

      /// pushing in values
      totalAddition.push(totalExpense);
      totalAddition.push(totalIncome);
      totalAddition.push(NetProfitLoss);
      totalAddition.push(administrativeExpenses);
      totalAddition.push(financialExpenses);
      totalAddition.push(commisionAndFeeIncome);
      totalAddition.push(investmentAndOtherIncome);

      return totalAddition;
    } catch (error) {
      return {
        error: error.message,
        statusCode: 400,
      };
    }
  }

async getCashFlow(dto: any) {
  const { reportingMonth } = dto;

  const previousYear = await this.getPreviousYearMonth(reportingMonth);

  const incomeQuery = IncomeStatementQuery();
  const balanceSheetQuery = BalanceSheetQuery();

  const [incomeStatement, balanceSheetCurrent, balanceSheetPrevious] = await Promise.all([
    this.mssqlService.query(incomeQuery, [reportingMonth, reportingMonth]),
    this.mssqlService.query(balanceSheetQuery, [200001, reportingMonth]),
    this.mssqlService.query(balanceSheetQuery, [200001, previousYear]),
  ]);

  const [
    netIncome,
    depreciation,
    changeInAccountReceivable,
    changeInOtherAccountReceivable,
    changeInGroupCompaniesAr,
    changeInPremiumPayable,
    changeInProducerPayable,
    changeInTaxesPayable,
    changeInGroupCompaniesAp,
    changeInCurrentLiabilities,
    changeInComprehensiveIncome,
    purchaseOfProperty,
    otherLongTermInvestments,
    increaseDecreaseLongTermAssets,
    beginningCashBalance,
  ] = await Promise.all([
    this.getNetIncome(incomeStatement),
    this.getDepreciation(incomeStatement),
    this.getChangeInAccountReceivable(balanceSheetCurrent, balanceSheetPrevious),
    this.getChangeInOtherReceivable(balanceSheetCurrent, balanceSheetPrevious),
    this.getChangeInGroupCompanies(balanceSheetCurrent, balanceSheetPrevious),
    this.getChangeInPremiumPayable(balanceSheetCurrent, balanceSheetPrevious),
    this.getChangeInProducerPayable(balanceSheetCurrent, balanceSheetPrevious),
    this.getChangeInTaxesPayable(balanceSheetCurrent, balanceSheetPrevious),
    this.getChangeInGroupCompaniesAp(balanceSheetCurrent, balanceSheetPrevious),
    this.getChangeInCurrentLiabilities(balanceSheetCurrent, balanceSheetPrevious),
    this.getChangeInComprehensiveIncome(balanceSheetCurrent, balanceSheetPrevious),
    this.purchaseOfProperty(balanceSheetCurrent, balanceSheetPrevious),
    this.getOtherLongTermInvestments(balanceSheetCurrent, balanceSheetPrevious),
    this.getIncreaseDecreaseLongTermAssets(balanceSheetCurrent, balanceSheetPrevious),
    this.getBeginningCashBalance(balanceSheetPrevious),
  ]);

  // === CALCULATIONS ===
  const cashFlowFromOperatingActivities =
    netIncome +
    depreciation +
    changeInAccountReceivable +
    changeInOtherAccountReceivable +
    changeInGroupCompaniesAr +
    changeInPremiumPayable +
    changeInProducerPayable +
    changeInTaxesPayable +
    changeInGroupCompaniesAp +
    changeInCurrentLiabilities +
    changeInComprehensiveIncome;

  const cashFlowFromInvestingActivities =
    purchaseOfProperty + otherLongTermInvestments;

  const cashFlowFromFinancingActivities =
    increaseDecreaseLongTermAssets;

  const changeInCashAndCashEquivalents =
    cashFlowFromOperatingActivities +
    cashFlowFromInvestingActivities +
    cashFlowFromFinancingActivities;

  const endingCashBalance =
    beginningCashBalance + changeInCashAndCashEquivalents;

  // === RETURN OBJECT WITH ROUNDED VALUES ===
  const round = (val: number) => Math.round(val);

  return {
    reportingMonth,
    cashFlowFromOperatingActivities: round(cashFlowFromOperatingActivities),
    cashFlowFromInvestingActivities: round(cashFlowFromInvestingActivities),
    cashFlowFromFinancingActivities: round(cashFlowFromFinancingActivities),
    changeInCashAndCashEquivalents: round(changeInCashAndCashEquivalents),
    beginningCashBalance: round(beginningCashBalance),
    endingCashBalance: round(endingCashBalance),
    breakdown: {
      netIncome: round(netIncome),
      depreciation: round(depreciation),
      changeInAccountReceivable: round(changeInAccountReceivable),
      changeInOtherAccountReceivable: round(changeInOtherAccountReceivable),
      changeInGroupCompaniesAr: round(changeInGroupCompaniesAr),
      changeInPremiumPayable: round(changeInPremiumPayable),
      changeInProducerPayable: round(changeInProducerPayable),
      changeInTaxesPayable: round(changeInTaxesPayable),
      changeInGroupCompaniesAp: round(changeInGroupCompaniesAp),
      changeInCurrentLiabilities: round(changeInCurrentLiabilities),
      changeInComprehensiveIncome: round(changeInComprehensiveIncome),
      purchaseOfProperty: round(purchaseOfProperty),
      otherLongTermInvestments: round(otherLongTermInvestments),
      increaseDecreaseLongTermAssets: round(increaseDecreaseLongTermAssets),
    },
  };
}



  private async getPreviousYearMonth(reportingMonth: string) {
    const year = parseInt(reportingMonth.slice(0, 4), 10);
    const month = 12;
    const previousYear = year - 1;
    return `${previousYear}${month}`;
  }

  private async getNetIncome(incomeStatement: any) {
    const incomeObject = incomeStatement.filter(
      (e) => e.AccountType === "Income"
    );
    const expenseObject = incomeStatement.filter(
      (e) => e.AccountType === "Expense"
    );

    const totalIncome = incomeObject.reduce(
      (totals, entry) => {
        totals.currentPeriodIncome += entry["IncomeStatement.CurrentPeriod"];
        totals.yearToDateIncome += entry["IncomeStatement.YearToDate"];
        return totals;
      },
      { currentPeriodIncome: 0, yearToDateIncome: 0 }
    );

    const totalExpense = expenseObject.reduce(
      (totals, entry) => {
        totals.currentPeriodExpense += entry["IncomeStatement.CurrentPeriod"];
        totals.yearToDateExpense += entry["IncomeStatement.YearToDate"];
        return totals;
      },
      { currentPeriodExpense: 0, yearToDateExpense: 0 }
    );

    const netIncome =
      totalIncome.yearToDateIncome - totalExpense.yearToDateExpense;

    return netIncome;
  }

  private async getDepreciation(incomeStatement: any) {
    const depreciationObjects = incomeStatement.filter(
      (e) => e.AccountCode.trim() === "7170"
    );
    const totalDepreciation = depreciationObjects.reduce(
      (totals, entry) => {
        totals.currentPeriod += entry["IncomeStatement.CurrentPeriod"];
        totals.yearToDate += entry["IncomeStatement.YearToDate"];
        return totals;
      },
      { currentPeriod: 0, yearToDate: 0 }
    );

    return totalDepreciation.yearToDate;
  }

  private async getChangeInAccountReceivable(
    balanceSheetCurrentPeriod: any,
    balanceSheetLastPeriod: any
  ) {
    const currentReceivableTotal = balanceSheetCurrentPeriod.reduce(
      (sum, item) => {
        return item.GLAccount.trim() === "2500"
          ? sum + item.AccountBalance
          : sum;
      },
      0
    );

    const lastReceivableTotal = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "2500" ? sum + item.AccountBalance : sum;
    }, 0);

    /// account recievable ---
    const currentAccountReceivableTotal = balanceSheetCurrentPeriod.reduce(
      (sum, item) => {
        return item.GLAccount.trim() === "2600"
          ? sum + item.AccountBalance
          : sum;
      },
      0
    );

    const lastAccountReceivableTotal = balanceSheetLastPeriod.reduce(
      (sum, item) => {
        return item.GLAccount.trim() === "2600"
          ? sum + item.AccountBalance
          : sum;
      },
      0
    );
    /// ----
    const currentAccountReceivableTradeTotal = balanceSheetCurrentPeriod.reduce(
      (sum, item) => {
        return item.GLAccount.trim() === "2650"
          ? sum + item.AccountBalance
          : sum;
      },
      0
    );

    const lastAccountReceivableTradeTotal = balanceSheetLastPeriod.reduce(
      (sum, item) => {
        return item.GLAccount.trim() === "2650"
          ? sum + item.AccountBalance
          : sum;
      },
      0
    );

    const currentDeferredAccountReceivableTotal =
      balanceSheetCurrentPeriod.reduce((sum, item) => {
        return item.GLAccount.trim() === "2651"
          ? sum + item.AccountBalance
          : sum;
      }, 0);

    const lastDeferredAccountReceivableTotal = balanceSheetLastPeriod.reduce(
      (sum, item) => {
        return item.GLAccount.trim() === "2651"
          ? sum + item.AccountBalance
          : sum;
      },
      0
    );

    const DirectBillCommissionIncome =
      currentReceivableTotal - lastReceivableTotal;
    const AccountsReceivable =
      currentAccountReceivableTotal - lastAccountReceivableTotal;
    const AccountReceivableTrade =
      currentAccountReceivableTradeTotal - lastAccountReceivableTradeTotal;
    const DeferredAccountReceivable =
      currentDeferredAccountReceivableTotal -
      lastDeferredAccountReceivableTotal;

    const changeInAccountReceivable =
      (DirectBillCommissionIncome +
        AccountsReceivable +
        AccountReceivableTrade +
        DeferredAccountReceivable) *
      -1;
    return changeInAccountReceivable;
  }

  private async getChangeInOtherReceivable(
    balanceSheetCurrentPeriod: any,
    balanceSheetLastPeriod: any
  ) {
    const currentAccountReceivableTotal = balanceSheetCurrentPeriod.reduce(
      (sum, item) => {
        return item.GLAccount.trim() === "2200"
          ? sum + item.AccountBalance
          : sum;
      },
      0
    );

    const lastAccountReceivableTotal = balanceSheetLastPeriod.reduce(
      (sum, item) => {
        return item.GLAccount.trim() === "2200"
          ? sum + item.AccountBalance
          : sum;
      },
      0
    );

    return (currentAccountReceivableTotal - lastAccountReceivableTotal) * -1;
  }

  private async getChangeInGroupCompanies(
    balanceSheetCurrentPeriod: any,
    balanceSheetLastPeriod: any
  ) {
    const current = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "2800" ? sum + item.AccountBalance : sum;
    }, 0);

    const last = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "2800" ? sum + item.AccountBalance : sum;
    }, 0);

    return (current - last) * -1;
  }

  private async getChangeInPremiumPayable(
    balanceSheetCurrentPeriod: any,
    balanceSheetLastPeriod: any
  ) {
    const current19 = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3019" ? sum + item.AccountBalance : sum;
    }, 0);

    const last19 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3019" ? sum + item.AccountBalance : sum;
    }, 0);

    const current20 = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3020" ? sum + item.AccountBalance : sum;
    }, 0);

    const last20 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3020" ? sum + item.AccountBalance : sum;
    }, 0);

    const current21 = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3021" ? sum + item.AccountBalance : sum;
    }, 0);

    const last21 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3021" ? sum + item.AccountBalance : sum;
    }, 0);

    const h19 = current19 - last19;
    const h20 = current20 - last20;
    const h21 = current21 - last21;

    return h19 + h20 + h21;
  }

  private async getChangeInProducerPayable(
    balanceSheetCurrentPeriod: any,
    balanceSheetLastPeriod: any
  ) {
    const current22 = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3030" ? sum + item.AccountBalance : sum;
    }, 0);

    const last22 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3030" ? sum + item.AccountBalance : sum;
    }, 0);

    const current23 = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3040" ? sum + item.AccountBalance : sum;
    }, 0);

    const last23 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3040" ? sum + item.AccountBalance : sum;
    }, 0);

    const h22 = current22 - last22;
    const h23 = current23 - last23;

    return h22 + h23;
  }

  private async getChangeInTaxesPayable(
    balanceSheetCurrentPeriod: any,
    balanceSheetLastPeriod: any
  ) {
    const current16 = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3005" ? sum + item.AccountBalance : sum;
    }, 0);

    const last16 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3005" ? sum + item.AccountBalance : sum;
    }, 0);

    const current17 = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3010" ? sum + item.AccountBalance : sum;
    }, 0);

    const last17 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3010" ? sum + item.AccountBalance : sum;
    }, 0);

    const h16 = current16 - last16;
    const h17 = current17 - last17;

    return h16 + h17;
  }

  private async getChangeInGroupCompaniesAp(
    balanceSheetCurrentPeriod: any,
    balanceSheetLastPeriod: any
  ) {
    const current15 = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3002" ? sum + item.AccountBalance : sum;
    }, 0);

    const last15 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3002" ? sum + item.AccountBalance : sum;
    }, 0);

    const current25 = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3070" ? sum + item.AccountBalance : sum;
    }, 0);

    const last25 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3070" ? sum + item.AccountBalance : sum;
    }, 0);

    const h15 = current15 - last15;
    const h25 = current25 - last25;

    return h15 + h25;
  }

  private async getChangeInCurrentLiabilities(
    balanceSheetCurrentPeriod: any,
    balanceSheetLastPeriod: any
  ) {
    const current14 = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3000" ? sum + item.AccountBalance : sum;
    }, 0);

    const last14 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3000" ? sum + item.AccountBalance : sum;
    }, 0);

    const current18 = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3015" ? sum + item.AccountBalance : sum;
    }, 0);

    const last18 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3015" ? sum + item.AccountBalance : sum;
    }, 0);

    const current24 = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3050" ? sum + item.AccountBalance : sum;
    }, 0);

    const last24 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3050" ? sum + item.AccountBalance : sum;
    }, 0);

    const h14 = current14 - last14;
    const h18 = current18 - last18;
    const h24 = current24 - last24;

    return h14 + h18 + h24;
  }

  private async getChangeInComprehensiveIncome(
    balanceSheetCurrentPeriod: any,
    balanceSheetLastPeriod: any
  ) {
    const current30 = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "4020" ? sum + item.AccountBalance : sum;
    }, 0);

    const last30 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "4020" ? sum + item.AccountBalance : sum;
    }, 0);

    const undistributedEarning = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GroupDescription === "Undistributed Earnings"
        ? sum + item.AccountBalance
        : sum;
    }, 0);

    const h30 = current30 - last30;

    return h30 - undistributedEarning;
  }

  private async purchaseOfProperty(
    balanceSheetCurrentPeriod: any[],
    balanceSheetLastPeriod: any[]
  ) {
    const getPPEBalances = (data) => {
      const ppeAccounts = data.filter(
        (item) =>
          item.GLAccount.trim() === "2000" &&
          !item.GLSubAccount.startsWith("ZDE") &&
          item.GLSubAccount.trim() !== "LESP"
      );

      // Sum AccountBalance for filtered accounts
      return ppeAccounts.reduce((sum, item) => sum + item.AccountBalance, 0);
    };

    const currentPPE = getPPEBalances(balanceSheetCurrentPeriod);
    const lastPPe = getPPEBalances(balanceSheetLastPeriod)

    return (currentPPE - lastPPe) * -1;
  }


    private async getOtherLongTermInvestments(
    balanceSheetCurrentPeriod: any,
    balanceSheetLastPeriod: any
  ) {
    const current30 = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "1400" ? sum + item.AccountBalance : sum;
    }, 0);

    const last30 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "1400" ? sum + item.AccountBalance : sum;
    }, 0);



    const h30 = (current30 - last30) * -1;

    return h30 ;
  }

private async getIncreaseDecreaseLongTermAssets(
    balanceSheetCurrentPeriod: any,
    balanceSheetLastPeriod: any
  ) {
    const current3090 = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3090" ? sum + item.AccountBalance : sum;
    }, 0);

    const last3090 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "3090" ? sum + item.AccountBalance : sum;
    }, 0);

    const current4500 = balanceSheetCurrentPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "4500" ? sum + item.AccountBalance : sum;
    }, 0);

    const last4500 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "4500" ? sum + item.AccountBalance : sum;
    }, 0);

    const h3090 = current3090 - last3090;
    const h4500 = current4500 - last4500

    return h3090 + h4500 ;
  }

  private async getBeginningCashBalance(
    balanceSheetLastPeriod: any
  ) {

    const last3090 = balanceSheetLastPeriod.reduce((sum, item) => {
      return item.GLAccount.trim() === "2900" ? sum + item.AccountBalance : sum;
    }, 0);


    return last3090;
  }
}

// =+('Epic Comparative BS Summary'!H5+'Epic Comparative BS Summary'!H6+'Epic Comparative BS Summary'!H8+'Epic Comparative BS Summary'!H9)*-1



  // async getCashFlows(dto: any) {
  //   const { reportingMonth } = dto;

  //   const incomeQuery = IncomeStatementQuery();
  //   const balanceSheetQuery = BalanceSheetQuery();

  //   const previousYear = await this.getPreviousYearMonth(reportingMonth);

  //   const [incomeStatement, balanceSheetCurrentPeriod, balanceSheetLastPeriod] =
  //     await Promise.all([
  //       this.mssqlService.query(incomeQuery, [reportingMonth, reportingMonth]),
  //       this.mssqlService.query(balanceSheetQuery, [200001, reportingMonth]),
  //       this.mssqlService.query(balanceSheetQuery, [200001, previousYear]),
  //     ]);

  //   const netIncome = await this.getNetIncome(incomeStatement);
  //   const depreciation = await this.getDepreciation(incomeStatement);
  //   const changeInAccountReceivable = await this.getChangeInAccountReceivable(
  //     balanceSheetCurrentPeriod,
  //     balanceSheetLastPeriod
  //   );
  //   const changeInOtherAccountReceivable =
  //     await this.getChangeInOtherReceivable(
  //       balanceSheetCurrentPeriod,
  //       balanceSheetLastPeriod
  //     );
  //   const changeInGroupCompaniesAr = await this.getChangeInGroupCompanies(
  //     balanceSheetCurrentPeriod,
  //     balanceSheetLastPeriod
  //   );
  //   const changeInPremiumPayable = await this.getChangeInPremiumPayable(
  //     balanceSheetCurrentPeriod,
  //     balanceSheetLastPeriod
  //   );
  //   const changeInProducerPayable = await this.getChangeInProducerPayable(
  //     balanceSheetCurrentPeriod,
  //     balanceSheetLastPeriod
  //   );
  //   const changeInTaxesPayable = await this.getChangeInTaxesPayable(
  //     balanceSheetCurrentPeriod,
  //     balanceSheetLastPeriod
  //   );
  //   const changeInGroupCompaniesAp = await this.getChangeInGroupCompaniesAp(
  //     balanceSheetCurrentPeriod,
  //     balanceSheetLastPeriod
  //   );
  //   const changeInCurrentLiabilities = await this.getChangeInCurrentLiabilities(
  //     balanceSheetCurrentPeriod,
  //     balanceSheetLastPeriod
  //   );
  //   const changeInComprehensiveIncome =
  //     await this.getChangeInComprehensiveIncome(
  //       balanceSheetCurrentPeriod,
  //       balanceSheetLastPeriod
  //     );
  //   const purchaseOfProperty = await this.purchaseOfProperty(
  //     balanceSheetCurrentPeriod,
  //     balanceSheetLastPeriod
  //   );
  //    const OtherLongTermInvestments = await this.getOtherLongTermInvestments(
  //     balanceSheetCurrentPeriod,
  //     balanceSheetLastPeriod
  //   );

  //   const increaseDecreaseLongTermAssets = await this.getIncreaseDecreaseLongTermAssets(
  //     balanceSheetCurrentPeriod,
  //     balanceSheetLastPeriod
  //   );

  //    const beginningCashBalance = await this.getBeginningCashBalance(
  //     balanceSheetLastPeriod
  //   );

  //   console.log(depreciation);
  //   console.log(changeInAccountReceivable);
  //   console.log(changeInOtherAccountReceivable);
  //   console.log(changeInGroupCompaniesAr);
  //   console.log(changeInPremiumPayable);
  //   console.log(changeInProducerPayable);
  //   console.log(changeInTaxesPayable);
  //   console.log(changeInGroupCompaniesAp);
  //   console.log(changeInCurrentLiabilities);
  //   console.log(changeInComprehensiveIncome);
  //   console.log(purchaseOfProperty);
  //   console.log(OtherLongTermInvestments);
  //   console.log(increaseDecreaseLongTermAssets);
  //   console.log(beginningCashBalance);

  //   const cashFlowOperatingActivities =
  //     netIncome +
  //     depreciation +
  //     changeInAccountReceivable +
  //     changeInOtherAccountReceivable +
  //     changeInGroupCompaniesAr +
  //     changeInPremiumPayable +
  //     changeInProducerPayable +
  //     changeInTaxesPayable +
  //     changeInGroupCompaniesAp +
  //     changeInCurrentLiabilities +
  //     changeInComprehensiveIncome;

  //   const cashFlowFromInvestingActivities = purchaseOfProperty + OtherLongTermInvestments
  //   const cashFlowFromFinancingActivities = increaseDecreaseLongTermAssets
  //   const changeInCashAndCashEquivalent = cashFlowOperatingActivities + cashFlowFromInvestingActivities + cashFlowFromFinancingActivities
  //   const endingCashBalance = beginningCashBalance + changeInCashAndCashEquivalent

  //   console.log("cash flow form operating activities", cashFlowOperatingActivities);
  //   console.log("cash flow from investing activities", cashFlowFromInvestingActivities)
  //   console.log("cash flow from financing activities", cashFlowFromFinancingActivities)
  //   console.log("change in cash and cash equivalent", changeInCashAndCashEquivalent)
  //   console.log("ending cash balance", endingCashBalance)

  //   return balanceSheetCurrentPeriod;
  // }