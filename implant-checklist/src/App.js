import { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";

export default function ImplantChecklistApp() {
  const [procedures, setProcedures] = useState([]);
  const [activeProcedures, setActiveProcedures] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedProcedures, setCollapsedProcedures] = useState({});
  const [dcNo, setDcNo] = useState("");
  const [showDcNoModal, setShowDcNoModal] = useState(false);
  const printRef = useRef();

  useEffect(() => {
    fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQu2GZRYcJnEjFaDryWHowegMFVkf8xzewGsEKqNLw7onpe1if24LnJrIZAl4CB5QdgVFjE1PqFYmUa/pub?output=csv')
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            const parsedProcedures = results.data.map(([name, items]) => ({
              name: name.trim(),
              items: items.split(',').map(item => item.trim())
            }));
            setProcedures(parsedProcedures);
          }
        });
      });
  }, []);

  const toggleProcedure = (procedure) => {
    if (activeProcedures.some((p) => p.name === procedure.name)) {
      setActiveProcedures((prev) => prev.filter((p) => p.name !== procedure.name));
    } else {
      setActiveProcedures((prev) => [...prev, procedure]);
    }
  };

  const toggleCollapse = (procedureName) => {
    setCollapsedProcedures((prev) => ({
      ...prev,
      [procedureName]: !prev[procedureName],
    }));
  };

  const handleItemChange = (procedureName, item) => {
    const key = `${procedureName}__${item}`;
    setSelectedItems((prev) => {
      if (prev[key]) {
        const { [key]: _, ...rest } = prev;
        return rest;
      } else {
        return { ...prev, [key]: [] };
      }
    });
  };

  const handleAddSizeQty = (key) => {
    setSelectedItems((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), { size: "", qty: 1 }],
    }));
  };

  const handleSizeQtyChange = (key, index, field, value) => {
    setSelectedItems((prev) => {
      const updated = [...prev[key]];
      updated[index][field] = value;
      return { ...prev, [key]: updated };
    });
  };

  const handleDeleteSizeQty = (key, index) => {
    setSelectedItems((prev) => {
      const updated = [...prev[key]];
      updated.splice(index, 1);
      if (updated.length === 0) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: updated };
    });
  };

  const handleClearAll = () => {
    setSelectedItems({});
  };

  const handlePrint = () => {
    if (!dcNo.trim()) {
      setShowDcNoModal(true);
      return;
    }

    const printWindow = window.open("", "", "height=800,width=600");
    printWindow.document.write("<html><head><title>SUMMARY</title>");
    printWindow.document.write(`
      <style>
        body { font-family: Arial, sans-serif; color: black; padding: 20px; }
        table, th, td { border: 1px solid black; border-collapse: collapse; padding: 8px; }
        th, td { text-align: left; font-size: 14px; }
        h2 { text-align: center; margin-bottom: 20px; }
        .footer { display: flex; justify-content: space-between; padding: 50px 20px; margin-top: 30px; }
      </style>
    `);
    printWindow.document.write("</head><body>");

    printWindow.document.write(`<div style='text-align:right'><strong>DC No:</strong> ${dcNo}</div>`);
    printWindow.document.write(`<h2>SUMMARY</h2>`);
    printWindow.document.write("<table style='width:100%'><tr><th>Sl No</th><th>Description</th><th>Qty</th></tr>");

    let serial = 1;
    Object.keys(selectedItems).forEach((key) => {
      const [procedureName, item] = key.split("__");
      if (!selectedItems[key] || selectedItems[key].length === 0) return;
      const sizeDetails = selectedItems[key].map((entry) => `${entry.size}-${entry.qty}`).join(", ");
      const totalQty = selectedItems[key].reduce((sum, entry) => sum + Number(entry.qty || 0), 0);
      printWindow.document.write(`
        <tr>
          <td>${serial++}</td>
          <td>${item} ${sizeDetails}</td>
          <td>${totalQty}</td>
        </tr>
      `);
    });

    printWindow.document.write("</table>");

    printWindow.document.write(`
      <div class="footer">
        <div>Receiver's Sign</div>
        <div>Authorized Sign</div>
      </div>
    `);

    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.print();
  };

  const formatText = (text) => {
    return text.toUpperCase().replace(/\s+/g, " ").trim();
  };

  const filteredProcedures = procedures.filter((procedure) =>
    procedure.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {showDcNoModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "white", padding: 24, borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.2)", maxWidth: 400, width: "100%" }}>
            <h2 style={{ fontSize: 20, fontWeight: "bold", marginBottom: 16 }}>Enter DC No</h2>
            <input
              placeholder="DC No"
              value={dcNo}
              onChange={(e) => setDcNo(e.target.value)}
              style={{ marginBottom: 16, width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowDcNoModal(false)} style={{ padding: "6px 12px", borderRadius: 4, border: "1px solid #ccc", background: "white" }}>Cancel</button>
              <button onClick={() => {
                if (dcNo.trim()) {
                  setShowDcNoModal(false);
                  handlePrint();
                }
              }} style={{ padding: "6px 12px", borderRadius: 4, background: "#2563eb", color: "white", border: "none" }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: "bold" }}>Ortho Implant Checklist</h1>
        <input
          placeholder="Enter DC No"
          value={dcNo}
          onChange={(e) => setDcNo(e.target.value)}
          style={{ width: 200, padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Search Procedures"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {filteredProcedures.map((procedure) => (
          <button
            key={procedure.name}
            onClick={() => toggleProcedure(procedure)}
            style={{
              padding: "10px 16px",
              borderRadius: 6,
              border: activeProcedures.some((p) => p.name === procedure.name) ? "2px solid #2563eb" : "1px solid #ccc",
              background: activeProcedures.some((p) => p.name === procedure.name) ? "#2563eb" : "white",
              color: activeProcedures.some((p) => p.name === procedure.name) ? "white" : "#222",
              fontWeight: 500,
              cursor: "pointer"
            }}
          >
            {procedure.name}
          </button>
        ))}
      </div>

      {activeProcedures.map((procedure) => (
        <div key={procedure.name} style={{ marginTop: 24, border: "1px solid #eee", borderRadius: 8, background: "#fafbfc" }}>
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 20, fontWeight: 600 }}>{procedure.name} Items</h2>
              <button onClick={() => toggleCollapse(procedure.name)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                {collapsedProcedures[procedure.name] ? <ChevronDown /> : <ChevronUp />}
              </button>
            </div>
            {!collapsedProcedures[procedure.name] &&
              procedure.items.map((item) => {
                const key = `${procedure.name}__${item}`;
                return (
                  <div key={item} style={{ margin: "12px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={key in selectedItems}
                        onChange={() => handleItemChange(procedure.name, item)}
                      />
                      <span>{item}</span>
                      {key in selectedItems && selectedItems[key].length === 0 && (
                        <button style={{ padding: "2px 8px", borderRadius: 4, background: "#e0e7ff", border: "none", cursor: "pointer" }} onClick={() => handleAddSizeQty(key)}>
                          + Add Size
                        </button>
                      )}
                    </div>
                    {selectedItems[key]?.length > 0 &&
                      selectedItems[key].map((entry, index) => (
                        <div key={index} style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 32, marginTop: 4 }}>
                          <input
                            placeholder="Size"
                            value={entry.size}
                            onChange={(e) => handleSizeQtyChange(key, index, "size", e.target.value)}
                            style={{ width: 80, padding: 6, border: "1px solid #ccc", borderRadius: 4 }}
                          />
                          <input
                            placeholder="Qty"
                            type="number"
                            value={entry.qty}
                            onChange={(e) => handleSizeQtyChange(key, index, "qty", e.target.value)}
                            style={{ width: 60, padding: 6, border: "1px solid #ccc", borderRadius: 4 }}
                          />
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              style={{ borderRadius: "50%", padding: 4, width: 28, height: 28, border: "1px solid #222", background: "#f1f5f9", color: "#222", cursor: "pointer" }}
                              onClick={() => handleAddSizeQty(key)}
                            >
                              +
                            </button>
                            <button
                              style={{ borderRadius: "50%", padding: 4, width: 28, height: 28, border: "none", background: "#ef4444", color: "white", cursor: "pointer" }}
                              onClick={() => handleDeleteSizeQty(key, index)}
                            >
                              <Trash2 style={{ width: 16, height: 16 }} />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                );
              })}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 32, display: "flex", gap: 16 }}>
        <button onClick={handlePrint} style={{ padding: "10px 24px", borderRadius: 6, background: "#2563eb", color: "white", border: "none", fontWeight: 500, fontSize: 16, cursor: "pointer" }}>Just Print</button>
        <button onClick={handleClearAll} style={{ padding: "10px 24px", borderRadius: 6, background: "#ef4444", color: "white", border: "none", fontWeight: 500, fontSize: 16, cursor: "pointer" }}>Clear All</button>
      </div>

      <div ref={printRef} className="hidden-print" style={{ marginTop: 24, padding: 16, border: "1px solid #eee", borderRadius: 8, background: "white" }}>
        <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>SUMMARY</h2>
        <ol style={{ paddingLeft: 20 }}>
          {Object.keys(selectedItems).map((key) => {
            const [procedureName, item] = key.split("__");
            if (!selectedItems[key] || selectedItems[key].length === 0) return null;
            return (
              <li key={key} style={{ marginBottom: 4 }}>
                {formatText(item)}: {selectedItems[key].map((entry) => `${formatText(entry.size)}-${entry.qty}`).join(", ")}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
