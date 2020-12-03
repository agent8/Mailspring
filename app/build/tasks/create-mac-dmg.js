const path = require('path');
const createDMG = require('electron-installer-dmg');

module.exports = grunt => {
  grunt.registerTask('create-mac-dmg', 'Create DMG for EdisonMail', function pack() {
    const done = this.async();
    const dmgPath = path.join(grunt.config('outputDir'), 'Email Client for Gmail.dmg');
    const isMas = grunt.option('is-mas');
    if (isMas) {
      console.log('mas version no need to build dmg');
      return;
    }
    createDMG(
      {
        appPath: path.join(
          grunt.config('outputDir'),
          'Email Client for Gmail-darwin-x64',
          'Email Client for Gmail.app'
        ),
        name: 'Email Client for Gmail',
        background: path.resolve(
          grunt.config('appDir'),
          'build',
          'resources',
          'mac',
          'installer-background.png'
        ),
        icon: path.resolve(
          grunt.config('appDir'),
          'build',
          'resources',
          'mac',
          'EdisonMailAppIcon.icns'
        ),
        overwrite: true,
        out: grunt.config('outputDir'),
        iconSize: 114,
        contents: function(opts) {
          return [
            { x: 494, y: 280, type: 'link', path: '/Applications' },
            { x: 164, y: 280, type: 'file', path: opts.appPath },
          ];
        },
      },
      err => {
        if (err) {
          done(err);
          return;
        }

        grunt.log.writeln(`>> Created ${dmgPath}`);
        done(null);
      }
    );
  });
};
