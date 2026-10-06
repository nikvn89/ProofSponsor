export default function StatusPill({status=''}:{status?:string}){
 const s=status.toUpperCase(); const c=s==='APPROVED'||s==='ACTIVE'||s==='RESERVED'||s==='PAID'?'good':s==='REJECTED'?'bad':s==='UNAVAILABLE'||s==='UNDERFUNDED'?'warn':s==='SUBMITTED'?'pending':'neutral'
 return <span className={`pill ${c}`}>{status||'Unknown'}</span>
}
