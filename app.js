const learners=[
 {name:'Maya Patel',id:'MP',color:'#eeeaff/#7568d9',status:'Present',score:92,last:'2 min ago'},
 {name:'Noah Williams',id:'NW',color:'#fff0e5/#d28755',status:'Present',score:78,last:'5 min ago'},
 {name:'Ava Chen',id:'AC',color:'#e5f7ef/#3a9c78',status:'Present',score:64,last:'8 min ago'},
 {name:'Liam Johnson',id:'LJ',color:'#e7f3ff/#5686b6',status:'Late',score:42,last:'12 min ago'},
 {name:'Sofia Garcia',id:'SG',color:'#ffebf0/#bf6c83',status:'Present',score:88,last:'15 min ago'},
 {name:'Ethan Brown',id:'EB',color:'#fff6dc/#b58d38',status:'Absent',score:0,last:'—'},
 {name:'Isabella Davis',id:'ID',color:'#e7f3ff/#5686b6',status:'Present',score:71,last:'18 min ago'},
 {name:'Oliver Wilson',id:'OW',color:'#eeeaff/#7568d9',status:'Present',score:53,last:'21 min ago'},
 {name:'Amara Okafor',id:'AO',color:'#fff0e5/#d28755',status:'Present',score:83,last:'23 min ago'},
 {name:'Lucas Martin',id:'LM',color:'#e5f7ef/#3a9c78',status:'Present',score:36,last:'28 min ago'},
 {name:'Priya Shah',id:'PS',color:'#ffebf0/#bf6c83',status:'Late',score:59,last:'31 min ago'},
 {name:'James Lee',id:'JL',color:'#fff6dc/#b58d38',status:'Present',score:76,last:'34 min ago'}
];
const body=document.querySelector('#rows'),count=document.querySelector('#count');
document.querySelector('#todayDate').textContent=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date());
function render(query=''){
 const found=learners.filter(x=>x.name.toLowerCase().includes(query.toLowerCase()));
 body.innerHTML=found.slice(0,6).map(x=>{const [bg,fg]=x.color.split('/'),level=x.score>=70?'High':x.score>=45?'Medium':'Low';return `<tr><td><div class="learner"><span class="student-avatar" style="background:${bg};color:${fg}">${x.id}</span>${x.name}</div></td><td><span class="status ${x.status.toLowerCase()}">${x.status}</span></td><td><div class="part"><span class="track"><i style="width:${x.score}%"></i></span><span class="${level.toLowerCase()}">${x.status==='Absent'?'—':`${level} · ${x.score}%`}</span></div></td><td>${x.last}</td><td><button class="dots" aria-label="More options">···</button></td></tr>`}).join('');
 count.textContent=query?`Showing ${found.length} matching learners`:'Showing 6 of 28 learners';
}
render();document.querySelector('#search').addEventListener('input',e=>render(e.target.value));
let timer;function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>el.classList.remove('show'),2400)}
document.querySelector('#allInsights').addEventListener('click',()=>toast('You’re viewing the available sample insights.'));
document.querySelector('#rosterLink').addEventListener('click',()=>toast('This demo includes 12 sample learners.'));
document.querySelector('#menu').addEventListener('click',()=>document.querySelector('#sidebar').classList.toggle('open'));
document.querySelectorAll('.sidebar nav a').forEach(link=>link.addEventListener('click',()=>{document.querySelectorAll('.sidebar nav a').forEach(x=>x.classList.remove('active'));link.classList.add('active');document.querySelector('#sidebar').classList.remove('open')}));
document.querySelectorAll('.outline').forEach(button=>button.addEventListener('click',()=>toast('This is a visual demo using sample data.')));
