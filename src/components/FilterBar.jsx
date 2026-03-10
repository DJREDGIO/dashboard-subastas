import React, { useState, useMemo } from 'react';
import { Filter, X, ChevronDown, Check } from 'lucide-react';
import { COLORS } from '../constants/colors';
import { normalizeCategory } from '../services/dataEngine';
// Strict Value Whitelists provided by User
const VALID_VALUES = {
    // categoria: REMOVED to allow dynamic generation from data
    subcategoria: [
        "Amarilla", "Blindado", "Blindados", "Cancelado", "Edificaciones",
        "Eléctricos y Electrónicos", "Equipos", "Ferrosa", "Industrial", "Mixtos",
        "Mobiliario", "Motores", "n/a", "n/d", "No Ferrosa", "Otros Materiales",
        "Pendiente", "Promocional", "Puesta en pie", "Salvamentos",
        "Unidad de suelo", "Usados", "Vehículos"
    ],
    tipoSubasta: [
        "Cancelado", "Cuerpo Cierto", "Medida resultante", "n/d", "Pendiente"
    ],
    modalidad: [
        "Al alza", "Cancelado", "n/d", "Pendiente", "Urna Virtual"
    ],
    unidadMedida: [
        "(Ft)Pies", "Cancelado", "Ft(Pies)", "Items", "Juntas (JT)",
        "Kilogramos", "Litros", "Metros", "n/d", "Pendiente", "Unidad"
    ],
    estadoTecnico: [
        "Aprobado", "Cancelado", "En valoración", "No aprobado", "No viable",
        "Por aprobar", "Re Publicado"
    ]
};

// Column Mapping
const COLUMN_MAP = {
    empresa: ["EMPRESA VENDEDORA"],
    categoria: ["CATEGORIA"],
    subcategoria: ["SUBCATEGORIA"],
    modalidad: ["MODALIDAD"],
    unidadMedida: ["UNIDAD DE MEDIDA", "UNIDAD"],
    estadoTecnico: ["ESTADO TECNICO"],
    estadoPublicacion: ["ESTADO PUBLICACION"],
    tipoSubasta: ["TIPO DE SUBASTA"],
    departamento: ["DEPARTAMENTO"]
};

// Helper: Normalize values (fix encoding, trimming)
const normalizeValue = (val) => {
    if (!val) return "";
    let str = String(val).trim();
    // Fix known encoding issues
    str = str.replace(/Veh\?culos/g, "Vehículos")
        .replace(/El\?ctricos/g, "Eléctricos")
        .replace(/Electr\?nicos/g, "Electrónicos");
    return str;
};

