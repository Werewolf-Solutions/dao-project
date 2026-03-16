import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { mainnet, bsc, sepolia, baseSepolia, localhost, foundry } from "wagmi/chains";

export const config = createConfig({
	chains: [mainnet, bsc, sepolia, baseSepolia, localhost, foundry],
	connectors: [injected({ target: 'metaMask' })],
	multiInjectedProviderDiscovery: false,
	transports: {
		[mainnet.id]: http(),
		[bsc.id]: http(),
		[sepolia.id]: http(),
		[baseSepolia.id]: http(),
		[localhost.id]: http(),
		[foundry.id]: http(),
	},
});

declare module "wagmi" {
	interface Register {
		config: typeof config;
	}
}
