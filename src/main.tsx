import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./App.css";
import App from "./pages/App";
import People from "./pages/People";
import Person from "./pages/Person";
import Review from "./pages/Review";
import { supabase } from "../lib/supabaseClient";


const router = createBrowserRouter([
  { path: "/", element: <App /> },
  { path: "/people", element: <People /> },
  { path: "/person/:id", element: <Person /> },
  { path: "/review", element: <Review /> },
]);

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
