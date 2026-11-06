import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = (offlineDocument = false) => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient, offlineDocument },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
