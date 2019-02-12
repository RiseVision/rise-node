# RISE Node Core: Crypto Module

Provides Key Pair generation, signing and hashing utilities

* `Crypto#makeKeyPair: (hash: Buffer) => IKeypair`
* `Crypto#sign: (hash: Buffer, keypair: IKeypair) => Buffer`
* `Crypto#verify: (hash: Buffer, signature: Buffer, publicKey: Buffer) => boolean`



