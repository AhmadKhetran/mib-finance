import { query } from "express"

export const BalanceSheetQuery = () => {

    const query = `
-- Declare input parameters
DECLARE @StartMonth VARCHAR(6) = @0;
DECLARE @EndMonth VARCHAR(6) = @1;
DECLARE @UniqAgencyList VARCHAR(MAX) = '65537';

-- Create temporary table for agency fiscal periods
CREATE TABLE #tmpAgency (
    UniqAgency INT,
    FiscalInitialMonth VARCHAR(6),
    InitialMonth VARCHAR(6),
    FirstFiscalMonth VARCHAR(2),
    BeginYearMonth VARCHAR(6),
    EndYearMonth VARCHAR(6)
);

-- Populate agency fiscal periods
INSERT INTO #tmpAgency
SELECT
    a.UniqAgency,
    FiscalInitialMonth = CASE
        WHEN a.FirstFiscalMonth = '01' THEN a.InitialMonth
        WHEN SUBSTRING(a.InitialMonth, 5, 2) >= a.FirstFiscalMonth
            THEN CONVERT(CHAR(4), CONVERT(INT, SUBSTRING(a.InitialMonth, 1, 4)) + 1) +
                 RIGHT('0' + CONVERT(VARCHAR(2), CONVERT(INT, SUBSTRING(a.InitialMonth, 5, 2)) -
                 CONVERT(INT, a.FirstFiscalMonth) + 1), 2)
        ELSE SUBSTRING(a.InitialMonth, 1, 4) +
             RIGHT('0' + CONVERT(VARCHAR(2), (12 - CONVERT(INT, a.FirstFiscalMonth) +
             CONVERT(INT, SUBSTRING(a.InitialMonth, 5, 2)) + 1)), 2)
    END,
    a.InitialMonth,
    a.FirstFiscalMonth,
    BeginYearMonth = CONVERT(CHAR(4), CASE
        WHEN a.FirstFiscalMonth = '01' THEN YEAR(CONVERT(DATE, @StartMonth + '01'))
        WHEN SUBSTRING(@StartMonth, 5, 2) >= a.FirstFiscalMonth THEN YEAR(CONVERT(DATE, @StartMonth + '01')) + 1
        ELSE YEAR(CONVERT(DATE, @StartMonth + '01'))
    END) + RIGHT('0' + CONVERT(VARCHAR(2), CASE
        WHEN SUBSTRING(@StartMonth, 5, 2) >= a.FirstFiscalMonth
            THEN SUBSTRING(@StartMonth, 5, 2) - CONVERT(INT, a.FirstFiscalMonth) + 1
        ELSE (12 - CONVERT(INT, a.FirstFiscalMonth) + SUBSTRING(@StartMonth, 5, 2) + 1)
    END), 2),
    EndYearMonth = CONVERT(CHAR(4), CASE
        WHEN a.FirstFiscalMonth = '01' THEN YEAR(CONVERT(DATE, @EndMonth + '01'))
        WHEN SUBSTRING(@EndMonth, 5, 2) >= a.FirstFiscalMonth THEN YEAR(CONVERT(DATE, @EndMonth + '01')) + 1
        ELSE YEAR(CONVERT(DATE, @EndMonth + '01'))
    END) + RIGHT('0' + CONVERT(VARCHAR(2), CASE
        WHEN SUBSTRING(@EndMonth, 5, 2) >= a.FirstFiscalMonth
            THEN SUBSTRING(@EndMonth, 5, 2) - CONVERT(INT, a.FirstFiscalMonth) + 1
        ELSE (12 - CONVERT(INT, a.FirstFiscalMonth) + SUBSTRING(@EndMonth, 5, 2) + 1)
    END), 2)
FROM Agency a
WHERE a.UniqAgency IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@UniqAgencyList, ','));

-- Create temporary table for account balances
CREATE TABLE #tmpAccount (
    UniqGlAccount INT,
    TypeCode CHAR(1),
    Account VARCHAR(50),
    Amount DECIMAL(18, 2),
    UniqRegion INT,
    UniqAgency INT
);

-- Insert account balances for Assets, Liabilities, and Equity
INSERT INTO #tmpAccount
SELECT
    g.UniqGlAccount,
    g.TypeCode,
    g.Account,
    SUM(gb.Amount) AS Amount,
    -1 AS UniqRegion,
    gb.UniqAgency
FROM GlAccount g
INNER JOIN GlAccountBalance gb ON g.UniqGlAccount = gb.UniqGlAccount
INNER JOIN #tmpAgency ta ON gb.UniqAgency = ta.UniqAgency
WHERE g.TypeCode IN ('A', 'E', 'L')
    AND (
        (RIGHT(gb.FiscalAccountingMonth, 2) <> '00'
            AND gb.FiscalAccountingMonth >= ta.BeginYearMonth
            AND gb.FiscalAccountingMonth <= ta.EndYearMonth)
        OR (RIGHT(gb.FiscalAccountingMonth, 2) = '00'
            AND ta.FiscalInitialMonth >= ta.BeginYearMonth
            AND ta.FiscalInitialMonth <= ta.EndYearMonth
            AND ta.BeginYearMonth <> ta.EndYearMonth)
    )
    AND gb.UniqAgency IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@UniqAgencyList, ','))
GROUP BY g.UniqGlAccount, g.TypeCode, g.Account, gb.UniqAgency;

-- Insert aggregated Income and Expense accounts as Equity
INSERT INTO #tmpAccount
SELECT
    -1 AS UniqGlAccount,
    'E' AS TypeCode,
    '' AS Account,
    SUM(gb.Amount) AS Amount,
    -1 AS UniqRegion,
    gb.UniqAgency
FROM GlAccount g
INNER JOIN GlAccountBalance gb ON g.UniqGlAccount = gb.UniqGlAccount
INNER JOIN #tmpAgency ta ON gb.UniqAgency = ta.UniqAgency
WHERE g.TypeCode IN ('I', 'X')
    AND (
        (RIGHT(gb.FiscalAccountingMonth, 2) <> '00'
            AND gb.FiscalAccountingMonth >= ta.BeginYearMonth
            AND gb.FiscalAccountingMonth <= ta.EndYearMonth)
        OR (RIGHT(gb.FiscalAccountingMonth, 2) = '00'
            AND ta.FiscalInitialMonth >= ta.BeginYearMonth
            AND ta.FiscalInitialMonth <= ta.EndYearMonth
            AND ta.BeginYearMonth <> ta.EndYearMonth)
    )
    AND gb.UniqAgency IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@UniqAgencyList, ','))
GROUP BY gb.UniqAgency;

-- Create temporary table for grouped account information
CREATE TABLE #tmpGrouping (
    UniqGlAccount INT,
    UniqAgency INT,
    TypeCode CHAR(1),
    SortType INT,
    AccountBalance DECIMAL(18, 2),
    TitleAccount VARCHAR(50),
    TitleAccountDescription NVARCHAR(255),
    UniqRegion INT
);

-- Insert account groupings
INSERT INTO #tmpGrouping
SELECT
    t.UniqGlAccount,
    t.UniqAgency,
    CASE t.TypeCode WHEN 'A' THEN 'A' WHEN 'L' THEN 'L' ELSE 'E' END AS TypeCode,
    CASE t.TypeCode WHEN 'A' THEN 1 WHEN 'L' THEN 2 ELSE 3 END AS SortType,
    CASE WHEN t.TypeCode = 'A' THEN t.Amount ELSE 0 - t.Amount END AS AccountBalance,
    g.Account AS TitleAccount,
    clr.ResourceText AS TitleAccountDescription,
    -1 AS UniqRegion
FROM #tmpAccount t
INNER JOIN GlAccount g ON t.Account = g.Account AND g.AccountLevelCode IN ('T', 'R')
LEFT OUTER JOIN ConfigureLkLanguageResource clr ON clr.ConfigureLkLanguageResourceID = g.ConfigureLkLanguageResourceID
    AND clr.CultureCode = 'en-US'
WHERE t.Amount <> 0;

-- Insert distinct accounts with zero balance if not already present
INSERT INTO #tmpGrouping
SELECT DISTINCT
    g.UniqGlAccount,
    t.UniqAgency,
    CASE t.TypeCode WHEN 'A' THEN 'A' WHEN 'L' THEN 'L' ELSE 'E' END AS TypeCode,
    CASE t.TypeCode WHEN 'A' THEN 1 WHEN 'L' THEN 2 ELSE 3 END AS SortType,
    0 AS AccountBalance,
    g.Account AS TitleAccount,
    clr.ResourceText AS TitleAccountDescription,
    -1 AS UniqRegion
FROM #tmpAccount t
INNER JOIN GlAccount g ON t.Account = g.Account AND g.AccountLevelCode IN ('T', 'R')
LEFT OUTER JOIN ConfigureLkLanguageResource clr ON clr.ConfigureLkLanguageResourceID = g.ConfigureLkLanguageResourceID
    AND clr.CultureCode = 'en-US'
WHERE t.Amount <> 0
    AND NOT EXISTS (
        SELECT 1 FROM #tmpGrouping g2
        WHERE g2.UniqGlAccount = g.UniqGlAccount
    );

-- Create temporary table for account type totals
CREATE TABLE #tmpAccountTypeTotal (
    TypeCode CHAR(1),
    Amount DECIMAL(18, 2)
);

-- Insert account type totals
INSERT INTO #tmpAccountTypeTotal
SELECT
    g.TypeCode,
    SUM(gb.Amount) AS Amount
FROM GlAccount g
INNER JOIN GlAccountBalance gb ON g.UniqGlAccount = gb.UniqGlAccount
INNER JOIN #tmpAgency ta ON gb.UniqAgency = ta.UniqAgency
WHERE (
        (RIGHT(gb.FiscalAccountingMonth, 2) <> '00'
            AND gb.FiscalAccountingMonth >= ta.BeginYearMonth
            AND gb.FiscalAccountingMonth <= ta.EndYearMonth)
        OR (RIGHT(gb.FiscalAccountingMonth, 2) = '00'
            AND ta.FiscalInitialMonth >= ta.BeginYearMonth
            AND ta.FiscalInitialMonth <= ta.EndYearMonth
            AND ta.BeginYearMonth <> ta.EndYearMonth)
    )
    AND gb.UniqAgency IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@UniqAgencyList, ','))
GROUP BY g.TypeCode;

-- Create temporary table for account information
CREATE TABLE #AccountInfo (
    UniqGlAccount INT,
    UniqAgency INT,
    GroupCode INT,
    GLAccount VARCHAR(50),
    GroupDescription NVARCHAR(255),
    GroupDescriptionFormat NVARCHAR(255),
    GroupDescriptionArgument0 NVARCHAR(255),
    GLSubAccount VARCHAR(50),
    AccountDescription NVARCHAR(255),
    AccountDescriptionFormat NVARCHAR(255),
    AccountDescriptionArgument0 NVARCHAR(255)
);

-- Insert account information
INSERT INTO #AccountInfo
SELECT
    g.UniqGlAccount,
    t.UniqAgency,
    CASE gag.GroupCode WHEN 0 THEN 1000 ELSE gag.GroupCode END AS GroupCode,
    g.Account AS GLAccount,
    CASE g.UniqGlAccount WHEN -1 THEN 'Undistributed Earnings' ELSE lkglag.ResourceText END AS GroupDescription,
    CASE g.UniqGlAccount WHEN -1 THEN 'Undistributed Earnings' ELSE '{0}' END AS GroupDescriptionFormat,
    lkglag.ResourceText AS GroupDescriptionArgument0,
    g.SubAccount AS GLSubAccount,
    CASE g.UniqGlAccount WHEN -1 THEN 'Undistributed Earnings' ELSE lkaccount.ResourceText END AS AccountDescription,
    CASE g.UniqGlAccount WHEN -1 THEN 'Undistributed Earnings' ELSE '{0}' END AS AccountDescriptionFormat,
    lkaccount.ResourceText AS AccountDescriptionArgument0
FROM #tmpGrouping t
INNER JOIN GlAccount g ON t.UniqGlAccount = g.UniqGlAccount
LEFT OUTER JOIN ConfigureLkLanguageResource lkaccount ON lkaccount.ConfigureLkLanguageResourceID = g.ConfigureLkLanguageResourceID
    AND lkaccount.CultureCode = 'en-US'
INNER JOIN GlAccountGroup gag ON g.UniqGlAccountGroup = gag.UniqGlAccountGroup
LEFT OUTER JOIN ConfigureLkLanguageResource lkglag ON lkglag.ConfigureLkLanguageResourceID = gag.ConfigureLkLanguageResourceID
    AND lkglag.CultureCode = 'en-US';

-- Final balance sheet report
SELECT
    t.UniqGlAccount,
    t.TypeCode AS [AccountTypeCode],
    CASE t.TypeCode
        WHEN 'A' THEN 'ASSET'
        WHEN 'L' THEN 'LIABILITY'
        ELSE 'EQUITY'
    END AS [AccountTypeDescription],
    ai.GroupCode AS [GroupCode],
    ai.GLAccount AS [GLAccount],
    ai.GroupDescription AS [GroupDescription],
    ai.GLSubAccount AS [GLSubAccount],
    ai.AccountDescription AS [AccountDescription],
    t.AccountBalance AS [AccountBalance],
    0 - (ISNULL(l.Amount, 0) + ISNULL(e.Amount, 0) + ISNULL(i.Amount, 0) + ISNULL(x.Amount, 0)) AS [BalanceSheetReport.TotalLiabilityEquity],
    ai.GroupDescriptionFormat AS [GroupDescription.Format],
    ai.GroupDescriptionArgument0 AS [GroupDescription.Argument0],
    ai.AccountDescriptionFormat AS [AccountDescription.Format],
    ai.AccountDescriptionArgument0 AS [AccountDescription.Argument0]
FROM #tmpGrouping t
LEFT OUTER JOIN #tmpAccountTypeTotal a ON a.TypeCode = 'A'
LEFT OUTER JOIN #tmpAccountTypeTotal l ON l.TypeCode = 'L'
LEFT OUTER JOIN #tmpAccountTypeTotal e ON e.TypeCode = 'E'
LEFT OUTER JOIN #tmpAccountTypeTotal i ON i.TypeCode = 'I'
LEFT OUTER JOIN #tmpAccountTypeTotal x ON x.TypeCode = 'X'
INNER JOIN #AccountInfo ai ON t.UniqGlAccount = ai.UniqGlAccount
ORDER BY
    t.SortType,
    ai.GroupCode,
    CAST(ai.GLAccount AS INT),
    ai.GLSubAccount;

-- Clean up temporary tables
DROP TABLE #tmpAgency;
DROP TABLE #tmpAccount;
DROP TABLE #tmpGrouping;
DROP TABLE #tmpAccountTypeTotal;
DROP TABLE #AccountInfo;`
return query
}


