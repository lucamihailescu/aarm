import * as cedar from "npm:@cedar-policy/cedar-wasm";

const cedarPolicies = {
  staticPolicies: {
    "rule1": `permit(principal, action == Action::"ReadDatabase", resource);`
  }
};

const authReq = {
  principal: { type: "User", id: "Agent1" },
  action: { type: "Action", id: "ReadDatabase" },
  resource: { type: "System", id: "Backend" },
  context: {},
  policies: cedarPolicies,
  entities: [
    { uid: { type: "User", id: "Agent1" }, attrs: {}, parents: [] },
    { uid: { type: "Action", id: "ReadDatabase" }, attrs: {}, parents: [] },
    { uid: { type: "System", id: "Backend" }, attrs: {}, parents: [] }
  ]
};

try {
  console.log("Evaluating...");
  const result = cedar.isAuthorized(authReq);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Exception:", e);
}
