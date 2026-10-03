import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppShell from '@/components/layout/AppShell'
import ProtectedRoute from '@/routes/ProtectedRoute'
import LoginPage from '@/pages/auth/LoginPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import DashboardPage from '@/pages/DashboardPage'
import EmployeeListPage from '@/pages/employees/EmployeeListPage'
import EmployeeDetailPage from '@/pages/employees/EmployeeDetailPage'
import EmployeeFormPage from '@/pages/employees/EmployeeFormPage'
import DepartmentsPage from '@/pages/departments/DepartmentsPage'
import DesignationsPage from '@/pages/departments/DesignationsPage'
import AttendancePage from '@/pages/attendance/AttendancePage'
import RegularizationPage from '@/pages/attendance/RegularizationPage'
import AttendanceReportsPage from '@/pages/attendance/AttendanceReportsPage'
import MonthlyPunchReportPage from '@/pages/attendance/MonthlyPunchReportPage'
import MusterRollPage from '@/pages/attendance/MusterRollPage'
import AttendanceExceptionsPage from '@/pages/attendance/AttendanceExceptionsPage'
import LeavePage from '@/pages/leaves/LeavePage'
import LeaveSettingsPage from '@/pages/leaves/LeaveSettingsPage'
import LeaveBalancesPage from '@/pages/leaves/LeaveBalancesPage'
import ApprovalsPage from '@/pages/approvals/ApprovalsPage'
import RosterPage from '@/pages/shifts/RosterPage'
import PunchLogPage from '@/pages/attendance/PunchLogPage'
import ShiftSwapPage from '@/pages/shifts/ShiftSwapPage'
import HolidayPage from '@/pages/shifts/HolidayPage'
import ShiftSettingsPage from '@/pages/shifts/ShiftSettingsPage'
import OvertimePage from '@/pages/overtime/OvertimePage'
import SalaryStructurePage from '@/pages/payroll/SalaryStructurePage'
import PayrollRunPage from '@/pages/payroll/PayrollRunPage'
import PayrollRunDetailPage from '@/pages/payroll/PayrollRunDetailPage'
import PayslipPage from '@/pages/payroll/PayslipPage'
import PayrollDashboardPage from '@/pages/payroll/PayrollDashboardPage'
import PayrollSettingsPage from '@/pages/payroll/PayrollSettingsPage'
import CompliancePage from '@/pages/payroll/CompliancePage'
import SettingsPage from '@/pages/settings/SettingsPage'
import QuickSetupPage from '@/pages/settings/QuickSetupPage'
import BranchesPage from '@/pages/settings/BranchesPage'
import CertificatesPage from '@/pages/certificates/CertificatesPage'
import UsersPage from '@/pages/settings/UsersPage'
import RolesPage from '@/pages/settings/RolesPage'
import BiometricSettingsPage from '@/pages/settings/BiometricSettingsPage'
import TeamAttendancePage from '@/pages/attendance/TeamAttendancePage'
import AiInsightsPage from '@/pages/AiInsightsPage'
import TemplateBuilderPage from '@/pages/certificates/TemplateBuilderPage'
import VerifyPage from '@/pages/certificates/VerifyPage'
import ChangePasswordPage from '@/pages/auth/ChangePasswordPage'
import PlatformDashboardPage from '@/pages/platform/PlatformDashboardPage'
import PlatformCompanyPage from '@/pages/platform/PlatformCompanyPage'
import OrganisationSettingsPage from '@/pages/settings/OrganisationSettingsPage'
import AuditLogPage from '@/pages/settings/AuditLogPage'
import BillingPage from '@/pages/settings/BillingPage'
import SignupPage from '@/pages/auth/SignupPage'
import PlatformPlansPage from '@/pages/platform/PlatformPlansPage'
import RequireFeature from '@/routes/RequireFeature'
import NotificationSettingsPage from '@/pages/settings/NotificationSettingsPage'
import AccountNotificationsPage from '@/pages/auth/AccountNotificationsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Public certificate verification — no auth required */}
          <Route path="/verify" element={<VerifyPage />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            {/* First sign-in with a temporary password: outside the app shell */}
            <Route path="/change-password" element={<ChangePasswordPage forced />} />

            <Route element={<AppShell />}>
              {/* Platform console (super admin) */}
              <Route path="/platform" element={<PlatformDashboardPage />} />
              <Route path="/platform/companies/:id" element={<PlatformCompanyPage />} />
              <Route path="/platform/plans" element={<PlatformPlansPage />} />

              <Route path="/account/security" element={<ChangePasswordPage />} />
              <Route path="/account/notifications" element={<AccountNotificationsPage />} />

              <Route path="/dashboard" element={<DashboardPage />} />

              <Route path="/employees" element={<EmployeeListPage />} />
              <Route path="/employees/new" element={<EmployeeFormPage />} />
              <Route path="/employees/:id" element={<EmployeeDetailPage />} />
              <Route path="/employees/:id/edit" element={<EmployeeFormPage />} />
              <Route path="/employees/:employeeId/salary" element={<SalaryStructurePage />} />

              <Route path="/departments" element={<DepartmentsPage />} />
              <Route path="/designations" element={<DesignationsPage />} />

              {/* Phase 2: Attendance */}
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/attendance/manage" element={<TeamAttendancePage />} />
              <Route path="/attendance/regularizations" element={<RegularizationPage />} />
              <Route path="/attendance/reports" element={<AttendanceReportsPage />} />
              <Route path="/attendance/monthly-punches" element={<MonthlyPunchReportPage />} />
              <Route path="/attendance/muster-roll" element={<MusterRollPage />} />
              <Route path="/attendance/exceptions" element={<AttendanceExceptionsPage />} />
              <Route path="/attendance/punches" element={<PunchLogPage />} />

              {/* Leave & approvals */}
              <Route path="/leaves" element={<LeavePage />} />
              <Route path="/leaves/apply" element={<LeavePage />} />
              <Route path="/leaves/balances" element={<LeaveBalancesPage />} />
              <Route path="/leaves/settings" element={<LeaveSettingsPage />} />
              <Route path="/approvals" element={<ApprovalsPage />} />

              {/* Phase 2: Shifts */}
              <Route path="/shifts/roster" element={<RequireFeature feature="shifts"><RosterPage /></RequireFeature>} />
              <Route path="/shifts/swaps" element={<RequireFeature feature="shifts"><ShiftSwapPage /></RequireFeature>} />
              <Route path="/shifts/holidays" element={<HolidayPage />} />

              {/* Phase 3: Overtime */}
              <Route path="/overtime" element={<OvertimePage />} />

              {/* Phase 3: Payroll */}
              <Route path="/payroll" element={<RequireFeature feature="payroll"><PayrollDashboardPage /></RequireFeature>} />
              <Route path="/payroll/runs" element={<RequireFeature feature="payroll"><PayrollRunPage /></RequireFeature>} />
              <Route path="/payroll/runs/:id" element={<RequireFeature feature="payroll"><PayrollRunDetailPage /></RequireFeature>} />
              <Route path="/payroll/payslips" element={<RequireFeature feature="payroll"><PayslipPage /></RequireFeature>} />
              <Route path="/payroll/settings" element={<RequireFeature feature="payroll"><PayrollSettingsPage /></RequireFeature>} />
              <Route path="/payroll/compliance" element={<RequireFeature feature="statutory"><CompliancePage /></RequireFeature>} />

              {/* Phase 4: Certificates */}
              <Route path="/certificates" element={<RequireFeature feature="certificates"><CertificatesPage /></RequireFeature>} />
              <Route path="/certificates/templates/new" element={<RequireFeature feature="certificates"><TemplateBuilderPage /></RequireFeature>} />
              <Route path="/certificates/templates/:id/edit" element={<RequireFeature feature="certificates"><TemplateBuilderPage /></RequireFeature>} />

              {/* Phase 5+ stubs */}
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/users" element={<UsersPage />} />
              <Route path="/settings/roles" element={<RolesPage />} />
              <Route path="/insights" element={<RequireFeature feature="insights"><AiInsightsPage /></RequireFeature>} />
              <Route path="/settings/quick-setup" element={<QuickSetupPage />} />
              <Route path="/settings/shifts" element={<ShiftSettingsPage />} />
              <Route path="/settings/branches" element={<BranchesPage />} />
              <Route path="/settings/biometric" element={<RequireFeature feature="biometric"><BiometricSettingsPage /></RequireFeature>} />
              <Route path="/settings/organisation" element={<OrganisationSettingsPage />} />
              <Route path="/settings/audit" element={<RequireFeature feature="audit_log"><AuditLogPage /></RequireFeature>} />
              <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
              <Route path="/settings/billing" element={<BillingPage />} />

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
