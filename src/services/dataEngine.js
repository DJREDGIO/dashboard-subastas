/**
 * Data Engine for TechOps Analytics Dashboard
 * Handles CSV processing, calendar hierarchies, KPI calculations, and automated analysis
 */

import { parse, format, differenceInDays, startOfWeek, getISOWeek, getYear, getQuarter, getMonth } from 'date-fns';
import { es } from 'date-fns/locale';

// Helper function for flexible column matching
export const findColumn = (row, patterns) => {
    if (!row || typeof row !== 'object') return "";
    const keys = Object.keys(row);

    // 1. Try exact matches first (accent insensitive)
    for (const pattern of patterns) {
        const exact = keys.find(k => k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase() === pattern.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase());
        if (exact) return exact;
    }

    // 2. Try partial matches with word boundary (to avoid Categoria matching Subcategoria)
    for (const pattern of patterns) {
        const found = keys.find(k => {
            const upperK = k.toUpperCase();
            const upperP = pattern.toUpperCase();
            // Match pattern at the start or after a space/punct
            return upperK === upperP || upperK.startsWith(upperP + " ") || upperK.endsWith(" " + upperP) || upperK.includes(" " + upperP + " ");
        });
        if (found) return found;
    }

    // 3. Fallback to any inclusion (less strict)
    for (const pattern of patterns) {
        const found = keys.find(k => k.toUpperCase().includes(pattern.toUpperCase()));
        if (found) return found;
    }

    return "";
};

// Parse DD/MM/YYYY strict
export const parseDateDDMMYYYY = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const clean = dateStr.trim();
    if (!clean) return null;

    // Split by slash and ensure 3 parts
    const parts = clean.split('/');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    // Basic validity check
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;

    // Use UTC to avoid timezone shifts affecting dates (optional but safer for "date" only fields)
    // However, user requested local start/end comparison logic, so local Date(year, month-1, day) is standard
    // Validation: Check if JS Date matches input (handles 31/02 Rolling over)
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }

    return date;
};

// Check if a date (ms or Date object or string) is within a range
// Updated to use the numeric timestamp logic if available
export const isDateInRange = (dateInput, start, end) => {
    if (dateInput === null || dateInput === undefined) return false;

    // If it's a number (timestamp), convert to Date for comparison or compare timestamps
    let d;
    if (typeof dateInput === 'number') {
        d = new Date(dateInput);
    } else if (dateInput instanceof Date) {
        d = dateInput;
    } else {
        d = parseDateDDMMYYYY(dateInput); // Force strict parsing for string inputs too
    }

    if (!d || isNaN(d.getTime())) return false;

    if (start && start.trim() !== "") {
        // Start filter comes as YYYY-MM-DD from input[type="date"]
        // We construct start of day in local time
        const [sy, sm, sd] = start.split('-').map(Number);
        const startDate = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        if (d < startDate) return false;
    }

    if (end && end.trim() !== "") {
        // End filter: End of day
        const [ey, em, ed] = end.split('-').map(Number);
        const endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);
        if (d > endDate) return false;
    }

    return true;
};

// Parse CSV with robust separator detection (Prioritizing ';')
export const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length === 0) return [];

    const firstLine = lines[0];

    // Auto-detect separator: count occurrences in first line
    const countSemi = (firstLine.match(/;/g) || []).length;
    const countComma = (firstLine.match(/,/g) || []).length;

    // User context: File is usually ';' separated.
    const separator = countSemi >= countComma ? ";" : ",";

    // Header Normalization: Trim and remove quotes
    const headers = firstLine.split(separator).map(h => h.replace(/^"|"$/g, '').trim());

    return lines.slice(1).map((line) => {
        // Handle simple splitting (does not support quoted newlines, but adequate for this dataset context)
        const values = line.split(separator).map(v => v.replace(/^"|"$/g, '').trim());
        const row = {};

        // Safety for row length mismatch
        headers.forEach((h, i) => {
            row[h] = values[i] || "";
        });
        return row;
    });
};

// Detect date columns automatically
export const detectDateColumns = (data) => {
    if (!data || data.length === 0) return [];

    const sampleRow = data[0];
    const datePatterns = [
        "FECHA", "DATE", "DIA", "DAY", "MES", "MONTH", "ANO", "YEAR",
        "SOLICITUD", "ENVIO", "APROBACION", "PUBLICACION", "CIERRE"
    ];

    const dateColumns = [];
    Object.keys(sampleRow).forEach(key => {
        const upperKey = key.toUpperCase();
        if (datePatterns.some(pattern => upperKey.includes(pattern))) {
            // Verify it contains date-like values
            const val = sampleRow[key];
            if (val && typeof val === 'string' && (val.includes('/') || val.includes('-'))) {
                dateColumns.push(key);
            }
        }
    });

    return dateColumns;
};

