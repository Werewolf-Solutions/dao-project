import { StrictMode, lazy, Suspense } from "react";
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
import ErrorPage from "@/pages/ErrorPage";

const Home = lazy(() => import("@/pages/Home"));
const TokenSale = lazy(() => import("@/pages/TokenSale"));
const DAO = lazy(() => import("@/pages/DAO"));
const Staking = lazy(() => import("@/pages/Staking"));
const Account = lazy(() => import("@/pages/Account"));
const Companies = lazy(() => import("@/pages/Companies"));
const DeFi = lazy(() => import("@/pages/DeFi"));
const Docs = lazy(() => import("@/pages/Docs"));
const Business = lazy(() => import("@/pages/Business"));
const WhitePaper = lazy(() => import("@/pages/WhitePaper"));
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
			{ path: "/companies-house/:companyId", element: <Business /> },
			{ path: "/defi/:companyId", element: <DeFi /> },
			{ path: "/docs", element: <Docs /> },
			{ path: "/whitepaper", element: <WhitePaper /> },
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
							<Suspense fallback={null}>
						<RouterProvider router={router} />
					</Suspense>
						</ChainProvider>
					</ThemeProvider>
				</AaveProvider>
			</QueryClientProvider>
		</WagmiProvider>
	</StrictMode>,
);
