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
  const printRef = useRef();
  const [showProcedures, setShowProcedures] = useState(false);
  const [newInstrumentInputs, setNewInstrumentInputs] = useState({});
  const [fixedQtyEdits, setFixedQtyEdits] = useState({});
  const [hospitalName, setHospitalName] = useState("");
  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [pendingPDF, setPendingPDF] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [focusSizeInput, setFocusSizeInput] = useState(null);
  const sizeInputRefs = useRef({});
  const [newItemInputs, setNewItemInputs] = useState({});
  const [selectedFixedItems, setSelectedFixedItems] = useState({});
  const [procedureTypes, setProcedureTypes] = useState([]);
  const [selectedProcedureType, setSelectedProcedureType] = useState("All");

  // Fetch procedures from Google Sheet
  const fetchProcedures = () => {
    fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQu2GZRYcJnEjFaDryWHowegMFVkf8xzewGsEKqNLw7onpe1if24LnJrIZAl4CB5QdgVFjE1PqFYmUa/pub?output=csv')
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            const parsedProcedures = results.data.slice(1).map(([name, items, fixedItems, fixedQty, instruments, type]) => {
              // Parse fixed items and qtys strictly by | only
              const fixedItemsArr = fixedItems ? fixedItems.split('|').map(s => s.trim()).filter(Boolean) : [];
              const fixedQtyArr = fixedQty ? fixedQty.split('|').map(s => s.trim()).filter(Boolean) : [];
              const fixedList = fixedItemsArr.map((item, idx) => ({ name: item, qty: fixedQtyArr[idx] || '' }));
              // Parse editable items (from Items column only, pipe-separated)
              const editableItems = items
                ? items.split('|').map(item => item.trim()).filter(Boolean)
                : [];
              return {
                name: name.trim(),
                items: editableItems,
                fixedList,
                instruments: instruments ? instruments.split('|').map(inst => inst.trim()).filter(Boolean) : [],
                type: type ? type.trim() : 'Others',
              };
            });
            setProcedures(parsedProcedures);
            setActiveProcedures([]); // Optionally clear active procedures on refetch

            // Initialize selectedFixedItems state
            const initialSelectedFixed = {};
            parsedProcedures.forEach(procedure => {
              if (procedure.fixedList) {
                procedure.fixedList.forEach(fixed => {
                  initialSelectedFixed[`${procedure.name}__${fixed.name}`] = true;
                });
              }
            });
            setSelectedFixedItems(initialSelectedFixed);

            // Extract unique procedure types
            const types = [...new Set(parsedProcedures.map(p => p.type))].filter(Boolean).sort();
            setProcedureTypes(['All', ...types]);
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
        // Parse for {Size:Qty,...} in the item string
        let pairs = [];
        const braceStart = item.indexOf('{');
        const braceEnd = item.lastIndexOf('}');
        if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
          const inside = item.slice(braceStart + 1, braceEnd);
          pairs = inside.split(',').map(pair => {
            const [size, qty] = pair.split(':').map(s => (s || '').trim());
            return (size || qty) ? { size: size || '', qty: qty || '' } : null;
          }).filter(Boolean);
        }
        if (pairs.length === 0) pairs = [{ size: '', qty: '' }];
        return { ...prev, [key]: pairs };
      }
    });
  };

  const handleAddSizeQty = (key) => {
    setSelectedItems((prev) => {
      const newArr = [...(prev[key] || []), { size: "", qty: 1 }];
      setFocusSizeInput({ key, index: newArr.length - 1 });
      return { ...prev, [key]: newArr };
    });
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
    setActiveProcedures([]);
    setSelectedFixedItems({});
  };

  const handlePrint = () => {
    if (!hospitalName.trim() || !dcNo.trim()) {
      setShowHospitalModal(true);
      setPendingPDF(false);
      return;
    }
    setShowPrintPreview(true);
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

  // Filter by selected type
  const typeFilteredProcedures = selectedProcedureType === 'All'
    ? filteredProcedures
    : filteredProcedures.filter(proc => proc.type === selectedProcedureType);

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

  // Handler for new item input change
  const handleNewItemInputChange = (procedureName, value) => {
    setNewItemInputs(prev => ({ ...prev, [procedureName]: value }));
  };

  // Handler to add a new item
  const handleAddItem = (procedureName) => {
    const value = (newItemInputs[procedureName] || '').trim();
    if (!value) return;
    setProcedures(prev => prev.map(proc =>
      proc.name === procedureName && !proc.items.includes(value)
        ? { ...proc, items: [...proc.items, value] }
        : proc
    ));
    setActiveProcedures(prev => prev.map(proc =>
      proc.name === procedureName && !proc.items.includes(value)
        ? { ...proc, items: [...proc.items, value] }
        : proc
    ));
    // Auto-select the new item (show + Add Size button)
    const key = `${procedureName}__${value}`;
    setSelectedItems(prev => ({ ...prev, [key]: [] }));
    setNewItemInputs(prev => ({ ...prev, [procedureName]: '' }));
  };

  // Handler to save summary as PDF
  const handleSavePDF = () => {
    if (!hospitalName.trim() || !dcNo.trim()) {
      setShowHospitalModal(true);
      setPendingPDF(true);
    } else {
      doSavePDF();
    }
  };

  // Actually generate PDF after hospital name is entered
  const doSavePDF = () => {
    if (printRef.current) {
      const options = {
        margin: 0.5,
        filename: `SRR-Ortho-Implant-DC-${dcNo || 'Summary'}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      };
      html2pdf().set(options).from(printRef.current).save();
    }
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

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: "bold", textAlign: "center", width: "100%", marginBottom: 32 }}>SRR Ortho Implant DC Generator</h1>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <input
          className="responsive-input"
          placeholder="Hospital Name"
          value={hospitalName}
          onChange={e => setHospitalName(e.target.value)}
          style={{ width: 220, padding: 8, border: "1px solid #ccc", borderRadius: 4, textAlign: 'left' }}
        />
        <input
          className="responsive-input"
          placeholder="DC No"
          value={dcNo}
          onChange={e => setDcNo(e.target.value)}
          style={{ width: 160, padding: 8, border: "1px solid #ccc", borderRadius: 4, textAlign: 'right' }}
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
        {/* Type filter buttons */}
        {procedureTypes.map(type => (
          <button
            key={type}
            onClick={() => {
              setSelectedProcedureType(type);
              setShowProcedures(true);
            }}
            style={{
              padding: "10px 16px",
              borderRadius: 6,
              border: selectedProcedureType === type ? "2px solid #2563eb" : "1px solid #ccc",
              background: selectedProcedureType === type ? "#2563eb" : "white",
              color: selectedProcedureType === type ? "white" : "#222",
              fontWeight: 500,
              cursor: "pointer"
            }}
          >
            {type}
          </button>
        ))}
        <button
          className="responsive-btn"
          onClick={() => setShowProcedures((prev) => !prev)}
          style={{ padding: "10px 24px", borderRadius: 6, background: "#000", color: "#fff", border: "none", fontWeight: 500, fontSize: 16, cursor: "pointer" }}
        >
          {showProcedures ? "Hide Procedures" : "Show Selected Procedures"}
        </button>
      </div>

      {(showProcedures || searchQuery.trim() !== "") && (
        <div className="procedure-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {typeFilteredProcedures.map((procedure) => (
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
                {/* Fixed items (editable checkbox) */}
                {procedure.fixedList && procedure.fixedList.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    {procedure.fixedList.map((fixed, idx) => {
                      const key = `${procedure.name}__${fixed.name}`;
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <input
                            type="checkbox"
                            checked={selectedFixedItems[key] || false}
                            onChange={() => setSelectedFixedItems(prev => ({ ...prev, [key]: !prev[key] }))}
                            style={{ accentColor: '#000' }}
                          />
                          <span>{fixed.name}</span>
                          <input
                            type="number"
                            value={fixedQtyEdits[key] ?? fixed.qty}
                            onChange={e => handleFixedQtyChange(procedure.name, fixed.name, e.target.value)}
                            style={{ width: 60, padding: 6, border: '1px solid #ccc', borderRadius: 4, background: '#fff', color: '#222' }}
                          />
                        </div>
                      );
                    })}
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
                        <span>{item.split('{')[0].trim()}</span>
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
                              ref={el => {
                                sizeInputRefs.current[`${key}-${index}`] = el;
                                if (
                                  focusSizeInput &&
                                  focusSizeInput.key === key &&
                                  focusSizeInput.index === index &&
                                  el
                                ) {
                                  el.focus();
                                  setFocusSizeInput(null);
                                }
                              }}
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
                {/* Add new item input */}
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Add item"
                    value={newItemInputs[procedure.name] || ''}
                    onChange={e => handleNewItemInputChange(procedure.name, e.target.value)}
                    style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4, minWidth: 120 }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddItem(procedure.name);
                    }}
                  />
                  <button
                    onClick={() => handleAddItem(procedure.name)}
                    style={{ padding: '6px 16px', borderRadius: 4, background: '#000', color: '#fff', border: 'none', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
                    disabled={!(newItemInputs[procedure.name] || '').trim() || (procedure.items || []).includes((newItemInputs[procedure.name] || '').trim())}
                  >
                    Add
                  </button>
                </div>
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

      {activeProcedures.length > 0 && (
        <div style={{ marginTop: 32, display: "flex", gap: 16 }}>
          <button
            onClick={handlePrint}
            style={{
              padding: "10px 24px",
              borderRadius: 6,
              background: "#000",
              color: "#fff",
              border: "none",
              fontWeight: 500,
              fontSize: 16,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "background 0.2s"
            }}
            onMouseOver={e => e.currentTarget.style.background = "#1e293b"}
            onMouseOut={e => e.currentTarget.style.background = "#000"}
          >
            <span role="img" aria-label="Print">🖨️</span> Print
          </button>
          <button
            onClick={handleSavePDF}
            style={{
              padding: "10px 24px",
              borderRadius: 6,
              background: "#2563eb",
              color: "#fff",
              border: "none",
              fontWeight: 500,
              fontSize: 16,
              cursor: "pointer"
            }}
          >
            Download PDF
          </button>
          <button onClick={handleClearAll} style={{ padding: "10px 24px", borderRadius: 6, background: "#ef4444", color: "white", border: "none", fontWeight: 500, fontSize: 16, cursor: "pointer" }}>Clear All</button>
        </div>
      )}

      {activeProcedures.length > 0 && (
        <div style={{ marginTop: 24, background: '#f8fafc', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontWeight: 600, marginBottom: 12 }}>Summary</h3>
          <div>
            {activeProcedures.map(proc => {
              const lines = [];
              let hasItems = false;
              // Fixed items
              if (proc.fixedList && proc.fixedList.length > 0) {
                proc.fixedList.forEach(fixed => {
                  const key = `${proc.name}__${fixed.name}`;
                  if (selectedFixedItems[key]) {
                    lines.push(
                      <div key={key}>
                        {fixed.name} - {fixedQtyEdits[key] ?? fixed.qty}
                      </div>
                    );
                    hasItems = true;
                  }
                });
              }
              // Editable items
              proc.items.forEach(item => {
                const key = `${proc.name}__${item}`;
                if (selectedItems[key] && selectedItems[key].length > 0) {
                  // Extract just the item name before {}
                  const itemName = item.split('{')[0].trim();
                  // Group all sizes/qtys for this item
                  const sizeQtys = selectedItems[key]
                    .map(entry => `${entry.size || ''}${entry.size ? '-' : ''}${entry.qty}`)
                    .join(', ');
                  const totalQty = selectedItems[key].reduce((sum, entry) => sum + Number(entry.qty || 0), 0);
                  lines.push(
                    <div key={proc.name + '-' + item}>
                      {itemName} {sizeQtys} <b>(Total: {totalQty})</b>
                    </div>
                  );
                  hasItems = true;
                }
              });
              // Instruments
              const instrumentLines = (proc.instruments && proc.instruments.length > 0)
                ? <div style={{ marginTop: 6, fontStyle: 'italic', color: '#444' }}>Instruments: {proc.instruments.join(', ')}</div>
                : null;
              return (
                <div key={proc.name} style={{ marginBottom: 18 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{proc.name}</div>
                  {hasItems ? lines : <div style={{ color: '#888' }}>No items selected.</div>}
                  {instrumentLines}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showHospitalModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="responsive-modal" style={{ background: "white", padding: 24, borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.2)", maxWidth: 400, width: "100%", minWidth: 0 }}>
            <h2 style={{ fontSize: 20, fontWeight: "bold", marginBottom: 16 }}>Enter Hospital Name & DC No</h2>
            <input
              className="responsive-input"
              placeholder="Hospital Name"
              value={hospitalName}
              onChange={e => setHospitalName(e.target.value)}
              style={{ marginBottom: 12, width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
            />
            <input
              className="responsive-input"
              placeholder="DC No"
              value={dcNo}
              onChange={e => setDcNo(e.target.value)}
              style={{ marginBottom: 16, width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowHospitalModal(false)} style={{ padding: "6px 12px", borderRadius: 4, border: "1px solid #ccc", background: "white" }}>Cancel</button>
              <button onClick={() => {
                if (hospitalName.trim() && dcNo.trim()) {
                  setShowHospitalModal(false);
                  if (pendingPDF) {
                    doSavePDF();
                  } else {
                    setShowPrintPreview(true);
                  }
                }
              }} style={{ padding: "6px 12px", borderRadius: 4, background: "#000", color: "white", border: "none" }} disabled={!hospitalName.trim() || !dcNo.trim()}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && (
        <div data-print-modal style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 8, maxWidth: 900, width: '98vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 2px 16px rgba(0,0,0,0.25)', padding: 24, position: 'relative' }}>
            <h2 style={{ textAlign: 'center', fontWeight: 700, marginBottom: 16 }}>SUMMARY</h2>
            <div id="print-preview-content" ref={printRef}>
           
              {/* Print-specific styles for table borders and full-page print */}
              <style>{`
                #print-preview-content table, #print-preview-content th, #print-preview-content td {
                  border: 1px solid #222;
                  border-collapse: collapse;
                }
                #print-preview-content th, #print-preview-content td {
                  padding: 8px;
                }
                @media print {
                  body * { visibility: hidden !important; }
                  #print-preview-content, #print-preview-content * {
                    visibility: visible !important;
                  }
                  #print-preview-content {
                    position: fixed !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    background: white !important;
                    z-index: 9999 !important;
                    overflow: visible !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                  [data-print-modal] {
                    all: unset !important;
                    display: block !important;
                    position: static !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    background: none !important;
                    box-shadow: none !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    overflow: visible !important;
                  }
                }
              `}</style>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontWeight: 600 }}>Hospital: {hospitalName}</span>
                <span style={{ fontWeight: 600 }}>DC No: {dcNo}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th>Sl No</th>
                    <th>Description</th>
                    <th>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let serial = 1;
                    const rows = [];
                    activeProcedures.forEach(proc => {
                      // Procedure heading
                      rows.push(
                        <tr key={proc.name + '-heading'}>
                          <td colSpan={3} style={{ background: '#f1f5f9', fontWeight: 'bold' }}>{proc.name}</td>
                        </tr>
                      );
                      // Fixed items
                      if (proc.fixedList && proc.fixedList.length > 0) {
                        proc.fixedList.forEach((fixed, idx) => {
                          const key = `${proc.name}__${fixed.name}`;
                          if (selectedFixedItems[key]) {
                            rows.push(
                              <tr key={key}>
                                <td>{serial++}</td>
                                <td>{fixed.name}</td>
                                <td>{fixedQtyEdits[key] ?? fixed.qty}</td>
                              </tr>
                            );
                          }
                        });
                      }
                      // Editable items
                      proc.items.forEach(item => {
                        const key = `${proc.name}__${item}`;
                        if (selectedItems[key] && selectedItems[key].length > 0) {
                          // Extract just the item name before {}
                          const itemName = item.split('{')[0].trim();
                          const sizeQtys = selectedItems[key]
                            .map(entry => `${entry.size || ''}${entry.size ? '-' : ''}${entry.qty}`)
                            .join(', ');
                          const totalQty = selectedItems[key].reduce((sum, entry) => sum + Number(entry.qty || 0), 0);
                          rows.push(
                            <tr key={proc.name + '-' + item}>
                              <td>{serial++}</td>
                              <td>{itemName} {sizeQtys}</td>
                              <td>{totalQty}</td>
                            </tr>
                          );
                        }
                      });
                      // Instruments
                      if (proc.instruments && proc.instruments.length > 0) {
                        rows.push(
                          <tr key={proc.name + '-inst-heading'}>
                            <td colSpan={3} style={{ background: '#e0e7ff', fontWeight: 'bold' }}>Instruments</td>
                          </tr>
                        );
                        rows.push(
                          <tr key={proc.name + '-inst-row'}>
                            <td>{serial++}</td>
                            <td colSpan={2}>{proc.instruments.join(', ')}</td>
                          </tr>
                        );
                      }
                    });
                    return rows;
                  })()}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '40px 0 0 0' }}>
                <div>Receiver's Sign</div>
                <div>Authorized Sign</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button onClick={() => setShowPrintPreview(false)} style={{ padding: '8px 20px', borderRadius: 4, border: '1px solid #ccc', background: 'white', fontWeight: 500, fontSize: 16 }}>Close</button>
              <button onClick={doSavePDF} style={{ padding: '8px 20px', borderRadius: 4, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 500, fontSize: 16 }}>Download PDF</button>
              <button onClick={() => window.print()} style={{ padding: '8px 20px', borderRadius: 4, background: '#000', color: '#fff', border: 'none', fontWeight: 500, fontSize: 16 }}>Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
