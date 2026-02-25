import { createContext, useContext, useState, useMemo, useEffect, useCallback, type ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { getBalance, readContract } from '@wagmi/core';
import { config } from '@/config/wagmi';
import { werewolfTokenABI, getAddress } from '@/contracts';
import type { GetBalanceReturnType } from '@wagmi/core';

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
    readable = `${whole}.${frac}`.replace(/\.?0+$/, '');
  } else {
    const frac = rawStr.padStart(decimalsInt, '0');
    readable = `0.${frac}`.replace(/\.?0+$/, '');
  }
  return readable;
}

export function ChainProvider({ children }: { children: ReactNode }) {
  const account = useAccount();

  const [ETHBalance, setETHBalance] = useState<GetBalanceReturnType | undefined>(undefined);
  const [tokenBalance, setTokenBalance] = useState<string | undefined>(undefined);
  const [tokenTotSupply, setTokenTotSupply] = useState<string | undefined>(undefined);

  const loadContracts = useCallback(async () => {
    if (!account.address || !account.chainId) return;

    const wlfAddress = getAddress(account.chainId, 'WerewolfToken');

    // ETH balance
    try {
      const bal = await getBalance(config, {
        address: account.address,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chainId: account.chainId as any,
      });
      setETHBalance(bal);
    } catch (e) {
      console.error('Error fetching ETH balance:', e);
    }

    if (!wlfAddress) return;

    // WLF balance
    try {
      const decimals = await readContract(config, {
        abi: werewolfTokenABI,
        address: wlfAddress,
        functionName: 'decimals',
      });
      const rawBalance = await readContract(config, {
        abi: werewolfTokenABI,
        address: wlfAddress,
        functionName: 'balanceOf',
        args: [account.address],
      });
      setTokenBalance(formatTokenAmount(rawBalance, Number(decimals)));
    } catch (e) {
      console.error('Error fetching WLF balance:', e);
    }

    // WLF total supply
    try {
      const decimals = await readContract(config, {
        abi: werewolfTokenABI,
        address: wlfAddress,
        functionName: 'decimals',
      });
      const rawSupply = await readContract(config, {
        abi: werewolfTokenABI,
        address: wlfAddress,
        functionName: 'totalSupply',
      });
      setTokenTotSupply(formatTokenAmount(rawSupply, Number(decimals)));
    } catch (e) {
      console.error('Error fetching WLF total supply:', e);
    }
  }, [account.address, account.chainId]);

  useEffect(() => {
    if (account.status === 'connected') {
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

  return <ChainContext.Provider value={contextValue}>{children}</ChainContext.Provider>;
}

export function useChain(): ChainContextValue {
  const ctx = useContext(ChainContext);
  if (!ctx) throw new Error('useChain must be used within a ChainProvider');
  return ctx;
}
