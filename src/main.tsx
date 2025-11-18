import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "./contexts/AuthContext";
import { RequireAuth } from "./components/RequireAuth";

import "./App.css";
import App from "./pages/App";
import People from "./pages/People";
import Person from "./pages/Person";
import Review from "./pages/Review";
import Login from "./pages/Login"; // <--- add this


const router = createBrowserRouter([
  // Public route: login
  {
    path: "/login",
    element: <Login />,
  },

  // Protected routes
  {
    path: "/",
    element: (
      <RequireAuth>
        <App />
      </RequireAuth>
    ),
  },
  {
    path: "/people",
    element: (
      <RequireAuth>
        <People />
      </RequireAuth>
    ),
  },
  {
    // if your Person links use /people/:id, use this:
    path: "/people/:id",
    element: (
      <RequireAuth>
        <Person />
      </RequireAuth>
    ),
  },
  {
    path: "/review",
    element: (
      <RequireAuth>
        <Review />
      </RequireAuth>
    ),
  },
]);

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);


