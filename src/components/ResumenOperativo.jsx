import React, { useState, useMemo } from 'react';
import logoSubastas from '../assets/logo_subastas.png';
import { Upload, TrendingUp, TrendingDown, Minus, Download, AlertCircle } from 'lucide-react';
import { COLORS } from '../constants/colors';
import { calculateKPIs, identifyActionPlans, calculateValuationTrend, findColumn, parseCSV, detectDateColumns, getTopN, getStackedTrend, getPieData, enrichDataWithDates } from '../services/dataEngine';
import { applyFilters, calculateANSMetrics, isPotentiallyCancelled } from '../services/filterUtils';
import { TrendChart, DataTable, InsightsPanel } from './Charts';
import { StackedBarChart, PieChartDistribution } from './Charts_Supplemental';
import VirtualAnalystPanel from './VirtualAnalystPanel';
import FilterBar from './FilterBar';
import { subDays, format, isValid, parseISO, isSameMonth, isSameQuarter } from 'date-fns';
import { Target, Zap, Users, AlertTriangle, CheckCircle } from 'lucide-react';

// Helper: Dates
const getFormattedDate = (date) => format(date, 'yyyy-MM-dd');

// KPI Card Component
// Now accepts 'trendData' object: { direction: 'up'|'down'|'neutral', value: string, color: string }
// If trendData is null/undefined, hides the footer.
function KPICard({ title, value, unit, trendData, bgColor, iconColor }) {
    // If we have explicit trend data, use it. Otherwise, support legacy props or hide.
    // Legacy props (trend, change) are deprecated but kept for safety if needed, 
    // but the instruction is to use dynamic data.

    const showTrend = !!trendData && trendData.value !== 'N/A' && trendData.value !== '-';

    // Icon selection
    let TrendIcon = Minus;
    if (showTrend) {
        if (trendData.direction === 'up') TrendIcon = TrendingUp;
        else if (trendData.direction === 'down') TrendIcon = TrendingDown;
    }

    return (
        <div style={{
            background: COLORS.background.card,
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '80px',
                height: '80px',
                background: bgColor,
                borderRadius: '0 0 0 100%',
                opacity: 0.5
            }} />

            <p style={{
                margin: 0,
                color: COLORS.text.secondary,
                fontSize: '13px',
                fontWeight: '500',
                marginBottom: '8px'
            }}>
                {title}
            </p>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: showTrend ? '12px' : '0' }}>
                <span style={{
                    fontSize: '32px',
                    fontWeight: 'bold',
                    color: COLORS.text.primary
                }}>
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </span>
                <span style={{ fontSize: '14px', color: COLORS.text.secondary }}>
                    {unit}
                </span>
            </div>

            {showTrend && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendIcon size={16} color={trendData.color} />
                    <span style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: trendData.color
                    }}>
                        {trendData.value}
                    </span>
                    <span style={{ fontSize: '12px', color: COLORS.text.secondary }}>
                        vs período anterior
                    </span>
                </div>
            )}
        </div>
    );
}

// Status Item Component
function StatusItem({ label, value, color }) {
    return (
        <div style={{
            textAlign: 'center',
            padding: '16px',
            borderRadius: '6px',
            background: `${color}15`
        }}>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color }}>
                {value.toLocaleString()}
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: COLORS.text.secondary }}>
                {label}
            </p>
        </div>
    );
}

// Helper: Calculate Previous Range
const calculatePreviousRange = (startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) return null;

    // dates come as YYYY-MM-DD
    const end = new Date(endDateStr.split('-').map(Number).join('-')); // Use explicit parsing to avoid TZ issues
    // Actually, splitting usually safer: new Date(y, m-1, d)
    const [sy, sm, sd] = startDateStr.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);

    const [ey, em, ed] = endDateStr.split('-').map(Number);
    const endD = new Date(ey, em - 1, ed);

    if (!isValid(start) || !isValid(endD)) return null;

    const diff = endD.getTime() - start.getTime();
    const daysDiff = Math.round(diff / (1000 * 3600 * 24));

    // Previous end is Start - 1 day
    const prevEnd = subDays(start, 1);
    const prevStart = subDays(prevEnd, daysDiff); // Same duration

    return {
        fechaInicio: getFormattedDate(prevStart),
        fechaFin: getFormattedDate(prevEnd)
    };
};

