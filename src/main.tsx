import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initMetaPixel } from "./services/pixel";
import "./index.css";

void initMetaPixel();

createRoot(document.getElementById("root")!).render(<App />);
