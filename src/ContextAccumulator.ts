interface SessionHistoryItem {
  timestamp: number;
  intent: string;
  prompt: string;
}

interface SessionData {
  history: SessionHistoryItem[];
}

export class ContextAccumulator {
  sessions: Record<string, SessionData>;

  constructor() {
    this.sessions = {};
  }

  accumulate(sessionId: string, agentIntent: string, userPrompt: string) {
    if (!this.sessions[sessionId]) {
      this.sessions[sessionId] = { history: [] };
    }
    
    const context = {
      timestamp: Date.now(),
      intent: agentIntent,
      prompt: userPrompt
    };
    
    this.sessions[sessionId].history.push(context);
    
    return {
      sessionId,
      recentHistory: this.sessions[sessionId].history.slice(-5)
    };
  }
}

export const contextAccumulator = new ContextAccumulator();