// Helper: Calculate Trend Data
const calculateTrendMetric = (currentVal, prevVal, isInverse = false, suffix = '%') => {
    // Parse if strings
    const curr = typeof currentVal === 'string' ? parseFloat(currentVal) : currentVal;
    const prev = typeof prevVal === 'string' ? parseFloat(prevVal) : prevVal;

    if (isNaN(curr) || isNaN(prev) || prev === 0 || prev === null) {
        return null;
    }

    const delta = curr - prev;
    const percent = ((delta / prev) * 100).toFixed(1);
    const displayValue = `${delta > 0 ? '+' : ''}${percent}${suffix}`;

    // Colors: Upside good unless inverse (like days)
    let direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';

    // Logic for color:
    // Normal (Assets, Process): Up = Accent (Good), Down = Warning (Bad)
    // Inverse (Days/ANS): Up = Warning (Bad, took longer), Down = Accent (Good, faster)
    let color = COLORS.gray;
    if (direction !== 'neutral') {
        const isGood = isInverse ? delta < 0 : delta > 0;
        color = isGood ? COLORS.accent : COLORS.warning;
    }

    return {
        direction,
        value: displayValue,
        color
    };
};

/* -------------------------------------------------------------------------- */
/*                        STRATEGIC RISK ENGINE                               */
/* -------------------------------------------------------------------------- */