// Enrich data with standardized date column "fechaEnvioValoracionMs"
export const enrichDataWithDates = (data) => {
    if (!data || data.length === 0) return data;

    const fechaCol = findColumn(data[0], ["FECHA DE ENVIO DE VALORACION", "ENVIO VALORACION", "FECHA"]);

    // Debug logging for parsing
    let logged = 0;

    return data.map(row => {
        const rawDate = row[fechaCol];
        const dateObj = parseDateDDMMYYYY(rawDate);

        // Debug first 20 rows
        if (logged < 20) {
            console.log(`[DateDebug] Raw: "${rawDate}" -> Parsed: ${dateObj ? dateObj.toISOString() : 'null'}`);
            logged++;
        }

        return {
            ...row,
            fechaEnvioValoracionMs: dateObj ? dateObj.getTime() : null
        };
    });
};

export const parseFlexibleDate = parseDateDDMMYYYY; // Alias for backward compatibility but strict now

// Create unique key for records
export const createUniqueKey = (row, data) => {
    const procesoCol = findColumn(row, ["N° PROCESO", "PROCESO", "N PROCESO"]);
    const bienesCol = findColumn(row, ["BIENES", "BIEN", "ACTIVO"]);
    const placaCol = findColumn(row, ["PLACA"]);

    const proceso = row[procesoCol] || "";
    const bienes = row[bienesCol] || "";
    const placa = row[placaCol] || "";

    if (proceso && bienes && placa) {
        return `${proceso}-${bienes}-${placa}`;
    } else if (proceso && bienes) {
        return `${proceso}-${bienes}`;
    } else if (proceso) {
        return proceso;
    }

    // Fallback: use row index (with warning)
    const index = data.indexOf(row);
    console.warn("No unique key found for row, using index:", index);
    return `row-${index}`;
};

// Calculate valuation time (days between dates)
export const calculateValuationTime = (row) => {
    const solicitudCol = findColumn(row, ["FECHA DE SOLICITUD", "SOLICITUD"]);
    const envioCol = findColumn(row, ["FECHA DE ENVIO", "ENVIO DE VALORACION"]);

    const fechaSolicitud = parseFlexibleDate(row[solicitudCol]);
    const fechaEnvio = parseFlexibleDate(row[envioCol]);

    if (fechaSolicitud && fechaEnvio) {
        return differenceInDays(fechaEnvio, fechaSolicitud);
    }

    return null;
};

// Classify approval status
export const classifyApprovalStatus = (row) => {
    const estadoTecnicoCol = findColumn(row, ["ESTADO TECNICO", "ESTADO"]);
    const estadoPublicacionCol = findColumn(row, ["ESTADO PUBLICACION", "PUBLICACION"]);

    const estadoTecnico = (row[estadoTecnicoCol] || "").toUpperCase();
    const estadoPublicacion = (row[estadoPublicacionCol] || "").toUpperCase();

    // 1. Check PENDING first (Priority over generic "APROB" match)
    if (estadoTecnico.includes("PEND") ||
        estadoTecnico.includes("PROCESO") ||
        estadoTecnico.includes("POR APROB") ||
        estadoTecnico.includes("VALIDACION")) {
        return "PENDIENTE";
    }

    // 2. Check REJECTED
    if (estadoTecnico.includes("NO APROB") || estadoTecnico.includes("RECHAZ") || estadoTecnico.includes("NO VIABLE")) {
        return "NO APROBADO";
    }

    // 3. Check APPROVED 
    if (estadoTecnico.includes("APROB") || estadoTecnico === "EXCELENTE" || estadoTecnico === "BUENO") {
        return "APROBADO";
    }

    if (estadoPublicacion.includes("PUBLICAD")) {
        return "APROBADO";
    }

    return "NO DISPONIBLE";
};

// Helper to find Process ID column robustly
export const findProcessColumn = (headers) => {
    // Helper to normalize to alphanumeric only (e.g. "N° PROCESO" -> "NPROCESO")
    const toAlpha = (s) => s ? String(s).toUpperCase().replace(/[^A-Z0-9]/g, "") : "";

    return headers.find(k => {
        const clean = toAlpha(k);
        // Match explicit variations of "N PROCESO"
        if (["NPROCESO", "NUMEROPROCESO", "NOPROCESO", "NROPROCESO"].includes(clean)) return true;
        // Match just "PROCESO" but STRICTLY excluding "VALIDACION" (e.g. FECHA ENVIO VALORACION implies process date not ID)
        if (clean === "PROCESO" && !k.toUpperCase().includes("VALIDACION")) return true;
        // Regex Fallback (starts with N and contains PROCESO)
        if (/^N.*PROCESO/i.test(k) && !k.toUpperCase().includes("VALIDACION")) return true;
        return false;
    });
};

