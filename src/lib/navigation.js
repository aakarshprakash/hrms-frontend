import {
  LayoutDashboard, Users, Clock, CalendarDays, IndianRupee, Award, Building, Settings, Sparkles, ShieldCheck,
  History, Globe2, Inbox, BellRing, CreditCard, Layers, KeyRound,
} from 'lucide-react'

/*
 * The app's navigation: sidebar sections and the pages the command palette
 * can jump to. Driven by permissions (what the user may do) and plan
 * features (what the organisation has bought) -- the same rules the API
 * enforces. `perms` lists alternatives (any one grants access).
 */
export const SECTIONS = [
  {
    label: null,
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/approvals', icon: Inbox, label: 'Approvals', perms: ['leaves.approve'], badge: 'approvals' },
      { to: '/insights', icon: Sparkles, label: 'AI Insights', perms: ['insights.view'], feature: 'insights' },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/employees', icon: Users, label: 'Employees' },
      {
        label: 'Organisation', icon: Building, group: true, prefix: ['/departments', '/designations', '/settings/branches'],
        perms: ['departments.manage', 'settings.manage'],
        children: [
          { to: '/settings/branches', label: 'Branches', perms: ['settings.manage'] },
          { to: '/departments', label: 'Departments', perms: ['departments.manage'] },
          { to: '/designations', label: 'Designations', perms: ['departments.manage'] },
        ],
      },
    ],
  },
  {
    label: 'Time',
    items: [
      {
        label: 'Attendance', icon: Clock, group: true, prefix: ['/attendance', '/shifts', '/settings/shifts', '/settings/biometric', '/overtime'],
        children: [
          { to: '/attendance', label: 'My Attendance' },
          { to: '/attendance/manage', label: 'Team Attendance', perms: ['attendance.view', 'attendance.manage'] },
          { to: '/attendance/regularizations', label: 'Regularization' },
          { to: '/overtime', label: 'Overtime' },
          { to: '/attendance/reports', label: 'Reports', perms: ['attendance.view'] },
          { to: '/attendance/muster-roll', label: 'Muster Roll', perms: ['attendance.view'] },
          { to: '/attendance/exceptions', label: 'Exceptions', perms: ['attendance.view'] },
          { to: '/attendance/punches', label: 'Punch Log', perms: ['attendance.view', 'attendance.manage'] },
          { to: '/shifts/roster', label: 'Shift Roster', perms: ['attendance.view', 'shifts.manage'], feature: 'shifts' },
          { to: '/shifts/swaps', label: 'Shift Swaps', feature: 'shifts' },
          { to: '/shifts/holidays', label: 'Holidays' },
          { to: '/settings/shifts', label: 'Shifts', perms: ['shifts.manage'] },
          { to: '/settings/biometric', label: 'Biometric Devices', perms: ['settings.manage'], feature: 'biometric' },
        ],
      },
      {
        label: 'Leave', icon: CalendarDays, group: true, prefix: ['/leaves'],
        children: [
          { to: '/leaves', label: 'My Leave' },
          { to: '/leaves/balances', label: 'Leave Balances', perms: ['leaves.view', 'leaves.approve', 'leaves.manage'] },
          { to: '/leaves/settings', label: 'Leave Settings', perms: ['leaves.manage'] },
        ],
      },
    ],
  },
  {
    label: 'Money',
    items: [
      {
        label: 'Payroll', icon: IndianRupee, group: true, prefix: ['/payroll'], perms: ['payroll.view', 'payroll.manage'], feature: 'payroll',
        children: [
          { to: '/payroll', label: 'Overview' },
          { to: '/payroll/runs', label: 'Payroll Runs' },
          { to: '/payroll/payslips', label: 'Payslips' },
          { to: '/payroll/compliance', label: 'Compliance', perms: ['payroll.view', 'payroll.manage', 'reports.view'], feature: 'statutory' },
          { to: '/payroll/settings', label: 'Pay Settings', perms: ['payroll.manage'] },
        ],
      },
      { to: '/payroll/payslips', icon: IndianRupee, label: 'My Payslips', notPerms: ['payroll.view', 'payroll.manage'] },
      { to: '/certificates', icon: Award, label: 'Letters & Certificates', feature: 'certificates' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/settings/users', icon: ShieldCheck, label: 'Users & Access', perms: ['users.manage'] },
      { to: '/settings/roles', icon: KeyRound, label: 'Roles', perms: ['roles.manage'] },
      { to: '/settings/notifications', icon: BellRing, label: 'Notifications', perms: ['notifications.manage'] },
      { to: '/settings/audit', icon: History, label: 'Audit Trail', perms: ['audit.view'], feature: 'audit_log' },
      { to: '/settings/billing', icon: CreditCard, label: 'Plan & Billing', perms: ['billing.manage'] },
      { to: '/settings', icon: Settings, label: 'Settings', perms: ['settings.manage'], exact: true },
    ],
  },
]

export const PLATFORM_SECTION = {
  label: 'Platform',
  items: [
    { to: '/platform', icon: Globe2, label: 'Organisations', exact: true },
    { to: '/platform/plans', icon: Layers, label: 'Plans' },
  ],
}

/** Whether a nav item is available to this user and organisation. */
export function isAllowed(item, { can, hasFeature }) {
  if (item.feature && !hasFeature(item.feature)) return false
  if (item.notPerms && can(...item.notPerms)) return false   // e.g. "My Payslips" only for non-payroll users
  if (item.perms && !can(...item.perms)) return false
  return true
}

/** Every page the user can open, flattened -- for search. */
export function reachablePages(sections, ctx) {
  const pages = []
  for (const section of sections) {
    for (const item of section.items) {
      if (!isAllowed(item, ctx)) continue
      if (item.group) {
        for (const child of item.children) {
          if (isAllowed(child, ctx)) pages.push({ to: child.to, label: child.label, group: item.label, icon: item.icon })
        }
      } else {
        pages.push({ to: item.to, label: item.label, group: section.label ?? 'General', icon: item.icon })
      }
    }
  }
  return pages.filter((p, i) => pages.findIndex((q) => q.to === p.to && q.label === p.label) === i)
}
