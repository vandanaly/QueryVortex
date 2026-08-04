import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetConversation, useSendMessage, useDeleteConversation, getGetConversationQueryKey, getListConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Trash2, ChevronDown, ChevronRight, FileText, Loader2, MessageSquare, Terminal } from "lucide-react";

export default function ChatPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const id = params.id ? parseInt(params.id) : null;
  
  const { data: conversation, isLoading } = useGetConversation(id!, { 
    query: { enabled: !!id, queryKey: getGetConversationQueryKey(id!) } 
  });
  
  const sendMessage = useSendMessage();
  const deleteConversation = useDeleteConversation();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.messages, sendMessage.isPending]);

  if (!id) {
    return (
      <div className="flex-1 flex items-center justify-center bg-card text-muted-foreground">
        <div className="text-center max-w-sm space-y-4">
          <Terminal className="w-12 h-12 mx-auto text-primary/40" />
          <h2 className="text-lg font-semibold text-foreground font-mono tracking-tight">System Ready</h2>
          <p className="text-sm">Select a conversation from the sidebar or start a new one to interrogate your document library.</p>
        </div>
      </div>
    );
  }

  const handleDelete = () => {
    if (confirm("Delete this conversation?")) {
      deleteConversation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          setLocation("/");
        }
      });
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessage.isPending) return;
    const content = input;
    setInput("");
    sendMessage.mutate({ id, data: { content } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(id) });
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <header className="h-14 border-b flex items-center justify-between px-6 bg-card shrink-0">
        <h1 className="font-semibold text-sm truncate flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          {conversation?.title || "Conversation"}
        </h1>
        <Button variant="ghost" size="icon" onClick={handleDelete} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" data-testid="button-delete-conversation">
          <Trash2 className="w-4 h-4" />
        </Button>
      </header>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-8" ref={scrollRef}>
        {isLoading && <div className="flex items-center justify-center py-10 text-muted-foreground text-sm font-mono gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Loading data stream...</div>}
        
        {conversation?.messages.length === 0 && !isLoading && (
          <div className="text-center text-sm font-mono text-muted-foreground py-10 border border-dashed border-border rounded-lg max-w-2xl mx-auto mt-10">
            Awaiting input. Ask a question to begin retrieval.
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-8 w-full">
          {conversation?.messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg p-5 ${msg.role === 'user' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/50 border border-border text-foreground shadow-sm'}`}>
                <div className="text-xs font-mono font-bold uppercase tracking-wider mb-2 opacity-50 flex items-center gap-2">
                  {msg.role === 'user' ? 'User Input' : 'System Output'}
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <Sources sources={msg.sources} />
                )}
              </div>
            </div>
          ))}
          {sendMessage.isPending && (
            <div className="flex justify-start">
              <div className="bg-muted/50 border border-border text-foreground rounded-lg p-5 flex items-center gap-3 max-w-[85%] shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-mono">Retrieving context & generating response...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t bg-card shrink-0">
        <form onSubmit={handleSend} className="flex gap-3 max-w-3xl mx-auto relative">
          <Input 
            value={input} 
            onChange={e => setInput(e.target.value)}
            placeholder="Interrogate documents..." 
            className="flex-1 font-mono text-sm py-6 pl-4 pr-14 rounded-xl border-input focus-visible:ring-primary shadow-sm"
            disabled={sendMessage.isPending}
            data-testid="input-message"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || sendMessage.isPending} className="absolute right-2 top-2 h-8 w-8 rounded-lg" data-testid="button-send-message">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function Sources({ sources }: { sources: any[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-4 pt-4 border-t border-border">
      <button 
        onClick={() => setExpanded(!expanded)} 
        className="flex items-center gap-1.5 text-xs font-mono font-medium opacity-70 hover:opacity-100 hover:text-primary transition-colors focus:outline-none"
        data-testid="button-toggle-sources"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span className="uppercase tracking-wider">Citations ({sources.length})</span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-3">
          {sources.map((src, i) => (
            <div key={i} className="bg-background rounded-md p-3 text-xs border border-border/60">
              <div className="flex justify-between items-start mb-2 opacity-60 font-mono text-[10px] uppercase tracking-wider">
                <span className="flex items-center gap-1.5 font-semibold text-primary"><FileText className="w-3 h-3" /> {src.documentName}</span>
                <span className="bg-muted px-1.5 py-0.5 rounded text-foreground">Rel: {src.score.toFixed(2)}</span>
              </div>
              <div className="line-clamp-4 leading-relaxed font-sans text-muted-foreground" title={src.text}>"{src.text}"</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}