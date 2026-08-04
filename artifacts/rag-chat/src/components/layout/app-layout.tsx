import { Link, useLocation } from "wouter";
import { FileText, MessageSquare, Plus, Database } from "lucide-react";
import { useListConversations, useCreateConversation, useGetStats, getListConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: stats } = useGetStats();
  const { data: conversations } = useListConversations();
  const createConversation = useCreateConversation();
  const queryClient = useQueryClient();

  const handleCreate = () => {
    createConversation.mutate({ data: { title: "New conversation" } }, {
      onSuccess: (conv) => {
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        setLocation(`/c/${conv.id}`);
      }
    });
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <aside className="w-64 flex flex-col border-r bg-sidebar border-sidebar-border shrink-0">
        <div className="p-4 border-b border-sidebar-border flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <span className="font-semibold tracking-tight text-sidebar-foreground">RAG Terminal</span>
        </div>
        
        {stats && (
          <div className="px-4 py-4 border-b border-sidebar-border bg-sidebar/50">
            <div className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-widest mb-3">System Load</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-mono font-medium text-sidebar-foreground">{stats.readyDocumentCount} / {stats.documentCount}</span>
                <span className="text-[10px] text-muted-foreground uppercase">Docs Ready</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-mono font-medium text-sidebar-foreground">{stats.totalChunks}</span>
                <span className="text-[10px] text-muted-foreground uppercase">Chunks</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
          <div className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1 mt-2 flex items-center justify-between">
            <span>Conversations</span>
            <Button variant="ghost" size="icon" className="h-5 w-5 rounded-sm hover:bg-primary/10 hover:text-primary transition-colors" onClick={handleCreate} data-testid="button-create-conversation" disabled={createConversation.isPending}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          {conversations?.map(conv => {
            const isActive = location === `/c/${conv.id}`;
            return (
              <Link key={conv.id} href={`/c/${conv.id}`} className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground hover:bg-muted/80'}`} data-testid={`link-conversation-${conv.id}`}>
                <MessageSquare className="w-3.5 h-3.5 opacity-70" />
                <span className="truncate flex-1">{conv.title}</span>
              </Link>
            )
          })}
        </div>

        <div className="p-3 border-t border-sidebar-border flex flex-col gap-1">
           <div className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">Library</div>
           <Link href="/documents" className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm font-medium transition-colors ${location === '/documents' ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground hover:bg-muted/80'}`} data-testid="link-documents">
             <FileText className="w-3.5 h-3.5 opacity-70" />
             <span>Manage Documents</span>
           </Link>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {children}
      </main>
    </div>
  );
}