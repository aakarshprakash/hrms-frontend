import { useRole } from '@/hooks/useRole'
import { UpgradeNotice } from '@/components/ui/kit'
import { FEATURE_LABELS } from '@/lib/api/billing'

/** A module the organisation's plan must include; otherwise an upgrade prompt. */
export default function RequireFeature({ feature, children }) {
  const { hasFeature, isPlatformAdmin, inSupportMode } = useRole()

  if ((isPlatformAdmin && !inSupportMode) || hasFeature(feature)) return children

  return (
    <div className="py-10">
      <UpgradeNotice feature={FEATURE_LABELS[feature]?.toLowerCase() ?? feature}
        description={`${FEATURE_LABELS[feature] ?? 'This module'} isn’t included in your current plan. Upgrade to switch it on — your data is kept.`} />
    </div>
  )
}
