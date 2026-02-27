import {
	createContext,
	useContext,
	useState,
	useMemo,
	useEffect,
	useCallback,
	type ReactNode,
} from "react";
import { useAccount } from "wagmi";
import { getBalance, readContract, getPublicClient } from "@wagmi/core";
import { config } from "@/config/wagmi";
import { werewolfTokenABI, erc20ABI, tokenSaleABI, lpStakingABI, getAddress } from "@/contracts";
import type { GetBalanceReturnType } from "@wagmi/core";

interface ChainContextValue {
	ETHBalance: GetBalanceReturnType | null;
	tokenBalance: string | null;
	tokenTotSupply: string | null;
	loadContracts: () => Promise<void>;
}

const ChainContext = createContext<ChainContextValue | null>(null);

function formatTokenAmount(rawBig: bigint, decimalsInt: number): string {
	const rawStr = rawBig.toString();
	let readable: string;
	if (rawStr.length > decimalsInt) {
		const whole = rawStr.slice(0, -decimalsInt);
		const frac = rawStr.slice(-decimalsInt);
		readable = `${whole}.${frac}`.replace(/\.?0+$/, "");
	} else {
		const frac = rawStr.padStart(decimalsInt, "0");
		readable = `0.${frac}`.replace(/\.?0+$/, "");
	}
	return readable;
}

