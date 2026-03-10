/**
 * Analysis Engine - "Virtual Analyst" logic
 * Emulates a Data Engineer's analysis using deterministic rules and heuristics.
 */

import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// 1. KNOWLEDGE BASE (Static Market Context)
// Simulates external market knowledge based on common auction/fleet seasonalities.
const MARKET_KNOWLEDGE_BASE = {
    '0': { // Enero
        context: "Enero suele presentar un repunte en la oferta de activos por renovaciones de flota anuales. La demanda puede ser cautelosa al inicio.",
        trend: "Alta rotación de inventario post-cierre fiscal."
    },
    '1': { // Febrero
        context: "Febrero estabiliza el flujo de subastas. Históricamente, se observa mayor tracción en maquinaria amarilla y transporte pesado.",
        trend: "Demanda creciente en sector construcción."
    },
    '2': { // Marzo
        context: "Cierre de Q1. Las empresas buscan liquidar activos improductivos antes del corte trimestral.",
        trend: "Pico de volumen en activos corporativos."
    },
    '3': { // Abril
        context: "Inicio de Q2. Mercado influenciado por dinámicas fiscales. Buen momento para subastas de vehículos livianos.",
        trend: "Estabilidad en precios de cierre."
    },
    '4': { // Mayo
        context: "Mes de transición. Se suelen activar lotes de chatarra industrial y excedentes de manufactura.",
        trend: "Oportunidad en nichos industriales."
    },
    '5': { // Junio
        context: "Cierre de Semestre (H1). Alto volumen de activos por ajustes de inventario de medio año.",
        trend: "Volumen alto, competencia en precios."
    },
    '6': { // Julio
        context: "Inicio de H2. El mercado suele reactivarse tras las vacaciones de mitad de año.",
        trend: "Recuperación de indicadores de liquidez."
    },
    '7': { // Agosto
        context: "Mes fuerte para maquinaria agrícola y transporte de carga por estacionalidad de cosechas en algunas regiones.",
        trend: "Demanda sectorial específica."
    },
    '8': { // Septiembre
        context: "Cierre de Q3. Preparación para la recta final del año. Se prioriza la liquidez.",
        trend: "Aceleración en tiempos de venta."
    },
    '9': { // Octubre
        context: "Inicio de Q4. Las empresas inician su plan de desinversión anual agresivo.",
        trend: "Alto volumen de oferta, precios competitivos."
    },
    '10': { // Noviembre
        context: "Pico histórico en subastas. Las flotas grandes liberan unidades masivamente para renovación.",
        trend: "Máxima oferta del año."
    },
    '11': { // Diciembre
        context: "Cierre de año. Enfoque en limpieza total de libros. Subastas rápidas y liquidaciones.",
        trend: "Velocidad de venta crítica."
    }
};

// 2. GROWTH LOOP BLOCKERS (Bottleneck Detection)
export const analyzeGrowthBlockers = (data, kpis) => {
    const blockers = [];
    if (!kpis) return blockers;

    // Rule 1: High Rejection Rate (>15%)
    const rejectionRate = kpis.totalRegistros > 0
        ? (kpis.noAprobados / kpis.totalRegistros) * 100
        : 0;

    if (rejectionRate > 15) {
        blockers.push({
            type: "Calidad de Entrada",
            impact: "Alto",
            observation: `Tasa de rechazo del ${rejectionRate.toFixed(1)}% supera el umbral saludable (10%).`,
            recommendation: "Revisar criterios de pre-selección de activos antes de enviarlos a valoración."
        });
    }

    // Rule 2: Slow Valuation Time (>5 days)
    const avgTime = parseFloat(kpis.tiempoPromedioValoracion);
    if (!isNaN(avgTime) && avgTime > 5) {
        blockers.push({
            type: "Eficiencia Operativa",
            impact: "Medio",
            observation: `Tiempo promedio de valoración (${avgTime} días) ralentiza el ciclo de venta.`,
            recommendation: "Asignar recursos adicionales o automatizar la carga de fotos para agilizar el proceso."
        });
    }

    // Rule 3: High Pending Volume (>20%)
    const pendingRate = kpis.totalRegistros > 0
        ? (kpis.pendientes / kpis.totalRegistros) * 100
        : 0;

    if (pendingRate > 20) {
        blockers.push({
            type: "Cuello de Botella",
            impact: "Crítico",
            observation: `El ${pendingRate.toFixed(1)}% del inventario está en 'Pendiente'.`,
            recommendation: "Escalar tickets pendientes con más de 7 días de antigüedad."
        });
    }

    return blockers;
};

