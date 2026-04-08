import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetStreamlitUrl } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function Analytics() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const page = searchParams.get('page') || 'upload';
  
  const { data: streamlitInfo, isLoading, isError, refetch } = useGetStreamlitUrl();
  const [iframeLoading, setIframeLoading] = useState(true);

  // When URL changes, reset iframe loading state
  useEffect(() => {
    if (streamlitInfo?.url && streamlitInfo?.available) {
      setIframeLoading(true);
    }
  }, [streamlitInfo?.url, page]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col p-6 w-full h-full">
        <div className="flex items-center space-x-3 mb-6">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="flex-1 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !streamlitInfo) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription className="mt-2">
            <p>Could not connect to the analytics engine.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!streamlitInfo.available || !streamlitInfo.url) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Analytics engine starting up...</h2>
        <p className="text-muted-foreground max-w-md">
          The precision data processing environment is warming up. This usually takes a few moments.
        </p>
        <Button variant="outline" onClick={() => refetch()} className="mt-4">
          Check Status
        </Button>
      </div>
    );
  }

  const iframeUrl = `${streamlitInfo.url}?embedded=true&page=${page}`;

  return (
    <div className="flex-1 flex flex-col h-full w-full relative bg-card">
      {iframeLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card z-10 flex-col space-y-4">
           <Loader2 className="h-8 w-8 text-primary animate-spin" />
           <p className="text-sm text-muted-foreground font-medium">Loading {page.replace('-', ' ')} module...</p>
        </div>
      )}
      <iframe
        src={iframeUrl}
        className={`w-full h-[calc(100vh-64px)] md:h-screen border-0 transition-opacity duration-500 ${iframeLoading ? 'opacity-0' : 'opacity-100'}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onLoad={() => setIframeLoading(false)}
        title="Statyx Analytics Engine"
      />
    </div>
  );
}
