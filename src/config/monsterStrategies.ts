export type StrategyWeights = {
  coverBase: number
  coveredPower: number
  immediatePowerGain: number
  weakenTargetPower: number
  center: number
  resultingPower: number
}

export const svarbhanuBeginnerStrategy: StrategyWeights = {
  coverBase: 80,
  coveredPower: 8,
  immediatePowerGain: 18,
  weakenTargetPower: 5,
  center: 12,
  resultingPower: 3,
}
