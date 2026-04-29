/**
 * Twin3DPage.jsx
 * Fullscreen standalone 3D digital twin — opens in its own tab at /twin3d
 * No sidebar, no topbar — just the building and sensor controls.
 */

import { useState, lazy, Suspense } from 'react';
import { useLiveSensorState } from '../services/sensorState';
import Icon from '../components/panels/Icon';

const BuildingTwin3D = lazy(() => import('../components/panels/BuildingTwin3D'));

export default function Twin3DPage() {
    const [selectedRoom, setSelectedRoom] = useState(null);
    const { sensorState, isLive } = useLiveSensorState();

    return (
        <div className="w-screen h-screen flex flex-col overflow-hidden bg-slate-950"
             style={{ fontFamily: "'DM Sans', 'Plus Jakarta Sans', sans-serif" }}>

            {/* Minimal topbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0"
                 style={{ background: 'rgba(8,13,20,0.95)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                        <Icon name="layers" className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white leading-none">SmartTwin — 3D View</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest">RIT Dubai · Interactive Digital Twin</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${isLive ? 'text-emerald-500' : 'text-amber-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {isLive ? 'Live Firebase Data' : 'Simulated Data'}
          </span>
                    <button onClick={() => window.close()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-all">
                        <Icon name="x" className="w-3.5 h-3.5" /> Close Tab
                    </button>
                </div>
            </div>

            {/* Fullscreen 3D canvas */}
            <div className="flex-1 overflow-hidden">
                <Suspense fallback={
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4"
                         style={{ background: 'linear-gradient(180deg, #87CEEB 0%, #c8ddf0 60%, #d8d0b8 100%)' }}>
                        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-slate-200 font-bold text-sm">Loading 3D Twin…</p>
                        <p className="text-slate-400 text-xs">Three.js · @react-three/fiber</p>
                    </div>
                }>
                    <BuildingTwin3D
                        sensorState={sensorState}
                        selectedRoom={selectedRoom}
                        onRoomSelect={setSelectedRoom}
                        height="100%"
                        compact={false}
                    />
                </Suspense>
            </div>
        </div>
    );
}