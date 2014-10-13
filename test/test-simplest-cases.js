'use strict';

var test = require('tap').test,
    path = require('path');

var buildFacets = require('../lib/api');

var projectPath = [
  path.join(__dirname, 'fixtures', 'test-project-1'),
  path.join(__dirname, 'fixtures', 'test-project-2')
];

test('Configure, load and merge directly', function (t) {
  var facets = buildFacets(projectPath[0]);
  t.ok(facets);
  facets.loadRules('./facet-rules');
  facets.buildVariant = {
    target: 'cordova',
    platform: 'ios',
    flavor: 'dev'
  };

  var buildConfigInitial = facets.loadConfiguration('./build-config');
  t.equal(buildConfigInitial.get('run'), 'cordova emulate ios');

  var buildConfigMerged = buildConfigInitial.merge('./local');
  t.equal(buildConfigMerged.get('project-dir'), '/Users/me/workspaces/my-cordova-project');

  t.end();
});

test('Compare and contrast 1', function (t) {
  var facets = buildFacets(projectPath[0]);
  facets.loadRules('./facet-rules');
  facets.buildVariant = {
    target: 'web',
    flavor: 'dev'
  };
  
  // The rules and config stays the same. Only the build variant changes.
  var buildConfig = facets.loadConfiguration('./build-config').merge('./local');
  
  t.equal(buildConfig.get('project-dir'), '.');
  t.equal(buildConfig.get('js-dist'),     'build');

  t.equal(buildConfig.get('run'),         'echo \"No need for run task\" && exit 1');

  t.equal(buildConfig.join('project-dir', 'js-dist'), 'build');
  t.equal(buildConfig.resolve('project-dir', 'js-dist'), path.resolve(projectPath[0], 'build'));
  t.end();
});

test('Compare and contrast 2', function (t) {
  var facets = buildFacets(projectPath[0]);
  facets.loadRules('./facet-rules');
  facets.buildVariant = {
    target: 'cordova',
    platform: 'android',
    flavor: 'dev'
  };
    
  // The rules and config stays the same. Only the build variant changes.
  var buildConfig = facets.loadConfiguration('./build-config').merge('./local');

  t.equal(buildConfig.get('project-dir'), '/Users/me/workspaces/my-cordova-project');
  t.equal(buildConfig.get('js-dist'),     'www');

  t.equal(buildConfig.get('run'),         'cordova run android');

  t.equal(buildConfig.join('project-dir', 'js-dist'),    path.join('/Users/me/workspaces/my-cordova-project', 'www'));
  t.equal(buildConfig.resolve('project-dir', 'js-dist'), path.resolve('/Users/me/workspaces/my-cordova-project', 'www'));
  t.end();
});


test('Configure, load and merge indirectly', function (t) {
  var facets = buildFacets(projectPath[1]);
  t.ok(facets);
  facets.loadRulesFromPackageJson('facet-rules');
  facets.buildVariant = {
    target: 'cordova',
    platform: 'ios',
    flavor: 'dev'
  };

  var buildConfigInitial = facets.loadConfigurationFromPackageJson('build-config');
  t.equal(buildConfigInitial.get('run'), 'cordova emulate ios');

  var buildConfigMerged = buildConfigInitial.mergeFromProperty('local');
  t.equal(buildConfigMerged.get('project-dir'), '/Users/me/workspaces/my-cordova-project');

  t.end();
});

