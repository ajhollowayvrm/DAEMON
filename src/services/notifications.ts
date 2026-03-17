import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { EnrichedMergeRequest } from "../types/models";

const notifiedIds = new Set<string>();

async function ensurePermission(): Promise<boolean> {
  let granted = await isPermissionGranted();
  if (!granted) {
    const result = await requestPermission();
    granted = result === "granted";
  }
  return granted;
}

async function notify(title: string, body: string) {
  const granted = await ensurePermission();
  if (!granted) return;
  sendNotification({ title, body });
}

export function checkMRNotifications(
  prevMRs: EnrichedMergeRequest[] | undefined,
  newMRs: EnrichedMergeRequest[],
) {
  // Skip on first load (no previous data to compare)
  if (!prevMRs) return;

  const prevIds = new Set(prevMRs.map((mr) => mr.id));
  const prevApprovalIds = new Set(
    prevMRs.filter((mr) => mr.needs_your_approval).map((mr) => mr.id),
  );
  const prevMentionIds = new Set(
    prevMRs.filter((mr) => mr.you_are_mentioned).map((mr) => mr.id),
  );

  for (const mr of newMRs) {
    const notifKey = `${mr.id}`;

    // New team MR
    if (mr.is_team_member && !prevIds.has(mr.id)) {
      const key = `new-${notifKey}`;
      if (!notifiedIds.has(key)) {
        notifiedIds.add(key);
        notify(
          "New Team MR",
          `${mr.author}: ${mr.title}`,
        );
      }
    }

    // Newly needs your approval
    if (mr.needs_your_approval && !prevApprovalIds.has(mr.id)) {
      const key = `approval-${notifKey}`;
      if (!notifiedIds.has(key)) {
        notifiedIds.add(key);
        notify(
          "Approval Needed",
          `!${mr.iid} ${mr.title}\n${mr.approval_rules_needing_you.join(", ")}`,
        );
      }
    }

    // Newly mentioned
    if (mr.you_are_mentioned && !prevMentionIds.has(mr.id)) {
      const key = `mention-${notifKey}`;
      if (!notifiedIds.has(key)) {
        notifiedIds.add(key);
        notify(
          "Mentioned in MR",
          `!${mr.iid} ${mr.title} by ${mr.author}`,
        );
      }
    }
  }
}
