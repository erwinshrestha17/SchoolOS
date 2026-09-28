-- A separate workflow keeps fiscal-year reopen distinct from period reopen.
ALTER TYPE "ApprovalWorkflowType" ADD VALUE IF NOT EXISTS 'FISCAL_YEAR_REOPEN';
