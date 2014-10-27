build-facets
============

Provides rule based tools to separate build configuration from build scripts. 

This is heavily influenced by Android's [resource selection framework](http://developer.android.com/guide/topics/resources/overview.html).

It is designed to replace hacking up build tools their command line arguments with something more uniform and extensible.

This should allow you to use existing tools, but using paramterized build configuration. e.g.
```sh
$ PLATFORM=ios FLAVOR=production TARGET=cordova grunt run
```
All the fiddly, bespoke conditional logic to parameterize your builds is replaced an easy to understand configuration file.

This allows for manageable, re-usable build scripts that can accomodate changes in build needs as the project grows.

Minimal Example
---------------
We have a webapp which we can run in a browser, and we want to deploy it as a cordova app.

For our webapp project, we will considering a minimal project structure:
```
my_webapp
|- project.json
|- lib/
|- test/
|- resources/
|- Gruntfile.js
```
We happen to be using `grunt` here, but this works equally well with `gulp`.

In our Gruntfile, we may start by providing other tasks a directory where to put final build artifacts: 

```javascript
module.exports = function (grunt) {
  grunt.initConfig({
    dist: './build',
    // ...
```
Other tasks can then reference this path as `<%= dist %>`.

We might want to move this and other paths this into its own file, which is loaded in our build script:

```javascript
var conf = require('build-facets')(__dirname)
            .loadConfiguration('./build-config.js');
module.exports = function (grunt) {
  grunt.initConfig({
    dist: conf.get('dist-relative'),
    // ...
```

Where `build-config.js` is a module in the same directory:
```javascript
module.exports = {
  'dist-relative': './build'
};
```

Now, `dist-relative` is likely to change now we want to build for cordova.

For one reason or another (perhaps fictitious), this hasn't been a cordova app right from the start, so our cordova project is in a sub-directory:

```
my_webapp
|- project.json
|- lib/
|- test/
|- resources/
|- cordova
   |- www/
|- build-config.js
|- Gruntfile.js
```

So, now we should probably like to say in `build-config.js`:

```javascript
module.exports = {
  'dist-relative': './build',
  'dist-relative.cordova': './cordova/www'
};
```

Without any further changes to our `Gruntfile.js` we are now able to change which `dist-relative` to use, by invoking `grunt` slightly differently:

```
TARGET=cordova grunt
```

`grunt` will now use `./cordova/www` instead of `./build`.

A less minimal example
----------------------
The `cordova` project directory may not be in this `my_webapp` project directory.

Cordova itself has different options. Perhaps as part of `grunt watch` we'd like to deploy new builds to our development device.

```
my_webapp
|- project.json
|- build-config.js
|- build-config-local.js
|- Gruntfile.js
```

For the first, we need a `project-dir` to specify where the root of the cordova project is, as well as the existing `dist-relative`.

But if `project-dir` is different on my dev machine, then it'll likely be different on another dev's machine or the build server.

So it'd be good to put all these paths local to the machine in a separate file. We'll call the new file `build-config-local.js`:
```javascript
module.exports = {
  'project-dir.cordova': '/Users/me/workspaces/my-cordova-project'
};
```

For our webapp, `project-dir` is the current directory, so we can add this to our main `build-config.js` file.
```javascript
module.exports = {
  'project-dir': '.',

  'dist-relative': './build',
  'dist-relative.cordova': './www'
};
```

We need to change the beginning of our build script:

```javascript
var conf = require('build-facets')(__dirname)
            .loadConfiguration('./build-config.js')
            .mergeWith('./build-config-local.js');
module.exports = function (grunt) {
  grunt.initConfig({
    dist: conf.resolve('project-dir', 'dist-relative'),
    // ...
```

Now, when we call
```
$ TARGET=cordova grunt
```

`grunt` will use `/Users/me/workspaces/my-cordova-project/www` for `dist`.

When we call grunt on its own, 
```
$ grunt
```
`grunt` will use `./build` for `dist`.

For the second, we're going to add a task to our grunt file:

```javascript
// ...
grunt.initConfig({
  // ...
  shell: {
    runOnDevice: {
      command: conf.get('run-command'),
        options: {
          execOptions: {
            cwd: conf.resolve('project-dir')
          }
        }
    }
  },
  // ...
});
```
And add the necessary run-commands in `build-config.js`

```javascript
module.exports = {
  'project-dir': '.',

  'dist-relative': './build',
  'dist-relative.cordova': './www',

  'run-comand': 'echo "localhost already running"'
  'run-command.ios': 'cordova emulate ios',
  'run-command.android': 'cordova run android'
  }
};
```

Now we can run:

```
$ TARGET=cordova PLATFORM=android grunt build shell:runOnDevice
```
to build our webapp for the cordova project and have cordova build and deploy it to a connected Android device.

Facet Rules
-----------
These rules are project independent.