export function ChainProvider({ children }: { children: ReactNode }) {
	const account = useAccount();

	const [ETHBalance, setETHBalance] = useState<
		GetBalanceReturnType | undefined
	>(undefined);
	const [tokenBalance, setTokenBalance] = useState<string | undefined>(
		undefined,
	);
	const [tokenTotSupply, setTokenTotSupply] = useState<string | undefined>(
		undefined,
	);

	const loadContracts = useCallback(async () => {
		if (!account.address || !account.chainId) return;

		const wlfAddress = getAddress(account.chainId, "WerewolfToken");

		// ETH balance
		try {
			const bal = await getBalance(config, {
				address: account.address,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				chainId: account.chainId as any,
			});

			setETHBalance(bal);
		} catch (e) {
			console.error("Error fetching ETH balance:", e);
		}

		if (!wlfAddress) return;

		// ── Diagnostic: verify contract is actually deployed ──────────────────
		console.group("[WLF] Contract check");
		console.log("chainId   :", account.chainId);
		console.log("chain     :", account.chain?.name ?? "unknown");
		console.log("rpcUrls   :", account.chain?.rpcUrls);
		console.log("wlfAddress:", wlfAddress);
		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const client = getPublicClient(config, { chainId: account.chainId as any });
			const code = await client?.getCode({ address: wlfAddress });
			const hasCode = code && code !== "0x";
			console.log(
				"bytecode  :",
				hasCode
					? `${code!.slice(0, 20)}… (${code!.length} chars)`
					: "0x  ← NO CONTRACT HERE — run `make deploy-local`",
			);
		} catch (e) {
			console.error("getCode failed:", e);
		}
		try {
			const supply = await readContract(config, {
				abi: werewolfTokenABI,
				address: wlfAddress,
				functionName: "totalSupply",
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				chainId: account.chainId as any,
			});
			console.log("totalSupply (raw):", supply.toString());
		} catch (e) {
			console.error("totalSupply() failed:", e);
		}
		console.groupEnd();

		// ── Diagnostic: verify USDT contract ─────────────────────────────────
		const usdtAddress = getAddress(account.chainId, "USDT");
		console.group("[USDT] Contract check");
		console.log("usdtAddress:", usdtAddress ?? "not configured for this chain");
		if (usdtAddress) {
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const usdtClient = getPublicClient(config, { chainId: account.chainId as any });
				const usdtCode = await usdtClient?.getCode({ address: usdtAddress });
				const hasUsdtCode = usdtCode && usdtCode !== "0x";
				console.log(
					"bytecode   :",
					hasUsdtCode
						? `${usdtCode!.slice(0, 20)}… (${usdtCode!.length} chars)`
						: "0x  ← NO CONTRACT HERE",
				);
			} catch (e) {
				console.error("getCode failed:", e);
			}
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const usdtDecimals = await readContract(config, { abi: erc20ABI, address: usdtAddress, functionName: "decimals", chainId: account.chainId as any });
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const usdtBalance = await readContract(config, { abi: erc20ABI, address: usdtAddress, functionName: "balanceOf", args: [account.address], chainId: account.chainId as any });
				console.log("decimals   :", usdtDecimals.toString());
				console.log("your balance:", formatTokenAmount(usdtBalance, usdtDecimals));
			} catch (e) {
				console.error("USDT read failed:", e);
			}
		}
		console.groupEnd();

		// ── Diagnostic: LP staking pipeline ──────────────────────────────────
		const tokenSaleAddress = getAddress(account.chainId, 'TokenSale');
		const lpStakingAddress = getAddress(account.chainId, 'LPStaking');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const chainIdArg = account.chainId as any;

		console.group('[TokenSale] End-sale state');
		console.log('tokenSaleAddress:', tokenSaleAddress ?? 'not configured');
		console.log('lpStakingAddress:', lpStakingAddress ?? 'not configured');
		if (tokenSaleAddress) {
			try {
				const saleId = await readContract(config, {
					abi: tokenSaleABI, address: tokenSaleAddress,
					functionName: 'saleIdCounter', chainId: chainIdArg,
				});
				const saleActive = await readContract(config, {
					abi: tokenSaleABI, address: tokenSaleAddress,
					functionName: 'saleActive', chainId: chainIdArg,
				});
				console.log('saleIdCounter:', saleId.toString());
				console.log('saleActive   :', saleActive);

				for (let id = 0n; id <= saleId; id++) {
					console.group(`  Sale #${id}`);
					const [wlfCollected, usdtCollected, ethCollected, usdtWlf,
						lpCreated, ethLpCreated, lpTokenId, ethLpTokenId] = await Promise.all([
						readContract(config, { abi: tokenSaleABI, address: tokenSaleAddress, functionName: 'saleWLFCollected',     args: [id], chainId: chainIdArg }),
						readContract(config, { abi: tokenSaleABI, address: tokenSaleAddress, functionName: 'saleUSDTCollected',    args: [id], chainId: chainIdArg }),
						readContract(config, { abi: tokenSaleABI, address: tokenSaleAddress, functionName: 'saleETHCollected',     args: [id], chainId: chainIdArg }),
						readContract(config, { abi: tokenSaleABI, address: tokenSaleAddress, functionName: 'saleUSDTWLFCollected', args: [id], chainId: chainIdArg }),
						readContract(config, { abi: tokenSaleABI, address: tokenSaleAddress, functionName: 'saleLPCreated',        args: [id], chainId: chainIdArg }),
						readContract(config, { abi: tokenSaleABI, address: tokenSaleAddress, functionName: 'saleLPETHCreated',     args: [id], chainId: chainIdArg }),
						readContract(config, { abi: tokenSaleABI, address: tokenSaleAddress, functionName: 'saleLPTokenId',        args: [id], chainId: chainIdArg }),
						readContract(config, { abi: tokenSaleABI, address: tokenSaleAddress, functionName: 'saleLPTokenIdETH',     args: [id], chainId: chainIdArg }),
					]);
					console.log('WLF collected    :', formatTokenAmount(wlfCollected, 18));
					console.log('USDT collected   :', formatTokenAmount(usdtCollected, 6));
					console.log('ETH collected    :', formatTokenAmount(ethCollected, 18));
					console.log('WLF paired w/USDT:', formatTokenAmount(usdtWlf, 18));
					console.log('USDT LP created  :', lpCreated,    '→ NFT #' + lpTokenId.toString());
					console.log('ETH  LP created  :', ethLpCreated, '→ NFT #' + ethLpTokenId.toString());
					if (account.address) {
						const purchase = await readContract(config, {
							abi: tokenSaleABI, address: tokenSaleAddress,
							functionName: 'purchases', args: [id, account.address], chainId: chainIdArg,
						});
						console.log('your purchase    :', formatTokenAmount(purchase, 18), 'WLF');
					}
					console.groupEnd();
				}
			} catch (e) {
				console.error('TokenSale read failed:', e);
			}
		}
		console.groupEnd();

		console.group('[LPStaking] Position state');
		console.log('lpStakingAddress:', lpStakingAddress ?? 'not configured');
		if (lpStakingAddress && tokenSaleAddress) {
			try {
				const tsPtr = await readContract(config, {
					abi: lpStakingABI, address: lpStakingAddress,
					functionName: 'tokenSaleContract', chainId: chainIdArg,
				});
				console.log('tokenSaleContract ptr:', tsPtr,
					tsPtr?.toLowerCase() === tokenSaleAddress.toLowerCase() ? '✓ matches' : '✗ MISMATCH!');

				const saleId = await readContract(config, {
					abi: tokenSaleABI, address: tokenSaleAddress,
					functionName: 'saleIdCounter', chainId: chainIdArg,
				});

				for (let id = 0n; id <= saleId; id++) {
					console.group(`  Sale #${id} LP positions`);
					const [usdtPos, ethPos, shares, totalWlf] = await Promise.all([
						readContract(config, { abi: lpStakingABI, address: lpStakingAddress, functionName: 'lpPositions',    args: [id], chainId: chainIdArg }),
						readContract(config, { abi: lpStakingABI, address: lpStakingAddress, functionName: 'ethLPPositions', args: [id], chainId: chainIdArg }),
						readContract(config, { abi: lpStakingABI, address: lpStakingAddress, functionName: 'saleShares',     args: [id], chainId: chainIdArg }),
						readContract(config, { abi: lpStakingABI, address: lpStakingAddress, functionName: 'saleTotalWLF',   args: [id], chainId: chainIdArg }),
					]);
					// Access by index — named tuple labels are unreliable in this wagmi version
					console.log('USDT/WLF pool — tokenId:', usdtPos[0].toString(), '| wlf:', formatTokenAmount(usdtPos[1], 18), '| usdt:', formatTokenAmount(usdtPos[2], 6),  '| liquidity:', usdtPos[3].toString(), '| initialized:', usdtPos[4]);
					console.log('ETH/WLF  pool — tokenId:', ethPos[0].toString(),  '| wlf:', formatTokenAmount(ethPos[1],  18), '| eth:',  formatTokenAmount(ethPos[2],  18), '| liquidity:', ethPos[3].toString(),  '| initialized:', ethPos[4]);
					console.log('saleShares   :', shares.toString());
					console.log('saleTotalWLF :', formatTokenAmount(totalWlf, 18));
					console.groupEnd();
				}

				if (account.address) {
					const [lpShares, earned] = await Promise.all([
						readContract(config, { abi: lpStakingABI, address: lpStakingAddress, functionName: 'balanceOf', args: [account.address], chainId: chainIdArg }),
						readContract(config, { abi: lpStakingABI, address: lpStakingAddress, functionName: 'earned',    args: [account.address], chainId: chainIdArg }),
					]);
					console.log('your LP shares:', lpShares.toString());
					console.log('your rewards  :', formatTokenAmount(earned, 18), 'WLF');
				}
			} catch (e) {
				console.error('LPStaking read failed:', e);
			}
		}
		console.groupEnd();
		// ─────────────────────────────────────────────────────────────────────

		// WLF balance
		try {
			const decimals = await readContract(config, {
				abi: werewolfTokenABI,
				address: wlfAddress,
				functionName: "decimals",
			});
			const rawBalance = await readContract(config, {
				abi: werewolfTokenABI,
				address: wlfAddress,
				functionName: "balanceOf",
				args: [account.address],
			});
			setTokenBalance(formatTokenAmount(rawBalance, Number(decimals)));
		} catch (e) {
			console.error("Error fetching WLF balance:", e);
		}

		// WLF total supply
		try {
			const decimals = await readContract(config, {
				abi: werewolfTokenABI,
				address: wlfAddress,
				functionName: "decimals",
			});
			const rawSupply = await readContract(config, {
				abi: werewolfTokenABI,
				address: wlfAddress,
				functionName: "totalSupply",
			});
			setTokenTotSupply(formatTokenAmount(rawSupply, Number(decimals)));
		} catch (e) {
			console.error("Error fetching WLF total supply:", e);
		}
	}, [account.address, account.chainId]);

	useEffect(() => {
		if (account.status === "connected") {
			void loadContracts();
		} else {
			setETHBalance(undefined);
			setTokenBalance(undefined);
			setTokenTotSupply(undefined);
		}
	}, [account.status, account.address, loadContracts]);

	const contextValue = useMemo<ChainContextValue>(
		() => ({
			loadContracts,
			tokenBalance: tokenBalance ?? null,
			tokenTotSupply: tokenTotSupply ?? null,
			ETHBalance: ETHBalance ?? null,
		}),
		[loadContracts, tokenBalance, ETHBalance, tokenTotSupply],
	);

	return (
		<ChainContext.Provider value={contextValue}>
			{children}
		</ChainContext.Provider>
	);
}

export function useChain(): ChainContextValue {
	const ctx = useContext(ChainContext);
	if (!ctx) throw new Error("useChain must be used within a ChainProvider");
	return ctx;
}
