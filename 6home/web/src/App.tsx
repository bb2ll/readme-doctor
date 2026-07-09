import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleHelp, Copy, LogOut, MessageCircle, Settings, ShieldCheck, Sparkles, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react'
import type { Card, Player } from './types'
import { useGameSocket } from './useGameSocket'
import { playTone, speakAction } from './audio'
import { resolvePlayerMotion, type PlayerMotion } from './playerMotion'
import './characters.css'

const SUITS: Record<string, string> = { S: '♠', H: '♥', C: '♣', D: '♦', J: '★' }
const QUICK_CHATS = ['快点出牌', '打得漂亮', '我来压', '这手过', '稳住能赢']
const WAITING_CHATS = ['人齐了吗', '我准备好了', '等我一下', '可以开始', '换个座位']
const ZODIAC_AVATARS = ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig']
const playerAvatar = (player: Player) => ZODIAC_AVATARS[(player.seat - 1 + (player.bot ? 6 : 0)) % ZODIAC_AVATARS.length]
const formatCards = (cards: Card[] = []) => cards.map(card => `${card.rank === 'BJ' ? '大王' : card.rank === 'SJ' ? '小王' : card.rank}${card.suit === 'J' ? '' : SUITS[card.suit]}`).join(' ')

function CardView({ card, selected, onClick, small = false }: { card: Card; selected?: boolean; onClick?: () => void; small?: boolean }) {
  const joker = card.rank === 'BJ' || card.rank === 'SJ'
  const red = card.suit === 'H' || card.suit === 'D' || card.rank === 'BJ'
  const label = card.rank === 'BJ' ? '大王' : card.rank === 'SJ' ? '小王' : card.rank
  return <button className={`playing-card ${red ? 'red' : ''} ${selected ? 'selected' : ''} ${small ? 'small' : ''}`} onClick={onClick} disabled={!onClick} aria-label={`${label}${SUITS[card.suit]}`}>
    <span className="card-rank">{label}</span><span className="card-suit">{joker ? '混' : SUITS[card.suit]}</span>
  </button>
}

function Countdown({ seconds, compact = false }: { seconds: number; compact?: boolean }) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => { const end=Date.now()+seconds*1000;const update=()=>setLeft(Math.max(0,Math.ceil((end-Date.now())/1000)));update();const id=setInterval(update,250);return()=>clearInterval(id)},[seconds])
  return <div className={`countdown ${compact ? 'compact' : ''} ${left <= 5 ? 'urgent' : ''}`} aria-label={`剩余 ${left} 秒`}>{left}<small>s</small></div>
}

function PlayerSeat({ player, position, current, self, turnSeconds, motion, showCharacter = false }: { player?: Player; position: number; current: boolean; self: boolean; turnSeconds?: number; motion?: PlayerMotion; showCharacter?: boolean }) {
  if (!player) return <div className={`player-seat pos-${position} empty`}><span>空座位</span></div>
  const status = player.finished ? '已出完' : player.bot ? '机器人' : player.auto ? '托管' : player.connected ? '在线' : '掉线'
  const avatar = playerAvatar(player)
  const playerMotion = motion ?? resolvePlayerMotion(player)
  return <div className={`player-seat pos-${position} team-${player.team} ${current ? 'current' : ''} ${self ? 'self' : ''}`} data-motion={playerMotion.kind} data-motion-key={playerMotion.eventKey} data-player-seat={player.seat}>
    {showCharacter ? <div className="player-character" aria-hidden="true"><img src={`./assets/characters/${avatar}.webp`} alt="" loading="lazy" draggable="false" /></div> : null}
    {current ? <div className="turn-pulse" /> : null}
    <div className="avatar"><img src={`./assets/avatars/${avatar}.webp`} alt="" /></div>
    <div className="player-meta"><strong>{player.name}</strong><span>{player.seat}号位 · 队伍{player.team}</span></div>
    {current && turnSeconds !== undefined ? <div className="seat-countdown"><Countdown seconds={turnSeconds} compact /></div> : null}
    <div className={`status ${status}`}>{player.isBigGong ? '大供 · ' : ''}{status}</div>
  </div>
}

