import { useQuery } from "@tanstack/react-query";
import { fetchDatadogMonitors } from "../services/tauri-bridge";

export function useDatadogMonitors() {
  return useQuery({
    queryKey: ["datadog", "monitors"],
    queryFn: fetchDatadogMonitors,
    refetchInterval: 60_000,
    retry: false,
  });
}
