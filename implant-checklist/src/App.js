import { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import Fuse from "fuse.js";
import html2pdf from "html2pdf.js";
import { Pencil, RefreshCcw } from "lucide-react";

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
  const partPrintRef = useRef();
  const [showProcedures, setShowProcedures] = useState(false);
  const [newInstrumentInputs, setNewInstrumentInputs] = useState({});
  const [fixedQtyEdits, setFixedQtyEdits] = useState({});
  const [hospitalName, setHospitalName] = useState("");
  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [pendingPDF, setPendingPDF] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showPartPrintPreview, setShowPartPrintPreview] = useState(false);
  const [requestedPrintType, setRequestedPrintType] = useState(null); // 'regular' or 'part'
  const [focusSizeInput, setFocusSizeInput] = useState(null);
  const sizeInputRefs = useRef({});
  const [newItemInputs, setNewItemInputs] = useState({});
  const [selectedFixedItems, setSelectedFixedItems] = useState({});
  const [procedureTypes, setProcedureTypes] = useState([]);
  const [selectedProcedureType, setSelectedProcedureType] = useState("All");
  const [showItemDetails, setShowItemDetails] = useState({});
  const [selectedProcedureMaterials, setSelectedProcedureMaterials] = useState({});
  const [instrumentSuggestions, setInstrumentSuggestions] = useState({});
  const [itemSuggestions, setItemSuggestions] = useState({});
  const [showInstrumentSuggestions, setShowInstrumentSuggestions] = useState({});
  const [showItemSuggestions, setShowItemSuggestions] = useState({});
  const [highlightedInstrumentIndex, setHighlightedInstrumentIndex] = useState({});
  const [highlightedItemIndex, setHighlightedItemIndex] = useState({});

  // NEW: State for editing procedures and items
  const [editingProcedureName, setEditingProcedureName] = useState(null);
  const [editingItemNameKey, setEditingItemNameKey] = useState(null);
  const [itemEditInputValues, setItemEditInputValues] = useState({});

  // Initialize Fuse.js for fuzzy search on items and instruments
  const itemFuse = useRef(null);
  const instrumentFuse = useRef(null);

  // Add new state for locking selection
  // State for controlling visibility of item lock buttons and item locking status
  const [showItemLocks, setShowItemLocks] = useState({});
  const [itemLocking, setItemLocking] = useState({});
  const [showItemLockingDropdown, setShowItemLockingDropdown] = useState({});

  const [refreshingProcedures, setRefreshingProcedures] = useState({});

  // Add this before the refetchSingleProcedure function
  const animateRefreshButton = (procedureName) => {
    setRefreshingProcedures(prev => ({ ...prev, [procedureName]: true }));
    setTimeout(() => {
      setRefreshingProcedures(prev => {
        const updated = { ...prev };
        delete updated[procedureName];
        return updated;
      });
    }, 1000); // Animation duration
  };

  // Effect to initialize Fuse.js instances when procedures data is loaded
  useEffect(() => {
    if (procedures.length > 0) {
      const allInstruments = [...new Set(procedures.flatMap(p => p.instruments))]; // Get unique instruments
      const allItems = [...new Set([
        ...procedures.flatMap(p => p.items),
        ...procedures.flatMap(p => p.fixedList.map(item => item.name))
      ])]; // Get unique original items and fixed item names

      instrumentFuse.current = new Fuse(allInstruments, {
        threshold: 0.4, // Increased threshold for more forgiving fuzzy search
      });

      itemFuse.current = new Fuse(allItems, {
        threshold: 0.4, // Increased threshold for more forgiving fuzzy search
        keys: [''], // Search the string elements directly
        ignoreLocation: true,
      });
    }
  }, [procedures]); // Re-initialize if procedures change

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
      // When removing a procedure, hide all its item details
      setShowItemDetails(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          if (key.startsWith(procedure.name + "__")) {
            delete updated[key];
          }
        });
        return updated;
      });
      setCollapsedProcedures((prev) => ({ ...prev, [procedure.name]: false }));
      // When adding a procedure, hide all its item details by default unless they already have selected sizes/qtys
      setShowItemDetails(prev => {
        const updated = { ...prev };
        // Initialize item details visibility. If item has selected sizes, show by default.
         procedure.items.forEach(item => {
           const key = `${procedure.name}__${item}`;
           if (!(key in updated)) { // Don't overwrite existing state if procedure was just collapsed/expanded
             updated[key] = selectedItems[key]?.length > 0; // Show if already has sizes, hide otherwise
           }
         });
         return updated;
      });

      // *** NEW: Explicitly select all fixed items for the newly active procedure ***
      setSelectedFixedItems(prev => {
          const updated = { ...prev };
          if (procedure.fixedList) {
              procedure.fixedList.forEach(fixed => {
                  updated[`${procedure.name}__${fixed.name}`] = true;
              });
          }
          return updated;
      });
    } else {
      setActiveProcedures((prev) => [...prev, procedure]);
      // Initialize material for the newly active procedure
      setSelectedProcedureMaterials(prev => ({ ...prev, [procedure.name]: 'SS' }));
      setCollapsedProcedures((prev) => ({ ...prev, [procedure.name]: false }));
      // When adding a procedure, hide all its item details by default unless they already have selected sizes/qtys
      setShowItemDetails(prev => {
        const updated = { ...prev };
        // Initialize item details visibility. If item has selected sizes, show by default.
         procedure.items.forEach(item => {
           const key = `${procedure.name}__${item}`;
           if (!(key in updated)) { // Don't overwrite existing state if procedure was just collapsed/expanded
             updated[key] = selectedItems[key]?.length > 0; // Show if already has sizes, hide otherwise
           }
         });
         return updated;
      });
    }
  };

  const toggleCollapse = (procedureName) => {
    setCollapsedProcedures((prev) => ({
      ...prev,
      [procedureName]: !prev[procedureName],
    }));
  };

  const handleItemChange = (procedureName, item) => {
    const itemNameBeforeBraces = item.split('{')[0].trim();
    const key = `${procedureName}__${itemNameBeforeBraces}`;
    setSelectedItems((prev) => {
      if (prev[key]) {
        // Item is currently selected, unselecting it
        const { [key]: _, ...rest } = prev;
        // When unselecting an item, also hide its details
        setShowItemDetails(prevDetails => {
          const updatedDetails = { ...prevDetails };
          delete updatedDetails[key];
          return updatedDetails;
        });
        return rest;
      } else {
        // Item is currently unselected, selecting it
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

        // When selecting an item, show its details by default
        setShowItemDetails(prevDetails => ({ ...prevDetails, [key]: true })); // Ensure details are shown

        return { ...prev, [key]: pairs };
      }
    });
  };

  const handleAddSizeQty = (key) => {
    setSelectedItems((prev) => {
      const newArr = [...(prev[key] || []), { size: "", qty: 1 }];
      setFocusSizeInput({ key, index: newArr.length - 1 });
      // Ensure item details are visible when adding a size/qty
      setShowItemDetails(prev => ({ ...prev, [key]: true }));
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
        // Hide item details if no sizes/qtys remain
        setShowItemDetails(prevDetails => {
           const updatedDetails = { ...prevDetails };
           delete updatedDetails[key];
           return updatedDetails;
        });
        return rest;
      }
      return { ...prev, [key]: updated };
    });
  };

  const handleClearAll = () => {
    setSelectedItems({});
    setActiveProcedures([]);
    setSelectedFixedItems({});
    setShowItemDetails({});
    // Clear all locking related states
    setShowItemLocks({});
    setItemLocking({});
    setShowItemLockingDropdown({});
  };

  const handlePrint = () => {
    setRequestedPrintType('regular');
    if (!hospitalName.trim() || !dcNo.trim()) {
      setShowHospitalModal(true);
      setPendingPDF(false);
      setShowPrintPreview(false);
      setShowPartPrintPreview(false);
      return;
    }
    setShowPrintPreview(true);
  };

  const handlePartPrint = () => {
    setRequestedPrintType('part');
    if (!hospitalName.trim() || !dcNo.trim()) {
      setShowHospitalModal(true);
      setPendingPDF(false);
      setShowPrintPreview(false);
      setShowPartPrintPreview(false);
      return;
    }
    setShowPartPrintPreview(true);
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

  // Refetch a single procedure's data from the sheet
  const refetchSingleProcedure = (procedureName) => {
    animateRefreshButton(procedureName);
    fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQu2GZRYcJnEjFaDryWHowegMFVkf8xzewGsEKqNLw7onpe1if24LnJrIZAl4CB5QdgVFjE1PqFYmUa/pub?output=csv')
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            const foundRow = results.data.slice(1).find(([name]) => name && name.trim() === procedureName);
            if (foundRow) {
              const [name, items, fixedItems, fixedQty, instruments, type] = foundRow;
              const fixedItemsArr = fixedItems ? fixedItems.split('|').map(s => s.trim()).filter(Boolean) : [];
              const fixedQtyArr = fixedQty ? fixedQty.split('|').map(s => s.trim()).filter(Boolean) : [];
              const fixedList = fixedItemsArr.map((item, idx) => ({ name: item, qty: fixedQtyArr[idx] || '' }));
              const editableItems = items
                ? items.split('|').map(item => item.trim()).filter(Boolean)
                : [];
              const updatedProcedure = {
                name: name.trim(),
                items: editableItems,
                fixedList,
                instruments: instruments ? instruments.split('|').map(inst => inst.trim()).filter(Boolean) : [],
                type: type ? type.trim() : 'Others',
              };

              // Update procedures state
              setProcedures(prev => prev.map(proc =>
                proc.name === procedureName ? updatedProcedure : proc
              ));

              // Update activeProcedures state
              setActiveProcedures(prev => prev.map(proc =>
                proc.name === procedureName ? updatedProcedure : proc
              ));

              // Re-initialize selectedFixedItems for this procedure with fetched data
              setSelectedFixedItems(prev => {
                  const updated = { ...prev };
                  // First, remove all previous fixed items for this procedure
                  Object.keys(updated).forEach(key => {
                      if (key.startsWith(procedureName + "__")) {
                          delete updated[key];
                      }
                  });
                  // Then, add the new/refreshed fixed items, all checked by default
                  updatedProcedure.fixedList.forEach(fixed => {
                      updated[`${procedureName}__${fixed.name}`] = true;
                  });
                  return updated;
              });

              // Clear fixedQtyEdits for this procedure as quantities are refetched
              setFixedQtyEdits(prev => {
                  const updated = { ...prev };
                   Object.keys(updated).forEach(key => {
                      if (key.startsWith(procedureName + "__")) {
                          delete updated[key];
                      }
                  });
                  return updated;
              });

              // *** NEW: Re-initialize selectedItems and showItemDetails for editable items based on refetched data ***
              setSelectedItems(prev => {
                  const updated = { ...prev };
                  // Remove all previous editable item selections for this procedure
                  Object.keys(updated).forEach(key => {
                      if (key.startsWith(procedureName + "__")) {
                          delete updated[key];
                      }
                  });
                  // Add selections and parse sizes/qtys based on the refetched item list
                  updatedProcedure.items.forEach(item => {
                      const key = `${procedureName}__${item}`;
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
                      // Only add to selectedItems if it has a pattern or should be selected by default
                      // For refresh, let's assume items from sheet with patterns should be selected and show details
                      if (pairs.length > 0) {
                           updated[key] = pairs;
                      } else {
                          // Optionally, you could decide if items without patterns should be selected by default on refresh.
                          // For now, we'll only auto-select items with parsed patterns.
                          // To auto-select all items from the sheet, uncomment the line below:
                          // updated[key] = [{ size: '', qty: 1 }];
                      }
                  });
                  return updated;
              });

               setShowItemDetails(prev => {
                  const updated = { ...prev };
                  // Remove all previous showItemDetails states for this procedure
                   Object.keys(updated).forEach(key => {
                      if (key.startsWith(procedureName + "__")) {
                          delete updated[key];
                      }
                  });
                   // Set showItemDetails to true for items that were just added to selectedItems (i.e., had patterns)
                  updatedProcedure.items.forEach(item => {
                       const key = `${procedureName}__${item}`;
                       if (selectedItems[key]) { // Check if it was added to selectedItems in the previous step
                           updated[key] = true;
                       }
                   });
                  return updated;
              });

              // Keep selectedItems state for editable items, as user selections should persist
              // Keep showItemDetails state for editable items
              // Also re-initialize material selection for this procedure on refetch
              setSelectedProcedureMaterials(prev => ({ ...prev, [procedureName]: 'SS' }));

              console.log(`Refreshed data for procedure: ${procedureName}`);
            } else {
              console.warn(`Procedure not found in sheet after refresh: ${procedureName}`);
            }
          }
        });
      })
      .catch(error => {
        console.error('Error refetching single procedure:', error);
      });
  };

  // Add a handler for instrument suggestion selection
  const handleInstrumentSuggestionClick = (procedureName, suggestion) => {
    handleNewInstrumentInputChange(procedureName, suggestion); // Put suggestion in input
    setShowInstrumentSuggestions(prev => ({ ...prev, [procedureName]: false })); // Hide suggestions
    setHighlightedInstrumentIndex(prev => ({ ...prev, [procedureName]: -1 })); // Reset highlight
  };

  // Add a handler for item suggestion selection
  const handleItemSuggestionClick = (procedureName, suggestion) => {
    handleNewItemInputChange(procedureName, suggestion); // Put suggestion in input
    setShowItemSuggestions(prev => ({ ...prev, [procedureName]: false })); // Hide suggestions
    setHighlightedItemIndex(prev => ({ ...prev, [procedureName]: -1 })); // Reset highlight
  };

  // Handler for input change
  const handleNewInstrumentInputChange = (procedureName, value) => {
    setNewInstrumentInputs(prev => ({ ...prev, [procedureName]: value }));

    // Filter instruments using Fuse.js if value is not empty
    if (value.trim() && instrumentFuse.current) {
      const results = instrumentFuse.current.search(value);
      setInstrumentSuggestions(prev => ({ ...prev, [procedureName]: results.map(r => r.item) }));
      setShowInstrumentSuggestions(prev => ({ ...prev, [procedureName]: true }));
      setHighlightedInstrumentIndex(prev => ({ ...prev, [procedureName]: -1 })); // Reset highlight on input change
    } else {
      setInstrumentSuggestions(prev => ({ ...prev, [procedureName]: [] }));
      setShowInstrumentSuggestions(prev => ({ ...prev, [procedureName]: false }));
      setHighlightedInstrumentIndex(prev => ({ ...prev, [procedureName]: -1 })); // Reset highlight if input is empty
    }
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
    setInstrumentSuggestions(prev => ({ ...prev, [procedureName]: [] })); // Clear suggestions on add
    setShowInstrumentSuggestions(prev => ({ ...prev, [procedureName]: false })); // Hide suggestions on add
    setHighlightedInstrumentIndex(prev => ({ ...prev, [procedureName]: -1 })); // Reset highlight on add
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

    // Filter items using Fuse.js if value is not empty
     if (value.trim() && itemFuse.current) {
       const results = itemFuse.current.search(value);
       setItemSuggestions(prev => ({ ...prev, [procedureName]: results.map(r => r.item) }));
       setShowItemSuggestions(prev => ({ ...prev, [procedureName]: true }));
       setHighlightedItemIndex(prev => ({ ...prev, [procedureName]: -1 })); // Reset highlight on input change
     } else {
       setItemSuggestions(prev => ({ ...prev, [procedureName]: [] }));
       setShowItemSuggestions(prev => ({ ...prev, [procedureName]: false }));
       setHighlightedItemIndex(prev => ({ ...prev, [procedureName]: -1 })); // Reset highlight if input is empty
     }
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
    // Parse for {Size:Qty,...} in the item string when adding
    let pairs = [];
    const braceStart = value.indexOf('{');
    const braceEnd = value.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
      const inside = value.slice(braceStart + 1, braceEnd);
      pairs = inside.split(',').map(pair => {
        const [size, qty] = pair.split(':').map(s => (s || '').trim());
        return (size || qty) ? { size: size || '', qty: qty || '' } : null;
      }).filter(Boolean);
    }
    if (pairs.length === 0) pairs = [{ size: '', qty: 1 }]; // Initialize with 1 qty if no pattern or empty sizes

    setSelectedItems(prev => ({ ...prev, [key]: pairs }));
    setShowItemDetails(prev => ({ ...prev, [key]: true })); // Ensure details are shown for the newly added item
    setNewItemInputs(prev => ({ ...prev, [procedureName]: '' }));
    setItemSuggestions(prev => ({ ...prev, [procedureName]: [] })); // Clear suggestions on add
    setShowItemSuggestions(prev => ({ ...prev, [procedureName]: false })); // Hide suggestions on add
    setHighlightedItemIndex(prev => ({ ...prev, [procedureName]: -1 })); // Reset highlight on add
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
    const targetRef = showPartPrintPreview ? partPrintRef : printRef;
    if (targetRef.current) {
      const options = {
        margin: 0.5,
        filename: `SRR-Ortho-Implant-DC-${dcNo || 'Summary'}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { 
          unit: 'in', 
          format: 'a4', 
          orientation: showPartPrintPreview ? 'landscape' : 'portrait' 
        },
      };
      html2pdf().set(options).from(targetRef.current).save();
    }
  };

  // NEW: Handle saving edited item name (for both fixed and editable items)
  const handleSaveItemName = (procedureName, oldItemName, newItemName, isFixed) => {
      const oldKey = `${procedureName}__${oldItemName}`;
      const newKey = `${procedureName}__${newItemName}`;

      if (!newItemName.trim()) { // Prevent saving empty names
          alert('Item name cannot be empty.');
          return;
      }

      // Update procedures and activeProcedures state
      setProcedures(prevProcedures =>
          prevProcedures.map(proc => {
              if (proc.name === procedureName) {
                  if (isFixed) {
                      return {
                          ...proc,
                          fixedList: proc.fixedList.map(fixed =>
                              fixed.name === oldItemName ? { ...fixed, name: newItemName } : fixed
                          ),
                      };
                  } else {
                      return {
                          ...proc,
                          items: proc.items.map(item => {
                              const itemNameBeforeBraces = item.split('{')[0].trim();
                              const restOfItem = item.includes('{') ? '{' + item.split('{')[1] : '';
                              return itemNameBeforeBraces === oldItemName ? `${newItemName}${restOfItem}` : item;
                          }),
                      };
                  }
              } else {
                  return proc;
              }
          })
      );

      setActiveProcedures(prevActiveProcedures =>
          prevActiveProcedures.map(proc => {
              if (proc.name === procedureName) {
                  if (isFixed) {
                       return {
                          ...proc,
                          fixedList: proc.fixedList.map(fixed =>
                              fixed.name === oldItemName ? { ...fixed, name: newItemName } : fixed
                          ),
                      };
                  } else {
                      return {
                          ...proc,
                          items: proc.items.map(item => {
                               const itemNameBeforeBraces = item.split('{')[0].trim();
                               const restOfItem = item.includes('{') ? '{' + item.split('{')[1] : '';
                               return itemNameBeforeBraces === oldItemName ? `${newItemName}${restOfItem}` : item;
                          }),
                      };
                  }
              } else {
                  return proc;
              }
          })
      );

      // Update keys in selectedItems (only for editable items)
      if (!isFixed && selectedItems[oldKey]) {
          setSelectedItems(prev => {
              const { [oldKey]: value, ...rest } = prev;
              return { ...rest, [newKey]: value };
          });
      }

      // Update keys in showItemDetails
      if (showItemDetails[oldKey]) {
           setShowItemDetails(prev => {
               const { [oldKey]: value, ...rest } = prev;
               return { ...rest, [newKey]: value };
           });
      }

      // Update keys in selectedFixedItems (only for fixed items)
      if (isFixed && selectedFixedItems[oldKey]) {
           setSelectedFixedItems(prev => {
               const { [oldKey]: value, ...rest } = prev;
               return { ...rest, [newKey]: value };
           });
      }

      // Update keys in fixedQtyEdits (only for fixed items)
       if (isFixed && fixedQtyEdits[oldKey]) {
            setFixedQtyEdits(prev => {
                const { [oldKey]: value, ...rest } = prev;
                return { ...rest, [newKey]: value };
            });
       }

      // Reset editing state
      setEditingItemNameKey(null);
      setItemEditInputValues(prev => { const { [oldKey]: _, ...rest } = prev; return rest; });

      // Re-initialize Fuse.js instances if item names have changed
      if (procedures.length > 0) {
          const allInstruments = [...new Set(procedures.flatMap(p => p.instruments))]; // Get unique instruments
          const allItems = [...new Set([
            ...procedures.flatMap(p => p.items),
            ...procedures.flatMap(p => p.fixedList.map(item => item.name))
          ])]; // Get unique original items and fixed item names

          instrumentFuse.current = new Fuse(allInstruments, {
            threshold: 0.4, // Increased threshold for more forgiving fuzzy search
          });

          itemFuse.current = new Fuse(allItems, {
            threshold: 0.4, // Increased threshold for more forgiving fuzzy search
            keys: [''], // Search the string elements directly
            ignoreLocation: true,
          });
        }

  };

  // NEW: Handle canceling item name edit
  const handleCancelItemNameEdit = (key) => {
      setEditingItemNameKey(null);
      setItemEditInputValues(prev => { const { [key]: _, ...rest } = prev; return rest; });
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

      {/* Main content */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: "bold", textAlign: "center", width: "100%", marginBottom: 32 }}>
          SRR Ortho Implant DC Generator
        </h1>
      </div>

      {/* Hospital and DC inputs */}
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

      {/* Search input */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Search Procedures"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
        />
      </div>

        {/* Type filter buttons */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24, gap: 8 }} className="responsive-row">
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

      {/* Procedures grid */}
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

      {/* Active procedures */}
      {activeProcedures.map((procedure) => (
        <div key={procedure.name} style={{ marginTop: 24, border: "1px solid #eee", borderRadius: 8, background: "#fafbfc" }}>
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 20, fontWeight: 600 }}>{procedure.name} Items</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select
                  value={selectedProcedureMaterials[procedure.name] || 'SS'}
                  onChange={(e) => setSelectedProcedureMaterials(prev => ({ ...prev, [procedure.name]: e.target.value }))}
                  style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, appearance: 'none', background: 'white url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.362%22%20height%3D%22292.362%22%3E%3Cpath%20fill%3D%22%23000000%22%20d%3D%22M287.9.9L146.213%20142.6l-141.68-141.7L0%205.193l146.213%20146.213L292.362%205.193z%22%2F%3E%3C%2Fsvg%3E") no-repeat right 8px center / 8px 10px' }}
                >
                  <option value="SS">SS</option>
                  <option value="Titanium">Titanium</option>
                </select>
                <button
                  onClick={() => setShowItemLocks(prev => ({ ...prev, [procedure.name]: !prev[procedure.name] }))}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    color: showItemLocks[procedure.name] ? '#2563eb' : '#666'
                  }}
                  title={showItemLocks[procedure.name] ? "Hide locking options" : "Show locking options"}
                >
                  🔒
                </button>
                <button onClick={() => toggleCollapse(procedure.name)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  {collapsedProcedures[procedure.name] ? <ChevronDown /> : <ChevronUp />}
                </button>
                <button
                  onClick={() => refetchSingleProcedure(procedure.name)}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer', 
                    color: '#555', 
                    padding: 4, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    transform: refreshingProcedures[procedure.name] ? 'rotate(360deg)' : 'none',
                    transition: 'transform 1s ease'
                  }}
                  title={`Refresh ${procedure.name} from sheet`}
                >
                  <RefreshCcw 
                    size={18} 
                    style={{
                      animation: refreshingProcedures[procedure.name] ? 'spin 1s linear' : 'none'
                    }}
                  />
                </button>
                      <button
                   onClick={() => setEditingProcedureName(editingProcedureName === procedure.name ? null : procedure.name)}
                   style={{ background: 'none', border: 'none', cursor: 'pointer', color: editingProcedureName === procedure.name ? '#2563eb' : '#555', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                   title={editingProcedureName === procedure.name ? `Cancel editing ${procedure.name}` : `Edit ${procedure.name}`}
                >
                    <Pencil size={18} />
                </button>
                <button
                  onClick={() => {
                    // First refresh the procedure data
                    fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQu2GZRYcJnEjFaDryWHowegMFVkf8xzewGsEKqNLw7onpe1if24LnJrIZAl4CB5QdgVFjE1PqFYmUa/pub?output=csv')
                      .then(response => response.text())
                      .then(csvText => {
                        Papa.parse(csvText, {
                          header: false,
                          skipEmptyLines: true,
                          complete: (results) => {
                            // After refresh, proceed with deletion
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

                            // Clear lock visibility and locking status for this procedure
                            setShowItemLocks(prev => {
                              const updated = { ...prev };
                              delete updated[procedure.name];
                              return updated;
                            });

                            setItemLocking(prev => {
                              const updated = { ...prev };
                              Object.keys(updated).forEach(key => {
                                if (key.startsWith(procedure.name + "__")) {
                                  delete updated[key];
                                }
                              });
                              return updated;
                            });

                            setShowItemLockingDropdown(prev => {
                              const updated = { ...prev };
                              Object.keys(updated).forEach(key => {
                                if (key.startsWith(procedure.name + "__")) {
                                  delete updated[key];
                                }
                              });
                              return updated;
                            });

                            // Clear fixed items selections and edits
                            setSelectedFixedItems(prev => {
                              const updated = { ...prev };
                              Object.keys(updated).forEach(key => {
                                if (key.startsWith(procedure.name + "__")) {
                                  delete updated[key];
                                }
                              });
                              return updated;
                            });

                            setFixedQtyEdits(prev => {
                              const updated = { ...prev };
                              Object.keys(updated).forEach(key => {
                                if (key.startsWith(procedure.name + "__")) {
                                  delete updated[key];
                                }
                              });
                              return updated;
                            });

                            // Clear item details visibility
                            setShowItemDetails(prev => {
                              const updated = { ...prev };
                              Object.keys(updated).forEach(key => {
                                if (key.startsWith(procedure.name + "__")) {
                                  delete updated[key];
                                }
                              });
                              return updated;
                            });

                            // Clear any editing states
                            if (editingProcedureName === procedure.name) {
                              setEditingProcedureName(null);
                            }
                            setItemEditInputValues(prev => {
                              const updated = { ...prev };
                              Object.keys(updated).forEach(key => {
                                if (key.startsWith(procedure.name + "__")) {
                                  delete updated[key];
                                }
                              });
                              return updated;
                            });

                            // Clear any new item/instrument inputs
                            setNewItemInputs(prev => {
                              const updated = { ...prev };
                              delete updated[procedure.name];
                              return updated;
                            });
                            setNewInstrumentInputs(prev => {
                              const updated = { ...prev };
                              delete updated[procedure.name];
                              return updated;
                            });

                            // Clear suggestions
                            setItemSuggestions(prev => {
                              const updated = { ...prev };
                              delete updated[procedure.name];
                              return updated;
                            });
                            setInstrumentSuggestions(prev => {
                              const updated = { ...prev };
                              delete updated[procedure.name];
                              return updated;
                            });

                            // Clear material selection
                            setSelectedProcedureMaterials(prev => {
                              const updated = { ...prev };
                              delete updated[procedure.name];
                              return updated;
                            });

                            // Update procedures state with refreshed data
                            setProcedures(prev => {
                              const foundRow = results.data.slice(1).find(([name]) => name && name.trim() === procedure.name);
                              if (foundRow) {
                                const [name, items, fixedItems, fixedQty, instruments, type] = foundRow;
                                const fixedItemsArr = fixedItems ? fixedItems.split('|').map(s => s.trim()).filter(Boolean) : [];
                                const fixedQtyArr = fixedQty ? fixedQty.split('|').map(s => s.trim()).filter(Boolean) : [];
                                const fixedList = fixedItemsArr.map((item, idx) => ({ name: item, qty: fixedQtyArr[idx] || '' }));
                                const editableItems = items
                                  ? items.split('|').map(item => item.trim()).filter(Boolean)
                                  : [];
                                const updatedProcedure = {
                                  name: name.trim(),
                                  items: editableItems,
                                  fixedList,
                                  instruments: instruments ? instruments.split('|').map(inst => inst.trim()).filter(Boolean) : [],
                                  type: type ? type.trim() : 'Others',
                                };
                                return prev.map(p => p.name === procedure.name ? updatedProcedure : p);
                              }
                              return prev;
                            });

                            // Finally remove from activeProcedures
                            setActiveProcedures(prev => prev.filter(p => p.name !== procedure.name));
                          }
                        });
                      })
                      .catch(error => {
                        console.error('Error refreshing procedure before delete:', error);
                        // If refresh fails, still proceed with deletion
                        setActiveProcedures(prev => prev.filter(p => p.name !== procedure.name));
                      });
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                      const isEditing = editingItemNameKey === key;
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          {isEditing ? (
                            <> {/* Edit input and buttons for fixed items */}
                                <input
                                    type="text"
                                    value={itemEditInputValues[key] ?? fixed.name}
                                    onChange={e => setItemEditInputValues(prev => ({ ...prev, [key]: e.target.value }))}
                                    style={{ 
                                        padding: '4px 8px',
                                        border: '1px solid #ccc',
                                        borderRadius: 4,
                                        fontSize: '14px',
                                        width: 'auto',
                                        minWidth: '200px',
                                        flex: 1
                                    }}
                                />
                                <button onClick={() => handleSaveItemName(procedure.name, fixed.name, itemEditInputValues[key] ?? fixed.name, true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'green' }}>
                                    ✔️
                                </button>
                                <button onClick={() => handleCancelItemNameEdit(key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red' }}>
                                    ❌
                                </button>
                            </>
                          ) : (
                            <> {/* Normal display for fixed items */}
                              <input
                                type="checkbox"
                                checked={selectedFixedItems[key] || false}
                                onChange={() => setSelectedFixedItems(prev => ({ ...prev, [key]: !prev[key] }))}
                                style={{ accentColor: '#000' }}
                              />
                              <span>
                                {(() => {
                                  let displayName = selectedProcedureMaterials[procedure.name] === 'Titanium' ? 'Titanium ' + fixed.name : fixed.name;
                                  if (itemLocking[key]) {
                                    const words = displayName.split(' ');
                                    const firstWord = words[0];
                                    const secondWord = words[1] || '';
                                    const isSecondWordSpecial = 
                                      /^\d+$/.test(secondWord) || // Check if second word is a number
                                      secondWord.toLowerCase() === 'mm' ||
                                      secondWord.toLowerCase() === 'hole';
                                    
                                    if (isSecondWordSpecial) {
                                      // Insert locking status after the special second word
                                      const beforeLocking = words.slice(0, 2).join(' ');
                                      const afterLocking = words.slice(2).join(' ');
                                      displayName = `${beforeLocking} ${itemLocking[key]} ${afterLocking}`.trim();
                                    } else {
                                      // Original logic for other cases
                                      const restOfName = displayName.slice(firstWord.length).trim();
                                      if (restOfName.includes('Locking')) {
                                        displayName = `${firstWord} ${restOfName.replace('Locking', itemLocking[key])}`;
                                      } else if (!restOfName.includes('Non-Locking')) {
                                        displayName = `${firstWord} ${itemLocking[key]} ${restOfName}`;
                                      }
                                    }
                                  }
                                  return displayName;
                                })()}
                              </span>
                              {showItemLocks[procedure.name] && (
                                <div style={{ position: 'relative', marginLeft: 4 }}>
                                  <button
                                    onClick={() => setShowItemLockingDropdown(prev => ({ ...prev, [key]: !prev[key] }))}
                                    style={{ 
                                      background: 'none', 
                                      border: 'none', 
                                      cursor: 'pointer',
                                      padding: '2px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      fontSize: '14px',
                                      color: itemLocking[key] ? '#2563eb' : '#666'
                                    }}
                                    title="Toggle Locking Options"
                                  >
                                    {itemLocking[key] === 'Locking' ? '🔒' : itemLocking[key] === 'Non-Locking' ? '🔓' : '🔒'}
                                  </button>
                                  {showItemLockingDropdown[key] && (
                                    <div style={{
                                      position: 'absolute',
                                      top: '100%',
                                      left: 0,
                                      background: 'white',
                                      border: '1px solid #ccc',
                                      borderRadius: 4,
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                      zIndex: 10
                                    }}>
                                      <button
                                        onClick={() => {
                                          const itemName = fixed.name;
                                          // If item already has "Locking", don't add it again
                                          if (itemName.includes('Locking')) {
                                            setItemLocking(prev => ({ ...prev, [key]: 'Locking' }));
                                          } else {
                                            setItemLocking(prev => ({ ...prev, [key]: 'Locking' }));
                                          }
                                          setShowItemLockingDropdown(prev => ({ ...prev, [key]: false }));
                                        }}
                                        style={{
                                          display: 'block',
                                          width: '100%',
                                          padding: '8px 12px',
                                          border: 'none',
                                          background: 'none',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        Locking
                                      </button>
                                      <button
                                        onClick={() => {
                                          const itemName = fixed.name;
                                          // If item already has "Locking", replace it with "Non-Locking"
                                          if (itemName.includes('Locking')) {
                                            setItemLocking(prev => ({ ...prev, [key]: 'Non-Locking' }));
                                          } else {
                                            setItemLocking(prev => ({ ...prev, [key]: 'Non-Locking' }));
                                          }
                                          setShowItemLockingDropdown(prev => ({ ...prev, [key]: false }));
                                        }}
                                        style={{
                                          display: 'block',
                                          width: '100%',
                                          padding: '8px 12px',
                                          border: 'none',
                                          background: 'none',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        Non-Locking
                                      </button>
                                      <button
                                        onClick={() => {
                                          setItemLocking(prev => {
                                            const updated = { ...prev };
                                            delete updated[key];
                                            return updated;
                                          });
                                          setShowItemLockingDropdown(prev => ({ ...prev, [key]: false }));
                                        }}
                                        style={{
                                          display: 'block',
                                          width: '100%',
                                          padding: '8px 12px',
                                          border: 'none',
                                          background: 'none',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        Clear
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                              <input
                                type="number"
                                value={fixedQtyEdits[key] ?? fixed.qty}
                                onChange={e => handleFixedQtyChange(procedure.name, fixed.name, e.target.value)}
                                style={{ width: 60, padding: 6, border: '1px solid #ccc', borderRadius: 4, background: '#fff', color: '#222' }}
                              />
                               {/* Pencil for fixed items (visible when procedure editing is active)*/}
                              {editingProcedureName === procedure.name && (
                                  <button
                                      onClick={() => { setEditingItemNameKey(key); setItemEditInputValues(prev => ({ ...prev, [key]: fixed.name })); }}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 14 }}
                                      title={`Edit ${fixed.name}`}
                                  >
                                      ✏️
                                  </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Editable items */}
                {procedure.items.map((item) => {
                  const key = `${procedure.name}__${item.split('{')[0].trim()}`;
                  const isItemSelected = key in selectedItems;
                  const itemHasSizes = isItemSelected && selectedItems[key]?.length > 0;
                  const areDetailsVisible = showItemDetails[key] || false; // Default to false if undefined
                  const isEditing = editingItemNameKey === key;
                  const itemNameBeforeBraces = item.split('{')[0].trim();

                  return (
                    <div key={key} style={{ margin: "12px 0" }}>
                      {isEditing ? (
                         <> {/* Edit input and buttons for editable items */}
                             <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <input
                                    type="text"
                                    value={itemEditInputValues[key] ?? itemNameBeforeBraces}
                                    onChange={e => setItemEditInputValues(prev => ({ ...prev, [key]: e.target.value }))}
                                    style={{ 
                                        padding: '4px 8px',
                                        border: '1px solid #ccc',
                                        borderRadius: 4,
                                        fontSize: '14px',
                                        width: 'auto',
                                        minWidth: '200px',
                                        flex: 1
                                    }}
                                />
                                <button onClick={() => handleSaveItemName(procedure.name, itemNameBeforeBraces, itemEditInputValues[key] ?? itemNameBeforeBraces, false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'green' }}>
                                    ✔️
                                </button>
                                <button onClick={() => handleCancelItemNameEdit(key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red' }}>
                                    ❌
                                </button>
                             </div>
                              {/* Keep details visible if editing */}
                             {itemHasSizes && areDetailsVisible && (
                                 <div style={{ marginLeft: 32, marginTop: 4 }}>
                                      {selectedItems[key].map((entry, index) => (
                                          <div key={index} style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                             )}
                         </>
                      ) : (
                        <> {/* Normal display for editable items */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={selectedItems[key]?.length > 0}
                              onChange={() => handleItemChange(procedure.name, item)}
                            />
                            <span>
                              {(() => {
                                let displayName = selectedProcedureMaterials[procedure.name] === 'Titanium' ? 'Titanium ' + itemNameBeforeBraces : itemNameBeforeBraces;
                                if (itemLocking[key]) {
                                  const words = displayName.split(' ');
                                  const firstWord = words[0];
                                  const secondWord = words[1] || '';
                                  const isSecondWordSpecial = 
                                    /^\d+$/.test(secondWord) || // Check if second word is a number
                                    secondWord.toLowerCase() === 'mm' ||
                                    secondWord.toLowerCase() === 'hole';
                                  
                                  if (isSecondWordSpecial) {
                                    // Insert locking status after the special second word
                                    const beforeLocking = words.slice(0, 2).join(' ');
                                    const afterLocking = words.slice(2).join(' ');
                                    displayName = `${beforeLocking} ${itemLocking[key]} ${afterLocking}`.trim();
                                  } else {
                                    // Original logic for other cases
                                    const restOfName = displayName.slice(firstWord.length).trim();
                                    if (restOfName.includes('Locking')) {
                                      displayName = `${firstWord} ${restOfName.replace('Locking', itemLocking[key])}`;
                                    } else if (!restOfName.includes('Non-Locking')) {
                                      displayName = `${firstWord} ${itemLocking[key]} ${restOfName}`;
                                    }
                                  }
                                }
                                return displayName;
                              })()}
                            </span>
                            {showItemLocks[procedure.name] && (
                              <div style={{ position: 'relative', marginLeft: 4 }}>
                                <button
                                  onClick={() => setShowItemLockingDropdown(prev => ({ ...prev, [key]: !prev[key] }))}
                                  style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '14px',
                                    color: itemLocking[key] ? '#2563eb' : '#666'
                                  }}
                                  title="Toggle Locking Options"
                                >
                                  {itemLocking[key] === 'Locking' ? '🔒' : itemLocking[key] === 'Non-Locking' ? '🔓' : '🔒'}
                                </button>
                                {showItemLockingDropdown[key] && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    background: 'white',
                                    border: '1px solid #ccc',
                                    borderRadius: 4,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                    zIndex: 10
                                  }}>
                                    <button
                                      onClick={() => {
                                        const itemName = item.split('{')[0].trim();
                                        // If item already has "Locking", don't add it again
                                        if (itemName.includes('Locking')) {
                                          setItemLocking(prev => ({ ...prev, [key]: 'Locking' }));
                                        } else {
                                          setItemLocking(prev => ({ ...prev, [key]: 'Locking' }));
                                        }
                                        setShowItemLockingDropdown(prev => ({ ...prev, [key]: false }));
                                      }}
                                      style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        whiteSpace: 'nowrap'
                                      }}
                                                                            >
                                          Locking
                                        </button>
                                    <button
                                      onClick={() => {
                                        const itemName = item.split('{')[0].trim();
                                        // If item already has "Locking", replace it with "Non-Locking"
                                        if (itemName.includes('Locking')) {
                                          setItemLocking(prev => ({ ...prev, [key]: 'Non-Locking' }));
                                        } else {
                                          setItemLocking(prev => ({ ...prev, [key]: 'Non-Locking' }));
                                        }
                                        setShowItemLockingDropdown(prev => ({ ...prev, [key]: false }));
                                      }}
                                      style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        whiteSpace: 'nowrap'
                                      }}
                                                                            >
                                          Non-Locking
                                        </button>
                                    <button
                                      onClick={() => {
                                        setItemLocking(prev => {
                                          const updated = { ...prev };
                                          delete updated[key];
                                          return updated;
                                        });
                                        setShowItemLockingDropdown(prev => ({ ...prev, [key]: false }));
                                      }}
                                      style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      Clear
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Show toggle button only if the item is selected */}
                            {isItemSelected && (
                              <button
                                style={{
                                  marginLeft: 8,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: "#e0e7ff",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  lineHeight: 1,
                                }}
                                onClick={() => setShowItemDetails(prev => ({ ...prev, [key]: !prev[key] }))}
                                title={areDetailsVisible ? "Hide sizes/qtys" : "Show sizes/qtys"}
                              >
                                {areDetailsVisible ? 'Hide Sizes' : 'Show Sizes'}
                              </button>
                            )}

                            {/* Show Add Size button only if the item is selected AND currently has no sizes */}
                            {isItemSelected && !itemHasSizes && (
                               <button style={{ padding: "2px 8px", borderRadius: 4, background: "#e0e7ff", border: "none", cursor: "pointer" }} onClick={() => handleAddSizeQty(key)}>
                                + Add Size
                              </button>
                            )}

                            {/* NEW: Edit Item Name Button (visible when procedure editing is active)*/}
                            {editingProcedureName === procedure.name && editingItemNameKey !== key && (
                              <button
                                 onClick={() => { setEditingItemNameKey(key); setItemEditInputValues(prev => ({ ...prev, [key]: itemNameBeforeBraces })); }}
                                 style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 14 }}
                                 title={`Edit ${itemNameBeforeBraces}`}
                              >
                                 ✏️
                              </button>
                            )}
                          </div>

                          {/* Show item details (size/qty inputs) only if item is selected, has sizes, AND is toggled on */}
                          {isItemSelected && itemHasSizes && areDetailsVisible && (
                             <div style={{ marginLeft: 32, marginTop: 4 }}>
                                  {selectedItems[key].map((entry, index) => (
                                      <div key={index} style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
                {/* Add new item input */}
                <div style={{ marginTop: 8, display: 'flex', gap: 8, position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Add item"
                    value={newItemInputs[procedure.name] || ''}
                    onChange={e => handleNewItemInputChange(procedure.name, e.target.value)}
                    style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4, minWidth: 120 }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        if (showItemSuggestions[procedure.name] && itemSuggestions[procedure.name]?.[highlightedItemIndex[procedure.name]] !== undefined) {
                          handleItemSuggestionClick(procedure.name, itemSuggestions[procedure.name][highlightedItemIndex[procedure.name]]);
                        } else if (newItemInputs[procedure.name]?.trim()) { // Only add if input is not empty
                          handleAddItem(procedure.name);
                        }
                        // No need to reset highlight/hide suggestions here, handlers do it.
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (showItemSuggestions[procedure.name] && itemSuggestions[procedure.name]?.length > 0) { // Only navigate if suggestions are visible
                          const nextIndex = (highlightedItemIndex[procedure.name] || 0) + 1;
                          if (nextIndex < itemSuggestions[procedure.name].length) {
                            setHighlightedItemIndex(prev => ({ ...prev, [procedure.name]: nextIndex }));
                          } else {
                            setHighlightedItemIndex(prev => ({ ...prev, [procedure.name]: 0 })); // Wrap around
                          }
                        }
                      } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          if (showItemSuggestions[procedure.name] && itemSuggestions[procedure.name]?.length > 0) { // Only navigate if suggestions are visible
                            const prevIndex = (highlightedItemIndex[procedure.name] || 0) - 1;
                            if (prevIndex >= 0) {
                              setHighlightedItemIndex(prev => ({ ...prev, [procedure.name]: prevIndex }));
                            } else {
                              setHighlightedItemIndex(prev => ({ ...prev, [procedure.name]: itemSuggestions[procedure.name].length - 1 })); // Wrap around
                            }
                          }
                      }
                    }}
                     onBlur={() => setTimeout(() => setShowItemSuggestions(prev => ({ ...prev, [procedure.name]: false })), 100)} // Hide suggestions on blur (with delay)
                     onFocus={() => { // Show suggestions again on focus if input has value and suggestions exist
                       if (newItemInputs[procedure.name]?.trim() && itemSuggestions[procedure.name]?.length > 0) {
                         setShowItemSuggestions(prev => ({ ...prev, [procedure.name]: true }));
                       }
                     }}
                  />
                  <button
                    onClick={() => handleAddItem(procedure.name)}
                    style={{ padding: '6px 16px', borderRadius: 4, background: '#000', color: '#fff', border: 'none', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
                    disabled={!(newItemInputs[procedure.name] || '').trim() || (procedure.items || []).includes((newItemInputs[procedure.name] || '').trim())}
                  >
                    Add
                  </button>
                   {/* Item Suggestions Dropdown */}
                   {showItemSuggestions[procedure.name] && itemSuggestions[procedure.name]?.length > 0 && (
                     <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'white', border: '1px solid #ccc', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', maxHeight: 150, overflowY: 'auto' }}>
                       {itemSuggestions[procedure.name].map((suggestion, sIdx) => (
                         <div
                           key={sIdx}
                           style={{
                             padding: '8px 12px',
                             cursor: 'pointer',
                             background: highlightedItemIndex[procedure.name] === sIdx ? '#f0f0f0' : 'transparent', // Highlight style
                           }}
                           onClick={() => handleItemSuggestionClick(procedure.name, suggestion)}
                           onMouseDown={(e) => e.preventDefault()} // Prevent blur from hiding suggestions before click
                         >
                           {suggestion.split('{')[0].trim()}
                         </div>
                       ))}
                     </div>
                   )}
                </div>
                {/* Instruments section after items */}
                {procedure.instruments && procedure.instruments.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', fontWeight: 600, marginBottom: 4 }}>
                      <span>Instruments</span>
                      <button
                        onClick={() => refetchSingleProcedure(procedure.name)}
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
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Add instrument"
                        value={newInstrumentInputs[procedure.name] || ''}
                        onChange={e => handleNewInstrumentInputChange(procedure.name, e.target.value)}
                        style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4, minWidth: 120 }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            if (showInstrumentSuggestions[procedure.name] && instrumentSuggestions[procedure.name]?.[highlightedInstrumentIndex[procedure.name]] !== undefined) {
                              handleInstrumentSuggestionClick(procedure.name, instrumentSuggestions[procedure.name][highlightedInstrumentIndex[procedure.name]]);
                            } else if (newInstrumentInputs[procedure.name]?.trim()) { // Only add if input is not empty
                              handleAddInstrument(procedure.name);
                            }
                               // No need to reset highlight/hide suggestions here, handlers do it.
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            if (showInstrumentSuggestions[procedure.name] && instrumentSuggestions[procedure.name]?.length > 0) { // Only navigate if suggestions are visible
                              const nextIndex = (highlightedInstrumentIndex[procedure.name] || 0) + 1;
                              if (nextIndex < instrumentSuggestions[procedure.name].length) {
                                setHighlightedInstrumentIndex(prev => ({ ...prev, [procedure.name]: nextIndex }));
                              } else {
                                setHighlightedInstrumentIndex(prev => ({ ...prev, [procedure.name]: 0 })); // Wrap around
                              }
                            }
                          } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              if (showInstrumentSuggestions[procedure.name] && instrumentSuggestions[procedure.name]?.length > 0) { // Only navigate if suggestions are visible
                                const prevIndex = (highlightedInstrumentIndex[procedure.name] || 0) - 1;
                                if (prevIndex >= 0) {
                                  setHighlightedInstrumentIndex(prev => ({ ...prev, [procedure.name]: prevIndex }));
                                } else {
                                  setHighlightedInstrumentIndex(prev => ({ ...prev, [procedure.name]: instrumentSuggestions[procedure.name].length - 1 })); // Wrap around
                                }
                              }
                          }
                        }}
                         onBlur={() => setTimeout(() => setShowInstrumentSuggestions(prev => ({ ...prev, [procedure.name]: false })), 100)} // Hide suggestions on blur (with delay)
                          onFocus={() => { // Show suggestions again on focus if input has value and suggestions exist
                            if (newInstrumentInputs[procedure.name]?.trim() && instrumentSuggestions[procedure.name]?.length > 0) {
                              setShowInstrumentSuggestions(prev => ({ ...prev, [procedure.name]: true }));
                            }
                          }}
                      />
                      <button
                        onClick={() => handleAddInstrument(procedure.name)}
                        style={{ padding: '6px 16px', borderRadius: 4, background: '#000', color: '#fff', border: 'none', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
                        disabled={!(newInstrumentInputs[procedure.name] || '').trim() || (procedure.instruments || []).includes((newInstrumentInputs[procedure.name] || '').trim())}
                      >
                        Add
                      </button>
                      {/* Instrument Suggestions Dropdown */}
                      {showInstrumentSuggestions[procedure.name] && instrumentSuggestions[procedure.name]?.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'white', border: '1px solid #ccc', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', maxHeight: 150, overflowY: 'auto' }}>
                          {instrumentSuggestions[procedure.name].map((suggestion, sIdx) => (
                            <div
                              key={sIdx}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                background: highlightedInstrumentIndex[procedure.name] === sIdx ? '#f0f0f0' : 'transparent', // Highlight style
                              }}
                              onClick={() => handleInstrumentSuggestionClick(procedure.name, suggestion)}
                              onMouseDown={(e) => e.preventDefault()} // Prevent blur from hiding suggestions before click
                            >
                              {suggestion}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            }
          </div>
        </div>
      ))}

      {/* Action buttons */}
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
            onClick={handlePartPrint}
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
            <span role="img" aria-label="Print">🖨️</span> Part Printing
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

      {/* Summary section */}
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
                    const displayedFixedName = selectedProcedureMaterials[proc.name] === 'Titanium' ? 'Titanium ' + fixed.name : fixed.name;
                    // Add locking text if selected and not already present
                    let displayName = displayedFixedName;
                    if (itemLocking[key]) {
                      const words = displayName.split(' ');
                      const firstWord = words[0];
                      const secondWord = words[1] || '';
                      const isSecondWordSpecial = 
                        /^\d+$/.test(secondWord) || // Check if second word is a number
                        secondWord.toLowerCase() === 'mm' ||
                        secondWord.toLowerCase() === 'hole';
                      
                      if (isSecondWordSpecial) {
                        // Insert locking status after the special second word
                        const beforeLocking = words.slice(0, 2).join(' ');
                        const afterLocking = words.slice(2).join(' ');
                        displayName = `${beforeLocking} ${itemLocking[key]} ${afterLocking}`.trim();
                      } else {
                        // Original logic for other cases
                        const restOfName = displayName.slice(firstWord.length).trim();
                        if (restOfName.includes('Locking')) {
                          displayName = `${firstWord} ${restOfName.replace('Locking', itemLocking[key])}`;
                        } else if (!restOfName.includes('Non-Locking')) {
                          displayName = `${firstWord} ${itemLocking[key]} ${restOfName}`;
                        }
                      }
                    }
                    lines.push(
                      <div key={key}>
                        {displayName} - {fixedQtyEdits[key] ?? fixed.qty}
                      </div>
                    );
                    hasItems = true;
                  }
                });
              }
              // Editable items
              proc.items.forEach(item => {
                const key = `${proc.name}__${item.split('{')[0].trim()}`;
                if (selectedItems[key] && selectedItems[key].length > 0) {
                  const itemName = item.split('{')[0].trim();
                  const displayedItemName = selectedProcedureMaterials[proc.name] === 'Titanium' ? 'Titanium ' + itemName : itemName;
                  // Add locking text if selected and not already present
                  let displayName = displayedItemName;
                  if (itemLocking[key]) {
                    const words = displayName.split(' ');
                    const firstWord = words[0];
                    const secondWord = words[1] || '';
                    const isSecondWordSpecial = 
                      /^\d+$/.test(secondWord) || // Check if second word is a number
                      secondWord.toLowerCase() === 'mm' ||
                      secondWord.toLowerCase() === 'hole';
                    
                    if (isSecondWordSpecial) {
                      // Insert locking status after the special second word
                      const beforeLocking = words.slice(0, 2).join(' ');
                      const afterLocking = words.slice(2).join(' ');
                      displayName = `${beforeLocking} ${itemLocking[key]} ${afterLocking}`.trim();
                    } else {
                      // Original logic for other cases
                      const restOfName = displayName.slice(firstWord.length).trim();
                      if (restOfName.includes('Locking')) {
                        displayName = `${firstWord} ${restOfName.replace('Locking', itemLocking[key])}`;
                      } else if (!restOfName.includes('Non-Locking')) {
                        displayName = `${firstWord} ${itemLocking[key]} ${restOfName}`;
                      }
                    }
                  }
                  const sizeQtys = selectedItems[key]
                    .map(entry => `${entry.size || ''}${entry.size ? '-' : ''}${entry.qty}`)
                    .join(', ');
                  const totalQty = selectedItems[key].reduce((sum, entry) => sum + Number(entry.qty || 0), 0);
                  lines.push(
                    <div key={proc.name + '-' + item}>
                      {displayName} {sizeQtys} <b>(Total: {totalQty})</b>
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

      {/* Hospital Modal */}
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
                  } else if (requestedPrintType === 'part') {
                    setShowPartPrintPreview(true);
                    setShowPrintPreview(false);
                  } else {
                    setShowPrintPreview(true);
                    setShowPartPrintPreview(false);
                  }
                }
              }} style={{ padding: "6px 12px", borderRadius: 4, background: "#000", color: "white", border: "none" }} disabled={!hospitalName.trim() || !dcNo.trim()}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* Part Print Preview Modal */}
      {showPartPrintPreview && (
        <div data-print-modal style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 8, maxWidth: '95vw', width: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 2px 16px rgba(0,0,0,0.25)', padding: 24, position: 'relative' }}>
            <div id="part-print-preview-content" ref={partPrintRef} style={{ maxHeight: '100vh', overflow: 'hidden' }}>
              <style>{`
                @page { size: landscape; }
                @media print {
                  @page {
                    size: landscape;
                    margin: 0.8cm;
                  }
                  @page :first {
                    margin: 0.8cm;
                  }
                  body * { visibility: hidden !important; }
                  #part-print-preview-content, #part-print-preview-content * {
                    visibility: visible !important;
                  }
                  #part-print-preview-content {
                    position: fixed !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    background: white !important;
                    z-index: 9999 !important;
                    overflow: hidden !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    font-size: 10px !important;
                  }
                  #part-print-preview-content h2 {
                    font-size: 13px !important;
                    margin-bottom: 4px !important;
                    font-weight: bold !important;
                  }
                  #part-print-preview-content .header-info {
                    font-size: 11px !important;
                    margin-bottom: 4px !important;
                  }
                  .print-table {
                    page-break-inside: avoid !important;
                    width: 45% !important;
                    max-height: calc(100vh - 2cm) !important;
                  }
                  .print-table-container {
                    display: flex !important;
                    justify-content: space-between !important;
                    width: 100% !important;
                    gap: 1cm !important;
                    padding: 0 0.8cm !important;
                  }
                  .print-table table {
                    margin-bottom: 4px !important;
                    width: 100% !important;
                    border-spacing: 0 !important;
                  }
                  .signature-section {
                    padding-top: 10px !important;
                    font-size: 10px !important;
                  }
                  [data-print-modal] {
                    all: unset !important;
                    display: block !important;
                  }
                  tr { 
                    page-break-inside: avoid !important; 
                  }
                  td { 
                    line-height: 1.1 !important;
                    padding: 3px 4px !important;
                  }
                  th {
                    padding: 3px 4px !important;
                  }
                  * {
                    -webkit-print-color-adjust: exact !important;
                    color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                }
                #part-print-preview-content table, #part-print-preview-content th, #part-print-preview-content td {
                  border: 1px solid #222;
                  border-collapse: collapse;
                }
                #part-print-preview-content th {
                  padding: 4px;
                  font-size: 11px;
                  background: #f1f5f9;
                }
                #part-print-preview-content td {
                  padding: 4px;
                  font-size: 11px;
                }
                #part-print-preview-content .procedure-heading {
                  background: #f1f5f9;
                  font-weight: bold;
                  font-size: 11px;
                }
                #part-print-preview-content .instruments-heading {
                  background: #e0e7ff;
                  font-weight: bold;
                  font-size: 11px;
                }
              `}</style>
              <div className="part-print-container" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: '1cm', padding: '0 0.8cm' }}>
                <div style={{ width: '45%' }}>
                  <h2 style={{ textAlign: 'center', fontWeight: 700, marginBottom: 8 }}>DELIVERY CHALLAN</h2>
                  <div className="header-info" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>Hospital: {hospitalName}</span>
                    <span style={{ fontWeight: 600 }}>DC No: {dcNo}</span>
                  </div>
                </div>
                <div style={{ width: '45%' }}>
                  <h2 style={{ textAlign: 'center', fontWeight: 700, marginBottom: 8 }}>DELIVERY CHALLAN</h2>
                  <div className="header-info" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>Hospital: {hospitalName}</span>
                    <span style={{ fontWeight: 600 }}>DC No: {dcNo}</span>
                  </div>
                </div>
              </div>
              <div className="part-print-container" style={{ display: 'flex', justifyContent: 'space-between', gap: '1cm', padding: '0 0.8cm' }}>
                {/* Left Table */}
                <div className="print-table" style={{ width: '45%' }}>
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
                          rows.push(
                            <tr key={proc.name + '-heading'}>
                              <td colSpan={3} style={{ background: '#f1f5f9', fontWeight: 'bold' }}>{proc.name}</td>
                            </tr>
                          );
                          if (proc.fixedList && proc.fixedList.length > 0) {
                            proc.fixedList.forEach(fixed => {
                              const key = `${proc.name}__${fixed.name}`;
                              if (selectedFixedItems[key]) {
                                const displayedFixedName = selectedProcedureMaterials[proc.name] === 'Titanium' ? 'Titanium ' + fixed.name : fixed.name;
                                // Add locking text if selected and not already present
                                let displayName = displayedFixedName;
                                if (itemLocking[key]) {
                                  const words = displayName.split(' ');
                                  const firstWord = words[0];
                                  const secondWord = words[1] || '';
                                  const isSecondWordSpecial = 
                                    /^\d+$/.test(secondWord) || // Check if second word is a number
                                    secondWord.toLowerCase() === 'mm' ||
                                    secondWord.toLowerCase() === 'hole';
                                  
                                  if (isSecondWordSpecial) {
                                    // Insert locking status after the special second word
                                    const beforeLocking = words.slice(0, 2).join(' ');
                                    const afterLocking = words.slice(2).join(' ');
                                    displayName = `${beforeLocking} ${itemLocking[key]} ${afterLocking}`.trim();
                                  } else {
                                    // Original logic for other cases
                                    const restOfName = displayName.slice(firstWord.length).trim();
                                    if (restOfName.includes('Locking')) {
                                      displayName = `${firstWord} ${restOfName.replace('Locking', itemLocking[key])}`;
                                    } else if (!restOfName.includes('Non-Locking')) {
                                      displayName = `${firstWord} ${itemLocking[key]} ${restOfName}`;
                                    }
                                  }
                                }
                                rows.push(
                                  <tr key={key}>
                                    <td>{serial++}</td>
                                    <td>{displayName}</td>
                                    <td>{fixedQtyEdits[key] ?? fixed.qty}</td>
                                  </tr>
                                );
                              }
                            });
                          }
                          proc.items.forEach(item => {
                            const key = `${proc.name}__${item.split('{')[0].trim()}`;
                            if (selectedItems[key] && selectedItems[key].length > 0) {
                              const itemName = item.split('{')[0].trim();
                              const displayedItemName = selectedProcedureMaterials[proc.name] === 'Titanium' ? 'Titanium ' + itemName : itemName;
                              // Add locking text if selected and not already present
                              let displayName = displayedItemName;
                              if (itemLocking[key]) {
                                const words = displayName.split(' ');
                                const firstWord = words[0];
                                const secondWord = words[1] || '';
                                const isSecondWordSpecial = 
                                  /^\d+$/.test(secondWord) || // Check if second word is a number
                                  secondWord.toLowerCase() === 'mm' ||
                                  secondWord.toLowerCase() === 'hole';
                                
                                if (isSecondWordSpecial) {
                                  // Insert locking status after the special second word
                                  const beforeLocking = words.slice(0, 2).join(' ');
                                  const afterLocking = words.slice(2).join(' ');
                                  displayName = `${beforeLocking} ${itemLocking[key]} ${afterLocking}`.trim();
                                } else {
                                  // Original logic for other cases
                                  const restOfName = displayName.slice(firstWord.length).trim();
                                  if (restOfName.includes('Locking')) {
                                    displayName = `${firstWord} ${restOfName.replace('Locking', itemLocking[key])}`;
                                  } else if (!restOfName.includes('Non-Locking')) {
                                    displayName = `${firstWord} ${itemLocking[key]} ${restOfName}`;
                                  }
                                }
                              }
                              const sizeQtys = selectedItems[key]
                                .map(entry => `${entry.size || ''}${entry.size ? '-' : ''}${entry.qty}`)
                                .join(', ');
                              const totalQty = selectedItems[key].reduce((sum, entry) => sum + Number(entry.qty || 0), 0);
                              rows.push(
                                <tr key={proc.name + '-' + item}>
                                  <td>{serial++}</td>
                                  <td>{displayName} {sizeQtys}</td>
                                  <td>{totalQty}</td>
                                </tr>
                              );
                            }
                          });
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
                  <div className="signature-section" style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 0 0 0' }}>
                    <div>Receiver's Sign</div>
                    <div>Authorized Sign</div>
                  </div>
                </div>

                {/* Right Table (Duplicate) */}
                <div className="print-table" style={{ width: '45%' }}>
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
                          rows.push(
                            <tr key={proc.name + '-heading-2'}>
                              <td colSpan={3} style={{ background: '#f1f5f9', fontWeight: 'bold' }}>{proc.name}</td>
                            </tr>
                          );
                          if (proc.fixedList && proc.fixedList.length > 0) {
                            proc.fixedList.forEach(fixed => {
                              const key = `${proc.name}__${fixed.name}`;
                              if (selectedFixedItems[key]) {
                                const displayedFixedName = selectedProcedureMaterials[proc.name] === 'Titanium' ? 'Titanium ' + fixed.name : fixed.name;
                                // Add locking text if selected and not already present
                                let displayName = displayedFixedName;
                                if (itemLocking[key]) {
                                  const words = displayName.split(' ');
                                  const firstWord = words[0];
                                  const secondWord = words[1] || '';
                                  const isSecondWordSpecial = 
                                    /^\d+$/.test(secondWord) || // Check if second word is a number
                                    secondWord.toLowerCase() === 'mm' ||
                                    secondWord.toLowerCase() === 'hole';
                                  
                                  if (isSecondWordSpecial) {
                                    // Insert locking status after the special second word
                                    const beforeLocking = words.slice(0, 2).join(' ');
                                    const afterLocking = words.slice(2).join(' ');
                                    displayName = `${beforeLocking} ${itemLocking[key]} ${afterLocking}`.trim();
                                  } else {
                                    // Original logic for other cases
                                    const restOfName = displayName.slice(firstWord.length).trim();
                                    if (restOfName.includes('Locking')) {
                                      displayName = `${firstWord} ${restOfName.replace('Locking', itemLocking[key])}`;
                                    } else if (!restOfName.includes('Non-Locking')) {
                                      displayName = `${firstWord} ${itemLocking[key]} ${restOfName}`;
                                    }
                                  }
                                }
                                rows.push(
                                  <tr key={key + '-2'}>
                                    <td>{serial++}</td>
                                    <td>{displayName}</td>
                                    <td>{fixedQtyEdits[key] ?? fixed.qty}</td>
                                  </tr>
                                );
                              }
                            });
                          }
                          proc.items.forEach(item => {
                            const key = `${proc.name}__${item.split('{')[0].trim()}`;
                            if (selectedItems[key] && selectedItems[key].length > 0) {
                              const itemName = item.split('{')[0].trim();
                              const displayedItemName = selectedProcedureMaterials[proc.name] === 'Titanium' ? 'Titanium ' + itemName : itemName;
                              // Add locking text if selected and not already present
                              let displayName = displayedItemName;
                              if (itemLocking[key]) {
                                const words = displayName.split(' ');
                                const firstWord = words[0];
                                const secondWord = words[1] || '';
                                const isSecondWordSpecial = 
                                  /^\d+$/.test(secondWord) || // Check if second word is a number
                                  secondWord.toLowerCase() === 'mm' ||
                                  secondWord.toLowerCase() === 'hole';
                                
                                if (isSecondWordSpecial) {
                                  // Insert locking status after the special second word
                                  const beforeLocking = words.slice(0, 2).join(' ');
                                  const afterLocking = words.slice(2).join(' ');
                                  displayName = `${beforeLocking} ${itemLocking[key]} ${afterLocking}`.trim();
                                } else {
                                  // Original logic for other cases
                                  const restOfName = displayName.slice(firstWord.length).trim();
                                  if (restOfName.includes('Locking')) {
                                    displayName = `${firstWord} ${restOfName.replace('Locking', itemLocking[key])}`;
                                  } else if (!restOfName.includes('Non-Locking')) {
                                    displayName = `${firstWord} ${itemLocking[key]} ${restOfName}`;
                                  }
                                }
                              }
                              const sizeQtys = selectedItems[key]
                                .map(entry => `${entry.size || ''}${entry.size ? '-' : ''}${entry.qty}`)
                                .join(', ');
                              const totalQty = selectedItems[key].reduce((sum, entry) => sum + Number(entry.qty || 0), 0);
                              rows.push(
                                <tr key={proc.name + '-' + item + '-2'}>
                                  <td>{serial++}</td>
                                  <td>{displayName} {sizeQtys}</td>
                                  <td>{totalQty}</td>
                                </tr>
                              );
                            }
                          });
                          if (proc.instruments && proc.instruments.length > 0) {
                            rows.push(
                              <tr key={proc.name + '-inst-heading-2'}>
                                <td colSpan={3} style={{ background: '#e0e7ff', fontWeight: 'bold' }}>Instruments</td>
                              </tr>
                            );
                            rows.push(
                              <tr key={proc.name + '-inst-row-2'}>
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
                  <div className="signature-section" style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 0 0 0' }}>
                    <div>Receiver's Sign</div>
                    <div>Authorized Sign</div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button onClick={() => {
                setShowPartPrintPreview(false);
                setRequestedPrintType(null);
              }} style={{ padding: '8px 20px', borderRadius: 4, border: '1px solid #ccc', background: 'white', fontWeight: 500, fontSize: 16 }}>Close</button>
              <button onClick={() => {
                const printContent = document.querySelector('#part-print-preview-content');
                const originalStyle = printContent.style.cssText;
                printContent.style.height = '100vh';
                printContent.style.overflow = 'hidden';
                window.print();
                setTimeout(() => {
                  printContent.style.cssText = originalStyle;
                }, 500);
              }} style={{ padding: '8px 20px', borderRadius: 4, background: '#000', color: '#fff', border: 'none', fontWeight: 500, fontSize: 16 }}>Print</button>
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
                      rows.push(
                        <tr key={proc.name + '-heading'}>
                          <td colSpan={3} style={{ background: '#f1f5f9', fontWeight: 'bold' }}>{proc.name}</td>
                        </tr>
                      );
                      if (proc.fixedList && proc.fixedList.length > 0) {
                        proc.fixedList.forEach((fixed, idx) => {
                          const key = `${proc.name}__${fixed.name}`;
                          if (selectedFixedItems[key]) {
                            const displayedFixedName = selectedProcedureMaterials[proc.name] === 'Titanium' ? 'Titanium ' + fixed.name : fixed.name;
                            // Add locking text if selected and not already present
                            let displayName = displayedFixedName;
                            if (itemLocking[key]) {
                              const words = displayName.split(' ');
                              const firstWord = words[0];
                              const secondWord = words[1] || '';
                              const isSecondWordSpecial = 
                                /^\d+$/.test(secondWord) || // Check if second word is a number
                                secondWord.toLowerCase() === 'mm' ||
                                secondWord.toLowerCase() === 'hole';
                              
                              if (isSecondWordSpecial) {
                                // Insert locking status after the special second word
                                const beforeLocking = words.slice(0, 2).join(' ');
                                const afterLocking = words.slice(2).join(' ');
                                displayName = `${beforeLocking} ${itemLocking[key]} ${afterLocking}`.trim();
                              } else {
                                // Original logic for other cases
                                const restOfName = displayName.slice(firstWord.length).trim();
                                if (restOfName.includes('Locking')) {
                                  displayName = `${firstWord} ${restOfName.replace('Locking', itemLocking[key])}`;
                                } else if (!restOfName.includes('Non-Locking')) {
                                  displayName = `${firstWord} ${itemLocking[key]} ${restOfName}`;
                                }
                              }
                            }
                            rows.push(
                              <tr key={key}>
                                <td>{serial++}</td>
                                <td>{displayName}</td>
                                <td>{fixedQtyEdits[key] ?? fixed.qty}</td>
                              </tr>
                            );
                          }
                        });
                      }
                      proc.items.forEach(item => {
                        const key = `${proc.name}__${item.split('{')[0].trim()}`;
                        if (selectedItems[key] && selectedItems[key].length > 0) {
                          const itemName = item.split('{')[0].trim();
                          const displayedItemName = selectedProcedureMaterials[proc.name] === 'Titanium' ? 'Titanium ' + itemName : itemName;
                          // Add locking text if selected and not already present
                          let displayName = displayedItemName;
                          if (itemLocking[key]) {
                            const words = displayName.split(' ');
                            const firstWord = words[0];
                            const secondWord = words[1] || '';
                            const isSecondWordSpecial = 
                              /^\d+$/.test(secondWord) || // Check if second word is a number
                              secondWord.toLowerCase() === 'mm' ||
                              secondWord.toLowerCase() === 'hole';
                            
                            if (isSecondWordSpecial) {
                              // Insert locking status after the special second word
                              const beforeLocking = words.slice(0, 2).join(' ');
                              const afterLocking = words.slice(2).join(' ');
                              displayName = `${beforeLocking} ${itemLocking[key]} ${afterLocking}`.trim();
                            } else {
                              // Original logic for other cases
                              const restOfName = displayName.slice(firstWord.length).trim();
                              if (restOfName.includes('Locking')) {
                                displayName = `${firstWord} ${restOfName.replace('Locking', itemLocking[key])}`;
                              } else if (!restOfName.includes('Non-Locking')) {
                                displayName = `${firstWord} ${itemLocking[key]} ${restOfName}`;
                              }
                            }
                          }
                          const sizeQtys = selectedItems[key]
                            .map(entry => `${entry.size || ''}${entry.size ? '-' : ''}${entry.qty}`)
                            .join(', ');
                          const totalQty = selectedItems[key].reduce((sum, entry) => sum + Number(entry.qty || 0), 0);
                          rows.push(
                            <tr key={proc.name + '-' + item}>
                              <td>{serial++}</td>
                              <td>{displayName} {sizeQtys}</td>
                              <td>{totalQty}</td>
                            </tr>
                          );
                        }
                      });
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
              <button onClick={() => {
                setShowPrintPreview(false);
                setRequestedPrintType(null);
              }} style={{ padding: '8px 20px', borderRadius: 4, border: '1px solid #ccc', background: 'white', fontWeight: 500, fontSize: 16 }}>Close</button>
              <button onClick={doSavePDF} style={{ padding: '8px 20px', borderRadius: 4, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 500, fontSize: 16 }}>Download PDF</button>
              <button onClick={() => window.print()} style={{ padding: '8px 20px', borderRadius: 4, background: '#000', color: '#fff', border: 'none', fontWeight: 500, fontSize: 16 }}>Print</button>
            </div>
          </div>
        </div>
      )}

      {/* Add this style block near the top of the component, where other styles are defined */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
