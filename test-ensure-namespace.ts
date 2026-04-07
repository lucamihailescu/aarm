import { policyEngine } from "./src/PolicyEngine.ts";
import { prisma } from "./src/db/prisma.ts";

async function run() {
  console.log("Testing ensureNamespaceAsync...");
  policyEngine.ensureNamespace("Finance::AppX");
  await new Promise(r => setTimeout(r, 2000));
  const app = await prisma.application.findUnique({ where: { id: "Finance::AppX" }});
  console.log("Application retrieved from DB:", app);
  Deno.exit(0);
}
run();
