# RISE Node Core: Launchpad

The RISE node launchpad module initializes the Application and starts / gracefully shuts down the node

## Overview

The Launchpad loads the submodules of the RISE node core and properly initializes them by providing a lifecycle for the submodules to initialize within. The `AppManager` allows submodules to add their exports to the inversion of control container so that other submodules may use their exports as dependencies within their own services through dependency injection. See [Inversify](http://inversify.io/) for more information on how this works. In addition, the module provides a binary to start the application through the command line, and a logging utility to monitor the node.

## Module Lifecycle

* `module.extendCommander`: add options to CLI
* `module.afterConfigValidation`: patch configuration of module with CLI parameters
* `module.addElementsToContainer`: add providers to container
* `module.initAppElements`: initialize service providers with dependencies
* `module.preBoot`: pre boot routine / initialization
* `module.boot`: boot module
* `module.teardown`: shutdown module
* `module.postTeardown`: cleanup module

## Interfaces

* `BaseCoreModule`: Base module to extend for modules

## Hook Actions

* `OnInitContainer`: After container has been initialized
* `OnFinishBoot`: After modules have been booted

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

