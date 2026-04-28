import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import POSScreen from "@/components/POSScreen";
import ProductionScanner from "@/components/ProductionScanner";
import CourierDashboard from "@/components/CourierDashboard";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="App grain">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<POSScreen />} />
          <Route path="/production" element={<ProductionScanner />} />
          <Route path="/courier" element={<CourierDashboard />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{
          style: {
            background: "#1A1A1A",
            border: "1px solid rgba(255,215,0,0.3)",
            color: "#FFD700",
            fontFamily: "Poppins, sans-serif",
          },
        }}
      />
    </div>
  );
}

export default App;