export const IncomeStatementQuery = () => {
    const query = `DECLARE @StartMonth VARCHAR(6) = @0;
DECLARE @EndMonth VARCHAR(6) = @1;
DECLARE @StartOfYear VARCHAR(6) = LEFT(@EndMonth, 4) + '01';

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
    SUM(CASE WHEN gab.FiscalAccountingMonth = @StartMonth THEN
        CASE ga.TypeCode WHEN 'I' THEN gab.Amount * -1 ELSE gab.Amount END
    ELSE 0.00 END) AS [IncomeStatement.CurrentPeriod], -- Note: This will be 0 unless @StartMonth matches
    SUM(CASE WHEN gab.FiscalAccountingMonth BETWEEN @StartOfYear AND @EndMonth THEN
        CASE ga.TypeCode WHEN 'I' THEN gab.Amount * -1 ELSE gab.Amount END
    ELSE 0.00 END) AS [IncomeStatement.YearToDate]
FROM GlAccount ga
JOIN GlAccountBalance gab ON ga.UniqGlAccount = gab.UniqGlAccount
LEFT JOIN GlAccountGroup gag ON ga.UniqGlAccountGroup = gag.UniqGlAccountGroup
LEFT JOIN ConfigureLkLanguageResource clr ON clr.ConfigureLkLanguageResourceID = ga.ConfigureLkLanguageResourceID AND clr.CultureCode = 'en-US'
LEFT JOIN ConfigureLkLanguageResource clr2 ON clr2.ConfigureLkLanguageResourceID = gag.ConfigureLkLanguageResourceID AND clr2.CultureCode = 'en-US'
WHERE gab.UniqAgency = 65537
    AND gab.FiscalAccountingMonth BETWEEN @StartOfYear AND @EndMonth
    AND ga.TypeCode IN ('I', 'X') -- Focus on Income and Expense accounts
GROUP BY
    ga.Account,
    ga.TypeCode,
    gag.GroupCode
HAVING SUM(gab.Amount) <> 0
ORDER BY
    CASE ga.TypeCode WHEN 'I' THEN 1 ELSE 2 END, -- Income first, then Expenses
    gag.GroupCode,
    ga.Account`

    return query
}