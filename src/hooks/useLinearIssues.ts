import { useQuery } from "@tanstack/react-query";
import { fetchIssues } from "../services/tauri-bridge";

export function useLinearIssues() {
  return useQuery({
    queryKey: ["linear", "issues"],
    queryFn: fetchIssues,
    refetchInterval: 60_000,
  });
}