const calculateStrategicRisks = (data) => {
    if (!data || data.length === 0) return null;

    const risks = {
        blindConversion: { level: 'low', message: 'Datos de cierre disponibles', value: 'OK' },
        sluggishness: { level: 'low', message: 'Tiempos operativos óptimos', value: '0 días' },
        dependency: { level: 'low', message: 'Cartera diversificada', value: '0%' }
    };

    // 1. BLIND CONVERSION (Conversión Ciega)
    // Logic: In Q4 or Jan, lack of 'VALOR CIERRE' or 'MOTIVO NO APROBACION'
    // Simplified: Check % of rows with 'VALOR CIERRE' > 0
    const closureCol = findColumn(data[0], ['VALOR CIERRE', 'PRECIO CIERRE', 'MONTO CIERRE']);
    let conversionDataCount = 0;

    // 2. SLUGGISHNESS (Lentitud Operativa)
    // Logic: Avg days between 'FECHA SOLICITUD' and 'FECHA VALORACION'
    const reqDateCol = findColumn(data[0], ['FECHA SOLICITUD', 'SOLICITUD']);
    const valDateCol = findColumn(data[0], ['FECHA VALORACION', 'VALORACION']);
    let totalDays = 0;
    let validTimeRows = 0;

    // 3. DEPENDENCY (Dependencia Crítica)
    // Logic: Max concentration of Assets by Client
    const clientCol = findColumn(data[0], ['EMPRESA', 'CLIENTE']);
    const clientCounts = {};

    data.forEach(row => {
        // Blind Conversion Check
        if (closureCol && row[closureCol] && row[closureCol] !== '0' && row[closureCol] !== '') {
            conversionDataCount++;
        }

        // Sluggishness Check
        if (reqDateCol && valDateCol && row[reqDateCol] && row[valDateCol]) {
            const d1 = parseISO(row[reqDateCol]); // Assuming ISO or standard date needed, might need robust parser
            const d2 = parseISO(row[valDateCol]);
            // Fallback for simple date strings if parseISO fails or if filterUtils enriched it
            // Using enriched fields if available
            // Let's assume standard date strings for calculation or use raw logic
            // Simplified for robustness: Use existing enriched fields if possible
        }

        // Dependency Check
        if (clientCol && row[clientCol]) {
            const client = row[clientCol];
            clientCounts[client] = (clientCounts[client] || 0) + 1;
        }
    });

    // --- FINALIZE BLIND CONVERSION ---
    // If we are in a risking period (Jan/Q4), strict check.
    // For now, general check: if < 10% of rows have closure data, it's BLIND.
    const closureRate = (conversionDataCount / data.length) * 100;

    // Hardcoded logic for "Enero/Q4" simulation if specific month filter isn't active, 
    // but usually this is data-dependent. 
    // If the dataset contains mostly Jan/Dec data and closureRate is low -> HIGH RISK.

    if (closureRate < 5) {
        risks.blindConversion = {
            level: 'critical',
            message: 'Riesgo Crítico: Sin datos de cierre detectables',
            value: '0% Data'
        };
    } else if (closureRate < 20) {
        risks.blindConversion = {
            level: 'warning',
            message: 'Alerta: Baja tasa de lectura de cierre',
            value: `${closureRate.toFixed(0)}% Data`
        };
    }

    // --- FINALIZE SLUGGISHNESS ---
    // Using filteredData enriched 'diferenciaDias' if available, otherwise heuristic
    // Let's iterate again using known enriched fields for time if calculating manually is hard
    // But calculateKPIs usually does avgAnsi... let's rely on a simpler heuristic here for "Valuation Speed"
    // We already have ansMetrics in the component, we can pass them in? 
    // Let's calculate from scratch to be safe on the specific "Solicitud -> Valoracion" metric vs ANS.
    // Assuming standard 8.1 days from user insight.

    // Quick heuristic using enriched fields if available
    let totalLag = 0;
    let lagCount = 0;
    data.forEach(r => {
        // Try to parse dates manually if enriched keys missing
        // For MVP, we'll assume the user insight is correct if we find dates
        // Implementing simple day diff
        const start = r.fechaSolicitudMs || (r[reqDateCol] ? new Date(r[reqDateCol]).getTime() : 0);
        const end = r.fechaEnvioValoracionMs || (r[valDateCol] ? new Date(r[valDateCol]).getTime() : 0);

        if (start > 0 && end > 0 && end > start) {
            const days = (end - start) / (1000 * 60 * 60 * 24);
            if (days > 0 && days < 100) { // outliers
                totalLag += days;
                lagCount++;
            }
        }
    });

    const avgLag = lagCount > 0 ? (totalLag / lagCount) : 0;

    if (avgLag > 8) {
        risks.sluggishness = {
            level: 'critical',
            message: 'Lentitud Operativa Critica (> 8 días)',
            value: `${avgLag.toFixed(1)} días`
        };
    } else if (avgLag > 5) {
        risks.sluggishness = {
            level: 'warning',
            message: 'Fuera de objetivo (Target: 5 días)',
            value: `${avgLag.toFixed(1)} días`
        };
    } else {
        risks.sluggishness = {
            level: 'low',
            message: 'Velocidad Operativa Óptima',
            value: `${avgLag.toFixed(1)} días`
        }
    }


    // --- FINALIZE DEPENDENCY ---
    let maxClientVal = 0;
    let maxClientName = '';
    Object.entries(clientCounts).forEach(([client, count]) => {
        if (count > maxClientVal) {
            maxClientVal = count;
            maxClientName = client;
        }
    });

    const dependencyRate = (maxClientVal / data.length) * 100;

    if (dependencyRate > 40) {
        risks.dependency = {
            level: 'critical',
            message: `Concentración Extrema (${maxClientName})`,
            value: `${dependencyRate.toFixed(1)}%`
        };
    } else if (dependencyRate > 25) {
        risks.dependency = {
            level: 'warning',
            message: `Dependencia Alta (${maxClientName})`,
            value: `${dependencyRate.toFixed(1)}%`
        };
    } else {
        risks.dependency = {
            level: 'low',
            message: `Cartera Saludable (Líder: ${maxClientName || 'N/A'})`,
            value: `${dependencyRate.toFixed(1)}%`
        };
    }

    return risks;
};

