import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/config/wagmi";
import { ChainProvider } from "@/contexts/ChainContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import App from "./App";
import Home from "@/pages/Home";
import TokenSale from "@/pages/TokenSale";
import DAO from "@/pages/DAO";
import Staking from "@/pages/Staking";
import Account from "@/pages/Account";
import ErrorPage from "@/pages/ErrorPage";
import "./index.css";

const queryClient = new QueryClient();

const router = createBrowserRouter([
	{
		path: "/",
		element: <App />,
		errorElement: <ErrorPage />,
		children: [
			{ path: "/", element: <Home /> },
			{ path: "/token-sale", element: <TokenSale /> },
			{ path: "/dao", element: <DAO /> },
			{ path: "/staking", element: <Staking /> },
			{ path: "/account", element: <Account /> },
		],
	},
]);

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<WagmiProvider config={config}>
			<QueryClientProvider client={queryClient}>
				<ThemeProvider>
					<ChainProvider>
						<RouterProvider router={router} />
					</ChainProvider>
				</ThemeProvider>
			</QueryClientProvider>
		</WagmiProvider>
	</StrictMode>,
);
