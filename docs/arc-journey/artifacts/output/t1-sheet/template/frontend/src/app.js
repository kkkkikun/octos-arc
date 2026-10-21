/* Shared application state: the workbook store and its seed.
 *
 * The store persists to /api/store (a JSON file on the server). A brand-new
 * store (server 404) is seeded with the evaluation workbook `Q3 Sales`
 * (worksheet `Sheet1`, cell A1 = `Region`); later startups keep user edits.
 * Each workbook carries its own sheets and cells, so data from one workbook
 * never leaks into another's grid. */
(function () {
  "use strict";

  function seed() {
    var now = new Date().toISOString();
    return {
      workbooks: {
        "Q3 Sales": {
          name: "Q3 Sales",
          lastUpdated: now,
          activeSheet: "Sheet1",
          sheets: {
            "Sheet1": {
              cells: {
                "0,0": "Region",
                "0,1": "Sales",
                "0,2": "Status",
                "1,0": "East",
                "1,1": "1200",
                "1,2": "Open",
                "2,0": "North",
                "2,1": "800",
                "2,2": "Closed",
                "3,0": "South",
                "3,1": "700",
                "3,2": "Open"
              }
            },
            // REQ-2-1-1/REQ-2-1-3: a second worksheet exists so adding a new
            // sheet yields Sheet3 and right-clicking Sheet2 is possible. It is
            // blank; the Region/Sales/Status data lives on Sheet1.
            "Sheet2": { cells: {} }
          }
        },
        // REQ-3 world (range selection): A1:B2 holds Item/Qty and Pen/4, with
        // the paste target D1:E2. It ships as its own workbook so the earlier
        // Q3 Sales cells (Region/Sales/Status) are never overwritten.
        "Inventory": {
          name: "Inventory",
          lastUpdated: now,
          activeSheet: "Sheet1",
          sheets: {
            "Sheet1": {
              cells: {
                "0,0": "Item",
                "0,1": "Qty",
                "1,0": "Pen",
                "1,1": "4",
                // REQ-3-2-2: a third row so inserting a row above row 3 shifts
                // North down to A4 and undo restores it to A3.
                "2,0": "North"
              }
            }
          }
        },
        // REQ-4 world (formulas): A1=2, B1=3, and formulas =A1+B1 (C1) and
        // =C1*2 (D1). It ships as its own workbook so the earlier Q3 Sales
        // cells (Region/Sales/Status) are never overwritten.
        "Calculations": {
          name: "Calculations",
          lastUpdated: now,
          activeSheet: "Sheet1",
          sheets: {
            "Sheet1": {
              cells: {
                "0,0": "2",
                "0,1": "3",
                "0,2": "=A1+B1",
                "0,3": "=C1*2"
              }
            }
          }
        }
      }
    };
  }

  var store = GenericUI.store("/api/store", seed);

  window.App = { store: store, seed: seed };
})();
