import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { reconnect } from "wagmi/actions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AaveProvider } from "@aave/react";
import { config } from "@/config/wagmi";
import { aaveClient } from "@/config/aave";
import { ChainProvider } from "@/contexts/ChainContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import App from "./App";
import Home from "@/pages/Home";
import TokenSale from "@/pages/TokenSale";
import DAO from "@/pages/DAO";
import Staking from "@/pages/Staking";
import Account from "@/pages/Account";
import Companies from "@/pages/Companies";
import DeFi from "@/pages/DeFi";
import ErrorPage from "@/pages/ErrorPage";
import "./index.css";

reconnect(config);

// Reload the page when MetaMask switches networks so all contract addresses and reads refresh cleanly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof window !== 'undefined' && (window as any).ethereum) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(window as any).ethereum.on('chainChanged', () => window.location.reload());
}

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
			{ path: "/companies-house", element: <Companies /> },
			{ path: "/defi/:companyId", element: <DeFi /> },
		],
	},
]);

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<WagmiProvider config={config}>
			<QueryClientProvider client={queryClient}>
				<AaveProvider client={aaveClient}>
					<ThemeProvider>
						<ChainProvider>
							<RouterProvider router={router} />
						</ChainProvider>
					</ThemeProvider>
				</AaveProvider>
			</QueryClientProvider>
		</WagmiProvider>
	</StrictMode>,
);
