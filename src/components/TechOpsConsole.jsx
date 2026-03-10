import React, { useState, useMemo, useEffect } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ComposedChart,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import {
    Upload,
    TrendingUp,
    AlertCircle,
    BrainCircuit,
    Loader2
} from "lucide-react";
import { generateContent } from "../services/gemini";

// Colores
const COLORS = {
    dark: "#192843",
    teal: "#03AB90",
    orange: "#E75912",
    red: "#DC2626",
};

const PIE_COLORS = ["#192843", "#03AB90", "#E75912", "#606060", "#2C4B7A", "#4FD1B8"];

// Helper: Buscar columna
const findCol = (row, patterns) => {
    const keys = Object.keys(row);
    for (const p of patterns) {
        const found = keys.find(k => k.toUpperCase().includes(p.toUpperCase()));
        if (found) return found;
    }
    return "";
};

// Parser CSV simple
const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];

    const sep = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));

    return lines.slice(1).map(line => {
        const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
        const row = {};
        headers.forEach((h, i) => row[h] = vals[i] || "");
        return row;
    });
};

// Parser fecha
const parseDate = (str) => {
    if (!str) return null;
    let d = new Date(str);
    if (isNaN(d.getTime())) {
        const parts = str.split(/[-/]/);
        if (parts.length === 3 && parts[2].length === 4) {
            d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
    }
    return isNaN(d.getTime()) ? null : d;
};

// Detectar columnas fecha
const detectDates = (data) => {
    if (!data.length) return [];
    return Object.keys(data[0]).filter(h => {
        const sample = data.slice(0, 10).filter(r => r[h]?.length > 6);
        if (!sample.length) return false;
        const valid = sample.filter(r => parseDate(r[h]));
        return valid.length / sample.length > 0.5;
    });
};

const formatDate = (d) => d.toISOString().split("T")[0];

// KPI Card
const KPICard = ({ title, value, prev, unit = "" }) => {
    const isNum = typeof value === "number" && typeof prev === "number";
    let trend = "flat", pct = 0;

    if (isNum && prev) {
        const delta = value - prev;
        pct = (delta / prev) * 100;
        trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    }

    const color = trend === "up" ? COLORS.teal : trend === "down" ? COLORS.orange : "#999";

    return (
        <div style={{
            background: "white",
            padding: "16px",
            borderRadius: "8px",
            borderLeft: `4px solid ${color}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px", textTransform: "uppercase" }}>
                {title}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                    <span style={{ fontSize: "24px", fontWeight: "bold", color: COLORS.dark }}>
                        {isNum ? value.toLocaleString() : value}
                    </span>
                    <span style={{ fontSize: "11px", color: "#999", marginLeft: "4px" }}>{unit}</span>
                </div>
                {isNum && prev > 0 && (
                    <div style={{ fontSize: "12px", color, fontWeight: "bold" }}>
                        {Math.abs(pct).toFixed(1)}%
                    </div>
                )}
            </div>
        </div>
    );
};

// Main App
export default function TechOpsConsole() {
    const [rawData, setRawData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dateCols, setDateCols] = useState([]);
    const [baseCol, setBaseCol] = useState("");
    const [dateRange, setDateRange] = useState({ start: "", end: "" });
    const [company, setCompany] = useState("TODAS");

    // AI State
    const [aiAnalysis, setAiAnalysis] = useState("");
    const [analyzing, setAnalyzing] = useState(false);
    const [tempKey, setTempKey] = useState("");

    const handleUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();

        reader.onload = (evt) => {
            try {
                const text = evt.target.result;
                const parsed = parseCSV(text);

                if (!parsed.length) {
                    alert("No se encontraron datos en el CSV");
                    setLoading(false);
                    return;
                }

                const dates = detectDates(parsed);
                setDateCols(dates);

                const defCol = dates.find(d => d.includes("PUBLICACION")) || dates[0] || "";
                setBaseCol(defCol);

                const processed = parsed.map((row, i) => ({
                    ...row,
                    _id: `${row[findCol(row, ["PROCESO"])] || i}`,
                    _date: null,
                    _valid: false
                }));

                setRawData(processed);
                setLoading(false);
            } catch (err) {
                alert("Error al leer CSV: " + err.message);
                setLoading(false);
            }
        };

        reader.onerror = () => {
            alert("Error al leer el archivo");
            setLoading(false);
        };

        reader.readAsText(file, "ISO-8859-1");
    };

    const dataWithDates = useMemo(() => {
        if (!baseCol || !rawData.length) return rawData.map(r => ({ ...r, _date: new Date(), _valid: true }));

        return rawData.map(row => {
            const d = parseDate(row[baseCol]);
            return {
                ...row,
                _date: d || new Date(),
                _valid: !!d,
                _month: d ? `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}` : ""
            };
        }).filter(r => r._valid);
    }, [rawData, baseCol]);

    useEffect(() => {
        if (dataWithDates.length && !dateRange.start) {
            const dates = dataWithDates.map(d => d._date.getTime());
            setDateRange({
                start: formatDate(new Date(Math.min(...dates))),
                end: formatDate(new Date(Math.max(...dates)))
            });
        }
    }, [dataWithDates]);

    const filtered = useMemo(() => {
        if (!dateRange.start) return dataWithDates;

        const start = new Date(dateRange.start).getTime();
        const end = new Date(dateRange.end).getTime();

        return dataWithDates.filter(r => {
            const d = r._date.getTime();
            const empCol = findCol(r, ["EMPRESA"]);
            const emp = r[empCol] || "";

            return d >= start && d <= end && (company === "TODAS" || emp === company);
        });
    }, [dataWithDates, dateRange, company]);

    const getTime = (r) => {
        const ansCol = findCol(r, ["ANS PLAN", "ANS"]);
        if (ansCol && r[ansCol]) {
            const match = String(r[ansCol]).match(/(\d+\.?\d*)/);
            if (match) return parseFloat(match[0]);
        }
        return null;
    };

    const sla = useMemo(() => {
        let stable = 0, critical = 0;
        const list = [];

        filtered.forEach(r => {
            const time = getTime(r);
            if (time !== null) {
                if (time > 5) {
                    critical++;
                    list.push({
                        id: r[findCol(r, ["PROCESO"])] || "N/A",
                        company: r[findCol(r, ["EMPRESA"])] || "N/A",
                        time
                    });
                } else {
                    stable++;
                }
            }
        });

        return { stable, critical, list: list.slice(0, 10) };
    }, [filtered]);

    const kpis = useMemo(() => {
        const inv = new Set(filtered.map(r => r._id)).size;
        const proc = new Set(filtered.map(r => r[findCol(r, ["PROCESO"])])).size;
        const comp = new Set(filtered.map(r => r[findCol(r, ["EMPRESA"])])).size;

        let totalTime = 0, count = 0;
        filtered.forEach(r => {
            const t = getTime(r);
            if (t) { totalTime += t; count++; }
        });

        return {
            inv,
            proc,
            comp,
            avgTime: count ? totalTime / count : 0
        };
    }, [filtered]);

    const distrib = useMemo(() => {
        const counts = {};
        filtered.forEach(r => {
            const cat = r[findCol(r, ["CATEGORIA"])] || "SIN CLASIFICAR";
            counts[cat] = (counts[cat] || 0) + 1;
        });

        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [filtered]);

    const trend = useMemo(() => {
        const grouped = {};

        filtered.forEach(r => {
            const key = r._month || "2024-01";
            if (!grouped[key]) grouped[key] = { count: 0, timeSum: 0, timeCount: 0 };
            grouped[key].count++;

            const t = getTime(r);
            if (t) {
                grouped[key].timeSum += t;
                grouped[key].timeCount++;
            }
        });

        return Object.keys(grouped).sort().map(k => ({
            period: k,
            Inventario: grouped[k].count,
            TiempoPromedio: grouped[k].timeCount ? grouped[k].timeSum / grouped[k].timeCount : 0
        }));
    }, [filtered]);

    // Función para analizar con Gemini
    const handleAnalyze = async () => {
        if (analyzing) return;
        setAnalyzing(true);
        setAiAnalysis("Generando análisis con IA...");

        try {
            // Contexto para la IA
            const context = `
                Actúa como experto en Operaciones y Logística. Analiza estos KPIs:
                - Tiempo Promedio: ${kpis.avgTime.toFixed(1)} días
                - Casos Críticos (>5 días): ${sla.critical}
                - Total Procesos: ${kpis.proc}
                - Tendencia Mensual: ${JSON.stringify(trend)}
                
                Provee:
                1. Diagnóstico breve de la situación actual.
                2. Identificación de cuellos de botella.
                3. 3 Recomendaciones accionables para reducir el tiempo de atención.
                
                Usa el formato: negritas para puntos clave y listas para recomendaciones. Sé directo y profesional.
            `;

            const result = await generateContent(context, null, tempKey);
            setAiAnalysis(result);

        } catch (error) {
            console.error(error);
            setAiAnalysis(`Error inesperado: ${error.message}`);
        } finally {
            setAnalyzing(false);
        }
    };

    if (!rawData.length) {
        return (
            <div style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: COLORS.dark,
                color: "white",
                padding: "24px"
            }}>
                <div style={{ maxWidth: "500px", textAlign: "center" }}>
                    <TrendingUp size={64} style={{ color: COLORS.teal, margin: "0 auto 24px" }} />
                    <h1 style={{ fontSize: "28px", marginBottom: "16px" }}>Dashboard Gerencial</h1>
                    <p style={{ marginBottom: "32px", color: "#ccc" }}>
                        Sube el archivo CSV para comenzar
                    </p>

                    <label style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        padding: "32px",
                        border: `2px dashed ${COLORS.teal}`,
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "all 0.2s"
                    }}>
                        <Upload size={32} style={{ color: COLORS.teal, marginBottom: "16px" }} />
                        <span>Click para cargar CSV</span>
                        <input type="file" accept=".csv" onChange={handleUpload} style={{ display: "none" }} />
                    </label>

                    {loading && <p style={{ marginTop: "16px", color: COLORS.orange }}>Procesando...</p>}
                </div>
            </div>
        );
    }

    const companies = [...new Set(rawData.map(r => r[findCol(r, ["EMPRESA"])] || ""))].filter(Boolean).sort();

    return (
        <div style={{ minHeight: "100vh", background: "#f5f5f5", display: "flex" }}>
            {/* Sidebar */}
            <div style={{
                width: "240px",
                background: COLORS.dark,
                color: "white",
                padding: "24px",
                flexShrink: 0
            }}>
                <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>Gerencia Técnica</h2>
                <p style={{ fontSize: "12px", color: "#999" }}>Informe Operativo</p>

                <div style={{ marginTop: "32px", fontSize: "12px" }}>
                    <div style={{ color: "#999", marginBottom: "8px" }}>DATOS</div>
                    <div>Registros: {rawData.length}</div>
                    <div>Filtrados: {filtered.length}</div>
                </div>

                <div style={{ marginTop: "32px" }}>
                    <div style={{ marginBottom: "16px" }}>
                        <label style={{ fontSize: "11px", color: "#ccc", display: "block", marginBottom: "4px" }}>
                            Probar Nueva API Key (Opcional)
                        </label>
                        <input
                            type="password"
                            placeholder="Pegar API Key aquí..."
                            onChange={e => setTempKey(e.target.value)}
                            value={tempKey}
                            style={{
                                width: "100%",
                                padding: "8px",
                                background: "rgba(255,255,255,0.1)",
                                border: "1px solid rgba(255,255,255,0.2)",
                                borderRadius: "4px",
                                color: "white",
                                fontSize: "12px"
                            }}
                        />
                    </div>

                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        style={{
                            background: COLORS.teal,
                            color: "white",
                            border: "none",
                            padding: "12px",
                            borderRadius: "6px",
                            width: "100%",
                            cursor: analyzing ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            opacity: analyzing ? 0.7 : 1
                        }}
                    >
                        {analyzing ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
                        {analyzing ? "Verificar Key" : "Probar API Key"}
                    </button>

                    <div style={{ marginTop: "12px", fontSize: "10px", color: "#666", textAlign: "center" }}>
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.teal, textDecoration: 'underline' }}>
                            Obtener Key en Google AI Studio
                        </a>
                    </div>
                </div>
            </div>

            {/* Main */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Header */}
                <div style={{ background: "white", padding: "16px", borderBottom: "1px solid #e5e5e5" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                        <h1 style={{ fontSize: "24px", fontWeight: "bold", color: COLORS.dark }}>
                            Tablero de Control
                        </h1>

                        <div style={{ display: "flex", gap: "8px" }}>
                            <button
                                onClick={() => {
                                    setCompany("TODAS");
                                    if (dataWithDates.length) {
                                        const dates = dataWithDates.map(d => d._date.getTime());
                                        setDateRange({
                                            start: formatDate(new Date(Math.min(...dates))),
                                            end: formatDate(new Date(Math.max(...dates)))
                                        });
                                    }
                                }}
                                style={{
                                    padding: "8px 16px",
                                    background: COLORS.orange,
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    fontWeight: "500"
                                }}
                            >
                                Restaurar Filtros
                            </button>

                            <button
                                onClick={() => {
                                    setRawData([]);
                                    setDateCols([]);
                                    setBaseCol("");
                                    setDateRange({ start: "", end: "" });
                                    setCompany("TODAS");
                                    setAiAnalysis("");
                                }}
                                style={{
                                    padding: "8px 16px",
                                    background: COLORS.dark,
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    fontWeight: "500"
                                }}
                            >
                                Cargar Nuevo Archivo
                            </button>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
                        {dateCols.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <label style={{ fontSize: "12px", fontWeight: "600", color: COLORS.dark }}>
                                    Columna de Fecha
                                </label>
                                <select
                                    value={baseCol}
                                    onChange={e => setBaseCol(e.target.value)}
                                    style={{
                                        padding: "8px",
                                        border: "1px solid #ccc",
                                        borderRadius: "4px",
                                        fontSize: "14px",
                                        color: "#1a1a1a"
                                    }}
                                >
                                    {dateCols.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        )}

                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <label style={{ fontSize: "12px", fontWeight: "600", color: COLORS.dark }}>
                                Empresa
                            </label>
                            <select
                                value={company}
                                onChange={e => setCompany(e.target.value)}
                                style={{
                                    padding: "8px",
                                    border: "1px solid #ccc",
                                    borderRadius: "4px",
                                    fontSize: "14px",
                                    color: "#1a1a1a"
                                }}
                            >
                                <option value="TODAS">Todas las Empresas</option>
                                {companies.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {baseCol && (
                            <>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                    <label style={{ fontSize: "12px", fontWeight: "600", color: COLORS.dark }}>
                                        Fecha Inicio
                                    </label>
                                    <input
                                        type="date"
                                        value={dateRange.start}
                                        onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))}
                                        style={{
                                            padding: "8px",
                                            border: "1px solid #ccc",
                                            borderRadius: "4px",
                                            fontSize: "14px",
                                            color: "#1a1a1a"
                                        }}
                                    />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                    <label style={{ fontSize: "12px", fontWeight: "600", color: COLORS.dark }}>
                                        Fecha Fin
                                    </label>
                                    <input
                                        type="date"
                                        value={dateRange.end}
                                        onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))}
                                        style={{
                                            padding: "8px",
                                            border: "1px solid #ccc",
                                            borderRadius: "4px",
                                            fontSize: "14px",
                                            color: "#1a1a1a"
                                        }}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>

                    {/* AI Analysis Result */}
                    {aiAnalysis && (
                        <div style={{
                            marginBottom: "24px",
                            padding: "20px",
                            background: "#f0fdfa",
                            border: `1px solid ${COLORS.teal}`,
                            borderRadius: "8px",
                            whiteSpace: "pre-line"
                        }}>
                            <h3 style={{ color: COLORS.teal, fontWeight: "bold", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <BrainCircuit size={20} /> Análisis de IA
                            </h3>
                            <div style={{ lineHeight: "1.6", color: "#374151" }}>
                                {aiAnalysis}
                            </div>
                        </div>
                    )}

                    {filtered.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "64px", color: "#999" }}>
                            <AlertCircle size={48} style={{ margin: "0 auto 16px" }} />
                            <p>No hay datos para mostrar con los filtros actuales</p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                            {/* KPIs */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                                <KPICard title="Inventario" value={kpis.inv} prev={0} unit="activos" />
                                <KPICard title="Procesos" value={kpis.proc} prev={0} />
                                <KPICard title="Empresas" value={kpis.comp} prev={0} />
                                <KPICard title="Tiempo Promedio" value={kpis.avgTime} prev={0} unit="días" />

                                <div style={{
                                    background: "white",
                                    padding: "16px",
                                    borderRadius: "8px",
                                    borderLeft: `4px solid ${COLORS.dark}`,
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                                }}>
                                    <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>ANS (5 días)</div>
                                    <div style={{ display: "flex", justifyContent: "space-around", fontSize: "12px" }}>
                                        <div style={{ textAlign: "center" }}>
                                            <div style={{ fontSize: "20px", fontWeight: "bold", color: COLORS.teal }}>{sla.stable}</div>
                                            <div>OK</div>
                                        </div>
                                        <div style={{ textAlign: "center" }}>
                                            <div style={{ fontSize: "20px", fontWeight: "bold", color: COLORS.red }}>{sla.critical}</div>
                                            <div>Críticos</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Charts */}
                            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
                                <div style={{ background: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                                    <h3 style={{ marginBottom: "16px", fontSize: "16px", fontWeight: "bold" }}>Tendencia</h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <ComposedChart data={trend}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                                            <YAxis yAxisId="left" />
                                            <YAxis yAxisId="right" orientation="right" />
                                            <Tooltip />
                                            <Legend />
                                            <Bar yAxisId="left" dataKey="Inventario" fill={COLORS.dark} />
                                            <Bar yAxisId="right" dataKey="TiempoPromedio" fill={COLORS.orange} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>

                                <div style={{ background: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                                    <h3 style={{ marginBottom: "16px", fontSize: "16px", fontWeight: "bold" }}>Por Categoría</h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie data={distrib} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                                                {distrib.map((e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Table */}
                            {sla.critical > 0 && (
                                <div style={{ background: "white", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                                    <div style={{ padding: "16px", background: "#fef2f2", borderBottom: "1px solid #fecaca" }}>
                                        <h3 style={{ fontSize: "16px", fontWeight: "bold", color: COLORS.red }}>
                                            Procesos Fuera de ANS ({sla.critical})
                                        </h3>
                                    </div>
                                    <div style={{ overflow: "auto", maxHeight: "300px" }}>
                                        <table style={{ width: "100%", fontSize: "13px" }}>
                                            <thead style={{ background: "#f9fafb", position: "sticky", top: 0 }}>
                                                <tr>
                                                    <th style={{ padding: "12px", textAlign: "left" }}>Proceso</th>
                                                    <th style={{ padding: "12px", textAlign: "left" }}>Empresa</th>
                                                    <th style={{ padding: "12px", textAlign: "right" }}>Días</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sla.list.map((item, i) => (
                                                    <tr key={i} style={{ borderTop: "1px solid #f0f0f0" }}>
                                                        <td style={{ padding: "12px" }}>{item.id}</td>
                                                        <td style={{ padding: "12px" }}>{item.company}</td>
                                                        <td style={{ padding: "12px", textAlign: "right" }}>
                                                            <span style={{
                                                                background: "#fee",
                                                                color: COLORS.red,
                                                                padding: "4px 8px",
                                                                borderRadius: "4px",
                                                                fontSize: "12px"
                                                            }}>
                                                                {item.time.toFixed(1)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
