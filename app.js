// === Supabase setup ===
const SUPABASE_URL = "https://kxrdehjguyeztfqhjfth.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4cmRlaGpndXllenRmcWhqZnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NTE1ODQsImV4cCI6MjA3NTUyNzU4NH0.4ZJ0Dwrbzlcyqpobb7c3UyIrfHH-JfVW5Hy23M71LKo";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// === Globals ===
const FIELDS = ['333', '332', '331', '330', '313-B'];
let currentFiles = {};
let currentFileName = null;
let editIndex = null;

// === Utility ===
function showLoading(show) {
  document.getElementById("loadingOverlay").style.display = show ? "block" : "none";
}

// === Tabs ===
function openTab(evt, tabName) {
  document.querySelectorAll(".tabcontent").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tablink").forEach(el => el.classList.remove("active"));
  document.getElementById(tabName).classList.add("active");
  evt.currentTarget.classList.add("active");
}

// === Load Supabase data on startup ===
window.addEventListener('DOMContentLoaded', async () => {
  showLoading(true);
  const { data, error } = await supabase.from('feed_reports').select('*');
  if (data) {
    data.forEach(row => { currentFiles[row.filename] = row.data; });
    updateFileList();
    updateFileSelector();
  }
  showLoading(false);
});

// === Upload files ===
document.getElementById('fileInput').addEventListener('change', async (e) => {
  showLoading(true);
  const uploadedFiles = [];

  for (const file of e.target.files) {
    const text = await file.text();
    try {
      const json = JSON.parse(text);
      currentFiles[file.name] = json;
      uploadedFiles.push(file.name);
      await supabase.from('feed_reports')
        .upsert([{ filename: file.name, data: json }]);
    } catch {
      alert(`Invalid JSON in ${file.name}`);
    }
  }

  updateFileList();
  updateFileSelector();

  if (uploadedFiles.length) {
    const firstFile = uploadedFiles[0];
    document.getElementById('fileSelector').value = firstFile;
    loadReport(firstFile);
    openTab({ currentTarget: document.querySelector('.tablink:nth-child(2)') }, 'reportTab');
  }

  showLoading(false);
  alert('Upload complete! Files saved and loaded.');
});

// === Update file list and selector ===
function updateFileList() {
  const list = document.getElementById('fileList');
  const names = Object.keys(currentFiles);
  list.innerHTML = names.length
    ? names.map(n => `<div>${n}</div>`).join('')
    : '<p>No files loaded.</p>';
}

function updateFileSelector() {
  const selector = document.getElementById('fileSelector');
  const names = Object.keys(currentFiles);
  selector.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
  if (names.length) {
    selector.value = names[0];
    loadReport(names[0]);
  }
}

// === Load report ===
document.getElementById('fileSelector').addEventListener('change', e => loadReport(e.target.value));

function loadReport(filename) {
  currentFileName = filename;
  renderReport(currentFiles[filename] || []);
}

// === Render table ===
function renderReport(data) {
  const reportTable = document.getElementById('reportTable');
  while (reportTable.tBodies.length > 0) reportTable.removeChild(reportTable.tBodies[0]);

  if (!data.length) {
    reportTable.style.display = 'none';
    return;
  }

  const groups = {};
  data.forEach((entry, i) => {
    const date = entry.date || 'Unknown Date';
    if (!groups[date]) groups[date] = [];
    groups[date].push({ ...entry, _index: i });
  });

  Object.keys(groups).sort().forEach(date => {
    const tbody = document.createElement('tbody');
    const totals = { '333': 0, '332': 0, '331': 0, '330': 0, '313-B': 0 };

    groups[date].forEach(entry => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${entry.date}</td>
        <td>${entry.farm}</td>
        ${FIELDS.map(f => {
          const val = entry[f];
          if (val) totals[f] += parseFloat(val) || 0;
          return `<td>${val || ''}</td>`;
        }).join('')}
        <td class="action-column"><button class="edit-btn" onclick="editEntry(${entry._index})">Edit</button></td>
      `;
      tbody.appendChild(tr);
    });

    const totalRow = document.createElement('tr');
    totalRow.classList.add('total-row');
    totalRow.innerHTML = `<td colspan="2">TOTAL</td>${FIELDS.map(f => `<td>${totals[f]}</td>`).join('')}<td></td>`;
    tbody.appendChild(totalRow);
    reportTable.appendChild(tbody);
  });

  reportTable.style.display = 'table';
}

// === Edit modal ===
function editEntry(index) {
  const pass = prompt("Enter admin password:");
  if (pass !== "123") return alert("Incorrect password.");
  const entry = currentFiles[currentFileName][index];
  editIndex = index;

  ['date','farm','333','332','331','330','313-B'].forEach(id => {
    document.getElementById(`edit${id.replace('-', '')}`).value = entry[id] || '';
  });

  document.getElementById('overlay').style.display = 'block';
  document.getElementById('editModal').style.display = 'block';
}

function closeModal() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('editModal').style.display = 'none';
}

// === Save edit ===
document.getElementById('editForm').addEventListener('submit', async e => {
  e.preventDefault();
  const entry = currentFiles[currentFileName][editIndex];
  entry.date = document.getElementById('editDate').value.trim();
  entry.farm = document.getElementById('editFarm').value.trim();
  entry['333'] = document.getElementById('edit333').value.trim();
  entry['332'] = document.getElementById('edit332').value.trim();
  entry['331'] = document.getElementById('edit331').value.trim();
  entry['330'] = document.getElementById('edit330').value.trim();
  entry['313-B'] = document.getElementById('edit313B').value.trim();

  closeModal();
  renderReport(currentFiles[currentFileName]);
  showLoading(true);
  await supabase.from('feed_reports')
    .update({ data: currentFiles[currentFileName] })
    .eq('filename', currentFileName);
  showLoading(false);
});

// === Backup all ===
document.getElementById('backupBtn').addEventListener('click', () => {
  Object.entries(currentFiles).forEach(([name, data]) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  });
});

// === Clear all ===
document.getElementById('clearBtn').addEventListener('click', async () => {
  const pass = prompt("Enter admin password to clear all:");
  if (pass !== "123") return alert("Incorrect password.");
  if (!confirm("Are you sure you want to delete all reports?")) return;

  showLoading(true);
  currentFiles = {};
  document.getElementById('reportTable').style.display = 'none';
  document.getElementById('fileList').innerHTML = '';
  document.getElementById('fileSelector').innerHTML = '';
  await supabase.from('feed_reports').delete().neq('filename', '');
  showLoading(false);
  alert("All data cleared.");
});
