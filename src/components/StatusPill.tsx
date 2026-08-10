export default function StatusPill({status=''}:{status?:string}){
 const s=status.toUpperCase(); const c=s==='APPROVED'||s==='ACTIVE'?'good':s==='REJECTED'?'bad':s==='SUBMITTED'?'pending':'neutral'
 return <span className={`pill ${c}`}>{status||'Unknown'}</span>
}
