/**
 * Loss of pay on a payslip breakdown: what absences (and days before joining
 * or after leaving) took off the salary. Payslips store each earning as
 * earned; for display they show the full rate with LOP as a deduction, so
 * gross + deductions both include it and net pay is unchanged.
 */
export function lopAmount(breakdown) {
  const b = breakdown ?? {}
  if ((b.version ?? 1) < 2) return 0 // v1 already lists LOP among its deductions
  if (b.totals?.lop !== undefined && b.totals?.lop !== null) return Number(b.totals.lop) || 0
  return Math.round((b.earnings ?? []).reduce((sum, e) => (
    e.kind === 'structure' && e.prorated && e.monthly !== null && e.monthly !== undefined
      ? sum + Math.max(0, Number(e.monthly) - Number(e.earned)) : sum
  ), 0) * 100) / 100
}
