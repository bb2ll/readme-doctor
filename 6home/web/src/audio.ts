let context: AudioContext | null = null

export function playTone(kind: 'tap' | 'play' | 'pass' | 'win') {
  try {
    context ??= new AudioContext()
    const osc = context.createOscillator()
    const gain = context.createGain()
    const now = context.currentTime
    const freq = kind === 'win' ? 660 : kind === 'play' ? 430 : kind === 'pass' ? 220 : 320
    osc.frequency.setValueAtTime(freq, now)
    if (kind === 'win') osc.frequency.exponentialRampToValueAtTime(990, now + 0.22)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
    osc.connect(gain).connect(context.destination)
    osc.start(now); osc.stop(now + 0.26)
  } catch { /* Sound is optional. */ }
}

export function speakAction(text: '过' | '要不起' | '大你') {
  try {
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 1.08
    utterance.pitch = 0.9
    utterance.volume = 0.9
    const chineseVoice = speechSynthesis.getVoices().find(voice => voice.lang.toLowerCase().startsWith('zh'))
    if (chineseVoice) utterance.voice = chineseVoice
    speechSynthesis.speak(utterance)
  } catch { /* Voice prompts are optional. */ }
}
