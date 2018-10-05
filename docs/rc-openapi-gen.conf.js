const fs = require('fs')
const path = require('path')
const package = require('../package.json')
const README = fs.readFileSync(
  path.join(process.cwd(), 'README.md')
).toString()

module.exports = {
  controllers: 'dist/apis/!(index|transport)*.js',
  schemas: 'dist/schema/*.js,dist/schema/+(common|responses)/*.js',
  out: 'docs/swagger.json',
  static: {
    info: {
      title: 'RISE Node',
      version: package.version,
      description: README
    },
    "x-servers": [
      {
        url: 'https://wallet.rise.vision',
        description: 'Mainnet'
      },
      {
        url: 'http://localhost:5566',
        description: 'Local Testnet'
      }
    ]
  },
  baseSchema: {
    Buffer: {
      id: "Buffer",
      type: "string",
      format: "binary"
    }
  },
  samples: {
    dir: 'docs/samples',
    languages: {
      javascript: {
        extension: 'js'
      }
    }
  }
}