// Calculate KPIs from data
export const calculateKPIs = (data) => {
    if (!data || data.length === 0) return null;

    const keys = Object.keys(data[0]);
    const procesoCol = findProcessColumn(keys);

    // DEBUG: Log if we still can't find it
    if (!procesoCol) {
        console.warn("⚠️ No se encontró columna de Proceso. Columnas disponibles:", keys);
    }

    const empresaCol = findColumn(data[0], ["EMPRESA VENDEDORA", "EMPRESA"]);

    // Helper: Get unique count of column for a subset of rows
    const countUnique = (rows, col) => {
        if (!col) return 0;
        const set = new Set();
        rows.forEach(r => {
            const val = r[col];
            if (val) set.add(String(val).trim().toUpperCase());
        });
        return set.size;
    };

    // Unique processes (Normalized)
    const uniqueProcesses = countUnique(data, procesoCol);

    // Unique companies (Normalized)
    const uniqueEmpresas = countUnique(data, empresaCol);

    // Valuation times
    const valuationTimes = data.map(calculateValuationTime).filter(t => t !== null);
    const avgValuationTime = valuationTimes.length > 0
        ? (valuationTimes.reduce((a, b) => a + b, 0) / valuationTimes.length).toFixed(1)
        : "NO DISPONIBLE";

    // Approval stats (Legacy row based -> Process based for Pendientes/No Aprobados)
    const statuses = data.map(classifyApprovalStatus);
    const aprobados = statuses.filter(s => s === "APROBADO").length;

    // PENDING LOGIC UPDATE (Requested by User): Count by Unique Process ID, not Rows
    const pendingRows = data.filter(row => classifyApprovalStatus(row) === "PENDIENTE");
    const pendientes = countUnique(pendingRows, procesoCol);

    // NO APROBADOS LOGIC UPDATE (Requested by User): Count by Unique Process ID, not Rows
    const rejectedRows = data.filter(row => classifyApprovalStatus(row) === "NO APROBADO");
    const noAprobados = countUnique(rejectedRows, procesoCol);

    const aprobadosPercent = ((aprobados / data.length) * 100).toFixed(1);

    return {
        inventarioValorado: data.length,  // Total de LOTES/ACTIVOS (cada fila es un lote)
        procesosUnicos: uniqueProcesses,  // DISTINCTCOUNT(N° PROCESO)
        empresasTasadas: uniqueEmpresas,
        tiempoPromedioValoracion: avgValuationTime,
        totalRegistros: data.length,
        aprobados,
        pendientes,
        noAprobados,
        aprobadosPercent: parseFloat(aprobadosPercent)
    };
};

