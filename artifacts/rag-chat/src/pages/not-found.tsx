export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-background text-foreground space-y-2">
      <h1 className="text-4xl font-bold font-mono tracking-tight text-primary">404</h1>
      <p className="text-muted-foreground text-sm font-medium uppercase tracking-widest">Signal Lost</p>
    </div>
  );
}