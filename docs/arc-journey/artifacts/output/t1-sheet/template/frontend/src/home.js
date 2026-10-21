/* Workbook home page: lists every workbook in the store. Each record shows
 * "Last updated: <value>" and a link whose accessible name is the workbook
 * name, opening the editor at /workbook/<name>.
 *
 * REQ-1-3-1: an "Import CSV" button opens a dialog named "Import CSV" with a
 * file control labeled "CSV file" and a "Confirm import" button. The CSV is
 * parsed in original row/column order (UTF-8 Chinese/English/numeric text,
 * empty fields preserved, commas inside quotes, escaped quote pairs, embedded
 * newlines); a field that begins with a double quote but has no closing quote
 * is rejected with "Invalid CSV file format. Import failed." On success a new
 * workbook named after the file (minus its final .csv) is created with Sheet1
 * holding the parsed grid, and the editor opens. On failure no workbook is
 * created and no partial result is retained. */
(function () {
  "use strict";

  var app = document.getElementById("app");

  App.store.load().then(function (state) {
    var h = document.createElement("h1");
    h.textContent = "Workbooks";
    app.appendChild(h);

    var newBtn = document.createElement("button");
    newBtn.type = "button";
    newBtn.textContent = "New blank workbook";
    newBtn.addEventListener("click", function () {
      window.location.href = "/create";
    });
    app.appendChild(newBtn);

    var importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.textContent = "Import CSV";
    importBtn.addEventListener("click", function () {
      openImportDialog(state);
    });
    app.appendChild(importBtn);

    var list = document.createElement("ul");
    list.className = "workbook-list";

    Object.keys(state.workbooks).forEach(function (name) {
      var wb = state.workbooks[name];
      var li = document.createElement("li");

      var a = document.createElement("a");
      a.href = "/workbook/" + encodeURIComponent(name);
      a.textContent = name;
      li.appendChild(a);

      var upd = document.createElement("div");
      upd.className = "last-updated";
      upd.textContent = "Last updated: " + formatDate(wb.lastUpdated);
      li.appendChild(upd);

      list.appendChild(li);
    });

    app.appendChild(list);
  });

  function openImportDialog(state) {
    var content = document.createElement("div");

    var fileField = GenericUI.field({ name: "CSV file", type: "file" });
    content.appendChild(fileField);

    var error = document.createElement("div");
    error.className = "import-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    content.appendChild(error);

    var dlg = GenericUI.dialog({
      name: "Import CSV",
      content: content,
      actions: [
        {
          label: "Confirm import",
          onClick: function (close) {
            var input = fileField.input;
            var file = input.files && input.files[0];
            if (!file) {
              error.textContent = "Please choose a CSV file";
              error.hidden = false;
              return;
            }
            var reader = new FileReader();
            reader.onload = function () {
              var text = String(reader.result || "");
              var rows = parseCSV(text);
              if (!rows) {
                error.textContent = "Invalid CSV file format. Import failed.";
                error.hidden = false;
                return;
              }
              var name = file.name.replace(/\.csv$/i, "");
              if (!name) {
                error.textContent = "Invalid CSV file format. Import failed.";
                error.hidden = false;
                return;
              }
              // Build the grid cells in original row/column order.
              var cells = {};
              for (var r = 0; r < rows.length; r++) {
                for (var c = 0; c < rows[r].length; c++) {
                  cells[r + "," + c] = rows[r][c];
                }
              }
              var now = new Date().toISOString();
              var wb = {
                name: name,
                lastUpdated: now,
                activeSheet: "Sheet1",
                sheets: { "Sheet1": { cells: cells } }
              };
              state.workbooks[name] = wb;
              App.store.save().then(function () {
                close();
                window.location.href = "/workbook/" + encodeURIComponent(name);
              }).catch(function (err) {
                // Roll back the incomplete record so it never appears on the
                // home page and no partial result is retained.
                delete state.workbooks[name];
                error.textContent = "Import failed: " +
                  (err && err.message ? err.message : "unknown error");
                error.hidden = false;
              });
            };
            reader.onerror = function () {
              error.textContent = "Could not read the file";
              error.hidden = false;
            };
            reader.readAsText(file, "utf-8");
          }
        }
      ]
    });
  }

  // RFC-4180-style CSV parser. Returns an array of rows (each an array of
  // fields) or null when a field that begins with a double quote has no
  // closing quote (invalid CSV).
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var i = 0;
    while (i < text.length) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            inQuotes = false;
            i++;
          }
        } else {
          field += ch;
          i++;
        }
      } else {
        if (ch === '"') {
          if (field === "") {
            inQuotes = true;
            i++;
          } else {
            field += ch;
            i++;
          }
        } else if (ch === ',') {
          row.push(field);
          field = "";
          i++;
        } else if (ch === '\n') {
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
          i++;
        } else if (ch === '\r') {
          if (i + 1 < text.length && text[i + 1] === '\n') i++;
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
          i++;
        } else {
          field += ch;
          i++;
        }
      }
    }
    if (inQuotes) return null;
    if (field !== "" || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleString();
  }
})();
