import { Button } from "../ui/primitives";

export function Emptyish({ onBack }: { onBack: () => void }) {
  return (
    <div className="py-10">
      <p className="text-center text-[13px] text-ink-400">
        This patient record may have been removed or you may not have permission
        to view it.
      </p>
      <div className="mt-4 flex justify-center">
        <Button size="sm" variant="outline" onClick={onBack}>
          Back to registry
        </Button>
      </div>
    </div>
  );
}