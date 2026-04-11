'use client';

import dynamic from 'next/dynamic';

const FarmBoundaryMapInner = dynamic(() => import('./FarmBoundaryMapInner'), {
  ssr: false,
});

export interface FarmBoundaryMapProps {
  polygon: number[][];
  center?: [number, number];
  height?: number;
}

export default function FarmBoundaryMap(props: FarmBoundaryMapProps) {
  return <FarmBoundaryMapInner {...props} />;
}
