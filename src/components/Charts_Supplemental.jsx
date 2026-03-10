import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';
import { COLORS } from '../constants/colors';
// Stacked Bar Chart for Categories
export const StackedBarChart = ({ data, title, keys }) => {
    // Default colors for known categories
    const colorMap = {
        'Vehículos': COLORS.accent, // Teal
        'Mobiliario': COLORS.gray,
        'Equipo industrial': COLORS.primary, // Dark Blue
        'Chatarra': COLORS.warning, // Orange
        'Otros': '#CBD5E1'
    };

    // Fallback colors
    const fallbackColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042'];

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
                <BarChart data={data}>
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
                    {keys.map((key, index) => (
                        <Bar
                            key={key}
                            dataKey={key}
                            stackId="a"
                            fill={colorMap[key] || fallbackColors[index % fallbackColors.length]}
                        >
                            <LabelList dataKey={key} position="inside" style={{ fill: 'white', fontWeight: 'bold', fontSize: '11px' }} />
                        </Bar>
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

// Pie Chart for Distributions
const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
    // Only show label if slice is > 5% to avoid clutter
    if (percent < 0.05) return null;

    const radius = innerRadius + (outerRadius - innerRadius) * 0.6; // Push out slightly
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text
            x={x}
            y={y}
            fill="white"
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontSize: '11px', fontWeight: 'bold', textShadow: '0px 0px 3px rgba(0,0,0,0.5)' }}
        >
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

export const PieChartDistribution = ({ data, title }) => {
    // Palette: Teal, Orange, Dark Blue, Gray, Light Blue
    const PIE_COLORS = [COLORS.accent, COLORS.warning, COLORS.primary, COLORS.gray, '#60A5FA', '#34D399', '#F472B6'];

    return (
        <div className="chart-container" style={{
            background: COLORS.background.card,
            borderRadius: '8px',
            padding: '16px', // Reduced padding for more space
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <h3 style={{ margin: '0 0 10px 0', color: COLORS.text.primary, fontSize: '15px', textAlign: 'center', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {title}
            </h3>
            <div style={{ flex: 1, minHeight: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="45%" // Move up slightly to make room for bottom legend
                            labelLine={false}
                            label={renderCustomizedLabel}
                            outerRadius={80} // Keep moderate to fit smaller screens
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value) => new Intl.NumberFormat('es-CO').format(value)}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Legend
                            layout="horizontal"
                            verticalAlign="bottom"
                            align="center"
                            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
