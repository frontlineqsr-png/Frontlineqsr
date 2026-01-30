// FrontlineQSR Upload Validation Logic

const MONTHS_REQUIRED = 5;
const REQUIRED_COLUMNS = [
  "Date",
  "Sales",
  "Labor %",
  "Transactions",
  "Net Sales"
];

const uploadSlots = document.getElementById("uploadSlots");
const validateBtn = document.getElementById("validateBtn");
const downloadBtn = document.getElementById("downloadIssuesBtn");
const resetBtn = document.getElementById("resetBtn");
const statusText = document.getElementById("statusText");
const issuesList = document.getElementById("issuesList");

let uploads = [];

// Build upload slots dynamically
function buildUploadSlots() {
  uploadSlots.innerHTML = "";
  uploads = [];

  for (let i = 1; i <= MONTHS_REQUIRED; i++) {
    const slot = document.createElement("div");
    slot.className = "card";

    slot.innerHTML = `
      <h4>Month ${i}</h4>
      <label>Month</label>
      <select class="monthSelect">
        <option value="">Select Month</option>
        ${generateMonthOptions()}
      </select>

      <label style="margin-top:8px;">CSV File</label>
      <input type="file" accept=".csv" class="fileInput" />
      <div class="meta error hidden"></div>
    `;

    uploadSlots.appendChild(slot);
    uploads.push(slot);
  }
}

function generateMonthOptions() {
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  return months.map(m => `<option value="${m}">${m}</option>`).join("");
}

// Validate uploads
validateBtn.addEventListener("click", async () => {
  issuesList.innerHTML = "";
  statusText.textContent = "Validating files...";
  downloadBtn.disabled = true;

  const usedMonths = new Set();
  let issues = [];

  for (let i = 0; i < uploads.length; i++) {
    const slot = uploads[i];
    const month = slot.querySelector(".monthSelect").value;
    const fileInput = slot.querySelector(".fileInput");
    const errorBox = sl
