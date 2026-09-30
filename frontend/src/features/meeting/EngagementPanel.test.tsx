import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalVideoTrack } from 'livekit-client'

import { EngagementPanel } from './EngagementPanel'
import { featuresFromFrame, scoreEngagement } from './engagement'

const baseProps = { meetingId: 'meeting-1', authToken: 'token', roomConnected: true }

function cameraTrack() {
  return {
    attach: vi.fn((video: HTMLVideoElement) => {
      Object.defineProperty(video, 'play', { value: vi.fn(async () => undefined) })
      Object.defineProperty(video, 'readyState', { value: HTMLMediaElement.HAVE_CURRENT_DATA })
      Object.defineProperty(video, 'videoWidth', { value: 640 })
      Object.defineProperty(video, 'videoHeight', { value: 480 })
      return video
    }),
    detach: vi.fn(),
  } as unknown as LocalVideoTrack
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: Uint8ClampedArray.from({ length: 32 * 32 * 4 }, (_, index) => Math.floor(index / 8) % 2 ? 255 : 0) })),
  } as unknown as CanvasRenderingContext2D)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
})

describe('EngagementPanel', () => {
  it('does not attach or process the camera before explicit consent', () => {
    const track = cameraTrack()
    render(<EngagementPanel {...baseProps} cameraTrack={track} cameraEnabled />)

    expect(track.attach).not.toHaveBeenCalled()
    expect(screen.getByText('UNAVAILABLE')).toBeInTheDocument()
  })

  it('attaches the actual local camera track only after consent', () => {
    const track = cameraTrack()
    render(<EngagementPanel {...baseProps} cameraTrack={track} cameraEnabled />)

    fireEvent.click(screen.getByRole('button', { name: 'Allow local estimation' }))

    expect(track.attach).toHaveBeenCalledOnce()
  })

  it('shows unavailable and does not attach when camera is off or track is missing', () => {
    const track = cameraTrack()
    const { rerender } = render(<EngagementPanel {...baseProps} cameraTrack={null} cameraEnabled />)
    fireEvent.click(screen.getByRole('button', { name: 'Allow local estimation' }))
    expect(screen.getByText('UNAVAILABLE')).toBeInTheDocument()

    rerender(<EngagementPanel {...baseProps} cameraTrack={track} cameraEnabled={false} />)
    expect(screen.getByText('UNAVAILABLE')).toBeInTheDocument()
    expect(track.attach).not.toHaveBeenCalled()
  })

  it('extracts a ready local frame and submits only its score and status', async () => {
    const track = cameraTrack()
    const frame = Uint8ClampedArray.from({ length: 32 * 32 * 4 }, (_, index) => Math.floor(index / 8) % 2 ? 255 : 0)
    expect(scoreEngagement(featuresFromFrame(frame, 32, 32)).status).not.toBe('UNAVAILABLE')
    render(<EngagementPanel {...baseProps} cameraTrack={track} cameraEnabled />)

    fireEvent.click(screen.getByRole('button', { name: 'Allow local estimation' }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/meetings/meeting-1/engagement', expect.objectContaining({
      method: 'POST',
      body: expect.stringMatching(/"score":\d+,"status":"(LOW|MODERATE|HIGH)"/),
    })), { timeout: 1500 })
    expect(screen.getByText(/Waiting for camera frames|Local estimate only/)).toBeInTheDocument()
  })
})