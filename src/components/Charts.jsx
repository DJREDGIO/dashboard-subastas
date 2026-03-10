import React from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, PieChart, Pie, Cell, LabelList } from 'recharts';
import { COLORS } from '../constants/colors';

// Trend Chart Component for time series data
export const TrendChart = ({ data, title }) => {
    return (
        <div className="chart-container" style={{
            background: COLORS.background.card,
            borderRadius: '8px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
            <h3 style={{ margin: '0 0 20px 0', color: COLORS.text.primary, fontSize: '18px' }}>
                {title}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={data}>
                    <defs>
                        <linearGradient id="color2024" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="color2025" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.6} />
                            <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                    <XAxis dataKey="name" stroke={COLORS.text.secondary} />
                    <YAxis stroke={COLORS.text.secondary} />
                    <Tooltip
                        contentStyle={{
                            background: COLORS.background.card,
                            border: `1px solid ${COLORS.accent}`,
                            borderRadius: '6px'
                        }}
                    />
                    <Legend />

                    {/* 2024 Background Trend */}
                    <Area
                        type="monotone"
                        dataKey="2024"
                        stroke="#94A3B8"
                        fill="url(#color2024)"
                        name="2024 (Histórico)"
                        strokeWidth={1}
                        fillOpacity={0.3}
                    />

                    {/* 2025 Main Context */}
                    <Area
                        type="monotone"
                        dataKey="2025"
                        stroke={COLORS.primary}
                        fill="url(#color2025)"
                        name="2025 (Referencia)"
                        strokeWidth={2}
                        fillOpacity={0.4}
                    />

                    {/* 2026 Active Trend */}
                    <Line
                        type="monotone"
                        dataKey="2026"
                        stroke={COLORS.accent} /* Green/Teal Highlight */
                        name="2026 (Tendencia Actual)"
                        strokeWidth={4}
                        dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                        activeDot={{ r: 8 }}
                        connectNulls={true}
                    >
                        <LabelList dataKey="2026" position="top" offset={10} style={{ fill: COLORS.accent, fontWeight: 'bold' }} />
                    </Line>
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

// Top Companies Bar Chart
export const TopCompaniesChart = ({ data, title }) => {
    return (
        <div className="chart-container" style={{
            background: COLORS.background.card,
            borderRadius: '8px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
            <h3 style={{ margin: '0 0 20px 0', color: COLORS.text.primary, fontSize: '18px' }}>
                {title}
            </h3>
            <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                    <XAxis type="number" stroke={COLORS.text.secondary} />
                    <YAxis
                        type="category"
                        dataKey="name"
                        width={150}
                        stroke={COLORS.text.secondary}
                        tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                        contentStyle={{
                            background: COLORS.background.card,
                            border: `1px solid ${COLORS.accent}`,
                            borderRadius: '6px'
                        }}
                    />
                    <Bar dataKey="count" fill={COLORS.accent} name="Activos Valorados" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

// Simple Table Component
export const DataTable = ({ data, columns, title }) => {
    return (
        <div className="chart-container" style={{
            background: COLORS.background.card,
            borderRadius: '8px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
            <h3 style={{ margin: '0 0 20px 0', color: COLORS.text.primary, fontSize: '18px' }}>
                {title}
            </h3>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: `2px solid ${COLORS.accent}` }}>
                            {columns.map((col, idx) => (
                                <th key={idx} style={{
                                    textAlign: 'left',
                                    padding: '12px',
                                    color: COLORS.text.primary,
                                    fontWeight: '600',
                                    fontSize: '14px'
                                }}>
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, rowIdx) => (
                            <tr key={rowIdx} style={{
                                borderBottom: '1px solid #E5E5E5',
                                transition: 'background 0.2s'
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                {columns.map((col, colIdx) => (
                                    <td key={colIdx} style={{
                                        padding: '12px',
                                        color: COLORS.text.secondary,
                                        fontSize: '13px'
                                    }}>
                                        {row[col.field]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Insights Panel Component
export const InsightsPanel = ({ insights, title }) => {
    return (
        <div style={{
            background: COLORS.primary,
            borderRadius: '8px',
            padding: '24px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            color: COLORS.text.inverse
        }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
                {title}
            </h3>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {insights.map((insight, idx) => (
                    <li key={idx} style={{
                        marginBottom: '12px',
                        fontSize: '14px',
                        lineHeight: '1.6'
                    }}>
                        {insight}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default {
    TrendChart,
    TopCompaniesChart,
    DataTable,
    InsightsPanel
};
