'use strict';
var _ = require('lodash'),
    path = require('path'),
    facets = require('strings-with-facets'),
    FacetMap = facets.Map;

module.exports = function (rootDirectory) {
  var facetRules = facets.createRules(require('overidify-defaults'));
  return {
    buildVariant: undefined,

    loadRules: function (moduleName) {
      var raw = loadObjectFromModule(rootDirectory, moduleName);
      facetRules = facets.createRules(raw);
      return this;
    },
    loadRulesFromPackageJson: function (propertyName) {
      var raw = loadObjectFromPkgJson(rootDirectory, propertyName);
      facetRules = facets.createRules(raw);
      return this;
    },
    loadVariantFromEnv: function (envVarPrefix) {
      var envOpt = require('env-opt');
      this.buildVariant = envOpt(facetRules.rules, envVarPrefix);
    },
    loadConfiguration: function (moduleName) {
      return this._loadConfiguration(moduleName, loadObjectFromModule);
    },
    loadConfigurationFromPackageJson: function (propertyName) {
      return this._loadConfiguration(propertyName, loadObjectFromPkgJson);
    },
    _loadConfiguration: function (name, loader) {
      if (!this.buildVariant) {
        this.loadVariantFromEnv();
      }
      var obj = loader(rootDirectory, name);
      return createBuildConfig(rootDirectory, this.buildVariant, facetRules, obj);
    }
  };

};

///////////////////////////////////////////////////////////////////////
function BuildConfig (directory, map) {
  this._map = map;
  this._cwd = directory;
};

_.extend(BuildConfig.prototype, {
  get: function (propertyName) {
    return this._map.get(propertyName);
  },
  join: function (propertyNames) {
    var args = mapVarArgs(this._map, arguments);
    return path.join.apply(path, args);
  },
  resolve: function (propertyNames) {
    return path.resolve(this._cwd, this.join(arguments));
  },

  _merge: function (object) {
    var newMap = this._map.mergeWith(object);
    var config = new BuildConfig(this._cwd, newMap);
    config.buildVariant = this.buildVariant;
    return config;
  },

  merge: function (moduleName) {
    return this._merge(loadObjectFromModule(this._cwd, moduleName));
    
  },
  mergeFromProperty: function (propertyName) {
    // We can assume that because FacetMap's IR is a simple object (no object values),
    // this.get() will return a string or number.
    // TODO more error reporting around non-string values.
    return this._merge(
      loadObjectFromModule(
        this._cwd, 
        this.join(arguments)
      )
    );
  },
  mergeFromPackageJson: function (propertyName) {
    // We can assume that because FacetMap's IR is a simple object (no object values),
    // this.get() will return a string or number.
    // TODO more error reporting around non-string values.
    var newMap = this._map.mergeWith(
      loadObjectFromPkgJson(
        this._cwd, 
        this.join(arguments)
      )
    );
    return new BuildConfig(this._cwd, newMap);
  },
});

BuildConfig.prototype.mergeWith = BuildConfig.prototype.merge;
BuildConfig.prototype.loadConfiguration = BuildConfig.prototype.merge;
BuildConfig.prototype.loadConfigurationFromProperty = BuildConfig.prototype.mergeFromProperty;
BuildConfig.prototype.loadConfigurationFromPackageJson = BuildConfig.prototype.mergeFromPackageJson;



function createBuildConfig (directory, variant, rules, obj) {
  var config = new BuildConfig(
    directory, 
    new FacetMap(variant, rules, obj)
  );
  config.buildVariant = variant;

  return config;
}

///////////////////////////////////////////////////////////////////////
function loadObjectFromPropertyValue (dir, property) {
  if (_.isString(property)) {
    return loadObjectFromModule(dir, property);
  } else if (_.isObject(property) && !_.isArray(property)) {
    return property;
  }
}

function loadObjectFromPkgJson (dir, propertyName) {
  var pkgJson = loadObjectFromModule(dir, 'package.json');
  var property = pkgJson[propertyName];
  return loadObjectFromPropertyValue(dir, property);
}

function loadObjectFromModule (dir, moduleName) {
  console.log('require: ' + path.resolve(dir, moduleName));
  return require(path.resolve(dir, moduleName));
}
///////////////////////////////////////////////////////////////////////
function mapVarArgs (map, args) {
  return _.chain(args)
    .toArray()
    .flatten()
    .map(function (k) {
      return map.get(k);
    })
    .compact()
    .value();
}
///////////////////////////////////////////////////////////////////////

