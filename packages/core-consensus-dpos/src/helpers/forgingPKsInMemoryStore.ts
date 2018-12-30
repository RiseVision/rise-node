import { injectable } from 'inversify';

@injectable()
export class ForgingPKsInMemoryStore {
  private pendingPKs: Buffer[];

  public markPKPendingOrThrow(newPK: Buffer) {
    for (const pk of this.pendingPKs) {
      if (pk.compare(newPK) === 0) {
        throw new Error('PublicKey already exists');
      }
    }
    this.pendingPKs.push(newPK);
  }

  public removePK(pk: Buffer) {
    for (let i = 0; i < this.pendingPKs.length; i++) {
      const p = this.pendingPKs[i];
      if (pk.compare(p) === 0) {
        this.pendingPKs.splice(i, 1);
      }
    }
  }
}