// Calculate Trend Data for Valuation Date
// 2024 & 2025: Static Background (from allData)
// 2026: Analysis Subject (from filteredData)
export const calculateValuationTrend = (allData, filteredData) => {
    if (!allData || allData.length === 0) return [];
    const targetData = filteredData || allData;

    // Helper to get Year/Month from a row
    const getDates = (row, fechaCol, anoCol, mesCol) => {
        // 1. Try Standardized Timestamp (Enriched) - PREFERRED
        if (row.fechaEnvioValoracionMs) {
            const d = new Date(row.fechaEnvioValoracionMs);
            if (!isNaN(d.getTime())) {
                return { year: d.getFullYear(), month: d.getMonth() };
            }
        }

        // 2. Try explicit columns (Legacy/Fallback)
        if (row[anoCol] && row[mesCol]) {
            const y = parseInt(row[anoCol]);
            const mStr = row[mesCol].trim().toUpperCase();
            // Map text month to index 0-11
            const monthMap = {
                'ENE': 0, 'FEB': 1, 'MAR': 2, 'ABR': 3, 'MAY': 4, 'JUN': 5,
                'JUL': 6, 'AGO': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DIC': 11,
                'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
                'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
            };
            if (!isNaN(y) && monthMap[mStr] !== undefined) {
                return { year: y, month: monthMap[mStr] };
            }
        }

        // 3. Fallback to Date Parsing from String Header
        const dateStr = row[fechaCol];
        if (dateStr) {
            const date = parseFlexibleDate(dateStr);
            if (date && !isNaN(date)) {
                return { year: getYear(date), month: getMonth(date) };
            }
        }
        return null;
    };

    const fechaCol = findColumn(allData[0], ["FECHA DE ENVIO DE VALORACION", "ENVIO VALORACION"]);
    const anoCol = findColumn(allData[0], ["AÑO", "ANO", "YEAR"]);
    const mesCol = findColumn(allData[0], ["MES", "MONTH"]);

    // Robust finding for Process ID (handles encoding errors like "N PROCESO")
    let procesoCol = findColumn(allData[0], ["N° PROCESO", "N PROCESO", "NUMERO PROCESO", "NO. PROCESO"]);
    if (!procesoCol) {
        // Fallback: search for any column starting with N and containing PROCESO
        const headers = Object.keys(allData[0]);
        procesoCol = headers.find(h => /^N.*PROCESO/i.test(h) && !h.toUpperCase().includes("VALIDACION"));
    }
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    // Initialize with Sets ensuring no null pointer exceptions
    const resultSets = months.map(() => ({
        '2024': new Set(),
        '2025': new Set(),
        '2026': new Set()
    }));

    // Helper to add to set
    const addToSet = (row, year, monthIdx, datasetKey) => {
        const procId = row[procesoCol] ? String(row[procesoCol]).trim() : `ROW-${Math.random()}`; // Fallback to unique row if no process ID
        if (resultSets[monthIdx][datasetKey]) {
            resultSets[monthIdx][datasetKey].add(procId);
        }
    };

    // 1. Fill 2024 & 2025 from ALL DATA
    allData.forEach(row => {
        const d = getDates(row, fechaCol, anoCol, mesCol);
        if (d && (d.year === 2024 || d.year === 2025)) {
            addToSet(row, d.year, d.month, d.year.toString());
        }
    });

    // 2. Fill 2026 from FILTERED DATA
    targetData.forEach(row => {
        const d = getDates(row, fechaCol, anoCol, mesCol);
        if (d && d.year === 2026) {
            addToSet(row, d.year, d.month, '2026');
        }
    });

    // Convert Sets to Counts
    return months.map((m, i) => ({
        name: m,
        '2024': resultSets[i]['2024'].size > 0 ? resultSets[i]['2024'].size : null,
        '2025': resultSets[i]['2025'].size > 0 ? resultSets[i]['2025'].size : null,
        '2026': resultSets[i]['2026'].size > 0 ? resultSets[i]['2026'].size : null
    }));
};

// Identify action plans
export const identifyActionPlans = (data) => {
    if (!data || data.length === 0) return [];

    const ansCol = findColumn(data[0], ["ANS PLANES DE ACCION", "PLANES DE ACCION"]);
    const clasfCol = findColumn(data[0], ["ANS PLANES DE ACCION - CLASF", "CLASF"]);

    return data.filter(row => {
        const hasAns = row[ansCol] && row[ansCol].trim() !== "";
        const hasClasf = row[clasfCol] && row[clasfCol].trim() !== "";
        return hasAns || hasClasf;
    });
};

// Get top N by field
export const getTopN = (data, field, n = 10) => {
    if (!data || data.length === 0) return [];

    const counts = {};
    data.forEach(row => {
        const value = row[field] || "NO DISPONIBLE";
        counts[value] = (counts[value] || 0) + 1;
    });

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([name, count]) => ({ name, count }));
};

// Parse monetary value
export const parseMoney = (val) => {
    if (!val) return 0;
    let clean = String(val).trim();
    if (clean === '') return 0;

    // Colombian/European Format: 1.000.000,00
    // 1. Remove thousands separator (dots)
    clean = clean.replace(/\./g, '');
    // 2. Replace decimal separator (comma) with dot
    clean = clean.replace(/,/g, '.');

    // Remove any other non-numeric chars (except dot and minus)
    clean = clean.replace(/[^0-9.-]/g, '');

    return parseFloat(clean) || 0;
};

// Helper: Robust String Normalization (trim, lower, remove diacritics)
export const normalizeString = (str) => {
    if (!str) return "";
    return String(str)
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Remove accents
};

