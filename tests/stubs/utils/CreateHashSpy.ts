import * as crypto from 'crypto';
import { Hash } from 'crypto';
import { SinonSandbox } from 'sinon';

// Allows to spy on hashes but keeping the original feature
export class CreateHashSpy {
  public realCreateHash;
  public hashes: Hash[] = [];
  public spies: any     = {
    createHash: undefined,
    update    : [],
    digest    : [],
  };
  public callCount      = 0;
  private cryptoToSpy;
  private sandbox: SinonSandbox;

  constructor(cryptoToSpy: any, sandbox: SinonSandbox) {
    this.cryptoToSpy = cryptoToSpy;
    this.sandbox     = sandbox;
    this.stub();
  }

  public stub() {
    this.realCreateHash   = crypto.createHash;
    const inst            = this;
    const createHashStub  = inst.sandbox.stub(this.cryptoToSpy, 'createHash').callsFake((algorithm: string) => {
      const hash      = inst.realCreateHash(algorithm);
      const updateSpy = inst.sandbox.spy(hash, 'update');
      const digestSpy = inst.sandbox.spy(hash, 'digest');
      inst.callCount++;
      inst.hashes.push(hash);
      inst.spies.update.push(updateSpy);
      inst.spies.digest.push(digestSpy);
      return hash;
    });
    inst.spies.createHash = createHashStub;
  }
}
