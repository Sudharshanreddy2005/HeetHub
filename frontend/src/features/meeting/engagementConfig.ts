export type EngagementScoringConfig = {
  gazeWeight: number
  headPoseWeight: number
  facePresenceWeight: number
  faceVisibilityWeight: number
  temporalWeight: number
  highThreshold: number
  moderateThreshold: number
}

export const DEFAULT_ENGAGEMENT_CONFIG: EngagementScoringConfig = {
  gazeWeight: 0.3,
  headPoseWeight: 0.25,
  facePresenceWeight: 0.2,
  faceVisibilityWeight: 0.15,
  temporalWeight: 0.1,
  highThreshold: 80,
  moderateThreshold: 50,
}

export function validateEngagementConfig(config: EngagementScoringConfig): EngagementScoringConfig {
  const weights = [config.gazeWeight, config.headPoseWeight, config.facePresenceWeight, config.faceVisibilityWeight, config.temporalWeight]
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0 || weight > 1)) {
    throw new Error('Engagement weights must be finite values between 0 and 1')
  }
  if (Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) > 1e-9) {
    throw new Error('Engagement weights must sum to 1')
  }
  if (!Number.isFinite(config.highThreshold) || !Number.isFinite(config.moderateThreshold) || config.highThreshold <= config.moderateThreshold || config.moderateThreshold < 0 || config.highThreshold > 100) {
    throw new Error('Engagement thresholds must be ordered between 0 and 100')
  }
  return config
}