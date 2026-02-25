import { createConfig, http } from 'wagmi';
import { sepolia, localhost } from 'wagmi/chains';

export const config = createConfig({
  chains: [sepolia, localhost],
  transports: {
    [sepolia.id]: http(),
    [localhost.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