You don't have to define your own. If you don't, a [default is supplied](https://github.com/jhugman/overidify-defaults/blob/master/overidify-rules.js).

These rules defining the facets are at `./facet-rules.js`:
```javascript
module.exports = {
  'target': [ 'cordova', 'web' ],
  'platform': [ 'ios', 'android' ],
  'flavor': [ 'dev', 'stage', 'production' ]
};
```

They are a stripped down version of the defaults, and are simplified for clarity.

N.B. The Android resource selection algorithm hard codes these facet-rules, and defines and applies the variants dynamically at runtime.

We can use these rules to constuct build variants with evironment variables before running our build. 

e.g. build script is a `Gruntfile.js`. Use the above rule to build our app for Cordova, on iOS.
```sh
$ PLATFORM=ios TARGET=cordova grunt
```

Each rule defines a list of modifiers which change which value is returned.

e.g. to define the value of `config.get('a')`, a config file might contain:
```javascript
module.exports = {
  // ...
  'a': 1,
  'a.dev': 2,
  'a.ios.stage': 3,
  'a.ios': 4,
  'a.ios.production': 5,
  // ...
};
```
For the variant `platform=ios, flavor=production`:
 - the key `a.ios` matches only the `platform` rule
 - the key `a.ios.stage` contradicts the `flavor` rule and is not chosen
 - the key `a.ios.production` matches both `platform` and `flavor` rules.

The more specific the match the better.

There are other rule types which describe fallbacks and synonyms.

Using the configuration
------------
Once the configuration has been loaded, we can use it to look up values with simple keys.

The keys are completely project dependent (i.e. up to us to define and use). In this case, we are using `project-dir`, `dist-relative` and `run`. These will be defined in the build-configuration, below.

The options from the variant is used to choose exactly which values are returned.

```javascript
// Calling path.resolve on the values for project-dir and dist-relative
var dist = config.resolve('project-dir', 'dist-relative');
                                     // /Users/me/workspaces/my-cordova-project/www
// in a child_process, 
// cd into the project-dir, 
// then call the run command.
var dir = config.get('project-dir'), // /Users/me/workspaces/my-cordova-project
    runCommand = config.get('run-command'),  // cordova emulate ios
    cmd = 'cd ' + dir +' && ' + runCommand;
    
 
child_process.exec(cmd, handler);
```

The comments showing values are for the build variant `platform=ios` and `target=cordova`, using the build configuration below.

None of the conditional logic for working out how to deal with the specific variant is present.


Loading the configuration
-------------------------
We can minimally, we can load the build configuration with the following incantations.

```javascript
// Now load the config itself.
var config =
    require('build-facets')(__dirname)
     // Load configuration from the build-config module,
     .loadConfiguration('./build-config.js')
     // and merge it with a local.js module.
     .mergeWith('./build-config-local.js');
```


```javascript
var facets = 
    require('build-facets')(__dirname)
     
     // Optionally, load the rules from the build-facets.js 
     // module, defined above, in the package directory.
     .loadRules('./facet-rules.js');
     
     // Then look for environment variables 
     // defining the variant.
     .loadVariantFromEnv();

// Now load the config itself.
var config =
    facets
     // Load configuration from the build-config module,
     .loadConfiguration('./build-config.js')
     // and merge it with a local.js module.
     .mergeWith('./build-config-local.js');
```

Configuration comes from two places:
 - the facet rules (defaults are available).
 - the build configurations, which use the rules

Build Configuration
-------------------
The build configuration is split over two files. The build script determines which files make up the build config.

It doesn't have to split over multiple files, but there are sound engineering reasons to do so.

The first is at `./build-config.js`:
```javascript
module.exports = {
  'project-dir': {
    'web': '.'
  },
  'dist-relative': {
    'web': 'build',
    'cordova': 'www'
  },
  'run-command': {
    'ios': 'cordova emulate ios',
    'android': 'cordova run android'
    '': 'echo \"No need for run task\" && exit 1'
  }
};
```

The second is at `build-config-local.js`. This is for paths outside this repository, and so shouldn't be checked in to source control:
```javascript
module.exports = {
  'project-dir': {
    'cordova': '/Users/me/workspaces/my-cordova-project'
   }
};
```

The keys in these objects are made up of:
 - The keys asked for in the build-script, i.e. `project-dir`, `dist-relative` or `run`
 - One of the modifiers used to define `facet-rules.js`.
 - A build-script key, combined with zero or more modifier suffixes.

Further use
===========


Flexible configuration styles
-----------------------------
When configuration objects are loaded, they are flattened into a simple object; the keys from nested objects have the key path to the object appended.

This is so:
  - configurations are trivially mergeable.
  - developer/devops can manage their configs in their preferred style.

For example, the following two build-config files encode the same information, namely the `api-url` for the deployment  flavor `dev`, `stage` and `production`.

```javascript
module.exports = {
  'api-url': {
    'dev'  : 'localhost:8080/api',
    'stage': 'stage.example.com/api',
    'production': 'example.com/api'
  }
};
```

The second is encourages less structured, but more leads to more easily copy/pastable configuration. e.g. to add another deployment environment.
```javascript
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

Both map to the same object, which is also acceptable.
```javascript
module.exports = {
  'api-url.dev'  : 'localhost:8080/api',
  'api-url.stage': 'stage.example.com/api',
  'api-url.production': 'example.com/api'
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

// You can also set the variant diectly.
facets.buildVariant = {
  platform: 'ios',
  target: 'cordova',
  flavor: 'production'
};

// Load the buildConfig,
var buildConfig = facets
    // Looks in package.json for a property called 'platforms'.
    // Resolve as above. Normalize the resulting object.
    .loadConfigurationFromPackageJson('platforms')
    // Look for the module at buildConfig.get('local').
    // Normalize the exports, 
    // and return a config with the two objects merged.
    .mergeFileFromProperty('local');
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

`build-facets` is intended for build-time, and much less complicated. Nevertheless, the following analogies can be made:

 - the facet rules: map to Android's precise ontology of modfiers, i.e. the complete set of available modifiers, and their fallback rules.
 - the build script - map to app code using the `R` and `Resources` classes.
 - the build configuration - map to the `res` directory.
 - the build variant as defined by environmnt variables: maps to the Android device configuration and runtime state.
