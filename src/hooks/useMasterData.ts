import { useCallback, useEffect, useState } from "react";
import { mastersService, type MasterRecord } from "@/services/mastersService";
import type { MasterDef } from "@/types/masterConfig.data";

type Status = "idle" | "loading" | "ready" | "error";

/**
 * Resolves the API for whichever master is currently selected.
 * `def.api` is the single source of truth — no per-master branching.
 * Returns `enabled: false` for masters that have no backend yet.
 */
export function useMasterData(def?: MasterDef) {
    const type = def?.api;
    const [rows, setRows] = useState<MasterRecord[]>([]);
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        if (!type) {
            setRows([]);
            setStatus("ready");
            return;
        }
        setStatus("loading");
        setError(null);
        try {
            const res = await mastersService.list(type);
            setRows(Array.isArray(res) ? res : ((res as any)?.data ?? []));
            setStatus("ready");
        } catch (e: any) {
            setError(e?.message ?? "Failed to load master data");
            setStatus("error");
        }
    }, [type]);

    useEffect(() => {
        void reload();
    }, [reload]);

    return { rows, status, error, reload, type, enabled: !!type };
}
