import React, { useState, useMemo } from 'react';
import { Share2, Clock, CheckCircle, Calendar, DollarSign, BarChart2, Filter, Download, AlertCircle } from 'lucide-react';
import logoSubastas from '../assets/logo_subastas.png';
import { COLORS } from '../constants/colors';
import { findColumn, parseMoney } from '../services/dataEngine';
import { format, parseISO, isValid, differenceInDays, isWithinInterval, parse } from 'date-fns';
import {
    ComposedChart,
    BarChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import PublicacionesAnalyst from './PublicacionesAnalyst';

// --- HELPERS ---

const parseDateSafe = (dateVal) => {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return dateVal;

    // Check for Excel serial number (numeric value)
    if (typeof dateVal === 'number') {
        // Excel base date is Dec 30, 1899
        return new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    }

    if (typeof dateVal === 'string') {
        const trimmed = dateVal.trim();

        // Try ISO-like YYYY-MM-DD
        if (trimmed.match(/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/)) {
            const d = parseISO(trimmed);
            if (isValid(d)) return d;
        }

        // Try DD/MM/YYYY or DD-MM-YYYY (Common in Spanish headers)
        // Matches D/M/YYYY, DD/MM/YYYY, D-M-YYYY etc.
        const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (dmyMatch) {
            const day = parseInt(dmyMatch[1], 10);
            const month = parseInt(dmyMatch[2], 10) - 1; // Months are 0-indexed
            const year = parseInt(dmyMatch[3], 10);
            const d = new Date(year, month, day);
            if (isValid(d)) return d;
        }

        // Fallback to standard parser
        const d = new Date(trimmed);
        if (isValid(d)) return d;
    }
    return null;
};

const formatCurrency = (value) => {
    if (!value) return '$ 0';
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(value);
};

const formatCompactCurrency = (value) => {
    if (!value) return '$0';
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value}`;
};

// --- COMPONENTS ---

const MetricCard = ({ title, value, unit, icon: Icon, color, subValue }) => (
    <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        borderTop: `4px solid ${color}`,
        flex: 1
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
                <p style={{ margin: 0, fontSize: '12px', color: COLORS.text.secondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px' }}>
                    <span style={{ fontSize: '28px', fontWeight: 'bold', color: COLORS.text.primary, fontFamily: 'Inter, sans-serif' }}>
                        {value}
                    </span>
                    <span style={{ fontSize: '12px', color: COLORS.text.secondary }}>{unit}</span>
                </div>
                {subValue && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: COLORS.accent, fontWeight: '500' }}>
                        {subValue}
                    </p>
                )}
            </div>
            <div style={{
                background: `${color}10`,
                padding: '10px',
                borderRadius: '8px'
            }}>
                <Icon size={20} color={color} />
            </div>
        </div>
    </div>
);

const DateFilter = ({ startDate, endDate, onChange }) => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'white',
        padding: '8px 16px',
        borderRadius: '6px',
        border: '1px solid #E5E5E5',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    }}>
        <Filter size={16} color={COLORS.text.secondary} />
        <span style={{ fontSize: '13px', fontWeight: '600', color: COLORS.text.primary }}>Filtro Envío Valoración:</span>
        <input
            type="date"
            value={startDate}
            onChange={(e) => onChange('start', e.target.value)}
            style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '4px 8px', fontSize: '13px' }}
        />
        <span style={{ color: '#999' }}>—</span>
        <input
            type="date"
            value={endDate}
            onChange={(e) => onChange('end', e.target.value)}
            style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '4px 8px', fontSize: '13px' }}
        />
    </div>
);

const PlanesAccion = ({ data }) => {
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    // 1. BASE FILTER: Estado Tecnico IN List
    const baseData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const statusCol = findColumn(data[0], ["ESTADO TECNICO", "ESTADO"]);
        if (!statusCol) return [];

        const allowed = ['re publicado', 'republicado', 'aprobado', 'en valoraciÃ³n', 'en valoracion', 'por aprobar', 'no viable', 'no aprobado'];

        return data.filter(row => {
            const status = String(row[statusCol] || '').trim().toLowerCase();
            return allowed.some(s => status.includes(s));
        });
    }, [data]);

    // 2. DATE FILTER & AGGREGATION
    // Apply Independent Date Filter on "FECHA DE ENVIO DE VALORACION"
    const { filteredData, aggregation, processList, processesOverANS, itemList, pieData } = useMemo(() => {
        if (!baseData.length) return { filteredData: [], aggregation: [], processList: [], itemList: [] };

        const envioDateCol = findColumn(baseData[0], ["FECHA DE ENVIO DE VALORACION", "ENVIO VALORACION", "FECHA ENVIO"]);
        const solicitudDateCol = findColumn(baseData[0], ["FECHA DE SOLICITUD DEL PROCESO", "FECHA SOLICITUD", "SOLICITUD"]);

        const processCol = findColumn(baseData[0], ["NÂ° PROCESO", "N PROCESO", "PROCESO", "ID PROCESO"]);
        const companyCol = findColumn(baseData[0], ["EMPRESA", "CLIENTE"]);
        const valueCol = findColumn(baseData[0], ["VALOR SUGERIDO", "PRECIO SUGERIDO", "BASE"]);
        const catCol = findColumn(baseData[0], ["CATEGORIA"]);
        const subcatCol = findColumn(baseData[0], ["SUBCATEGORIA", "SUB CATEGORIA", "CLASE"]);
        const typeCol = findColumn(baseData[0], ["TIPO DE SUBASTA", "TIPO SUBASTA", "TIPO"]);
        const modCol = findColumn(baseData[0], ["MODALIDAD", "MODO"]);

        // Granular Columns
        const goodsCol = findColumn(baseData[0], ["BIENES", "DESCRIPCION", "OBJETO"]);
        const validationCol = findColumn(baseData[0], ["VALIDACION DE PROCESO", "VALIDACION", "CODIGO VALIDACION"]);
        const unitCol = findColumn(baseData[0], ["UNIDAD DE MEDIDA", "UNIDAD", "UM", "MEDIDA"]);

        let filtered = baseData;

        // Apply Date Filter
        if (dateRange.start || dateRange.end) {
            filtered = baseData.filter(row => {
                if (!envioDateCol) return true;
                const d = parseDateSafe(row[envioDateCol]);
                if (!isValid(d)) return false;

                const start = dateRange.start ? parseISO(dateRange.start) : new Date(2000, 0, 1);
                const end = dateRange.end ? parseISO(dateRange.end) : new Date(2100, 0, 1);

                // Set End Date to end of day to include selected day
                end.setHours(23, 59, 59, 999);

                return d >= start && d <= end;
            });
        }

        // Aggregate by Company
        const aggMap = new Map();

        // Global Aggregators for Charts
        const globalCats = {};
        const globalSubcats = {};

        let totalAns = 0;
        let ansCount = 0;

        // For Granular Analysis
        const items = [];
        const procMap = new Map();

        filtered.forEach(row => {
            const company = row[companyCol] || "SIN EMPRESA";
            const val = parseMoney(row[valueCol]);

            // Valid Whitelists
            const VALID_CATEGORIES = [
                "Chatarra y Materiales", "Equipos", "Inmuebles", "Maquinaria",
                "Otros", "Vehículos", "n/d", "Pendiente"
            ];
            const VALID_SUBCATEGORIES = [
                "Eléctricos y Electrónicos", "Equipos", "Ferrosa", "Industrial", "Mixtos",
                "Mobiliario", "Motores", "n/a", "n/d", "No Ferrosa", "Otros Materiales",
                "Pendiente", "Promocional", "Puesta en pie", "Salvamentos",
                "Unidad de suelo", "Usados", "Vehículos"
            ];

            let cat = row[catCol] || "OTROS";
            let subcat = row[subcatCol] || "OTROS";

            // Normalize and Validate Category
            const catMatch = VALID_CATEGORIES.find(c => c.toLowerCase() === String(cat).trim().toLowerCase());
            cat = catMatch ? catMatch : "Otros";

            // Normalize and Validate Subcategory
            const subcatMatch = VALID_SUBCATEGORIES.find(s => s.toLowerCase() === String(subcat).trim().toLowerCase());
            subcat = subcatMatch ? subcatMatch : "Otros";

            const tipo = row[typeCol] || "N/D";
            const mod = row[modCol] || "N/D";
            const procId = row[processCol];
            const dEnvio = parseDateSafe(row[envioDateCol]);
            const dSolicitud = parseDateSafe(row[solicitudDateCol]);

            // Global Distributions
            globalCats[cat] = (globalCats[cat] || 0) + 1;
            globalSubcats[subcat] = (globalSubcats[subcat] || 0) + 1;

            // --- 1. Company Aggregation ---
            if (!aggMap.has(company)) {
                aggMap.set(company, {
                    name: company,
                    processes: new Set(),
                    rows: 0,
                    totalValue: 0,
                    categories: {},
                    types: {}, // Count auction types
                    modalities: {}, // Count modalities
                    repubCount: 0,
                    ansSum: 0,
                    ansCount: 0
                });
            }

            const entry = aggMap.get(company);
            entry.rows += 1;
            if (procId) entry.processes.add(procId);
            entry.totalValue += val;
            entry.categories[cat] = (entry.categories[cat] || 0) + 1;
            entry.types[tipo] = (entry.types[tipo] || 0) + 1;
            entry.modalities[mod] = (entry.modalities[mod] || 0) + 1;

            // REPUBLICATIONS (Keeping logic, though mainly for Publicaciones)
            if (procId && /[- ]R\d+/i.test(procId)) {
                entry.repubCount++;
            }

            // ANS Calculation (Envio - Solicitud)
            let rowAns = null;
            if (isValid(dEnvio) && isValid(dSolicitud)) {
                rowAns = Math.abs(differenceInDays(dEnvio, dSolicitud));
                entry.ansSum += rowAns;
                entry.ansCount++;
                totalAns += rowAns;
                ansCount++;
            }

            // --- 2. Granular Item Extraction ---
            const goodsName = row[goodsCol] || "Sin DescripciÃ³n";
            const validationCode = row[validationCol] || "N/A";
            const unitsCol = findColumn(row, ["UNIDADES", "CANTIDAD", "CANT"]);
            const units = unitsCol ? (parseFloat(row[unitsCol]) || 1) : 1;
            const unitMeasure = row[unitCol] || "Unidades";

            const itemObj = {
                processId: procId || "SIN PROCESO",
                company,
                goods: goodsName,
                validationCode,
                value: val,
                units: units,
                unitMeasure: unitMeasure
            };
            items.push(itemObj);

            // --- 3. Process Aggregation (for top Process logic) ---
            const pIdKey = procId || "SIN PROCESO";
            if (!procMap.has(pIdKey)) {
                procMap.set(pIdKey, {
                    id: pIdKey,
                    company: company,
                    category: cat,
                    lotes: 0,
                    value: 0,
                    date: dEnvio,
                    items: [],
                    ansDays: rowAns, // Natively bind ANS calculated
                    solDate: dSolicitud,
                    envDate: dEnvio
                });
            }
            const p = procMap.get(pIdKey);
            p.lotes += units;
            p.value += val;
            p.items.push(itemObj);
            if (!p.date && dEnvio) p.date = dEnvio;
            // Update ANS if multiple rows had different validity
            if (p.ansDays === null && rowAns !== null) {
                p.ansDays = rowAns;
                p.solDate = dSolicitud;
                p.envDate = dEnvio;
            }
        });

        // Convert Map to Array
        const aggArray = Array.from(aggMap.values()).map(e => {
            // Find Top Category
            let topCat = "N/A", maxCat = 0;
            Object.entries(e.categories).forEach(([c, count]) => {
                if (count > maxCat) {
                    maxCat = count;
                    topCat = c;
                }
            });

            // Find Top Type
            let topType = "N/A", maxType = 0;
            Object.entries(e.types).forEach(([c, count]) => {
                if (count > maxType) {
                    maxType = count;
                    topType = c;
                }
            });

            // Find Top Modality
            let topModalidad = "N/A", maxMod = 0;
            Object.entries(e.modalities).forEach(([c, count]) => {
                if (count > maxMod) {
                    maxMod = count;
                    topModalidad = c;
                }
            });

            const totalProcs = e.processes.size || 1;
            let repubProcs = 0;
            e.processes.forEach(p => {
                if (/[- ]R\d+/i.test(p)) repubProcs++;
            });

            return {
                name: e.name,
                processCount: e.processes.size,
                unitCount: e.rows,
                value: e.totalValue,
                topCategory: topCat,
                topType,
                topModalidad,
                repubRate: (repubProcs / e.processes.size) * 100,
                avgAns: e.ansCount > 0 ? (e.ansSum / e.ansCount) : 0
            };
        }).sort((a, b) => b.value - a.value);

        const procArray = Array.from(procMap.values()).sort((a, b) => a.id.localeCompare(b.id));

        // Format Pie Data Helpers
        const toPie = (obj, limit = 5) => {
            const sorted = Object.entries(obj)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

            if (sorted.length <= limit) return sorted;

            const top = sorted.slice(0, limit);
            const others = sorted.slice(limit).reduce((sum, item) => sum + item.value, 0);
            if (others > 0) top.push({ name: "Otros", value: others });

            return top;
        };

        // Top 10 Companies for Bar Chart
        let compVals = aggArray.map(a => ({ name: a.name, value: a.value })).sort((a, b) => b.value - a.value);
        if (compVals.length > 10) {
            const top = compVals.slice(0, 10);
            // Optional: Add "Others" if we want total context, but for "Top 10" strict ranking, we might just show top 10.
            // User asked for "Top 10", often implies a ranking list. Let's keep it clean with just Top 10 for the bar chart 
            // to avoid skewing the scale if "Others" is huge.
            compVals = top;
        }

        // Processes Over ANS limits (> 5 Days)
        const procsOverANS = procArray.filter(p => p.ansDays !== null && p.ansDays > 5)
            .sort((a, b) => b.ansDays - a.ansDays);

        return {
            filteredData: filtered,
            aggregation: aggArray,
            processList: procArray,
            processesOverANS: procsOverANS,
            itemList: items,
            pieData: {
                categories: toPie(globalCats, 5),
                subcategories: toPie(globalSubcats, 5),
                companiesValue: compVals
            }
        };

    }, [baseData, dateRange]);

    // 3. FINAL METRICS
    const metrics = useMemo(() => {
        const totalProcesses = aggregation.reduce((acc, curr) => acc + curr.processCount, 0);
        const totalUnits = aggregation.reduce((acc, curr) => acc + curr.unitCount, 0);
        const totalValue = aggregation.reduce((acc, curr) => acc + curr.value, 0);

        // Republication % Global
        const uniqueProcs = new Set();
        filteredData.forEach(r => {
            const pid = r[findColumn(baseData[0] || {}, ["N° PROCESO", "Nº PROCESO", "N PROCESO", "PROCESO", "ID PROCESO"])];
            if (pid) uniqueProcs.add(pid);
        });

        let globalRepubCount = 0;
        uniqueProcs.forEach(p => {
            if (/[- ]R\d+/i.test(p)) globalRepubCount++;
        });

        const globalRepubRate = uniqueProcs.size > 0 ? (globalRepubCount / uniqueProcs.size) * 100 : 0;

        // ANS Weighted Average
        let totalAnsDays = 0;
        let ansN = 0;

        // Re-calculate global ANS mean to be exact across all valid rows
        const envioDateCol = findColumn(baseData[0] || {}, ["FECHA DE ENVIO DE VALORACION", "ENVIO VALORACION", "FECHA ENVIO"]);
        const solicitudDateCol = findColumn(baseData[0] || {}, ["FECHA DE SOLICITUD DEL PROCESO", "FECHA SOLICITUD", "SOLICITUD"]);

        filteredData.forEach(row => {
            const dEnvio = parseDateSafe(row[envioDateCol]);
            const dSolicitud = parseDateSafe(row[solicitudDateCol]);
            if (isValid(dEnvio) && isValid(dSolicitud)) {
                totalAnsDays += Math.abs(differenceInDays(dEnvio, dSolicitud));
                ansN++;
            }
        });
        const globalAvgAns = ansN > 0 ? (totalAnsDays / ansN) : 0;

        return {
            uniqueProcesses: uniqueProcs.size,
            totalUnits: totalUnits,
            totalValue: totalValue,
            avgAns: globalAvgAns,
            repubRate: globalRepubRate
        };
    }, [filteredData, aggregation, baseData]);

    if (!data || data.length === 0) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Cargando datos del módulo de Valoraciones...</div>;
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: COLORS.background.main }}>

            {/* PRINT HEADER (Hidden on Screen) */}
            <div className="print-only" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px',
                borderBottom: '2px solid #03AB90',
                marginBottom: '20px'
            }}>
                <div>
                    <h1 style={{ marginBottom: '5px', color: '#1F2937' }}>Tablero de Valoraciones</h1>
                    <p style={{ margin: 0, color: '#6B7280' }}>Seguimiento de Tiempos de Valoración y Estados</p>
                    <p style={{ margin: '4px 0 0 0', color: '#03AB90', fontWeight: 'bold', fontSize: '14px' }}>
                        Periodo: {dateRange.start && dateRange.end ? `${dateRange.start} al ${dateRange.end}` : "Histórico Completo"}
                    </p>
                </div>
                <img src={logoSubastas} alt="Subastas y Comercio" style={{ height: '60px' }} />
            </div>

            {/* SCREEN Header + Actions (Hidden on Print) */}
            <div className="no-print" style={{
                padding: '20px 32px',
                background: 'white',
                borderBottom: '1px solid #E5E5E5',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px', color: COLORS.text.primary }}>Tablero de Valoraciones</h1>
                    <p style={{ margin: '4px 0 0 0', color: COLORS.text.secondary }}>Seguimiento de Tiempos de Valoración y Estados</p>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <DateFilter
                        startDate={dateRange.start}
                        endDate={dateRange.end}
                        onChange={(type, val) => setDateRange(prev => ({ ...prev, [type]: val }))}
                    />
                    <button
                        onClick={() => window.print()}
                        style={{
                            padding: '10px 20px',
                            background: COLORS.primary,
                            color: COLORS.text.inverse,
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: '600'
                        }}>
                        <Download size={18} />
                        Exportar Reporte
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>

                {/* 0. INTELLIGENCE PANEL (AI ANALYST) */}
                <PublicacionesAnalyst aggregation={aggregation} globalMetrics={metrics} processList={processList} itemList={itemList} />

                {/* 1. KPI CARDS */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '20px',
                    marginBottom: '20px'
                }}>
                    <MetricCard
                        title="Procesos en Gestión"
                        value={metrics.uniqueProcesses}
                        unit=""
                        icon={Share2}
                        color={COLORS.primary}
                        subValue="Expedientes Únicos"
                    />
                    <MetricCard
                        title="Lotes o Bienes"
                        value={metrics.totalUnits}
                        unit=""
                        icon={CheckCircle}
                        color={COLORS.accent}
                        subValue="Total Activos"
                    />
                    <MetricCard
                        title="Valor Sugerido Total"
                        value={formatCurrency(metrics.totalValue)}
                        unit=""
                        icon={DollarSign}
                        color={COLORS.accent}
                        subValue="Monto Base Estimado"
                    />
                    <MetricCard
                        title="ANS Promedio"
                        value={metrics.avgAns.toFixed(1)}
                        unit="Días"
                        icon={Clock}
                        color={COLORS.warning}
                        subValue="Solicitud → Envío Valoración"
                    />
                </div>

                {/* 1.2 ANS ALERTS SECTION */}
                {processesOverANS && processesOverANS.length > 0 && (
                    <div style={{
                        background: 'white',
                        borderRadius: '8px',
                        padding: '16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        marginBottom: '20px',
                        borderLeft: `4px solid ${COLORS.warning}`
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <AlertCircle size={20} color={COLORS.warning} />
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: COLORS.dark }}>
                                Alertas de ANS: Procesos que exceden 5 días ({processesOverANS.length})
                            </h3>
                        </div>
                        <div style={{ overflowX: 'auto', maxHeight: '250px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead style={{ position: 'sticky', top: 0, background: '#F8F9FA' }}>
                                    <tr style={{ background: '#F8F9FA', color: COLORS.text.secondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #eee' }}>N° Proceso</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #eee' }}>Empresa Cliente</th>
                                        <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #eee' }}>Fecha Solicitud</th>
                                        <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #eee' }}>Fecha Envío</th>
                                        <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #eee' }}>Días ANS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {processesOverANS.map((proc, idx) => (
                                        <tr key={proc.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                            <td style={{ padding: '10px', fontWeight: '600', color: COLORS.primary }}>{proc.id}</td>
                                            <td style={{ padding: '10px', color: COLORS.text.primary }}>{proc.company}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', color: COLORS.text.secondary }}>
                                                {proc.solDate ? format(proc.solDate, 'dd/MM/yyyy') : 'N/D'}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center', color: COLORS.text.secondary }}>
                                                {proc.envDate ? format(proc.envDate, 'dd/MM/yyyy') : 'N/D'}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>
                                                <span style={{
                                                    background: proc.ansDays > 10 ? '#FEE2E2' : '#FEF3C7',
                                                    color: proc.ansDays > 10 ? '#DC2626' : '#D97706',
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {proc.ansDays} días
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 1.5 PIE CHARTS SECTION */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '20px' }}>

                    {/* Top 10 Companies (Bar Chart) */}
                    <div style={{ background: 'white', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', height: '350px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 'bold', color: COLORS.dark, textAlign: 'center' }}>
                            Top 10 Empresas (Valor Sugerido)
                        </h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart
                                layout="vertical"
                                data={pieData.companiesValue}
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" tickFormatter={(val) => `$${(val / 1000000).toFixed(0)}M`} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={120}
                                    tick={{ fontSize: 11 }}
                                    interval={0}
                                    tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '..' : val}
                                />
                                <Tooltip
                                    formatter={(val) => formatCurrency(val)}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="value" fill={COLORS.primary} radius={[0, 4, 4, 0]}>
                                    {pieData.companiesValue.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={[COLORS.primary, COLORS.accent, COLORS.warning, '#4B5563', '#1F2937'][index % 5]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Category Distribution */}
                    <div style={{ background: 'white', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', height: '350px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 'bold', color: COLORS.dark, textAlign: 'center' }}>
                            Distribución por Categoría
                        </h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <PieChart>
                                <Pie
                                    data={pieData.categories}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={2}
                                    dataKey="value"
                                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                                >
                                    {pieData.categories.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={[COLORS.accent, COLORS.primary, COLORS.warning, '#9CA3AF'][index % 4]} />
                                    ))}
                                </Pie>
                                <Legend
                                    layout="horizontal"
                                    align="center"
                                    verticalAlign="bottom"
                                    formatter={(value) => value.length > 20 ? value.substring(0, 20) + '...' : value}
                                />
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Subcategory Distribution */}
                    <div style={{ background: 'white', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', height: '350px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 'bold', color: COLORS.dark, textAlign: 'center' }}>
                            Top Subcategorías
                        </h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <PieChart>
                                <Pie
                                    data={pieData.subcategories}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={2}
                                    dataKey="value"
                                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                                >
                                    {pieData.subcategories.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={[COLORS.primary, COLORS.warning, COLORS.accent, '#374151', '#6B7280'][index % 5]} />
                                    ))}
                                </Pie>
                                <Legend
                                    layout="horizontal"
                                    align="center"
                                    verticalAlign="bottom"
                                    formatter={(value) => value.length > 20 ? value.substring(0, 20) + '...' : value}
                                />
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. CHARTS SECTION (Mixed Chart: Volume vs Value) */}
                <div style={{
                    background: 'white',
                    borderRadius: '8px',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    marginBottom: '20px',
                    height: '320px'
                }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: COLORS.dark }}>
                        Rendimiento por Empresa (Volumen vs Valor)
                    </h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={aggregation.slice(0, 10)} margin={{ top: 10, right: 10, bottom: 30, left: 10 }}> {/* Top 10 only */}
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                            <XAxis
                                dataKey="name"
                                scale="band"
                                tick={{ fontSize: 11, fill: COLORS.text.secondary, dy: 10 }}
                                interval={0}
                                angle={-30}
                                textAnchor="middle"
                                height={100}
                                tickFormatter={(val) => val.length > 25 ? val.substring(0, 25) + '...' : val}
                            />
                            <YAxis yAxisId="left" orientation="left" stroke={COLORS.primary} tick={{ fontSize: 11 }} />
                            <YAxis yAxisId="right" orientation="right" stroke={COLORS.accent} tickFormatter={formatCompactCurrency} tick={{ fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                formatter={(value, name) => [
                                    name === 'Monto ($)' ? formatCurrency(value) : value,
                                    name
                                ]}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar yAxisId="left" dataKey="processCount" name="Procesos" fill={COLORS.primary} barSize={30} radius={[4, 4, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="value" name="Monto ($)" stroke={COLORS.accent} strokeWidth={3} dot={{ r: 4 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                {/* 3. SENIOR ANALYST TABLE (Pivot Style) */}
                <div style={{
                    background: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    overflow: 'hidden'
                }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid #E5E5E5', background: '#FAFAFA' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: COLORS.dark }}>
                            Matriz de Detalle Comercial
                        </h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ background: '#F3F4F6', color: COLORS.text.secondary, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: '600' }}>Empresa Cliente</th>
                                    <th style={{ padding: '16px 24px', textAlign: 'center', fontWeight: '600' }}>Procesos</th>
                                    <th style={{ padding: '16px 24px', textAlign: 'center', fontWeight: '600' }}>Unidades</th>
                                    <th style={{ padding: '16px 24px', textAlign: 'right', fontWeight: '600' }}>Valor Sugerido Total</th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: '600' }}>Tipo Subasta</th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: '600' }}>Modalidad</th>
                                </tr>
                            </thead>
                            <tbody>
                                {aggregation.map((row, idx) => {
                                    // Heatmap Logic for bar
                                    const maxVal = aggregation[0].value;
                                    const percent = (row.value / maxVal) * 100;

                                    return (
                                        <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '16px 24px', fontWeight: '600', color: COLORS.dark }}>
                                                {row.name}
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'center', color: COLORS.text.secondary }}>
                                                <span style={{ background: '#F3F4F6', padding: '4px 12px', borderRadius: '12px', fontWeight: '600' }}>
                                                    {row.processCount}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'center', color: COLORS.text.secondary }}>
                                                {row.unitCount}
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: '500', color: COLORS.dark, width: '200px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                    {formatCurrency(row.value)}
                                                    <div style={{ width: '100px', height: '4px', background: '#F3F4F6', borderRadius: '2px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${percent}%`, height: '100%', background: '#854D0E' }} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px', color: COLORS.text.secondary }}>
                                                {row.topType}
                                            </td>
                                            <td style={{ padding: '16px 24px', color: COLORS.text.secondary }}>
                                                {row.topModalidad}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* PRINT SIGNATURE FOOTER */}
                <div className="print-only" style={{
                    marginTop: '20px',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    paddingTop: '10px'
                }}>
                    <div style={{ textAlign: 'center', borderTop: '1px solid #ccc', padding: '10px 40px', minWidth: '200px' }}>
                        <p style={{ margin: 0, fontWeight: 'bold', color: COLORS.dark }}>By Sergio Yate González</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlanesAccion;

