import { useEffect, useRef, useState } from 'react'
import { ParticipantEvent, Room, RoomEvent, ConnectionState, Track, type Participant, type RemoteTrackPublication, type LocalVideoTrack } from 'livekit-client'
import {
  endMeeting,
  fetchMeetingDetails,
  fetchMessageHistory,
  leaveMeeting,
  moderateParticipant,
  fetchMeetingControls,
  updateMeetingControls as saveMeetingControls,
  requestMeetingAccess,
  sendMessage,
  type ChatMessage,
  type Meeting,
  type ModerationAction,
  type MeetingControls,
} from './meetingApi'
import { ParticipantTile } from './ParticipantTile'
import { ChatPanel } from './ChatPanel'
import { VoiceModerationPanel } from './VoiceModerationPanel'
import { EngagementPanel } from './EngagementPanel'
import { EngagementAlertPanel } from './EngagementAlertPanel'
import { MeetingIcon } from './MeetingIcon'
import { HostControlsPanel } from './HostControlsPanel'
import type { Preferences } from '../../preferences'

type MeetingRoomProps = {
  meetingId: string
  authToken: string
  onLeave?: () => void
  onAuthExpired?: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  preferences: Preferences
}

type MeetingLayout = 'speaker' | 'grid'
type UtilityPanel = 'participants' | 'chat' | 'info' | 'host' | 'host-controls'

function connectionLabel(state: ConnectionState) {
  if (state === ConnectionState.Connecting) return 'Connecting'
  if (state === ConnectionState.Reconnecting) return 'Reconnecting'
  if (state === ConnectionState.Disconnected) return 'Disconnected'
  return 'Connected'
}

function mediaErrorMessage(error: unknown, mediaType: 'camera' | 'microphone' | 'screen') {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      if (mediaType === 'camera') return 'Camera permission was denied.'
      if (mediaType === 'microphone') return 'Microphone permission was denied.'
      return 'Screen sharing was cancelled or denied.'
    }
    if (error.name === 'NotFoundError' || error.name === 'NotReadableError') {
      if (mediaType === 'camera') return 'Camera is unavailable or already in use.'
      if (mediaType === 'microphone') return 'Microphone is unavailable or already in use.'
      return 'Screen sharing is unavailable on this device.'
    }
    if (error.name === 'OverconstrainedError') return mediaType === 'camera' ? 'The camera does not support the requested settings.' : 'The microphone does not support the requested settings.'
    if (error.name === 'AbortError') {
      if (mediaType === 'screen') return 'Screen sharing was cancelled.'
      return mediaType === 'camera' ? 'Camera activation was interrupted.' : 'Microphone activation was interrupted.'
    }
  }
  if (mediaType === 'camera') return 'Camera permission was denied or the device is unavailable.'
  if (mediaType === 'microphone') return 'Microphone permission was denied or the device is unavailable.'
  return 'Screen sharing is unavailable on this device.'
}

