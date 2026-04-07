import { serveDir } from "@std/http/file-server";
import { aml } from './src/ActionMediationLayer.ts';
import { approvalService } from './src/ApprovalService.ts';
import { telemetryExporter } from './src/TelemetryExporter.ts';
import { policyEngine } from './src/PolicyEngine.ts';

const PORT = 3000;

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  // API Endpoints
  if (req.method === 'POST' && url.pathname === '/api/mediate') {
    try {
      const body = await req.json();
      const result = await aml.mediate(body);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/approvals') {
    return new Response(JSON.stringify(approvalService.getPendingApprovals()), {
      headers: { "Content-Type": "application/json" }
    });
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/approvals/')) {
    const id = url.pathname.split('/').pop();
    if (id) {
      try {
        const { approved, reviewer } = await req.json();
        approvalService.resolveApproval(id, approved, reviewer || 'Admin');
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 404 });
      }
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/telemetry') {
    return new Response(JSON.stringify(telemetryExporter.getRecentEvents()), {
      headers: { "Content-Type": "application/json" }
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/pde/namespaces') {
    return new Response(JSON.stringify(policyEngine.getNamespaces()), { headers: { "Content-Type": "application/json" } });
  }

  if (req.method === 'GET' && url.pathname === '/api/pde/policies') {
    const namespace = url.searchParams.get("namespace") || "Default::Global";
    return new Response(JSON.stringify(policyEngine.getPolicies(namespace)), { headers: { "Content-Type": "application/json" } });
  }

  if (req.method === 'POST' && url.pathname === '/api/pde/policies') {
    try {
      const namespace = url.searchParams.get("namespace") || "Default::Global";
      const newPolicies = await req.json();
      await policyEngine.setPolicies(namespace, newPolicies);
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    } catch(e: any) { 
        return new Response(JSON.stringify({ error: e.message }), { status: 400 }); 
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/pde/entities') {
    const namespace = url.searchParams.get("namespace") || "Default::Global";
    return new Response(JSON.stringify(policyEngine.getEntities(namespace)), { headers: { "Content-Type": "application/json" } });
  }

  if (req.method === 'POST' && url.pathname === '/api/pde/entities') {
    try {
      const namespace = url.searchParams.get("namespace") || "Default::Global";
      const newEntities = await req.json();
      await policyEngine.setEntities(namespace, newEntities);
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    } catch(e: any) { 
        return new Response(JSON.stringify({ error: e.message }), { status: 400 }); 
    }
  }

  // Serve static files from 'public' directory
  return await serveDir(req, {
    fsRoot: "./public",
    quiet: true,
  });
};

await policyEngine.init();
console.log(`Deno AARM Platform running on http://localhost:${PORT}`);
Deno.serve({ port: PORT }, handler);
