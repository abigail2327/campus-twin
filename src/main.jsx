import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

import { AuthProvider }  from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute    from './components/panels/ProtectedRoute';
import Layout            from './components/panels/Layout';

import Login          from './pages/Login';
import Dashboard      from './pages/Dashboard';
import BuildingRooms  from './pages/BuildingRooms';
import DeviceTwin     from './pages/DeviceTwin';
import Alerts         from './pages/Alerts';
import Analytics      from './pages/Analytics';
import Twin3DPage     from './pages/Twin3DPage';
import OntologyGraph  from './pages/OntologyGraph';



function ProtectedLayout({ pageTitle, children }) {
    return (
        <ProtectedRoute>
            <Layout pageTitle={pageTitle}>
                {children}
            </Layout>
        </ProtectedRoute>
    );
}

function App() {
    return (
        <BrowserRouter>
            <ThemeProvider>
                <AuthProvider>
                    <Routes>
                        {/* Auth */}
                        <Route path="/login" element={<Login />} />

                        {/* Fullscreen 3D twin — no layout wrapper, opens in its own tab */}
                        <Route path="/twin3d" element={
                            <ProtectedRoute>
                                <Twin3DPage />
                            </ProtectedRoute>
                        } />

                        {/* Dashboard pages */}
                        <Route path="/" element={
                            <ProtectedLayout pageTitle="Main Dashboard">
                                <Dashboard />
                            </ProtectedLayout>
                        } />
                        <Route path="/building" element={
                            <ProtectedLayout pageTitle="Building & Rooms">
                                <BuildingRooms />
                            </ProtectedLayout>
                        } />
                        <Route path="/devices" element={
                            <ProtectedLayout pageTitle="Device Twin">
                                <DeviceTwin />
                            </ProtectedLayout>
                        } />
                        <Route path="/alerts" element={
                            <ProtectedLayout pageTitle="Alerts & Notifications">
                                <Alerts />
                            </ProtectedLayout>
                        } />
                        <Route path="/analytics" element={
                            <ProtectedLayout pageTitle="Analytics & Reports">
                                <Analytics />
                            </ProtectedLayout>
                        } />
                        <Route path="/ontology" element={
                            <ProtectedLayout pageTitle="Ontology Graph">
                                <OntologyGraph />
                            </ProtectedLayout>
                        } />

                        {/* Catch-all */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </AuthProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>
);