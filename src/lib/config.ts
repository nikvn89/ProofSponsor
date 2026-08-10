export const CONTRACT_ADDRESS =
  (import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}` | undefined) ??
  '0x3Aa42FdD6EC0299c4172aaB47C4f0586625736bC'

export const STUDIO_RPC =
  (import.meta.env.VITE_STUDIO_RPC as string | undefined) ??
  '/genlayer-rpc'

export const EXPLORER_BASE =
  'https://explorer-studio.genlayer.com'