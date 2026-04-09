// --- MSAL Auth & Fetch Override ---
let msalInstance = null;
let activeAccount = null;

async function initAuth() {
  try {
    const configRes = await originalFetch('/api/system/config');
    const config = await configRes.json();
    
    const msalConfig = {
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        redirectUri: window.location.origin
      },
      cache: { cacheLocation: "sessionStorage" }
    };
    
    msalInstance = new msal.PublicClientApplication(msalConfig);
    await msalInstance.initialize();

    // Handle redirect response if coming back from Entra ID
    const redirectResponse = await msalInstance.handleRedirectPromise();
    if (redirectResponse) {
      activeAccount = redirectResponse.account;
      msalInstance.setActiveAccount(activeAccount);
    } else {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        activeAccount = accounts[0];
        msalInstance.setActiveAccount(activeAccount);
      }
    }
    updateProfileUI();
  } catch (error) {
    console.error("Failed to initialize MSAL:", error);
  }
}

async function getToken() {
  if (!msalInstance || !activeAccount) return null;
  
  const tokenRequest = {
    // Relying on idToken to be validated on the backend
    scopes: [`${msalInstance.config.auth.clientId}/.default`],
    account: activeAccount
  };
  
  try {
    const response = await msalInstance.acquireTokenSilent(tokenRequest);
    return response.accessToken || response.idToken;
  } catch (e) {
    if (e instanceof msal.InteractionRequiredAuthError) {
       console.warn("Interaction required for MSAL");
       // fallback could be logic to prompt login, but we'll let user click login
    }
    return null;
  }
}

async function login() {
  if (!msalInstance) return;
  try {
    await msalInstance.loginRedirect({ scopes: [`${msalInstance.config.auth.clientId}/.default`] });
  } catch(error) {
    console.error("Login failed:", error);
  }
}

function logout() {
  if (!msalInstance || !activeAccount) return;
  try {
    msalInstance.logoutRedirect({ account: activeAccount });
  } catch(error) {
    console.error("Logout failed:", error);
  }
}

async function fetchProfilePicture() {
    if (!msalInstance || !activeAccount) return;
    try {
        const tokenResponse = await msalInstance.acquireTokenSilent({
            scopes: ["User.Read"],
            account: activeAccount
        });
        
        const res = await window.fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
            headers: { Authorization: `Bearer ${tokenResponse.accessToken}` }
        });
        
        if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const img = document.getElementById('profile-picture');
            const initials = document.getElementById('profile-initials');
            if (img && initials) {
                img.src = url;
                img.classList.remove('hidden');
                initials.classList.add('hidden');
            }
        }
    } catch (e) {
        console.log("Profile picture fetch skipped or failed.");
    }
}

function updateProfileUI() {
  const profileBtn = document.getElementById('btn-profile');
  const initialsSpan = document.getElementById('profile-initials');
  const nameSpan = document.getElementById('profile-name');
  
  const loginScreen = document.getElementById('login-screen');
  const authApp = document.getElementById('authenticated-app');
  
  if (activeAccount) {
    if (loginScreen) loginScreen.classList.add('hidden');
    if (authApp) authApp.classList.remove('hidden');
    
    if (initialsSpan && nameSpan) {
        const name = activeAccount.name || activeAccount.username || "User";
        const parts = name.split(' ');
        let initials = parts[0].substring(0,1);
        if (parts.length > 1) {
            initials += parts[parts.length-1].substring(0,1);
        } else {
            initials = name.substring(0,2);
        }
        
        initialsSpan.innerText = initials.toUpperCase();
        nameSpan.innerText = name;
        
        fetchProfilePicture();
    }
  } else {
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (authApp) authApp.classList.add('hidden');
    
    if (initialsSpan && nameSpan) {
        initialsSpan.innerText = "?";
        nameSpan.innerText = "Guest";
    }
  }
}

// Intercept window.fetch
const originalFetch = window.fetch;
window.fetch = async function() {
  const resource = arguments[0];
  const config = arguments[1] || {};
  
  if (typeof resource === 'string' && resource.startsWith('/api/') && resource !== '/api/system/config') {
    const token = await getToken();
    
    const headers = new Headers(config.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    
    config.headers = headers;
    
    const response = await originalFetch(resource, config);
    if (response.status === 401) {
       console.warn("API returned 401 Unauthorized");
       updateProfileUI();
       throw new Error("Unauthorized access - UI gracefully failed request");
    }
    return response;
  }
  return originalFetch.apply(this, arguments);
};

// Profile click handler
document.addEventListener('DOMContentLoaded', () => {
    const profileBtn = document.getElementById('btn-profile');
    const profileDropdown = document.getElementById('profile-dropdown');
    
    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('hidden');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
                profileDropdown.classList.add('hidden');
            }
        });
    }
    
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', logout);
    }
    
    const heroBtn = document.getElementById('btn-login-hero');
    if (heroBtn) {
        heroBtn.addEventListener('click', login);
    }
    
    // Bind Telemetry Filter
    const appFilter = document.getElementById('telemetry-app-filter');
    if (appFilter) {
        appFilter.addEventListener('change', fetchTelemetry);
    }
});

// Init phase before other logic runs
initAuth().then(() => {
   handleRouting();
   fetchSystemVersion(); // It will be properly handled
   if (activeAccount) {
       fetchNamespaces();
       fetchPdeState();
       fetchApprovals();
       fetchTelemetry();
       startPolling();
   }
});

// --- DOM Elements ---

// Navigation & Routing
// deno-lint-ignore-file no-window-prefix
const navLinks = document.querySelectorAll('.nav-link');
const views = document.querySelectorAll('.view');
const pageTitle = document.getElementById('page-title');

// Simulator
const simBuInput = document.getElementById('sim-bu');
const simAppInput = document.getElementById('sim-app');
const simActionSelect = document.getElementById('sim-action');
const simPrincipalInput = document.getElementById('sim-principal');
const btnSimulate = document.getElementById('btn-simulate');
const simResult = document.getElementById('sim-result');

