import { useState, useRef } from "react";
import { useListDocuments, useDeleteDocument, getListDocumentsQueryKey, getGetStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, Trash2, FileText, AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function DocumentsPage() {
  const { data: documents, isLoading } = useListDocuments();
  const deleteDoc = useDeleteDocument();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleUpload = async (file: File) => {
    if (!file || file.type !== "application/pdf") {
      alert("Please upload a PDF file.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(import.meta.env.BASE_URL + "api/documents", { 
        method: "POST", 
        body: fd 
      });
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
    } catch (e) {
      alert("Error uploading file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Purge this document from the vector store?")) {
      deleteDoc.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        }
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <header className="h-14 border-b flex items-center px-6 bg-card shrink-0">
        <h1 className="font-semibold text-sm flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Document Library
        </h1>
      </header>

      <div className="p-8 max-w-5xl w-full mx-auto space-y-10">
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold tracking-tight">Ingest Documents</h2>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Upload PDF payloads to construct the vector knowledge base.</p>
          </div>

          <div 
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${dragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 bg-card hover:bg-card/80'}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              accept="application/pdf" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={(e) => e.target.files && handleUpload(e.target.files[0])}
              data-testid="input-file-upload"
            />
            <div className="mx-auto w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mb-6 border border-border shadow-sm">
              {uploading ? <Loader2 className="w-8 h-8 animate-spin text-primary" /> : <UploadCloud className="w-8 h-8 text-primary/70" />}
            </div>
            <h3 className="text-base font-semibold mb-2">{uploading ? "Ingesting Payload..." : "Transmit Payload"}</h3>
            <p className="text-sm text-muted-foreground mb-6 font-mono">PDF format • MAX_SIZE_50MB</p>
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} variant={uploading ? "secondary" : "default"} data-testid="button-browse-files">
              {uploading ? "Processing..." : "Select File"}
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight">Knowledge Base</h2>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono"><Loader2 className="w-4 h-4 animate-spin"/> Syncing indices...</div>
          ) : documents?.length === 0 ? (
            <div className="text-sm text-muted-foreground p-10 text-center border border-dashed rounded-xl bg-card font-mono uppercase tracking-wider">
              Knowledge base empty. Awaiting ingestion.
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 font-mono text-[10px] uppercase text-muted-foreground border-b tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Identifier</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 font-semibold">Nodes</th>
                    <th className="px-5 py-3.5 font-semibold">Timestamp</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Operation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {documents?.map(doc => (
                    <tr key={doc.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-5 py-4 font-medium flex items-center gap-3">
                        <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="truncate max-w-[250px] font-mono text-xs" title={doc.originalName}>{doc.originalName}</span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={doc.status} />
                        {doc.status === 'error' && doc.errorMessage && (
                          <div className="text-[10px] text-destructive mt-1.5 flex items-center gap-1 font-mono uppercase tracking-wider" title={doc.errorMessage}>
                            <AlertCircle className="w-3 h-3" /> Error
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{doc.chunkCount}</td>
                      <td className="px-5 py-4 text-muted-foreground text-xs font-mono">{format(new Date(doc.createdAt), 'yy-MM-dd HH:mm')}</td>
                      <td className="px-5 py-4 text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" data-testid={`button-delete-doc-${doc.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "outline",
    processing: "secondary",
    ready: "default",
    error: "destructive"
  };
  const labels: Record<string, string> = {
    pending: "QUEUED",
    processing: "INDEXING",
    ready: "ACTIVE",
    error: "FAILED"
  };
  return (
    <Badge variant={variants[status] || "outline"} className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 ${status === 'processing' ? 'animate-pulse bg-primary/20 text-primary border-primary/20' : ''}`}>
      {labels[status] || status}
    </Badge>
  );
}