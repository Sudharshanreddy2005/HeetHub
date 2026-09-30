import { useState } from 'react'
import type { MeetingControls, ModerationAction } from './meetingApi'

const supportedControls: Array<{ key: keyof Pick<MeetingControls, 'allow_chat' | 'allow_participant_microphone' | 'allow_participant_camera' | 'allow_screen_share' | 'meeting_locked' | 'join_before_host'>; label: string; description: string }> = [
  { key: 'allow_chat', label: 'Participant chat', description: 'Participants can send meeting messages.' },
  { key: 'allow_participant_microphone', label: 'Participant microphone', description: 'Participants can publish microphone audio.' },
  { key: 'allow_participant_camera', label: 'Participant camera', description: 'Participants can publish camera video.' },
  { key: 'allow_screen_share', label: 'Screen sharing', description: 'Participants can publish screen shares.' },
  { key: 'meeting_locked', label: 'Meeting lock', description: 'Blocks new participant joins while enabled.' },
  { key: 'join_before_host', label: 'Join before host', description: 'Allows participants to join before the host.' },
]

type HostControlsPanelProps = {
  controls: MeetingControls
  onUpdate: (changes: Partial<MeetingControls>) => Promise<void>
  onBulkAction: (action: ModerationAction) => Promise<void>
  onClose: () => void
}

export function HostControlsPanel({ controls, onUpdate, onBulkAction, onClose }: HostControlsPanelProps) {
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  const update = async (key: keyof MeetingControls) => {
    setPendingKey(key)
    setFeedback('')
    setError('')
    try {
      await onUpdate({ [key]: !controls[key] })
      setFeedback('Updated')
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update host controls')
    } finally {
      setPendingKey(null)
    }
  }

  const bulkAction = async (action: ModerationAction) => {
    setPendingKey(action)
    setFeedback('')
    setError('')
    try {
      await onBulkAction(action)
      setFeedback('Updated')
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : 'Unable to update participants')
    } finally {
      setPendingKey(null)
    }
  }

  return (
    <section className="host-controls-panel" aria-labelledby="host-controls-title">
      <div className="host-controls-heading">
        <div>
          <p className="meeting-kicker">Host administration</p>
          <h2 id="host-controls-title">Host controls</h2>
          <p>Control what participants can do in this meeting.</p>
        </div>
        <button type="button" className="meeting-panel-close" aria-label="Close host controls" onClick={onClose}>×</button>
      </div>
      <div className="host-control-list">
        {supportedControls.map(({ key, label, description }) => (
          <div className="host-control-row" key={key}>
            <div><strong>{label}</strong><span>{description}</span></div>
            <button
              type="button"
              className={controls[key] ? 'host-control-switch host-control-switch-on' : 'host-control-switch'}
              aria-pressed={controls[key]}
              aria-label={`${label}: ${controls[key] ? 'on' : 'off'}`}
              disabled={pendingKey === key}
              onClick={() => void update(key)}
            >
              {pendingKey === key ? 'Updating...' : controls[key] ? 'On' : 'Off'}
            </button>
          </div>
        ))}
      </div>
      <div className="host-bulk-actions">
        <strong>Participant management</strong>
        <button type="button" disabled={pendingKey !== null} onClick={() => void bulkAction('MUTE')}>{pendingKey === 'MUTE' ? 'Muting...' : 'Mute all participants'}</button>
        <button type="button" disabled={pendingKey !== null} onClick={() => void bulkAction('DISABLE_CAMERA')}>{pendingKey === 'DISABLE_CAMERA' ? 'Disabling...' : 'Disable all cameras'}</button>
      </div>
      <div className="host-control-unsupported" aria-label="Unsupported host controls">
        <strong>Not available in the current realtime model</strong>
        <span>Reactions, raise hand, and waiting-room admission require participant event and admission flows that are not implemented by the current backend.</span>
      </div>
      {feedback && <p className="meeting-success" role="status">{feedback}</p>}
      {error && <p className="meeting-error" role="alert">{error}</p>}
    </section>
  )
}
