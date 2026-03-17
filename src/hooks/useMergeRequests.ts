import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMergeRequests } from "../services/tauri-bridge";
import { checkMRNotifications } from "../services/notifications";
import type { EnrichedMergeRequest } from "../types/models";

export function useMergeRequests() {
  const prevDataRef = useRef<EnrichedMergeRequest[] | undefined>(undefined);

  const query = useQuery({
    queryKey: ["gitlab", "mergeRequests"],
    queryFn: fetchMergeRequests,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (query.data) {
      checkMRNotifications(prevDataRef.current, query.data);
      prevDataRef.current = query.data;
    }
  }, [query.data]);

  return query;
}