// Approvals & Telemetry (Main Views)
const approvalsList = document.getElementById('approvals-list');
const navApprovalBadge = document.getElementById('nav-approval-badge');
const telemetryBody = document.getElementById('telemetry-body');

// Dashboard KPIs
const kpiIntercepts = document.getElementById('kpi-intercepts');
const kpiApprovals = document.getElementById('kpi-approvals');
const kpiNamespaces = document.getElementById('kpi-namespaces');
const dashTelemetryBody = document.getElementById('dash-telemetry-body');

// Policy Editor (PAP)
const pdeNamespaceSelect = document.getElementById('pde-namespace');
const policyEditor = document.getElementById('policy-editor');
const entitiesEditor = document.getElementById('entities-editor');
const btnSavePolicies = document.getElementById('btn-save-policies');
const btnSaveEntities = document.getElementById('btn-save-entities');
const btnOpenWizard = document.getElementById('btn-open-wizard');

// Policy Wizard Modal
const wizardModal = document.getElementById('wizard-modal');
const wizRuleName = document.getElementById('wiz-rule-name');
const wizEffectPermit = document.querySelector('input[name="wiz-effect"][value="permit"]');
const wizPrincipalType = document.getElementById('wiz-principal-type');
const wizPrincipalVal = document.getElementById('wiz-principal-val');
const wizPrincipalCustom = document.getElementById('wiz-principal-custom');
const wizActionType = document.getElementById('wiz-action-type');
const wizActionVal = document.getElementById('wiz-action-val');
const wizActionCustom = document.getElementById('wiz-action-custom');
const wizResourceType = document.getElementById('wiz-resource-type');
const wizResourceVal = document.getElementById('wiz-resource-val');
const wizResourceCustom = document.getElementById('wiz-resource-custom');
const btnWizCancel = document.getElementById('btn-wiz-cancel');
const btnWizGenerate = document.getElementById('btn-wiz-generate');

// Admin View
const adminNamespaceList = document.getElementById('admin-namespace-list');
const adminNewNsInput = document.getElementById('admin-new-ns');
const btnCreateNs = document.getElementById('btn-create-ns');

const adminMainView = document.getElementById('admin-main-view');
const adminDetailsView = document.getElementById('admin-details-view');
const btnAdminBack = document.getElementById('btn-admin-back');
const adminDetailNsName = document.getElementById('admin-detail-ns-name');
const adminAppList = document.getElementById('admin-app-list');
const adminNewAppInput = document.getElementById('admin-new-app');
const adminNewAppOwner = document.getElementById('admin-new-app-owner');
const adminNewAppEmail = document.getElementById('admin-new-app-email');
const adminNewAppEnv = document.getElementById('admin-new-app-env');
const btnCreateApp = document.getElementById('btn-create-app');

// App Details View
const adminAppDetailView = document.getElementById('admin-app-detail-view');
const btnAdminAppBack = document.getElementById('btn-admin-app-back');
const adminDetailAppName = document.getElementById('admin-detail-app-name');
const adminAppPolicies = document.getElementById('admin-app-policies');
const adminAppEntities = document.getElementById('admin-app-entities');
const btnEditAppPolicies = document.getElementById('btn-edit-app-policies');

// Metadata Application Fields
const adminDetailAppOwner = document.getElementById('admin-detail-app-owner');
const adminDetailAppEmail = document.getElementById('admin-detail-app-email');
const adminDetailAppEnv = document.getElementById('admin-detail-app-env');
const adminDetailAppCreated = document.getElementById('admin-detail-app-created');
const btnSaveAppMetadata = document.getElementById('btn-save-app-metadata');

// Application Logs Fields
const adminAppLogsBody = document.getElementById('admin-app-logs-body');
const appLogsPageIndicator = document.getElementById('app-logs-page-indicator');
const btnAppLogsPrev = document.getElementById('btn-app-logs-prev');
const btnAppLogsNext = document.getElementById('btn-app-logs-next');

// Modal Elements
const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-title');
const confirmDesc = document.getElementById('confirm-desc');
const btnConfirmCancel = document.getElementById('btn-confirm-cancel');
const btnConfirmOk = document.getElementById('btn-confirm-ok');

// State for Admin View
let currentAdminNamespace = null;
let currentAdminApp = null;
let currentNamespacesData = [];
let appLogsCurrentPage = 1;
const APP_LOGS_LIMIT = 20;

// State counters
let totalIntercepts = 0;

// Global Confirm Promise Wrapper
function showConfirm(title, description) {
  return new Promise((resolve) => {
    if (!confirmModal || !confirmTitle || !confirmDesc || !btnConfirmCancel || !btnConfirmOk) {
       console.warn("Modal elements not found, falling back to native confirm");
       resolve(confirm(`${title}\n\n${description}`));
       return;
    }
    
    confirmTitle.innerText = title;
    confirmDesc.innerText = description;
    
    // Show Modal
    confirmModal.classList.remove('hidden');
    confirmModal.classList.add('flex');
    
    // Setup Handlers
    const cleanup = () => {
      confirmModal.classList.add('hidden');
      confirmModal.classList.remove('flex');
      btnConfirmCancel.removeEventListener('click', onCancel);
      btnConfirmOk.removeEventListener('click', onOk);
    };
    
    const onCancel = () => { cleanup(); resolve(false); };
    const onOk = () => { cleanup(); resolve(true); };
    
    btnConfirmCancel.addEventListener('click', onCancel);
    btnConfirmOk.addEventListener('click', onOk);
  });
}

// --- 1. Routing & Navigation ---

