build-facets
============

Provides rule based tools to separate build configuration from build scripts. 

This is heavily influenced by Android's [resource selection framework](http://developer.android.com/guide/topics/resources/overview.html).

Configuration of the build comes from three places:

 - the facet rules.
 - the build script.
 - the build configurations.

```sh
$ PLATFORM=ios FLAVOR=production TARGET=cordova grunt run
```

This allows for manageable, re-usable build scripts that can accomodate changes in build needs.

As the project grows, it is the build configuration that grows most. The build scripts stay small. 

Facet Rules
-----------
These rules defining the facets are at `./facet-rules.js`:
```javascript
module.exports = {
  'target': [ 'cordova', 'web' ],
  'platform': [ 'ios', 'android' ],
  'flavor': [ 'dev', 'test', 'stage', 'production' ]
};
```

We use these rules to define individual build variants.

N.B. The Android resource selection algorithm hard codes these facet-rules, and defines and applies the variants dynamically at runtime.


Build script
------------
`build-facets` is meant to be build-system agnostic, and is more about providing paths and configuration to an existing build script.
```javascript
var facets = require('build-facets')(__dirname);
facets.loadRules('./facet-rules.js');
// Looks for environment variables defining the variant.
facets.loadVariantFromEnv();

// load an on object a js file, and merge it with 
// a local.js module (e.g. for paths outside of this module)
var buildConfig = facets.load('./build-config.js').merge('./local.js');
```

Once the configuration has been loaded, we can use it to look up values with simple keys.

The options from the variant is used to choose exactly which values are returned.

```javascript
// Using the configuration.
var relativeDist = buildConfig.get('js-dist');
// absolute path joining  
var dist = buildConfig.join('project-dir', 'js-dist');


var dir = buildConfig.get('project-dir'),
    runCommand = buildConfig.get('run'),
    cmd = 'cd ' + dir +' && ' + runCommand;
child_process.exec(cmd, handler);
```

Build Configuration
-------------------
The build config files are in two parts.

The first is at `./build-config.js`:
```javascript
module.exports = {
  'web': {
    'project-dir': '.',
    'js-dist': 'build'
  },
  'cordova': {
    'js-dist': 'www'
  },
  'run.ios': 'cordova emulate ios',
  'run.android': 'cordova run android'
  'run': 'echo \"No need for run task\" && exit 1'
};
```

The second is at `local.js`. This is for paths outside this repository, and so shouldn't be checked in to source control:
```javascript
module.exports = {
  'project-dir-cordova': '~/workspaces/my-cordova-project'
};
```

Further use
===========


Build Configuration Normalization
---------------------------------
To allow flexibility of configuration styles, the objects are flattened into a simple object, with complex objects mapped replaced with key paths represented as key suffixes.

```javascript
module.exports = {
  'api-url.dev'  : 'localhost:8080/api',
  'api-url.stage': 'stage.example.com/api',
  'api-url.production': 'example.com/api'
};
module.exports = {
  'api-url': {
    'dev'  : 'localhost:8080/api',
    'stage': 'stage.example.com/api',
    'production': 'example.com/api'
  }
};
module.exports = {
    'dev'  : { 
      'api-url': 'localhost:8080/api' 
    },
    'stage': { 
      'api-url': 'stage.example.com/api' 
    },
    'production': { 
      'api-url': 'example.com/api' 
    }
  }
};
```


Loading rules and configuration via package.json
-----------------------------------------
To allow interoperability with other tools using the same rules (e.g. [overidify](https://github.com/jhugman/overidify)), you can load the rules 
from a property in `package.json`.

```javascript
// Get facets for this directory.
var facets = require('build-facets')(__dirname);

// Looks in package.json for a property called 'overidify'.
// If it's a string treat it like a module name to be required.
// If it's an object, use that.
// Otherwise, use defaults.
facets.loadRulesFromPackageJson('overidify');

// Load the buildConfig,
var buildConfig = facets
    // Looks in package.json for a property called 'platforms'.
    // Resolve as above. Normalize the resulting object.
    .loadFromPackageJson('platforms')
    // Look for the module at buildConfig.get('local').
    // Normalize the exports, 
    // and return a config with the two objects merged.
    .mergeFileAt('local');

// You can also set the variant diectly.
facets.buildVariant = {
  platform: 'ios',
  target: 'cordova',
  flavor: 'production'
};
```

Comparision with Android's `res` system
===================================
Android `res` directory contains a series of directories with zero or more modifier suffixes defining conditions when that directory's content is used over the alternatives.

e.g.
```
res/
 - drawable
   - my_icon.png
 - drawable-mdpi
   - my_icon.png
 - drawable-hdpi
   - my_icon.png
 - drawable-hdpi-land
   - my_icon.png
 - drawable-xhdpi
   - my_icon.png
```

The app code only references the name of the icon:
```java
  imageView.setDrawable(R.drawable.my_icon);
```

At runtime, Android chooses which icon the app uses, depending on the device state, in this case pixel density.

Note that in this example, if the device is high dpi (hdpi), there is a different version of the icon for portrait and landscape.

The app code does not need to know anything of neither the device state nor the asset resources available, just that when it asks for a specific one it gets the most appropriate version of the asset available.

`build-facets` is intended for build-time, and much less complicated. Nevertheless, comparisons can be drawn:

 - the complete set of available modifiers, and how they relate is defined by the Android SDK. `build-facets` expects them to be defined, either by you or a simple default.
 - the res directory works with files and directories. `build-facets` work with javascript key-value objects.
 - the device state is used at runtime. `build-facets` use environment variables at build time. The precise combinations is called the build variant.
 - the java code contains a simple reference. `build-facets` allows build scripts to only have simple key names, without worrying about build variants.
