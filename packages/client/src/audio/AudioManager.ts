/**
 * AudioManager — Procedural Web Audio engine.
 * No audio files needed: all SFX are synthesised via OscillatorNode / BiquadFilterNode.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private volume = 0.5;

  bind(_scene: Phaser.Scene): void {
    // Lazily create AudioContext on first user gesture
    this.ensureCtx();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.setValueAtTime(this.volume, this.ctx!.currentTime);
  }

  mute(): void {
    this.muted = true;
    if (this.masterGain) this.masterGain.gain.setValueAtTime(0, this.ctx!.currentTime);
  }

  unmute(): void {
    this.muted = false;
    if (this.masterGain) this.masterGain.gain.setValueAtTime(this.volume, this.ctx!.currentTime);
  }

  // ─────────────────────────────────────────────────────────────────
  // Public SFX API
  // ─────────────────────────────────────────────────────────────────

  playTowerPlace(): void {
    // Rising "thunk" + tone
    this.playTone(180, 0.08, 'square', 0.18);
    this.playTone(440, 0.06, 'sine', 0.08, 0.05);
  }

  playTowerShoot(): void {
    // Short high-frequency burst
    this.playNoise(0.04, 0.12, 3200, 'highpass');
  }

  playGrenadeShoot(): void {
    // Low thud + whistle
    this.playTone(80, 0.12, 'sawtooth', 0.22, 0, 40);
  }

  playEnemyDeath(): void {
    // Crunch noise + descending tone
    this.playNoise(0.06, 0.18, 600, 'bandpass');
    this.playToneSlide(300, 60, 0.25, 'sawtooth', 0.15);
  }

  playBossEnemyDeath(): void {
    // Big boom — low noise burst
    this.playNoise(0.12, 0.5, 120, 'lowpass');
    this.playToneSlide(120, 30, 0.5, 'sawtooth', 0.3);
  }

  playWaveStart(): void {
    // Ascending fanfare: three notes
    const notes = [261, 329, 523];
    notes.forEach((freq, i) => {
      this.playTone(freq, 0.12, 'sine', 0.25, i * 0.12);
    });
  }

  playWaveClear(): void {
    // Victory arpeggio
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, i) => {
      this.playTone(freq, 0.18, 'sine', 0.2, i * 0.15);
    });
  }

  playBaseDamage(): void {
    // Heavy low buzz + alarm
    this.playNoise(0.1, 0.35, 80, 'lowpass');
    this.playTone(220, 0.2, 'square', 0.18, 0, 200);
  }

  playReaction(reactionId: string): void {
    const reactionSounds: Record<string, () => void> = {
      'fire+water': () => { this.playSteam(); },
      'fire+ice':   () => { this.playFreezeShatter(); },
      'ice+water':  () => { this.playIceWater(); },
      'fire+poison':() => { this.playExplosionPoison(); },
    };
    const sfx = reactionSounds[reactionId];
    if (sfx) sfx();
    else this.playTone(660, 0.08, 'triangle', 0.12);
  }

  playReactionDefault(): void {
    this.playTone(660, 0.08, 'triangle', 0.12);
  }

  playMusic(): void {
    // No music file — play ambient drone
    this.startAmbientDrone();
  }

  stopMusic(): void {
    this.stopAmbientDrone();
  }

  // ─────────────────────────────────────────────────────────────────
  // Reaction SFX
  // ─────────────────────────────────────────────────────────────────

  private playSteam(): void {
    this.playNoise(0.04, 0.25, 1800, 'highpass');
    this.playTone(800, 0.12, 'sine', 0.08, 0.05, -200);
  }

  private playFreezeShatter(): void {
    this.playNoise(0.03, 0.12, 3000, 'highpass');
    this.playTone(1200, 0.06, 'sine', 0.1);
  }

  private playIceWater(): void {
    this.playNoise(0.03, 0.15, 2000, 'bandpass');
  }

  private playExplosionPoison(): void {
    this.playNoise(0.08, 0.3, 200, 'bandpass');
    this.playToneSlide(400, 50, 0.3, 'square', 0.12);
  }

  // ─────────────────────────────────────────────────────────────────
  // Ambient drone
  // ─────────────────────────────────────────────────────────────────

  private droneNodes: AudioNode[] = [];

  private startAmbientDrone(): void {
    if (!this.ensureCtx()) return;
    this.stopAmbientDrone();

    const ctx = this.ctx!;
    const dronFreqs = [55, 82.5, 110]; // A1, E2, A2
    dronFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start();
      this.droneNodes.push(osc, gain);
    });
  }

  private stopAmbientDrone(): void {
    this.droneNodes.forEach((node) => {
      try {
        if (node instanceof OscillatorNode) node.stop();
        node.disconnect();
      } catch {/* already stopped */}
    });
    this.droneNodes = [];
  }

  // ─────────────────────────────────────────────────────────────────
  // Primitives
  // ─────────────────────────────────────────────────────────────────

  private ensureCtx(): boolean {
    if (this.ctx) return true;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
    freqSlide = 0
  ): void {
    if (!this.ensureCtx() || this.muted) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqSlide !== 0) osc.frequency.linearRampToValueAtTime(freq + freqSlide, now + duration);
    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gainNode);
    gainNode.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  private playToneSlide(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0
  ): void {
    if (!this.ensureCtx() || this.muted) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), now + duration);
    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gainNode);
    gainNode.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  private playNoise(
    duration: number,
    decay: number,
    filterFreq: number,
    filterType: BiquadFilterType,
    delay = 0
  ): void {
    if (!this.ensureCtx() || this.muted) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime + delay;

    const bufferSize = Math.ceil(ctx.sampleRate * (duration + decay));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.25, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration + decay);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain!);
    source.start(now);
    source.stop(now + duration + decay + 0.01);
  }
}