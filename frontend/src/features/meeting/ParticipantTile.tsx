import { useEffect, useRef } from 'react'
import { Track, type Participant, type TrackPublication } from 'livekit-client'
import type { ModerationAction } from './meetingApi'
import { MeetingIcon } from './MeetingIcon'

type ParticipantTileProps = {
  participant: Participant
  renderVersion: number
  className?: string
  isActiveSpeaker?: boolean
  moderationActions?: ModerationAction[]
  onModerate?: (userId: string, action: ModerationAction) => void
  mirrorLocalVideo?: boolean
  speakerDeviceId?: string
}

export function ParticipantTile({ participant, renderVersion, className = '', isActiveSpeaker = false, moderationActions, onModerate, mirrorLocalVideo = false, speakerDeviceId = '' }: ParticipantTileProps) {
  const mediaContainer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const publications = participant
      .getTrackPublications()
      .filter((publication: TrackPublication) => publication.track && !publication.isMuted && (publication.source === Track.Source.Camera || publication.source === Track.Source.ScreenShare) && (publication.isSubscribed || participant.isLocal))
    const attachedTracks = publications.map((publication) => ({ publication, track: publication.track! }))
    const elements = attachedTracks.map(({ publication, track }) => ({ publication, element: track.attach() }))
    elements.forEach(({ publication, element }) => {
      element.classList.add('participant-media')
      element.classList.add(publication.source === Track.Source.ScreenShare ? 'participant-screen' : 'participant-camera')
      if (participant.isLocal && publication.source === Track.Source.Camera && mirrorLocalVideo) element.classList.add('participant-camera-mirrored')
      element.setAttribute('playsinline', 'true')
      const mediaElement = element as HTMLMediaElement & { setSinkId?: (deviceId: string) => Promise<void> }
      if (speakerDeviceId && mediaElement.setSinkId) void mediaElement.setSinkId(speakerDeviceId).catch(() => undefined)
      mediaContainer.current?.appendChild(element)
    })

    return () => {
      attachedTracks.forEach(({ track }) => track.detach())
      elements.forEach(({ element }) => element.remove())
    }
  }, [mirrorLocalVideo, participant, renderVersion, speakerDeviceId])

  const isMuted = !participant.isMicrophoneEnabled

  return (
    <article className={`participant-tile ${className}${isActiveSpeaker ? ' participant-tile-active-speaker' : ''}`.trim()}>
      <div className="participant-media-container" ref={mediaContainer}>
        <div className="participant-placeholder" aria-hidden="true">
          {(participant.name || participant.identity).slice(0, 1).toUpperCase() || '?'}
        </div>
      </div>
      <footer className="participant-label">
        <span className="participant-label-name">{participant.name || participant.identity}</span>
        <span className="participant-label-status">
          <span className="participant-status-icon" aria-label={isMuted ? 'Microphone muted' : 'Microphone active'} title={isMuted ? 'Microphone muted' : 'Microphone active'}>
            <MeetingIcon name={isMuted ? 'micOff' : 'mic'} />
          </span>
          {!participant.isCameraEnabled && <span className="participant-status-icon" aria-label="Camera off" title="Camera off"><MeetingIcon name="cameraOff" /></span>}
          {isActiveSpeaker && <span className="participant-speaking-indicator" aria-label="Active speaker" title="Active speaker" />}
        </span>
      </footer>
      {moderationActions && onModerate && !participant.isLocal && (
        <div className="participant-moderation" aria-label={`Moderate ${participant.name || participant.identity}`}>
          {moderationActions.map((action) => (
            <button key={action} type="button" onClick={() => onModerate(participant.identity, action)}>
              {action.replace('_', ' ').toLowerCase()}
            </button>
          ))}
        </div>
      )}
    </article>
  )
}
