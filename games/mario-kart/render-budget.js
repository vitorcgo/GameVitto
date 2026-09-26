export class RenderBudget {
  constructor({ windowSize = 90, slowFrameMs = 20, fastFrameMs = 14.5, initialQuality = 'performance' } = {}) {
    this.windowSize = windowSize;
    this.slowFrameMs = slowFrameMs;
    this.fastFrameMs = fastFrameMs;
    this.quality = initialQuality === 'balanced' ? 'balanced' : 'performance';
    this.total = 0;
    this.count = 0;
    this.fastWindows = 0;
    this.averageFrameMs = 0;
  }

  sample(frameMs) {
    if (!Number.isFinite(frameMs) || frameMs < 1 || frameMs > 100) return null;
    this.total += frameMs;
    this.count += 1;
    if (this.count < this.windowSize) return null;

    this.averageFrameMs = this.total / this.count;
    this.total = 0;
    this.count = 0;

    if (this.quality === 'balanced' && this.averageFrameMs > this.slowFrameMs) {
      this.quality = 'performance';
      this.fastWindows = 0;
      return this.quality;
    }

    if (this.quality === 'performance') {
      this.fastWindows = this.averageFrameMs < this.fastFrameMs ? this.fastWindows + 1 : 0;
      if (this.fastWindows >= 3) {
        this.quality = 'balanced';
        this.fastWindows = 0;
        return this.quality;
      }
    }
    return null;
  }
}
