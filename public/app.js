// --- DOM Elements ---

// Navigation & Routing
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
  let hash = window.location.hash || '#dashboard';
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
handleRouting();


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
    const events = await res.json();
    
    // Update global intercept counter if it's far behind
    if (events.length > totalIntercepts) {
       totalIntercepts = events.length;
       kpiIntercepts.innerText = totalIntercepts;
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

      return `
        <tr class="hover:bg-slate-800/50 transition-colors group cursor-pointer" onclick="toggleTelemetry('${ev.eventId}')">
          <td class="px-5 py-3 border-b border-slate-700/50 font-mono text-xs text-slate-500 flex items-center gap-2">
            <span class="text-slate-600 text-[10px] transform transition-transform ${isExpanded ? 'rotate-90' : ''}">▶</span> ${time}
          </td>
          <td class="px-5 py-3 border-b border-slate-700/50"><span class="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs border border-slate-700">${ev.eventType}</span></td>
          <td class="px-5 py-3 border-b border-slate-700/50 font-medium text-slate-200">${typeStr}</td>
          <td class="px-5 py-3 border-b border-slate-700/50">
            ${ev.decision ? `<span class="uppercase text-[10px] font-bold px-2 py-0.5 rounded border ${badgeClass}">${ev.decision}</span>` : '-'}
          </td>
          <td class="px-5 py-3 border-b border-slate-700/50 text-xs text-slate-400 truncate max-w-[200px]" title="${ev.executionStatus || ev.reason || '-'}">${ev.executionStatus || ev.reason || '-'}</td>
        </tr>
        <tr class="${rowHiddenState} bg-slate-950/80 details-row-${ev.eventId}">
          <td colspan="5" class="p-4 border-b border-slate-700/50">
            <div class="bg-black/60 p-4 rounded-lg border border-slate-700/50 font-mono text-xs shadow-inner">
              <div class="text-[10px] text-brand-400 mb-2 uppercase tracking-widest font-bold border-b border-slate-800 pb-2">AML Canonical Action Schema Match</div>
              <pre class="text-sky-300 whitespace-pre-wrap">${escapedJson}</pre>
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
    
  } catch(e) {
    console.error("Failed to fetch app details", e);
    if (adminAppPolicies) adminAppPolicies.innerText = 'Error loading policies';
    if (adminAppEntities) adminAppEntities.innerText = 'Error loading context';
  }
};

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

setInterval(() => {
  fetchApprovals();
  fetchTelemetry();
}, 2000);

async function fetchSystemVersion() {
  try {
    const res = await fetch('/api/system/version');
    const data = await res.json();
    const versionEl = document.getElementById('sys-version');
    if (versionEl && data.version && data.version !== "unknown") {
      versionEl.innerText = `v.${data.version}`;
      versionEl.classList.remove('hidden');
    }
  } catch (e) {
    console.error("Failed to fetch system version", e);
  }
}

async function init() {
    await fetchNamespaces();
    await fetchPdeState();
    fetchSystemVersion();
    fetchApprovals();
    fetchTelemetry();
}
init();
