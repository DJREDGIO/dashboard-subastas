import React, { useState } from 'react';
import Sidebar from './Sidebar';
import ResumenOperativo from './ResumenOperativo';
import PlanesAccion from './PlanesAccion';
import BenchBid from './BenchBid';
import Publicaciones from './Publicaciones';
import ValuationTracking from './ValuationTracking';
import { COLORS } from '../constants/colors';

const PageManager = () => {
    const [activePage, setActivePage] = useState('dashboard');
    const [csvData, setCsvData] = useState(null);
    const [filters, setFilters] = useState({
        fechaInicio: null,
        fechaFin: null,
        empresa: [],
        categoria: [],
        subcategoria: [],
        modalidad: [],
        estadoTecnico: [],
        estadoPublicacion: [],
        tipoSubasta: [],
        departamento: [],
        unidadMedida: [],
        incluirCancelados: true
    });

    const handleFilterChange = (filterName, value) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const handleClearFilters = () => {
        setFilters({
            fechaInicio: null,
            fechaFin: null,
            empresa: [],
            categoria: [],
            subcategoria: [],
            modalidad: [],
            estadoTecnico: [],
            estadoPublicacion: [],
            tipoSubasta: [],
            departamento: [],
            unidadMedida: [],
            incluirCancelados: true
        });
    };

    const renderPage = () => {
        switch (activePage) {
            case 'dashboard':
                return (
                    <ResumenOperativo
                        data={csvData}
                        onDataLoad={setCsvData}
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        onClearFilters={handleClearFilters}
                    />
                );
            case 'reports':
                return (
                    <PlanesAccion
                        data={csvData}
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        onClearFilters={handleClearFilters}
                    />
                );
            case 'seguimiento':
                return (
                    <ValuationTracking
                        data={csvData}
                    />
                );
            case 'publicaciones':
                return (
                    <Publicaciones data={csvData} />
                );
            case 'benchbid':
            case 'inventory':
                return (
                    <BenchBid
                        data={csvData}
                        filters={filters}
                        onFilterChange={handleFilterChange}
                    />
                );
            case 'valuations':
            case 'settings':
                return (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: COLORS.text.secondary
                    }}>
                        <p>Esta sección estará disponible próximamente</p>
                    </div>
                );
            default:
                return (
                    <ResumenOperativo
                        data={csvData}
                        onDataLoad={setCsvData}
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        onClearFilters={handleClearFilters}
                    />
                );
        }
    };

    return (
        <div className="print-container" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <div className="no-print">
                <Sidebar activePage={activePage} onPageChange={setActivePage} />
            </div>
            <div className="print-content" style={{
                flex: 1,
                background: COLORS.background.main,
                overflow: 'auto',
                height: '100%'
            }}>
                {renderPage()}
            </div>
        </div>
    );
};

export default PageManager;
