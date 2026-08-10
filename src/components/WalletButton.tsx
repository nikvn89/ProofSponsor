import { Wallet } from 'lucide-react'
export default function WalletButton({account,onConnect,busy}:{account:string;onConnect:()=>void;busy?:boolean}){
 const short=account?`${account.slice(0,6)}…${account.slice(-4)}`:''
 return <button className="wallet" onClick={onConnect} disabled={busy}><Wallet size={17}/>{account?short:busy?'Connecting…':'Connect wallet'}</button>
}
