
let participants=[]
let matches=[]
let results=[]
let bonusPicks=[]
let bonusActual=[]

async function loadData(){
participants=await fetch("data/predictions.json").then(r=>r.json())
matches=await fetch("data/matches.json").then(r=>r.json())
results=await fetch("data/results.json").then(r=>r.json())
bonusPicks=await fetch("data/bonus_picks.json").then(r=>r.json())
bonusActual=await fetch("data/bonus_actual.json").then(r=>r.json())
initParticipants()
renderRanking()
renderAllMatches()
}

function initParticipants(){
const sel=document.getElementById("sel")
participants.forEach(p=>{
let o=document.createElement("option")
o.value=p.name
o.textContent=p.name
sel.appendChild(o)
})
sel.addEventListener("change",()=>showParticipant(sel.value))
}

function showParticipant(name){
const p=participants.find(x=>x.name===name)
if(!p)return
let matchPts=calcMatchPoints(p)
let bonus=calcBonus(p)
document.getElementById("s_name").textContent=p.name
document.getElementById("s_match").textContent=matchPts
document.getElementById("s_bonus").textContent=bonus
document.getElementById("s_total").textContent=matchPts+bonus
}

function calcMatchPoints(p){
let pts=0
p.predictions.forEach(pr=>{
let r=results.find(x=>x.matchId===pr.matchId)
if(!r)return
if(pr.home==r.home && pr.away==r.away) pts+=5
else if((pr.home-pr.away)==(r.home-r.away)) pts+=3
else if(Math.sign(pr.home-pr.away)==Math.sign(r.home-r.away)) pts+=2
})
return pts
}

function calcBonus(p){
let pts=0
bonusActual.forEach(b=>{
if(p.bonus.includes(b.team)) pts+=b.points
})
return pts
}

function renderRanking(){
let tbody=document.querySelector("#rankingTable tbody")
let arr=participants.map(p=>{
let mp=calcMatchPoints(p)
let b=calcBonus(p)
return {name:p.name,match:mp,bonus:b,total:mp+b}
})
arr.sort((a,b)=>b.total-a.total)
arr.forEach((p,i)=>{
let tr=document.createElement("tr")
tr.innerHTML=`<td>${i+1}</td><td>${p.name}</td><td>${p.match}</td><td>${p.bonus}</td><td>${p.total}</td>`
tbody.appendChild(tr)
})
}

function renderAllMatches(){
let stages=["grupos","dieciseisavos","octavos","cuartos","semifinal","tercero","final"]
stages.forEach(stage=>{
let container=document.getElementById("matches-"+stage)
if(!container)return
let ms=matches.filter(m=>m.stage===stage)
ms.forEach(m=>{
let div=document.createElement("div")
div.className="match"
div.innerHTML=`<strong>${m.home}</strong> vs <strong>${m.away}</strong>`
container.appendChild(div)
})
})
}

document.querySelectorAll(".tab").forEach(t=>{
t.onclick=()=>{
document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"))
document.querySelectorAll(".tabcontent").forEach(x=>x.classList.remove("active"))
t.classList.add("active")
document.getElementById(t.dataset.tab).classList.add("active")
}
})

loadData()
