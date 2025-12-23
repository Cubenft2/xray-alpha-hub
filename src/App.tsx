import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PageTransition from "./components/PageTransition";
import { Layout } from "./components/Layout";
import { CommunityPromotion } from "./components/CommunityPromotion";
import ErrorBoundary from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";

// All pages imported eagerly to avoid dynamic import issues in corporate browsers
import MarketBriefHome from "./pages/MarketBriefHome";
import Index from "./pages/Index";
import Markets from "./pages/Markets";
import Watchlist from "./pages/Watchlist";
import News from "./pages/News";
import Store from "./pages/Store";
import Support from "./pages/Support";
import ChillZone from "./pages/ChillZone";
import About from "./pages/About";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import AuthorXRay from "./pages/AuthorXRay";
import NotFound from "./pages/NotFound";
import AdminIndex from "./pages/Admin/Index";
import Auth from "./pages/Auth";
import CryptoUniverseDetail from "./pages/CryptoUniverseDetail";
import Screener from "./pages/Screener";
import Favorites from "./pages/Favorites";
import StockScreener from "./pages/StockScreener";
import StockDetail from "./pages/StockDetail";
import WebSocketTest from "./pages/test/WebSocketTest";
import { Navigate } from "react-router-dom";
const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-center" offset="120px" />
          {import.meta.env.VITE_SHOW_PROMOS === 'true' && <CommunityPromotion />}
          <BrowserRouter>
            <Layout>
              <PageTransition>
                <Routes>
                  <Route path="/" element={<MarketBriefHome />} />
                  <Route path="/marketbrief/:date" element={<MarketBriefHome />} />
                  <Route path="/crypto" element={<Index />} />
                  <Route path="/markets" element={<Markets />} />
                  <Route path="/stocks" element={<StockScreener />} />
                  <Route path="/stock/:symbol" element={<StockDetail />} />
                  <Route path="/watchlist" element={<Watchlist />} />
                  <Route path="/news" element={<News />} />
                  <Route path="/store" element={<Store />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/chill" element={<ChillZone />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/author/xray" element={<AuthorXRay />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/crypto-universe" element={<Screener />} />
                  <Route path="/crypto-universe/:symbol" element={<CryptoUniverseDetail />} />
                  <Route path="/screener" element={<Navigate to="/crypto-universe" replace />} />
                  <Route path="/token/:symbol" element={<CryptoUniverseDetail />} />
                  <Route path="/favorites" element={<Favorites />} />
                  <Route path="/admin" element={
                    <ProtectedRoute requireAdmin={true}>
                      <AdminIndex />
                    </ProtectedRoute>
                  } />
                  <Route path="/test/websocket" element={<WebSocketTest />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </PageTransition>
            </Layout>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