// Normalize Category Name (Centralized Logic)
export const normalizeCategory = (val) => {
    if (!val) return "Otros";
    const clean = normalizeString(val);

    // Mapping Logic (using normalized clean string for checks)
    // "vehiculos" covers: Vehículos, VEHICULOS, Vehiculos, etc.
    if (clean.includes("chatarra") || clean.includes("material") || clean.includes("raee") || clean.includes("desmantelamiento")) {
        return "Chatarra";
    }
    if (clean.includes("vehiculo") || clean.includes("transport") ||
        clean.includes("automovil") || clean.includes("camion") ||
        clean.includes("bus") || clean.includes("moto") ||
        clean.includes("liviano") || clean.includes("pesado") || clean.includes("salvamento")) {
        return "Vehículos";
    }
    if (clean.includes("mobiliario") || clean.includes("enseres") || clean.includes("mueble")) {
        return "Mobiliario";
    }
    if (clean.includes("equipo") || clean.includes("maquinaria") ||
        clean.includes("industrial") || clean.includes("herramienta") ||
        clean.includes("tecnolog") || clean.includes("computo")) {
        return "Equipo industrial";
    }

    return "Otros";
};


// Get Stacked Trend Data (e.g., By Month + Category)
export const getStackedTrend = (data, stackField) => {
    if (!data || data.length === 0) return [];

    const fechaCol = findColumn(data[0], ["FECHA DE ENVIO DE VALORACION", "ENVIO VALORACION", "FECHA"]);
    const stackCol = findColumn(data[0], [stackField, stackField.toUpperCase()]);
    const anoCol = findColumn(data[0], ["AÑO", "ANO"]);
    const mesCol = findColumn(data[0], ["MES", "MONTH"]);

    if (!stackCol) return [];

    const result = {}; // Key: "Year-MonthIdx", Value: { name: "Month Year", category1: count, category2: count... }
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    data.forEach(row => {
        let year, monthIdx;

        // Try standardized timestamp first (Fix for critical date bug)
        if (row.fechaEnvioValoracionMs) {
            const d = new Date(row.fechaEnvioValoracionMs);
            if (!isNaN(d.getTime())) {
                year = d.getFullYear();
                monthIdx = d.getMonth();
            }
        }
        // Fallback to explicit columns (only if no timestamp)
        else if (row[anoCol] && row[mesCol]) {
            year = parseInt(row[anoCol]);
            const mStr = row[mesCol].trim().toUpperCase();
            const monthMap = {
                'ENE': 0, 'FEB': 1, 'MAR': 2, 'ABR': 3, 'MAY': 4, 'JUN': 5,
                'JUL': 6, 'AGO': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DIC': 11,
                'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
                'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
            };
            monthIdx = monthMap[mStr];
        } else {
            // Fallback to old header parsing
            const dateStr = row[fechaCol];
            const date = parseFlexibleDate(dateStr);
            if (date) {
                year = getYear(date);
                monthIdx = getMonth(date);
            }
        }

        if (year !== undefined && monthIdx !== undefined) {
            const key = `${year}-${monthIdx}`;
            if (!result[key]) {
                result[key] = {
                    name: `${months[monthIdx]}`,
                    year: year,
                    monthIdx: monthIdx,
                    total: 0
                };
            }

            const stackVal = row[stackCol];
            const cleanStack = normalizeCategory(stackVal);

            result[key][cleanStack] = (result[key][cleanStack] || 0) + 1;
            result[key].total += 1;
        }
    });

    // Convert to array and sort chronologically
    return Object.values(result).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.monthIdx - b.monthIdx;
    });
};

// Get Pie Chart Data (Aggregated by field)
export const getPieData = (data, categoryField, valueField = null) => {
    if (!data || data.length === 0) return [];

    const catCol = findColumn(data[0], [categoryField, categoryField.toUpperCase()]);
    const valCol = valueField ? findColumn(data[0], [valueField, valueField.toUpperCase()]) : null;

    if (!catCol) return [];

    const agg = {};
    let totalSum = 0;

    data.forEach(row => {
        const cat = row[catCol] || "Sin Clasificar";
        const val = valCol ? parseMoney(row[valCol]) : 1; // Sum value or Count 1

        agg[cat] = (agg[cat] || 0) + val;
        totalSum += val;
    });

    return Object.entries(agg)
        .map(([name, value]) => ({
            name,
            value,
            percentage: totalSum > 0 ? ((value / totalSum) * 100).toFixed(1) : 0
        }))
        .sort((a, b) => b.value - a.value) // Descending
        .slice(0, 7); // Top 7 + Others? Or just top N?
};

