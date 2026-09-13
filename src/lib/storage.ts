import { CONTRACT_ADDRESS } from './config'

const V1_ADDRESS = '0x3Aa42FdD6EC0299c4172aaB47C4f0586625736bC'
const KEY = CONTRACT_ADDRESS.toLowerCase() === V1_ADDRESS.toLowerCase()
  ? 'sponsorjudge:campaigns'
  : `sponsorjudge:campaigns:${CONTRACT_ADDRESS.toLowerCase()}`
export function getRecentCampaigns():string[]{try{return JSON.parse(localStorage.getItem(KEY)??'[]')}catch{return []}}
export function rememberCampaign(id:string){const next=[id,...getRecentCampaigns().filter(x=>x!==id)].slice(0,8);localStorage.setItem(KEY,JSON.stringify(next));return next}
