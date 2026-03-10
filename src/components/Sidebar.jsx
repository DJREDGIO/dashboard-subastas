import React from 'react';
import { LayoutDashboard, BarChart3, Settings, Calculator, Box, TrendingUp, Share2 } from 'lucide-react';
import { COLORS } from '../constants/colors';
import logoSubastas from '../assets/logo_subastas_white.png';

const Sidebar = ({ activePage, onPageChange }) => {
    // Definición de Menú con IDs que coinciden con PageManager
    const menuItems = [
        { id: 'dashboard', label: 'Resumen Operativo', icon: LayoutDashboard },
        { id: 'seguimiento', label: 'Seguimiento Valor.', icon: TrendingUp },
        { id: 'reports', label: 'Planes Acción', icon: BarChart3 },
        { id: 'publicaciones', label: 'Publicaciones', icon: Share2 },
        { id: 'benchbid', label: 'BenchBid', icon: Box },
    ];

    return (
        <div style={{
            width: '240px', // Ancho ajustado para evitar saltos de línea
            height: '100vh',
            background: COLORS.background.sidebar,
            display: 'flex',
            flexDirection: 'column',
            padding: '24px 0'
        }}>
            {/* Logo */}
            <div style={{
                padding: '0 16px',
                marginBottom: '32px',
                textAlign: 'center'
            }}>
                <img
                    src={logoSubastas}
                    alt="Subastas y Comercio"
                    style={{
                        width: '100%',
                        maxWidth: '170px',
                        height: 'auto'
                    }}
                />
            </div>

            {/* Menu Items */}
            <nav style={{ flex: 1 }}>
                {menuItems.map(item => {
                    const Icon = item.icon;
                    // Active logic: BenchBid shares view with 'inventory'
                    const isActive = activePage === item.id || (item.id === 'benchbid' && activePage === 'inventory');

                    return (
                        <button
                            key={item.id}
                            onClick={() => onPageChange(item.id)}
                            style={{
                                width: '100%',
                                padding: '12px 24px',
                                background: isActive ? 'rgba(3, 171, 144, 0.1)' : 'transparent',
                                border: 'none',
                                borderLeft: isActive ? `3px solid ${COLORS.accent}` : '3px solid transparent',
                                color: isActive ? COLORS.accent : COLORS.text.inverse,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: isActive ? '600' : '400',
                                transition: 'all 0.2s',
                                textAlign: 'left'
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'transparent';
                                }
                            }}
                        >
                            <Icon size={20} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Footer */}
            <div style={{
                padding: '0 24px',
                borderTop: `1px solid rgba(255, 255, 255, 0.1)`,
                paddingTop: '16px'
            }}>
                <p style={{
                    color: COLORS.gray,
                    fontSize: '11px',
                    margin: 0
                }}>
                    © Gestión Técnica 2026
                </p>
                <div style={{ marginTop: '8px', fontSize: '10px', color: '#666' }}>
                    v1.2 Publicaciones
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
