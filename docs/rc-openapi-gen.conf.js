const fs = require('fs')
const path = require('path')
const package = require('../package.json')
const README = fs.readFileSync(
  path.join(process.cwd(), 'README.md')
).toString()

module.exports = {
  controllers: 'dist/apis/!(transport)*API.js',
  schemas: 'dist/schema/*.js,dist/schema/+(common|responses)/*.js',
  out: 'docs/swagger.json',
  static: {
    info: {
      title: 'RISE Node',
      version: package.version,
      description: README
    }
  },
  baseSchema: {
    TransactionQuery: {
      id: 'TransactionQuery',
      type: 'object',
      properties: {
        transaction: { type: 'object' },
        transactions: { type: 'array', maxItems: 10 }
      }
    },
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
