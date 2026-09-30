import { useEffect, useState } from 'react'

import { fetchEngagementAlert, type EngagementAlert } from './meetingApi'

type EngagementAlertPanelProps = { meetingId: string; authToken: string }

export function EngagementAlertPanel({ meetingId, authToken }: EngagementAlertPanelProps) {
  const [alert, setAlert] = useState<EngagementAlert | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const next = await fetchEngagementAlert(meetingId, authToken)
        if (!cancelled) { setAlert(next); setError('') }
      } catch (refreshError) {
        if (!cancelled) setError(refreshError instanceof Error ? refreshError.message : 'Unable to load engagement alert')
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [authToken, meetingId])

  if (error) return <p className="meeting-error" role="alert">{error}</p>
  if (!alert) return null
  return <section className={`engagement-alert ${alert.alert ? 'engagement-alert-active' : ''}`} role={alert.alert ? 'alert' : 'status'}>
    <strong>{alert.alert ? 'Meeting engagement alert' : 'Engagement monitor'}</strong>
    <span>{alert.alert ? alert.message : `${alert.low_engagement_participants} of ${alert.eligible_participants} eligible participants currently show low visual engagement.`}</span>
  </section>
}