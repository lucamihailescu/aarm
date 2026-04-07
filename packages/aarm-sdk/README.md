# `@aarm-dev/sdk`

The official TypeScript SDK for the AARM (Autonomous Action Runtime Management) Platform. This SDK allows you to embed AARM within any JavaScript/TypeScript-based agent runtime to intermediate and record tool executions using declarative Cedar policies.

## Features

- **Universal Compatible Transport**: Built heavily on the native `fetch` API, enabling this SDK to run in Node.js, Deno, Edge runtimes (Cloudflare workers), and directly in the browser.
- **Framework Hooks**: Built-in support for orchestrating with LangChain node.
- **Secure Telemetry**: Send rich context traces and intent-drift detections directly from the runtime to the AARM platform.

## Installation

```bash
npm install @aarm-dev/sdk
```

## Basic Usage

The SDK is designed to be embedded directly before a tool is executed to intercept runtime intent.

```typescript
import { AarmClient } from '@aarm-dev/sdk';

// Initialize the client connected to your Policy Decision Engine (AARM)
// You can provide global defaults here
const client = new AarmClient({
  baseUrl: 'http://localhost:3000', // URL of AARM Gateway
  businessUnit: 'Engineering',
  application: 'CustomerSupportAgent'
});

async function interceptTool(sessionId: string, userIntent: string, toolName: string, toolInput: any, currentUserId: string) {
  try {
    const result = await client.mediateAction({
      sessionId: sessionId,
      intent: 'Assist customer with billing',
      userPrompt: userIntent,
      actionType: toolName,
      parameters: toolInput,
      principalId: currentUserId // Override the principal dynamically per user
    });

    if (result.status === 'DENY') {
      console.warn('Action blocked by AARM:', result.executionStatus);
      return false; 
    } 

    if (result.status === 'ALLOW') {
      console.log('Action permitted. Receipt Signature:', result.receipt?.signature);
      // Proceed to run the tool logic here
      return true;
    }
  } catch (err) {
    console.error('Mediation error:', err);
    return false;
  }
}
```

## Debugging & Logging

For troubleshooting, you can enable verbose debug logs. The SDK uses `console.log` by default but allows overriding the logger for backend applications (e.g. to write to a file in NodeJS).

```typescript
// Example 1: Console logging
const client = new AarmClient({
  baseUrl: 'http://localhost:3000',
  logLevel: 'debug' // 'none' | 'error' | 'warn' | 'info' | 'debug'
});

// Example 2: Custom logger (Node.js file logging)
import * as fs from 'fs';
const fileClient = new AarmClient({
  baseUrl: 'http://localhost:3000',
  logLevel: 'debug',
  logger: (level, message, ...meta) => {
    const logLine = `[${level}] ${message} ${JSON.stringify(meta)}\n`;
    fs.appendFileSync('aarm.log', logLine);
  }
});
```

## Framework Integrations

### LangChain

We ship a light integration designed to interface directly into the `tools` lifecycle.

```typescript
import { createLangchainHooks, AarmClient } from '@aarm-dev/sdk';
import { DynamicTool } from "@langchain/core/tools";

const client = new AarmClient({ baseUrl: 'http://localhost:3000' });

// Create hooks dynamically per session, ensuring the current user's principalId is tracked
const hooks = createLangchainHooks(client, 'session-1234', 'read database', {
  principalId: 'user-789'
});

// Hook into the tool's execution flow
const dbTool = new DynamicTool({
  name: "read_database",
  description: "Reads user data from SQL",
  func: async (input: string) => {
    // 1. AARM intercepts the request
    await hooks.onToolStart("read_database", input);
    
    // 2. Logic runs ONLY if allowed
    return JSON.stringify({ data: "Sensitive info" });
  }
});
```

## Transport Override

The SDK exposes `RestTransport` by default. Should you wish to use a custom transport mechanism (e.g. gRPC or a custom REST handler wrapper):

```typescript
import { Transport, MediationResult, RawRequest, AarmClient } from '@aarm-dev/sdk';

class CustomGRPCTransport implements Transport {
  async mediate(request: RawRequest): Promise<MediationResult> {
    // Send gRPC protobuf over HTTP/2 here...
    return { status: 'ALLOW', executionStatus: 'OK' }
  }
}

const client = new AarmClient(
  { baseUrl: 'http://grpc-server:9000' },
  new CustomGRPCTransport() // Provide the transport override
);
```
