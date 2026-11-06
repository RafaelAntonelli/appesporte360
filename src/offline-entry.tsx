import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "@/router";
import "@/styles.css";

// Static, anonymous document; RouterProvider renders the exact requested URL.
const root = document.getElementById("offline-app");
if (root) createRoot(root).render(<RouterProvider router={getRouter(true)} />);