import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing.tsx";
import ChatDemo from "./pages/ChatDemo.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Helios from "./pages/Helios.tsx";
import Mnemosyne from "./pages/Mnemosyne.tsx";
import Echo from "./pages/Echo.tsx";
import Hermes from "./pages/Hermes.tsx";
import Aletheia from "./pages/Aletheia.tsx";
import Companion from "./pages/Companion.tsx";
import NotFound from "./pages/NotFound.tsx";
import { TrustProvider } from "./components/TrustLayer.tsx";
import { ChatbotBubble } from "./components/ChatbotBubble.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <TrustProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/demo" element={<ChatDemo />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/helios" element={<Helios />} />
          <Route path="/mnemosyne" element={<Mnemosyne />} />
          <Route path="/echo" element={<Echo />} />
          <Route path="/hermes" element={<Hermes />} />
          <Route path="/aletheia" element={<Aletheia />} />
          <Route path="/companion" element={<Companion />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <ChatbotBubble />
      </BrowserRouter>
      </TrustProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
