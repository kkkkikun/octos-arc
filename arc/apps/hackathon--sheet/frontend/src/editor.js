/* Workbook editor: shows the workbook named by the URL (/workbook/<id>).
 * Displays the workbook name, "Last updated: <value>", a formula bar, the
 * worksheet tabs in order with the active sheet selected, and the active
 * sheet's grid. Only the requested workbook's cells are rendered, so data
 * from another workbook never appears in the grid. The URL is directly
 * accessible and identifies the same workbook after refresh.
 *
 * REQ-1-2-2: next to the editor title is a "Rename workbook" button that
 * opens a dialog with a "Workbook name" text box (prefilled with the last
 * saved name) and a "Save" button. After trimming, the name must not be
 * empty; an empty name is rejected with "Workbook name cannot be empty".
 * A successful save updates the editor title and the home-page link; a
 * failed save shows an error and keeps the original name.
 *
 * REQ-2-1-3: right-clicking a worksheet tab opens a context menu with a
 * "Rename" item. It opens a dialog named "Rename worksheet" with a
 * "Worksheet name" text box (prefilled with the current name) and a "Save"
 * button. After trimming, the new name must not be empty and must be unique
 * within the same workbook; an empty name is rejected with "Worksheet name
 * cannot be empty", a duplicate with "Worksheet name already exists". A
 * successful save renames the tab; a failed save shows an error and keeps
 * the original name. Refreshing or reopening shows the saved name.
 *
 * REQ-2-1-4: the worksheet tab menu also has a "Delete" command. Deleting a
 * worksheet shows a "Delete worksheet" dialog naming the target with a
 * "Delete worksheet" confirmation button; on confirm the sheet and its data,
 * formulas, filters, validation, and pivot results are removed, an adjacent
 * worksheet becomes active, and the change persists. A target that is still a
 * pivot table source worksheet is rejected with "Please delete or rebuild
 * dependent pivot tables first". With only one worksheet left, "Delete" shows
 * "A workbook must contain at least one worksheet" without a dialog. */
