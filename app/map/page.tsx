'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically load MapComponent to ensure it only renders on client
const MapComponent = dynamic(() => import('../components/MapComponent'), { ssr: false });

const MapPage: React.FC = () => {
  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <MapComponent />
    </div>
  );
};

export default MapPage;
