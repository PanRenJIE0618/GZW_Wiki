import { HudLoader } from "@/components/HudLoader";

export default function EntryLoading() {
  return (
    <div className="panel min-h-[40vh]">
      <HudLoader label="LOADING ENTRY" />
    </div>
  );
}
