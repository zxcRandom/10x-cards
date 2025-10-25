/**
 * LoadingState Component
 * 
 * Displays a loading spinner with message while fetching due cards
 */

export default function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
      <p className="text-muted-foreground">Ładowanie kart do nauki...</p>
    </div>
  );
}
