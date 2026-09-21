"use client";

import dynamic from "next/dynamic";
import { HudLoader } from "@/components/HudLoader";
import type { MapLayerWithPoints, MapMarker, WikiMap } from "@/lib/types";

type EntryOption = {
  id: string;
  title: string;
  slug: string;
};

type Props = {
  map: WikiMap;
  initialMarkers: MapMarker[];
  entryOptions: EntryOption[];
  canEdit: boolean;
  currentUserId: string | null;
  initialSelectedMarkerId?: string | null;
  layers?: MapLayerWithPoints[];
  initialLayerId?: string | null;
  initialLayerPointId?: string | null;
  layersLoadError?: string | null;
};

const ZoomMapViewer = dynamic(
  () =>
    import("@/components/ZoomMapViewer").then((m) => m.ZoomMapViewer),
  {
    ssr: false,
    loading: () => (
      <div className="panel flex h-[min(70vh,720px)] items-center justify-center">
        <HudLoader label="LOADING MAP ENGINE" />
      </div>
    ),
  },
);

export function MapViewerClient(props: Props) {
  return <ZoomMapViewer {...props} />;
}