function handleRouting() {
  // deno-lint-ignore no-window
  const hash = window.location.hash || '#dashboard';
  const targetId = hash.substring(1); // remove '#'
  
  // Hide all views, remove active from links
  views.forEach(v => v.classList.remove('active'));
  navLinks.forEach(l => l.classList.remove('active'));
  
  // Show target view
  const targetView = document.getElementById(`view-${targetId}`);
  if (targetView) {
    targetView.classList.add('active');
  } else {
    document.getElementById('view-dashboard').classList.add('active'); // fallback
  }
  
  // Activate link
  const activeLink = document.querySelector(`.nav-link[href="${hash}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
    pageTitle.innerText = activeLink.innerText.trim().replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').trim() + (targetId === 'dashboard' ? ' Overview' : '');
  }
}

window.addEventListener('hashchange', handleRouting);
// Run on initial load
// handleRouting(); // deferred to initAuth().then()


// --- 2. Simulator Logic ---

btnSimulate.addEventListener('click', async () => {
  const bu = simBuInput ? simBuInput.value : 'Default';
  const app = simAppInput ? simAppInput.value : 'Global';
  const actionType = simActionSelect.value;
  const principalId = (simPrincipalInput ? simPrincipalInput.value : 'Agent1') || 'Agent1';
  
  btnSimulate.disabled = true;
  btnSimulate.innerText = 'Routing...';
  simResult.innerText = `Sending raw action intent for ${actionType} as ${principalId} in [${bu}::${app}]...\n\n`;

  try {
    const response = await fetch('/api/mediate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sim-session-1',
        intent: 'perform simulation',
        userPrompt: `Please test the ${actionType} tool as ${principalId}`,
        actionType: actionType,
        principalId: principalId,
        businessUnit: bu,
        application: app,
        parameters: { target: 'test-target' }
      })
    });
    const data = await response.json();
    simResult.innerText += JSON.stringify(data, null, 2);
    
    // Refresh globals
    fetchApprovals();
    fetchTelemetry();
    fetchNamespaces(); 
    
    // Update local stat
    totalIntercepts++;
    kpiIntercepts.innerText = totalIntercepts;

  } catch (error) {
    simResult.innerText += `Error: ${error.message}`;
  } finally {
    btnSimulate.disabled = false;
    btnSimulate.innerHTML = '⚡ Execute Simulation';
  }
});


// --- 3. Approvals Logic ---

async function fetchApprovals() {
  try {
    const res = await fetch('/api/approvals');
    const approvals = await res.json();
    
    const count = approvals.length;
    
    // Update UI counters
    kpiApprovals.innerText = count;
    
    if (count > 0) {
      navApprovalBadge.innerText = count;
      navApprovalBadge.style.display = 'inline-block';
    } else {
      navApprovalBadge.style.display = 'none';
    }
    
    if (count === 0) {
      approvalsList.innerHTML = `
        <div class="col-span-full py-12 flex flex-col items-center justify-center text-slate-500 glass-panel border-dashed border-slate-700">
           <span class="text-4xl mb-3 opacity-50">🎉</span>
           <p>No pending approvals</p>
           <p class="text-xs mt-1">All queues are clear.</p>
        </div>
      `;
      return;
    }

    approvalsList.innerHTML = approvals.map(app => `
      <div class="approval-card group hover:-translate-y-1 bg-slate-900 border border-slate-700/50 p-5 rounded-xl flex flex-col gap-3 shadow-lg transition-all relative overflow-hidden">
        <div class="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-bl-full z-0"></div>
        <div class="z-10">
          <div class="flex justify-between items-start mb-1">
             <h4 class="font-semibold text-slate-100 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-amber-500"></span> ${app.action.type}
             </h4>
          </div>
          <p class="text-xs text-slate-400 font-mono">ID: ${app.id.substring(0, 18)}...</p>
        </div>
        
        <div class="text-xs bg-black/30 p-2 rounded border border-slate-800 text-slate-300 mt-1 z-10">
          Principal: <span class="font-medium text-brand-300">${app.context?.principalId || 'Unknown'}</span>
          <br>
          Context: [${app.context?.businessUnit || '-'}::${app.context?.application || '-'}]
        </div>
        
        <div class="flex gap-2 mt-2 z-10">
          <button class="flex-1 btn-success py-1.5" onclick="resolveApproval('${app.id}', true)">Approve</button>
          <button class="flex-1 btn-danger py-1.5" onclick="resolveApproval('${app.id}', false)">Deny</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to fetch approvals:', err);
  }
}

