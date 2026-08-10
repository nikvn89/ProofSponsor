const KEY='sponsorjudge:campaigns'
export function getRecentCampaigns():string[]{try{return JSON.parse(localStorage.getItem(KEY)??'[]')}catch{return []}}
export function rememberCampaign(id:string){const next=[id,...getRecentCampaigns().filter(x=>x!==id)].slice(0,8);localStorage.setItem(KEY,JSON.stringify(next));return next}
