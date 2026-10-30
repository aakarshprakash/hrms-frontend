import { useSearchParams } from 'react-router-dom'
import { Settings2 } from 'lucide-react'
import { PageHeader, Tabs } from '@/components/ui/kit'
import PlatformMobileSettings from './PlatformMobileSettings'
import PlatformMailSettings from './PlatformMailSettings'

const TABS = [
  { key: 'mobile', label: 'Mobile app' },
  { key: 'mail', label: 'Mail server' },
]

/** Platform-wide configuration: the mobile app's switches and the outgoing mail server. */
export default function PlatformSettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'mobile'

  return (
    <div className="space-y-6">
      <PageHeader icon={Settings2} title="Platform settings" subtitle="Switches that apply to every organisation on PeopleNex." />
      <Tabs tabs={TABS} value={tab} onChange={(key) => setParams(key === 'mobile' ? {} : { tab: key })} />
      {tab === 'mobile' && <PlatformMobileSettings />}
      {tab === 'mail' && <PlatformMailSettings />}
    </div>
  )
}
