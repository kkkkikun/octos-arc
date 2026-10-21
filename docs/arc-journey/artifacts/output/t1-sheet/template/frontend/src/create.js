/* Workbook creation page: creates a new blank workbook and opens it in the
 * editor. The submit button is named "Create". A new workbook gets a single
 * blank worksheet "Sheet1" (active) with no cells. On failure an error is
 * shown and the user stays on this page to retry; the incomplete record is
 * rolled back so it never appears on the home page. */
(function () {
  "use strict";

  var app = document.getElementById("app");

  var h = document.createElement("h1");
  h.textContent = "New blank workbook";
  app.appendChild(h);

  var error = document.createElement("div");
  error.className = "create-error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  app.appendChild(error);

  var form = document.createElement("form");
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    create();
  });

  var createBtn = document.createElement("button");
  createBtn.type = "submit";
  createBtn.textContent = "Create";
  form.appendChild(createBtn);
  app.appendChild(form);

  function create() {
    createBtn.disabled = true;
    error.hidden = true;
    App.store.load().then(function (state) {
      var name = uniqueName(state);
      var now = new Date().toISOString();
      state.workbooks[name] = {
        name: name,
        lastUpdated: now,
        activeSheet: "Sheet1",
        sheets: {
          "Sheet1": { cells: {} }
        }
      };
      return App.store.save().then(function () {
        window.location.href = "/workbook/" + encodeURIComponent(name);
      }).catch(function (err) {
        // Roll back the incomplete record so it never appears on the home page.
        delete state.workbooks[name];
        showError(err);
      });
    }).catch(function (err) {
      showError(err);
    });
  }

  function showError(err) {
    error.textContent = "Could not create workbook: " +
      (err && err.message ? err.message : "unknown error");
    error.hidden = false;
    createBtn.disabled = false;
  }

  function uniqueName(state) {
    var base = "Untitled workbook";
    if (!state.workbooks[base]) return base;
    var i = 2;
    while (state.workbooks[base + " " + i]) i++;
    return base + " " + i;
  }
})();
