import * as cedar from "npm:@cedar-policy/cedar-wasm";

const authReq = {
  principal: { type: `test-unit::python-cli-tester::User`, id: "user123" },
  action: { type: `test-unit::python-cli-tester::Action`, id: "web_search" },
  resource: { type: `test-unit::python-cli-tester::System`, id: "Backend" },
  context: {},
  policies: {
    staticPolicies: {
      "r1": 'permit ( principal == test-unit::python-cli-tester::User::"user123", action == test-unit::python-cli-tester::Action::"web_search", resource == test-unit::python-cli-tester::System::"Backend" );'
    }
  },
  entities: []
};

try {
  const result = cedar.isAuthorized(authReq);
  console.log(result);
} catch (e) {
  console.log("Exception:", e);
}
