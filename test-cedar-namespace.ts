import * as cedar from "npm:@cedar-policy/cedar-wasm";

const cedarPolicies = {
  staticPolicies: {
    "rule1": `permit(principal, action == Finance::AppX::Action::"ReadDatabase", resource == Finance::AppX::System::"Backend");`
  }
};

const authReq = {
  principal: { type: "Finance::AppX::User", id: "Agent1" },
  action: { type: "Finance::AppX::Action", id: "ReadDatabase" },
  resource: { type: "Finance::AppX::System", id: "Backend" },
  context: {},
  policies: cedarPolicies,
  entities: [
    { uid: { type: "Finance::AppX::User", id: "Agent1" }, attrs: {}, parents: [] },
    { uid: { type: "Finance::AppX::Action", id: "ReadDatabase" }, attrs: {}, parents: [] },
    { uid: { type: "Finance::AppX::System", id: "Backend" }, attrs: {}, parents: [] }
  ]
};

try {
  console.log("Evaluating Namespace...");
  const result = cedar.isAuthorized(authReq);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Exception:", e);
}