async function resolveApproval(id, approved) {
  try {
    await fetch(`/api/approvals/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved, reviewer: 'Admin via Dashboard' })
    });
    fetchApprovals();
    fetchTelemetry(); 
  } catch (err) {
    console.error('Failed to resolve approval:', err);
  }
}


// State counters
const expandedTelemetryIds = new Set();
window.telemetryLogsCache = {};

window.createPolicyFromLog = async (eventId) => {
  const ev = window.telemetryLogsCache[eventId];
  if (!ev) return;

  // Extract action/tool
  let actionStr = ev.actionType || ev.action?.type || ev.tool || ev.eventType || 'unknown';
  if (actionStr.includes('::')) actionStr = actionStr.split('::').pop(); // Get last part
  
  // Extract principal
  let principalId = ev.context?.principalId || ev.identity?.human || ev.principalId || 'unknown';

  // Extract namespace
  let bu = ev.context?.businessUnit || ev.businessUnit || ev.context?.business_unit;
  let app = ev.context?.application || ev.application || ev.identity?.service;
  let ns = 'Default::Global';
  if (bu && app) ns = `${bu}::${app}`;

  // Switch to Policies view
  window.location.hash = '#policies';
  
  // Make sure namespaces are loaded if we just loaded the page
  if (currentNamespacesData.length === 0) {
      await fetchNamespaces();
  }

  // Select namespace & fetch its state
  if (pdeNamespaceSelect) {
    const opts = Array.from(pdeNamespaceSelect.options).map(o => o.value);
    if (!opts.includes(ns)) {
       // If namespace not in list, it might be auto-created but not cached locally, we manually add it
       const option = document.createElement("option");
       option.value = ns;
       option.text = ns;
       pdeNamespaceSelect.add(option);
    }
    pdeNamespaceSelect.value = ns;
    await fetchPdeState();
  }

  // Open Wizard
  if (wizardModal) {
    wizardModal.classList.remove('hidden');
    wizardModal.classList.add('flex');
    
    // Fill the fields
    if (wizRuleName) wizRuleName.value = `Allow ${actionStr}`;
    if (wizEffectPermit) wizEffectPermit.checked = true;
    
    // Sanitize generated Cedar namespace
    const cleanNs = ns.replace(/[^a-zA-Z0-9_]/g, '_');

    if (wizPrincipalType && wizPrincipalVal) {
       wizPrincipalType.value = 'Custom';
       wizPrincipalVal.disabled = false;
       wizPrincipalVal.value = principalId;
       if (wizPrincipalCustom) {
           wizPrincipalCustom.classList.remove('hidden');
           wizPrincipalCustom.value = `${cleanNs}::User`;
       }
    }
    
    if (wizActionType && wizActionVal) {
       wizActionType.value = 'Custom';
       wizActionVal.disabled = false;
       wizActionVal.value = actionStr;
       if (wizActionCustom) {
           wizActionCustom.classList.remove('hidden');
           wizActionCustom.value = `${cleanNs}::Action`;
       }
    }
    
    if (wizResourceType && wizResourceVal) {
       wizResourceType.value = 'Custom';
       wizResourceVal.disabled = false;
       wizResourceVal.value = 'Backend';
       if (wizResourceCustom) {
           wizResourceCustom.classList.remove('hidden');
           wizResourceCustom.value = `${cleanNs}::System`;
       }
    }
  }
};

window.toggleTelemetry = (id) => {
  if (expandedTelemetryIds.has(id)) {
    expandedTelemetryIds.delete(id);
  } else {
    expandedTelemetryIds.add(id);
  }
  // Toggle immediately in DOM to avoid waiting for next polling tick
  document.querySelectorAll(`.details-row-${id}`).forEach(el => el.classList.toggle('hidden'));
};

async function fetchTelemetry() {
  try {
    const res = await fetch('/api/telemetry');
    let events = await res.json();
    
    // Update global intercept counter if it's far behind
    if (events.length > totalIntercepts) {
       totalIntercepts = events.length;
       kpiIntercepts.innerText = totalIntercepts;
    }
    
    // Handle Application filtering
    const appFilterSelect = document.getElementById('telemetry-app-filter');
    if (appFilterSelect) {
       const apps = new Set(events.map(ev => ev.context?.application || ev.application).filter(Boolean));
       const currentSelection = appFilterSelect.value;
       
       let optionsHtml = `<option value="ALL">All Applications</option>`;
       Array.from(apps).sort().forEach(app => {
           const selected = app === currentSelection ? 'selected' : '';
           optionsHtml += `<option value="${app}" ${selected}>${app}</option>`;
       });
       appFilterSelect.innerHTML = optionsHtml;
       
       if (currentSelection !== 'ALL') {
           events = events.filter(ev => (ev.context?.application || ev.application) === currentSelection);
       }
    }
    
    const reversed = events.reverse();

    // Helper to format rows
    const createRow = (ev) => {
      const time = new Date(ev.timestamp).toLocaleTimeString();
      let badgeClass = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'; // allow
      if (ev.decision?.toLowerCase() === 'deny') {
         badgeClass = 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      } else if (ev.decision?.toLowerCase() === 'step_up') {
         badgeClass = 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      }

      // Build AML normalized object per https://aarm.dev/components/action-mediation
      const typeStr = ev.actionType || ev.action?.type || ev.eventType || 'unknown';
      let parsedTool = typeStr;
      let parsedOp = typeStr;
      if (typeStr.includes('::')) {
          const parts = typeStr.split('::');
          parsedTool = parts[0];
          parsedOp = parts[1];
      }

      const normalized = {
        action_id: ev.eventId || "act_" + Math.random().toString(36).substr(2, 8),
        timestamp: ev.timestamp,
        tool: ev.action?.tool || parsedTool,
        operation: ev.action?.operation || parsedOp,
        parameters: ev.action?.parameters || ev.parameters || ev.action?.intent || {},
        identity: {
          human: ev.context?.principalId || ev.principalId || "unknown",
          service: ev.context?.application || ev.application || "agent-svc",
          session: ev.sessionId || "unknown"
        },
        context: {
          business_unit: ev.context?.businessUnit || ev.businessUnit || "unknown",
          decision: ev.decision || "unknown",
          reason: ev.reason || ev.executionStatus || "none"
        },
        risk_signals: ev.risk_signals || {
          injection_score: 0.0 // Default placeholder if missing
        }
      };

      const jsonStr = JSON.stringify(normalized, null, 2);
      const escapedJson = jsonStr.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      const isExpanded = expandedTelemetryIds.has(ev.eventId);
      const rowHiddenState = isExpanded ? '' : 'hidden';

      const appName = ev.context?.application || ev.application || "Unknown App";

      window.telemetryLogsCache[ev.eventId] = ev;

      let createPolicyBtn = '';
      if (ev.decision?.toUpperCase() === 'DENY') {
         createPolicyBtn = `<div class="mt-3"><button onclick="createPolicyFromLog('${ev.eventId}')" class="btn-success text-[10px] py-1 px-3" onclick="event.stopPropagation();"><span>✨</span> Create Policy from Log</button></div>`;
      }

      return `
        <tr class="hover:bg-slate-800/50 transition-colors group cursor-pointer" onclick="toggleTelemetry('${ev.eventId}')">
          <td class="px-5 py-3 border-b border-slate-700/50 font-mono text-xs text-slate-500 flex items-center gap-2">
            <span class="text-slate-600 text-[10px] transform transition-transform ${isExpanded ? 'rotate-90' : ''}">▶</span> ${time}
          </td>
          <td class="px-5 py-3 border-b border-slate-700/50 text-slate-300 font-medium whitespace-nowrap">${appName}</td>
          <td class="px-5 py-3 border-b border-slate-700/50"><span class="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs border border-slate-700">${ev.eventType}</span></td>
          <td class="px-5 py-3 border-b border-slate-700/50 font-medium text-slate-200">${typeStr}</td>
          <td class="px-5 py-3 border-b border-slate-700/50">
            ${ev.decision ? `<span class="uppercase text-[10px] font-bold px-2 py-0.5 rounded border ${badgeClass}">${ev.decision}</span>` : '-'}
          </td>
          <td class="px-5 py-3 border-b border-slate-700/50 text-xs text-slate-400 truncate max-w-[200px]" title="${ev.executionStatus || ev.reason || '-'}">${ev.executionStatus || ev.reason || '-'}</td>
        </tr>
        <tr class="${rowHiddenState} bg-slate-950/80 details-row-${ev.eventId}">
          <td colspan="6" class="p-4 border-b border-slate-700/50">
            <div class="bg-black/60 p-4 rounded-lg border border-slate-700/50 font-mono text-xs shadow-inner">
              <div class="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
                 <div class="text-[10px] text-brand-400 uppercase tracking-widest font-bold">AML Canonical Action Schema Match</div>
              </div>
              <pre class="text-sky-300 whitespace-pre-wrap">${escapedJson}</pre>
              ${createPolicyBtn}
            </div>
          </td>
        </tr>
      `;
    };

    // Render full table
    telemetryBody.innerHTML = reversed.map(createRow).join('');
    
    // Render dashboard snippet (top 5 only)
    if (reversed.length > 0) {
        dashTelemetryBody.innerHTML = reversed.slice(0, 5).map(createRow).join('');
    }

  } catch (err) {
    console.error('Failed to fetch telemetry:', err);
  }
}


// --- 5. PDE / PAP Editors ---

window.openNamespaceDetails = (rootNs) => {
  currentAdminNamespace = rootNs;
  adminDetailNsName.innerText = rootNs;
  adminMainView.classList.add('hidden');
  adminDetailsView.classList.remove('hidden');
  renderAdminAppList(rootNs);
};

window.renderAdminAppList = (rootNs) => {
  if (!adminAppList) return;
  const apps = currentNamespacesData
      .filter(ns => ns.startsWith(rootNs + '::'))
      .map(ns => ns.substring(rootNs.length + 2));
  
  if (apps.length === 0) {
     adminAppList.innerHTML = `<tr><td class="p-4 text-center text-slate-500">No applications registered</td></tr>`;
  } else {
     adminAppList.innerHTML = apps.map(app => `
       <tr class="hover:bg-slate-800/50 transition-colors cursor-pointer group" onclick="openAppDetails('${app}')">
          <td class="px-5 py-3 flex items-center justify-between">
             <div class="flex items-center gap-2">
                 <span class="w-2 h-2 rounded-full bg-sky-400"></span>
                 <span class="font-mono text-slate-200 group-hover:text-brand-300 transition-colors">${app}</span>
             </div>
             <span class="text-xs text-slate-500 group-hover:text-slate-400">&rarr; View</span>
          </td>
       </tr>
     `).join('');
  }
};

window.openAppDetails = async (appName) => {
  currentAdminApp = appName;
  const fullNamespace = `${currentAdminNamespace}::${appName}`;
  adminDetailAppName.innerText = fullNamespace;
  adminDetailsView.classList.add('hidden');
  adminAppDetailView.classList.remove('hidden');
  
  if (adminAppPolicies) adminAppPolicies.innerText = 'Loading...';
  if (adminAppEntities) adminAppEntities.innerText = 'Loading...';
  if (adminDetailAppOwner) adminDetailAppOwner.value = '';
  if (adminDetailAppEmail) adminDetailAppEmail.value = '';
  if (adminDetailAppEnv) adminDetailAppEnv.value = 'UNKNOWN';
  if (adminDetailAppCreated) adminDetailAppCreated.innerText = '-';
  
  try {
    const [polRes, entRes, metricsRes] = await Promise.all([
      fetch('/api/pde/policies?namespace=' + encodeURIComponent(fullNamespace)),
      fetch('/api/pde/entities?namespace=' + encodeURIComponent(fullNamespace)),
      fetch('/api/pde/applications/details?namespace=' + encodeURIComponent(fullNamespace))
    ]);
    
    const policies = (await polRes.json()) || {};
    const entities = (await entRes.json()) || [];
    const meta = (await metricsRes.json()) || {};
    
    if (adminDetailAppOwner) adminDetailAppOwner.value = meta.ownerTeam || '';
    if (adminDetailAppEmail) adminDetailAppEmail.value = meta.supportEmail || '';
    if (adminDetailAppEnv) adminDetailAppEnv.value = meta.environment || 'UNKNOWN';
    if (adminDetailAppCreated && meta.createdAt) {
      adminDetailAppCreated.innerText = new Date(meta.createdAt).toLocaleString();
    }
    
    let polStr = '';
    if (policies.staticPolicies && Object.keys(policies.staticPolicies).length > 0) {
      for (const [key, val] of Object.entries(policies.staticPolicies)) {
        polStr += `// ${key}\n${val.trim()}\n\n`;
      }
    } else {
      polStr = 'No policies currently defined for this application.';
    }
    
    if (adminAppPolicies) adminAppPolicies.innerText = polStr;
    if (adminAppEntities) adminAppEntities.innerText = JSON.stringify(entities, null, 2);
    
    // Load logs
    appLogsCurrentPage = 1;
    fetchApplicationLogs(appName, appLogsCurrentPage);
    
  } catch(e) {
    console.error("Failed to fetch app details", e);
    if (adminAppPolicies) adminAppPolicies.innerText = 'Error loading policies';
    if (adminAppEntities) adminAppEntities.innerText = 'Error loading context';
  }
};

