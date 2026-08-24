import React,{useEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {supabase} from './supabase'
import {Heart,MessageCircle,Sparkles,Send,Copy,Moon,Sun,ArrowLeft,Reply,Trash2} from 'lucide-react'
import './style.css'

const appreciation=[
['💗','Thank you for understanding me','You somehow understand the things I don’t always know how to explain.'],
['🌷','Thank you for your time','I know your time is valuable, so I really appreciate every moment you choose to spend talking to me.'],
['✨','Thank you for listening','Sometimes I just need someone who listens, and I’m really glad I can talk to you.'],
['😊','Thank you for making me smile','Some conversations are ordinary, but somehow talking to you makes them special.'],
['🫶','One more thing...','I’m genuinely happy that I got to know you.']
]
const starters=['How was your day? 🌷','Tell me something random.','What’s on your mind? 👀','Ask me anything.','I have something to tell you...']
const reactions=['❤️','😂','🥹','😭','😏','🫶','✨']

function App(){
 const [name,setName]=useState(localStorage.getItem('ols-name')||'')
 const [started,setStarted]=useState(!!localStorage.getItem('ols-name'))
 const [tab,setTab]=useState('letter'),[dark,setDark]=useState(false),[opened,setOpened]=useState(false)
 const [expanded,setExpanded]=useState(null),[room,setRoom]=useState(null),[roomInput,setRoomInput]=useState('')
 const [createCode,setCreateCode]=useState('')
const [privateRoom,setPrivateRoom]=useState(false)
const [createPassword,setCreatePassword]=useState('')
const [joinPassword,setJoinPassword]=useState('')
 const [messages,setMessages]=useState([]),[text,setText]=useState(''),[replyTo,setReplyTo]=useState(null),[showExtras,setShowExtras]=useState(false)
 const [user,setUser]=useState(null),[status,setStatus]=useState('Connecting...'),[error,setError]=useState('')
 const [mood,setMood]=useState(localStorage.getItem('ols-mood')||'😊 Happy')
 const [notificationsEnabled,setNotificationsEnabled]=useState(
  typeof Notification !== 'undefined' && Notification.permission === 'granted'
)

async function enableNotifications(){
  if(!('Notification' in window)){
    setError('Notifications are not supported by this browser.')
    return
  }

  const permission=await Notification.requestPermission()

  if(permission==='granted'){
    setNotificationsEnabled(true)
    new Notification('Our Little Space 💗',{
      body:'Notifications are now enabled!'
    })
  }else{
    setError('Notifications were not allowed.')
  }
}
 const channelRef=useRef(null)

 useEffect(()=>{localStorage.setItem('ols-mood',mood)},[mood])

 useEffect(()=>{
   if(!started)return
   let mounted=true
   ;(async()=>{
     const {data}=await supabase.auth.getSession()
     if(!mounted)return
     if(data.session){setUser(data.session.user);setStatus('Ready')}
     else {
       const {data:d,error:e}=await supabase.auth.signInAnonymously()
       if(e){setError('Anonymous sign-in is not enabled in Supabase.');setStatus('Offline')}
       else {setUser(d.user);setStatus('Ready')}
     }
   })()
   return()=>{mounted=false}
 },[started])

 async function loadRoom(r){
   setRoom(r);setError('')
   const {data,error}=await supabase.from('messages').select('*').eq('room_id',r.id).order('created_at',{ascending:true})
   if(error){setError(error.message);return}
   setMessages(data||[])
   if(channelRef.current)await supabase.removeChannel(channelRef.current)
  const ch=supabase.channel('room-'+r.id)
  .on(
    'postgres_changes',
    {
      event:'INSERT',
      schema:'public',
      table:'messages',
      filter:`room_id=eq.${r.id}`
    },
    payload=>{
      setMessages(prev =>
        prev.some(x=>x.id===payload.new.id)
          ? prev
          : [...prev,payload.new]
      )

      // 🔔 Show notification for messages from the other person
      if(
        payload.new.user_id !== user?.id &&
        'Notification' in window &&
        Notification.permission === 'granted' &&
        document.visibilityState !== 'visible'
      ){
        new Notification(
          `${payload.new.display_name} 💗`,
          {
            body: payload.new.body,
            icon: '/favicon.ico'
          }
        )
      }
    }
  )
  .on(
    'postgres_changes',
    {
      event:'DELETE',
      schema:'public',
      table:'messages',
      filter:`room_id=eq.${r.id}`
    },
    payload=>{
      setMessages(prev =>
        prev.filter(x=>x.id!==payload.old.id)
      )
    }
  )
  .subscribe(s=>{
    if(s==='SUBSCRIBED'){
      setStatus('Online')
    }
  })
   channelRef.current=ch
 }async function createRoom(){

  if(!user){
    return setError('Still connecting. Try again in a moment.')
  }

  const code = createCode.trim().toUpperCase()

  if(!code){
    return setError('Please enter a room code.')
  }

  if(code.length < 4){
    return setError('Room code must be at least 4 characters.')
  }
if(privateRoom && !createPassword.trim()){
  return setError('Please enter a password for your private room.')
}

  const {data,error} = await supabase.rpc(
    'create_room',
    {
      p_code: code,
      p_display_name: name,
      p_is_private: privateRoom,
     p_password: privateRoom ? createPassword : null
    }
  )

  if(error){

    if(error.message.includes('ROOM_CODE_TAKEN')){
      return setError('This room code is already taken. Try another one.')
    }

    setError(error.message)
    return
  }

  localStorage.setItem('ols-room',data.id)

  await loadRoom(data)
}

 async function joinRoom(){

  if(!user){
    return setError('Still connecting. Try again in a moment.')
  }

  const code = roomInput.trim().toUpperCase()

  if(!code){
    return setError('Please enter a room code.')
  }

  const {data,error} = await supabase.rpc(
    'join_room',
    {
      p_code: code,
      p_display_name: name,
     p_password: joinPassword || null
    }
  )

  if(error){

    if(error.message.includes('ROOM_NOT_FOUND')){
      return setError('Room not found. Check the code.')
    }

    if(error.message.includes('WRONG_PASSWORD')){
      return setError('Incorrect password 🔒')
    }

    setError(error.message)
    return
  }

  localStorage.setItem('ols-room',data.id)

  await loadRoom(data)
}
 async function send(value=text){
   if(!value.trim()||!room||!user)return
   const {error}=await supabase.from('messages').insert({room_id:room.id,user_id:user.id,display_name:name||'Someone',body:value.trim(),reply_to:replyTo?.id||null})
   if(error)setError(error.message)
   else {setText('');setReplyTo(null)}
 }
 async function removeMessage(id){await supabase.from('messages').delete().eq('id',id)}
 async function react(messageId,emoji){
   const {data}=await supabase.from('message_reactions').select('*').eq('message_id',messageId).eq('user_id',user.id).eq('reaction',emoji).maybeSingle()
   if(data)await supabase.from('message_reactions').delete().match({message_id:messageId,user_id:user.id,reaction:emoji})
   else await supabase.from('message_reactions').insert({message_id:messageId,user_id:user.id,reaction:emoji})
 }

 if(!started)return <div className="app"><main className="welcome"><div className="envelope">💌</div><p className="eyebrow">A tiny corner of the internet</p><h1>Hey, I made something<br/>for you...</h1><p className="sub">Just a little something I wanted to say.</p><div className="name-card"><label>What should I call you? 💗</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your name..." onKeyDown={e=>e.key==='Enter'&&name.trim()&& (localStorage.setItem('ols-name',name.trim()),setStarted(true))}/><button className="primary" onClick={()=>{if(name.trim()){localStorage.setItem('ols-name',name.trim());setStarted(true)}}}>Let's go <Sparkles size={16}/></button></div></main></div>

 return <div className={dark?'app dark':'app'}>
 <header><div><span className="brand-heart">♥</span>Our Little Space</div><button className="icon-btn" onClick={()=>setDark(!dark)}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button></header>
 {error&&<div className="error">{error}<button onClick={()=>setError('')}>×</button></div>}
 {tab==='letter'&&(!opened?<main className="letter intro"><div className="hero-envelope">💌</div><p className="eyebrow">For {name}</p><h1>There’s something<br/>I wanted to tell you.</h1><button className="primary" onClick={()=>setOpened(true)}>Open it <Heart size={17} fill="currentColor"/></button></main>:
 <main className="letter"><p className="eyebrow">A little note for you</p><h1>Thank You <span>♥</span></h1><div className="message-card">Thank you for understanding me, for giving me your time, and for being patient with me.<br/><br/>I genuinely appreciate all the little conversations, the laughs, and the moments you’ve shared with me.<br/><br/>You probably don’t realize it, but your time and attention mean more to me than you think.</div><div className="cards">{appreciation.map((a,i)=><button className="app-card" key={i} onClick={()=>setExpanded(expanded===i?null:i)}><span>{a[0]}</span><div><strong>{a[1]}</strong>{expanded===i&&<p>{a[2]}</p>}</div><b>{expanded===i?'−':'+'}</b></button>)}</div><div className="final"><p>One last thing...</p><h2>I’m genuinely glad you’re here. <span>♥</span></h2><button className="primary" onClick={()=>setTab('chat')}>Let's Talk <MessageCircle size={17}/></button></div></main>)}
 {tab==='chat'&&<main className="chat-page">{!room?
 <div className="room-card">

  <div className="mini-heart">♥</div>

  <h1>Our Little Chat</h1>

  <p>{status}</p>

  <input
    value={createCode}
    onChange={e=>setCreateCode(e.target.value.toUpperCase())}
    placeholder="Create your room code..."
    maxLength={20}
  />
  <label className="private-option">
  <input
    type="checkbox"
    checked={privateRoom}
    onChange={e=>setPrivateRoom(e.target.checked)}
  />
  🔒 Make this room private
</label>
{privateRoom && (
  <input
    type="password"
    value={createPassword}
    onChange={e=>setCreatePassword(e.target.value)}
    placeholder="Create a password..."
  />
)}

  <button className="primary full" onClick={createRoom}>
    Create a Little Room 💗
  </button>

  <div className="or">or</div>

  <input
    value={roomInput}
    onChange={e=>setRoomInput(e.target.value)}
    placeholder="Enter their room code..."
  />
  <input
  type="password"
  value={joinPassword}
  onChange={e=>setJoinPassword(e.target.value)}
  placeholder="Password (private rooms only)..."
/>

  <button
    className="secondary full"
    onClick={joinRoom}
  >
    Join a Room ✨
  </button>

 </div>
 :
 <div className="chat-shell">
 <div className="chat-head"><button
  className="back"
  title="Exit room"
  onClick={()=>{
    localStorage.removeItem('ols-room')
    setRoom(null)
    setMessages([])
    setTab('chat')
  }}
>
  <ArrowLeft size={19}/>
</button><div className="avatar">♥</div><div><strong>Our Little Chat</strong><small>● {status}</small></div><button className="copy" title="Copy room code" onClick={()=>navigator.clipboard?.writeText(room.code)}><Copy size={17}/></button></div><div className="room-code">Share code <b>{room.code}</b></div>
 <div className="messages">{messages.length===0?<div className="empty"><div>💗</div><h3>Our little chat is waiting.</h3><p>Start with something random...</p>{starters.slice(0,3).map(s=><button key={s} onClick={()=>setText(s)}>{s}</button>)}</div>:messages.map(m=><div className={'msg-wrap '+(m.user_id===user?.id?'mine':'')} key={m.id}><div className="msg"><small>{m.display_name}</small>{m.reply_to&&<div className="reply-preview">↩ replied to a message</div>}<div className="bubble">{m.body}</div><footer>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</footer><div className="reactions">{reactions.map(r=><button key={r} onClick={()=>react(m.id,r)}>{r}</button>)}</div></div><div className="msg-actions"><button onClick={()=>setReplyTo(m)}><Reply size={13}/></button>{m.user_id===user?.id&&<button onClick={()=>removeMessage(m.id)}><Trash2 size={13}/></button>}</div></div>)}</div>
 {replyTo&&<div className="replying">Replying to: <b>{replyTo.body}</b><button onClick={()=>setReplyTo(null)}>×</button></div>}
 <div className="composer"><button className="icon-btn" onClick={()=>setShowExtras(!showExtras)}><Sparkles size={19}/></button><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),send())} placeholder="Say something... 💭"/><button className="send" onClick={()=>send()}><Send size={18}/></button></div>
 {showExtras&&<div className="extras"><button onClick={()=>send('💌 A little note for you')}>💌 Note</button><button onClick={()=>send('❤️')}>❤️ Heart</button><button onClick={()=>send('🌷')}>🌷 Flower</button><button onClick={()=>send('✨')}>✨ Sparkles</button><button onClick={()=>send(starters[Math.floor(Math.random()*starters.length)])}>🎲 Random</button></div>}</div>}</main>}
{tab==='things'&&
<main className="things">

  <p className="eyebrow">
    For when we need something random
  </p>

  <h1>Little Things ✨</h1>


  {/* MOOD */}
  <div className="thing-card">
    <h3>😊 How are you feeling?</h3>

    <div className="moods">
      {[
        '😊 Happy',
        '🥹 Soft',
        '😴 Sleepy',
        '😏 Mischievous',
        '💗 Romantic',
        '😐 Just existing'
      ].map(x =>
        <button
          className={mood===x?'selected':''}
          key={x}
          onClick={()=>setMood(x)}
        >
          {x}
        </button>
      )}
    </div>

    <p className="tiny">
      Your mood: <b>{mood}</b>
    </p>
  </div>


  {/* RANDOM QUESTIONS */}
  <div className="thing-card">

    <h3>💭 Random Questions</h3>

    <p className="random-question">
      What is the most unpredictable thing you've done recently?
    </p>

    <button
      className="secondary"
      onClick={() => {

        const questions = [

          "What is the most unpredictable thing you've done recently?",
          "What's something you've always wanted to do but never told anyone?",
          "What's a random memory that still makes you smile?",
          "If you could disappear for 24 hours, where would you go?",
          "What's something small that instantly makes your day better?",
          "What's the weirdest compliment you've ever received?",
          "What's something you wish people understood about you?",
          "What's one thing you could talk about for hours?",
          "What's the most spontaneous decision you've ever made?",
          "What's something you've done that you would definitely do again?",
          "What's a place you'd love to visit with someone special?",
          "What's one thing that can always make you laugh?",
          "What's a completely random skill you'd love to learn?",
          "What's the nicest thing someone has ever done for you?",
          "What's something you're secretly really good at?",
          "What's one moment from your life you'd love to experience again?",
          "What's something you used to hate but now love?",
          "What's your biggest 'I can't believe I actually did that' moment?",
          "What's something that instantly makes you comfortable around someone?",
          "If you could relive one day of your life, which day would it be?"

        ];

        const random =
          questions[Math.floor(Math.random() * questions.length)];

        document.querySelector('.random-question').textContent = random;

      }}
    >
      🎲 Give me another question
    </button>

  </div>


  {/* FUNNY QUESTIONS */}
  <div className="thing-card">

    <h3>😂 Stupidly Funny Questions</h3>

    <p className="funny-question">
      If animals could text, which animal would leave you on seen?
    </p>

    <button
      className="secondary"
      onClick={() => {

        const funnyQuestions = [

          "If animals could text, which animal would leave you on seen?",
          "If you had to fight one food, which food are you choosing?",
          "What's the dumbest thing you've ever confidently believed?",
          "If your life had a warning label, what would it say?",
          "Which fictional character would be the worst roommate?",
          "If you became invisible for one hour, what is the first harmless thing you'd do?",
          "What's the weirdest thing you've ever searched on Google?",
          "If your pet could expose one secret about you, what would it be?",
          "Would you rather have a permanent clown nose or permanent squeaky shoes?",
          "If your phone could judge you, what would it complain about?",
          "What's the most embarrassing autocorrect you've ever sent?",
          "If you had to eat one meal forever, what are you choosing?",
          "Which vegetable has the most suspicious personality?",
          "If your life was a sitcom, what would the title be?",
          "What's something completely normal that you find weird?",
          "If you could swap lives with a cartoon character for a day, who?",
          "What's the most ridiculous excuse you've ever used?",
          "If your brain had a loading screen, what would it say?",
          "Would you survive a zombie apocalypse or become the first victim?",
          "If you had to rename yourself after a food, what would your name be?"

        ];

        const random =
          funnyQuestions[
            Math.floor(Math.random() * funnyQuestions.length)
          ];

        document.querySelector('.funny-question').textContent = random;

      }}
    >
      😂 Ask me something stupid
    </button>

  </div>


  {/* FLIRTY QUESTIONS */}
  <div className="thing-card">

    <h3>💘 Flirty Questions</h3>

    <p className="flirty-question">
      What's something about me you find hard to resist? 👀
    </p>

    <button
      className="secondary"
      onClick={() => {

        const flirtyQuestions = [

          "What's something about me you find hard to resist? 👀",
          "Be honest… did you smile when you saw my message? 😏",
          "What's your idea of a perfect date with someone you like?",
          "What's the first thing you notice about someone you're attracted to?",
          "If we had a free evening together, what would you want to do?",
          "What's one thing that instantly makes someone attractive to you?",
          "Would you rather have a cute date or a chaotic adventure together? 😌",
          "What's your biggest weakness when someone is flirting with you?",
          "Do you believe two people can have chemistry just from texting? 👀",
          "What's the cutest thing someone could do for you?",
          "If I asked you out right now, what would you say? 😏",
          "What's your favourite kind of flirting?",
          "What's one compliment you'd secretly love to hear?",
          "Would you rather get a good-morning text or a good-night text?",
          "What's something that would make you instantly blush?",
          "Do you like someone who flirts directly or keeps it subtle?",
          "What's your idea of a dangerously good date? 😏",
          "If we were stuck together for 24 hours, what would we do?",
          "What's more attractive: confidence, humour, or a cute smile?",
          "Are you the type to make the first move or wait for them? 👀",
          "What's one question you've always wanted someone to ask you?",
          "What's the smoothest pickup line you've ever heard?",
          "If you could steal one thing from me, what would you steal? 😏",
          "Would you rather hold hands all night or talk until sunrise?",
          "On a scale of 1–10, how good are you at flirting? 😌"

        ];

        const random =
          flirtyQuestions[
            Math.floor(Math.random() * flirtyQuestions.length)
          ];

        document.querySelector('.flirty-question').textContent = random;

      }}
    >
      😏 Give me a flirty question
    </button>

  </div>


  {/* CHAT */}
  <div className="thing-card">

    <h3>💬 Want to talk about it?</h3>

    <p>
      Pick a question and take the conversation wherever it goes.
    </p>

    <button
      className="secondary"
      onClick={() => setTab('chat')}
    >
      Ask in chat 💬
    </button>

  </div>


</main>
}
 <nav><button className={tab==='letter'?'active':''} onClick={()=>setTab('letter')}>💌 Letter</button><button className={tab==='chat'?'active':''} onClick={()=>setTab('chat')}><MessageCircle size={18}/> Our Chat</button><button className={tab==='things'?'active':''} onClick={()=>setTab('things')}><Sparkles size={18}/> Little Things</button></nav>
 </div>
}
createRoot(document.getElementById('root')).render(<App/>)
