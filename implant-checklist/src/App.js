import { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import Fuse from "fuse.js";
import html2pdf from "html2pdf.js";

export default function ImplantChecklistApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const PASSWORD = "srrOrthOSat";
  const EMAIL = "srrorthoplus999@gmail.com";

  const [procedures, setProcedures] = useState([]);
  const [activeProcedures, setActiveProcedures] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedProcedures, setCollapsedProcedures] = useState({});
  const [dcNo, setDcNo] = useState("");
  const [showDcNoModal, setShowDcNoModal] = useState(false);
  const printRef = useRef();
  const [showProcedures, setShowProcedures] = useState(false);
  const [newInstrumentInputs, setNewInstrumentInputs] = useState({});
  const [fixedQtyEdits, setFixedQtyEdits] = useState({});
  const [hospitalName, setHospitalName] = useState("");
  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [pendingPDF, setPendingPDF] = useState(false);

  // Fetch procedures from Google Sheet
  const fetchProcedures = () => {
    fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQu2GZRYcJnEjFaDryWHowegMFVkf8xzewGsEKqNLw7onpe1if24LnJrIZAl4CB5QdgVFjE1PqFYmUa/pub?output=csv')
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            const parsedProcedures = results.data.map(([name, items, fixedItems, fixedQty, instruments]) => {
              // Parse fixed items and qtys strictly by &k only
              const fixedItemsArr = fixedItems ? fixedItems.split('&k').map(s => s.trim()).filter(Boolean) : [];
              const fixedQtyArr = fixedQty ? fixedQty.split('&k').map(s => s.trim()).filter(Boolean) : [];
              const fixedList = fixedItemsArr.map((item, idx) => ({ name: item, qty: fixedQtyArr[idx] || '' }));
              // Parse editable items (from Items column only, comma-separated)
              const editableItems = items
                ? items.split(',').map(item => item.trim()).filter(Boolean)
                : [];
              return {
                name: name.trim(),
                items: editableItems,
                fixedList,
                instruments: instruments ? instruments.split('|').map(inst => inst.trim()).filter(Boolean) : [],
              };
            });
            setProcedures(parsedProcedures);
            setActiveProcedures([]); // Optionally clear active procedures on refetch
          }
        });
      });
  };

  useEffect(() => {
    fetchProcedures();
  }, []);

  const toggleProcedure = (procedure) => {
    if (activeProcedures.some((p) => p.name === procedure.name)) {
      setActiveProcedures((prev) => prev.filter((p) => p.name !== procedure.name));
    } else {
      setActiveProcedures((prev) => [...prev, procedure]);
      setCollapsedProcedures((prev) => ({ ...prev, [procedure.name]: false }));
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
    printWindow.document.write(`<div style='height: 24px'></div>`);
    printWindow.document.write("<table style='width:100%'><tr><th>Sl No</th><th>Description</th><th>Qty</th></tr>");

    let serial = 1;
    // Print fixed items first
    const selectedProcedureNames = Array.from(new Set(Object.keys(selectedItems).map(key => key.split("__")[0])));
    selectedProcedureNames.forEach(procName => {
      const proc = procedures.find(p => p.name === procName);
      if (proc && proc.fixedList && proc.fixedList.length > 0) {
        proc.fixedList.forEach(fixed => {
          printWindow.document.write(`
            <tr>
              <td>${serial++}</td>
              <td>${fixed.name}</td>
              <td>${fixed.qty}</td>
            </tr>
          `);
        });
      }
    });

    // Collect all instruments from selected procedures (no duplicates)
    selectedProcedureNames.forEach(procName => {
      const proc = procedures.find(p => p.name === procName);
      if (proc && proc.instruments && proc.instruments.length > 0) {
        printWindow.document.write(`
          <tr><th colspan='3' style='text-align:center;background:#e0e7ff;'>Instruments</th></tr>
        `);
        printWindow.document.write(`
          <tr>
            <td>${serial++}</td>
            <td>${proc.instruments.join(', ')}</td>
            <td></td>
          </tr>
        `);
      }
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

  // Fuzzy search for procedures
  const fuse = new Fuse(procedures, {
    keys: ['name'],
    threshold: 0.4, // Lower = stricter, higher = more forgiving
  });

  const filteredProcedures =
    searchQuery.trim() === ""
      ? procedures
      : fuse.search(searchQuery).map(result => result.item);

  // Add a handler to remove an instrument from a procedure
  const handleRemoveInstrument = (procedureName, instrument) => {
    setProcedures(prev =>
      prev.map(proc =>
        proc.name === procedureName
          ? { ...proc, instruments: proc.instruments.filter(inst => inst !== instrument) }
          : proc
      )
    );
    setActiveProcedures(prev =>
      prev.map(proc =>
        proc.name === procedureName
          ? { ...proc, instruments: proc.instruments.filter(inst => inst !== instrument) }
          : proc
      )
    );
  };

  // Refetch instruments for a single procedure from the sheet
  const refetchProcedureInstruments = (procedureName) => {
    fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQu2GZRYcJnEjFaDryWHowegMFVkf8xzewGsEKqNLw7onpe1if24LnJrIZAl4CB5QdgVFjE1PqFYmUa/pub?output=csv')
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            const found = results.data.find(([name]) => name && name.trim() === procedureName);
            if (found) {
              const instruments = found[4] ? found[4].split('|').map(inst => inst.trim()).filter(Boolean) : [];
              setProcedures(prev => prev.map(proc =>
                proc.name === procedureName ? { ...proc, instruments } : proc
              ));
              setActiveProcedures(prev => prev.map(proc =>
                proc.name === procedureName ? { ...proc, instruments } : proc
              ));
            }
          }
        });
      });
  };

  // Handler for input change
  const handleNewInstrumentInputChange = (procedureName, value) => {
    setNewInstrumentInputs(prev => ({ ...prev, [procedureName]: value }));
  };

  // Handler to add a new instrument
  const handleAddInstrument = (procedureName) => {
    const value = (newInstrumentInputs[procedureName] || '').trim();
    if (!value) return;
    setProcedures(prev => prev.map(proc =>
      proc.name === procedureName && !proc.instruments.includes(value)
        ? { ...proc, instruments: [...proc.instruments, value] }
        : proc
    ));
    setActiveProcedures(prev => prev.map(proc =>
      proc.name === procedureName && !proc.instruments.includes(value)
        ? { ...proc, instruments: [...proc.instruments, value] }
        : proc
    ));
    setNewInstrumentInputs(prev => ({ ...prev, [procedureName]: '' }));
  };

  // Handler for fixed item qty change
  const handleFixedQtyChange = (procedureName, itemName, value) => {
    setFixedQtyEdits(prev => ({
      ...prev,
      [`${procedureName}__${itemName}`]: value
    }));
    // Also update in procedures/activeProcedures for print
    setProcedures(prev => prev.map(proc =>
      proc.name === procedureName
        ? {
            ...proc,
            fixedList: proc.fixedList.map(fixed =>
              fixed.name === itemName ? { ...fixed, qty: value } : fixed
            )
          }
        : proc
    ));
    setActiveProcedures(prev => prev.map(proc =>
      proc.name === procedureName
        ? {
            ...proc,
            fixedList: proc.fixedList.map(fixed =>
              fixed.name === itemName ? { ...fixed, qty: value } : fixed
            )
          }
        : proc
    ));
  };

  // Handler to save summary as PDF
  const handleSavePDF = () => {
    setShowHospitalModal(true);
    setPendingPDF(true);
  };

  // Actually generate PDF after hospital name is entered
  const doSavePDF = () => {
    setShowHospitalModal(false);
    setPendingPDF(false);
    setTimeout(() => {
      if (printRef.current) {
        html2pdf().set({
          margin: 0.5,
          filename: `SRR-Ortho-Implant-DC-${dcNo || 'Summary'}.pdf`,
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        }).from(printRef.current).save();
      }
    }, 200); // Give modal time to close
  };

  if (!authenticated) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f3f4f6"
      }}>
        <div style={{
          background: "white",
          padding: 32,
          borderRadius: 8,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          minWidth: 320,
          width: 340
        }}>
          <h2 style={{ marginBottom: 16 }}>Enter Email & Password</h2>
          <input
            type="email"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 12, border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }}
            placeholder="Email"
            autoComplete="username"
            onKeyDown={e => {
              if (e.key === "Enter" && emailInput === EMAIL && passwordInput === PASSWORD) {
                setAuthenticated(true);
              }
            }}
          />
          <input
            type="password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 16, border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }}
            placeholder="Password"
            autoComplete="current-password"
            onKeyDown={e => {
              if (e.key === "Enter" && emailInput === EMAIL && passwordInput === PASSWORD) {
                setAuthenticated(true);
              }
            }}
          />
          <button
            onClick={() => {
              if (emailInput === EMAIL && passwordInput === PASSWORD) {
                setAuthenticated(true);
              } else {
                alert("Incorrect email or password");
              }
            }}
            style={{
              width: "100%",
              padding: 10,
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 4,
              fontWeight: 500,
              fontSize: 16,
              boxSizing: "border-box"
            }}
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-container" style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Responsive styles */}
      <style>{`
        @media (max-width: 900px) {
          .procedure-grid {
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)) !important;
          }
        }
        @media (max-width: 600px) {
          .main-container {
            padding: 8px !important;
          }
          .procedure-grid {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
          .responsive-row {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .responsive-btn, .responsive-input {
            width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
          }
          .responsive-modal {
            max-width: 340px !important;
            width: 96vw !important;
            padding: 6px 6px 16px 6px !important;
            min-width: 0 !important;
          }
          .responsive-table {
            display: block !important;
            overflow-x: auto !important;
            width: 100% !important;
          }
        }
      `}</style>
      {/* End responsive styles */}
      {showDcNoModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="responsive-modal" style={{ background: "white", padding: 24, borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.2)", maxWidth: 400, width: "100%", minWidth: 0 }}>
            <h2 style={{ fontSize: 20, fontWeight: "bold", marginBottom: 16 }}>Enter DC No</h2>
            <input
              className="responsive-input"
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
        <h1 style={{ fontSize: 28, fontWeight: "bold" }}>SRR Ortho Implant DC Generator</h1>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <input
          className="responsive-input"
          placeholder="Hospital Name"
          value={hospitalName}
          onChange={e => setHospitalName(e.target.value)}
          style={{ width: 220, padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
        />
        <input
          className="responsive-input"
          placeholder="DC No"
          value={dcNo}
          onChange={e => setDcNo(e.target.value)}
          style={{ width: 160, padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
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

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24, gap: 8 }} className="responsive-row">
        <button
          className="responsive-btn"
          onClick={() => setShowProcedures((prev) => !prev)}
          style={{ padding: "10px 24px", borderRadius: 6, background: "#000", color: "#fff", border: "none", fontWeight: 500, fontSize: 16, cursor: "pointer" }}
        >
          {showProcedures ? "Hide Procedures" : "Show All Procedures"}
        </button>
      </div>

      {(showProcedures || searchQuery.trim() !== "") && (
        <div className="procedure-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
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
      )}

      {activeProcedures.map((procedure) => (
        <div key={procedure.name} style={{ marginTop: 24, border: "1px solid #eee", borderRadius: 8, background: "#fafbfc" }}>
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 20, fontWeight: 600 }}>{procedure.name} Items</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => toggleCollapse(procedure.name)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  {collapsedProcedures[procedure.name] ? <ChevronDown /> : <ChevronUp />}
                </button>
                <button
                  onClick={() => {
                    // Remove all selected items for this procedure
                    setSelectedItems(prev => {
                      const updated = { ...prev };
                      Object.keys(updated).forEach(key => {
                        if (key.startsWith(procedure.name + "__")) {
                          delete updated[key];
                        }
                      });
                      return updated;
                    });
                    // Remove from activeProcedures
                    setActiveProcedures(prev => prev.filter(p => p.name !== procedure.name));
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', marginLeft: 4 }}
                  title={`Delete ${procedure.name}`}
                >
                  <Trash2 style={{ width: 20, height: 20 }} />
                </button>
              </div>
            </div>
            {!collapsedProcedures[procedure.name] &&
              <>
                {/* Fixed items (read-only) */}
                {procedure.fixedList && procedure.fixedList.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    {procedure.fixedList.map((fixed, idx) => (
                      <div key={fixed.name + idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <input type="checkbox" checked readOnly disabled style={{ accentColor: '#000' }} />
                        <span>{fixed.name}</span>
                        <input
                          type="number"
                          value={fixedQtyEdits[`${procedure.name}__${fixed.name}`] ?? fixed.qty}
                          onChange={e => handleFixedQtyChange(procedure.name, fixed.name, e.target.value)}
                          style={{ width: 60, padding: 6, border: '1px solid #ccc', borderRadius: 4, background: '#fff', color: '#222' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {/* Editable items (old logic) */}
                {procedure.items.map((item) => {
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
                {/* Instruments section after items */}
                {procedure.instruments && procedure.instruments.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', fontWeight: 600, marginBottom: 4 }}>
                      <span>Instruments</span>
                      <button
                        onClick={() => refetchProcedureInstruments(procedure.name)}
                        style={{
                          marginLeft: 8,
                          background: 'none',
                          border: 'none',
                          color: '#000',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: 16,
                          lineHeight: 1
                        }}
                        title="Refetch instruments from sheet"
                      >
                        ↻
                      </button>
                    </div>
                    <div style={{ color: "#555", fontStyle: "italic", display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {procedure.instruments.map((inst, idx) => (
                        <span key={inst + idx} style={{ display: "flex", alignItems: "center", background: "#e0e7ff", borderRadius: 4, padding: "2px 8px", marginRight: 4, marginBottom: 4 }}>
                          {inst}
                          <button
                            onClick={() => handleRemoveInstrument(procedure.name, inst)}
                            style={{
                              marginLeft: 6,
                              background: "none",
                              border: "none",
                              color: "#ef4444",
                              fontWeight: "bold",
                              cursor: "pointer",
                              fontSize: 14,
                              lineHeight: 1
                            }}
                            title="Remove instrument"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    {/* Add new instrument input */}
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        placeholder="Add instrument"
                        value={newInstrumentInputs[procedure.name] || ''}
                        onChange={e => handleNewInstrumentInputChange(procedure.name, e.target.value)}
                        style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4, minWidth: 120 }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddInstrument(procedure.name);
                        }}
                      />
                      <button
                        onClick={() => handleAddInstrument(procedure.name)}
                        style={{ padding: '6px 16px', borderRadius: 4, background: '#000', color: '#fff', border: 'none', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
                        disabled={!(newInstrumentInputs[procedure.name] || '').trim() || (procedure.instruments || []).includes((newInstrumentInputs[procedure.name] || '').trim())}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </>
            }
          </div>
        </div>
      ))}

      <div style={{ marginTop: 32, display: "flex", gap: 16 }}>
        <button onClick={handlePrint} style={{ padding: "10px 24px", borderRadius: 6, background: "#000", color: "#fff", border: "none", fontWeight: 500, fontSize: 16, cursor: "pointer" }}> Print</button>
        <button onClick={handleSavePDF} style={{ padding: "10px 24px", borderRadius: 6, background: "#000", color: "#fff", border: "none", fontWeight: 500, fontSize: 16, cursor: "pointer" }}>Save as PDF</button>
        <button onClick={handleClearAll} style={{ padding: "10px 24px", borderRadius: 6, background: "#ef4444", color: "white", border: "none", fontWeight: 500, fontSize: 16, cursor: "pointer" }}>Clear All</button>
      </div>

      {showHospitalModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="responsive-modal" style={{ background: "white", padding: 24, borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.2)", maxWidth: 400, width: "100%", minWidth: 0 }}>
            <h2 style={{ fontSize: 20, fontWeight: "bold", marginBottom: 16 }}>Enter Hospital Name</h2>
            <input
              className="responsive-input"
              placeholder="Hospital Name"
              value={hospitalName}
              onChange={e => setHospitalName(e.target.value)}
              style={{ marginBottom: 16, width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowHospitalModal(false)} style={{ padding: "6px 12px", borderRadius: 4, border: "1px solid #ccc", background: "white" }}>Cancel</button>
              <button onClick={doSavePDF} style={{ padding: "6px 12px", borderRadius: 4, background: "#000", color: "white", border: "none" }} disabled={!hospitalName.trim()}>Save PDF</button>
            </div>
          </div>
        </div>
      )}

      <div ref={printRef} className="hidden-print responsive-table" style={{ marginTop: 24, padding: 16, border: "1px solid #eee", borderRadius: 8, background: "white" }}>
        {/* Hospital Name and DC No at the top */}
        {hospitalName && (
          <div style={{ textAlign: 'right', fontWeight: 600, marginBottom: 4 }}>
            <span>Hospital: {hospitalName}</span>
          </div>
        )}
        <div style={{ textAlign: 'right', fontWeight: 600, marginBottom: 8 }}>
          <span>DC No: {dcNo}</span>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>SUMMARY</h2>
        <ol style={{ paddingLeft: 20 }}>
          {activeProcedures.map(proc => (
            proc.fixedList && proc.fixedList.length > 0 && proc.fixedList.map((fixed, idx) => (
              <li key={proc.name + fixed.name + idx} style={{ marginBottom: 4 }}>
                {formatText(fixed.name)}: {fixedQtyEdits[`${proc.name}__${fixed.name}`] ?? fixed.qty}
              </li>
            ))
          ))}
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
        {/* Instruments summary for each selected procedure */}
        <div style={{ marginTop: 12 }}>
          {activeProcedures.map(proc => (
            proc.instruments && proc.instruments.length > 0 ? (
              <div key={proc.name} style={{ color: "#555", fontStyle: "italic", marginBottom: 4 }}>
                <strong>Instruments for {proc.name}:</strong> {proc.instruments.join(", ")} (qty 1 each)
              </div>
            ) : null
          ))}
        </div>
      </div>
    </div>
  );
}
