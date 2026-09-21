import { HudLoader } from "@/components/HudLoader";

export default function Loading() {
  return (
    <div className="panel min-h-[40vh]">
      <HudLoader label="LOADING INTEL" />
    </div>
  );
}
