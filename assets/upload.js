(() => {
  "use strict";

  // ---- AUTH GUARD (admin only) ----
  if (!window.FLQSR_AUTH || FLQSR_AUTH.session()?.role !== "admin") {
    location.href = "/login.html";
    return;
  }

  const statusEl = document.getElementById("status");
  const submitBtn = document.getElementById("submitBtn");

  function setStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.style.color = isError ? "#ff6b6b" : "#7CFC9A";
  }

  function getFiles() {
    return Array.from(document.querySelectorAll('input[type="file"]'))
      .map(i => i.files[0])
      .filter(Boolean);
  }

  function validateCSV(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result.trim();
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) {
          reject(`File ${file.name} has no data rows`);
          return;
        }

        const headers = lines[0].toLowerCase().split(",");
        const required = ["date", "location", "sales", "labor"];

        for (const r of required) {
          if (!headers.includes(r)) {
            reject(`Missing column "${r}" in ${file.name}`);
            return;
          }
        }
        resolve();
      };
      reader.readAsText(file);
    });
  }

  async function validateAndSubmit() {
    try {
      const files = getFiles();
      if (!files.length) {
        setStatus("No files selected.", true);
        return;
      }

      setStatus("Validating files...");

      for (const file of files) {
        await validateCSV(file);
      }

      // Save snapshot locally (admin approval step)
      const snapshot = {
        uploadedAt: new Date().toISOString(),
        files: files.map(f => f.name)
      };

      localStorage.setItem("flqsr_latest_upload", JSON.stringify(snapshot));

      setStatus("Upload validated. Ready for admin approval.");

      // Optional: redirect to admin review
      // location.href = "/admin.html";

    } catch (err) {
      setStatus(err.toString(), true);
    }
  }

  submitBtn.addEventListener("click", validateAndSubmit);
})();
