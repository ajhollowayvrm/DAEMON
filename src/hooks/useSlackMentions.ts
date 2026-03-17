import { useQuery } from "@tanstack/react-query";
import { fetchSlackSections } from "../services/tauri-bridge";

export function useSlackSections() {
  return useQuery({
    queryKey: ["slack", "sections"],
    queryFn: fetchSlackSections,
    refetchInterval: 30_000,
  });
}
