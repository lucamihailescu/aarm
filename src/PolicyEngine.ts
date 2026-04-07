import * as cedar from "@cedar-policy/cedar-wasm";
import { prisma } from "./db/prisma.ts";
import { redisClient, redisPubSub, connectRedis } from "./db/redis.ts";

export interface EntityUid {
  type: string;
  id: string;
}

export interface Entity {
  uid: EntityUid;
  attrs: Record<string, unknown>;
  parents: EntityUid[];
}

export interface PolicyAction {
  type: string;
}

export interface PolicyContext {
  principalId?: string;
  namespace?: string;
  businessUnit?: string;
  application?: string;
  isApproved?: boolean;
}

interface NamespaceState {
  policies: Record<string, Record<string, string>>;
  entities: Entity[];
}

export class PolicyEngine {
  private namespaces: Map<string, NamespaceState>;

  constructor() {
    this.namespaces = new Map();
  }

  async init() {
    await connectRedis();

    const bgNamespaces = await prisma.application.findMany({
      include: {
        policies: true,
        entities: true
      }
    });

    if (bgNamespaces.length === 0) {
      await this.seedDefaultGlobal();
      await this.loadAllFromDB();
    } else {
      await this.loadAllFromDB();
    }

    if (redisPubSub.isOpen) {
       await redisPubSub.subscribe("policy_updates", async (message) => {
          try {
             const { namespace } = JSON.parse(message);
             if (namespace) {
                await this.loadNamespaceFromDB(namespace);
             }
          } catch(e) { /* ignore invalid JSON */ }
       });
    }
  }

  private async loadAllFromDB() {
    const namespaces = await prisma.application.findMany({
      include: {
        policies: true,
        entities: true
      }
    });
    for (const ns of namespaces) {
       this.namespaces.set(ns.id, this.mapDBToState(ns));
    }
  }

  private async loadNamespaceFromDB(namespaceId: string) {
     const ns = await prisma.application.findUnique({
        where: { id: namespaceId },
        include: {
          policies: true,
          entities: true
        }
     });
     if (ns) {
        this.namespaces.set(ns.id, this.mapDBToState(ns));
     }
  }

  private mapDBToState(dbNs: { policies: { name: string, content: string }[], entities: { uidType: string, uidId: string, attrs: string, parents: string }[] }): NamespaceState {
     const policiesObj: Record<string, string> = {};
     for (const p of dbNs.policies) {
        policiesObj[p.name] = p.content;
     }

     const entities: Entity[] = dbNs.entities.map((e: { uidType: string, uidId: string, attrs: string, parents: string }) => ({
        uid: { type: e.uidType, id: e.uidId },
        attrs: JSON.parse(e.attrs),
        parents: JSON.parse(e.parents)
     }));

     return {
        policies: { staticPolicies: policiesObj },
        entities
     };
  }

  private async seedDefaultGlobal() {
    const namespace = "Default::Global";
    await prisma.namespace.create({
      data: { name: "Default" }
    });
    await prisma.application.create({
      data: { id: namespace, name: "Global", namespaceName: "Default" }
    });

    const staticPolicies = [
      { name: "rule1", content: `permit(principal, action == Default::Global::Action::"ReadDatabase", resource);` },
      { name: "rule2", content: `forbid(principal, action == Default::Global::Action::"DropTable", resource);` },
      { name: "rule3", content: `permit(principal, action == Default::Global::Action::"SendEmail", resource) when { context.isApproved == true };` },
      { name: "rule4", content: `permit(principal, action == Default::Global::Action::"ExecuteCommand", resource) when { context.isApproved == true };` }
    ];

    for (const p of staticPolicies) {
      await prisma.policy.create({
         data: { applicationId: namespace, name: p.name, content: p.content }
      });
    }

    const entities = [
      { 
        applicationId: namespace,
        uidType: "Default::Global::User", uidId: "Agent1",
        attrs: JSON.stringify({ riskScore: 10, department: "IT" }), 
        parents: JSON.stringify([])
      },
      { 
        applicationId: namespace,
        uidType: "Default::Global::User", uidId: "Agent2", 
        attrs: JSON.stringify({ riskScore: 90, department: "Marketing" }), 
        parents: JSON.stringify([]) 
      }
    ];

    for (const e of entities) {
      await prisma.entity.create({ data: e });
    }
  }

  getNamespaces(): string[] {
    return Array.from(this.namespaces.keys());
  }

  private async ensureNamespaceAsync(namespace: string) {
    const exists = await prisma.application.findUnique({ where: { id: namespace } });
    if (!exists) {
      const parts = namespace.split('::');
      const rootNs = parts[0];
      const appNs = parts.length > 1 ? parts.slice(1).join('::') : "Default";

      const nsExists = await prisma.namespace.findUnique({ where: { name: rootNs } });
      if (!nsExists) {
         await prisma.namespace.create({ data: { name: rootNs } });
      }

      await prisma.application.create({ 
         data: { id: namespace, name: appNs, namespaceName: rootNs } 
      });
      this.namespaces.set(namespace, { policies: { staticPolicies: {} }, entities: [] });
    }
  }