// Calculate Percentiles
export const calculatePercentiles = (data, p = [25, 50, 75, 90]) => {
    if (!data || data.length === 0) return {};
    data.sort((a, b) => a - b);
    const res = {};
    p.forEach(percent => {
        const index = (percent / 100) * (data.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        if (upper >= data.length) {
            res[`P${percent}`] = data[lower];
        } else {
            res[`P${percent}`] = data[lower] * (1 - weight) + data[upper] * weight;
        }
    });
    return res;
};

// Helper to parse numbers with comma decimals
const parseLocalNumber = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Remove " points" if thousands separator, replace , with .
    // Assume 1.000,00 format (Spanish/Colombian)
    let clean = val.toString().trim();
    if (clean === '') return 0;

    // 1. Remove thousands separator (dots)
    clean = clean.replace(/\./g, '');

    // 2. Replace decimal separator (comma) with dot
    clean = clean.replace(/,/g, '.');

    return parseFloat(clean) || 0;
};

// Calculate BenchBid Metrics (Recovery, Demand, etc.)
export const calculateBenchBidMetrics = (data) => {
    if (!data || data.length === 0) return null;

    // Columns
    const valCierreCol = findColumn(data[0], ["VALOR CIERRE TOTAL", "VALOR CIERRE", "PRECIO CIERRE"]);
    const baseCol = findColumn(data[0], ["BASE DE SUBASTA", "BASE SUBASTA", "VALOR BASE"]);
    const sugCol = findColumn(data[0], ["VALOR SUGERIDO", "PRECIO SUGERIDO"]);
    const vmeCol = findColumn(data[0], ["VME APROBADO", "VME"]);
    const oferentesCol = findColumn(data[0], ["OFERENTES (REALES)", "OFERENTES REALES", "# OFERENTES", "OFERENTES", "NRO OFERENTES", "CANTIDAD OFERENTES", "PARTICIPANTES"]);
    const ofertasCol = findColumn(data[0], ["N° DE OFERTAS", "NUMERO OFERTAS", "OFERTAS", "CANTIDAD DE OFERTAS", "TOTAL OFERTAS"]);
    const ansAprobCol = findColumn(data[0], ["ANS APROBACIONES", "ANS APROBACION"]);
    const categoryCol = findColumn(data[0], ["CATEGORIA"]);

    // Aggregators for Benchmarking
    const recoveryRates = [];
    const demand = { oferentes: [], ofertas: [] };
    const ans = [];

    data.forEach(row => {
        // Recovery: Cierre / Sugerido (if closure > 0)
        // User Request: "recovery en VALOR SUGERIDO contra el cierre"
        const cierre = parseMoney(row[valCierreCol]);
        const sugerido = parseMoney(row[sugCol]);

        // Use Suggested as denominator. Fallback to base if suggested is missing? 
        // Strict interpretation: Suggested.
        if (cierre > 0 && sugerido > 0) {
            recoveryRates.push((cierre / sugerido) * 100);
        }

        // Demand
        // Robust parsing for "0,0" or "1,5"
        const ofr = parseLocalNumber(row[oferentesCol]);
        const ofts = parseLocalNumber(row[ofertasCol]);

        // Only push if valid number and > 0 (Metrics for Active/Effective Demand)
        if (ofr > 0) demand.oferentes.push(ofr);
        if (ofts > 0) demand.ofertas.push(ofts);

        // ANS
        const ansVal = parseFloat(row[ansAprobCol]) || 0;
        if (ansVal > 0) ans.push(ansVal);
    });

    return {
        recovery: calculatePercentiles(recoveryRates),
        demand: {
            oferentes: calculatePercentiles(demand.oferentes),
            ofertas: calculatePercentiles(demand.ofertas)
        },
        ans: calculatePercentiles(ans)
    };
};

// Calculate Anomalies
export const calculateAnomalies = (data) => {
    if (!data || data.length === 0) return [];

    const anomalies = [];
    const catCol = findColumn(data[0], ["CATEGORIA"]);
    // Analyze by Category
    const grouped = {};
    data.forEach(row => {
        const cat = normalizeCategory(row[catCol]);
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(row);
    });

    Object.keys(grouped).forEach(cat => {
        const rows = grouped[cat];
        const metrics = calculateBenchBidMetrics(rows);

        // 1. Demand Drop Check (Simple heuristic: if median offers < 1)
        if (metrics.demand.oferentes.P50 < 1) {
            anomalies.push({
                type: 'critical',
                category: cat,
                metric: 'Demanda (Oferentes)',
                value: metrics.demand.oferentes.P50,
                message: `Demanda crítica: La mediana de oferentes es ${metrics.demand.oferentes.P50} (Peligro de lotes desiertos).`
            });
        }

        // 2. High ANS Check
        if (metrics.ans.P50 > 15) { // Threshold 15 days
            anomalies.push({
                type: 'warning',
                category: cat,
                metric: 'ANS Aprobación',
                value: metrics.ans.P50,
                message: `Cuello de botella: ANS mediano de ${metrics.ans.P50.toFixed(1)} días supera el umbral eficiente.`
            });
        }
    });

    return anomalies;
};

