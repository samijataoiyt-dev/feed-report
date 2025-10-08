// === Supabase setup ===
const SUPABASE_URL = "https://kxrdehjguyeztfqhjfth.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4cmRlaGpndXllenRmcWhqZnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NTE1ODQsImV4cCI6MjA3NTUyNzU4NH0.4ZJ0Dwrbzlcyqpobb7c3UyIrfHH-JfVW5Hy23M71LKo";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Fields for report
const FIELDS = ['333','332','331','330','313-B'];

// State
let currentFiles = {};      // { filename: dataArray }
let currentFileName = null;
let editIndex = null;

// DOM
const navBtns = document.querySelectorAll('.nav-btn');
const panels = document.querySelectorAll('.panel');
const pageTitle = document.getElementById('pageTitle');

const fileInput = document.getElementById('fileInput');
const fileListEl = document.getElementById('fileList');
const fileSelector = document.getElementById('fileSelector');
const reportTable = document.getElementById('reportTable');
const reportWrapper = document.getElementById('reportWrapper');

const editModal = document.getElementById('editModal');
const overlay = document.getElementById('overlay');
const editForm = document.getElementById('editForm');

const saveChangesBtn = document.getElementById('saveChangesBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const saveAllBtn = document.getElementById('saveAllBtn');
const refreshBtn = document.getElementById('refreshBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');
const statusText = document.getElementById('statusText');

/* Auth DOM */
const signInBtn = document.getElementById('signInBtn');
const signUpBtn = document.getElementById('signUpBtn');
const signOutBtn = document.getElementById('signOutBtn');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const signupEmail = document.getElementById('signupEmail');
const signupPassword = document.getElementById('signupPassword');
const authForms = document.getElementById('authForms');
const userPanel = document.getElementById('userPanel');
const userEmailEl = document.getElementById('userEmail');
const showSignup = document.getElementById('showSignup');
const showSignin = document.getElementById('showSignin');
const signupCard = document.getElementById('signupCard');

/* simple helpers */
function showLoading(show){
  loadingOverlay.classList.toggle('hidden', !show);
}
function showToast(msg, timeout=2500){
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(()=>toast.classList.add('hidden'), timeout);
}
function setStatus(msg){ statusText.textContent = msg || ''; }

/* NAV */
navBtns.forEach(btn=>{
  btn.addEventListener('click', (e)=>{
    navBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');

    panels.forEach(p=>p.classList.remove('active'));
    const target = btn.dataset.target;
    document.getElementById(target).classList.add('active');

    pageTitle.textContent = btn.textContent.trim();
  });
});

/* AUTH: toggle signin/signup forms */
showSignup.addEventListener('click', e=>{
  e.preventDefault();
  signupCard.classList.remove('hidden');
});
showSignin.addEventListener('click', e=>{
  e.preventDefault();
  signupCard.classList.add('hidden');
});

/* AUTH: sign up */
signUpBtn.addEventListener('click', async ()=>{
  const email = signupEmail.value.trim();
  const password = signupPassword.value;
  if(!email || !password){
    return showToast('Enter email and password');
  }
  showLoading(true);
  const { data, error } = await supabase.auth.signUp({ email, password });
  showLoading(false);
  if(error) return showToast('Sign up error: ' + error.message);
  showToast('Check your email to confirm (if email confirmations enabled).');
  signupEmail.value = ''; signupPassword.value = '';
  signupCard.classList.add('hidden');
});

/* AUTH: sign in */
signInBtn.addEventListener('click', async ()=>{
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if(!email || !password) return showToast('Enter email and password');
  showLoading(true);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  showLoading(false);
  if(error) return showToast('Sign in error: ' + error.message);
  await onSignedIn();
});

/* AUTH: sign out */
signOutBtn.addEventListener('click', async ()=>{
  await supabase.auth.signOut();
  setUiForSignedOut();
});

/* AUTH: check session on load */
async function checkSession(){
  const { data: { session }} = await supabase.auth.getSession();
  if(session) {
    await onSignedIn();
  } else {
    setUiForSignedOut();
  }
}

/* Set UI when signed in */
async function onSignedIn(){
  const { data: { user } } = await supabase.auth.getUser();
  userPanel.classList.remove('hidden');
  authForms.classList.add('hidden');
  userEmailEl.textContent = user?.email || 'User';
  userPanel.querySelector('#signOutBtn')?.addEventListener('click', async ()=>{ await supabase.auth.signOut(); setUiForSignedOut(); });
  // load cloud data
  await fetchAllReportsFromCloud();
}

/* Set UI for logged-out */
function setUiForSignedOut(){
  userPanel.classList.add('hidden');
  authForms.classList.remove('hidden');
  signupCard.classList.add('hidden');
  currentFiles = {};
  currentFileName = null;
  updateFileList();
  updateFileSelector();
  renderReport([]);
}

/* ===== Data functions ===== */

/* Fetch all reports from Supabase */
async function fetchAllReportsFromCloud(){
  showLoading(true);
  setStatus('Loading files from cloud...');
  const { data, error } = await supabase.from('feed_reports').select('*');
  showLoading(false);
  setStatus('');
  if(error) {
    showToast('Error fetching: ' + error.message);
    return;
  }
  currentFiles = {};
  (data || []).forEach(row => {
    currentFiles[row.filename] = row.data || [];
  });
  updateFileList();
  updateFileSelector();
  showToast('Files loaded from cloud');
}

/* Upload or upsert a single file (by name) to Supabase */
async function upsertFileToCloud(filename, jsonData){
  showLoading(true);
  setStatus('Saving ' + filename + '...');
  const { error } = await supabase.from('feed_reports').upsert({ filename, data: jsonData });
  showLoading(false);
  setStatus('');
  if(error) throw error;
}

/* Delete all rows in table (admin) */
async function deleteAllCloud(){
  showLoading(true);
  setStatus('Deleting all reports from cloud...');
  const { error } = await supabase.from('feed_reports').delete().neq('filename','');
  showLoading(false);
  setStatus('');
  if(error) throw error;
}

/* ===== UI update helpers ===== */
function updateFileList(){
  const names = Object.keys(currentFiles);
  if(!names.length){
    fileListEl.innerHTML = '<p class="muted">No files loaded.</p>';
    return;
  }
  fileListEl.innerHTML = names.map(n=>`<div class="file-item"><div>${n}</div><div class="muted small">${(currentFiles[n]||[]).length} entries</div></div>`).join('');
}

function updateFileSelector(){
  const names = Object.keys(currentFiles);
  fileSelector.innerHTML = names.map(n=>`<option value="${encodeURIComponent(n)}">${n}</option>`).join('');
  if(names.length){
    // select first by default if nothing selected
    if(!currentFileName) {
      const first = names[0];
      fileSelector.value = encodeURIComponent(first);
      loadReport(first);
    } else {
      // preserve selection if exists
      if(names.includes(currentFileName)) fileSelector.value = encodeURIComponent(currentFileName);
    }
  } else {
    fileSelector.innerHTML = '';
    renderReport([]);
  }
}

/* ===== File upload (client) ===== */
fileInput.addEventListener('change', async (e)=>{
  if(!supabase.auth.getUser) {
    // ensure user logged in
  }
  const files = Array.from(e.target.files || []);
  if(!files.length) return;
  showLoading(true);
  setStatus('Processing upload...');
  const uploaded = [];
  for(const f of files){
    const text = await f.text();
    try {
      const json = JSON.parse(text);
      currentFiles[f.name] = json;
      uploaded.push(f.name);
      // upsert to cloud immediately in background
      try {
        await upsertFileToCloud(f.name, json);
      } catch(err){
        console.error('Upsert error', err);
        showToast('Error saving ' + f.name);
      }
    } catch(err){
      showToast('Invalid JSON: ' + f.name);
    }
  }
  updateFileList();
  updateFileSelector();
  showLoading(false);
  setStatus('');
  if(uploaded.length){
    // open report tab and select first uploaded
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    const reportBtn = Array.from(document.querySelectorAll('.nav-btn')).find(b=>b.dataset.target==='reportTab');
    reportBtn.classList.add('active');
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('reportTab').classList.add('active');
    pageTitle.textContent = 'Feed Report';
    loadReport(uploaded[0]);
  }
  showToast('Upload complete');
});

/* select change */
fileSelector.addEventListener('change', (e)=>{
  const filename = decodeURIComponent(e.target.value || '');
  if(filename) loadReport(filename);
});

/* load in-memory report into table */
function loadReport(filename){
  currentFileName = filename;
  renderReport(currentFiles[filename] || []);
}

/* Render table (grouped by date and totals) */
function renderReport(data){
  // clear table bodies
  while(reportTable.tBodies.length>0) reportTable.removeChild(reportTable.tBodies[0]);
  if(!Array.isArray(data) || !data.length){
    reportTable.style.display = 'none';
    return;
  }

  // group by date
  const groups = {};
  data.forEach((entry, idx)=>{
    const date = entry.date || 'Unknown Date';
    if(!groups[date]) groups[date] = [];
    groups[date].push({...entry, _index: idx});
  });

  const sortedDates = Object.keys(groups).sort();
  sortedDates.forEach(date=>{
    const tbody = document.createElement('tbody');
    tbody.classList.add('date-group');
    const entries = groups[date];
    const totals = {'333':0,'332':0,'331':0,'330':0,'313-B':0};

    entries.forEach(ent=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${ent.date || ''}</td>
        <td>${ent.farm || ''}</td>
        ${FIELDS.map(f=>{
          const v = ent[f];
          if(v !== undefined && v !== '' && v !== null){
            totals[f] += parseFloat(v) || 0;
            return `<td>${v}</td>`;
          } else return `<td></td>`;
        }).join('')}
        <td class="action-column"><button class="btn" onclick="window.app_editEntry(${ent._index})">Edit</button></td>
      `;
      tbody.appendChild(tr);
    });

    const totalRow = document.createElement('tr');
    totalRow.classList.add('total-row');
    totalRow.innerHTML = `<td colspan="2">TOTAL</td>${FIELDS.map(f=>`<td>${totals[f]}</td>`).join('')}<td></td>`;
    tbody.appendChild(totalRow);

    reportTable.appendChild(tbody);
  });

  reportTable.style.display = 'table';
}

/* expose editEntry to inline onclicks */
window.app_editEntry = function(index){
  // only allow if signed in
  supabase.auth.getUser().then(({data:{user}})=>{
    if(!user) return showToast('Sign in to edit');
    editEntry(index);
  });
};

/* Open modal and populate */
function editEntry(index){
  if(!currentFileName) return showToast('No file selected');
  const fileData = currentFiles[currentFileName] || [];
  const entry = fileData[index];
  if(!entry) return showToast('Entry not found');

  editIndex = index;
  document.getElementById('editDate').value = entry.date || '';
  document.getElementById('editFarm').value = entry.farm || '';
  document.getElementById('edit333').value = entry['333'] || '';
  document.getElementById('edit332').value = entry['332'] || '';
  document.getElementById('edit331').value = entry['331'] || '';
  document.getElementById('edit330').value = entry['330'] || '';
  document.getElementById('edit313B').value = entry['313-B'] || '';

  overlay.classList.remove('hidden');
  editModal.classList.remove('hidden');
}

/* Cancel edit */
document.getElementById('cancelEdit').addEventListener('click', ()=>{
  overlay.classList.add('hidden');
  editModal.classList.add('hidden');
});

/* Save edit locally and do not save to cloud until 'Save Changes' pressed */
editForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  if(!currentFileName || editIndex === null) return showToast('No open file');
  const fileData = currentFiles[currentFileName];
  const entry = fileData[editIndex];
  entry.date = document.getElementById('editDate').value.trim();
  entry.farm = document.getElementById('editFarm').value.trim();
  entry['333'] = document.getElementById('edit333').value.trim();
  entry['332'] = document.getElementById('edit332').value.trim();
  entry['331'] = document.getElementById('edit331').value.trim();
  entry['330'] = document.getElementById('edit330').value.trim();
  entry['313-B'] = document.getElementById('edit313B').value.trim();

  // close modal, re-render
  overlay.classList.add('hidden');
  editModal.classList.add('hidden');
  renderReport(fileData);
  showToast('Changes saved locally. Click Save Changes to push to cloud.');
});

/* Save Changes button: save currently open file to Supabase */
saveChangesBtn.addEventListener('click', async ()=>{
  if(!currentFileName) return showToast('No report open to save');
  const payload = currentFiles[currentFileName] || [];
  showLoading(true);
  try{
    await upsertFileToCloud(currentFileName, payload);
    showToast('Saved to cloud');
    // refresh cloud timestamp by fetching that single record (optional)
    await fetchAllReportsFromCloud();
  }catch(err){
    console.error(err);
    showToast('Save failed: ' + (err.message || err));
  } finally {
    showLoading(false);
  }
});

/* Save All: saves all in-memory files to cloud */
saveAllBtn.addEventListener('click', async ()=>{
  const names = Object.keys(currentFiles);
  if(!names.length) return showToast('No files to save');
  showLoading(true);
  for(const n of names){
    try{
      await upsertFileToCloud(n, currentFiles[n]);
    }catch(err){
      console.error(err);
      showToast('Error saving ' + n);
    }
  }
  showLoading(false);
  showToast('All files saved to cloud');
  await fetchAllReportsFromCloud();
});

/* Download all backups */
downloadAllBtn.addEventListener('click', ()=>{
  const names = Object.keys(currentFiles);
  if(!names.length) return showToast('No files to download');
  for(const n of names){
    const blob = new Blob([JSON.stringify(currentFiles[n], null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = n;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }
  showToast('Downloads started');
});

/* Refresh from cloud */
refreshBtn.addEventListener('click', async ()=>{
  await fetchAllReportsFromCloud();
});

/* Clear all (admin) */
clearAllBtn.addEventListener('click', async ()=>{
  const { data:{ user } } = await supabase.auth.getUser();
  if(!user) return showToast('Sign in to perform admin actions');
  if(!confirm('Are you sure you want to permanently delete ALL reports?')) return;
  showLoading(true);
  try{
    await deleteAllCloud();
    currentFiles = {};
    currentFileName = null;
    updateFileList();
    updateFileSelector();
    renderReport([]);
    showToast('All reports deleted');
  }catch(err){
    console.error(err);
    showToast('Delete failed');
  }finally{
    showLoading(false);
  }
});

/* Initial load */
checkSession();

/* expose for debugging */
window.appState = ()=>({currentFiles, currentFileName});
