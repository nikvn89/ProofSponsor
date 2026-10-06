const V1_CONTRACT_ADDRESS = '0x3Aa42FdD6EC0299c4172aaB47C4f0586625736bC'
const V2_CONTRACT_ADDRESS = '0xcD38Ed017A9cC3351C14c78c562bDB02194aE2bb'
const V3_CONTRACT_ADDRESS = '0x5f9950BCe63AcAb1b5DF02f0231A645fcbB74e0A'
const V4_CONTRACT_ADDRESS = '0x2cA205dF7F2AD3B6D87eE07439864db76d841a2b'

export const CONTRACT_VERSION =
  (import.meta.env.VITE_CONTRACT_VERSION as string | undefined) ??
  '4'

export const CONTRACT_ADDRESS =
  (import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}` | undefined) ??
  (CONTRACT_VERSION === '3' ? V3_CONTRACT_ADDRESS : V4_CONTRACT_ADDRESS)

const isOneOf = (addresses: string[]) =>
  addresses.some((address) => address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase())

export const V2_CONFIG_ERROR =
  CONTRACT_VERSION === '2' && isOneOf([V1_CONTRACT_ADDRESS])

export const V3_CONFIG_ERROR =
  CONTRACT_VERSION === '3' && isOneOf([V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS, '0x0000000000000000000000000000000000000000'])

// V4 holds money: it must never be pointed at an older contract that has no treasury.
export const V4_CONFIG_ERROR =
  CONTRACT_VERSION === '4' &&
  isOneOf([V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS, V3_CONTRACT_ADDRESS, '0x0000000000000000000000000000000000000000'])

export const CONFIG_ERROR = V3_CONFIG_ERROR || V4_CONFIG_ERROR

export const REVISION_ENABLED =
  (CONTRACT_VERSION === '2' && !V2_CONFIG_ERROR) ||
  (CONTRACT_VERSION === '3' && !V3_CONFIG_ERROR) ||
  (CONTRACT_VERSION === '4' && !V4_CONFIG_ERROR)

export const TREASURY_ENABLED = CONTRACT_VERSION === '4' && !V4_CONFIG_ERROR

export const STUDIO_RPC =
  (import.meta.env.VITE_STUDIO_RPC as string | undefined) ??
  '/genlayer-rpc'

// Public RPC handed to the wallet when StudioNet is not yet in its network list.
export const WALLET_ADD_RPC = 'https://studio.genlayer.com/api'
export const STUDIONET_CHAIN_ID = 61999

export const EXPLORER_BASE =
  'https://explorer-studio.genlayer.com'
