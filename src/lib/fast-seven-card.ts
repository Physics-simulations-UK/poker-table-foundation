import type { Card, Rank } from "@/lib/poker";

const ranks:Record<Rank,number>={"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,J:11,Q:12,K:13,A:14};
const suits={spades:0,hearts:1,diamonds:2,clubs:3} as const;
function straight(mask:number):number {
  if(mask&(1<<14)) mask|=1<<1;
  for(let high=14;high>=5;high--){
    const five=31<<(high-4);
    if((mask&five)===five) return high;
  }
  return 0;
}
function score(category:number,values:number[]):number {
  let n=category;
  for(let i=0;i<5;i++) n=n*15+(values[i]??0);
  return n;
}
/** Allocation-light seven-card ranking for exhaustive equity; higher wins. */
export function fastSevenCardScore(cards:Card[]):number {
  if(cards.length!==7) throw new Error("Fast evaluator requires seven cards");
  const counts=new Array<number>(15).fill(0);
  const suitCounts=[0,0,0,0];
  const suitMasks=[0,0,0,0];
  let mask=0;
  for(const card of cards){
    const r=ranks[card.rank],s=suits[card.suit];
    counts[r]++;suitCounts[s]++;suitMasks[s]|=1<<r;mask|=1<<r;
  }
  const flushSuit=suitCounts.findIndex(n=>n>=5);
  if(flushSuit>=0){
    const sf=straight(suitMasks[flushSuit]);
    if(sf) return score(8,[sf]);
  }
  let quad=0,trip1=0,trip2=0,pair1=0,pair2=0;
  for(let r=14;r>=2;r--){
    if(counts[r]===4) quad=r;
    else if(counts[r]===3){if(!trip1)trip1=r;else trip2=r;}
    else if(counts[r]===2){if(!pair1)pair1=r;else pair2=r;}
  }
  if(quad){
    for(let r=14;r>=2;r--)if(r!==quad&&counts[r])return score(7,[quad,r]);
  }
  if(trip1&&(pair1||trip2))return score(6,[trip1,Math.max(pair1,trip2)]);
  if(flushSuit>=0){
    const top:number[]=[];
    for(let r=14;r>=2&&top.length<5;r--)if(suitMasks[flushSuit]&(1<<r))top.push(r);
    return score(5,top);
  }
  const st=straight(mask);
  if(st)return score(4,[st]);
  if(trip1){
    const top=[trip1];
    for(let r=14;r>=2&&top.length<3;r--)if(r!==trip1&&counts[r])top.push(r);
    return score(3,top);
  }
  if(pair2){
    const top=[pair1,pair2];
    for(let r=14;r>=2;r--)if(r!==pair1&&r!==pair2&&counts[r]){top.push(r);break;}
    return score(2,top);
  }
  if(pair1){
    const top=[pair1];
    for(let r=14;r>=2&&top.length<4;r--)if(r!==pair1&&counts[r])top.push(r);
    return score(1,top);
  }
  const top:number[]=[];
  for(let r=14;r>=2&&top.length<5;r--)if(counts[r])top.push(r);
  return score(0,top);
}