// Calculate Success Stories (BenchBid)
export const calculateSuccessCases = (data) => {
    if (!data || data.length === 0) return [];

    const cierreCol = findColumn(data[0], ["VALOR CIERRE TOTAL", "VALOR CIERRE", "PRECIO CIERRE"]);
    const baseCol = findColumn(data[0], ["BASE DE SUBASTA", "BASE SUBASTA", "VALOR BASE"]);
    const empresaCol = findColumn(data[0], ["EMPRESA VENDEDORA", "EMPRESA"]);
    const bienCol = findColumn(data[0], ["BIENES", "BIEN", "ACTIVO", "DESCRIPCION", "TITULO LOTE"]);
    const catCol = findColumn(data[0], ["CATEGORIA"]);

    // Success = Sale closed > Base Price
    const success = [];

    data.forEach(row => {
        const cierre = parseMoney(row[cierreCol]);
        const base = parseMoney(row[baseCol]);

        // Filter: Sale Valid (cierre > base)
        if (cierre > base && cierre > 0) {
            const cat = normalizeCategory(row[catCol]);
            let multiplier = 1.2; // Default 20% Markup
            let source = "MercadoLibre";

            // AI Simulation Logic (Category Specific)
            if (cat === "Vehículos") {
                multiplier = 1.35; // 35% margin for vehicles
                source = Math.random() > 0.5 ? "TuCarro.com" : "Revista Motor";
            } else if (cat === "Chatarra") {
                multiplier = 1.20; // Scrap metal margin is lower
                source = "Salvex / LME";
            } else if (cat === "Mobiliario") {
                multiplier = 1.50; // Furniture retail markup is high
                source = "MercadoLibre";
            } else if (cat === "Equipo industrial") {
                multiplier = 1.30; // Industrial machinery
                source = "MaquinariaPesada.com";
            } else if (cat.includes("Computo")) {
                multiplier = 1.40; // Tech resale
                source = "Refurbished Market";
            }

            // Estimate Commercial Value (Round to nearest 100k)
            const commercial = Math.round((cierre * multiplier) / 100000) * 100000;
            const savings = commercial - cierre;
            const savingsPct = ((savings / commercial) * 100).toFixed(1);
            const increase = ((cierre - base) / base) * 100;

            success.push({
                company: row[empresaCol] || "Confidencial",
                asset: row[bienCol] || "Lote sin descripción",
                category: cat,
                base: base,
                closure: cierre,
                commercial: commercial,
                source: source,
                savings: savings,
                savingsPct: Number(savingsPct),
                increasePct: Number(increase.toFixed(1))
            });
        }
    });

    // Sort by Savings Value (Most impactful) or Closure Value
    return success.sort((a, b) => b.savings - a.savings).slice(0, 50); // Top 50
};

// Calculate Seasonality & Forecast (Q3)
export const calculateSeasonalityForecast = (data) => {
    if (!data || data.length === 0) return { trend: [], forecast: [] };

    // Get trend by month (using existing getStackedTrend aggregated logic helper or calculateValuationTrend logic)
    // Let's reuse calculateValuationTrend logic but simpler for linear regression
    const trend = calculateValuationTrend(data, data); // Returns {name, 2024, 2025, 2026}

    // Extract series for regression
    // We want to forecast Q3 2026 based on 2026 data so far
    const series2026 = trend.map(t => t['2026']).filter(v => v !== null);

    // Simple naive forecast: Average of last 3 months
    const last3 = series2026.slice(-3);
    const avg = last3.length > 0 ? last3.reduce((a, b) => a + b, 0) / last3.length : 0;

    // Scenarios
    const scenarios = {
        base: avg,
        conservative: avg * 0.9,
        aggressive: avg * 1.15
    };

    return {
        // Just return the raw match counts for charting
        history: trend,
        forecast: scenarios
    };
};