window.fetchApplicationLogs = async (appName, page) => {
  if (!adminAppLogsBody) return;
  adminAppLogsBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500">Loading logs for ${appName}...</td></tr>`;
  
  try {
    const res = await fetch(`/api/pde/applications/logs?applicationName=${encodeURIComponent(appName)}&page=${page}&limit=${APP_LOGS_LIMIT}`);
    if (!res.ok) throw new Error("Failed to fetch logs");
    
    const data = await res.json();
    const { events, totalCount } = data;
    
    if (events.length === 0) {
      adminAppLogsBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500">No logs found for this application.</td></tr>`;
      btnAppLogsPrev.disabled = true;
      btnAppLogsNext.disabled = true;
      appLogsPageIndicator.innerText = "Page 1 of 1";
      return;
    }
    
    // Update pagination controls
    const totalPages = Math.ceil(totalCount / APP_LOGS_LIMIT) || 1;
    btnAppLogsPrev.disabled = page <= 1;
    btnAppLogsNext.disabled = page >= totalPages;
    appLogsPageIndicator.innerText = `Page ${page} of ${totalPages}`;
    
    // Render rows
    adminAppLogsBody.innerHTML = events.map(ev => {
      const time = new Date(ev.timestamp).toLocaleTimeString();
      let badgeClass = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      if (ev.decision?.toLowerCase() === 'deny') {
        badgeClass = 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      } else if (ev.decision?.toLowerCase() === 'step_up') {
        badgeClass = 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      }
      
      const typeStr = ev.actionType || ev.eventType || 'unknown';
      let parsedTool = typeStr;
      if (typeStr.includes('::')) parsedTool = typeStr.split('::')[0];
      
      const normalizedJson = JSON.stringify(ev, null, 2).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      
      window.telemetryLogsCache[ev.eventId] = ev;

      let createPolicyBtn = '';
      if (ev.decision?.toUpperCase() === 'DENY') {
         createPolicyBtn = `<div class="mt-3"><button onclick="createPolicyFromLog('${ev.eventId}')" class="btn-success text-[10px] py-1 px-3" onclick="event.stopPropagation();"><span>✨</span> Create Policy from Log</button></div>`;
      }
      
      return `
        <tr class="hover:bg-slate-800/50 transition-colors group cursor-pointer" onclick="toggleTelemetry('${ev.eventId}')">
          <td class="px-4 py-3 border-b border-slate-700/50 font-mono text-xs text-slate-500 flex items-center gap-2">
            <span class="text-slate-600 text-[10px]">▶</span> ${time}
          </td>
          <td class="px-4 py-3 border-b border-slate-700/50"><span class="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs border border-slate-700">${ev.eventType}</span></td>
          <td class="px-4 py-3 border-b border-slate-700/50 font-medium text-slate-200">${typeStr}</td>
          <td class="px-4 py-3 border-b border-slate-700/50">
            ${ev.decision ? `<span class="uppercase text-[10px] font-bold px-2 py-0.5 rounded border ${badgeClass}">${ev.decision}</span>` : '-'}
          </td>
          <td class="px-4 py-3 border-b border-slate-700/50 text-xs text-slate-400 truncate max-w-[200px]" title="${ev.executionStatus || ev.reason || '-'}">${ev.executionStatus || ev.reason || '-'}</td>
        </tr>
        <tr class="hidden bg-slate-950/80 details-row-${ev.eventId}">
          <td colspan="5" class="p-3 border-b border-slate-700/50">
            <div class="bg-black/60 p-3 rounded-lg border border-slate-700/50 font-mono text-[10px] shadow-inner">
              <pre class="text-sky-300 whitespace-pre-wrap">${normalizedJson}</pre>
              ${createPolicyBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
  } catch(e) {
    console.error(e);
    adminAppLogsBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-rose-500">Failed to load logs.</td></tr>`;
  }
};

if (btnAppLogsPrev) {
  btnAppLogsPrev.addEventListener('click', () => {
    if (appLogsCurrentPage > 1 && currentAdminApp) {
      appLogsCurrentPage--;
      fetchApplicationLogs(currentAdminApp, appLogsCurrentPage);
    }
  });
}

if (btnAppLogsNext) {
  btnAppLogsNext.addEventListener('click', () => {
    if (currentAdminApp) {
      appLogsCurrentPage++;
      fetchApplicationLogs(currentAdminApp, appLogsCurrentPage);
    }
  });
}

async function fetchNamespaces() {
  try {
    const res = await fetch('/api/pde/namespaces');
    const namespaces = await res.json();
    currentNamespacesData = namespaces;
    
    // Group into roots and applications
    const namespaceTree = {};
    namespaces.forEach(ns => {
      const parts = ns.split('::');
      const root = parts[0];
      const app = parts.length > 1 ? parts.slice(1).join('::') : '';
      if (!namespaceTree[root]) namespaceTree[root] = [];
      if (app) namespaceTree[root].push(app);
    });

    const roots = Object.keys(namespaceTree);
    kpiNamespaces.innerText = roots.length || 0;
    
    // Update Editor Dropdown
    const currentVal = pdeNamespaceSelect.value;
    pdeNamespaceSelect.innerHTML = namespaces.map(ns => `<option value="${ns}">${ns}</option>`).join('');

    if (namespaces.includes(currentVal)) {
      pdeNamespaceSelect.value = currentVal;
    } else if (namespaces.length > 0) {
      pdeNamespaceSelect.value = namespaces[0];
    }
    
    // Update Admin View List
    if (adminNamespaceList) {
       if (roots.length === 0) {
          adminNamespaceList.innerHTML = `<tr><td class="p-4 text-center text-slate-500">No namespaces found</td></tr>`;
       } else {
          adminNamespaceList.innerHTML = roots.map(root => {
            const appsCount = namespaceTree[root].filter(app => app !== '').length;
            return `
            <tr class="hover:bg-slate-800/50 transition-colors cursor-pointer group" onclick="openNamespaceDetails('${root}')">
               <td class="px-5 py-3 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span class="font-mono text-slate-200 group-hover:text-brand-300 transition-colors">${root}</span>
                  </div>
                  <span class="text-xs text-slate-500 group-hover:text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">${appsCount} app${appsCount !== 1 ? 's' : ''} &rarr;</span>
               </td>
            </tr>
            `;
          }).join('');
       }
    }

    if (currentAdminNamespace && !adminDetailsView.classList.contains('hidden')) {
      renderAdminAppList(currentAdminNamespace);
    }
    
  } catch (e) {
    console.error("Failed to fetch namespaces", e);
  }
}

async function fetchPdeState() {
  const ns = pdeNamespaceSelect.value;
  if (!ns || ns === 'NEW_ADD') {
    policyEditor.value = "";
    entitiesEditor.value = "[]";
    return;
  }
  
  try {
    const [polRes, entRes] = await Promise.all([
      fetch('/api/pde/policies?namespace=' + encodeURIComponent(ns)),
      fetch('/api/pde/entities?namespace=' + encodeURIComponent(ns))
    ]);
    
    const policies = (await polRes.json()) || {};
    const entities = (await entRes.json()) || [];
    
    let polStr = '';
    if (policies.staticPolicies) {
      for (const [key, val] of Object.entries(policies.staticPolicies)) {
        polStr += `// ${key}\n${val.trim()}\n\n`;
      }
    }
    policyEditor.value = polStr;
    entitiesEditor.value = JSON.stringify(entities, null, 2);
  } catch (e) {
    console.error("Failed to load PDE state:", e);
  }
}

pdeNamespaceSelect.addEventListener('change', () => {
    fetchPdeState();
});

btnAdminBack.addEventListener('click', () => {
  adminDetailsView.classList.add('hidden');
  adminMainView.classList.remove('hidden');
  currentAdminNamespace = null;
});

if (btnAdminAppBack) {
  btnAdminAppBack.addEventListener('click', () => {
    adminAppDetailView.classList.add('hidden');
    adminDetailsView.classList.remove('hidden');
    currentAdminApp = null;
  });
}

if (btnEditAppPolicies) {
  btnEditAppPolicies.addEventListener('click', () => {
    const fullNamespace = `${currentAdminNamespace}::${currentAdminApp}`;
    window.location.hash = '#policies';
    setTimeout(() => {
      if (pdeNamespaceSelect) {
        // Only select if it exists or we could fetch it, since namespaces might need syncing
        const opts = Array.from(pdeNamespaceSelect.options).map(o => o.value);
        if (opts.includes(fullNamespace)) {
          pdeNamespaceSelect.value = fullNamespace;
        } else {
          // If it's not strictly an option, add it temporarily so it works
          const opt = document.createElement('option');
          opt.value = fullNamespace;
          opt.innerText = fullNamespace;
          pdeNamespaceSelect.appendChild(opt);
          pdeNamespaceSelect.value = fullNamespace;
        }
        fetchPdeState();
      }
    }, 100);
  });
}

if (btnSaveAppMetadata) {
  btnSaveAppMetadata.addEventListener('click', async () => {
    if (!currentAdminNamespace || !currentAdminApp) return;

    const isConfirmed = await showConfirm(
       "Update Application", 
       "Are you sure you want to save these changes to the active metadata structure?"
    );
    if (!isConfirmed) return;

    const fullNamespace = `${currentAdminNamespace}::${currentAdminApp}`;
    const ownerTeam = adminDetailAppOwner ? adminDetailAppOwner.value.trim() : '';
    const supportEmail = adminDetailAppEmail ? adminDetailAppEmail.value.trim() : '';
    const environment = adminDetailAppEnv ? adminDetailAppEnv.value : '';

    btnSaveAppMetadata.disabled = true;
    const oldText = btnSaveAppMetadata.innerText;
    btnSaveAppMetadata.innerText = 'Saving...';

    try {
        await fetch('/api/pde/applications', {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
             namespace: fullNamespace,
             ownerTeam, 
             supportEmail, 
             environment 
           })
        });
        btnSaveAppMetadata.innerText = 'Saved!';
    } catch(e) {
        console.error("Failed to update Application:", e);
        btnSaveAppMetadata.innerText = 'Error!';
    } finally {
        setTimeout(() => {
           btnSaveAppMetadata.disabled = false;
           btnSaveAppMetadata.innerText = oldText;
        }, 2000);
    }
  });
}

