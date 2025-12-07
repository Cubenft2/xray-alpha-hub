import { lazy, Suspense } from "react";
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
import { PageSkeleton } from "./components/PageSkeleton";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Critical path - keep eager (homepage)
import MarketBriefHome from "./pages/MarketBriefHome";

// Lazy load all other pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Markets = lazy(() => import("./pages/Markets"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const News = lazy(() => import("./pages/News"));
const Store = lazy(() => import("./pages/Store"));
const Support = lazy(() => import("./pages/Support"));
const ChillZone = lazy(() => import("./pages/ChillZone"));
const About = lazy(() => import("./pages/About"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const AuthorXRay = lazy(() => import("./pages/AuthorXRay"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminIndex = lazy(() => import("./pages/Admin/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const CryptoUniverse = lazy(() => import("./pages/CryptoUniverse"));
const CryptoUniverseDetail = lazy(() => import("./pages/CryptoUniverseDetail"));
const ZombieDog = lazy(() => import("./pages/ZombieDog"));

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
                <Suspense fallback={<PageSkeleton />}>
                  <Routes>
                    <Route path="/" element={<MarketBriefHome />} />
                    <Route path="/marketbrief/:date" element={<MarketBriefHome />} />
                    <Route path="/crypto" element={<Index />} />
                    <Route path="/markets" element={<Markets />} />
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
                    <Route path="/crypto-universe" element={<CryptoUniverse />} />
                    <Route path="/crypto-universe/:symbol" element={<CryptoUniverseDetail />} />
                    <Route path="/zombiedog" element={<ZombieDog />} />
                    <Route path="/admin" element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminIndex />
                      </ProtectedRoute>
                    } />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </PageTransition>
            </Layout>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
