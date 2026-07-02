import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AppShell } from "./layouts/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastContainer } from "./components/ui/ToastContainer";
import "./index.css";

export default function App() {
  return (
    <ErrorBoundary label="App error">
      <QueryClientProvider client={queryClient}>
        <AppShell />
        <ToastContainer />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
