const V1_CONTRACT_ADDRESS = '0x3Aa42FdD6EC0299c4172aaB47C4f0586625736bC'
const V2_CONTRACT_ADDRESS = '0xcD38Ed017A9cC3351C14c78c562bDB02194aE2bb'

export const CONTRACT_VERSION =
  (import.meta.env.VITE_CONTRACT_VERSION as string | undefined) ??
  '2'

export const CONTRACT_ADDRESS =
  (import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}` | undefined) ??
  V2_CONTRACT_ADDRESS

export const V2_CONFIG_ERROR =
  CONTRACT_VERSION === '2' &&
  CONTRACT_ADDRESS.toLowerCase() === V1_CONTRACT_ADDRESS.toLowerCase()

export const REVISION_ENABLED =
  CONTRACT_VERSION === '2' && !V2_CONFIG_ERROR

export const STUDIO_RPC =
  (import.meta.env.VITE_STUDIO_RPC as string | undefined) ??
  '/genlayer-rpc'

export const EXPLORER_BASE =
  'https://explorer-studio.genlayer.com'
