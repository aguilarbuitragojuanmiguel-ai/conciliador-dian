import { Toaster } from "sonner";
import Index from "./pages/Index";

export default function App() {
  return (
    <>
      <Index />
      <Toaster position="bottom-right" richColors />
    </>
  );
}
