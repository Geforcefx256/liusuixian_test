import type { AgentSessionMessage } from '../sessionStore.js'
import { TokenEstimator } from './TokenEstimator.js'

const ZERO = 0

export class MessageSelector {
  constructor(private readonly estimator: TokenEstimator) {}

  selectWithinBudget(params: {
    messages: AgentSessionMessage[]
    budget: number
  }): { selected: AgentSessionMessage[]; estimatedTokens: number } {
    const { messages, budget } = params
    if (budget <= ZERO) {
      return { selected: [], estimatedTokens: ZERO }
    }

    const reversed = [...messages].reverse()
    const selectedReversed: AgentSessionMessage[] = []
    let total = ZERO

    for (const message of reversed) {
      const messageTokens = this.estimator.countMessage(message)
      if (total + messageTokens > budget) {
        break
      }
      selectedReversed.push(message)
      total += messageTokens
    }

    return {
      selected: selectedReversed.reverse(),
      estimatedTokens: total
    }
  }
}