// 3. REJECTION ANALYSIS (Top Reasons)
export const analyzeRejectionReasons = (data) => {
    // Heuristic: Search in "OBSERVACIONES" or "MOTIVO RECHAZO" columns
    // We assume dataEngine generic findColumn might not be precise enough for specific text analysis,
    // so we iterate specifically looking for keywords.

    const reasonsMap = {};
    const keywords = {
        'FOTO': 'Falta de Fotos / Calidad',
        'DOCUMENT': 'Documentación Incompleta',
        'PRECIO': 'Precio Fuera de Mercado',
        'DAÑO': 'Daños Reportados / Estado',
        'SIN MOTOR': 'Faltantes Mecánicos',
        'BAJA': 'Trámite de Baja Pendiente'
    };

    // Find likely observation column
    const obsCol = Object.keys(data[0] || {}).find(k => k.match(/OBSERV|NOTA|COMENTARIO/i));

    if (!obsCol) return [];

    data.forEach(row => {
        const text = (row[obsCol] || "").toUpperCase();
        if (text.length < 5) return; // Ignore empty/short

        let matched = false;
        for (const [key, label] of Object.entries(keywords)) {
            if (text.includes(key)) {
                reasonsMap[label] = (reasonsMap[label] || 0) + 1;
                matched = true;
                break; // One reason per row
            }
        }
        if (!matched && (text.includes("NO APROB") || text.includes("RECHAZ"))) {
            reasonsMap['Otros Motivos Técnicos'] = (reasonsMap['Otros Motivos Técnicos'] || 0) + 1;
        }
    });

    return Object.entries(reasonsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count }));
};

// 4. MAIN GENERATOR FUNCTION
export const generateTechnicalReport = (data, kpis, filters) => {
    if (!data || data.length === 0) return null;

    // Detect Context (Month of Analysis)
    // If date filters exist, use start date month. If not, use current month or data mode.
    let reportMonth = new Date().getMonth(); // Default current
    if (filters.fechaInicio) {
        reportMonth = new Date(filters.fechaInicio).getMonth(); // UTC parsing is fine for month index estimate
    }

    const marketContext = MARKET_KNOWLEDGE_BASE[String(reportMonth)];
    const blockers = analyzeGrowthBlockers(data, kpis);
    const topRejections = analyzeRejectionReasons(data);

    // Derived Metrics
    const conversionRate = kpis.aprobadosPercent;
    const isHealthy = conversionRate >= 90;

    return {
        meta: {
            dateGenerated: new Date().toLocaleDateString('es-CO'),
            analyst: "Virtual TechOps Analyst v1.0",
            periodContext: marketContext
        },
        executiveSummary: {
            status: isHealthy ? "OPTIMAL" : "NEEDS ATTENTION",
            headline: isHealthy
                ? `Operación saludable con una conversión del ${conversionRate}%`
                : `Se detectan fricciones operativas impactando la conversión (${conversionRate}%)`,
            keyMetric: `${kpis.inventarioValorado} Activos Valorados`
        },
        deepDive: {
            blockers,
            topRejections,
            proposedAdjustments: blockers.map(b => b.recommendation) // Auto-generated from blockers
        }
    };
};
