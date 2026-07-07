import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronRight, faFolder, faFolderOpen, faFile, faCircle } from "@fortawesome/free-solid-svg-icons";
import type { SourceFileEntry } from "../../../types/simulator";

interface SourceEditorPanelProps {
  files: SourceFileEntry[];
  selectedFileId: string;
  selectedContent: string;
  isLoading: boolean;
  dirtyFileIds: string[];
  onSelectFile: (id: string) => void;
  onChangeContent: (content: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  fileId: string | null;
}

const createNode = (name: string, path: string): TreeNode => ({
  name,
  path,
  children: [],
  fileId: null,
});

const normalizeDisplayPath = (rawPath: string): string => {
  const normalizedSeparators = rawPath.trim().replace(/\\/g, "/");
  const noLeadingCurrentDir = normalizedSeparators.replace(/^\.\//, "");
  const withoutDotSegments = noLeadingCurrentDir
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== ".")
    .join("/");

  return withoutDotSegments;
};

const buildTree = (files: SourceFileEntry[]): TreeNode => {
  const root = createNode("", "");

  files.forEach((file) => {
    const sanitizedPath = normalizeDisplayPath(file.path);
    const segments = sanitizedPath
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);
    let cursor = root;

    segments.forEach((segment, index) => {
      const nextPath = cursor.path ? `${cursor.path}/${segment}` : segment;
      let child = cursor.children.find((node) => node.name === segment);
      if (!child) {
        child = createNode(segment, nextPath);
        cursor.children.push(child);
      }

      if (index === segments.length - 1) {
        child.fileId = file.id;
      }

      cursor = child;
    });

    if (!segments.length) {
      const fallback = createNode(file.id, file.id);
      fallback.fileId = file.id;
      root.children.push(fallback);
    }
  });

  const sortRecursive = (node: TreeNode): void => {
    node.children.sort((a, b) => {
      const typeA = a.fileId ? 1 : 0;
      const typeB = b.fileId ? 1 : 0;
      if (typeA !== typeB) {
        return typeA - typeB;
      }
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortRecursive);
  };

  sortRecursive(root);
  return root;
};

const renderNode = (
  node: TreeNode,
  depth: number,
  selectedFileId: string,
  expandedFolders: Set<string>,
  dirtyFileIdSet: Set<string>,
  dirtyFolderPaths: Set<string>,
  onSelectFile: (id: string) => void,
  onToggleFolder: (path: string) => void
): ReactElement => {
  const isFile = Boolean(node.fileId);
  const isExpanded = expandedFolders.has(node.path);
  const isDirty = isFile
    ? Boolean(node.fileId && dirtyFileIdSet.has(node.fileId))
    : dirtyFolderPaths.has(node.path);

  return (
    <div key={node.path || node.name}>
      {isFile ? (
        <button
          type="button"
          className={`file-node ${node.fileId === selectedFileId ? "active" : ""}`}
          style={{ paddingLeft: `${depth * 16 + 10}px` }}
          onClick={() => onSelectFile(node.fileId as string)}
        >
          <span className="folder-arrow" aria-hidden="true" />
          <span className="node-icon" aria-hidden="true"><FontAwesomeIcon icon={faFile} /></span>
          {node.name}
          {isDirty && <span className="dirty-dot" aria-label="Unsaved changes" title="Unsaved changes"><FontAwesomeIcon icon={faCircle} /></span>}
        </button>
      ) : (
        <button
          type="button"
          className="folder-node"
          style={{ paddingLeft: `${depth * 16 + 10}px` }}
          onClick={() => onToggleFolder(node.path)}
        >
          <span className="folder-arrow"><FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} /></span>
          <span className="node-icon" aria-hidden="true"><FontAwesomeIcon icon={isExpanded ? faFolderOpen : faFolder} /></span>
          {node.name}
          {isDirty && <span className="dirty-dot" aria-label="Contains unsaved changes" title="Contains unsaved changes"><FontAwesomeIcon icon={faCircle} /></span>}
        </button>
      )}

      {!isFile && isExpanded
        ? node.children.map((child) =>
            renderNode(child, depth + 1, selectedFileId, expandedFolders, dirtyFileIdSet, dirtyFolderPaths, onSelectFile, onToggleFolder)
          )
        : null}
    </div>
  );
};

