import { connectorsForWallets, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, type Config } from "wagmi";
import { polygonAmoy } from "wagmi/chains";
import { AMOY_RPC_URL, WALLETCONNECT_PROJECT_ID } from "./config";

export const amoy = polygonAmoy;

const transports = { [polygonAmoy.id]: http(AMOY_RPC_URL) };

// With a WalletConnect project id we offer RainbowKit's full wallet list. Without one, only
// injected browser wallets (MetaMask etc.), which need no project id.
export const wagmiConfig: Config = WALLETCONNECT_PROJECT_ID
  ? getDefaultConfig({
      appName: "CanopyChain",
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [polygonAmoy],
      transports,
      ssr: true,
    })
  : createConfig({
      chains: [polygonAmoy],
      transports,
      ssr: true,
      connectors: connectorsForWallets([{ groupName: "Browser wallet", wallets: [injectedWallet] }], {
        appName: "CanopyChain",
        projectId: "injected-only",
      }),
    });
