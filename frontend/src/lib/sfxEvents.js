import { playSfxOneOf } from './sfx'

import tap from '../assets/geoguessr-tap.mp3'
import countdown from '../assets/geoguessr-countdown.mp3'
import errorWindows from '../assets/error-windows.mp3'

import loseGta from '../assets/lose-gtawasted.mp3'
import loseMario from '../assets/lose-mario.mp3'
import losePacman from '../assets/lose - pacman.mp3'
import loseAnother from '../assets/lose-anotherone.mp3'

import winGta from '../assets/win-gtamissioncompleted.mp3'
import winMario from '../assets/win - mario.mp3'
import winPvz from '../assets/win-pvz.mp3'
import winCook from '../assets/win - let him cook.mp3'

import winBot from '../assets/win bot - i always come back.mp3'

import joinDiscord from '../assets/someone joining - discord.mp3'

import gameStartCountdown from '../assets/game start - 3-2-1-go.mp3'
import gameStartMario from '../assets/game start - mario.mp3'
import gameStartBrawl from '../assets/game start - brawl stars.mp3'

const SFX = {
  tap: [tap],
  countdown: [countdown],
  error: [errorWindows],
  win: [winGta, winMario, winPvz, winCook],
  lose: [loseGta, loseMario, losePacman, loseAnother],
  botWin: [winBot],
  mpJoin: [joinDiscord],
  mpStartCountdown: [gameStartCountdown],
  mpStart: [gameStartMario, gameStartBrawl],
}

export function playSfx(name, opts) {
  const sources = SFX[name] || []
  playSfxOneOf(sources, opts)
}
