'use strict';
var _ = require('lodash'),
    path = require('path'),
    facets = require('strings-with-facets'),
    FacetMap = facets.Map;

module.exports = function (rootDirectory) {
  var facetRules;
  return {
    buildVariant: undefined,

    loadRules: function (moduleName) {
      var raw = loadObjectFromModule(rootDirectory, moduleName);
      facetRules = facets.createRules(raw);
    },
    loadRulesFromPackageJson: function (propertyName) {
      var raw = loadObjectFromPkgJson(rootDirectory, propertyName);
      facetRules = facets.createRules(raw);
    },
    loadVariantFromEnv: function (envVarPrefix) {
      this.buildVariant = {};
    },
    loadConfiguration: function (moduleName) {
      var obj = loadObjectFromModule(rootDirectory, moduleName);
      return createBuildConfig(rootDirectory, this.buildVariant, facetRules, obj);
    },
    loadConfigurationFromPackageJson: function (propertyName) {
      var obj = loadObjectFromPkgJson(rootDirectory, propertyName);
      return createBuildConfig(rootDirectory, this.buildVariant, facetRules, obj);
    },
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
  merge: function (moduleName) {
    var newMap = this._map.mergeWith(
      loadObjectFromModule(this._cwd, moduleName)
    );
    return new BuildConfig(this._cwd, newMap);
  },
  mergeFromProperty: function (propertyName) {
    // We can assume that because FacetMap's IR is a simple object (no object values),
    // this.get() will return a string or number.
    // TODO more error reporting around non-string values.
    var newMap = this._map.mergeWith(
      loadObjectFromModule(
        this._cwd, 
        this.join(arguments)
      )
    );
    return new BuildConfig(this._cwd, newMap);
  },
});

function createBuildConfig (directory, variant, rules, obj) {
  return new BuildConfig(
    directory, 
    new FacetMap(variant, rules, obj)
  );
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