function Lobby({ connected, error, send, clearError }: { connected: boolean; error: string; send: (v: Record<string, unknown> & { type: string }) => void; clearError: () => void }) {
  const [name, setName] = useState(localStorage.getItem('zaliujia-name') || '')
  const [code, setCode] = useState(new URLSearchParams(location.search).get('room') || '')
  const submit = (type: 'create_room' | 'join_room') => {
    const clean = name.trim(); if (!clean) return
    localStorage.setItem('zaliujia-name', clean); clearError()
    send({ type, name: clean, ...(type === 'join_room' ? { roomCode: code } : {}) })
  }
  return <main className="lobby">
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <section className="lobby-panel">
      <div className="brand-mark"><span>六</span></div>
      <h1>砸六家</h1>
      <p className="tagline">六人围桌，三三组队，一手见高低</p>
      <label className="field"><span>你的昵称</span><input value={name} maxLength={10} onChange={e => setName(e.target.value)} placeholder="输入昵称" /></label>
      <button className="button primary large" disabled={!connected || !name.trim()} onClick={() => submit('create_room')}><Sparkles size={19} />创建房间</button>
      <div className="join-row"><input value={code} maxLength={6} inputMode="numeric" onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="输入6位房间码" /><button className="button secondary" disabled={!connected || !name.trim() || code.length !== 6} onClick={() => submit('join_room')}>加入房间</button></div>
      {error ? <div className="notice error">{error}</div> : null}
      <div className={`connection ${connected ? 'ok' : ''}`}>{connected ? <Wifi size={14} /> : <WifiOff size={14} />}{connected ? '服务已连接' : '正在连接服务'}</div>
    </section>
    <aside className="rules-card"><CircleHelp size={20} /><div><strong>简单玩法</strong><p>54张牌，六人分成两队。只出同点数牌组，大小王、3、2可向下替代。</p></div></aside>
  </main>
}

function WaitingRoom({ room, self, send, leave }: any) {
  const players: Player[] = room.players
  const [chatText, setChatText] = useState('')
  const chatListRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const list = chatListRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [room.chats?.length])
  const copy = async () => { await navigator.clipboard.writeText(`${location.origin}${location.pathname}?room=${room.code}`); playTone('tap') }
  const sendChat = (text = chatText) => {
    const clean = text.trim()
    if (!clean) return
    send({ type: 'chat', msg: clean })
    setChatText('')
  }
  return <main className="room-screen">
    <header className="topbar"><div className="mini-brand"><span>六</span><strong>砸六家</strong></div><div className="room-code">房间码 <strong>{room.code}</strong><button onClick={copy} title="复制邀请链接"><Copy size={16} /></button></div><button className="icon-button" onClick={leave}><LogOut size={18} /></button></header>
    <section className="waiting-content">
      <div className="waiting-copy"><span>等待牌友入座</span><h2>{players.length}/6 位玩家</h2><p>奇数座为队伍A，偶数座为队伍B。全员准备后由房主开始。</p></div>
      <div className="table-wrap waiting-table"><div className="felt-table"><div className="table-center"><span>三三组队</span><strong>{players.filter(p => p.ready).length}/6 已准备</strong></div></div>
        {[1,2,3,4,5,6].map(seat => <PlayerSeat key={seat} player={players.find(p=>p.seat===seat)} position={seat} current={false} self={self.seat===seat} />)}
      </div>
      <div className="team-legend"><span className="team-a">队伍A · 1 / 3 / 5</span><span className="team-b">队伍B · 2 / 4 / 6</span></div>
      <div className="seat-switch"><span>换座：</span>{[1,2,3,4,5,6].map(seat=><button key={seat} disabled={!!players.find(p=>p.seat===seat)} onClick={()=>send({type:'sit',seat})}>{seat}</button>)}</div>
      <div className="waiting-actions">
        <button className={`button ${self.ready ? 'secondary' : 'primary'} large`} onClick={() => send({type:'ready'})}>{self.ready ? '取消准备' : '准备'}</button>
        {self.isHost ? <>
          <button className="button secondary large" disabled={players.length >= 6} onClick={() => send({type:'add_bots'})}>添加测试机器人</button>
          <button className="button gold large" disabled={players.length !== 6 || players.some(p=>!p.ready)} onClick={() => send({type:'start'})}>开始游戏</button>
        </> : <span className="host-hint">等待房主开始</span>}
      </div>
      <div className="waiting-chat">
        <div className="waiting-chat-head"><MessageCircle size={16}/><strong>房间聊天</strong><span>{room.chats?.length || 0}/12</span></div>
        <div className="waiting-chat-list" ref={chatListRef}>
          {room.chats?.length ? room.chats.map((chat:any, index:number)=><div className={`waiting-chat-item ${chat.seat===self.seat?'mine':''}`} key={`${chat.at}-${index}`}><span>{chat.seat}号位 · {chat.name}</span><p>{chat.text}</p></div>) : <div className="waiting-chat-empty">还没有聊天，先打个招呼吧</div>}
        </div>
        <div className="waiting-chat-presets">{WAITING_CHATS.map(text=><button key={text} onClick={()=>sendChat(text)}>{text}</button>)}</div>
        <form className="waiting-chat-form" onSubmit={event=>{event.preventDefault();sendChat()}}>
          <input value={chatText} maxLength={40} onChange={event=>setChatText(event.target.value)} placeholder="输入聊天内容，最多40字" />
          <button className="button gold" disabled={!chatText.trim()}>发送</button>
        </form>
      </div>
    </section>
  </main>
}

