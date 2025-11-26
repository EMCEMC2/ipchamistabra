import { AggrTrade, AggrLiquidation } from '../../types/aggrTypes';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;
  private lastPlayTime: number = 0;
  private minInterval: number = 100; // ms between sounds

  constructor() {
    // Initialize AudioContext on first user interaction usually, 
    // but we can try to init it lazily.
  }

  private getContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        this.ctx = new AudioContextClass();
      } catch (e) {
        console.error('Web Audio API not supported');
        return null;
      }
    }
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  public playTradeSound(trade: AggrTrade) {
    if (!this.isEnabled) return;
    
    // Throttle
    const now = Date.now();
    if (now - this.lastPlayTime < this.minInterval) return;
    this.lastPlayTime = now;

    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Frequency based on trade size (higher pitch for larger trades)
    // Base: 200Hz (sell) / 400Hz (buy)
    // Max: 800Hz / 1200Hz
    const baseFreq = trade.side === 'buy' ? 400 : 200;
    const sizeFactor = Math.min(trade.usdValue / 1000000, 1); // Cap at $1M for max pitch effect
    const freq = baseFreq + (sizeFactor * 400);

    osc.frequency.value = freq;
    osc.type = trade.side === 'buy' ? 'sine' : 'sawtooth';

    // Volume based on size
    const volume = Math.min(0.05 + (trade.usdValue / 5000000) * 0.2, 0.3);
    
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  public playLiquidationSound(liq: AggrLiquidation) {
    if (!this.isEnabled) return;

    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Distinct sound for liquidations (lower, longer)
    osc.frequency.value = 150;
    osc.type = 'square';

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }
}

export const soundEngine = new SoundEngine();
