import { HudLoader } from "@/components/HudLoader";

export default function CategoryLoading() {
  return (
    <div className="panel min-h-[40vh]">
      <HudLoader label="LOADING CATEGORY" />
    </div>
  );
}
