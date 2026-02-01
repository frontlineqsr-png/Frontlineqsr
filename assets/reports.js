(() => {
  const data = JSON.parse(localStorage.getItem("flqsr_upload_data") || "[]");

  const out = document.getElementById("output");
  if (!data.length) {
    out.innerText = "No uploaded data yet.";
    return;
  }

  out.innerHTML = "<pre>" + JSON.stringify(data, null, 2) + "</pre>";
})();