  ensureNamespace(namespace: string) {
    if (!this.namespaces.has(namespace)) {
      this.namespaces.set(namespace, {
        policies: { staticPolicies: {} },
        entities: []
      });
      this.ensureNamespaceAsync(namespace).catch(e => console.error("ensureNamespaceAsync err: ", e));
    }
  }

  async registerApplication(namespace: string, metadata: { ownerTeam?: string, supportEmail?: string, environment?: string } = {}) {
    this.namespaces.set(namespace, { policies: { staticPolicies: {} }, entities: [] });
    // First ensure the base application namespace is handled
    await this.ensureNamespaceAsync(namespace);
    
    // Then upsert metadata attributes via update
    await prisma.application.update({
      where: { id: namespace },
      data: {
        ownerTeam: metadata.ownerTeam || null,
        supportEmail: metadata.supportEmail || null,
        environment: metadata.environment || null,
      }
    });
  }

  async getApplicationDetails(namespace: string) {
    const app = await prisma.application.findUnique({
      where: { id: namespace }
    });
    return app;
  }

  getPolicies(namespace: string) {
    this.ensureNamespace(namespace);
    return this.namespaces.get(namespace)?.policies;
  }

  async setPolicies(namespace: string, newPolicies: Record<string, Record<string, string>>) {
    await this.ensureNamespaceAsync(namespace);
    
    await prisma.policy.deleteMany({ where: { applicationId: namespace } });

    const staticPolicies = newPolicies.staticPolicies || {};
    for (const [name, content] of Object.entries(staticPolicies)) {
       await prisma.policy.create({
          data: { applicationId: namespace, name, content }
       });
    }

    await this.notifyUpdates(namespace);
  }

  getEntities(namespace: string) {
    this.ensureNamespace(namespace);
    return this.namespaces.get(namespace)?.entities;
  }

  async setEntities(namespace: string, newEntities: Entity[]) {
    await this.ensureNamespaceAsync(namespace);
    
    await prisma.entity.deleteMany({ where: { applicationId: namespace } });

    for (const e of newEntities) {
       await prisma.entity.create({
          data: {
             applicationId: namespace,
             uidType: e.uid.type,
             uidId: e.uid.id,
             attrs: JSON.stringify(e.attrs),
             parents: JSON.stringify(e.parents)
          }
       });
    }

    await this.notifyUpdates(namespace);
  }

  private async notifyUpdates(namespace: string) {
     if (redisClient.isOpen) {
        await redisClient.publish("policy_updates", JSON.stringify({ namespace }));
        await this.loadNamespaceFromDB(namespace);
     }
  }

  evaluate(action: PolicyAction, context: PolicyContext) {
    const actionType = action.type;
    const principalId = context.principalId || "Agent1";
    let namespace = context.namespace || "Default::Global";
    
    if (context.businessUnit && context.application) {
       namespace = `${context.businessUnit}::${context.application}`;
    }

    this.ensureNamespace(namespace);
    const nsState = this.namespaces.get(namespace)!;

    let isApproved = false;
    if (context.isApproved === true) {
      isApproved = true;
    }

    try {
      const mergedEntities = [
        ...nsState.entities,
        { uid: { type: `${namespace}::Action`, id: actionType }, attrs: {}, parents: [] },
        { uid: { type: `${namespace}::System`, id: "Backend" }, attrs: {}, parents: [] }
      ];

      const uniqueEntitiesMap = new Map();
      for (const e of mergedEntities) {
        uniqueEntitiesMap.set(`${e.uid.type}::"${e.uid.id}"`, e);
      }
      const uniqueEntities = Array.from(uniqueEntitiesMap.values());

      const authReq = {
        principal: { type: `${namespace}::User`, id: principalId },
        action: { type: `${namespace}::Action`, id: actionType },
        resource: { type: `${namespace}::System`, id: "Backend" },
        context: { isApproved: isApproved },
        policies: nsState.policies,
        entities: uniqueEntities
      };

      const result = cedar.isAuthorized(authReq);

      if (result.type === "success" && result.response.decision === "allow") {
        return {
          decision: 'ALLOW',
          reason: `Cedar [${namespace}] ALLOWED action ${actionType}`,
          evaluatedAt: Date.now()
        };
      } else {
        const hypotheticalReq = { ...authReq, context: { ...authReq.context, isApproved: true } };
        const hypotheticalResult = cedar.isAuthorized(hypotheticalReq);
        
        if (hypotheticalResult.type === "success" && hypotheticalResult.response.decision === "allow") {
           return {
             decision: 'STEP_UP',
             reason: `Cedar [${namespace}] requires human approval. Triggering STEP_UP for ${actionType}`,
             evaluatedAt: Date.now()
           };
        } else {
           return {
             decision: 'DENY',
             reason: `Cedar [${namespace}] DENIED ${actionType} natively.`,
             evaluatedAt: Date.now()
           };
        }
      }
    } catch (e: unknown) {
      console.error(`Cedar evaluation error [${namespace}]`, e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      return {
        decision: 'DENY',
        reason: `Cedar Evaluation Exception: ${errorMessage}`,
        evaluatedAt: Date.now()
      };
    }
  }
}

export const policyEngine = new PolicyEngine();
