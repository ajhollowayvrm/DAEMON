import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Plus, Minus, FileText, FilePlus, FileX, FileEdit } from "lucide-react";
import type { FileDiff } from "../../types/models";
import styles from "./DiffViewer.module.css";

// ── Diff line parser ─────────────────────────────────────────
interface DiffLine {
  type: "add" | "remove" | "context" | "hunk";
  content: string;
  oldNum?: number;
  newNum?: number;
}

function parseDiff(raw: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of raw.split("\n")) {
    if (line.startsWith("@@")) {
      // Parse hunk header: @@ -oldStart,count +newStart,count @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      lines.push({ type: "hunk", content: line });
    } else if (line.startsWith("+")) {
      lines.push({ type: "add", content: line.slice(1), newNum: newLine });
      newLine++;
    } else if (line.startsWith("-")) {
      lines.push({ type: "remove", content: line.slice(1), oldNum: oldLine });
      oldLine++;
    } else if (line.startsWith("\\")) {
      // "\ No newline at end of file" — skip
    } else {
      // Context line (starts with space or is empty)
      lines.push({ type: "context", content: line.startsWith(" ") ? line.slice(1) : line, oldNum: oldLine, newNum: newLine });
      oldLine++;
      newLine++;
    }
  }
  return lines;
}

// ── Status icon ──────────────────────────────────────────────
const STATUS_ICONS: Record<string, typeof FileText> = {
  added: FilePlus,
  deleted: FileX,
  modified: FileEdit,
  renamed: FileEdit,
};

const STATUS_COLORS: Record<string, string> = {
  added: "var(--neon-green)",
  deleted: "var(--neon-red, #ff3366)",
  modified: "var(--neon-cyan)",
  renamed: "var(--neon-orange)",
};

// ── File Diff Section ────────────────────────────────────────
function FileDiffSection({ file }: { file: FileDiff }) {
  const [expanded, setExpanded] = useState(true);
  const lines = useMemo(() => parseDiff(file.diff), [file.diff]);
  const additions = lines.filter((l) => l.type === "add").length;
  const deletions = lines.filter((l) => l.type === "remove").length;
  const Icon = STATUS_ICONS[file.status] ?? FileText;
  const color = STATUS_COLORS[file.status] ?? "var(--text-muted)";
  const displayPath = file.status === "renamed" && file.old_path !== file.new_path
    ? `${file.old_path} → ${file.new_path}`
    : file.new_path;

  return (
    <div className={styles.file}>
      <button className={styles.fileHeader} onClick={() => setExpanded(!expanded)}>
        <span className={styles.fileChevron}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <Icon size={12} style={{ color }} />
        <span className={styles.filePath}>{displayPath}</span>
        <span className={styles.fileStats}>
          {additions > 0 && (
            <span className={styles.additions}>
              <Plus size={9} />{additions}
            </span>
          )}
          {deletions > 0 && (
            <span className={styles.deletions}>
              <Minus size={9} />{deletions}
            </span>
          )}
        </span>
      </button>
      {expanded && (
        <div className={styles.diffBody}>
          <table className={styles.diffTable}>
            <tbody>
              {lines.map((line, i) => (
                <tr
                  key={i}
                  className={`${styles.diffLine} ${styles[`line_${line.type}`]}`}
                >
                  <td className={styles.lineNum}>
                    {line.type === "hunk" ? "" : (line.oldNum ?? "")}
                  </td>
                  <td className={styles.lineNum}>
                    {line.type === "hunk" ? "" : (line.newNum ?? "")}
                  </td>
                  <td className={styles.lineSign}>
                    {line.type === "add" ? "+" : line.type === "remove" ? "−" : line.type === "hunk" ? "@@" : ""}
                  </td>
                  <td className={styles.lineContent}>
                    <code>{line.type === "hunk" ? line.content : line.content}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Diff Viewer ──────────────────────────────────────────────
export function DiffViewer({ files }: { files: FileDiff[] }) {
  const totalAdds = files.reduce((sum, f) => sum + parseDiff(f.diff).filter((l) => l.type === "add").length, 0);
  const totalDels = files.reduce((sum, f) => sum + parseDiff(f.diff).filter((l) => l.type === "remove").length, 0);

  return (
    <div className={styles.viewer}>
      <div className={styles.summary}>
        <span className={styles.fileCount}>{files.length} {files.length === 1 ? "file" : "files"} changed</span>
        <span className={styles.additions}><Plus size={9} />{totalAdds}</span>
        <span className={styles.deletions}><Minus size={9} />{totalDels}</span>
      </div>
      <div className={styles.fileList}>
        {files.map((file) => (
          <FileDiffSection key={`${file.old_path}-${file.new_path}`} file={file} />
        ))}
      </div>
    </div>
  );
}
