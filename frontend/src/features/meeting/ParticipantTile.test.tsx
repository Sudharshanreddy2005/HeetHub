import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Track, type Participant } from 'livekit-client'

import { ParticipantTile } from './ParticipantTile'

function publication(source: Track.Source, subscribed = true, muted = false) {
  const video = document.createElement('video')
  return {
    source,
    track: { attach: vi.fn(() => video), detach: vi.fn() },
    isSubscribed: subscribed,
    isMuted: muted,
  }
}

describe('ParticipantTile', () => {
  it('attaches subscribed remote camera and screen tracks but never audio tracks', () => {
    const camera = publication(Track.Source.Camera)
    const screen = publication(Track.Source.ScreenShare)
    const audio = publication(Track.Source.Microphone)
    const unsubscribedCamera = publication(Track.Source.Camera, false)
    const mutedCamera = publication(Track.Source.Camera, true, true)
    const participant = {
      name: 'participant_test',
      identity: 'participant-id',
      isLocal: false,
      isMicrophoneEnabled: false,
      getTrackPublications: () => [camera, screen, audio, unsubscribedCamera, mutedCamera],
    } as unknown as Participant

    const { unmount } = render(<ParticipantTile participant={participant} renderVersion={1} />)

    expect(camera.track.attach).toHaveBeenCalledOnce()
    expect(screen.track.attach).toHaveBeenCalledOnce()
    expect(audio.track.attach).not.toHaveBeenCalled()
    expect(unsubscribedCamera.track.attach).not.toHaveBeenCalled()
    expect(mutedCamera.track.attach).not.toHaveBeenCalled()
    expect(document.querySelector('.participant-camera')).toBeInTheDocument()
    expect(document.querySelector('.participant-screen')).toBeInTheDocument()

    unmount()
    expect(camera.track.detach).toHaveBeenCalledOnce()
    expect(screen.track.detach).toHaveBeenCalledOnce()
  })
})