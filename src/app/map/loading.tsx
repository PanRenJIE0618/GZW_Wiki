import { HudLoader } from "@/components/HudLoader";

export default function MapLoading() {
  return (
    <div className="panel min-h-[50vh]">
      <HudLoader label="LOADING WORLD MAP" />
    </div>
  );
}
