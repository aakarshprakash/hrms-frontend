import { useRole } from '@/hooks/useRole'
import EmployeeHome from '@/pages/home/EmployeeHome'
import OrgDashboard from '@/pages/dashboard/OrgDashboard'

/**
 * Employees and managers land on their self-service home; people who run
 * a branch or the organisation get the organisation dashboard.
 */
export default function DashboardPage() {
  const { dataScope, user } = useRole()
  const selfService = !!user?.employee_id && (dataScope === 'self' || dataScope === 'team')

  return selfService ? <EmployeeHome /> : <OrgDashboard />
}
