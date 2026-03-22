import { useQuery } from "@tanstack/react-query";
import { fetchDmConversations } from "../services/tauri-bridge";

export function useDmConversations() {
  return useQuery({
    queryKey: ["slack", "dms"],
    queryFn: fetchDmConversations,
    refetchInterval: 60_000,
  });
}