btnCreateApp.addEventListener('click', async () => {
    if (!currentAdminNamespace) return;
    const appName = adminNewAppInput.value.trim();
    if (!appName) return;
    
    const ownerTeam = adminNewAppOwner ? adminNewAppOwner.value.trim() : '';
    const supportEmail = adminNewAppEmail ? adminNewAppEmail.value.trim() : '';
    const environment = adminNewAppEnv ? adminNewAppEnv.value : '';

    btnCreateApp.disabled = true;
    btnCreateApp.innerText = 'Creating...';
    
    const fullNamespace = `${currentAdminNamespace}::${appName}`;
    try {
        await fetch('/api/pde/applications', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
             namespace: fullNamespace,
             ownerTeam, 
             supportEmail, 
             environment 
           })
        });
        
        adminNewAppInput.value = '';
        if (adminNewAppOwner) adminNewAppOwner.value = '';
        if (adminNewAppEmail) adminNewAppEmail.value = '';
        if (adminNewAppEnv) adminNewAppEnv.value = 'DEV';
        
        await fetchNamespaces();
    } catch(e) {
        console.error("Failed to create Application:", e);
    } finally {
        btnCreateApp.disabled = false;
        btnCreateApp.innerText = 'Create Application';
    }
});

btnCreateNs.addEventListener('click', async () => {
    const ns = adminNewNsInput.value.trim();
    if (!ns) return;
    
    btnCreateNs.disabled = true;
    btnCreateNs.innerText = 'Creating...';
    
    try {
        // Create an empty namespace by saving an empty policy to it
        await fetch('/api/pde/policies?namespace=' + encodeURIComponent(ns), {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ staticPolicies: {} })
        });
        adminNewNsInput.value = '';
        await fetchNamespaces();
        // Switch context to newly created namespace in the editor
        if (pdeNamespaceSelect) {
            const opts = Array.from(pdeNamespaceSelect.options).map(o => o.value);
            if(opts.includes(ns)) {
                pdeNamespaceSelect.value = ns;
                fetchPdeState();
            }
        }
    } catch(e) {
        console.error("Failed to create NS:", e);
    } finally {
        btnCreateNs.disabled = false;
        btnCreateNs.innerText = 'Initialize Namespace';
    }
});