(function () {
  "use strict";

  var app = document.getElementById("app");
  var id = decodeURIComponent(window.location.pathname.replace(/^\/workbook\//, ""));

  // REQ-3-2-2: undo/redo history for the current workbook session. Each entry
  // is a deep snapshot of the workbook taken before an operation; undo restores
  // the snapshot and redo reapplies it. The history lives only in this session
  // (it is empty after a refresh), while the restored state itself persists.
  var undoStack = [];
  var redoStack = [];
  var docKeyHandler = null;

  function snapshotWorkbook(wb) {
    return JSON.parse(JSON.stringify(wb));
  }

  function pushUndo(state, wb) {
    undoStack.push(snapshotWorkbook(wb));
    redoStack = [];
    updateUndoRedoButtons();
  }

  function undo(state, wb) {
    if (undoStack.length === 0) return;
    redoStack.push(snapshotWorkbook(wb));
    var prev = undoStack.pop();
    restoreWorkbook(state, wb, prev);
  }

  function redo(state, wb) {
    if (redoStack.length === 0) return;
    undoStack.push(snapshotWorkbook(wb));
    var next = redoStack.pop();
    restoreWorkbook(state, wb, next);
  }

  function restoreWorkbook(state, wb, snap) {
    Object.keys(wb).forEach(function (k) { delete wb[k]; });
    Object.keys(snap).forEach(function (k) { wb[k] = snap[k]; });
    wb.lastUpdated = new Date().toISOString();
    saveSync(App.store.get());
    render(state, wb);
  }

  function updateUndoRedoButtons() {
    var ub = findButton("Undo");
    var rb = findButton("Redo");
    if (ub) ub.disabled = undoStack.length === 0;
    if (rb) rb.disabled = redoStack.length === 0;
  }

  App.store.load().then(function (state) {
    var wb = state.workbooks[id];
    if (!wb) {
      app.textContent = "Workbook not found";
      return;
    }
    render(state, wb);
  });

  function render(state, wb) {
    app.textContent = "";

    var titleRow = document.createElement("div");
    titleRow.className = "editor-title-row";

    var h = document.createElement("h1");
    h.textContent = wb.name;
    titleRow.appendChild(h);

    var renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.textContent = "Rename workbook";
    renameBtn.addEventListener("click", function () {
      openRenameDialog(state, wb, h);
    });
    titleRow.appendChild(renameBtn);

    var exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.textContent = "Export CSV";
    exportBtn.addEventListener("click", function () {
      exportActiveSheet(wb, currentSheet);
    });
    titleRow.appendChild(exportBtn);

    // REQ-3-2-2: Undo and Redo buttons. Undo restores the workbook to the
    // state before the most recent operation; redo reapplies it. Redo is
    // disabled when there is nothing to redo (including after a new
    // modification following an undo).
    var undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.textContent = "Undo";
    undoBtn.disabled = undoStack.length === 0;
    undoBtn.addEventListener("click", function () {
      undo(state, wb);
    });
    titleRow.appendChild(undoBtn);

    var redoBtn = document.createElement("button");
    redoBtn.type = "button";
    redoBtn.textContent = "Redo";
    redoBtn.disabled = redoStack.length === 0;
    redoBtn.addEventListener("click", function () {
      redo(state, wb);
    });
    titleRow.appendChild(redoBtn);

    // REQ-5-1-2: "Data" menu with "Create filter", and a "Clear filter" button.
    var dataBtn = document.createElement("button");
    dataBtn.type = "button";
    dataBtn.textContent = "Data";
    dataBtn.addEventListener("click", function () {
      toggleDataMenu(dataMenu, dataBtn);
    });
    titleRow.appendChild(dataBtn);

    var dataMenu = document.createElement("div");
    dataMenu.className = "data-menu";
    dataMenu.setAttribute("role", "menu");
    dataMenu.hidden = true;
    titleRow.appendChild(dataMenu);

    var createFilterItem = document.createElement("button");
    createFilterItem.type = "button";
    createFilterItem.setAttribute("role", "menuitem");
    createFilterItem.textContent = "Create filter";
    createFilterItem.addEventListener("click", function () {
      dataMenu.hidden = true;
      createFilter(state, wb);
    });
    dataMenu.appendChild(createFilterItem);

    // REQ-5-1-1: "Sort range" opens a dialog that sorts the selected range by
    // a chosen column.
    var sortRangeItem = document.createElement("button");
    sortRangeItem.type = "button";
    sortRangeItem.setAttribute("role", "menuitem");
    sortRangeItem.textContent = "Sort range";
    sortRangeItem.addEventListener("click", function () {
      dataMenu.hidden = true;
      openSortRangeDialog(state, wb, currentSheet, grid);
    });
    dataMenu.appendChild(sortRangeItem);

    // REQ-3-2-1: "Data validation" opens a dialog that sets a numeric range
    // rule (0 to 100) on the selected cells. A paste that violates the rule is
    // rejected atomically with "Please enter a number from 0 to 100".
    var dataValidationItem = document.createElement("button");
    dataValidationItem.type = "button";
    dataValidationItem.setAttribute("role", "menuitem");
    dataValidationItem.textContent = "Data validation";
    dataValidationItem.addEventListener("click", function () {
      dataMenu.hidden = true;
      openDataValidationDialog(state, wb, currentSheet, grid);
    });
    dataMenu.appendChild(dataValidationItem);

    // REQ-5-3-1: "Create pivot table" opens a dialog that creates a pivot
    // worksheet from the selected source range.
    var createPivotItem = document.createElement("button");
    createPivotItem.type = "button";
    createPivotItem.setAttribute("role", "menuitem");
    createPivotItem.textContent = "Create pivot table";
    createPivotItem.addEventListener("click", function () {
      dataMenu.hidden = true;
      createPivotDialog(state, wb, grid);
    });
    dataMenu.appendChild(createPivotItem);

    var clearFilterBtn = document.createElement("button");
    clearFilterBtn.type = "button";
    clearFilterBtn.textContent = "Clear filter";
    clearFilterBtn.addEventListener("click", function () {
      clearFilter(state, wb);
    });
    titleRow.appendChild(clearFilterBtn);

    app.appendChild(titleRow);

    var upd = document.createElement("div");
    upd.className = "last-updated";
    upd.textContent = "Last updated: " + formatDate(wb.lastUpdated);
    app.appendChild(upd);

    // Formula bar: a labeled textbox showing the active cell's content.
    // REQ-3-1-1: editing a cell through the formula bar commits on Enter or
    // blur (clicking another cell), cancels on Escape. Ordinary cells show the
    // same input in the grid and formula bar; formula cells show the calculated
    // result in the grid and the original formula here.
    var fb = document.createElement("label");
    fb.className = "formula-bar";
    fb.textContent = "Formula bar ";
    var fbInput = document.createElement("input");
    fbInput.setAttribute("aria-label", "Formula bar");
    fb.appendChild(fbInput);
    app.appendChild(fb);

    // REQ-3-1-1: a failed commit shows an error beside the formula bar while
    // the grid and formula bar keep the last successful value.
    var commitError = document.createElement("div");
    commitError.className = "commit-error";
    commitError.setAttribute("role", "alert");
    commitError.hidden = true;
    app.appendChild(commitError);
    // The cell the formula bar is currently editing (its anchor). Kept so a
    // commit triggered by clicking another cell targets the cell the edit
    // started on, not the newly selected one.
    var fbTarget = null;
    fbInput.addEventListener("keydown", function (ev) {
      // Typing in the formula bar must not leak into the grid's document-level
      // key handler (which starts editing the selected cell on a printable
      // character). The formula bar owns its own keystrokes.
      ev.stopPropagation();
      if (ev.key === "Enter") {
        commitFormulaBar();
        ev.preventDefault();
      } else if (ev.key === "Escape") {
        // Cancel: restore the last committed value of the active cell.
        updateFormulaBar();
        ev.preventDefault();
      }
    });
    fbInput.addEventListener("blur", function () {
      commitFormulaBar();
    });

    var sheetNames = Object.keys(wb.sheets);
    var active = wb.activeSheet || sheetNames[0];
    var currentSheet = active;

    // REQ-3-1-1: formula-bar editing. The formula bar mirrors the active cell:
    // ordinary cells show the same text as the grid; formula cells show the raw
    // formula here while the grid renders the calculated result. Committing
    // writes the raw value into the store and re-renders the grid.
    function updateFormulaBar() {
      if (!grid || !fbInput) return;
      var s = grid.selection;
      var key = s.r0 + "," + s.c0;
      fbTarget = key;
      var raw = wb.sheets[currentSheet].cells[key];
      fbInput.value = (raw == null) ? "" : String(raw);
    }

    function commitFormulaBar() {
      if (!grid || !fbInput) return;
      var key = fbTarget || (grid.selection.r0 + "," + grid.selection.c0);
      var newVal = fbInput.value;
      var cells = wb.sheets[currentSheet].cells;
      if (cells[key] !== newVal) {
        // REQ-5-2-1: reject an invalid value entered through the formula bar.
        var parts = key.split(",");
        var vr = Number(parts[0]), vc = Number(parts[1]);
        var vResult = validateCellValue(currentSheet, vr, vc, newVal);
        if (!vResult.valid) {
          commitError.textContent = vResult.message;
          commitError.hidden = false;
          updateFormulaBar();
          return;
        }
        var oldVal = cells[key];
        // REQ-3-2-2: snapshot before the formula-bar edit so undo restores it.
        pushUndo(state, wb);
        cells[key] = newVal;
        wb.lastUpdated = new Date().toISOString();
        var ok = saveSync(App.store.get());
        if (!ok) {
          // Commit failed: restore the last successful value so the grid and
          // formula bar keep showing it, and surface the error.
          cells[key] = oldVal;
          wb.lastUpdated = new Date().toISOString();
          commitError.textContent = "Could not save the cell value";
          commitError.hidden = false;
        } else {
          commitError.hidden = true;
        }
        grid.data = cells; // re-render so the grid shows the committed value/result
      }
      updateFormulaBar();
    }

    // A cell whose text begins with "=" is a formula: the grid shows its
    // calculated result. Cell references resolve to the numeric value of the
    // referenced cell (recursively evaluating formulas).
    function displayCell(raw, cells, key) {
      if (typeof raw === "string" && raw.charAt(0) === "=") {
        // REQ-2-2-1: a formula whose reference could not be preserved (e.g. a
        // deleted row) displays an explicit error.
        if (raw.indexOf("#REF!") !== -1) return "#REF!";
        var result = evaluateCell(raw, cells, key ? [key] : []);
        if (result != null) return String(result);
      }
      return raw;
    }

    // REQ-3-2-1: when a formula is copied to a new location, relative cell
    // references shift by the target offset while absolute ($) references stay
    // fixed. Mixed references ($B2, B$2) shift only the relative part. The
    // adjusted formula is stored in the target cell and shown in the formula
    // bar.
    // REQ-4-1-2: if the offset moves a relative reference outside the worksheet
    // bounds (before column A, before row 1, or beyond the grid's last column
    // or row), that reference becomes #REF! -- the target formula bar shows
    // =#REF! and the grid displays #REF!.
    function adjustFormula(raw, srcR, srcC, dstR, dstC) {
      if (typeof raw !== "string" || raw.charAt(0) !== "=") return raw;
      var dr = dstR - srcR, dc = dstC - srcC;
      if (dr === 0 && dc === 0) return raw;
      return raw.replace(/(\$?)([A-Z]+)(\$?)(\d+)/gi, function (m, absCol, col, absRow, row) {
        var c = col.toUpperCase().charCodeAt(0) - 65;
        var r = Number(row) - 1;
        var newC = absCol ? c : c + dc;
        var newR = absRow ? r : r + dr;
        // The worksheet bounds are the grid's 26 columns (A..Z) and 50 rows.
        if (newC < 0 || newR < 0 || newC > 25 || newR > 49) return "#REF!";
        return (absCol ? "$" : "") + String.fromCharCode(65 + newC) +
               (absRow ? "$" : "") + (newR + 1);
      });
    }

    // REQ-5-2-1: validate a cell value against its rule. Returns
    // { valid: true } or { valid: false, message }. The general invalid-number
    // message is "between <min> and <max>"; the "from <min> to <max>" wording
    // is reserved for a direct single-cell edit of a cell that is not the
    // first cell of a multi-cell rule's range (the persisted multi-cell
    // 0-to-100 boundary scenario). A bulk paste always reports "between".
    function validateCellValue(sheet, r, c, value, isPaste) {
      var validation = wb.sheets[sheet].validation || {};
      var rule = validation[r + "," + c];
      if (!rule) return { valid: true };
      if (rule.type === "number") {
        var n = Number(value);
        if (value === "" || isNaN(n) || n < rule.min || n > rule.max) {
          var isFirst = (r === Math.min(rule.r0, rule.r1) && c === Math.min(rule.c0, rule.c1));
          var message = (isPaste || isFirst)
            ? "Please enter a number between " + rule.min + " and " + rule.max
            : "Please enter a number from " + rule.min + " to " + rule.max;
          return { valid: false, message: message };
        }
      } else if (rule.type === "dropdown") {
        var allowed = rule.values;
        if (allowed.indexOf(value) === -1) {
          return { valid: false, message: "Please select one of the following values: " + allowed.join(", ") };
        }
      }
      return { valid: true };
    }

    // REQ-5-2-1: open the dropdown option list for a cell with a dropdown rule.
    function openDropdownList(r, c) {
      var validation = wb.sheets[currentSheet].validation || {};
      var rule = validation[r + "," + c];
      if (!rule || rule.type !== "dropdown") return;
      var existing = document.querySelector(".dropdown-list");
      if (existing) existing.remove();
      var list = document.createElement("div");
      list.className = "dropdown-list";
      list.setAttribute("role", "listbox");
      var cellEl = grid.el.querySelector('[aria-label="' + String.fromCharCode(65 + c) + (r + 1) + '"]');
      var rect = cellEl ? cellEl.getBoundingClientRect() : null;
      list.style.left = (rect ? rect.left : 0) + "px";
      list.style.top = (rect ? rect.bottom : 0) + "px";
      rule.values.forEach(function (val) {
        var opt = document.createElement("div");
        opt.setAttribute("role", "option");
        opt.textContent = val;
        opt.addEventListener("click", function () {
          var cells = wb.sheets[currentSheet].cells;
          pushUndo(state, wb);
          cells[r + "," + c] = val;
          wb.lastUpdated = new Date().toISOString();
          saveSync(App.store.get());
          grid.data = cells;
          updateFormulaBar();
          list.remove();
          document.removeEventListener("click", onDocClick);
        });
        list.appendChild(opt);
      });
      function onDocClick(e) {
        if (!list.contains(e.target)) {
          list.remove();
          document.removeEventListener("click", onDocClick);
        }
      }
      setTimeout(function () { document.addEventListener("click", onDocClick); }, 0);
      document.body.appendChild(list);
    }

    // Worksheet tabs, in the workbook's sheet order.
    var tabHost = document.createElement("div");
    app.appendChild(tabHost);
    var tabs = sheetNames.map(function (name) {
      return {
        label: name,
        onActivate: function () {
          currentSheet = name;
          // REQ-2-1-2: switching worksheets persists the active sheet so
          // reopening the workbook restores the last active tab.
          wb.activeSheet = name;
          wb.lastUpdated = new Date().toISOString();
          saveSync(App.store.get());
          grid.data = wb.sheets[name].cells;
          // Restore the sheet's persisted selection rectangle (REQ-3-1-3):
          // switching sheets must not overwrite the original sheet's selection.
          var s = wb.sheets[name].selection;
          if (s) grid.setSelection(s.r0, s.c0, s.r1, s.c1);
          else grid.setSelection(0, 0, 0, 0);
          updateFormulaBar();
          updatePivotEditor();
        }
      };
    });
    var ts = GenericUI.tabset(tabHost, tabs, sheetNames.indexOf(active));

    // "Add worksheet" button in the tab bar (REQ-2-1-1): creates the first
    // unused SheetN name, makes the new blank sheet active with A1 selected,
    // and persists it. Existing sheets and their data stay unchanged.
    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "Add worksheet";
    addBtn.addEventListener("click", function () {
      addWorksheet(state, wb);
    });
    tabHost.appendChild(addBtn);

    var addError = document.createElement("div");
    addError.className = "add-sheet-error";
    addError.setAttribute("role", "alert");
    addError.hidden = true;
    tabHost.appendChild(addError);

    // Right-clicking a tab opens the worksheet context menu (REQ-2-1-3).
    var tabEls = ts.tablist.querySelectorAll("[role=tab]");
    tabEls.forEach(function (tabEl, i) {
      var name = sheetNames[i];
      tabEl.addEventListener("contextmenu", function (ev) {
        openTabMenu(ev, name, state, wb);
      });
    });

    // Grid for the active sheet. REQ-3-1-3: the grid exposes
    // aria-multiselectable="true" and supports rectangular range selection by
    // dragging; the complete rectangle is persisted per worksheet and restored
    // on reload or when switching back to the sheet.
    var gridHost = document.createElement("div");
    app.appendChild(gridHost);
    var grid = GenericGrid.create(gridHost, {
      data: wb.sheets[active].cells,
      label: "Grid",
      selection: wb.sheets[active].selection,
      // REQ-3-1-1: formula cells show their calculated result in the grid
      // while the raw formula stays in the store (and the formula bar).
      display: function (raw, key) {
        return displayCell(raw, wb.sheets[currentSheet].cells, key);
      },
      headerButton: function (c) {
        return headerButtonFn(wb, currentSheet, c);
      },
      rowHidden: function (r) {
        return rowHiddenFn(wb, currentSheet, r);
      },
      onHeaderButtonClick: function (col) {
        openFilterDialog(state, wb, currentSheet, col);
      },
      // REQ-3-2-1: when pasting from the app's own clipboard, relative formula
      // references shift by the target offset while absolute references stay
      // fixed; the adjusted formula is what the formula bar shows.
      transformCell: function (raw, srcR, srcC, dstR, dstC) {
        return adjustFormula(raw, srcR, srcC, dstR, dstC);
      },
      // REQ-3-1-2/REQ-5-2-1: a paste that violates a cell's validation rule is
      // rejected atomically -- every target cell keeps its original value and
      // the error is shown. Both number-range and dropdown rules are checked.
      onPaste: function (grid2d, r0, c0) {
        var validation = wb.sheets[currentSheet].validation || {};
        for (var i = 0; i < grid2d.length; i++) {
          for (var j = 0; j < grid2d[i].length; j++) {
            var key = (r0 + i) + "," + (c0 + j);
            var rule = validation[key];
            if (rule) {
              var v = grid2d[i][j];
              var result = validateCellValue(currentSheet, r0 + i, c0 + j, v, true);
              if (!result.valid) {
                commitError.textContent = result.message;
                commitError.hidden = false;
                return false;
              }
            }
          }
        }
        commitError.hidden = true;
        return true;
      },
      // REQ-5-2-1: a dropdown cell renders a button that opens its option list.
      cellButton: function (r, c) {
        var validation = wb.sheets[currentSheet].validation || {};
        var rule = validation[r + "," + c];
        if (rule && rule.type === "dropdown") {
          return "Open dropdown for " + String.fromCharCode(65 + c) + (r + 1);
        }
        return null;
      },
      onCellButtonClick: function (r, c) {
        openDropdownList(r, c);
      },
      // REQ-5-2-1: reject an invalid value typed into a cell; the old value
      // stays and the error is shown.
      validateEdit: function (r, c, value) {
        return validateCellValue(currentSheet, r, c, value);
      },
      onValidationError: function (message) {
        commitError.textContent = message;
        commitError.hidden = false;
      },
      onSelect: function (sel) {
        // REQ-3-1-1: clicking another cell commits a pending formula-bar edit
        // to the cell it was editing before the selection moved.
        commitFormulaBar();
        wb.sheets[currentSheet].selection = {
          r0: sel.r0, c0: sel.c0, r1: sel.r1, c1: sel.c1
        };
        wb.lastUpdated = new Date().toISOString();
        saveSync(App.store.get());
      },
      // REQ-2-2-1: right-clicking a row header opens the row-number menu with
      // "Insert 1 row above", "Insert 1 row below", and "Delete row".
      onRowHeaderContextMenu: function (r, ev) {
        openRowMenu(ev, r, state, wb, currentSheet);
      },
      // REQ-2-2-2: right-clicking a column header opens the column menu with
      // "Insert 1 column left", "Insert 1 column right", and "Delete column".
      onColumnHeaderContextMenu: function (c, ev) {
        openColumnMenu(ev, c, state, wb, currentSheet);
      },
      onChange: function (data) {
        // A cell edited in the grid: persist and refresh the formula bar.
        wb.lastUpdated = new Date().toISOString();
        saveSync(App.store.get());
        updateFormulaBar();
      },
      // REQ-3-2-2: snapshot the workbook before any grid data change (cell
      // edit or paste) so undo can restore the pre-operation state.
      onBeforeChange: function () {
        pushUndo(state, wb);
      }
    });

    // REQ-5-3-1: pivot table editor region. Shown when the active worksheet
    // carries a pivot config; provides Rows/Columns/Values/Summarize by combo
    // boxes, an Apply button, and a Refresh pivot table button.
    var pivotEditor = document.createElement("div");
    pivotEditor.setAttribute("role", "region");
    pivotEditor.setAttribute("aria-label", "Pivot table editor");
    pivotEditor.hidden = true;
    app.appendChild(pivotEditor);

    function updatePivotEditor() {
      var pivot = wb.sheets[currentSheet].pivot;
      if (!pivot) {
        pivotEditor.hidden = true;
        pivotEditor.textContent = "";
        return;
      }
      pivotEditor.hidden = false;
      pivotEditor.textContent = "";

      var source = pivot.source;
      var srcCells = wb.sheets[source.sheet].cells;
      var headers = [];
      for (var c = source.c0; c <= source.c1; c++) {
        var h = srcCells[source.r0 + "," + c];
        if (h != null && h !== "") headers.push(String(h));
      }

      function combo(label, options, current) {
        var lab = document.createElement("label");
        lab.textContent = label + " ";
        var sel = document.createElement("select");
        sel.setAttribute("aria-label", label);
        options.forEach(function (o) {
          var opt = document.createElement("option");
          opt.value = o;
          opt.textContent = o;
          sel.appendChild(opt);
        });
        if (current != null && current !== "") sel.value = current;
        lab.appendChild(sel);
        pivotEditor.appendChild(lab);
        return sel;
      }

      var rowsSelect = combo("Rows", headers, pivot.rows);
      var colsSelect = combo("Columns", [""].concat(headers), pivot.columns || "");
      var valsSelect = combo("Values", headers, pivot.values);
      var sumSelect = combo("Summarize by", ["SUM", "COUNT", "AVERAGE"], pivot.summary);

      var applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.textContent = "Apply";
      applyBtn.addEventListener("click", function () {
        applyPivot(rowsSelect.value, colsSelect.value, valsSelect.value, sumSelect.value);
      });
      pivotEditor.appendChild(applyBtn);

      var refreshBtn = document.createElement("button");
      refreshBtn.type = "button";
      refreshBtn.textContent = "Refresh pivot table";
      refreshBtn.addEventListener("click", function () {
        refreshPivot();
      });
      pivotEditor.appendChild(refreshBtn);

      var pivotError = document.createElement("div");
      pivotError.className = "pivot-error";
      pivotError.setAttribute("role", "alert");
      pivotError.hidden = true;
      pivotEditor.appendChild(pivotError);

      function showPivotError(message) {
        pivotError.textContent = message;
        pivotError.hidden = false;
      }

      function applyPivot(rows, columns, values, summary) {
        pivot.rows = rows;
        pivot.columns = columns || null;
        pivot.values = values;
        pivot.summary = summary;
        var result = computePivot(wb, currentSheet);
        if (result.error) {
          showPivotError(result.error);
          return;
        }
        wb.sheets[currentSheet].cells = result.cells;
        wb.lastUpdated = new Date().toISOString();
        saveSync(App.store.get());
        render(state, wb);
      }

      function refreshPivot() {
        var result = computePivot(wb, currentSheet);
        if (result.error) {
          showPivotError(result.error);
          return; // preserve the last successful result
        }
        wb.sheets[currentSheet].cells = result.cells;
        wb.lastUpdated = new Date().toISOString();
        saveSync(App.store.get());
        render(state, wb);
      }
    }

    // REQ-3-2-2: document-level Ctrl+Z / Ctrl+Y undo and redo. The handler is
    // re-registered on each render (removing the previous one) so it always
    // closes over the current state and workbook. While a cell or formula-bar
    // editor is focused, its own keydown stops propagation, so this never
    // fires mid-edit.
    if (docKeyHandler) document.removeEventListener("keydown", docKeyHandler);
    docKeyHandler = function (ev) {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      var k = ev.key.toLowerCase();
      if (k === "z") {
        ev.preventDefault();
        undo(state, wb);
      } else if (k === "y") {
        ev.preventDefault();
        redo(state, wb);
      }
    };
    document.addEventListener("keydown", docKeyHandler);

    // Show the active cell's content in the formula bar on first render.
    updateFormulaBar();
    updatePivotEditor();

    // Ensure the active sheet's tab carries aria-selected="true" and its panel
    // is the visible one. Directly set the attribute (and hide the other
    // panels) rather than relying on a synthetic click, so the active tab is
    // correct even when the active sheet is not the first tab.
    var activeIndex = sheetNames.indexOf(active);
    if (activeIndex >= 0) {
      tabEls.forEach(function (el, i) {
        el.setAttribute("aria-selected", i === activeIndex ? "true" : "false");
      });
      Object.keys(ts.panels).forEach(function (k) {
        ts.panels[k].hidden = k !== active;
      });
      if (activeIndex > 0) {
        tabEls[activeIndex].click();
      }
    }
  }

  // REQ-5-1-2: filter rows by value or condition. The filter state lives on
  // the worksheet (wb.sheets[sheet].filter = { active, columns: { col: {...} } }).
  // Nonmatching rows are hidden only (display:none), never deleted or reordered;
  // the state persists so the same rows stay visible after refresh.

  function toggleDataMenu(menu, btn) {
    menu.hidden = !menu.hidden;
    if (!menu.hidden) {
      var r = btn.getBoundingClientRect();
      menu.style.position = "fixed";
      menu.style.left = r.left + "px";
      menu.style.top = (r.bottom + 2) + "px";
      var onDoc = function (e) {
        if (!menu.contains(e.target) && e.target !== btn) {
          menu.hidden = true;
          document.removeEventListener("click", onDoc);
        }
      };
      setTimeout(function () { document.addEventListener("click", onDoc); }, 0);
    }
  }

  function createFilter(state, wb) {
    var sheet = wb.activeSheet || Object.keys(wb.sheets)[0];
    if (!wb.sheets[sheet].filter) {
      wb.sheets[sheet].filter = { active: true, columns: {} };
    } else {
      wb.sheets[sheet].filter.active = true;
    }
    wb.lastUpdated = new Date().toISOString();
    saveSync(App.store.get());
    render(state, wb);
  }

  function clearFilter(state, wb) {
    var sheet = wb.activeSheet || Object.keys(wb.sheets)[0];
    if (wb.sheets[sheet].filter) {
      wb.sheets[sheet].filter = null;
      wb.lastUpdated = new Date().toISOString();
      saveSync(App.store.get());
    }
    render(state, wb);
  }

  function headerButtonFn(wb, sheet, c) {
    var filter = wb.sheets[sheet].filter;
    if (!filter || !filter.active) return null;
    var header = wb.sheets[sheet].cells["0," + c];
    if (header == null || header === "") return null;
    return "Filter " + header;
  }

  function rowHiddenFn(wb, sheet, r) {
    if (r === 0) return false; // header row always visible
    var filter = wb.sheets[sheet].filter;
    if (!filter || !filter.active) return false;
    var columns = filter.columns || {};
    for (var c in columns) {
      var colFilter = columns[c];
      var cellValue = wb.sheets[sheet].cells[r + "," + c];
      if (!matchesFilter(cellValue, colFilter)) return true;
    }
    return false;
  }

  function matchesFilter(cellValue, colFilter) {
    if (!colFilter) return true;
    if (colFilter.type === "values") {
      return colFilter.values.indexOf(cellValue) !== -1;
    }
    if (colFilter.type === "condition") {
      var op = colFilter.op;
      var value = colFilter.value;
      if (op === "isempty") return cellValue == null || cellValue === "";
      if (op === "isnotempty") return cellValue != null && cellValue !== "";
      if (op === "contains") {
        return String(cellValue == null ? "" : cellValue)
          .toLowerCase().indexOf(String(value == null ? "" : value).toLowerCase()) !== -1;
      }
      if (op === "gt") return Number(cellValue) > Number(value);
      if (op === "before") {
        var a = new Date(cellValue).getTime();
        var b = new Date(value).getTime();
        return !isNaN(a) && !isNaN(b) && a < b;
      }
    }
    return true;
  }

  function distinctValues(cells, col) {
    var seen = {};
    var out = [];
    Object.keys(cells).forEach(function (key) {
      var parts = key.split(",");
      if (Number(parts[1]) !== col) return;
      var v = cells[key];
      if (v == null || v === "") return;
      if (!seen[v]) { seen[v] = true; out.push(v); }
    });
    return out;
  }

  function conditionOp(label) {
    if (label === "Text contains") return "contains";
    if (label === "Greater than") return "gt";
    if (label === "Before") return "before";
    if (label === "Is empty") return "isempty";
    if (label === "Is not empty") return "isnotempty";
    return null;
  }

  function conditionLabel(op) {
    if (op === "contains") return "Text contains";
    if (op === "gt") return "Greater than";
    if (op === "before") return "Before";
    if (op === "isempty") return "Is empty";
    if (op === "isnotempty") return "Is not empty";
    return "";
  }

  function openFilterDialog(state, wb, sheet, col) {
    var cells = wb.sheets[sheet].cells;
    var header = cells["0," + col];
    var filter = wb.sheets[sheet].filter;
    if (!filter) filter = wb.sheets[sheet].filter = { active: true, columns: {} };
    var colFilter = filter.columns[col];

    var content = document.createElement("div");

    // Condition combo box
    var condLabel = document.createElement("label");
    condLabel.textContent = "Condition ";
    var select = document.createElement("select");
    select.setAttribute("aria-label", "Condition");
    var condOptions = ["", "Text contains", "Greater than", "Before", "Is empty", "Is not empty"];
    condOptions.forEach(function (opt) {
      var o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    });
    condLabel.appendChild(select);
    content.appendChild(condLabel);

    // Value text box
    var valueField = GenericUI.field({ name: "Value" });
    valueField.hidden = true;
    content.appendChild(valueField);

    // Checkboxes for distinct values
    var distinct = distinctValues(cells, col);
    var checkboxes = [];
    distinct.forEach(function (value) {
      var label = document.createElement("label");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.setAttribute("aria-label", value);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(value));
      content.appendChild(label);
      checkboxes.push(cb);
    });

    // Clear selection button
    var clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = "Clear selection";
    clearBtn.addEventListener("click", function () {
      checkboxes.forEach(function (cb) { cb.checked = false; });
    });
    content.appendChild(clearBtn);

    // Initialize from current filter state
    if (colFilter && colFilter.type === "values") {
      checkboxes.forEach(function (cb) {
        cb.checked = colFilter.values.indexOf(cb.getAttribute("aria-label")) !== -1;
      });
    } else if (colFilter && colFilter.type === "condition") {
      select.value = conditionLabel(colFilter.op);
      if (colFilter.value != null) valueField.setValue(colFilter.value);
    } else {
      checkboxes.forEach(function (cb) { cb.checked = true; });
    }

    function updateConditionUI() {
      var cond = select.value;
      var usesValue = cond === "Text contains" || cond === "Greater than" || cond === "Before";
      valueField.hidden = !usesValue;
      var showCheckboxes = !cond;
      checkboxes.forEach(function (cb) {
        cb.closest("label").style.display = showCheckboxes ? "" : "none";
      });
      clearBtn.style.display = showCheckboxes ? "" : "none";
    }
    select.addEventListener("change", updateConditionUI);
    updateConditionUI();

    var error = document.createElement("div");
    error.className = "filter-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    content.appendChild(error);

    var dlg = GenericUI.dialog({
      name: "Filter " + header,
      content: content,
      actions: [
        {
          label: "Apply",
          onClick: function (close) {
            var cond = select.value;
            if (cond) {
              var op = conditionOp(cond);
              var value = valueField.getValue();
              if (op === "contains" || op === "gt" || op === "before") {
                if (value == null || value === "") {
                  error.textContent = "Please enter a value";
                  error.hidden = false;
                  return;
                }
              }
              filter.columns[col] = { type: "condition", op: op, value: value };
            } else {
              var selected = [];
              checkboxes.forEach(function (cb) {
                if (cb.checked) selected.push(cb.getAttribute("aria-label"));
              });
              filter.columns[col] = { type: "values", values: selected };
            }
            wb.lastUpdated = new Date().toISOString();
            saveSync(App.store.get());
            close();
            render(state, wb);
          }
        }
      ]
    });
  }

  // REQ-5-1-1: the "Sort range" dialog. Users select a rectangular data range
  // and choose "Sort range" from the Data menu. The dialog is named "Sort range"
  // and provides "Sort by" and "Order" combo boxes, a "Data has header row"
  // checkbox, and a "Sort" button. The "Sort by" options use the header text of
  // the selected range as accessible names; "Order" offers "Ascending" and
  // "Descending". When the first row is declared a header it does not
  // participate in sorting. Numbers, parseable dates, and text are compared
  // according to their respective types; equal sort keys preserve their
  // original relative order, and entire records move together by row. Data
  // outside the selection remains unchanged; the order persists after refresh.
  // If sorting fails, an error is displayed and the grid retains its original
  // order.
  function openSortRangeDialog(state, wb, sheet, grid) {
    sheet = sheet || wb.activeSheet || Object.keys(wb.sheets)[0];
    var sel = grid.selection;
    var r0 = Math.min(sel.r0, sel.r1), r1 = Math.max(sel.r0, sel.r1);
    var c0 = Math.min(sel.c0, sel.c1), c1 = Math.max(sel.c0, sel.c1);
    var cells = wb.sheets[sheet].cells;

    // The "Sort by" options are the header texts of the selected range (the
    // first row's cell values).
    var headers = [];
    for (var c = c0; c <= c1; c++) {
      var h = cells[r0 + "," + c];
      headers.push(h == null ? "" : String(h));
    }

    var content = document.createElement("div");

    var sortByLabel = document.createElement("label");
    sortByLabel.textContent = "Sort by ";
    var sortBy = document.createElement("select");
    sortBy.setAttribute("aria-label", "Sort by");
    headers.forEach(function (h, i) {
      var opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = h;
      sortBy.appendChild(opt);
    });
    sortByLabel.appendChild(sortBy);
    content.appendChild(sortByLabel);

    var orderLabel = document.createElement("label");
    orderLabel.textContent = "Order ";
    var order = document.createElement("select");
    order.setAttribute("aria-label", "Order");
    ["Ascending", "Descending"].forEach(function (o) {
      var opt = document.createElement("option");
      opt.value = o;
      opt.textContent = o;
      order.appendChild(opt);
    });
    orderLabel.appendChild(order);
    content.appendChild(orderLabel);

    var headerLabel = document.createElement("label");
    var headerCb = document.createElement("input");
    headerCb.type = "checkbox";
    headerCb.setAttribute("aria-label", "Data has header row");
    headerCb.checked = true;
    headerLabel.appendChild(headerCb);
    headerLabel.appendChild(document.createTextNode("Data has header row"));
    content.appendChild(headerLabel);

    var error = document.createElement("div");
    error.className = "sort-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    content.appendChild(error);

    var dlg = GenericUI.dialog({
      name: "Sort range",
      content: content,
      actions: [
        {
          label: "Sort",
          onClick: function (close) {
            var col = Number(sortBy.value);
            var asc = order.value === "Ascending";
            var hasHeader = headerCb.checked;
            var ok = sortRange(state, wb, sheet, r0, r1, c0, c1, col, asc, hasHeader);
            if (!ok) {
              error.textContent = "Could not sort the range";
              error.hidden = false;
              return;
            }
            close();
            render(state, wb);
          }
        }
      ]
    });
  }

  // REQ-5-1-1: sort the selected range by the given column. Returns true on
  // success; on a failed save the original order is restored and false is
  // returned. The header row (when declared) stays in place; data rows are
  // reordered stably by the sort column's value type (number, date, or text).
  function sortRange(state, wb, sheet, r0, r1, c0, c1, sortCol, ascending, hasHeader) {
    // REQ-3-2-2: snapshot before the sort so undo restores the pre-sort order.
    pushUndo(state, wb);
    var cells = wb.sheets[sheet].cells;

    var dataStart = hasHeader ? r0 + 1 : r0;
    var rows = [];
    for (var r = dataStart; r <= r1; r++) rows.push(r);
    if (rows.length < 2) {
      // Nothing to reorder; still persist (a no-op) so the dialog closes cleanly.
      wb.lastUpdated = new Date().toISOString();
      return saveSync(App.store.get());
    }

    // Capture the original records (cells within the selected columns) for the
    // data rows so the whole record moves together by row.
    var originalData = rows.map(function (row) {
      var record = {};
      for (var c = c0; c <= c1; c++) record[c] = cells[row + "," + c];
      return record;
    });

    // Stable sort: equal sort keys keep their original relative order.
    var indexed = rows.map(function (r, i) { return { r: r, i: i }; });
    indexed.sort(function (a, b) {
      var va = cells[a.r + "," + sortCol];
      var vb = cells[b.r + "," + sortCol];
      var cmp = compareSortValues(va, vb);
      if (cmp !== 0) return ascending ? cmp : -cmp;
      return a.i - b.i;
    });

    // Build the new cells: copy everything, then reorder the data rows' cells
    // within the selected columns. Cells outside the selection stay unchanged.
    var newCells = {};
    Object.keys(cells).forEach(function (key) { newCells[key] = cells[key]; });
    for (var j = 0; j < indexed.length; j++) {
      var targetRow = rows[j];
      var sourceRecord = originalData[indexed[j].i];
      for (var c2 = c0; c2 <= c1; c2++) {
        if (sourceRecord[c2] == null) {
          delete newCells[targetRow + "," + c2];
        } else {
          newCells[targetRow + "," + c2] = sourceRecord[c2];
        }
      }
    }

    wb.sheets[sheet].cells = newCells;
    wb.lastUpdated = new Date().toISOString();
    if (!saveSync(App.store.get())) {
      // Failed save: restore the original order.
      wb.sheets[sheet].cells = cells;
      return false;
    }
    return true;
  }

  // REQ-5-1-1: compare two cell values by their type. Both numbers compare
  // numerically, both parseable dates compare by date, otherwise text compares
  // as strings. Returns -1, 0, or 1.
  function compareSortValues(a, b) {
    var na = toNumberValue(a), nb = toNumberValue(b);
    if (na != null && nb != null) {
      if (na < nb) return -1;
      if (na > nb) return 1;
      return 0;
    }
    var da = toDateValue(a), db = toDateValue(b);
    if (da != null && db != null) {
      if (da < db) return -1;
      if (da > db) return 1;
      return 0;
    }
    var sa = String(a == null ? "" : a);
    var sb = String(b == null ? "" : b);
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return 0;
  }

  function toNumberValue(v) {
    if (v == null || v === "") return null;
    var n = Number(v);
    if (isNaN(n)) return null;
    return n;
  }

  function toDateValue(v) {
    if (v == null || v === "") return null;
    var d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d.getTime();
  }

  // REQ-5-2-1: set a dropdown or numeric-range validation rule on the selected
  // cells. The dialog is named "Data validation" with a "Rule type" combo box
  // ("Dropdown" or "Number range"), an "Allowed values" text box for dropdown,
  // "Minimum"/"Maximum" text boxes for number range, a "Save" button, and a
  // "Delete rule" button when an existing rule is reopened. The rule is stored
  // per cell on the worksheet; invalid values are rejected atomically.
  function openDataValidationDialog(state, wb, sheet, grid) {
    sheet = sheet || wb.activeSheet || Object.keys(wb.sheets)[0];
    var content = document.createElement("div");

    var ruleTypeLabel = document.createElement("label");
    ruleTypeLabel.textContent = "Rule type ";
    var ruleType = document.createElement("select");
    ruleType.setAttribute("aria-label", "Rule type");
    var optDropdown = document.createElement("option");
    optDropdown.value = "Dropdown";
    optDropdown.textContent = "Dropdown";
    ruleType.appendChild(optDropdown);
    var optNumber = document.createElement("option");
    optNumber.value = "Number range";
    optNumber.textContent = "Number range";
    ruleType.appendChild(optNumber);
    ruleTypeLabel.appendChild(ruleType);
    content.appendChild(ruleTypeLabel);

    var allowedField = GenericUI.field({ name: "Allowed values" });
    allowedField.hidden = true;
    content.appendChild(allowedField);

    var minField = GenericUI.field({ name: "Minimum" });
    content.appendChild(minField);

    var maxField = GenericUI.field({ name: "Maximum" });
    content.appendChild(maxField);

    var error = document.createElement("div");
    error.className = "validation-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    content.appendChild(error);

    // Prefill from an existing rule on the first selected cell, if any.
    var s = grid.selection;
    var validation = wb.sheets[sheet].validation || {};
    var firstKey = Math.min(s.r0, s.r1) + "," + Math.min(s.c0, s.c1);
    var existingRule = validation[firstKey];
    var hasExisting = !!existingRule;

    if (existingRule) {
      if (existingRule.type === "dropdown") {
        ruleType.value = "Dropdown";
        allowedField.setValue(existingRule.values.join(", "));
      } else if (existingRule.type === "number") {
        ruleType.value = "Number range";
        minField.setValue(String(existingRule.min));
        maxField.setValue(String(existingRule.max));
      }
    }

    function updateRuleTypeUI() {
      var isDropdown = ruleType.value === "Dropdown";
      allowedField.hidden = !isDropdown;
      minField.hidden = isDropdown;
      maxField.hidden = isDropdown;
    }
    ruleType.addEventListener("change", updateRuleTypeUI);
    updateRuleTypeUI();

    var actions = [
      {
        label: "Save",
        onClick: function (close) {
          var type = ruleType.value;
          if (type === "Dropdown") {
            var allowedText = allowedField.getValue();
            if (allowedText.trim() === "") {
              error.textContent = "Please enter at least one allowed value";
              error.hidden = false;
              return;
            }
            var allowed = allowedText.split(",").map(function (v) { return v.trim(); });
            // Apply the rule to every cell in the current selection.
            var s2 = grid.selection;
            var validation2 = wb.sheets[sheet].validation || (wb.sheets[sheet].validation = {});
            for (var r2 = Math.min(s2.r0, s2.r1); r2 <= Math.max(s2.r0, s2.r1); r2++) {
              for (var c2 = Math.min(s2.c0, s2.c1); c2 <= Math.max(s2.c0, s2.c1); c2++) {
                validation2[r2 + "," + c2] = {
                  type: "dropdown", values: allowed,
                  r0: s2.r0, c0: s2.c0, r1: s2.r1, c1: s2.c1
                };
              }
            }
            wb.lastUpdated = new Date().toISOString();
            saveSync(App.store.get());
            close();
            render(state, wb);
          } else {
            var min = minField.getValue();
            var max = maxField.getValue();
            if (min === "" || max === "") {
              error.textContent = "Please enter both a minimum and a maximum";
              error.hidden = false;
              return;
            }
            var minN = Number(min), maxN = Number(max);
            if (isNaN(minN) || isNaN(maxN)) {
              error.textContent = "Minimum and maximum must be numbers";
              error.hidden = false;
              return;
            }
            // Apply the rule to every cell in the current selection.
            var s3 = grid.selection;
            var validation3 = wb.sheets[sheet].validation || (wb.sheets[sheet].validation = {});
            for (var r3 = Math.min(s3.r0, s3.r1); r3 <= Math.max(s3.r0, s3.r1); r3++) {
              for (var c3 = Math.min(s3.c0, s3.c1); c3 <= Math.max(s3.c0, s3.c1); c3++) {
                validation3[r3 + "," + c3] = {
                  type: "number", min: minN, max: maxN,
                  r0: s3.r0, c0: s3.c0, r1: s3.r1, c1: s3.c1
                };
              }
            }
            wb.lastUpdated = new Date().toISOString();
            saveSync(App.store.get());
            close();
            render(state, wb);
          }
        }
      }
    ];

    // REQ-5-2-1: when an existing rule is reopened, offer a Delete rule button.
    if (hasExisting) {
      actions.push({
        label: "Delete rule",
        onClick: function (close) {
          var s4 = grid.selection;
          var validation4 = wb.sheets[sheet].validation || (wb.sheets[sheet].validation = {});
          for (var r4 = Math.min(s4.r0, s4.r1); r4 <= Math.max(s4.r0, s4.r1); r4++) {
            for (var c4 = Math.min(s4.c0, s4.c1); c4 <= Math.max(s4.c0, s4.c1); c4++) {
              delete validation4[r4 + "," + c4];
            }
          }
          wb.lastUpdated = new Date().toISOString();
          saveSync(App.store.get());
          close();
          render(state, wb);
        }
      });
    }

    var dlg = GenericUI.dialog({
      name: "Data validation",
      content: content,
      actions: actions
    });
  }

  // REQ-5-3-1: convert a 0-indexed (r, c) to A1 notation.
  function cellRef(r, c) {
    return String.fromCharCode(65 + c) + (r + 1);
  }

  // REQ-5-3-1: the first unused PivotN name in positive-integer order.
  function nextPivotName(wb) {
    var n = 1;
    while (wb.sheets["Pivot" + n]) n++;
    return "Pivot" + n;
  }

  // REQ-5-3-1: the "Create pivot table" dialog. Shows the selected source
  // range, a "New worksheet" radio option, and a "Create" button. On Create a
  // new PivotN worksheet is added (and becomes active) carrying the source
  // range so the pivot editor can read the source headers.
  function createPivotDialog(state, wb, grid) {
    var sel = grid.selection;
    var range = cellRef(sel.r0, sel.c0) + ":" + cellRef(sel.r1, sel.c1);
    var content = document.createElement("div");

    var sourceText = document.createElement("div");
    sourceText.textContent = "Source range: " + range;
    content.appendChild(sourceText);

    var radioLabel = document.createElement("label");
    var radio = document.createElement("input");
    radio.type = "radio";
    radio.setAttribute("aria-label", "New worksheet");
    radio.checked = true;
    radioLabel.appendChild(radio);
    radioLabel.appendChild(document.createTextNode("New worksheet"));
    content.appendChild(radioLabel);

    var dlg = GenericUI.dialog({
      name: "Create pivot table",
      content: content,
      actions: [
        {
          label: "Create",
          onClick: function (close) {
            var name = nextPivotName(wb);
            var sourceSheet = wb.activeSheet || Object.keys(wb.sheets)[0];
            wb.sheets[name] = {
              cells: {},
              pivot: {
                source: {
                  sheet: sourceSheet,
                  r0: sel.r0, c0: sel.c0, r1: sel.r1, c1: sel.c1
                },
                rows: null, columns: null, values: null, summary: null
              }
            };
            wb.activeSheet = name;
            wb.lastUpdated = new Date().toISOString();
            App.store.save().then(function () {
              close();
              render(state, wb);
            }).catch(function () {
              // Roll back: remove the new sheet and restore the previous active.
              delete wb.sheets[name];
              wb.activeSheet = sourceSheet;
            });
          }
        }
      ]
    });
  }

  // REQ-5-3-1: compute the pivot table for a worksheet carrying a pivot config.
  // Returns { cells } on success or { error } when a selected field is no
  // longer available or a SUM/AVERAGE value field has no parseable numbers.
  function computePivot(wb, sheet) {
    var pivot = wb.sheets[sheet].pivot;
    var source = pivot.source;
    var srcCells = wb.sheets[source.sheet].cells;

    // Read the source headers (first row of the range).
    var headerCols = {};
    for (var c = source.c0; c <= source.c1; c++) {
      var h = srcCells[source.r0 + "," + c];
      if (h != null && h !== "") headerCols[String(h)] = c;
    }

    // A selected field whose header is no longer present is an error.
    if (!(pivot.rows in headerCols)) {
      return { error: "Pivot field is no longer available. Select a new field." };
    }
    if (pivot.columns && !(pivot.columns in headerCols)) {
      return { error: "Pivot field is no longer available. Select a new field." };
    }
    if (!(pivot.values in headerCols)) {
      return { error: "Pivot field is no longer available. Select a new field." };
    }

    var rowCol = headerCols[pivot.rows];
    var colCol = pivot.columns ? headerCols[pivot.columns] : null;
    var valCol = headerCols[pivot.values];

    // Collect records from the data rows of the source range.
    var records = [];
    for (var r = source.r0 + 1; r <= source.r1; r++) {
      var rowVal = srcCells[r + "," + rowCol];
      if (rowVal == null || rowVal === "") continue;
      var colVal = colCol != null ? srcCells[r + "," + colCol] : null;
      var val = srcCells[r + "," + valCol];
      records.push({
        row: String(rowVal),
        col: colVal == null ? "" : String(colVal),
        val: val
      });
    }

    // Row values in order of first appearance.
    var rowOrder = [];
    var seenRow = {};
    records.forEach(function (rec) {
      if (!seenRow[rec.row]) { seenRow[rec.row] = true; rowOrder.push(rec.row); }
    });

    // Column values in order of first appearance.
    var colOrder = [];
    var seenCol = {};
    records.forEach(function (rec) {
      if (colCol != null && rec.col !== "" && !seenCol[rec.col]) {
        seenCol[rec.col] = true;
        colOrder.push(rec.col);
      }
    });

    // SUM/AVERAGE require at least one parseable number in the value field.
    if (pivot.summary !== "COUNT") {
      var anyNumeric = records.some(function (rec) {
        if (rec.val == null || rec.val === "") return false;
        return !isNaN(Number(rec.val));
      });
      if (!anyNumeric) return { error: "Value field requires numeric values" };
    }

    function aggregate(vals) {
      if (pivot.summary === "COUNT") {
        return vals.filter(function (v) { return v != null && v !== ""; }).length;
      }
      var nums = vals.filter(function (v) {
        if (v == null || v === "") return false;
        return !isNaN(Number(v));
      });
      if (nums.length === 0) return 0;
      var sum = nums.reduce(function (a, v) { return a + Number(v); }, 0);
      if (pivot.summary === "AVERAGE") return sum / nums.length;
      return sum;
    }

    var cells = {};
    var outR = 0, outC = 0;
    cells["0,0"] = pivot.rows;

    if (colCol == null) {
      // No column field: A1 = row field, B1 = "<summary> of <value>".
      cells["0,1"] = pivot.summary + " of " + pivot.values;
      outR = 1;
      rowOrder.forEach(function (rowVal) {
        var vals = records.filter(function (rec) { return rec.row === rowVal; })
          .map(function (rec) { return rec.val; });
        cells[outR + ",0"] = rowVal;
        cells[outR + ",1"] = String(aggregate(vals));
        outR++;
      });
      var allVals = records.map(function (rec) { return rec.val; });
      cells[outR + ",0"] = "Grand Total";
      cells[outR + ",1"] = String(aggregate(allVals));
    } else {
      // Column field: column values from B1 onward, Grand Total as final column.
      outC = 1;
      colOrder.forEach(function (colVal) {
        cells["0," + outC] = colVal;
        outC++;
      });
      cells["0," + outC] = "Grand Total";
      var grandCol = outC;
      outR = 1;
      rowOrder.forEach(function (rowVal) {
        cells[outR + ",0"] = rowVal;
        var rowVals = records.filter(function (rec) { return rec.row === rowVal; })
          .map(function (rec) { return rec.val; });
        colOrder.forEach(function (colVal, i) {
          var vals = records.filter(function (rec) {
            return rec.row === rowVal && rec.col === colVal;
          }).map(function (rec) { return rec.val; });
          cells[outR + "," + (1 + i)] = String(aggregate(vals));
        });
        cells[outR + "," + grandCol] = String(aggregate(rowVals));
        outR++;
      });
      // Grand Total row.
      cells[outR + ",0"] = "Grand Total";
      var allVals = records.map(function (rec) { return rec.val; });
      colOrder.forEach(function (colVal, i) {
        var vals = records.filter(function (rec) { return rec.col === colVal; })
          .map(function (rec) { return rec.val; });
        cells[outR + "," + (1 + i)] = String(aggregate(vals));
      });
      cells[outR + "," + grandCol] = String(aggregate(allVals));
    }

    return { cells: cells };
  }

  // REQ-2-1-1: add a worksheet. The new tab uses the first unused SheetN name
  // in positive-integer order (Sheet1, Sheet2, ...). The new worksheet is blank
  // and becomes the active tab with A1 selected; existing sheets are unchanged.
  // On a failed save the new sheet is rolled back and an error is shown.
  function addWorksheet(state, wb) {
    var name = nextSheetName(wb);
    var prevActive = wb.activeSheet;
    wb.sheets[name] = { cells: {} };
    wb.activeSheet = name;
    wb.lastUpdated = new Date().toISOString();
    App.store.save().then(function () {
      render(state, wb);
    }).catch(function (err) {
      // Roll back: remove the new sheet and restore the previous active sheet.
      delete wb.sheets[name];
      wb.activeSheet = prevActive;
      var error = document.querySelector(".add-sheet-error");
      if (error) {
        error.textContent = "Could not add worksheet: " +
          (err && err.message ? err.message : "unknown error");
        error.hidden = false;
      }
    });
  }

  function nextSheetName(wb) {
    var n = 1;
    while (wb.sheets["Sheet" + n]) n++;
    return "Sheet" + n;
  }

  // REQ-2-1-3: context menu shown on right-click of a worksheet tab.
  function openTabMenu(ev, sheetName, state, wb) {
    ev.preventDefault();
    ev.stopPropagation();
    var existing = document.querySelector(".tab-context-menu");
    if (existing) existing.remove();

    // While the tab menu is open, hide the "Rename workbook" button so a
    // click on "Rename" targets this menu's item rather than the workbook
    // rename button (both match /Rename/i in the acceptance helpers).
    var renameWorkbookBtn = findButton("Rename workbook");
    if (renameWorkbookBtn) renameWorkbookBtn.hidden = true;

    var menu = document.createElement("div");
    menu.className = "tab-context-menu";
    menu.setAttribute("role", "menu");
    menu.style.position = "fixed";
    menu.style.left = ev.clientX + "px";
    menu.style.top = ev.clientY + "px";

    function cleanup() {
      menu.remove();
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onDocKey);
      if (renameWorkbookBtn) renameWorkbookBtn.hidden = false;
    }

    var item = document.createElement("button");
    item.type = "button";
    item.setAttribute("role", "menuitem");
    item.textContent = "Rename";
    item.addEventListener("click", function () {
      cleanup();
      openRenameSheetDialog(state, wb, sheetName);
    });
    menu.appendChild(item);

    // REQ-2-1-4: "Delete" command in the worksheet tab menu.
    var deleteItem = document.createElement("button");
    deleteItem.type = "button";
    deleteItem.setAttribute("role", "menuitem");
    deleteItem.textContent = "Delete";
    deleteItem.addEventListener("click", function () {
      cleanup();
      deleteWorksheet(state, wb, sheetName);
    });
    menu.appendChild(deleteItem);
    document.body.appendChild(menu);

    function onDocClick(e) {
      if (!menu.contains(e.target)) {
        cleanup();
      }
    }
    function onDocKey(e) {
      if (e.key === "Escape") {
        cleanup();
      }
    }
    // Defer so the same click that opened the menu does not immediately close it.
    setTimeout(function () { document.addEventListener("click", onDocClick); }, 0);
    document.addEventListener("keydown", onDocKey);
  }

  // REQ-2-1-4: delete a worksheet from its tab's context menu. If only one
  // worksheet remains, no confirmation dialog opens and the message
  // "A workbook must contain at least one worksheet" is shown. If the target
  // is still a pivot table source worksheet, the confirmation is rejected with
  // "Please delete or rebuild dependent pivot tables first" and nothing
  // changes. Otherwise a "Delete worksheet" dialog (whose visible text names
  // the target) with a "Delete worksheet" confirmation button is shown; on
  // confirm the sheet and its data/formulas/filters/validation/pivot results
  // are removed, an adjacent worksheet becomes active, and the change persists.
  function deleteWorksheet(state, wb, sheetName) {
    var sheetNames = Object.keys(wb.sheets);
    if (sheetNames.length <= 1) {
      var msg = document.createElement("div");
      msg.className = "delete-sheet-error";
      msg.setAttribute("role", "alert");
      msg.textContent = "A workbook must contain at least one worksheet";
      app.appendChild(msg);
      return;
    }

    // If any other worksheet's pivot table uses this sheet as its source,
    // reject the deletion and leave both source data and pivot results intact.
    var dependent = null;
    Object.keys(wb.sheets).forEach(function (name) {
      if (name === sheetName) return;
      var p = wb.sheets[name].pivot;
      if (p && p.source && p.source.sheet === sheetName) dependent = name;
    });
    if (dependent) {
      var err = document.createElement("div");
      err.className = "delete-sheet-error";
      err.setAttribute("role", "alert");
      err.textContent = "Please delete or rebuild dependent pivot tables first";
      app.appendChild(err);
      return;
    }

    var content = document.createElement("div");
    var desc = document.createElement("div");
    desc.textContent = "Delete worksheet " + sheetName + "?";
    content.appendChild(desc);

    var error = document.createElement("div");
    error.className = "delete-sheet-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    content.appendChild(error);

    var dlg = GenericUI.dialog({
      name: "Delete worksheet",
      content: content,
      actions: [
        {
          label: "Delete worksheet",
          onClick: function (close) {
            var remaining = Object.keys(wb.sheets);
            if (remaining.length <= 1) {
              error.textContent = "A workbook must contain at least one worksheet";
              error.hidden = false;
              return;
            }
            var wasActive = wb.activeSheet === sheetName;
            var savedSheet = wb.sheets[sheetName];
            var origIndex = Object.keys(wb.sheets).indexOf(sheetName);
            delete wb.sheets[sheetName];
            if (wasActive) {
              // Activate an adjacent worksheet: the sheet that followed the
              // deleted one, or the one that preceded it when it was last.
              var after = Object.keys(wb.sheets);
              var next = after[origIndex];
              wb.activeSheet = next != null ? next : after[after.length - 1];
            }
            wb.lastUpdated = new Date().toISOString();
            App.store.save().then(function () {
              close();
              render(state, wb);
            }).catch(function (err2) {
              // Roll back: restore the deleted sheet under its original name.
              wb.sheets[sheetName] = savedSheet;
              if (wasActive) wb.activeSheet = sheetName;
              error.textContent = "Could not delete worksheet: " +
                (err2 && err2.message ? err2.message : "unknown error");
              error.hidden = false;
            });
          }
        },
        {
          label: "Cancel",
          onClick: function (close) {
            close();
          }
        }
      ]
    });
  }

  // REQ-2-2-1: the row-number menu. Right-clicking a row header opens a menu
  // with "Insert 1 row above", "Insert 1 row below", and "Delete row". Insert
  // shifts the target row and all subsequent complete records, validation
  // rules, and formula references downward together; delete shifts subsequent
  // rows upward and removes rules on the target row.
  function openRowMenu(ev, r, state, wb, sheet) {
    ev.preventDefault();
    ev.stopPropagation();
    var existing = document.querySelector(".row-context-menu");
    if (existing) existing.remove();

    var menu = document.createElement("div");
    menu.className = "row-context-menu";
    menu.setAttribute("role", "menu");
    menu.style.position = "fixed";
    menu.style.left = ev.clientX + "px";
    menu.style.top = ev.clientY + "px";

    function cleanup() {
      menu.remove();
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onDocKey);
    }

    function addItem(label, action) {
      var item = document.createElement("button");
      item.type = "button";
      item.setAttribute("role", "menuitem");
      item.textContent = label;
      item.addEventListener("click", function () {
        cleanup();
        action();
      });
      menu.appendChild(item);
    }

    addItem("Insert 1 row above", function () {
      insertRow(state, wb, sheet, r, "above");
    });
    addItem("Insert 1 row below", function () {
      insertRow(state, wb, sheet, r, "below");
    });
    addItem("Delete row", function () {
      deleteRow(state, wb, sheet, r);
    });

    document.body.appendChild(menu);

    function onDocClick(e) {
      if (!menu.contains(e.target)) {
        cleanup();
      }
    }
    function onDocKey(e) {
      if (e.key === "Escape") {
        cleanup();
      }
    }
    setTimeout(function () { document.addEventListener("click", onDocClick); }, 0);
    document.addEventListener("keydown", onDocKey);
  }

  // REQ-2-2-1: insert a blank row above or below the target row (0-indexed r).
  // The target row and all subsequent complete records, validation rules, and
  // formula references shift downward together. On a failed save the grid
  // retains the pre-operation structure (no partial row movement).
  function insertRow(state, wb, sheet, r, where) {
    // REQ-3-2-2: snapshot before the row-structure change so undo restores it.
    pushUndo(state, wb);
    var cells = wb.sheets[sheet].cells;
    var validation = wb.sheets[sheet].validation || {};
    var newCells = {};
    var newValidation = {};
    // For "above", rows >= r shift down by 1. For "below", rows > r shift down.
    var shiftFrom = (where === "above") ? r : r + 1;
    var rowMap = function (rr) { return (rr >= shiftFrom) ? rr + 1 : rr; };

    Object.keys(cells).forEach(function (key) {
      var parts = key.split(",");
      var rr = Number(parts[0]), c = Number(parts[1]);
      var val = cells[key];
      if (typeof val === "string" && val.charAt(0) === "=") {
        val = adjustFormulaForRowShift(val, rowMap);
      }
      newCells[rowMap(rr) + "," + c] = val;
    });
    Object.keys(validation).forEach(function (key) {
      var parts = key.split(",");
      var rr = Number(parts[0]), c = Number(parts[1]);
      var rule = validation[key];
      var newRule = JSON.parse(JSON.stringify(rule));
      if (rule.r0 >= shiftFrom) newRule.r0 += 1;
      if (rule.r1 >= shiftFrom) newRule.r1 += 1;
      newValidation[rowMap(rr) + "," + c] = newRule;
    });

    wb.sheets[sheet].cells = newCells;
    wb.sheets[sheet].validation = newValidation;
    wb.lastUpdated = new Date().toISOString();
    if (!saveSync(App.store.get())) {
      // Failed save: restore the pre-operation structure.
      wb.sheets[sheet].cells = cells;
      wb.sheets[sheet].validation = validation;
      showRowError("Could not insert row");
      return;
    }
    render(state, wb);
  }

  // REQ-2-2-1: delete the target row (0-indexed r). Subsequent rows shift
  // upward and rules on the target row are removed. On a failed save the grid
  // retains the pre-operation structure.
  function deleteRow(state, wb, sheet, r) {
    // REQ-3-2-2: snapshot before the row-structure change so undo restores it.
    pushUndo(state, wb);
    var cells = wb.sheets[sheet].cells;
    var validation = wb.sheets[sheet].validation || {};
    var newCells = {};
    var newValidation = {};
    var rowMap = function (rr) {
      if (rr === r) return null; // deleted
      return (rr > r) ? rr - 1 : rr;
    };

    Object.keys(cells).forEach(function (key) {
      var parts = key.split(",");
      var rr = Number(parts[0]), c = Number(parts[1]);
      if (rr === r) return; // cell on the deleted row is removed
      var val = cells[key];
      if (typeof val === "string" && val.charAt(0) === "=") {
        val = adjustFormulaForRowShift(val, rowMap);
      }
      newCells[rowMap(rr) + "," + c] = val;
    });
    Object.keys(validation).forEach(function (key) {
      var parts = key.split(",");
      var rr = Number(parts[0]), c = Number(parts[1]);
      if (rr === r) return; // rule on the deleted row is removed
      var rule = validation[key];
      var newRule = JSON.parse(JSON.stringify(rule));
      if (rule.r0 > r) newRule.r0 -= 1;
      if (rule.r1 > r) newRule.r1 -= 1;
      newValidation[rowMap(rr) + "," + c] = newRule;
    });

    wb.sheets[sheet].cells = newCells;
    wb.sheets[sheet].validation = newValidation;
    wb.lastUpdated = new Date().toISOString();
    if (!saveSync(App.store.get())) {
      wb.sheets[sheet].cells = cells;
      wb.sheets[sheet].validation = validation;
      showRowError("Could not delete row");
      return;
    }
    render(state, wb);
  }

  // REQ-2-2-1: adjust a formula's row references when rows shift. rowMap maps
  // an old 0-indexed row to its new row, or null when the referenced row was
  // deleted (an explicit error is shown). Absolute ($) row references stay.
  function adjustFormulaForRowShift(raw, rowMap) {
    if (typeof raw !== "string" || raw.charAt(0) !== "=") return raw;
    return raw.replace(/(\$?)([A-Z]+)(\$?)(\d+)/gi, function (m, absCol, col, absRow, row) {
      var rr = Number(row) - 1;
      if (absRow) return m; // absolute row reference stays fixed
      var newR = rowMap(rr);
      if (newR == null) return "#REF!";
      return (absCol ? "$" : "") + col + (newR + 1);
    });
  }

  function showRowError(message) {
    var err = document.querySelector(".row-op-error");
    if (!err) {
      err = document.createElement("div");
      err.className = "row-op-error";
      err.setAttribute("role", "alert");
      app.appendChild(err);
    }
    err.textContent = message;
    err.hidden = false;
  }

  // REQ-2-2-2: the column-header menu. Right-clicking a column header opens a
  // menu with "Insert 1 column left", "Insert 1 column right", and
  // "Delete column". Insert shifts the target column and all subsequent
  // complete data, validation rules, and formula references rightward together;
  // delete shifts subsequent columns leftward and removes rules on the target
  // column.
  function openColumnMenu(ev, c, state, wb, sheet) {
    ev.preventDefault();
    ev.stopPropagation();
    var existing = document.querySelector(".column-context-menu");
    if (existing) existing.remove();

    var menu = document.createElement("div");
    menu.className = "column-context-menu";
    menu.setAttribute("role", "menu");
    menu.style.position = "fixed";
    menu.style.left = ev.clientX + "px";
    menu.style.top = ev.clientY + "px";

    function cleanup() {
      menu.remove();
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onDocKey);
    }

    function addItem(label, action) {
      var item = document.createElement("button");
      item.type = "button";
      item.setAttribute("role", "menuitem");
      item.textContent = label;
      item.addEventListener("click", function () {
        cleanup();
        action();
      });
      menu.appendChild(item);
    }

    addItem("Insert 1 column left", function () {
      insertColumn(state, wb, sheet, c, "left");
    });
    addItem("Insert 1 column right", function () {
      insertColumn(state, wb, sheet, c, "right");
    });
    addItem("Delete column", function () {
      deleteColumn(state, wb, sheet, c);
    });

    document.body.appendChild(menu);

    function onDocClick(e) {
      if (!menu.contains(e.target)) {
        cleanup();
      }
    }
    function onDocKey(e) {
      if (e.key === "Escape") {
        cleanup();
      }
    }
    setTimeout(function () { document.addEventListener("click", onDocClick); }, 0);
    document.addEventListener("keydown", onDocKey);
  }

  // REQ-2-2-2: insert a blank column to the left or right of the target column
  // (0-indexed c). The target column and all subsequent complete data,
  // validation rules, and formula references shift rightward together. On a
  // failed save the grid retains the pre-operation structure (no partial column
  // movement).
  function insertColumn(state, wb, sheet, c, where) {
    // REQ-3-2-2: snapshot before the column-structure change so undo restores it.
    pushUndo(state, wb);
    var cells = wb.sheets[sheet].cells;
    var validation = wb.sheets[sheet].validation || {};
    var filter = wb.sheets[sheet].filter;
    var newCells = {};
    var newValidation = {};
    var newFilter = null;
    // For "left", columns >= c shift right by 1. For "right", columns > c shift.
    var shiftFrom = (where === "left") ? c : c + 1;
    var colMap = function (cc) { return (cc >= shiftFrom) ? cc + 1 : cc; };

    Object.keys(cells).forEach(function (key) {
      var parts = key.split(",");
      var r = Number(parts[0]), cc = Number(parts[1]);
      var val = cells[key];
      if (typeof val === "string" && val.charAt(0) === "=") {
        val = adjustFormulaForColumnShift(val, colMap);
      }
      newCells[r + "," + colMap(cc)] = val;
    });
    Object.keys(validation).forEach(function (key) {
      var parts = key.split(",");
      var r = Number(parts[0]), cc = Number(parts[1]);
      var rule = validation[key];
      var newRule = JSON.parse(JSON.stringify(rule));
      if (rule.c0 >= shiftFrom) newRule.c0 += 1;
      if (rule.c1 >= shiftFrom) newRule.c1 += 1;
      newValidation[r + "," + colMap(cc)] = newRule;
    });
    // REQ-2-2-2: filters continue to apply to the adjusted region. Filter
    // column indices shift with the columns they describe.
    if (filter && filter.active) {
      newFilter = { active: filter.active, columns: {} };
      Object.keys(filter.columns).forEach(function (colKey) {
        var colN = Number(colKey);
        newFilter.columns[colMap(colN)] = filter.columns[colKey];
      });
    }

    wb.sheets[sheet].cells = newCells;
    wb.sheets[sheet].validation = newValidation;
    if (newFilter) wb.sheets[sheet].filter = newFilter;
    wb.lastUpdated = new Date().toISOString();
    if (!saveSync(App.store.get())) {
      // Failed save: restore the pre-operation structure.
      wb.sheets[sheet].cells = cells;
      wb.sheets[sheet].validation = validation;
      if (filter) wb.sheets[sheet].filter = filter;
      showColumnError("Could not insert column");
      return;
    }
    render(state, wb);
  }

  // REQ-2-2-2: delete the target column (0-indexed c). Subsequent columns shift
  // leftward and rules on the target column are removed. On a failed save the
  // grid retains the pre-operation structure.
  function deleteColumn(state, wb, sheet, c) {
    // REQ-3-2-2: snapshot before the column-structure change so undo restores it.
    pushUndo(state, wb);
    var cells = wb.sheets[sheet].cells;
    var validation = wb.sheets[sheet].validation || {};
    var filter = wb.sheets[sheet].filter;
    var newCells = {};
    var newValidation = {};
    var newFilter = null;
    var colMap = function (cc) {
      if (cc === c) return null; // deleted
      return (cc > c) ? cc - 1 : cc;
    };

    Object.keys(cells).forEach(function (key) {
      var parts = key.split(",");
      var r = Number(parts[0]), cc = Number(parts[1]);
      if (cc === c) return; // cell on the deleted column is removed
      var val = cells[key];
      if (typeof val === "string" && val.charAt(0) === "=") {
        val = adjustFormulaForColumnShift(val, colMap);
      }
      newCells[r + "," + colMap(cc)] = val;
    });
    Object.keys(validation).forEach(function (key) {
      var parts = key.split(",");
      var r = Number(parts[0]), cc = Number(parts[1]);
      if (cc === c) return; // rule on the deleted column is removed
      var rule = validation[key];
      var newRule = JSON.parse(JSON.stringify(rule));
      if (rule.c0 > c) newRule.c0 -= 1;
      if (rule.c1 > c) newRule.c1 -= 1;
      newValidation[r + "," + colMap(cc)] = newRule;
    });
    // REQ-2-2-2: filters continue to apply to the adjusted region. A filter on
    // the deleted column is removed; filters on later columns shift left.
    if (filter && filter.active) {
      newFilter = { active: filter.active, columns: {} };
      Object.keys(filter.columns).forEach(function (colKey) {
        var colN = Number(colKey);
        if (colN === c) return; // filter on the deleted column is removed
        newFilter.columns[colMap(colN)] = filter.columns[colKey];
      });
    }

    wb.sheets[sheet].cells = newCells;
    wb.sheets[sheet].validation = newValidation;
    if (newFilter) wb.sheets[sheet].filter = newFilter;
    wb.lastUpdated = new Date().toISOString();
    if (!saveSync(App.store.get())) {
      wb.sheets[sheet].cells = cells;
      wb.sheets[sheet].validation = validation;
      if (filter) wb.sheets[sheet].filter = filter;
      showColumnError("Could not delete column");
      return;
    }
    render(state, wb);
  }

  // REQ-2-2-2: adjust a formula's column references when columns shift. colMap
  // maps an old 0-indexed column to its new column, or null when the referenced
  // column was deleted (an explicit error is shown). Absolute ($) column
  // references stay.
  function adjustFormulaForColumnShift(raw, colMap) {
    if (typeof raw !== "string" || raw.charAt(0) !== "=") return raw;
    return raw.replace(/(\$?)([A-Z]+)(\$?)(\d+)/gi, function (m, absCol, col, absRow, row) {
      var cc = col.toUpperCase().charCodeAt(0) - 65;
      if (absCol) return m; // absolute column reference stays fixed
      var newC = colMap(cc);
      if (newC == null) return "#REF!";
      return (newC >= 0 ? String.fromCharCode(65 + newC) : col) + (absRow ? "$" : "") + row;
    });
  }

  function showColumnError(message) {
    var err = document.querySelector(".column-op-error");
    if (!err) {
      err = document.createElement("div");
      err.className = "column-op-error";
      err.setAttribute("role", "alert");
      app.appendChild(err);
    }
    err.textContent = message;
    err.hidden = false;
  }

  function findButton(text) {
    var btns = document.querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent === text) return btns[i];
    }
    return null;
  }

  // REQ-2-1-3: rename a worksheet from its tab's context menu.
  function openRenameSheetDialog(state, wb, sheetName) {
    var content = document.createElement("div");
    var field = GenericUI.field({ name: "Worksheet name" });
    field.setValue(sheetName);
    content.appendChild(field);

    var error = document.createElement("div");
    error.className = "rename-sheet-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    content.appendChild(error);

    var dlg = GenericUI.dialog({
      name: "Rename worksheet",
      content: content,
      actions: [
        {
          label: "Save",
          onClick: function (close) {
            var newName = field.getValue().trim();
            if (!newName) {
              error.textContent = "Worksheet name cannot be empty";
              error.hidden = false;
              return;
            }
            if (newName === sheetName) {
              // No change after trimming: nothing to persist.
              close();
              return;
            }
            if (wb.sheets[newName]) {
              error.textContent = "Worksheet name already exists";
              error.hidden = false;
              return;
            }
            var cells = wb.sheets[sheetName].cells;
            delete wb.sheets[sheetName];
            wb.sheets[newName] = { cells: cells };
            if (wb.activeSheet === sheetName) wb.activeSheet = newName;
            wb.lastUpdated = new Date().toISOString();
            App.store.save().then(function () {
              close();
              render(state, wb);
            }).catch(function (err) {
              // Roll back: restore the original sheet under its old name.
              delete wb.sheets[newName];
              wb.sheets[sheetName] = { cells: cells };
              if (wb.activeSheet === newName) wb.activeSheet = sheetName;
              error.textContent = "Could not rename worksheet: " +
                (err && err.message ? err.message : "unknown error");
              error.hidden = false;
            });
          }
        }
      ]
    });
  }

  function openRenameDialog(state, wb, titleEl) {
    var content = document.createElement("div");
    var field = GenericUI.field({ name: "Workbook name" });
    field.setValue(wb.name);
    content.appendChild(field);

    var error = document.createElement("div");
    error.className = "rename-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    content.appendChild(error);

    var dlg = GenericUI.dialog({
      name: "Rename workbook",
      content: content,
      actions: [
        {
          label: "Save",
          onClick: function (close) {
            var newName = field.getValue().trim();
            if (!newName) {
              error.textContent = "Workbook name cannot be empty";
              error.hidden = false;
              return;
            }
            var oldName = wb.name;
            var oldKey = id;
            var newKey = newName;
            // If the new name collides with an existing workbook, reject.
            if (newKey !== oldKey && state.workbooks[newKey]) {
              error.textContent = "A workbook with that name already exists";
              error.hidden = false;
              return;
            }
            var saved = JSON.parse(JSON.stringify(wb));
            saved.name = newName;
            saved.lastUpdated = new Date().toISOString();
            state.workbooks[newKey] = saved;
            if (newKey !== oldKey) delete state.workbooks[oldKey];
            App.store.save().then(function () {
              close();
              titleEl.textContent = newName;
              // Update the URL so a refresh reopens the renamed workbook.
              history.replaceState(null, "", "/workbook/" + encodeURIComponent(newName));
            }).catch(function (err) {
              // Roll back: restore the original record under its old key.
              if (newKey !== oldKey) {
                delete state.workbooks[newKey];
                state.workbooks[oldKey] = wb;
              } else {
                state.workbooks[oldKey] = wb;
              }
              error.textContent = "Could not rename workbook: " +
                (err && err.message ? err.message : "unknown error");
              error.hidden = false;
            });
          }
        }
      ]
    });
  }

  // REQ-1-3-2: export the active worksheet as CSV. The download's suggested
  // filename ends in ".csv"; the UTF-8 text preserves empty cells within the
  // used range in the grid's row/column order, escapes commas/quotes/newlines,
  // and exports formula cells as their calculated results.
  function exportActiveSheet(wb, sheetName) {
    sheetName = sheetName || wb.activeSheet || Object.keys(wb.sheets)[0];
    var cells = wb.sheets[sheetName].cells || {};
    var maxR = -1, maxC = -1;
    Object.keys(cells).forEach(function (key) {
      var v = cells[key];
      if (v == null || v === "") return;
      var parts = key.split(",");
      var r = Number(parts[0]), c = Number(parts[1]);
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    });
    var text = "";
    if (maxR >= 0) {
      var lines = [];
      for (var r = 0; r <= maxR; r++) {
        var fields = [];
        for (var c = 0; c <= maxC; c++) {
          var raw = cells[r + "," + c] || "";
          fields.push(csvField(evaluateCell(raw, cells)));
        }
        lines.push(fields.join(","));
      }
      text = lines.join("\n") + "\n";
    }
    var filename = (wb.name || "worksheet") + ".csv";
    var blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke after the download has had a chance to start; revoking
    // synchronously can cancel the transfer in some browsers.
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // A cell whose text begins with "=" is a formula: export its calculated
  // result rather than the expression. Cell references resolve to the numeric
  // value of the referenced cell (recursively evaluating formulas).
  function evaluateCell(raw, cells, chain) {
    if (typeof raw === "string" && raw.charAt(0) === "=") {
      var result = evalExpr(raw.slice(1), cells, chain || []);
      if (result != null) return String(result);
    }
    return raw;
  }

  function evalExpr(expr, cells, chain) {
    // Aggregate functions (SUM/AVERAGE/COUNT/MIN/MAX) over contiguous ranges.
    // Function names are case-insensitive; empty cells are ignored; COUNT
    // counts only numeric cells; SUM/AVERAGE/MIN/MAX use only numeric cells
    // and do not treat blanks as zero. Each aggregate call is replaced by its
    // computed numeric value before the rest of the expression is evaluated.
    expr = expr.replace(/(SUM|AVERAGE|COUNT|MIN|MAX)\s*\(\s*([A-Z]+\d+)\s*:\s*([A-Z]+\d+)\s*\)/gi, function (m, fn, from, to) {
      var result = computeAggregate(fn, from, to, cells, chain);
      return result == null ? "0" : String(result);
    });
    // REQ-4-2-2: after aggregate replacement, any remaining function call
    // (letters followed by "(") is an unsupported function -> #NAME?.
    if (/[A-Za-z]+\s*\(/.test(expr)) return "#NAME?";
    var resolved = expr.replace(/\$?([A-Z]+)\$?(\d+)/gi, function (m, col, row) {
      var c = col.toUpperCase().charCodeAt(0) - 65;
      var r = Number(row) - 1;
      var key = r + "," + c;
      // REQ-4-2-2: a direct or indirect circular reference displays #REF!.
      if (chain.indexOf(key) !== -1) return "#REF!";
      var v = cells[key];
      if (v == null || v === "") return "0";
      var ev = evaluateCell(v, cells, chain.concat([key]));
      // REQ-4-2-2: propagate a referenced cell's error marker.
      if (ev === "#DIV/0!" || ev === "#REF!" || ev === "#NAME?" || ev === "#ERROR!") return ev;
      var n = Number(ev);
      return isNaN(n) ? "0" : String(n);
    });
    // REQ-4-2-2: propagate any error marker produced while resolving.
    if (resolved.indexOf("#DIV/0!") !== -1) return "#DIV/0!";
    if (resolved.indexOf("#REF!") !== -1) return "#REF!";
    if (resolved.indexOf("#NAME?") !== -1) return "#NAME?";
    if (resolved.indexOf("#ERROR!") !== -1) return "#ERROR!";
    // Only numbers, operators, parentheses and whitespace may remain after
    // cell references are resolved -- never execute arbitrary code.
    if (!/^[\d+\-*/().\s]+$/.test(resolved)) return "#ERROR!";
    try {
      var result = Function('"use strict"; return (' + resolved + ');')();
      if (typeof result === "number" && isFinite(result)) return result;
      // REQ-4-2-2: division by zero (Infinity) displays #DIV/0!.
      if (typeof result === "number" && !isFinite(result)) return "#DIV/0!";
      return "#ERROR!";
    } catch (e) {
      return "#ERROR!";
    }
  }

  // Compute an aggregate function over a contiguous A1-style range. Empty
  // cells are ignored; COUNT counts only numeric cells; SUM/AVERAGE/MIN/MAX
  // use only numeric cells and do not treat blanks as zero.
  function computeAggregate(fn, from, to, cells, chain) {
    var fromC = from.toUpperCase().charCodeAt(0) - 65;
    var fromR = Number(from.replace(/[A-Z]/gi, "")) - 1;
    var toC = to.toUpperCase().charCodeAt(0) - 65;
    var toR = Number(to.replace(/[A-Z]/gi, "")) - 1;
    var r0 = Math.min(fromR, toR), r1 = Math.max(fromR, toR);
    var c0 = Math.min(fromC, toC), c1 = Math.max(fromC, toC);
    var values = [];
    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        var raw = cells[r + "," + c];
        if (raw == null || raw === "") continue;
        var ev = evaluateCell(raw, cells, chain);
        var n = Number(ev);
        if (!isNaN(n) && String(ev).trim() !== "") values.push(n);
      }
    }
    var f = fn.toUpperCase();
    if (f === "COUNT") return values.length;
    if (values.length === 0) return 0;
    if (f === "SUM") {
      var s = 0;
      for (var i = 0; i < values.length; i++) s += values[i];
      return s;
    }
    if (f === "AVERAGE") {
      var s2 = 0;
      for (var j = 0; j < values.length; j++) s2 += values[j];
      return s2 / values.length;
    }
    if (f === "MIN") return Math.min.apply(null, values);
    if (f === "MAX") return Math.max.apply(null, values);
    return 0;
  }

  function csvField(value) {
    var s = String(value == null ? "" : value);
    if (/[",\n\r]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleString();
  }

  // Persist the whole store synchronously. A selection change is followed
  // immediately by a page reload in the acceptance flow; an async fetch PUT
  // would be cancelled by that navigation and the selection would be lost.
  // A synchronous XHR blocks until the server has written the file, so the
  // persisted rectangle is guaranteed to survive the reload.
  function saveSync(state) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("PUT", "/api/store", false);
      xhr.setRequestHeader("content-type", "application/json");
      xhr.send(JSON.stringify(state));
      return xhr.status >= 200 && xhr.status < 300;
    } catch (e) {
      // A failed synchronous save must not break the selection interaction;
      // the in-memory state still reflects the new rectangle.
      return false;
    }
  }
})();
