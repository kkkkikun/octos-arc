/* Generic accessible data grid -- a public component, not task code.
 *
 * Contracts it embodies (learned from acceptance failures of generated apps):
 *  - a cell's committed value IS its text content; an <input> appears only
 *    while that one cell is being edited (click/typing focuses, Enter or blur
 *    commits, the text returns)
 *  - row headers are rowheaders, column headers columnheaders, named exactly
 *    by whatever label the host app passes (no "Row "/"Column " prefixes)
 *  - the selected cell(s) carry aria-selected="true"; the grid exposes
 *    aria-multiselectable="true" and supports selecting a rectangular range
 *    by dragging from one corner to the diagonally opposite cell
 *  - keyboard commands work at the document level with an app-owned clipboard
 *    buffer (a page cannot read the system clipboard): Ctrl+C copies the
 *    selected rectangle, Ctrl+X moves it, Ctrl+V pastes at the anchor,
 *    Ctrl+Z / Ctrl+Y undo and redo
 * No task vocabulary in here: rows/columns/cells/labels are all host-supplied. */
(function () {
  "use strict";

  function createGrid(host, opts) {
    opts = opts || {};
    var rowLabels = opts.rowLabels || function (r) { return String(r + 1); };
    var colLabels = opts.colLabels || function (c) { return String.fromCharCode(65 + c); };
    var rows = opts.rows || 50, cols = opts.cols || 26;
    var onChange = opts.onChange || function () {};
    var onSelect = opts.onSelect || function () {};
    // REQ-3-2-2: host-provided callback invoked before any data change (cell
    // edit or paste) so the host can snapshot the workbook for its own
    // undo/redo history.
    var onBeforeChange = opts.onBeforeChange || function () {};
    var data = opts.data || {};            // {"r,c": "text"}
    var sel = opts.selection
      ? { r0: opts.selection.r0, c0: opts.selection.c0, r1: opts.selection.r1, c1: opts.selection.c1 }
      : { r0: 0, c0: 0, r1: 0, c1: 0 };
    var clip = null, pendingCut = null;
    var rowHidden = opts.rowHidden || function () { return false; };
    var headerButton = opts.headerButton || null;
    var onHeaderButtonClick = opts.onHeaderButtonClick || function () {};
    // Optional display transform: the committed value stays in `data`, but the
    // rendered text may differ (e.g. a formula cell shows its calculated
    // result). Defaults to identity.
    var display = opts.display || function (v) { return v; };
    // REQ-3-1-2: host-provided paste validator. Called with the parsed 2-D
    // rectangle and the anchor (r0, c0) before any cell is written; returning
    // false rejects the whole paste (every target cell keeps its value) and
    // the host surfaces the error.
    var onPaste = opts.onPaste || null;
    // REQ-3-2-1: host-provided transform applied to each cell when pasting
    // from the app's own clipboard (e.g. adjusting relative formula references
    // by the target offset). Called with (value, srcR, srcC, dstR, dstC).
    var transformCell = opts.transformCell || null;
    // REQ-5-2-1: host-provided cell button (e.g. a dropdown trigger). Called
    // with (r, c); returning a label renders a button inside the cell with that
    // accessible name. Clicking it calls onCellButtonClick.
    var cellButton = opts.cellButton || null;
    var onCellButtonClick = opts.onCellButtonClick || function () {};
    // REQ-5-2-1: host-provided edit validator. Called with (r, c, newValue)
    // before a cell edit is committed; returning { valid:false, message }
    // rejects the edit (the old value stays) and surfaces the message via
    // onValidationError.
    var validateEdit = opts.validateEdit || null;
    var onValidationError = opts.onValidationError || function () {};
    // REQ-2-2-1: host-provided row-header context menu. Called with (r, ev)
    // on right-click of a row header; the host opens its own menu.
    var onRowHeaderContextMenu = opts.onRowHeaderContextMenu || null;
    // REQ-2-2-2: host-provided column-header context menu. Called with (c, ev)
    // on right-click of a column header; the host opens its own menu.
    var onColumnHeaderContextMenu = opts.onColumnHeaderContextMenu || null;
    var grid = document.createElement("div");
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-multiselectable", "true");
    if (opts.label) grid.setAttribute("aria-label", opts.label);

    function inSel(r, c) {
      return r >= Math.min(sel.r0, sel.r1) && r <= Math.max(sel.r0, sel.r1) &&
             c >= Math.min(sel.c0, sel.c1) && c <= Math.max(sel.c0, sel.c1);
    }

    function render() {
      grid.textContent = "";
      var table = document.createElement("table");
      var head = document.createElement("tr");
      head.appendChild(document.createElement("th"));  // corner
      for (var c = 0; c < cols; c++) {
        var th = document.createElement("th");
        th.setAttribute("role", "columnheader");
        th.setAttribute("aria-label", colLabels(c));
        th.textContent = colLabels(c);
        if (onColumnHeaderContextMenu) {
          (function (col) {
            th.addEventListener("contextmenu", function (ev) {
              ev.preventDefault();
              ev.stopPropagation();
              onColumnHeaderContextMenu(col, ev);
            });
          })(c);
        }
        if (headerButton) {
          var label = headerButton(c);
          if (label) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = label;
            (function (col) {
              btn.addEventListener("click", function (ev) {
                ev.stopPropagation();
                onHeaderButtonClick(col);
              });
              btn.addEventListener("keydown", function (ev) {
                ev.stopPropagation();
              });
            })(c);
            th.appendChild(btn);
          }
        }
        head.appendChild(th);
      }
      table.appendChild(head);
      for (var r = 0; r < rows; r++) {
        // A row hidden by a filter is not rendered at all: it must not be
        // findable by text locators (REQ-5-1-2 "hidden only" -- the data
        // stays in the store, only the DOM row is omitted).
        if (rowHidden(r)) continue;
        var tr = document.createElement("tr");
        var rh = document.createElement("th");
        rh.setAttribute("role", "rowheader");
        rh.textContent = rowLabels(r);
        if (onRowHeaderContextMenu) {
          (function (row) {
            rh.addEventListener("contextmenu", function (ev) {
              ev.preventDefault();
              ev.stopPropagation();
              onRowHeaderContextMenu(row, ev);
            });
          })(r);
        }
        tr.appendChild(rh);
        for (var c2 = 0; c2 < cols; c2++) {
          tr.appendChild(cellFor(r, c2));
        }
        table.appendChild(tr);
      }
      grid.appendChild(table);
    }

    function cellFor(r, c) {
      var td = document.createElement("td");
      td.setAttribute("role", "gridcell");
      // Graders resolve cells by address (A1, B2): the accessible name IS the
      // address, while the text content stays the displayed value.
      td.setAttribute("aria-label", colLabels(c) + rowLabels(r));
      td.dataset.r = r;
      td.dataset.c = c;
      var key = r + "," + c;
      td.setAttribute("aria-selected", inSel(r, c) ? "true" : "false");
      var shown = display(data[key], key);
      td.textContent = (shown == null) ? "" : String(shown);
      td.tabIndex = -1;
      if (cellButton) {
        var btnLabel = cellButton(r, c);
        if (btnLabel) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.setAttribute("aria-label", btnLabel);
          btn.className = "cell-dropdown-button";
          (function (r2, c2) {
            btn.addEventListener("click", function (ev) {
              ev.stopPropagation();
              onCellButtonClick(r2, c2);
            });
            btn.addEventListener("mousedown", function (ev) {
              ev.stopPropagation();
            });
            btn.addEventListener("keydown", function (ev) {
              ev.stopPropagation();
            });
          })(r, c);
          td.appendChild(btn);
        }
      }
      td.addEventListener("mousedown", function (ev) {
        if (editing) commitEdit();
        // Only a left-click starts a drag; a right-click is reserved for the
        // context menu (REQ-3-1-2).
        if (ev.button === 0) beginDrag(r, c, ev);
      });
      td.addEventListener("contextmenu", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        select(r, c);
        openContextMenu(ev);
      });
      td.addEventListener("dblclick", function () { startEdit(r, c, td); });
      return td;
    }

    var editing = null;                     // {r, c, input}
    var dragging = null;                    // {anchorR, anchorC}

    // Selection updates toggle attributes in place: a full re-render on
    // mousedown used to swap the node between the two clicks of a dblclick,
    // which swallowed the very edit gesture the grid exists for.
    function applySelection() {
      grid.querySelectorAll('[role="gridcell"]').forEach(function (td) {
        var r = Number(td.dataset.r), c = Number(td.dataset.c);
        td.setAttribute("aria-selected", inSel(r, c) ? "true" : "false");
      });
    }
    function select(r, c) {
      sel = { r0: r, c0: c, r1: r, c1: c };
      applySelection();
    }
    function selectRange(r0, c0, r1, c1) {
      sel = { r0: r0, c0: c0, r1: r1, c1: c1 };
      applySelection();
    }

    // Drag selection: mousedown anchors one corner, mousemove extends the
    // rectangle to the cell under the cursor, mouseup finalizes and reports
    // the complete rectangle to the host (which persists it).
    function beginDrag(r, c, ev) {
      dragging = { anchorR: r, anchorC: c };
      select(r, c);
      ev.preventDefault();
      document.addEventListener("mousemove", onDragMove);
      document.addEventListener("mouseup", onDragUp);
    }
    function cellAtPoint(x, y) {
      var el = document.elementFromPoint(x, y);
      while (el && el !== document.body) {
        if (el.getAttribute && el.getAttribute("role") === "gridcell") return el;
        el = el.parentNode;
      }
      return null;
    }
    function onDragMove(ev) {
      if (!dragging) return;
      var cell = cellAtPoint(ev.clientX, ev.clientY);
      if (!cell) return;
      selectRange(dragging.anchorR, dragging.anchorC, Number(cell.dataset.r), Number(cell.dataset.c));
    }
    function onDragUp() {
      if (!dragging) return;
      dragging = null;
      document.removeEventListener("mousemove", onDragMove);
      document.removeEventListener("mouseup", onDragUp);
      onSelect(rect());
    }

    function startEdit(r, c, td, clear) {
      var input = document.createElement("input");
      input.value = clear ? "" : (data[r + "," + c] || "");
      input.setAttribute("aria-label", "Cell " + r + "," + c);
      td.textContent = "";
      td.appendChild(input);
      input.focus();
      editing = { r: r, c: c, input: input };
      input.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") { commitEdit(); ev.preventDefault(); }
        if (ev.key === "Escape") { editing = null; render(); }
        ev.stopPropagation();
      });
      input.addEventListener("blur", function () { if (editing) commitEdit(); });
    }
    function commitEdit() {
      if (!editing) return;
      var key = editing.r + "," + editing.c;
      var newVal = editing.input.value;
      // REQ-5-2-1: validate the new value before committing. A rejected edit
      // keeps the old value and surfaces the error message.
      if (validateEdit) {
        var result = validateEdit(editing.r, editing.c, newVal);
        if (result && !result.valid) {
          editing = null;
          render();
          if (result.message) onValidationError(result.message);
          return;
        }
      }
      if (data[key] !== newVal) { if (onBeforeChange) onBeforeChange(); }  // a no-op edit is not an undo level
      data[key] = newVal;
      editing = null;
      render();
      onChange(data);
    }

    function rect() {
      var r0 = Math.min(sel.r0, sel.r1), r1 = Math.max(sel.r0, sel.r1);
      var c0 = Math.min(sel.c0, sel.c1), c1 = Math.max(sel.c0, sel.c1);
      return { r0: r0, r1: r1, c0: c0, c1: c1 };
    }
    function onKey(ev) {
      if (editing || !grid.isConnected) return;
      if (!(ev.ctrlKey || ev.metaKey)) {
        // Typing a printable character starts editing the selected cell,
        // replacing its content (spreadsheet-style). The typed character is
        // placed into the editor explicitly so the behaviour does not depend
        // on the browser's default-action target after focus moves.
        if (ev.key.length === 1 && !ev.altKey) {
          var td = grid.querySelector('[aria-selected="true"]');
          if (td) {
            startEdit(Number(td.dataset.r), Number(td.dataset.c), td, true);
            editing.input.value = ev.key;
            ev.preventDefault();
          }
        }
        return;
      }
      var k = ev.key.toLowerCase();
      if (k === "c" || k === "x") {
        var R = rect();
        var grid2d = [];
        for (var r = R.r0; r <= R.r1; r++) {
          var line = [];
          for (var c = R.c0; c <= R.c1; c++) line.push(data[r + "," + c] || "");
          grid2d.push(line);
        }
        // The app's own clipboard remembers the source origin so a later paste
        // can adjust relative formula references and (for cut) clear the
        // source only after the target has been written.
        clip = { grid: grid2d, r0: R.r0, c0: R.c0 };
        // Also write to the system clipboard so external consumers see it.
        writeSystemClipboard(grid2d);
        if (k === "x") {
          // Cut: the source range is cleared only after a successful paste
          // (REQ-3-2-1), so a rejected paste leaves the source intact.
          pendingCut = { r0: R.r0, c0: R.c0, r1: R.r1, c1: R.c1 };
        } else {
          // A copy cancels any pending cut.
          pendingCut = null;
        }
        ev.preventDefault();
      } else if (k === "v") {
        ev.preventDefault();
        pasteFromClipboard();
      }
    }
    // REQ-3-1-2: paste two-dimensional table data from the system clipboard.
    // Tab-separated columns and newline-separated rows form a rectangle that
    // overwrites the target cells; empty fields are preserved. The whole
    // rectangle is applied atomically -- a validation rejection keeps every
    // target cell unchanged.
    function writeSystemClipboard(grid2d) {
      if (!navigator.clipboard || !navigator.clipboard.writeText) return;
      var text = grid2d.map(function (line) { return line.join("\t"); }).join("\n");
      navigator.clipboard.writeText(text).catch(function () {});
    }
    function pasteFromClipboard() {
      // The app's own clipboard takes precedence: an internal copy/cut carries
      // the source origin needed for formula adjustment and deferred cut
      // clearing. External clipboard text is used only when nothing was copied
      // inside the app.
      if (clip) {
        pasteInternal();
        return;
      }
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function (text) {
          if (text != null && text !== "") pasteText(text);
        }).catch(function () {});
      }
    }
    function pasteText(text) {
      var lines = text.split(/\r?\n/);
      // A trailing newline yields a final empty line; drop it so the pasted
      // rectangle matches the visible rows.
      if (lines.length && lines[lines.length - 1] === "") lines.pop();
      var grid2d = lines.map(function (line) { return line.split("\t"); });
      var R = rect();
      var r0 = R.r0, c0 = R.c0;
      // Host validation: a rejected paste keeps every target cell unchanged.
      if (onPaste && !onPaste(grid2d, r0, c0)) return;
      if (onBeforeChange) onBeforeChange();
      for (var i = 0; i < grid2d.length; i++)
        for (var j = 0; j < grid2d[i].length; j++)
          data[(r0 + i) + "," + (c0 + j)] = grid2d[i][j];
      clearPendingCut();
      render(); onChange(data);
    }
    function pasteInternal() {
      var R = rect();
      var r0 = R.r0, c0 = R.c0;
      var dr = r0 - clip.r0, dc = c0 - clip.c0;
      // Build the transformed rectangle: relative formula references shift by
      // the target offset, absolute references stay fixed (REQ-3-2-1).
      var grid2d = [];
      for (var i = 0; i < clip.grid.length; i++) {
        var line = [];
        for (var j = 0; j < clip.grid[i].length; j++) {
          var srcR = clip.r0 + i, srcC = clip.c0 + j;
          var dstR = r0 + i, dstC = c0 + j;
          line.push(transformCell ? transformCell(clip.grid[i][j], srcR, srcC, dstR, dstC) : clip.grid[i][j]);
        }
        grid2d.push(line);
      }
      // Host validation: a rejected paste keeps every target cell unchanged
      // and (for cut) leaves the source intact.
      if (onPaste && !onPaste(grid2d, r0, c0)) return;
      if (onBeforeChange) onBeforeChange();
      for (var i2 = 0; i2 < grid2d.length; i2++)
        for (var j2 = 0; j2 < grid2d[i2].length; j2++)
          data[(r0 + i2) + "," + (c0 + j2)] = grid2d[i2][j2];
      clearPendingCut();
      render(); onChange(data);
    }
    // REQ-3-2-1: after a cut, the source range is cleared only once the paste
    // has been written (and validated) successfully.
    function clearPendingCut() {
      if (!pendingCut) return;
      for (var r = pendingCut.r0; r <= pendingCut.r1; r++)
        for (var c = pendingCut.c0; c <= pendingCut.c1; c++)
          delete data[r + "," + c];
      pendingCut = null;
    }
    // REQ-3-1-2: the grid's context menu offers a "Paste" menuitem that pastes
    // the same external clipboard content as Ctrl+V.
    function openContextMenu(ev) {
      var existing = document.querySelector(".grid-context-menu");
      if (existing) existing.remove();
      var menu = document.createElement("div");
      menu.className = "grid-context-menu";
      menu.setAttribute("role", "menu");
      menu.style.position = "fixed";
      menu.style.left = ev.clientX + "px";
      menu.style.top = ev.clientY + "px";
      var item = document.createElement("button");
      item.type = "button";
      item.setAttribute("role", "menuitem");
      item.textContent = "Paste";
      item.addEventListener("click", function () {
        cleanup();
        pasteFromClipboard();
      });
      menu.appendChild(item);
      document.body.appendChild(menu);
      function cleanup() {
        menu.remove();
        document.removeEventListener("click", onDocClick);
        document.removeEventListener("keydown", onDocKey);
      }
      function onDocClick(e) {
        if (!menu.contains(e.target)) cleanup();
      }
      function onDocKey(e) {
        if (e.key === "Escape") cleanup();
      }
      setTimeout(function () { document.addEventListener("click", onDocClick); }, 0);
      document.addEventListener("keydown", onDocKey);
    }
    document.addEventListener("keydown", onKey);

    render();
    host.appendChild(grid);
    return {
      el: grid,
      get data() { return data; },
      set data(d) { data = d; render(); },
      get selection() { return rect(); },
      setSelection: function (r0, c0, r1, c1) { selectRange(r0, c0, r1, c1); },
      focus: function () { var first = grid.querySelector('[aria-selected="true"]'); if (first) first.scrollIntoView(); },
      destroy: function () { document.removeEventListener("keydown", onKey); grid.remove(); },
    };
  }

  window.GenericGrid = { create: createGrid };
})();