function setupWizardEvents() {
  if (!btnOpenWizard) return;
  
  btnOpenWizard.addEventListener('click', () => {
    wizardModal.classList.remove('hidden');
    wizardModal.classList.add('flex');
  });
  
  btnWizCancel.addEventListener('click', () => {
    wizardModal.classList.add('hidden');
    wizardModal.classList.remove('flex');
  });
  
  const setupToggle = (typeSel, valInp, customInp) => {
    typeSel.addEventListener('change', () => {
      if (typeSel.value === 'Any') {
        valInp.disabled = true;
        valInp.value = '';
        customInp.classList.add('hidden');
      } else if (typeSel.value === 'Custom') {
        valInp.disabled = false;
        customInp.classList.remove('hidden');
        customInp.focus();
      } else {
        valInp.disabled = false;
        customInp.classList.add('hidden');
        valInp.focus();
      }
    });
  };
  
  setupToggle(wizPrincipalType, wizPrincipalVal, wizPrincipalCustom);
  setupToggle(wizActionType, wizActionVal, wizActionCustom);
  setupToggle(wizResourceType, wizResourceVal, wizResourceCustom);
  
  btnWizGenerate.addEventListener('click', () => {
    const name = wizRuleName.value.trim() || 'New Rule';
    const effect = wizEffectPermit && wizEffectPermit.checked ? 'permit' : 'forbid';
    
    let principalStr = '';
    if (wizPrincipalType.value !== 'Any' && wizPrincipalVal.value.trim()) {
      const typeStr = wizPrincipalType.value === 'Custom' ? (wizPrincipalCustom.value.trim() || 'Custom') : wizPrincipalType.value;
      principalStr = `principal == ${typeStr}::"${wizPrincipalVal.value.trim()}"`;
    } else {
      principalStr = `principal`;
    }
    
    let actionStr = '';
    if (wizActionType.value !== 'Any' && wizActionVal.value.trim()) {
      const typeStr = wizActionType.value === 'Custom' ? (wizActionCustom.value.trim() || 'Custom') : wizActionType.value;
      actionStr = `action == ${typeStr}::"${wizActionVal.value.trim()}"`;
    } else {
      actionStr = `action`;
    }
    
    let resourceStr = '';
    if (wizResourceType.value !== 'Any' && wizResourceVal.value.trim()) {
       const typeStr = wizResourceType.value === 'Custom' ? (wizResourceCustom.value.trim() || 'Custom') : wizResourceType.value;
       resourceStr = `resource == ${typeStr}::"${wizResourceVal.value.trim()}"`;
    } else {
       resourceStr = `resource`;
    }
    
    const conditions = [principalStr, actionStr, resourceStr].join(',\n  ');
    
    let policy = `// ${name}\n${effect} (\n  ${conditions}\n);`;
    
    // Append to editor
    if (policyEditor.value) {
      if (!policyEditor.value.endsWith('\\n\\n')) {
        policyEditor.value += policyEditor.value.endsWith('\\n') ? '\\n' : '\\n\\n';
      }
      policyEditor.value += policy + '\\n\\n';
    } else {
      policyEditor.value = policy + '\\n\\n';
    }
    
    // Close modal
    wizardModal.classList.add('hidden');
    wizardModal.classList.remove('flex');
    
    // Reset forms
    wizRuleName.value = '';
    wizPrincipalType.value = 'Any';
    wizPrincipalVal.value = '';
    wizPrincipalVal.disabled = true;
    wizPrincipalCustom.value = '';
    wizPrincipalCustom.classList.add('hidden');
    wizActionType.value = 'Any';
    wizActionVal.value = '';
    wizActionVal.disabled = true;
    wizActionCustom.value = '';
    wizActionCustom.classList.add('hidden');
    wizResourceType.value = 'Any';
    wizResourceVal.value = '';
    wizResourceVal.disabled = true;
    wizResourceCustom.value = '';
    wizResourceCustom.classList.add('hidden');
  });
}
setupWizardEvents();

