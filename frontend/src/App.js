import "@/App.css";
import POSScreen from "@/components/POSScreen";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="App grain">
      <POSScreen />
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
