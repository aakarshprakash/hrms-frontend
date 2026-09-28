import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import SubscriptionBanner from './SubscriptionBanner'

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} />
        <SubscriptionBanner />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1480px] p-4 md:p-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
