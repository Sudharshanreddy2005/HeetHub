import { useEffect, useRef, useState } from 'react'
import type { LocalVideoTrack } from 'livekit-client'

import { submitEngagementMetric } from './meetingApi'
import { featuresFromFrame, scoreEngagement, smoothScore, temporalConsistency, unavailableEstimate, type EngagementEstimate } from './engagement'

type EngagementPanelProps = { cameraTrack: LocalVideoTrack | null; cameraEnabled: boolean; roomConnected: boolean; meetingId: string; authToken: string; initialConsent?: boolean }

export function EngagementPanel({ cameraTrack, cameraEnabled, roomConnected, meetingId, authToken, initialConsent = false }: EngagementPanelProps) {
  const [consent, setConsent] = useState(initialConsent)
  const [estimate, setEstimate] = useState<EngagementEstimate>(unavailableEstimate)
  const [isProcessing, setProcessing] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previousScore = useRef<number | null>(null)
  const validScores = useRef<number[]>([])
  const lastSubmission = useRef(0)

  useEffect(() => {
    if (!consent || !cameraEnabled || !roomConnected || !cameraTrack) return
    const track = cameraTrack
    const video = videoRef.current
    if (!video) return
    video.muted = true
    video.playsInline = true
    video.autoplay = true
    const attachedVideo = track.attach(video) as HTMLVideoElement
    attachedVideo.muted = true
    attachedVideo.playsInline = true
    attachedVideo.autoplay = true
    void attachedVideo.play().catch(() => undefined)
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return
    let timer = 0
    let cancelled = false
    const minimumReadyState = typeof HTMLMediaElement.HAVE_CURRENT_DATA === 'number' ? HTMLMediaElement.HAVE_CURRENT_DATA : 2
    const processFrame = () => {
      if (cancelled) return
      if (attachedVideo.readyState >= minimumReadyState && attachedVideo.videoWidth > 0 && attachedVideo.videoHeight > 0) {
        canvas.width = 32; canvas.height = 32
        try {
          context.drawImage(attachedVideo, 0, 0, 32, 32)
        } catch (error) {
          if (import.meta.env.DEV) console.debug('[Engagement] frame processing deferred', error instanceof Error ? error.name : 'unknown')
          timer = window.setTimeout(processFrame, 1000)
          return
        }
        const features = featuresFromFrame(context.getImageData(0, 0, 32, 32).data, 32, 32)
        const next = scoreEngagement(features, temporalConsistency(validScores.current))
        if (next.status === 'UNAVAILABLE') {
          previousScore.current = null
          validScores.current = []
          setEstimate(unavailableEstimate())
          setProcessing(false)
        } else {
          const score = smoothScore(previousScore.current, next.score)
          previousScore.current = score
          validScores.current = [...validScores.current.slice(-4), score]
          const nextEstimate = { score: Math.round(score), status: score >= 80 ? 'HIGH' as const : score >= 50 ? 'MODERATE' as const : 'LOW' as const }
          setEstimate(nextEstimate)
          if (Date.now() - lastSubmission.current >= 5000) {
            lastSubmission.current = Date.now()
            void submitEngagementMetric(meetingId, authToken, nextEstimate.score, nextEstimate.status).catch(() => undefined)
          }
          setProcessing(true)
        }
      }
      timer = window.setTimeout(processFrame, 1000)
    }
    attachedVideo.addEventListener('loadedmetadata', processFrame)
    processFrame()
    return () => { cancelled = true; window.clearTimeout(timer); attachedVideo.removeEventListener('loadedmetadata', processFrame); track.detach(video); video.srcObject = null; previousScore.current = null; validScores.current = []; lastSubmission.current = 0; setProcessing(false) }
  }, [authToken, cameraEnabled, cameraTrack, consent, meetingId, roomConnected])

  const disable = () => { setConsent(false); setEstimate(unavailableEstimate()); previousScore.current = null }

  const displayedEstimate = !cameraEnabled || !roomConnected || !cameraTrack ? unavailableEstimate() : estimate
  return <section className="engagement-panel" aria-labelledby="engagement-title">
    <div className="section-heading"><div><p className="eyebrow">Private, local estimate</p><h2 id="engagement-title">Visual engagement estimation</h2></div><span className={`estimate-status estimate-${displayedEstimate.status.toLowerCase()}`}>{displayedEstimate.status}</span></div>
    {!consent ? <><p>This optional local baseline uses camera-frame brightness variation. It does not recognize faces, gaze, or head pose and cannot determine attention. No camera frames are sent to engagement analytics; only score and status metrics are submitted. Camera-off is shown as unavailable.</p><button type="button" onClick={() => setConsent(true)}>Allow local estimation</button></> : <><div className="estimate-reading"><strong>{displayedEstimate.status === 'UNAVAILABLE' ? 'Unavailable' : `${displayedEstimate.score}%`}</strong><span>{isProcessing && displayedEstimate.status !== 'UNAVAILABLE' ? 'Local estimate only. This is not proof of attention.' : 'Waiting for camera frames.'}</span></div><button type="button" className="button-muted" onClick={disable}>Disable estimation</button></>}
    <video ref={videoRef} className="engagement-capture" aria-hidden="true" /><canvas ref={canvasRef} className="engagement-capture" aria-hidden="true" />
  </section>
}