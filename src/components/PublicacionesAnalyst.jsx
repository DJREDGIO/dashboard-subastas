import React, { useMemo } from 'react';
import { TrendingUp, AlertTriangle, Zap, Award, BarChart2, DollarSign } from 'lucide-react';
import { COLORS } from '../constants/colors';

const formatCurrency = (value) => {
    if (!value) return '$ 0';
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(value);
};

const formatNumber = (value) => {
    if (!value) return '0';
    return new Intl.NumberFormat('es-CO').format(value);
};

const PublicacionesAnalyst = ({ aggregation, globalMetrics, processList, itemList }) => {

    const insights = useMemo(() => {
        if (!aggregation || aggregation.length === 0) return null;

        // 1. VALUE LEADER (Company)
        const valueLeader = aggregation.reduce((prev, current) => (prev.value > current.value) ? prev : current);
        const totalValue = globalMetrics.totalValue || 1;
        const valueShare = (valueLeader.value / totalValue) * 100;

        // 2. VOLUME LEADER (Company)
        const volumeLeader = aggregation.reduce((prev, current) => (prev.processCount > current.processCount) ? prev : current);

        // 3. EFFICIENCY ALERTS (High Republication Rate)
        const inefficient = aggregation
            .filter(a => a.processCount > 2)
            .sort((a, b) => b.repubRate - a.repubRate);
        const topInefficient = inefficient.length > 0 && inefficient[0].repubRate > 0 ? inefficient[0] : null;

        // 4. INVENTORY HIGHLIGHTS (Granular Item Level)
        let topValueItem = null;
        let topUnitItem = null;

        if (itemList && itemList.length > 0) {
            // LOT/ASSET with Max Value
            topValueItem = itemList.reduce((prev, current) => (prev.value > current.value) ? prev : current);

            // LOT/ASSET with Max Units
            topUnitItem = itemList.reduce((prev, current) => (prev.units > current.units) ? prev : current);
        } else if (processList && processList.length > 0) {
            // Fallback to Process Level if no granular items found
            topValueItem = processList.reduce((prev, current) => (prev.value > current.value) ? prev : current);
        }

        return {
            valueLeader,
            valueShare,
            volumeLeader,
            topInefficient,
            topValueItem,
            topUnitItem
        };
    }, [aggregation, globalMetrics, processList, itemList]);

    if (!insights) return null;

    return (
        <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)', // Very light green/white hint
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px',
            border: `1px solid ${COLORS.status.success}40`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ background: COLORS.status.success, padding: '6px', borderRadius: '6px' }}>
                    <Zap size={18} color="white" />
                </div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#166534' }}>
                    Inteligencia Comercial (IA)
                </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>

                {/* 1. MARKET LEADER */}
                <div style={{ background: 'rgba(255,255,255,0.8)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Award size={16} color={COLORS.primary} />
                        <span style={{ fontSize: '14px', fontWeight: '600', color: COLORS.text.secondary, textTransform: 'uppercase' }}>Líder del Mercado</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '16px', color: COLORS.dark }}>
                        <strong>{insights.valueLeader.name}</strong> domina con <strong>{formatCurrency(insights.valueLeader.value)}</strong>.
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: COLORS.text.secondary }}>
                        Representa el <strong>{insights.valueShare.toFixed(1)}%</strong> del valor total gestionado.
                    </p>
                </div>

                {/* 2. HIGHEST VALUE ASSET (Granular) */}
                {insights.topValueItem && (
                    <div style={{ background: 'rgba(255,255,255,0.8)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <DollarSign size={16} color={COLORS.accent} />
                            <span style={{ fontSize: '14px', fontWeight: '600', color: COLORS.text.secondary, textTransform: 'uppercase' }}>Activo de Mayor Valor</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '16px', color: COLORS.dark }}>
                            <strong>{insights.topValueItem.validationCode !== "N/A" ? `Lote ${insights.topValueItem.validationCode}` : `Proceso ${insights.topValueItem.processId}`}</strong>
                        </p>
                        <p style={{ margin: '4px 0 8px 0', fontSize: '12px', color: '#666', fontStyle: 'italic', lineHeight: '1.4' }}>
                            {insights.topValueItem.goods}
                        </p>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: COLORS.accent }}>
                            Valor Base: {formatCurrency(insights.topValueItem.value)}
                        </p>
                    </div>
                )}

                {/* 3. HIGHEST UNIT ASSET (Inventory Density) */}
                {insights.topUnitItem && (
                    <div style={{ background: 'rgba(255,255,255,0.8)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <BarChart2 size={16} color={COLORS.warning} />
                            <span style={{ fontSize: '14px', fontWeight: '600', color: COLORS.text.secondary, textTransform: 'uppercase' }}>Mayor Inventario</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '16px', color: COLORS.dark }}>
                            <strong>{insights.topUnitItem.validationCode !== "N/A" ? `Lote ${insights.topUnitItem.validationCode}` : `Proceso ${insights.topUnitItem.processId}`}</strong> tiene más items.
                        </p>
                        <p style={{ margin: '4px 0 8px 0', fontSize: '12px', color: '#666', fontStyle: 'italic', lineHeight: '1.4' }}>
                            {insights.topUnitItem.goods}
                        </p>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: COLORS.warning }}>
                            Contiene: <span style={{ fontSize: '18px' }}>{formatNumber(insights.topUnitItem.units)}</span> {insights.topUnitItem.unitMeasure ? insights.topUnitItem.unitMeasure.toLowerCase() : 'unidades'}
                        </p>
                    </div>
                )}

                {/* 4. EFFICIENCY WATCH */}
                {insights.topInefficient ? (
                    <div style={{ background: '#fff7ed', padding: '20px', borderRadius: '8px', border: '1px solid #ffedd5', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <AlertTriangle size={16} color={COLORS.warning} />
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#c2410c', textTransform: 'uppercase' }}>Oportunidad de Mejora</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '16px', color: '#9a3412' }}>
                            <strong>{insights.topInefficient.name}</strong> presenta una tasa de republicación del <strong>{insights.topInefficient.repubRate.toFixed(1)}%</strong>.
                        </p>
                    </div>
                ) : (
                    <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '8px', border: '1px solid #bbf7d0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <TrendingUp size={16} color={COLORS.status.success} />
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#166534', textTransform: 'uppercase' }}>Eficiencia Operativa</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '16px', color: '#166534' }}>
                            Excelente. No se detectan empresas con tasas críticas de republicación.
                        </p>
                    </div>
                )}

            </div>
        </div>
    );
};

export default PublicacionesAnalyst;
