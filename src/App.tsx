import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Markets from "./pages/Markets";
import MarketBrief from "./pages/MarketBrief";
import MarketBriefHome from "./pages/MarketBriefHome";
import Watchlist from "./pages/Watchlist";
import News from "./pages/News";
import Store from "./pages/Store";
import Support from "./pages/Support";
import ChillZone from "./pages/ChillZone";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MarketBriefHome />} />
            <Route path="/crypto" element={<Index />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/market-brief" element={<MarketBrief />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/news" element={<News />} />
            <Route path="/store" element={<Store />} />
            <Route path="/support" element={<Support />} />
            <Route path="/chill" element={<ChillZone />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
