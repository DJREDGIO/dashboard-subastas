import React, { useState, useMemo } from 'react';
import { COLORS } from '../constants/colors';
import logoSubastas from '../assets/logo_subastas.png';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, AreaChart, Area } from 'recharts';
import { Search, Filter, Download, AlertTriangle, TrendingUp, Info, Activity, BrainCircuit, Target, Calendar, CheckCircle, AlertCircle, ShieldAlert } from 'lucide-react';
import { applyFilters } from '../services/filterUtils';
import { calculateBenchBidMetrics, findColumn, normalizeCategory, parseDateDDMMYYYY, calculateAnomalies, calculateSeasonalityForecast, parseMoney, calculateStrategicMetrics, calculateSuccessCases } from '../services/dataEngine';
import { format } from 'date-fns';

const DateFilter = ({ startDate, endDate, onChange }) => (
    <div className="no-print" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(255,255,255,0.05)',
        padding: '6px 16px',
        borderRadius: '8px',
        border: `1px solid ${COLORS.accent}`
    }}>
        <Calendar size={16} color="white" />
        <span style={{ fontSize: '12px', fontWeight: '500', color: 'white' }}>Cierre:</span>
        <input
            type="date"
            value={startDate}
            onChange={(e) => onChange('start', e.target.value)}
            style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '12px',
                width: '110px',
                fontFamily: 'inherit',
                cursor: 'pointer'
            }}
        />
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>—</span>
        <input
            type="date"
            value={endDate}
            onChange={(e) => onChange('end', e.target.value)}
            style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '12px',
                width: '110px',
                fontFamily: 'inherit',
                cursor: 'pointer'
            }}
        />
    </div>
);

