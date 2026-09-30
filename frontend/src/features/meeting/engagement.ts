import { DEFAULT_ENGAGEMENT_CONFIG, validateEngagementConfig, type EngagementScoringConfig } from './engagementConfig'

export type VisualFeatures = {
  facePresence: number
  faceVisibility: number
  gaze: number
  headPose: number
}

export type EngagementStatus = 'HIGH' | 'MODERATE' | 'LOW' | 'UNAVAILABLE'

export type EngagementEstimate = {
  score: number
  status: EngagementStatus
}

export function scoreEngagement(features: VisualFeatures, temporalConsistency = 1, config: EngagementScoringConfig = DEFAULT_ENGAGEMENT_CONFIG): EngagementEstimate {
  validateEngagementConfig(config)
  const values = [features.gaze, features.headPose, features.facePresence, features.faceVisibility, temporalConsistency]
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1) || features.facePresence <= 0 || features.faceVisibility <= 0) {
    return unavailableEstimate()
  }
  const score = Math.round(Math.max(0, Math.min(100, (
    features.gaze * config.gazeWeight +
    features.headPose * config.headPoseWeight +
    features.facePresence * config.facePresenceWeight +
    features.faceVisibility * config.faceVisibilityWeight +
    temporalConsistency * config.temporalWeight
  ) * 100)))
  const status: EngagementStatus = score >= config.highThreshold ? 'HIGH' : score >= config.moderateThreshold ? 'MODERATE' : 'LOW'
  return { score, status }
}

export function smoothScore(previous: number | null, next: number, alpha = 0.35): number {
  if (previous === null) return next
  return previous + (next - previous) * alpha
}

function regionVariance(data: Uint8ClampedArray, width: number, height: number, left: number, top: number, right: number, bottom: number) {
  let sum = 0
  let sumSquares = 0
  let count = 0
  const startX = Math.max(0, Math.floor(left))
  const startY = Math.max(0, Math.floor(top))
  const endX = Math.min(width, Math.ceil(right))
  const endY = Math.min(height, Math.ceil(bottom))
  for (let y = startY; y < endY; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const offset = (y * width + x) * 4
      const luminance = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114
      sum += luminance
      sumSquares += luminance * luminance
      count += 1
    }
  }
  if (!count) return 0
  const mean = sum / count
  return Math.sqrt(Math.max(0, sumSquares / count - mean * mean))
}

export function featuresFromFrame(data: Uint8ClampedArray, width: number, height: number): VisualFeatures {
  const centerVariance = regionVariance(data, width, height, width * 0.25, height * 0.15, width * 0.75, height * 0.85)
  const boundedVariance = Number.isFinite(centerVariance) ? centerVariance : 0
  const facePresence = Math.max(0, Math.min(1, (boundedVariance - 8) / 42))
  const faceVisibility = Math.max(0, Math.min(1, boundedVariance / 50))
  return { facePresence, faceVisibility, gaze: facePresence, headPose: facePresence }
}

export function unavailableEstimate(): EngagementEstimate {
  return { score: 0, status: 'UNAVAILABLE' }
}

export function temporalConsistency(observations: number[], nextObservation?: number): number {
  const values = [...observations, ...(nextObservation === undefined ? [] : [nextObservation])].filter((value) => Number.isFinite(value) && value >= 0 && value <= 100)
  if (values.length < 2) return 1
  const changes = values.slice(1).map((value, index) => Math.abs(value - values[index]) / 100)
  return Math.max(0, Math.min(1, 1 - changes.reduce((sum, change) => sum + change, 0) / changes.length))
}