btnSavePolicies.addEventListener('click', async () => {
  btnSavePolicies.innerText = 'Saving...';
  const ns = pdeNamespaceSelect.value;
  if (!ns) return;

  try {
    let text = policyEditor.value;
    const rules = {};
    const sections = text.split(/\n\n+/);
    sections.forEach((sec, idx) => {
      if (sec.trim().length > 0 && !sec.trim().startsWith('//')) {
         rules[`rule${idx+1}`] = sec.trim();
      } else if (sec.trim().startsWith('//')) {
         // handle the comments gracefully if we parse it
         // highly simplified parser to just grab rules
         const lines = sec.split('\n');
         const ruleName = lines[0].replace('//', '').trim();
         const ruleBody = lines.slice(1).join('\n').trim();
         if(ruleBody) rules[ruleName] = ruleBody;
      }
    });

    const bodyObj = { staticPolicies: rules };
    const res = await fetch('/api/pde/policies?namespace=' + encodeURIComponent(ns), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj)
    });
    
    if(res.ok) btnSavePolicies.innerText = 'Saved!';
    else btnSavePolicies.innerText = 'Error!';
  } catch(e) {
    btnSavePolicies.innerText = 'Error!';
  } finally {
    setTimeout(() => { btnSavePolicies.innerText = 'Save Definition'; }, 2000);
  }
});

btnSaveEntities.addEventListener('click', async () => {
  btnSaveEntities.innerText = 'Saving...';
  const ns = pdeNamespaceSelect.value;
  if (!ns) return;

  try {
    const updatedEntities = JSON.parse(entitiesEditor.value);
    const res = await fetch('/api/pde/entities?namespace=' + encodeURIComponent(ns), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedEntities)
    });
    
    if(res.ok) btnSaveEntities.innerText = 'Saved!';
    else btnSaveEntities.innerText = 'Error!';
  } catch(e) {
    alert("Invalid JSON format for entities!");
    btnSaveEntities.innerText = 'Error!';
  } finally {
    setTimeout(() => { btnSaveEntities.innerText = 'Save Context'; }, 2000);
  }
});


// --- Initialization & Polling ---

let pollingInterval = null;

function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(() => {
    if (activeAccount) {
      fetchApprovals();
      fetchTelemetry();
    }
  }, 2000);
}

async function fetchSystemVersion() {
  try {
    const res = await fetch('/api/system/version');
    if (!res.ok) return;
    const data = await res.json();
    const versionEl = document.getElementById('sys-version');
    if (versionEl && data.version && data.version !== "unknown") {
      versionEl.innerText = `v.${data.version}`;
      versionEl.classList.remove('hidden');
    }
  } catch (e) {
    console.log("System version skipped or unavailable.");
  }
}
