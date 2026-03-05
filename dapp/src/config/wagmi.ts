import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { sepolia, localhost, foundry } from "wagmi/chains";

export const config = createConfig({
	chains: [sepolia, localhost, foundry],
	connectors: [injected({ target: 'metaMask' })],
	multiInjectedProviderDiscovery: false,
	transports: {
		[sepolia.id]: http(),
		[localhost.id]: http(),
		[foundry.id]: http(),
	},
});

declare module "wagmi" {
	interface Register {
		config: typeof config;
	}
}
