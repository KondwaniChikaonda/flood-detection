'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('../components/MapComponent'), { ssr: false });

const MapPage: React.FC = () => {
  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <MapComponent />
    </div>
  );
};

export default MapPage;
