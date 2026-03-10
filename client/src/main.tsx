import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const originalFetch = window.fetch;
window.fetch = async (input, init) => {
    if (typeof input === 'string' && input.startsWith('/api')) {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        input = apiUrl + input;
    }
    return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