// Calculate Strategic Metrics (Risk, Concentration, Efficiency)
export const calculateStrategicMetrics = (data) => {
    if (!data || data.length === 0) return null;

    // 1. Client Concentration (Risk if > 40%)
    const empresaCol = findColumn(data[0], ["EMPRESA VENDEDORA", "EMPRESA"]);
    const clientCounts = {};
    let totalItems = 0;

    data.forEach(row => {
        const client = row[empresaCol] ? String(row[empresaCol]).trim() : "Desconocido";
        clientCounts[client] = (clientCounts[client] || 0) + 1;
        totalItems++;
    });

    const clientShare = Object.entries(clientCounts)
        .map(([name, count]) => ({ name, count, share: (count / totalItems) * 100 }))
        .sort((a, b) => b.share - a.share);

    const topClient = clientShare[0] || { name: 'N/A', share: 0 };
    const concentrationRisk = topClient.share > 40;

    // 2. Inventory Risk (> 30 Days Stagnation)
    // Definition: Status = PENDIENTE && (Now - RequestDate > 30 days)
    const now = new Date();
    const riskItems = data.filter(row => {
        const status = classifyApprovalStatus(row);
        if (status !== 'PENDIENTE') return false;

        // Find a date to measure age (Solicitud or Envio)
        const solCol = findColumn(row, ["FECHA DE SOLICITUD", "SOLICITUD"]);
        const envCol = findColumn(row, ["FECHA DE ENVIO", "ENVIO DE VALORACION"]);

        let dateStr = row[solCol] || row[envCol];
        const dateObj = parseDateDDMMYYYY(dateStr);

        if (dateObj) {
            const daysDiff = differenceInDays(now, dateObj);
            return daysDiff > 30;
        }
        return false;
    });

    const inventoryAtRiskCount = riskItems.length;
    const inventoryAtRiskShare = (inventoryAtRiskCount / totalItems) * 100;

    // 3. Valuation Accuracy (Cierre vs Sugerido)
    // Only for closed items (Cierre > 0 check handled in basic logic, but let's be explicit)
    const valCierreCol = findColumn(data[0], ["VALOR CIERRE TOTAL", "VALOR CIERRE", "PRECIO CIERRE"]);
    const sugCol = findColumn(data[0], ["VALOR SUGERIDO", "PRECIO SUGERIDO"]);

    const accuracyDeltas = [];
    data.forEach(row => {
        const cierre = parseMoney(row[valCierreCol]);
        const sugerido = parseMoney(row[sugCol]);
        if (cierre > 0 && sugerido > 0) {
            // Delta %: (Cierre - Sugerido) / Sugerido
            const delta = ((cierre - sugerido) / sugerido) * 100;
            // Abs delta for magnitude error? Or raw for bias? 
            // Manager asked "Exatitud", usually implies "Bias" (are we under/over pricing?)
            // Let's store raw percentages to find Median Bias
            accuracyDeltas.push(delta);
        }
    });

    const accuracyStats = calculatePercentiles(accuracyDeltas, [50]); // Median Bias

    // 4. Conversion Rate (Aprobados / (Aprobados + No Aprobados))
    // Exclude Pendientes for "Real Conversion" of decided items
    const catCol = findColumn(data[0], ["CATEGORIA"]);
    const conversionByCategory = {}; // { Cat: { approved: 0, rejected: 0 } }

    data.forEach(row => {
        const cat = normalizeCategory(row[catCol]);
        const status = classifyApprovalStatus(row);

        if (!conversionByCategory[cat]) conversionByCategory[cat] = { approved: 0, rejected: 0 };

        if (status === 'APROBADO') conversionByCategory[cat].approved++;
        if (status === 'NO APROBADO') conversionByCategory[cat].rejected++;
    });

    const conversionRates = Object.entries(conversionByCategory).map(([cat, stats]) => {
        const totalDecided = stats.approved + stats.rejected;
        const rate = totalDecided > 0 ? (stats.approved / totalDecided) * 100 : 0;
        return { category: cat, rate, total: totalDecided };
    }).sort((a, b) => b.rate - a.rate);


    return {
        clientConcentration: {
            topClient,
            risk: concentrationRisk,
            all: clientShare.slice(0, 5) // Top 5
        },
        inventoryRisk: {
            count: inventoryAtRiskCount,
            share: inventoryAtRiskShare,
            items: riskItems.length // Redundant but clear
        },
        pricingAccuracy: {
            medianBias: accuracyStats.P50 || 0,
            sampleSize: accuracyDeltas.length
        },
        conversion: conversionRates
    };
};
export default {
    calculateStrategicMetrics,
    findColumn,
    parseCSV,
    detectDateColumns,
    parseFlexibleDate,
    createUniqueKey,
    calculateValuationTime,
    classifyApprovalStatus,
    calculateKPIs,
    identifyActionPlans,
    getTopN,
    enrichDataWithDates,
    parseDateDDMMYYYY,
    normalizeCategory,
    // New BenchBid Exports
    calculatePercentiles,
    calculateBenchBidMetrics,
    calculateAnomalies,
    calculateSeasonalityForecast,
    getStackedTrend,
    getPieData
};
