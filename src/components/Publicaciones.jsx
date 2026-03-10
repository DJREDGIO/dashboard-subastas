import React, { useState, useMemo } from 'react';
import { Share2, Clock, CheckCircle, Calendar, DollarSign, BarChart2, Filter, Download } from 'lucide-react';
import logoSubastas from '../assets/logo_subastas.png';
import { COLORS } from '../constants/colors';
import { findColumn, parseMoney } from '../services/dataEngine';
import { format, parseISO, isValid, differenceInDays, isWithinInterval, parse } from 'date-fns';
import {
    ComposedChart,
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
        <span style={{ fontSize: '13px', fontWeight: '600', color: COLORS.text.primary }}>Filtro Publicación:</span>
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

const Publicaciones = ({ data }) => {
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    // 1. BASE FILTER: Estado Tecnico IN ("Aprobado", "Re Publicado", etc)
    const baseData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const statusCol = findColumn(data[0], ["ESTADO TECNICO", "ESTADO"]);
        if (!statusCol) return [];

        return data.filter(row => {
            const status = String(row[statusCol] || '').trim().toLowerCase();
            return status.includes('aprobado') || status.includes('re publicad') || status.includes('republicad');
        });
    }, [data]);

    // 2. DATE FILTER & AGGREGATION
    // Apply Independent Date Filter on "FECHA PUBLICACION"
    const { filteredData, aggregation, processList, itemList } = useMemo(() => {
        if (!baseData.length) return { filteredData: [], aggregation: [] };

        const pubDateCol = findColumn(baseData[0], ["FECHA DE PUBLICACION", "FECHA PUBLICACION", "PUBLICACION"]);
        const processCol = findColumn(baseData[0], ["N° PROCESO", "N PROCESO", "PROCESO", "ID PROCESO"]);
        const companyCol = findColumn(baseData[0], ["EMPRESA", "CLIENTE"]);
        const valueCol = findColumn(baseData[0], ["VALOR SUGERIDO", "PRECIO SUGERIDO", "BASE"]);
        const catCol = findColumn(baseData[0], ["CATEGORIA"]);
        const approvalDateCol = findColumn(baseData[0], ["FECHA DE APROBACION VALORACION", "FECHA APROBACION VALORACION", "APROBACION VALORACION", "FECHA DE APROBACION"]);

        let filtered = baseData;

        // Apply Date Filter
        if (dateRange.start || dateRange.end) {
            filtered = baseData.filter(row => {
                if (!pubDateCol) return true;
                const d = parseDateSafe(row[pubDateCol]);
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

        let totalAns = 0;
        let ansCount = 0;

        filtered.forEach(row => {
            const company = row[companyCol] || "SIN EMPRESA";
            const val = parseMoney(row[valueCol]);
            const cat = row[catCol] || "OTROS";
            const procId = row[processCol];
            const dPub = parseDateSafe(row[pubDateCol]);
            const dApp = parseDateSafe(row[approvalDateCol]);

            if (!aggMap.has(company)) {
                aggMap.set(company, {
                    name: company,
                    processes: new Set(),
                    rows: 0,
                    totalValue: 0,
                    categories: {},
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

            // REPUBLICATIONS Calculation (Detect "-R" in Process ID)
            if (procId && /[- ]R\d+/i.test(procId)) {
                // Matches -R1, -R2, -R139... (case insensitive)
                entry.repubCount++;
            }

            // ANS Calculation
            if (isValid(dPub) && isValid(dApp)) {
                const diff = Math.abs(differenceInDays(dApp, dPub));
                entry.ansSum += diff;
                entry.ansCount++;
                totalAns += diff;
                ansCount++;
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

            const totalProcs = e.processes.size || 1; // Avoid div by zero, though logic implies >0
            // Note: repubCount is row-based? Or process based? 
            // Usually republication applies to the PROCESS ID itself. 
            // If we count rows, we might count items. Let's assume row-based check is okay for now, 
            // or better, check if the *process ID* is a republication.
            // If the process ID itself has -R, then ALL rows for that process are part of a republication.
            // However, entry.repubCount above increments for every ROW. 
            // Let's refine: If we want % of PROCESSES that are republications:

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
                repubRate: (repubProcs / e.processes.size) * 100,
                avgAns: e.ansCount > 0 ? (e.ansSum / e.ansCount) : 0
            };
        }).sort((a, b) => b.value - a.value); // Sort by Value by default

        // Aggregate by Process (Validation View)
        const procMap = new Map();
        const items = []; // Granular list for "By Item/Lot" analysis

        // Columns for Granular Analysis
        const goodsCol = findColumn(baseData[0], ["BIENES", "DESCRIPCION", "OBJETO"]);
        const validationCol = findColumn(baseData[0], ["VALIDACION DE PROCESO", "VALIDACION", "CODIGO VALIDACION"]);
        const unitCol = findColumn(baseData[0], ["UNIDAD DE MEDIDA", "UNIDAD", "UM", "MEDIDA"]);

        filtered.forEach(row => {
            const procId = row[processCol] || "SIN PROCESO";
            const company = row[companyCol] || "";
            const cat = row[catCol] || "OTROS";
            const val = parseMoney(row[valueCol]);
            const dPub = parseDateSafe(row[pubDateCol]);

            // Item Level Data
            const goodsName = row[goodsCol] || "Sin Descripción";
            const validationCode = row[validationCol] || "N/A";

            // Units & Measure
            const unitsCol = findColumn(row, ["UNIDADES", "CANTIDAD", "CANT"]);
            const units = unitsCol ? (parseFloat(row[unitsCol]) || 1) : 1;
            const unitMeasure = row[unitCol] || "Unidades";

            items.push({
                processId: procId,
                company,
                goods: goodsName,
                validationCode,
                value: val,
                units: units,
                unitMeasure: unitMeasure // Pass the detailed unit
            });

            if (!procMap.has(procId)) {
                procMap.set(procId, {
                    id: procId,
                    company: company,
                    category: cat,
                    lotes: 0,
                    value: 0,
                    date: dPub,
                    items: []
                });
            }
            const p = procMap.get(procId);
            p.lotes += units; // Accumulate units per process
            p.value += val;
            p.items.push(items[items.length - 1]); // Link item to process
            if (!p.date && dPub) p.date = dPub;
        });

        const procArray = Array.from(procMap.values()).sort((a, b) => a.id.localeCompare(b.id));

        return { filteredData: filtered, aggregation: aggArray, processList: procArray, itemList: items };

    }, [baseData, dateRange]);

    // 3. FINAL METRICS
    const metrics = useMemo(() => {
        const totalProcesses = aggregation.reduce((acc, curr) => acc + curr.processCount, 0);
        const totalUnits = aggregation.reduce((acc, curr) => acc + curr.unitCount, 0);
        const totalValue = aggregation.reduce((acc, curr) => acc + curr.value, 0);

        // Republication % Global
        const uniqueProcs = new Set();
        filteredData.forEach(r => {
            const pid = r[findColumn(baseData[0] || {}, ["N° PROCESO", "N PROCESO", "PROCESO", "ID PROCESO"])];
            if (pid) uniqueProcs.add(pid);
        });

        let globalRepubCount = 0;
        uniqueProcs.forEach(p => {
            if (/[- ]R\d+/i.test(p)) globalRepubCount++;
        });

        const globalRepubRate = uniqueProcs.size > 0 ? (globalRepubCount / uniqueProcs.size) * 100 : 0;

        // ANS Weighted Average
        let totalAnsDays = 0;
        let totalAnsCount = 0;

        let ansSum = 0;
        let ansN = 0;
        const pubDateCol = findColumn(baseData[0] || {}, ["FECHA DE PUBLICACION", "FECHA PUBLICACION", "PUBLICACION"]);
        const approvalDateCol = findColumn(baseData[0] || {}, ["FECHA DE APROBACION VALORACION", "FECHA APROBACION VALORACION", "APROBACION VALORACION", "FECHA DE APROBACION"]);

        filteredData.forEach(row => {
            const dPub = parseDateSafe(row[pubDateCol]);
            const dApp = parseDateSafe(row[approvalDateCol]);
            if (isValid(dPub) && isValid(dApp)) {
                ansSum += Math.abs(differenceInDays(dApp, dPub));
                ansN++;
            }
        });
        const globalAvgAns = ansN > 0 ? (ansSum / ansN) : 0;

        return {
            uniqueProcesses: totalProcesses,
            totalUnits: totalUnits,
            totalValue: totalValue,
            avgAns: globalAvgAns,
            repubRate: globalRepubRate
        };
    }, [filteredData, aggregation, baseData]);

    if (!data || data.length === 0) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Cargando datos del módulo de publicaciones...</div>;
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
                    <h1 style={{ marginBottom: '5px', color: '#1F2937' }}>Tablero de Publicaciones</h1>
                    <p style={{ margin: 0, color: '#6B7280' }}>Análisis de rendimiento comercial por empresa</p>
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
                    <h1 style={{ margin: 0, fontSize: '24px', color: COLORS.text.primary }}>Tablero de Publicaciones</h1>
                    <p style={{ margin: '4px 0 0 0', color: COLORS.text.secondary }}>Análisis de rendimiento comercial por empresa</p>
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
                        title="Procesos Publicados"
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
                        subValue="Aprobación → Publicación"
                    />
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
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: '600' }}>Categoría Principal</th>
                                    <th style={{ padding: '16px 24px', textAlign: 'center', fontWeight: '600' }}>% Repub.</th>
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
                                                {row.topCategory}
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                                <span style={{
                                                    color: row.repubRate > 20 ? COLORS.warning : COLORS.status.success,
                                                    fontWeight: '600'
                                                }}>
                                                    {row.repubRate.toFixed(1)}%
                                                </span>
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

export default Publicaciones;