function GameScreen({ room, self, send, leave, sound, setSound, bgm, setBgm, voice, setVoice }: any) {
  const [selected, setSelected] = useState<string[]>([])
  const [chatOpen, setChatOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dealing, setDealing] = useState(false)
  const musicRef = useRef<HTMLAudioElement | null>(null)
  const initialAction = room.actionLog?.at(-1)
  const lastSpokenAction = useRef(initialAction ? `${initialAction.at}-${initialAction.seat}-${initialAction.kind}` : '')
  const players: Player[] = room.players
  const currentPlayer = players.find(p=>p.seat===room.current)
  const latestAction = room.actionLog?.at(-1)
  const myTurn = room.current === self.seat
  const actionLog = (room.actionLog || []).slice(-6).reverse()
  useEffect(() => setSelected([]), [room.current, room.lastPlay?.seat, self.hand.length])
  useEffect(() => { if (sound && room.result) playTone('win') }, [room.result, sound])
  useEffect(() => {
    const dealKey = `zaliujia-deal-${room.code}-${room.round}`
    if (sessionStorage.getItem(dealKey)) return
    sessionStorage.setItem(dealKey, 'shown')
    setDealing(true)
    const timer = window.setTimeout(() => setDealing(false), 2800)
    return () => window.clearTimeout(timer)
  }, [room.code, room.round])
  useEffect(() => {
    const music = musicRef.current
    if (!music) return
    music.volume = 0.28
    if (bgm) void music.play().catch(() => setBgm(false))
    else music.pause()
  }, [bgm, setBgm])
  useEffect(() => {
    const latest = room.actionLog?.at(-1)
    if (!latest) return
    const key = `${latest.at}-${latest.seat}-${latest.kind}`
    if (lastSpokenAction.current === key) return
    lastSpokenAction.current = key
    if (!voice) return
    speakAction(latest.kind === 'play' ? '大你' : new Date(latest.at).getTime() % 2 ? '过' : '要不起')
  }, [room.actionLog, voice])
  const toggleBgm = async () => {
    const music = musicRef.current
    if (!music) return
    if (bgm) {
      music.pause()
      setBgm(false)
      return
    }
    music.volume = 0.28
    try {
      await music.play()
      setBgm(true)
    } catch {
      setBgm(false)
    }
  }
  const toggle = (id: string) => setSelected(v => v.includes(id) ? v.filter(x=>x!==id) : [...v,id])
  const play = () => { send({type:'play', cards:selected}); if(sound)playTone('play') }
  const pass = () => { send({type:'pass'}); if(sound)playTone('pass') }
  return <main className="game-screen">
    <header className="game-topbar"><div className="score"><span className="team-a">队伍A</span><b>VS</b><span className="team-b">队伍B</span><small>第 {room.round} 局</small></div><div className="game-room">房间 {room.code}</div><div className="tools"><button className="icon-button" title="快捷聊天" onClick={()=>setChatOpen(v=>!v)}><MessageCircle size={19}/></button><button className="icon-button" title="提示音" onClick={()=>setSound((v:boolean)=>!v)}>{sound?<Volume2 size={19}/>:<VolumeX size={19}/>}</button><button className="icon-button" title="声音与游戏设置" onClick={()=>setSettingsOpen(v=>!v)}><Settings size={19}/></button><button className="icon-button" title="退出" onClick={leave}><LogOut size={19}/></button></div></header>
    {dealing ? <div className="dealing-overlay" aria-label="荷官发牌中">
      <img src="./assets/ui/dealer-dealing.webp" alt="" />
      <div className="dealing-shade" />
      <div className="dealing-title"><span>本局开始</span><strong>荷官发牌中</strong><i /></div>
      <div className="dealing-cards">{Array.from({length:18},(_,index)=><span className={`dealing-card deal-seat-${index%6}`} style={{animationDelay:`${260+index*85}ms`} } key={index} />)}</div>
    </div> : null}
    <section className="game-board">
      <div className="table-wrap game-table"><div className="felt-table"><div className="center-play">
        {room.displayPlay ? <div className="last-play-panel"><span>{room.lastPlay ? '上一手' : '新一轮前一手'} · {room.displayPlay.seat}号位 · {room.displayPlay.target === 'PAIR_JOKER' ? '对王' : `${room.displayPlay.count}张 ${room.displayPlay.target}`}</span><div className="last-cards">{room.displayPlay.cards.map((c:Card)=><CardView key={c.id} card={c} small />)}</div></div> : <><ShieldCheck size={38}/><strong>新一轮自由出牌</strong></>}
      </div></div>
        {[1,2,3,4,5,6].map(seat => {
          const player = players.find(p=>p.seat===seat)
          return <PlayerSeat key={seat} player={player} position={seat} current={room.current===seat} self={self.seat===seat} turnSeconds={room.turnSeconds} motion={player ? resolvePlayerMotion(player, latestAction) : undefined} showCharacter />
        })}
        <div className={`turn-banner ${myTurn ? 'my-turn' : ''}`}><Countdown seconds={room.turnSeconds}/><div><strong>{myTurn ? '轮到你出牌' : `等待 ${currentPlayer?.seat || room.current}号位出牌`}</strong><span>{myTurn ? (room.lastPlay ? `需要出 ${room.lastPlay.count} 张更大的牌` : '可自由选择牌型和数量') : `${currentPlayer?.name || '玩家'} 正在思考`}</span></div></div>
        <aside className="action-log"><strong>最近动作</strong>{actionLog.length ? actionLog.map((item:any, index:number)=><div className={`action-item ${index===0?'latest':''}`} key={`${item.at}-${item.seat}-${index}`}><span>{item.seat}号位：</span>{item.kind==='play'?<em>出 {formatCards(item.cards)}</em>:<em>过</em>}</div>) : <div className="action-empty">等待第一手出牌</div>}</aside>
      </div>
      <div className="hand-area"><div className="hand">{self.hand.map((card:Card)=><CardView key={card.id} card={card} selected={selected.includes(card.id)} onClick={()=>toggle(card.id)} />)}</div><div className="play-actions"><button className="button gold" disabled={!myTurn||selected.length===0} onClick={play}>出牌</button><button className="button secondary" disabled={!myTurn||!room.lastPlay} onClick={pass}>过</button></div><div className="self-label"><span className={`team-dot team-${self.team.toLowerCase()}`}/>{players.find(p=>p.seat===self.seat)?.name} · {self.seat}号位 {self.auto ? '· 托管中' : ''}</div></div>
      {chatOpen ? <div className="chat-panel"><strong>快捷聊天</strong>{QUICK_CHATS.map(text=><button key={text} onClick={()=>{send({type:'chat',msg:text});setChatOpen(false)}}>{text}</button>)}</div>:null}
      {settingsOpen ? <div className="settings-panel">
        <strong>声音与游戏设置</strong>
        <button onClick={toggleBgm}><span>背景音乐</span><em className={bgm?'on':''}>{bgm?'开':'关'}</em></button>
        <button onClick={()=>setVoice((value:boolean)=>!value)}><span>出牌语音</span><em className={voice?'on':''}>{voice?'开':'关'}</em></button>
        <button onClick={()=>send({type:'toggle_auto'})}><span>自动托管</span><em className={self.auto?'on':''}>{self.auto?'开':'关'}</em></button>
      </div>:null}
      <audio ref={musicRef} src="./assets/audio/poker-storm.mp3" loop preload="metadata" />
      {room.chats?.length ? <div className="chat-toast"><strong>{room.chats.at(-1).name}</strong>：{room.chats.at(-1).text}</div>:null}
    </section>
    {room.result ? <ResultModal room={room} self={self} send={send}/>:null}
  </main>
}

