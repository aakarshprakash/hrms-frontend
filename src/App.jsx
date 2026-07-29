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
import MusterRollPage from '@/pages/attendance/MusterRollPage'
import AttendanceExceptionsPage from '@/pages/attendance/AttendanceExceptionsPage'
import LeavePage from '@/pages/leaves/LeavePage'
import LeaveFormPage from '@/pages/leaves/LeaveFormPage'
import LeaveSettingsPage from '@/pages/leaves/LeaveSettingsPage'
import ShiftRosterPage from '@/pages/shifts/ShiftRosterPage'
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
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Public certificate verification — no auth required */}
          <Route path="/verify" element={<VerifyPage />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
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
              <Route path="/attendance/muster-roll" element={<MusterRollPage />} />
              <Route path="/attendance/exceptions" element={<AttendanceExceptionsPage />} />

              {/* Phase 2: Leaves */}
              <Route path="/leaves" element={<LeavePage />} />
              <Route path="/leaves/apply" element={<LeaveFormPage />} />
              <Route path="/leaves/settings" element={<LeaveSettingsPage />} />

              {/* Phase 2: Shifts */}
              <Route path="/shifts/roster" element={<ShiftRosterPage />} />
              <Route path="/shifts/swaps" element={<ShiftSwapPage />} />
              <Route path="/shifts/holidays" element={<HolidayPage />} />

              {/* Phase 3: Overtime */}
              <Route path="/overtime" element={<OvertimePage />} />

              {/* Phase 3: Payroll */}
              <Route path="/payroll" element={<PayrollDashboardPage />} />
              <Route path="/payroll/runs" element={<PayrollRunPage />} />
              <Route path="/payroll/runs/:id" element={<PayrollRunDetailPage />} />
              <Route path="/payroll/payslips" element={<PayslipPage />} />
              <Route path="/payroll/settings" element={<PayrollSettingsPage />} />

              {/* Phase 4: Certificates */}
              <Route path="/certificates" element={<CertificatesPage />} />
              <Route path="/certificates/templates/new" element={<TemplateBuilderPage />} />
              <Route path="/certificates/templates/:id/edit" element={<TemplateBuilderPage />} />

              {/* Phase 5+ stubs */}
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/users" element={<UsersPage />} />
              <Route path="/settings/roles" element={<RolesPage />} />
              <Route path="/insights" element={<AiInsightsPage />} />
              <Route path="/settings/quick-setup" element={<QuickSetupPage />} />
              <Route path="/settings/shifts" element={<ShiftSettingsPage />} />
              <Route path="/settings/branches" element={<BranchesPage />} />
              <Route path="/settings/biometric" element={<BiometricSettingsPage />} />
              <Route path="/recruitment" element={<StubPage title="Recruitment" phase="Phase 5" />} />
              <Route path="/performance" element={<StubPage title="Performance" phase="Phase 5" />} />
              <Route path="/reports" element={<StubPage title="Reports" phase="Phase 6" />} />

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

function StubPage({ title, phase }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="rounded-2xl border border-dashed border-slate-300 px-12 py-10">
        <h1 className="text-xl font-bold text-slate-700">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">Coming in {phase}</p>
      </div>
    </div>
  )
}