// Multi-Select Filter Component
function MultiSelectFilter({ label, filterKey, selectedValues, onChange, options }) {
    const [isOpen, setIsOpen] = useState(false);

    // Ensure selectedValues is always an array
    const currentSelection = Array.isArray(selectedValues) ? selectedValues : [];

    const toggleValue = (value) => {
        if (currentSelection.includes(value)) {
            onChange(currentSelection.filter(v => v !== value));
        } else {
            onChange([...currentSelection, value]);
        }
    };

    const selectAll = () => onChange([...options]);
    const clearAll = () => onChange([]);

    return (
        <div style={{ position: 'relative' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '4px' }}>
                {label}
            </label>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: currentSelection.length > 0 ? `2px solid ${COLORS.accent}` : '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: COLORS.text.primary,
                    background: COLORS.background.card,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textAlign: 'left',
                    minHeight: '38px'
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
                    {currentSelection.length === 0 ? 'Todos' :
                        currentSelection.length === options.length ? 'Todos seleccionados' :
                            `${currentSelection.length} seleccionado(s)`}
                </span>
                <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: COLORS.text.secondary }} />
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: COLORS.background.card,
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    minWidth: '200px'
                }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid #eee', display: 'flex', gap: '8px' }}>
                        <button onClick={selectAll} style={{ flex: 1, padding: '4px', fontSize: '11px', background: COLORS.accent, color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                            Todos
                        </button>
                        <button onClick={clearAll} style={{ flex: 1, padding: '4px', fontSize: '11px', background: '#f0f0f0', color: COLORS.text.primary, border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                            Ninguno
                        </button>
                    </div>

                    <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '4px 0' }}>
                        {options.length === 0 ? (
                            <div style={{ padding: '8px', textAlign: 'center', color: COLORS.text.secondary, fontSize: '12px' }}>
                                No hay opciones
                            </div>
                        ) : (
                            options.map(option => {
                                const isChecked = currentSelection.includes(option);
                                return (
                                    <label
                                        key={option}
                                        onClick={() => toggleValue(option)}
                                        style={{
                                            display: 'flex', alignItems: 'center', padding: '6px 12px', cursor: 'pointer', gap: '8px',
                                            background: isChecked ? `${COLORS.accent}10` : 'transparent'
                                        }}
                                        onMouseEnter={(e) => !isChecked && (e.currentTarget.style.background = '#f5f5f5')}
                                        onMouseLeave={(e) => !isChecked && (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <div style={{
                                            width: '16px', height: '16px', border: isChecked ? 'none' : '1px solid #ccc', borderRadius: '3px',
                                            background: isChecked ? COLORS.accent : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {isChecked && <Check size={12} color="white" />}
                                        </div>
                                        <span style={{ fontSize: '13px', color: COLORS.text.primary }}>{option}</span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {isOpen && <div onClick={() => setIsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />}
        </div>
    );
}

const FilterBar = ({ filters, onFilterChange, onClearFilters, data }) => {
    if (!data || data.length === 0) return null;

    // Helper: Normalize String (strip accents, uppercase)
    const normalizeHeader = (str) => {
        if (!str) return "";
        return str.toString().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    };

    // Get column values logic
    const getColumnValues = (filterKey) => {
        const patterns = COLUMN_MAP[filterKey];
        if (!patterns) return [];

        // Find exact column match (Accent Insensitive)
        const headers = Object.keys(data[0]);
        const normalizedPatterns = patterns.map(p => normalizeHeader(p));

        const col = headers.find(h => {
            const normH = normalizeHeader(h);
            return normalizedPatterns.includes(normH);
        });

        if (!col) return [];

        // Extract, Normalize, Unique
        let values = [...new Set(
            data.map(r => {
                const val = r[col];
                // Apply robust normalization for CATEGORIA
                if (filterKey === 'categoria') {
                    return normalizeCategory(val);
                }
                return normalizeValue(val);
            })
                .filter(v => v !== "")
        )];

        // STRICT WHITELIST FILTERING
        const whitelist = VALID_VALUES[filterKey];
        if (whitelist) {
            // Only keep values that exactly match the whitelist (case-insensitive for safety, then map to canonical)
            values = values.filter(v =>
                whitelist.some(w => w.toLowerCase() === v.toLowerCase())
            ).map(v => {
                // Return the canonical casing from the whitelist
                return whitelist.find(w => w.toLowerCase() === v.toLowerCase());
            });
        }

        return values.sort();
    };

    // Memoize options
    const options = useMemo(() => ({
        empresa: getColumnValues('empresa'),
        categoria: getColumnValues('categoria'),
        subcategoria: getColumnValues('subcategoria'),
        modalidad: getColumnValues('modalidad'),
        unidadMedida: getColumnValues('unidadMedida'),
        estadoTecnico: getColumnValues('estadoTecnico'),
        estadoPublicacion: getColumnValues('estadoPublicacion'),
        tipoSubasta: getColumnValues('tipoSubasta'),
        departamento: getColumnValues('departamento')
    }), [data]);

    return (
        <div style={{
            background: COLORS.background.card,
            padding: '20px 24px',
            borderRadius: '8px',
            marginBottom: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Filter size={18} color={COLORS.accent} />
                    <h3 style={{ margin: 0, color: COLORS.text.primary, fontSize: '16px', fontWeight: '600' }}>
                        Filtros Globales (Controlado)
                    </h3>
                </div>
                <button
                    onClick={onClearFilters}
                    style={{
                        padding: '6px 12px',
                        background: 'transparent',
                        border: `1px solid ${COLORS.gray}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: COLORS.text.secondary
                    }}
                >
                    <X size={14} />
                    Reiniciar
                </button>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: '16px 16px',
                alignItems: 'end'
            }}>
                {/* Date Ranges - Split for better grid behavior */}
                <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '4px' }}>
                        Desde
                    </label>
                    <input type="date" value={filters.fechaInicio || ''} onChange={(e) => onFilterChange('fechaInicio', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }} />
                </div>
                <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '4px' }}>
                        Hasta
                    </label>
                    <input type="date" value={filters.fechaFin || ''} onChange={(e) => onFilterChange('fechaFin', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }} />
                </div>

                {/* Multi-Select Filters */}
                <MultiSelectFilter label="Empresa" filterKey="empresa" selectedValues={filters.empresa} onChange={(v) => onFilterChange('empresa', v)} options={options.empresa} />
                <MultiSelectFilter label="Categoría" filterKey="categoria" selectedValues={filters.categoria} onChange={(v) => onFilterChange('categoria', v)} options={options.categoria} />
                <MultiSelectFilter label="Subcategoría" filterKey="subcategoria" selectedValues={filters.subcategoria} onChange={(v) => onFilterChange('subcategoria', v)} options={options.subcategoria} />
                <MultiSelectFilter label="Modalidad" filterKey="modalidad" selectedValues={filters.modalidad} onChange={(v) => onFilterChange('modalidad', v)} options={options.modalidad} />
                <MultiSelectFilter label="Unidad de Medida" filterKey="unidadMedida" selectedValues={filters.unidadMedida} onChange={(v) => onFilterChange('unidadMedida', v)} options={options.unidadMedida} />
                <MultiSelectFilter label="Estado Técnico" filterKey="estadoTecnico" selectedValues={filters.estadoTecnico} onChange={(v) => onFilterChange('estadoTecnico', v)} options={options.estadoTecnico} />
                <MultiSelectFilter label="Tipo de Subasta" filterKey="tipoSubasta" selectedValues={filters.tipoSubasta} onChange={(v) => onFilterChange('tipoSubasta', v)} options={options.tipoSubasta} />
                <MultiSelectFilter label="Departamento" filterKey="departamento" selectedValues={filters.departamento} onChange={(v) => onFilterChange('departamento', v)} options={options.departamento} />

                {/* Cancelled Checkbox */}
                <div style={{ display: 'flex', alignItems: 'end', paddingBottom: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: COLORS.text.primary }}>
                        <input type="checkbox" checked={filters.incluirCancelados} onChange={(e) => onFilterChange('incluirCancelados', e.target.checked)} style={{ width: '16px', height: '16px' }} />
                        <span>Ver Cancelados</span>
                    </label>
                </div>
            </div>
        </div>
    );
};

export default FilterBar;
