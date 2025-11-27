import { AggrTrade, AggrLiquidation } from '../../types/aggrTypes';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = false; // Disabled by default

  constructor() {
    // Audio disabled
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = false; // Force disabled
  }

  public playTradeSound(trade: AggrTrade) {
    // Sound removed as per user request
    return;
  }

  public playLiquidationSound(liq: AggrLiquidation) {
    // Sound removed as per user request
    return;
  }
}

export const soundEngine = new SoundEngine();
