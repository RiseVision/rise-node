## Rise-node version 1.1.1

# RISE
[![Build Status](https://travis-ci.org/RiseVision/rise-node.svg?branch=development)](https://travis-ci.org/RiseVision/rise-node) [![Coverage Status](https://coveralls.io/repos/github/RiseVision/rise-node/badge.svg?branch=development)](https://coveralls.io/github/RiseVision/rise-node?branch=development) 
## Installation

An automatic install script for Ubuntu is available.

### Wiki 

For detailed information on node installation and management please refer to the [wiki of this repository](https://github.com/RiseVision/rise-node/wiki).

### Quick start Rise installation (Mainnet)

First, perform some basic checks:

- MAKE SURE NOT TO RUN AS ROOT OR WITH SUDO
- Your user will need sudo privileges, though
- PostgresSQL must **not** be installed on your server

Then go home:

```
cd $HOME
```

Download the installer:

```
wget https://raw.githubusercontent.com/RiseVision/rise-build/master/scripts/install.sh
```

Install Rise:
```
bash install.sh install -r mainnet -u https://downloads.rise.vision/core/mainnet/latest.tar.gz
```

The installer will start the node automatically if installation was successful.

(Optional) Fast sync from a snapshot

```
cd rise
wget https://downloads.rise.vision/snapshots/mainnet/latest -O latestsnap.gz
./manager.sh restoreBackup latestsnap.gz
```

## Basic node management

Installer will create a `rise` folder in your homedir. Make sure to `cd` to this dir when managing your node.


Check the status of your node with:
```
./manager.sh status
```

Stop node with: 
```
./manager.sh stop node
```

Insert your passphrase so you can forge:
```
nano etc/node_config.json
```

And change this section to include your passphrase:
```
{
  "fileLogLevel": "error",
  "forging": {
    "secret": [ "my secret" ],
    "access": {
      "whiteList": [ "127.0.0.1" ]
    }
  }
}
```

And finally restart your node to apply the changes:
```
./manager.sh reload node
```

### Quick start Rise installation (Testnet) 
The same as above, only the install step is different:
```
bash install.sh install -r testnet -u https://downloads.rise.vision/core/testnet/latest.tar.gz
```


(Optional) Fast sync from a snapshot

```
wget https://downloads.rise.vision/snapshots/testnet/latest -O latestsnap.gz
./manager.sh restoreBackup latestsnap.gz
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
