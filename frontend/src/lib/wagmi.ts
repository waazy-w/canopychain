import { connectorsForWallets, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, type Config } from "wagmi";
import { hardhat, polygonAmoy } from "wagmi/chains";
import { IS_LOCAL_CHAIN, RPC_URL, WALLETCONNECT_PROJECT_ID } from "./config";

/** The chain the contract lives on: Polygon Amoy, or a local Hardhat node with NEXT_PUBLIC_CHAIN=local. */
export const targetChain = IS_LOCAL_CHAIN ? hardhat : polygonAmoy;

// Both ids are listed to satisfy wagmi's types; only targetChain is in `chains`, so only it is used.
const transports = { [polygonAmoy.id]: http(RPC_URL), [hardhat.id]: http(RPC_URL) };

// With a WalletConnect project id we offer RainbowKit's full wallet list. Without one, only
// injected browser wallets (MetaMask etc.), which need no project id.
export const wagmiConfig: Config = WALLETCONNECT_PROJECT_ID
  ? getDefaultConfig({
      appName: "CanopyChain",
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [targetChain],
      transports,
      ssr: true,
    })
  : createConfig({
      chains: [targetChain],
      transports,
      ssr: true,
      connectors: connectorsForWallets([{ groupName: "Browser wallet", wallets: [injectedWallet] }], {
        appName: "CanopyChain",
        projectId: "injected-only",
      }),
    });