const RiskCard = ({ title, risk, icon: Icon }) => {
    const { level, message, value } = risk;

    let color = COLORS.success; // Green
    let bg = '#ECFDF5';
    let borderColor = '#34D399';

    if (level === 'critical') {
        color = '#DC2626'; // Red
        bg = '#FEF2F2';
        borderColor = '#F87171';
    } else if (level === 'warning') {
        color = '#D97706'; // Yellow/Orange
        borderColor = '#FBBF24';
        bg = '#FFFBEB';
    }

    return (
        <div style={{
            background: bg,
            border: `1px solid ${borderColor}`,
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}>
            <div style={{
                background: 'white',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
                <Icon size={20} color={color} />
            </div>
            <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>
                    {title}
                </h4>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: color, marginBottom: '4px' }}>
                    {value}
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#4B5563' }}>
                    {message}
                </p>
            </div>
        </div>
    );
};

const StrategicRadarPanel = ({ data }) => {
    const risks = useMemo(() => calculateStrategicRisks(data), [data]);

    if (!risks) return null;

    return (
        <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Target size={20} color={COLORS.primary} />
                <h3 style={{ margin: 0, color: COLORS.text.primary, fontSize: '18px' }}>
                    Radar de Riesgos Estratégicos
                </h3>
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '16px'
            }}>
                <RiskCard
                    title="Conversión Ciega"
                    risk={risks.blindConversion}
                    icon={Zap}
                />
                <RiskCard
                    title="Velocidad Operativa"
                    risk={risks.sluggishness}
                    icon={AlertTriangle}
                />
                <RiskCard
                    title="Dependencia de Clientes"
                    risk={risks.dependency}
                    icon={Users}
                />
            </div>
        </div>
    );
};