function ResultModal({ room, self, send }: any) {
  const won = room.result.kind === 'win' && room.result.winningTeam === self.team
  const players: Player[] = room.players
  const confirmed = players.filter(player => player.ready).length
  return <div className="modal-backdrop"><div className="result-modal"><div className="result-emblem">{room.result.kind === 'draw' ? '和' : won ? '胜' : '负'}</div><span>第 {room.round} 局结束</span><h2>{room.result.title}</h2><p>{room.result.kind==='draw'?'大供队友未能全部出完，双方握手言和。':won?'配合漂亮，你的队伍率先全部出完。':'对方队伍率先全部出完。'}</p><div className="result-teams"><div className="team-a"><b>队伍A</b><span>{room.result.winningTeam==='A'?'获胜':room.result.kind==='draw'?'平局':'落败'}</span></div><strong>VS</strong><div className="team-b"><b>队伍B</b><span>{room.result.winningTeam==='B'?'获胜':room.result.kind==='draw'?'平局':'落败'}</span></div></div>
    <div className="rematch-status"><div className="rematch-title"><strong>下一局确认</strong><span>{confirmed}/6</span></div><div className="rematch-players">{players.map(player=><div className={`rematch-player ${player.ready?'confirmed':''}`} key={player.seat}><img src={`./assets/avatars/${playerAvatar(player)}.webp`} alt="" /><span>{player.name}</span><em>{player.ready?'已确认':'待确认'}</em></div>)}</div></div>
    <button className="button gold large" disabled={self.ready} onClick={()=>send({type:'rematch'})}>{self.ready?'等待其他玩家':'确认下一局'}</button><small>全部玩家确认后将自动开始下一局</small></div></div>
}

