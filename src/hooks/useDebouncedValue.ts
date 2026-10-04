/**
 * `useDebouncedValue` — delay a fast-changing value (search term, filter).
 *
 * Doc §24 (search API optimisation): typing "Sansar" must not fire six
 * requests. The input stays fully controlled by the component; this hook only
 * publishes a settled copy that the API call depends on:
 *
 *   const [term, setTerm] = useState("");
 *   const debounced = useDebouncedValue(term, 350);
 *
 *   const [rows, setRows] = useState([]);   // page state, filled in the effect
 *     () => fetchPatients({ search: debounced }),
 *     [debounced],
 *   );
 *
 * Combined with an effect that ignores superseded answers, the newest search
 * wins: an older in-flight answer cannot overwrite a newer one.
 */

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebouncedValue;
