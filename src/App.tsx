import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChartLoadManagerProvider } from "@/contexts/ChartLoadManager";
import PageTransition from "./components/PageTransition";
import { Layout } from "./components/Layout";
import { CommunityPromotion } from "./components/CommunityPromotion";
import { SlidingBanner } from "./components/SlidingBanner";
import Index from "./pages/Index";
import Markets from "./pages/Markets";
import MarketBrief from "./pages/MarketBrief";
import MarketBriefHome from "./pages/MarketBriefHome";
import Watchlist from "./pages/Watchlist";
import News from "./pages/News";
import Store from "./pages/Store";
import Support from "./pages/Support";
import ChillZone from "./pages/ChillZone";
import About from "./pages/About";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
import AdminIndex from "./pages/Admin/Index";
import Auth from "./pages/Auth";
import { ProtectedRoute } from "./components/ProtectedRoute";

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
        <ChartLoadManagerProvider>
          <Toaster />
          <Sonner position="top-center" offset="120px" />
          <CommunityPromotion />
          <SlidingBanner />
          <BrowserRouter>
          <Layout>
            <PageTransition>
              <Routes>
                <Route path="/" element={<MarketBriefHome />} />
                <Route path="/crypto" element={<Index />} />
                <Route path="/markets" element={<Markets />} />
                <Route path="/market-brief" element={<MarketBrief />} />
                <Route path="/marketbrief/:date" element={<MarketBriefHome />} />
                <Route path="/watchlist" element={<Watchlist />} />
                <Route path="/news" element={<News />} />
                <Route path="/store" element={<Store />} />
                <Route path="/support" element={<Support />} />
                <Route path="/chill" element={<ChillZone />} />
                <Route path="/about" element={<About />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/admin" element={
                  <ProtectedRoute requireAdmin={true}>
                    <AdminIndex />
                  </ProtectedRoute>
                } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </PageTransition>
          </Layout>
        </BrowserRouter>
        </ChartLoadManagerProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
