import { findColumn, isDateInRange, normalizeCategory } from './dataEngine';

// Strict column name mapping
const COLUMN_MAP = {
    empresa: ["EMPRESA VENDEDORA"],
    categoria: ["CATEGORIA"],
    subcategoria: ["SUBCATEGORIA"],
    modalidad: ["MODALIDAD"],
    unidadMedida: ["UNIDAD DE MEDIDA", "UNIDAD"],
    estadoTecnico: ["ESTADO TECNICO"],
    estadoPublicacion: ["ESTADO PUBLICACION", "ESTADO PUBLICACIÓN"],
    tipoSubasta: ["TIPO DE SUBASTA"],
    departamento: ["DEPARTAMENTO"]
};

// Helper: Normalize values (fix encoding, trimming)
const normalizeValue = (val) => {
    if (!val) return "";
    let str = String(val).trim();
    str = str.replace(/Veh\?culos/g, "Vehículos")
        .replace(/El\?ctricos/g, "Eléctricos")
        .replace(/Electr\?nicos/g, "Electrónicos");
    return str;
};

// Helper: Normalize String (strip accents, uppercase)
const normalizeHeader = (str) => {
    if (!str) return "";
    return str.toString().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
};

// Helper: Find Column Case-Insensitive and Accent-Insensitive
const findColumnStrict = (data, patterns) => {
    if (!data || !data[0]) return null;
    const headers = Object.keys(data[0]);
    // Normalize patterns once
    const normalizedPatterns = patterns.map(p => normalizeHeader(p));

    return headers.find(h => {
        const normH = normalizeHeader(h);
        return normalizedPatterns.includes(normH);
    });
};

// Apply all filters to dataset (supports multi-select arrays)
export const applyFilters = (data, filters) => {
    if (!data || data.length === 0) return [];

    let filtered = [...data];

    // Filter by date range (Envío de Valoración)
    if (filters.fechaInicio || filters.fechaFin) {
        // Use the standardized timestamp field if available (enriched data)
        // Checks 'fechaEnvioValoracionMs' which is created by enrichDataWithDates
        const useTimestamp = data[0] && data[0].hasOwnProperty('fechaEnvioValoracionMs');

        if (useTimestamp) {
            filtered = filtered.filter(r => isDateInRange(r.fechaEnvioValoracionMs, filters.fechaInicio, filters.fechaFin));
        } else {
            // Fallback to legacy column search if not enriched (should not happen in main flow)
            const envioCol = findColumn(filtered[0], ["FECHA DE ENVIO DE VALORACION", "ENVIO VALORACION", "FECHA"]);
            if (envioCol) {
                filtered = filtered.filter(r => isDateInRange(r[envioCol], filters.fechaInicio, filters.fechaFin));
            }
        }
    }

    // Helper for multi-select filtering
    const applyMultiFilter = (filterKey) => {
        const selectedValues = filters[filterKey];
        if (!selectedValues || !Array.isArray(selectedValues) || selectedValues.length === 0) return;

        const patterns = COLUMN_MAP[filterKey];
        const col = findColumnStrict(filtered, patterns);

        if (col) {
            filtered = filtered.filter(row => {
                const rawVal = row[col];
                let checkVal;

                // Use robust normalization for CATEGORIA
                if (filterKey === 'categoria') {
                    checkVal = normalizeCategory(rawVal);
                } else {
                    checkVal = normalizeValue(rawVal);
                }

                return selectedValues.some(sel => sel.toLowerCase() === checkVal.toLowerCase());
            });
        }
    };

    // Apply all multi-select filters
    applyMultiFilter('empresa');
    applyMultiFilter('categoria');
    applyMultiFilter('subcategoria');
    applyMultiFilter('modalidad');
    applyMultiFilter('unidadMedida');
    applyMultiFilter('estadoTecnico');
    applyMultiFilter('estadoPublicacion');
    applyMultiFilter('tipoSubasta');
    applyMultiFilter('departamento');

    // Filter cancelados if not included
    if (!filters.incluirCancelados) {
        filtered = filtered.filter(r => !isPotentiallyCancelled(r));
    }

    return filtered;
};

// Calculate ANS metrics correctly
export const calculateANSMetrics = (data) => {
    if (!data || data.length === 0) return null;

    const ansAprobCol = findColumn(data[0], ["ANS APROBACIONES"]);
    const ansPubCol = findColumn(data[0], ["ANS PUBLICACIONES"]);
    const ansPlanesCol = findColumn(data[0], ["ANS PLANES DE ACCION"]);

    // Calculate average for numeric ANS fields
    const calculateAvg = (columnName) => {
        if (!columnName) return 'NO DISPONIBLE';

        const values = data
            .map(r => {
                const val = r[columnName];
                if (!val || val.trim() === '') return null;
                const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
                return isNaN(num) ? null : num;
            })
            .filter(v => v !== null);

        if (values.length === 0) return 'NO DISPONIBLE';
        return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
    };

    return {
        avgANSAprobaciones: calculateAvg(ansAprobCol),
        avgANSPublicaciones: calculateAvg(ansPubCol),
        avgANSPlanesAccion: calculateAvg(ansPlanesCol)
    };
};

// Check if a record is potentially cancelled
export const isPotentiallyCancelled = (row) => {
    // Check main status columns
    const columnsToCheck = [
        "ESTADO TECNICO",
        "ESTADO PUBLICACION"
    ];

    return columnsToCheck.some(colName => {
        // Find exact column
        const headers = Object.keys(row);
        const col = headers.find(h => h.trim().toUpperCase() === colName);

        if (!col) return false;

        const val = (row[col] || "").toUpperCase();
        return val.includes("CANCEL");
    });
};

export default {
    applyFilters,
    calculateANSMetrics,
    isPotentiallyCancelled
};