const BenchBid = ({ data, filters, onFilterChange }) => {
    const [activeTab, setActiveTab] = useState('benchmarking');
    // Success Cases Date Filter State
    const [successDateRange, setSuccessDateRange] = useState({ start: '', end: '' });

    // Filter Data Logic
    const filteredData = useMemo(() => {
        if (!data || data.length === 0) return [];
        return applyFilters(data, filters);
    }, [data, filters]);

    // Calculate Metrics
    const metrics = useMemo(() => {
        return calculateBenchBidMetrics(filteredData);
    }, [filteredData]);

    const anomalies = useMemo(() => {
        return calculateAnomalies(filteredData);
    }, [filteredData]);

    const seasonality = useMemo(() => {
        return calculateSeasonalityForecast(data);
    }, [data]);

    const strategicMetrics = useMemo(() => {
        return calculateStrategicMetrics(filteredData);
    }, [filteredData]);

    const successCases = useMemo(() => {
        // 1. Calculate base success cases (metrics, commercial value)
        let cases = calculateSuccessCases(filteredData);

        // 2. Apply Custom Date Filter (If selected)
        if (successDateRange.start || successDateRange.end) {
            // Find Date Column (Look for "FECHA CIERRE")
            // We need to access the RAW data row associated with each case.
            // calculateSuccessCases currently simulates data. 
            // We should filter FIRST or pass raw data?
            // "calculateSuccessCases" returns objects with computed values but maybe not the original date.
            // Let's check `calculateSuccessCases` output. It has `closure` value but not date.
            // STRATEGY: Filter `filteredData` BEFORE passing to `calculateSuccessCases`?
            // BUT `filteredData` already has global filters. User wants INDEPENDENT filter?
            // "perfecto, necesitamos para esta pantalla el filtro de calendario... "
            // Usually implies sub-filtering the current view.

            // To support date filtering, we need to know the date of each success case.
            // The `calculateSuccessCases` function in `dataEngine.js` iterates `data`.
            // We need to pass the date filter TO `calculateSuccessCases` or update `calculateSuccessCases` to return the date.

            // Let's FILTER the data passed to `calculateSuccessCases`.
            const dateCol = findColumn(filteredData[0], ["FECHA DE CIERRE", "FECHA CIERRE", "CIERRE"]);

            if (dateCol) {
                const start = successDateRange.start ? new Date(successDateRange.start) : new Date(2000, 0, 1);
                const end = successDateRange.end ? new Date(successDateRange.end) : new Date(2100, 0, 1);
                end.setHours(23, 59, 59, 999);

                const dateFilteredData = filteredData.filter(row => {
                    const dateVal = parseDateDDMMYYYY(row[dateCol]); // Using existing parser from dataEngine logic?
                    // dataEngine uses `parseDateDDMMYYYY` or `parseDateSafe` internally?
                    // Let's use a safe parser here or assume standard format.
                    // Actually, let's look at `calculateSuccessCases` implementation in dataEngine.js (it uses `data.forEach`).
                    // Better approach: Filter the input array `filteredData` using the same logic as other filters.

                    // Simple parse attempt for now
                    if (!row[dateCol]) return false;
                    // Try parsing
                    let d = null;
                    if (typeof row[dateCol] === 'object' && row[dateCol] instanceof Date) d = row[dateCol];
                    else {
                        // Rough parsing for "DD/MM/YYYY" which is common in this dataset
                        const parts = String(row[dateCol]).split('/');
                        if (parts.length === 3) d = new Date(parts[2], parts[1] - 1, parts[0]);
                        else d = new Date(row[dateCol]);
                    }

                    return d && d >= start && d <= end;
                });
                return calculateSuccessCases(dateFilteredData);
            }
        }

        return cases;
    }, [filteredData, successDateRange]);

    // Recommendations Engine
    const recommendations = useMemo(() => {
        const recs = [];
        // 1. Based on Anomalies
        anomalies.forEach(a => {
            if (a.metric === 'Demanda (Oferentes)') {
                recs.push({
                    segment: a.category,
                    kpi: 'Oferentes',
                    risk: 'Alto riesgo de lotes desiertos',
                    actionImmediate: 'Revisar estrategia de precios base (reducir 10%) para reactivar puja.',
                    actionStructural: 'Ampliar base de datos de compradores para esta categoría.',
                    impact: 'High',
                    effort: 'Medium'
                });
            } else if (a.metric.includes('ANS')) {
                recs.push({
                    segment: a.category,
                    kpi: 'ANS',
                    risk: 'Pérdida de interés de vendedores',
                    actionImmediate: 'Asignar recurso backup para aprobaciones pendientes > 5 días.',
                    actionStructural: 'Revisar matriz de delegación de autoridad.',
                    impact: 'Medium',
                    effort: 'Low'
                });
            }
        });

        // 2. Based on Recovery
        if (metrics && metrics.recovery && metrics.recovery.P50 < 80) {
            recs.push({
                segment: 'Global',
                kpi: 'Recovery',
                risk: 'Subvaloración de activos',
                actionImmediate: 'Auditar muestras de lotes con cierre < 70% del base.',
                actionStructural: 'Ajustar algoritmo de valor sugerido.',
                impact: 'Critical',
                effort: 'High'
            });
        }

        return recs;
    }, [anomalies, metrics]);

    // Categories Breakdown for Benchmarking
    const categoryMetrics = useMemo(() => {
        if (!filteredData.length) return [];
        const catCol = findColumn(filteredData[0], ["CATEGORIA"]);
        if (!catCol) return [];

        const grouped = {};
        filteredData.forEach(row => {
            const cat = normalizeCategory(row[catCol]);
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(row);
        });

        // Calculate metrics per category
        return Object.keys(grouped).map(cat => ({
            category: cat,
            metrics: calculateBenchBidMetrics(grouped[cat])
        }));
    }, [filteredData]);

    // Render Tab Content
    const renderContent = () => {
        switch (activeTab) {
            case 'success':
                return (
                    <div style={{ display: 'grid', gap: '24px' }}>
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
                                <h1 style={{ marginBottom: '5px', color: '#1F2937' }}>Reporte de Casos de Éxito</h1>
                                <p style={{ margin: 0, color: '#6B7280' }}>Benchmarking Comercial & Ahorro de Mercado</p>
                                <p style={{ margin: '4px 0 0 0', color: '#03AB90', fontWeight: 'bold', fontSize: '14px' }}>
                                    Generado el: {new Date().toLocaleDateString()}
                                </p>
                            </div>
                            <img src={logoSubastas} alt="Subastas y Comercio" style={{ height: '60px' }} />
                        </div>

                        {/* SCREEN HEADER (Hidden on Print) */}
                        <div className="no-print" style={{
                            background: `linear-gradient(135deg, ${COLORS.primary} 0%, #0f172a 100%)`,
                            padding: '32px',
                            borderRadius: '16px',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        }}>
                            <div>
                                <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>Casos de Éxito & Ahorro de Mercado</h2>
                                <p style={{ margin: 0, opacity: 0.9, maxWidth: '600px', fontWeight: '300' }}>
                                    Descubre el valor real. Comparamos el precio de cierre de nuestras subastas con referencias de mercado (Inteligencia Artificial) para demostrar el ahorro obtenido.
                                </p>
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                <DateFilter
                                    startDate={successDateRange.start}
                                    endDate={successDateRange.end}
                                    onChange={(type, val) => setSuccessDateRange(prev => ({ ...prev, [type]: val }))}
                                />

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
                                    <div>
                                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: COLORS.accent }}>
                                            {successCases.length > 0 ? `${successCases[0].savingsPct}%` : '0%'}
                                        </div>
                                        <div style={{ fontSize: '14px', opacity: 0.8 }}>Ahorro Máximo Detectado</div>
                                    </div>
                                    <button
                                        onClick={() => window.print()}
                                        style={{
                                            padding: '12px 24px',
                                            background: COLORS.accent,
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontWeight: '600',
                                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                            e.currentTarget.style.boxShadow = '0 6px 8px rgba(0,0,0,0.2)';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                                        }}
                                    >
                                        <Download size={18} />
                                        Exportar Reporte
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
                            {successCases.map((item, idx) => (
                                <div key={idx} style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', breakInside: 'avoid' }}>
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: COLORS.primary, background: '#eff6ff', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                                {item.category}
                                            </span>
                                            <span style={{ fontSize: '11px', color: COLORS.text.secondary }}>{item.company}</span>
                                        </div>
                                        <h3 style={{ margin: 0, fontSize: '16px', lineHeight: '1.4', color: COLORS.dark }}>
                                            {item.asset}
                                        </h3>
                                    </div>

                                    <div style={{ marginTop: 'auto' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '12px', color: COLORS.text.secondary }}>Valor Cierre Subasta</span>
                                            <span style={{ fontSize: '16px', fontWeight: 'bold', color: COLORS.dark }}>$ {new Intl.NumberFormat('es-CO').format(item.closure)}</span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px dashed #e2e8f0' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '12px', color: COLORS.text.secondary }}>Valor Comercial (Est.)</span>
                                                <span style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic' }}>Fuente: {item.source}</span>
                                            </div>
                                            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#64748b', textDecoration: 'line-through' }}>$ {new Intl.NumberFormat('es-CO').format(item.commercial)}</span>
                                        </div>

                                        <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <span style={{ display: 'block', fontSize: '11px', color: '#166534', fontWeight: 'bold', textTransform: 'uppercase' }}>Ahorro / Margen</span>
                                                <span style={{ fontSize: '18px', fontWeight: '800', color: '#16a34a' }}>$ {new Intl.NumberFormat('es-CO').format(item.savings)}</span>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#16a34a' }}>{item.savingsPct}%</div>
                                                <div style={{ fontSize: '10px', color: '#166534' }}>vs Mercado</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* PRINT SIGNATURE BLOCK */}
                        <div className="print-only" style={{
                            marginTop: '20px',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            paddingTop: '10px',
                            pageBreakInside: 'avoid'
                        }}>
                            <div style={{ textAlign: 'center', borderTop: '1px solid #ccc', padding: '10px 40px', minWidth: '200px' }}>
                                <p style={{ margin: 0, fontWeight: 'bold', color: COLORS.dark }}>By Sergio Yate González</p>
                            </div>
                        </div>
                    </div>
                );
            case 'benchmarking':
                return (
                    <div style={{ display: 'grid', gap: '32px' }}>
                        {/* Summary Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                            <MetricCard
                                title="Recovery Rate (Global)"
                                value={`${metrics?.recovery?.P50?.toFixed(1) || 0}%`}
                                subtitle={`P90: ${metrics?.recovery?.P90?.toFixed(1) || 0}% | P10: ${metrics?.recovery?.P25?.toFixed(1) || 0}%`}
                                icon={Target}
                                color={COLORS.accent}
                            />
                            <MetricCard
                                title="Oferentes Promedio (P50)"
                                value={metrics?.demand?.oferentes?.P50?.toFixed(1) || 0}
                                subtitle="Señal de demanda mediana"
                                icon={Activity}
                                color={COLORS.primary}
                            />
                            <MetricCard
                                title="ANS Aprobación (P50)"
                                value={`${metrics?.ans?.P50?.toFixed(1) || 0} días`}
                                subtitle="Tiempo mediano de gestión"
                                icon={Calendar}
                                color={COLORS.warning}
                            />
                        </div>

                        {/* Category Breakdown Table */}
                        <div style={{ background: COLORS.background.card, borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            <h3 style={{ margin: '0 0 20px 0', color: COLORS.text.primary }}>Benchmarks por Categoría</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: `2px solid ${COLORS.gray}30` }}>
                                            <th style={{ textAlign: 'left', padding: '12px', color: COLORS.text.secondary }}>Categoría</th>
                                            <th style={{ textAlign: 'right', padding: '12px', color: COLORS.text.secondary }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                    <span>Recovery P50</span>
                                                    <span style={{ fontSize: '10px', color: COLORS.text.secondary, fontWeight: 'normal' }}>Mediana (Cierre/Sugerido)</span>
                                                </div>
                                            </th>
                                            <th style={{ textAlign: 'right', padding: '12px', color: COLORS.text.secondary }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                    <span>Recovery P90</span>
                                                    <span style={{ fontSize: '10px', color: COLORS.text.secondary, fontWeight: 'normal' }}>Top 10% Performance</span>
                                                </div>
                                            </th>
                                            <th style={{ textAlign: 'right', padding: '12px', color: COLORS.text.secondary }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                    <span>Oferentes P50</span>
                                                    <span style={{ fontSize: '10px', color: COLORS.text.secondary, fontWeight: 'normal' }}>Demanda Efectiva (&gt;0)</span>
                                                </div>
                                            </th>
                                            <th style={{ textAlign: 'right', padding: '12px', color: COLORS.text.secondary }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                    <span>ANS Aprob. P50</span>
                                                    <span style={{ fontSize: '10px', color: COLORS.text.secondary, fontWeight: 'normal' }}>Días Gestión (Mediana)</span>
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {categoryMetrics.map((item, idx) => (
                                            <tr key={idx} style={{ borderBottom: `1px solid ${COLORS.gray}15` }}>
                                                <td style={{ padding: '16px 12px', fontWeight: '500' }}>{item.category}</td>
                                                <td style={{ textAlign: 'right', padding: '16px 12px', color: COLORS.accent, fontWeight: 'bold' }}>
                                                    {item.metrics?.recovery?.P50?.toFixed(1)}%
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '16px 12px', color: COLORS.accent }}>
                                                    {item.metrics?.recovery?.P90?.toFixed(1)}%
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '16px 12px' }}>
                                                    {item.metrics?.demand?.oferentes?.P50?.toFixed(1)}
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '16px 12px' }}>
                                                    {item.metrics?.ans?.P50?.toFixed(1)} d
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'anomalies':
                return (
                    <div style={{ display: 'grid', gap: '20px' }}>
                        {anomalies.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: COLORS.text.secondary }}>
                                <CheckCircle size={48} color={COLORS.success} style={{ marginBottom: '16px' }} />
                                <p>No se han detectado anomalías críticas en los datos filtrados.</p>
                            </div>
                        ) : (
                            anomalies.map((anom, idx) => (
                                <div key={idx} style={{ background: COLORS.background.card, padding: '24px', borderRadius: '12px', borderLeft: `4px solid ${anom.type === 'critical' ? COLORS.loss : COLORS.warning}`, display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <div style={{ padding: '12px', borderRadius: '50%', background: `${anom.type === 'critical' ? COLORS.loss : COLORS.warning}20` }}>
                                        <AlertTriangle size={24} color={anom.type === 'critical' ? COLORS.loss : COLORS.warning} />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: COLORS.text.primary }}>{anom.category}: {anom.metric}</h4>
                                        <p style={{ margin: 0, color: COLORS.text.secondary }}>{anom.message}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                );
            case 'forecast':
                const fData = seasonality.history;
                return (
                    <div style={{ display: 'grid', gap: '32px' }}>
                        <div style={{ background: COLORS.background.card, padding: '24px', borderRadius: '12px' }}>
                            <h3 style={{ margin: '0 0 20px 0' }}>Estacionalidad & Proyección (Q3 2026)</h3>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={fData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" fontSize={11} stroke={COLORS.text.disabled} />
                                        <YAxis fontSize={11} stroke={COLORS.text.disabled} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        />
                                        <Legend />
                                        <Bar dataKey="2024" fill={COLORS.gray} opacity={0.3} radius={[4, 4, 0, 0]} name="2024" />
                                        <Bar dataKey="2025" fill={COLORS.primary} opacity={0.6} radius={[4, 4, 0, 0]} name="2025" />
                                        <Line type="monotone" dataKey="2026" stroke={COLORS.accent} strokeWidth={3} dot={{ r: 4 }} name="2026 (Actual)" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                            <ForecastCard label="Conservador" value={seasonality.forecast.conservative.toFixed(0)} color={COLORS.gray} />
                            <ForecastCard label="Base (Tendencia)" value={seasonality.forecast.base.toFixed(0)} color={COLORS.primary} />
                            <ForecastCard label="Agresivo" value={seasonality.forecast.aggressive.toFixed(0)} color={COLORS.accent} />
                        </div>
                    </div>
                );
            case 'recommendations':
                return (
                    <div style={{ display: 'grid', gap: '20px' }}>
                        {recommendations.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: COLORS.text.secondary }}>
                                <Info size={48} color={COLORS.primary} style={{ marginBottom: '16px' }} />
                                <p>El motor no tiene recomendaciones para los filtros actuales.</p>
                            </div>
                        ) : (
                            recommendations.map((rec, idx) => (
                                <div key={idx} style={{ background: COLORS.background.card, padding: '24px', borderRadius: '12px', border: `1px solid ${COLORS.gray}30` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <div style={{ padding: '8px', background: `${COLORS.accent}20`, borderRadius: '6px' }}>
                                                <BrainCircuit size={20} color={COLORS.accent} />
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '16px' }}>Acción Recomendada: {rec.segment}</h4>
                                                <span style={{ fontSize: '12px', color: COLORS.text.secondary }}>KPI Impactado: {rec.kpi}</span>
                                            </div>
                                        </div>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '100px',
                                            background: rec.effort === 'High' ? `${COLORS.warning}20` : `${COLORS.success}20`,
                                            color: rec.effort === 'High' ? COLORS.warning : COLORS.success,
                                            fontSize: '11px',
                                            fontWeight: 'bold',
                                            height: 'fit-content'
                                        }}>
                                            Esfuerzo: {rec.effort}
                                        </span>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', fontSize: '14px' }}>
                                        <div>
                                            <p style={{ fontWeight: 'bold', color: COLORS.text.primary, marginBottom: '4px' }}>Inmediato (2 semanas)</p>
                                            <p style={{ margin: 0, color: COLORS.text.secondary }}>{rec.actionImmediate}</p>
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 'bold', color: COLORS.text.primary, marginBottom: '4px' }}>Estructural (30-60 días)</p>
                                            <p style={{ margin: 0, color: COLORS.text.secondary }}>{rec.actionStructural}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                );
            case 'strategy':
                return (
                    <div style={{ display: 'grid', gap: '32px' }}>
                        {/* Risk Indicators */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                            <MetricCard
                                title="Inventario en Riesgo"
                                value={`${strategicMetrics?.inventoryRisk?.count || 0}`}
                                subtitle={`${strategicMetrics?.inventoryRisk?.share?.toFixed(1) || 0}% del total (>30 días)`}
                                icon={AlertCircle}
                                color={strategicMetrics?.inventoryRisk?.share > 10 ? COLORS.error : COLORS.success}
                            />
                            <MetricCard
                                title="Dependencia Clientes"
                                value={`${strategicMetrics?.clientConcentration?.topClient?.share?.toFixed(1) || 0}%`}
                                subtitle={`Top: ${strategicMetrics?.clientConcentration?.topClient?.name.substring(0, 20)}...`}
                                icon={ShieldAlert}
                                color={strategicMetrics?.clientConcentration?.risk ? COLORS.error : COLORS.success}
                            />
                            <MetricCard
                                title="Precisión de Valoración"
                                value={`${strategicMetrics?.pricingAccuracy?.medianBias?.toFixed(1) || 0}%`}
                                subtitle="Sesgo mediano (Cierre vs Sugerido)"
                                icon={Target}
                                color={Math.abs(strategicMetrics?.pricingAccuracy?.medianBias || 0) > 15 ? COLORS.warning : COLORS.primary}
                            />
                        </div>

                        {/* Conversion Funnel */}
                        <div style={{ background: COLORS.background.card, padding: '24px', borderRadius: '12px' }}>
                            <h3 style={{ margin: '0 0 20px 0', color: COLORS.text.primary }}>Embudo de Conversión por Categoría</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: `1px solid ${COLORS.gray}30` }}>
                                            <th style={{ padding: '12px', color: COLORS.text.secondary }}>Categoría</th>
                                            <th style={{ padding: '12px', color: COLORS.text.secondary }}>Tasa de Conversión (Aprobados/Total)</th>
                                            <th style={{ padding: '12px', color: COLORS.text.secondary }}>Total Gestionado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {strategicMetrics?.conversion?.map((c, i) => (
                                            <tr key={i} style={{ borderBottom: `1px solid ${COLORS.gray}10` }}>
                                                <td style={{ padding: '12px', color: COLORS.text.primary }}>{c.category}</td>
                                                <td style={{ padding: '12px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ width: '100px', height: '8px', background: '#e0e0e0', borderRadius: '4px' }}>
                                                            <div style={{ width: `${c.rate}%`, height: '100%', background: c.rate < 20 ? COLORS.error : COLORS.success, borderRadius: '4px' }} />
                                                        </div>
                                                        <span style={{ color: COLORS.text.primary }}>{c.rate.toFixed(1)}%</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '12px', color: COLORS.text.primary }}>{c.total}</td>
                                            </tr>
                                        ))}
                                        {(!strategicMetrics?.conversion || strategicMetrics.conversion.length === 0) && (
                                            <tr><td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: COLORS.text.secondary }}>Sin datos de conversión</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    if (!data || data.length === 0) {
        return (
            <div style={{ padding: '32px', textAlign: 'center' }}>
                <p style={{ color: COLORS.text.secondary }}>Cargando datos o sin datos disponibles...</p>
            </div>
        );
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: COLORS.background.main }}>

            {/* Header */}
            <div style={{
                padding: '24px 32px',
                background: COLORS.background.card,
                borderBottom: `1px solid #E5E5E5`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                    <h1 style={{ margin: 0, color: COLORS.text.primary, fontSize: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <BarChart2 size={28} color={COLORS.primary} />
                        BenchBid: Inteligencia de Mercado
                    </h1>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ padding: '0 32px', background: COLORS.background.card, borderBottom: `1px solid #E5E5E5` }}>
                <div style={{ display: 'flex', gap: '32px' }}>
                    <TabButton active={activeTab === 'benchmarking'} onClick={() => setActiveTab('benchmarking')} label="Benchmarking Interno" icon={Target} />
                    <TabButton active={activeTab === 'success'} onClick={() => setActiveTab('success')} label="Casos de Éxito (IA Market)" icon={CheckCircle} />
                    <TabButton active={activeTab === 'anomalies'} onClick={() => setActiveTab('anomalies')} label="Detección de Anomalías" icon={AlertTriangle} />
                    <TabButton active={activeTab === 'forecast'} onClick={() => setActiveTab('forecast')} label="Estacionalidad y Forecast" icon={TrendingUp} />
                    <TabButton active={activeTab === 'recommendations'} onClick={() => setActiveTab('recommendations')} label="Recomendaciones" icon={BrainCircuit} />
                    <TabButton active={activeTab === 'strategy'} onClick={() => setActiveTab('strategy')} label="Estrategia & Riesgos" icon={ShieldAlert} />
                </div>
            </div>

            {/* Content */}
            <div style={{ padding: '32px', flex: 1, overflow: 'auto' }}>
                {renderContent()}
            </div>
        </div>
    );
};

// Subcomponents
const MetricCard = ({ title, value, subtitle, icon: Icon, color }) => (
    <div style={{ background: COLORS.background.card, padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
            <p style={{ margin: 0, color: COLORS.text.secondary, fontSize: '13px', fontWeight: '500' }}>{title}</p>
            <p style={{ margin: '8px 0 4px 0', fontSize: '28px', fontWeight: 'bold', color: COLORS.text.primary }}>{value}</p>
            <p style={{ margin: 0, fontSize: '12px', color: COLORS.text.secondary }}>{subtitle}</p>
        </div>
        <div style={{ padding: '12px', borderRadius: '8px', background: `${color}15` }}>
            <Icon size={24} color={color} />
        </div>
    </div>
);

const TabButton = ({ active, onClick, label, icon: Icon }) => (
    <button
        onClick={onClick}
        style={{
            background: 'none',
            border: 'none',
            padding: '16px 0',
            margin: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: active ? COLORS.primary : COLORS.text.secondary,
            borderBottom: active ? `3px solid ${COLORS.primary}` : '3px solid transparent',
            fontWeight: active ? '600' : '400',
            transition: 'all 0.2s'
        }}
    >
        <Icon size={18} />
        {label}
    </button>
);

const ForecastCard = ({ label, value, color }) => (
    <div style={{ background: COLORS.background.card, padding: '24px', borderRadius: '12px', borderTop: `4px solid ${color}`, textAlign: 'center' }}>
        <p style={{ margin: 0, color: COLORS.text.secondary, fontSize: '13px', fontWeight: '500' }}>Escenario {label}</p>
        <p style={{ margin: '12px 0 0 0', fontSize: '32px', fontWeight: 'bold', color: color }}>{value}</p>
        <p style={{ margin: 0, fontSize: '11px', color: COLORS.text.secondary }}>lotes proyectados Q3</p>
    </div>
);

// Import Chart component to fix missing reference if needed, though we imported BarChart etc at top.
// Note: We need BarChart2 for the header icon which is what we used in Sidebar.
import { BarChart2 } from 'lucide-react';

export default BenchBid;
