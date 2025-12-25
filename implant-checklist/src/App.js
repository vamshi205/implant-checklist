import { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import { Trash2, ChevronDown, ChevronUp, Info } from "lucide-react";
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
  const [showItemDetails, setShowItemDetails] = useState({});
  const [selectedMaterial, setSelectedMaterial] = useState("SS");
  const [instrumentSuggestions, setInstrumentSuggestions] = useState({});
  const [itemSuggestions, setItemSuggestions] = useState({});
  const [showInstrumentSuggestions, setShowInstrumentSuggestions] = useState({});
  const [showItemSuggestions, setShowItemSuggestions] = useState({});
  const [highlightedInstrumentIndex, setHighlightedInstrumentIndex] = useState({});
  const [highlightedItemIndex, setHighlightedItemIndex] = useState({});
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedInstrumentImage, setSelectedInstrumentImage] = useState({ instrument: '', imageUrl: '', fallbackUrls: null });
  const [currentImageError, setCurrentImageError] = useState(false);

  // Instrument image mapping - fallback if not in Google Sheets
  // Format: "Instrument Name": "Image URL"
  // You can add Google Drive URLs here: https://drive.google.com/uc?export=view&id=FILE_ID
  const instrumentImageMap = {
    // Example entries (replace with your actual image URLs):
    // "Drill": "https://drive.google.com/uc?export=view&id=YOUR_FILE_ID",
    // "Forceps": "https://drive.google.com/uc?export=view&id=YOUR_FILE_ID",
    // Add your instrument image here - replace "Your Instrument Name" with the actual instrument name
    // "Your Instrument Name": "https://drive.google.com/uc?export=view&id=1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE",
  };

  // Initialize Fuse.js for fuzzy search on items and instruments
  const itemFuse = useRef(null);
  const instrumentFuse = useRef(null);

  // Effect to initialize Fuse.js instances when procedures data is loaded
  useEffect(() => {
    if (procedures.length > 0) {
      const allInstruments = [...new Set(procedures.flatMap(p => p.instruments))]; // Get unique instruments
      const allItems = [...new Set(procedures.flatMap(p => p.items))]; // Get unique original items

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
            const parsedProcedures = results.data.slice(1).map((row) => {
              // Support 6 columns (original) or 7 columns (with instrument images)
              const [name, items, fixedItems, fixedQty, instruments, type, instrumentImages] = row;
              
              // Parse fixed items and qtys strictly by | only
              const fixedItemsArr = fixedItems ? fixedItems.split('|').map(s => s.trim()).filter(Boolean) : [];
              const fixedQtyArr = fixedQty ? fixedQty.split('|').map(s => s.trim()).filter(Boolean) : [];
              const fixedList = fixedItemsArr.map((item, idx) => ({ name: item, qty: fixedQtyArr[idx] || '' }));
              // Parse editable items (from Items column only, pipe-separated)
              const editableItems = items
                ? items.split('|').map(item => item.trim()).filter(Boolean)
                : [];
              
              // Parse instruments and their images
              const instrumentsArr = instruments ? instruments.split('|').map(inst => inst.trim()).filter(Boolean) : [];
              const instrumentImagesArr = instrumentImages ? instrumentImages.split('|').map(url => url.trim()).filter(Boolean) : [];
              
              // Create instrument-image mapping for this procedure
              const instrumentImageMapping = {};
              instrumentsArr.forEach((inst, idx) => {
                instrumentImageMapping[inst] = instrumentImagesArr[idx] || instrumentImageMap[inst] || null;
              });
              
              return {
                name: name.trim(),
                items: editableItems,
                fixedList,
                instruments: instrumentsArr,
                instrumentImageMapping, // Map of instrument name -> image URL
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
    const key = `${procedureName}__${item}`;
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
    setShowItemDetails({}); // Clear item detail visibility state
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

  // Refetch a single procedure's data from the sheet
  const refetchSingleProcedure = (procedureName) => {
    fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQu2GZRYcJnEjFaDryWHowegMFVkf8xzewGsEKqNLw7onpe1if24LnJrIZAl4CB5QdgVFjE1PqFYmUa/pub?output=csv')
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            const foundRow = results.data.slice(1).find(([name]) => name && name.trim() === procedureName);
            if (foundRow) {
              const [name, items, fixedItems, fixedQty, instruments, type, instrumentImages] = foundRow;
              const fixedItemsArr = fixedItems ? fixedItems.split('|').map(s => s.trim()).filter(Boolean) : [];
              const fixedQtyArr = fixedQty ? fixedQty.split('|').map(s => s.trim()).filter(Boolean) : [];
              const fixedList = fixedItemsArr.map((item, idx) => ({ name: item, qty: fixedQtyArr[idx] || '' }));
              const editableItems = items
                ? items.split('|').map(item => item.trim()).filter(Boolean)
                : [];
              
              // Parse instruments and their images
              const instrumentsArr = instruments ? instruments.split('|').map(inst => inst.trim()).filter(Boolean) : [];
              const instrumentImagesArr = instrumentImages ? instrumentImages.split('|').map(url => url.trim()).filter(Boolean) : [];
              
              // Create instrument-image mapping for this procedure
              const instrumentImageMapping = {};
              instrumentsArr.forEach((inst, idx) => {
                instrumentImageMapping[inst] = instrumentImagesArr[idx] || instrumentImageMap[inst] || null;
              });
              
              const updatedProcedure = {
                name: name.trim(),
                items: editableItems,
                fixedList,
                instruments: instrumentsArr,
                instrumentImageMapping,
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
    
    // Get image URL from mapping if available
    const imageUrl = instrumentImageMap[value] || null;
    
    setProcedures(prev => prev.map(proc =>
      proc.name === procedureName && !proc.instruments.includes(value)
        ? { 
            ...proc, 
            instruments: [...proc.instruments, value],
            instrumentImageMapping: { ...proc.instrumentImageMapping, [value]: imageUrl }
          }
        : proc
    ));
    setActiveProcedures(prev => prev.map(proc =>
      proc.name === procedureName && !proc.instruments.includes(value)
        ? { 
            ...proc, 
            instruments: [...proc.instruments, value],
            instrumentImageMapping: { ...proc.instrumentImageMapping, [value]: imageUrl }
          }
        : proc
    ));
    setNewInstrumentInputs(prev => ({ ...prev, [procedureName]: '' }));
    setInstrumentSuggestions(prev => ({ ...prev, [procedureName]: [] })); // Clear suggestions on add
    setShowInstrumentSuggestions(prev => ({ ...prev, [procedureName]: false })); // Hide suggestions on add
    setHighlightedInstrumentIndex(prev => ({ ...prev, [procedureName]: -1 })); // Reset highlight on add
  };

  // Convert Google Drive URL to working format
  const convertGoogleDriveUrl = (url) => {
    if (!url) return null;
    
    // Extract file ID from various Google Drive URL formats
    let fileId = null;
    
    // Format 1: https://drive.google.com/uc?export=view&id=FILE_ID
    const ucMatch = url.match(/[?&]id=([^&]+)/);
    if (ucMatch) {
      fileId = ucMatch[1];
    }
    
    // Format 2: https://drive.google.com/file/d/FILE_ID/view
    const fileMatch = url.match(/\/file\/d\/([^\/]+)/);
    if (fileMatch) {
      fileId = fileMatch[1];
    }
    
    if (!fileId) return url; // Return original if we can't parse
    
    // Try multiple working formats
    return {
      thumbnail: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
      preview: `https://drive.google.com/file/d/${fileId}/preview`,
      uc: `https://drive.google.com/uc?export=view&id=${fileId}`,
      original: url
    };
  };

  // Handler to show instrument image
  const handleShowInstrumentImage = (procedureName, instrumentName) => {
    const procedure = activeProcedures.find(p => p.name === procedureName) || procedures.find(p => p.name === procedureName);
    const imageUrl = procedure?.instrumentImageMapping?.[instrumentName] || instrumentImageMap[instrumentName] || null;
    
    if (imageUrl) {
      // Convert to working URL format
      const urlOptions = convertGoogleDriveUrl(imageUrl);
      // Use thumbnail format first (most reliable for Google Drive)
      const workingUrl = typeof urlOptions === 'object' ? urlOptions.thumbnail : imageUrl;
      
      setCurrentImageError(false); // Reset error state
      setSelectedInstrumentImage({ 
        instrument: instrumentName, 
        imageUrl: workingUrl,
        fallbackUrls: typeof urlOptions === 'object' ? urlOptions : null
      });
      setShowImageModal(true);
    } else {
      alert(`No image available for ${instrumentName}`);
    }
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
        @media (max-width: 768px) {
          .main-container {
            padding: 12px !important;
          }
          .procedure-header-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .procedure-header-buttons {
            flex-wrap: wrap !important;
            gap: 4px !important;
          }
          .action-buttons-container {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .action-buttons-container button {
            width: 100% !important;
          }
        }
        @media (max-width: 600px) {
          .main-container {
            padding: 8px !important;
          }
          .main-title {
            font-size: 20px !important;
            margin-bottom: 16px !important;
          }
          .hospital-dc-row {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .hospital-dc-row input {
            width: 100% !important;
          }
          .search-material-row {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .search-material-row input,
          .search-material-row select {
            width: 100% !important;
          }
          .procedure-grid {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
          .responsive-row {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .responsive-row button {
            width: 100% !important;
          }
          .responsive-btn, .responsive-input {
            width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
          }
          .responsive-modal {
            max-width: 96vw !important;
            width: 96vw !important;
            padding: 16px !important;
            min-width: 0 !important;
            margin: 10px !important;
          }
          .responsive-table {
            display: block !important;
            overflow-x: auto !important;
            width: 100% !important;
            font-size: 12px !important;
          }
          .procedure-card {
            margin-top: 16px !important;
            border-radius: 6px !important;
          }
          .procedure-card-content {
            padding: 12px !important;
          }
          .procedure-card-header h2 {
            font-size: 16px !important;
          }
          .item-row {
            flex-wrap: wrap !important;
            gap: 4px !important;
          }
          .item-size-inputs {
            margin-left: 0 !important;
            margin-top: 8px !important;
            width: 100% !important;
          }
          .size-qty-row {
            flex-wrap: wrap !important;
            gap: 4px !important;
          }
          .size-qty-row input {
            flex: 1 !important;
            min-width: 60px !important;
          }
          .add-item-row,
          .add-instrument-row {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .add-item-row input,
          .add-instrument-row input {
            width: 100% !important;
          }
          .add-item-row button,
          .add-instrument-row button {
            width: 100% !important;
          }
          .instrument-tags {
            flex-wrap: wrap !important;
            gap: 6px !important;
          }
          .instrument-tag {
            font-size: 12px !important;
            padding: 4px 8px !important;
          }
          .summary-container {
            padding: 12px !important;
            font-size: 13px !important;
          }
          .print-preview-modal {
            max-width: 98vw !important;
            width: 98vw !important;
            padding: 12px !important;
            max-height: 95vh !important;
          }
          .print-preview-buttons {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .print-preview-buttons button {
            width: 100% !important;
          }
          .image-modal-content {
            max-width: 95vw !important;
            width: 95vw !important;
            padding: 12px !important;
          }
          .image-modal-header h3 {
            font-size: 16px !important;
          }
          .image-container {
            padding: 12px !important;
          }
          .image-container img {
            max-height: 60vh !important;
          }
        }
        @media (max-width: 400px) {
          .main-container {
            padding: 4px !important;
          }
          .main-title {
            font-size: 18px !important;
          }
          .procedure-card-content {
            padding: 8px !important;
          }
        }
      `}</style>
      {/* End responsive styles */}

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
        <h1 className="main-title" style={{ fontSize: 28, fontWeight: "bold", textAlign: "center", width: "100%", marginBottom: 32 }}>SRR Ortho Implant DC Generator</h1>
      </div>
      <div className="hospital-dc-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8 }}>
        <input
          className="responsive-input"
          placeholder="Hospital Name"
          value={hospitalName}
          onChange={e => setHospitalName(e.target.value)}
          style={{ width: 220, padding: 8, border: "1px solid #ccc", borderRadius: 4, textAlign: 'left', boxSizing: 'border-box' }}
        />
        <input
          className="responsive-input"
          placeholder="DC No"
          value={dcNo}
          onChange={e => setDcNo(e.target.value)}
          style={{ width: 160, padding: 8, border: "1px solid #ccc", borderRadius: 4, textAlign: 'right', boxSizing: 'border-box' }}
        />
      </div>

      <div className="search-material-row" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Search Procedures"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, padding: 8, border: "1px solid #ccc", borderRadius: 4, boxSizing: 'border-box' }}
        />
        {/* Material Type Dropdown */}
        <select
          value={selectedMaterial}
          onChange={(e) => setSelectedMaterial(e.target.value)}
          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4, boxSizing: 'border-box', minWidth: 100 }}
        >
          <option value="SS">SS</option>
          <option value="Titanium">Titanium</option>
        </select>
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
        <div key={procedure.name} className="procedure-card" style={{ marginTop: 24, border: "1px solid #eee", borderRadius: 8, background: "#fafbfc" }}>
          <div className="procedure-card-content" style={{ padding: 16 }}>
            <div className="procedure-header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: 'wrap', gap: 8 }}>
              <h2 className="procedure-card-header" style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{procedure.name} Items</h2>
              <div className="procedure-header-buttons" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => toggleCollapse(procedure.name)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  {collapsedProcedures[procedure.name] ? <ChevronDown /> : <ChevronUp />}
                </button>
                <button
                  onClick={() => refetchSingleProcedure(procedure.name)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', marginLeft: 4 }}
                  title={`Refresh ${procedure.name} from sheet`}
                >
                  ↻
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
                          <span>{selectedMaterial === 'Titanium' ? 'Titanium ' + fixed.name : fixed.name}</span>
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
                {/* Editable items */}
                {procedure.items.map((item) => {
                  const key = `${procedure.name}__${item}`;
                  const isItemSelected = key in selectedItems;
                  const itemHasSizes = isItemSelected && selectedItems[key]?.length > 0;
                  const areDetailsVisible = showItemDetails[key] || false; // Default to false if undefined

                  return (
                    <div key={key} style={{ margin: "12px 0" }}>
                      <div className="item-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: 'wrap' }}>
                        <input
                          type="checkbox"
                          checked={isItemSelected}
                          onChange={() => handleItemChange(procedure.name, item)}
                          style={{ flexShrink: 0 }}
                        />
                        <span style={{ flex: 1, minWidth: 120, wordBreak: 'break-word' }}>{selectedMaterial === 'Titanium' ? 'Titanium ' + item.split('{')[0].trim() : item.split('{')[0].trim()}</span>

                        {/* Show toggle button only if the item is selected */}
                        {isItemSelected && (
                          <button
                            style={{
                              padding: "4px 8px",
                              borderRadius: 4,
                              background: "#e0e7ff",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 12,
                              lineHeight: 1,
                              whiteSpace: 'nowrap'
                            }}
                            onClick={() => setShowItemDetails(prev => ({ ...prev, [key]: !prev[key] }))}
                            title={areDetailsVisible ? "Hide sizes/qtys" : "Show sizes/qtys"}
                          >
                            {areDetailsVisible ? 'Hide Sizes' : 'Show Sizes'}
                          </button>
                        )}

                        {/* Show Add Size button only if the item is selected AND currently has no sizes */}
                        {isItemSelected && !itemHasSizes && (
                           <button style={{ padding: "4px 8px", borderRadius: 4, background: "#e0e7ff", border: "none", cursor: "pointer", whiteSpace: 'nowrap' }} onClick={() => handleAddSizeQty(key)}>
                            + Add Size
                          </button>
                        )}
                      </div>

                      {/* Show item details (size/qty inputs) only if item is selected, has sizes, AND is toggled on */}
                      {isItemSelected && itemHasSizes && areDetailsVisible && (
                        <div className="item-size-inputs" style={{ marginLeft: 32, marginTop: 4 }}>
                          {selectedItems[key].map((entry, index) => (
                            <div key={index} className="size-qty-row" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
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
                                style={{ width: 80, padding: 6, border: "1px solid #ccc", borderRadius: 4, boxSizing: 'border-box' }}
                              />
                              <input
                                placeholder="Qty"
                                type="number"
                                value={entry.qty}
                                onChange={(e) => handleSizeQtyChange(key, index, "qty", e.target.value)}
                                style={{ width: 60, padding: 6, border: "1px solid #ccc", borderRadius: 4, boxSizing: 'border-box' }}
                              />
                              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                <button
                                  style={{ borderRadius: "50%", padding: 4, width: 28, height: 28, border: "1px solid #222", background: "#f1f5f9", color: "#222", cursor: "pointer", display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  onClick={() => handleAddSizeQty(key)}
                                >
                                  +
                                </button>
                                <button
                                  style={{ borderRadius: "50%", padding: 4, width: 28, height: 28, border: "none", background: "#ef4444", color: "white", cursor: "pointer", display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  onClick={() => handleDeleteSizeQty(key, index)}
                                >
                                  <Trash2 style={{ width: 16, height: 16 }} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Add new item input */}
                <div className="add-item-row" style={{ marginTop: 8, display: 'flex', gap: 8, position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Add item"
                    value={newItemInputs[procedure.name] || ''}
                    onChange={e => handleNewItemInputChange(procedure.name, e.target.value)}
                    style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4, minWidth: 120, flex: 1, boxSizing: 'border-box' }}
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
                    <div className="instrument-tags" style={{ color: "#555", fontStyle: "italic", display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {procedure.instruments.map((inst, idx) => {
                        const hasImage = procedure.instrumentImageMapping?.[inst] || instrumentImageMap[inst];
                        return (
                          <span key={inst + idx} className="instrument-tag" style={{ display: "flex", alignItems: "center", background: "#e0e7ff", borderRadius: 4, padding: "4px 8px" }}>
                            {inst}
                            {hasImage && (
                              <button
                                onClick={() => handleShowInstrumentImage(procedure.name, inst)}
                                style={{
                                  marginLeft: 6,
                                  background: "none",
                                  border: "none",
                                  color: "#2563eb",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  padding: 2
                                }}
                                title={`View image of ${inst}`}
                              >
                                <Info size={14} />
                              </button>
                            )}
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
                        );
                      })}
                    </div>
                    {/* Add new instrument input */}
                    <div className="add-instrument-row" style={{ marginTop: 8, display: 'flex', gap: 8, position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Add instrument"
                        value={newInstrumentInputs[procedure.name] || ''}
                        onChange={e => handleNewInstrumentInputChange(procedure.name, e.target.value)}
                        style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4, minWidth: 120, flex: 1, boxSizing: 'border-box' }}
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

      {activeProcedures.length > 0 && (
        <div className="action-buttons-container" style={{ marginTop: 32, display: "flex", gap: 16, flexWrap: 'wrap' }}>
          <button
            onClick={handlePrint}
            className="responsive-btn"
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
              justifyContent: "center",
              gap: 8,
              transition: "background 0.2s",
              boxSizing: 'border-box'
            }}
            onMouseOver={e => e.currentTarget.style.background = "#1e293b"}
            onMouseOut={e => e.currentTarget.style.background = "#000"}
          >
            <span role="img" aria-label="Print">🖨️</span> Print
          </button>
          <button
            onClick={handleSavePDF}
            className="responsive-btn"
            style={{
              padding: "10px 24px",
              borderRadius: 6,
              background: "#2563eb",
              color: "#fff",
              border: "none",
              fontWeight: 500,
              fontSize: 16,
              cursor: "pointer",
              boxSizing: 'border-box'
            }}
          >
            Download PDF
          </button>
          <button 
            onClick={handleClearAll} 
            className="responsive-btn"
            style={{ padding: "10px 24px", borderRadius: 6, background: "#ef4444", color: "white", border: "none", fontWeight: 500, fontSize: 16, cursor: "pointer", boxSizing: 'border-box' }}
          >
            Clear All
          </button>
        </div>
      )}

      {activeProcedures.length > 0 && (
        <div className="summary-container" style={{ marginTop: 24, background: '#f8fafc', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
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
                    const displayedFixedName = selectedMaterial === 'Titanium' ? 'Titanium ' + fixed.name : fixed.name;
                    lines.push(
                      <div key={key}>
                        {displayedFixedName} - {fixedQtyEdits[key] ?? fixed.qty}
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
                  const displayedItemName = selectedMaterial === 'Titanium' ? 'Titanium ' + itemName : itemName; // Apply material prefix
                  // Group all sizes/qtys for this item
                  const sizeQtys = selectedItems[key]
                    .map(entry => `${entry.size || ''}${entry.size ? '-' : ''}${entry.qty}`)
                    .join(', ');
                  const totalQty = selectedItems[key].reduce((sum, entry) => sum + Number(entry.qty || 0), 0);
                  lines.push(
                    <div key={proc.name + '-' + item}>
                      {displayedItemName} {sizeQtys} <b>(Total: {totalQty})</b>
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
        <div data-print-modal style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
          <div className="print-preview-modal" style={{ background: 'white', borderRadius: 8, maxWidth: 900, width: '98vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 2px 16px rgba(0,0,0,0.25)', padding: 24, position: 'relative' }}>
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
                            const displayedFixedName = selectedMaterial === 'Titanium' ? 'Titanium ' + fixed.name : fixed.name;
                            rows.push(
                              <tr key={key}>
                                <td>{serial++}</td>
                                <td>{displayedFixedName}</td>
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
                          const displayedItemName = selectedMaterial === 'Titanium' ? 'Titanium ' + itemName : itemName; // Apply material prefix
                          const sizeQtys = selectedItems[key]
                            .map(entry => `${entry.size || ''}${entry.size ? '-' : ''}${entry.qty}`)
                            .join(', ');
                          const totalQty = selectedItems[key].reduce((sum, entry) => sum + Number(entry.qty || 0), 0);
                          rows.push(
                            <tr key={proc.name + '-' + item}>
                              <td>{serial++}</td>
                              <td>{displayedItemName} {sizeQtys}</td>
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
            <div className="print-preview-buttons" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
              <button onClick={() => setShowPrintPreview(false)} className="responsive-btn" style={{ padding: '8px 20px', borderRadius: 4, border: '1px solid #ccc', background: 'white', fontWeight: 500, fontSize: 16, boxSizing: 'border-box' }}>Close</button>
              <button onClick={doSavePDF} className="responsive-btn" style={{ padding: '8px 20px', borderRadius: 4, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 500, fontSize: 16, boxSizing: 'border-box' }}>Download PDF</button>
              <button onClick={() => window.print()} className="responsive-btn" style={{ padding: '8px 20px', borderRadius: 4, background: '#000', color: '#fff', border: 'none', fontWeight: 500, fontSize: 16, boxSizing: 'border-box' }}>Print</button>
            </div>
          </div>
        </div>
      )}

      {/* Instrument Image Modal */}
      {showImageModal && (
        <div 
          style={{ 
            position: "fixed", 
            inset: 0, 
            background: "rgba(0,0,0,0.7)", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            zIndex: 300,
            padding: 20
          }}
          onClick={() => setShowImageModal(false)}
        >
          <div 
            className="image-modal-content"
            style={{ 
              background: "white", 
              borderRadius: 8, 
              maxWidth: "90vw", 
              maxHeight: "90vh", 
              overflow: "auto",
              position: "relative",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="image-modal-header" style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              padding: 16, 
              borderBottom: "1px solid #eee" 
            }}>
              <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18, wordBreak: 'break-word', flex: 1, paddingRight: 8 }}>
                {selectedInstrumentImage.instrument}
              </h3>
              <button
                onClick={() => setShowImageModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  color: "#666",
                  padding: "0 8px",
                  lineHeight: 1
                }}
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="image-container" style={{ padding: 20, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
              {currentImageError && selectedInstrumentImage.fallbackUrls && (
                <div style={{ marginBottom: 12, padding: 8, background: "#fef3c7", borderRadius: 4, fontSize: 12 }}>
                  Trying alternative URL format...
                </div>
              )}
              <img
                key={selectedInstrumentImage.imageUrl} // Force re-render on URL change
                src={selectedInstrumentImage.imageUrl}
                alt={selectedInstrumentImage.instrument}
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                  borderRadius: 4,
                  border: "1px solid #e5e7eb"
                }}
                onLoad={() => {
                  console.log('Image loaded successfully:', selectedInstrumentImage.imageUrl);
                  setCurrentImageError(false);
                }}
                onError={(e) => {
                  console.error('Image failed to load:', selectedInstrumentImage.imageUrl);
                  
                  // Try fallback URLs if available
                  if (selectedInstrumentImage.fallbackUrls && !currentImageError) {
                    setCurrentImageError(true);
                    // Try preview format
                    if (selectedInstrumentImage.imageUrl === selectedInstrumentImage.fallbackUrls.thumbnail) {
                      console.log('Trying preview format...');
                      setSelectedInstrumentImage(prev => ({
                        ...prev,
                        imageUrl: selectedInstrumentImage.fallbackUrls.preview
                      }));
                      return;
                    }
                    // Try uc format
                    if (selectedInstrumentImage.imageUrl === selectedInstrumentImage.fallbackUrls.preview) {
                      console.log('Trying uc format...');
                      setSelectedInstrumentImage(prev => ({
                        ...prev,
                        imageUrl: selectedInstrumentImage.fallbackUrls.uc
                      }));
                      return;
                    }
                  }
                  
                  // All formats failed - show error
                  e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f3f4f6' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='sans-serif' font-size='14'%3EImage not available%3C/text%3E%3Ctext x='50%25' y='60%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='sans-serif' font-size='12'%3ECheck sharing settings%3C/text%3E%3C/svg%3E";
                  e.target.style.border = "1px solid #e5e7eb";
                }}
              />
              <div style={{ marginTop: 12, fontSize: 11, color: "#666", wordBreak: "break-all", maxWidth: "100%", textAlign: "center" }}>
                <div style={{ marginBottom: 4 }}>URL: {selectedInstrumentImage.imageUrl}</div>
                {selectedInstrumentImage.fallbackUrls && (
                  <a 
                    href={selectedInstrumentImage.fallbackUrls.original} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: "#2563eb", textDecoration: "underline" }}
                  >
                    Open in new tab
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
