import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { VoteSessionProvider } from "./context/VoteSessionContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <VoteSessionProvider>
      <App />
    </VoteSessionProvider>
  </React.StrictMode>
);