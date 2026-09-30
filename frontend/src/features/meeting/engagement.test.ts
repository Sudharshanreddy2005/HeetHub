import { describe, expect, it } from 'vitest'

import { featuresFromFrame, scoreEngagement, smoothScore, temporalConsistency, unavailableEstimate } from './engagement'
import { DEFAULT_ENGAGEMENT_CONFIG, validateEngagementConfig } from './engagementConfig'

describe('engagement baseline', () => {
  it('uses the documented weights and status thresholds', () => {
    expect(scoreEngagement({ gaze: 1, headPose: 1, facePresence: 1, faceVisibility: 1 }, 1)).toEqual({ score: 100, status: 'HIGH' })
    expect(scoreEngagement({ gaze: 0.5, headPose: 0.5, facePresence: 0.5, faceVisibility: 0.5 }, 0.5).status).toBe('MODERATE')
  })

  it('smooths readings and returns unavailable separately', () => {
    expect(smoothScore(null, 80)).toBe(80)
    expect(smoothScore(40, 80, 0.5)).toBe(60)
    expect(unavailableEstimate().status).toBe('UNAVAILABLE')
    expect(temporalConsistency([70, 72, 71])).toBeGreaterThan(0.9)
  })

  it('rejects invalid weights and clamps valid scores', () => {
    expect(() => validateEngagementConfig({ ...DEFAULT_ENGAGEMENT_CONFIG, temporalWeight: 0.2 })).toThrow()
    expect(scoreEngagement({ gaze: 1, headPose: 1, facePresence: 1, faceVisibility: 1 }, 1, { ...DEFAULT_ENGAGEMENT_CONFIG, highThreshold: 90, moderateThreshold: 60 })).toEqual({ score: 100, status: 'HIGH' })
    expect(scoreEngagement({ gaze: 0, headPose: 0, facePresence: 0, faceVisibility: 0 }, 1).status).toBe('UNAVAILABLE')
    expect(scoreEngagement({ gaze: Number.NaN, headPose: 1, facePresence: 1, faceVisibility: 1 }, 1).status).toBe('UNAVAILABLE')
  })

  it('extracts bounded local frame features without sending frame data', () => {
    const features = featuresFromFrame(new Uint8ClampedArray(32 * 32 * 4).fill(128), 32, 32)
    expect(Object.values(features).every((value) => value >= 0 && value <= 1)).toBe(true)
  })
})