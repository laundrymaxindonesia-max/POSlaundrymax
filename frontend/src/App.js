import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import POSScreen from "@/components/POSScreen";
import ProductionScanner from "@/components/ProductionScanner";
import CourierDashboard from "@/components/CourierDashboard";
import AdminDashboard from "@/components/AdminDashboard";
import PipelineDashboard from "@/components/PipelineDashboard";
import AttendanceKiosk from "@/components/AttendanceKiosk";
import TrackingScreen from "@/components/TrackingScreen";
import AuthCallback from "@/components/auth/AuthCallback";
import OwnerProtectedRoute from "@/components/auth/OwnerProtectedRoute";
import StaffPinGate from "@/components/auth/StaffPinGate";
import { AuthProvider } from "@/lib/AuthContext";
import { Toaster } from "@/components/ui/sonner";

// Intercept Emergent Auth callback (#session_id=...) BEFORE normal routing runs.
function AppRouter() {
  const location = useLocation();
  if (location.hash && location.hash.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route
        path="/"
        element={
          <StaffPinGate>
            <POSScreen />
          </StaffPinGate>
        }
      />
      <Route
        path="/production"
        element={
          <StaffPinGate>
            <ProductionScanner />
          </StaffPinGate>
        }
      />
      <Route
        path="/courier"
        element={
          <StaffPinGate>
            <CourierDashboard />
          </StaffPinGate>
        }
      />
      <Route
        path="/tracking"
        element={
          <StaffPinGate>
            <TrackingScreen />
          </StaffPinGate>
        }
      />
      <Route path="/absen" element={<AttendanceKiosk />} />
      <Route
        path="/dashboard"
        element={
          <OwnerProtectedRoute loginNextPath="/dashboard">
            <PipelineDashboard />
          </OwnerProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <OwnerProtectedRoute loginNextPath="/admin">
            <AdminDashboard />
          </OwnerProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <div className="App grain">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
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
