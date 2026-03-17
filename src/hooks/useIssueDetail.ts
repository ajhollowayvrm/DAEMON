import { useQuery } from "@tanstack/react-query";
import { fetchIssueDetail } from "../services/tauri-bridge";

export function useIssueDetail(identifier: string | null) {
  return useQuery({
    queryKey: ["linear", "issue", identifier],
    queryFn: () => fetchIssueDetail(identifier!),
    enabled: !!identifier,
  });
}
