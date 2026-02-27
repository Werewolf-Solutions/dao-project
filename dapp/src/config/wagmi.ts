import { createConfig, http, injected } from "wagmi";
import { sepolia, localhost, foundry } from "wagmi/chains";

export const config = createConfig({
	chains: [sepolia, localhost, foundry],
	connectors: [injected()],
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
