module.exports = {
  'web': {
    'project-dir': '.',
    'js-dist': 'build'
  },
  'cordova': {
    'js-dist': 'www'
  },
  'run.ios': 'cordova emulate ios',
  'run.android': 'cordova run android',
  'run': 'echo \"No need for run task\" && exit 1',

  'local': './local'
};