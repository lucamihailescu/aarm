import { AarmClient } from './index';

const client = new AarmClient({
  baseUrl: 'http://localhost:3000',
  businessUnit: 'Engineering',
  application: 'AgentTest',
  principalId: 'lucam'
});

async function run() {
  try {
    console.log("Mediating an action...");
    const result = await client.mediateAction({
      sessionId: 'test-session-123',
      intent: 'Summarize user data',
      userPrompt: 'Please summarize the latest events.',
      actionType: 'ReadDatabase',
      parameters: { query: 'SELECT * FROM events limit 10' }
    });
    
    console.log('Mediation Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error during mediation:', error);
  }
}

run();
