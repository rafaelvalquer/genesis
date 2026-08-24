export function getConvoyCheckpointOptions(session) {
  const convoy=session?.convoy; const config=session?.phase?.convoy||{};
  if(!convoy||session.convoyFlow?.state!=="checkpointDecision"||session.convoyFlow.checkpointOptionChosen)return [];
  return [{id:"repair",label:"REPARAR BLINDAGEM",amount:Math.min(config.checkpointRewards?.repairHp||200,Math.max(0,convoy.maxHp-convoy.hp))},{id:"refill",label:"REABASTECER",amount:Math.min(config.checkpointRewards?.reserveAmount||40,Math.max(0,convoy.reserveMax-convoy.reserve))}];
}
export function applyConvoyCheckpointOption(session,optionId,events=[]) { const option=getConvoyCheckpointOptions(session).find(o=>o.id===optionId); if(!option)return{ok:false,reason:"A decisão logística já foi escolhida ou não está disponível."}; const c=session.convoy; if(optionId==="repair")c.hp=Math.min(c.maxHp,c.hp+option.amount); else c.reserve=Math.min(c.reserveMax,c.reserve+option.amount); session.convoyFlow.checkpointOptionChosen=true; session.convoyFlow.checkpointBriefingPending=false; events.push({type:"convoyCheckpointReward",optionId,amount:option.amount}); return{ok:true,optionId,amount:option.amount}; }