export function MeetingRoom({ meetingId, authToken, onLeave, onAuthExpired, theme, preferences }: MeetingRoomProps) {
  const [room] = useState(() => new Room({ adaptiveStream: true, dynacast: true }))
  const [participants, setParticipants] = useState<Participant[]>([])
  const [meetingDetails, setMeetingDetails] = useState<Meeting | null>(null)
  const [renderVersion, setRenderVersion] = useState(0)
  const [connection, setConnection] = useState<ConnectionState>(ConnectionState.Disconnected)
  const [isJoining, setJoining] = useState(true)
  const [error, setError] = useState('')
  const [isMicrophoneEnabled, setMicrophoneEnabled] = useState(false)
  const [isCameraEnabled, setCameraEnabled] = useState(false)
  const [isScreenSharing, setScreenSharing] = useState(false)
  const [isPictureInPicture, setPictureInPicture] = useState(false)
  const [pictureInPictureSupported] = useState(() => typeof document !== 'undefined' && document.pictureInPictureEnabled === true)
  const [isHost, setHost] = useState(false)
  const [meetingControls, setMeetingControls] = useState<MeetingControls | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSendingMessage, setSendingMessage] = useState(false)
  const [chatError, setChatError] = useState('')
  const [layout, setLayout] = useState<MeetingLayout>('speaker')
  const [activePanel, setActivePanel] = useState<UtilityPanel | null>(null)
  const [isMoreOpen, setMoreOpen] = useState(false)
  const preferencesRef = useRef(preferences)
  const stageRef = useRef<HTMLElement>(null)
  const filmstripRef = useRef<HTMLDivElement>(null)
  const audioOutputRef = useRef<HTMLDivElement>(null)
  const screenSharer = participants.find((participant) => participant.getTrackPublication(Track.Source.ScreenShare)?.track)
  const activeSpeaker = participants.find((participant) => participant.isSpeaking)
  const featuredParticipant = screenSharer
    ?? activeSpeaker
    ?? participants[0]

  const isSharedContentVisible = Boolean(screenSharer?.getTrackPublication(Track.Source.ScreenShare)?.track)

  useEffect(() => {
    preferencesRef.current = preferences
  }, [preferences])

  useEffect(() => {
    const attachedAudio = new Map<string, HTMLAudioElement>()
    const audioKey = (participant: Participant, publication: RemoteTrackPublication) => `${participant.identity}:${publication.trackSid}`
    const applySink = (element: HTMLAudioElement) => {
      const mediaElement = element as HTMLAudioElement & { setSinkId?: (deviceId: string) => Promise<void> }
      const sinkId = preferencesRef.current.speakerDeviceId
      if (sinkId && mediaElement.setSinkId) void mediaElement.setSinkId(sinkId).catch(() => undefined)
    }
    const attachAudio = (track: Track, publication: RemoteTrackPublication, participant: Participant) => {
      if (track.source !== Track.Source.Microphone || participant.isLocal || !audioOutputRef.current) return
      const key = audioKey(participant, publication)
      if (attachedAudio.has(key)) return
      const element = track.attach() as HTMLAudioElement
      element.autoplay = true
      applySink(element)
      audioOutputRef.current.appendChild(element)
      attachedAudio.set(key, element)
    }
    const removeAudio = (track: Track, publication: RemoteTrackPublication, participant: Participant) => {
      const element = attachedAudio.get(audioKey(participant, publication))
      if (!element) return
      track.detach(element)
      element.remove()
      attachedAudio.delete(audioKey(participant, publication))
    }
    const handleSubscribed = (track: Track, publication: RemoteTrackPublication, participant: Participant) => attachAudio(track, publication, participant)
    const handleUnsubscribed = (track: Track, publication: RemoteTrackPublication, participant: Participant) => removeAudio(track, publication, participant)
    room.on(RoomEvent.TrackSubscribed, handleSubscribed)
    room.on(RoomEvent.TrackUnsubscribed, handleUnsubscribed)
    return () => {
      room.off(RoomEvent.TrackSubscribed, handleSubscribed)
      room.off(RoomEvent.TrackUnsubscribed, handleUnsubscribed)
      attachedAudio.forEach((element, key) => {
        const track = room.remoteParticipants.get(key.split(':')[0])?.getTrackPublication(Track.Source.Microphone)?.track
        track?.detach(element)
        element.remove()
      })
      attachedAudio.clear()
    }
  }, [room])

  useEffect(() => {
    const mediaElements = audioOutputRef.current?.querySelectorAll('audio') ?? []
    const sinkId = preferences.speakerDeviceId
    mediaElements.forEach((element) => {
      const mediaElement = element as HTMLAudioElement & { setSinkId?: (deviceId: string) => Promise<void> }
      if (sinkId && mediaElement.setSinkId) void mediaElement.setSinkId(sinkId).catch(() => undefined)
    })
  }, [preferences.speakerDeviceId])

  useEffect(() => {
    const updateParticipants = () => {
      setParticipants([room.localParticipant, ...Array.from(room.remoteParticipants.values())])
      setRenderVersion((version) => version + 1)
    }
    const updateLocalMediaState = () => {
      setMicrophoneEnabled(room.localParticipant.isMicrophoneEnabled)
      setCameraEnabled(room.localParticipant.isCameraEnabled)
      setScreenSharing(room.localParticipant.isScreenShareEnabled)
    }
    const updateRoomState = () => {
      updateParticipants()
      updateLocalMediaState()
    }
    const handleConnection = (state: ConnectionState) => {
      setConnection(state)
      if (state === ConnectionState.Disconnected) {
        setParticipants([])
        setRenderVersion((version) => version + 1)
        setMicrophoneEnabled(false)
        setCameraEnabled(false)
        setScreenSharing(false)
      } else if (state === ConnectionState.Connected) {
        setJoining(false)
        updateRoomState()
      }
    }
    const handleData = (payload: Uint8Array, _participant?: Participant, _kind?: unknown, topic?: string) => {
      if (topic !== 'meeting-chat') return
      try {
        const message = JSON.parse(new TextDecoder().decode(payload)) as ChatMessage
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
      } catch {
        setChatError('Received an unreadable chat message')
      }
    }

    room.on(RoomEvent.ParticipantConnected, updateRoomState)
    room.on(RoomEvent.ParticipantDisconnected, updateRoomState)
    room.on(RoomEvent.TrackUnpublished, updateRoomState)
    room.on(RoomEvent.TrackSubscribed, updateRoomState)
    room.on(RoomEvent.TrackUnsubscribed, updateRoomState)
    room.on(RoomEvent.LocalTrackPublished, updateRoomState)
    room.on(RoomEvent.LocalTrackUnpublished, updateRoomState)
    room.on(RoomEvent.ConnectionStateChanged, handleConnection)
    room.on(ParticipantEvent.TrackMuted, updateRoomState)
    room.on(ParticipantEvent.TrackUnmuted, updateRoomState)
    room.on(RoomEvent.DataReceived, handleData)

    const handleTrackPublished = async (publication: RemoteTrackPublication) => {
      await publication.setSubscribed(true)
      updateRoomState()
    }
    room.on(RoomEvent.TrackPublished, handleTrackPublished)

    const connect = async () => {
      if (!authToken) {
        setJoining(false)
        setError('Sign in before joining a meeting')
        return
      }
      try {
        setConnection(ConnectionState.Connecting)
        const access = await requestMeetingAccess(meetingId, authToken)
        setHost(access.is_host)
        void fetchMeetingDetails(meetingId, authToken).then(setMeetingDetails).catch(() => undefined)
        try {
          setMessages(await fetchMessageHistory(meetingId, authToken))
        } catch {
          setChatError('Unable to load chat history')
        }
        await room.connect(access.livekit_url, access.token)
        const currentPreferences = preferencesRef.current
        if (currentPreferences.microphoneDeviceId) await room.switchActiveDevice('audioinput', currentPreferences.microphoneDeviceId)
        if (currentPreferences.cameraDeviceId) await room.switchActiveDevice('videoinput', currentPreferences.cameraDeviceId)
        await room.localParticipant.setMicrophoneEnabled(!currentPreferences.muteOnEntry)
        await room.localParticipant.setCameraEnabled(currentPreferences.cameraOnEntry)
        updateParticipants()
      } catch (joinError) {
        setJoining(false)
        const message = joinError instanceof Error ? joinError.message : 'Unable to connect to the meeting'
        if (message.includes('expired')) onAuthExpired?.()
        setError(message)
      }
    }
    void connect()

    return () => {
      room.off(RoomEvent.TrackPublished, handleTrackPublished)
      room.off(RoomEvent.ParticipantConnected, updateRoomState)
      room.off(RoomEvent.ParticipantDisconnected, updateRoomState)
      room.off(RoomEvent.TrackUnpublished, updateRoomState)
      room.off(RoomEvent.TrackSubscribed, updateRoomState)
      room.off(RoomEvent.TrackUnsubscribed, updateRoomState)
      room.off(RoomEvent.LocalTrackPublished, updateRoomState)
      room.off(RoomEvent.LocalTrackUnpublished, updateRoomState)
      room.off(RoomEvent.ConnectionStateChanged, handleConnection)
      room.off(ParticipantEvent.TrackMuted, updateRoomState)
      room.off(ParticipantEvent.TrackUnmuted, updateRoomState)
      room.off(RoomEvent.DataReceived, handleData)
      room.disconnect()
      void leaveMeeting(meetingId, authToken)
    }
  }, [authToken, meetingId, onAuthExpired, room])

  useEffect(() => {
    if (connection !== ConnectionState.Connected) return
    let cancelled = false
    const refreshControls = async () => {
      try {
        const next = await fetchMeetingControls(meetingId, authToken)
        if (!cancelled) setMeetingControls(next)
      } catch (controlsError) {
        if (!cancelled && isHost) setError(controlsError instanceof Error ? controlsError.message : 'Unable to load meeting controls')
      }
    }
    void refreshControls()
    const interval = window.setInterval(() => void refreshControls(), 3000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [authToken, connection, isHost, meetingId])

  useEffect(() => {
    if (isHost || !meetingControls) return
    if (!meetingControls.allow_participant_microphone && room.localParticipant.isMicrophoneEnabled) void room.localParticipant.setMicrophoneEnabled(false)
    if (!meetingControls.allow_participant_camera && room.localParticipant.isCameraEnabled) void room.localParticipant.setCameraEnabled(false)
    if (!meetingControls.allow_screen_share && room.localParticipant.isScreenShareEnabled) void room.localParticipant.setScreenShareEnabled(false)
  }, [isHost, meetingControls, room])

  useEffect(() => {
    if (connection !== ConnectionState.Connected) return
    const applyDevice = async (kind: 'audioinput' | 'videoinput', deviceId: string) => {
      if (!deviceId) return
      try { await room.switchActiveDevice(kind, deviceId) } catch { setError(`Unable to select the saved ${kind === 'audioinput' ? 'microphone' : 'camera'} device.`) }
    }
    void applyDevice('audioinput', preferences.microphoneDeviceId)
    void applyDevice('videoinput', preferences.cameraDeviceId)
  }, [connection, preferences.cameraDeviceId, preferences.microphoneDeviceId, room])

  const toggleMicrophone = async () => {
    if (!isHost && meetingControls && !meetingControls.allow_participant_microphone) { setError('Microphone use has been disabled by the host.'); return }
    try {
      await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled)
      setMicrophoneEnabled(room.localParticipant.isMicrophoneEnabled)
    } catch (mediaError) {
      setMicrophoneEnabled(room.localParticipant.isMicrophoneEnabled)
      setError(mediaErrorMessage(mediaError, 'microphone'))
    }
  }

  const toggleCamera = async () => {
    if (!isHost && meetingControls && !meetingControls.allow_participant_camera) { setError('Camera use has been disabled by the host.'); return }
    try {
      await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled)
      setCameraEnabled(room.localParticipant.isCameraEnabled)
    } catch (mediaError) {
      setCameraEnabled(room.localParticipant.isCameraEnabled)
      setError(mediaErrorMessage(mediaError, 'camera'))
    }
  }

  const toggleScreenShare = async () => {
    if (!isHost && meetingControls && !meetingControls.allow_screen_share) { setError('Screen sharing has been disabled by the host.'); return }
    try {
      await room.localParticipant.setScreenShareEnabled(!room.localParticipant.isScreenShareEnabled)
      setScreenSharing(room.localParticipant.isScreenShareEnabled)
    } catch (mediaError) {
      setScreenSharing(room.localParticipant.isScreenShareEnabled)
      setError(mediaErrorMessage(mediaError, 'screen'))
    }
  }

  const togglePictureInPicture = async () => {
    if (!pictureInPictureSupported) {
      setError('Picture in Picture is not supported by this browser.')
      return
    }

    const video = stageRef.current?.querySelector('video')
    if (!video) {
      setError('Turn on a participant video before opening Picture in Picture.')
      return
    }

    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture()
      } else {
        await video.requestPictureInPicture()
      }
    } catch (pictureInPictureError) {
      setError(pictureInPictureError instanceof Error ? pictureInPictureError.message : 'Unable to open Picture in Picture.')
    }
  }

  useEffect(() => {
    const video = stageRef.current?.querySelector('video')
    if (!video) {
      setPictureInPicture(false)
      return
    }

    const handleEnter = () => setPictureInPicture(true)
    const handleLeave = () => setPictureInPicture(false)
    video.addEventListener('enterpictureinpicture', handleEnter)
    video.addEventListener('leavepictureinpicture', handleLeave)
    setPictureInPicture(document.pictureInPictureElement === video)

    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnter)
      video.removeEventListener('leavepictureinpicture', handleLeave)
    }
  }, [featuredParticipant, renderVersion])

  const leave = async () => {
    await leaveMeeting(meetingId, authToken).catch(() => undefined)
    room.disconnect()
    onLeave?.()
  }

  const end = async () => {
    if (!window.confirm('End this meeting for everyone?')) return
    try {
      await endMeeting(meetingId, authToken)
      await leave()
    } catch (endError) {
      setError(endError instanceof Error ? endError.message : 'Unable to end the meeting')
    }
  }

  const submitMessage = async (content: string) => {
    setSendingMessage(true)
    setChatError('')
    try {
      const message = await sendMessage(meetingId, authToken, content)
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
    } catch (sendError) {
      setChatError(sendError instanceof Error ? sendError.message : 'Unable to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const moderate = async (userId: string, action: ModerationAction) => {
    if ((action === 'REMOVE' || action === 'BLOCK') && !window.confirm(`${action === 'BLOCK' ? 'Block' : 'Remove'} this participant from the meeting?`)) return
    try {
      await moderateParticipant(meetingId, authToken, userId, action)
      setError(`Host action applied: ${action.replace('_', ' ').toLowerCase()}.`)
    } catch (moderationError) {
      setError(moderationError instanceof Error ? moderationError.message : 'Unable to apply moderation action')
    }
  }

  const updateMeetingControls = async (changes: Partial<MeetingControls>) => {
    const updated = await saveMeetingControls(meetingId, authToken, changes)
    setMeetingControls(updated)
  }

  const bulkModerate = async (action: ModerationAction) => {
    const targets = participants.filter((participant) => !participant.isLocal)
    await Promise.all(targets.map((participant) => moderateParticipant(meetingId, authToken, participant.identity, action)))
    setError(`${action === 'MUTE' ? 'Muted' : 'Disabled cameras for'} ${targets.length} participant${targets.length === 1 ? '' : 's'}.`)
  }

  const scrollFilmstrip = (direction: -1 | 1) => {
    filmstripRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' })
  }

  const togglePanel = (panel: UtilityPanel) => {
    setActivePanel((current) => current === panel ? null : panel)
    setMoreOpen(false)
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await stageRef.current?.requestFullscreen()
    } catch (fullscreenError) {
      setError(fullscreenError instanceof Error ? fullscreenError.message : 'Unable to change fullscreen mode.')
    }
  }

  return (
    <main className="meeting-workspace" data-theme={theme}>
      <div className="meeting-main">
        <header className="meeting-topbar">
          <div className="meeting-title-center"><h1>{meetingDetails?.title ?? 'Meeting room'}</h1></div>
          <div className="meeting-topbar-actions">
            <button type="button" className="meeting-header-action" onClick={() => setLayout((current) => current === 'speaker' ? 'grid' : 'speaker')}>
              <MeetingIcon name="layout" />
              <span>{layout === 'speaker' ? 'Speaker' : 'Grid'}</span>
            </button>
            <button type="button" className="meeting-header-action" onClick={() => togglePanel('info')} aria-expanded={activePanel === 'info'}>
              <MeetingIcon name="info" />
              <span>Meeting info</span>
            </button>
            <button type="button" className="meeting-header-action" onClick={() => setMoreOpen((open) => !open)} aria-expanded={isMoreOpen}>
              <MeetingIcon name="more" />
              <span>More</span>
            </button>
            {isMoreOpen && <div className="meeting-more-menu" role="menu" aria-label="More meeting actions">
              <button type="button" role="menuitem" onClick={() => togglePanel('participants')}><MeetingIcon name="participants" />Participants</button>
              <button type="button" role="menuitem" onClick={() => togglePanel('chat')}><MeetingIcon name="chat" />Chat</button>
              <button type="button" role="menuitem" onClick={() => togglePanel('info')}><MeetingIcon name="info" />Meeting info</button>
              {isHost && <button type="button" role="menuitem" onClick={() => togglePanel('host-controls')}><MeetingIcon name="layout" />Host controls</button>}
              {isHost && <button type="button" role="menuitem" onClick={() => togglePanel('host')}><MeetingIcon name="layout" />Host monitoring</button>}
            </div>}
            <span className="connection-state" role="status"><span className="meeting-live-dot" aria-hidden="true" />{isJoining ? 'Joining' : connectionLabel(connection)}</span>
          </div>
        </header>
        {error && <p className="meeting-error" role="alert">{error}</p>}
        <div className="meeting-audio-output" ref={audioOutputRef} aria-hidden="true" />
        <div className="meeting-content-grid">
          <section className="meeting-stage-column" aria-label="Meeting stage">
            <div className="participant-strip" aria-label="Participant thumbnails">
              <button type="button" className="filmstrip-nav filmstrip-nav-outside" aria-label="Scroll participants left" onClick={() => scrollFilmstrip(-1)}><MeetingIcon name="chevronLeft" /></button>
              {participants.map((participant) => <ParticipantTile key={participant.identity} participant={participant} renderVersion={renderVersion} className="participant-tile-thumbnail" isActiveSpeaker={participant === activeSpeaker} mirrorLocalVideo={preferences.mirrorVideo} speakerDeviceId={preferences.speakerDeviceId} />)}
              {!participants.length && <p className="empty-room">{connectionLabel(connection)} to the meeting...</p>}
              <button type="button" className="filmstrip-nav filmstrip-nav-outside" aria-label="Scroll participants right" onClick={() => scrollFilmstrip(1)}><MeetingIcon name="chevronRight" /></button>
            </div>
            <section className={`active-speaker-stage meeting-layout-${layout}`} aria-label="Active speaker" ref={stageRef}>
              {featuredParticipant ? <ParticipantTile participant={featuredParticipant} renderVersion={renderVersion} className="participant-tile-featured" isActiveSpeaker={!isSharedContentVisible && featuredParticipant === activeSpeaker} moderationActions={isHost ? ['WARN', 'MUTE', 'UNMUTE', 'DISABLE_CHAT', 'ENABLE_CHAT', 'DISABLE_CAMERA', 'ENABLE_CAMERA', 'DISABLE_SCREEN_SHARE', 'ENABLE_SCREEN_SHARE', 'REMOVE', 'BLOCK'] : undefined} onModerate={(userId, action) => void moderate(userId, action)} mirrorLocalVideo={preferences.mirrorVideo} speakerDeviceId={preferences.speakerDeviceId} /> : <p className="empty-room">{connectionLabel(connection)} to the meeting...</p>}
              {isSharedContentVisible && <div className="shared-content-label">Viewing shared content</div>}
              <button type="button" className="meeting-fullscreen-button" title="Toggle fullscreen" aria-label="Toggle fullscreen" onClick={() => void toggleFullscreen()}><MeetingIcon name="fullscreen" /></button>
            </section>
            <nav className="meeting-control-bar" aria-label="Meeting controls">
              <button type="button" aria-pressed={isMicrophoneEnabled} className={isMicrophoneEnabled ? 'room-control room-control-active' : 'room-control'} title={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'} onClick={() => void toggleMicrophone()}><MeetingIcon name={isMicrophoneEnabled ? 'mic' : 'micOff'} /><small>{isMicrophoneEnabled ? 'Mute' : 'Unmute'}</small></button>
              <button type="button" aria-pressed={isCameraEnabled} className={isCameraEnabled ? 'room-control room-control-active' : 'room-control'} title={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'} onClick={() => void toggleCamera()}><MeetingIcon name={isCameraEnabled ? 'camera' : 'cameraOff'} /><small>{isCameraEnabled ? 'Camera off' : 'Camera'}</small></button>
              <button type="button" aria-pressed={isScreenSharing} className={isScreenSharing ? 'room-control room-control-active' : 'room-control'} title={isScreenSharing ? 'Stop screen sharing' : 'Share screen'} onClick={() => void toggleScreenShare()}><MeetingIcon name="screenShare" /><small>{isScreenSharing ? 'Stop share' : 'Share screen'}</small></button>
              <button type="button" className={isPictureInPicture ? 'room-control room-control-active' : 'room-control'} title={pictureInPictureSupported ? 'Picture in Picture' : 'Picture in Picture is not supported by this browser.'} aria-label={isPictureInPicture ? 'Exit Picture in Picture' : 'Picture in Picture'} disabled={!pictureInPictureSupported} onClick={() => void togglePictureInPicture()}><MeetingIcon name="pip" /><small>{isPictureInPicture ? 'Exit PiP' : 'Picture in Picture'}</small></button>
              <button type="button" aria-pressed={activePanel === 'chat'} className={activePanel === 'chat' ? 'room-control room-control-active' : 'room-control'} title="Open meeting chat" onClick={() => togglePanel('chat')}><MeetingIcon name="chat" /><small>Chat</small></button>
              <button type="button" aria-pressed={activePanel === 'participants'} className={activePanel === 'participants' ? 'room-control room-control-active' : 'room-control'} title="Show participants" onClick={() => togglePanel('participants')}><MeetingIcon name="participants" /><small>Participants</small></button>
              {isHost && <button type="button" aria-pressed={activePanel === 'host-controls'} className={activePanel === 'host-controls' ? 'room-control room-control-active' : 'room-control'} title="Host controls" onClick={() => togglePanel('host-controls')}><MeetingIcon name="layout" /><small>Host controls</small></button>}
              {isHost && <button type="button" className="room-control room-control-danger" onClick={() => void end()}><MeetingIcon name="leave" /><small>End meeting</small></button>}
              <button type="button" className="room-control room-control-danger" onClick={() => void leave()}><MeetingIcon name="leave" /><small>Leave</small></button>
            </nav>
            {isHost && <EngagementAlertPanel meetingId={meetingId} authToken={authToken} />}
            <section className="meeting-info-panel"><div><p className="meeting-kicker">Room information</p><h2>Secure meeting session</h2></div><div className="meeting-info-items"><span><strong>{participants.length}</strong> connected</span><span><strong>{isHost ? 'Host' : 'Participant'}</strong> access</span><span><strong>{connectionLabel(connection)}</strong> status</span></div></section>
          </section>
          {activePanel && <aside className="meeting-side-panel meeting-side-panel-open" aria-label="Meeting details">
            <button type="button" className="meeting-panel-close" aria-label="Close meeting panel" onClick={() => togglePanel(activePanel)}><MeetingIcon name="close" /></button>
            {activePanel === 'participants' && <section className="participants-panel">
              <div className="participants-panel-heading"><div><p className="meeting-kicker">In this room</p><h2>Participants</h2></div><span className="participant-count">{participants.length}</span></div>
              {participants.length ? <div className="participant-list">{participants.map((participant) => <div className="participant-list-row" key={participant.identity}><span className="participant-avatar">{(participant.name || participant.identity).slice(0, 1).toUpperCase()}</span><span className="participant-list-name"><strong>{participant.name || participant.identity}</strong><small>{participant.isLocal ? 'You' : 'Participant'}</small></span><span className="participant-list-status"><span className={participant.isMicrophoneEnabled ? 'participant-state participant-state-live' : 'participant-state'}>{participant.isMicrophoneEnabled ? 'Live' : 'Muted'}</span><span className="participant-state">{participant.isCameraEnabled ? 'Camera on' : 'Camera off'}</span></span>{isHost && !participant.isLocal && <div className="participant-list-actions"><button type="button" title="Mute participant" onClick={() => void moderate(participant.identity, 'MUTE')}>Mute</button><button type="button" title="Disable participant camera" onClick={() => void moderate(participant.identity, 'DISABLE_CAMERA')}>Camera off</button><button type="button" title="Restrict participant chat" onClick={() => void moderate(participant.identity, 'DISABLE_CHAT')}>Chat off</button><button type="button" title="Restrict participant screen sharing" onClick={() => void moderate(participant.identity, 'DISABLE_SCREEN_SHARE')}>Share off</button><button type="button" title="Remove participant" onClick={() => void moderate(participant.identity, 'REMOVE')}>Remove</button></div>}</div>)}</div> : <p className="panel-empty">{connectionLabel(connection)} participants...</p>}
            </section>}
            {activePanel === 'chat' && <section className="panel-chat-section"><ChatPanel messages={messages} isOpen isSending={isSendingMessage} error={chatError} embedded onToggle={() => togglePanel('chat')} onSend={submitMessage} disabled={!isHost && meetingControls !== null && !meetingControls.allow_chat} /></section>}
            {activePanel === 'info' && <section className="meeting-info-drawer"><p className="meeting-kicker">Room details</p><h2>Meeting info</h2><dl><div><dt>Title</dt><dd>{meetingDetails?.title ?? 'Meeting room'}</dd></div><div><dt>Meeting ID</dt><dd>{meetingId}</dd></div><div><dt>Host</dt><dd>{meetingDetails?.host_username ?? (isHost ? 'You' : 'Host')}</dd></div><div><dt>Participants</dt><dd>{participants.length}</dd></div><div><dt>Connection</dt><dd>{connectionLabel(connection)}</dd></div></dl></section>}
            {activePanel === 'host' && isHost && <section className="host-monitoring-panel" aria-label="Host monitoring"><EngagementAlertPanel meetingId={meetingId} authToken={authToken} /><EngagementPanel key={`engagement-${preferences.visualEngagementConsent}`} cameraTrack={(room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined) ?? null} cameraEnabled={isCameraEnabled} roomConnected={connection === ConnectionState.Connected} meetingId={meetingId} authToken={authToken} initialConsent={preferences.visualEngagementConsent} /><VoiceModerationPanel key={`voice-${preferences.voiceModerationConsent}`} meetingId={meetingId} authToken={authToken} initialConsent={preferences.voiceModerationConsent} /></section>}
            {activePanel === 'host-controls' && isHost && meetingControls && <HostControlsPanel controls={meetingControls} onUpdate={updateMeetingControls} onBulkAction={bulkModerate} onClose={() => togglePanel('host-controls')} />}
            {activePanel !== 'participants' && <div className="meeting-panel-quick-actions"><button type="button" onClick={() => togglePanel('participants')}>Participants</button><button type="button" onClick={() => togglePanel('chat')}>Chat</button>{isHost && <button type="button" onClick={() => togglePanel('host')}>Host tools</button>}</div>}
          </aside>}
        </div>
      </div>
    </main>
  )
}
