import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

type MapViewProps = PropsWithChildren<
  ViewProps & {
    provider?: unknown;
    region?: unknown;
    showsUserLocation?: boolean;
  }
>;

type MapOverlayProps = PropsWithChildren<{
  coordinate?: unknown;
  coordinates?: unknown;
  pinColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  title?: string;
}>;

export const PROVIDER_GOOGLE = 'google';

export function Marker(_props: MapOverlayProps) {
  return null;
}

export function Polyline(_props: MapOverlayProps) {
  return null;
}

export default function MapView({ children: _children, style }: MapViewProps) {
  return <View style={[{ backgroundColor: '#e8eef2' }, style]} />;
}
