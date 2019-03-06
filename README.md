## Rise-node version 1.2.0

# RISE
[![Build Status](https://travis-ci.org/RiseVision/rise-node.svg?branch=development)](https://travis-ci.org/RiseVision/rise-node) [![Coverage Status](https://coveralls.io/repos/github/RiseVision/rise-node/badge.svg?branch=development)](https://coveralls.io/github/RiseVision/rise-node?branch=development)

## Installation

An automatic install script for Ubuntu is available.

### More Information

For detailed information on node installation and management please refer to the [developer docs](https://risevision.github.io/#pages/node/Installation).

### System Configuration

Before installing the RISE node, please check your configuration for the following:

* Your operating system needs to be Linux based
* **Do not run the following commands as root or with sudo**: The node should be installed for a non-root user with sudo capabilities. If you are unsure of how to configure that please read [How to add a sudo-capable user](https://www.digitalocean.com/community/tutorials/how-to-create-a-sudo-user-on-ubuntu-quickstart)
* You will need `wget` installed to download the installer
* Do not have another instance of PostgreSQL running. If PostgreSQL is currently, please stop the service with `sudo service postgresql stop` or similar

### Quick start installation

Go to your install directory. We recommend your home directory.

```bash
cd $HOME
```

Download the installer

```bash
TODO wget https://raw.githubusercontent.com/RiseVision/rise-build/master/scripts/install.sh
```

Select your network for your current bash shell (You can set the network variable to `mainnet` or `testnet`)

```bash
export NETWORK="mainnet"
```

Run the installer. This will install the node into a `rise` directory in your install directory (e.g. `$HOME/rise`)

```bash
TODO bash install.sh install -r ${NETWORK?} -u https://downloads.rise.vision/core/${NETWORK}/latest.tar.gz
```

The installer will start the node automatically if installation was successful.

### Quick Sync (optional)

To sync the blockchain from the latest snapshot, download the snapshot and restore the backup using the following steps. First go to your rise installation folder.

```bash
cd $HOME/rise
```

Download the latest snapshot (see [quick start above](#quick-start-installation) about setting your `NETWORK` environment variable if errors occur)

```bash
TODO wget https://downloads.rise.vision/snapshots/${NETWORK?}/latest -O latestsnap.gz
```

Restore snapshot using the node manager

```bash
./manager.sh restoreBackup latestsnap.gz
```

## Basic node management

The installer will create a `rise` folder in your installation directory (e.g. `$HOME/rise`). Make sure to `cd` to this directory when managing your node.

Check the status of your node with

```bash
./manager.sh status
```

Stop node with

```bash
./manager.sh stop node
```

Insert your passphrase so you can forge

```bash
nano etc/node_config.json
```

And change this section to include your passphrase

```json
{
  "fileLogLevel": "error",
  "forging": {
    "secret": [ "MY SUPER SECRET MNEMONIC PHRASE" ],
    "access": {
      "whiteList": [ "127.0.0.1" ]
    }
  }
}
```

And finally restart your node to apply the changes

```bash
./manager.sh reload node
```

See help for more commands and usage

```bash
./manager.sh --help
```

## Building node from source

To build the node from source, please check your system for the following

* [`Node.js`](https://nodejs.org/en/) version 10 or higher
* [`yarn`](https://nodejs.org/en/://yarnpkg.com/en/)
* [`git`](https://git-scm.com/)

The RISE node also uses [`lerna`](https://github.com/lerna/lerna) to handle submodules and
their dependencies. After making sure the above are installed, you can install `lerna` by running the following (may require `sudo`)

```bash
yarn global add lerna
```

### Installation

After making sure all of the above dependencies are installed clone the repository

```bash
git clone https://github.com/RiseVision/rise-node-priv.git rise-node
```

Enter the installation directory

```bash
cd rise-node
```

Install node modules

```bash
yarn install && lerna bootstrap
```

Compile TypeScript

```bash
yarn transpile
```

Link compiled packages

```bash
lerna link
```

### Starting the node

Navigate to the installation directory created above

```bash
cd rise-node
```

Create a node configuration file

```bash
touch node_config.json && nano node_config.json
```

And edit the configuration. A basic sample is below, but review the [developer docs](https://risevision.github.io/#pages/node/management/Configuration) for a full list of configuration options.

```json
{
  "fileLogLevel": "error",
  "forging": {
    "secret": [],
    "access": {
      "whiteList": [ "127.0.0.1" ]
    }
  }
}
```

Add `logs` directory

```bash
mkdir packages/rise/logs && ln -s packages/rise/logs logs
```

Run the node (change `mainnet` to `testnet` to run the node on the testnet)

```bash
lerna run start:mainnet --stream --no-prefix -- -e ../../../node_config.json
```

## Starting with docker

The RISE node can also be run with [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/). To get started, clone the repository

```bash
git clone https://github.com/RiseVision/rise-node-priv.git rise-node
```

Navigate to the docker compose files

```bash
cd rise-node/docker/compose
```

And run the following to build / pull the necessary images and start the node

```bash
docker-compose up
```

## Authors

- Andrea B. <vekexasia+crypto@gmail.com>
- Jan <lepetitjan@icloud.com>
- Mariusz Serek <mariusz@serek.net>
- Goldeneye (Shift Team)
- Ralfs (Shift Team)
- Joey <shiftcurrency@gmail.com>
- Boris Povod <boris@crypti.me>
- Pavel Nekrasov <landgraf.paul@gmail.com>
- Sebastian Stupurac <stupurac.sebastian@gmail.com>
- Oliver Beddows <oliver@lightcurve.io>
- Isabella Dell <isabella@lightcurve.io>
- Marius Serek <mariusz@serek.net>
- Maciej Baj <maciej@lightcurve.io>

## License

Copyright © 2017 Rise<br>
Copyright © 2016-2017 Shift<br>  
Copyright © 2016-2017 Lisk Foundation

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the [GNU General Public License](https://github.com/RiseVision/rise-node/src/master/LICENSE) along with this program.  If not, see <http://www.gnu.org/licenses/>.

***

This program also incorporates work previously released with lisk `0.7.0` (and earlier) versions under the [MIT License](https://opensource.org/licenses/MIT). To comply with the requirements of that license, the following permission notice, applicable to those parts of the code only, is included below:

Copyright © 2017 Rise<br>
Copyright © 2016-2017 Shift<br>
Copyright © 2016-2017 Lisk Foundation<br>  
Copyright © 2015 Crypti

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
