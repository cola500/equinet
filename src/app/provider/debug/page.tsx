"use client"

import { useAuth } from "@/hooks/useAuth"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { DebugLogViewer } from "@/components/provider/DebugLogViewer"

export default function DebugPage() {
  const { isProvider, isLoading } = useAuth()
  const offlineMode = useFeatureFlag("offline_mode")

  if (isLoading) {
    return null
  }

  if (!isProvider || !offlineMode) {
    return (
      <ProviderLayout>
        <p className="text-center text-gray-500 py-20">
          Sidan hittades inte.
        </p>
      </ProviderLayout>
    )
  }

  return (
    <ProviderLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Debug-loggar</h1>
        <p className="text-gray-600 text-sm mt-1">
          Offline-diagnostik. Kopiera och skicka till support vid problem.
        </p>
      </div>
      <DebugLogViewer />
    </ProviderLayout>
  )
}
