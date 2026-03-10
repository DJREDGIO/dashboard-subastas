import React, { useMemo, useState } from 'react';
import { COLORS } from '../constants/colors';
import { findColumn, parseMoney, parseDateDDMMYYYY, normalizeString, isDateInRange } from '../services/dataEngine';
import { Clock, CheckCircle, AlertCircle, FileText, TrendingUp, Calendar, ChevronDown, ChevronUp, Package, BarChart3, Filter, X, Check, Download, FileSpreadsheet, MapPin, Tag } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts';
import logoSubastas from '../assets/logo_subastas.png';

// Internal Multi-Select Component (matches FilterBar style)
function MultiSelectFilter({ label, selectedValues, onChange, options }) {
    const [isOpen, setIsOpen] = useState(false);
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
        <div style={{ position: 'relative', minWidth: '200px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: COLORS.text.secondary, display: 'block', marginBottom: '4px' }}>
                {label}:
            </label>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '6px 12px',
                    border: currentSelection.length > 0 ? `1px solid ${COLORS.primary}` : '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: COLORS.text.primary,
                    background: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textAlign: 'left',
                    height: '34px' // Match date input roughly
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
                    background: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    minWidth: '250px' // Wider dropdown
                }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid #eee', display: 'flex', gap: '8px' }}>
                        <button onClick={selectAll} style={{ flex: 1, padding: '4px', fontSize: '11px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                            Todas
                        </button>
                        <button onClick={clearAll} style={{ flex: 1, padding: '4px', fontSize: '11px', background: '#f0f0f0', color: COLORS.text.primary, border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                            Ninguna
                        </button>
                    </div>

                    <div style={{ maxHeight: '250px', overflowY: 'auto', padding: '4px 0' }}>
                        {options.map(option => {
                            const isChecked = currentSelection.includes(option);
                            return (
                                <label
                                    key={option}
                                    onClick={() => toggleValue(option)}
                                    style={{
                                        display: 'flex', alignItems: 'center', padding: '6px 12px', cursor: 'pointer', gap: '8px',
                                        background: isChecked ? `${COLORS.primary}10` : 'transparent',
                                        fontSize: '12px'
                                    }}
                                    onMouseEnter={(e) => !isChecked && (e.currentTarget.style.background = '#f5f5f5')}
                                    onMouseLeave={(e) => !isChecked && (e.currentTarget.style.background = 'transparent')}
                                >
                                    <div style={{
                                        width: '14px', height: '14px', border: isChecked ? 'none' : '1px solid #ccc', borderRadius: '3px',
                                        background: isChecked ? COLORS.primary : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                    }}>
                                        {isChecked && <Check size={10} color="white" />}
                                    </div>
                                    <span style={{ color: COLORS.text.primary, lineHeight: '1.2' }}>{option}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}
            {isOpen && <div onClick={() => setIsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />}
        </div>
    );
}

const ValuationTracking = ({ data }) => {
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [selectedCompanies, setSelectedCompanies] = useState([]);
    const [selectedEstadoTecnico, setSelectedEstadoTecnico] = useState([]);

    // Extract Unique Companies for Filter
    const companyOptions = useMemo(() => {
        if (!data || data.length === 0) return [];
        const col = findColumn(data[0], ["EMPRESA VENDEDORA", "EMPRESA"]);
        if (!col) return [];
        return [...new Set(data.map(row => row[col]).filter(Boolean))].sort();
    }, [data]);

    // Extract Unique Estado Técnico for Filter
    const estadoTecnicoOptions = useMemo(() => {
        if (!data || data.length === 0) return [];
        const col = findColumn(data[0], ["ESTADO TECNICO", "ESTADO_TECNICO"]);
        if (!col) return [];
        return [...new Set(data.map(row => row[col]).filter(Boolean).map(v => String(v).trim()))].sort();
    }, [data]);

    // 1. Filter and Process Data
    const trackedProcesses = useMemo(() => {
        if (!data || data.length === 0) return [];

        // Find relevant columns
        const publicacionCol = findColumn(data[0], ["ESTADO PUBLICACION", "PUBLICACION"]);
        const procesoCol = findColumn(data[0], ["N° PROCESO", "N PROCESO", "PROCESO", "ID PROCESO"]);
        const empresaCol = findColumn(data[0], ["EMPRESA VENDEDORA", "EMPRESA"]);
        const fechaCol = findColumn(data[0], ["FECHA DE ENVIO DE VALORACION", "ENVIO VALORACION"]);
        const valorCol = findColumn(data[0], ["VALOR SUGERIDO", "PRECIO SUGERIDO"]);
        const bienCol = findColumn(data[0], ["BIENES", "BIEN", "ACTIVO", "DESCRIPCION"]);
        const ubicacionCol = findColumn(data[0], ["UBICACION", "CIUDAD", "DEPARTAMENTO", "MUNICIPIO"]);
        const categoriaCol = findColumn(data[0], ["CATEGORIA", "LINEA", "FAMILIA"]);
        const estadoTecCol = findColumn(data[0], ["ESTADO TECNICO", "ESTADO_TECNICO"]);

        if (!publicacionCol || !procesoCol) return [];

        // Group by Process ID
        const groups = {};

        data.forEach(row => {
            const estadoPub = normalizeString(row[publicacionCol]);
            const empresaName = row[empresaCol];
            const estadoTec = estadoTecCol ? String(row[estadoTecCol] || '').trim() : '';

            // Filter: Company Selection
            if (selectedCompanies.length > 0 && !selectedCompanies.includes(empresaName)) return;

            // Filter: Estado Técnico Selection
            if (selectedEstadoTecnico.length > 0 && !selectedEstadoTecnico.includes(estadoTec)) return;

            // Filter: Exclude explicitly PUBLISHED items.
            if (estadoPub.includes("publicado") && !estadoPub.includes("no publicado")) return;
            if (estadoPub.includes("vendido") || estadoPub.includes("cerrado")) return;

            // Helper to normalize process ID (Trim to ensure grouping works)
            const rawId = row[procesoCol] || "SIN PROCESO";
            const procesoId = String(rawId).trim();
            const fechaEnvioStr = row[fechaCol];

            // Date Filter Check
            if (dateRange.start || dateRange.end) {
                if (!isDateInRange(fechaEnvioStr, dateRange.start, dateRange.end)) return;
            }

            if (!groups[procesoId]) {
                const dateObj = parseDateDDMMYYYY(fechaEnvioStr);
                const daysPending = dateObj ? differenceInDays(new Date(), dateObj) : 0;

                groups[procesoId] = {
                    id: procesoId,
                    empresa: empresaName || "Desconocida",
                    fechaEnvio: fechaEnvioStr,
                    fechaEnvioMs: row.fechaEnvioValoracionMs || (dateObj ? dateObj.getTime() : 0),
                    valorTotal: 0,
                    items: [], // Store full items
                    status: 'En Revisión',
                    daysPending: daysPending,
                    ubicacion: row[ubicacionCol] || "N/D",
                    categoria: row[categoriaCol] || "Varios",
                    estadoTecnico: estadoTec || "N/D"
                };
            }

            // Sum Value & Add Item
            const val = parseMoney(row[valorCol]);
            groups[procesoId].valorTotal += val;
            groups[procesoId].items.push({
                nombre: row[bienCol] || "Sin nombre",
                valor: val
            });
        });

        // Convert to array and sort by Days Pending (Desc) -> Most critical first
        return Object.values(groups).sort((a, b) => b.daysPending - a.daysPending);
    }, [data, dateRange, selectedCompanies, selectedEstadoTecnico]);

    // Metrics for Header
    const totalPendingValue = trackedProcesses.reduce((acc, curr) => acc + curr.valorTotal, 0);
    const totalProcesses = trackedProcesses.length;

    // Helper for Days Pending Color
    const getDaysColor = (days) => {
        if (days >= 15) return COLORS.warning; // Red/Orange-ish for critical
        if (days >= 5) return '#EAB308'; // Yellow
        return COLORS.success; // Green
    };

    // Helper: Export to CSV
    const exportToCSV = () => {
        if (!trackedProcesses.length) return;

        // Headers
        // Headers
        const headers = ["ID Proceso", "Empresa", "Bien / Activo", "Valor Sugerido", "Fecha Envío", "Días Pendiente", "Estado", "Ubicación", "Categoría"];

        // Rows
        const rows = [];
        trackedProcesses.forEach(proc => {
            proc.items.forEach(item => {
                rows.push([
                    `"${proc.id}"`, // Quote to prevent CSV issues
                    `"${proc.empresa}"`,
                    `"${item.nombre.replace(/"/g, '""')}"`, // Escape quotes
                    item.valor, // Raw number for excel
                    proc.fechaEnvio,
                    proc.daysPending,
                    proc.status,
                    `"${proc.ubicacion}"`,
                    `"${proc.categoria}"`
                ].join(','));
            });
        });

        const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n'); // BOM for Excel formatting
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Seguimiento_Valoraciones_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!data || data.length === 0) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: COLORS.text.secondary }}>
                <p>No hay datos cargados para analizar.</p>
            </div>
        );
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: COLORS.background.main }}>
            {/* PRINT HEADER (Hidden on Screen) */}
            <div className="print-only" style={{
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px',
                borderBottom: '2px solid #03AB90',
                marginBottom: '20px',
                display: 'none' // Controlled by CSS
            }}>
                <div>
                    <h1 style={{ marginBottom: '5px', color: '#1F2937', fontSize: '24px' }}>Tablero de Valoraciones</h1>
                    <p style={{ margin: 0, color: '#6B7280' }}>
                        Seguimiento de Tiempos de Valoración y Estados
                        {(dateRange.start || dateRange.end) && ` | Rango: ${dateRange.start || 'Inicio'} - ${dateRange.end || 'Fin'}`}
                    </p>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                        <span style={{ fontWeight: 'bold' }}>Total Pendiente: $ {new Intl.NumberFormat('es-CO', { notation: "compact", compactDisplay: "short" }).format(totalPendingValue)}</span>
                        <span style={{ fontWeight: 'bold' }}>Procesos en Gestión: {totalProcesses}</span>
                        <span style={{ fontWeight: 'bold' }}>Lotes o Bienes: {trackedProcesses.reduce((acc, p) => acc + p.items.length, 0)}</span>
                    </div>
                </div>
                <img src={logoSubastas} alt="Subastas y Comercio" style={{ height: '60px' }} />
            </div>

            {/* SCREEN Header (Hidden on Print) */}
            <div className="no-print" style={{
                padding: '16px 32px',
                background: COLORS.background.card,
                borderBottom: `1px solid #E5E5E5`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div>
                    <h1 style={{ margin: 0, color: COLORS.text.primary, fontSize: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <TrendingUp size={28} color={COLORS.primary} />
                        Tablero de Valoraciones
                    </h1>
                    <p style={{ margin: '4px 0 0 0', color: COLORS.text.secondary, fontSize: '14px' }}>
                        Seguimiento de Tiempos de Valoración y Estados
                    </p>
                </div>

                {/* Export Buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={exportToCSV}
                        style={{
                            padding: '8px 16px',
                            background: '#fff',
                            border: `1px solid ${COLORS.success}`,
                            color: COLORS.success,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: '600',
                            fontSize: '13px'
                        }}>
                        <FileSpreadsheet size={16} />
                        Exportar CSV
                    </button>
                    <button
                        onClick={() => window.print()}
                        style={{
                            padding: '8px 16px',
                            background: COLORS.primary,
                            color: COLORS.text.inverse,
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: '600',
                            fontSize: '13px'
                        }}>
                        <Download size={16} />
                        Exportar Reporte
                    </button>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#F8F9FA', padding: '8px 16px', borderRadius: '8px', border: '1px solid #eee' }}>

                    {/* MultiSelect Company Filter */}
                    <MultiSelectFilter
                        label="Filtrar Empresa"
                        options={companyOptions}
                        selectedValues={selectedCompanies}
                        onChange={setSelectedCompanies}
                    />

                    <div style={{ height: '30px', width: '1px', background: '#ddd' }}></div>

                    {/* MultiSelect Estado Técnico Filter */}
                    <MultiSelectFilter
                        label="Estado Técnico"
                        options={estadoTecnicoOptions}
                        selectedValues={selectedEstadoTecnico}
                        onChange={setSelectedEstadoTecnico}
                    />

                    <div style={{ height: '30px', width: '1px', background: '#ddd' }}></div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: COLORS.text.secondary, marginBottom: '4px' }}>Rango Fecha Envío:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="date"
                                style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', outline: 'none' }}
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            />
                            <span style={{ color: '#ccc' }}>—</span>
                            <input
                                type="date"
                                style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', outline: 'none' }}
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>

                {/* Summary Metrics */}
                <div style={{ display: 'flex', gap: '24px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: COLORS.text.secondary }}>Total Pendiente</p>
                        <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: COLORS.accent }}>
                            $ {new Intl.NumberFormat('es-CO', { notation: "compact", compactDisplay: "short" }).format(totalPendingValue)}
                        </p>
                    </div>
                    <div style={{ textAlign: 'right', borderLeft: '1px solid #eee', paddingLeft: '24px' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: COLORS.text.secondary }}>Procesos en Gestión</p>
                        <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: COLORS.primary }}>
                            {totalProcesses}
                        </p>
                    </div>
                    <div style={{ textAlign: 'right', borderLeft: '1px solid #eee', paddingLeft: '24px' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: COLORS.text.secondary }}>Lotes o Bienes</p>
                        <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: COLORS.success }}>
                            {trackedProcesses.reduce((acc, p) => acc + p.items.length, 0)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            {trackedProcesses.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                    <div style={{
                        background: COLORS.background.card,
                        borderRadius: '12px',
                        padding: '24px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        border: '1px solid #eee'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                            <BarChart3 size={20} color={COLORS.primary} />
                            <h3 style={{ margin: 0, fontSize: '16px', color: COLORS.text.primary }}>Top Empresas por Valor en Gestión</h3>
                        </div>
                        <div style={{ height: '350px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    data={Object.values(trackedProcesses.reduce((acc, curr) => {
                                        if (!acc[curr.empresa]) acc[curr.empresa] = { name: curr.empresa, value: 0, count: 0 };
                                        acc[curr.empresa].value += curr.valorTotal;
                                        acc[curr.empresa].count += 1;
                                        return acc;
                                    }, {})).sort((a, b) => b.value - a.value).slice(0, 10)}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" xAxisId="countAxis" orientation="top" stroke="#ff7300" hide />
                                    <XAxis type="number" xAxisId="moneyAxis" orientation="bottom" stroke={COLORS.primary} tickFormatter={(val) => `$${new Intl.NumberFormat('es-CO', { notation: "compact", compactDisplay: "short" }).format(val)}`} />
                                    <YAxis type="category" dataKey="name" width={180} style={{ fontSize: '10px', fontWeight: 'bold' }} interval={0} />
                                    <Tooltip
                                        formatter={(value, name) => {
                                            if (name === 'Valor Total') return [`$ ${new Intl.NumberFormat('es-CO').format(value)}`, name];
                                            return [value, name];
                                        }}
                                        labelStyle={{ color: COLORS.text.primary, fontWeight: 'bold' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                    <Bar dataKey="value" name="Valor Total" barSize={16} radius={[0, 4, 4, 0]} xAxisId="moneyAxis">
                                        {Object.values(trackedProcesses).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index < 3 ? COLORS.primary : '#94a3b8'} />
                                        ))}
                                        <LabelList
                                            dataKey="value"
                                            position="right"
                                            style={{ fontSize: '10px', fontWeight: 'bold', fill: COLORS.text.secondary }}
                                            formatter={(val) => `$${new Intl.NumberFormat('es-CO', { notation: "compact", compactDisplay: "short" }).format(val)}`}
                                        />
                                    </Bar>
                                    <Line type="monotone" dataKey="count" name="Cant. Procesos" stroke="#ff7300" strokeWidth={2} dot={{ r: 3 }} xAxisId="countAxis" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Chart 2: Top Pending Time */}
                    <div style={{
                        background: COLORS.background.card,
                        borderRadius: '12px',
                        padding: '24px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        border: '1px solid #eee'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                            <Clock size={20} color={COLORS.warning} />
                            <h3 style={{ margin: 0, fontSize: '16px', color: COLORS.text.primary }}>Top 10 Procesos Más Antiguos</h3>
                        </div>
                        <div style={{ height: '350px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={[...trackedProcesses].sort((a, b) => b.daysPending - a.daysPending).slice(0, 10)}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="id" width={100} style={{ fontSize: '11px', fontWeight: '500' }} />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '12px' }}>
                                                        <p style={{ fontWeight: 'bold', margin: '0 0 5px' }}>{label}</p>
                                                        <p style={{ margin: 0 }}>Empresa: {data.empresa}</p>
                                                        <p style={{ margin: 0, color: COLORS.warning, fontWeight: 'bold' }}>{data.daysPending} días pendiente</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="daysPending" name="Días Pendiente" barSize={16} radius={[0, 4, 4, 0]}>
                                        {trackedProcesses.slice(0, 10).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.daysPending > 30 ? '#EF4444' : entry.daysPending > 15 ? '#F97316' : '#EAB308'} />
                                        ))}
                                        <LabelList
                                            dataKey="daysPending"
                                            position="right"
                                            style={{ fontSize: '10px', fontWeight: 'bold', fill: COLORS.text.secondary }}
                                            formatter={(val) => `${val} d`}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div >
            ) : (
                <div style={{
                    background: COLORS.background.card,
                    borderRadius: '12px',
                    padding: '48px',
                    textAlign: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    marginBottom: '24px'
                }}>
                    <CheckCircle size={48} color={COLORS.success} style={{ marginBottom: '16px' }} />
                    <h3 style={{ margin: '0 0 8px 0', color: COLORS.text.primary }}>Todo al día</h3>
                    <p style={{ margin: 0, color: COLORS.text.secondary }}>
                        No se encontraron procesos pendientes con los filtros seleccionados.
                    </p>
                </div>
            )
            }


            {/* Content List */}
            <div style={{ padding: '0 32px 32px 32px', flex: 1, overflow: 'auto' }}>

                {trackedProcesses.length === 0 ? (
                    <div style={{
                        background: COLORS.background.card,
                        borderRadius: '12px',
                        padding: '48px',
                        textAlign: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                        <CheckCircle size={48} color={COLORS.success} style={{ marginBottom: '16px' }} />
                        <h3 style={{ margin: '0 0 8px 0', color: COLORS.text.primary }}>Todo al día</h3>
                        <p style={{ margin: 0, color: COLORS.text.secondary }}>
                            No se encontraron procesos pendientes en el rango seleccionado.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
                        {trackedProcesses.map((proc) => (
                            <div key={proc.id} style={{
                                background: COLORS.background.card,
                                borderRadius: '12px',
                                padding: '24px',
                                borderLeft: `5px solid ${getDaysColor(proc.daysPending)}`,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                {/* Card Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ padding: '10px', background: `${COLORS.primary}10`, borderRadius: '8px' }}>
                                            <FileText size={20} color={COLORS.primary} />
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: COLORS.text.secondary }}>Empresa</p>
                                            <p style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: COLORS.text.primary, lineHeight: '1.2' }}>
                                                {proc.empresa}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            background: `${getDaysColor(proc.daysPending)}20`,
                                            color: getDaysColor(proc.daysPending),
                                            fontSize: '12px',
                                            fontWeight: 'bold',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            <Clock size={12} />
                                            {proc.daysPending} días
                                        </span>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div style={{ height: '1px', background: '#f0f0f0', margin: '0 0 16px 0' }} />

                                {/* Details Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                            <Calendar size={14} color={COLORS.text.secondary} />
                                            <span style={{ fontSize: '12px', color: COLORS.text.secondary }}>Enviado el</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: COLORS.text.primary }}>
                                            {proc.fechaEnvio || "N/A"}
                                        </p>
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                            <TrendingUp size={14} color={COLORS.text.secondary} />
                                            <span style={{ fontSize: '12px', color: COLORS.text.secondary }}>Valor Sugerido</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: COLORS.primary }}>
                                            $ {new Intl.NumberFormat('es-CO', { notation: "compact", compactDisplay: "short" }).format(proc.valorTotal)}
                                        </p>
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                            <MapPin size={14} color={COLORS.text.secondary} />
                                            <span style={{ fontSize: '12px', color: COLORS.text.secondary }}>Ubicación</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '12px', fontWeight: '500', color: COLORS.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={proc.ubicacion}>
                                            {proc.ubicacion}
                                        </p>
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                            <Tag size={14} color={COLORS.text.secondary} />
                                            <span style={{ fontSize: '12px', color: COLORS.text.secondary }}>Categoría</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '12px', fontWeight: '500', color: COLORS.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={proc.categoria}>
                                            {proc.categoria}
                                        </p>
                                    </div>
                                </div>

                                {/* Items List (Always visible, scrollable) */}
                                <div style={{
                                    marginTop: 'auto',
                                    pt: '8px',
                                    borderTop: '1px solid #f0f0f0'
                                }}>
                                    <div style={{
                                        marginTop: '8px',
                                        maxHeight: '150px',
                                        overflowY: 'auto',
                                        background: '#F8F9FA',
                                        borderRadius: '6px',
                                        padding: '4px'
                                    }}>
                                        {proc.items.map((item, idx) => (
                                            <div key={idx} style={{
                                                padding: '6px 8px',
                                                borderBottom: idx === proc.items.length - 1 ? 'none' : '1px solid #eee',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '11px',
                                                alignItems: 'flex-start'
                                            }}>
                                                <span style={{
                                                    color: COLORS.text.primary,
                                                    fontWeight: '500',
                                                    width: '65%',
                                                    whiteSpace: 'normal', // Allow wrapping
                                                    wordBreak: 'break-word',
                                                    lineHeight: '1.3'
                                                }}>
                                                    {item.nombre}
                                                </span>
                                                <span style={{
                                                    color: COLORS.text.secondary,
                                                    whiteSpace: 'nowrap',
                                                    marginLeft: '8px'
                                                }}>
                                                    $ {new Intl.NumberFormat('es-CO', { notation: "compact", compactDisplay: "short" }).format(item.valor)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ padding: '6px 0 0 0', fontSize: '10px', textAlign: 'center', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Proceso: {proc.id}</span>
                                        <span>{proc.items.length} ítems</span>
                                    </div>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Print Footer / Signature (Hidden on Screen) */}
            <div className="print-only" style={{
                marginTop: '50px',
                padding: '20px',
                display: 'none', // Controlled by CSS
                pageBreakInside: 'avoid'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '80px', marginTop: '40px' }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ borderTop: '1px solid #000', marginBottom: '8px', width: '80%', margin: '0 auto 8px auto' }}></div>
                        <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12px', color: '#1F2937' }}>ELABORADO POR</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#1F2937' }}>Sergio Yate González</p>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ borderTop: '1px solid #000', marginBottom: '8px', width: '80%', margin: '0 auto 8px auto' }}></div>
                        <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12px', color: '#1F2937' }}>REVISADO POR</p>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ borderTop: '1px solid #000', marginBottom: '8px', width: '80%', margin: '0 auto 8px auto' }}></div>
                        <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12px', color: '#1F2937' }}>APROBADO POR</p>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default ValuationTracking;
