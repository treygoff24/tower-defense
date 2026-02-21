/**
 * AudioManager — Procedural Web Audio engine.
 * No audio files needed: all SFX are synthesised via OscillatorNode / BiquadFilterNode.
 *
 * v2: All sounds are routed through a SoundPool that enforces per-category
 * polyphony limits (max 4 simultaneous) and volume normalisation (1/√N).
 */
import { SoundPool, type PooledInstance } from './SoundPool';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private volume = 0.5;

  /** Shared pool — enforces polyphony limits across all categories. */
  private readonly pool = new SoundPool(4);

  /** Monotonic counter to order instances. */
  private _tick = 0;

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
    this.playEvent('tower-place', (dest, vol) => {
      this.playTone(180, 0.08, 'square', 0.18 * vol, 0, 0, dest);
      this.playTone(440, 0.06, 'sine', 0.08 * vol, 0.05, 0, dest);
    });
  }

  playTowerShoot(): void {
    this.playEvent('tower-shoot', (dest, vol) => {
      this.playNoise(0.04, 0.12, 3200, 'highpass', 0, dest, vol);
    });
  }

  playGrenadeShoot(): void {
    this.playEvent('grenade-shoot', (dest, vol) => {
      this.playTone(80, 0.12, 'sawtooth', 0.22 * vol, 0, 40, dest);
    });
  }

  playEnemyDeath(): void {
    this.playEvent('enemy-death', (dest, vol) => {
      this.playNoise(0.06, 0.18, 600, 'bandpass', 0, dest, vol);
      this.playToneSlide(300, 60, 0.25, 'sawtooth', 0.15 * vol, 0, dest);
    });
  }

  playBossEnemyDeath(): void {
    this.playEvent('boss-death', (dest, vol) => {
      this.playNoise(0.12, 0.5, 120, 'lowpass', 0, dest, vol);
      this.playToneSlide(120, 30, 0.5, 'sawtooth', 0.3 * vol, 0, dest);
    });
  }

  playWaveStart(): void {
    this.playEvent('wave-start', (dest, vol) => {
      const notes = [261, 329, 523];
      notes.forEach((freq, i) => {
        this.playTone(freq, 0.12, 'sine', 0.25 * vol, i * 0.12, 0, dest);
      });
    });
  }

  playWaveClear(): void {
    this.playEvent('wave-clear', (dest, vol) => {
      const notes = [523, 659, 784, 1046];
      notes.forEach((freq, i) => {
        this.playTone(freq, 0.18, 'sine', 0.2 * vol, i * 0.15, 0, dest);
      });
    });
  }

  playBaseDamage(): void {
    this.playEvent('base-damage', (dest, vol) => {
      this.playNoise(0.1, 0.35, 80, 'lowpass', 0, dest, vol);
      this.playTone(220, 0.2, 'square', 0.18 * vol, 0, 200, dest);
    });
  }

  playSellTower(): void {
    // Cha-ching: ascending coin tones + metallic tinkle
    this.playEvent('sell-tower', (dest, vol) => {
      const notes = [523, 659, 784, 1046];
      notes.forEach((freq, i) => {
        this.playTone(freq, 0.1, 'sine', 0.2 * vol, i * 0.06, 0, dest);
      });
      // High-frequency metallic noise (coin clink)
      this.playNoise(0.03, 0.08, 4000, 'highpass', 0.15, dest, vol);
    });
  }

  playReaction(reactionId: string): void {
    this.playEvent('reaction', (dest, vol) => {
      const reactionSounds: Record<string, () => void> = {
        'fire+water': () => { this.playSteam(dest, vol); },
        'fire+ice':   () => { this.playFreezeShatter(dest, vol); },
        'ice+water':  () => { this.playIceWater(dest, vol); },
        'fire+poison':() => { this.playExplosionPoison(dest, vol); },
      };
      const sfx = reactionSounds[reactionId];
      if (sfx) sfx();
      else this.playTone(660, 0.08, 'triangle', 0.12 * vol, 0, 0, dest);
    });
  }

  playReactionDefault(): void {
    this.playEvent('reaction', (dest, vol) => {
      this.playTone(660, 0.08, 'triangle', 0.12 * vol, 0, 0, dest);
    });
  }

  playMusic(): void {
    // No music file — play ambient drone
    this.startAmbientDrone();
  }

  stopMusic(): void {
    this.stopAmbientDrone();
  }

  // ─────────────────────────────────────────────────────────────────
  // Pool event helper
  // ─────────────────────────────────────────────────────────────────

  /**
   * Creates a per-event GainNode, registers it with the SoundPool,
   * and calls `fn` with the destination node and the normalised volume factor.
   * The pool may stop the oldest instance if this category is full.
   *
   * After `durationMs` the instance is released from the pool so that the
   * slot is freed for future sounds without waiting for the cap to evict it.
   */
  private playEvent(
    category: string,
    fn: (dest: GainNode, volumeFactor: number) => void,
    durationMs = 1200
  ): void {
    if (!this.ensureCtx() || this.muted) return;
    const ctx = this.ctx!;

    // Per-event intermediate gain node so we can silence it on eviction
    const eventGain = ctx.createGain();
    eventGain.gain.setValueAtTime(1, ctx.currentTime);
    eventGain.connect(this.masterGain!);

    const tick = ++this._tick;
    const instance: PooledInstance = {
      startTime: tick,
      stop: () => {
        // Ramp down in 5 ms to avoid click artifacts
        eventGain.gain.cancelScheduledValues(ctx.currentTime);
        eventGain.gain.setValueAtTime(eventGain.gain.value, ctx.currentTime);
        eventGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.005);
      },
    };

    const volumeFactor = this.pool.acquire(category, instance);
    fn(eventGain, volumeFactor);

    // Release the pool slot once the sound has naturally finished.
    // durationMs is a generous upper bound covering the longest synthesised
    // primitives scheduled by fn (see individual playEvent call sites).
    setTimeout(() => {
      this.pool.release(category, instance);
    }, durationMs);
  }

  // ─────────────────────────────────────────────────────────────────
  // Reaction SFX (now take dest + vol params)
  // ─────────────────────────────────────────────────────────────────

  private playSteam(dest: GainNode, vol: number): void {
    this.playNoise(0.04, 0.25, 1800, 'highpass', 0, dest, vol);
    this.playTone(800, 0.12, 'sine', 0.08 * vol, 0.05, -200, dest);
  }

  private playFreezeShatter(dest: GainNode, vol: number): void {
    this.playNoise(0.03, 0.12, 3000, 'highpass', 0, dest, vol);
    this.playTone(1200, 0.06, 'sine', 0.1 * vol, 0, 0, dest);
  }

  private playIceWater(dest: GainNode, vol: number): void {
    this.playNoise(0.03, 0.15, 2000, 'bandpass', 0, dest, vol);
  }

  private playExplosionPoison(dest: GainNode, vol: number): void {
    this.playNoise(0.08, 0.3, 200, 'bandpass', 0, dest, vol);
    this.playToneSlide(400, 50, 0.3, 'square', 0.12 * vol, 0, dest);
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
  // Primitives (dest parameter added — connect to caller-supplied node)
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
    freqSlide = 0,
    dest?: GainNode
  ): void {
    if (!this.ensureCtx() || this.muted) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime + delay;
    const output = dest ?? this.masterGain!;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqSlide !== 0) osc.frequency.linearRampToValueAtTime(freq + freqSlide, now + duration);
    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gainNode);
    gainNode.connect(output);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  private playToneSlide(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
    dest?: GainNode
  ): void {
    if (!this.ensureCtx() || this.muted) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime + delay;
    const output = dest ?? this.masterGain!;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), now + duration);
    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gainNode);
    gainNode.connect(output);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  private playNoise(
    duration: number,
    decay: number,
    filterFreq: number,
    filterType: BiquadFilterType,
    delay = 0,
    dest?: GainNode,
    volFactor = 1
  ): void {
    if (!this.ensureCtx() || this.muted) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime + delay;
    const output = dest ?? this.masterGain!;

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
    gainNode.gain.setValueAtTime(0.25 * volFactor, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration + decay);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(output);
    source.start(now);
    source.stop(now + duration + decay + 0.01);
  }
}