export const SourceEditorPanel = ({
  files,
  selectedFileId,
  selectedContent,
  isLoading,
  dirtyFileIds,
  onSelectFile,
  onChangeContent,
}: SourceEditorPanelProps): ReactElement => {
  const tree = useMemo(() => buildTree(files), [files]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const hasInitializedFoldersRef = useRef<boolean>(false);

  const folderPaths = useMemo(() => {
    const paths = new Set<string>();

    const visit = (node: TreeNode): void => {
      if (!node.fileId && node.path) {
        paths.add(node.path);
      }
      node.children.forEach(visit);
    };

    tree.children.forEach(visit);
    return paths;
  }, [tree]);

  useEffect(() => {
    setExpandedFolders((previous) => {
      if (!hasInitializedFoldersRef.current) {
        hasInitializedFoldersRef.current = true;
        return new Set(folderPaths);
      }

      const next = new Set<string>();
      folderPaths.forEach((path) => {
        if (previous.has(path)) {
          next.add(path);
        }
      });

      return next;
    });
  }, [folderPaths]);

  const activeFile = files.find((file) => file.id === selectedFileId) ?? null;
  const activeFileDisplayPath = activeFile ? normalizeDisplayPath(activeFile.path) : null;

  const dirtyFileIdSet = useMemo(() => new Set(dirtyFileIds), [dirtyFileIds]);
  const dirtyFolderPaths = useMemo(() => {
    const folders = new Set<string>();
    dirtyFileIds.forEach((fileId) => {
      const normalized = normalizeDisplayPath(fileId);
      const segments = normalized.split("/").filter(Boolean);
      for (let i = 0; i < segments.length - 1; i++) {
        folders.add(segments.slice(0, i + 1).join("/"));
      }
    });
    return folders;
  }, [dirtyFileIds]);

  const toggleFolder = (path: string): void => {
    setExpandedFolders((previous) => {
      const next = new Set(previous);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const editorLanguage = (() => {
    const filePath = activeFile?.path.toLowerCase() ?? "";
    if (filePath.endsWith(".s") || filePath.endsWith(".asm")) {
      return "riscv";
    }
    if (filePath.endsWith(".json")) {
      return "json";
    }
    if (filePath.endsWith(".c") || filePath.endsWith(".h")) {
      return "c";
    }
    if (filePath.endsWith(".cpp") || filePath.endsWith(".cc") || filePath.endsWith(".hpp")) {
      return "cpp";
    }
    return "plaintext";
  })();

  const beforeMount = (monaco: Monaco): void => {
    if (!monaco.languages.getLanguages().some((language: { id: string; }) => language.id === "riscv")) {
      monaco.languages.register({ id: "riscv" });
      monaco.languages.setMonarchTokensProvider("riscv", {
        tokenizer: {
          root: [
            [/#[^\n]*/, "comment"],
            [/\./, "delimiter"],
            [/[a-zA-Z_][\w$]*:/, "type.identifier"],
            [
              /\b(add|addi|sub|mul|div|rem|and|andi|or|ori|xor|xori|sll|slli|srl|srli|sra|srai|slt|slti|sltu|sltiu|lb|lh|lw|lbu|lhu|sb|sh|sw|beq|bne|blt|bge|bltu|bgeu|jal|jalr|lui|auipc|ecall|ebreak|fence|nop|li|mv|la|j|ret|call|csrr|csrw|csrs|csrc)\b/,
              "keyword",
            ],
            [/\b(x([0-9]|[12][0-9]|3[01])|zero|ra|sp|gp|tp|t[0-6]|s([0-9]|1[01])|a[0-7])\b/, "variable"],
            [/\b(0x[0-9a-fA-F]+|\d+)\b/, "number"],
            [/[,()]/, "delimiter"],
            [/".*?"/, "string"],
          ],
        },
      });
    }
  };

  return (
    <main className="editor-shell">
      <aside className="editor-tree">
        <div className="editor-tree-header">Source Files</div>
        <div className="editor-tree-body">
          {files.length === 0 && <div className="empty-state">No source files found in this task.</div>}
          {tree.children.map((node) =>
            renderNode(node, 0, selectedFileId, expandedFolders, dirtyFileIdSet, dirtyFolderPaths, onSelectFile, toggleFolder)
          )}
        </div>
      </aside>

      <section className="editor-pane">
        <header className="editor-pane-header">
          <div className="editor-file-header">
            <div className="editor-file-path">{activeFileDisplayPath ?? "No file selected"}</div>
            {activeFile && (
              <div className="editor-file-config-meta">
                <span>Name: {activeFile.configProgramName}</span>
                <span>Address: {activeFile.configProgramAddress}</span>
              </div>
            )}
          </div>
        </header>

        <div className="source-editor">
          {isLoading ? (
            <div className="empty-state editor-empty">Loading source files...</div>
          ) : activeFile ? (
            <Editor
              height="100%"
              defaultLanguage="riscv"
              language={editorLanguage}
              theme="vs"
              value={selectedContent}
              beforeMount={beforeMount}
              onChange={(value) => onChangeContent(value ?? "")}
              options={{
                minimap: { enabled: false },
                fontFamily: "IBM Plex Mono, Fira Code, JetBrains Mono, monospace",
                fontSize: 13,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: "off",
              }}
            />
          ) : (
            <div className="empty-state editor-empty">Choose a file to start editing.</div>
          )}
        </div>
      </section>
    </main>
  );
};
