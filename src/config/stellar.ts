/*
 * SEP-0024 Hosted Deposit and Withdrawal Bridge configuration.
 * Enables fiat off-ramp payouts via Stellar anchors.
 */
export const SEP24_CONFIG = {
  enabled: (import.meta.env.VITE_SEP24_ENABLED as string) !== "false",
  anchorHomeDomain: import.meta.env.VITE_SEP24_ANCHOR_DOMAIN || "testanchor.stellar.org",
  anchorTomlUrl:
    import.meta.env.VITE_SEP24_ANCHOR_TOML_URL ||
    "https://testanchor.stellar.org/.well-known/stellar.toml",
  transferServerUrl:
    import.meta.env.VITE_SEP24_TRANSFER_SERVER_URL ||
    "https://testanchor.stellar.org/sep24",
  pollingIntervalMs: Number(import.meta.env.VITE_SEP24_POLL_INTERVAL_MS) || 5000,
  pollTimeoutMs: Number(import.meta.env.VITE_SEP24_POLL_TIMEOUT_MS) || 600000,
  defaultAssetCode: import.meta.env.VITE_SEP24_ASSET_CODE || "USDC",
  defaultAssetIssuer:
    import.meta.env.VITE_SEP24_ASSET_ISSUER ||
    "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT.AQH3ZLLFLA5",
  withdrawalTypes: ["bankaccount", "cash"] as const,
};

/**
 * Stellar & Soroban Network Configuration for StormSale
 */
export const STELLAR_CONFIG = {
  network: (import.meta.env.VITE_STELLAR_NETWORK as "TESTNET" | "PUBLIC") || "TESTNET",
  networkPassphrase:
    import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE ||
    "Test DF Network ; September 2015",
  rpcUrl: import.meta.env.VITE_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
  horizonUrl:
    import.meta.env.VITE_STELLAR_HORIZON_URL ||
    "https://horizon-testnet.stellar.org",
  explorerUrl: "https://stellar.expert/explorer/testnet",

  // Deployed Soroban Contract ID on Stellar Testnet
  contractId:
    import.meta.env.VITE_STORMSALE_CONTRACT_ID ||
    "CDLZFC3SYJYDZT7K67ZV75HPJVIEUVNIXF47ZG2FB2RMQUVU2HHGCYSC",

  nativeAsset: "XLM",
  nativeDecimals: 7,

  // SEP-0024 hosted deposit/withdrawal bridge (fiat off-ramp)
  sep24: SEP24_CONFIG,
};

export const STELLAR_NETWORKS = {
  TESTNET: {
    name: "Testnet",
    passphrase: "Test DF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
  },
  PUBLIC: {
    name: "Public (Mainnet)",
    passphrase: "Public Global Stellar Network ; September 2015",
    rpcUrl: "https://soroban-rpc.mainnet.stellar.org",
    horizonUrl: "https://horizon.stellar.org",
  },
};