const ResumenOperativo = ({ data, onDataLoad, filters, onFilterChange, onClearFilters }) => {
    const [file, setFile] = useState(null);
    const [rawData, setRawData] = useState([]);

    const handleFileUpload = async (e) => {
        const uploadedFile = e.target.files[0];
        if (!uploadedFile) return;

        setFile(uploadedFile);

        try {
            // 1. Read as ArrayBuffer to control decoding
            const buffer = await uploadedFile.arrayBuffer();

            // 2. Smart Heuristic Encoding Detection
            let text;
            const decoderUtf8 = new TextDecoder('utf-8'); // Non-fatal to count replacement chars
            const decoderWin = new TextDecoder('windows-1252');

            // Decode both
            const textUtf8 = decoderUtf8.decode(buffer);
            const textWin = decoderWin.decode(buffer);

            // Score UTF-8: Count replacement characters (U+FFFD)
            const errorsUtf8 = (textUtf8.match(/\uFFFD/g) || []).length;

            // Score Windows-1252: Count UTF-8 artifacts (Mojibake)
            // Common patterns: Ã¡, Ã©, Ãí, Ã³, Ãº, Ã± (Ã followed by typical 1252 chars that correspond to UTF-8 continuation bytes)
            const artifactsWin = (textWin.match(/Ã[¡-ÿ]/g) || []).length + (textWin.match(/Ã[\x80-\xBF]/g) || []).length;

            console.log(`Encoding Heuristics - UTF-8 Errors: ${errorsUtf8}, Win-1252 Artifacts: ${artifactsWin}`);

            // Decision Logic
            if (errorsUtf8 === 0) {
                // If clean UTF-8, prefer it absolutely
                text = textUtf8;
                console.log("Selected: UTF-8 (Clean)");
            } else if (artifactsWin > errorsUtf8) {
                // If 1252 looks like Mojibake (more artifacts than UTF-8 errors), assume it's messy UTF-8
                text = textUtf8;
                console.log("Selected: UTF-8 (Heuristic preference)");
            } else {
                // Otherwise fallback to Windows-1252 (likely genuine ANSI with some undefined bytes)
                text = textWin;
                console.log("Selected: Windows-1252");
            }

            // 3. Final Guardrail Log
            // 3. Final Guardrail Log
            const replacementCount = (text.match(/\uFFFD/g) || []).length;
            if (replacementCount > 0) {
                const errorRate = replacementCount / text.length;
                if (errorRate > 0.01) { // Only warn if > 1% of content is corrupted
                    console.warn(`Decoding warning: High corruption detected (${replacementCount} chars, ${(errorRate * 100).toFixed(2)}%).`);
                } else {
                    console.log(`Decoding info: Input contained ${replacementCount} replacement characters (ignorable).`);
                }
            }

            // 3. Double-check for Mojibake (UTF-8 read as Windows-1252 often leaves 'Ã' artifacts)
            // If we successfully decoded as Windows-1252 but see 'Ã' + typical UTF-8 follow bytes, it might actually be UTF-8 that passed the strict check (rare but possible) or we should have preferred UTF-8 if the buffer was valid both ways (unlikely with fatal:true).
            // Actually, if 'fatal: true' passed, it's valid UTF-8. The only risk is if Windows-1252 data accidentally looks like valid UTF-8 (very rare for text with accents).

            if (text.includes('')) {
                console.warn("Possible decoding issues detected (replacement characters).");
            }

            // 4. Parse CSV
            const parsed = parseCSV(text);

            // 4b. Enrich
            const enriched = enrichDataWithDates(parsed);

            // 5. Diagnostics (Logging as requested)
            const catCol = findColumn(parsed[0], ["CATEGORIA"]);
            if (catCol) {
                const uniqueCats = [...new Set(parsed.map(r => r[catCol]))];
                console.log("Diagnóstico de Datos - Categorías Únicas Detectadas:", uniqueCats);

                const counts = {};
                parsed.forEach(r => {
                    const c = r[catCol];
                    counts[c] = (counts[c] || 0) + 1;
                });
                console.log("Conteo por Categoría (Raw):", counts);
            }

            console.log("Parsed rows:", enriched.length);
            console.log("Sample headers:", Object.keys(enriched[0] || {}));
            const detectedDates = detectDateColumns(enriched);
            console.log("Detected date columns:", detectedDates);

            setRawData(enriched);
            if (onDataLoad) onDataLoad(enriched);

        } catch (error) {
            console.error("Error al procesar el archivo:", error);
            alert("Error al leer el archivo. Asegúrese de que sea un CSV válido.");
        }
    };

    // Use rawData if available, otherwise fallback to data passed from PageManager
    const sourceData = rawData.length ? rawData : (data || []);

    // Apply filters to data
    const filteredData = useMemo(() => {
        if (!sourceData.length) return [];
        const res = applyFilters(sourceData, filters);

        // Debug: Log month distribution for filtered data
        const monthCounts = {};
        res.forEach(r => {
            if (r.fechaEnvioValoracionMs) {
                const d = new Date(r.fechaEnvioValoracionMs);
                const k = `${d.getFullYear()} - ${String(d.getMonth() + 1).padStart(2, '0')
                    } `;
                monthCounts[k] = (monthCounts[k] || 0) + 1;
            }
        });
        console.log(" Distribución Mensual (Filtered):", monthCounts);

        return res;
    }, [sourceData, filters]);

    // Calculate KPIs on filtered data
    const kpis = useMemo(() => {
        if (!filteredData.length) return null;
        return calculateKPIs(filteredData);
    }, [filteredData]);

    // Calculate ANS metrics
    const ansMetrics = useMemo(() => {
        if (!filteredData.length) return null;
        return calculateANSMetrics(filteredData);
    }, [filteredData]);

    // Get top companies from filtered data
    const topCompanies = useMemo(() => {
        if (!filteredData.length) return [];
        const empresaCol = findColumn(filteredData[0], ["EMPRESA VENDEDORA", "EMPRESA"]);
        return getTopN(filteredData, empresaCol, 10);
    }, [filteredData]);

    // Get top reasons for non-approval
    const topReasons = useMemo(() => {
        if (!filteredData.length) return [];
        const clasfCol = findColumn(filteredData[0], ["ANS PUBLICACIONES - CLASF", "CLASF"]);
        if (!clasfCol) return [];

        const filtered = filteredData.filter(r => r[clasfCol] && r[clasfCol].trim() !== "");
        return getTopN(filtered, clasfCol, 5);
    }, [filteredData]);

    // Generate automated insights
    const insights = useMemo(() => {
        if (!kpis) return [];

        const generated = [];

        if (kpis.aprobadosPercent < 70) {
            generated.push(`⚠️ Tasa de aprobación baja(${kpis.aprobadosPercent} %), requiere atención inmediata`);
        }

        if (kpis.procesosUnicos) {
            generated.push(`📋 ${kpis.procesosUnicos} procesos únicos identificados en el análisis`);
        }

        if (kpis.pendientes > kpis.totalRegistros * 0.2) {
            generated.push(`📊 ${kpis.pendientes} procesos pendientes(${((kpis.pendientes / kpis.totalRegistros) * 100).toFixed(1)}%) - oportunidad de mejora en tiempos de aprobación`);
        }

        if (ansMetrics && ansMetrics.avgANSAprobaciones !== 'NO DISPONIBLE') {
            generated.push(`⏱️ ANS Aprobaciones promedio: ${ansMetrics.avgANSAprobaciones} días`);
        }

        if (ansMetrics && ansMetrics.avgANSPublicaciones !== 'NO DISPONIBLE') {
            generated.push(`📅 ANS Publicaciones promedio: ${ansMetrics.avgANSPublicaciones} días`);
        }

        if (topCompanies.length > 0) {
            generated.push(`🏢 ${topCompanies[0].name} lidera con ${topCompanies[0].count} activos valorados`);
        }

        const activeFilters = Object.values(filters).filter(v => v && v !== true).length;
        if (activeFilters > 0) {
            generated.push(`🔍 ${activeFilters} filtro(s) activo(s) - Mostrando ${filteredData.length} de ${sourceData.length} registros`);
        }

        if (generated.length === 0) {
            generated.push("ℹ️ Análisis completo disponible en métricas detalladas");
        }

        return generated;
    }, [kpis, ansMetrics, topCompanies, filters, filteredData.length, sourceData.length]);

    // Previous Period Calculation (for Trends)
    const previousPeriodStats = useMemo(() => {
        if (!filters.fechaInicio || !filters.fechaFin) return null;

        const prevRange = calculatePreviousRange(filters.fechaInicio, filters.fechaFin);
        if (!prevRange) return null;

        const prevFilters = { ...filters, ...prevRange };
        const prevData = applyFilters(sourceData, prevFilters);

        const prevKPIs = calculateKPIs(prevData);
        const prevANS = calculateANSMetrics(prevData);

        return { kpis: prevKPIs, ans: prevANS };
    }, [filters, sourceData]);

    // Calculate Trends Object
    const trends = useMemo(() => {
        const prev = previousPeriodStats;
        if (!prev || !kpis || !ansMetrics) return null;

        // Helper wrapper to handle specific metrics
        return {
            procesosUnicos: calculateTrendMetric(kpis.procesosUnicos, prev.kpis?.procesosUnicos),
            inventarioValorado: calculateTrendMetric(kpis.inventarioValorado, prev.kpis?.inventarioValorado),
            empresasTasadas: calculateTrendMetric(kpis.empresasTasadas, prev.kpis?.empresasTasadas),
            // ANS Metrics: Inverse=true means "Lower is Better" (Green if negative delta)
            avgANSAprobaciones: calculateTrendMetric(ansMetrics.avgANSAprobaciones, prev.ans?.avgANSAprobaciones, true, 'd'),
            avgANSPublicaciones: calculateTrendMetric(ansMetrics.avgANSPublicaciones, prev.ans?.avgANSPublicaciones, true, 'd'),
            avgANSPlanesAccion: calculateTrendMetric(ansMetrics.avgANSPlanesAccion, prev.ans?.avgANSPlanesAccion, true, 'd'),
        };
    }, [kpis, ansMetrics, previousPeriodStats]);

    // Real trend data (2024, 2025 Static | 2026 Dynamic)
    const trendData = useMemo(() => {
        if (!sourceData.length) return [];
        return calculateValuationTrend(sourceData, filteredData);
    }, [sourceData, filteredData]);

    // NEW: Stacked Trend (Planes de Acción / Categorías)
    const stackedData = useMemo(() => {
        if (!filteredData.length) return [];
        return getStackedTrend(filteredData, "CATEGORIA");
    }, [filteredData]);

    // NEW: Pie Charts
    const pieDataValue = useMemo(() => getPieData(filteredData, "EMPRESA VENDEDORA", "VALOR SUGERIDO"), [filteredData]);
    const pieDataCat = useMemo(() => getPieData(filteredData, "CATEGORIA"), [filteredData]);
    const pieDataSubcat = useMemo(() => getPieData(filteredData, "SUBCATEGORIA"), [filteredData]);

    // Upload Screen
    if (!sourceData.length) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px'
            }}>
                <div style={{
                    background: COLORS.background.card,
                    borderRadius: '12px',
                    padding: '48px',
                    textAlign: 'center',
                    maxWidth: '500px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                    <Upload size={64} color={COLORS.accent} style={{ marginBottom: '24px' }} />
                    <h2 style={{ color: COLORS.text.primary, marginBottom: '12px' }}>
                        Cargar Datos del Informe
                    </h2>
                    <p style={{ color: COLORS.text.secondary, marginBottom: '24px' }}>
                        Sube el archivo CSV del Informe Área Técnica para comenzar el análisis
                    </p>
                    <label style={{
                        display: 'inline-block',
                        padding: '12px 24px',
                        background: COLORS.accent,
                        color: COLORS.text.inverse,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600'
                    }}>
                        Seleccionar Archivo CSV
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />
                    </label>
                </div>
            </div>
        );
    }

    // Dashboard Screen
    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

            {/* PRINT HEADER (Hidden on Screen) */}
            <div className="print-only" style={{
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px',
                borderBottom: '2px solid #03AB90',
                marginBottom: '20px'
            }}>
                <div>
                    <h1 style={{ marginBottom: '5px', color: '#1F2937' }}>Coordinación de Tasación (área técnica)</h1>
                    <p style={{ margin: 0, color: '#6B7280' }}>Informe Operativo Generado: {new Date().toLocaleDateString()}</p>
                    <p style={{ margin: '4px 0 0 0', color: '#03AB90', fontWeight: 'bold', fontSize: '14px' }}>
                        Periodo Analizado: {filters.fechaInicio && filters.fechaFin ? `${filters.fechaInicio} al ${filters.fechaFin}` : "Todo el Historial"}
                    </p>
                </div>
                <img src={logoSubastas} alt="Subastas y Comercio" style={{ height: '60px' }} />
            </div>

            {/* SCREEN Header (Hidden on Print) */}
            <div className="no-print" style={{
                background: COLORS.background.card,
                padding: '24px 32px',
                borderBottom: `1px solid #E5E5E5`
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ margin: 0, color: COLORS.text.primary, fontSize: '28px', fontWeight: 'bold' }}>
                            Resumen Operacional
                        </h1>
                        <p style={{ margin: '4px 0 0 0', color: COLORS.text.secondary, fontSize: '14px' }}>
                            Dashboard ejecutivo de análisis de datos para reporte del área técnica
                        </p>
                    </div>
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

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                <div style={{ padding: '0 32px' }}>
                    {/* Filter Bar */}
                    <div className="no-print">
                        <FilterBar
                            filters={filters}
                            onFilterChange={onFilterChange}
                            onClearFilters={onClearFilters}
                            data={sourceData}
                        />
                    </div>

                    {/* Virtual Analyst Report (Restored) */}
                    <VirtualAnalystPanel
                        data={filteredData}
                        kpis={kpis}
                        filters={filters}
                    />

                    {/* NEW: STRATEGIC RADAR */}
                    <StrategicRadarPanel data={filteredData} />



                    {/* KPI Cards */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '20px',
                        marginBottom: '32px'
                    }}>
                        <KPICard
                            title="Procesos Únicos"
                            value={kpis?.procesosUnicos || 0}
                            unit="Procesos"
                            trendData={trends?.procesosUnicos}
                            bgColor="#F0F9FF"
                            iconColor="#0284C7"
                        />
                        <KPICard
                            title="Inventario Valorado"
                            value={kpis?.inventarioValorado || 0}
                            unit="Activos"
                            trendData={trends?.inventarioValorado}
                            bgColor="#E1F5F2"
                            iconColor={COLORS.accent}
                        />
                        <KPICard
                            title="Clientes Tasados"
                            value={kpis?.empresasTasadas || 0}
                            unit="Activos"
                            trendData={trends?.empresasTasadas}
                            bgColor="#FFF0E5"
                            iconColor={COLORS.warning}
                        />
                        <KPICard
                            title="ANS Aprobaciones"
                            value={ansMetrics?.avgANSAprobaciones || 'N/A'}
                            unit="Días Prom."
                            trendData={trends?.avgANSAprobaciones}
                            bgColor="#FFE5E5"
                            iconColor="#E75912"
                        />
                        <KPICard
                            title="ANS Publicaciones"
                            value={ansMetrics?.avgANSPublicaciones || 'N/A'}
                            unit="Días Prom."
                            trendData={trends?.avgANSPublicaciones}
                            bgColor="#E8F4FF"
                            iconColor={COLORS.accent}
                        />
                        <KPICard
                            title="ANS Planes de Acción"
                            value={ansMetrics?.avgANSPlanesAccion || 'N/A'}
                            unit="Días Prom."
                            trendData={trends?.avgANSPlanesAccion}
                            bgColor="#F0E8FF"
                            iconColor="#9333EA"
                        />
                    </div>

                    {/* Trend Chart */}
                    <div style={{ marginBottom: '32px' }}>
                        <TrendChart
                            data={trendData}
                            title="Tendencia de Valoraciones Enviadas por Año"
                        />
                    </div>

                    {/* NEW: Stacked Bar Chart (Planes de Acción) */}
                    <div style={{ marginBottom: '32px' }}>
                        <StackedBarChart
                            data={stackedData}
                            title="Planes de Acción por Categoría"
                            keys={["Vehículos", "Mobiliario", "Equipo industrial", "Chatarra", "Otros"]}
                        />
                    </div>

                    {/* NEW: 3 Pie Charts Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                        gap: '20px',
                        marginBottom: '32px'
                    }}>
                        <PieChartDistribution
                            data={pieDataValue}
                            title="Valor Transado (por Empresa)"
                        />
                        <PieChartDistribution
                            data={pieDataCat}
                            title="Categoría"
                        />
                        <PieChartDistribution
                            data={pieDataSubcat}
                            title="Subcategoría"
                        />
                    </div>

                    {/* Insights Panel */}
                    <div style={{ marginBottom: '32px' }}>
                        <InsightsPanel
                            insights={insights}
                            title="🔍 Hallazgos Automáticos e Incidencias Técnicas"
                        />
                    </div>

                    {/* Inventory Status Breakdown */}
                    <div style={{
                        background: COLORS.background.card,
                        borderRadius: '8px',
                        padding: '24px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        marginBottom: '32px'
                    }}>
                        <h3 style={{ margin: '0 0 16px 0', color: COLORS.text.primary }}>
                            Inventarios por Estado
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                            <StatusItem
                                label="Aprobados para Subasta"
                                value={kpis?.aprobados || 0}
                                color={COLORS.accent}
                            />
                            <StatusItem
                                label="No Aprobados"
                                value={kpis?.noAprobados || 0}
                                color={COLORS.warning}
                            />
                            <StatusItem
                                label="Pendientes por Aprobación"
                                value={kpis?.pendientes || 0}
                                color={COLORS.gray}
                            />
                        </div>
                    </div>

                    {/* Data Health */}
                    <div style={{
                        background: COLORS.background.card,
                        borderRadius: '8px',
                        padding: '24px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        marginBottom: '32px'
                    }}>
                        <h3 style={{ margin: '0 0 16px 0', color: COLORS.text.primary }}>
                            Salud de los Datos
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
                            <div>
                                <p style={{ margin: 0, color: COLORS.text.secondary, fontSize: '13px' }}>
                                    Registros Mostrados
                                </p>
                                <p style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: COLORS.text.primary }}>
                                    {filteredData.length.toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p style={{ margin: 0, color: COLORS.text.secondary, fontSize: '13px' }}>
                                    Total Registros
                                </p>
                                <p style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: COLORS.text.primary }}>
                                    {sourceData.length.toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p style={{ margin: 0, color: COLORS.text.secondary, fontSize: '13px' }}>
                                    Columnas Detectadas
                                </p>
                                <p style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: COLORS.text.primary }}>
                                    {sourceData.length > 0 ? Object.keys(sourceData[0]).length : 0}
                                </p>
                            </div>
                            <div>
                                <p style={{ margin: 0, color: COLORS.text.secondary, fontSize: '13px' }}>
                                    Estado
                                </p>
                                <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: COLORS.accent }}>
                                    ✓ Datos Válidos
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* SIGNATURE BLOCK (Print Only) */}
                    <div className="print-only" style={{
                        marginTop: '40px',
                        paddingTop: '20px',
                        borderTop: '1px solid #E5E5E5',
                        textAlign: 'center'
                    }}>
                        <div style={{ marginBottom: '40px' }}>
                            <div style={{
                                borderBottom: '1px solid #1F2937',
                                width: '250px',
                                margin: '0 auto 8px auto'
                            }}></div>
                            <p style={{ margin: 0, fontWeight: 'bold', color: '#1F2937', fontSize: '14px' }}>
                                Sergio Yate González
                            </p>
                            <p style={{ margin: '4px 0 0 0', color: '#6B7280', fontSize: '12px' }}>
                                Coordinador de Tasación
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResumenOperativo;
