export const Symbols = {
  api    : {
    accounts          : Symbol('accountsAPI'),
    blocks            : Symbol('blocksAPI'),
    loader            : Symbol('loader'),
    multisignatures   : Symbol('multisignaturesAPI'),
    peers             : Symbol('peersAPI'),
    signatures        : Symbol('signaturesAPI'),
    successInterceptor: Symbol('successInterceptor'),
    transactions      : Symbol('transactionsAPI'),
    transport         : Symbol('transportAPI'),
  },
  generic: {
    appConfig         : Symbol('appConfig'),
    expressApp        : Symbol('expressApp'),
    genesisBlock      : Symbol('genesisBlock'),
    hookSystem        : Symbol('hookSystem'),
    nonce             : Symbol('nonce'),
    redisClient       : Symbol('redisClient'),
    socketIO          : Symbol('socketIO'),
    versionBuild      : Symbol('versionBuild'),
    zschema           : Symbol('z_schema'),
  },
  helpers: {
    bus              : Symbol('bus'),
    constants        : Symbol('constants'),
    crypto           : Symbol('crypto'),
    db               : Symbol('dbHelper'),
    exceptionsManager: Symbol('exceptionsManager'),
    jobsQueue        : Symbol('jobsQueue'),
    logger           : Symbol('logger'),
    migrator         : Symbol('migrator'),
    sequence         : Symbol('sequence'),
    sequences: {
      balancesSequence: Symbol('balanceSequence'),
      dbSequence      : Symbol('dbSequence'),
      defaultSequence : Symbol('defaultSequence'),
    },
    timeToEpoch      : Symbol('timeToEpoch'),
  },
  logic  : {
    account          : Symbol('accountLogic'),
    appState         : Symbol('appState'),
    block            : Symbol('blockLogic'),
    blockReward      : Symbol('blockRewardL'),
    broadcaster      : Symbol('broadcasterL'),
    peer             : Symbol('peerL'),
    peerFactory      : Symbol('Factory<peerL>'),
    peers            : Symbol('peersL'),
    singleTransaction: Symbol('singleTransaction'),
    transaction      : Symbol('transactionL'),
    transactionPool  : Symbol('transactionPoolL'),
    transactions     : {
      createmultisig : Symbol('createMultisigTxL'),
      delegate       : Symbol('delegateTxL'),
      secondSignature: Symbol('secondSignatureTxL'),
      send           : Symbol('sendTxL'),
      vote           : Symbol('voteTxL'),
    },
  },
  model: Symbol('model'),
  models : {
    accounts                  : Symbol('accountsModel'),
    blocks                    : Symbol('blocksModel'),
    exceptions                : Symbol('exceptionsModel'),
    forkStats                 : Symbol('forkStatsModel'),
    info                      : Symbol('infoModel'),
    migrations                : Symbol('migrationsModel'),
    peers                     : Symbol('peersModel'),
    transactions              : Symbol('transactionsModel'),
  },
  module: Symbol('module'),
  modules: {
    accounts        : Symbol('accountsM'),
    blocks          : Symbol('blocksM'),
    blocksSubModules: {
      chain  : Symbol('blocks_submodule_chain'),
      process: Symbol('blocks_submodule_process'),
      utils  : Symbol('blocks_submodule_utils'),
      verify : Symbol('blocks_submodule_verify'),
    },
    cache           : Symbol('cacheM'),
    fork            : Symbol('forkM'),
    loader          : Symbol('loaderM'),
    peers           : Symbol('peersM'),
    system          : Symbol('systemM'),
    transactions    : Symbol('transactionsM'),
    transport       : Symbol('transportM'),
  }
};