export function App() {
  const game = useGameSocket()
  const [sound, setSound] = useState(()=>localStorage.getItem('zaliujia-sound')!=='off')
  const [bgm, setBgm] = useState(()=>localStorage.getItem('zaliujia-bgm')==='on')
  const [voice, setVoice] = useState(()=>localStorage.getItem('zaliujia-voice')!=='off')
  useEffect(()=>localStorage.setItem('zaliujia-sound',sound?'on':'off'),[sound])
  useEffect(()=>localStorage.setItem('zaliujia-bgm',bgm?'on':'off'),[bgm])
  useEffect(()=>localStorage.setItem('zaliujia-voice',voice?'on':'off'),[voice])
  const leave = () => { if (game.room?.phase === 'playing') return; game.send({type:'leave_room'}); setTimeout(()=>{game.leaveLocal();location.reload()},120) }
  const content = useMemo(() => {
    if (!game.room || !game.self) return <Lobby connected={game.connected} error={game.error} send={game.send} clearError={()=>game.setError('')} />
    if (game.room.phase === 'waiting') return <WaitingRoom room={game.room} self={game.self} send={game.send} leave={leave} />
    return <GameScreen room={game.room} self={game.self} send={game.send} leave={leave} sound={sound} setSound={setSound} bgm={bgm} setBgm={setBgm} voice={voice} setVoice={setVoice} />
  }, [game.room, game.self, game.connected, game.error, game.send, sound, bgm, voice])
  return <>{content}{game.error && game.room ? <div className="global-error" onClick={()=>game.setError('')}>{game.error}</div>:null}</>
}
