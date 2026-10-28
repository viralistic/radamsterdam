import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-content-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Deze pagina bestaat niet</h1>
      <p className="text-muted-foreground">Misschien is de link verouderd. Ga terug naar de kaart.</p>
      <div className="flex justify-center gap-2">
        <Link href="/kaart" className={buttonVariants()}>Naar de kaart</Link>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>Naar de start</Link>
      </div>
    </div>
  );
}
