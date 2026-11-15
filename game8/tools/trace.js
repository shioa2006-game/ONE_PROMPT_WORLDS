// 自動プレイの追跡（node tools/trace.js <level> [from] [to] [step秒]）
const path=require('path');const Sim=require(path.join(__dirname,'..','js','sim.js'));
const orig=Sim.step;const li=+process.argv[2],from=+(process.argv[3]||0),to=+(process.argv[4]||60),every=+(process.argv[5]||1);
let last=-1;
Sim.step=function(s,inp,dt){orig(s,inp,dt);if(s.t>=from&&s.t<=to&&s.t-last>=every){last=s.t;
 const un=s.animals.filter(a=>!a.settled).map(a=>a.kind[0]+a.id+'('+a.x.toFixed(0)+','+a.y.toFixed(0)+(a.panic>0?'!':'')+(a.graze?'g':'')+')').join(' ');
 console.log(s.t.toFixed(1),'dog',s.dog.x.toFixed(0),s.dog.y.toFixed(0),'g'+s.dog.gait,'->',inp.tx.toFixed(0),inp.ty.toFixed(0),inp.dash?'D':'w','|',un);}};
const {run}=require('./bot.js');const L=require(path.join(__dirname,'..','js','levels.js'));
console.log(run(L[li],process.argv[7]||'smart',+(process.argv[6]||101),{maxT:to}));
