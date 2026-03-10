import React, { useMemo } from 'react';
import { generateTechnicalReport } from '../services/analysisEngine';
import { COLORS } from '../constants/colors';
import { FileText, AlertTriangle, TrendingUp, CheckCircle, Info, BrainCircuit } from 'lucide-react';

const VirtualAnalystPanel = ({ data, kpis, filters }) => {

    // Generate Report on data change
    const report = useMemo(() => {
        if (!data || data.length === 0) return null;
        return generateTechnicalReport(data, kpis, filters);
    }, [data, kpis, filters]);

    if (!report) return null;

    const { meta, executiveSummary, deepDive } = report;

    return (
        <div style={{
            background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)', // Premium dark gradient
            borderRadius: '12px',
            padding: '24px',
            color: 'white',
            marginBottom: '32px',
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: COLORS.accent, padding: '8px', borderRadius: '8px' }}>
                        <BrainCircuit size={24} color="white" />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Analista Virtual TechOps</h2>
                        <span style={{ fontSize: '12px', opacity: 0.7 }}>Reporte Generado: {meta.dateGenerated} | {meta.analyst}</span>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background: executiveSummary.status === 'OPTIMAL' ? 'rgba(3, 171, 144, 0.2)' : 'rgba(231, 89, 18, 0.2)',
                        color: executiveSummary.status === 'OPTIMAL' ? '#03AB90' : '#E75912',
                        fontWeight: 'bold',
                        fontSize: '12px'
                    }}>
                        {executiveSummary.status === 'OPTIMAL' ? 'OPERACIÓN SALUDABLE' : 'REQUIERE ATENCIÓN'}
                    </span>
                </div>
            </div>

            {/* Executive Summary & Market Context */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>

                {/* Highlights */}
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                    <h3 style={{ fontSize: '14px', color: COLORS.accent, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={16} /> Resumen Ejecutivo
                    </h3>
                    <p style={{ fontSize: '16px', fontWeight: '500', lineHeight: '1.5', margin: 0 }}>
                        {executiveSummary.headline}
                    </p>
                    <p style={{ marginTop: '8px', opacity: 0.7, fontSize: '13px' }}>
                        Se han procesado <strong>{executiveSummary.keyMetric}</strong> en el periodo seleccionado.
                    </p>
                </div>

                {/* Market Context (Knowledge Base) */}
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                    <h3 style={{ fontSize: '14px', color: '#60a5fa', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Info size={16} /> Contexto de Mercado (Estacional)
                    </h3>
                    {meta.periodContext ? (
                        <>
                            <p style={{ fontSize: '13px', lineHeight: '1.5', margin: '0 0 8px 0' }}>
                                <strong>Contexto:</strong> {meta.periodContext.context}
                            </p>
                            <p style={{ fontSize: '13px', lineHeight: '1.5', margin: 0 }}>
                                <strong>Tendencia Global:</strong> {meta.periodContext.trend}
                            </p>
                        </>
                    ) : (
                        <p style={{ fontSize: '13px', opacity: 0.5 }}>Información estacional no disponible para este periodo.</p>
                    )}
                </div>
            </div>

            {/* Deep Dive Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>

                {/* 1. Growth Loop Blockers */}
                <div>
                    <h3 style={{ fontSize: '15px', marginBottom: '16px', borderLeft: `3px solid ${COLORS.warning}`, paddingLeft: '8px' }}>
                        🚫 Bloqueantes del Growth Loop
                    </h3>
                    {deepDive.blockers.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {deepDive.blockers.map((b, i) => (
                                <div key={i} style={{ background: 'rgba(231, 89, 18, 0.1)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(231, 89, 18, 0.2)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: COLORS.warning }}>{b.type}</span>
                                        <span style={{ fontSize: '11px', opacity: 0.7 }}>Impacto: {b.impact}</span>
                                    </div>
                                    <p style={{ fontSize: '13px', margin: 0 }}>{b.observation}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '16px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                            <CheckCircle size={20} color={COLORS.accent} style={{ marginBottom: '8px' }} />
                            <p style={{ fontSize: '13px', opacity: 0.7, margin: 0 }}>No se detectan bloqueos críticos.</p>
                        </div>
                    )}
                </div>

                {/* 2. Top Rejection Reasons */}
                <div>
                    <h3 style={{ fontSize: '15px', marginBottom: '16px', borderLeft: `3px solid #ef4444`, paddingLeft: '8px' }}>
                        📉 Principales Razones de Rechazo
                    </h3>
                    {deepDive.topRejections.length > 0 ? (
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '8px' }}>
                            {deepDive.topRejections.map((r, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: i < deepDive.topRejections.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                    <span style={{ fontSize: '13px' }}>{i + 1}. {r.reason}</span>
                                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{r.count}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ fontSize: '13px', opacity: 0.5 }}>Insuficientes datos de rechazo para análisis.</p>
                    )}
                </div>

                {/* 3. Proposed Adjustments */}
                <div>
                    <h3 style={{ fontSize: '15px', marginBottom: '16px', borderLeft: `3px solid ${COLORS.accent}`, paddingLeft: '8px' }}>
                        💡 Ajustes Sugeridos
                    </h3>
                    {deepDive.proposedAdjustments.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6', color: 'rgba(255,255,255,0.9)' }}>
                            {deepDive.proposedAdjustments.map((adj, i) => (
                                <li key={i} style={{ marginBottom: '8px' }}>{adj}</li>
                            ))}
                            <li style={{ opacity: 0.7, fontStyle: 'italic' }}>Revisar alineación de precios con tendencias Q{Math.floor(new Date().getMonth() / 3) + 1}.</li>
                        </ul>
                    ) : (
                        <p style={{ fontSize: '13px', opacity: 0.7 }}>Mantener estrategia actual. Monitorear KPIs semanalmente.</p>
                    )}
                </div>

            </div>
        </div>
    );
};

export default VirtualAnalystPanel;
